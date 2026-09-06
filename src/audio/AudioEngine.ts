import type { SongConfig, SongSource } from "../config/songs";
import { AUDIO_DELIVERY_POLICY, COMPLETION_THRESHOLD, qualityPreferenceOrder } from "../config/songs";

/**
 * One <audio> element for the entire app lifetime.
 *
 * iOS Safari only allows programmatic playback after a real user gesture
 * has unlocked *that specific element*. Creating a fresh `new Audio()` (or
 * a fresh <audio> DOM node) after the gesture — e.g. when moving from DÜN to
 * YARIN — does NOT inherit the unlock, and autoplay will silently fail.
 * So: create the element once, keep it mounted for the whole session, and
 * only ever swap its `src`.
 */

type Listener = () => void;

/**
 * ==================== TEMPORARY PRODUCTION AUDIO DIAGNOSTICS ====================
 * Added solely to find why the deployed GitHub Pages build shows
 * "Yüklenemedi" on a real device when every static check (codec, git state,
 * HTTP headers, file integrity) already came back clean. Everything below
 * this banner down to its matching end-banner is instrumentation only — it
 * observes and records events, it does NOT change fallback/error behavior.
 * Delete this block (and its call sites: the trace listener registration in
 * the constructor, the `triedIndices`/`lastPlayRejection` bookkeeping, and
 * `getDebugSnapshot()`) once the real cause is confirmed from a real
 * browser's console/UI. See src/audio/useAudioDebugSnapshot.ts (also
 * temporary) and the diagnostic block in SongScreen.tsx.
 */
const TRACE_EVENTS = [
  "loadstart",
  "loadedmetadata",
  "loadeddata",
  "canplay",
  "canplaythrough",
  "play",
  "playing",
  "pause",
  "waiting",
  "stalled",
  "suspend",
  "abort",
  "emptied",
  "error",
] as const;

const MEDIA_ERROR_MESSAGES: Record<number, string> = {
  1: "MEDIA_ERR_ABORTED — fetching process aborted (by user or script, e.g. src/load() churn)",
  2: "MEDIA_ERR_NETWORK — a network error occurred while fetching",
  3: "MEDIA_ERR_DECODE — an error occurred while decoding",
  4: "MEDIA_ERR_SRC_NOT_SUPPORTED — the source (format or file) is not supported",
};

export interface AudioTraceEntry {
  t: number;
  type: string;
  track: string | null;
  src: string;
  readyState: number;
  networkState: number;
  errorCode: number | null;
}

export interface AudioDebugSnapshot {
  trackId: string | null;
  attemptedSrc: string | null;
  tier: string | null;
  mp3FallbackAttempted: boolean;
  errorCode: number | null;
  errorMessage: string | null;
  networkState: number;
  readyState: number;
  currentSrc: string;
  canPlayMp4: string;
  canPlayMpeg: string;
  playRejection: { name: string; message: string } | null;
  eventLog: AudioTraceEntry[];
}
/** ==================== end temporary diagnostics types ==================== */

