# BUĞU — Design Document

A bespoke digital art object built around three original songs. Not a website — a ritual.

---

## 1. Information Architecture

```
/          — single route, client-only state machine, no URL-based navigation
│
├── Journey Mode (default, first-time visitor)
│   ├── Opening   — "BUĞU" / "senin için." / "başla"
│   ├── DÜN       — song chrome, over PersistentWorld's "dun" phase
│   ├── YARIN     — song chrome, over PersistentWorld's "yarin"→"convergence" phases
│   └── ŞİMDİ     — terminal hold, word only, over PersistentWorld's "presence" phase
│
├── Album Mode (post-proposal, permanent, remotely/admin-toggled)
│   ├── Album Home — DÜN / YARIN / ŞİMDİ, all unlocked, over PersistentWorld's "album" phase
│   └── Song View  — same chrome component per song, free seek + lyrics + prev/next
│
└── /admin (hidden, never linked) — passphrase-gated Album Mode switch
```

Notes:
- One route per mode. The "screen" is a value in a state machine, not a URL — nothing to deep-link, nothing to leak via history/back-button, no chapter count ever visible.
- `/admin` is a second, separate entry point (a plain `pathname` check in `main.tsx`, not a router) — it renders instead of the Journey/Album app entirely, and is not reachable from anywhere inside the normal experience.
- Album Mode is not a new app — it's the same `SongScreen` chrome with `seekable=true`, entered from an Album Home shell instead of the journey sequence, and it shares one `PersistentWorld` instance with that shell (see §3, §4).
- No settings page, no nav bar, no footer, no chapter indicator. The only persistent chrome is a barely-there Sözler toggle and the audio control itself.

---

## 2. State Diagram

```
                    ┌──────────┐
                    │ OPENING  │  (gesture required: "başla")
                    └────┬─────┘
                         │ tap → stage: "dun"
                         ▼
                    ┌──────────┐   `ended`
                    │   DÜN    │───────────┐
                    └──────────┘           │ world starts morphing toward
                                            │ YARIN's target immediately;
                                            │ DÜN's own chrome fades; after
                                            │ a fixed hold (not an animation
                                            │ callback) →
                                            ▼
                                     stage: "yarin"
                                     (YARIN's chrome appears a further
                                      short delay later, once the morph
                                      has visibly gotten underway)
                                            │
                                            │ `ended` (or a heard+watchdog
                                            │ fallback for a stalled tail,
                                            │ or an error after "heard")
                                            ▼
                                     world → "convergence" phase
                                     (density briefly returns, texture +
                                     light seem to pull together, then
                                     resolve toward stillness); after a
                                     fixed, generous hold →
                                            │
                                            ▼
                                     stage: "simdi"
                                     world → "presence" phase (fully
                                     resolved); ŞİMDİ's word fades in over
                                     the already-still world — terminal.

Orthogonal: albumMode (env var OR remote flag OR admin panel OR unlock
link — see §7). When true, bypasses the whole graph above entirely;
lands on Album Home instead of Opening. Every song's chrome becomes
seekable, and prev/next navigation between songs appears.
```

There is deliberately no "transition" stage in the persisted state
machine. The DÜN→YARIN and YARIN→ŞİMDİ seams are not separate screens —
they are periods where the persisted `stage` hasn't advanced yet but the
*visual world* (a single component, `PersistentWorld` — see §3) is
already tweening toward the next stage's target. See `App.tsx` for the
local, unpersisted `dunClosing`/`yarinRevealed`/`yarinClosing` flags that
drive this without needing a stage of their own.

Persisted state (localStorage), namespaced `bugu.journey.v1`:

```ts
{
  stage: "opening" | "dun" | "yarin" | "simdi",
  dunCompleted: boolean,
  yarinCompleted: boolean,
  lastProgress: { dun?: number; yarin?: number }, // currentTime, seconds
}
```

(A `stage: "transition"` value can still exist in storage written by a
pre-refactor build — `journeyStore.ts` reads it as `"dun"` on load and
otherwise ignores it; the morph itself was never worth persisting.)

