const CACHE = 'forq-shell-v3';
const SHELL = [
  '/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png',
  '/recipe-images/breakfast.webp', '/recipe-images/curry.webp', '/recipe-images/noodles.webp',
  '/recipe-images/pasta.webp', '/recipe-images/roast.webp', '/recipe-images/salad.webp',
  '/recipe-images/sandwich.webp', '/recipe-images/tacos.webp',
  '/recipe-images/families/bagel.webp', '/recipe-images/families/bibimbap.webp',
  '/recipe-images/families/brownie.webp', '/recipe-images/families/couscous.webp',
  '/recipe-images/families/crumble.webp', '/recipe-images/families/frittata.webp',
  '/recipe-images/families/overnight.webp', '/recipe-images/families/pizza.webp',
  '/recipe-images/families/roastveg.webp', '/recipe-images/families/salmon.webp',
  '/recipe-images/families/shakshuka.webp', '/recipe-images/families/smoothie.webp',
  '/recipe-images/families/stirfry.webp', '/recipe-images/families/tacos.webp',
  '/recipe-images/families/tuna.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))),
  );
});
