import { useEffect } from "react";
import { AudioEngine } from "./AudioEngine";
import { useJourneyStore } from "../state/journeyStore";

/**
 * Writes playback progress to the journey store (and thus localStorage)
 * on visibilitychange(hidden) and pagehide — not on an interval, and not
 * on beforeunload, which iOS Safari does not reliably fire. This is what
 * lets the experience survive being backgrounded (a phone call, switching
 * to Messages, the screen locking) without losing the listener's place.
 */
export function usePersistProgress(songId: "dun" | "yarin" | "simdi" | null) {
  const setProgress = useJourneyStore((s) => s.setProgress);

  useEffect(() => {
    if (!songId) return;

    const save = () => {
      const t = AudioEngine.currentTime;
      if (Number.isFinite(t) && t > 0) {
        setProgress(songId, t);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [songId, setProgress]);
}