Completion rule (both songs) — two distinct signals, not one:
- **"heard"** fires once at `currentTime / duration >= 0.92` **or** at
  `ended`, whichever comes first. This only persists
  `dunCompleted`/`yarinCompleted` — a resume safety net — and must never
  itself change `stage`.
- **"advance"** (via `onEnded`) fires only on the native `ended` event.
  This is what starts the closing choreography that eventually moves
  `stage` forward. Crossing 92% while she's still actively listening must
  not cut the song short and jump the screen.

Boot-time reconciliation (`reconcileStageOnBoot`) does **not** infer a
stage change from a completion flag. Earlier builds of this app jumped
`stage: "dun"` → `"transition"` the moment `dunCompleted` became true —
which meant crossing 92%, then closing the app before `ended` fired, then
reopening, skipped the rest of the song entirely. That was a real bug, not
a feature; it's gone. The only thing boot reconciliation still corrects is
storage that couldn't have been produced by normal use (e.g. `stage:
"yarin"` with `dunCompleted` still false).

Anti-skip rule: DÜN → YARIN has no direct UI affordance. YARIN's chrome
does not render until the local `yarinRevealed` flag is true (see §5),
which only ever becomes true after DÜN's `ended` and a deliberate hold.

---

## 3. Component Structure

```
src/
├── config/
│   └── songs.ts             — SINGLE source of truth (see §7)
├── state/
│   ├── journeyStore.ts       — journey state machine + localStorage persistence
│   └── albumMode.ts          — album mode resolution: env / remote flag / admin / unlock link
├── audio/
│   ├── AudioEngine.ts        — one <audio> element for the app lifetime, imperative API
│   ├── useAudioEngine.ts     — reactive snapshot (time/duration/playing/error/buffering)
│   ├── useSongPrepare.ts     — wires a mounted SongScreen to AudioEngine
│   ├── usePersistProgress.ts
│   ├── usePrefetchNext.ts    — best-effort fetch()-based cache warm for the next song
│   └── formatTime.ts
├── world/
│   ├── PersistentWorld.tsx   — the one continuously-mounted visual layer (see §4)
│   └── PersistentWorld.css
├── screens/
│   ├── Opening.tsx           — foreground text only; background is PersistentWorld
│   ├── SongScreen.tsx        — chrome only (title/play/progress/sözler), shared by every song
│   ├── SimdiWord.tsx         — just the word, over PersistentWorld's resolved "presence"
│   ├── useIdleFade.ts
│   └── AlbumHome.tsx         — mounts its own PersistentWorld instance
├── components/
│   ├── PlayPauseButton.tsx
│   ├── ProgressBar.tsx       — presentational; seekable only in Album Mode
│   ├── LyricsSheet.tsx       — bottom-sheet, its own scroll container
│   └── FadeTransition.tsx    — thin Framer Motion wrapper for foreground chrome, opacity/scale only
├── admin/
│   ├── AdminPanel.tsx        — hidden at /admin, passphrase-gated Album Mode switch
│   ├── AdminPanel.css
│   └── sha256.ts
├── lib/
│   └── motionPrefs.ts        — shared EASE curve + prefersReducedMotion()
├── App.tsx                   — Journey Mode orchestration (see §2); or renders AlbumHome
└── main.tsx                  — /admin pathname check, then boot reconciliation, then render
```

Design rule: `SongScreen` never knows which song it is beyond the config
object it's given, and it owns **no background at all** — visual identity
lives entirely in `PersistentWorld`, driven by `songConfig.world` (see
§4, §7). This is what keeps Album Mode a config flip rather than a second
implementation, and what keeps the world from ever visually resetting
between songs.

---

## 4. Visual Direction — PersistentWorld

The single biggest structural change from earlier drafts of this app: the
background is not per-screen. `PersistentWorld` mounts once per mode
(once in `App.tsx` for the whole Journey, once in `AlbumHome.tsx` for the
whole Album shell) and never unmounts between songs. It exposes one prop,
`phase`, and every visible thing about it — a base gradient, two soft
drifting light masses, a grain layer, and a converging veil — is driven by
five plain numbers (`lift`, `density`, `driftSeconds`, `tone`, `resolve`)
that are continuously tweened (via Framer Motion's imperative `animate()`,
writing CSS custom properties directly) from wherever they currently are
to wherever the new phase targets. Nothing is ever mounted, unmounted, or
crossfaded to change the world — only these five numbers move.

Phases: `opening → dun → yarin → convergence → presence` (Journey), plus
a separate `album` resting phase for the Album Home list. See
`src/world/PersistentWorld.tsx` for the exact target values per phase and
the reasoning behind each.

**DÜN — memory.** Low `lift` (weight settles low/grounded), high
`density` (tactile, dusty grain), `tone` fully toward the warm accent.
Very slow drift (150s+) — near-static, the way memory doesn't move.

**YARIN — possibility.** High `lift` (open, upward), lower `density`
(more luminous air, less texture), `tone` fully toward the cool accent.
Slightly faster drift than DÜN, but still calm — nothing here should read
as "energetic."

**The DÜN→YARIN seam.** The moment DÜN ends, `phase` changes directly from
`"dun"` to `"yarin"` and a single ~7s tween carries every parameter there
continuously — there is no intermediate "transition" visual state to
design, because the tween *is* the transition. DÜN's own chrome (title,
controls) fades out on its own faster timeline; YARIN's chrome only
appears once that world tween has had time to feel underway.

**Convergence → ŞİMDİ.** YARIN ending pushes `phase` to `"convergence"`:
`density` briefly rises again (DÜN's texture returning) while `resolve`
climbs — this is what visually reads as "memory's texture and
possibility's light seem to converge" before everything gives way to
stillness. `resolve` drives a centered, ivory-tinted veil that grows
outward and dampens grain/saturation as it does — a continuous
compositing operation, not a black overlay covering a new screen. Once
`phase` reaches `"presence"`, the veil, density, and drift have all
settled; `SimdiWord` mounts on top of an already-still world and fades in
on its own separate ~3.6s timeline, so the word reads as something the
world resolved into, not something React mounted.

**Opening.** Its own quiet phase — a low-density, low-intensity echo of
DÜN's target values — so tapping "başla" doesn't load a new background;
the world just deepens into DÜN's fuller state.

**Album Home.** A fourth, separate resting phase: an even blend of both
songs' tones, partway resolved, calmer than any Journey phase but
deliberately distinct from ŞİMDİ's specific `"presence"` state — this is a
keepsake at rest, not a replay of the proposal's emotional arrival.
Switching between songs in Album Mode reuses the same phases
(`dun`/`yarin`/`presence`) but with a much shorter, library-appropriate
tween duration (`fast` prop) rather than the Journey's cinematic pacing.

No literal iconography anywhere (no rings, hearts, cats, houses,
sunrises). Everything above is abstract: gradients, soft light, grain,
drift. Typography — `ui-serif` (New York on iOS Safari) for display type —
carries the emotional weight the imagery deliberately doesn't.

---

## 5. Motion & Transition Principles

1. **The world never cuts.** `PersistentWorld` is the one thing in this
   app that is never allowed to have a visible seam — see §4.
2. **Foreground chrome crossfades independently**, via `FadeTransition` —
   a much lower-stakes kind of transition than the world itself, since the
   world underneath is continuous regardless of what UI is fading in or
   out on top of it.
3. **Stage advances are driven by fixed timers, never animation
   callbacks.** Every seam that used to gate a state change on
   `onAnimationComplete` (the old Transition screen's iris, the old
   closing-iris) has been replaced with a plain `setTimeout` whose
   duration is chosen to feel right, decoupled from whatever the visual
   tween is doing at that exact moment. A refresh mid-timer simply lands
   on the next stage's resting state, which is correct, not a broken
   mid-animation frame.
4. **No slides, bounces, springs, wipes, or irises.** The only shape
   language is opacity, gentle scale, and (inside `PersistentWorld`) blur
   + gradient interpolation.
5. **Lyrics sheet** slides up from the bottom (translateY, 350ms) as a
   physical sheet, dismissible by swipe-down or scrim tap. Never
   auto-opens, never auto-scrolls to a "current line."
6. **`prefers-reduced-motion` is checked explicitly everywhere motion is
   JS-driven** (`PersistentWorld`, `FadeTransition`, `Opening`,
   `AlbumHome`'s stagger, `SimdiWord`'s breathing) via one shared
   `prefersReducedMotion()` helper — not left to the blanket CSS media
   query alone, which only ever covered plain CSS animations/transitions.
   Reduced motion collapses tweens to near-zero duration, landing on the
   same final composition, not a broken intermediate one.

---

## 6. Mobile Interaction Model

- **Single-thumb reach zone.** Play/pause is one large circular hit target (≥64px) centered in the bottom third of the screen, inside `env(safe-area-inset-bottom)` padding.
- **No hover states anywhere.**
- **No scroll required for the core player.** `100dvh` with `100svh`/`100lvh` fallback, `viewport-fit=cover`, `overscroll-behavior: none`. Only the lyrics sheet scrolls.
- **Explicit gesture to start audio, every time.** Every song screen mounts paused; the only thing that calls `play()` is a direct tap on that screen's own play button. The single shared `<audio>` element (`AudioEngine.ts`) is what makes reusing it across DÜN→YARIN safe regardless of which gesture unlocked it first.
- **Interruption survival.** Progress persists on `visibilitychange`(hidden)/`pagehide`, not on an interval or `beforeunload`. Reopening restores `stage` and seeks close to `lastProgress`.
- **Lock screen / Control Center.** MediaSession metadata per song; Journey Mode leaves `nexttrack`/`previoustrack`/`seekto` unset so the OS can't skip DÜN into YARIN. Entering ŞİMDİ fully clears MediaSession.
- **Weak connection tolerance.** `preload="metadata"` only; source selection follows `AUDIO_DELIVERY_POLICY` (§7), not "first in the config array"; a stalled source falls through to the next tier silently; a stall mid-playback pulses the play button rather than looking broken; next-song prefetch targets the compressed tier only and is skipped on `saveData`/`2g`.
- **Portrait-only assumption**, degrades gracefully via `100dvh`/flex centering if rotated.

---

## 7. Configuration Layer (preview — implemented in `src/config/songs.ts`)

```ts
export interface SongWorld {
  lift: number;       // 0..1 — vertical center of visual weight
  density: number;    // 0..1 — grain/texture intensity
  driftSeconds: number;
}