class AudioEngineImpl {
  readonly element: HTMLAudioElement;
  private currentSongId: string | null = null;
  private listeners = new Set<Listener>();
  /** Fires once per song at the 92% mark (or at `ended`, whichever comes
   * first) — used only to persist a "heard" flag as a resume safety net.
   * Must never drive stage/UI advancement (see `endedListeners`). */
  private heardListeners = new Set<(songId: string) => void>();
  /** Fires once per song on the native `ended` event only — this is what
   * should trigger moving to the next screen, since the audio has actually
   * finished rather than merely crossed a threshold mid-playback. */
  private endedListeners = new Set<(songId: string) => void>();
  private firedHeardFor = new Set<string>();
  /** Song id currently in a load/playback error state, if any. Cleared on
   * a successful loadeddata (i.e. recovered) or when a different song is
   * prepared. */
  private erroredSongId: string | null = null;
  private currentSong: SongConfig | null = null;
  /** The current song's sources, in raw config order (NOT fallback order —
   * see fallbackOrder below). */
  private sources: SongSource[] = [];
  private sourceIndex = 0;
  /** Indices into `sources`, ordered by fallback preference: first every
   * source `canPlayType()`-playable, grouped by AUDIO_DELIVERY_POLICY's
   * quality-tier order, then any remaining (theoretically unplayable)
   * sources as an absolute last resort. `sourceIndex` starts at
   * `fallbackOrder[0]`. `handleError` walks forward through THIS array,
   * not through `sources` directly — a policy that starts playback at a
   * non-zero index (e.g. "high"/AAC before "lossless"/WAV) must still be
   * able to fall through to every other source when that one fails, not
   * just the ones after it in the raw config array. Recomputed by
   * `prepare()` whenever the song changes, and by `retry()`. */
  private fallbackOrder: number[] = [];
  /** True between a `play()` call and the next `pause()`/`ended` — i.e.
   * "she asked for sound to be playing right now". Used only to decide
   * whether a source-fallback reload should resume playback afterward;
   * a stall-then-fallback must never turn audio back on that she paused. */
  private wantsPlay = false;
  /** Soft "the browser is waiting on data" signal — drives an elegant
   * loading affordance, not the hard error/retry UI. Never set `hasError`. */
  private buffering = false;

  // ---- TEMPORARY diagnostics state (see banner above) ----
  /** Every source index actually assigned to `element.src` + `load()`-ed for
   * the current song, regardless of outcome — used only to answer "was the
   * MP3 fallback actually attempted", not to gate any real behavior. */
  private triedIndices = new Set<number>();
  private lastPlayRejection: { name: string; message: string } | null = null;
  private eventLog: AudioTraceEntry[] = [];
  // ---- end temporary diagnostics state ----

  constructor() {
    this.element = new Audio();
    this.element.preload = "none";
    // playsinline only affects HTMLVideoElement fullscreen takeover; not
    // applicable to audio, and not present in HTMLAudioElement's TS type.
    this.element.setAttribute("playsinline", "true");

    this.element.addEventListener("timeupdate", this.handleTimeUpdate);
    this.element.addEventListener("ended", this.handleEnded);
    this.element.addEventListener("play", this.notify);
    this.element.addEventListener("pause", this.notify);
    this.element.addEventListener("durationchange", this.notify);
    this.element.addEventListener("error", this.handleError);
    this.element.addEventListener("loadeddata", this.handleRecovered);
    this.element.addEventListener("waiting", this.handleWaiting);
    this.element.addEventListener("stalled", this.handleWaiting);
    this.element.addEventListener("playing", this.handleReady);
    this.element.addEventListener("canplay", this.handleReady);

    // TEMPORARY: chronological trace, purely observational — added
    // alongside the functional listeners above, never replacing them, and
    // never itself calling handleError or touching fallback state.
    TRACE_EVENTS.forEach((type) => this.element.addEventListener(type, this.traceEvent));
  }

  /** TEMPORARY — logs every requested lifecycle event to the console and to
   * the in-memory eventLog the debug snapshot exposes. Never mutates
   * playback/fallback state. */
  private traceEvent = (e: Event) => {
    const el = this.element;
    const entry: AudioTraceEntry = {
      t: Math.round(performance.now()),
      type: e.type,
      track: this.currentSongId,
      src: el.currentSrc,
      readyState: el.readyState,
      networkState: el.networkState,
      errorCode: el.error?.code ?? null,
    };
    this.eventLog.push(entry);
    if (this.eventLog.length > 60) this.eventLog.shift();
    // eslint-disable-next-line no-console
    console.info(
      `[audio-trace] t=${entry.t}ms type=${entry.type} track=${entry.track} readyState=${entry.readyState} networkState=${entry.networkState} errorCode=${entry.errorCode} src=${entry.src}`
    );
    this.notify();
  };

