import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { songs } from "../config/songs";
import { EASE, prefersReducedMotion } from "../lib/motionPrefs";
import "./PersistentWorld.css";

/**
 * The one continuously-mounted visual layer for an entire mode (Journey or
 * Album). It never unmounts between DÜN/YARIN/ŞİMDİ, and it never resets —
 * only its target parameters change, and a single tween carries the visible
 * state smoothly from wherever it currently is to the new target.
 *
 * The visual metaphor is a single horizon line, present in every chapter,
 * that never disappears — DÜN buries it low and lets memory's texture
 * crowd right up against it; YARIN lets it rise and clear, light spreading
 * outward; ŞİMDİ settles it to a calm, centered, fully sharp line and lets
 * everything else go quiet. Nothing here is swapped for something else —
 * it is always the same object, at a different point in one continuous
 * transformation.
 *
 * Foreground UI (title, controls, progress) mounts *above* this in the DOM
 * and can crossfade/appear on its own ordinary timeline — a much
 * lower-stakes kind of transition than the world itself cutting. The
 * progress bar is deliberately styled (see ProgressBar.css) to read as a
 * lit segment of this same horizon, so the player and the world are one
 * object rather than controls placed on a background.
 */
export type WorldPhase = "opening" | "dun" | "yarin" | "convergence" | "presence" | "album";

interface WorldTarget {
  /** 0..1 — vertical position of the horizon line; 0 buried low, 1 risen high. */
  horizonY: number;
  /** 0..1 — how densely texture crowds the line. */
  crowd: number;
  /** 0..1 — sharpness/brightness of the line itself; 0 faint and broken, 1 fully resolved. */
  clarity: number;
  /** 0..1 — how far light spreads outward from the line. */
  spread: number;
  /** seconds — duration of the slowest ambient drift loop. */
  driftSeconds: number;
  /** 0..1 — 0 leans toward DÜN's dusk, 1 toward YARIN's dawn. */
  tone: number;
  /** 0..1 — how far the world has settled toward ŞİMDİ's stillness. Slows
   * drift, quiets saturation, and is what makes the YARIN->ŞİMDİ approach
   * read as "everything settling" rather than a screen being covered. */
  resolve: number;
}

const TARGETS: Record<WorldPhase, WorldTarget> = {
  // A quiet, low-crowd echo of DÜN's world — pressing "başla" steps deeper
  // into what was already there, not loading a new screen.
  opening: {
    horizonY: 0.22,
    crowd: songs.dun.world.crowd * 0.3,
    clarity: 0.34,
    spread: 0.16,
    driftSeconds: 220,
    tone: 0,
    resolve: 0,
  },
  dun: {
    horizonY: songs.dun.world.horizonY,
    crowd: songs.dun.world.crowd,
    // Faint and buried, but not so low that it disappears entirely once
    // the contrast-guarantee scrim (chrome-scrim-bottom, see global.css)
    // sits on top of it — DÜN's own chrome anchors to the bottom, exactly
    // where this line sits (horizonY 0.14), so the two compound. 0.22 read
    // as literally invisible under that scrim in testing; 0.3 keeps it
    // perceptibly "buried" without vanishing.
    clarity: 0.3,
    spread: 0.2,
    driftSeconds: songs.dun.world.driftSeconds,
    tone: 0,
    resolve: 0,
  },
  yarin: {
    horizonY: songs.yarin.world.horizonY,
    crowd: songs.yarin.world.crowd,
    clarity: 0.74,
    spread: 0.88,
    driftSeconds: songs.yarin.world.driftSeconds,
    tone: 1,
    resolve: 0,
  },
  // The digital climax's approach: texture briefly ticks back up (memory's
  // texture and possibility's light seem to converge) while the line
  // itself keeps sharpening and everything else starts pulling toward
  // stillness — depth compressing, drift slowing — before `presence` lets
  // it resolve the rest of the way.
  convergence: {
    horizonY: 0.5,
    crowd: 0.42,
    clarity: 0.58,
    spread: 0.58,
    driftSeconds: 220,
    tone: 1,
    resolve: 0.6,
  },
  presence: {
    horizonY: songs.simdi.world.horizonY,
    crowd: songs.simdi.world.crowd,
    clarity: 1,
    // Pulled back from YARIN's widest reach — presence is focused and
    // immediate, not vast. Bigger/further is not more emotional here.
    spread: 0.46,
    driftSeconds: songs.simdi.world.driftSeconds,
    tone: 0.55,
    resolve: 1,
  },
  // Album Mode's resting state (list view, nothing selected) — an even,
  // calm blend of dusk and dawn, already partway settled. Deliberately NOT
  // identical to `presence` — a keepsake at rest, not the specific
  // emotional arrival ŞİMDİ's reveal earned.
  album: {
    horizonY: 0.4,
    crowd: 0.14,
    clarity: 0.6,
    spread: 0.4,
    driftSeconds: 240,
    tone: 0.5,
    resolve: 0.2,
  },
};

