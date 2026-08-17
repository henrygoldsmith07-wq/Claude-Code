/**
 * At-rest encryption for the local store.
 *
 * AES-GCM with a PBKDF2-derived key, via WebCrypto — available in both the
 * browser and Node 22, so there is no separate code path and no dependency.
 * The passphrase never leaves the caller; only salt, IV and ciphertext are
 * persisted.
 *
 * This protects data at rest on a shared or lost device. It is not a defence
 * against a compromised running process, and nothing here pretends otherwise.
 */

import type { PersistenceAdapter, SyncCursor } from "../events/store.js";
import type { AnyStoredEvent } from "../events/migrate.js";
import type { PulseEvent } from "../events/schema.js";

const PBKDF2_ITERATIONS = 310_000; // OWASP guidance for PBKDF2-HMAC-SHA256.
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedBlob {
  format: "pulse-encrypted";
  version: 1;
  algorithm: "AES-GCM";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function subtle(): SubtleCrypto {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle) {
    throw new Error("WebCrypto is unavailable; Pulse cannot encrypt local data in this environment");
  }
  return crypto.subtle;
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

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const material = await subtle().importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(value: unknown, passphrase: string): Promise<EncryptedBlob> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await subtle().encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, plaintext);

  return {
    format: "pulse-encrypted",
    version: 1,
    algorithm: "AES-GCM",
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson<T>(blob: EncryptedBlob, passphrase: string): Promise<T> {
  if (blob.format !== "pulse-encrypted") throw new Error("Not a Pulse encrypted blob");
  const key = await deriveKey(passphrase, fromBase64(blob.salt), blob.iterations);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await subtle().decrypt(
      { name: "AES-GCM", iv: fromBase64(blob.iv) as unknown as BufferSource },
      key,
      fromBase64(blob.ciphertext) as unknown as BufferSource,
    );
  } catch {
    // AES-GCM authentication failure is indistinguishable from a wrong
    // passphrase, and saying more would be a guessing oracle.
    throw new Error("Could not decrypt: wrong passphrase, or the data has been altered");
  }
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export interface BlobStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

/** localStorage-backed blob storage, for the browser build. */
export function createLocalStorageBlobStorage(key = "pulse.store"): BlobStorage {
  return {
    async read() {
      return globalThis.localStorage?.getItem(key) ?? null;
    },
    async write(value) {
      globalThis.localStorage?.setItem(key, value);
    },
  };
}

export function createMemoryBlobStorage(): BlobStorage {
  let held: string | null = null;
  return {
    async read() {
      return held;
    },
    async write(value) {
      held = value;
    },
  };
}

export interface EncryptedAdapter<T> {
  load(): Promise<T | null>;
  save(snapshot: T): Promise<void>;
}

/**
 * Wraps any blob storage in transparent encryption for an arbitrary snapshot
 * type. `createEncryptedAdapter` is the event store's form of this; the
 * generic form encrypts anything else — e.g. the insight history — the same
 * way, so every kind of persisted data shares one on-disk format.
 */
export function createEncryptedBlobAdapter<T>(storage: BlobStorage, passphrase: string): EncryptedAdapter<T> {
  return {
    async load() {
      const raw = await storage.read();
      if (!raw) return null;
      const blob = JSON.parse(raw) as EncryptedBlob;
      return decryptJson<T>(blob, passphrase);
    },
    async save(snapshot: T) {
      const blob = await encryptJson(snapshot, passphrase);
      await storage.write(JSON.stringify(blob));
    },
  };
}

/**
 * Wraps any blob storage in transparent encryption, producing a
 * `PersistenceAdapter` the event store can use unchanged.
 *
 * Implemented inline rather than through `createEncryptedBlobAdapter` because
 * the event snapshot type is asymmetric — it saves `PulseEvent`s but loads
 * `AnyStoredEvent`s awaiting migration — and that asymmetry is exactly what
 * the store's interface describes.
 */
export function createEncryptedAdapter(storage: BlobStorage, passphrase: string): PersistenceAdapter {
  return {
    async load() {
      const raw = await storage.read();
      if (!raw) return null;
      const blob = JSON.parse(raw) as EncryptedBlob;
      return decryptJson<{ events: AnyStoredEvent[]; cursors: SyncCursor[] }>(blob, passphrase);
    },
    async save(snapshot: { events: PulseEvent[]; cursors: SyncCursor[] }) {
      const blob = await encryptJson(snapshot, passphrase);
      await storage.write(JSON.stringify(blob));
    },
  };
}
