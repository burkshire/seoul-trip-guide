const scope = new URL(self.registration.scope);
const entry = new URL('index.html', scope);
const cachePrefix = `korea-trip:${scope.href}:`;
// Bump the release when the HTML, store data, or bundled assets change.
const cacheName = `${cachePrefix}v23`;
const imageCache = `korea-guide-media:${scope.href}:v1`;
const offlineFiles = ['index.html', 'guide-mobile.html', 'style.css', 'stores.js', 'app.js?v=home-17', 'seoul.svg', 'site.js?v=images-15'].map((file) => new URL(file, scope).href);

// Static hosts can redirect .html URLs to clean paths. A fresh Response removes
// the redirected flag so Safari and Chromium can use it for offline navigation.
function navigationResponse(response) {
  const headers = new Headers(response.headers);
  // Fetch already decoded the body; these describe the wire representation.
  headers.delete('content-encoding');
  headers.delete('content-length');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await Promise.all(offlineFiles.map(async (url) => {
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok) throw new Error('Unable to cache ' + url);
      await cache.put(url, navigationResponse(response));
    }));
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
  const relativePath = pathname.slice(scope.pathname.length);
  const documentUrl = ['', 'index', 'index.html'].includes(relativePath) ? entry.href
    : ['guide', 'guide.html', 'guide-mobile', 'guide-mobile.html'].includes(relativePath) ? new URL('guide-mobile.html', scope).href
    : null;
  if (request.mode === 'navigate' &&
      documentUrl) {
    event.respondWith((async () => {
      // HTML and its search data are installed together. Use that complete
      // release immediately instead of waiting for another mobile connection.
      const cached = await caches.match(documentUrl, { cacheName });
      if (cached) return navigationResponse(cached);
      try {
        const response = await fetch(new Request(documentUrl, { redirect: 'follow' }));
        if (response.ok) return navigationResponse(response);
      } catch {
        // The installed release remains available when the network fails.
      }
      return Response.error();
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { cacheName });
    return cached ?? fetch(request);
  })());
});
