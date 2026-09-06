import {
  albumModeEnvDefault,
  REMOTE_ALBUM_MODE_FLAG_URL,
  ALBUM_UNLOCK_PASSPHRASE,
  ALBUM_FLAG_ENDPOINT,
} from "../config/songs";

/**
 * Album Mode toggle — see config/songs.ts for the three mechanisms this
 * wires together (env var, remote JSON flag, unlock link) and why.
 */
const OVERRIDE_KEY = "bugu.albumMode.override"; // dev-only true/false force
const PERMANENT_KEY = "bugu.albumMode.unlocked"; // set once, never unset

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable — the unlock simply won't persist on this device;
    // nothing else should break.
  }
}

/**
 * Synchronous check for the very first render — must never flash Journey
 * Mode first and then jump to Album Mode a moment later, so this has to be
 * resolvable instantly (no network).
 */
export function isAlbumMode(): boolean {
  const override = readLocal(OVERRIDE_KEY);
  if (override === "true") return true;
  if (override === "false") return false;

  if (readLocal(PERMANENT_KEY) === "true") return true;

  return albumModeEnvDefault;
}

/** Unlocks Album Mode permanently on THIS device only — used by the admin
 * panel as a always-available local fallback/convenience alongside
 * whatever remote action it also attempts. */
export function unlockThisDevicePermanently() {
  writeLocal(PERMANENT_KEY, "true");
}

/**
 * Checks the URL for ?unlock=<passphrase>. If it matches, permanently
 * unlocks Album Mode on this device and strips the param so it never ends
 * up in a screenshot, browser history entry, or gets shared onward
 * unintentionally. Call once, before first render.
 */
export function checkUnlockLink(): boolean {
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return false;
  }

  const attempt = url.searchParams.get("unlock");
  if (!attempt) return false;

  const matched = attempt === ALBUM_UNLOCK_PASSPHRASE;
  url.searchParams.delete("unlock");
  window.history.replaceState({}, "", url.toString());

  if (matched) {
    writeLocal(PERMANENT_KEY, "true");
  }
  return matched;
}

/** Shared response shape for both the static JSON fallback and any real
 * hosted endpoint plugged in via ALBUM_FLAG_ENDPOINT — keeping one shape
 * means the admin panel and this poll never need to know which one is
 * actually configured. */
interface AlbumFlagResponse {
  albumMode?: unknown;
}

function readAlbumModeFlag(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as AlbumFlagResponse).albumMode === true;
}

/**
 * Best-effort remote check. Tries ALBUM_FLAG_ENDPOINT first if configured
 * (the admin panel's actual global flag), then always falls back to the
 * static public/album-mode.json regardless — a real endpoint and the free
 * static-file mechanism aren't mutually exclusive, and checking both costs
 * nothing on a normal connection. Any failure (offline, 404, malformed
 * JSON, no endpoint configured at all) is a silent no-op — this must never
 * be able to break or delay the journey. On success, persists the unlock
 * permanently so future loads don't depend on this fetch succeeding again.
 */
export async function pollRemoteAlbumModeFlag(): Promise<boolean> {
  if (ALBUM_FLAG_ENDPOINT) {
    try {
      const res = await fetch(`${ALBUM_FLAG_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok && readAlbumModeFlag(await res.json())) {
        writeLocal(PERMANENT_KEY, "true");
        return true;
      }
    } catch {
      // fall through to the static-file check below
    }
  }

  try {
    const res = await fetch(`${REMOTE_ALBUM_MODE_FLAG_URL}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return false;
    const unlocked = readAlbumModeFlag(await res.json());
    if (unlocked) writeLocal(PERMANENT_KEY, "true");
    return unlocked;
  } catch {
    return false;
  }
}

/**
 * Writes `{ albumMode: true }` to ALBUM_FLAG_ENDPOINT — the admin panel's
 * action. Requires an endpoint to actually be configured (see README
 * "Album Mode activation" for minimal hosted-backend recipes); if none is
 * set, this is honest about doing nothing remote and the caller should
 * fall back to unlocking only the current device.
 *
 * The `secret` is never the plaintext admin passphrase — AdminPanel passes
 * its SHA-256 hash, sent as a bearer token so whatever tiny backend you
 * wire up can check it without ever seeing (or needing to store) the
 * actual phrase.
 */
export async function setRemoteAlbumModeFlag(secretHash: string): Promise<{ ok: boolean; message: string }> {
  if (!ALBUM_FLAG_ENDPOINT) {
    return {
      ok: false,
      message:
        "Uzak bir uç nokta (ALBUM_FLAG_ENDPOINT) tanımlı değil — sadece bu cihaz kalıcı olarak açıldı.",
    };
  }
  try {
    const res = await fetch(ALBUM_FLAG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretHash}`,
      },
      body: JSON.stringify({ albumMode: true }),
    });
    if (!res.ok) {
      return { ok: false, message: `Uzak uç nokta hata döndürdü (${res.status}).` };
    }
    return { ok: true, message: "Albüm Modu genel olarak açıldı." };
  } catch {
    return { ok: false, message: "Uzak uç noktaya ulaşılamadı (bağlantı sorunu)." };
  }
}
