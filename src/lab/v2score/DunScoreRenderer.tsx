/**
 * DÜN — Authored audiovisual score renderer.
 * CHECKPOINT 1: 0:00–1:35
 *
 * Route: ?lab=v2-score
 * Demo:  ?lab=v2-score&demo=1   (internal clock — for screen recording)
 * Still: ?lab=v2-score&t=30     (frozen frame — for screenshots)
 * UI:    ?lab=v2-score&t=30&ui=1
 *
 * Architecture:
 *   React renders the SVG structure ONCE.
 *   A requestAnimationFrame loop reads getSceneTime() and updates all
 *   SVG attributes imperatively — zero React re-renders per frame.
 *   All state is pure fn of t → seeking reconstructs the scene.
 *
 * Visual vocabulary:
 *   OLED black background + ivory hairline linework + restrained bloom.
 *   P1 (FRONT layer) occludes P2 (BACK layer) at their crossing.
 *   Typography appears between layers — P1/P4B in front, P2 behind.
 *   Light pulses travel through previously-drawn paths at 0:43.
 *   "SONRA SEN" revealed through expanding clip rects at 1:15.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getSceneTime, resetDemoClock, IS_DEMO, FROZEN_T,
  interp,
  PATHS,
  P1_DRAW, P2_DRAW, PCONN_DRAW,
  P3A_DRAW, P3B_DRAW, P4A_DRAW, P4B_DRAW,
  P1_PULSE_POS, P1_PULSE_OP,
  P2_PULSE_POS, P2_PULSE_OP,
  SUSP_PULSE_POS, SUSP_PULSE_OP,
  P1_HEAD_OP, P2_HEAD_OP,
  JUNCTION_BLOOM, CONN_BLOOM, SPECTRAL_OP,
  SONRA_REVEAL, SEN_REVEAL, TYP_ABSORB,
} from "./scoreTimeline";
import { AudioEngine } from "../../audio/AudioEngine";
import "./DunScoreRenderer.css";

// ── URL flags ─────────────────────────────────────────────────────────────────

const _params = new URLSearchParams(window.location.search);
const SHOW_UI  = _params.get("ui") === "1";
const AUDIO_SRC = "/audio/dun.m4a";

// Text clip widths (px) — generous boxes; actual text is narrower
const SONRA_CLIP_W = 220;  // px — clip rect full-reveal width for "SONRA"
const SEN_CLIP_W   = 140;  // px — clip rect full-reveal width for "SEN"

// Pulse segment length in px
const PULSE_LEN = 55;

// ── Scene ref bundle ─────────────────────────────────────────────────────────

interface Refs {
  // Paths — geometry layer (back)
  p2:       SVGPathElement | null;
  p2Glow:   SVGPathElement | null;
  // Paths — geometry layer (front)
  p1:       SVGPathElement | null;
  p1Glow:   SVGPathElement | null;
  pconn:    SVGPathElement | null;
  pconnGlow:SVGPathElement | null;
  p3a:      SVGPathElement | null;
  p3b:      SVGPathElement | null;
  p4a:      SVGPathElement | null;
  p4b:      SVGPathElement | null;
  // Light pulses
  p1Pulse:  SVGPathElement | null;
  p2Pulse:  SVGPathElement | null;
  suspPulse:SVGPathElement | null;
  // Drawing heads
  p1Head:   SVGCircleElement | null;
  p2Head:   SVGCircleElement | null;
  // Bloom at crossing
  junctionGlow: SVGCircleElement | null;
  connGlow:     SVGCircleElement | null;
  // Spectral color at junction
  spectral: SVGCircleElement | null;
  // Typography clip rects
  sonraClip: SVGRectElement | null;
  senClip:   SVGRectElement | null;
  // Typography text (for absorption)
  typGroup: SVGGElement | null;
  // Dev overlay
  timeDisp: HTMLSpanElement | null;
}

// Path lengths — populated after mount via getTotalLength()
interface Lengths {
  [key: string]: number;
  p1: number;
  p2: number;
  pconn: number;
  p3a: number;
  p3b: number;
  p4a: number;
  p4b: number;
  p1Pulse: number;
  p2Pulse: number;
  suspPulse: number;
}

// ── Imperative scene update (no React re-renders) ─────────────────────────────

function setDash(
  el: SVGPathElement | null,
  progress: number,
  totalLen: number,
): void {
  if (!el) return;
  // stroke-dasharray = "L L", dashoffset = L*(1-progress)
  const offset = totalLen * (1 - progress);
  el.style.strokeDashoffset = `${offset}`;
}

function setPulse(
  el: SVGPathElement | null,
  pos: number,      // 0–1 along the pulse path
  opacity: number,
  totalLen: number,
): void {
  if (!el) return;
  // Dash is PULSE_LEN long; offset shifts it along the path
  const offset = -(pos * (totalLen - PULSE_LEN));
  el.style.strokeDashoffset = `${offset}`;
  el.style.opacity = `${opacity}`;
}

function updateScene(t: number, r: Refs, L: Lengths): void {
  const ct = Math.max(0, t);

  // ── P1 drawing ──────────────────────────────────────────────────────────
  const p1Draw = interp(ct, P1_DRAW);
  setDash(r.p1, p1Draw, L.p1);
  setDash(r.p1Glow, p1Draw, L.p1);

  // P1 drawing head
  if (r.p1 && r.p1Head) {
    const headOp = interp(ct, P1_HEAD_OP);
    if (headOp > 0.01) {
      const pt = r.p1.getPointAtLength(p1Draw * L.p1);
      r.p1Head.setAttribute("cx", pt.x.toFixed(1));
      r.p1Head.setAttribute("cy", pt.y.toFixed(1));
      r.p1Head.style.opacity = `${headOp}`;
    } else {
      r.p1Head.style.opacity = "0";
    }
  }

  // ── P2 drawing ──────────────────────────────────────────────────────────
  const p2Draw = interp(ct, P2_DRAW);
  setDash(r.p2, p2Draw, L.p2);
  setDash(r.p2Glow, p2Draw, L.p2);

  if (r.p2 && r.p2Head) {
    const headOp = interp(ct, P2_HEAD_OP);
    if (headOp > 0.01) {
      const pt = r.p2.getPointAtLength(p2Draw * L.p2);
      r.p2Head.setAttribute("cx", pt.x.toFixed(1));
      r.p2Head.setAttribute("cy", pt.y.toFixed(1));
      r.p2Head.style.opacity = `${headOp}`;
    } else {
      r.p2Head.style.opacity = "0";
    }
  }

  // ── PCONN (connection bridge) ────────────────────────────────────────────
  const pconnDraw = interp(ct, PCONN_DRAW);
  setDash(r.pconn, pconnDraw, L.pconn);
  setDash(r.pconnGlow, pconnDraw, L.pconn);

  // ── Secondary strokes (vocal phase) ──────────────────────────────────────
  setDash(r.p3a, interp(ct, P3A_DRAW), L.p3a);
  setDash(r.p3b, interp(ct, P3B_DRAW), L.p3b);

  // ── Post-connection geometry ──────────────────────────────────────────────
  setDash(r.p4a, interp(ct, P4A_DRAW), L.p4a);
  setDash(r.p4b, interp(ct, P4B_DRAW), L.p4b);

  // ── Light pulses (0:43 payoff — old geometry becomes active) ─────────────
  setPulse(r.p1Pulse, interp(ct, P1_PULSE_POS), interp(ct, P1_PULSE_OP), L.p1Pulse);
  setPulse(r.p2Pulse, interp(ct, P2_PULSE_POS), interp(ct, P2_PULSE_OP), L.p2Pulse);

  // ── Suspension pulse (1:05–1:15) ─────────────────────────────────────────
  setPulse(r.suspPulse, interp(ct, SUSP_PULSE_POS), interp(ct, SUSP_PULSE_OP), L.suspPulse);

  // ── Junction crossing bloom (0:14–0:17) ──────────────────────────────────
  if (r.junctionGlow) {
    r.junctionGlow.style.opacity = `${interp(ct, JUNCTION_BLOOM)}`;
  }

  // ── Connection bloom (0:43 payoff) ───────────────────────────────────────
  if (r.connGlow) {
    r.connGlow.style.opacity = `${interp(ct, CONN_BLOOM)}`;
  }

  // ── Spectral color at junction (first warm tint — earned at 0:43) ────────
  if (r.spectral) {
    r.spectral.style.opacity = `${interp(ct, SPECTRAL_OP)}`;
  }

  // ── Typography: SONRA SEN ────────────────────────────────────────────────
  const absorb = interp(ct, TYP_ABSORB);
  const sonraReveal = interp(ct, SONRA_REVEAL) * (1 - absorb);
  const senReveal   = interp(ct, SEN_REVEAL)   * (1 - absorb);

  if (r.sonraClip) {
    r.sonraClip.setAttribute("width", `${(sonraReveal * SONRA_CLIP_W).toFixed(1)}`);
  }
  if (r.senClip) {
    r.senClip.setAttribute("width", `${(senReveal * SEN_CLIP_W).toFixed(1)}`);
  }

  // Typography group opacity — stays at 1 when any word has reveal > 0
  if (r.typGroup) {
    const anyVisible = Math.max(sonraReveal, senReveal);
    r.typGroup.style.opacity = anyVisible > 0.01 ? "1" : "0";
  }

  // ── Dev overlay time ─────────────────────────────────────────────────────
  if (r.timeDisp) {
    r.timeDisp.textContent = ct.toFixed(1) + "s";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DunScoreRenderer() {
  const refs = useRef<Refs>({
    p2: null, p2Glow: null,
    p1: null, p1Glow: null,
    pconn: null, pconnGlow: null,
    p3a: null, p3b: null, p4a: null, p4b: null,
    p1Pulse: null, p2Pulse: null, suspPulse: null,
    p1Head: null, p2Head: null,
    junctionGlow: null, connGlow: null, spectral: null,
    sonraClip: null, senClip: null,
    typGroup: null,
    timeDisp: null,
  });

  const lengths = useRef<Lengths>({
    p1: 773, p2: 591, pconn: 50,
    p3a: 67, p3b: 47, p4a: 140, p4b: 94,
    p1Pulse: 555, p2Pulse: 277, suspPulse: 314,
  });

  const rafId = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── After mount: read actual path lengths, set initial dasharray ──────────
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

    measure(r.p1, "p1");         measure(r.p1Glow, "p1");
    measure(r.p2, "p2");         measure(r.p2Glow, "p2");
    measure(r.pconn, "pconn");   measure(r.pconnGlow, "pconn");
    measure(r.p3a, "p3a");
    measure(r.p3b, "p3b");
    measure(r.p4a, "p4a");
    measure(r.p4b, "p4b");

    // Pulse paths use pulse dasharray (fixed pulse length)
    const initPulse = (el: SVGPathElement | null, key: keyof Lengths) => {
      if (!el) return;
      const len = el.getTotalLength();
      (L as Record<string, number>)[key] = len;
      el.style.strokeDasharray = `${PULSE_LEN} ${len}`;
      el.style.strokeDashoffset = `${len}`;
      el.style.opacity = "0";
    };
    initPulse(r.p1Pulse, "p1Pulse");
    initPulse(r.p2Pulse, "p2Pulse");
    initPulse(r.suspPulse, "suspPulse");
  }, []);

  // ── Audio setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (IS_DEMO || FROZEN_T !== null) return;
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
      const t = getSceneTime();
      updateScene(t, refs.current, lengths.current);
      rafId.current = requestAnimationFrame(loop);
    }
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  // ── Demo controls ──────────────────────────────────────────────────────────
  const handleDemo = useCallback(() => {
    resetDemoClock();
    setIsPlaying(true);
  }, []);

  const handlePlayPause = useCallback(() => {
    const el = AudioEngine.element;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const handleSeek = useCallback((v: number) => {
    if (IS_DEMO) return; // demo has no seek
    AudioEngine.element.currentTime = v;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dun-score">
      <svg
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        className="dun-score__svg"
        aria-hidden="true"
      >
        <defs>
          {/* Drawing head bloom — small radius, tight glow */}
          <filter id="sc-head-bloom" x="-400%" y="-400%" width="900%" height="900%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Path glow — very subtle, wider, lower opacity */}
          <filter id="sc-path-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
            </feMerge>
          </filter>

          {/* Pulse bloom — wider blur so warm glow reads through underlying ivory line */}
          <filter id="sc-pulse-bloom" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Junction glow — wider spread */}
          <filter id="sc-junction-glow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* SONRA clip path — reveals text left-to-right */}
          <clipPath id="sc-sonra-clip">
            <rect
              ref={(el) => { refs.current.sonraClip = el; }}
              x="112" y="354" width="0" height="40"
            />
          </clipPath>

          {/* SEN clip path — reveals text left-to-right */}
          <clipPath id="sc-sen-clip">
            <rect
              ref={(el) => { refs.current.senClip = el; }}
              x="214" y="420" width="0" height="50"
            />
          </clipPath>
        </defs>

        {/* ═══ 0. Background — true OLED black ══════════════════════════════════ */}
        <rect width="390" height="844" fill="#010101" />

        {/* ═══ 1. BACK LAYER — P2 (behind P1 at crossing) ══════════════════════ */}
        <g className="sc-layer-back">
          {/* P2 glow — subtle bloom duplicate */}
          <path
            ref={(el) => { refs.current.p2Glow = el; }}
            d={PATHS.P2}
            fill="none"
            stroke="rgba(242,238,225,0.22)"
            strokeWidth="3.5"
            strokeLinecap="butt"
            filter="url(#sc-path-glow)"
          />
          {/* P2 crisp stroke */}
          <path
            ref={(el) => { refs.current.p2 = el; }}
            d={PATHS.P2}
            fill="none"
            stroke="rgba(242,238,225,0.88)"
            strokeWidth="1"
            strokeLinecap="butt"
          />
          {/* P2 light pulse — warm amber, forward propagation from junction */}
          <path
            ref={(el) => { refs.current.p2Pulse = el; }}
            d={PATHS.P2_PULSE}
            fill="none"
            stroke="rgba(248,210,108,0.95)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#sc-pulse-bloom)"
          />
          {/* P3A secondary stroke */}
          <path
            ref={(el) => { refs.current.p3a = el; }}
            d={PATHS.P3A}
            fill="none"
            stroke="rgba(242,238,225,0.72)"
            strokeWidth="0.8"
            strokeLinecap="butt"
          />
          {/* P3B secondary stroke */}
          <path
            ref={(el) => { refs.current.p3b = el; }}
            d={PATHS.P3B}
            fill="none"
            stroke="rgba(242,238,225,0.72)"
            strokeWidth="0.8"
            strokeLinecap="butt"
          />
          {/* P4A extension from P1 end */}
          <path
            ref={(el) => { refs.current.p4a = el; }}
            d={PATHS.P4A}
            fill="none"
            stroke="rgba(242,238,225,0.82)"
            strokeWidth="1"
            strokeLinecap="butt"
          />
          {/* Suspension pulse — slow light through P2 during 1:05-1:15 */}
          <path
            ref={(el) => { refs.current.suspPulse = el; }}
            d={PATHS.SUSP_PULSE}
            fill="none"
            stroke="rgba(242,238,225,0.80)"
            strokeWidth="1.5"
            strokeLinecap="round"
            filter="url(#sc-pulse-bloom)"
          />
          {/* P2 drawing head */}
          <circle
            ref={(el) => { refs.current.p2Head = el; }}
            r="3"
            fill="rgba(242,238,225,0.90)"
            style={{ opacity: 0 }}
            filter="url(#sc-head-bloom)"
          />
          {/* Junction crossing bloom — at P2 × P1 crossing (around 190,381) */}
          <circle
            ref={(el) => { refs.current.junctionGlow = el; }}
            cx="190" cy="381" r="12"
            fill="rgba(242,238,225,0.12)"
            style={{ opacity: 0 }}
            filter="url(#sc-junction-glow)"
          />
        </g>

        {/* ═══ 2. TYPOGRAPHY LAYER — between P2 and P1 in z-order ══════════════
              P1 and P4B (rendered above) appear IN FRONT of the text.
              P2 (rendered below) appears BEHIND the text.
        ══════════════════════════════════════════════════════════════════════ */}
        <g
          ref={(el) => { refs.current.typGroup = el; }}
          style={{ opacity: 0 }}
        >
          {/* SONRA — clip reveals left-to-right */}
          <text
            clipPath="url(#sc-sonra-clip)"
            x="112"
            y="382"
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
            clipPath="url(#sc-sen-clip)"
            x="214"
            y="448"
            fontFamily="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif"
            fontWeight="200"
            fontSize="32"
            fill="rgba(242,238,225,0.90)"
            style={{ letterSpacing: "0.25em" }}
          >
            SEN
          </text>
        </g>

        {/* ═══ 3. FRONT LAYER — P1 renders on top of P2 at crossing ═══════════ */}
        <g className="sc-layer-front">
          {/* P1 glow — subtle bloom */}
          <path
            ref={(el) => { refs.current.p1Glow = el; }}
            d={PATHS.P1}
            fill="none"
            stroke="rgba(242,238,225,0.20)"
            strokeWidth="4"
            strokeLinecap="butt"
            filter="url(#sc-path-glow)"
          />
          {/* P1 crisp stroke */}
          <path
            ref={(el) => { refs.current.p1 = el; }}
            d={PATHS.P1}
            fill="none"
            stroke="rgba(242,238,225,0.92)"
            strokeWidth="1.1"
            strokeLinecap="butt"
          />
          {/* PCONN connection bridge */}
          <path
            ref={(el) => { refs.current.pconn = el; }}
            d={PATHS.PCONN}
            fill="none"
            stroke="rgba(242,238,225,0.88)"
            strokeWidth="1"
            strokeLinecap="butt"
          />
          {/* PCONN glow */}
          <path
            ref={(el) => { refs.current.pconnGlow = el; }}
            d={PATHS.PCONN}
            fill="none"
            stroke="rgba(242,238,225,0.35)"
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#sc-path-glow)"
          />
          {/* P4B branch from junction — passes through SONRA SEN area */}
          <path
            ref={(el) => { refs.current.p4b = el; }}
            d={PATHS.P4B}
            fill="none"
            stroke="rgba(242,238,225,0.80)"
            strokeWidth="0.9"
            strokeLinecap="butt"
          />
          {/* P1 reverse light pulse — warm amber, back-propagation from junction to start */}
          <path
            ref={(el) => { refs.current.p1Pulse = el; }}
            d={PATHS.P1_PULSE}
            fill="none"
            stroke="rgba(248,210,108,0.95)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#sc-pulse-bloom)"
          />
          {/* P1 drawing head */}
          <circle
            ref={(el) => { refs.current.p1Head = el; }}
            r="3.5"
            fill="rgba(242,238,225,0.95)"
            style={{ opacity: 0 }}
            filter="url(#sc-head-bloom)"
          />
          {/* Connection bloom at (195,340)–(182,388) junction */}
          <circle
            ref={(el) => { refs.current.connGlow = el; }}
            cx="188" cy="364" r="18"
            fill="rgba(242,238,225,0.10)"
            style={{ opacity: 0 }}
            filter="url(#sc-junction-glow)"
          />
          {/* Spectral color — first earned warm tint at 0:43 */}
          {/* Restrained amber/warm trace at the connection point */}
          <circle
            ref={(el) => { refs.current.spectral = el; }}
            cx="188" cy="364" r="8"
            fill="rgba(195,158,88,0.45)"
            style={{ opacity: 0 }}
            filter="url(#sc-junction-glow)"
          />
        </g>

        {/* ═══ 4. Vignette — very subtle, not artistic, just framing ══════════ */}
        <radialGradient id="sc-vig" cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor="transparent" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.48" />
        </radialGradient>
        <rect width="390" height="844" fill="url(#sc-vig)" style={{ pointerEvents: "none" }} />
      </svg>

      {/* ── Dev overlay ─────────────────────────────────────────────────────── */}
      {SHOW_UI && (
        <div className="dun-score__dev">
          {IS_DEMO ? (
            <button type="button" className="dun-score__dev-btn" onClick={handleDemo}>
              ↺ Demo
            </button>
          ) : (
            <>
              <button type="button" className="dun-score__dev-btn" onClick={handlePlayPause}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <input
                type="range"
                className="dun-score__dev-seek"
                min="0" max="95" step="0.5"
                defaultValue="0"
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
              />
            </>
          )}
          <span
            ref={(el) => { refs.current.timeDisp = el; }}
            className="dun-score__dev-time"
          >
            {FROZEN_T !== null ? FROZEN_T.toFixed(1) + "s" : "0.0s"}
          </span>
        </div>
      )}
    </div>
  );
}
