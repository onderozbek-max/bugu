import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lets the player chrome recede while she's actually listening, and
 * reappear instantly the moment she touches the screen — so "put the
 * phone down and just listen" is true visually, not just functionally.
 *
 * Only active when `active` is true (callers pass `isPlaying && !hasError`
 * — never recede while paused/deciding, and never recede behind a stalled
 * retry affordance). Re-arms on any pointerdown and on returning from the
 * background (visibilitychange), so coming back from Messages never shows
 * a screen that looks dead just because nothing was touched yet.
 *
 * The pointerdown listener is only attached while `active` — not just to
 * save a global listener while paused, but because attaching it
 * unconditionally would mean every pointerdown that starts a ProgressBar
 * scrub or a LyricsSheet drag also runs through here. `{ passive: true }`
 * keeps it from ever blocking those gestures either way.
 */
export function useIdleFade(active: boolean, delayMs = 3500) {
  const [faded, setFaded] = useState(false);
  const timerRef = useRef<number | null>(null);

  const wake = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFaded(false);
    if (active) {
      timerRef.current = window.setTimeout(() => setFaded(true), delayMs);
    }
  }, [active, delayMs]);

  useEffect(() => {
    wake();
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [wake]);

  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, wake]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("pointerdown", wake, { passive: true });
    return () => window.removeEventListener("pointerdown", wake);
  }, [active, wake]);

  return faded;
}
