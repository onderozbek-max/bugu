/**
 * V3 Journey — Full three-song continuous audiovisual experience.
 *
 * Route: ?lab=v3-journey
 *
 * Experience flow:
 *   OPENING  →  DÜN (key construction)
 *            →  YARIN (key → ∞ morph)
 *            →  ŞİMDİ (∞ → heart, revealed at 2:21)
 *            →  OUTRO (fade to black → album unlocked → ?lab=v3-album)
 *
 * Architecture:
 *   One persistent AudioEngine element, source switches at song boundaries.
 *   Each visual renderer mounts/unmounts based on `song` state.
 *   Renderers are already authored to start from the correct visual state:
 *     DÜN  t=0 → key begins drawing
 *     YARIN t=0 → completed key held (seam from DÜN end)
 *     ŞİMDİ t=0 → completed ∞ held (seam from YARIN end)
 *
 * Audio sources (until journey.m4a is created):
 *   dun.m4a   — 224.67s
 *   yarin.m4a — 232.17s
 *   simdi.m4a — 213.21s
 *
 * The visual transition between songs is seamless because each song's
 * starting pose IS the ending state of the previous song.
 *
 * Album unlock:
 *   When ŞİMDİ's audio `ended` event fires, the journey is considered
 *   complete. `bugu.v3album.unlocked` is written to localStorage (isolated
 *   from the production `bugu.albumMode.unlocked` key — do not merge them).
 *   A 2.5s black fade plays, then the page navigates to ?lab=v3-album.
 *   A long fallback timer (simdi.duration + 8s) fires the same handler
 *   in case `ended` never arrives (cellular stall, decode error).
 *
 * DO NOT MODIFY PRODUCTION. This is a standalone lab route.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { AudioEngine } from "../../audio/AudioEngine";
import { V3DunRenderer }   from "../v3dun/V3DunRenderer";
import { V3YarinRenderer } from "../v3yarin/V3YarinRenderer";
import { V3SimdiRenderer } from "../v3simdi/V3SimdiRenderer";
import "./V3JourneyApp.css";

// ── Audio sources ──────────────────────────────────────────────────────────────

// Use BASE_URL so paths resolve correctly on GitHub Pages (/bugu/audio/…)
// as well as locally (/audio/…). Hardcoded root-relative paths (/audio/…)
// 404 on any deployment that isn't served from the domain root.
const BASE = import.meta.env.BASE_URL;

const SONGS = [
  { id: "dun",   src: `${BASE}audio/dun.m4a`,   duration: 224.67 },
  { id: "yarin", src: `${BASE}audio/yarin.m4a`, duration: 232.17 },
  { id: "simdi", src: `${BASE}audio/simdi.m4a`, duration: 213.21 },
] as const;

type Song = typeof SONGS[number]["id"];
type Stage = "opening" | Song | "outro";

// ── Album unlock helpers ──────────────────────────────────────────────────────

/** Isolated from the production `bugu.albumMode.unlocked` key. */
const V3_ALBUM_KEY = "bugu.v3album.unlocked";

function writeV3AlbumUnlock() {
  try { localStorage.setItem(V3_ALBUM_KEY, "true"); } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────

export function V3JourneyApp() {
  const [stage,          setStage]         = useState<Stage>("opening");
  const [openingVisible, setOpeningVisible] = useState(true);
  const songIndex        = useRef(0);
  const boundaryTimer    = useRef<number | undefined>(undefined);
  const fallbackTimer    = useRef<number | undefined>(undefined);
  const journeyEnded     = useRef(false); // guards against double-fire

  // ── Journey-complete handler (called by ended event OR fallback timer) ────
  const handleJourneyComplete = useCallback(() => {
    if (journeyEnded.current) return;
    journeyEnded.current = true;

    writeV3AlbumUnlock();
    setStage("outro");

    // Navigate after the fade-to-black animation completes (2.5s).
    window.setTimeout(() => {
      window.location.href = window.location.pathname + "?lab=v3-album";
    }, 2500);
  }, []);

  // ── Load and play a song by index ─────────────────────────────────────────
  const playSong = useCallback((idx: number) => {
    if (idx >= SONGS.length) return;
    const song = SONGS[idx];
    songIndex.current = idx;

    const el = AudioEngine.element;
    el.src = song.src;
    el.preload = "auto";
    el.currentTime = 0;
    el.play().catch(() => {});

    setStage(song.id);

    // Schedule transition to next song (or no-op beyond last song)
    clearTimeout(boundaryTimer.current);
    boundaryTimer.current = window.setTimeout(() => {
      playSong(idx + 1);
    }, song.duration * 1000 + 300); // +300ms buffer for decode
  }, []);

  // ── ŞİMDİ completion listener ─────────────────────────────────────────────
  //
  // Primary: the `ended` event fires at the exact moment the audio finishes.
  // Fallback: a long timer fires if `ended` never arrives (network stall,
  // decode error). Both are guarded by journeyEnded.current so only the
  // first one to fire actually triggers the outro.
  useEffect(() => {
    if (stage !== "simdi") return;

    const el = AudioEngine.element;
    el.addEventListener("ended", handleJourneyComplete);

    // Fallback: simdi.duration + 8s after play() was called
    fallbackTimer.current = window.setTimeout(
      handleJourneyComplete,
      (SONGS[2].duration + 8) * 1000
    );

    return () => {
      el.removeEventListener("ended", handleJourneyComplete);
      clearTimeout(fallbackTimer.current);
    };
  }, [stage, handleJourneyComplete]);

  // ── Opening tap handler ────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (stage !== "opening") return;

    // Fade out opening over 700ms, then start DÜN
    setOpeningVisible(false);
    window.setTimeout(() => {
      playSong(0);
    }, 700);
  }, [stage, playSong]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(boundaryTimer.current);
      clearTimeout(fallbackTimer.current);
      AudioEngine.element.pause();
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="vj" onClick={stage === "opening" ? handleStart : undefined}>

      {/* Opening screen */}
      {stage === "opening" && (
        <div
          className="vj__opening"
          style={{
            opacity: openingVisible ? 1 : 0,
            transition: "opacity 700ms ease",
          }}
        >
          <div className="vj__opening-title">BUĞU</div>
          <div className="vj__opening-sub">
            Kulaklıklarını tak.
            <br />
            Hazır olduğunda dokun.
          </div>
        </div>
      )}

      {/* Visual renderers — only one mounted at a time */}
      {stage === "dun" && (
        <div className="vj__renderer">
          <V3DunRenderer />
        </div>
      )}
      {stage === "yarin" && (
        <div className="vj__renderer">
          <V3YarinRenderer />
        </div>
      )}

      {/* ŞİMDİ stays mounted during outro so the heart is visible
          while the black fade plays over it. */}
      {(stage === "simdi" || stage === "outro") && (
        <div className="vj__renderer">
          <V3SimdiRenderer />
        </div>
      )}

      {/* Outro — full-screen black fades in over the completed heart */}
      {stage === "outro" && (
        <div className="vj__outro" aria-hidden="true" />
      )}

    </div>
  );
}
