// Offline / low-bandwidth caching helpers (client + service-worker hint).
// Uses Cache API when available, falls back to no-op.

const CACHE_NAME = "world-news-lite-v1";
const OFFLINE_URLS = ["/", "/world", "/feed"];

export async function precacheLite(): Promise<void> {
  if (typeof caches === "undefined" || typeof window === "undefined") return;
  try {
    const c = await caches.open(CACHE_NAME);
    await c.addAll(OFFLINE_URLS.map(u=> `${u}?lite=1`));
  } catch {}
}

export async function cacheNews(key: string, payload: unknown): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const c = await caches.open(CACHE_NAME);
    await c.put(`/cache/news/${key}`, new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } }));
  } catch {}
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function perfMark(name: string): void {
  try { performance.mark(name); } catch {}
}

export function perfMeasure(name: string, start: string, end?: string): number | null {
  try {
    if (end) performance.mark(end);
    const m = performance.measure(name, start, end);
    return m.duration;
  } catch { return null; }
}
