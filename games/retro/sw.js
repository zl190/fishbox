// 复古机 service worker — self-hosted EmulatorJS, fully offline.
// Precaches the shell + the self-hosted engine and all shipped cores on install,
// so every console plays offline from first launch (no CDN, no prior online play).
//
// It ALSO injects COOP/COEP into the navigation document (the "coi-serviceworker"
// technique) so the page becomes crossOriginIsolated → SharedArrayBuffer → EmulatorJS'
// threaded cores work even on GitHub Pages, which can't send real HTTP headers. Threads
// give a big speed-up on the heavy cores (N64) and unlock PSP (ppsspp is thread-only).
// Only the top-level document needs the headers: every subresource here is same-origin,
// which COEP: require-corp permits without a CORP header — so the big core files are left
// untouched (no re-stream cost). The page reloads itself once on first load to come up
// isolated (see index.html). iOS keeps threads OFF at runtime, so it's unaffected.
const CACHE = "retro-v7";

// Wrap the navigation response with cross-origin isolation headers.
function withCOI(res) {
  if (!res) return res;
  const h = new Headers(res.headers);
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Embedder-Policy", "require-corp");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

const SHELL = ["./", "./index.html", "./manifest.json",
  "./roms/tobutobugirl.gb", "./roms/libbet.gb", "./roms/ucity.gbc", "./roms/nova.nes"];

const EJS = "./emulatorjs/data/";
const ENGINE = [
  "loader.js", "emulator.min.js", "emulator.min.css", "version.json",
  "localization/en-US.json",
  "compression/extract7z.js", "compression/extractzip.js",
  "compression/libunrar.js", "compression/libunrar.wasm",
].map((f) => EJS + f);
// Precache only the cores the demos use (gambatte=GB/GBC, fceumm=NES) — NOT all 6 (14MB),
// which spiked memory on mobile. Other cores cache on demand (SWR below) on first play.
const CORES = ["gambatte", "fceumm"].flatMap((c) => [
  `${EJS}cores/${c}-wasm.data`,
  `${EJS}cores/${c}-legacy-wasm.data`,
  `${EJS}cores/reports/${c}.json`,
]);

const PRECACHE = [...SHELL, ...ENGINE, ...CORES];

self.addEventListener("install", (e) => {
  // allSettled so one missing asset never aborts the whole install.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("retro-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // skip ROM blob: URLs and anything off-origin
  const save = (res) => { if (res && res.status === 200) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; };
  // Code (HTML/manifest) = NETWORK-FIRST so updates apply immediately online (fall back to cache
  // offline) — no more "clear site data" to escape a stale version. Big immutable engine/cores/ROM
  // = CACHE-FIRST (fast, offline), refreshed in the background.
  const isCode = req.mode === "navigate" || url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html") || url.pathname.endsWith(".json");
  if (isCode) {
    // Network-first; inject COOP/COEP only into the top-level document (req.mode navigate)
    // — that's all that's needed for crossOriginIsolated; subresources are same-origin.
    const r = fetch(req).then(save).catch(() => caches.match(req));
    e.respondWith(req.mode === "navigate" ? r.then(withCOI) : r);
  } else {
    e.respondWith(caches.match(req).then((cached) => {
      const networked = fetch(req).then(save).catch(() => cached);
      return cached || networked;
    }));
  }
});
