import { useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { songOrder, songs, proposal, type SongId } from "../config/songs";
import { SongScreen } from "./SongScreen";
import { AudioEngine } from "../audio/AudioEngine";
import { FadeTransition } from "../components/FadeTransition";
import { PersistentWorld, type WorldPhase } from "../world/PersistentWorld";
import { EASE, prefersReducedMotion } from "../lib/motionPrefs";
import "./AlbumHome.css";

const WORLD_PHASE_FOR: Record<SongId, WorldPhase> = {
  dun: "dun",
  yarin: "yarin",
  simdi: "presence",
};

/**
 * Post-proposal permanent shell — the completed form of the same artwork,
 * not an admin list bolted onto the ritual. One PersistentWorld instance,
 * shared across the list and every song (switching crossfades its target
 * parameters rather than mounting a second visual tree), so DÜN/YARIN/
 * ŞİMDİ still look like they belong to one thing even now that all three
 * are finally visible together. Transitions here use `fast` — a library
 * should feel responsive, not carry the Journey's once-in-a-lifetime pacing.
 */
export function AlbumHome() {
  const [active, setActive] = useState<SongId | null>(null);
  const reduced = prefersReducedMotion();

  const backToList = () => {
    // The album list has no playback controls of its own — leaving a song
    // running underneath it with nothing on-screen to stop it (short of
    // the lock screen) would be a dead end, so returning to the list pauses.
    AudioEngine.pause();
    setActive(null);
  };

  const activeSong = active ? songs[active] : null;
  const activeIndex = active ? songOrder.indexOf(active) : -1;
  const previous = activeIndex >= 0 ? songOrder[(activeIndex - 1 + songOrder.length) % songOrder.length] : null;
  const next = activeIndex >= 0 ? songOrder[(activeIndex + 1) % songOrder.length] : null;
  const phase: WorldPhase = activeSong ? WORLD_PHASE_FOR[activeSong.id] : "album";
  const hasFooter = Boolean(proposal.date || proposal.location || proposal.note);

  return (
    <>
      <PersistentWorld phase={phase} fast />

      <AnimatePresence mode="wait">
        {activeSong ? (
          <FadeTransition key={`song-${activeSong.id}`} duration={0.7}>
            <button type="button" className="album-back" onClick={backToList}>
              ‹ albüm
            </button>
            <SongScreen
              song={activeSong}
              seekable
              showTime
              lockMediaSessionNav={false}
              onPrevious={() => previous && setActive(previous)}
              onNext={() => next && setActive(next)}
            />
          </FadeTransition>
        ) : (
          <FadeTransition key="list" duration={0.7}>
            <div className="album-home">
              <div className="chrome-scrim-top" aria-hidden="true" />
              <div className="chrome-scrim-bottom" aria-hidden="true" />
              <p className="album-home__mark">buğu</p>
              {/*
               * Each song sits at its own horizonY position along one
               * shared vertical axis — DÜN low, YARIN high, ŞİMDİ centered
               * — the same relationship PersistentWorld draws for whichever
               * one is actually playing. This is what keeps the keepsake
               * from reading as a plain developer-style list: memory,
               * possibility, and presence stay visibly related even now
               * that all three are selectable at once.
               */}
              <div className="album-home__list">
                <div className="album-home__axis" aria-hidden="true" />
                {songOrder.map((id, i) => {
                  const song = songs[id];
                  return (
                    <motion.button
                      key={id}
                      type="button"
                      className="album-home__item"
                      onClick={() => setActive(id)}
                      style={
                        {
                          top: `${(1 - song.world.horizonY) * 100}%`,
                          "--accent": song.accentColor,
                        } as CSSProperties
                      }
                      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reduced ? 0.4 : 0.9,
                        delay: reduced ? 0 : 0.2 + i * 0.12,
                        ease: EASE,
                      }}
                    >
                      <span className="album-home__item-line" />
                      <span className="album-home__item-title">{song.title}</span>
                    </motion.button>
                  );
                })}
              </div>

              {hasFooter && (
                <motion.div
                  className="album-home__footer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: reduced ? 0.4 : 1,
                    delay: reduced ? 0 : 0.2 + songOrder.length * 0.12 + 0.3,
                    ease: EASE,
                  }}
                >
                  {(proposal.date || proposal.location) && (
                    <p className="album-home__footer-line">
                      {[proposal.date, proposal.location].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {proposal.note && <p className="album-home__footer-note">{proposal.note}</p>}
                </motion.div>
              )}
            </div>
          </FadeTransition>
        )}
      </AnimatePresence>
    </>
  );
}
