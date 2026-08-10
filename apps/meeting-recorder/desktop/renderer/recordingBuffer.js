// Local recording buffer + crash recovery + integrity + resume.
// Renderer-side helpers; pure on the blob/file boundary so they can be tested without Electron.
const BUFFER_KEY = "mr_pending_upload";

export function savePending({ blob, meta }) {
  // Store blob as base64 in localStorage for small recordings; for large, rely on IndexedDB in future.
  // Conservative: only store meta + size for recovery signal.
  try { localStorage.setItem(BUFFER_KEY, JSON.stringify({ meta, size: blob.size, savedAt: new Date().toISOString() })); } catch {}
}
export function loadPending() { try { return JSON.parse(localStorage.getItem(BUFFER_KEY) || "null"); } catch { return null; } }
export function clearPending() { try { localStorage.removeItem(BUFFER_KEY); } catch {} }

export function integrityForBlobHeader(bytes) {
  if (!bytes || bytes.length < 4) return { ok: false, reason: "too small" };
  const isWebm = bytes[0]===0x1A && bytes[1]===0x45 && bytes[2]===0xDF && bytes[3]===0xA3;
  if (!isWebm && bytes.length > 5000) return { ok: false, reason: "webm header mismatch" };
  return { ok: true };
}

export async function uploadWithResume(url, blob, headers, { retries=3, delayMs=1200 }={}) {
  let lastErr;
  for (let i=0;i<retries;i++) {
    try {
      const res = await fetch(url, { method: "PUT", headers, body: blob });
      if (!res.ok) throw new Error(`PUT ${res.status}`);
      return res;
    } catch (e) { lastErr=e; await new Promise(r=>setTimeout(r, delayMs*(i+1))); }
  }
  throw lastErr;
}
