import { useEffect, useState } from "react";
import { AudioEngine, type AudioDebugSnapshot } from "./AudioEngine";

/**
 * ==================== TEMPORARY — PRODUCTION AUDIO DIAGNOSTICS ====================
 * Whole file exists only to help diagnose the deployed "Yüklenemedi" bug from
 * a real device. Delete this file, its import/usage in SongScreen.tsx, and
 * the matching diagnostics block in AudioEngine.ts once that's resolved.
 *
 * Deliberately NOT built on useSyncExternalStore (unlike useAudioSnapshot):
 * AudioEngine.getDebugSnapshot() allocates a new object/array every call by
 * design (it's a point-in-time dump of an event log), which would violate
 * useSyncExternalStore's "getSnapshot must return a cached/stable reference
 * when nothing changed" contract and spam React's dev warning. A plain
 * subscribe-and-setState is simpler and entirely adequate for a debug-only
 * panel that's only ever mounted while `hasError` is true.
 */
export function useAudioDebugSnapshot(): AudioDebugSnapshot {
  const [snapshot, setSnapshot] = useState<AudioDebugSnapshot>(() => AudioEngine.getDebugSnapshot());

  useEffect(() => {
    setSnapshot(AudioEngine.getDebugSnapshot());
    return AudioEngine.subscribe(() => setSnapshot(AudioEngine.getDebugSnapshot()));
  }, []);

  return snapshot;
}
/** ==================== end temporary file ==================== */
