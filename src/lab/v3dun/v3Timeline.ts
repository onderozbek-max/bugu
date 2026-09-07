/**
 * V3 DÜN — Authored audiovisual score timeline.
 * CHECKPOINT 1: 0:00–1:35
 *
 * Construction order for DELAYED KEY RECOGNITION.
 * At 1:35 the structure reads as "architectural / formal" — ring OPEN,
 * shaft not yet reaching the ring, no teeth. Recognition deferred to DÜN peak.
 *
 * Three time modes:
 *   ?t=N      frozen frame — screenshots
 *   ?demo=1   internal clock (performance.now) — screen recording
 *   default   AudioEngine.element.currentTime
 *
 * All state is a pure function of t. Seeking reconstructs correctly.
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

// ── Authored path data ─────────────────────────────────────────────────────────
//
// KEY FORM — coordinate source: COORDS["key"] in FormsLab.tsx
//
// LO (left_outer): Left half of key ring. Primary inscription.
//   (195,172) → sweeps LEFT → left equator (72,296) → toward ring base.
//   FRONT layer. CAPPED AT 80%: tip hangs at ≈(146,370) — open C-arc.
//   An open arc is abstract; returning to the base would close a ring. ← KEY RULE
//
// RO (right_outer): Right half of key ring. DEFERRED TO CHORUS (t=75+).
//   First appearance at 1:15 coincides with SONRA SEN — new structural event.
//   Caps at ~35% in CP1 — only the upper-right arc portion visible.
//   BACK layer — behind LO.
//
// SP (spine / shaft): Draws from BOTTOM upward.
//   Terminal y=540 — keeps shaft well clear of ring base (y=420) at all times.
//   BACK layer. Shaft and ring remain visually separate (160px+ gap).
//
// SEC_R: Short secondary right accent — small diagonal in upper ring area.
//   Appears during vocal phase (0:24–0:28) to balance composition.
//   BACK layer.
//
// LI (left_inner): Inner left ring arc. Depth element post-connection.
//   FRONT layer — concentric inside LO.
//
// RI (right_inner): Enters at chorus (1:15+). FRONT layer.
//
// RIB_LL: Lower-left structural rib — (128,370)→(195,420). Fires 0:43.
//   FRONT layer.
//
// LO_PULSE: Reversed LO arc — amber light, ring base → ring top (proves reactivation).
// SUSP_PULSE: LO arc — slow amber sweep, suspension (1:05–1:15).
// SP_PULSE: Shaft, top-to-bottom — amber light descends through shaft (chorus).

export const PATHS = {
  // ── CP1 paths (0:00–1:35) — DO NOT MODIFY ────────────────────────────────
  LO:         "M 195,172 C 118,148 72,212 72,296 C 72,380 118,424 195,420",
  RO:         "M 195,172 C 272,148 318,212 318,296 C 318,380 272,424 195,420",
  LI:         "M 195,224 C 152,210 128,250 128,296 C 128,342 152,374 195,372",
  RI:         "M 195,224 C 238,210 262,250 262,296 C 262,342 238,374 195,372",
  SP:         "M 195,720 L 195,540",  // shaft, bottom-up, terminal 180px clear of ring base
  SEC_R:      "M 255,192 L 312,148",  // small secondary accent, upper-right ring area
  RIB_LL:     "M 128,370 L 195,420",  // connection rib, fires 0:43
  LO_PULSE:   "M 195,420 C 118,424 72,380 72,296 C 72,212 118,148 195,172", // reversed LO
  SUSP_PULSE: "M 195,172 C 118,148 72,212 72,296 C 72,380 118,424 195,420", // same as LO
  SP_PULSE:   "M 195,540 L 195,720",  // shaft top-to-bottom (light descends)

  // ── CP2 paths (1:35–3:44) ─────────────────────────────────────────────────
  // SP_EXT: shaft extension — continues SP from y=540 upward through the ring.
  //   Activates at t=100 (1:40). Tip crosses ring base (y=420) at t≈130 (2:10)
  //   = DEPTH CROSSING: shaft passes behind ring arcs (BACK layer) for the first time.
  //   Fully drawn by t=180 (3:00) — shaft runs top to bottom of the full key.
  SP_EXT:     "M 195,540 L 195,172",  // shaft extension, y=540 → y=172 (368px)

  // Key structural ribs (KeyExtras in FormsLab)
  RIB_UL:     "M 140,212 L 72,296",   // upper-left rib: inside ring → outer arc midpoint
  RIB_UR:     "M 250,212 L 318,296",  // upper-right rib: symmetric
  RIB_LR:     "M 262,370 L 195,420",  // lower-right rib: symmetric to RIB_LL

  // Ring-top notch arcs (subtle detail crowning the ring)
  NOTCH_L:    "M 195,172 C 170,156 144,160 120,180",
  NOTCH_R:    "M 195,172 C 220,156 246,160 270,180",

  // Key teeth — appear LAST, confirming key recognition
  TOOTH_1:    "M 195,516 L 138,516",
  TOOTH_2:    "M 195,576 L 154,576",
  TOOTH_3:    "M 195,636 L 138,636",

  // Shaft bottom cap
  SHAFT_CAP:  "M 175,720 L 215,720",

  // CP2 pulse paths
  // SP_EXT reversed — amber light descends through upper shaft (crossing beat)
  SP_EXT_PULSE: "M 195,172 L 195,540",

  // OUTRO cycling pulse paths — three dots flowing through completed key
  //
  // RING_LOOP: full ring traversal in one continuous path.
  //   LO arc (ring top → ring base via left) +
  //   reversed RO arc (ring base → ring top via right) = closed loop, no jump.
  //   Two dots use this path at 50% phase offset → they stay diametrically opposite.
  RING_LOOP:   "M 195,172 C 118,148 72,212 72,296 C 72,380 118,424 195,420"
             + " C 272,424 318,380 318,296 C 318,212 272,148 195,172",

  // Full shaft — top-to-bottom (triangle-wave pendulum = smooth bounce)
  OUTRO_SHAFT: "M 195,172 L 195,720",  // full shaft 548px
} as const;

// ── Draw-progress keyframes (0 = invisible, 1 = fully drawn) ─────────────────

// LO — primary inscription, opens 0:00.
// 0→62%: reaches left equator (72,296) — ambiguous arch from top-center.
// CP1 HARD CAP 80% (t=75–95): tip hangs at ≈(146,370). Ring stays open.
// CP2 continuation (t=95+): resumes, reaches 100% at t=155 (2:35) — ring left CLOSES.
export const LO_DRAW: readonly KF[] = [
  [0.0,  0],
  [0.5,  0],                          // brief silence before first mark
  [9.5,  0.62, ease.heavyDecel],      // left equator reached (~0:10)
  [38.0, 0.70, ease.out4],            // creeps through vocal phase
  [43.0, 0.74, ease.out2],            // connection payoff
  [60.0, 0.78, ease.out3],            // post-release continues
  [75.0, 0.80, ease.out3],            // chorus onset — CP1 holds here
  [95.0, 0.80],                       // CP1 end / CP2 seam
  // CP2 continuation ────────────────────────────────────────────────────────
  [120.0, 0.88, ease.out3],           // 2:00
  [140.0, 0.95, ease.out3],           // 2:20
  [155.0, 1.00, ease.out2],           // 2:35 — RING LEFT CLOSES (arc returns to base)
];

// RO — deferred to CHORUS (t=75+). Caps at 35% in CP1.
// CP2: extends to 100% at t=160 (2:40) — RING RIGHT CLOSES. BACK layer.
export const RO_DRAW: readonly KF[] = [
  [0,    0],
  [75.0, 0],                          // does NOT appear until SONRA SEN chorus
  [85.0, 0.28, ease.out3],
  [93.0, 0.35, ease.out2],
  // CP2 continuation ────────────────────────────────────────────────────────
  [115.0, 0.55, ease.out3],           // 1:55
  [138.0, 0.80, ease.out3],           // 2:18
  [160.0, 1.00, ease.out2],           // 2:40 — RING RIGHT CLOSES
];

// SP — shaft (lower portion, y=720→y=540). CP2: completes quickly.
// SP_EXT takes over from y=540 upward through the ring.
export const SP_DRAW: readonly KF[] = [
  [0,    0],
  [10.0, 0],                          // delayed — LO leads
  [18.0, 0.55, ease.out3],            // lower shaft visible
  [22.0, 0.60, ease.out4],
  [43.0, 0.70, ease.out3],            // post-connection
  [60.0, 0.80, ease.out3],
  [80.0, 0.90, ease.out3],            // chorus
  [93.0, 0.97, ease.out2],            // nearly full
  // CP2: complete SP before SP_EXT takes over
  [105.0, 1.00, ease.out2],           // 1:45 — SP fully drawn
];

// SEC_R — brief secondary right accent during vocal phase (0:24–0:28).
// Short diagonal in upper-right ring area — balances composition without
// committing to the ring form.
export const SEC_R_DRAW: readonly KF[] = [
  [0,    0],
  [24.0, 0],
  [28.0, 1.0, ease.heavyDecel],
];

// LI — inner left arc. CP2: completes by 2:25.
export const LI_DRAW: readonly KF[] = [
  [0,    0],
  [45.0, 0],
  [65.0, 0.45, ease.out3],
  [80.0, 0.65, ease.out3],
  [95.0, 0.78, ease.out2],
  // CP2 ──────────────────────────────────────────────────────────────────────
  [120.0, 0.90, ease.out3],
  [145.0, 1.00, ease.out2],           // 2:25 — inner left arc complete
];

// RI — inner right arc. CP2: completes by 2:30.
export const RI_DRAW: readonly KF[] = [
  [0,    0],
  [75.0, 0],
  [88.0, 0.38, ease.out3],
  [95.0, 0.55, ease.out2],
  // CP2 ──────────────────────────────────────────────────────────────────────
  [120.0, 0.72, ease.out3],
  [150.0, 1.00, ease.out2],           // 2:30 — inner right arc complete
];

// RIB_LL — connection rib, fires at 0:43 payoff.
export const RIB_LL_DRAW: readonly KF[] = [
  [0,    0],
  [42.8, 0],
  [44.5, 1.0, ease.out2],
];

// ── Light pulse keyframes ──────────────────────────────────────────────────────

// LO back-propagation: connection fires → amber light sweeps ring base → ring top
export const LO_PULSE_POS: readonly KF[] = [
  [0,    0],
  [43.2, 0],
  [52.0, 1.0, ease.out3],
];

export const LO_PULSE_OP: readonly KF[] = [
  [0,    0],
  [43.2, 0],
  [43.6, 1.0, ease.out3],
  [51.5, 0.40],
  [55.0, 0,   ease.out2],
];

// SP pulse: light descends through shaft after connection (chorus)
export const SP_PULSE_POS: readonly KF[] = [
  [0,    0],
  [78.0, 0],
  [87.0, 1.0, ease.out3],
];

export const SP_PULSE_OP: readonly KF[] = [
  [0,    0],
  [78.0, 0],
  [78.5, 1.0, ease.out3],
  [86.5, 0.35],
  [89.0, 0,   ease.out2],
];

// Suspension pulse (1:05–1:15): slow amber light traverses LO arc
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
  [75.5, 0,    ease.out2],
];

// ── Drawing head bloom ─────────────────────────────────────────────────────────

// LO drawing head — primary inscription head
export const LO_HEAD_OP: readonly KF[] = [
  [0,    0],
  [0.5,  0],
  [1.0,  0.75, ease.out3],
  [9.0,  0.75],
  [20.0, 0.40],
  [25.0, 0,    ease.out3],
  [38.5, 0],
  [38.7, 0.65, ease.out3],  // resumes as it approaches ring base
  [43.2, 0,    ease.out3],
];

// RO drawing head — enters with RO at chorus (t=75+)
export const RO_HEAD_OP: readonly KF[] = [
  [0,    0],
  [75.0, 0],
  [75.5, 0.60, ease.out3],
  [82.0, 0.60],
  [84.0, 0,    ease.out3],
];

// ── Bloom events ───────────────────────────────────────────────────────────────

// Ring-top bloom: brief glow at (195,172) when RO first appears at chorus (1:15).
// New structural element arriving at the shared source point.
export const JUNCTION_BLOOM: readonly KF[] = [
  [0,    0],
  [75.0, 0],
  [75.8, 0.65, ease.heavyDecel],
  [77.5, 0.65],
  [79.0, 0,    ease.out2],
];

// Connection bloom: ring-base area (195,420) at 0:43 when RIB_LL fires
export const CONN_BLOOM: readonly KF[] = [
  [0,    0],
  [43.0, 0],
  [43.5, 1.0,  ease.out3],
  [50.0, 0.45],
  [58.0, 0,    ease.out3],
];

// Spectral color — warm tint at connection point, earned at 0:43
export const SPECTRAL_OP: readonly KF[] = [
  [0,    0],
  [43.0, 0],
  [44.2, 1.0,  ease.out3],
  [58.0, 0.85],
  [65.0, 0,    ease.out3],
];

// ── Typography: SONRA SEN (first chorus, 1:15–1:35) ──────────────────────────
//
// Protected zone: x=44–250, y=540–650.
// At t=75 (reveal start) all drawn paths clear this area:
//   LO arc tip ≈ (160,385) — above zone
//   RO arc tip ≈ (230,385) — above zone
//   SP shaft shows y=720→y≈508 at x=195 — right of zone
//   RIB_LL ends at (195,420) — above zone
//   LI partial — upper ring area only
//
// "SONRA" x=44 y=562, "SEN" x=128 y=624.
// Geometry (LO, LI) renders in FRONT LAYER — appears in front of text.
// RO and SP render in BACK LAYER — appear behind text.

export const SONRA_REVEAL: readonly KF[] = [
  [0,    0],
  [75.0, 0],
  [77.8, 1.0, ease.heavyDecel],
];

export const SEN_REVEAL: readonly KF[] = [
  [0,    0],
  [77.5, 0],
  [79.5, 1.0, ease.heavyDecel],
];

// Typography absorption — geometry reclaims text
export const TYP_ABSORB: readonly KF[] = [
  [0,    0],
  [88.0, 0],
  [93.0, 1.0, ease.inOut3],
];

// ═══════════════════════════════════════════════════════════════════════════
// CP2 — DÜN 1:35–3:44 (t=95–225)
// Key form approaches and achieves recognition. Shaft pierces ring (depth
// crossing). Ring closes. Teeth confirm the key. Peak at t≈180. Outro holds.
// ═══════════════════════════════════════════════════════════════════════════

// ── CP2 draw-progress keyframes ──────────────────────────────────────────────

// SP_EXT — shaft extension from y=540 upward through ring to y=172.
// Starts at t=100 (1:40). Tip crosses ring base (y=420) at 32.6% = t≈130 (2:10).
// At that crossing, shaft appears BEHIND ring arcs → DEPTH CROSSING earned.
// Fully drawn by t=180 (3:00).
export const SP_EXT_DRAW: readonly KF[] = [
  [0,     0],
  [100.0, 0],                         // activates 1:40 as SP completes
  [130.0, 0.33, ease.out3],           // 2:10 — shaft tip crosses ring base (DEPTH CROSSING)
  [155.0, 0.58, ease.out3],           // 2:35
  [180.0, 1.00, ease.out3],           // 3:00 — shaft through ring, complete
];

// SP_EXT drawing head — visible while shaft rises through ring
export const SP_EXT_HEAD_OP: readonly KF[] = [
  [0,     0],
  [100.0, 0],
  [100.5, 0.65, ease.out3],           // head appears as shaft resumes
  [170.0, 0.65],
  [180.0, 0,    ease.out3],           // fades as shaft completes
];

// RIB_UL — upper-left structural rib
export const RIB_UL_DRAW: readonly KF[] = [
  [0,     0],
  [100.0, 0],
  [112.0, 1.0, ease.out2],            // 1:52
];

// RIB_UR — upper-right structural rib
export const RIB_UR_DRAW: readonly KF[] = [
  [0,     0],
  [104.0, 0],
  [116.0, 1.0, ease.out2],            // 1:56
];

// RIB_LR — lower-right rib (symmetric to RIB_LL)
export const RIB_LR_DRAW: readonly KF[] = [
  [0,     0],
  [112.0, 0],
  [122.0, 1.0, ease.out2],            // 2:02
];

// NOTCH_L — left notch arc at ring top
export const NOTCH_L_DRAW: readonly KF[] = [
  [0,     0],
  [140.0, 0],                         // 2:20
  [150.0, 1.0, ease.out2],
];

// NOTCH_R — right notch arc at ring top
export const NOTCH_R_DRAW: readonly KF[] = [
  [0,     0],
  [143.0, 0],
  [153.0, 1.0, ease.out2],
];

// Teeth — LAST to appear, clinching key recognition
// Each tooth draws quickly after the ring closes at t≈155–160.
export const TOOTH_1_DRAW: readonly KF[] = [
  [0,     0],
  [161.0, 0],
  [165.0, 1.0, ease.out2],            // 2:41
];

export const TOOTH_2_DRAW: readonly KF[] = [
  [0,     0],
  [164.0, 0],
  [168.0, 1.0, ease.out2],
];

export const TOOTH_3_DRAW: readonly KF[] = [
  [0,     0],
  [167.0, 0],
  [171.0, 1.0, ease.out2],
];

// SHAFT_CAP — horizontal base of shaft, arrives with third tooth
export const SHAFT_CAP_DRAW: readonly KF[] = [
  [0,     0],
  [170.0, 0],
  [174.0, 1.0, ease.out2],
];

// ── CP2 pulse events ──────────────────────────────────────────────────────────

// CROSSING PULSE — amber light descends through upper shaft as it enters ring (t≈130)
// SP_EXT_PULSE path: "M 195,172 L 195,540" (top-to-bottom = downward travel)
export const CROSSING_PULSE_POS: readonly KF[] = [
  [0,     0],
  [128.0, 0],
  [140.0, 1.0, ease.out3],
];

export const CROSSING_PULSE_OP: readonly KF[] = [
  [0,     0],
  [128.0, 0],
  [129.0, 0.90, ease.out3],
  [139.0, 0.40],
  [142.0, 0,    ease.out2],
];

// RING CLOSE BLOOM — large glow at ring base when LO closes (t=155)
export const RING_CLOSE_BLOOM: readonly KF[] = [
  [0,     0],
  [155.0, 0],
  [156.5, 1.0, ease.out3],
  [164.0, 0.55],
  [174.0, 0,   ease.out3],
];

// CLIMAX BLOOM — key form complete at t≈180 (3:00). Wide warm amber glow.
// Covers the full key form and fades through the outro.
export const CLIMAX_BLOOM_OP: readonly KF[] = [
  [0,     0],
  [180.0, 0],
  [182.0, 1.0,  ease.out3],           // full bloom
  [195.0, 0.65],
  [210.0, 0.35],
  [225.0, 0,    ease.out3],           // fades as song ends (t=224.7)
];
