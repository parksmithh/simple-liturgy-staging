const CACHE = "daily-office-reader-staging-da6bec082ba98852b73da7afb5a3a37052a32380";
const CACHE_PREFIX = "daily-office-reader-";
const RELEASE_MARKER = `?v=${CACHE.slice(CACHE_PREFIX.length)}`;
const CONTENT_ROOT = self.registration.scope.endsWith("/web/") ? "../" : "./";
const PACK_URL = `${CONTENT_ROOT}firmware/circuitpython/readings.active.jsonl?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380`;
const PACK_INDEX_URL = `${CONTENT_ROOT}firmware/circuitpython/readings.active.idx?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380`;
const COLLECTS_URL = `${CONTENT_ROOT}data/collects/collects.json?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380`;
const SCRIPTURE_WEB_URL = `${CONTENT_ROOT}data/scripture/engwebp.json?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380`;
const SCRIPTURE_KJV_URL = `${CONTENT_ROOT}data/scripture/eng-kjv.json?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380`;
const RITE_TWO_URL = `${CONTENT_ROOT}data/daily-office/rite-two.json?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380`;
const FULL_OFFICE_INDEX_URL = "./dor-engine/daily-office-content.index.json?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380";
const FULL_OFFICE_PACK_URL = "./dor-engine/daily-office-content.active.jsonl?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380";
const FULL_OFFICE_CONTENT = [
  RITE_TWO_URL,
  FULL_OFFICE_INDEX_URL,
  FULL_OFFICE_PACK_URL,
];
const FULL_OFFICE_PATHS = new Set(FULL_OFFICE_CONTENT.map(
  url => new URL(url, self.registration.scope).pathname,
));
const PACK_PATH = new URL(PACK_URL, self.registration.scope).pathname;
const FULL_OFFICE_PACK_PATH = new URL(FULL_OFFICE_PACK_URL, self.registration.scope).pathname;
const PACK_INDEX_PATH = new URL(PACK_INDEX_URL, self.registration.scope).pathname;
const COLLECTS_PATH = new URL(COLLECTS_URL, self.registration.scope).pathname;
const rangedPackBytes = new Map();
const SHELL = [
  "./",
  "./index.html",
  "./privacy.html",
  "./terms.html",
  "./LICENSE.md",
  "./NOTICE",
  "./CONTRIBUTING.md",
  "./design-tokens.css?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./app.css?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./app.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./analytics.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./bookmark-engine.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./boundary-timer.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./compline-preference.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./daily-office-content.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./daily-office.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./feast-link-preference.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./feast-wikipedia.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./full-office-lifecycle.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./noonday-preference.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./office-schedule.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./office-document.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./pixel-art.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./prayer-calendar.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./prayer-format-preference.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./psalm-preference.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./reading-pack-loader.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./scripture-pack-loader.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./scripture-preference.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./scripture-reading.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./scripture-resolve.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./theme.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./timed-office-onboarding.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./version.js?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./manifest.webmanifest?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./icon.svg?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./apple-touch-icon.png?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./icon-192.png?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./icon-512.png?v=staging-da6bec082ba98852b73da7afb5a3a37052a32380",
  "./assets/og-simple-liturgy.png?v=3",
  "./assets/liturgical-icons/liturgical-calendar/lit-01-solemnity.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-02-feast.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-03-christ-the-king.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-04-lamb-of-god.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-05-maundy-thursday.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-06-good-friday.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-07-holy-saturday.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-08-easter-sunday.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-09-easter-season.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-10-pentecost.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-11-trinity-sunday.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-12-ordinary-time.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-13-ordination.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-14-baptism.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-15-anointing-of-the-sick.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-16-st-peter-st-paul.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-17-martyrdom.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-18-bishop.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-19-dedication-of-a-church.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-20-all-angels.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-21-advent.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-22-christmas-eve.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-23-christmas-day.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-24-presentation-of-christ.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-25-epiphany.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-26-epiphany-season.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-27-transfiguration.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-28-palm-sunday.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-29-holy-communion.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-30-crown-of-thorns.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-31-nails.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-32-spear.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-33-empty-tomb.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-34-paschal-candle.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-35-peace.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-36-harvest.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-37-prayer.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-38-altar.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-39-praise.svg",
  "./assets/liturgical-icons/liturgical-calendar/lit-40-hope.svg",
  "./assets/liturgical-icons/saints/saint-01-st-peter.svg",
  "./assets/liturgical-icons/saints/saint-02-st-paul.svg",
  "./assets/liturgical-icons/saints/saint-03-st-mary.svg",
  "./assets/liturgical-icons/saints/saint-04-st-benedict.svg",
  "./assets/liturgical-icons/saints/saint-05-st-francis.svg",
  "./assets/liturgical-icons/saints/saint-06-st-teresa-of-avila.svg",
  "./assets/liturgical-icons/saints/saint-07-st-augustine.svg",
  "./assets/liturgical-icons/saints/saint-08-st-joseph.svg",
  "./assets/liturgical-icons/saints/saint-09-st-joan-of-arc.svg",
  "./assets/liturgical-icons/saints/saint-10-st-patrick.svg",
  "./assets/liturgical-icons/saints/saint-11-st-catherine-of-alexandria.svg",
  "./assets/liturgical-icons/saints/saint-12-st-john-chrysostom.svg",
  "./assets/liturgical-icons/saints/saint-13-st-thomas-aquinas.svg",
  "./assets/liturgical-icons/saints/saint-14-st-margaret.svg",
  "./assets/liturgical-icons/saints/saint-15-st-nicholas.svg",
  "./assets/liturgical-icons/saints/saint-16-st-lucy.svg",
  "./assets/liturgical-icons/saints/saint-17-st-john-the-baptist.svg",
  "./assets/liturgical-icons/saints/saint-18-st-stephen.svg",
  "./assets/liturgical-icons/saints/saint-19-st-philip.svg",
  "./assets/liturgical-icons/saints/saint-20-st-james-the-apostle.svg",
  "./assets/liturgical-icons/saints/saint-21-st-matthias.svg",
  "./assets/liturgical-icons/saints/saint-22-st-luke.svg",
  "./assets/liturgical-icons/saints/saint-23-st-mark.svg",
  "./assets/liturgical-icons/saints/saint-24-st-john-the-evangelist.svg",
  "./assets/liturgical-icons/saints/saint-25-st-martha.svg",
  "./assets/liturgical-icons/saints/saint-26-st-mary-magdalene.svg",
  "./assets/liturgical-icons/saints/saint-27-st-michael-the-archangel.svg",
  "./assets/liturgical-icons/saints/saint-28-st-gabriel-the-archangel.svg",
  "./assets/liturgical-icons/saints/saint-29-st-raphael-the-archangel.svg",
  "./assets/liturgical-icons/saints/saint-30-all-saints.svg",
  "./llms.txt",
  PACK_INDEX_URL,
  COLLECTS_URL,
  SCRIPTURE_WEB_URL,
  SCRIPTURE_KJV_URL,
];

