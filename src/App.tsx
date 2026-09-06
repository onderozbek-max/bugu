import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { songs } from "./config/songs";
import { useJourneyStore, type JourneyStage } from "./state/journeyStore";
import { isAlbumMode, pollRemoteAlbumModeFlag } from "./state/albumMode";
import { AudioEngine } from "./audio/AudioEngine";
import { useAudioSnapshot } from "./audio/useAudioEngine";
import { Opening } from "./screens/Opening";
import { SongScreen } from "./screens/SongScreen";
import { AlbumHome } from "./screens/AlbumHome";
import { FadeTransition } from "./components/FadeTransition";
import { PersistentWorld, type WorldPhase } from "./world/PersistentWorld";

/** Chrome-fade hold before DÜN's `ended` flips the persisted stage. The
 * world itself starts transforming immediately (see computePhase) — this
 * is only how long DÜN's own title/controls take to recede first. One
 * fixed timer, not gated on any animation callback. */
const DUN_STAGE_ADVANCE_MS = 2600;

/** How long after *live-arriving* at "yarin" this session before its title
 * and play control are allowed to appear — gives the world's own ~7s
 * transformation room to get underway first, so YARIN emerges from DÜN
 * rather than popping in the instant the stage changes. Not applied when
 * a boot/refresh lands directly on "yarin" — there's no live morph to
 * wait out in that case, and she should see something usable immediately. */
const YARIN_REVEAL_DELAY_MS = 2600;

/** The digital climax's duration: from YARIN ending to arriving at ŞİMDİ.
 * Deliberately generous — the most important transition in the experience
 * is not allowed to feel rushed. */
const YARIN_STAGE_ADVANCE_MS = 5200;

/** If YARIN's audio stalls at the very tail on a weak connection and never
 * fires `ended` this session, this forces the same closing sequence
 * anyway once "heard" (92%) has fired — there must always be a route into
 * ŞİMDİ, not just the optimistic one. */
const YARIN_WATCHDOG_MS = 20000;

/** How long after *live-arriving* at "simdi" this session before its title
 * and play control appear — the brief's "world resolves -> ŞİMDİ appears ->
 * short pause -> play control becomes available" beat. Not applied when a
 * boot/refresh lands directly on "simdi" — there's no live settling to wait
 * out in that case, and she should be able to press play immediately. */
const SIMDI_REVEAL_DELAY_MS = 2200;

function computePhase(stage: JourneyStage, dunClosing: boolean, yarinClosing: boolean): WorldPhase {
  if (stage === "opening") return "opening";
  if (stage === "dun") return dunClosing ? "yarin" : "dun";
  if (stage === "yarin") return yarinClosing ? "convergence" : "yarin";
  return "presence"; // stage === "simdi"
}

