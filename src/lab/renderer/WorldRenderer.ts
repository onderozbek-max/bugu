/**
 * Canvas 2D renderer for the V2 visual laboratory.
 *
 * Runs its own requestAnimationFrame loop — deliberately decoupled from React
 * state. React mounts/unmounts the canvas; this class owns all drawing.
 *
 * Visual system overview:
 *   - 5–6 oval "pools" per phase, organized into far/mid/near depth layers.
 *   - Screen-blend compositing on near-black creates luminous depth without
 *     additive brightness from overlaps.
 *   - Strong radial vignette on top with multiply blend for cinematic framing.
 *   - Per-pool spring physics for transient-driven displacement kicks.
 *   - Depth-parallax: audio energy modulates apparent layer separation.
 *   - Chromatic separation on near-layer pools during strong transients.
 *   - Partial-clear trail each frame for atmospheric motion blur.
 *
 * Performance notes:
 *   - 5–6 filled arc + radial-gradient ops per frame at 60fps is well within
 *     Canvas 2D capacity on modern mobile (well under 2ms of GPU time).
 *   - No per-pixel computation; no external textures; no CSS filter on the
 *     canvas element (avoids compositing-layer issues on mobile Safari).
 *   - If a frame takes longer than 25ms, the renderer simply draws less
 *     frequently — rAF naturally throttles to display refresh rate.
 */

import type { PhaseConfig, PoolConfig } from "./worldConfig";
import type { AudioSignals } from "./AudioAnalyzer";

interface PoolState {
  x: number;          // current position (fraction of width)
  y: number;          // current position (fraction of height)
  rotation: number;   // current rotation (radians)
  dispX: number;      // spring displacement (pixels)
  dispY: number;
  velX: number;       // spring velocity (pixels/s)
  velY: number;
  scaleX: number;     // current radius multiplier
  scaleY: number;
  chromatic: number;  // chromatic-separation magnitude (fraction of height)
  chromaticDecay: number;
}

const SPRING_STIFFNESS = 14;  // oscillation speed
const SPRING_DAMPING   = 0.62; // per-frame damping exponent base