self.addEventListener("install", event => {
  // Take control before any cache work. A failed precache used to reject this
  // install, so the already-running worker stayed in control forever.
  event.waitUntil(self.skipWaiting());
});

function previousCachesToKeep(keys) {
  return keys.filter(() => false);
}

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (typeof client.navigate !== "function") continue;
      const next = new URL(client.url);
      // A new URL cannot be satisfied by the iOS standalone page snapshot.
      // Do not await navigate(): waiting for that load inside activate deadlocks,
      // because the load cannot finish until this worker finishes activating.
      next.searchParams.set("staging-shell", String(Date.now()));
      client.navigate(next.href).catch(() => {});
    }
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "CACHE_COMPLETE_READING_PACK") {
    event.waitUntil(
      caches.match(PACK_URL).then(cached => cached || caches.open(CACHE).then(cache => cache.add(PACK_URL))),
    );
  } else if (event.data?.type === "CACHE_FULL_DAILY_OFFICE") {
    const caching = caches.open(CACHE)
      .then(async cache => {
        const cached = await Promise.all(FULL_OFFICE_CONTENT.map(url => cache.match(url)));
        if (cached.some(response => !response)) {
          await cache.addAll(FULL_OFFICE_CONTENT);
          for (const url of FULL_OFFICE_CONTENT) {
            rangedPackBytes.delete(new URL(url, self.registration.scope).href);
          }
        }
      })
      .then(
        () => event.ports[0]?.postMessage({ ok: true }),
        error => {
          event.ports[0]?.postMessage({ ok: false, message: String(error?.message || error) });
          throw error;
        },
      );
    event.waitUntil(caching);
  }
});

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (!response.ok && response.type !== "opaque") throw new Error(`Request failed with ${response.status}`);
  if (response.ok && new URL(request.url).origin === self.location.origin) {
    try {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
      rangedPackBytes.delete(request.url);
    } catch {
      // A healthy network response should still render if Cache Storage is unavailable.
    }
  }
  return response;
}

