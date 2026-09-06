/**
 * ==================== TEMPORARY — PRODUCTION AUDIO DIAGNOSTICS ====================
 * "DEPLOYED FILE PROBE": fetches a source URL directly (same-origin, no
 * special headers beyond a follow-up Range request) and reports exactly
 * what bytes actually came back — status, headers, real byte length, and a
 * hex/ASCII dump of the first 32 bytes — so an HTML error page, an LFS
 * pointer file, or a truncated/wrong response is impossible to miss. Delete
 * this file and its usage in SongScreen.tsx once the deployed "Yüklenemedi"
 * cause is confirmed and fixed.
 */

export interface RangeProbeResult {
  status: number;
  contentRange: string | null;
  byteCount: number;
  first32Hex: string;
}

export interface FileProbeResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  contentType: string | null;
  contentLength: string | null;
  acceptRanges: string | null;
  contentRange: string | null;
  actualByteLength: number;
  first32Hex: string;
  first32Ascii: string;
  looksLikeHtmlOrText: boolean;
  looksLikeLfsPointer: boolean;
  range: RangeProbeResult | { error: string };
  fetchError: string | null;
}

function hexAndAscii(bytes: Uint8Array): { hex: string; ascii: string } {
  let hex = "";
  let ascii = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0") + " ";
    ascii += bytes[i] >= 32 && bytes[i] <= 126 ? String.fromCharCode(bytes[i]) : ".";
  }
  return { hex: hex.trim(), ascii };
}

const TEXT_SIGNATURES = ["<!doctype", "<html", "<head", "<body"];

export async function probeDeployedFile(url: string): Promise<FileProbeResult> {
  const empty32 = { hex: "", ascii: "" };
  try {
    const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    const buf = await res.arrayBuffer();
    const first32 = new Uint8Array(buf).slice(0, 32);
    const { hex, ascii } = buf.byteLength > 0 ? hexAndAscii(first32) : empty32;
    const asciiLower = ascii.toLowerCase();
    const looksLikeHtmlOrText = TEXT_SIGNATURES.some((s) => asciiLower.includes(s));
    // A real LFS pointer file is plain text starting exactly with this line;
    // 32 bytes is enough to catch "version https://git-lfs.github.com/spec/v1".
    const looksLikeLfsPointer = asciiLower.includes("version https://git-lfs");

    let range: RangeProbeResult | { error: string };
    try {
      const rRes = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Range: "bytes=0-63" },
      });
      const rBuf = await rRes.arrayBuffer();
      const rFirst32 = new Uint8Array(rBuf).slice(0, 32);
      range = {
        status: rRes.status,
        contentRange: rRes.headers.get("content-range"),
        byteCount: rBuf.byteLength,
        first32Hex: rBuf.byteLength > 0 ? hexAndAscii(rFirst32).hex : "",
      };
    } catch (e) {
      range = { error: e instanceof Error ? e.message : String(e) };
    }

    return {
      requestedUrl: url,
      finalUrl: res.url,
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type"),
      contentLength: res.headers.get("content-length"),
      acceptRanges: res.headers.get("accept-ranges"),
      contentRange: res.headers.get("content-range"),
      actualByteLength: buf.byteLength,
      first32Hex: hex,
      first32Ascii: ascii,
      looksLikeHtmlOrText,
      looksLikeLfsPointer,
      range,
      fetchError: null,
    };
  } catch (e) {
    return {
      requestedUrl: url,
      finalUrl: url,
      status: 0,
      ok: false,
      contentType: null,
      contentLength: null,
      acceptRanges: null,
      contentRange: null,
      actualByteLength: 0,
      first32Hex: "",
      first32Ascii: "",
      looksLikeHtmlOrText: false,
      looksLikeLfsPointer: false,
      range: { error: "not attempted — main fetch failed" },
      fetchError: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    };
  }
}
/** ==================== end temporary file ==================== */
