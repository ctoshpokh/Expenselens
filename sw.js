// ReceiptIQ service worker: network-first for the app shell, never caches cloud API calls.
const CACHE_NAME = 'receiptiq-v2';
const SHELL = ['./', './index.html', './manifest.json'];
const BYPASS_HOSTS = ['api.jsonbin.io', 'api.anthropic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (BYPASS_HOSTS.includes(url.hostname)) return;     // cloud data: always straight to network, never cached
  if (url.origin !== self.location.origin) return;     // CDN assets: browser handles them

  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // Bypass the HTTP cache so a new index.html is picked up immediately
    const fresh = await fetch(req.url, { cache: 'no-store' });
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    if (cached) return cached;
    throw err;
  }
}
