/**
 * Gate B0 — DÜN 0:00–0:48 authored motion timeline.
 *
 * All visual state is a pure function of audio.currentTime (t).
 * No audio reactivity, no beat detection. Deterministic.
 * Seeking always reconstructs the correct visual state.
 *
 * Shot map:
 *   0:00–0:10  Shot 1 — mystery: single thin edge of light, one dark plane
 *   0:10–0:22  Shot 2 — second plane enters, depth through occlusion, letterform
 *   0:22–0:43  Shot 3 — vocal entrance, lyric fragments, tension builds at 0:34
 *   0:43–0:48  Shot 4 — reveal: constraining structure opens, larger space exposed
 */

// ── Easing functions ──────────────────────────────────────────────────────────

export type EasingFn = (t: number) => number;

export const ease = {
  linear:     (t: number) => t,
  in2:        (t: number) => t * t,
  out2:       (t: number) => 1 - (1 - t) * (1 - t),
  out3:       (t: number) => 1 - Math.pow(1 - t, 3),
  out4:       (t: number) => 1 - Math.pow(1 - t, 4),
  inOut3:     (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOut4:     (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  outExpo:    (t: number) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  heavyDecel: (t: number) => 1 - Math.pow(1 - t, 4),
} as const;

// ── Core interpolation ────────────────────────────────────────────────────────

/**
 * Keyframe: [time, value, easingFnIntoThisKeyframe?]
 * The easing governs the segment from the PREVIOUS keyframe to this one.
 */
export type KF = readonly [number, number, EasingFn?];

/** Interpolate a numeric value given keyframes at time t. */
export function interp(t: number, kfs: readonly KF[]): number {
  if (kfs.length === 0) return 0;
  if (t <= kfs[0][0]) return kfs[0][1];
  const last = kfs[kfs.length - 1];
  if (t >= last[0]) return last[1];

  for (let i = 1; i < kfs.length; i++) {
    const [t1, v1, ef] = kfs[i];
    const [t0, v0]     = kfs[i - 1];
    if (t <= t1) {
      const p  = (t - t0) / (t1 - t0);
      const ep = ef ? ef(p) : p;
      return v0 + (v1 - v0) * ep;
    }
  }
  return last[1];
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const REVEAL_START = 43.0;
export const REVEAL_DONE  = 45.5;
export const SEQ_END      = 48.0;

// ── Plane 1: constraining foreground slab ─────────────────────────────────────
//
// The plane polygon in SVG has its right edge at x≈212–215 (slightly diagonal).
// translateX > 0 → whole group shifts RIGHT: edge advances, covers more frame.
// translateX < 0 → whole group shifts LEFT: edge retreats, exposes what's behind.
//
// Shot 1 (0–10s)  : tx=0–10.   Right edge at x=212–225.  Barely visible drift.
// Shot 2 (10–22s) : tx=10–16.  Stable. Plane 2 enters the right-side void.
// Shot 3 (22–34s) : tx=16–20.  Vocal entrance. Composition shifts.
// Tension (34–43s): tx=20→155. Edge advances to x=367 — covers 94% of frame.
// Reveal  (43–45s): tx → -630. Plane exits LEFT at velocity. Everything exposed.

export const PLANE1_TX: readonly KF[] = [
  [0.0,   0,    ease.linear],
  [1.5,   3,    ease.heavyDecel],
  [10.0,  10,   ease.linear],
  [22.0,  16,   ease.linear],
  [34.0,  20,   ease.linear],
  [40.5,  152,  ease.inOut4],
  [42.5,  155,  ease.out2],
  [43.0,  155,  ease.linear],
  [45.2,  -630, ease.outExpo],
  [SEQ_END, -630, ease.linear],
];

export const PLANE1_EDGE_OP: readonly KF[] = [
  [0.0,  0.0],
  [0.9,  0.0],
  [1.8,  0.80, ease.heavyDecel],
  [40.0, 0.88],
  [43.0, 0.90],
  [44.8, 0.0,  ease.out2],
];

// ── Plane 2: second structural plane, entering from top-right at t=10 ─────────
//
// Oriented differently from Plane 1 (angled diagonal vs. near-vertical).
// Enters slowly — not triggered by the drum hit, just arrives.
// Its diagonal left edge occludes the large letterform, establishing depth.
// Exits during the reveal at t=43.

export const PLANE2_TY: readonly KF[] = [
  [0.0,  -530, ease.linear],
  [9.5,  -530, ease.linear],
  [14.2, 0,    ease.inOut3],
  [22.0, 0,    ease.linear],
  [27.0, -65,  ease.inOut3],
  [34.0, -72,  ease.linear],
  [43.0, -72,  ease.linear],
  [45.0, -530, ease.outExpo],
  [SEQ_END, -530, ease.linear],
];

export const PLANE2_OP: readonly KF[] = [
  [0.0,  0.0],
  [9.5,  0.0],
  [12.0, 1.0, ease.heavyDecel],
  [43.0, 1.0],
  [45.0, 0.0, ease.out2],
];

// ── Large letterform: "DÜN" at 360px — cropped, reads as geometry first ───────
//
// Positioned so Plane 1 hides the "D" and left portion of "Ü".
// Right portion of "Ü" + beginning of "N" is visible in the void area.
// At large scale the letter curves read as abstract geometric forms.
// As Plane 1 advances (tension), the letterform is progressively consumed.

export const LETTER_OP: readonly KF[] = [
  [0.0,  0.0],
  [11.5, 0.0],
  [14.5, 0.92, ease.heavyDecel],
  [30.0, 0.92],
  [33.5, 0.0,  ease.inOut3],   // fades out BEFORE tension (t=34) starts
  // Letterform must be gone before Plane1's left edge begins uncovering
  // the "D" on the far left — avoids two type fragments moving opposite
  // directions during the tension phase.
];

export const LETTER_TY: readonly KF[] = [
  [0.0,  0],
  [22.0, 0],
  [29.0, -50, ease.inOut3],
  [SEQ_END, -50],
];

// ── Small "DÜN" typography (lower-right quiet zone) ───────────────────────────

export const TYPE_DUN_OP: readonly KF[] = [
  [0.0,  0.0],
  [4.5,  0.0],
  [6.2,  0.68, ease.heavyDecel],
  [41.0, 0.68],
  [43.5, 0.0,  ease.out2],
];

// ── Lyric 1: "Bir hayatım vardı" ──────────────────────────────────────────────
// Appears in the void at x=238. Plane1 edge is at x≈228–235 during this window.
// Fades before the tension phase starts.

export const LYRIC1_OP: readonly KF[] = [
  [0.0,  0.0],
  [25.8, 0.0],
  [27.5, 0.82, ease.heavyDecel],
  [32.0, 0.82],
  [34.0, 0.0,  ease.out2],
];

// ── Lyric 2: "kendince güzel" ─────────────────────────────────────────────────
// Appears at x=295. By t≈38 the advancing Plane1 edge reaches x=295 — the
// lyric is physically swallowed by the dark structure. This is the effect.

export const LYRIC2_OP: readonly KF[] = [
  [0.0,  0.0],
  [35.5, 0.0],
  [37.0, 0.76, ease.heavyDecel],
  [43.0, 0.76],
  [SEQ_END, 0.0],
];

// ── Deep space: always rendered, revealed when Plane 1 exits ──────────────────
// A different kind of space: cool temperature, multiple planes at different
// scales (depth through scale contrast), first spectral color (teal), vast void.

export const DEEP_OP: readonly KF[] = [
  [0.0,  0.0],
  [43.2, 0.0],
  [45.5, 1.0, ease.outExpo],
  [SEQ_END, 1.0],
];

// ── Background: very subtle luminance lift at the reveal ─────────────────────

export const BG_LUMINANCE: readonly KF[] = [
  [0.0,  0.0],
  [43.0, 0.0],
  [47.0, 0.06, ease.inOut3],
  [SEQ_END, 0.06],
];
