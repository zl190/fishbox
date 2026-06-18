// 复古机 service worker — self-hosted EmulatorJS, fully offline.
// Precaches the shell + the self-hosted engine and all shipped cores on install,
// so every console plays offline from first launch (no CDN, no prior online play).
const CACHE = "retro-v2";

const SHELL = ["./", "./index.html", "./manifest.json"];

const EJS = "./emulatorjs/data/";
const ENGINE = [
  "loader.js", "emulator.min.js", "emulator.min.css", "version.json",
  "localization/en-US.json",
  "compression/extract7z.js", "compression/extractzip.js",
  "compression/libunrar.js", "compression/libunrar.wasm",
].map((f) => EJS + f);
// Both variants per core: "-wasm" (webgl2) and "-legacy-wasm" (fallback). The device
// fetches whichever matches its capabilities; precaching both keeps every console offline.
const CORES = ["fceumm", "snes9x", "gambatte", "mgba", "genesis_plus_gx", "mupen64plus_next"]
  .flatMap((c) => [
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
