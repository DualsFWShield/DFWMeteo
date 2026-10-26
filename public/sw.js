const CACHE_NAME = "dfwmeteo-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./gemini-svg.svg",
  "./DFWMeteo-svg.svg",
  "./fonts/manrope-latin.woff2",
  "./fonts/manrope-latin-ext.woff2",
  "./fonts/instrument-serif-latin.woff2",
  "./fonts/instrument-serif-latin-ext.woff2",
  "./fonts/instrument-serif-latin-italic.woff2",
  "./js/app.js",
  "./js/api.js",
  "./js/charts.js",
  "./js/format.js",
  "./js/i18n.js",
  "./js/icons.js",
  "./js/dfwmeteo-api.js",
  "./data/irm.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Weather and geocoding APIs: Network-first, fallback to cache
  if (
    url.hostname.includes("open-meteo.com") ||
    url.hostname.includes("bigdatacloud.net") ||
    url.pathname.includes("/data/irm.json") ||
    url.pathname.startsWith("/api/")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // App shell & static assets: Cache-first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && (response.type === "basic" || response.type === "cors")) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    }),
  );
});
