/**
 * V3 YARIN — Authored audiovisual score timeline.
 * Full song: 0:00–3:52 (232.17 seconds)
 *
 * VISUAL FORM: KEY → ∞ (infinity) morph.
 * The completed DÜN key transforms into the infinity sign over the entire song.
 * Recognition of ∞ is deferred to the YARIN PEAK at 3:10 (t=190).
 *
 * Three time modes:
 *   ?t=N      frozen frame — screenshots
 *   ?demo=1   internal clock — screen recording
 *   default   AudioEngine.element.currentTime
 *
 * All state is a pure function of t. Seeking reconstructs correctly.
 *
 * Morph system: morphT 0.0 = key pose, 1.0 = infinity pose.
 * Primary arcs (LO, RO, LI, RI, SP) lerp between the two coordinate sets.
 * Key extras (ribs, teeth, notches, shaft) fade out via opacity.
 * ∞ extras (crossing accent ×) fade in via opacity.
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
// Source: COORDS["key"] and COORDS["infinity"] from FormsLab.tsx
//
// KEY pose: the completed DÜN key (ring + shaft).
// INFINITY pose: the ∞ sign (two horizontal oval loops meeting at center).

export const KEY_COORDS = {
  lo: [195,172, 118,148, 72,212,  72,296,  72,380,  118,424, 195,420],
  ro: [195,172, 272,148, 318,212, 318,296, 318,380, 272,424, 195,420],
  li: [195,224, 152,210, 128,250, 128,296, 128,342, 152,374, 195,372],
  ri: [195,224, 238,210, 262,250, 262,296, 262,342, 238,374, 195,372],
  sp: [195,172, 195,720],  // full shaft top→bottom
} as const;

export const INF_COORDS = {
  lo: [195,418, 128,418, 8,318,   8,420,   8,522,   128,422, 195,422],
  ro: [195,418, 262,418, 382,318, 382,420, 382,522, 262,422, 195,422],
  li: [195,420, 188,420, 178,420, 178,420, 178,420, 188,420, 195,420], // collapsed
  ri: [195,420, 202,420, 212,420, 212,420, 212,420, 202,420, 195,420], // collapsed
  sp: [195,390, 195,450],  // tiny center mark at ∞ crossing
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

// ── Static paths (key extras — not in morph system, fade out) ─────────────────

export const KEY_EXTRA_PATHS = {
  // Structural ribs (inside ring)
  RIB_UL:    "M 140,212 L 72,296",
  RIB_UR:    "M 250,212 L 318,296",
  RIB_LL:    "M 128,370 L 195,420",
  RIB_LR:    "M 262,370 L 195,420",
  // Ring top notch arcs
  NOTCH_L:   "M 195,172 C 170,156 144,160 120,180",
  NOTCH_R:   "M 195,172 C 220,156 246,160 270,180",
  // Teeth
  TOOTH_1:   "M 195,516 L 138,516",
  TOOTH_2:   "M 195,576 L 154,576",
  TOOTH_3:   "M 195,636 L 138,636",
  // Shaft base cap
  SHAFT_CAP: "M 175,720 L 215,720",
} as const;

// ── ∞ extras (crossing accent — fades IN as morph completes) ─────────────────

export const INF_EXTRA_PATHS = {
  CROSS_L: "M 180,413 L 210,427",
  CROSS_R: "M 210,413 L 180,427",
} as const;

// ── Morph timeline ────────────────────────────────────────────────────────────
//
// morphT: 0 = key pose, 1 = ∞ pose.
// Pacing follows YARIN's musical structure.
//
// Musical landmarks:
//   0:00–0:12  clean guitar, no drums — key held
//   0:12–0:24  drums enter — very subtle shift begins
//   0:24–0:56  vocals, branching — the key starts opening
//   0:59–1:20  chorus 1 — first major transformation wave
//   1:59–2:19  chorus 2 — mid-morph
//   2:58–3:07  chorus 3 — final pre-peak state
//   3:10–3:34  YARIN PEAK — ∞ complete and readable
//   3:34–3:52  outro — ∞ holds, transform toward ŞİMDİ begins

export const MORPH_KF: readonly KF[] = [
  [0,   0.00],
  [12,  0.00],                        // key held during guitar intro
  [24,  0.02, ease.out3],             // drums: imperceptible start
  [56,  0.22, ease.out3],             // vocals: the form begins opening
  [59,  0.28],                        // chorus 1 start
  [80,  0.38, ease.out3],             // chorus 1 end (1:20)
  [119, 0.55, ease.out3],             // chorus 2 start (1:59)
  [139, 0.65, ease.out3],             // chorus 2 end (2:19)
  [163, 0.75, ease.out3],             // verse (2:43)
  [175, 0.80],                        // deep suspension (2:55)
  [178, 0.82],
  [190, 0.88, ease.out3],             // total suspension end (3:10)
  [214, 1.00, ease.out2],             // ∞ COMPLETE (3:34 = YARIN PEAK)
  [232, 1.00],                        // holds to end
];

// ── Key extras opacity (fade out as morph increases) ─────────────────────────
//
// Teeth, ribs, notches, shaft cap — DÜN-specific elements that dissolve
// as the key transforms into ∞. Fade front-loaded: mostly gone by first chorus.

export const KEY_EXT_OP: readonly KF[] = [
  [0,   1.00],
  [12,  1.00],                        // hold during guitar intro
  [24,  0.85, ease.out3],             // begin fading with drums
  [56,  0.35, ease.out3],             // substantially faded during vocals
  [80,  0.08, ease.out3],             // nearly invisible at chorus 1 end
  [103, 0.00],                        // completely gone by second verse
];

// ── Inner arcs opacity (LI, RI — collapsed to points in ∞ form) ──────────────

export const INNER_OP: readonly KF[] = [
  [0,   1.00],
  [59,  0.75],
  [119, 0.45],
  [178, 0.15],
  [214, 0.00],
];

// ── ∞ extras opacity (fade in as ∞ form crystallizes) ────────────────────────

export const INF_EXT_OP: readonly KF[] = [
  [0,   0.00],
  [142, 0.00],
  [175, 0.55, ease.out3],
  [214, 1.00, ease.out2],
];

// ── Typography: SENİNLE DOLU HER YER ─────────────────────────────────────────
//
// Three appearances at chorus points.
// Protected negative space zone: x=15–375, y=596–650.
// At all chorus times, the morphing form is in the upper/middle viewport area.
// y=618 text position is clear at all three appearances.
//
// Opacity envelope: 0 → peak → 0 for each appearance.
// Using non-monotonic opacity keyframes — interp handles this correctly.

export const CHORUS_TYP_OP: readonly KF[] = [
  // Silence before
  [0,   0.00],

  // Chorus 1: 0:59–1:20 (t=59–80)
  [59,  0.00],
  [61,  1.00, ease.heavyDecel],       // ~2s fade in
  [78,  1.00],                        // hold
  [81,  0.00, ease.out3],             // ~3s fade out

  // Chorus 2: 1:59–2:19 (t=119–139)
  [119, 0.00],
  [121, 1.00, ease.heavyDecel],
  [137, 1.00],
  [140, 0.00, ease.out3],

  // Chorus 3 (strongest): 2:58–3:07 (t=178–187)
  [178, 0.00],
  [180, 1.00, ease.heavyDecel],
  [185, 1.00],
  [188, 0.00, ease.out3],
];

// Clip rect width fraction for left-to-right wipe (0=closed, 1=open)
// — only used for reveal on first appearance; subsequent appearances re-open same clip
// Using a single clip_W: keep at max (1.0) once first reveal completes.
// Hide is handled via CHORUS_TYP_OP dropping to 0 (opacity = invisible).
export const CHORUS_CLIP: readonly KF[] = [
  [0,   0.00],
  [59,  0.00],
  [61,  1.00, ease.heavyDecel],        // reveal over ~2s (same as opacity ramp)
  // Stays open after first reveal — opacity handles subsequent hide/show
  [232, 1.00],
];

// ── Peak pulse (t=214 — ∞ complete, coordinated illumination wave) ─────────────
//
// Amber light sweeps through LO arc at the YARIN PEAK recognition moment.
// Uses the ∞ pose LO arc path (which is now fully drawn at morph=1.0).

export const PEAK_PULSE_POS: readonly KF[] = [
  [0,   0.00],
  [214, 0.00],
  [224, 1.00, ease.out3],
];

export const PEAK_PULSE_OP: readonly KF[] = [
  [0,   0.00],
  [214, 0.00],
  [214.5, 0.90, ease.out3],
  [223,   0.35],
  [226,   0.00, ease.out2],
];

// ── Outro cycling dots constants ───────────────────────────────────────────────
//
// Two amber dots, one orbiting each ∞ loop ellipse.
// Left loop:  cx=101.5, cy=420, rx=93.5, ry=102
// Right loop: cx=288.5, cy=420, rx=93.5, ry=102
// Dot period: 12s. Right loop starts 6s offset = always on opposite phase.
// Active from t=214 (∞ complete) to t=232 (song end).

export const OUTRO_LEFT_CX  = 101.5;
export const OUTRO_LEFT_CY  = 420;
export const OUTRO_RIGHT_CX = 288.5;
export const OUTRO_RIGHT_CY = 420;
export const OUTRO_RX = 93.5;
export const OUTRO_RY = 102;
