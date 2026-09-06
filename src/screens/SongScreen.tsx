import { useEffect, useRef, useState, type CSSProperties } from "react";
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
// TEMPORARY — production audio diagnostics only, see AudioEngine.ts banner,
// useAudioDebugSnapshot.ts, and deployedFileProbe.ts. Delete this import,
// the useAudioDebugSnapshot import below, and the block that uses both,
// once the deployed "Yüklenemedi" cause is confirmed.
import { useAudioDebugSnapshot } from "../audio/useAudioDebugSnapshot";
import { probeDeployedFile, type FileProbeResult } from "../audio/deployedFileProbe";
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
  const debugSnapshot = useAudioDebugSnapshot(); // TEMPORARY diagnostics

  // TEMPORARY — "DEPLOYED FILE PROBE": once every configured source has
  // genuinely failed (hasError), directly fetch each of this song's real
  // source URLs and report exactly what bytes came back, so an HTML error
  // page / LFS pointer / truncated response is impossible to miss. Runs
  // once per hasError transition (not on every render), so a single visit
  // to the error state doesn't re-download multi-megabyte files repeatedly.
  const [fileProbes, setFileProbes] = useState<FileProbeResult[] | null>(null);
  const probedForSongRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasError) {
      probedForSongRef.current = null;
      return;
    }
    if (probedForSongRef.current === song.id) return;
    probedForSongRef.current = song.id;
    setFileProbes(null);
    void Promise.all(song.sources.map((s) => probeDeployedFile(s.src))).then(setFileProbes);
  }, [hasError, song.id, song.sources]);
  // Chrome should stay put while she's waiting on a stall, or once closing
  // has started — receding it during a buffer (or fading it twice at once)
  // would read as the screen having died, not settled.
  const faded = useIdleFade(isPlaying && !hasError && !isBuffering && !closing);

  // ŞİMDİ only: a one-way, playback-time-anchored recede, independent of
  // touch (unlike useIdleFade, this never wakes back up on a tap) — roughly
  // 18-30s into playback, title/controls/sözler gradually become less
  // visually insistent. Nothing unmounts and nothing moves; the real-world
  // moment is meant to become the climax, not the screen going dark or
  // controls becoming unreachable.
  const simdiRecede =
    song.id === "simdi" && isPlaying && currentTime > 18 ? Math.min(1, (currentTime - 18) / 12) : 0;
  // Floor of 0.42, not near-zero — the brief requires the interface stay
  // "visible, understandable, tappable" at ~20s in, only "less visually
  // insistent." A floor low enough to be merely nonzero fails that; this
  // still reads as clearly receded relative to the first 18s.
  const simdiChromeOpacity = song.id === "simdi" ? 1 - simdiRecede * 0.58 : undefined;

  usePersistProgress(persistProgress ? song.id : null);
  usePrefetchNext(currentTime, duration, nextSong);
  useSongPrepare(song, resumeAt, lockMediaSessionNav, onHeard, onEnded);

  // Numeric timestamps are the most literal, least poetic thing on an
  // otherwise wordless screen — kept only where `showTime` is explicitly
  // passed (Album Mode), never inferred from `seekable` now that ŞİMDİ is
  // also seekable in Journey Mode without wanting a numeric readout.
  const showTimeReadout = showTime && Number.isFinite(duration) && duration > 0 && !hasError;
  // Title and controls are one composed unit (.song-screen__stage), not two
  // independently-positioned elements. Placement is authored per song here
  // directly — NOT derived from song.world.horizonY, which belongs to the
  // retired horizon-line concept and has no relationship to the current
  // pool field (PersistentWorld reads crowd/spread/openness/etc., never
  // horizonY). Pinning DÜN to the very bottom against that stale value is
  // exactly what produced the earlier failure of a huge empty upper frame
  // with every control crammed into the last 6vh — the pool field's own
  // visual activity (see PersistentWorld.css anchor points) now sits mostly
  // in the vertical middle third for every phase, so chrome is centered for
  // DÜN/ŞİMDİ (amid that activity, not stranded below it) and only nudged
  // upward for YARIN, to read as reaching toward its own open, higher pool
  // spread without recreating an empty opposite extreme.
  const stageStyle: CSSProperties =
    song.id === "yarin"
      ? {
          justifyContent: "flex-start",
          paddingTop: "calc(env(safe-area-inset-top) + 15vh)",
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

      {/* Recedes further while lyrics are open -- without this, the still-
          fully-visible title/glyph/progress sat at the same centered screen
          position as the lyrics text and read as a confusing double-
          exposure rather than "the same world, quieter." Nothing unmounts,
          it just yields visual priority to the clearing in front of it. */}
      <div
        className={`song-screen__stage${lyricsOpen ? " song-screen__stage--lyrics-open" : ""}`}
        style={stageStyle}
      >
        <h1
          className={`song-screen__title${song.id === "simdi" ? " song-screen__title--culmination" : ""}${
            closing ? " song-screen__title--concluding" : ""
          }`}
          style={simdiChromeOpacity !== undefined ? { opacity: simdiChromeOpacity } : undefined}
        >
          {song.title}
        </h1>

        <div
          className={`song-screen__controls${faded ? " song-screen__controls--faded" : ""}${
            closing ? " song-screen__controls--concluding" : ""
          }`}
          style={simdiChromeOpacity !== undefined ? { opacity: simdiChromeOpacity } : undefined}
        >
          {hasError ? (
            <>
              <button
                type="button"
                className="song-screen__retry"
                onClick={() => AudioEngine.retry()}
              >
                yüklenemedi — tekrar dene
              </button>
              {/* TEMPORARY — production audio diagnostics. Remove this whole
                  block (and the useAudioDebugSnapshot import/call above)
                  once the deployed "Yüklenemedi" cause is confirmed. */}
              <pre className="song-screen__debug">
                {[
                  `track: ${debugSnapshot.trackId}`,
                  `tier attempted: ${debugSnapshot.tier}`,
                  `src attempted: ${debugSnapshot.attemptedSrc}`,
                  `currentSrc: ${debugSnapshot.currentSrc}`,
                  `mp3 fallback attempted: ${debugSnapshot.mp3FallbackAttempted}`,
                  `error.code: ${debugSnapshot.errorCode ?? "null"}`,
                  `error.message: ${debugSnapshot.errorMessage ?? "null"}`,
                  `networkState: ${debugSnapshot.networkState}`,
                  `readyState: ${debugSnapshot.readyState}`,
                  `canPlayType(mp4/aac): "${debugSnapshot.canPlayMp4}"`,
                  `canPlayType(mpeg): "${debugSnapshot.canPlayMpeg}"`,
                  `play() rejection: ${
                    debugSnapshot.playRejection
                      ? `${debugSnapshot.playRejection.name}: ${debugSnapshot.playRejection.message}`
                      : "none"
                  }`,
                  `last events:`,
                  ...debugSnapshot.eventLog
                    .slice(-10)
                    .map(
                      (e) =>
                        `  t=${e.t} ${e.type} rs=${e.readyState} ns=${e.networkState} err=${e.errorCode ?? "-"}`
                    ),
                  ``,
                  `===== DEPLOYED FILE PROBE =====`,
                  fileProbes === null
                    ? "(fetching...)"
                    : fileProbes
                        .map((p) =>
                          [
                            `--- ${p.requestedUrl} ---`,
                            `final URL: ${p.finalUrl}`,
                            `status: ${p.status}  ok: ${p.ok}`,
                            `Content-Type: ${p.contentType ?? "null"}`,
                            `Content-Length (header): ${p.contentLength ?? "null"}`,
                            `Accept-Ranges: ${p.acceptRanges ?? "null"}`,
                            `Content-Range: ${p.contentRange ?? "null"}`,
                            `actual downloaded bytes: ${p.actualByteLength}`,
                            `first 32 bytes (hex): ${p.first32Hex}`,
                            `first 32 bytes (ascii): ${p.first32Ascii}`,
                            p.looksLikeHtmlOrText ? `!!! LOOKS LIKE HTML/TEXT, NOT BINARY MEDIA !!!` : null,
                            p.looksLikeLfsPointer ? `!!! LOOKS LIKE A GIT LFS POINTER FILE !!!` : null,
                            p.fetchError ? `fetch() threw: ${p.fetchError}` : null,
                            "range request bytes=0-63:",
                            "error" in p.range
                              ? `  ${p.range.error}`
                              : [
                                  `  status: ${p.range.status}`,
                                  `  Content-Range: ${p.range.contentRange ?? "null"}`,
                                  `  returned bytes: ${p.range.byteCount}`,
                                  `  first 32 bytes (hex): ${p.range.first32Hex}`,
                                ].join("\n"),
                          ]
                            .filter(Boolean)
                            .join("\n")
                        )
                        .join("\n\n"),
                ].join("\n")}
              </pre>
            </>
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