export type SourceQuality = "lossless" | "high" | "compatible";
export interface SongSource {
  src: string;
  type: string;        // MIME incl. codec, passed to canPlayType()
  quality: SourceQuality;
}

export interface SongConfig {
  id: "dun" | "yarin" | "simdi";
  title: string;
  sources: SongSource[];   // ordered highest-fidelity-first, for readability only
  durationHint?: number;
  lyrics: string[][];      // stanzas — NO timestamps, ever
  artwork?: string;
  accentColor: string;
  world: SongWorld;
}

// Decouples "which format plays" from "what order sources are listed in" —
// see AudioEngine.pickSourceIndex.
export type AudioDeliveryPolicy = "auto-mobile" | "lossless-preferred";
export const AUDIO_DELIVERY_POLICY: AudioDeliveryPolicy = "auto-mobile";

export const albumModeEnvDefault: boolean = import.meta.env.VITE_ALBUM_MODE === "true";
export const REMOTE_ALBUM_MODE_FLAG_URL = "/album-mode.json";
export const ALBUM_UNLOCK_PASSPHRASE = "sensinki";       // URL-param link — obscurity only
export const ADMIN_PASSPHRASE_HASH = "…";                 // SHA-256 hex, /admin gate
export const ALBUM_FLAG_ENDPOINT: string | undefined;     // optional real remote flag

export const proposal = { date: "", location: "", note: "" }; // intentionally empty
```

Everything a component needs — copy, color, motion params, audio, lyrics —
flows in as props derived from this one file. No song-specific literals
inside components. See **README.md** for the full walkthrough of every
Album Mode activation mechanism and the audio delivery policy's actual
behavior — kept there instead of duplicated here so it doesn't go stale.
