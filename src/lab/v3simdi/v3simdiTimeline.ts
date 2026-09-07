/**
 * V3 ŞİMDİ — Authored audiovisual score timeline.
 * Full song: 0:00–3:33 (213.21 seconds)
 *
 * VISUAL FORM: ∞ → HEART morph.
 * The completed YARIN ∞ transforms into the heart over the entire song.
 *
 * CRITICAL RULE: heart must NOT be recognizable before 2:21 (t=141).
 *   Before t=141: morphT ≤ 0.88 — form is abstract, ambiguous.
 *   At t=141 (THE REVELATION): morphT → 1.0 + heart extras appear.
 *   Recognition arrives from structural completion, not gradual drift.
 *
 * Three time modes: ?t=N  ?demo=1  default=AudioEngine.element.currentTime
 *
 * Musical landmarks (from spec):
 *   0:00–0:17  clean guitar only
 *   0:17–0:33  drums enter
 *   0:33–0:45  drums stop, vocals
 *   0:45–0:52  suspension
 *   0:52–1:17  all instruments
 *   1:17–1:24  intimate suspension
 *   1:24–1:38  final construction phase starts
 *   1:38–2:03  vocals, escalating coordination
 *   2:03–2:17  THE INHALE — final connection inscribed
 *   2:17–2:21  IGNITION — light propagates outward
 *   2:21–2:30  THE REVELATION — heart complete and readable
 *   2:30–2:40  EXPANSION
 *   2:40–2:56  FLIGHT
 *   2:56–3:05  SECOND REVELATION WAVE
 *   3:05–3:13  MAXIMUM COHERENCE
 *   3:13–3:33  THE EXHALE — held heart, bloom recedes
 */

import { AudioEngine } from "../../audio/AudioEngine";

// ── Time source ────────────────────────────────────────────────────────────────

const _params = new URLSearchParams(window.location.search);

export const FROZEN_T: number | null =
  _params.get("t") !== null ? parseFloat(_params.get("t")!) : null;

export const IS_DEMO = _params.get("demo") === "1";

let _demoStart: number | null = null;

export function resetDemoClock() {
  _demoStart = performance.now();
}

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

// ── Morph coordinate data ─────────────────────────────────────────────────────
//
// Source: COORDS["infinity"] and COORDS["heart"] from FormsLab.tsx

export const INF_COORDS = {
  lo: [195,418, 128,418, 8,318,   8,420,   8,522,   128,422, 195,422],
  ro: [195,418, 262,418, 382,318, 382,420, 382,522, 262,422, 195,422],
  li: [195,420, 188,420, 178,420, 178,420, 178,420, 188,420, 195,420], // collapsed
  ri: [195,420, 202,420, 212,420, 212,420, 212,420, 202,420, 195,420], // collapsed
  sp: [195,390, 195,450],
} as const;

export const HEART_COORDS = {
  lo: [195,240, 48,128,  18,238,  18,356,  18,474,  105,574, 195,660],
  ro: [195,240, 342,128, 372,238, 372,356, 372,474, 285,574, 195,660],
  li: [195,290, 92,196,  62,280,  62,358,  62,436,  135,524, 195,618],
  ri: [195,290, 298,196, 328,280, 328,358, 328,436, 255,524, 195,618],
  sp: [195,240, 195,295],
} as const;

// ── Morph helpers ─────────────────────────────────────────────────────────────

export function lerpCoords(a: readonly number[], b: readonly number[], t: number): number[] {
  return (a as number[]).map((v, i) => v + (b[i] - v) * t);
}

export function build2C(c: number[]): string {
  return `M ${c[0]},${c[1]} C ${c[2]},${c[3]} ${c[4]},${c[5]} ${c[6]},${c[7]} ` +
         `C ${c[8]},${c[9]} ${c[10]},${c[11]} ${c[12]},${c[13]}`;
}

export function buildL(c: number[]): string {
  return `M ${c[0]},${c[1]} L ${c[2]},${c[3]}`;
}

