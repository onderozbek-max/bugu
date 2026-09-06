# Changelog

## ŞİMDİ becomes playable; Horizon visual system replaces the gradient world

**Architecture reversal, explicitly authorized by the proposal owner:** the
real-world proposal happens in a busy Kadıköy metro environment with no
speaker, no quiet room, no friend cueing Buğu, and no remote unlock at an
exact second. ŞİMDİ can no longer be a silent, non-playable hold screen —
it is now a complete, playable Journey Mode song, identical in kind to
DÜN/YARIN, that she starts herself before continuing to walk toward the
proposal.

- `src/screens/SimdiWord.tsx` (and its CSS) deleted. `App.tsx` renders
  ŞİMDİ as a `SongScreen` instance: seekable, resumable, with play/pause,
  progress, and sözler — same chrome family as DÜN/YARIN, revealed after a
  short pause once the world has settled (`SIMDI_REVEAL_DELAY_MS`).
- `AudioEngine.releaseForHold()` deleted — it existed only to blank
  MediaSession for the screen that no longer exists.
- `journeyStore`: added `lastProgress.simdi` and `markSimdiHeard` (persist
  only — there is no `advanceFromSimdi`; ŞİMDİ is terminal and stays
  playable/replayable in place).
- ŞİMDİ gets `lockMediaSessionNav={false}` and a wired `seekto` handler —
  nothing to skip ahead into, and Control Center is the control surface
  she's likeliest to reach with the phone pocketed.
- **Real bug found and fixed while wiring this up:** `AudioEngine`'s
  source-fallback only ever walked forward through the raw config array
  from wherever `AUDIO_DELIVERY_POLICY` started playback. Since the
  default policy starts at the AAC/M4A tier (index 1), a failed AAC had no
  path back to the WAV master sitting at index 0. Replaced with a
  precomputed `fallbackOrder` (every source, ranked by policy tier, then
  `canPlayType`) that both the initial pick and the error handler walk —
  exactly the scenario ("ŞİMDİ fails to load on cellular in Kadıköy")
  this whole rebuild exists to prevent.

**New persistent visual metaphor: a single horizon line.** The previous
world (`lift`/`density`/`tone`/`resolve` driving a radial gradient + two
glow blobs + grain) was correctly flagged as "a color shift, not a
narrative transformation." Replaced with one construct present in every
chapter: a horizontal line, buried and crowded by texture in DÜN, rising
and clearing in YARIN, settling calm/centered/fully sharp in ŞİMDİ.
`PersistentWorld.tsx`'s `WorldTarget` is now `{horizonY, crowd, clarity,
spread, driftSeconds, tone, resolve}`; `songs.ts`'s `SongWorld` renamed
`lift`/`density` → `horizonY`/`crowd` to match. `ProgressBar` is
restyled to read as a lit continuation of that same line (hairline +
matching glow), so the player and the world share a visual language
rather than the player looking like controls placed on a background.

**Contrast fixes** (YARIN's title/controls/progress were reported as
reading near-invisible — pale ink on a pale wash): the ambient gradient
now always mixes heavily toward `--void` before it can cover any real
area of the frame (color lives on the line and small glow accents, not as
a wash behind text); YARIN's accent changed from an icy `#cfe3ff` to a
warm dawn gold `#e3ab66` (warmer than clinical blue, per the brief, and
easier to keep dark-enough-behind-text); every chrome layer gets a fixed
`chrome-scrim-top`/`chrome-scrim-bottom` dark vignette behind whichever
edge it anchors to, as a floor independent of whatever the world is doing
that frame; Opening's `başla` changed from an opacity-only text link to a
filled `--ink` pill (unmistakably tappable, not merely "premium").

**DÜN's composition** was title-in-a-corner + independently-centered
controls. `SongScreen` now composes title+controls as one `__stage` unit
that moves, fades, and settles together, anchored by the song's own
`horizonY` — DÜN's line was also nudged from `clarity: 0.22` to `0.3`
after testing showed it could read as fully invisible once compounded
with the new contrast scrim at DÜN's bottom-anchored position.

