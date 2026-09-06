# BUĞU

A bespoke, mobile-first interactive proposal experience built around three
original songs — DÜN, YARIN, ŞİMDİ. See `DESIGN.md` for the concept,
information architecture, state diagram, and visual/motion direction this
implementation follows, and `CHANGELOG.md` for what's changed and why
across each review pass.

**Status: `tsc -b` and `vite build` have both been run and pass cleanly in
this environment** (this sandbox happened to already have `node_modules`
present from an earlier setup, despite a corporate proxy — McAfee Web
Gateway — that returns `403 MediaTypeBlocked` on fresh `npm install`
attempts here). That means: the TypeScript project compiles with no
errors, and the production bundle builds successfully. **It has not been
opened in any real browser, on any real device, with any real audio
file.** Nothing about visual appearance, animation feel, audio playback,
or touch interaction has been observed — only that the code is
well-typed and bundles. Run it on your own machine and on an actual
iPhone before trusting it for the proposal; see "Testing checklist" and
"iPhone tests you need to perform personally" below.

---

## Run instructions

```bash
npm install
npm run dev       # http://localhost:5173, but test on an actual iPhone —
                   # see "Testing on an iPhone" below
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve the production build locally
```

If `npm install` fails on a rollup-related optional-dependency error on
your first attempt, just run `npm install` again — this is a known
npm/rollup optional-dependencies bug, not a real conflict in this
project; there is no `overrides` block pinning around it anymore (removed
— see CHANGELOG). Do not reach for `--force` or `--legacy-peer-deps`.

### Testing on an iPhone

`localhost` on your laptop isn't reachable from your phone. Either:
- run `npm run dev -- --host` and open `http://<your-laptop-LAN-IP>:5173` in
  iPhone Safari (same Wi-Fi network), or
- deploy `dist/` (after `npm run build`) to any static host (Vercel,
  Netlify, GitHub Pages, etc.) and open the real URL.

Audio gesture-unlock behavior, MediaSession/lock-screen integration, the
actual look of `PersistentWorld`'s gradients/grain/drift, and safe-area
insets can only be properly verified on-device in Safari — the desktop
Vite dev server preview is fine for layout/logic iteration only. If your
host serves static files without an SPA rewrite rule, confirm `/admin`
(see below) actually resolves to `index.html` rather than 404ing — most
hosts (Vercel, Netlify, Cloudflare Pages) do this by default for a Vite
SPA; a plain S3 bucket typically needs an explicit rewrite rule added.

---

## Configuration — `src/config/songs.ts`

This is the single file to edit for content. Nothing song-specific is
hardcoded in any component.

```ts
songs.dun.sources     // → SongSource[], ordered highest-fidelity-first (see "Audio formats" below)
songs.dun.lyrics      // → string[][], stanzas of plain lines, NO timestamps
songs.dun.artwork     // → optional image path, used for MediaSession lock-screen art
songs.dun.accentColor // → single CSS color, blended into PersistentWorld's gradient for this song
songs.dun.world       // → { lift, density, driftSeconds } — see DESIGN.md §4 for what each does
```

To swap in real audio: drop the files in `public/audio/` and list them in
`sources`, e.g.:

```ts
sources: [
  { src: "/audio/dun.wav", type: "audio/wav", quality: "lossless" },
  { src: "/audio/dun.m4a", type: 'audio/mp4; codecs="mp4a.40.2"', quality: "high" },
],
```

No other change needed — duration is read from the file itself at
runtime. See "Audio formats and quality" below before dropping in the
real masters, and note `AUDIO_DELIVERY_POLICY` (same file) controls which
tier actually plays on mobile — not just which is listed first.

`proposal.date` / `proposal.location` / `proposal.note` are present but
intentionally empty. Fill them in whenever you're ready — Album Home
renders them (only if non-empty) as a small footer beneath the song list.

`ALBUM_UNLOCK_PASSPHRASE` is the passphrase for the shareable unlock link
(see below) — it's a URL parameter by design, so treat it as obscurity,
not security, and change it from the placeholder before sharing any link
that includes it. `ADMIN_PASSPHRASE_HASH` is different and gates `/admin`
instead — see "Album Mode activation" below for how to set your own.

---

## Album Mode activation

Four mechanisms exist, layered so hosting limitations don't leave you
with no way to flip it. You don't need all four; the admin panel is the
intended day-of-proposal mechanism.

