/** PWA + offline/low-bandwidth caching helpers (web-safe). */
export function registerServiceWorker(url = "/sw.js"): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(url).catch(()=>{});
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function lowBandwidth(): boolean {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData) return true;
  if (c?.effectiveType && ["slow-2g","2g"].includes(c.effectiveType)) return true;
  return false;
}

export const CACHE_NAME = "meeting-recorder-v1";
export async function precache(urls: string[]): Promise<void> {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(urls).catch(()=>{});
}
