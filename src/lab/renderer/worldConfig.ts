import { dunBeats, yarinBeats } from "./beatMaps";

/**
 * V2 Lab — Structural Form Configurations.
 *
 * Each phase is defined as an array of "forms" — abstract shapes rendered as
 * filled bezier paths with depth-ordered compositing. This replaces the V1
 * soft-radial-blob approach.
 *
 * KEY DESIGN PRINCIPLES (learned from V1 failure):
 *  - Forms are structural, not atmospheric — they have clear edges and occlude
 *    each other based on depth ordering (far rendered first, near last).
 *  - DÜN: covers ~70% of the canvas — dense, compressed, "trapped inside."
 *    The structures extend beyond the viewport; you cannot see the whole thing.
 *  - YARIN: covers ~40-45% of the canvas — the same type of world seen from
 *    a distance. One near form + one tiny far form creates an 8:1 scale ratio
 *    that communicates "enormous apparent depth" in a still image.
 *  - The distinction must survive grayscale conversion with no labels.
 *
 * Anchors are Catmull-Rom control points in fractional canvas coordinates:
 * (0,0) = top-left, (1,1) = bottom-right, values outside [0,1] extend off-screen.
 * The renderer connects them as a smooth closed bezier path.
 */

export interface FormConfig {
  id: string;
  /** Catmull-Rom anchor points [x,y], fractions of canvas width/height */
  anchors: [number, number][];
  /** 0 = farthest, 1 = nearest. Determines draw order + visual treatment. */
  depth: number;
  /** Fill color — HSL */
  hue: number;
  sat: number;
  lit: number;
  /** Fill opacity in source-over blend */
  fillAlpha: number;
  /**
   * Linear gradient direction (degrees from horizontal):
   * 0=right, 90=down, 135=lower-right. Applied inside the bezier shape.
   * Creates directional-lighting quality distinct from blob radial-gradients.
   */
  gradAngle: number;
  /** Gradient bright/shadow ratio: 0-1 how much lighter the bright face is */
  gradStrength: number;
  /** Edge stroke (screen blend). 0 = no edge. Applied to near forms only. */
  edgeLitBoost: number;  // how much lighter the edge color is
  edgeAlpha: number;
  edgeWidth: number;
  /** Autonomous drift (fraction of canvas per oscillation, rad/s, phase) */
  driftAmpX: number;
  driftAmpY: number;
  driftFreqX: number;
  driftFreqY: number;
  driftPhaseX: number;
  driftPhaseY: number;
  /** How strongly this form responds to transient kicks (multiplier) */
  transientScale: number;
  /** Preferred transient displacement direction (unit vector) */
  transientDirX: number;
  transientDirY: number;
  /**
   * How strongly this form's gap to adjacent forms responds to audio energy:
   * positive = expands with energy, negative = compresses with energy.
   * Applied as an offset to ALL this form's anchors (a translation).
   */
  energyDriftScale: number;
  energyDriftDirX: number;
  energyDriftDirY: number;
}

export interface AuthoredMoment {
  /** Which form's anchors to translate */
  formIdx: number;
  /** Time range (renderer wall-clock, not playback position) */
  t0: number;
  t1: number;
  /** Translation applied to all anchors at full interpolation, fractions of canvas */
  dx: number;
  dy: number;
  /** If set, fillAlpha fades from 0 to authored value over t0→t1 */
  fadeIn?: boolean;
}

export interface PhaseConfig {
  id: "dun" | "yarin";
  bgH: number;
  bgS: number;
  bgL: number;
  vignetteStrength: number;
  trailAlpha: number;
  forms: FormConfig[];
  moments: AuthoredMoment[];
  transientStrength: number;
  energyResponseScale: number;
  /**
   * Beat map: extracted from actual audio via ffmpeg onset detection.
   * kicks: strong energy onsets → spring displacement + chromatic flash
   * hits:  medium onsets → scale pulse only
   * Format: [timestamp_seconds, normalized_strength_0_to_1]
   */
  beatMap: {
    kicks: [number, number][];
    hits: [number, number][];
    duration: number;
  };
  /**
   * Narrative arc: how the world transforms as the song progresses (0-1).
   * Each entry [progress, formIdx, dx, dy] shifts a form toward the given
   * offset at the given progress point (smoothly interpolated).
   * DÜN: forms compress toward each other (building pressure over the song).
   * YARIN: near form expands, far forms recede (space opens over the song).
   */
  narrativeArc: [progress: number, formIdx: number, dx: number, dy: number][];
}

