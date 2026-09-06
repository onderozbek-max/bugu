/**
 * Authored visual configuration for the V2 laboratory.
 *
 * Each song has a PhaseConfig that describes a world of layered oval "pools"
 * — soft luminous volumes composited with Canvas 2D screen blending. Pools
 * are organized into three depth levels (far / mid / near), each with
 * authored drift and audio-response parameters.
 *
 * The key visual differentiators from V1 PersistentWorld:
 *   - Rotated ovals, not circles — shapes have orientation and character.
 *   - Differential depth separation driven by audio frequency bands.
 *   - Strong vignette framing the composition cinematically.
 *   - Chromatic separation on near-layer transients.
 *   - Screen+multiply compositing vs. screen-only.
 *
 * DÜN: close, compressed, intimate — bass creates "spatial pressure."
 * YARIN: expansive, deep, spatial — energy "opens" the world outward.
 */

export interface PoolConfig {
  /** Position as fraction of viewport: 0=left/top, 1=right/bottom */
  x: number;
  y: number;
  /** Horizontal radius as fraction of canvas height */
  rx: number;
  /** Vertical radius as fraction of canvas height */
  ry: number;
  /** Shape rotation in radians */
  rotation: number;
  /**
   * Depth in scene: 0 = farthest (barely moves), 1 = nearest (most responsive).
   * Drives parallax separation, drift amplitude inheritance, and which audio
   * band modulates luminance.
   */
  depth: number;
  /** HSL color. Rendered with screen blend — rich, mid-lightness works best. */
  hue: number;
  sat: number;
  lit: number;
  /** Peak alpha in screen composite. 0.15–0.55 on near-black yields luminous depth. */
  alpha: number;
  /** Autonomous drift in canvas-height fractions and radians/second */
  driftXAmp: number;
  driftYAmp: number;
  driftXFreq: number; // rad/s
  driftYFreq: number;
  driftXPhase: number; // initial phase (radians)
  driftYPhase: number;
  rotDriftAmp: number;  // radians
  rotDriftFreq: number; // rad/s
  rotDriftPhase: number;
  /**
   * Preferred direction for transient-driven spring kick (unit vector).
   * Each pool should differ so transients produce complex spatial motion,
   * not uniform pulsing.
   */
  dispDirX: number;
  dispDirY: number;
}

