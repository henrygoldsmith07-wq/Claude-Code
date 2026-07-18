// Le Studio service worker: makes the app usable offline. Strategy is
// network-first with a cache fallback — online visitors always get fresh
// assets (so new builds ship immediately), while offline visitors are served
// the last-seen version from the runtime cache. TTS audio is generated on the
// device by the browser, so it keeps working with no network at all.

const CACHE = 'le-studio-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GET; let the API (Groq) and cross-origin pass through.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache a copy of successful responses for offline use.
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit || caches.match('./index.html'))
      )
  );
});

// Let the page ask how much is cached (drives the offline-readiness UI).
self.addEventListener('message', (event) => {
  if (event.data === 'cache-count' && event.source) {
    caches.open(CACHE)
      .then((c) => c.keys())
      .then((keys) => event.source.postMessage({ type: 'cache-count', count: keys.length }))
      .catch(() => event.source.postMessage({ type: 'cache-count', count: 0 }));
  }
});
