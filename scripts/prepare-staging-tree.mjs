#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".txt",
  ".webmanifest",
]);

export function stagingBuildId(commit) {
  const sha = String(commit || "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error("staging build needs the full 40-character commit sha");
  }
  const id = `staging-${sha}`;
  if (id.startsWith("v") || /^v\d+\.\d+\.\d+/.test(id)) {
    throw new Error("staging build id must not look like a production tag");
  }
  return id;
}

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`${label} is missing the expected production text`);
  const next = text.replace(from, to);
  if (next === text) throw new Error(`${label} was not rewritten`);
  return next;
}

async function walkFiles(root, visitor) {
  async function visit(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      const path = join(dir, entry.name);
      const rel = relative(root, path).split(sep).join("/");
      if (rel === ".github/workflows" || rel.startsWith(".github/workflows/")) continue;
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        await visitor(path, rel);
      }
    }
  }
  await visit(root);
}

const PRODUCTION_INSTALL = `self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});`;

const STAGING_INSTALL = `self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const critical = SHELL.filter(url => !/(?:engwebp|eng-kjv)\\.json/.test(url));
    await Promise.all(critical.map(async url => {
      const response = await fetch(new Request(url, { cache: "reload" }));
      if (!response.ok) throw new Error(\`staging shell \${response.status} for \${url}\`);
      await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});`;

const PRODUCTION_PREVIOUS_CACHES = `function previousCachesToKeep(keys) {
  return keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .slice(0, 1);
}`;

const STAGING_PREVIOUS_CACHES = `function previousCachesToKeep(keys) {
  return keys.filter(() => false);
}`;

const PRODUCTION_CACHE_FIRST = `async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetchAndCache(request);
}`;

const STAGING_CACHE_FIRST = `async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch {
    // Fall through to the network when Cache Storage is unavailable.
  }
  return fetchAndCache(request);
}`;

const PRODUCTION_NAVIGATION = `  if (event.request.mode === "navigate") {
    event.waitUntil(refreshCurrentVersionShell(event.request));
    event.respondWith(currentVersionCacheFirst(event.request, "./"));
    return;
  }`;

const STAGING_NAVIGATION = `  if (event.request.mode === "navigate") {
    event.respondWith(stagingNavigation(event.request));
    return;
  }`;

const STAGING_NAVIGATION_HELPER = `async function stagingNavigation(request) {
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

`;

const PRODUCTION_REGISTRATION = `if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker
    .register("./service-worker.js", { updateViaCache: "none" })
    .then(registration => {
      const checkForUpdate = () => {
        registration.update().catch(() => {});
      };
      checkForUpdate();
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkForUpdate();
      });
    })
    .catch(() => {});
}`;

function stagingRegistration(id) {
  return `if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    const next = new URL(window.location.href);
    next.searchParams.set("staging-shell", String(Date.now()));
    window.location.replace(next.href);
  });
  navigator.serviceWorker
    .register("./service-worker.js?v=${id}", { updateViaCache: "none" })
    .then(registration => {
      const checkForUpdate = () => {
        registration.update().catch(() => {});
      };
      checkForUpdate();
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkForUpdate();
      });
      window.addEventListener("pageshow", checkForUpdate);
      window.addEventListener("focus", checkForUpdate);
    })
    .catch(() => {});
}`;
}

