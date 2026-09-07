/**
 * V3 YARIN — Key → ∞ morph renderer.
 * Full song: 0:00–3:52
 *
 * Route: ?lab=v3-yarin
 * Demo:  ?lab=v3-yarin&demo=1
 * Still: ?lab=v3-yarin&t=90
 * UI:    ?lab=v3-yarin&t=90&ui=1
 *
 * Architecture:
 *   Starts with the completed DÜN key (all paths in key pose, morph=0).
 *   Per-frame morphT from interp() drives lerpCoords() → setAttribute("d").
 *   Key extras fade out via opacity. ∞ extras fade in via opacity.
 *   No stroke-dasharray drawing — all paths are pre-drawn from DÜN's end state.
 *   Zero React re-renders per frame (fully imperative rAF loop).
 *
 * Depth system:
 *   BACK layer:  RO (right outer arc), SP (spine/shaft morph)
 *   TEXT layer:  "SENİNLE DOLU HER YER"
 *   FRONT layer: LO, LI, RI, key extras (fading), ∞ extras (emerging), pulses
 *
 * Outro (t=214–232):
 *   Two amber dots orbit the two ∞ loop ellipses continuously.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getSceneTime, resetDemoClock, IS_DEMO, FROZEN_T,
  interp,
  KEY_COORDS, INF_COORDS,
  KEY_EXTRA_PATHS,
  lerpCoords, build2C, buildL,
  MORPH_KF, KEY_EXT_OP, INNER_OP, INF_EXT_OP,
  CHORUS_TYP_OP, CHORUS_CLIP,
  PEAK_PULSE_POS, PEAK_PULSE_OP,
  OUTRO_LEFT_CX, OUTRO_LEFT_CY,
  OUTRO_RIGHT_CX, OUTRO_RIGHT_CY,
  OUTRO_RX, OUTRO_RY,
} from "./v3yarinTimeline";
import { AudioEngine } from "../../audio/AudioEngine";
import "./V3YarinRenderer.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const _params = new URLSearchParams(window.location.search);
const SHOW_UI     = _params.get("ui") === "1";
const AUDIO_SRC   = "/audio/yarin.m4a";
const IS_STANDALONE = _params.get("lab") !== "v3-journey";

const PULSE_LEN     = 52;   // amber streak length (px)
const CHORUS_CLIP_W = 380;  // px — clip for "SENİNLE DOLU HER YER"

// ── Refs ──────────────────────────────────────────────────────────────────────

interface Refs {
  // BACK — morphing paths
  ro:       SVGPathElement | null;
  roGlow:   SVGPathElement | null;
  sp:       SVGPathElement | null;
  // FRONT — morphing paths
  lo:       SVGPathElement | null;
  loGlow:   SVGPathElement | null;
  li:       SVGPathElement | null;
  ri:       SVGPathElement | null;
  // Key extras (static paths, fade out)
  ribUL:    SVGPathElement | null;
  ribUR:    SVGPathElement | null;
  ribLL:    SVGPathElement | null;
  ribLR:    SVGPathElement | null;
  notchL:   SVGPathElement | null;
  notchR:   SVGPathElement | null;
  tooth1:   SVGPathElement | null;
  tooth2:   SVGPathElement | null;
  tooth3:   SVGPathElement | null;
  shaftCap: SVGPathElement | null;
  // ∞ extras (static paths, fade in)
  crossL:   SVGPathElement | null;
  crossR:   SVGPathElement | null;
  // Pulse at peak
  peakPulse: SVGPathElement | null;
  // Outro orbit dots (circles, parametric)
  orbitL:   SVGCircleElement | null;
  orbitR:   SVGCircleElement | null;
  // Typography clip + group
  chorusClip: SVGRectElement | null;
  chorusGroup: SVGGElement | null;
  // Dev
  timeDisp: HTMLSpanElement | null;
}

interface Lengths {
  [key: string]: number;
  peakPulse: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setPulse(el: SVGPathElement | null, pos: number, opacity: number, totalLen: number): void {
  if (!el) return;
  el.style.strokeDashoffset = `${-(pos * (totalLen - PULSE_LEN))}`;
  el.style.opacity = `${opacity}`;
}

function setAttr(el: SVGPathElement | null, d: string): void {
  if (!el) return;
  el.setAttribute("d", d);
}

function setOp(el: SVGElement | null, op: number): void {
  if (!el) return;
  el.style.opacity = `${op}`;
}

// ── Scene update ──────────────────────────────────────────────────────────────

function updateScene(t: number, r: Refs, L: Lengths): void {
  const ct = Math.max(0, t);

  // ── Morph all primary paths ────────────────────────────────────────────────
  const morphT = interp(ct, MORPH_KF);

  const lo = lerpCoords(KEY_COORDS.lo, INF_COORDS.lo, morphT);
  const ro = lerpCoords(KEY_COORDS.ro, INF_COORDS.ro, morphT);
  const li = lerpCoords(KEY_COORDS.li, INF_COORDS.li, morphT);
  const ri = lerpCoords(KEY_COORDS.ri, INF_COORDS.ri, morphT);
  const sp = lerpCoords(KEY_COORDS.sp, INF_COORDS.sp, morphT);

  const loD = build2C(lo);
  const roD = build2C(ro);
  const spD = buildL(sp);

  setAttr(r.lo,     loD);
  setAttr(r.loGlow, loD);
  setAttr(r.ro,     roD);
  setAttr(r.roGlow, roD);
  setAttr(r.li,     build2C(li));
  setAttr(r.ri,     build2C(ri));
  setAttr(r.sp,     spD);

  // ── Key extras — fade out ─────────────────────────────────────────────────
  const keyOp = interp(ct, KEY_EXT_OP);
  const keyExtEls = [
    r.ribUL, r.ribUR, r.ribLL, r.ribLR,
    r.notchL, r.notchR,
    r.tooth1, r.tooth2, r.tooth3,
    r.shaftCap,
  ];
  for (const el of keyExtEls) setOp(el, keyOp);

  // ── Inner arcs — fade out ─────────────────────────────────────────────────
  const innerOp = interp(ct, INNER_OP);
  setOp(r.li, innerOp);
  setOp(r.ri, innerOp);

  // ── ∞ extras — fade in ────────────────────────────────────────────────────
  const infOp = interp(ct, INF_EXT_OP);
  setOp(r.crossL, infOp);
  setOp(r.crossR, infOp);

  // ── Peak pulse (amber sweep at YARIN resolution, t=214) ───────────────────
  // Pulse uses current LO path (which is now ∞ pose at morph=1.0)
  // Update pulse path to match morphed LO
  if (r.peakPulse) r.peakPulse.setAttribute("d", loD);
  const peakPos = interp(ct, PEAK_PULSE_POS);
  const peakOp  = interp(ct, PEAK_PULSE_OP);
  setPulse(r.peakPulse, peakPos, peakOp, L.peakPulse);

  // ── Typography: SENİNLE DOLU HER YER ─────────────────────────────────────
  const typOp  = interp(ct, CHORUS_TYP_OP);
  const clipW  = interp(ct, CHORUS_CLIP) * CHORUS_CLIP_W;
  if (r.chorusClip) {
    r.chorusClip.setAttribute("width", clipW.toFixed(1));
  }
  if (r.chorusGroup) {
    r.chorusGroup.style.opacity = typOp > 0.01 ? `${typOp}` : "0";
  }

  // ── OUTRO ORBIT DOTS ──────────────────────────────────────────────────────
  // Two amber dots orbiting the two ∞ loop ellipses. Active t=214–232.
  {
    const OUTRO_START = 214;
    const SONG_END    = 232.2;
    const PERIOD      = 12;

    const outroOp =
      ct < OUTRO_START        ? 0 :
      ct < OUTRO_START + 5    ? ((ct - OUTRO_START) / 5) * 0.88 :
      ct < SONG_END - 5       ? 0.88 :
      ct < SONG_END           ? ((SONG_END - ct) / 5) * 0.88 : 0;

    if (outroOp > 0.01) {
      const phase = ((ct - OUTRO_START) % PERIOD) / PERIOD;
      const a = 2 * Math.PI * phase;

      // Left loop dot (orbits left ∞ loop ellipse)
      if (r.orbitL) {
        r.orbitL.setAttribute("cx", (OUTRO_LEFT_CX  + OUTRO_RX * Math.sin(a)).toFixed(1));
        r.orbitL.setAttribute("cy", (OUTRO_LEFT_CY  - OUTRO_RY * Math.cos(a)).toFixed(1));
        r.orbitL.style.opacity = `${outroOp}`;
      }
      // Right loop dot — 180° offset, orbits right ∞ loop ellipse
      const a2 = a + Math.PI;
      if (r.orbitR) {
        r.orbitR.setAttribute("cx", (OUTRO_RIGHT_CX + OUTRO_RX * Math.sin(a2)).toFixed(1));
        r.orbitR.setAttribute("cy", (OUTRO_RIGHT_CY - OUTRO_RY * Math.cos(a2)).toFixed(1));
        r.orbitR.style.opacity = `${outroOp * 0.88}`;
      }
    } else {
      setOp(r.orbitL, 0);
      setOp(r.orbitR, 0);
    }
  }

  // ── Dev overlay ───────────────────────────────────────────────────────────
  if (r.timeDisp) {
    r.timeDisp.textContent = ct.toFixed(1) + "s";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function V3YarinRenderer() {
  const refs = useRef<Refs>({
    ro: null, roGlow: null, sp: null,
    lo: null, loGlow: null, li: null, ri: null,
    ribUL: null, ribUR: null, ribLL: null, ribLR: null,
    notchL: null, notchR: null,
    tooth1: null, tooth2: null, tooth3: null, shaftCap: null,
    crossL: null, crossR: null,
    peakPulse: null,
    orbitL: null, orbitR: null,
    chorusClip: null, chorusGroup: null,
    timeDisp: null,
  });

  const lengths = useRef<Lengths>({ peakPulse: 350 });
  const rafId   = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── After mount: compute initial path strings (key pose), init peakPulse ──
  useEffect(() => {
    const r = refs.current;
    const L = lengths.current;

    // Render all paths at morph=0 (key pose)
    const loD = build2C([...KEY_COORDS.lo]);
    const roD = build2C([...KEY_COORDS.ro]);
    if (r.lo)     r.lo.setAttribute("d", loD);
    if (r.loGlow) r.loGlow.setAttribute("d", loD);
    if (r.ro)     r.ro.setAttribute("d", roD);
    if (r.roGlow) r.roGlow.setAttribute("d", roD);
    if (r.li)     r.li.setAttribute("d", build2C([...KEY_COORDS.li]));
    if (r.ri)     r.ri.setAttribute("d", build2C([...KEY_COORDS.ri]));
    if (r.sp)     r.sp.setAttribute("d", buildL([...KEY_COORDS.sp]));

    // peakPulse: init dasharray for amber peak pulse (uses LO arc path)
    if (r.peakPulse) {
      const len = r.peakPulse.getTotalLength();
      L.peakPulse = len;
      r.peakPulse.style.strokeDasharray = `${PULSE_LEN} ${len}`;
      r.peakPulse.style.strokeDashoffset = `${len}`;
      r.peakPulse.style.opacity = "0";
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
    <div className="v3yarin">
      <svg
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        className="v3yarin__svg"
        aria-hidden="true"
      >
        <defs>
          {/* Head / path glow — tight bloom */}
          <filter id="vy-path-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
            </feMerge>
          </filter>

          {/* Pulse bloom — wide warm amber glow */}
          <filter id="vy-pulse-bloom" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Junction bloom — very wide */}
          <filter id="vy-junction-bloom" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Chorus text clip — left-to-right wipe */}
          <clipPath id="vy-chorus-clip">
            <rect
              ref={(el) => { refs.current.chorusClip = el; }}
              x="8" y="596" width="0" height="42"
            />
          </clipPath>
        </defs>

        {/* ═══ 0. Background ════════════════════════════════════════════════ */}
        <rect width="390" height="844" fill="#010101" />

        {/* ═══ 1. BACK LAYER — RO, SP ═══════════════════════════════════════ */}
        <g>
          {/* RO glow */}
          <path
            ref={(el) => { refs.current.roGlow = el; }}
            fill="none"
            stroke="rgba(242,238,225,0.16)"
            strokeWidth="3.5"
            strokeLinecap="butt"
            filter="url(#vy-path-glow)"
          />
          {/* RO crisp */}
          <path
            ref={(el) => { refs.current.ro = el; }}
            fill="none"
            stroke="rgba(242,238,225,0.80)"
            strokeWidth="1"
            strokeLinecap="butt"
          />
          {/* SP — spine / shaft (morphs key shaft → ∞ center mark) */}
          <path
            ref={(el) => { refs.current.sp = el; }}
            fill="none"
            stroke="rgba(242,238,225,0.72)"
            strokeWidth="0.9"
            strokeLinecap="butt"
          />
        </g>

        {/* ═══ 2. TYPOGRAPHY LAYER ═══════════════════════════════════════════
              Protected zone: y=596–640, x=12–377. Geometry stays clear.
        ════════════════════════════════════════════════════════════════════ */}
        <g
          ref={(el) => { refs.current.chorusGroup = el; }}
          style={{ opacity: 0 }}
        >
          <text
            clipPath="url(#vy-chorus-clip)"
            x="8"
            y="624"
            fontFamily="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif"
            fontWeight="200"
            fontSize="18"
            fill="rgba(242,238,225,0.90)"
            style={{ letterSpacing: "0.18em" }}
          >
            SENİNLE DOLU HER YER
          </text>
        </g>

        {/* ═══ 3. FRONT LAYER ════════════════════════════════════════════════ */}
        <g>
          {/* LO glow */}
          <path
            ref={(el) => { refs.current.loGlow = el; }}
            fill="none"
            stroke="rgba(242,238,225,0.18)"
            strokeWidth="4"
            strokeLinecap="butt"
            filter="url(#vy-path-glow)"
          />
          {/* LO primary arc */}
          <path
            ref={(el) => { refs.current.lo = el; }}
            fill="none"
            stroke="rgba(242,238,225,0.92)"
            strokeWidth="1.1"
            strokeLinecap="butt"
          />
          {/* LI inner arc (fades out) */}
          <path
            ref={(el) => { refs.current.li = el; }}
            fill="none"
            stroke="rgba(242,238,225,0.60)"
            strokeWidth="0.75"
            strokeLinecap="butt"
          />
          {/* RI inner arc (fades out) */}
          <path
            ref={(el) => { refs.current.ri = el; }}
            fill="none"
            stroke="rgba(242,238,225,0.55)"
            strokeWidth="0.75"
            strokeLinecap="butt"
          />

          {/* ── Key extras — fade out ──────────────────────────────────────── */}
          <path ref={(el)=>{refs.current.ribUL=el;}}   d={KEY_EXTRA_PATHS.RIB_UL}   fill="none" stroke="rgba(242,238,225,0.62)" strokeWidth="0.75" strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.ribUR=el;}}   d={KEY_EXTRA_PATHS.RIB_UR}   fill="none" stroke="rgba(242,238,225,0.62)" strokeWidth="0.75" strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.ribLL=el;}}   d={KEY_EXTRA_PATHS.RIB_LL}   fill="none" stroke="rgba(242,238,225,0.78)" strokeWidth="0.85" strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.ribLR=el;}}   d={KEY_EXTRA_PATHS.RIB_LR}   fill="none" stroke="rgba(242,238,225,0.78)" strokeWidth="0.85" strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.notchL=el;}}  d={KEY_EXTRA_PATHS.NOTCH_L}  fill="none" stroke="rgba(242,238,225,0.55)" strokeWidth="0.70" strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.notchR=el;}}  d={KEY_EXTRA_PATHS.NOTCH_R}  fill="none" stroke="rgba(242,238,225,0.55)" strokeWidth="0.70" strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.tooth1=el;}}  d={KEY_EXTRA_PATHS.TOOTH_1}  fill="none" stroke="rgba(242,238,225,0.82)" strokeWidth="1.0"  strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.tooth2=el;}}  d={KEY_EXTRA_PATHS.TOOTH_2}  fill="none" stroke="rgba(242,238,225,0.82)" strokeWidth="1.0"  strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.tooth3=el;}}  d={KEY_EXTRA_PATHS.TOOTH_3}  fill="none" stroke="rgba(242,238,225,0.82)" strokeWidth="1.0"  strokeLinecap="butt" />
          <path ref={(el)=>{refs.current.shaftCap=el;}} d={KEY_EXTRA_PATHS.SHAFT_CAP} fill="none" stroke="rgba(242,238,225,0.72)" strokeWidth="0.85" strokeLinecap="butt" />

          {/* ── ∞ extras — crossing accent (fade in) ──────────────────────── */}
          <line
            ref={(el) => { refs.current.crossL = el as unknown as SVGPathElement; }}
            x1="180" y1="413" x2="210" y2="427"
            stroke="rgba(242,238,225,0.55)" strokeWidth="0.70"
            style={{ opacity: 0 }}
          />
          <line
            ref={(el) => { refs.current.crossR = el as unknown as SVGPathElement; }}
            x1="210" y1="413" x2="180" y2="427"
            stroke="rgba(242,238,225,0.55)" strokeWidth="0.70"
            style={{ opacity: 0 }}
          />

          {/* Peak pulse — amber sweep through LO at YARIN resolution */}
          <path
            ref={(el) => { refs.current.peakPulse = el; }}
            fill="none"
            stroke="rgba(248,210,108,0.95)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#vy-pulse-bloom)"
          />

          {/* Outro orbit dots — two amber circles on ∞ loop ellipses */}
          <circle
            ref={(el) => { refs.current.orbitL = el; }}
            r="9"
            fill="rgba(248,210,108,0.95)"
            style={{ opacity: 0 }}
            filter="url(#vy-pulse-bloom)"
          />
          <circle
            ref={(el) => { refs.current.orbitR = el; }}
            r="9"
            fill="rgba(248,210,108,0.95)"
            style={{ opacity: 0 }}
            filter="url(#vy-pulse-bloom)"
          />
        </g>

        {/* ═══ 4. Vignette ══════════════════════════════════════════════════ */}
        <radialGradient id="vy-vig" cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor="transparent" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
        <rect width="390" height="844" fill="url(#vy-vig)" style={{ pointerEvents: "none" }} />
      </svg>

      {/* Dev overlay */}
      {SHOW_UI && (
        <div className="v3yarin__dev">
          {IS_DEMO ? (
            <button type="button" className="v3yarin__dev-btn" onClick={handleDemo}>↺ Demo</button>
          ) : (
            <>
              <button type="button" className="v3yarin__dev-btn" onClick={handlePlayPause}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <input
                type="range" className="v3yarin__dev-seek"
                min="0" max="232" step="1"
                defaultValue="0"
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
              />
            </>
          )}
          <span
            ref={(el) => { refs.current.timeDisp = el; }}
            className="v3yarin__dev-time"
          >
            {FROZEN_T !== null ? FROZEN_T.toFixed(1) + "s" : "0.0s"}
          </span>
        </div>
      )}
    </div>
  );
}
