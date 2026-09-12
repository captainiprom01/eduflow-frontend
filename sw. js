// Minimal service worker: just enough to make the app installable and to
// keep the app shell (this HTML file + logo + icons) available if the
// person opens the app with no connection. It deliberately does NOT cache
// API calls to the backend — those always need to be live/fresh, and
// they're a different origin anyway (Render), so this worker leaves them
// alone entirely.

const CACHE_NAME = 'eduflow-shell-v1';
const SHELL_FILES = ['./', './index.html', './logo.png', './icon-192.png', './icon-512.png', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => { /* fine if a file is missing — just skip caching it */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isShellRequest = event.request.method === 'GET' && url.origin === self.location.origin;
  if (!isShellRequest) return; // let API calls and third-party CDN requests pass through untouched

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