// ── ∞ extras (fading out) ─────────────────────────────────────────────────────

export const INF_EXTRA_PATHS = {
  CROSS_L: "M 180,413 L 210,427",
  CROSS_R: "M 210,413 L 180,427",
} as const;

// ── Heart extras (fading in at THE REVELATION) ────────────────────────────────
//
// These are NOT in the morph system.
// They appear at t=141 (THE REVELATION) to complete the heart silhouette.
// Their arrival makes the heart suddenly readable — the "perspective reveal" in 2D.

export const HEART_EXTRA_PATHS = {
  RIB_UL:   "M 106,224 L 18,356",    // upper-left diagonal rib
  RIB_UR:   "M 284,224 L 372,356",   // upper-right diagonal rib
  RIB_LL:   "M 82,480 L 195,618",    // lower-left rib → heart point
  RIB_LR:   "M 308,480 L 195,618",   // lower-right rib → heart point
  NOTCH_L:  "M 195,240 C 166,218 138,218 112,236",  // left lobe crown notch
  NOTCH_R:  "M 195,240 C 224,218 252,218 278,236",  // right lobe crown notch
  // Final connection: the lower-right rib drawn during THE INHALE (2:03–2:17)
  // Appears as a dedicated drawn element with a drawing head.
  FINAL_CNX: "M 308,480 L 195,618",  // same as RIB_LR — the pivotal stroke
} as const;

// ── Morph timeline ────────────────────────────────────────────────────────────
//
// morphT: 0.0 = ∞ pose, 1.0 = heart pose.
//
// RULE: morphT must NOT reach 1.0 (or anything obviously heart-shaped) before t=141.
// Heart recognition threshold is approximately morphT ≈ 0.90.
// At t=137-141: a final structural element (FINAL_CNX) is inscribed.
// At t=141: morphT snaps to 1.0 simultaneously with heart extras appearing.

export const MORPH_KF: readonly KF[] = [
  // RULE: form must NOT read as heart before t=141.
  // Heart recognition threshold is morphT ≈ 0.45.
  // We stay WELL below that until t=137, then snap via outExpo in 4 seconds.
  // The 4-second snap IS the revelation — the form rushes to completion
  // simultaneously with the drum build (2:17–2:21).
  [0,   0.00],                        // ∞ from YARIN
  [17,  0.01, ease.out3],             // drums: imperceptible
  [33,  0.03, ease.out3],             // vocals: very slight vertical pull
  [52,  0.06, ease.out3],             // all instruments: clearly ∞-derived
  [77,  0.10, ease.out3],             // 1:17 suspension: slightly elongated ∞
  [98,  0.18, ease.out3],             // 1:38 construction: abstract, changing
  [123, 0.28, ease.out3],             // 2:03 INHALE: form clearly in transition
  [137, 0.34, ease.out4],             // 2:17 IGNITION: still not recognizably heart
  [141, 1.00, ease.outExpo],          // 2:21 THE REVELATION — SNAP to heart
  [213, 1.00],
];

// ── ∞ extras opacity (crossing accent — fades out as form departs ∞) ─────────

export const INF_EXT_OP: readonly KF[] = [
  [0,   1.00],                        // ∞ extras visible at YARIN end
  [17,  0.80],
  [52,  0.25, ease.out3],
  [77,  0.00],                        // gone by 1:17
];

// ── Inner arcs opacity ────────────────────────────────────────────────────────
// LI and RI: were collapsed (invisible) in ∞, grow into heart lobes.
// Fade IN as morph progresses (heart inner arcs show depth).

// Inner arcs: invisible until THE REVELATION.
// They contribute strongly to heart recognition — must NOT appear before t=141.
export const INNER_OP: readonly KF[] = [
  [0,   0.00],
  [141, 0.00],                        // strictly zero before the reveal
  [144, 0.65, ease.outExpo],          // snap in at THE REVELATION
  [185, 0.75],
  [213, 0.75],
];

