/**
 * V3 Album Mode — explore all three songs after completing the journey.
 *
 * Route: ?lab=v3-album
 *
 * Shows the completed geometric artwork from each song (KEY / ∞ / HEART)
 * as an ambient full-screen backdrop. Thin luminous progress bar, prev/next,
 * Sözler lyrics sheet, and a link back to the full Journey.
 *
 * Audio managed directly via AudioEngine (same pattern as V3JourneyApp).
 * Reuses PlayPauseButton, ProgressBar, and LyricsSheet from production
 * components — no copies, no modifications.
 *
 * DO NOT MODIFY PRODUCTION. DO NOT MIGRATE. This is a standalone lab route.
 */

import { useState, useCallback, useEffect, type CSSProperties } from "react";
import { AudioEngine } from "../../audio/AudioEngine";
import { useAudioSnapshot } from "../../audio/useAudioEngine";
import { formatTime } from "../../audio/formatTime";
import { songs, type SongConfig } from "../../config/songs";
import { PlayPauseButton } from "../../components/PlayPauseButton";
import { ProgressBar } from "../../components/ProgressBar";
import { LyricsSheet } from "../../components/LyricsSheet";
import "./V3AlbumApp.css";

// ── Song order ─────────────────────────────────────────────────────────────────

const ALBUM_SONGS: SongConfig[] = [songs.dun, songs.yarin, songs.simdi];

// Known durations (seconds) — same as V3JourneyApp.
const TRACK_DURATIONS = [224.67, 232.17, 213.21];

// ── Artwork SVGs — completed geometric forms, frozen at Journey endpoint ──────
//
// Coordinate data taken verbatim from v3Timeline.ts (DÜN) and morph target
// coords from v3yarinTimeline.ts / v3simdiTimeline.ts. DO NOT MODIFY these
// coordinates — they are the canonical endpoint geometry and must stay in
// sync with the Journey renderers.

