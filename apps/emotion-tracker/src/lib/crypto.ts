// Local vault encryption using WebCrypto AES-GCM + PBKDF2.
// All crypto runs client-side — nothing leaves the browser. "Local-only mode"
// means the Reflect API is not called at all.

const PBKDF2_ITERS = 120_000;
const SALT_LEN = 16;
const IV_LEN = 12;

function enc(s: string): Uint8Array { return new TextEncoder().encode(s); }
function dec(b: Uint8Array): string { return new TextDecoder().decode(b); }
function b64(b: Uint8Array): string {
  // Chunked conversion — per-byte concatenation is painfully slow on
  // multi-hundred-KB vault payloads.
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < b.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + CHUNK)) as unknown as number[]);
  }
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc(passphrase) as unknown as BufferSource, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedBlob {
  v: 1;
  salt: string; // b64
  iv: string;   // b64
  ct: string;   // b64
}

export async function encryptJson(passphrase: string, value: unknown): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt);
  const pt = enc(JSON.stringify(value));
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, pt as unknown as BufferSource);
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ctBuf)) };
}

export async function decryptJson<T>(passphrase: string, blob: EncryptedBlob): Promise<T> {
  if (blob.v !== 1) throw new Error("Unsupported vault version");
  const salt = fromB64(blob.salt);
  const iv = fromB64(blob.iv);
  const ct = fromB64(blob.ct);
  const key = await deriveKey(passphrase, salt);
  const ptBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, ct as unknown as BufferSource);
  return JSON.parse(dec(new Uint8Array(ptBuf))) as T;
}

// ── key UX: verify before restoring, and re-key without losing the vault ─
export async function verifyPassphrase(passphrase: string, blob: EncryptedBlob): Promise<boolean> {
  try {
    await decryptJson(passphrase, blob);
    return true;
  } catch {
    return false;
  }
}

export async function rekeyVault(passphrase: string, newPassphrase: string, blob: EncryptedBlob): Promise<EncryptedBlob> {
  const value = await decryptJson(passphrase, blob);
  return encryptJson(newPassphrase, value);
}

// ── passphrase strength hint (local, no zxcvbn dep) ───────────────────
export function passphraseStrength(p: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (p.length < 8) return { score: 0, label: "too short" };
  let s = 0;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  if (s <= 0) return { score: 1, label: "weak" };
  if (s === 1) return { score: 1, label: "weak" };
  if (s === 2) return { score: 2, label: "okay" };
  return { score: 3, label: "strong" };
}