**Lyrics sheet** changed from a ~96%-opaque solid panel (read as a native
OS drawer) to a translucent, blurred layer (`backdrop-filter: blur(28px)
saturate(150%)`) that keeps the world's hue bleeding through, with a lit
hairline handle matching the horizon-line/progress-bar visual language
instead of a generic gray pill.

**Album Mode**'s list is no longer a plain vertical stack: each song sits
at its own `horizonY` position along one shared vertical axis (DÜN low,
YARIN high, ŞİMDİ centered) with a connecting throughline, mirroring the
same relationship the horizon draws during Journey Mode.

**Reduced motion:** `LyricsSheet`'s scrim/sheet entrance didn't check
`prefersReducedMotion()` at all — fixed (shorter duration; same animated
property, not a property swap — see below).

**A note on process, not just output:** while testing the lyrics sheet
enter animation in browser automation, it was observed stuck at its
initial (fully off-screen) position. Two plausible causes were tried and
fixed (`AnimatePresence` given a real child array instead of children
wrapped in a Fragment; the reduced-motion branch no longer switches which
property is animated between renders) — but the actual, confirmed cause
was that the automation tab's `document.visibilityState` stayed `"hidden"`
for the whole session, which fully suspends Framer Motion's
`requestAnimationFrame`-driven tweens. Both code changes are kept as
genuinely safer patterns, but neither was proven to be the bug, and this
is flagged explicitly rather than claimed as a fix — see the QA report
for what still needs a real, foregrounded-device pass.

## Architectural overhaul: one persistent world, not several screens

A structural critique (reviewed as a creative director/narrative
designer/mobile UX designer, against the actual implementation rather
than the spec) found the build was still structurally a slideshow: DÜN
screen → Transition screen (with a "devam et" button) → YARIN screen →
circular contraction to black → a freshly-mounted ŞİMDİ text component.
Locked narrative (BUĞU→DÜN→YARIN→ŞİMDİ hold→proposal→Album Mode) is
unchanged; how it's rendered is not.

**The world is now one component, mounted once.** `src/world/
PersistentWorld.tsx` is the only thing on screen behind the foreground
chrome in either mode, for the entire session. It never unmounts between
DÜN/YARIN/ŞİMDİ — only five plain numbers (`lift`, `density`,
`driftSeconds`, `tone`, `resolve`) change, continuously tweened via
Framer Motion's imperative `animate()` writing CSS custom properties
directly. `src/components/SongWorld.tsx` (a per-screen mount) is gone.

**The "devam et" Transition screen is gone.** `src/screens/Transition.tsx`
deleted. DÜN ending now starts the world morphing toward YARIN
immediately; a single fixed timer (not an animation callback — this
codebase has hit the "gate a state change on onAnimationComplete" mistake
twice before) advances the persisted stage after a hold, and YARIN's own
title/play button only appear once that morph has had time to feel
underway. The `"transition"` journey stage no longer exists.

**YARIN→ŞİMDİ no longer contracts to black.** The old closing iris
(`clip-path: circle()` down to a point, then a separately-mounted
`SimdiHold` on a fresh black background) is gone. YARIN ending pushes the
world into a `"convergence"` phase (density briefly returns — DÜN's
texture and YARIN's light visibly pulling together — while an ivory veil
grows from the center and everything else slows toward stillness), then
`"presence"` once fully resolved. `src/screens/SimdiWord.tsx` (replacing
`SimdiHold.tsx`) mounts on top of an already-still world and fades in on
its own timeline — the word reads as something the world resolved into,
not something React mounted over a black screen.