async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch {
    // Fall through to the network when Cache Storage is unavailable.
  }
  return fetchAndCache(request);
}

async function currentVersionCacheFirst(request, fallback = null) {
  try {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(request, { ignoreSearch: true }))
      || (fallback ? await cache.match(fallback) : null);
    if (cached) return cached;
  } catch {
    // Fall through to the network when Cache Storage is unavailable.
  }
  return fetchAndCache(request);
}

async function refreshCurrentVersionShell(request) {
  try {
    const cache = await caches.open(CACHE);
    const response = await fetch(request, { cache: "no-store" });
    if (!response.ok || !(await response.clone().text()).includes(RELEASE_MARKER)) return;
    const cacheKey = new URL(request.url);
    cacheKey.search = "";
    await cache.put(cacheKey.href, response);
  } catch {
    // The already-cached shell remains available when revalidation fails.
  }
}

async function networkFirst(request, fallback = null) {
  try {
    return await fetchAndCache(request);
  } catch {
    return (await caches.match(request)) || (fallback ? await caches.match(fallback) : null) || Response.error();
  }
}

async function rangedPackResponse(request) {
  const range = request.headers.get("range")?.match(/^bytes=(\d+)-(\d*)$/);
  if (!range) return fetch(request);
  if (request.cache === "reload") {
    rangedPackBytes.delete(request.url);
    return fetch(request);
  }
  if (!rangedPackBytes.has(request.url)) {
    const loading = caches.match(request.url).then(async cached => {
      if (!cached) return null;
      return {
        bytes: await cached.arrayBuffer(),
        headers: new Headers(cached.headers),
      };
    });
    rangedPackBytes.set(request.url, loading);
    loading.catch(() => {
      if (rangedPackBytes.get(request.url) === loading) rangedPackBytes.delete(request.url);
    });
  }
  const cached = await rangedPackBytes.get(request.url);
  if (!cached) {
    rangedPackBytes.delete(request.url);
    return fetch(request);
  }
  const { bytes } = cached;
  const start = Number(range[1]);
  const requestedEnd = range[2] ? Number(range[2]) : bytes.byteLength - 1;
  if (start >= bytes.byteLength || requestedEnd < start) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.byteLength}` } });
  }
  const end = Math.min(requestedEnd, bytes.byteLength - 1);
  const headers = new Headers(cached.headers);
  headers.delete("Content-Encoding");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${end}/${bytes.byteLength}`);
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

async function stagingNavigation(request) {
  // iOS can leave the newer worker waiting after install. This navigation
  // asks it to take control so the open app does not stay on the old shell.
  self.registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      try {
        const cache = await caches.open(CACHE);
        const cacheKey = new URL(request.url);
        cacheKey.search = "";
        await cache.put(cacheKey.href, response.clone());
      } catch {
        // A fresh response should still render if Cache Storage is unavailable.
      }
      return response;
    }
  } catch {
    // The cached shell is the offline copy.
  }
  return currentVersionCacheFirst(request, "./");
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if ((url.pathname === PACK_PATH || url.pathname === FULL_OFFICE_PACK_PATH)
    && event.request.headers.has("range")) {
    event.respondWith(rangedPackResponse(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(stagingNavigation(event.request));
    return;
  }

  if (url.origin === self.location.origin
    && FULL_OFFICE_PATHS.has(url.pathname)
    && event.request.cache === "reload") {
    event.respondWith(fetchAndCache(event.request));
    return;
  }

  if (url.origin === self.location.origin && (url.searchParams.has("v")
    || url.pathname === PACK_PATH || url.pathname === PACK_INDEX_PATH || url.pathname === COLLECTS_PATH)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
