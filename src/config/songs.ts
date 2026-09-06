/**
 * Single source of truth for song content, artwork, and visual/motion params.
 *
 * Nothing song-specific should ever be hardcoded inside a component — a
 * component receives a SongConfig (or the whole config module) and renders
 * from it. This is what lets Album Mode reuse exactly the same SongScreen
 * and PersistentWorld components as Journey Mode.
 *
 * Lyrics are stored as stanza arrays of plain strings with NO timestamp
 * fields, by design — this structurally prevents building a karaoke-style
 * synced-lyrics UI later. Lyrics are for reading in the Sözler sheet, not
 * for following along line-by-line.
 */

export type SongId = "dun" | "yarin" | "simdi";

/**
 * Feeds PersistentWorld's continuous per-song target state — not a preset
 * "look" a component switches on, but a small set of tunable numbers a
 * single visual system tweens between. See src/world/PersistentWorld.tsx.
 *
 * The persistent visual metaphor is a single horizon line, present in every
 * chapter, that never disappears — only where it sits, how sharp it is, and
 * how much crowds around it changes:
 *
 *  horizonY — 0..1, vertical position of the line. Low = buried near the
 *            bottom, weight pressing down (DÜN, memory); high = risen,
 *            open (YARIN, possibility); mid, settled/centered (ŞİMDİ,
 *            presence). SongScreen reads this same value to decide whether
 *            its own title/controls anchor low, high, or centered, so the
 *            chrome and the world never disagree about which way is "open."
 *  crowd    — 0..1, how densely grain/texture crowds the line. High for
 *            DÜN's tactile, obscured memory; lower for YARIN's clearing
 *            air; near zero once ŞİMDİ has fully settled.
 *  driftSeconds — duration of the slowest ambient movement loop. Larger =
 *            slower/calmer. ŞİMDİ's is intentionally very large (barely
 *            perceptible) rather than zero — a completely frozen frame
 *            reads as broken after several minutes; a near-imperceptible
 *            drift reads as alive.
 */
export interface SongWorld {
  horizonY: number;
  crowd: number;
  driftSeconds: number;
}

/**
 * "lossless" — the untouched master (WAV). Highest fidelity, largest file.
 * "high" — a transparent, high-bitrate web-delivery encode (AAC/M4A) —
 *   NOT a minimum-file-size compromise, a genuinely transparent encode.
 * "compatible" — optional last-resort tier (e.g. a normal-bitrate MP3) for
 *   a browser that plays neither of the above. Not expected to be needed
 *   on iPhone Safari, the only platform this experience is built for.
 */
export type SourceQuality = "lossless" | "high" | "compatible";

export interface SongSource {
  src: string;
  /** Full MIME type incl. codec string where relevant, passed verbatim to
   * HTMLAudioElement.canPlayType(), e.g. `audio/wav` or
   * `audio/mp4; codecs="mp4a.40.2"`. */
  type: string;
  quality: SourceQuality;
}

export interface SongConfig {
  id: SongId;
  title: string;
  /** small supporting label shown near the title, e.g. a subtitle. Keep empty if unused. */
  subtitle?: string;
  /** Ordered highest-fidelity-first, for readability/archival clarity only.
   * Actual playback selection goes through AUDIO_DELIVERY_POLICY below —
   * never assume "first in this array" is what plays. */
  sources: SongSource[];
  /** optional known duration (seconds) used only as a display hint before metadata loads */
  durationHint?: number;
  lyrics: string[][];
  artwork?: string;
  accentColor: string;
  world: SongWorld;
}

