// 消消乐 service worker — stale-while-revalidate, scoped to this game's folder.
// Bump CACHE when the shell list changes. Caches the shared engine too so the
// game is fully offline after first open.
const CACHE = "match3-v8";
const SHELL = ["./", "./index.html", "./manifest.json", "../../shared/grid-core.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  // CacheStorage is per-origin, shared with the other games — only evict our own.
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("match3-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const networked = fetch(req)
          .then((res) => { if (res && res.status === 200) cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || networked;
      })
    )
  );
});
