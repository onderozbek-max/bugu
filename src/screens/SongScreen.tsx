import { useState, type CSSProperties } from "react";
import type { SongConfig } from "../config/songs";
import { PlayPauseButton } from "../components/PlayPauseButton";
import { ProgressBar } from "../components/ProgressBar";
import { LyricsSheet } from "../components/LyricsSheet";
import { AudioEngine } from "../audio/AudioEngine";
import { useAudioSnapshot } from "../audio/useAudioEngine";
import { usePersistProgress } from "../audio/usePersistProgress";
import { usePrefetchNext } from "../audio/usePrefetchNext";
import { formatTime } from "../audio/formatTime";
import { useIdleFade } from "./useIdleFade";
import { useSongPrepare } from "../audio/useSongPrepare";
import "./SongScreen.css";

/**
 * Shared player CHROME for DÜN, YARIN, and every song in Album Mode —
 * title, play/pause, progress, sözler. It owns none of the background: the
 * world behind it is PersistentWorld, mounted once by the parent (App.tsx
 * in Journey Mode, AlbumHome.tsx in Album Mode) and never remounted between
 * songs. This is what keeps Album Mode a config flip rather than a second
 * implementation, and what keeps the world from ever visually resetting.
 */
export function SongScreen({
  song,
  seekable,
  resumeAt,
  onHeard,
  onEnded,
  lockMediaSessionNav,
  nextSong,
  onNext,
  onPrevious,
  persistProgress,
  closing,
  showTime,
}: {
  song: SongConfig;
  /** Journey Mode: false for DÜN/YARIN (no scrubbing, narrative integrity).
   * ŞİMDİ and Album Mode: true — ŞİMDİ is terminal, there's no "spoiler"
   * risk to seeking freely once it's the song actually playing on the
   * walk to the proposal. */
  seekable: boolean;
  resumeAt?: number;
  /** Fires once at 92% or `ended` — persist the "heard" flag only. Must
   * never itself change which screen is shown (see onEnded). */
  onHeard?: () => void;
  /** Fires once, only on the native `ended` event — the signal the parent
   * uses to start its own closing choreography (world morph + eventual
   * stage advance). This component has no opinion about what happens next. */
  onEnded?: () => void;
  /** Journey Mode: true, so lock-screen controls can't skip ahead. */
  lockMediaSessionNav?: boolean;
  /** Warms the HTTP cache for the next song's high-quality (not lossless)
   * source once this one is well underway, network permitting. */
  nextSong?: SongConfig;
  /** Album Mode only: lets the player switch songs without returning to the list. */
  onNext?: () => void;
  onPrevious?: () => void;
  /** Journey Mode only: persists resume position to the journey store. Album
   * Mode must NOT write here — it has no resumeAt of its own, so it would
   * silently overwrite (and corrupt) the Journey resume position for
   * anyone who reaches Album Mode without having finished the journey. */
  persistProgress?: boolean;
  /** Set by the parent once it has decided this song is ending (DÜN or
   * YARIN in Journey Mode) — fades this screen's own title/controls out.
   * The world's own closing choreography runs independently in
   * PersistentWorld; this is only ever "this chrome is going away now." */
  closing?: boolean;
  /** Numeric mm:ss readout. Deliberately a SEPARATE flag from `seekable` —
   * ŞİMDİ is seekable in Journey Mode but should stay as wordless as DÜN/
   * YARIN; only Album Mode (a library, not a ritual) sets this true. */
  showTime?: boolean;
}) {
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const { currentTime, duration, isPlaying, hasError, isBuffering } = useAudioSnapshot();
  // Chrome should stay put while she's waiting on a stall, or once closing
  // has started — receding it during a buffer (or fading it twice at once)
  // would read as the screen having died, not settled.
  const faded = useIdleFade(isPlaying && !hasError && !isBuffering && !closing);

  usePersistProgress(persistProgress ? song.id : null);
  usePrefetchNext(currentTime, duration, nextSong);
  useSongPrepare(song, resumeAt, lockMediaSessionNav, onHeard, onEnded);

  // Numeric timestamps are the most literal, least poetic thing on an
  // otherwise wordless screen — kept only where `showTime` is explicitly
  // passed (Album Mode), never inferred from `seekable` now that ŞİMDİ is
  // also seekable in Journey Mode without wanting a numeric readout.
  const showTimeReadout = showTime && Number.isFinite(duration) && duration > 0 && !hasError;
  // Title/controls settle low for a grounded song (DÜN), rise for an open
  // one (YARIN), centered for a resolved one (ŞİMDİ) — reads straight from
  // the same horizonY value driving the world behind it, so the two never
  // disagree about which way is "open".
  // Title and controls are one composed unit (.song-screen__stage), not two
  // independently-positioned elements — this is what fixes the old "title
  // shoved into a corner, play button floating independently" disconnect.
  // The whole stage moves together: low/bottom for a grounded song (DÜN),
  // high/top for an open one (YARIN), centered for a resolved one (ŞİMDİ).
  const { horizonY } = song.world;
  const stageStyle: CSSProperties =
    horizonY < 0.4
      ? {
          justifyContent: "flex-end",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 6vh)",
        }
      : horizonY > 0.6
        ? {
            justifyContent: "flex-start",
            paddingTop: "calc(env(safe-area-inset-top) + 11vh)",
          }
        : { justifyContent: "center" };
  const rootStyle = { "--accent": song.accentColor } as CSSProperties;

  return (
    <div className="song-screen" style={rootStyle}>
      <div className="chrome-scrim-top" aria-hidden="true" />
      <div className="chrome-scrim-bottom" aria-hidden="true" />

      {onPrevious && (
        <button
          type="button"
          className={`song-screen__nav song-screen__nav--prev${faded ? " song-screen__nav--faded" : ""}`}
          onClick={onPrevious}
          aria-label="önceki"
        >
          ‹
        </button>
      )}
      {onNext && (
        <button
          type="button"
          className={`song-screen__nav song-screen__nav--next${faded ? " song-screen__nav--faded" : ""}`}
          onClick={onNext}
          aria-label="sonraki"
        >
          ›
        </button>
      )}

      <div className="song-screen__stage" style={stageStyle}>
        <h1
          className={`song-screen__title${song.id === "simdi" ? " song-screen__title--culmination" : ""}${
            closing ? " song-screen__title--concluding" : ""
          }`}
        >
          {song.title}
        </h1>

        <div
          className={`song-screen__controls${faded ? " song-screen__controls--faded" : ""}${
            closing ? " song-screen__controls--concluding" : ""
          }`}
        >
          {hasError ? (
            <button
              type="button"
              className="song-screen__retry"
              onClick={() => AudioEngine.retry()}
            >
              yüklenemedi — tekrar dene
            </button>
          ) : (
            <PlayPauseButton
              isPlaying={isPlaying}
              onToggle={() => AudioEngine.toggle()}
              label={isPlaying ? "duraklat" : "oynat"}
              buffering={isBuffering}
            />
          )}

          <div className="song-screen__progress">
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              seekable={seekable}
              onSeek={(t) => AudioEngine.seek(t)}
            />
            {showTimeReadout && (
              <div className="song-screen__time" aria-hidden="true">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="song-screen__sozler"
            onClick={() => setLyricsOpen(true)}
          >
            sözler
          </button>
        </div>
      </div>

      <LyricsSheet
        open={lyricsOpen}
        onClose={() => setLyricsOpen(false)}
        title={song.title}
        stanzas={song.lyrics}
      />
    </div>
  );
}