export interface PhaseConfig {
  id: "dun" | "yarin";
  /** Background base color (HSLA) */
  bgH: number;
  bgS: number;
  bgL: number;
  /**
   * Per-frame trail fraction: how much background is repainted each frame.
   * 0.15 = long atmospheric trail; 0.35 = brief, crisper motion trail.
   * Energy tightens this further (more responsive during loud moments).
   */
  trailAlpha: number;
  pools: PoolConfig[];
  /**
   * Base depth-parallax scale: how much the near/far split creates apparent
   * spatial separation. Higher = more visible depth between layers.
   */
  depthParallax: number;
  /**
   * How audio energy modulates depth separation per frame.
   *   DÜN  (negative) — bass compresses layers together ("spatial pressure").
   *   YARIN (positive) — energy expands layers apart ("the world opens").
   */
  energyDepthK: number;
  /**
   * Transient displacement strength in canvas-height units per unit transient.
   * Near pools are additionally scaled by their depth value.
   */
  transientStrength: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DÜN — memory: close, layered, compressed, imperfectly aligned, intimate
// Bass creates spatial pressure. Transients produce restrained optical kicks.
// Colors: deep warm amber, muted copper-rose, dark teal, recessive violet.
// ─────────────────────────────────────────────────────────────────────────────

const dunPools: PoolConfig[] = [
  // ── Far layer (depth 0.08–0.15) ─────────────────────────────────────────
  // These barely move — they are the weight of memory itself.
  {
    x: 0.38, y: 0.56,
    rx: 0.52, ry: 0.43, rotation: 0.28,
    depth: 0.08,
    hue: 35, sat: 65, lit: 38, alpha: 0.26,
    driftXAmp: 0.008, driftYAmp: 0.005, driftXFreq: 0.18, driftYFreq: 0.13,
    driftXPhase: 0.0, driftYPhase: 1.1,
    rotDriftAmp: 0.04, rotDriftFreq: 0.07, rotDriftPhase: 0.0,
    dispDirX: 0.3, dispDirY: -0.2,
  },
  {
    x: 0.62, y: 0.41,
    rx: 0.48, ry: 0.41, rotation: -0.22,
    depth: 0.13,
    hue: 272, sat: 38, lit: 28, alpha: 0.22,
    driftXAmp: 0.007, driftYAmp: 0.006, driftXFreq: 0.14, driftYFreq: 0.20,
    driftXPhase: 2.1, driftYPhase: 0.7,
    rotDriftAmp: 0.035, rotDriftFreq: 0.09, rotDriftPhase: 1.4,
    dispDirX: -0.4, dispDirY: 0.1,
  },
  // ── Mid layer (depth 0.42–0.50) ─────────────────────────────────────────
  // The world's substance — moderate audio response, shaped asymmetrically.
  {
    x: 0.34, y: 0.40,
    rx: 0.34, ry: 0.27, rotation: 0.52,
    depth: 0.42,
    hue: 192, sat: 55, lit: 24, alpha: 0.35,
    driftXAmp: 0.018, driftYAmp: 0.014, driftXFreq: 0.31, driftYFreq: 0.24,
    driftXPhase: 0.8, driftYPhase: 2.3,
    rotDriftAmp: 0.07, rotDriftFreq: 0.13, rotDriftPhase: 0.5,
    dispDirX: -0.6, dispDirY: -0.3,
  },
  {
    x: 0.65, y: 0.63,
    rx: 0.32, ry: 0.28, rotation: -0.38,
    depth: 0.48,
    hue: 18, sat: 52, lit: 30, alpha: 0.32,
    driftXAmp: 0.016, driftYAmp: 0.013, driftXFreq: 0.27, driftYFreq: 0.35,
    driftXPhase: 1.6, driftYPhase: 0.4,
    rotDriftAmp: 0.06, rotDriftFreq: 0.16, rotDriftPhase: 2.0,
    dispDirX: 0.5, dispDirY: 0.4,
  },
  // ── Near layer (depth 0.95) ──────────────────────────────────────────────
  // Intimate foreground — most audio-responsive, most luminous.
  {
    x: 0.50, y: 0.53,
    rx: 0.22, ry: 0.19, rotation: 0.18,
    depth: 0.95,
    hue: 38, sat: 72, lit: 44, alpha: 0.45,
    driftXAmp: 0.010, driftYAmp: 0.008, driftXFreq: 0.22, driftYFreq: 0.30,
    driftXPhase: 3.2, driftYPhase: 1.8,
    rotDriftAmp: 0.05, rotDriftFreq: 0.20, rotDriftPhase: 0.9,
    dispDirX: 0.1, dispDirY: -0.7,
  },
];

export const dunConfig: PhaseConfig = {
  id: "dun",
  bgH: 28, bgS: 12, bgL: 3,
  trailAlpha: 0.30,       // brief, present trail — DÜN is immediate/compressed
  pools: dunPools,
  depthParallax: 0.06,    // small depth separation — layers feel close together
  energyDepthK: -0.045,   // negative: bass compresses layers further (spatial pressure)
  transientStrength: 0.022,
};

// ─────────────────────────────────────────────────────────────────────────────
// YARIN — possibility: expansive, deep, open, spatial, spectral
// Energy expands the world. Broad displacement. Scale and parallax matter more.
// Colors: deep cobalt, indigo-magenta, spectral teal, rich near-field magenta.
// ─────────────────────────────────────────────────────────────────────────────

const yarinPools: PoolConfig[] = [
  // ── Far layer (depth 0.05–0.08) ─────────────────────────────────────────
  // Vast, barely moving — the suggestion of enormous space behind the screen.
  {
    x: 0.44, y: 0.42,
    rx: 0.72, ry: 0.64, rotation: 0.10,
    depth: 0.05,
    hue: 222, sat: 75, lit: 28, alpha: 0.20,
    driftXAmp: 0.006, driftYAmp: 0.004, driftXFreq: 0.10, driftYFreq: 0.08,
    driftXPhase: 0.0, driftYPhase: 0.6,
    rotDriftAmp: 0.025, rotDriftFreq: 0.05, rotDriftPhase: 0.0,
    dispDirX: 0.2, dispDirY: 0.1,
  },
  {
    x: 0.59, y: 0.62,
    rx: 0.65, ry: 0.54, rotation: -0.42,
    depth: 0.08,
    hue: 285, sat: 52, lit: 24, alpha: 0.18,
    driftXAmp: 0.005, driftYAmp: 0.005, driftXFreq: 0.08, driftYFreq: 0.12,
    driftXPhase: 2.4, driftYPhase: 1.2,
    rotDriftAmp: 0.022, rotDriftFreq: 0.06, rotDriftPhase: 1.8,
    dispDirX: -0.3, dispDirY: -0.2,
  },
  // ── Mid layer (depth 0.48–0.52) ─────────────────────────────────────────
  {
    x: 0.32, y: 0.50,
    rx: 0.40, ry: 0.30, rotation: 0.58,
    depth: 0.48,
    hue: 178, sat: 62, lit: 26, alpha: 0.38,
    driftXAmp: 0.022, driftYAmp: 0.018, driftXFreq: 0.24, driftYFreq: 0.18,
    driftXPhase: 0.5, driftYPhase: 2.0,
    rotDriftAmp: 0.08, rotDriftFreq: 0.10, rotDriftPhase: 1.0,
    dispDirX: -0.7, dispDirY: 0.2,
  },
  {
    x: 0.67, y: 0.34,
    rx: 0.38, ry: 0.33, rotation: -0.58,
    depth: 0.52,
    hue: 212, sat: 70, lit: 32, alpha: 0.35,
    driftXAmp: 0.020, driftYAmp: 0.016, driftXFreq: 0.20, driftYFreq: 0.28,
    driftXPhase: 1.8, driftYPhase: 0.3,
    rotDriftAmp: 0.075, rotDriftFreq: 0.12, rotDriftPhase: 2.5,
    dispDirX: 0.6, dispDirY: -0.4,
  },
  // ── Near layer (depth 0.85–0.92) ────────────────────────────────────────
  // Two near pools — binocular depth, chromatic separation on strong transients.
  {
    x: 0.46, y: 0.38,
    rx: 0.26, ry: 0.23, rotation: 0.22,
    depth: 0.92,
    hue: 310, sat: 58, lit: 30, alpha: 0.48,
    driftXAmp: 0.012, driftYAmp: 0.010, driftXFreq: 0.28, driftYFreq: 0.20,
    driftXPhase: 2.8, driftYPhase: 0.9,
    rotDriftAmp: 0.06, rotDriftFreq: 0.18, rotDriftPhase: 0.3,
    dispDirX: 0.3, dispDirY: -0.8,
  },
  {
    x: 0.54, y: 0.64,
    rx: 0.23, ry: 0.21, rotation: -0.18,
    depth: 0.85,
    hue: 192, sat: 65, lit: 28, alpha: 0.42,
    driftXAmp: 0.011, driftYAmp: 0.009, driftXFreq: 0.32, driftYFreq: 0.24,
    driftXPhase: 1.3, driftYPhase: 3.0,
    rotDriftAmp: 0.055, rotDriftFreq: 0.22, rotDriftPhase: 1.6,
    dispDirX: -0.4, dispDirY: 0.6,
  },
];

export const yarinConfig: PhaseConfig = {
  id: "yarin",
  bgH: 222, bgS: 18, bgL: 3,
  trailAlpha: 0.20,       // longer, more atmospheric trail — YARIN is dreamlike
  pools: yarinPools,
  depthParallax: 0.14,    // large depth separation — vast apparent space
  energyDepthK: 0.08,     // positive: energy expands layers (the world opens)
  transientStrength: 0.038,
};
