// ---------------------------------------------------------------------------
// End-to-end encryption for sync.
//
// Sync is optional. When it is on, the server stores one opaque blob per user
// and cannot read any of it: the key is derived from a passphrase that never
// leaves the device, using PBKDF2-SHA-256, and the payload is sealed with
// AES-GCM.
//
// This matters more here than in most apps. The synced data is a record of
// someone's difficult conversations, what they find hard about talking to
// people, and what they wrote about it afterwards. Server-side encryption
// would make that readable by anyone who could read the database; this makes it
// readable by nobody but the user.
//
// The trade-off is stated plainly in the UI: lose the passphrase and the synced
// copy is unrecoverable. There is no reset, because a reset would mean the
// server could decrypt.
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface SealedPayload {
  /** Base64. */
  ciphertext: string;
  iv: string;
  salt: string;
  /** Bumped if the KDF parameters ever change, so old blobs stay readable. */
  version: 1;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function seal(data: unknown, passphrase: string): Promise<SealedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, encoded);
  return {
    ciphertext: toBase64(new Uint8Array(sealed)),
    iv: toBase64(iv),
    salt: toBase64(salt),
    version: 1,
  };
}

export async function open<T>(payload: SealedPayload, passphrase: string): Promise<T> {
  const key = await deriveKey(passphrase, fromBase64(payload.salt));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv) as BufferSource },
    key,
    fromBase64(payload.ciphertext) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/**
 * Passphrase strength, checked before sync is enabled. A weak passphrase on an
 * encrypted blob is worse than no encryption, because it looks like protection.
 */
export function passphraseStrength(passphrase: string): { ok: boolean; message: string } {
  if (passphrase.length < 12) {
    return { ok: false, message: "Use at least 12 characters. Three or four unrelated words work well." };
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(passphrase)).length;
  const words = passphrase.trim().split(/\s+/).length;
  if (words < 3 && classes < 3) {
    return { ok: false, message: "Either use three or more words, or mix cases, digits and symbols." };
  }
  return { ok: true, message: "Strong enough. There is no way to recover this if you lose it." };
}

/** Whether WebCrypto is usable. Sync is offered only where it is. */
export function cryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}