export default function App() {
  const [albumMode, setAlbumMode] = useState(isAlbumMode);
  const stage = useJourneyStore((s) => s.stage);
  const lastProgress = useJourneyStore((s) => s.lastProgress);
  const markDunHeard = useJourneyStore((s) => s.markDunHeard);
  const advanceFromDun = useJourneyStore((s) => s.advanceFromDun);
  const markYarinHeard = useJourneyStore((s) => s.markYarinHeard);
  const advanceFromYarin = useJourneyStore((s) => s.advanceFromYarin);
  const markSimdiHeard = useJourneyStore((s) => s.markSimdiHeard);
  const { hasError } = useAudioSnapshot();

  const [dunClosing, setDunClosing] = useState(false);
  const [yarinClosing, setYarinClosing] = useState(false);
  // Default true: covers boot/refresh landing directly on "yarin"/"simdi"
  // (no live morph in this session to wait out) and every stage where it's
  // simply irrelevant. Only ever set false by the live dun->yarin or
  // yarin->simdi arrival below.
  const [yarinRevealed, setYarinRevealed] = useState(true);
  const [simdiRevealed, setSimdiRevealed] = useState(true);
  const prevStageRef = useRef(stage);

  // One-shot check against the admin remote flag / static JSON fallback
  // (see state/albumMode.ts). Not polled on an interval here — the
  // guaranteed path is that any *fresh* load picks it up via isAlbumMode()
  // above; this is a courtesy for a tab already open when the flag flips.
  useEffect(() => {
    if (albumMode) return;
    let cancelled = false;
    void pollRemoteAlbumModeFlag().then((unlocked) => {
      if (unlocked && !cancelled) setAlbumMode(true);
    });
    return () => {
      cancelled = true;
    };
  }, [albumMode]);

  // DÜN's closing choreography. `ended` fades DÜN's own chrome and starts
  // the world moving toward YARIN's target immediately; a single fixed
  // timer (not an animation callback) advances the persisted stage after
  // that hold. If she refreshes mid-hold, dunCompleted is already
  // persisted (see AudioEngine: heard always fires alongside ended) and
  // she resumes on "dun" near the very end — safe, not broken.
  const handleDunEnded = useCallback(() => {
    setDunClosing(true);
    window.setTimeout(advanceFromDun, DUN_STAGE_ADVANCE_MS);
  }, [advanceFromDun]);

  // The reveal delay for YARIN's and ŞİMDİ's chrome — only armed the moment
  // `stage` *changes* live into one of them while this component is
  // mounted, never on an initial boot that already reads that stage from
  // storage (nothing to wait out there; she should be able to press play
  // immediately on a refresh).
  useEffect(() => {
    const prev = prevStageRef.current;
    prevStageRef.current = stage;
    if (prev !== "yarin" && stage === "yarin") {
      setYarinRevealed(false);
      const t = window.setTimeout(() => setYarinRevealed(true), YARIN_REVEAL_DELAY_MS);
      return () => window.clearTimeout(t);
    }
    if (prev !== "simdi" && stage === "simdi") {
      setSimdiRevealed(false);
      const t = window.setTimeout(() => setSimdiRevealed(true), SIMDI_REVEAL_DELAY_MS);
      return () => window.clearTimeout(t);
    }
  }, [stage]);

  // YARIN's closing choreography — the digital climax. Three ways in,
  // exactly one way through (closeResolvedRef guarantees a single fire no
  // matter which trigger reaches it first):
  //   1. native `ended` — the normal path.
  //   2. a watchdog armed once "heard" (92%) fires, in case a weak
  //      connection stalls the last 8% and `ended` never arrives this
  //      session.
  //   3. a load/playback error arriving after "heard" already fired —
  //      no reason to make her wait out the watchdog for a failure that's
  //      already happened.
  const closeResolvedRef = useRef(false);
  const heardFiredRef = useRef(false);
  const advanceTimerRef = useRef<number | undefined>(undefined);

  const beginYarinClosing = useCallback(() => {
    if (closeResolvedRef.current) return;
    closeResolvedRef.current = true;
    setYarinClosing(true);
    advanceTimerRef.current = window.setTimeout(advanceFromYarin, YARIN_STAGE_ADVANCE_MS);
  }, [advanceFromYarin]);

  useEffect(() => {
    if (stage !== "yarin") return;
    closeResolvedRef.current = false;
    heardFiredRef.current = false;
    setYarinClosing(false);
    let watchdog: number | undefined;

    const unsubscribeEnded = AudioEngine.onEnded((id) => {
      if (id === "yarin") beginYarinClosing();
    });
    const unsubscribeHeard = AudioEngine.onHeard((id) => {
      if (id !== "yarin") return;
      heardFiredRef.current = true;
      watchdog = window.setTimeout(beginYarinClosing, YARIN_WATCHDOG_MS);
    });

    return () => {
      unsubscribeEnded();
      unsubscribeHeard();
      if (watchdog !== undefined) window.clearTimeout(watchdog);
      if (advanceTimerRef.current !== undefined) window.clearTimeout(advanceTimerRef.current);
    };
  }, [stage, beginYarinClosing]);

  useEffect(() => {
    if (stage !== "yarin" || !hasError || !heardFiredRef.current) return;
    beginYarinClosing();
  }, [stage, hasError, beginYarinClosing]);

  if (albumMode) {
    return <AlbumHome />;
  }

  const phase = computePhase(stage, dunClosing, yarinClosing);

  return (
    <>
      {/* Mounted once, for the entire Journey Mode session. Never
          unmounted or replaced between stages — only `phase` changes,
          and PersistentWorld tweens continuously between whatever it
          currently looks like and the new target. This is the one thing
          that must never cut. */}
      <PersistentWorld phase={phase} />

      {/* No mode="wait": exit and enter run concurrently (both screens
          position:absolute/inset:0) rather than sequentially, so this
          foreground chrome layer can crossfade without ever implying the
          world underneath reset too. */}
      <AnimatePresence>
        {stage === "opening" && (
          <FadeTransition key="opening">
            <Opening />
          </FadeTransition>
        )}

        {stage === "dun" && (
          <FadeTransition key="dun">
            <SongScreen
              song={songs.dun}
              seekable={false}
              resumeAt={lastProgress.dun}
              onHeard={markDunHeard}
              onEnded={handleDunEnded}
              lockMediaSessionNav
              nextSong={songs.yarin}
              persistProgress
              closing={dunClosing}
            />
          </FadeTransition>
        )}

        {stage === "yarin" && yarinRevealed && (
          <FadeTransition key="yarin">
            <SongScreen
              song={songs.yarin}
              seekable={false}
              resumeAt={lastProgress.yarin}
              onHeard={markYarinHeard}
              lockMediaSessionNav
              nextSong={songs.simdi}
              persistProgress
              closing={yarinClosing}
            />
          </FadeTransition>
        )}

        {/* ŞİMDİ is a complete, playable song, not a wordless hold — this
            is the load-bearing reversal of the old design: the real-world
            proposal happens in a busy metro environment with no friend
            cueing her and no remote unlock, so ŞİMDİ has to play on her own
            phone, from her own tap, exactly like DÜN and YARIN did. It stays
            playable/seekable/replayable in place afterward — there is
            nowhere further for Journey Mode to advance to. */}
        {stage === "simdi" && simdiRevealed && (
          <FadeTransition key="simdi" duration={1.8}>
            <SongScreen
              song={songs.simdi}
              seekable
              resumeAt={lastProgress.simdi}
              onHeard={markSimdiHeard}
              lockMediaSessionNav={false}
              persistProgress
            />
          </FadeTransition>
        )}
      </AnimatePresence>
    </>
  );
}