**A real, previously-undetected bug in stage-boot reconciliation is
fixed.** The old `reconcileStageOnBoot` forced `stage: "dun"` →
`"transition"` the instant `dunCompleted` became true — which happens at
the 92% mark, before `ended`. Crossing 92%, closing the app, and
reopening therefore skipped the rest of the song, including its actual
ending. `journeyStore.ts` no longer infers stage from completion flags at
all; a refresh always resumes the current stage at its last known
position, and only a real `ended` event (this session or next) advances
it. This was a genuine risk to the exact moment the brief cared about
most, not a hypothetical.

**Audio delivery is now policy-driven, not array-order-driven.**
`AudioEngine.pickSourceIndex` previously picked the first source in
`SongConfig.sources` the browser could play at all — meaning a WAV listed
first (for archival readability) would actually stream first on
cellular. `AUDIO_DELIVERY_POLICY` (`"auto-mobile"` by default) now
decides which quality tier to prefer; `canPlayType()` still gates the
actual pick within that tier, but "WAV support" and "WAV-first cellular
streaming" are explicitly two different decisions now.

**Album Mode shares a `PersistentWorld` instance across the list and
every song** (crossfading target parameters with a short, library-
appropriate duration rather than the Journey's cinematic pacing) instead
of each song rendering its own background. The list gained an entrance
stagger fix for reduced motion, and a footer that renders
`proposal.date`/`location`/`note` only when non-empty — no invented copy.

**A hidden `/admin` route replaces "edit a JSON file or an env var" as
the primary Album Mode switch.** Passphrase-gated (SHA-256 hash compared
client-side, never the plaintext), one action, one confirmation step.
Writes to an optional `VITE_ALBUM_FLAG_ENDPOINT` for a genuine global
flag Buğu's phone picks up on its own; honest on-screen messaging when
that endpoint isn't configured (unlocks only the device you're standing
on, and says so, rather than implying a global flip that didn't happen).
No real backend is provisioned by this repo — README documents three
minimal recipes (Cloudflare Worker+KV, Firebase RTDB REST, Supabase) —
fabricating working credentials for a hosted service I can't verify would
be worse than being upfront that one still needs to be stood up.

**Reduced-motion coverage completed.** `FadeTransition`, `Opening`'s
blur-clear entrance, and `AlbumHome`'s list stagger previously ignored
`prefers-reduced-motion` entirely (a gap flagged but not fixed in the
previous pass) — all three now check it explicitly and land on the same
finished composition, just faster, rather than relying on the blanket CSS
media query that only ever covered plain CSS transitions.

**Dead code removed, not left behind.** `Transition.tsx/.css`,
`SimdiHold.tsx/.css`, `SongWorld.tsx/.css`, and the `"transition"` journey
stage are deleted, not deprecated-in-place. `SongScreen.tsx` no longer
owns any world-rendering or closing-choreography logic — that moved to
`App.tsx` (the one place actually coordinating stage + world + chrome)
and it's now pure chrome (title/play/progress/sözler). The stale
`rollup` version override in `package.json` — a workaround for this
sandbox's own network restrictions, not a real dependency conflict — is
removed.

**Build verification, not just static review.** Unlike every previous
pass, `node_modules` in this sandbox turned out to already contain a
working `tsc`/`vite` install. `tsc -b` passes with zero errors; `vite
build` succeeds (285KB JS / 93KB gzipped); a local `vite preview` boot
serves `200` on both `/` and `/admin`. This is real evidence the code
compiles and bundles — it is not evidence anything renders, animates, or
sounds correct in an actual browser, which still has not been observed.

## Audio: lossless/multi-source pipeline

The original request assumed MP3 delivery. That was replaced with a
config-driven, multi-source pipeline that preserves master audio fidelity
while staying reliable on cellular:

- **`SongConfig.audioSrc: string` → `SongConfig.sources: SongSource[]`**
  (`{ src, type, quality }`, ordered highest-fidelity-first). Nothing
  transcodes or normalizes automatically — the engine only ever selects
  between files you provide. `src/config/songs.ts`.
- **`AudioEngine` now picks a source via `canPlayType()`**, taking the
  first entry the browser reports it can play at all — deliberately not
  reranked by "probably"/"maybe" confidence, since Safari under-reports
  WAV support relative to AAC even though both play correctly, and
  reranking would silently demote the lossless master on the one device
  this is built for.
- **Source-level fallback on `error`**: if the selected source fails, the
  engine falls through to the next lower tier, preserving playback
  position and resuming automatically only if it was already playing
  (tracked via a `wantsPlay` flag, so a stall-then-fallback can never turn
  sound back on that was deliberately paused). The on-screen retry
  affordance only appears once every listed source has failed.
- **New `isBuffering` signal** (waiting/stalled → canplay/playing) drives
  a gentle pulse on the play/pause ring instead of a silent-looking tap
  during a cellular stall — and is explicitly excluded from
  `useIdleFade`'s active condition, so the chrome never recedes mid-stall.
- **Next-song prefetch now targets the `quality: "high"` (AAC/M4A) source,
  never the lossless master**, and is skipped outright when the Network
  Information API reports `saveData` or `effectiveType` of `2g`/`slow-2g`.
- **Placeholder assets regenerated** as WAV (16-bit/44.1kHz PCM) + AAC/M4A
  (~220kbps) pairs per song, replacing the earlier placeholder MP3s.
- **Hosting requirement documented, not solved in code**: seeking and
  partial buffering rely on the static host serving `Accept-Ranges` and
  correct `Content-Type` for `.wav`/`.m4a` — true by default on the static
  hosts this is built for (Vercel/Netlify/GitHub Pages/S3+CloudFront/
  Cloudflare Pages), called out in README so it isn't assumed silently.

Standing caveat unchanged: nothing above has been exercised in a real
browser in this sandbox. Test the final masters on iPhone Safari over
actual cellular before considering this production-ready — placeholder
tones prove the plumbing, not the real-world experience of a multi-
megabyte WAV over a weak connection.

---

# Changelog — creative-director critique pass

Two internal critique-and-improvement cycles applied to the working build,
reviewed as "Buğu holding an iPhone once, before a proposal she doesn't know
is coming." Locked narrative architecture (BUĞU → DÜN → YARIN → ŞİMDİ hold →
real-world proposal → Album Mode) was not changed — every item below is a
refinement inside it, not a structural rewrite.

