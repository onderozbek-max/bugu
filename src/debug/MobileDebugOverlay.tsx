import { useEffect, useState } from "react";
import { AudioEngine } from "../audio/AudioEngine";
import { getDebugJourney, getRuntimeErrors, subscribeDebugJourney } from "./mobileDebug";

/**
 * ==================== TEMPORARY — MOBILE BLACK-SCREEN DIAGNOSTICS ====================
 * Mounted as a SEPARATE React root, appended directly to document.body as a
 * SIBLING of #root (see main.tsx) — deliberately NOT inside the app's own
 * component tree, so it keeps rendering even if #root's contents/compositing
 * collapse. `position: fixed`, huge z-index, and no transform/filter/opacity/
 * blend-mode anywhere in its own styling or ancestry (html/body have none).
 *
 * Enable with `?mobileDebug=1` in the URL. Delete this file,
 * mobileDebug.ts, mobileDebugOverrides.css, and their wiring in
 * main.tsx/App.tsx/FadeTransition.tsx once the mobile bug is fixed.
 */

interface Snapshot {
  time: string;
  journey: ReturnType<typeof getDebugJourney>;
  track: string;
  playing: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  visibilityState: string;
  innerWidth: number;
  innerHeight: number;
  vvWidth: number | null;
  vvHeight: number | null;
  rects: Record<string, string>;
  computed: Record<string, string>;
  errors: string[];
}

const WATCHED_SELECTORS: Record<string, string> = {
  root: "#root",
  field: ".field",
  poolsTight: ".field__pools--tight",
  poolsBroad: ".field__pools--broad",
  songScreen: ".song-screen",
  fadeTransition: ".fade-transition",
};

function readRect(el: Element | null): string {
  if (!el) return "MISSING";
  const r = el.getBoundingClientRect();
  return `${r.width.toFixed(0)}x${r.height.toFixed(0)} @(${r.left.toFixed(0)},${r.top.toFixed(0)})`;
}

function readComputed(el: Element | null): string {
  if (!el) return "MISSING";
  const cs = window.getComputedStyle(el);
  return `op=${cs.opacity} disp=${cs.display} vis=${cs.visibility} z=${cs.zIndex} blend=${cs.mixBlendMode}`;
}

function takeSnapshot(): Snapshot {
  const debugSnap = AudioEngine.getDebugSnapshot();
  const rects: Record<string, string> = {};
  const computed: Record<string, string> = {};
  for (const [key, sel] of Object.entries(WATCHED_SELECTORS)) {
    const el = document.querySelector(sel);
    rects[key] = readRect(el);
    computed[key] = readComputed(el);
  }
  const vv = window.visualViewport;
  return {
    time: new Date().toISOString().slice(11, 23),
    journey: getDebugJourney(),
    track: debugSnap.trackId ?? "none",
    playing: AudioEngine.isPlaying,
    ended: AudioEngine.element.ended,
    currentTime: AudioEngine.currentTime,
    duration: AudioEngine.duration,
    visibilityState: document.visibilityState,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    vvWidth: vv ? Math.round(vv.width) : null,
    vvHeight: vv ? Math.round(vv.height) : null,
    rects,
    computed,
    errors: getRuntimeErrors()
      .slice(-5)
      .map((e) => `[${e.t}] ${e.kind}: ${e.message}`),
  };
}

export function MobileDebugOverlay() {
  const [snap, setSnap] = useState<Snapshot>(() => takeSnapshot());

  useEffect(() => {
    const id = window.setInterval(() => setSnap(takeSnapshot()), 500);
    const unsubJourney = subscribeDebugJourney(() => setSnap(takeSnapshot()));
    const unsubAudio = AudioEngine.subscribe(() => setSnap(takeSnapshot()));
    return () => {
      window.clearInterval(id);
      unsubJourney();
      unsubAudio();
    };
  }, []);

  return (
    <pre
      style={{
        position: "fixed",
        inset: "auto 0 0 0",
        margin: 0,
        maxHeight: "48vh",
        overflowY: "auto",
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.85)",
        color: "#5ff67a",
        font: "9px/1.4 ui-monospace, Menlo, monospace",
        padding: "6px 8px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        pointerEvents: "auto",
      }}
    >
      {`[MOBILE DEBUG ${snap.time}] stage=${snap.journey.stage} phase=${snap.journey.phase}
lastTransition: ${snap.journey.lastTransition}
track=${snap.track} playing=${snap.playing} ended=${snap.ended} t=${snap.currentTime.toFixed(1)}/${snap.duration.toFixed(1)}
visibilityState=${snap.visibilityState}
viewport=${snap.innerWidth}x${snap.innerHeight} visualViewport=${snap.vvWidth}x${snap.vvHeight}
-- rects --
${Object.entries(snap.rects)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}
-- computed --
${Object.entries(snap.computed)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}
-- errors (last 5) --
${snap.errors.length ? snap.errors.join("\n") : "(none)"}`}
    </pre>
  );
}
/** ==================== end temporary file ==================== */