export const songs: Record<SongId, SongConfig> = {
  dun: {
    id: "dun",
    title: "DÜN",
    // No "lossless"/WAV tier: there is no real WAV master for this song (the
    // old one was a placeholder tone) — do not resurrect a placeholder as a
    // fallback tier. "compatible" is a real, full-length MP3 transcode of
    // the same song (not a placeholder either) — a genuine safety net for
    // the rare browser whose AAC decoder can't handle this particular file,
    // not a silent regression to filler audio.
    sources: [
      { src: "/audio/dun.m4a", type: 'audio/mp4; codecs="mp4a.40.2"', quality: "high" },
      { src: "/audio/dun.mp3", type: "audio/mpeg", quality: "compatible" },
    ],
    // AUTHORITATIVE, LOCKED lyrics — verbatim as supplied. Do not rewrite,
    // spell-check, normalize, or "fix" repeated/near-identical stanzas.
    lyrics: [
      [
        "Bir hayatım vardı, kendince güzel",
        "Bazen mutluluk, bazen de keder",
        "Çok şey istedim, çok kez üzüldüm",
        "Durmadan hep koştum, ve hep yoruldum",
      ],
      [
        "Sonu bitmeyen bazı masalların oldu",
        "Tuttuğun boş kadehler göz yaşınla doldu",
        "Dost dediklerin ve arkadaşların",
        "Susuz bir yaprak gibi sararıp soldu",
      ],
      ["Koştum, yoruldum", "Güldüm, ağladım", "Özledim bilmeden", "Senmişsin aradığım"],
      ["Sonra sen...", "Bir anda karşımda", "Sonra sen...", "Gölgeler ardında"],
      ["Gerçek sandığım ne varsa", "Yalanmış aslında", "Sonra sen...", "Gördüğüm en güzel rüya"],
      [
        "Bir hayatın vardı, Buğu'nun ardında",
        "Ne güzel gülerdin eski resimlerde",
        "Farkında bile değildin özlediğinin",
        "Martılar uçar mı hâlâ gökyüzünde?",
      ],
      [
        "İstikameti meçhul tuhaf bir yoldaydım",
        "O boş kadehler ne yapsam dolmadı",
        "Dost dediklerim ve arkadaşlarım",
        "Dertlerime bir derman olmadı",
      ],
      ["Koştum, yoruldum", "Güldüm, ağladım", "Özledim bilmeden", "Senmişsin aradığım"],
      ["Sonra sen...", "Bir anda karşımda", "Sonra sen...", "Gölgeler ardında"],
      ["Gerçek sandığım ne varsa", "Yalanmış aslında", "Sonra sen...", "Gördüğüm en güzel rüya"],
      ["Sonra sen...", "Bir anda karşımda", "Sonra sen...", "Gölgeler ardında"],
      ["Gerçek sandığım ne varsa", "Yalanmış aslında", "Sonra sen...", "Gördüğüm en güzel rüya"],
      ["Dünya dönmeye devam etti.", "Ben ilk defa", "yarını merak ettim."],
    ],
    // Dusk — the horizon buried and warm, close and heavy.
    accentColor: "#8a6a4f",
    world: {
      horizonY: 0.14,
      crowd: 0.78,
      driftSeconds: 170,
    },
  },
  yarin: {
    id: "yarin",
    title: "YARIN",
    // See DÜN's sources comment — same reasoning.
    sources: [
      { src: "/audio/yarin.m4a", type: 'audio/mp4; codecs="mp4a.40.2"', quality: "high" },
      { src: "/audio/yarin.mp3", type: "audio/mpeg", quality: "compatible" },
    ],
    // AUTHORITATIVE, LOCKED lyrics — verbatim as supplied. Note the chorus
    // recurs with two distinct variants ("Senden"/"İçimde hâlâ sen var" vs.
    // the final "Bizden" variant) — that's an intentional lyric variation in
    // the source text, not a typo to reconcile.
    lyrics: [
      [
        "Evimizin anahtarları avucumda",
        "Bizim şarkımız benim dilimin ucunda",
        "Akşam güneşi salona süzülürken",
        "Bu hayal olsa bile kurulmaz",
      ],
      [
        "Tokyo geceleri uzun, uykumuz kaçak",
        "Dönüşte iki kedi, kapıda bi merak",
        "Yıllar sonra bir kep havada dönerken",
        "Aynı şarkı çalıyor radyoda — sesini aç",
      ],
      [
        "Kalabalık masa, göz göze geldik yine",
        "Kilitlendim kaldım yemyeşil gözlerine",
        "Kimse anlamaz bizim neden sustuğumuzu",
        "Gizlice gülüşün ele verir senin de",
      ],
      ["Seninle dolu her yer", "Seninle dolu yıllar", "Dönüp baktığım her yerde", "Senden bir şeyler var"],
      ["Seninle dolu her yer", "Ne eksilir, ne solar", "Bir hayat geçti derken", "İçimde hâlâ sen var"],
      [
        "Bazı günler ağır, ev sessize yakın",
        "Gözlerin buğulu, ve sözlerin yarım",
        "Ben sessizce otururken yanı başında",
        "Gölgeli ışıkları süzülür sabahın",
      ],
      [
        "Zor anlarımda bir sesin yeterdi bana",
        "Beklerdim yanında hiç sesin çıkmasa da",
        "Bir gün sen tuttun elimi, bir gün ben senin",
        "Düştük, ama hep kalktık; aynı yolda",
      ],
      ["Seninle dolu her yer", "Seninle dolu yıllar", "Dönüp baktığım her yerde", "Senden bir şeyler var"],
      ["Seninle dolu her yer", "Ne eksilir, ne solar", "Bir hayat geçti derken", "İçimde hâlâ sen var"],
      [
        "Bir gün radyolarda çalar bizim şarkımız",
        "Hiçbir zaman bıkmadık biz, farkında mısın?",
        "Bizden başka bir kimse dinlemese bile",
        "Bizim için en güzel hatıralarımız",
      ],
      [
        "Dolapta bir kutu, içi karmakarışık",
        "Birkaç eski fotoğraf arkadaşlarımız",
        "Biletler, mektuplar ve de şarkı sözleri",
        "Hep kalbimizde gizli sakladıklarımız",
      ],
      ["Seninle dolu her yer", "Seninle dolu yıllar", "Dönüp baktığım her yerde", "Bizden bir şeyler var"],
      ["Seninle dolu her yer", "Ne eksilir, ne solar", "Bir hayat geçti derken", "İçimde hâlâ sen var"],
      ["Yıllar sustu.", "Müzik kaldı.", "Sonra sen—", "Tam karşımdaydın."],
    ],
    // Dawn — warm gold light rising over the same horizon, not clinical
    // ice-blue. Deliberately closer in warmth to DÜN's dusk than a cold
    // palette would be — YARIN is a different *light*, not a different
    // planet — and this warmth is what keeps title/controls readable
    // against it (see PersistentWorld.css: the large-area glow always
    // mixes heavily toward --void, so brightness never approaches the
    // pale-on-pale failure a literal near-white sky would cause).
    accentColor: "#e3ab66",
    world: {
      horizonY: 0.62,
      crowd: 0.26,
      driftSeconds: 85,
    },
  },
  simdi: {
    id: "simdi",
    title: "ŞİMDİ",
    // See DÜN's sources comment — same reasoning.
    sources: [
      { src: "/audio/simdi.m4a", type: 'audio/mp4; codecs="mp4a.40.2"', quality: "high" },
      { src: "/audio/simdi.mp3", type: "audio/mpeg", quality: "compatible" },
    ],
    // AUTHORITATIVE, LOCKED lyrics — verbatim as supplied.
    lyrics: [
      [
        "Filmin adını unuttum",
        "Güldüğün o an aklımda",
        "Sabah sessin ilk duyduğum,",
        "Gece kalan kulağımda",
      ],
      [
        "Artık her sabah",
        "Senle başlasın",
        "Aynı evde",
        "Aynı yastıkta",
        "Sarılarak",
        "Bitsin her gün",
        "Sarılarak",
        "Her bir gece",
      ],
      [
        "Söylenecekler bitti, artık sözler bitti ve sıra sende",
        "Bir hayat var bir umut bir güneş yelken açalım birlikte",
        "Diz çöktüm ruhum bir tanrıçanın saklı bembeyaz ellerinde",
        "Asla sönmez bu ateş, yanar benimle",
        "Benim için cevap belli sonsuza dek",
        "Yürüyecek misin bu yolda benimle?",
      ],
    ],
    // Daylight — the same horizon, fully risen and clear. Neither dusk nor
    // dawn: a settled, neutral light, matching --ink almost exactly.
    accentColor: "#f5f1ea",
    world: {
      horizonY: 0.47,
      crowd: 0.03,
      driftSeconds: 340,
    },
  },
};

