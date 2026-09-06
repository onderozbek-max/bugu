import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { EASE, prefersReducedMotion } from "../lib/motionPrefs";
import "./PersistentWorld.css";

/**
 * REFRACTION SYSTEM (prototype).
 *
 * There is no depicted object — no line, no horizon, no glass pane, no
 * water. What exists is a small field of soft ambient light forms ("pools")
 * and an invisible optical field that displaces them (SVG
 * feTurbulence -> feDisplacementMap). The displacement map itself is never
 * rendered; only its effect on the light is visible — space and light are
 * being bent, not "a distortion effect" being shown off.
 *
 * Two fixed-frequency displacement filters exist simultaneously
 * (#refr-tight: high frequency, small-scale, local warps — DÜN's close,
 * uneven, overlapping misalignment; #refr-broad: low frequency, large-scale,
 * slow warps — YARIN's broad, dimensional bending) and are cross-faded by
 * opacity as `openness` changes. This avoids re-tweening feTurbulence's
 * baseFrequency every frame, which regenerates the whole noise map and
 * drops frames on a phone — only each filter's feDisplacementMap `scale`
 * attribute is tweened imperatively, once per frame, exactly like the CSS
 * custom properties below.
 *
 * A third, much smaller filter (#refr-fine) exists for chrome elements that
 * must stay optically "of this world" without ever losing hit-test
 * precision (see ProgressBar) — its scale is hard-capped at ~2px.
 */
export type WorldPhase = "opening" | "dun" | "yarin" | "convergence" | "presence" | "album";

interface WorldTarget {
  /** 0..1 — how tightly the light pools cluster/overlap. High = DÜN's
   * compressed, layered closeness. Low = real negative space opening up. */
  crowd: number;
  /** 0..1 — how large/far-apart the pools sit; the primary "the world gets
   * bigger" mechanism (paired with parallax), not brightness. */
  spread: number;
  /** 0..1 — normalized overall displacement strength (mapped to px). */
  scale: number;
  /** 0..1 — blend from the tight/local filter (0) to the broad/slow filter
   * (1). Not a proxy for "clarity" — DÜN and YARIN are both fully
   * displaced, just by optically different fields. */
  openness: number;
  /** 0..1 — how differently near/far pools move during ambient drift.
   * Near-zero = flat, everything moves together (DÜN's compressed depth).
   * High = real parallax differential (YARIN's dimensionality). */
  parallax: number;
  /** seconds — duration of the slowest ambient drift loop. */
  driftSeconds: number;
  /** 0..1 — 0 leans dusk, 1 leans dawn. A secondary cue only: every phase
   * must still read as distinct with this stripped to grayscale. */
  tone: number;
  /** 0..1 — how far the world has settled toward ŞİMDİ's stillness/near-
   * alignment. Pulls `scale` toward its floor and quiets drift/parallax. */
  resolve: number;
}

const TARGETS: Record<WorldPhase, WorldTarget> = {
  opening: {
    crowd: 0.24,
    spread: 0.2,
    scale: 0.4,
    openness: 0.18,
    parallax: 0.1,
    driftSeconds: 220,
    tone: 0,
    resolve: 0.1,
  },
  dun: {
    // Local, frequent, uneven displacement; compressed apparent depth;
    // pools overlap/misalign; close and unresolved.
    crowd: 0.82,
    spread: 0.2,
    scale: 0.64,
    openness: 0.06,
    parallax: 0.08,
    driftSeconds: 170,
    tone: 0,
    resolve: 0,
  },
  yarin: {
    // The spatially most expansive chapter: pools separate and grow (spread)
    // and move at genuinely different rates (parallax) — real dimensionality,
    // not brightness. Distortion itself turns broad and slow (openness high)
    // rather than weak.
    crowd: 0.2,
    spread: 0.94,
    scale: 0.5,
    openness: 0.92,
    parallax: 0.88,
    driftSeconds: 85,
    tone: 1,
    resolve: 0,
  },
  convergence: {
    crowd: 0.36,
    spread: 0.52,
    scale: 0.3,
    // Matches YARIN's own openness (this phase transitions FROM yarin) —
    // settling is carried by crowd/spread/scale/resolve dropping instead,
    // so the tight layer's ghost stays as faint as it already was in YARIN
    // rather than becoming a second, separately-tuned double-image risk.
    openness: 0.92,
    parallax: 0.4,
    driftSeconds: 200,
    tone: 1,
    resolve: 0.6,
  },
  presence: {
    // Convergence and presence: displacement resolves toward near-perfect
    // alignment, complexity/apparent depth simplifies, motion quiets.
    // Pulled back from YARIN's widest reach — presence is immediate, not
    // vast; bigger is not the point here.
    crowd: 0.07,
    spread: 0.34,
    scale: 0.05,
    openness: 0.5,
    parallax: 0.12,
    driftSeconds: 340,
    tone: 0.5,
    resolve: 1,
  },
  album: {
    crowd: 0.16,
    spread: 0.4,
    scale: 0.28,
    openness: 0.5,
    parallax: 0.3,
    driftSeconds: 240,
    tone: 0.5,
    resolve: 0.2,
  },
};