// ── Heart extras opacity ──────────────────────────────────────────────────────
// Structural ribs + notch arcs: arrive at THE REVELATION (t=141).
// Their appearance is what makes the heart suddenly readable.

export const HEART_EXT_OP: readonly KF[] = [
  [0,   0.00],
  [141, 0.00],
  [144, 0.80, ease.outExpo],          // rapid emergence at THE REVELATION
  [213, 0.80],
];

// ── Final connection — drawn during THE INHALE ────────────────────────────────
// One luminous path inscribed deliberately at 2:03–2:17 (t=123–137).
// This is the lower-right rib (→ heart point). Its completion triggers IGNITION.

// Final connection: starts at IGNITION (t=137), completes by THE REVELATION (t=141).
// Brief 4-second inscription that slots in as the form rushes to completion.
// Appears at heart coordinates — visually merges with the snapping outer arcs.
export const FINAL_CNX_DRAW: readonly KF[] = [
  [0,   0],
  [137, 0],                           // starts at IGNITION
  [141, 1.0, ease.heavyDecel],        // completes at THE REVELATION
];

export const FINAL_CNX_HEAD_OP: readonly KF[] = [
  [0,   0],
  [137, 0],
  [137.3, 0.85, ease.out3],
  [140.8, 0.85],
  [141.5, 0,   ease.out3],
];

// ── IGNITION pulse (t=137–141) ────────────────────────────────────────────────
// Amber light propagates through the near-complete heart BEFORE the reveal.
// Path: LO arc (left lobe outer, now in heart pose at morph≈0.87).
// The pulse sets the stage for THE REVELATION.

export const IGNITION_POS: readonly KF[] = [
  [0,   0],
  [137, 0],
  [143, 1.0, ease.out3],
];

export const IGNITION_OP: readonly KF[] = [
  [0,   0],
  [137, 0],
  [137.5, 0.95, ease.out3],
  [142,   0.50],
  [145,   0,   ease.out2],
];

// ── REVELATION BLOOM (t=141) ──────────────────────────────────────────────────
// Large warm bloom covering the full heart form at the reveal moment.

export const REVEAL_BLOOM_OP: readonly KF[] = [
  [0,   0],
  [141, 0],
  [142, 1.00, ease.outExpo],          // instant bloom
  [148, 0.65],
  [160, 0.40],
  [185, 0.20],                        // fades gently through MAXIMUM COHERENCE
  [193, 0.10, ease.out3],             // THE EXHALE
  [213, 0.00],
];

// ── Outro orbit dots — heart lobe ellipses ────────────────────────────────────
//
// Three amber dots orbiting separate parts of the completed heart.
// Ellipse approximations of the heart's two outer lobes + one inner lobe.
//
// Left outer lobe:   cx=106, cy=420, rx=88, ry=175
// Right outer lobe:  cx=284, cy=420, rx=88, ry=175
// Inner arc (left):  cx=128, cy=407, rx=66, ry=130
//
// Phase diagram (phase=0 = top of each ellipse):
//   Dot L: left outer, starts at top (phase=0)
//   Dot R: right outer, starts at bottom (phase=0.5) → always opposite Dot L
//   Dot I: inner left, starts at 0.25 (rightmost) → offset for visual spread

export const HEART_OUTER_L_CX = 106;
export const HEART_OUTER_L_CY = 420;
export const HEART_OUTER_R_CX = 284;
export const HEART_OUTER_R_CY = 420;
export const HEART_OUTER_RX   = 88;
export const HEART_OUTER_RY   = 175;

export const HEART_INNER_CX = 128;
export const HEART_INNER_CY = 407;
export const HEART_INNER_RX = 66;
export const HEART_INNER_RY = 130;

// ── THE EXHALE glow — held heart breathing ────────────────────────────────────
// Gentle arc brightness during the outro (t=193–213).
// Not a bloom circle — just the paths' glow opacity increasing slightly.
export const EXHALE_GLOW: readonly KF[] = [
  [0,   0],
  [193, 0],
  [198, 0.55, ease.out3],
  [213, 0.30, ease.out3],
];
