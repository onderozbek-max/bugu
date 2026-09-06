import { create } from "zustand";

/**
 * Journey Mode state machine.
 *
 *   opening -> dun -> yarin -> simdi
 *
 * There is deliberately no "transition" stage. The visual world is a single
 * persistent layer (see PersistentWorld) that morphs continuously across
 * these four stages — App.tsx drives that morph with its own local,
 * unpersisted timers (dunClosing/yarinRevealed/yarinClosing), and only
 * calls `advanceFromDun`/`advanceFromYarin` once the morph has run long
 * enough to feel earned. Nothing about *how* the world looks lives here —
 * this store only ever answers "which stage," never "what does it look
 * like right now."
 */
export type JourneyStage = "opening" | "dun" | "yarin" | "simdi";

interface LastProgress {
  dun?: number;
  yarin?: number;
  simdi?: number;
}

interface JourneyState {
  stage: JourneyStage;
  dunCompleted: boolean;
  yarinCompleted: boolean;
  /** "Heard" (92%+/ended) at least once. Unlike dunCompleted/yarinCompleted
   * this drives no advance — ŞİMDİ is terminal and freely replayable — it
   * exists only so a future addition (e.g. an Album-Mode "played before"
   * mark) has somewhere to read from without re-deriving it from progress. */
  simdiCompleted: boolean;
  lastProgress: LastProgress;

  begin: () => void;
  /** Marks DÜN "heard" (92% or ended) — persists the flag only, no stage change. */
  markDunHeard: () => void;
  /** Moves to YARIN. Called once, from App.tsx's own closing-choreography
   * timer — never directly from an audio event — so the visual morph has
   * time to run before the next stage's UI can appear. */
  advanceFromDun: () => void;
  /** Marks YARIN "heard" (92% or ended) — persists the flag only, no stage change. */
  markYarinHeard: () => void;
  /** Moves to the live, playable ŞİMDİ stage. Same pattern as advanceFromDun. */
  advanceFromYarin: () => void;
  /** Marks ŞİMDİ "heard" — persists the flag only. There is deliberately no
   * advanceFromSimdi: ŞİMDİ is the last stage, and it stays playable/
   * replayable in place rather than moving anywhere afterward. */
  markSimdiHeard: () => void;
  setProgress: (song: "dun" | "yarin" | "simdi", seconds: number) => void;
}

const STORAGE_KEY = "bugu.journey.v1";

interface PersistedShape {
  stage: JourneyStage;
  dunCompleted: boolean;
  yarinCompleted: boolean;
  simdiCompleted: boolean;
  lastProgress: LastProgress;
}

function loadPersisted(): PersistedShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    if (!parsed || typeof parsed !== "object") return null;
    // A stage of "transition" can only exist in storage written by a
    // pre-refactor build — treat it as "dun" (the morph itself is
    // ephemeral and was never worth persisting, so there is nothing to
    // resume into; re-entering "dun" just resumes the song normally).
    const rawStage: string | undefined = parsed.stage;
    const stage = rawStage === "transition" ? "dun" : rawStage ?? "opening";
    return {
      stage: stage as JourneyStage,
      dunCompleted: Boolean(parsed.dunCompleted),
      yarinCompleted: Boolean(parsed.yarinCompleted),
      simdiCompleted: Boolean(parsed.simdiCompleted),
      lastProgress: parsed.lastProgress ?? {},
    };
  } catch {
    return null;
  }
}

function persist(state: PersistedShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode, quota) — journey simply won't
    // survive a refresh; nothing else should break.
  }
}

const initial = loadPersisted();

export const useJourneyStore = create<JourneyState>((set, get) => ({
  stage: initial?.stage ?? "opening",
  dunCompleted: initial?.dunCompleted ?? false,
  yarinCompleted: initial?.yarinCompleted ?? false,
  simdiCompleted: initial?.simdiCompleted ?? false,
  lastProgress: initial?.lastProgress ?? {},

  begin: () => {
    set({ stage: "dun" });
    persistCurrent(get);
  },

  markDunHeard: () => {
    if (get().dunCompleted) return;
    set({ dunCompleted: true });
    persistCurrent(get);
  },

  advanceFromDun: () => {
    if (!get().dunCompleted) set({ dunCompleted: true });
    set({ stage: "yarin" });
    persistCurrent(get);
  },

  markYarinHeard: () => {
    if (get().yarinCompleted) return;
    set({ yarinCompleted: true });
    persistCurrent(get);
  },

  advanceFromYarin: () => {
    if (!get().yarinCompleted) set({ yarinCompleted: true });
    set({ stage: "simdi" });
    persistCurrent(get);
  },

  markSimdiHeard: () => {
    if (get().simdiCompleted) return;
    set({ simdiCompleted: true });
    persistCurrent(get);
  },

  setProgress: (song, seconds) => {
    set((s) => ({ lastProgress: { ...s.lastProgress, [song]: seconds } }));
    persistCurrent(get);
  },
}));

function persistCurrent(get: () => JourneyState) {
  const { stage, dunCompleted, yarinCompleted, simdiCompleted, lastProgress } = get();
  persist({ stage, dunCompleted, yarinCompleted, simdiCompleted, lastProgress });
}

/**
 * Boot-time guard against corrupted storage only — NOT a "skip ahead"
 * mechanism. Deliberately does NOT advance `stage` just because a
 * completion flag is true: `dunCompleted`/`yarinCompleted` can legitimately
 * become true (the 92% "heard" mark) well before the song actually ends,
 * specifically so that closing the app in that window and reopening
 * resumes the rest of the song rather than skipping to the next stage —
 * she should still get to hear DÜN's and YARIN's real endings. Advancing
 * stage happens only through `advanceFromDun`/`advanceFromYarin`, called
 * from App.tsx's own closing choreography on the *next* live session, not
 * retroactively here.
 *
 * The one thing this does correct: a stage of "yarin"/"dun" persisted
 * before its own prior stage's audio was ever prepared (e.g. "yarin" with
 * no dunCompleted at all) — storage state that shouldn't be reachable
 * through normal use, but would otherwise strand the app on a screen with
 * no valid resume position.
 */
export function reconcileStageOnBoot() {
  const s = useJourneyStore.getState();
  if (s.stage === "yarin" && !s.dunCompleted) {
    useJourneyStore.setState({ stage: "dun" });
  }
}