const TWEEN_SECONDS: Record<WorldPhase, number> = {
  opening: 0,
  dun: 2.4,
  yarin: 7,
  convergence: 9,
  presence: 6,
  album: 3,
};

const ALBUM_SWITCH_SECONDS = 2.4;

/**
 * px ceilings `scale` (1.0) maps to — DIFFERENT per filter, and each must
 * stay well under its own noise wavelength (~1/baseFrequency), or
 * feDisplacementMap resamples the source at an incoherent offset relative
 * to the noise's own grain and reads as static/noise rather than a warp.
 * refr-tight: baseFrequency 0.022 -> wavelength ~45px -> ceiling 16px (~36%).
 * refr-broad: baseFrequency 0.007 -> wavelength ~143px -> ceiling 60px (~42%).
 * Both were previously sharing one 64px ceiling regardless of frequency —
 * fine for the broad filter (32px vs a ~143px wavelength was coherent) but
 * DÜN's tight filter was pushed to ~41px against a ~19px wavelength, well
 * past the point of coherent warping.
 */
const TIGHT_MAX_DISPLACEMENT_PX = 16;
const BROAD_MAX_DISPLACEMENT_PX = 60;
/** px — hard cap for the fine filter used by in-world chrome (ProgressBar's
 * decorative echo). Was 2px, which at DÜN's scale worked out to ~1.8px on
 * a 2px-tall track — up to 90% of the track's own height, reading as
 * eroded/broken rather than "slightly alive." 0.6px keeps it a subtle
 * wobble, well under both hit-test tolerance and the track's own height. */
const MAX_FINE_DISPLACEMENT_PX = 0.6;