### 1. Admin panel — `/admin`, passphrase-gated

The one built for "from my phone, after the proposal, without touching
code." Not linked anywhere in the normal UI, so Buğu has no route to
stumble onto it.

1. Set your own passphrase before relying on this: pick a phrase, run in
   any browser console —
   ```js
   crypto.subtle.digest("SHA-256", new TextEncoder().encode("your phrase"))
     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,"0")).join("")))
   ```
   and paste the resulting hex string into `ADMIN_PASSPHRASE_HASH` in
   `src/config/songs.ts`. The placeholder shipped in this repo is **not**
   a real hash of anything — replace it before you rely on this route.
2. Open `https://<your-site>/admin`, enter the passphrase, confirm.
3. This always unlocks Album Mode permanently on the device you're
   standing on. Whether it also flips a **global** flag that Buğu's phone
   picks up on its own depends on whether you've configured
   `VITE_ALBUM_FLAG_ENDPOINT` (below) — the panel tells you honestly which
   one just happened.

**`VITE_ALBUM_FLAG_ENDPOINT` — the real global flag.** This project does
not ship a backend (there's nowhere to run one from this sandbox, and
fabricating one you can't verify would be worse than not having it). To
get a genuine global remote flag, point this env var at any tiny endpoint
you control that:
- responds to `GET` with `{"albumMode": true|false}`,
- accepts `POST` with body `{"albumMode": true}` and header
  `Authorization: Bearer <sha256 hex of your admin passphrase>`, and
  updates that same value.

Three minimal ways to stand that up, roughly in order of effort:
- **Cloudflare Worker + KV** — a ~15-line Worker reading/writing one KV
  key, checking the bearer token against an environment secret.
- **Firebase Realtime Database REST** — a single JSON node
  (`/albumMode.json`) with a security rule that allows public read and
  write-if-the-request-includes-a-matching-custom-token/secret.
- **Supabase** — one table, one row, a Row Level Security policy that
  allows anon read and a service-role (or Edge Function-gated) write.

Without `VITE_ALBUM_FLAG_ENDPOINT` set, the admin panel still works — it
just says so plainly, and you fall back to mechanism 2 or 3 below to
reach Buğu's device specifically.

### 2. Unlock link

Open once, in Safari, on whichever phone should unlock:

```
https://<your-site>/?unlock=sensinki
```

(replace `sensinki` with your own `ALBUM_UNLOCK_PASSPHRASE`). Unlocks
permanently on that device only; the `?unlock=...` param is stripped from
the address bar immediately.

### 3. Static remote flag — `public/album-mode.json`

```json
{ "albumMode": false }
```

Polled once per fresh page load (`cache: "no-store"`). Flip to `true` and
redeploy (or edit the single static file directly, on hosts that allow
that) — any device opening the site afterward unlocks itself permanently.

### 4. Environment variable — the permanent, global default

```bash
VITE_ALBUM_MODE=true
```

Build-time flag (`.env.example`). Requires a rebuild+redeploy, but most
hosts let you trigger that from their mobile dashboard, no laptop needed.
Once set, Journey Mode becomes unreachable regardless of any other flag.

**None of these four require you to touch the site during the proposal
itself.** The ŞİMDİ holding screen needs no interaction and can sit open
indefinitely; the mode switch is something you do afterward.

---

## Audio formats and quality

These are original, professionally produced masters — the pipeline is
built to preserve that, not compress it away by default.

- **Do not use low-bitrate MP3 anywhere in `sources`.** The placeholders
  in `public/audio/` are a lossless WAV (`ffmpeg`-synthesized sine tone,
  16-bit/44.1kHz PCM) paired with a high-bitrate AAC/M4A encode (~220kbps)
  of that exact WAV — replace both with the real masters, keeping the
  same pairing pattern: **WAV master in, AAC out of that WAV**, never out
  of an already-lossy intermediate.
- **Nothing transcodes, normalizes, or otherwise processes audio
  automatically.** `AudioEngine` only ever selects between files you list
  in `sources` — no resampling, loudness normalization, EQ, limiting, or
  crossfading. Whatever DSP the masters need happens before they land in
  `public/audio/`.
- **`AUDIO_DELIVERY_POLICY` decides which quality tier plays — not array
  order.** `"auto-mobile"` (the default) prefers the `"high"` (AAC/M4A)
  tier for actual playback, falling through to `"compatible"` then
  `"lossless"` only if nothing else is playable — WAV support and
  WAV-first cellular streaming are deliberately different decisions.
  `"lossless-preferred"` inverts that, for a link you know will only ever
  be opened on Wi-Fi. Within whichever tier wins, `canPlayType()` still
  gates the actual pick, and does **not** rerank by "probably" vs "maybe"
  confidence (Safari reports `audio/wav` as only "maybe" and `audio/mp4`
  as "probably" even though both play back perfectly — ranking by that
  value would misrepresent real support).
- **Source-level fallback**: if the selected source fails outright
  (`error` event) mid-session, it falls through to the next tier —
  position preserved, playback resumes automatically if it was already
  playing. The retry affordance only appears once every listed source has
  failed, and retrying starts again from the top of the preference order.
- **A third `quality: "compatible"` tier can be added** (e.g. a
  normal-bitrate MP3) for a browser that plays neither WAV nor AAC — not
  expected to be necessary on iPhone Safari, the only platform this is
  built for.
- **Hosting must serve `Accept-Ranges`/HTTP range requests and correct
  `Content-Type`** (`audio/wav`, `audio/mp4`). Static hosts (Vercel,
  Netlify, GitHub Pages, S3+CloudFront, Cloudflare Pages) do this by
  default — just confirm nothing in front of them re-encodes or strips
  range support from binary audio in transit.
- **Test the final masters on real iPhone Safari, on cellular, before the
  proposal.** Placeholder tones prove the plumbing, not the real-world
  experience of a multi-megabyte WAV over a weak connection.

---

## Audio behavior on iPhone Safari

- A single `<audio>` element is created once and reused for the entire
  session (`src/audio/AudioEngine.ts`) — iOS only unlocks playback on the
  specific element a user gesture was performed on.
- Every song screen opens **paused**. Playback starts only from a direct
  tap on the play button — no autoplay anywhere, including across the
  DÜN→YARIN world morph.
- `preload="metadata"` (never `"auto"`) — loads just enough to know
  `duration`, regardless of whether the selected source is WAV or AAC.
  Once playback starts, the browser buffers ahead via ordinary HTTP range
  requests — no app code drives that part.
- Progress persists on `visibilitychange`(hidden)/`pagehide`, not on an
  interval or `beforeunload` (unreliable on iOS Safari).
- MediaSession metadata set per song; Journey Mode leaves
  next/previous/seek unwired so the lock screen can't skip DÜN into
  YARIN. Entering ŞİMDİ fully clears MediaSession (metadata, playback
  state, all handlers).
- A mid-playback stall (cellular) pulses the play/pause ring gently in
  place rather than looking like a tap did nothing.
- Load/decode/playback failures first fall through silently to the next
  source (see "Audio formats and quality" above); the "yüklenemedi —
  tekrar dene" affordance only replaces the play button once every listed
  source has failed.
- Once DÜN passes ~70% played, YARIN's **high-quality, not lossless**
  source is quietly fetched in the background to warm the HTTP cache
  (plain `fetch()`; Safari has never implemented `<link rel=prefetch>`),
  skipped entirely on `saveData` or `effectiveType` of `2g`/`slow-2g`.

---

## Testing checklist

**Executed in this sandbox: `tsc -b` (passes) and `vite build` (succeeds,
285KB JS / 93KB gzipped) and a local `vite preview` boot (serves `200` on
both `/` and `/admin`).** Nothing below that requires a browser, a
device, real audio, or visual judgment has been observed. Verify each one
for real before trusting this for the actual proposal.

| Scenario | Expected behavior |
|---|---|
| Fresh first visit | Opening screen (`BUĞU` / `senin için.` / `başla`) over a quiet, low-density echo of DÜN's world; no album/song-count hints |
| Opening → DÜN | World deepens from the quiet "opening" phase into DÜN's fuller target continuously; no new background loads |
| Refresh during DÜN | Resumes on DÜN, seeks near where you left off once metadata loads |
| Close app / reopen during DÜN | Same as refresh |
| Completion at 94% | Marks DÜN "heard" (safety net only) but does **not** jump screens — audio keeps playing |
| Completion at 100% (`ended`) | DÜN's chrome fades, the world begins morphing toward YARIN immediately; after a fixed hold, stage advances to "yarin" |
| DÜN → YARIN | One continuous `PersistentWorld` tween, ~7s — no black frame, no separate transition screen; YARIN's title/play button appear partway through, once the morph is visibly underway |
| Refresh mid-morph (right after DÜN ends, before YARIN's chrome appears) | Lands directly on stage "yarin" with chrome immediately visible, paused — a simpler but correct recovery, not a replay of the live choreography |
| Open lyrics mid-song | Sheet slides up; audio keeps playing underneath; swipe down or scrim tap dismisses |
| Screen lock / unlock | Lock screen shows song title via MediaSession; audio continues if playing |
| Switch to another app and back | Audio element persists; playback state unaffected |
| Weak connection | `preload="metadata"` only; UI never blocks on it |
| Playback stalls mid-song on cellular | Play/pause button pulses gently instead of looking broken; chrome does not fade out during the stall |
| Selected source fails but a lower tier exists | Falls through silently, resumes at the same position — no retry UI shown |
| Every source for a song fails | Retry affordance replaces the play button; retry starts again from the best-quality source |
| Refresh during YARIN | Resumes on YARIN with seek |
| YARIN completion | Chrome fades, world shifts to "convergence" (density briefly rises, then everything resolves toward stillness) immediately; after a generous fixed hold, stage advances to "simdi" |
| YARIN → ŞİMDİ | No black cut — a continuing veil/resolve compositing operation on the same world; ŞİMDİ's word fades in over an already-still frame |
| Long ŞİMDİ hold | No controls, no text beyond the word, faint breathing opacity after the entrance settles; MediaSession fully cleared |
| Refresh on ŞİMDİ holding screen | Persisted `stage: "simdi"` — reopens directly to the resolved hold state, no replay of any prior choreography |
| Album Mode after first journey | Journey progress in `localStorage` untouched |
| Album Mode on a new device | Works identically — no dependency on prior journey state |
| Admin: passphrase gate | Wrong passphrase shows a generic error; correct passphrase reaches the confirm step, not an immediate action |
| Admin: no `VITE_ALBUM_FLAG_ENDPOINT` configured | Unlocks the admin's own device; states plainly that no global flip happened |
| Turkish typography | System `ui-serif`/`-apple-system` stacks, full Ğğ Üü Şş İı Öö Çç glyph coverage; `toLocaleLowerCase("tr")` used anywhere case-folding touches Turkish text |
| Safe-area insets | Controls padded with `env(safe-area-inset-bottom)`; world and ŞİMDİ screens are full-bleed |
| Safari bar-driven viewport changes | `100dvh` with `100svh`/`100lvh` fallback chain on `#root` |
| Reduced motion (Settings → Accessibility → Motion) | Every JS-driven animation (world tweens, chrome fades, ŞİMDİ's breathing) shortens to near-instant but lands on the same finished composition — never a half-transitioned or blank frame |

---

## Project structure

```
src/
├── config/songs.ts        — all content: audio sources/delivery policy/lyrics/artwork/color/world, mode-switch config
├── state/
│   ├── journeyStore.ts     — Journey Mode state machine (opening/dun/yarin/simdi) + localStorage persistence
│   └── albumMode.ts        — Album Mode resolution: env / remote flag / admin endpoint / unlock link
├── audio/
│   ├── AudioEngine.ts      — single persistent <audio> element, imperative API, source selection + fallback
│   ├── useAudioEngine.ts   — reactive snapshot (time/duration/playing/error/buffering) for React
│   ├── useSongPrepare.ts   — wires a mounted SongScreen to AudioEngine
│   ├── usePersistProgress.ts
│   ├── usePrefetchNext.ts
│   └── formatTime.ts
├── world/
│   ├── PersistentWorld.tsx — the one continuously-mounted visual layer (see DESIGN.md §4)
│   └── PersistentWorld.css
├── screens/                — Opening, SongScreen (chrome only, shared), SimdiWord, AlbumHome
├── components/              — PlayPauseButton, ProgressBar, LyricsSheet, FadeTransition
├── admin/                   — /admin panel: passphrase gate (SHA-256) + Album Mode switch
├── lib/motionPrefs.ts       — shared easing curve + prefersReducedMotion()
├── App.tsx                  — Journey Mode orchestration, or renders AlbumHome
└── main.tsx                 — /admin pathname check → boot reconciliation → unlock-link check → render
```

See `DESIGN.md` for the reasoning behind each of these, and `CHANGELOG.md`
for what changed across each review pass and why.
# bugu
