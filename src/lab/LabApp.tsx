import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "../audio/AudioEngine";
import { useAudioSnapshot } from "../audio/useAudioEngine";
import { songs } from "../config/songs";
import { AudioAnalyzer } from "./renderer/AudioAnalyzer";
import { WorldRenderer } from "./renderer/WorldRenderer";
import { dunConfig, yarinConfig } from "./renderer/worldConfig";
import "./LabApp.css";

/**
 * V2 Audiovisual Laboratory — accessible via ?lab=1.
 *
 * Completely isolated from the production journey:
 *   - No journey state, no stage machine, no persistence.
 *   - AudioEngine is used only for play/pause — its single persistent
 *     <audio> element also feeds the AudioAnalyzer for Web Audio analysis.
 *   - The WorldRenderer runs its own rAF loop; no audio state flows through
 *     React on every frame (this was the root cause of the mobile #185 crash).
 *
 * Controls auto-hide 3s after playback begins. Tap anywhere to reveal.
 */

type SongId = "dun" | "yarin";

const PHASE_CONFIGS = { dun: dunConfig, yarin: yarinConfig } as const;
const HIDE_DELAY_MS = 3000;

export function LabApp() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);

  const [songId, setSongId] = useState<SongId>("dun");
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | undefined>(undefined);

  // Only isPlaying and hasError needed from AudioEngine — not currentTime
  const { isPlaying, hasError } = useAudioSnapshot();

  // ── Renderer lifecycle ─────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer  = new WorldRenderer(canvas);
    const analyzer  = new AudioAnalyzer();

    rendererRef.current  = renderer;
    analyzerRef.current  = analyzer;

    // Size canvas to physical pixels
    const handleResize = () => renderer.resize();
    window.addEventListener("resize", handleResize);
    handleResize();

    renderer.setConfig(PHASE_CONFIGS["dun"]);
    renderer.setSignalsProvider(null); // no signals until analyzer connects
    renderer.start();

    return () => {
      renderer.stop();
      window.removeEventListener("resize", handleResize);
      rendererRef.current  = null;
      analyzerRef.current  = null;
    };
  }, []); // run once on mount

  // ── Song switch ────────────────────────────────────────────────────────

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setConfig(PHASE_CONFIGS[songId]);

    // Prepare AudioEngine for the new song without autoplaying.
    AudioEngine.prepare(songs[songId], 0);
  }, [songId]);

  // ── Sync isPlaying to renderer (for spring-kick gating) ───────────────

  useEffect(() => {
    rendererRef.current?.setPlaying(isPlaying);
    if (!isPlaying && analyzerRef.current) {
      void analyzerRef.current.suspend();
    }
  }, [isPlaying]);

  // ── Controls auto-hide ─────────────────────────────────────────────────

  const showControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = window.setTimeout(
        () => setControlsVisible(false),
        HIDE_DELAY_MS
      );
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      window.clearTimeout(hideTimerRef.current);
    } else {
      hideTimerRef.current = window.setTimeout(
        () => setControlsVisible(false),
        HIDE_DELAY_MS
      );
    }
    return () => window.clearTimeout(hideTimerRef.current);
  }, [isPlaying]);

  // ── Play / pause ───────────────────────────────────────────────────────

  const handlePlay = useCallback(async () => {
    const analyzer = analyzerRef.current;

    // 1. Resume AudioContext synchronously in the gesture — this is the only
    //    moment mobile browsers permit it without a dedicated gesture.
    if (analyzer && !analyzer.isConnected) {
      analyzer.connect(AudioEngine.element);
    }
    if (analyzer) {
      await analyzer.resume();
    }

    // 2. Wire the analyzer's tick() into the renderer's signal provider
    //    (done after connect so the method is live).
    if (analyzer && rendererRef.current) {
      rendererRef.current.setSignalsProvider(() => analyzer.tick());
    }

    // 3. Start or pause AudioEngine — must happen AFTER AudioContext resume.
    AudioEngine.toggle();
  }, []);

  // ── Song change (while possibly playing) ──────────────────────────────

  const handleSongSwitch = useCallback(
    async (id: SongId) => {
      if (id === songId) return;
      // Stop current playback first — prepare() on the same element while
      // playing causes an aborted-load error sequence.
      if (isPlaying) {
        AudioEngine.toggle(); // pause
      }
      setSongId(id);
    },
    [songId, isPlaying]
  );

  // ── Status line ────────────────────────────────────────────────────────

  let status = "";
  if (hasError) status = "yüklenemedi";
  else if (!isPlaying) status = `${songId === "dun" ? "DÜN" : "YARIN"} · hazır`;

  return (
    <div
      className="lab"
      onClick={showControls}
      onTouchStart={showControls}
    >
      <canvas ref={canvasRef} className="lab__canvas" />

      {status && <div className="lab__status">{status}</div>}

      <div
        className={`lab__controls ${controlsVisible ? "lab__controls--visible" : "lab__controls--hidden"}`}
        onClick={(e) => e.stopPropagation()} // don't re-trigger showControls twice
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
          {isPlaying ? "⏸" : "▶"}
        </button>
      </div>

      {!controlsVisible && (
        <div className="lab__hint">tap to show controls</div>
      )}
    </div>
  );
}
