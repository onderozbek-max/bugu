import { useEffect } from "react";
import type { SongConfig } from "../config/songs";
import { AudioEngine } from "./AudioEngine";

/**
 * Wires a mounted SongScreen to the shared AudioEngine: prepares the song
 * (never autoplays — see AudioEngine.prepare), sets MediaSession metadata,
 * and forwards onHeard/onEnded. Pulled out of SongScreen itself so the
 * component only has to think about rendering chrome, not audio wiring.
 */
export function useSongPrepare(
  song: SongConfig,
  resumeAt: number | undefined,
  lockMediaSessionNav: boolean | undefined,
  onHeard: (() => void) | undefined,
  onEnded: (() => void) | undefined
) {
  useEffect(() => {
    // Prepare only — never autoplay. Playback starts from the explicit tap
    // on PlayPauseButton (a direct, synchronous user gesture).
    AudioEngine.prepare(song, resumeAt);
    AudioEngine.setMediaSessionMetadata(song, { lockNavigation: lockMediaSessionNav });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);

  useEffect(() => {
    if (!onHeard) return;
    return AudioEngine.onHeard((id) => {
      if (id === song.id) onHeard();
    });
  }, [song.id, onHeard]);

  useEffect(() => {
    if (!onEnded) return;
    return AudioEngine.onEnded((id) => {
      if (id === song.id) onEnded();
    });
  }, [song.id, onEnded]);
}