export function PersistentWorld({ phase, fast }: { phase: WorldPhase; fast?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<WorldTarget>(TARGETS[phase]);
  const tightMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const broadMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const fineMapRef = useRef<SVGFEDisplacementMapElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const style = el.style;
    const reduced = prefersReducedMotion();
    const from = currentRef.current;
    const to = TARGETS[phase];
    const duration = reduced ? 0 : fast ? ALBUM_SWITCH_SECONDS : TWEEN_SECONDS[phase];

    const controls = animate(0, 1, {
      duration,
      ease: EASE,
      onUpdate: (p) => {
        const next: WorldTarget = {
          crowd: from.crowd + (to.crowd - from.crowd) * p,
          spread: from.spread + (to.spread - from.spread) * p,
          scale: from.scale + (to.scale - from.scale) * p,
          openness: from.openness + (to.openness - from.openness) * p,
          parallax: from.parallax + (to.parallax - from.parallax) * p,
          driftSeconds: from.driftSeconds + (to.driftSeconds - from.driftSeconds) * p,
          tone: from.tone + (to.tone - from.tone) * p,
          resolve: from.resolve + (to.resolve - from.resolve) * p,
        };
        style.setProperty("--w-crowd", next.crowd.toFixed(4));
        style.setProperty("--w-spread", next.spread.toFixed(4));
        style.setProperty("--w-openness", next.openness.toFixed(4));
        style.setProperty("--w-parallax", next.parallax.toFixed(4));
        style.setProperty("--w-drift", `${next.driftSeconds.toFixed(1)}s`);
        style.setProperty("--w-tone", next.tone.toFixed(4));
        style.setProperty("--w-resolve", next.resolve.toFixed(4));

        // Derived "separation" — how far apart the three pools actually sit,
        // not just how large or how densely blended they are. Low crowd AND
        // high spread both push pools apart; `resolve` then pulls this back
        // down regardless of raw crowd/spread, so ŞİMDİ reads as genuinely
        // simplified/compact rather than "YARIN but dimmer." This is what
        // makes DÜN (compressed) and ŞİMDİ (resolved) both read as compact
        // for different reasons, while YARIN alone reads as dramatically
        // more spatially open — the actual anchor POSITIONS below are driven
        // by this, not by crowd directly, since crowd alone was too small a
        // range to move pools apart far enough to read as real negative
        // space (see PersistentWorld.css comment on pool anchors).
        const sep = (1 - next.crowd) * (0.35 + next.spread * 0.65);
        const t = sep * (1 - next.resolve);
        style.setProperty("--w-t", t.toFixed(4));

        // Separate from `t`: how hard all three pools are pulled toward one
        // shared center point, regardless of where `t` would otherwise
        // place them. Without this, ŞİMDİ (resolve=1) ends up at nearly the
        // SAME three-pool constellation as DÜN (resolve=0) just calmer —
        // both use the same "clustered" anchors, and the only real
        // difference left is how warped their edges look, which is far too
        // subtle at DÜN's displacement-vs-blur ratio to read in a still
        // frame (confirmed by the grayscale check: DÜN and ŞİMDİ collapsed
        // to the same composition). `resolve` driving actual convergence
        // toward one point is what "displacement approaches near-perfect
        // alignment" and "complexity simplifies" should mean structurally,
        // not just calmer motion on the same layout.
        style.setProperty("--w-converge", next.resolve.toFixed(4));

        // Only the displacement *scale* attribute is tweened imperatively —
        // never baseFrequency (that regenerates the noise map and is
        // expensive). tight/broad each convert the same normalized `scale`
        // through their OWN ceiling (see constants above) — they must not
        // share one absolute px value, since their coherent ranges differ.
        tightMapRef.current?.setAttribute("scale", (next.scale * TIGHT_MAX_DISPLACEMENT_PX).toFixed(2));
        broadMapRef.current?.setAttribute("scale", (next.scale * BROAD_MAX_DISPLACEMENT_PX).toFixed(2));
        fineMapRef.current?.setAttribute(
          "scale",
          Math.min(MAX_FINE_DISPLACEMENT_PX, next.scale * MAX_FINE_DISPLACEMENT_PX * 1.4).toFixed(2)
        );

        currentRef.current = next;
      },
    });

    return () => controls.stop();
  }, [phase, fast]);

  return (
    <div ref={rootRef} className="field" aria-hidden="true">
      {/* Filter definitions live here, mounted once for the session — other
          components (ProgressBar's decorative echo, LyricsSheet's calm
          reveal) reference #refr-fine / #refr-tight / #refr-broad by id
          from anywhere in the document; SVG filter references resolve
          globally, so this is genuinely one shared optical system rather
          than copies matched by styling. */}
      <svg className="field__defs" width="0" height="0">
        <defs>
          <filter id="refr-tight" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves={2} seed={7} result="n" />
            <feDisplacementMap
              ref={tightMapRef}
              in="SourceGraphic"
              in2="n"
              scale={10}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <filter id="refr-broad" x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves={2} seed={3} result="n" />
            <feDisplacementMap
              ref={broadMapRef}
              in="SourceGraphic"
              in2="n"
              scale={10}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <filter id="refr-fine" x="-60%" y="-60%" width="220%" height="220%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={1} seed={11} result="n" />
            <feDisplacementMap
              ref={fineMapRef}
              in="SourceGraphic"
              in2="n"
              scale={1}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div className="field__pools field__pools--tight">
        <div className="field__pool field__pool--a" />
        <div className="field__pool field__pool--b" />
        <div className="field__pool field__pool--c" />
      </div>
      <div className="field__pools field__pools--broad">
        <div className="field__pool field__pool--a" />
        <div className="field__pool field__pool--b" />
        <div className="field__pool field__pool--c" />
      </div>
      <div className="field__grain" />
    </div>
  );
}
