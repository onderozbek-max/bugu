/**
 * Gate B0 — DÜN 0:00–0:48 authored motion sequence.
 *
 * Route:       ?lab=v2-dun
 * Dev overlay: add &ui=1 (hidden by default — art must stand alone)
 * Screenshot:  add &t=5 to freeze the scene at t=5s (audio won't load in sandbox)
 *
 * Architecture:
 *   React renders the SVG structure ONCE.
 *   A requestAnimationFrame loop reads audio.currentTime and updates all SVG
 *   DOM properties imperatively — zero React re-renders during playback.
 *   All visual state passes through interp() — seeking reconstructs state.
 *
 * DO NOT MODIFY PRODUCTION. DO NOT IMPLEMENT AUDIO REACTIVITY.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  interp,
  PLANE1_TX,    PLANE1_EDGE_OP,
  PLANE2_TY,    PLANE2_OP,
  LETTER_OP,    LETTER_TY,
  TYPE_DUN_OP,
  LYRIC1_OP,    LYRIC2_OP,
  DEEP_OP,      BG_LUMINANCE,
  SEQ_END,
} from "./dunTimeline";
import { AudioEngine } from "../../audio/AudioEngine";
import "./DunSequence.css";

// ── URL configuration ─────────────────────────────────────────────────────────

const _params   = new URLSearchParams(window.location.search);
/** ?t=5  → frozen-frame mode for screenshots (audio won't load in sandbox). */
const FROZEN_T  = _params.get("t") !== null ? parseFloat(_params.get("t")!) : null;
/** ?ui=1 → show dev overlay (play/pause/seek). Hidden by default. */
const SHOW_UI   = _params.get("ui") === "1";

const AUDIO_SRC = "/audio/dun.m4a";

// ── Imperative scene refs ─────────────────────────────────────────────────────

interface SceneRefs {
  plane1:     SVGGElement | null;
  plane1Edge: SVGLineElement | null;
  plane2:     SVGGElement | null;
  letter:     SVGGElement | null;
  typeDun:    SVGTextElement | null;
  lyric1:     SVGGElement | null;
  lyric2:     SVGGElement | null;
  deepSpace:  SVGGElement | null;
  bgBright:   SVGRectElement | null;
  timeDisp:   HTMLSpanElement | null;
}