export const songOrder: SongId[] = ["dun", "yarin", "simdi"];

/**
 * Which audio source AudioEngine reaches for first, independent of the
 * order sources happen to be listed in for a given song. "WAV support"
 * and "WAV-first streaming on cellular" are deliberately different
 * decisions — this constant is the second one.
 *
 *  "auto-mobile"       — prefer the transparent high-bitrate AAC/M4A
 *                         encode for actual playback (the default; this
 *                         is what mobile/cellular delivery should use).
 *                         Falls through to "compatible", then "lossless"
 *                         only if nothing else is playable.
 *  "lossless-preferred" — prefer the WAV master when the browser can play
 *                         it at all. Useful for, e.g., testing on Wi-Fi,
 *                         or if you decide the audience for this link will
 *                         always be on a fast connection.
 *
 * Within whichever tier wins, `HTMLAudioElement.canPlayType()` still gates
 * the actual pick — a policy asking for a tier the browser can't play at
 * all falls through to the next tier rather than force-loading it.
 */
export type AudioDeliveryPolicy = "auto-mobile" | "lossless-preferred";
export const AUDIO_DELIVERY_POLICY: AudioDeliveryPolicy = "auto-mobile";

export function qualityPreferenceOrder(policy: AudioDeliveryPolicy): SourceQuality[] {
  return policy === "lossless-preferred"
    ? ["lossless", "high", "compatible"]
    : ["high", "compatible", "lossless"];
}

