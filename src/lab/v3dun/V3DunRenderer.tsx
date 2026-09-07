/**
 * V3 DÜN — Authored audiovisual score renderer.
 * CHECKPOINT 1: 0:00–1:35
 *
 * Route: ?lab=v3-dun
 * Demo:  ?lab=v3-dun&demo=1    (internal clock — screen recording)
 * Still: ?lab=v3-dun&t=30      (frozen frame — screenshots)
 * UI:    ?lab=v3-dun&t=30&ui=1
 *
 * Architecture:
 *   React renders the SVG structure ONCE.
 *   requestAnimationFrame loop reads getSceneTime(), updates all
 *   SVG attributes imperatively — zero React re-renders per frame.
 *   All state is a pure fn of t → seeking reconstructs the scene.
 *
 * Visual vocabulary:
 *   OLED black + ivory hairline linework + restrained bloom.
 *   KEY FORM — left_outer arc (LO), right_outer arc (RO), shaft (SP),
 *   inner arcs (LI, RI), lower rib (RIB_LL).
 *
 * Depth system:
 *   BACK layer:  RO (right outer arc), SP (shaft)
 *   TEXT layer:  "SONRA SEN" (between layers — LO in front, RO/SP behind)
 *   FRONT layer: LO (left outer arc), LI, RI, RIB_LL, pulses, heads
 *
 * Construction narrative (delayed key recognition):
 *   0:00 LO begins — ambiguous arch departing from top-center
 *   0:10 SP enters from below — separate vertical element
 *   0:22 RO enters — bilateral structure emerging from shared source
 *   0:43 RIB_LL fires — LIGHT propagates through LO (old geometry alive)
 *   1:05 Suspension — slow amber pulse through LO
 *   1:15 SONRA SEN — clip-wipe reveal, chorus
 *   1:25 SP approaches ring base — depth gap shrinks (ring stays OPEN)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getSceneTime, resetDemoClock, IS_DEMO, FROZEN_T,
  interp,
  PATHS,
  // CP1 paths
  LO_DRAW, RO_DRAW, SP_DRAW, SEC_R_DRAW, LI_DRAW, RI_DRAW, RIB_LL_DRAW,
  LO_PULSE_POS, LO_PULSE_OP,
  SP_PULSE_POS, SP_PULSE_OP,
  SUSP_PULSE_POS, SUSP_PULSE_OP,
  LO_HEAD_OP, RO_HEAD_OP,
  JUNCTION_BLOOM, CONN_BLOOM, SPECTRAL_OP,
  SONRA_REVEAL, SEN_REVEAL, TYP_ABSORB,
  // CP2 paths
  SP_EXT_DRAW, SP_EXT_HEAD_OP,
  RIB_UL_DRAW, RIB_UR_DRAW, RIB_LR_DRAW,
  NOTCH_L_DRAW, NOTCH_R_DRAW,
  TOOTH_1_DRAW, TOOTH_2_DRAW, TOOTH_3_DRAW,
  SHAFT_CAP_DRAW,
  CROSSING_PULSE_POS, CROSSING_PULSE_OP,
  RING_CLOSE_BLOOM,
  CLIMAX_BLOOM_OP,
} from "./v3Timeline";
import { AudioEngine } from "../../audio/AudioEngine";
import "./V3DunRenderer.css";

// ── URL flags ─────────────────────────────────────────────────────────────────

const _params = new URLSearchParams(window.location.search);
const SHOW_UI     = _params.get("ui") === "1";
const AUDIO_SRC   = "/audio/dun.m4a";
// In journey mode the JourneyApp manages audio — skip self-setup.
const IS_STANDALONE = _params.get("lab") !== "v3-journey";

// Typography clip widths
const SONRA_CLIP_W = 220;  // px — generous clip rect for "SONRA"
const SEN_CLIP_W   = 120;  // px — clip rect for "SEN"

// Pulse segment length (px)
const PULSE_LEN = 48;

// Ring ellipse parameters — matches the key ring geometry exactly
// Center: (195, 296) = midpoint between ring top (y=172) and ring base (y=420)
// rx=123 (center to left equator x=72), ry=124 (center to ring top/base)
const RING_CX = 195;
const RING_CY = 296;
const RING_RX = 123;
const RING_RY = 124;

// ── Scene ref bundle ──────────────────────────────────────────────────────────

interface Refs {
  // BACK layer — CP1
  ro:        SVGPathElement | null;
  roGlow:    SVGPathElement | null;
  sp:        SVGPathElement | null;
  secR:      SVGPathElement | null;
  // BACK layer — CP2
  spExt:     SVGPathElement | null;
  shaftCap:  SVGPathElement | null;
  // FRONT layer — CP1
  lo:        SVGPathElement | null;
  loGlow:    SVGPathElement | null;
  li:        SVGPathElement | null;
  ri:        SVGPathElement | null;
  ribLL:     SVGPathElement | null;
  // FRONT layer — CP2
  ribUL:     SVGPathElement | null;
  ribUR:     SVGPathElement | null;
  ribLR:     SVGPathElement | null;
  notchL:    SVGPathElement | null;
  notchR:    SVGPathElement | null;
  tooth1:    SVGPathElement | null;
  tooth2:    SVGPathElement | null;
  tooth3:    SVGPathElement | null;
  // Light pulses — CP1
  loPulse:   SVGPathElement | null;
  spPulse:   SVGPathElement | null;
  suspPulse: SVGPathElement | null;
  // Light pulses — CP2
  crossingPulse: SVGPathElement | null;
  // Outro cycling dots (circle-based — ellipse parametrization, no cusps)
  ringDot1: SVGCircleElement | null;   // orbits ring ellipse
  ringDot2: SVGCircleElement | null;   // orbits ring ellipse, 180° offset
  shaftDot: SVGPathElement | null;     // bounces on shaft (triangle wave)
  // Drawing heads — CP1
  loHead:    SVGCircleElement | null;
  roHead:    SVGCircleElement | null;
  // Drawing heads — CP2
  spExtHead: SVGCircleElement | null;
  // Bloom circles — CP1
  junctionGlow: SVGCircleElement | null;
  connGlow:     SVGCircleElement | null;
  spectral:     SVGCircleElement | null;
  // Bloom circles — CP2
  ringCloseBloom: SVGCircleElement | null;
  climaxBloom:    SVGCircleElement | null;
  // Typography clip rects
  sonraClip: SVGRectElement | null;
  senClip:   SVGRectElement | null;
  // Typography group (for absorption)
  typGroup:  SVGGElement | null;
  // Dev overlay
  timeDisp:  HTMLSpanElement | null;
}

// Path lengths — populated after mount via getTotalLength()
interface Lengths {
  [key: string]: number;
  // CP1
  lo: number; ro: number; sp: number; secR: number;
  li: number; ri: number; ribLL: number;
  loPulse: number; spPulse: number; suspPulse: number;
  // CP2
  spExt: number; shaftCap: number;
  ribUL: number; ribUR: number; ribLR: number;
  notchL: number; notchR: number;
  tooth1: number; tooth2: number; tooth3: number;
  crossingPulse: number;
  // Outro shaft dot
  shaftDot: number;
}

// ── Imperative scene update ───────────────────────────────────────────────────

// Outro ring dot — smooth ellipse parametrization, zero cusps.
// phase: 0=ring top, 0.25=right equator, 0.5=ring base, 0.75=left equator.
function setRingDot(el: SVGCircleElement | null, phase: number, opacity: number): void {
  if (!el) return;
  const angle = 2 * Math.PI * phase;
  el.setAttribute("cx", (RING_CX + RING_RX * Math.sin(angle)).toFixed(1));
  el.setAttribute("cy", (RING_CY - RING_RY * Math.cos(angle)).toFixed(1));
  el.style.opacity = `${opacity}`;
}

// Outro shaft dot — triangle wave bounce, no jump.
function setShaftDotPos(el: SVGPathElement | null, phase: number, opacity: number, totalLen: number): void {
  if (!el) return;
  // triangle: 0→1→0→1 as phase goes 0→1
  const t = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  el.style.strokeDashoffset = `${-(t * (totalLen - PULSE_LEN))}`;
  el.style.opacity = `${opacity}`;
}

function setDash(el: SVGPathElement | null, progress: number, totalLen: number): void {
  if (!el) return;
  el.style.strokeDashoffset = `${totalLen * (1 - progress)}`;
}

function setPulse(
  el: SVGPathElement | null,
  pos: number,
  opacity: number,
  totalLen: number,
): void {
  if (!el) return;
  el.style.strokeDashoffset = `${-(pos * (totalLen - PULSE_LEN))}`;
  el.style.opacity = `${opacity}`;
}

function updateScene(t: number, r: Refs, L: Lengths): void {
  const ct = Math.max(0, t);

  // ── LO drawing ──────────────────────────────────────────────────────────
  const loDraw = interp(ct, LO_DRAW);
  setDash(r.lo,     loDraw, L.lo);
  setDash(r.loGlow, loDraw, L.lo);

  if (r.lo && r.loHead) {
    const headOp = interp(ct, LO_HEAD_OP);
    if (headOp > 0.01) {
      const pt = r.lo.getPointAtLength(loDraw * L.lo);
      r.loHead.setAttribute("cx", pt.x.toFixed(1));
      r.loHead.setAttribute("cy", pt.y.toFixed(1));
      r.loHead.style.opacity = `${headOp}`;
    } else {
      r.loHead.style.opacity = "0";
    }
  }

  // ── RO drawing ──────────────────────────────────────────────────────────
  const roDraw = interp(ct, RO_DRAW);
  setDash(r.ro,     roDraw, L.ro);
  setDash(r.roGlow, roDraw, L.ro);

  if (r.ro && r.roHead) {
    const headOp = interp(ct, RO_HEAD_OP);
    if (headOp > 0.01) {
      const pt = r.ro.getPointAtLength(roDraw * L.ro);
      r.roHead.setAttribute("cx", pt.x.toFixed(1));
      r.roHead.setAttribute("cy", pt.y.toFixed(1));
      r.roHead.style.opacity = `${headOp}`;
    } else {
      r.roHead.style.opacity = "0";
    }
  }

  // ── SP drawing (shaft) + secondary right accent ─────────────────────────
  setDash(r.sp,   interp(ct, SP_DRAW),    L.sp);
  setDash(r.secR, interp(ct, SEC_R_DRAW), L.secR);

  // ── Inner arcs (post-connection depth) ──────────────────────────────────
  setDash(r.li, interp(ct, LI_DRAW), L.li);
  setDash(r.ri, interp(ct, RI_DRAW), L.ri);

  // ── RIB_LL (connection payoff, 0:43) ────────────────────────────────────
  setDash(r.ribLL, interp(ct, RIB_LL_DRAW), L.ribLL);

  // ── CP2 geometry (activates t>95) ────────────────────────────────────────
  setDash(r.spExt,    interp(ct, SP_EXT_DRAW),   L.spExt);
  setDash(r.shaftCap, interp(ct, SHAFT_CAP_DRAW), L.shaftCap);
  setDash(r.ribUL,    interp(ct, RIB_UL_DRAW),   L.ribUL);
  setDash(r.ribUR,    interp(ct, RIB_UR_DRAW),   L.ribUR);
  setDash(r.ribLR,    interp(ct, RIB_LR_DRAW),   L.ribLR);
  setDash(r.notchL,   interp(ct, NOTCH_L_DRAW),  L.notchL);
  setDash(r.notchR,   interp(ct, NOTCH_R_DRAW),  L.notchR);
  setDash(r.tooth1,   interp(ct, TOOTH_1_DRAW),  L.tooth1);
  setDash(r.tooth2,   interp(ct, TOOTH_2_DRAW),  L.tooth2);
  setDash(r.tooth3,   interp(ct, TOOTH_3_DRAW),  L.tooth3);

  // SP_EXT drawing head
  if (r.spExt && r.spExtHead) {
    const headOp = interp(ct, SP_EXT_HEAD_OP);
    if (headOp > 0.01) {
      const prog = interp(ct, SP_EXT_DRAW);
      const pt = r.spExt.getPointAtLength(prog * L.spExt);
      r.spExtHead.setAttribute("cx", pt.x.toFixed(1));
      r.spExtHead.setAttribute("cy", pt.y.toFixed(1));
      r.spExtHead.style.opacity = `${headOp}`;
    } else {
      r.spExtHead.style.opacity = "0";
    }
  }

  // ── Light pulses ─────────────────────────────────────────────────────────
  // LO back-propagation: ring base → ring top (amber)
  setPulse(r.loPulse,   interp(ct, LO_PULSE_POS),   interp(ct, LO_PULSE_OP),   L.loPulse);
  // SP descent: light travels down shaft (chorus)
  setPulse(r.spPulse,   interp(ct, SP_PULSE_POS),   interp(ct, SP_PULSE_OP),   L.spPulse);
  // Suspension pulse: slow amber sweep through LO (1:05–1:15)
  setPulse(r.suspPulse, interp(ct, SUSP_PULSE_POS), interp(ct, SUSP_PULSE_OP), L.suspPulse);

  // ── CP2 crossing pulse (amber through SP_EXT as it enters ring) ──────────
  setPulse(r.crossingPulse, interp(ct, CROSSING_PULSE_POS), interp(ct, CROSSING_PULSE_OP), L.crossingPulse);

  // ── Bloom events ─────────────────────────────────────────────────────────
  if (r.junctionGlow) {
    r.junctionGlow.style.opacity = `${interp(ct, JUNCTION_BLOOM)}`;
  }
  if (r.connGlow) {
    r.connGlow.style.opacity = `${interp(ct, CONN_BLOOM)}`;
  }
  if (r.spectral) {
    r.spectral.style.opacity = `${interp(ct, SPECTRAL_OP)}`;
  }
  // CP2 blooms
  if (r.ringCloseBloom) {
    r.ringCloseBloom.style.opacity = `${interp(ct, RING_CLOSE_BLOOM)}`;
  }
  if (r.climaxBloom) {
    r.climaxBloom.style.opacity = `${interp(ct, CLIMAX_BLOOM_OP)}`;
  }

  // ── Typography: SONRA SEN ────────────────────────────────────────────────
  const absorb     = interp(ct, TYP_ABSORB);
  const sonraReveal = interp(ct, SONRA_REVEAL) * (1 - absorb);
  const senReveal   = interp(ct, SEN_REVEAL)   * (1 - absorb);

  if (r.sonraClip) {
    r.sonraClip.setAttribute("width", `${(sonraReveal * SONRA_CLIP_W).toFixed(1)}`);
  }
  if (r.senClip) {
    r.senClip.setAttribute("width", `${(senReveal * SEN_CLIP_W).toFixed(1)}`);
  }
  if (r.typGroup) {
    r.typGroup.style.opacity = Math.max(sonraReveal, senReveal) > 0.01 ? "1" : "0";
  }

  // ── Shaft dimming — protected text zone (x=44–250, y=540–650) ────────────
  // Spec: "no line crosses behind text." SP at x=195 passes through this zone.
  // Fade shaft to near-invisible while text is present; restore during absorption.
  if (r.sp) {
    const textVisible = Math.max(sonraReveal, senReveal);
    r.sp.style.opacity = textVisible > 0.01
      ? `${Math.max(0.08, 1 - textVisible * 0.92)}`
      : "1";
  }

  // ── OUTRO CYCLING PULSES ─────────────────────────────────────────────────
  // Three amber dots traversing separate parts of the completed key.
  // Pure loop math — no keyframes. Active t=175–224 (song end).
  // Staggered by 4s (ring dots) and 2s (shaft) for organic feel.
  {
    const OUTRO_START = 175;
    const SONG_END    = 224.7;

    // Fade envelope: 0 → 1 over 6s, hold, → 0 over last 5s
    const outroOp =
      ct < OUTRO_START        ? 0 :
      ct < OUTRO_START + 6    ? ((ct - OUTRO_START) / 6) * 0.88 :
      ct < SONG_END - 5       ? 0.88 :
      ct < SONG_END           ? ((SONG_END - ct) / 5) * 0.88 : 0;

    if (outroOp > 0.01) {
      // Ring dots: smooth ellipse orbit, period 16s.
      // Dot 2 is 180° offset — always diametrically opposite Dot 1.
      const ringPhase = ((ct - OUTRO_START) % 16) / 16;
      setRingDot(r.ringDot1, ringPhase,              outroOp);
      setRingDot(r.ringDot2, (ringPhase + 0.5) % 1,  outroOp * 0.88);

      // Shaft dot: triangle wave pendulum, period 13s, 2s delayed start.
      const shaftPhase = (Math.max(0, ct - OUTRO_START - 2) % 13) / 13;
      setShaftDotPos(r.shaftDot, shaftPhase, outroOp * 0.85, L.shaftDot);
    } else {
      if (r.ringDot1)  r.ringDot1.style.opacity  = "0";
      if (r.ringDot2)  r.ringDot2.style.opacity  = "0";
      if (r.shaftDot)  r.shaftDot.style.opacity  = "0";
    }
  }

  // ── Dev overlay ──────────────────────────────────────────────────────────
  if (r.timeDisp) {
    r.timeDisp.textContent = ct.toFixed(1) + "s";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function V3DunRenderer() {
  const refs = useRef<Refs>({
    ro: null, roGlow: null, sp: null, secR: null,
    spExt: null, shaftCap: null,
    lo: null, loGlow: null, li: null, ri: null, ribLL: null,
    ribUL: null, ribUR: null, ribLR: null,
    notchL: null, notchR: null,
    tooth1: null, tooth2: null, tooth3: null,
    loPulse: null, spPulse: null, suspPulse: null, crossingPulse: null,
    ringDot1: null, ringDot2: null, shaftDot: null,
    loHead: null, roHead: null, spExtHead: null,
    junctionGlow: null, connGlow: null, spectral: null,
    ringCloseBloom: null, climaxBloom: null,
    sonraClip: null, senClip: null,
    typGroup: null, timeDisp: null,
  });

  const lengths = useRef<Lengths>({
    lo: 350, ro: 350, sp: 180, secR: 64,
    li: 248, ri: 248, ribLL: 84,
    loPulse: 350, spPulse: 180, suspPulse: 350,
    spExt: 368, shaftCap: 40,
    ribUL: 92, ribUR: 92, ribLR: 92,
    notchL: 88, notchR: 88,
    tooth1: 57, tooth2: 41, tooth3: 57,
    crossingPulse: 368,
    shaftDot: 548,
  });

  const rafId = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── After mount: measure actual path lengths, init dasharray ─────────────
  useEffect(() => {
    const r = refs.current;
    const L = lengths.current;

    const measure = (el: SVGPathElement | null, key: keyof Lengths) => {
      if (!el) return;
      const len = el.getTotalLength();
      (L as Record<string, number>)[key] = len;
      el.style.strokeDasharray = `${len} ${len}`;
      el.style.strokeDashoffset = `${len}`;
    };

    measure(r.lo,     "lo");    measure(r.loGlow, "lo");
    measure(r.ro,     "ro");    measure(r.roGlow, "ro");
    measure(r.sp,     "sp");
    measure(r.secR,   "secR");
    measure(r.li,     "li");
    measure(r.ri,     "ri");
    measure(r.ribLL,  "ribLL");
    // CP2 paths
    measure(r.spExt,    "spExt");
    measure(r.shaftCap, "shaftCap");
    measure(r.ribUL,    "ribUL");
    measure(r.ribUR,    "ribUR");
    measure(r.ribLR,    "ribLR");
    measure(r.notchL,   "notchL");
    measure(r.notchR,   "notchR");
    measure(r.tooth1,   "tooth1");
    measure(r.tooth2,   "tooth2");
    measure(r.tooth3,   "tooth3");

    const initPulse = (el: SVGPathElement | null, key: keyof Lengths) => {
      if (!el) return;
      const len = el.getTotalLength();
      (L as Record<string, number>)[key] = len;
      el.style.strokeDasharray = `${PULSE_LEN} ${len}`;
      el.style.strokeDashoffset = `${len}`;
      el.style.opacity = "0";
    };
    initPulse(r.loPulse,       "loPulse");
    initPulse(r.spPulse,       "spPulse");
    initPulse(r.suspPulse,     "suspPulse");
    initPulse(r.crossingPulse, "crossingPulse");

    // Shaft dot — uses standard pulse dasharray
    initPulse(r.shaftDot, "shaftDot");
  }, []);

  // ── Audio setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (IS_DEMO || FROZEN_T !== null || !IS_STANDALONE) return;
    const el = AudioEngine.element;
    el.src = AUDIO_SRC;
    el.preload = "auto";
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    el.addEventListener("play",  onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play",  onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.pause();
    };
  }, []);

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    function loop() {
      updateScene(getSceneTime(), refs.current, lengths.current);
      rafId.current = requestAnimationFrame(loop);
    }
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  // ── Controls ───────────────────────────────────────────────────────────────
  const handleDemo = useCallback(() => { resetDemoClock(); setIsPlaying(true); }, []);
  const handlePlayPause = useCallback(() => {
    const el = AudioEngine.element;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);
  const handleSeek = useCallback((v: number) => {
    if (IS_DEMO) return;
    AudioEngine.element.currentTime = v;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="v3dun">
      <svg
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        className="v3dun__svg"
        aria-hidden="true"
      >
        <defs>
          {/* Drawing head bloom — tight glow */}
          <filter id="v3-head-bloom" x="-400%" y="-400%" width="900%" height="900%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Path glow — subtle wider bloom */}
          <filter id="v3-path-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
            </feMerge>
          </filter>

          {/* Pulse bloom — wide blur, warm amber glow clearly distinct from ivory */}
          <filter id="v3-pulse-bloom" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Junction / connection glow — wide spread */}
          <filter id="v3-junction-glow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* SONRA clip — reveals text left-to-right */}
          <clipPath id="v3-sonra-clip">
            <rect
              ref={(el) => { refs.current.sonraClip = el; }}
              x="44" y="540" width="0" height="42"
            />
          </clipPath>

          {/* SEN clip — reveals text left-to-right */}
          <clipPath id="v3-sen-clip">
            <rect
              ref={(el) => { refs.current.senClip = el; }}
              x="128" y="600" width="0" height="44"
            />
          </clipPath>
        </defs>

        {/* ═══ 0. Background — OLED black ══════════════════════════════════════ */}
        <rect width="390" height="844" fill="#010101" />

        {/* ═══ 1. BACK LAYER — RO (behind LO), SP (shaft) ═════════════════════
              Both render below typography and below FRONT layer paths.
              Depth story: RO emerges "behind" LO from their shared start
              at ring top (195,172); SP rises toward ring base from behind.
        ════════════════════════════════════════════════════════════════════ */}
        <g className="v3dun-back">

          {/* RO glow duplicate */}
          <path
            ref={(el) => { refs.current.roGlow = el; }}
            d={PATHS.RO}
            fill="none"
            stroke="rgba(242,238,225,0.18)"
            strokeWidth="3.5"
            strokeLinecap="butt"
            filter="url(#v3-path-glow)"
          />
          {/* RO crisp stroke */}
          <path
            ref={(el) => { refs.current.ro = el; }}
            d={PATHS.RO}
            fill="none"
            stroke="rgba(242,238,225,0.80)"
            strokeWidth="1"
            strokeLinecap="butt"
          />

          {/* SP — shaft lower portion, draws bottom-up */}
          <path
            ref={(el) => { refs.current.sp = el; }}
            d={PATHS.SP}
            fill="none"
            stroke="rgba(242,238,225,0.88)"
            strokeWidth="1"
            strokeLinecap="butt"
          />

          {/* SP_EXT — shaft extension through ring (CP2). BACK layer → depth crossing visible. */}
          <path
            ref={(el) => { refs.current.spExt = el; }}
            d={PATHS.SP_EXT}
            fill="none"
            stroke="rgba(242,238,225,0.88)"
            strokeWidth="1"
            strokeLinecap="butt"
          />

          {/* SHAFT_CAP — horizontal base of shaft (CP2) */}
          <path
            ref={(el) => { refs.current.shaftCap = el; }}
            d={PATHS.SHAFT_CAP}
            fill="none"
            stroke="rgba(242,238,225,0.72)"
            strokeWidth="0.85"
            strokeLinecap="butt"
          />

          {/* SEC_R — secondary accent, upper-right area (vocal phase 0:24–0:28) */}
          <path
            ref={(el) => { refs.current.secR = el; }}
            d={PATHS.SEC_R}
            fill="none"
            stroke="rgba(242,238,225,0.55)"
            strokeWidth="0.75"
            strokeLinecap="butt"
          />

          {/* SP pulse — amber light descends through shaft (chorus) */}
          <path
            ref={(el) => { refs.current.spPulse = el; }}
            d={PATHS.SP_PULSE}
            fill="none"
            stroke="rgba(248,210,108,0.95)"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#v3-pulse-bloom)"
          />

          {/* CROSSING PULSE — amber descending through SP_EXT as shaft enters ring */}
          <path
            ref={(el) => { refs.current.crossingPulse = el; }}
            d={PATHS.SP_EXT_PULSE}
            fill="none"
            stroke="rgba(248,210,108,0.95)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#v3-pulse-bloom)"
          />

          {/* RO drawing head */}
          <circle
            ref={(el) => { refs.current.roHead = el; }}
            r="2.8"
            fill="rgba(242,238,225,0.88)"
            style={{ opacity: 0 }}
            filter="url(#v3-head-bloom)"
          />

          {/* Ring-top bloom at (195,172) — fires when RO departs (0:22) */}
          <circle
            ref={(el) => { refs.current.junctionGlow = el; }}
            cx="195" cy="172" r="10"
            fill="rgba(242,238,225,0.10)"
            style={{ opacity: 0 }}
            filter="url(#v3-junction-glow)"
          />

        </g>

        {/* ═══ 2. TYPOGRAPHY LAYER — between back and front ════════════════════
              LO and LI (rendered in FRONT above) appear in front of the text.
              RO and SP (rendered in BACK below) appear behind the text.
              Protected zone: x=44–250, y=540–650. No geometry crosses here at t=75.
        ════════════════════════════════════════════════════════════════════ */}
        <g
          ref={(el) => { refs.current.typGroup = el; }}
          style={{ opacity: 0 }}
        >
          {/* SONRA — clip reveals left-to-right */}
          <text
            clipPath="url(#v3-sonra-clip)"
            x="44"
            y="562"
            fontFamily="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif"
            fontWeight="200"
            fontSize="26"
            fill="rgba(242,238,225,0.90)"
            style={{ letterSpacing: "0.30em" }}
          >
            SONRA
          </text>
          {/* SEN — clip reveals left-to-right, slightly larger */}
          <text
            clipPath="url(#v3-sen-clip)"
            x="128"
            y="624"
            fontFamily="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif"
            fontWeight="200"
            fontSize="32"
            fill="rgba(242,238,225,0.90)"
            style={{ letterSpacing: "0.25em" }}
          >
            SEN
          </text>
        </g>

        {/* ═══ 3. FRONT LAYER — LO sits above RO / SP ═════════════════════════
              LO (left outer arc) is the primary inscription path.
              LI, RI, RIB_LL, pulses, and heads render here.
        ════════════════════════════════════════════════════════════════════ */}
        <g className="v3dun-front">

          {/* LO glow duplicate */}
          <path
            ref={(el) => { refs.current.loGlow = el; }}
            d={PATHS.LO}
            fill="none"
            stroke="rgba(242,238,225,0.20)"
            strokeWidth="4"
            strokeLinecap="butt"
            filter="url(#v3-path-glow)"
          />
          {/* LO crisp stroke — primary inscription */}
          <path
            ref={(el) => { refs.current.lo = el; }}
            d={PATHS.LO}
            fill="none"
            stroke="rgba(242,238,225,0.92)"
            strokeWidth="1.1"
            strokeLinecap="butt"
          />

          {/* LI — inner left arc, post-connection depth element */}
          <path
            ref={(el) => { refs.current.li = el; }}
            d={PATHS.LI}
            fill="none"
            stroke="rgba(242,238,225,0.62)"
            strokeWidth="0.75"
            strokeLinecap="butt"
          />

          {/* RI — inner right arc, enters at chorus */}
          <path
            ref={(el) => { refs.current.ri = el; }}
            d={PATHS.RI}
            fill="none"
            stroke="rgba(242,238,225,0.58)"
            strokeWidth="0.75"
            strokeLinecap="butt"
          />

          {/* RIB_LL — structural rib, connection payoff 0:43 */}
          <path
            ref={(el) => { refs.current.ribLL = el; }}
            d={PATHS.RIB_LL}
            fill="none"
            stroke="rgba(242,238,225,0.78)"
            strokeWidth="0.85"
            strokeLinecap="butt"
          />

          {/* ── CP2 structural elements ────────────────────────────────────────── */}

          {/* Upper ribs inside ring */}
          <path
            ref={(el) => { refs.current.ribUL = el; }}
            d={PATHS.RIB_UL}
            fill="none"
            stroke="rgba(242,238,225,0.62)"
            strokeWidth="0.75"
            strokeLinecap="butt"
          />
          <path
            ref={(el) => { refs.current.ribUR = el; }}
            d={PATHS.RIB_UR}
            fill="none"
            stroke="rgba(242,238,225,0.62)"
            strokeWidth="0.75"
            strokeLinecap="butt"
          />
          {/* Lower-right rib */}
          <path
            ref={(el) => { refs.current.ribLR = el; }}
            d={PATHS.RIB_LR}
            fill="none"
            stroke="rgba(242,238,225,0.78)"
            strokeWidth="0.85"
            strokeLinecap="butt"
          />

          {/* Ring top notch arcs */}
          <path
            ref={(el) => { refs.current.notchL = el; }}
            d={PATHS.NOTCH_L}
            fill="none"
            stroke="rgba(242,238,225,0.55)"
            strokeWidth="0.7"
            strokeLinecap="butt"
          />
          <path
            ref={(el) => { refs.current.notchR = el; }}
            d={PATHS.NOTCH_R}
            fill="none"
            stroke="rgba(242,238,225,0.55)"
            strokeWidth="0.7"
            strokeLinecap="butt"
          />

          {/* Teeth — confirm key recognition */}
          <path
            ref={(el) => { refs.current.tooth1 = el; }}
            d={PATHS.TOOTH_1}
            fill="none"
            stroke="rgba(242,238,225,0.82)"
            strokeWidth="1"
            strokeLinecap="butt"
          />
          <path
            ref={(el) => { refs.current.tooth2 = el; }}
            d={PATHS.TOOTH_2}
            fill="none"
            stroke="rgba(242,238,225,0.82)"
            strokeWidth="1"
            strokeLinecap="butt"
          />
          <path
            ref={(el) => { refs.current.tooth3 = el; }}
            d={PATHS.TOOTH_3}
            fill="none"
            stroke="rgba(242,238,225,0.82)"
            strokeWidth="1"
            strokeLinecap="butt"
          />

          {/* LO back-propagation pulse — amber, travels ring base → ring top */}
          <path
            ref={(el) => { refs.current.loPulse = el; }}
            d={PATHS.LO_PULSE}
            fill="none"
            stroke="rgba(248,210,108,0.95)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#v3-pulse-bloom)"
          />

          {/* Suspension pulse — slow amber traversal of LO (1:05–1:15) */}
          <path
            ref={(el) => { refs.current.suspPulse = el; }}
            d={PATHS.SUSP_PULSE}
            fill="none"
            stroke="rgba(248,210,108,0.75)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#v3-pulse-bloom)"
          />

          {/* LO drawing head */}
          <circle
            ref={(el) => { refs.current.loHead = el; }}
            r="3.5"
            fill="rgba(242,238,225,0.95)"
            style={{ opacity: 0 }}
            filter="url(#v3-head-bloom)"
          />

          {/* SP_EXT drawing head — rises through ring */}
          <circle
            ref={(el) => { refs.current.spExtHead = el; }}
            r="3.5"
            fill="rgba(242,238,225,0.95)"
            style={{ opacity: 0 }}
            filter="url(#v3-head-bloom)"
          />

          {/* Connection bloom at ring base (195,420) — fires when RIB_LL completes */}
          <circle
            ref={(el) => { refs.current.connGlow = el; }}
            cx="195" cy="420" r="16"
            fill="rgba(242,238,225,0.10)"
            style={{ opacity: 0 }}
            filter="url(#v3-junction-glow)"
          />

          {/* Spectral color — warm tint earned at 0:43 */}
          <circle
            ref={(el) => { refs.current.spectral = el; }}
            cx="168" cy="400" r="8"
            fill="rgba(195,158,88,0.45)"
            style={{ opacity: 0 }}
            filter="url(#v3-junction-glow)"
          />

          {/* RING CLOSE BLOOM — ring base glow when LO closes at t=155 */}
          <circle
            ref={(el) => { refs.current.ringCloseBloom = el; }}
            cx="195" cy="420" r="24"
            fill="rgba(242,238,225,0.12)"
            style={{ opacity: 0 }}
            filter="url(#v3-junction-glow)"
          />

          {/* CLIMAX BLOOM — full key complete, wide warm amber glow at ring center */}
          <circle
            ref={(el) => { refs.current.climaxBloom = el; }}
            cx="195" cy="296" r="200"
            fill="rgba(195,158,88,0.06)"
            style={{ opacity: 0 }}
            filter="url(#v3-junction-glow)"
          />

          {/* ── OUTRO CYCLING DOTS — ellipse-parametrized, perfectly smooth ──── */}
          {/* Ring dot 1 — cx/cy set each frame via setRingDot() */}
          <circle
            ref={(el) => { refs.current.ringDot1 = el; }}
            r="9"
            fill="rgba(248,210,108,0.95)"
            style={{ opacity: 0 }}
            filter="url(#v3-pulse-bloom)"
          />
          {/* Ring dot 2 — 180° offset, always opposite dot 1 */}
          <circle
            ref={(el) => { refs.current.ringDot2 = el; }}
            r="9"
            fill="rgba(248,210,108,0.95)"
            style={{ opacity: 0 }}
            filter="url(#v3-pulse-bloom)"
          />
          {/* Shaft dot — triangle-wave pendulum on OUTRO_SHAFT path */}
          <path
            ref={(el) => { refs.current.shaftDot = el; }}
            d={PATHS.OUTRO_SHAFT}
            fill="none"
            stroke="rgba(248,210,108,0.95)"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#v3-pulse-bloom)"
          />

        </g>

        {/* ═══ 4. Vignette — framing only ══════════════════════════════════════ */}
        <radialGradient id="v3-vig" cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor="transparent" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.25" />
        </radialGradient>
        <rect
          width="390" height="844"
          fill="url(#v3-vig)"
          style={{ pointerEvents: "none" }}
        />

      </svg>

      {/* ── Dev overlay ──────────────────────────────────────────────────────── */}
      {SHOW_UI && (
        <div className="v3dun__dev">
          {IS_DEMO ? (
            <button type="button" className="v3dun__dev-btn" onClick={handleDemo}>
              ↺ Demo
            </button>
          ) : (
            <>
              <button type="button" className="v3dun__dev-btn" onClick={handlePlayPause}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <input
                type="range"
                className="v3dun__dev-seek"
                min="0" max="95" step="0.5"
                defaultValue="0"
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
              />
            </>
          )}
          <span
            ref={(el) => { refs.current.timeDisp = el; }}
            className="v3dun__dev-time"
          >
            {FROZEN_T !== null ? FROZEN_T.toFixed(1) + "s" : "0.0s"}
          </span>
        </div>
      )}
    </div>
  );
}
