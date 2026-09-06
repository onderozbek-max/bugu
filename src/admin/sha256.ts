/**
 * Web Crypto SHA-256, hex-encoded. Used only to compare a typed passphrase
 * against ADMIN_PASSPHRASE_HASH without ever holding the plaintext phrase
 * in the client bundle. Not real cryptographic authentication (there's no
 * salt, no rate limiting, no server-side verification of the hash itself)
 * — an appropriate, deliberately small amount of effort for a route Buğu
 * is never meant to know exists, not a claim of real security.
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
