/**
 * Web Audio analysis for the V2 laboratory.
 *
 * Derives a small set of heavily-smoothed musical signals from a live
 * HTMLAudioElement. These signals are intended for visual mapping, not for
 * technical measurement — accuracy to individual bins matters less than
 * stable, emotionally-legible values.
 *
 * IMPORTANT CONSTRAINTS:
 *   - `createMediaElementSource` can be called ONLY ONCE per element across
 *     the page lifetime. Subsequent calls throw. We cache the node in a
 *     WeakMap to prevent double-creation if connect() is called more than
 *     once.
 *   - AudioContext must be resumed from within a user-gesture handler.
 *     Call `resume()` synchronously on the play-button tap, BEFORE calling
 *     AudioEngine.toggle(), or the analyser will read zeros while audio plays.
 *   - This module is ONLY used by the lab (?lab=1). Never import it from
 *     the production journey — the source-node rerouting must not happen
 *     unless the lab is actually running.
 */

export interface AudioSignals {
  /** Overall weighted RMS energy: 0–1 */
  energy: number;
  /** Low-frequency energy (sub-bass + bass ≈ 43–344 Hz): 0–1 */
  bass: number;
  /** Mid-frequency energy (≈ 387–2365 Hz): 0–1 */
  mid: number;
  /** Presence/high energy (≈ 2408–6880 Hz): 0–1 */
  high: number;
  /** Transient intensity: 0–1, fast attack, slow decay */
  transient: number;
  /** false when Web Audio is unavailable — visual falls back to authored state */
  isActive: boolean;
}

const ZERO_SIGNALS: AudioSignals = {
  energy: 0, bass: 0, mid: 0, high: 0, transient: 0, isActive: false,
};

/**
 * Asymmetric exponential smoothing: fast attack (sounds respond quickly),
 * slow decay (brightness lingers naturally rather than cutting instantly).
 * This asymmetry is what makes audio reactivity feel physically real.
 */
function smooth(current: number, target: number, attackAlpha: number, decayAlpha: number): number {
  const alpha = target > current ? attackAlpha : decayAlpha;
  return current + (target - current) * alpha;
}

function bandAvg(data: Uint8Array<ArrayBuffer>, from: number, to: number): number {
  let sum = 0;
  const end = Math.min(to, data.length - 1);
  for (let i = from; i <= end; i++) sum += data[i];
  return sum / ((end - from + 1) * 255);
}

/** WeakMap prevents double-creation if the element is reused across calls. */
const cachedSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

export class AudioAnalyzer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private _connected = false;

  // Internal smoothed state
  private _energy = 0;
  private _bass = 0;
  private _mid = 0;
  private _high = 0;
  private _fastEnergy = 0;
  private _slowEnergy = 0;
  private _transient = 0;

  private _lastSignals: AudioSignals = { ...ZERO_SIGNALS };

  /**
   * Connect to an HTMLAudioElement. Safe to call multiple times — returns
   * true immediately if already connected. Returns false if Web Audio is
   * unavailable (e.g., restricted environment); caller should fall back to
   * authored-only visual state.
   */
  connect(element: HTMLAudioElement): boolean {
    if (this._connected) return true;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0; // we do our own smoothing

      // Reuse cached source node if this element was already tapped
      let source = cachedSources.get(element);
      if (!source) {
        source = ctx.createMediaElementSource(element);
        // Keep audio audible — source reroutes output into the Web Audio graph
        source.connect(ctx.destination);
        cachedSources.set(element, source);
      }
      source.connect(analyser);

      this.audioCtx = ctx;
      this.analyser = analyser;
      this.dataArray = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      this._connected = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resume the AudioContext. MUST be called from within a user-gesture
   * handler (e.g. the play-button's onClick), not from within rAF or a
   * timeout. Mobile Safari and Chrome both require this.
   */
  async resume(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state !== "running") {
      await this.audioCtx.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === "running") {
      await this.audioCtx.suspend();
    }
  }

  /**
   * Called once per rAF frame. Reads the analyser, updates smoothed
   * signals, and returns the current AudioSignals. Must NOT be called
   * from React render or state setters — only from the renderer's own
   * rAF loop.
   */
  tick(): AudioSignals {
    if (!this.analyser || !this._connected) return ZERO_SIGNALS;

    this.analyser.getByteFrequencyData(this.dataArray);
    const d = this.dataArray;

    // Frequency band extraction
    // 1024-point FFT at ~44.1 kHz → ~43 Hz per bin
    const rawBass = bandAvg(d, 1, 8);    // ~43–344 Hz
    const rawMid  = bandAvg(d, 9, 55);   // ~387–2365 Hz
    const rawHigh = bandAvg(d, 56, 160); // ~2408–6880 Hz
    const rawEnergy = rawBass * 0.50 + rawMid * 0.35 + rawHigh * 0.15;

    // Smooth with asymmetric attack/decay
    this._bass   = smooth(this._bass,   rawBass,   0.35, 0.10);
    this._mid    = smooth(this._mid,    rawMid,    0.30, 0.08);
    this._high   = smooth(this._high,   rawHigh,   0.25, 0.07);
    this._energy = smooth(this._energy, rawEnergy, 0.25, 0.08);

    // Transient detection: fast EMA vs. slow EMA
    // When fast-average significantly exceeds slow-average, a transient occurred.
    this._fastEnergy = this._fastEnergy * 0.55 + rawEnergy * 0.45;
    this._slowEnergy = this._slowEnergy * 0.975 + rawEnergy * 0.025;
    const rawTransient = Math.max(0, this._fastEnergy - this._slowEnergy)
      / (this._slowEnergy + 0.01);
    this._transient = smooth(this._transient, Math.min(1, rawTransient * 2.5), 0.45, 0.06);

    this._lastSignals = {
      energy: this._energy,
      bass: this._bass,
      mid: this._mid,
      high: this._high,
      transient: this._transient,
      isActive: true,
    };
    return this._lastSignals;
  }

  get lastSignals(): AudioSignals {
    return this._lastSignals;
  }

  get isConnected(): boolean {
    return this._connected;
  }
}