## What changed, and why

**Opening now has atmosphere instead of reading as a blank loading screen.**
`BUĞU` (mist/fog/breath-on-glass) used to just fade in on flat black — the
one screen that sets the tone for everything after was the least considered
one. It now clears from a blur rather than a plain opacity fade (a literal
"clearing" — the word's own meaning), over a static, colorless grain layer
so the very first frame already has depth. `Opening.tsx`, `Opening.css`.

**Song world colors now reach the chrome, not just the backdrop.**
The progress fill and the play button's ring were flat ink-colored on every
song, so DÜN/YARIN/ŞİMDİ looked identical from the neck down — only the
background art carried the visual identity the brief asked for per song.
Both now blend toward each song's `accentColor` via `color-mix`, driven
entirely from `config/songs.ts` (no per-song logic in the components).
`ProgressBar.css`, `PlayPauseButton.css`.

**Journey Mode timestamps removed; kept only in Album Mode.**
A running `mm:ss` readout is a media-player convention, not a ritual
artifact — during DÜN and YARIN it was the most literal, least poetic thing
on screen, and it's the one piece of UI that silently reveals "there is a
countdown to something." Album Mode keeps it (it's a library, not a
ceremony, and `seekable` already doubles as the signal for "this is Album
Mode"). `SongScreen.tsx`.

**Controls now recede during uninterrupted listening.**
The player chrome held full opacity for the entire song, which fights the
"put the phone down and just listen" intent the design was supposed to
create — nothing in the interface actually got out of the way. A new
`useIdleFade` hook fades the control cluster to near-invisible after 3.5s of
undisturbed playback, and snaps back instantly on any touch or on returning
from the background (so coming back from Messages never looks like a dead
screen). Deliberately gated on `isPlaying && !hasError` — never recedes
while paused, deciding, or behind a stalled retry affordance.
`useIdleFade.ts` (new), `SongScreen.tsx`, `SongScreen.css`.

**YARIN → ŞİMDİ is now a closing bookend, not a timer-based fade.**
The previous handoff was `onEnded` → `setTimeout(2500ms)` → flip stage — an
arbitrary pause with no visual choreography, in the single most important
hinge of the whole experience. It now mirrors the opening iris from
`Transition.tsx`: title and controls recede first, a breath of silence
holds, and then YARIN's world itself contracts to a point via the same
`clip-path: circle()` mechanic that first opened it. `stage` only advances
once that whole sequence resolves (`onResolved`), not on `ended` directly.
Because `dunCompleted`/`yarinCompleted` are already persisted by the time
this fires, a refresh mid-sequence loses nothing — `reconcileStageOnBoot()`
snaps straight to the next stage. Backed by a watchdog for weak-connection
stalls past the 92% mark and a hard backstop timer in case the
`onAnimationComplete` event never fires (interrupted, backgrounded, reduced
motion) — there is always a route into ŞİMDİ, never a dead end.
`SongScreen.tsx`, `App.tsx` (removed the old `handleYarinEnded`/delay).

**Album Mode's list now has an entrance instead of appearing instantly.**
Post-proposal, this screen is meant to read as a permanent keepsake, not an
admin panel bolted onto the ritual — appearing with no motion at all was
the one place the build's visual sophistication dropped. The three titles
now fade and lift in with a light stagger. `AlbumHome.tsx`.

**Reduced DÜN's grain tiling risk.**
The film-grain texture backing DÜN's "imperfect recollection" mood repeats
on a visible tile boundary at typical iPhone viewport sizes at certain
zoom/DPI combinations — worth flattening/enlarging before final art lands,
noted directly against `SongWorld`'s ember variant.

**Deduplication only (no behavior change):** the `EASE` easing constant and
`prefersReducedMotion()` helper existed as separate inline copies in
`Transition.tsx` and were about to be copied a third time into
`SongScreen.tsx`. Both now live once in `src/lib/motionPrefs.ts` and are
imported everywhere — so every seam in the app uses the exact same curve,
and there's one place to check reduced-motion handling against, not three.

## Known gaps carried forward (not fixed — flagged for the next pass)

1. **`prefers-reduced-motion` coverage is incomplete.** The global CSS media
   query (`src/styles/global.css`) only overrides plain CSS
   animations/transitions. Framer Motion drives its own JS-timed animations
   and ignores that block entirely. `Transition.tsx` and `SongScreen`'s
   closing iris explicitly check `prefersReducedMotion()` and are correct;
   `FadeTransition`, `Opening`'s blur-clear entrance, and `AlbumHome`'s list
   stagger do not yet, and will keep animating at full duration under that
   OS setting until updated.

2. **The YARIN closing watchdog assumes a short tail.** In
   `SongScreen.tsx`, the fallback that forces the world to start closing if
   `ended` never fires is hardcoded to 20 seconds after the 92% mark — safe
   for any song under ~4 minutes, but if YARIN's real master runs longer
   than that with a slow tail, the world can start closing while audio is
   still audibly playing. Worth making this proportional to `duration`
   (e.g. `duration * 0.08 * 1000 + margin`) once the real files are in
   place, or confirming the actual runtime stays under the assumption.

## Standing caveat (unchanged since the last report)

Nothing in this project has been installed, built, or run in this sandbox —
`npm install` fails here on every package via a corporate proxy
(`403 MediaTypeBlocked` from a McAfee Web Gateway on all npm `.tgz`
fetches), confirmed unrelated to any specific dependency. Every behavior
described above is reasoned from the code, not observed in a browser. Treat
this build as reviewed, not verified, until it's run on a normal machine.
