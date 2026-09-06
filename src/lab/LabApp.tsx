import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "../audio/AudioEngine";
import { useAudioSnapshot } from "../audio/useAudioEngine";
import { songs } from "../config/songs";
import { AudioAnalyzer } from "./renderer/AudioAnalyzer";
import { WorldRenderer } from "./renderer/WorldRenderer";
import { dunConfig, yarinConfig } from "./renderer/worldConfig";
import "./LabApp.css";

/**
 * V2 Audiovisual Laboratory — ?lab=1
 *
 * Art review mode: controls are HIDDEN by default. Tap anywhere to reveal
 * briefly, then they fade. The canvas should be evaluable as pure artwork
 * with no UI visible.
 *
 * Architecture:
 *  - WorldRenderer runs its own rAF loop, completely decoupled from React.
 *  - AudioAnalyzer.tick() is called by the renderer per frame — no audio
 *    state flows through React on every frame (this was the crash cause).
 *  - React only manages: play/pause state, song selection, controls visibility.
 */

type SongId = "dun" | "yarin";

const PHASE_CONFIGS = { dun: dunConfig, yarin: yarinConfig } as const;
const CONTROLS_HIDE_MS = 2800;
const FAR_ALPHA_TARGET = 0.28; // for YARIN's F0 fade-in authored moment

// Silence the unused var warning — the constant is for documentation
void FAR_ALPHA_TARGET;

export function LabApp() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const renderer    = useRef<WorldRenderer | null>(null);
  const analyzer    = useRef<AudioAnalyzer | null>(null);
  const hideTimer   = useRef<number | undefined>(undefined);

  const [songId, setSongId]               = useState<SongId>("dun");
  const [controlsVisible, setVisible]     = useState(false); // hidden by default

  const { isPlaying, hasError } = useAudioSnapshot();

  // ── Renderer mount ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rnd = new WorldRenderer(canvas);
    const ana = new AudioAnalyzer();
    renderer.current = rnd;
    analyzer.current = ana;

    const onResize = () => rnd.resize();
    window.addEventListener("resize", onResize);
    onResize();

    rnd.setConfig(PHASE_CONFIGS["dun"]);
    rnd.start();

    return () => {
      rnd.stop();
      window.removeEventListener("resize", onResize);
      renderer.current = null;
      analyzer.current = null;
    };
  }, []);

  // ── Song switch ────────────────────────────────────────────────────────

  useEffect(() => {
    renderer.current?.setConfig(PHASE_CONFIGS[songId]);
    AudioEngine.prepare(songs[songId], 0);
  }, [songId]);

  // ── isPlaying → renderer ───────────────────────────────────────────────

  useEffect(() => {
    renderer.current?.setPlaying(isPlaying);
    if (!isPlaying) void analyzer.current?.suspend();
  }, [isPlaying]);

  // ── Controls auto-hide ─────────────────────────────────────────────────

  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), CONTROLS_HIDE_MS);
  }, []);

  const revealControls = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  // Auto-hide after play begins
  useEffect(() => {
    if (isPlaying) scheduleHide();
    else {
      window.clearTimeout(hideTimer.current);
      // Keep hidden even when paused — the art should be primary
      // Only reveal on explicit tap
    }
    return () => window.clearTimeout(hideTimer.current);
  }, [isPlaying, scheduleHide]);

  // ── Play / pause ───────────────────────────────────────────────────────

  const handlePlay = useCallback(async () => {
    const ana = analyzer.current;
    if (ana && !ana.isConnected) {
      ana.connect(AudioEngine.element);
    }
    // Resume AudioContext synchronously in the gesture handler
    if (ana) await ana.resume();
    // Wire the analyzer into the renderer signal path
    if (ana && renderer.current) {
      renderer.current.setSignalsProvider(() => ana.tick());
    }
    AudioEngine.toggle();
  }, []);

  // ── Song switch ────────────────────────────────────────────────────────

  const handleSongSwitch = useCallback(
    async (id: SongId) => {
      if (id === songId) return;
      if (isPlaying) AudioEngine.toggle(); // pause before switching
      setSongId(id);
    },
    [songId, isPlaying]
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="lab"
      onClick={revealControls}
      onTouchStart={revealControls}
    >
      <canvas ref={canvasRef} className="lab__canvas" />

      <div
        className={`lab__controls ${controlsVisible ? "lab__controls--visible" : "lab__controls--hidden"}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="lab__song-row">
          {(["dun", "yarin"] as SongId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`lab__song-btn${songId === id ? " lab__song-btn--active" : ""}`}
              onClick={() => void handleSongSwitch(id)}
            >
              {id === "dun" ? "DÜN" : "YARIN"}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="lab__play"
          onClick={() => void handlePlay()}
          aria-label={isPlaying ? "duraklat" : "oynat"}
        >
          {hasError ? "!" : isPlaying ? "⏸" : "▶"}
        </button>
      </div>

      {!controlsVisible && (
        <div className="lab__hint">tap to show controls</div>
      )}
    </div>
  );
}
