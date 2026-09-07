/**
 * V2 Canvas 2D Renderer — Structural Form System.
 *
 * Renders abstract structural forms (closed bezier paths) at different virtual
 * depths with proper occlusion, directional lighting gradients, and luminous
 * edge strokes on near-field elements.
 *
 * ARCHITECTURE:
 *   - Completely decoupled from React. No state, no setState, no context.
 *   - Own rAF loop started/stopped by the lab React component.
 *   - All coordinates in logical CSS pixels; DPR handled in resize().
 *   - Audio signals read once per frame from a provided getter function.
 *
 * DEPTH SYSTEM:
 *   Forms drawn far→near. Each form's `fillAlpha` creates partial transparency
 *   so deeper forms bleed through, while high-depth (near) forms still dominate.
 *   The `source-over` composite for fills means near forms genuinely occlude far.
 *   Edge strokes use `screen` blend for luminous crispness without covering the fill.
 *
 * VISUAL DIFFERENTIATORS FROM V1:
 *   1. Bezier polygon shapes — not radial-gradient circles.
 *   2. Directional (linear) gradient fill — not center-radiating glow.
 *   3. Proper depth occlusion (far forms hidden behind near forms).
 *   4. Luminous edge stroke on near forms only.
 *   5. Strong vignette (multiply) for cinematic framing.
 *   6. Authored time-based moments that change inter-form relationships.
 *   7. Audio changes inter-form separation, not whole-form scale.
 */

import type { PhaseConfig, FormConfig, AuthoredMoment } from "./worldConfig";
import type { AudioSignals } from "./AudioAnalyzer";

// Smooth interpolation
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Convert Catmull-Rom anchor points to cubic bezier segments.
 * Returns an array of {cp1x, cp1y, cp2x, cp2y, x, y} for use with
 * ctx.bezierCurveTo().
 */
function catmullRomToBezier(
  pts: [number, number][],
  w: number, h: number,
  tension = 0.5
): { cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number }[] {
  const n = pts.length;
  const result = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    // Control points in canvas logical pixels
    const cp1x = p1[0] * w + (p2[0] - p0[0]) * w * tension / 6;
    const cp1y = p1[1] * h + (p2[1] - p0[1]) * h * tension / 6;
    const cp2x = p2[0] * w - (p3[0] - p1[0]) * w * tension / 6;
    const cp2y = p2[1] * h - (p3[1] - p1[1]) * h * tension / 6;
    result.push({ cp1x, cp1y, cp2x, cp2y, x: p2[0] * w, y: p2[1] * h });
  }
  return result;
}

interface FormState {
  /** Per-form spring displacement (pixels) for transient kicks */
  dispX: number;
  dispY: number;
  velX:  number;
  velY:  number;
  /** Current effective fillAlpha (modified by authored fade-ins) */
  effectiveAlpha: number;
  /** Current energy-driven drift offset (pixels) */
  energyOffX: number;
  energyOffY: number;
}

const PREFERS_REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Softer spring: K=3 → natural period ~2.1s, kick displacement visible for ~0.8s.
// Old K=12 damped to <1px in 3 frames — visually zero. This is the bug.
const SPRING_K    = 3.0;
// 0.94 per frame at 60fps → velocity halves every ~11 frames (~0.18s).
// Old 0.60 per frame → halved every 1 frame — impossible to see.
const SPRING_DAMP = 0.94;

