/**
 * V3 ŞİMDİ — ∞ → Heart morph renderer.
 * Full song: 0:00–3:33
 *
 * Route: ?lab=v3-simdi
 * Demo:  ?lab=v3-simdi&demo=1
 * Still: ?lab=v3-simdi&t=90
 * UI:    ?lab=v3-simdi&t=90&ui=1
 *
 * Architecture:
 *   Starts with completed YARIN ∞ (morph=0). Per-frame morphT drives
 *   lerpCoords() → setAttribute("d") on all primary arcs.
 *   ∞ extras fade out. Heart extras emerge at THE REVELATION (t=141).
 *   One final connection drawn (THE INHALE, t=123–137).
 *   THE REVELATION: morphT snaps to 1.0, heart readable for the first time.
 *   THE EXHALE: heart held clean in OLED black. No orbit dots. Let it breathe.
 *
 * Depth:
 *   BACK: RO, SP
 *   FRONT: LO, LI, RI, ∞ extras (fading), heart extras (appearing), pulses
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getSceneTime, resetDemoClock, IS_DEMO, FROZEN_T,
  interp,
  INF_COORDS, HEART_COORDS,
  HEART_EXTRA_PATHS,
  lerpCoords, build2C, buildL,
  MORPH_KF, INF_EXT_OP, INNER_OP, HEART_EXT_OP,
  FINAL_CNX_DRAW, FINAL_CNX_HEAD_OP,
  IGNITION_POS, IGNITION_OP,
  REVEAL_BLOOM_OP, EXHALE_GLOW,
  HEART_OUTER_L_CX, HEART_OUTER_L_CY,
  HEART_OUTER_R_CX, HEART_OUTER_R_CY,
  HEART_OUTER_RX, HEART_OUTER_RY,
  HEART_INNER_CX, HEART_INNER_CY,
  HEART_INNER_RX, HEART_INNER_RY,
} from "./v3simdiTimeline";
import { AudioEngine } from "../../audio/AudioEngine";
import "./V3SimdiRenderer.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const _params = new URLSearchParams(window.location.search);
const SHOW_UI     = _params.get("ui") === "1";
const AUDIO_SRC   = "/audio/simdi.m4a";
const IS_STANDALONE = _params.get("lab") !== "v3-journey";
const PULSE_LEN = 55;

// ── Refs ──────────────────────────────────────────────────────────────────────

interface Refs {
  // BACK — morphing
  ro:       SVGPathElement | null;
  roGlow:   SVGPathElement | null;
  sp:       SVGPathElement | null;
  // FRONT — morphing
  lo:       SVGPathElement | null;
  loGlow:   SVGPathElement | null;
  li:       SVGPathElement | null;
  ri:       SVGPathElement | null;
  // ∞ extras (fade out)
  crossL:   SVGLineElement | null;
  crossR:   SVGLineElement | null;
  // Heart extras (emerge at t=141)
  ribUL:    SVGLineElement | null;
  ribUR:    SVGLineElement | null;
  ribLL:    SVGLineElement | null;
  ribLR:    SVGLineElement | null;
  notchL:   SVGPathElement | null;
  notchR:   SVGPathElement | null;
  // Final connection — drawn during THE INHALE
  finalCnx:     SVGPathElement | null;
  finalCnxHead: SVGCircleElement | null;
  // IGNITION pulse
  ignitionPulse: SVGPathElement | null;
  // REVELATION bloom
  revealBloom: SVGCircleElement | null;
  // Outro orbit dots (fireworks — parametric, no cusps)
  heartDotL: SVGCircleElement | null;   // left outer lobe
  heartDotR: SVGCircleElement | null;   // right outer lobe
  heartDotI: SVGCircleElement | null;   // inner arc
  // Dev
  timeDisp: HTMLSpanElement | null;
}

interface Lengths {
  [key: string]: number;
  finalCnx: number;
  ignitionPulse: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setAttr(el: SVGPathElement | null, d: string): void {
  if (!el) return;
  el.setAttribute("d", d);
}

function setOp(el: SVGElement | null, op: number): void {
  if (!el) return;
  el.style.opacity = `${op}`;
}

function setPulse(el: SVGPathElement | null, pos: number, opacity: number, totalLen: number): void {
  if (!el) return;
  el.style.strokeDashoffset = `${-(pos * (totalLen - PULSE_LEN))}`;
  el.style.opacity = `${opacity}`;
}

function setDash(el: SVGPathElement | null, progress: number, totalLen: number): void {
  if (!el) return;
  el.style.strokeDashoffset = `${totalLen * (1 - progress)}`;
}

// ── Scene update ──────────────────────────────────────────────────────────────

function updateScene(t: number, r: Refs, L: Lengths): void {
  const ct = Math.max(0, t);

  // ── Morph all primary paths ───────────────────────────────────────────────
  const morphT = interp(ct, MORPH_KF);

  const lo = lerpCoords(INF_COORDS.lo, HEART_COORDS.lo, morphT);
  const ro = lerpCoords(INF_COORDS.ro, HEART_COORDS.ro, morphT);
  const li = lerpCoords(INF_COORDS.li, HEART_COORDS.li, morphT);
  const ri = lerpCoords(INF_COORDS.ri, HEART_COORDS.ri, morphT);
  const sp = lerpCoords(INF_COORDS.sp, HEART_COORDS.sp, morphT);

  const loD = build2C(lo);
  const roD = build2C(ro);

  setAttr(r.lo,     loD);
  setAttr(r.loGlow, loD);
  setAttr(r.ro,     roD);
  setAttr(r.roGlow, roD);
  setAttr(r.li,     build2C(li));
  setAttr(r.ri,     build2C(ri));
  setAttr(r.sp,     buildL(sp));

  // ── ∞ extras — fade out ───────────────────────────────────────────────────
  const infOp = interp(ct, INF_EXT_OP);
  setOp(r.crossL, infOp);
  setOp(r.crossR, infOp);

  // ── Inner arcs — fade in as heart lobes form ──────────────────────────────
  const innerOp = interp(ct, INNER_OP);
  setOp(r.li, innerOp);
  setOp(r.ri, innerOp);

  // ── Heart extras — emerge at THE REVELATION ───────────────────────────────
  const heartExtOp = interp(ct, HEART_EXT_OP);
  // RIB_LR is the FINAL_CNX — shown via the dedicated drawn element, not as extra
  setOp(r.ribUL,  heartExtOp);
  setOp(r.ribUR,  heartExtOp);
  setOp(r.ribLL,  heartExtOp);
  // ribLR rendered as FINAL_CNX — skip here (avoid double render)
  setOp(r.notchL, heartExtOp);
  setOp(r.notchR, heartExtOp);

  // ── Final connection — drawn during THE INHALE (2:03–2:17) ───────────────
  const cnxProg = interp(ct, FINAL_CNX_DRAW);
  setDash(r.finalCnx, cnxProg, L.finalCnx);

  if (r.finalCnx && r.finalCnxHead) {
    const headOp = interp(ct, FINAL_CNX_HEAD_OP);
    if (headOp > 0.01) {
      const pt = r.finalCnx.getPointAtLength(cnxProg * L.finalCnx);
      r.finalCnxHead.setAttribute("cx", pt.x.toFixed(1));
      r.finalCnxHead.setAttribute("cy", pt.y.toFixed(1));
      r.finalCnxHead.style.opacity = `${headOp}`;
    } else {
      r.finalCnxHead.style.opacity = "0";
    }
  }

  // ── IGNITION pulse (2:17–2:21) ────────────────────────────────────────────
  // Pulse uses current LO path (near-heart pose at morphT≈0.87–1.0)
  if (r.ignitionPulse) r.ignitionPulse.setAttribute("d", loD);
  setPulse(r.ignitionPulse, interp(ct, IGNITION_POS), interp(ct, IGNITION_OP), L.ignitionPulse);

  // ── REVELATION bloom ──────────────────────────────────────────────────────
  if (r.revealBloom) {
    r.revealBloom.style.opacity = `${interp(ct, REVEAL_BLOOM_OP)}`;
  }

  // ── THE EXHALE — path glow gently elevated during outro ──────────────────
  // Apply subtle extra brightness to loGlow during exhale
  const exhaleGlow = interp(ct, EXHALE_GLOW);
  if (r.loGlow) {
    r.loGlow.style.opacity = `${0.18 + exhaleGlow * 0.25}`;
  }
  if (r.roGlow) {
    r.roGlow.style.opacity = `${0.14 + exhaleGlow * 0.20}`;
  }

  // ── OUTRO HEART ORBIT DOTS — "digital fireworks" ─────────────────────────
  // Three amber dots on separate parts of the completed heart.
  // Dot L: left outer lobe ellipse.
  // Dot R: right outer lobe ellipse, 180° offset (always opposite Dot L).
  // Dot I: inner left arc ellipse, 90° offset, smaller radius, faster period.
  // All fade in over 9s from THE REVELATION, fade out over final 5s.
  {
    const REVEAL_T  = 141;
    const SONG_END  = 213.2;
    const PERIOD_O  = 14;  // outer lobe period (s)
    const PERIOD_I  = 9;   // inner arc period (s) — faster = more "fireworks"

    const dotOp =
      ct < REVEAL_T          ? 0 :
      ct < REVEAL_T + 9      ? ((ct - REVEAL_T) / 9) * 0.90 :
      ct < SONG_END - 5      ? 0.90 :
      ct < SONG_END          ? ((SONG_END - ct) / 5) * 0.90 : 0;

    if (dotOp > 0.01) {
      const oPhase = ((ct - REVEAL_T) % PERIOD_O) / PERIOD_O;
      const iPhase = ((ct - REVEAL_T + PERIOD_I * 0.25) % PERIOD_I) / PERIOD_I;

      const aL = 2 * Math.PI * oPhase;
      const aR = aL + Math.PI;  // 180° offset
      const aI = 2 * Math.PI * iPhase;

      if (r.heartDotL) {
        r.heartDotL.setAttribute("cx", (HEART_OUTER_L_CX + HEART_OUTER_RX * Math.sin(aL)).toFixed(1));
        r.heartDotL.setAttribute("cy", (HEART_OUTER_L_CY - HEART_OUTER_RY * Math.cos(aL)).toFixed(1));
        r.heartDotL.style.opacity = `${dotOp}`;
      }
      if (r.heartDotR) {
        r.heartDotR.setAttribute("cx", (HEART_OUTER_R_CX + HEART_OUTER_RX * Math.sin(aR)).toFixed(1));
        r.heartDotR.setAttribute("cy", (HEART_OUTER_R_CY - HEART_OUTER_RY * Math.cos(aR)).toFixed(1));
        r.heartDotR.style.opacity = `${dotOp * 0.88}`;
      }
      if (r.heartDotI) {
        r.heartDotI.setAttribute("cx", (HEART_INNER_CX + HEART_INNER_RX * Math.sin(aI)).toFixed(1));
        r.heartDotI.setAttribute("cy", (HEART_INNER_CY - HEART_INNER_RY * Math.cos(aI)).toFixed(1));
        r.heartDotI.style.opacity = `${dotOp * 0.72}`;
      }
    } else {
      if (r.heartDotL) r.heartDotL.style.opacity = "0";
      if (r.heartDotR) r.heartDotR.style.opacity = "0";
      if (r.heartDotI) r.heartDotI.style.opacity = "0";
    }
  }

  // ── Dev ───────────────────────────────────────────────────────────────────
  if (r.timeDisp) {
    r.timeDisp.textContent = ct.toFixed(1) + "s";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function V3SimdiRenderer() {
  const refs = useRef<Refs>({
    ro: null, roGlow: null, sp: null,
    lo: null, loGlow: null, li: null, ri: null,
    crossL: null, crossR: null,
    ribUL: null, ribUR: null, ribLL: null, ribLR: null,
    notchL: null, notchR: null,
    finalCnx: null, finalCnxHead: null,
    ignitionPulse: null,
    revealBloom: null,
    heartDotL: null, heartDotR: null, heartDotI: null,
    timeDisp: null,
  });

  const lengths = useRef<Lengths>({ finalCnx: 178, ignitionPulse: 500 });
  const rafId   = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Init — render ∞ pose (morph=0), set up pulse dasharray ───────────────
  useEffect(() => {
    const r = refs.current;
    const L = lengths.current;

    const loD = build2C([...INF_COORDS.lo]);
    const roD = build2C([...INF_COORDS.ro]);
    if (r.lo)     r.lo.setAttribute("d", loD);
    if (r.loGlow) r.loGlow.setAttribute("d", loD);
    if (r.ro)     r.ro.setAttribute("d", roD);
    if (r.roGlow) r.roGlow.setAttribute("d", roD);
    if (r.li)     r.li.setAttribute("d", build2C([...INF_COORDS.li]));
    if (r.ri)     r.ri.setAttribute("d", build2C([...INF_COORDS.ri]));
    if (r.sp)     r.sp.setAttribute("d", buildL([...INF_COORDS.sp]));

    // Final connection path
    if (r.finalCnx) {
      const len = r.finalCnx.getTotalLength();
      L.finalCnx = len;
      r.finalCnx.style.strokeDasharray = `${len} ${len}`;
      r.finalCnx.style.strokeDashoffset = `${len}`;
    }

    // Ignition pulse
    if (r.ignitionPulse) {
      r.ignitionPulse.setAttribute("d", loD);
      const len = r.ignitionPulse.getTotalLength();
      L.ignitionPulse = len;
      r.ignitionPulse.style.strokeDasharray = `${PULSE_LEN} ${len}`;
      r.ignitionPulse.style.strokeDashoffset = `${len}`;
      r.ignitionPulse.style.opacity = "0";
    }
  }, []);

  // ── Audio ─────────────────────────────────────────────────────────────────
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

  // ── rAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function loop() {
      updateScene(getSceneTime(), refs.current, lengths.current);
      rafId.current = requestAnimationFrame(loop);
    }
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  const handleDemo      = useCallback(() => { resetDemoClock(); setIsPlaying(true); }, []);
  const handlePlayPause = useCallback(() => {
    const el = AudioEngine.element;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);
  const handleSeek = useCallback((v: number) => {
    if (IS_DEMO) return;
    AudioEngine.element.currentTime = v;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="v3simdi">
      <svg
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        className="v3simdi__svg"
        aria-hidden="true"
      >
        <defs>
          <filter id="vs-path-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
            </feMerge>
          </filter>

          <filter id="vs-pulse-bloom" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="vs-head-bloom" x="-400%" y="-400%" width="900%" height="900%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="vs-reveal-bloom" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="28" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
            </feMerge>
          </filter>
        </defs>

        {/* ═══ 0. Background ════════════════════════════════════════════════ */}
        <rect width="390" height="844" fill="#010101" />

        {/* ═══ 1. BACK LAYER ════════════════════════════════════════════════ */}
        <g>
          <path ref={(el)=>{refs.current.roGlow=el;}} fill="none" stroke="rgba(242,238,225,0.14)" strokeWidth="3.5" strokeLinecap="butt" filter="url(#vs-path-glow)" />
          <path ref={(el)=>{refs.current.ro=el;}}     fill="none" stroke="rgba(242,238,225,0.80)" strokeWidth="1"   strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.sp=el;}}     fill="none" stroke="rgba(242,238,225,0.65)" strokeWidth="0.85" strokeLinecap="butt" />
        </g>

        {/* ═══ 2. FRONT LAYER ═══════════════════════════════════════════════ */}
        <g>
          {/* Primary arcs */}
          <path ref={(el)=>{refs.current.loGlow=el;}} fill="none" stroke="rgba(242,238,225,0.18)" strokeWidth="4"   strokeLinecap="butt" filter="url(#vs-path-glow)" />
          <path ref={(el)=>{refs.current.lo=el;}}     fill="none" stroke="rgba(242,238,225,0.92)" strokeWidth="1.1" strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.li=el;}}     fill="none" stroke="rgba(242,238,225,0.60)" strokeWidth="0.78" strokeLinecap="butt" style={{opacity:0}} />
          <path ref={(el)=>{refs.current.ri=el;}}     fill="none" stroke="rgba(242,238,225,0.55)" strokeWidth="0.78" strokeLinecap="butt" style={{opacity:0}} />

          {/* ∞ crossing accent — fades out */}
          <line ref={(el)=>{refs.current.crossL=el;}} x1="180" y1="413" x2="210" y2="427" stroke="rgba(242,238,225,0.55)" strokeWidth="0.70" />
          <line ref={(el)=>{refs.current.crossR=el;}} x1="210" y1="413" x2="180" y2="427" stroke="rgba(242,238,225,0.55)" strokeWidth="0.70" />

          {/* Heart structural ribs — emerge at t=141 */}
          <line ref={(el)=>{refs.current.ribUL=el;}} x1="106" y1="224" x2="18"  y2="356" stroke="rgba(242,238,225,0.60)" strokeWidth="0.72" style={{opacity:0}} />
          <line ref={(el)=>{refs.current.ribUR=el;}} x1="284" y1="224" x2="372" y2="356" stroke="rgba(242,238,225,0.60)" strokeWidth="0.72" style={{opacity:0}} />
          <line ref={(el)=>{refs.current.ribLL=el;}} x1="82"  y1="480" x2="195" y2="618" stroke="rgba(242,238,225,0.60)" strokeWidth="0.72" style={{opacity:0}} />
          {/* ribLR rendered via FINAL_CNX (dedicated drawn element — skip here) */}
          <path ref={(el)=>{refs.current.notchL=el;}} d={HEART_EXTRA_PATHS.NOTCH_L} fill="none" stroke="rgba(242,238,225,0.50)" strokeWidth="0.65" style={{opacity:0}} />
          <path ref={(el)=>{refs.current.notchR=el;}} d={HEART_EXTRA_PATHS.NOTCH_R} fill="none" stroke="rgba(242,238,225,0.50)" strokeWidth="0.65" style={{opacity:0}} />

          {/* FINAL CONNECTION — drawn deliberately during THE INHALE (2:03–2:17) */}
          {/* Path: lower-right rib → heart bottom point */}
          <path
            ref={(el)=>{refs.current.finalCnx=el;}}
            d={HEART_EXTRA_PATHS.FINAL_CNX}
            fill="none"
            stroke="rgba(242,238,225,0.88)"
            strokeWidth="1"
            strokeLinecap="butt"
          />
          <circle
            ref={(el)=>{refs.current.finalCnxHead=el;}}
            r="3.5"
            fill="rgba(242,238,225,0.95)"
            style={{opacity:0}}
            filter="url(#vs-head-bloom)"
          />

          {/* IGNITION pulse — amber light at REVELATION */}
          <path
            ref={(el)=>{refs.current.ignitionPulse=el;}}
            fill="none"
            stroke="rgba(248,210,108,0.95)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#vs-pulse-bloom)"
          />

          {/* REVELATION BLOOM — large warm glow at heart center (t=141) */}
          <circle
            ref={(el)=>{refs.current.revealBloom=el;}}
            cx="195" cy="450" r="240"
            fill="rgba(195,158,88,0.07)"
            style={{opacity:0}}
            filter="url(#vs-reveal-bloom)"
          />

          {/* ── OUTRO HEART ORBIT DOTS — digital fireworks ─────────────────── */}
          {/* Dot L: left outer lobe orbit */}
          <circle
            ref={(el)=>{refs.current.heartDotL=el;}}
            r="9"
            fill="rgba(248,210,108,0.95)"
            style={{opacity:0}}
            filter="url(#vs-pulse-bloom)"
          />
          {/* Dot R: right outer lobe orbit, 180° offset */}
          <circle
            ref={(el)=>{refs.current.heartDotR=el;}}
            r="9"
            fill="rgba(248,210,108,0.95)"
            style={{opacity:0}}
            filter="url(#vs-pulse-bloom)"
          />
          {/* Dot I: inner arc orbit, faster period */}
          <circle
            ref={(el)=>{refs.current.heartDotI=el;}}
            r="6"
            fill="rgba(248,210,108,0.95)"
            style={{opacity:0}}
            filter="url(#vs-pulse-bloom)"
          />
        </g>

        {/* ═══ 3. Vignette ══════════════════════════════════════════════════ */}
        <radialGradient id="vs-vig" cx="50%" cy="55%" r="60%">
          <stop offset="0%"   stopColor="transparent" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
        </radialGradient>
        <rect width="390" height="844" fill="url(#vs-vig)" style={{pointerEvents:"none"}} />
      </svg>

      {SHOW_UI && (
        <div className="v3simdi__dev">
          {IS_DEMO ? (
            <button type="button" className="v3simdi__dev-btn" onClick={handleDemo}>↺ Demo</button>
          ) : (
            <>
              <button type="button" className="v3simdi__dev-btn" onClick={handlePlayPause}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <input
                type="range" className="v3simdi__dev-seek"
                min="0" max="213" step="1"
                defaultValue="0"
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
              />
            </>
          )}
          <span ref={(el)=>{refs.current.timeDisp=el;}} className="v3simdi__dev-time">
            {FROZEN_T !== null ? FROZEN_T.toFixed(1) + "s" : "0.0s"}
          </span>
        </div>
      )}
    </div>
  );
}
