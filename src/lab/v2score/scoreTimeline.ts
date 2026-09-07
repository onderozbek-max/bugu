/**
 * DÜN — Authored audiovisual score timeline.
 * CHECKPOINT 1: 0:00–1:35
 *
 * Three time modes:
 *   ?t=N      frozen frame for screenshots
 *   ?demo=1   internal clock (performance.now) for screen recording
 *   default   AudioEngine.element.currentTime
 *
 * ALL state is a pure function of t. Seeking reconstructs correctly.
 */

import { AudioEngine } from "../../audio/AudioEngine";

// ── Time source ────────────────────────────────────────────────────────────────

const _params = new URLSearchParams(window.location.search);

/** Frozen time for screenshot mode (?t=5 renders scene at exactly t=5s). */
export const FROZEN_T: number | null =
  _params.get("t") !== null ? parseFloat(_params.get("t")!) : null;

/** Demo mode: use an internal clock driven by performance.now(). */
export const IS_DEMO = _params.get("demo") === "1";

let _demoStart: number | null = null;

export function resetDemoClock() {
  _demoStart = performance.now();
}

/** Get the canonical scene time in seconds. */
export function getSceneTime(): number {
  if (FROZEN_T !== null) return FROZEN_T;
  if (IS_DEMO) {
    if (_demoStart === null) _demoStart = performance.now();
    return (performance.now() - _demoStart) / 1000;
  }
  return AudioEngine.element.currentTime;
}

// ── Easing ────────────────────────────────────────────────────────────────────

export type EasingFn = (t: number) => number;

export const ease = {
  linear:     (t: number) => t,
  out2:       (t: number) => 1 - (1 - t) ** 2,
  out3:       (t: number) => 1 - (1 - t) ** 3,
  out4:       (t: number) => 1 - (1 - t) ** 4,
  inOut3:     (t: number) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  heavyDecel: (t: number) => 1 - (1 - t) ** 4,
  outExpo:    (t: number) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
} as const;

export type KF = readonly [number, number, EasingFn?];

/** Interpolate a scalar value at time t from authored keyframes. */
export function interp(t: number, kfs: readonly KF[]): number {
  if (!kfs.length) return 0;
  if (t <= kfs[0][0]) return kfs[0][1];
  const last = kfs[kfs.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < kfs.length; i++) {
    const [t1, v1, ef] = kfs[i];
    const [t0, v0] = kfs[i - 1];
    if (t <= t1) {
      const p = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (ef ? ef(p) : p);
    }
  }
  return last[1];
}

// ── Authored path data ─────────────────────────────────────────────────────────
//
// P1:    Main diagonal. Guitar inscription (0:00–0:10+).
//        Enters from below viewport, rises steeply, changes direction at kink.
//        Renders in FRONT layer (occludes P2 at crossing).
//
// P2:    Second diagonal. Drums enter (0:10+).
//        Enters from upper right, crosses P1 (behind it), continues down-left.
//        Renders in BACK layer.
//
// PCONN: Short bridge connecting P1 kink to P2 kink. Completes at 0:43.
//        Triggers light propagation through both paths.
//
// P3A,B: Short secondary strokes during vocal phase (0:22–0:43).
//
// P4A:   Post-connection extension from P1 end (0:45+).
// P4B:   Branch from junction upward — passes through SONRA SEN area (0:46+).
//        Renders in FRONT layer (appears in front of chorus typography).
//
// P1_PULSE: Reversed P1 first segment — used for light propagation only.
// P2_PULSE: P2 second segment — light propagation only.

export const PATHS = {
  P1:       "M 120,890 L 195,340 L 355,490",
  P2:       "M 415,175 L 182,388 L 60,640",
  PCONN:    "M 195,340 L 182,388",
  P3A:      "M 255,192 L 308,152",
  P3B:      "M 62,498 L 88,458",
  P4A:      "M 355,490 L 328,628",
  P4B:      "M 195,340 L 152,258",
  P1_PULSE: "M 195,340 L 120,890",      // reversed P1 seg1 for back-propagation
  P2_PULSE: "M 182,388 L 60,640",       // P2 seg2 for forward-propagation
  SUSP_PULSE: "M 415,175 L 182,388",    // P2 seg1, slow pulse during suspension
} as const;

// ── Draw-progress keyframes (0 = not started, 1 = fully drawn) ───────────────

// P1 — slow deliberate inscription, changes direction at kink (~71% of path)
// Rate slows in construction phase while P2 also draws.
// Continues very slowly through vocal phase toward connection point.
export const P1_DRAW: readonly KF[] = [
  [0.0,  0],
  [0.8,  0],                          // true silence before inscription begins
  [9.5,  0.71, ease.heavyDecel],      // kink reached (~end of guitar section)
  [20.0, 0.88, ease.out3],            // segment 2 drawing slowly (construction)
  [38.0, 0.94, ease.out4],            // creeping toward junction (anticipation)
  [43.0, 1.0,  ease.out2],            // completes as connection fires
];

// P2 — starts after drums, different orientation, more fluid than P1
export const P2_DRAW: readonly KF[] = [
  [0,    0],
  [10.5, 0],                          // delayed start — NOT on the drum hit
  [17.5, 0.56, ease.out3],            // segment 1 mostly complete
  [25.0, 1.0,  ease.out2],            // segment 2 complete
];

