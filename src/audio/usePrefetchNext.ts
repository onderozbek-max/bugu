import { useEffect } from "react";
import type { SongConfig } from "../config/songs";
import { prefetchSourceFor } from "../config/songs";

/**
 * Warms the browser's HTTP cache for the *next* song's high-quality (not
 * lossless) source once the current song is well underway — not on mount,
 * so it never competes with the current song's own load on a weak
 * connection, and never the multi-ten-megabyte WAV master, so it never
 * turns into the "aggressively download lossless assets" behavior the
 * brief explicitly rules out.
 *
 * Uses a plain fetch() rather than <link rel=prefetch>: Safari has never
 * implemented rel=prefetch, so on the primary target platform that hint
 * would silently do nothing. A background fetch() populates the normal
 * HTTP cache on every engine, and is itself best-effort — if the response
 * isn't cacheable, or the request fails on a bad connection, this is a
 * silent no-op with no effect on the current song.
 */
const alreadyPrefetched = new Set<string>();

/** navigator.connection has no stable TS lib type yet; this is the subset
 * every implementation (Chrome/Android WebView; absent on Safari, which
 * simply skips this check entirely and always prefetches) actually has. */
interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

function networkDisallowsPrefetch(): boolean {
  const nav = navigator as Navigator & { connection?: NetworkInformationLike };
  const conn = nav.connection;
  if (!conn) return false; // no Network Information API (e.g. Safari) — proceed
  if (conn.saveData) return true;
  if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return true;
  return false;
}

export function usePrefetchNext(
  currentTime: number,
  duration: number,
  nextSong: SongConfig | undefined,
  threshold = 0.7
) {
  useEffect(() => {
    if (!nextSong) return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (currentTime / duration < threshold) return;

    const target = prefetchSourceFor(nextSong);
    if (!target) return;
    if (alreadyPrefetched.has(target.src)) return;
    if (networkDisallowsPrefetch()) return;
    alreadyPrefetched.add(target.src);

    fetch(target.src, { credentials: "same-origin" }).catch(() => {
      // weak/offline connection — fine, the next screen just loads normally
      alreadyPrefetched.delete(target.src);
    });
  }, [currentTime, duration, nextSong, threshold]);
}