export class WorldRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private config: PhaseConfig | null = null;
  private formStates: FormState[] = [];
  private raf: number | null = null;

  private elapsed   = 0;
  private lastTime: number | null = null;
  private isPlaying = false;
  // private prevTransient = 0; // removed — beats replace transient signal

  private getSignals: (() => AudioSignals) | null = null;
  /** Called each frame to get reliable audio position — no Web Audio needed */
  // removed duplicate getter declaration

  // Beat tracking (uses real song timestamps from beatMaps.ts)
  private nextKickIdx = 0;
  private nextHitIdx  = 0;
  // private lastBeatTime = -1; // unused

  private lw = 0;
  private lh = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  setConfig(config: PhaseConfig): void {
    this.config = config;
    this.formStates = config.forms.map((f) => ({
      dispX: 0, dispY: 0, velX: 0, velY: 0,
      effectiveAlpha: f.fillAlpha,
      energyOffX: 0, energyOffY: 0,
    }));
    this.elapsed = 0;
    this.nextKickIdx = 0;
    this.nextHitIdx  = 0;
  }

  setSignalsProvider(fn: (() => AudioSignals) | null): void {
    this.getSignals = fn;
  }

  setAudioTimeGetter(fn: (() => { currentTime: number; duration: number }) | null): void {
    this.getAudioTimeGetter = fn;
  }

  private getAudioTimeGetter: (() => { currentTime: number; duration: number }) | null = null;

  setPlaying(playing: boolean): void {
    this.isPlaying = playing;
  }

  start(): void {
    if (this.raf !== null) return;
    this.lastTime = null;
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
    const w = this.canvas.offsetWidth;
    const h = this.canvas.offsetHeight;
    this.canvas.width  = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // Scale context so all draw calls use logical pixels
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.lw = w;
    this.lh = h;
  }

  // ─── Frame loop ──────────────────────────────────────────────────────────

  private onFrame = (ts: number): void => {
    const dt = this.lastTime === null
      ? 0
      : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.elapsed += dt;

    if (this.config && this.formStates.length > 0 && this.lw > 0) {
      const signals = this.getSignals?.() ?? null;
      this.update(dt, signals);
      this.draw(signals);
    }

    this.raf = requestAnimationFrame(this.onFrame);
  };

  // ─── Physics update ──────────────────────────────────────────────────────

  private update(dt: number, _signals: AudioSignals | null): void {
    const config = this.config!;
    const t      = this.elapsed;
    const w      = this.lw;
    const h      = this.lh;

    // ── Real-time audio position (reliable on iOS, no Web Audio needed) ───
    const audioPos = this.getAudioTimeGetter?.() ?? { currentTime: 0, duration: 1 };
    const currentTime = audioPos.currentTime;
    const duration    = Math.max(1, audioPos.duration);
    const progress    = currentTime / duration; // 0–1 narrative position

    // ── Beat detection: fire spring kicks from pre-computed timestamps ─────
    // No AudioContext, no analyser — just compare currentTime to known beats.
    let kickThisFrame = 0;  // normalized strength of kick this frame (0=none)
    let hitThisFrame  = 0;

    if (this.isPlaying && !PREFERS_REDUCED_MOTION) {
      const { kicks, hits } = config.beatMap;

      // Advance past already-fired kicks
      while (this.nextKickIdx < kicks.length && kicks[this.nextKickIdx][0] < currentTime - 0.05) {
        this.nextKickIdx++;
      }
      // Check if next kick is NOW (within current frame window)
      if (this.nextKickIdx < kicks.length) {
        const [beatT, strength] = kicks[this.nextKickIdx];
        if (beatT >= currentTime - 0.05 && beatT <= currentTime + dt + 0.05) {
          kickThisFrame = strength;
          this.nextKickIdx++;
        }
      }

      // Same for hits
      while (this.nextHitIdx < hits.length && hits[this.nextHitIdx][0] < currentTime - 0.05) {
        this.nextHitIdx++;
      }
      if (this.nextHitIdx < hits.length) {
        const [beatT, strength] = hits[this.nextHitIdx];
        if (beatT >= currentTime - 0.05 && beatT <= currentTime + dt + 0.05) {
          hitThisFrame = strength;
          this.nextHitIdx++;
        }
      }
    }

    // ── Narrative arc: position-based world transformation ─────────────────
    // Forms shift by authored amounts as the song progresses (0→1).
    // This runs regardless of beat detection — even with audio paused,
    // resuming from mid-song should show the correct world state.
    const narrativeOffsets: { x: number; y: number }[] = config.forms.map(() => ({ x: 0, y: 0 }));
    for (const [arcProgress, formIdx, dx, dy] of config.narrativeArc) {
      // Each arc entry contributes proportionally once the song reaches that progress
      const alpha = Math.max(0, Math.min(1, progress / arcProgress));
      if (formIdx < narrativeOffsets.length) {
        narrativeOffsets[formIdx].x += dx * w * alpha;
        narrativeOffsets[formIdx].y += dy * h * alpha;
      }
    }

    // ── Authored wall-clock moments ────────────────────────────────────────
    const momentOffsets = this.computeMomentOffsets(config.moments, t, config.forms);

    for (let i = 0; i < config.forms.length; i++) {
      const f  = config.forms[i];
      const s  = this.formStates[i];
      const mo = momentOffsets[i];

      // ── Beat kick — direct impulse displacement + small velocity ──────────
      // Direct displacement (not just velocity) guarantees visible movement:
      // the form instantly jumps by up to `transientStrength * h` pixels in its
      // preferred direction, then the spring pulls it back over ~0.5-1s.
      // Previous approach (velocity only + K=12 damp=0.60) produced <1px
      // displacement in <3 frames — visually zero.
      if (kickThisFrame > 0) {
        const maxPx = kickThisFrame * config.transientStrength * h * f.transientScale;
        // Instant position jump (visible this frame)
        s.dispX += f.transientDirX * maxPx;
        s.dispY += f.transientDirY * maxPx;
        // Small additional velocity for bounce-back feel
        s.velX  += f.transientDirX * maxPx * 0.4;
        s.velY  += f.transientDirY * maxPx * 0.4;
      }
      // Hit: smaller scale effect (no spring, just a brief alpha brightening)
      // handled in draw() via `hitThisFrame`

      // ── Spring physics ─────────────────────────────────────────────────
      s.velX += (0 - s.dispX) * SPRING_K * dt;
      s.velY += (0 - s.dispY) * SPRING_K * dt;
      const damp = Math.pow(SPRING_DAMP, dt * 60);
      s.velX *= damp;
      s.velY *= damp;
      s.dispX += s.velX * dt;
      s.dispY += s.velY * dt;

      // Store hit + narrative offsets for draw
      s.energyOffX = narrativeOffsets[i].x + (mo.offX ?? 0);
      s.energyOffY = narrativeOffsets[i].y + (mo.offY ?? 0);
    }

    // Store hit for draw
    this._hitThisFrame  = hitThisFrame;
    this._kickThisFrame = kickThisFrame;
  }

  private _hitThisFrame  = 0;
  private _kickThisFrame = 0;

  /**
   * Compute per-form translation from authored moments.
   * Returns an array of {offX (pixels), offY (pixels), fadeInAlpha} per form.
   */
  private computeMomentOffsets(
    moments: AuthoredMoment[],
    t: number,
    forms: FormConfig[]
  ): { offX: number; offY: number; fadeInAlpha?: number }[] {
    const result = forms.map(() => ({ offX: 0, offY: 0 })) as {
      offX: number; offY: number; fadeInAlpha?: number
    }[];

    for (const m of moments) {
      const alpha = smoothstep(m.t0, m.t1, t);
      result[m.formIdx].offX += m.dx * this.lw * alpha;
      result[m.formIdx].offY += m.dy * this.lh * alpha;
      if (m.fadeIn) {
        result[m.formIdx].fadeInAlpha = alpha;
      }
    }
    return result;
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  private draw(_signals: AudioSignals | null): void {
    const config = this.config!;
    const ctx    = this.ctx;
    const w      = this.lw;
    const h      = this.lh;
    const t      = this.elapsed;

    // ── Background / trail ────────────────────────────────────────────────
    // Kick flashes briefly brighten the background (screen-blend white flash)
    const kick = this._kickThisFrame;
    const hit  = this._hitThisFrame;
    let trail = config.trailAlpha;
    // Shorten trail on beats so kick displacement is crisp, not smeared
    if (kick > 0) trail = Math.min(0.95, trail + kick * 0.45);
    if (hit  > 0) trail = Math.min(0.95, trail + hit  * 0.20);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `hsla(${config.bgH}, ${config.bgS}%, ${config.bgL}%, ${trail})`;
    ctx.fillRect(0, 0, w, h);

    // Brief luminous flash on strong kicks — a subtle screen-blend white at center
    if (kick > 0.4 && !PREFERS_REDUCED_MOTION) {
      ctx.globalCompositeOperation = "screen";
      const fl = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, h * 0.5);
      fl.addColorStop(0, `hsla(${config.bgH + 30}, 20%, 80%, ${kick * 0.12})`);
      fl.addColorStop(1, "transparent");
      ctx.fillStyle = fl;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    }

    // ── Forms: far → near ─────────────────────────────────────────────────
    const forms  = [...config.forms];
    const states = this.formStates;
    const momentOffsets = this.computeMomentOffsets(config.moments, t, forms);
    const order = forms.map((_, i) => i).sort((a, b) => forms[a].depth - forms[b].depth);

    for (const i of order) {
      const f  = forms[i];
      const s  = states[i];
      const mo = momentOffsets[i];

      // ── Effective alpha ─────────────────────────────────────────────────
      let effectiveAlpha = f.fillAlpha;
      if (mo.fadeInAlpha !== undefined) {
        const target = Math.min(0.95, f.fillAlpha * 1.8);
        effectiveAlpha = f.fillAlpha + (target - f.fillAlpha) * mo.fadeInAlpha;
      }
      // Beat luminance boost: hit makes forms briefly brighter
      const beatBoost = kick * 0.18 * f.transientScale + hit * 0.08;
      effectiveAlpha = Math.min(0.95, effectiveAlpha + effectiveAlpha * beatBoost);

      // ── Compute displaced anchor positions ──────────────────────────────
      const driftScale = PREFERS_REDUCED_MOTION ? 0.08 : 1.0;
      // energyOffX/Y now carries: narrative arc + moment offsets (set in update())
      const totalOffX  = s.dispX + s.energyOffX;
      const totalOffY  = s.dispY + s.energyOffY;

      // Compute drifted and offset anchors
      const driftedAnchors: [number, number][] = f.anchors.map((a, idx) => {
        // Different drift phase per anchor to create organic deformation
        // (not rigid body translation — makes the form feel alive at its edges)
        const angleBase = (idx / f.anchors.length) * Math.PI * 2;
        const dX = Math.sin(t * f.driftFreqX + f.driftPhaseX + angleBase * 0.3)
          * f.driftAmpX * driftScale;
        const dY = Math.cos(t * f.driftFreqY + f.driftPhaseY + angleBase * 0.4)
          * f.driftAmpY * driftScale;
        return [
          a[0] + dX + totalOffX / w,
          a[1] + dY + totalOffY / h,
        ];
      });

      // ── Build bezier path ───────────────────────────────────────────────
      const segs = catmullRomToBezier(driftedAnchors, w, h);
      ctx.beginPath();
      ctx.moveTo(driftedAnchors[0][0] * w, driftedAnchors[0][1] * h);
      for (const seg of segs) {
        ctx.bezierCurveTo(seg.cp1x, seg.cp1y, seg.cp2x, seg.cp2y, seg.x, seg.y);
      }
      ctx.closePath();

      // ── Fill with directional-lighting gradient ─────────────────────────
      // Compute the bounding box of this path's anchor points for gradient sizing
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const a of driftedAnchors) {
        minX = Math.min(minX, a[0] * w);
        maxX = Math.max(maxX, a[0] * w);
        minY = Math.min(minY, a[1] * h);
        maxY = Math.max(maxY, a[1] * h);
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const bw = maxX - minX;
      const bh = maxY - minY;
      const halfDiag = Math.sqrt(bw * bw + bh * bh) / 2;

      const angle = (f.gradAngle * Math.PI) / 180;
      const gx0   = cx - Math.cos(angle) * halfDiag;
      const gy0   = cy - Math.sin(angle) * halfDiag;
      const gx1   = cx + Math.cos(angle) * halfDiag;
      const gy1   = cy + Math.sin(angle) * halfDiag;

      const strength = f.gradStrength;
      const lBright  = Math.min(100, f.lit * (1 + strength * 0.5));
      const lDark    = Math.max(0,   f.lit * (1 - strength * 0.5));
      const sBright  = f.sat;
      const sDark    = Math.max(0, f.sat - 20);

      const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      grad.addColorStop(0,    `hsla(${f.hue}, ${sBright}%, ${lBright}%, ${effectiveAlpha})`);
      grad.addColorStop(0.55, `hsla(${f.hue}, ${f.sat}%,  ${f.lit}%, ${effectiveAlpha})`);
      grad.addColorStop(1,    `hsla(${f.hue}, ${sDark}%,  ${lDark}%, ${effectiveAlpha * 0.55})`);

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = grad;
      ctx.fill();

      // ── Luminous edge: any form with edgeAlpha > 0, screen blend ──────
      // NOTE: was previously gated on depth > 0.3 (near-forms only), but that
      // wrongly excluded YARIN's tiny far form, which relies on its edge to
      // "read" at small scale against the dark background.
      if (f.edgeAlpha > 0) {
        const edgeLit = Math.min(100, f.lit + f.edgeLitBoost);
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = `hsla(${f.hue}, ${f.sat + 5}%, ${edgeLit}%, ${f.edgeAlpha})`;
        ctx.lineWidth   = f.edgeWidth;
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
    }

    // ── Vignette: multiply to darken edges, focus center ─────────────────
    // This is the cinematic frame absent from V1. Creates depth of field.
    // Multiply: white = no change, black = fully darkened.
    const vs = config.vignetteStrength;
    const vcx = w * 0.5;
    const vcy = h * 0.5;
    const vInner = h * (0.25 - vs * 0.08);
    const vOuter = h * (0.95 - vs * 0.10);
    const vig = ctx.createRadialGradient(vcx, vcy, vInner, vcx, vcy, vOuter);
    vig.addColorStop(0.0, "rgba(255,255,255,1)");
    vig.addColorStop(0.5, `rgba(${Math.round(200 - vs * 80)},${Math.round(200 - vs * 80)},${Math.round(200 - vs * 80)},1)`);
    vig.addColorStop(0.8, `rgba(${Math.round(60 - vs * 40)},${Math.round(60 - vs * 40)},${Math.round(60 - vs * 40)},1)`);
    vig.addColorStop(1.0, "rgba(0,0,0,1)");
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "source-over";
  }
}