// ─────────────────────────────────────────────────────────────────────────────
// DÜN — compressed, dense, close, trapped inside the structure
// Coverage: ~70% of canvas area. Background barely visible through form gaps.
// Palette: deep warm amber, teal-green, plum-violet, copper-bronze.
// ─────────────────────────────────────────────────────────────────────────────

export const dunConfig: PhaseConfig = {
  id: "dun",
  bgH: 24, bgS: 10, bgL: 3,
  vignetteStrength: 0.65,   // was 0.85 — too aggressive in corners, hid F2 plum form
  trailAlpha: 0.28,

  forms: [
    // ── F0: FAR amber — enters from upper-left, its bulk is off-screen ───────
    // Visual reading: "an enormous structure whose right and lower edge we can barely see."
    {
      id: "f0",
      anchors: [
        [-0.22, 0.18],  // enters from left
        [ 0.04,-0.10],  // exits top
        [ 0.38,-0.05],  // just above top edge
        [ 0.56, 0.12],  // first visible corner
        [ 0.48, 0.32],  // curves down
        [ 0.20, 0.38],  // lower visible edge
        [-0.12, 0.30],  // exits left
      ],
      depth: 0.05,
      hue: 34, sat: 55, lit: 20, fillAlpha: 0.18,
      gradAngle: 135, gradStrength: 0.5,
      edgeLitBoost: 0, edgeAlpha: 0, edgeWidth: 0,
      // Drift amps: fraction of canvas. 0.03 = ~12px on 390px screen — just perceptible.
      // 0.06 = ~23px — clearly visible as organic breathing.
      driftAmpX: 0.030, driftAmpY: 0.022, driftFreqX: 0.42, driftFreqY: 0.30,
      driftPhaseX: 0.0, driftPhaseY: 1.2,
      transientScale: 0.0,
      transientDirX: 0, transientDirY: 0,
      energyDriftScale: -0.045, energyDriftDirX: 0.4, energyDriftDirY: 0.6,
    },
    // ── F1: MID teal — lower-right mass, extends off bottom and right ────────
    {
      id: "f1",
      anchors: [
        [ 0.26, 0.52],  // upper-left (on screen)
        [ 0.65, 0.38],  // upper-center
        [ 1.08, 0.48],  // exits right
        [ 1.10, 1.10],  // off-screen corner
        [ 0.62, 1.12],  // exits bottom
        [ 0.10, 0.96],  // lower-left (on screen)
        [ 0.06, 0.72],  // left side
      ],
      depth: 0.28,
      hue: 183, sat: 60, lit: 22, fillAlpha: 0.60,
      gradAngle: 45, gradStrength: 0.45,
      edgeLitBoost: 0, edgeAlpha: 0, edgeWidth: 0,
      driftAmpX: 0.055, driftAmpY: 0.040, driftFreqX: 0.52, driftFreqY: 0.38,
      driftPhaseX: 1.4, driftPhaseY: 0.5,
      transientScale: 0.5,
      transientDirX: -0.3, transientDirY: 0.5,
      energyDriftScale: -0.055, energyDriftDirX: -0.2, energyDriftDirY: -0.4,
    },
    // ── F2: MID-NEAR plum — upper-right wedge, partially behind/in-front F1 ─
    {
      id: "f2",
      anchors: [
        [ 0.46,-0.08],  // exits top
        [ 0.90,-0.10],  // top-right off-screen
        [ 1.15, 0.22],  // exits right
        [ 1.10, 0.58],  // exits right (lower)
        [ 0.80, 0.65],  // visible lower-right corner
        [ 0.52, 0.55],  // visible interior
        [ 0.40, 0.32],  // left side
      ],
      depth: 0.48,
      hue: 270, sat: 50, lit: 32, fillAlpha: 0.68,
      gradAngle: 225, gradStrength: 0.55,
      edgeLitBoost: 18, edgeAlpha: 0.22, edgeWidth: 1.5,
      driftAmpX: 0.048, driftAmpY: 0.035, driftFreqX: 0.65, driftFreqY: 0.48,
      driftPhaseX: 2.2, driftPhaseY: 0.8,
      transientScale: 0.7,
      transientDirX: 0.5, transientDirY: -0.4,
      energyDriftScale: -0.050, energyDriftDirX: -0.5, energyDriftDirY: 0.3,
    },
    // ── F3: NEAR copper-bronze — diagonal swath, the most prominent form ─────
    {
      id: "f3",
      anchors: [
        [-0.12, 0.52],  // enters from left
        [ 0.10, 0.32],  // upper-left area
        [ 0.40, 0.28],  // center-upper
        [ 0.68, 0.40],  // center-right
        [ 0.74, 0.65],  // lower-right
        [ 0.44, 0.76],  // lower-center
        [ 0.06, 0.78],  // lower-left
      ],
      depth: 0.88,
      hue: 28, sat: 68, lit: 35, fillAlpha: 0.70,
      gradAngle: 45, gradStrength: 0.60,
      edgeLitBoost: 22, edgeAlpha: 0.42, edgeWidth: 1.8,
      driftAmpX: 0.035, driftAmpY: 0.028, driftFreqX: 0.44, driftFreqY: 0.58,
      driftPhaseX: 3.0, driftPhaseY: 1.6,
      transientScale: 1.0,
      transientDirX: 0.2, transientDirY: -0.6,
      energyDriftScale: -0.060, energyDriftDirX: 0.0, energyDriftDirY: -0.5,
    },
  ],

  moments: [
    { formIdx: 3, t0: 8, t1: 12, dx: 0.055, dy: 0.070 },
    { formIdx: 1, t0: 25, t1: 30, dx: -0.060, dy: -0.045 },
  ],

  // 0.28 * 844px = 236px max displacement on a full-strength kick.
  // Near form (transientScale=1.0, transientDirY=-0.6) jumps ~141px upward.
  // That is ~17% of screen height — impossible to miss.
  transientStrength: 0.28,
  energyResponseScale: 1.0,

  beatMap: dunBeats,

  // Narrative arc: as DÜN progresses (0→1), forms gradually press inward.
  // At 100% through the song the copper form has shifted down-right by 8%
  // of the canvas and the teal mass has shifted up-left by 6% — the world
  // becomes MORE compressed over time, building pressure toward the end.
  // formIdx 1=teal, 3=copper
  narrativeArc: [
    [0.5, 3, 0.02, 0.025],   // at 50%: near form begins pressing down-right
    [1.0, 3, 0.08, 0.080],   // at 100%: near form fully pressed
    [0.5, 1, -0.01, -0.010], // at 50%: teal begins shifting upper-left
    [1.0, 1, -0.06, -0.045], // at 100%: teal fully shifted
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// YARIN — vast, open, spacious, "the camera has escaped DÜN"
//
// The depth argument is a SCALE RATIO, not a color effect:
//   F0 (very far): tiny form, ~18% of canvas width, visible from t=0
//   F2 (near):     large form, ~65% of canvas width on the right
//   That 3.5:1 scale ratio reads as enormous depth in a still, in grayscale.
//
// Void: ~50% of canvas is black background (left-center and lower-left).
// The emptiness IS the spatial claim.
//
// Fixed from V2a: F0 now starts at fillAlpha=0.22 (visible immediately),
// edge rendering no longer gated on depth, vignette reduced from 0.78→0.60.
// ─────────────────────────────────────────────────────────────────────────────

export const yarinConfig: PhaseConfig = {
  id: "yarin",
  bgH: 222, bgS: 16, bgL: 3,
  vignetteStrength: 0.60,   // reduced from 0.78 — far forms visible in corners/edges
  trailAlpha: 0.22,

  forms: [
    // ── F0: VERY FAR spectral teal — the depth anchor ────────────────────────
    // ~18% × 16% of canvas, upper-left area (in the void).
    // Visible from the first frame — the depth argument can't wait for t=8s.
    // The contrast between this and F2 (3.5× wider) is the spatial statement.
    {
      id: "f0",
      anchors: [
        [ 0.14, 0.14],
        [ 0.22, 0.08],
        [ 0.32, 0.12],
        [ 0.34, 0.22],
        [ 0.26, 0.28],
        [ 0.14, 0.24],
        [ 0.10, 0.18],
      ],
      depth: 0.02,
      hue: 178, sat: 68, lit: 44, fillAlpha: 0.22,  // visible from start (was 0.0 — invisible)
      gradAngle: 90, gradStrength: 0.45,
      edgeLitBoost: 28, edgeAlpha: 0.55, edgeWidth: 1.5,  // edge critical at small size
      driftAmpX: 0.018, driftAmpY: 0.012, driftFreqX: 0.20, driftFreqY: 0.15,
      driftPhaseX: 0.0, driftPhaseY: 0.8,
      transientScale: 0.0,
      transientDirX: 0, transientDirY: 0,
      energyDriftScale: 0.0, energyDriftDirX: 0, energyDriftDirY: 0,
    },
    // ── F1: MID-FAR rose-magenta — bottom-left, clearly secondary ────────────
    {
      id: "f1",
      anchors: [
        [-0.25, 0.55],
        [-0.05, 0.38],
        [ 0.22, 0.45],
        [ 0.18, 0.72],
        [-0.08, 0.85],
        [-0.30, 0.75],
      ],
      depth: 0.22,
      hue: 308, sat: 55, lit: 28, fillAlpha: 0.48,
      gradAngle: 315, gradStrength: 0.50,
      edgeLitBoost: 18, edgeAlpha: 0.28, edgeWidth: 1.3,
      driftAmpX: 0.048, driftAmpY: 0.035, driftFreqX: 0.40, driftFreqY: 0.30,
      driftPhaseX: 1.8, driftPhaseY: 0.4,
      transientScale: 0.4,
      transientDirX: -0.5, transientDirY: 0.3,
      energyDriftScale: 0.035, energyDriftDirX: -0.7, energyDriftDirY: 0.2,
    },
    // ── F2: NEAR cobalt — right-dominant, the largest form ───────────────────
    {
      id: "f2",
      anchors: [
        [ 0.30, 0.12],
        [ 0.72, 0.04],
        [ 1.08, 0.20],
        [ 1.10, 0.68],
        [ 0.82, 0.96],
        [ 0.45, 0.92],
        [ 0.26, 0.70],
        [ 0.25, 0.38],
      ],
      depth: 0.90,
      hue: 218, sat: 80, lit: 34, fillAlpha: 0.82,
      gradAngle: 330, gradStrength: 0.62,
      edgeLitBoost: 22, edgeAlpha: 0.42, edgeWidth: 2.0,
      driftAmpX: 0.030, driftAmpY: 0.022, driftFreqX: 0.28, driftFreqY: 0.38,
      driftPhaseX: 2.6, driftPhaseY: 1.0,
      transientScale: 0.8,
      transientDirX: 0.3, transientDirY: -0.5,
      energyDriftScale: 0.055, energyDriftDirX: 0.3, energyDriftDirY: -0.3,
    },
    // ── F3: MID-FAR indigo — upper-right peeking behind F2 ───────────────────
    {
      id: "f3",
      anchors: [
        [ 0.62, 0.02],
        [ 0.90, -0.02],
        [ 1.12, 0.16],
        [ 1.04, 0.38],
        [ 0.80, 0.42],
        [ 0.62, 0.28],
        [ 0.54, 0.10],
      ],
      depth: 0.18,
      hue: 244, sat: 58, lit: 28, fillAlpha: 0.40,
      gradAngle: 210, gradStrength: 0.45,
      edgeLitBoost: 15, edgeAlpha: 0.22, edgeWidth: 1.0,
      driftAmpX: 0.038, driftAmpY: 0.028, driftFreqX: 0.35, driftFreqY: 0.26,
      driftPhaseX: 0.6, driftPhaseY: 2.2,
      transientScale: 0.3,
      transientDirX: 0.5, transientDirY: -0.3,
      energyDriftScale: 0.028, energyDriftDirX: 0.5, energyDriftDirY: -0.2,
    },
  ],

  moments: [
    { formIdx: 0, t0: 8, t1: 14, dx: 0, dy: 0, fadeIn: true },
    { formIdx: 2, t0: 25, t1: 30, dx: 0.080, dy: 0.0 },
  ],

  transientStrength: 0.32,
  energyResponseScale: 1.0,

  beatMap: yarinBeats,

  // Narrative arc: as YARIN progresses (0→1), the near form expands outward
  // (the world is opening) while the far tiny form grows slightly more present.
  // formIdx 0=tiny far teal, 2=large cobalt near
  narrativeArc: [
    [0.5, 2,  0.03, -0.02],  // at 50%: near form begins expanding right/up
    [1.0, 2,  0.09, -0.05],  // at 100%: near form fully expanded
    [0.5, 0,  0.00,  0.02],  // at 50%: far form drifts slightly
    [1.0, 0,  0.00,  0.04],  // at 100%: far form settled lower
  ],
};