/** How long the *parameter tween* itself takes, per phase — a separate
 * clock from any stage-advance timer in App.tsx/AlbumHome.tsx. Tying this
 * to a stage flip is the "animation callback as source of truth" mistake
 * this codebase has hit before. */
const TWEEN_SECONDS: Record<WorldPhase, number> = {
  opening: 0,
  dun: 2.4,
  yarin: 7,
  convergence: 9,
  presence: 6,
  album: 3,
};

/** Album Mode song-to-song switching uses this fixed, much shorter
 * duration regardless of phase — a library should feel responsive, not
 * carry the once-in-a-lifetime pacing of the Journey narrative. */
const ALBUM_SWITCH_SECONDS = 2.4;

/**
 * `--w-*` is written only onto this component's own root div, not shared
 * via `document.documentElement` — SongScreen/Opening do NOT read these
 * custom properties directly. The kinship between the world's horizon line
 * and the player's progress bar (see ProgressBar.css) is deliberately
 * achieved through shared STYLING LANGUAGE instead — matching hairline
 * thickness, matching glow treatment, both tinted by the song's own accent
 * — not through a cross-component CSS variable contract. That's a
 * conscious scope call: pixel-exact alignment between an independently
 * laid-out player and this background layer would be fragile across
 * viewport sizes, safe areas, and dynamic viewport height, for a payoff
 * (literal geometric alignment) the shared visual language already covers.
 */
export function PersistentWorld({ phase, fast }: { phase: WorldPhase; fast?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<WorldTarget>(TARGETS[phase]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const target = el.style;
    const reduced = prefersReducedMotion();
    const from = currentRef.current;
    const to = TARGETS[phase];
    const duration = reduced ? 0 : fast ? ALBUM_SWITCH_SECONDS : TWEEN_SECONDS[phase];

    const controls = animate(0, 1, {
      duration,
      ease: EASE,
      onUpdate: (p) => {
        const next: WorldTarget = {
          horizonY: from.horizonY + (to.horizonY - from.horizonY) * p,
          crowd: from.crowd + (to.crowd - from.crowd) * p,
          clarity: from.clarity + (to.clarity - from.clarity) * p,
          spread: from.spread + (to.spread - from.spread) * p,
          driftSeconds: from.driftSeconds + (to.driftSeconds - from.driftSeconds) * p,
          tone: from.tone + (to.tone - from.tone) * p,
          resolve: from.resolve + (to.resolve - from.resolve) * p,
        };
        target.setProperty("--w-horizon", next.horizonY.toFixed(4));
        target.setProperty("--w-crowd", next.crowd.toFixed(4));
        target.setProperty("--w-clarity", next.clarity.toFixed(4));
        target.setProperty("--w-spread", next.spread.toFixed(4));
        target.setProperty("--w-drift", `${next.driftSeconds.toFixed(1)}s`);
        target.setProperty("--w-tone", next.tone.toFixed(4));
        target.setProperty("--w-resolve", next.resolve.toFixed(4));
        currentRef.current = next;
      },
    });

    return () => controls.stop();
  }, [phase, fast]);

  return (
    <div ref={rootRef} className="world" aria-hidden="true">
      <div className="world__glow" />
      <div className="world__mote world__mote--a" />
      <div className="world__mote world__mote--b" />
      <div className="world__grain" />
      <div className="world__line" />
    </div>
  );
}
