/** IndexedDB recording store + chunked-upload helpers (web-safe).
 * Provides crash/power-loss recovery: blob + part etag log survives reload.
 * Falls back to in-memory when IndexedDB is unavailable (SSR/tests).
 */
export const DB_NAME = "meeting-recorder";
export const STORE = "pendingRecordings";
export const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_RETRIES = 4;

export interface PendingRecording {
  id: string;
  title: string;
  mimeType: string;
  durationSec: number;
  createdAt: string;
  blobSize: number;
  r2Key?: string;
  meetingId?: string;
  uploadUrl?: string;
  partSize: number;
  uploadedParts: { partNumber: number; etag: string; size: number }[];
  totalParts: number;
  savedAt: string;
}

export function chunkPlan(blobSize: number, partSize = CHUNK_SIZE): { totalParts: number; parts: { partNumber: number; start: number; end: number; size: number }[] } {
  if (blobSize <= 0) return { totalParts: 0, parts: [] };
  const totalParts = Math.ceil(blobSize / partSize);
  const parts = Array.from({ length: totalParts }, (_, i) => {
    const start = i * partSize;
    const end = Math.min(start + partSize, blobSize);
    return { partNumber: i + 1, start, end, size: end - start };
  });
  return { totalParts, parts };
}

export function resumeNeeded(pending: PendingRecording | null): boolean {
  if (!pending) return false;
  return pending.uploadedParts.length < pending.totalParts;
}

export function nextPartToUpload(pending: PendingRecording): number | null {
  const uploaded = new Set(pending.uploadedParts.map((p) => p.partNumber));
  for (let n = 1; n <= pending.totalParts; n++) if (!uploaded.has(n)) return n;
  return null;
}

export function integrityCheck(bytes: Uint8Array, expectedMime: string): { ok: boolean; reason?: string } {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty file" };
  if (bytes.byteLength < 1024) return { ok: false, reason: "file too small — truncated?" };
  if (expectedMime.includes("webm") && bytes.byteLength > 5000) {
    const isWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    const isMp4 = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
    if (!isWebm && !isMp4) return { ok: false, reason: "header mismatch — may be corrupted" };
  }
  return { ok: true };
}

// ---- IndexedDB (lazy, web-only) ----

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) return reject(new Error("no IndexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const memoryFallback = new Map<string, PendingRecording & { blob?: Blob }>();

export async function savePendingRecording(id: string, blob: Blob, meta: Omit<PendingRecording, "blobSize" | "savedAt" | "uploadedParts" | "totalParts" | "partSize"> & Partial<Pick<PendingRecording, "partSize">>): Promise<PendingRecording> {
  const partSize = meta.partSize ?? CHUNK_SIZE;
  const { totalParts } = chunkPlan(blob.size, partSize);
  const record: PendingRecording = {
    id,
    title: meta.title,
    mimeType: meta.mimeType,
    durationSec: meta.durationSec,
    createdAt: meta.createdAt,
    blobSize: blob.size,
    r2Key: meta.r2Key,
    meetingId: meta.meetingId,
    uploadUrl: meta.uploadUrl,
    partSize,
    uploadedParts: [],
    totalParts,
    savedAt: new Date().toISOString(),
  };
  if (!hasIDB()) {
    memoryFallback.set(id, { ...record, blob });
    try { localStorage.setItem("mr_pending_meta", JSON.stringify(record)); } catch {}
    return record;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...record, blob });
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch {
    memoryFallback.set(id, { ...record, blob });
  }
  return record;
}

export async function loadPendingRecording(id: string): Promise<(PendingRecording & { blob?: Blob }) | null> {
  if (memoryFallback.has(id)) return memoryFallback.get(id)!;
  if (!hasIDB()) {
    try {
      const raw = localStorage.getItem("mr_pending_meta");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingRecording;
      if (parsed.id !== id) return null;
      return parsed;
    } catch { return null; }
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    const val: (PendingRecording & { blob?: Blob }) | undefined = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    db.close();
    return val ?? null;
  } catch { return null; }
}

export async function listPendingRecordings(): Promise<PendingRecording[]> {
  if (!hasIDB()) return Array.from(memoryFallback.values()).map(({ blob: _b, ...r }) => r);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    const vals: (PendingRecording & { blob?: Blob })[] = await new Promise((res, rej) => { req.onsuccess = () => res(req.result as unknown as (PendingRecording & { blob?: Blob })[]); req.onerror = () => rej(req.error); });
    db.close();
    return vals.map(({ blob: _b, ...r }) => r);
  } catch { return []; }
}

export async function markPartUploaded(id: string, partNumber: number, etag: string, size: number): Promise<void> {
  const rec = await loadPendingRecording(id);
  if (!rec) return;
  const updated: PendingRecording & { blob?: Blob } = { ...rec, uploadedParts: [...(rec.uploadedParts ?? []), { partNumber, etag, size }].sort((a,b)=>a.partNumber-b.partNumber) } as PendingRecording & { blob?: Blob };
  if (memoryFallback.has(id)) { memoryFallback.set(id, updated); return; }
  if (!hasIDB()) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(updated);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch { memoryFallback.set(id, updated); }
}

export async function clearPendingRecording(id: string): Promise<void> {
  memoryFallback.delete(id);
  try { if (typeof localStorage !== "undefined") localStorage.removeItem("mr_pending_meta"); } catch {}
  if (!hasIDB()) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch {}
}

export async function uploadWithResume(
  id: string,
  blob: Blob,
  presignedBaseUrl: string,
  headers: Record<string,string>,
  opts: { partSize?: number; retries?: number; onProgress?: (uploaded: number, total: number) => void; fetchImpl?: typeof fetch } = {}
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const partSize = opts.partSize ?? CHUNK_SIZE;
  const retries = opts.retries ?? MAX_RETRIES;
  const { parts } = chunkPlan(blob.size, partSize);
  let uploaded = 0;
  for (const part of parts) {
    const pending = await loadPendingRecording(id);
    if (pending?.uploadedParts.some((p) => p.partNumber === part.partNumber)) { uploaded += part.size; continue; }
    const slice = blob.slice(part.start, part.end);
    let lastErr: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const url = `${presignedBaseUrl}${presignedBaseUrl.includes("?") ? "&" : "?"}partNumber=${part.partNumber}&uploadId=${encodeURIComponent(id)}`;
        const res = await fetchImpl(url, { method: "PUT", headers, body: slice });
        if (!res.ok) throw new Error(`part ${part.partNumber} failed: ${res.status}`);
        const etag = res.headers.get("etag") ?? `part-${part.partNumber}`;
        await markPartUploaded(id, part.partNumber, etag, part.size);
        uploaded += part.size;
        opts.onProgress?.(uploaded, blob.size);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    if (lastErr) throw lastErr;
  }
}
