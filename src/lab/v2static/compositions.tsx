/**
 * V2 Static Visual Compositions — Gate A
 *
 * Three SVG compositions using the same visual vocabulary
 * (luminous contour lines + ribbon surfaces) governed by
 * three different spatial rules:
 *
 *   DÜN:   structures INTERFERE — many, dense, crossing, compressed
 *   YARIN: structures DIVERGE  — few, dramatic scale contrast, vast negative space
 *   ŞİMDİ: structures CONVERGE — oriented flows arriving at one zone
 *
 * Technique: each "ribbon" = two <path> elements sharing one bezier —
 *   1. Fill layer: thick stroke (40–90px) at low opacity (0.12–0.22)
 *   2. Spine line: thin stroke (1–2px) at high opacity (0.60–0.82) + glow filter
 * All paths are open (not closed), use stroke-linecap="butt", and exit the
 * viewport — no round blobs at path ends, no closed fill shapes.
 *
 * The structural distinction (density/scale/orientation) must survive
 * grayscale conversion. Color is applied ON TOP of a composition that
 * already reads differently in black-and-white.
 */

import type { ReactNode } from "react";

// ── Shared SVG filter defs ─────────────────────────────────────────────────

export function SharedDefs() {
  return (
    <defs>
      {/* Subtle spine glow: gaussian + merge keeps source sharp, adds luminous halo */}
      <filter id="glow-xs" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="1.8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-sm" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

// ── Ribbon helper ──────────────────────────────────────────────────────────

interface RibbonProps {
  d: string;
  fillColor: string;    // rgba for the thick body stroke
  fillWidth: number;    // px
  spineColor: string;   // rgba for the thin luminous line
  spineWidth?: number;  // px, default 1.6
  glow?: "xs" | "sm" | "none";
}

function Ribbon({ d, fillColor, fillWidth, spineColor, spineWidth = 1.6, glow = "xs" }: RibbonProps) {
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={fillColor}
        strokeWidth={fillWidth}
        strokeLinecap="butt"
      />
      <path
        d={d}
        fill="none"
        stroke={spineColor}
        strokeWidth={spineWidth}
        strokeLinecap="butt"
        filter={glow !== "none" ? `url(#glow-${glow})` : undefined}
      />
    </>
  );
}

interface AccentProps {
  d: string;
  color: string;
  width?: number;
}
function Accent({ d, color, width = 0.6 }: AccentProps) {
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />;
}

// ── Shared wrapper ─────────────────────────────────────────────────────────

function CompositionSVG({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <SharedDefs />
      <rect width="390" height="844" fill={bg} />
      {children}
      {/* Vignette — compositional framing only, not an artistic element */}
      <radialGradient id="vig" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stopColor="transparent" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
      </radialGradient>
      <rect width="390" height="844" fill="url(#vig)" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DÜN — many forces / unresolved relationships → structures INTERFERE
//
// Spatial grammar: 4 ribbons cross at oblique angles in the center zone.
// High coverage (~70%). Diagonal tensions. Structures extend beyond all edges.
// Grayscale reading: dense crossing density in center, compressed.
//
// Palette: warm amber spine + cool steel crossing + mineral accents.
// ═══════════════════════════════════════════════════════════════════════════

export function DunComposition() {
  // ── Five ribbons covering ~70% of the viewport ─────────────────────────
  // Spatial rule: multiple forces at INCOMPATIBLE angles → interference.
  // All paths exit the frame — no visible endpoints.
  // Warm amber (RA, RE) + cool steel (RB) + neutral mineral (RC, RD).

  // RA: dominant warm diagonal — upper-left → lower-right
  //     The main compositional thrust, warmest element
  const RA = "M 50,-10 C 110,90 175,240 235,370 C 285,470 325,570 370,700";

  // RB: crossing cool diagonal — lower-left → upper-right
  //     Conflicts directly with RA; the X-crossing is DÜN's central tension
  const RB = "M -20,670 C 55,550 130,415 200,325 C 260,248 305,155 348,-10";

  // RC: medium ribbon from right, wrapping inward
  //     Third incompatible force vector entering from right side
  const RC = "M 410,300 C 355,285 295,305 258,348 C 228,385 218,428 208,500";

  // RD: lower diagonal — keeps lower-left from feeling empty
  //     Runs lower-left to mid-right, adding coverage below the main crossing
  const RD = "M -20,760 C 55,700 130,650 210,610 C 270,578 320,555 390,530";

  // RE: upper-right compact loop — fills upper-right void, adds asymmetry
  //     Short arc that enters/exits the upper-right area
  const RE = "M 290,-10 C 330,50 370,130 395,220";

  // Fine accent lines at the primary crossing zone (~x:225, y:370)
  const AC1 = "M 188,342 C 202,354 220,364 236,373";
  const AC2 = "M 183,372 C 198,384 218,393 235,401";
  const AC3 = "M 218,298 C 224,322 229,344 232,368";

  return (
    <CompositionSVG bg="#060505">
      {/* Deepest layer first */}
      <Ribbon d={RD} fillColor="rgba(38,50,42,0.16)" fillWidth={55}
        spineColor="rgba(105,132,110,0.55)" spineWidth={1.2} glow="none" />
      <Ribbon d={RE} fillColor="rgba(78,58,38,0.14)" fillWidth={35}
        spineColor="rgba(162,128,88,0.52)" spineWidth={1.1} glow="none" />

      {/* Mid layer */}
      <Ribbon d={RB} fillColor="rgba(40,58,80,0.20)" fillWidth={62}
        spineColor="rgba(110,150,195,0.68)" spineWidth={1.7} glow="xs" />
      <Ribbon d={RC} fillColor="rgba(70,52,38,0.18)" fillWidth={44}
        spineColor="rgba(165,130,90,0.62)" spineWidth={1.3} glow="xs" />

      {/* Near layer — warmest, most prominent */}
      <Ribbon d={RA} fillColor="rgba(98,70,44,0.24)" fillWidth={70}
        spineColor="rgba(195,152,108,0.80)" spineWidth={1.9} glow="xs" />

      {/* Fine accent lines — local interference texture at crossing */}
      <Accent d={AC1} color="rgba(202,164,118,0.44)" width={0.7} />
      <Accent d={AC2} color="rgba(202,164,118,0.36)" width={0.6} />
      <Accent d={AC3} color="rgba(118,152,195,0.38)" width={0.5} />

      {/* Crossing zone focal point */}
      <circle cx="228" cy="370" r="3.5" fill="rgba(212,175,120,0.28)" filter="url(#glow-sm)" />
      <circle cx="228" cy="370" r="1.2" fill="rgba(238,202,158,0.58)" />
    </CompositionSVG>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// YARIN — many possible configurations → structures DIVERGE
//
// Spatial grammar: 3 ribbons at DRAMATICALLY different scales + ~55% void.
// One enormous near form. One very small far form. One intermediate.
// Grayscale reading: large-mass + small-mass + large void = depth contrast.
//
// Must look immediately different from DÜN without reading the title.
// Palette: cold cobalt (near) + muted sage (mid) + faint warm (far).
// ═══════════════════════════════════════════════════════════════════════════

export function YarinComposition() {
  // ── Spatial rule: structures DIVERGE — dramatic scale contrast = depth ──
  //
  // The depth argument: RA is ~4× the visual weight of anything in DÜN.
  // The tiny RC/RD marks read as enormous distance by contrast with RA.
  // ~55% of the canvas is void — the emptiness communicates space.
  // RB is clearly a ribbon (diagonal entry+exit) not a partial arc.

  // RA: enormous near ribbon — the visual anchor of YARIN
  // Wide sweep from lower-left to upper-right, exits both top and right
  // fillWidth=110 → at 390px wide, this ribbon is visually massive
  const RA = "M -30,800 C 55,590 165,350 268,180 C 325,72 362,-18 392,-38";

  // RB: mid-distance ribbon — clearly a ribbon with two exits (bottom, right)
  // Completely different direction from RA = divergence
  const RB = "M 230,844 C 265,780 300,710 330,645 C 355,590 375,540 400,485";

  // RC: far distant contour — tiny, lower-left void
  // Scale 1:8 vs RA → depth perception. Slightly more visible than before.
  const RC = "M 38,695 C 65,700 92,705 122,700";

  // RD: second far trace — upper-left void, adds asymmetry to the void
  const RD = "M 72,128 C 102,152 134,178 162,200";

  // RE: thin branch in upper zone — suggests further divergence beyond frame
  const RE = "M 285,42 C 308,88 328,138 342,195";

  return (
    <CompositionSVG bg="#050508">
      {/* Far layer — minimal, high-precision tiny marks */}
      <Ribbon d={RC} fillColor="rgba(75,58,40,0.10)" fillWidth={9}
        spineColor="rgba(162,128,92,0.42)" spineWidth={0.75} glow="none" />
      <Ribbon d={RD} fillColor="rgba(52,68,82,0.10)" fillWidth={11}
        spineColor="rgba(118,148,182,0.44)" spineWidth={0.80} glow="none" />
      <Ribbon d={RE} fillColor="rgba(48,58,88,0.08)" fillWidth={8}
        spineColor="rgba(110,138,178,0.36)" spineWidth={0.65} glow="none" />

      {/* Mid layer — clearly a ribbon (not an arc), different direction */}
      <Ribbon d={RB} fillColor="rgba(42,60,44,0.18)" fillWidth={52}
        spineColor="rgba(112,152,118,0.60)" spineWidth={1.4} glow="xs" />

      {/* Near layer — the dominant element, ~4× larger than any far form */}
      <Ribbon d={RA} fillColor="rgba(34,55,100,0.26)" fillWidth={108}
        spineColor="rgba(125,168,232,0.84)" spineWidth={2.1} glow="sm" />
    </CompositionSVG>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ŞİMDİ — one coherent force → structures CONVERGE
//
// Spatial grammar: 3 ribbons share a common flow direction (lower-left →
// upper-right). They arrive at a convergence zone, from which a single
// emergent ribbon continues. Confidence and unity, not chaos.
//
// Key distinction from DÜN: ribbons in DÜN cross at DIFFERENT angles.
//   In ŞİMDİ they are all roughly PARALLEL, converging to ONE zone.
//
// Grayscale reading: oriented parallel flow pattern → different from
//   DÜN's chaotic crossings, different from YARIN's scale contrast.
//
// Palette: violet-silver integrated (color feels unified, not fragmented).
// ═══════════════════════════════════════════════════════════════════════════

export function SimdiComposition() {
  // ── Spatial rule: structures CONVERGE — shared orientation, substantial ─
  //
  // Five ribbons all oriented in the same directional family (roughly
  // lower-left → upper-right), spanning the full frame height. They travel
  // at similar but non-identical trajectories, gradually spacing tighter
  // in the upper portion — a zone of increasing coherence, not a point.
  //
  // Brief requirement: "Do NOT make ŞİMDİ minimal or visually quiet."
  // Coverage: ~65% of the viewport.
  // Different from DÜN: no oblique X-crossing. All ribbons share direction.
  // Different from YARIN: no dramatic scale contrast. Uniform participation.

  const FA = "M -20,790 C 75,608 162,428 238,288 C 295,182 332,108 370,22";
  const FB = "M 48,844 C 118,672 194,498 262,358 C 312,258 348,178 382,85";
  const FC = "M 148,844 C 192,718 238,590 280,468 C 314,368 340,285 365,195";
  const FD = "M -20,548 C 52,492 118,445 180,408 C 234,376 278,350 312,325 C 340,304 362,280 385,248";
  const FG = "M 228,844 C 255,748 282,648 308,550 C 330,466 348,388 366,310";
  const FE = "M 368,188 C 378,148 388,102 398,48";

  const EC1 = "M 352,228 C 362,208 372,188 381,165";
  const EC2 = "M 338,248 C 350,226 362,204 374,180";
  const EC3 = "M 322,270 C 336,248 350,226 364,202";

  return (
    <CompositionSVG bg="#06060a">
      <Ribbon d={FG} fillColor="rgba(42,38,64,0.16)" fillWidth={44}
        spineColor="rgba(135,122,178,0.58)" spineWidth={1.3} glow="none" />
      <Ribbon d={FC} fillColor="rgba(48,42,72,0.18)" fillWidth={52}
        spineColor="rgba(145,132,188,0.62)" spineWidth={1.5} glow="xs" />
      <Ribbon d={FB} fillColor="rgba(50,44,76,0.20)" fillWidth={58}
        spineColor="rgba(152,140,196,0.66)" spineWidth={1.6} glow="xs" />
      <Ribbon d={FD} fillColor="rgba(52,46,78,0.20)" fillWidth={50}
        spineColor="rgba(158,145,202,0.68)" spineWidth={1.6} glow="xs" />
      <Ribbon d={FA} fillColor="rgba(55,48,82,0.23)" fillWidth={65}
        spineColor="rgba(165,152,210,0.74)" spineWidth={1.8} glow="xs" />
      <Ribbon d={FE} fillColor="rgba(68,60,108,0.30)" fillWidth={68}
        spineColor="rgba(198,186,240,0.90)" spineWidth={2.2} glow="sm" />
      <Accent d={EC1} color="rgba(198,186,238,0.48)" width={0.7} />
      <Accent d={EC2} color="rgba(198,186,238,0.40)" width={0.6} />
      <Accent d={EC3} color="rgba(198,186,238,0.32)" width={0.5} />
    </CompositionSVG>
  );
}