// Detect once at module load — doesn't change during the session.
const PREFERS_REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class WorldRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private config: PhaseConfig | null = null;
  private poolStates: PoolState[] = [];
  private raf: number | null = null;
  private lastTimestamp: number | null = null;
  private elapsed = 0;           // total time since start (seconds)
  private isPlaying = false;
  private prevTransient = 0;

  private getSignals: (() => AudioSignals) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  setConfig(config: PhaseConfig): void {
    this.config = config;
    this.initPoolStates(config.pools);
  }

  setSignalsProvider(fn: (() => AudioSignals) | null): void {
    this.getSignals = fn;
  }

  setPlaying(playing: boolean): void {
    this.isPlaying = playing;
  }

  start(): void {
    if (this.raf !== null) return;
    this.lastTimestamp = null;
    this.raf = requestAnimationFrame(this.onFrame);
  }

  stop(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = this.canvas.offsetWidth  * dpr;
    this.canvas.height = this.canvas.offsetHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private initPoolStates(pools: PoolConfig[]): void {
    this.poolStates = pools.map((p) => ({
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      dispX: 0, dispY: 0,
      velX: 0,  velY: 0,
      scaleX: 1, scaleY: 1,
      chromatic: 0,
      chromaticDecay: 0,
    }));
  }

  private onFrame = (timestamp: number): void => {
    const dt = this.lastTimestamp === null
      ? 0
      : Math.min((timestamp - this.lastTimestamp) / 1000, 0.05); // cap at 50ms
    this.lastTimestamp = timestamp;
    this.elapsed += dt;

    if (this.config && this.poolStates.length > 0) {
      const signals = this.getSignals?.() ?? null;
      this.update(dt, signals);
      this.draw(signals);
    }

    this.raf = requestAnimationFrame(this.onFrame);
  };

  // ─── Update (physics + audio response) ───────────────────────────────────

  private update(dt: number, signals: AudioSignals | null): void {
    const config = this.config!;
    const pools  = config.pools;
    const w      = this.canvas.offsetWidth;
    const h      = this.canvas.offsetHeight;
    const t      = this.elapsed;

    // Transient pulse: how much transient *increased* this frame
    const transient     = signals?.transient ?? 0;
    const transientDiff = Math.max(0, transient - this.prevTransient - 0.04);
    this.prevTransient  = transient;

    // Depth separation: base + audio modulation
    // DÜN  (energyDepthK < 0): bass compresses layers together
    // YARIN (energyDepthK > 0): energy pushes layers apart
    let depthSep = config.depthParallax;
    if (signals) {
      depthSep += signals.bass * config.energyDepthK;
      depthSep  = Math.max(0.005, depthSep);
    }

    const driftScale = PREFERS_REDUCED_MOTION ? 0.08 : 1.0;

    for (let i = 0; i < pools.length; i++) {
      const p = pools[i];
      const s = this.poolStates[i];

      // ── Autonomous drift ────────────────────────────────────────────────
      const driftX = Math.sin(t * p.driftXFreq + p.driftXPhase) * p.driftXAmp * driftScale;
      const driftY = Math.cos(t * p.driftYFreq + p.driftYPhase) * p.driftYAmp * driftScale;
      const driftR = Math.sin(t * p.rotDriftFreq + p.rotDriftPhase) * p.rotDriftAmp * driftScale;

      // ── Depth-parallax offset ───────────────────────────────────────────
      // Near pools (depth→1) shift more than far pools (depth→0) when audio
      // energy is high. The differential creates apparent 3D depth separation.
      const energy = signals?.energy ?? 0;
      const bass   = signals?.bass ?? 0;
      const parallaxX = (p.depth - 0.5) * depthSep * energy;
      const parallaxY = (p.depth - 0.5) * depthSep * 0.35 * bass;

      // ── Spring physics for transient kick ───────────────────────────────
      if (transientDiff > 0 && !PREFERS_REDUCED_MOTION && this.isPlaying) {
        const strength = transientDiff * config.transientStrength * h * (1 + p.depth * 0.9);
        s.velX += p.dispDirX * strength;
        s.velY += p.dispDirY * strength;
      }
      // Damped spring toward origin
      s.velX += (0 - s.dispX) * SPRING_STIFFNESS * dt;
      s.velY += (0 - s.dispY) * SPRING_STIFFNESS * dt;
      const dampFactor = Math.pow(SPRING_DAMPING, dt * 60);
      s.velX *= dampFactor;
      s.velY *= dampFactor;
      s.dispX += s.velX * dt;
      s.dispY += s.velY * dt;

      // ── Final position ──────────────────────────────────────────────────
      s.x        = p.x + driftX + parallaxX + s.dispX / w;
      s.y        = p.y + driftY + parallaxY + s.dispY / h;
      s.rotation = p.rotation + driftR;

      // ── Radius scaling (shape breathes with audio) ──────────────────────
      let tSX = 1.0, tSY = 1.0;
      if (signals && !PREFERS_REDUCED_MOTION) {
        if (p.depth > 0.8) {
          // Near: responsive to mid frequencies (human/intimate range)
          tSX = 1.0 + signals.mid  * 0.28;
          tSY = 1.0 + signals.mid  * 0.20;
        } else if (p.depth > 0.35) {
          // Mid: overall energy
          tSX = 1.0 + signals.energy * 0.16;
          tSY = 1.0 + signals.energy * 0.12;
        } else {
          // Far: bass (deep, slow, expansive)
          tSX = 1.0 + signals.bass * 0.24;
          tSY = 1.0 + signals.bass * 0.18;
        }
      }
      s.scaleX += (tSX - s.scaleX) * 0.09;
      s.scaleY += (tSY - s.scaleY) * 0.09;

      // ── Chromatic separation (near pools on strong transients) ──────────
      if (p.depth > 0.8 && transientDiff > 0.12 && !PREFERS_REDUCED_MOTION && this.isPlaying) {
        s.chromatic      = Math.min(0.026, transientDiff * 0.038);
        s.chromaticDecay = 0.86;
      }
      if (s.chromatic > 0.0005) {
        s.chromatic      *= s.chromaticDecay;
        s.chromaticDecay *= 0.89;
      } else {
        s.chromatic      = 0;
        s.chromaticDecay = 0;
      }
    }
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────

  private draw(signals: AudioSignals | null): void {
    const config = this.config!;
    const ctx    = this.ctx;
    // Use logical pixels (CSS pixels), not physical — ctx.scale(dpr) in resize()
    const w      = this.canvas.offsetWidth;
    const h      = this.canvas.offsetHeight;

    // ── Trail / partial clear ────────────────────────────────────────────
    // Painting background at <1 alpha creates motion trails: bright
    // elements fade out over several frames rather than vanishing instantly.
    // High energy tightens the trail (more responsive); quiet passages
    // let the trail linger (more atmospheric).
    let trailA = config.trailAlpha;
    if (signals) {
      trailA += signals.energy * (1 - config.trailAlpha) * 0.38;
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `hsla(${config.bgH}, ${config.bgS}%, ${config.bgL}%, ${trailA})`;
    ctx.fillRect(0, 0, w, h);

    // ── Pools: far → near, screen blend ─────────────────────────────────
    ctx.globalCompositeOperation = "screen";
    const pools = config.pools;

    for (let i = 0; i < pools.length; i++) {
      const p = pools[i];
      const s = this.poolStates[i];

      // Alpha scaled by audio frequency band appropriate to this depth layer
      let alphaScale = 0.62;
      if (signals) {
        if (p.depth > 0.8) {
          alphaScale = 0.72 + signals.mid    * 0.44; // near: mid-frequency band
        } else if (p.depth > 0.35) {
          alphaScale = 0.68 + signals.energy * 0.38; // mid: overall energy
        } else {
          alphaScale = 0.58 + signals.bass   * 0.50; // far: bass band
        }
      }
      const alpha = p.alpha * alphaScale;

      const cx = s.x * w;
      const cy = s.y * h;
      const rx = p.rx * h * s.scaleX;
      const ry = p.ry * h * s.scaleY;

      if (s.chromatic > 0.002) {
        // Chromatic separation: draw R, G, B channels offset slightly
        const off = s.chromatic * h;
        this.drawPool(cx + off * 0.6,  cy + off * 0.3,  rx, ry, s.rotation,
          p.hue + 14, p.sat, p.lit, alpha * 0.72);
        this.drawPool(cx - off * 0.45, cy - off * 0.55, rx, ry, s.rotation,
          p.hue - 18, p.sat, p.lit, alpha * 0.72);
        this.drawPool(cx,              cy,               rx, ry, s.rotation,
          p.hue, p.sat, p.lit, alpha);
      } else {
        this.drawPool(cx, cy, rx, ry, s.rotation, p.hue, p.sat, p.lit, alpha);
      }
    }

    // ── Vignette: multiply darkens edges, leaving center exposed ─────────
    // This is the key visual differentiator from V1 PersistentWorld (no vignette).
    // Creates cinematic framing and depth of field — focus toward center.
    ctx.globalCompositeOperation = "multiply";
    const vCx = w * 0.5;
    const vCy = h * 0.5;
    const vInner = h * 0.28;
    const vOuter = h * 0.92;
    const vignette = ctx.createRadialGradient(vCx, vCy, vInner, vCx, vCy, vOuter);
    // Multiply with white = no change; multiply with black = full darken
    vignette.addColorStop(0.0,  "rgba(255,255,255,1)");
    vignette.addColorStop(0.55, "rgba(180,180,180,1)");
    vignette.addColorStop(0.82, "rgba( 60, 60, 60,1)");
    vignette.addColorStop(1.0,  "rgba(  0,  0,  0,1)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Reset for next frame
    ctx.globalCompositeOperation = "source-over";
  }

  /**
   * Draw a single oval luminous pool using an axis-aligned radial gradient
   * scaled into an ellipse via ctx.scale(). Four gradient stops create a
   * natural-looking light volume: bright core fading to transparent edge,
   * with a non-linear falloff that avoids the "flat circle with glow edge"
   * look of a simple 2-stop gradient.
   */
  private drawPool(
    cx: number, cy: number,
    rx: number, ry: number,
    rotation: number,
    hue: number, sat: number, lit: number, alpha: number
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.scale(1, ry / rx); // circle → ellipse in the rotated frame

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0.00, `hsla(${hue}, ${sat}%, ${lit}%,       ${alpha})`);
    grad.addColorStop(0.30, `hsla(${hue}, ${sat}%, ${lit * 0.78}%, ${alpha * 0.58})`);
    grad.addColorStop(0.65, `hsla(${hue}, ${sat}%, ${lit * 0.52}%, ${alpha * 0.20})`);
    grad.addColorStop(1.00, `hsla(${hue}, ${sat}%, ${lit * 0.30}%, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
