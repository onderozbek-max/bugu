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

const SPRING_K    = 12.0;
const SPRING_DAMP = 0.60;

export class WorldRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private config: PhaseConfig | null = null;
  private formStates: FormState[] = [];
  private raf: number | null = null;

  private elapsed   = 0;   // total wall-clock time (seconds)
  private lastTime: number | null = null;
  private isPlaying = false;
  private prevTransient = 0;

  private getSignals: (() => AudioSignals) | null = null;

  // Logical pixel dimensions (post-DPR transform)
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
    this.elapsed = 0; // restart authored moments on song switch
    this.prevTransient = 0;
  }

  setSignalsProvider(fn: (() => AudioSignals) | null): void {
    this.getSignals = fn;
  }

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

  private update(dt: number, signals: AudioSignals | null): void {
    const config  = this.config!;
    const t       = this.elapsed;
    const w       = this.lw;
    const h       = this.lh;

    // Transient pulse: how much transient signal increased this frame
    const tr     = signals?.transient ?? 0;
    const trPulse = Math.max(0, tr - this.prevTransient - 0.05);
    this.prevTransient = tr;

    // Authored moments: time-based translations applied per-form
    const momentOffsets = this.computeMomentOffsets(config.moments, t, config.forms);

    for (let i = 0; i < config.forms.length; i++) {
      const f = config.forms[i];
      const s = this.formStates[i];

      // ── Authored moment alpha fade-in ──────────────────────────────────
      const { fadeInAlpha } = momentOffsets[i];
      if (f.fillAlpha === 0 && fadeInAlpha !== undefined) {
        s.effectiveAlpha = fadeInAlpha * f.fillAlpha; // only relevant for non-zero authored
        // For the far tiny form: authored fillAlpha is 0, but we want to fade in to 0.28
        // We store the "target" alpha separately
      }
      // (Handled below where effectiveAlpha is computed for the fade-in form)

      // ── Energy-driven inter-form drift ─────────────────────────────────
      // This changes the RELATIONSHIP between forms (gap/overlap) rather
      // than moving the whole world uniformly — avoids "bouncing" feel.
      const energyMag = (signals?.bass ?? 0) * 0.6 + (signals?.energy ?? 0) * 0.4;
      const targetEnergyOffX = f.energyDriftScale * energyMag
        * config.energyResponseScale * f.energyDriftDirX * w;
      const targetEnergyOffY = f.energyDriftScale * energyMag
        * config.energyResponseScale * f.energyDriftDirY * h;
      s.energyOffX += (targetEnergyOffX - s.energyOffX) * 0.08;
      s.energyOffY += (targetEnergyOffY - s.energyOffY) * 0.08;

      // ── Transient spring kick ──────────────────────────────────────────
      if (trPulse > 0 && !PREFERS_REDUCED_MOTION && this.isPlaying) {
        const strength = trPulse * config.transientStrength * h * f.transientScale;
        s.velX += f.transientDirX * strength;
        s.velY += f.transientDirY * strength;
      }
      s.velX += (0 - s.dispX) * SPRING_K * dt;
      s.velY += (0 - s.dispY) * SPRING_K * dt;
      const damp = Math.pow(SPRING_DAMP, dt * 60);
      s.velX *= damp;
      s.velY *= damp;
      s.dispX += s.velX * dt;
      s.dispY += s.velY * dt;
    }
  }

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

  private draw(signals: AudioSignals | null): void {
    const config = this.config!;
    const ctx    = this.ctx;
    const w      = this.lw;
    const h      = this.lh;
    const t      = this.elapsed;

    // ── Background / trail ────────────────────────────────────────────────
    // Partial clear: creates subtle motion persistence for form edges.
    // Higher energy → more clearing (sharper motion); quiet → longer trail.
    let trail = config.trailAlpha;
    if (signals) trail += signals.energy * (1 - config.trailAlpha) * 0.35;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `hsla(${config.bgH}, ${config.bgS}%, ${config.bgL}%, ${trail})`;
    ctx.fillRect(0, 0, w, h);

    // ── Forms: far → near (source-over for proper occlusion) ─────────────
    // Sort by depth ascending (0=far first, 1=near last)
    const forms = [...config.forms];
    const states = this.formStates;
    const momentOffsets = this.computeMomentOffsets(config.moments, t, forms);

    // Sort indices by depth so we render far→near
    const order = forms.map((_, i) => i).sort((a, b) => forms[a].depth - forms[b].depth);

    for (const i of order) {
      const f  = forms[i];
      const s  = states[i];
      const mo = momentOffsets[i];

      // ── Effective alpha ─────────────────────────────────────────────────
      let effectiveAlpha = f.fillAlpha;
      if (mo.fadeInAlpha !== undefined) {
        // fadeIn moment brightens the form from its authored fillAlpha to
        // a higher value (1.8× authored, capped at 0.95). F0 in YARIN
        // starts at fillAlpha=0.22 and rises to ~0.40 over t=8-14s.
        const target = Math.min(0.95, f.fillAlpha * 1.8);
        effectiveAlpha = f.fillAlpha + (target - f.fillAlpha) * mo.fadeInAlpha;
      }
      // Slight audio luminance response (far: bass, near: mid)
      let alphaBoost = 0;
      if (signals) {
        alphaBoost = f.depth > 0.7
          ? signals.mid  * 0.15
          : f.depth > 0.3
          ? signals.energy * 0.12
          : signals.bass   * 0.14;
      }
      effectiveAlpha = Math.min(0.95, effectiveAlpha + effectiveAlpha * alphaBoost);

      // ── Compute displaced anchor positions ──────────────────────────────
      const driftScale = PREFERS_REDUCED_MOTION ? 0.08 : 1.0;
      const totalOffX  = mo.offX + s.dispX + s.energyOffX;
      const totalOffY  = mo.offY + s.dispY + s.energyOffY;

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
