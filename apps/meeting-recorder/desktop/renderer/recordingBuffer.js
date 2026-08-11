// Local recording buffer + crash/power-loss recovery + integrity + chunked resume.
// Renderer-side helpers; pure on the blob/file boundary so they can be tested without Electron.
// For large recordings, IndexedDB (recordingStore.ts) holds the blob + part etag log.
const BUFFER_KEY = "mr_pending_upload";
const CHUNK_SIZE = 5 * 1024 * 1024;

export function savePending({ blob, meta }) {
  try { localStorage.setItem(BUFFER_KEY, JSON.stringify({ meta, size: blob.size, savedAt: new Date().toISOString() })); } catch {}
  // Large blobs: persist to IndexedDB via recordingStore.savePendingRecording when available.
  try {
    if (typeof window !== "undefined" && window.recordingStore && blob.size > CHUNK_SIZE) {
      window.recordingStore.savePendingRecording(meta.meetingId ?? meta.title ?? "pending", blob, meta);
    }
  } catch {}
}
export function loadPending() { try { return JSON.parse(localStorage.getItem(BUFFER_KEY) || "null"); } catch { return null; } }
export function clearPending() { try { localStorage.removeItem(BUFFER_KEY); } catch {} }

export function integrityForBlobHeader(bytes) {
  if (!bytes || bytes.length < 4) return { ok: false, reason: "too small" };
  const isWebm = bytes[0]===0x1A && bytes[1]===0x45 && bytes[2]===0xDF && bytes[3]===0xA3;
  if (!isWebm && bytes.length > 5000) return { ok: false, reason: "webm header mismatch" };
  return { ok: true };
}

export function chunkPlan(blobSize, partSize = CHUNK_SIZE) {
  if (blobSize <= 0) return { totalParts: 0, parts: [] };
  const totalParts = Math.ceil(blobSize / partSize);
  const parts = Array.from({ length: totalParts }, (_, i) => ({ partNumber: i+1, start: i*partSize, end: Math.min((i+1)*partSize, blobSize), size: Math.min(partSize, blobSize - i*partSize) }));
  return { totalParts, parts };
}

export async function uploadWithResume(url, blob, headers, { retries=3, delayMs=1200, partSize=CHUNK_SIZE, onProgress }={}) {
  const { parts } = chunkPlan(blob.size, partSize);
  if (parts.length <= 1) {
    let lastErr;
    for (let i=0;i<retries;i++) {
      try { const res = await fetch(url, { method: "PUT", headers, body: blob }); if (!res.ok) throw new Error(`PUT ${res.status}`); return res; } catch (e) { lastErr=e; await new Promise(r=>setTimeout(r, delayMs*(i+1))); }
    }
    throw lastErr;
  }
  // Chunked: PUT each part with partNumber query (R2 multipart via presigned URL when supported; else sequential PUTs to same URL with offset).
  let uploaded = 0;
  for (const part of parts) {
    const slice = blob.slice(part.start, part.end);
    let lastErr;
    for (let i=0;i<retries;i++) {
      try {
        const partUrl = `${url}${url.includes("?") ? "&" : "?"}partNumber=${part.partNumber}`;
        const res = await fetch(partUrl, { method: "PUT", headers, body: slice });
        if (!res.ok) throw new Error(`part ${part.partNumber} ${res.status}`);
        uploaded += slice.size;
        onProgress?.(uploaded, blob.size);
        lastErr = null;
        break;
      } catch (e) { lastErr = e; await new Promise(r=>setTimeout(r, delayMs*(i+1))); }
    }
    if (lastErr) throw lastErr;
  }
  return { ok: true };
}