// PCONN — approaches slowly (0:38–0:43), lands at the payoff
export const PCONN_DRAW: readonly KF[] = [
  [0,    0],
  [38.5, 0],
  [43.0, 1.0, ease.out2],
];

// P3A — brief secondary stroke during vocal phase
export const P3A_DRAW: readonly KF[] = [
  [0,    0],
  [24.0, 0],
  [28.0, 1.0, ease.heavyDecel],
];

// P3B — second secondary stroke
export const P3B_DRAW: readonly KF[] = [
  [0,    0],
  [30.5, 0],
  [35.0, 1.0, ease.heavyDecel],
];

// P4A — extends from P1's endpoint post-connection
export const P4A_DRAW: readonly KF[] = [
  [0,    0],
  [45.0, 0],
  [56.0, 1.0, ease.out3],
];

// P4B — branch from junction, grows toward chorus (passes through SONRA area)
export const P4B_DRAW: readonly KF[] = [
  [0,    0],
  [47.0, 0],
  [60.0, 1.0, ease.out3],
];

// ── Light pulse progress (0 = at path start, 1 = pulse has traversed full path) ─

// P1 reverse-propagation: light travels from junction back toward P1's origin
export const P1_PULSE_POS: readonly KF[] = [
  [0,    0],
  [43.2, 0],
  [52.0, 1.0, ease.out3],
];

// P2 forward-propagation: light travels from junction to P2's end
export const P2_PULSE_POS: readonly KF[] = [
  [0,    0],
  [43.5, 0],
  [51.0, 1.0, ease.out3],
];

// P1 pulse opacity — appears with connection, fades after traversal
export const P1_PULSE_OP: readonly KF[] = [
  [0,    0],
  [43.2, 0],
  [43.5, 1.0, ease.out3],
  [51.5, 0.4],
  [55.0, 0,   ease.out2],
];

// P2 pulse opacity
export const P2_PULSE_OP: readonly KF[] = [
  [0,    0],
  [43.5, 0],
  [43.8, 1.0, ease.out3],
  [52.0, 0.4],
  [55.0, 0,   ease.out2],
];

// Suspension pulse (1:05–1:15): one slow light through P2 path
export const SUSP_PULSE_POS: readonly KF[] = [
  [0,    0],
  [65.0, 0],
  [75.0, 1.0, ease.linear],
];

export const SUSP_PULSE_OP: readonly KF[] = [
  [0,    0],
  [65.0, 0],
  [66.0, 0.55, ease.out2],
  [74.0, 0.55],
  [75.5, 0,   ease.out2],
];

// ── Drawing head bloom ─────────────────────────────────────────────────────────

// P1 drawing head visibility
export const P1_HEAD_OP: readonly KF[] = [
  [0,    0],
  [0.8,  0],
  [1.2,  0.75, ease.out3],
  [9.0,  0.75],
  [20.0, 0.45],
  [25.0, 0,    ease.out3],
  [38.5, 0],
  [38.7, 0.65, ease.out3],  // resumes as it approaches junction
  [43.2, 0,    ease.out3],
];

// P2 drawing head visibility
export const P2_HEAD_OP: readonly KF[] = [
  [0,    0],
  [10.5, 0],
  [11.0, 0.65, ease.out3],
  [24.0, 0.65],
  [26.0, 0,    ease.out3],
];

// ── Junction and connection bloom ─────────────────────────────────────────────

// Crossing bloom: brief glow when P2's head crosses P1 (around 0:14–0:16)
export const JUNCTION_BLOOM: readonly KF[] = [
  [0,    0],
  [13.5, 0],
  [14.5, 0.70, ease.heavyDecel],
  [16.0, 0.70],
  [17.5, 0,    ease.out2],
];

// Connection bloom at 0:43 payoff
export const CONN_BLOOM: readonly KF[] = [
  [0,    0],
  [43.0, 0],
  [43.5, 1.0,  ease.out3],
  [50.0, 0.45],
  [58.0, 0,    ease.out3],
];

// Spectral color at junction (first warm tint — earned at 0:43)
export const SPECTRAL_OP: readonly KF[] = [
  [0,    0],
  [43.0, 0],
  [44.2, 1.0,  ease.out3],
  [58.0, 0.85],
  [65.0, 0,    ease.out3],
];

// ── Typography: SONRA SEN (first chorus, 1:15–1:35) ──────────────────────────
//
// Clip-rect width expressed as fraction (0 = no text visible, 1 = fully revealed).
// Clip rects are generous fixed-pixel widths; fraction maps to pixel width.
// Geometry (P4B, P1) renders in FRONT LAYER (above text) — automatic z-order.

export const SONRA_REVEAL: readonly KF[] = [
  [0,    0],
  [75.0, 0],                        // 1:15 chorus
  [77.8, 1.0, ease.heavyDecel],     // reveals over ~2.8s
];

export const SEN_REVEAL: readonly KF[] = [
  [0,    0],
  [77.5, 0],                        // starts as SONRA finishes
  [79.5, 1.0, ease.heavyDecel],
];

// Typography absorption: geometry "reclaims" the text
// Expressed as fraction; 1 = fully hidden (clip rect width = 0)
export const TYP_ABSORB: readonly KF[] = [
  [0,    0],
  [88.0, 0],                        // ~1:28 absorption begins
  [93.0, 1.0, ease.inOut3],         // fully absorbed by ~1:33
];
