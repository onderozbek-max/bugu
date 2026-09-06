import { useSyncExternalStore } from "react";
import { AudioEngine } from "./AudioEngine";

/**
 * Reactive snapshot of the shared audio element, for driving UI (play/pause
 * icon, progress bar, error/retry affordance). Progress persistence to
 * localStorage is handled separately in usePersistProgress (tied to
 * visibilitychange/pagehide, not to every timeupdate tick).
 *
 * useSyncExternalStore requires getSnapshot to return a referentially
 * stable value when nothing has changed (otherwise React re-renders on
 * every call). We cache the last snapshot and only allocate a new object
 * when one of the primitive values actually differs.
 */
interface AudioSnapshot {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  hasError: boolean;
  /** Browser is waiting on data for the currently-selected source — distinct
   * from hasError (every source has failed) and never true at the same time
   * as it; used to show a "yükleniyor" affordance instead of a broken tap. */
  isBuffering: boolean;
}

let cached: AudioSnapshot = {
  currentTime: 0,
  duration: NaN,
  isPlaying: false,
  hasError: false,
  isBuffering: false,
};

function getSnapshot(): AudioSnapshot {
  const currentTime = AudioEngine.currentTime;
  const duration = AudioEngine.duration;
  const isPlaying = AudioEngine.isPlaying;
  const hasError = AudioEngine.hasError;
  const isBuffering = AudioEngine.isBuffering;

  // Object.is, not !==, for every field: `duration` is NaN before metadata
  // loads, and `NaN !== NaN` is always true in JS, so a plain !== check
  // allocated a new snapshot on every call while duration was NaN —
  // useSyncExternalStore then sees an ever-changing store and loops
  // (getSnapshot-should-be-cached warning → Maximum update depth
  // exceeded, before Opening ever renders). Object.is(NaN, NaN) is true,
  // so the cached snapshot is correctly reused once nothing has changed.
  // Applied to every field, not just duration, so no other primitive
  // (e.g. a future -0/0 edge case) can reintroduce the same failure mode.
  if (
    !Object.is(cached.currentTime, currentTime) ||
    !Object.is(cached.duration, duration) ||
    !Object.is(cached.isPlaying, isPlaying) ||
    !Object.is(cached.hasError, hasError) ||
    !Object.is(cached.isBuffering, isBuffering)
  ) {
    cached = { currentTime, duration, isPlaying, hasError, isBuffering };
  }
  return cached;
}

const SERVER_SNAPSHOT: AudioSnapshot = {
  currentTime: 0,
  duration: NaN,
  isPlaying: false,
  hasError: false,
  isBuffering: false,
};

/** Must be a STABLE reference across renders (module-level, not created
 * inline in the hook) — this is the actual root cause of the mobile
 * "React error #185 / Maximum update depth exceeded" crash (see
 * getServerSnapshot below for the matching fix). A fresh closure passed as
 * useSyncExternalStore's `subscribe` argument makes React treat every
 * render as "the subscription changed," forcing it to re-subscribe and
 * re-check getSnapshot() during that render's passive-effect commit. Since
 * `currentTime` changes continuously during real playback, that recheck
 * almost always finds a newer value than the one just rendered with,
 * forces an immediate re-render, which recreates the closure again,
 * checks again, finds another newer value again — a tight synchronous
 * loop with no external event ever breaking it, which is exactly what
 * trips React's nested-update-depth guard. A stable reference means React
 * only needs to do that mount-time check once; ordinary playback-driven
 * re-renders afterward go through the normal subscribe-notify path
 * instead. */
function subscribe(onStoreChange: () => void) {
  return AudioEngine.subscribe(onStoreChange);
}

/** Also hoisted to module scope for the same reason as `subscribe` above
 * — an inline `() => SERVER_SNAPSHOT` is a fresh function every render.
 * This one has no realistic way to trigger the loop on its own (this app
 * has no SSR hydration pass), but there's no reason to leave a second
 * unstable useSyncExternalStore argument in place once the mechanism is
 * understood. */
function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function useAudioSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