export async function prepareStagingTree(root, { commit }) {
  const id = stagingBuildId(commit);
  const versionPath = join(root, "version.js");
  const versionBefore = await readFile(versionPath, "utf8");
  const versionMatch = versionBefore.match(/export const APP_VERSION = "(\d+\.\d+\.\d+)";/);
  if (!versionMatch) throw new Error("version.js is missing APP_VERSION");
  const appVersion = versionMatch[1];
  if (id === `v${appVersion}`) throw new Error("staging build id must not reuse the production tag");

  let version = replaceOnce(
    versionBefore,
    'export const APP_CHANNEL = "production";',
    'export const APP_CHANNEL = "staging";',
    "version.js channel",
  );
  version = replaceOnce(
    version,
    "export function appVersionLabel() {\n  return `Version ${APP_VERSION}${APP_CHANNEL === \"staging\" ? \" · Staging\" : \"\"}`;\n}",
    `export function appVersionLabel() {\n  return \`Version ${id} · Staging\`;\n}`,
    "version.js footer",
  );
  await writeFile(versionPath, version);

  const workerPath = join(root, "service-worker.js");
  let worker = await readFile(workerPath, "utf8");
  worker = replaceOnce(
    worker,
    `const CACHE = "daily-office-reader-v${appVersion}";`,
    `const CACHE = "daily-office-reader-${id}";`,
    "service worker cache",
  );
  worker = replaceOnce(
    worker,
    'const CACHE_PREFIX = "daily-office-reader-v";',
    'const CACHE_PREFIX = "daily-office-reader-";',
    "service worker cache prefix",
  );
  await writeFile(workerPath, worker);

  const analyticsPath = join(root, "analytics.js");
  let analytics = await readFile(analyticsPath, "utf8");
  analytics = replaceOnce(
    analytics,
    'const TRACKER_URL = "https://cloud.umami.is/script.js";',
    'const TRACKER_URL = "";',
    "analytics tracker",
  );
  analytics = replaceOnce(
    analytics,
    'const WEBSITE_ID = "dab0bd9b-34dc-4e61-8292-fdecfe97b3cc";',
    'const WEBSITE_ID = "";',
    "analytics website id",
  );
  analytics = replaceOnce(
    analytics,
    "export function initializeAnalytics({ document, storage, trackerWindow }) {\n  const controls = Array.from(document.querySelectorAll(\"[data-analytics-toggle]\"));",
    "export function initializeAnalytics({ document, storage, trackerWindow }) {\n  if (!TRACKER_URL || !WEBSITE_ID) {\n    const controls = Array.from(document.querySelectorAll(\"[data-analytics-toggle]\"));\n    const statuses = Array.from(document.querySelectorAll(\"[data-analytics-status]\"));\n    controls.forEach(control => { control.checked = false; control.disabled = true; });\n    statuses.forEach(status => { status.textContent = \"Analytics are off on staging.\"; });\n    return false;\n  }\n  const controls = Array.from(document.querySelectorAll(\"[data-analytics-toggle]\"));",
    "analytics init",
  );
  analytics = replaceOnce(
    analytics,
    "function loadTracker(document, trackerWindow, isEnabled) {\n  if (!isEnabled() || TRACKED_DOCUMENTS.has(document)) return null;",
    "function loadTracker(document, trackerWindow, isEnabled) {\n  if (!TRACKER_URL || !WEBSITE_ID) return null;\n  if (!isEnabled() || TRACKED_DOCUMENTS.has(document)) return null;",
    "analytics loader",
  );
  if (analytics.includes("cloud.umami.is") || analytics.includes("dab0bd9b-34dc-4e61-8292-fdecfe97b3cc")) {
    throw new Error("staging copy still references Umami");
  }
  await writeFile(analyticsPath, analytics);

  const queryFrom = `?v=${appVersion}`;
  const queryTo = `?v=${id}`;
  await walkFiles(root, async (path, rel) => {
    if (rel === "CNAME") throw new Error("CNAME must not be published");
    const extension = path.includes(".") ? path.slice(path.lastIndexOf(".")) : "";
    if (!TEXT_EXTENSIONS.has(extension)) return;
    let text = await readFile(path, "utf8");
    const original = text;
    if (text.includes(queryFrom)) text = text.replaceAll(queryFrom, queryTo);
    if (extension === ".html" && !text.includes('name="robots" content="noindex, nofollow"')) {
      const charset = '<meta charset="utf-8">';
      if (!text.includes(charset)) throw new Error(`${rel} has no charset meta for noindex`);
      text = text.replace(charset, `${charset}\n  <meta name="robots" content="noindex, nofollow">`);
    }
    if (rel === "index.html") {
      text = replaceOnce(
        text,
        'name="apple-mobile-web-app-title" content="Simple Liturgy"',
        'name="apple-mobile-web-app-title" content="Staging"',
        rel,
      );
    }
    if (rel === "manifest.webmanifest") {
      text = replaceOnce(text, '"short_name": "Simple Liturgy"', '"short_name": "Staging"', rel);
      text = replaceOnce(text, '"name": "Simple Liturgy"', '"name": "Simple Liturgy Staging"', rel);
    }
    if (text !== original) await writeFile(path, text);
  });

  await writeFile(join(root, "robots.txt"), "User-agent: *\nDisallow: /\n");

  const appPath = join(root, "app.js");
  const appBefore = await readFile(appPath, "utf8");
  await writeFile(appPath, replaceOnce(appBefore, PRODUCTION_REGISTRATION, stagingRegistration(id), "app.js service worker registration"));

  let stagedWorker = await readFile(workerPath, "utf8");
  stagedWorker = replaceOnce(stagedWorker, PRODUCTION_INSTALL, STAGING_INSTALL, "service worker install");
  stagedWorker = replaceOnce(stagedWorker, PRODUCTION_PREVIOUS_CACHES, STAGING_PREVIOUS_CACHES, "service worker previous caches");
  stagedWorker = replaceOnce(stagedWorker, PRODUCTION_CACHE_FIRST, STAGING_CACHE_FIRST, "service worker cache first");
  stagedWorker = replaceOnce(
    stagedWorker,
    'self.addEventListener("fetch", event => {',
    `${STAGING_NAVIGATION_HELPER}self.addEventListener("fetch", event => {`,
    "service worker navigation helper",
  );
  stagedWorker = replaceOnce(stagedWorker, PRODUCTION_NAVIGATION, STAGING_NAVIGATION, "service worker navigation");
  await writeFile(workerPath, stagedWorker);

  const finalVersion = await readFile(versionPath, "utf8");
  if (!finalVersion.includes('export const APP_CHANNEL = "staging"')) {
    throw new Error("staging channel was not written");
  }
  if (!finalVersion.includes(`Version ${id} · Staging`)) {
    throw new Error("staging footer was not written");
  }
  if (finalVersion.includes('APP_CHANNEL = "production"')) {
    throw new Error("production channel remained on the staging copy");
  }
  const finalWorker = await readFile(workerPath, "utf8");
  if (!finalWorker.includes(`const CACHE = "daily-office-reader-${id}";`)) {
    throw new Error("staging cache name was not written");
  }
  if (finalWorker.includes(`daily-office-reader-v${appVersion}`)) {
    throw new Error("production cache name remained on the staging copy");
  }
  if (!finalWorker.includes('cache: "reload"') || !finalWorker.includes("async function stagingNavigation")) {
    throw new Error("staging worker does not refresh the installed shell");
  }
  if (finalWorker.includes("cache.addAll(SHELL)")) {
    throw new Error("staging install still waits on the whole shell");
  }
  const finalApp = await readFile(appPath, "utf8");
  if (!finalApp.includes(`register("./service-worker.js?v=${id}"`)) {
    throw new Error("staging app does not register the commit-specific worker");
  }
  if (!finalApp.includes('window.addEventListener("pageshow", checkForUpdate)')) {
    throw new Error("staging app does not check for an update when the installed app is shown");
  }
  try {
    await stat(join(root, "CNAME"));
    throw new Error("CNAME must not be published");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const commit = process.env.GITHUB_SHA || process.env.STAGING_COMMIT;
  prepareStagingTree(process.cwd(), { commit })
    .then(() => {
      console.log(`prepared ${stagingBuildId(commit)}`);
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
