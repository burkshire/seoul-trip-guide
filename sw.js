const scope = new URL(self.registration.scope);
const entry = new URL('index.html', scope);
const cachePrefix = `korea-trip:${scope.href}:`;
// Bump the release when the HTML, store data, or bundled assets change.
const cacheName = `${cachePrefix}v19`;
const imageCache = `korea-guide-media:${scope.href}:v1`;
const offlineFiles = ['index.html', 'guide.html', 'guide.css', 'site.js', 'style.css', 'stores.js', 'app.js', 'app.js?v=home-17', 'seoul.svg', 'guide-data.js', 'guide-ocr.js', 'guide.js', 'site.js?v=images-15', 'guide.js?v=images-15', 'guide.css?v=images-15'].map((file) => new URL(file, scope).href);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(offlineFiles.map((url) => new Request(url, { cache: 'reload' })));
    const media = await caches.open(imageCache);
    const coverNames = ['626.webp', '395.webp', '411.webp', '321.webp', '088.webp', '532.webp'];
    await Promise.all(coverNames.map(async (name) => {
      const url = new URL('guide-media/' + name, scope).href;
      if (!await media.match(url)) await media.add(url);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const obsolete = keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName);
    await Promise.all(obsolete.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(scope.href)) return;

  const { pathname } = new URL(request.url);
  if (pathname.startsWith(scope.pathname + 'guide-media/')) {
    event.respondWith((async () => {
      const cache = await caches.open(imageCache);
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) {
        try { await cache.put(request, response.clone()); }
        catch { /* The image still displays if browser storage is full. */ }
      }
      return response;
    })());
    return;
  }
  const documentUrl = pathname === scope.pathname ? entry.href : new URL(pathname, scope).href;
  if (request.mode === 'navigate' &&
      [entry.href, new URL('guide.html', scope).href].includes(documentUrl)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch {
        // The installed release remains available when the network fails.
      }
      return await caches.match(documentUrl, { cacheName }) || Response.error();
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { cacheName });
    return cached ?? fetch(request);
  })());
});