/** Called every rAF frame — no React state involved. */
function updateScene(t: number, r: SceneRefs): void {
  const ct = Math.max(0, Math.min(t, SEQ_END + 2));

  // Plane 1 — constraining foreground slab
  if (r.plane1) {
    r.plane1.setAttribute("transform", `translate(${interp(ct, PLANE1_TX).toFixed(2)},0)`);
  }
  if (r.plane1Edge) {
    r.plane1Edge.setAttribute("opacity", interp(ct, PLANE1_EDGE_OP).toFixed(4));
  }

  // Plane 2 — second depth element entering from top-right
  if (r.plane2) {
    r.plane2.setAttribute("transform", `translate(0,${interp(ct, PLANE2_TY).toFixed(2)})`);
    r.plane2.setAttribute("opacity", interp(ct, PLANE2_OP).toFixed(4));
  }

  // Large letterform — reads as geometry before typography
  if (r.letter) {
    r.letter.setAttribute("opacity", interp(ct, LETTER_OP).toFixed(4));
    r.letter.setAttribute("transform", `translate(0,${interp(ct, LETTER_TY).toFixed(2)})`);
  }

  // Small "DÜN" (quiet lower-right zone)
  if (r.typeDun) {
    r.typeDun.setAttribute("opacity", interp(ct, TYPE_DUN_OP).toFixed(4));
  }

  // Lyric 1 — "Bir hayatım vardı"
  if (r.lyric1) {
    r.lyric1.setAttribute("opacity", interp(ct, LYRIC1_OP).toFixed(4));
  }

  // Lyric 2 — "kendince güzel"
  if (r.lyric2) {
    r.lyric2.setAttribute("opacity", interp(ct, LYRIC2_OP).toFixed(4));
  }

  // Deep space — hidden beneath Plane 1, revealed at t=43
  if (r.deepSpace) {
    r.deepSpace.setAttribute("opacity", interp(ct, DEEP_OP).toFixed(4));
  }

  // Background luminance lift (subtle, at reveal)
  if (r.bgBright) {
    r.bgBright.setAttribute("opacity", interp(ct, BG_LUMINANCE).toFixed(4));
  }

  // Dev time display (imperative, no React re-render)
  if (r.timeDisp) {
    r.timeDisp.textContent = ct.toFixed(1) + "s";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DunSequence() {
  const refs = useRef<SceneRefs>({
    plane1: null, plane1Edge: null,
    plane2: null,
    letter: null,
    typeDun: null,
    lyric1: null, lyric2: null,
    deepSpace: null,
    bgBright: null,
    timeDisp: null,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const rafId = useRef<number>(0);

  // ── Audio setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = AudioEngine.element;
    el.src    = AUDIO_SRC;
    el.preload = "auto";
    el.loop   = false;

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

  // ── Animation loop — reads audio.currentTime or frozen ?t= param ───────────
  useEffect(() => {
    function loop() {
      // Read the LIVE HTMLAudioElement time (not AudioEngine's snapshotted getter)
      const rawT = AudioEngine.element.currentTime;
      const t    = FROZEN_T !== null ? FROZEN_T : rawT;
      updateScene(t, refs.current);
      rafId.current = requestAnimationFrame(loop);
    }
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  // ── Dev controls ─────────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    const el = AudioEngine.element;
    if (el.paused) { el.play().catch(() => {}); }
    else           { el.pause(); }
  }, []);

  const handleSeek = useCallback((v: number) => {
    AudioEngine.element.currentTime = v;
  }, []);

  const handleRestart = useCallback(() => {
    AudioEngine.element.currentTime = 0;
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="dun48">
      <svg
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        className="dun48__svg"
        aria-hidden="true"
      >
        <defs>
          {/* Film grain — static fractal noise, very subtle */}
          <filter id="d48-grain" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="4"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
            <feBlend in="SourceGraphic" in2="gray" mode="overlay" result="blended" />
            <feComposite in="blended" in2="SourceGraphic" operator="in" />
          </filter>

          {/* Edge glow — fine luminous halo on thin lines */}
          <filter id="d48-glow" x="-80%" y="-20%" width="260%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Warm gradient on Plane 1 — subtle brightening toward its right edge */}
          <linearGradient id="d48-p1-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"    stopColor="#090809" />
            <stop offset="70%"   stopColor="#0c0a09" />
            <stop offset="90%"   stopColor="#121008" />
            <stop offset="100%"  stopColor="#181410" />
          </linearGradient>

          {/* Warm light source in the deep space (implies what lit Plane 1's edge) */}
          <radialGradient id="d48-src-glow" cx="5%" cy="50%" r="70%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="rgba(175,145,95,0.14)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>

          {/* Vignette */}
          <radialGradient id="d48-vig" cx="50%" cy="50%" r="65%">
            <stop offset="0%"   stopColor="transparent" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.58" />
          </radialGradient>
        </defs>

        {/* ══ 0. Base background ═══════════════════════════════════════════════ */}
        <rect width="390" height="844" fill="#07060a" />

        {/* ══ 1. Luminance lift (barely perceptible at reveal) ════════════════ */}
        <rect
          ref={(el) => { refs.current.bgBright = el; }}
          width="390" height="844"
          fill="rgba(255,248,235,0.06)"
          opacity="0"
          style={{ pointerEvents: "none" }}
        />

        {/* ══ 2. Deep space — always rendered, exposed at t=43 ════════════════
              A different kind of space: cool temperature, multiple planes at
              different scales (depth through scale contrast), first visible
              spectral color (teal edge), much more negative space.
        ════════════════════════════════════════════════════════════════════════ */}
        <g
          ref={(el) => { refs.current.deepSpace = el; }}
          opacity="0"
        >
          {/* Warm light source halo (was always there, now visible) */}
          <rect x="-10" y="0" width="230" height="844" fill="url(#d48-src-glow)" />

          {/* Mid plane — cool blue-gray, lower-left, mid-distance */}
          <polygon
            points="0,318 188,272 162,844 0,844"
            fill="#0a0c15"
          />
          {/* Mid plane: diagonal luminous edge — cool blue */}
          <line
            x1="188" y1="272" x2="162" y2="844"
            stroke="rgba(108,142,190,0.52)"
            strokeWidth="1.3"
            filter="url(#d48-glow)"
          />
          {/* Mid plane: top edge — subtly warmer (suggests light source direction) */}
          <line
            x1="0" y1="318" x2="188" y2="272"
            stroke="rgba(148,122,88,0.28)"
            strokeWidth="0.75"
          />

          {/* Far plane — upper right, dramatically SMALLER than mid plane.
              Scale contrast = implied distance. A different order of magnitude. */}
          <polygon
            points="240,68 362,52 350,208 228,224"
            fill="#090b12"
          />
          {/* Far plane: spectral teal edge — FIRST color in the entire sequence */}
          <line
            x1="240" y1="68" x2="362" y2="52"
            stroke="rgba(68,158,152,0.44)"
            strokeWidth="1.0"
            filter="url(#d48-glow)"
          />
          {/* Far plane: left edge — cool blue, dim */}
          <line
            x1="240" y1="68" x2="228" y2="224"
            stroke="rgba(92,128,175,0.30)"
            strokeWidth="0.70"
          />

          {/* Additional thin line in mid zone — implies further depth layers */}
          <line
            x1="38" y1="524" x2="162" y2="482"
            stroke="rgba(110,138,178,0.26)"
            strokeWidth="0.65"
          />

          {/* Very distant trace — upper left, near-invisible (extreme distance) */}
          <line
            x1="18" y1="138" x2="82" y2="130"
            stroke="rgba(88,115,152,0.20)"
            strokeWidth="0.55"
          />
        </g>

        {/* ══ 3. Large letterform: "DÜN" at 360px — cropped by viewport ════════
              Positioned so Plane 1 hides the "D" and left portion of "Ü".
              Right portion of "Ü" + beginning of "N" visible in the void.
              At this scale, letterform curves read as pure geometry first.
              As Plane 1 advances (tension), the text is progressively consumed.
        ════════════════════════════════════════════════════════════════════════ */}
        <g
          ref={(el) => { refs.current.letter = el; }}
          opacity="0"
        >
          {/* Letter body — very dark, slightly warm surface */}
          <text
            x="-115"
            y="720"
            fontSize="360"
            fontFamily="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif"
            fontWeight="200"
            fill="#0f0d0a"
          >
            DÜN
          </text>
          {/* Faint rim light on letterform — just enough to confirm the surface */}
          <text
            x="-115"
            y="720"
            fontSize="360"
            fontFamily="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif"
            fontWeight="200"
            fill="none"
            stroke="rgba(168,145,110,0.16)"
            strokeWidth="0.8"
          >
            DÜN
          </text>
        </g>

        {/* ══ 4. Plane 2: second structural plane entering from top-right ════════
              Oriented differently from Plane 1 — creates depth through occlusion.
              Its diagonal left edge partially covers the large letterform.
              Cool temperature — immediately distinguishable from Plane 1's warmth.
        ════════════════════════════════════════════════════════════════════════ */}
        <g
          ref={(el) => { refs.current.plane2 = el; }}
          opacity="0"
          transform="translate(0,-530)"
        >
          {/* Surface — slightly cool */}
          <polygon
            points="80,-100 435,-100 435,520 202,520"
            fill="#0b0d12"
          />
          {/* Luminous diagonal left edge — cool mineral blue */}
          <line
            x1="80" y1="-100" x2="202" y2="520"
            stroke="rgba(112,148,190,0.60)"
            strokeWidth="1.4"
            filter="url(#d48-glow)"
          />
        </g>

        {/* ══ 5. Plane 1: the constraining foreground slab ════════════════════
              The primary structural element. Its right edge is the thin line
              of warm light we see first. The plane is enormous — we only ever
              see its edge and the surface immediately around it.
              As tension builds, the plane advances rightward until it covers
              94% of the frame. At t=43, it exits left at velocity.
        ════════════════════════════════════════════════════════════════════════ */}
        <g ref={(el) => { refs.current.plane1 = el; }}>
          {/* Surface — warm gradient brightening toward the right edge */}
          <polygon
            points="-10,-50 215,-50 209,894 -10,894"
            fill="url(#d48-p1-grad)"
          />
          {/* Luminous right edge — warm mineral, the only light in Shot 1 */}
          <line
            ref={(el) => { refs.current.plane1Edge = el; }}
            x1="215" y1="-50"
            x2="209" y2="894"
            stroke="rgba(190,165,130,0.80)"
            strokeWidth="1.5"
            opacity="0"
            filter="url(#d48-glow)"
          />
        </g>

        {/* ══ 6. Small "DÜN" typography — quiet lower-right zone ══════════════ */}
        <text
          ref={(el) => { refs.current.typeDun = el; }}
          x="258"
          y="768"
          fontSize="9"
          fontFamily="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif"
          fontWeight="400"
          fill="rgba(215,205,188,0.68)"
          opacity="0"
          style={{ letterSpacing: "0.28em" }}
        >
          DÜN
        </text>

        {/* ══ 7. Lyric 1: "Bir hayatım vardı" ════════════════════════════════ */}
        <g
          ref={(el) => { refs.current.lyric1 = el; }}
          opacity="0"
        >
          <text
            x="238"
            y="388"
            fontSize="13.5"
            fontFamily="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif"
            fontWeight="300"
            fill="rgba(215,205,190,0.82)"
            style={{ letterSpacing: "0.04em" }}
          >
            Bir hayatım vardı
          </text>
        </g>

        {/* ══ 8. Lyric 2: "kendince güzel" ════════════════════════════════════
              Appears at t=35.5. By t≈38 the advancing Plane 1 edge (x≈295+)
              physically swallows the text — the advancing darkness is the effect.
        ════════════════════════════════════════════════════════════════════════ */}
        <g
          ref={(el) => { refs.current.lyric2 = el; }}
          opacity="0"
        >
          <text
            x="295"
            y="572"
            fontSize="13"
            fontFamily="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif"
            fontWeight="300"
            fill="rgba(215,205,190,0.76)"
            style={{ letterSpacing: "0.04em" }}
          >
            kendince güzel
          </text>
        </g>

        {/* ══ 9. Film grain — static, very subtle ═════════════════════════════ */}
        <rect
          width="390" height="844"
          fill="rgba(255,255,255,0.038)"
          filter="url(#d48-grain)"
          style={{ pointerEvents: "none" }}
        />

        {/* ══ 10. Vignette ════════════════════════════════════════════════════ */}
        <rect
          width="390" height="844"
          fill="url(#d48-vig)"
          style={{ pointerEvents: "none" }}
        />
      </svg>

      {/* ── Dev overlay — hidden unless ?ui=1 ──────────────────────────────── */}
      {SHOW_UI && (
        <div className="dun48__dev">
          <button
            type="button"
            className="dun48__dev-btn"
            onClick={handlePlayPause}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <input
            type="range"
            className="dun48__dev-seek"
            min="0"
            max={SEQ_END}
            step="0.5"
            defaultValue="0"
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
          />
          <span
            ref={(el) => { refs.current.timeDisp = el; }}
            className="dun48__dev-time"
          >
            {FROZEN_T !== null ? FROZEN_T.toFixed(1) + "s" : "0.0s"}
          </span>
          <button
            type="button"
            className="dun48__dev-btn"
            onClick={handleRestart}
          >
            ↺
          </button>
        </div>
      )}
    </div>
  );
}