  private notify = () => {
    this.listeners.forEach((l) => l());
  };

  private handleTimeUpdate = () => {
    this.notify();
    const { duration, currentTime } = this.element;
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (!this.currentSongId) return;
    if (this.firedHeardFor.has(this.currentSongId)) return;
    if (currentTime / duration >= COMPLETION_THRESHOLD) {
      this.firedHeardFor.add(this.currentSongId);
      this.heardListeners.forEach((cb) => cb(this.currentSongId!));
    }
  };

  private handleEnded = () => {
    if (!this.currentSongId) return;
    const id = this.currentSongId;
    if (!this.firedHeardFor.has(id)) {
      this.firedHeardFor.add(id);
      this.heardListeners.forEach((cb) => cb(id));
    }
    this.endedListeners.forEach((cb) => cb(id));
  };

  /**
   * A source failed to load/decode. If another source for this song is
   * still untried, fall through to it silently — an AAC failing to load on
   * a bad cellular connection in Kadıköy should surface as "quietly now
   * playing the WAV master", not as a broken-looking retry screen, and this
   * must hold regardless of which tier played first. Walks `fallbackOrder`
   * (every source, not just the ones after the current one in raw config
   * order) so a non-zero starting index never strands playback with
   * untried sources still sitting earlier in the array. Only once every
   * source in `fallbackOrder` has failed does this become the hard error
   * state SongScreen's retry affordance responds to.
   */
  private handleError = () => {
    if (!this.currentSongId) return;
    const pos = this.fallbackOrder.indexOf(this.sourceIndex);
    const nextPos = pos + 1;
    if (pos !== -1 && nextPos < this.fallbackOrder.length) {
      this.sourceIndex = this.fallbackOrder[nextPos];
      this.reloadCurrentSource({ resume: true });
      return;
    }
    this.erroredSongId = this.currentSongId;
    this.buffering = false;
    this.notify();
  };

  /** Re-points the element at `this.sources[this.sourceIndex]`, preserving
   * playback position and (optionally) resuming playback across the swap —
   * used by both the error-fallback path and `retry()`. */
  private reloadCurrentSource(opts: { resume: boolean }) {
    const resumeTime = this.element.currentTime;
    const shouldResumePlaying = opts.resume && this.wantsPlay;
    const next = this.sources[this.sourceIndex];
    this.element.preload = "metadata";
    this.element.src = next.src;
    this.element.load();
    this.triedIndices.add(this.sourceIndex); // TEMPORARY diagnostics

    const afterMetadata = () => {
      if (resumeTime > 0) this.element.currentTime = resumeTime;
      if (shouldResumePlaying) void this.element.play().catch(() => {});
    };
    if (this.element.readyState >= 1) {
      afterMetadata();
    } else {
      this.element.addEventListener("loadedmetadata", afterMetadata, { once: true });
    }
  }

  private handleRecovered = () => {
    if (this.erroredSongId && this.erroredSongId === this.currentSongId) {
      this.erroredSongId = null;
      this.notify();
    }
  };

  private handleWaiting = () => {
    if (this.buffering) return;
    this.buffering = true;
    this.notify();
  };

  private handleReady = () => {
    if (!this.buffering) return;
    this.buffering = false;
    this.notify();
  };

