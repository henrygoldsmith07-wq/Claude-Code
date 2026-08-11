/** Local encryption (WebCrypto, AES-GCM). Opt-in for local-only/before-upload.
 * Passphrase-derived (PBKDF2) so the key is portable if the user remembers it.
 * Falls back to device-bound random key in IndexedDB when no passphrase.
 */
export const ENC_ALGO: AesKeyGenParams = { name: "AES-GCM", length: 256 };

function hasCrypto(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 120_000, hash: "SHA-256" } as Pbkdf2Params,
    base,
    ENC_ALGO,
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBytes(bytes: Uint8Array, passphrase: string): Promise<{ iv: string; salt: string; ciphertext: string }> {
  if (!hasCrypto()) throw new Error("WebCrypto unavailable");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource } as AesGcmParams, key, bytes as unknown as BufferSource);
  const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
  return { iv: toB64(iv), salt: toB64(salt), ciphertext: toB64(new Uint8Array(ct)) };
}

export async function decryptBytes(payload: { iv: string; salt: string; ciphertext: string }, passphrase: string): Promise<Uint8Array> {
  if (!hasCrypto()) throw new Error("WebCrypto unavailable");
  const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const key = await deriveKey(passphrase, fromB64(payload.salt));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(payload.iv) as unknown as BufferSource } as AesGcmParams, key, fromB64(payload.ciphertext) as unknown as BufferSource);
  return new Uint8Array(pt);
}

export function isEncryptedFlag(mimeType: string): boolean {
  return mimeType.includes("encrypted");
}