/**
 * Album Mode toggle. Four mechanisms, layered so hosting limitations don't
 * leave you with no way to flip it — see README.md "Switching to Album
 * Mode" for the operational walkthrough of each:
 *
 *  1. Admin panel (/admin route, passphrase-gated) — the intended one.
 *     Writes to ALBUM_FLAG_ENDPOINT if configured (a tiny hosted remote
 *     flag you control — see README for minimal recipes); otherwise falls
 *     back to unlocking only the admin's own device and tells you so, so
 *     you're never left thinking a global flip happened when it didn't.
 *  2. Static remote flag — public/album-mode.json, polled on load.
 *  3. Unlock link — ?unlock=<ALBUM_UNLOCK_PASSPHRASE>, unlocks the device
 *     that opens it.
 *  4. Build-time env var VITE_ALBUM_MODE=true — permanent global default,
 *     requires a redeploy.
 *
 * ALBUM_UNLOCK_PASSPHRASE is obscurity, not security — it's a URL param by
 * design, so it's inherently visible to anyone who sees the link. Change
 * it to something only the two of you would think to type before sharing
 * any link that includes it. ADMIN_PASSPHRASE_HASH is different: the admin
 * route never has the plaintext in the bundle, only a SHA-256 hash of it
 * (see src/admin/AdminPanel.tsx) — still not real security for anything
 * high-stakes, but meaningfully harder to casually read out of the source
 * than a plaintext string, which is the right amount of effort for a
 * route Buğu is never meant to see the existence of.
 *
 * To set your own admin passphrase: pick a phrase, then in any browser
 * console run
 *   crypto.subtle.digest("SHA-256", new TextEncoder().encode("your phrase"))
 *     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,"0")).join("")))
 * and paste the resulting hex string below.
 */
export const albumModeEnvDefault: boolean = import.meta.env.VITE_ALBUM_MODE === "true";
export const REMOTE_ALBUM_MODE_FLAG_URL = "/album-mode.json";
export const ALBUM_UNLOCK_PASSPHRASE = "sensinki";
export const ADMIN_PASSPHRASE_HASH =
  "3f0f2e5c2a2d1e9c9d8b7a6f5e4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1"; // placeholder — replace, see above
/** Optional. If unset, the admin panel can only unlock its own device
 * (still useful, still not nothing) — see README "Album Mode activation". */
export const ALBUM_FLAG_ENDPOINT: string | undefined = import.meta.env.VITE_ALBUM_FLAG_ENDPOINT;

/**
 * Intentionally empty. Do not invent copy for these — fill in later.
 */
export const proposal = {
  date: "",
  location: "",
  note: "",
};

/** Completion threshold: a song counts as "heard" once played past this fraction. */
export const COMPLETION_THRESHOLD = 0.92;

/**
 * The source AudioEngine and usePrefetchNext agree to warm ahead of time for
 * the *next* chapter. Deliberately NOT the lossless master — prefetching a
 * multi-ten-megabyte WAV in the background on cellular is exactly the
 * "aggressively download lossless assets" behavior this build avoids. Falls
 * back to the first available source only if a song has no "high" tier.
 */
export function prefetchSourceFor(song: SongConfig): SongSource | undefined {
  // Deliberately NOT "always high" regardless of policy — under
  // "lossless-preferred", playback will pick the WAV master, so warming
  // the AAC cache instead would warm a file that never actually plays.
  // Skips the "lossless" tier itself even when it's what's about to play,
  // for the same reason multi-source playback exists at all: never
  // background-fetch a multi-megabyte master speculatively.
  const order = qualityPreferenceOrder(AUDIO_DELIVERY_POLICY).filter((q) => q !== "lossless");
  for (const tier of order) {
    const match = song.sources.find((s) => s.quality === tier);
    if (match) return match;
  }
  return song.sources.find((s) => s.quality === "high") ?? song.sources[0];
}
