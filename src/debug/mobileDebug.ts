/**
 * ==================== TEMPORARY — MOBILE BLACK-SCREEN DIAGNOSTICS ====================
 * Small module-level bus + global error capture for MobileDebugOverlay.tsx.
 * Deliberately NOT React state/context: the overlay is mounted as a SEPARATE
 * React root outside #root specifically so it survives whatever is making
 * #root's contents disappear — it must not depend on the same component
 * tree that might be failing. Delete this file, MobileDebugOverlay.tsx,
 * mobileDebugOverrides.css, and their wiring in main.tsx/App.tsx once the
 * mobile rendering bug is fixed.
 */

export interface JourneyDebugState {
  stage: string;
  phase: string;
  lastTransition: string;
}

let journeyState: JourneyDebugState = { stage: "opening", phase: "opening", lastTransition: "boot" };
const journeyListeners = new Set<() => void>();

export function setDebugJourney(stage: string, phase: string) {
  const changed = journeyState.stage !== stage || journeyState.phase !== phase;
  journeyState = {
    stage,
    phase,
    lastTransition: changed
      ? `${journeyState.stage}/${journeyState.phase} -> ${stage}/${phase} @ ${new Date().toISOString().slice(11, 23)}`
      : journeyState.lastTransition,
  };
  journeyListeners.forEach((l) => l());
}

export function getDebugJourney(): JourneyDebugState {
  return journeyState;
}

export function subscribeDebugJourney(cb: () => void): () => void {
  journeyListeners.add(cb);
  return () => journeyListeners.delete(cb);
}

// ---- global runtime error capture (page-wide, installed once at import) ----
export interface RuntimeErrorEntry {
  t: string;
  kind: "error" | "unhandledrejection";
  message: string;
}

const runtimeErrors: RuntimeErrorEntry[] = [];
const MAX_RUNTIME_ERRORS = 20;

function pushRuntimeError(entry: RuntimeErrorEntry) {
  runtimeErrors.push(entry);
  if (runtimeErrors.length > MAX_RUNTIME_ERRORS) runtimeErrors.shift();
}

export function getRuntimeErrors(): RuntimeErrorEntry[] {
  return runtimeErrors;
}

let installed = false;
export function installGlobalErrorCapture() {
  if (installed) return;
  installed = true;
  window.addEventListener("error", (e) => {
    pushRuntimeError({
      t: new Date().toISOString().slice(11, 23),
      kind: "error",
      message: `${e.message} (${e.filename}:${e.lineno}:${e.colno})`,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason as { message?: string; name?: string } | undefined;
    pushRuntimeError({
      t: new Date().toISOString().slice(11, 23),
      kind: "unhandledrejection",
      message: reason?.message ? `${reason.name ?? "Error"}: ${reason.message}` : String(e.reason),
    });
  });
}

/** Recognized `?flag=1` URL params -> `data-dbg-<lowercase>` attributes on
 * <html>, read once at boot in main.tsx. See mobileDebugOverrides.css for
 * what each one disables. `mobileDebug` itself just controls whether the
 * overlay mounts at all. */
export const DEBUG_FLAG_PARAMS = [
  "mobileDebug",
  "noBlend",
  "noSvgFilter",
  "noAnim",
  "noGrain",
  "noIsolate",
  "noSongAnim",
  "flat",
] as const;

export function applyDebugFlagsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  for (const key of DEBUG_FLAG_PARAMS) {
    if (params.get(key) === "1") {
      document.documentElement.setAttribute(`data-dbg-${key.toLowerCase()}`, "");
    }
  }
}

export function isMobileDebugEnabled(): boolean {
  return document.documentElement.hasAttribute("data-dbg-mobiledebug");
}
/** ==================== end temporary file ==================== */