function KeyArtwork({ color }: { color: string }) {
  return (
    <svg className="va__art-svg" viewBox="0 0 390 844" aria-hidden="true">
      <defs>
        <filter id="va-key-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient bloom around ring */}
      <ellipse cx="195" cy="296" rx="165" ry="155" fill={color} fillOpacity="0.05" />

      {/* Outer ring — LO arc (left) */}
      <path
        d="M 195,172 C 118,148 72,212 72,296 C 72,380 118,424 195,420"
        fill="none" stroke={color} strokeWidth="1.5" filter="url(#va-key-glow)"
      />
      {/* Outer ring — RO arc (right) */}
      <path
        d="M 195,172 C 272,148 318,212 318,296 C 318,380 272,424 195,420"
        fill="none" stroke={color} strokeWidth="1.5" filter="url(#va-key-glow)"
      />

      {/* Inner arcs */}
      <path
        d="M 195,224 C 152,210 128,250 128,296 C 128,342 152,374 195,372"
        fill="none" stroke={color} strokeWidth="0.8" opacity="0.45"
      />
      <path
        d="M 195,224 C 238,210 262,250 262,296 C 262,342 238,374 195,372"
        fill="none" stroke={color} strokeWidth="0.8" opacity="0.45"
      />

      {/* Structural ribs */}
      <path d="M 140,212 L 72,296"  fill="none" stroke={color} strokeWidth="0.7" opacity="0.35" />
      <path d="M 250,212 L 318,296" fill="none" stroke={color} strokeWidth="0.7" opacity="0.35" />
      <path d="M 128,370 L 195,420" fill="none" stroke={color} strokeWidth="0.7" opacity="0.35" />
      <path d="M 262,370 L 195,420" fill="none" stroke={color} strokeWidth="0.7" opacity="0.35" />

      {/* Notch arcs at ring crown */}
      <path d="M 195,172 C 170,156 144,160 120,180" fill="none" stroke={color} strokeWidth="0.7" opacity="0.35" />
      <path d="M 195,172 C 220,156 246,160 270,180" fill="none" stroke={color} strokeWidth="0.7" opacity="0.35" />

      {/* Full shaft (top of ring to shaft base) */}
      <path
        d="M 195,172 L 195,720"
        fill="none" stroke={color} strokeWidth="1.5" filter="url(#va-key-glow)"
      />

      {/* Key teeth — appear left of shaft */}
      <path d="M 195,516 L 138,516" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M 195,576 L 154,576" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M 195,636 L 138,636" fill="none" stroke={color} strokeWidth="1.5" />

      {/* Shaft base cap */}
      <path d="M 175,720 L 215,720" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function InfinityArtwork({ color }: { color: string }) {
  return (
    <svg className="va__art-svg" viewBox="0 0 390 844" aria-hidden="true">
      <defs>
        <filter id="va-inf-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient bloom */}
      <ellipse cx="195" cy="420" rx="210" ry="130" fill={color} fillOpacity="0.05" />

      {/* ∞ — left arc (INF_COORDS.lo morph target) */}
      <path
        d="M 195,418 C 128,418 8,318 8,420 C 8,522 128,422 195,422"
        fill="none" stroke={color} strokeWidth="1.5" filter="url(#va-inf-glow)"
      />
      {/* ∞ — right arc (INF_COORDS.ro morph target) */}
      <path
        d="M 195,418 C 262,418 382,318 382,420 C 382,522 262,422 195,422"
        fill="none" stroke={color} strokeWidth="1.5" filter="url(#va-inf-glow)"
      />

      {/* Crossing accent — INF extras, faint */}
      <path
        d="M 195,418 C 128,418 8,318 8,420"
        fill="none" stroke={color} strokeWidth="0.7" opacity="0.3"
      />
      <path
        d="M 195,418 C 262,418 382,318 382,420"
        fill="none" stroke={color} strokeWidth="0.7" opacity="0.3"
      />
    </svg>
  );
}

function HeartArtwork({ color }: { color: string }) {
  return (
    <svg className="va__art-svg" viewBox="0 0 390 844" aria-hidden="true">
      <defs>
        <filter id="va-heart-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient bloom */}
      <ellipse cx="195" cy="440" rx="195" ry="240" fill={color} fillOpacity="0.05" />

      {/* Outer heart — LO arc (HEART_COORDS.lo morph target) */}
      <path
        d="M 195,240 C 48,128 18,238 18,356 C 18,474 105,574 195,660"
        fill="none" stroke={color} strokeWidth="1.5" filter="url(#va-heart-glow)"
      />
      {/* Outer heart — RO arc (HEART_COORDS.ro morph target) */}
      <path
        d="M 195,240 C 342,128 372,238 372,356 C 372,474 285,574 195,660"
        fill="none" stroke={color} strokeWidth="1.5" filter="url(#va-heart-glow)"
      />

      {/* Inner arcs */}
      <path
        d="M 195,290 C 92,196 62,280 62,358 C 62,436 135,524 195,618"
        fill="none" stroke={color} strokeWidth="0.8" opacity="0.45"
      />
      <path
        d="M 195,290 C 298,196 328,280 328,358 C 328,436 255,524 195,618"
        fill="none" stroke={color} strokeWidth="0.8" opacity="0.45"
      />
    </svg>
  );
}

// ── Artwork accent colors (luminous mid-tone, separate from dark accentColor) ─

const ARTWORK_COLORS = [
  "#c89a6a", // DÜN  — warm amber light
  "#d4a855", // YARIN — gold
  "#d8ccbf", // ŞİMDİ — warm neutral white
];

// ── Unlock gate ───────────────────────────────────────────────────────────────

/** Isolated from the production `bugu.albumMode.unlocked` key — see V3JourneyApp. */
const V3_ALBUM_KEY = "bugu.v3album.unlocked";

function isV3AlbumUnlocked(): boolean {
  try { return localStorage.getItem(V3_ALBUM_KEY) === "true"; } catch { return false; }
}

// ── Audio helpers ─────────────────────────────────────────────────────────────

function loadTrack(songConfig: SongConfig, autoPlay = true) {
  const src =
    songConfig.sources.find((s) => s.quality === "high")?.src ??
    songConfig.sources[0].src;
  const el = AudioEngine.element;
  el.src = src;
  el.currentTime = 0;
  if (autoPlay) void el.play().catch(() => {});
}

// ── Main component ─────────────────────────────────────────────────────────────

export function V3AlbumApp() {
  // ?track=N — dev convenience to start in playing view for screenshot
  const _params = new URLSearchParams(window.location.search);
  const _trackParam = parseInt(_params.get("track") ?? "", 10);
  const _initIdx = Number.isFinite(_trackParam) && _trackParam >= 0 && _trackParam < ALBUM_SONGS.length
    ? _trackParam : -1;

  const [view, setView] = useState<"home" | "playing">(_initIdx >= 0 ? "playing" : "home");
  const [trackIdx, setTrackIdx] = useState(_initIdx >= 0 ? _initIdx : 0);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const { currentTime, duration, isPlaying, isBuffering } = useAudioSnapshot();

  // Auto-advance to next track on song end
  useEffect(() => {
    if (view !== "playing") return;
    const el = AudioEngine.element;
    function onEnded() {
      setTrackIdx((prev) => {
        const next = prev + 1;
        if (next < ALBUM_SONGS.length) {
          loadTrack(ALBUM_SONGS[next]);
          return next;
        }
        return prev; // last track: stay, no auto-advance
      });
    }
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [view]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const enterTrack = useCallback((idx: number) => {
    setTrackIdx(idx);
    setView("playing");
    setLyricsOpen(false);
    loadTrack(ALBUM_SONGS[idx]);
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentTime > 3) {
      AudioEngine.seek(0);
    } else if (trackIdx > 0) {
      const newIdx = trackIdx - 1;
      setTrackIdx(newIdx);
      loadTrack(ALBUM_SONGS[newIdx]);
    }
  }, [currentTime, trackIdx]);

  const handleNext = useCallback(() => {
    if (trackIdx < ALBUM_SONGS.length - 1) {
      const newIdx = trackIdx + 1;
      setTrackIdx(newIdx);
      loadTrack(ALBUM_SONGS[newIdx]);
    }
  }, [trackIdx]);

  const handleBackToHome = useCallback(() => {
    AudioEngine.element.pause();
    setView("home");
    setLyricsOpen(false);
  }, []);

  const song = ALBUM_SONGS[trackIdx];
  const artColor = ARTWORK_COLORS[trackIdx];

  // ── Lock gate — bypass only via ?track=N (dev) ────────────────────────────
  const isDev = _initIdx >= 0; // ?track=N was present
  if (!isDev && !isV3AlbumUnlocked()) {
    return (
      <div className="va va--locked">
        <p className="va__locked-msg">Yolculuğu tamamla.</p>
        <a className="va__locked-link" href="?lab=v3-journey">Başla →</a>
      </div>
    );
  }

  // ── Home view ──────────────────────────────────────────────────────────────

  if (view === "home") {
    return (
      <div className="va va--home">
        <h1 className="va__home-title">BUĞU</h1>

        <nav className="va__track-list" aria-label="şarkılar">
          {ALBUM_SONGS.map((s, i) => (
            <button
              key={s.id}
              className="va__track-btn"
              onClick={() => enterTrack(i)}
            >
              <span className="va__track-name">{s.title}</span>
              <span className="va__track-dur">{formatTime(TRACK_DURATIONS[i])}</span>
            </button>
          ))}
        </nav>

        <a className="va__journey-link" href="?lab=v3-journey">
          Yolculuğu yeniden yaşa
        </a>
      </div>
    );
  }

  // ── Playing view ───────────────────────────────────────────────────────────

  const rootStyle = { "--accent": song.accentColor } as CSSProperties;

  return (
    <div className={`va va--playing va--${song.id}`} style={rootStyle}>

      {/* Full-screen artwork (ambient backdrop).
          key={trackIdx} forces a remount on track change → CSS animation restarts →
          new artwork fades in from opacity 0 to 0.38 over 1000ms. */}
      <div className="va__artwork" key={trackIdx} aria-hidden="true">
        {trackIdx === 0 && <KeyArtwork color={artColor} />}
        {trackIdx === 1 && <InfinityArtwork color={artColor} />}
        {trackIdx === 2 && <HeartArtwork color={artColor} />}
      </div>

      {/* Back to album home */}
      <button className="va__back-btn" onClick={handleBackToHome} aria-label="albüm listesine dön">
        albüm
      </button>

      {/* Bottom chrome — title + controls + journey link */}
      <div className="va__chrome">
        <h2 className="va__song-title">{song.title}</h2>

        <div className="va__progress">
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            seekable
            onSeek={(t) => AudioEngine.seek(t)}
          />
          <div className="va__time" aria-hidden="true">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="va__transport">
          <button
            className="va__nav-btn"
            onClick={handlePrevious}
            aria-label="önceki"
          >
            ‹
          </button>
          <PlayPauseButton
            isPlaying={isPlaying}
            onToggle={() => AudioEngine.toggle()}
            label={isPlaying ? "duraklat" : "oynat"}
            buffering={isBuffering}
          />
          <button
            className="va__nav-btn"
            onClick={handleNext}
            aria-label="sonraki"
          >
            ›
          </button>
        </div>

        <button className="va__sozler-btn" onClick={() => setLyricsOpen(true)}>
          sözler
        </button>

        <a className="va__journey-link" href="?lab=v3-journey">
          Yolculuğu yeniden yaşa
        </a>
      </div>

      {/* Lyrics sheet */}
      <LyricsSheet
        open={lyricsOpen}
        onClose={() => setLyricsOpen(false)}
        title={song.title}
        stanzas={song.lyrics}
      />
    </div>
  );
}