  /**
   * Orders every source index by AUDIO_DELIVERY_POLICY's quality-tier order
   * first, `canPlayType()` second — deliberately two separate questions.
   * "Is this format playable at all" is answered by the browser; "which
   * format *should* play on this delivery policy" is answered by config,
   * not by which quality tier happens to be listed first for a given song.
   * Within whichever tier wins, `canPlayType()` still gates ranking — it
   * does not distinguish "probably" from "maybe" (Safari reports
   * `audio/wav` as only "maybe" and `audio/mp4` as "probably" even when
   * both play back perfectly, so ranking by that confidence value would
   * misrepresent actual support), it only separates "reports some support"
   * from "reports zero support". Every index is included exactly once, so
   * this doubles as the full fallback chain `handleError` walks — nothing
   * is ever unreachable just because it wasn't first choice.
   */
  private computeFallbackOrder(sources: SongSource[]): number[] {
    const playable: number[] = [];
    const unplayable: number[] = [];
    for (const tier of qualityPreferenceOrder(AUDIO_DELIVERY_POLICY)) {
      sources.forEach((s, i) => {
        if (s.quality !== tier) return;
        if (this.element.canPlayType(s.type) !== "") playable.push(i);
        else unplayable.push(i);
      });
    }
    return [...playable, ...unplayable];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Marks a song "heard" (92% or ended) — for persisting completion state only. */
  onHeard(cb: (songId: string) => void): () => void {
    this.heardListeners.add(cb);
    return () => this.heardListeners.delete(cb);
  }

  /** Fires only when playback actually reaches the end — for advancing the UI. */
  onEnded(cb: (songId: string) => void): () => void {
    this.endedListeners.add(cb);
    return () => this.endedListeners.delete(cb);
  }

  /**
   * Point the shared element at a song and (optionally) seek to a resume
   * position. Deliberately does NOT call play() — every song screen opens
   * paused, and playback only ever starts from the explicit tap on the big
   * play button (a real, synchronous user-gesture call to play()). This
   * keeps the "no autoplay" rule trivially true everywhere, with no need
   * for gesture-unlock tricks on earlier taps.
   */
  prepare(song: SongConfig, resumeAt?: number) {
    const isSameSrc = this.currentSongId === song.id;
    this.currentSongId = song.id;
    this.currentSong = song;

    if (!isSameSrc) {
      this.element.pause();
      this.wantsPlay = false;
      this.buffering = false;
      if (this.erroredSongId && this.erroredSongId !== song.id) {
        this.erroredSongId = null;
      }
      // Fresh song: start from the best-fidelity source again, regardless
      // of which tier the previous song ended up falling back to.
      this.sources = song.sources;
      this.fallbackOrder = this.computeFallbackOrder(song.sources);
      this.sourceIndex = this.fallbackOrder[0] ?? 0;
      // "metadata" (not "none"): fetches just enough to get `duration` so
      // the progress bar isn't stuck at 0/NaN before the first tap, without
      // downloading the full file on a weak connection — true for the WAV
      // master exactly as it was for the old MP3s, since "metadata" never
      // asks for the whole file regardless of format. Also means the
      // loadedmetadata-gated seek below resolves before playback can start,
      // instead of racing it and producing an audible jump.
      this.element.preload = "metadata";
      this.element.src = this.sources[this.sourceIndex].src;
      this.element.load();
      this.triedIndices = new Set([this.sourceIndex]); // TEMPORARY diagnostics: reset per new song
    }

    if (resumeAt && Number.isFinite(resumeAt) && resumeAt > 0) {
      const applySeek = () => {
        this.element.currentTime = resumeAt;
      };
      if (this.element.readyState >= 1) {
        applySeek();
      } else {
        this.element.addEventListener("loadedmetadata", applySeek, { once: true });
      }
    }
  }

  play() {
    this.wantsPlay = true;
    this.lastPlayRejection = null; // TEMPORARY diagnostics: clear before new attempt
    void this.element.play().catch((err: unknown) => {
      // TEMPORARY diagnostics only — this catch already existed and already
      // swallowed the rejection unconditionally; recording it here does not
      // change that a rejected play() promise never sets hasError/erroredSongId.
      const e = err as { name?: string; message?: string } | undefined;
      this.lastPlayRejection = { name: e?.name ?? "Error", message: e?.message ?? String(err) };
      this.notify();
    });
  }

  pause() {
    this.wantsPlay = false;
    this.element.pause();
  }

  toggle() {
    if (this.element.paused) this.play();
    else this.pause();
  }

  /** True when every available source for the current song has failed. */
  get hasError(): boolean {
    return this.erroredSongId !== null && this.erroredSongId === this.currentSongId;
  }

  /** Soft "waiting on data" signal — never true at the same time as hasError. */
  get isBuffering(): boolean {
    return this.buffering;
  }

  /**
   * Re-attempts loading the current song from scratch. Called from a user
   * tap (the retry affordance), so it's also safe to attempt play()
   * directly here — this click is itself the required gesture. Starts over
   * from the best-fidelity source (index 0) rather than resuming wherever
   * the fallback chain left off — a manual retry usually means "I think the
   * connection recovered," so it's worth trying for the master again.
   */
  retry() {
    if (!this.currentSong) return;
    this.erroredSongId = null;
    this.sources = this.currentSong.sources;
    this.fallbackOrder = this.computeFallbackOrder(this.sources);
    this.sourceIndex = this.fallbackOrder[0] ?? 0;
    this.wantsPlay = true;
    this.element.preload = "metadata";
    this.element.src = this.sources[this.sourceIndex].src;
    this.element.load();
    this.triedIndices = new Set([this.sourceIndex]); // TEMPORARY diagnostics
    this.play();
  }

  /** TEMPORARY — everything a real device's browser console/UI needs to show
   * to explain a "Yüklenemedi" state. See banner near the top of this file. */
  getDebugSnapshot(): AudioDebugSnapshot {
    const el = this.element;
    const currentEntry = this.sources[this.sourceIndex] as SongSource | undefined;
    const mp3Index = this.sources.findIndex((s) => s.quality !== "high");
    return {
      trackId: this.currentSongId,
      attemptedSrc: currentEntry?.src ?? null,
      tier: currentEntry?.quality ?? null,
      mp3FallbackAttempted: mp3Index !== -1 && this.triedIndices.has(mp3Index),
      errorCode: el.error?.code ?? null,
      errorMessage: el.error ? (MEDIA_ERROR_MESSAGES[el.error.code] ?? `unknown code ${el.error.code}`) : null,
      networkState: el.networkState,
      readyState: el.readyState,
      currentSrc: el.currentSrc,
      canPlayMp4: el.canPlayType('audio/mp4; codecs="mp4a.40.2"'),
      canPlayMpeg: el.canPlayType("audio/mpeg"),
      playRejection: this.lastPlayRejection,
      eventLog: [...this.eventLog],
    };
  }

  seek(seconds: number) {
    if (!Number.isFinite(this.element.duration)) return;
    this.element.currentTime = Math.max(0, Math.min(seconds, this.element.duration));
  }

  get currentTime() {
    return this.element.currentTime;
  }

  get duration() {
    return this.element.duration;
  }

  get isPlaying() {
    return !this.element.paused && !this.element.ended;
  }

  setMediaSessionMetadata(song: SongConfig, opts: { lockNavigation?: boolean } = {}) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: "buğu",
      artwork: song.artwork ? [{ src: song.artwork }] : undefined,
    });

    // DÜN/YARIN (lockNavigation=true) deliberately leave nexttrack/
    // previoustrack/seekto unset so the lock screen / Control Center can't
    // be used to skip DÜN straight into YARIN — those two are meant to be
    // heard straight through. ŞİMDİ and Album Mode pass lockNavigation=false
    // and get real lock-screen seekto: ŞİMDİ is terminal (nothing to skip
    // ahead *into*) and is likely to be playing with the phone pocketed, so
    // Control Center is the control surface she's most likely to actually
    // reach. nexttrack/previoustrack stay unset even when unlocked — there
    // is no cross-song queue wired to the OS, only the on-screen prev/next
    // Album Mode already has.
    if (opts.lockNavigation) {
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    } else {
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) this.seek(details.seekTime);
      });
    }

    navigator.mediaSession.setActionHandler("play", () => this.play());
    navigator.mediaSession.setActionHandler("pause", () => this.pause());
  }
}

export const AudioEngine = new AudioEngineImpl();
