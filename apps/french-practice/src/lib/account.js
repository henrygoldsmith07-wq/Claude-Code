// Optional account & sync layer — fully client-side, no backend.
//
// A "sync code" is a portable, self-contained snapshot of all your progress
// that you copy on one device and paste on another (or move as a file). With a
// passphrase it's encrypted with AES-GCM (key stretched from the passphrase via
// PBKDF2), so it's safe to send to yourself over any channel. Without one it's
// a plain, base64-wrapped backup. Either way the private API key is never
// included (exportProgress omits it).

import { exportProgress, importProgress, markBackup } from './storage';

const PREFIX = 'LS1:'; // identifies a Le Studio sync code
const PBKDF2_ROUNDS = 150000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const subtle = () => globalThis.crypto?.subtle;

function bufToB64(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase, salt) {
  const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Build a sync code from the current progress. Pass a non-empty passphrase to
// encrypt it. Records the backup time as a side effect.
export async function makeSyncCode(passphrase = '') {
  const snapshot = exportProgress();
  let envelope;
  if (passphrase && subtle()) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(snapshot)));
    envelope = { v: 1, enc: true, salt: bufToB64(salt), iv: bufToB64(iv), data: bufToB64(ct) };
  } else {
    envelope = { v: 1, enc: false, snapshot };
  }
  markBackup();
  return PREFIX + bufToB64(enc.encode(JSON.stringify(envelope)));
}

// Restore progress from a sync code. Returns the number of items restored.
// Throws a friendly error on a bad code or wrong/missing passphrase.
export async function restoreSyncCode(code, passphrase = '') {
  const trimmed = String(code || '').trim();
  if (!trimmed.startsWith(PREFIX)) {
    throw new Error('That is not a valid sync code.');
  }
  let envelope;
  try {
    envelope = JSON.parse(dec.decode(b64ToBuf(trimmed.slice(PREFIX.length))));
  } catch {
    throw new Error('This sync code is corrupted or incomplete.');
  }
  let snapshot;
  if (envelope.enc) {
    if (!passphrase) throw new Error('This code is encrypted — enter its passphrase.');
    if (!subtle()) throw new Error('Encrypted codes need a secure browser context (https).');
    try {
      const key = await deriveKey(passphrase, b64ToBuf(envelope.salt));
      const pt = await subtle().decrypt({ name: 'AES-GCM', iv: b64ToBuf(envelope.iv) }, key, b64ToBuf(envelope.data));
      snapshot = JSON.parse(dec.decode(pt));
    } catch {
      throw new Error('Wrong passphrase, or the code was altered.');
    }
  } else {
    snapshot = envelope.snapshot;
  }
  return importProgress(snapshot);
}

export const isEncryptedCode = (code) => {
  try {
    const t = String(code || '').trim();
    if (!t.startsWith(PREFIX)) return false;
    return JSON.parse(dec.decode(b64ToBuf(t.slice(PREFIX.length)))).enc === true;
  } catch {
    return false;
  }
};
