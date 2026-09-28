#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { register } from "node:module";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareStagingTree, stagingBuildId } from "./prepare-staging-tree.mjs";
import { redactStagingAuth, stagingAuthorizationHeader, stagingGitEnv } from "./publish-staging-repo.mjs";
import { syncStagingTree } from "./sync-staging-tree.mjs";

register(new URL("./version-query-loader.mjs", import.meta.url));

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SEMVER_QUERY = /\?v=(\d+\.\d+\.\d+)/g;
const LOCAL_REF = /(?:href|src)="(\.\/[^"#?]+)/g;
const IMPORT_REF = /from\s+"(\.\/[^"]+)"/g;
const QUERY_SELECTOR_ID = /querySelector(?:All)?\(["'`]#([A-Za-z][\w-]*)/g;
const REQUIRED_HTML_IDS = [
  "screen",
  "install-button",
  "install-dialog",
  "settings-page",
  "device-screen",
  "full-daily-office-enabled",
  "preview-simple-morning",
  "preview-simple-evening",
  "preview-traditional-morning",
  "preview-traditional-evening",
  "retry-full-office",
  "create-prayer-reminders",
  "prayer-reminder-status",
  "prayer-import-help",
  "noonday-enabled",
  "preview-noonday",
  "compline-enabled",
  "preview-compline",
  "feast-links-enabled",
  "feast-browser",
  "feast-list",
  "browse-feast-days",
  "close-feast-browser",
  "reader-menu",
  "open-reader-button",
  "share-button",
  "install-tooltip",
  "app-version",
  "previous-control",
  "center-control",
  "next-control",
  "timed-office-onboarding",
  "scripture-settings",
  "scripture-settings-title",
];

const SMOKE_PATHS = [
  "/",
  "/index.html",
  "/privacy.html",
  "/terms.html",
  "/llms.txt",
  "/NOTICE",
  "/manifest.webmanifest",
  "/service-worker.js",
  "/version.js",
  "/app.js",
  "/app.css",
  "/design-tokens.css",
  "/icon.svg",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/assets/og-simple-liturgy.png",
  "/firmware/circuitpython/readings.active.jsonl",
  "/firmware/circuitpython/readings.active.idx",
  "/data/collects/collects.json",
  "/data/daily-office/rite-two.json",
  "/data/daily-office/psalter.json",
  "/data/scripture/engwebp.json",
  "/data/scripture/eng-kjv.json",
  "/scripture-pack-loader.js",
  "/scripture-preference.js",
  "/scripture-reading.js",
  "/scripture-resolve.js",
  "/dor-engine/daily-office-content.index.json",
  "/dor-engine/daily-office-content.active.jsonl",
  "/dor-engine/office-appointments.json",
];

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".idx": "application/octet-stream",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonl": "application/jsonl; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const failures = [];
let passed = 0;

function ok(name) {
  passed += 1;
  console.log(`ok  ${name}`);
}

function fail(name, error) {
  failures.push({ name, error });
  console.error(`not ok  ${name}`);
  console.error(`  ${error instanceof Error ? error.message : error}`);
}

function check(name, fn) {
  try {
    fn();
    ok(name);
  } catch (error) {
    fail(name, error);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (error) {
    fail(name, error);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function repoPath(...parts) {
  return join(ROOT, ...parts);
}

async function readText(...parts) {
  return readFile(repoPath(...parts), "utf8");
}

async function exists(...parts) {
  try {
    await stat(repoPath(...parts));
    return true;
  } catch {
    return false;
  }
}

function stripQuery(specifier) {
  return specifier.split("?")[0];
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate, offset) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return localIsoDate(date);
}

function recordAt(bytes, offset) {
  const start = offset;
  const newline = bytes.indexOf(10, start);
  const end = newline === -1 ? bytes.length : newline;
  return JSON.parse(Buffer.from(bytes.subarray(start, end)).toString("utf8"));
}

async function listAppJsFiles() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  return entries.filter(entry => entry.isFile() && entry.name.endsWith(".js")).map(entry => entry.name);
}

function extractIds(source) {
  return [...source.matchAll(QUERY_SELECTOR_ID)].map(match => match[1]);
}

function extractShellPaths(workerSource) {
  const paths = new Set();
  for (const match of workerSource.matchAll(/"(\.\/[^"]+)"/g)) {
    paths.add(stripQuery(match[1]));
  }
  for (const match of workerSource.matchAll(/CONTENT_ROOT\}(firmware\/[^"?]+|data\/[^"?]+)/g)) {
    paths.add(`./${match[1]}`);
  }
  paths.add("./firmware/circuitpython/readings.active.jsonl");
  paths.add("./firmware/circuitpython/readings.active.idx");
  paths.add("./data/collects/collects.json");
  paths.add("./data/scripture/engwebp.json");
  paths.add("./data/scripture/eng-kjv.json");
  paths.add("./dor-engine/daily-office-content.index.json");
  paths.add("./dor-engine/daily-office-content.active.jsonl");
  return [...paths];
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url, "http://127.0.0.1");
        let relative = decodeURIComponent(url.pathname);
        if (relative === "/") relative = "/index.html";
        const file = repoPath(relative.replace(/^\/+/, ""));
        if (!file.startsWith(ROOT)) {
          response.writeHead(403).end();
          return;
        }
        await stat(file);
        response.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
        createReadStream(file).pipe(response);
      } catch {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

async function fetchStatus(origin, path) {
  const response = await fetch(new URL(path, origin));
  return { path, status: response.status, ok: response.ok, bytes: Number(response.headers.get("content-length") || 0) };
}

const {
  APP_CHANNEL,
  APP_VERSION,
  appVersionLabel,
} = await import("../version.js");
const {
  DAILY_FOCUS_ORDER,
  dateWithOffset,
  handle,
  keyboardEvent,
  LORDS_PRAYER_HEADING,
  LORDS_PRAYER_TEXT,
  model,
  numberedLiturgicalTextHtml,
  parseBundle,
  parseCollects,
  prayerLineationHtml,
  resolvePrayer,
  screenHtml,
  stateForDate,
  swipeEvent,
  upcomingFeastDays,
} = await import("../bookmark-engine.js");
const { composeDailyOffice } = await import("../daily-office.js");
const { parseReadingIndex } = await import("../reading-pack-loader.js");
const { ALL_ICON_ASSET_PATHS } = await import("../pixel-art.js");
const { scheduledServiceAt, officePeriodAt } = await import("../office-schedule.js");
const { buildPrayerCalendar } = await import("../prayer-calendar.js");
const { resolveCitation, unavailableNote } = await import("../scripture-resolve.js");
const {
  applyScriptureToSimpleView,
  applyScriptureToTimedOffice,
  formatVerseMarker,
  paginateScriptureVersesByFit,
  psalmTokensToCitation,
  scriptureLessonPages,
  VERSE_ELLIPSIS,
  versesToPageText,
  withChapterHeadings,
  withPsalmChapterHeadings,
} = await import("../scripture-reading.js");
const { initializeScripturePreference, setScriptureMode } = await import("../scripture-preference.js");

const indexHtml = await readText("index.html");
const privacyHtml = await readText("privacy.html");
const termsHtml = await readText("terms.html");
const manifestText = await readText("manifest.webmanifest");
const workerSource = await readText("service-worker.js");
const appJs = await readText("app.js");
const jsFiles = await listAppJsFiles();
const versionedTextFiles = [
  "index.html",
  "privacy.html",
  "terms.html",
  "manifest.webmanifest",
  ...jsFiles,
];

check("production channel is locked", () => {
  assert(APP_CHANNEL === "production", `APP_CHANNEL must be production, got ${APP_CHANNEL}`);
  assert(/^\d+\.\d+\.\d+$/.test(APP_VERSION), `APP_VERSION must be semver, got ${APP_VERSION}`);
  assert(appVersionLabel().includes(APP_VERSION), "version label must include APP_VERSION");
  assert(!appVersionLabel().toLowerCase().includes("staging"), "production label must not mention staging");
});

check("promote tag matches APP_VERSION", () => {
  if (process.env.GITHUB_REF_TYPE !== "tag") return;
  const tag = process.env.GITHUB_REF_NAME || "";
  assert(tag === `v${APP_VERSION}`, `tag ${tag || "(empty)"} must be v${APP_VERSION}`);
});

await checkAsync("Pages publish stays off ordinary main merges", async () => {
  const verifyWorkflow = await readText(".github/workflows/pages.yml");
  const publishWorkflow = await readText(".github/workflows/publish-pages.yml");
  const workflowNames = (await readdir(repoPath(".github/workflows"))).filter(name => name.endsWith(".yml") || name.endsWith(".yaml"));
  assert(workflowNames.includes("publish-pages.yml"), "publish-pages.yml must exist");
  assert(workflowNames.includes("staging.yml"), "staging publish workflow must exist");
  for (const name of workflowNames) {
    if (name === "publish-pages.yml") continue;
    const text = await readText(".github/workflows", name);
    assert(!text.includes("actions/deploy-pages"), `${name} must not reference actions/deploy-pages`);
    assert(!text.includes("actions/upload-pages-artifact"), `${name} must not upload a Pages artifact`);
  }
  assert(!verifyWorkflow.includes("deploy-pages"), "tag verify workflow must not deploy Pages");
  assert(!verifyWorkflow.includes("environment:"), "tag verify workflow must not enter github-pages");
  assert(verifyWorkflow.includes("v*.*.*"), "tag verify workflow must still run on version tags");
  assert(publishWorkflow.includes("workflow_run"), "Pages publish must follow the tagged verify workflow");
  assert(publishWorkflow.includes("Deploy Simple Liturgy"), "Pages publish must wait on Deploy Simple Liturgy");
  assert(publishWorkflow.includes("actions/deploy-pages"), "Pages publish must deploy the tagged commit");
  assert(
    publishWorkflow.includes("startsWith(github.event.workflow_run.head_branch, 'v')"),
    "Pages publish must check out the tagged commit only after a v* verify"
  );
  assert(
    publishWorkflow.includes("github.event.workflow_run.head_sha"),
    "Pages publish must check out the tagged commit, not the latest main tip"
  );
  const stagingWorkflow = await readText(".github/workflows/staging.yml");
  assert(stagingWorkflow.includes("branches:\n      - main"), "staging publish runs on main");
  assert(stagingWorkflow.includes("group: staging"), "staging publish uses its own concurrency group");
  assert(stagingWorkflow.includes("cancel-in-progress: true"), "staging publish may cancel an older staging run");
  assert(!stagingWorkflow.includes("group: pages"), "staging publish must not take the production deploy lock");
  assert(publishWorkflow.includes("group: pages"), "production publish keeps the pages concurrency group");
  assert(!stagingWorkflow.includes("environment:"), "staging publish must not enter github-pages");
  assert(stagingWorkflow.includes("secrets.STAGING_REPO_TOKEN"), "staging publish uses the staging repository token");
  assert(!(await exists("CNAME")), "a CNAME file would retarget the production Pages domain");
  assert(!(await exists("robots.txt")), "robots.txt must stay off the production tree");
  assert(!indexHtml.includes("noindex"), "noindex must stay off the committed site");
});

await checkAsync("staging copy is rewritten only at deploy time", async () => {
  const temp = await mkdtemp(join(tmpdir(), "staging-rewrite-"));
  try {
    const sha = "a".repeat(40);
    const id = stagingBuildId(sha);
    assert(id === `staging-${sha}`, "staging id includes the commit");
    assert(!/^v\d+\.\d+\.\d+/.test(id), "staging id must not look like a production tag");
    for (const name of ["version.js", "service-worker.js", "analytics.js", "index.html", "privacy.html", "terms.html", "manifest.webmanifest"]) {
      await cp(repoPath(name), join(temp, name));
    }
    await prepareStagingTree(temp, { commit: sha });
    const version = await readFile(join(temp, "version.js"), "utf8");
    assert(version.includes('export const APP_CHANNEL = "staging"'), "rewritten channel");
    assert(version.includes(`Version ${id} · Staging`), "footer shows the staging id");
    assert(!version.includes('APP_CHANNEL = "production"'), "rewritten copy drops the production channel");
    const worker = await readFile(join(temp, "service-worker.js"), "utf8");
    assert(worker.includes(`const CACHE = "daily-office-reader-${id}";`), "cache uses the staging id");
    assert(!worker.includes("daily-office-reader-v0.3.148"), "production cache name is not reused");
    assert(worker.includes(`?v=${id}`), "versioned worker urls use the staging id");
    const analytics = await readFile(join(temp, "analytics.js"), "utf8");
    assert(!analytics.includes("cloud.umami.is"), "staging omits the Umami script");
    assert(!analytics.includes("dab0bd9b-34dc-4e61-8292-fdecfe97b3cc"), "staging omits the Umami website id");
    const robots = await readFile(join(temp, "robots.txt"), "utf8");
    assert(robots.includes("Disallow: /"), "staging robots.txt");
    for (const name of ["index.html", "privacy.html", "terms.html"]) {
      const html = await readFile(join(temp, name), "utf8");
      assert(html.includes('name="robots" content="noindex, nofollow"'), `${name} noindex`);
      assert(html.includes(`?v=${id}`), `${name} cache-busts with the staging id`);
    }
    const manifest = await readFile(join(temp, "manifest.webmanifest"), "utf8");
    assert(manifest.includes('"name": "Simple Liturgy Staging"'), "manifest name marks staging");
    const committed = await readText("version.js");
    assert(committed.includes('export const APP_CHANNEL = "production"'), "committed channel stays production");
    assert(!committed.includes("staging-"), "committed version.js has no staging id");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

await checkAsync("staging sync preserves workflows and drops CNAME", async () => {
  const root = await mkdtemp(join(tmpdir(), "staging-sync-"));
  const source = join(root, "source");
  const dest = join(root, "dest");
  try {
    await mkdir(join(source, ".github/workflows"), { recursive: true });
    await mkdir(join(dest, ".github/workflows"), { recursive: true });
    await writeFile(join(source, ".github/workflows/staging.yml"), "source-workflow\n");
    await writeFile(join(dest, ".github/workflows/pages.yml"), "dest-workflow\n");
    await writeFile(join(source, "index.html"), "fresh\n");
    await writeFile(join(source, "CNAME"), "simpleliturgy.com\n");
    await writeFile(join(dest, "CNAME"), "staging.simpleliturgy.com\n");
    await writeFile(join(dest, "old.txt"), "gone\n");
    const gitInDest = (args) => spawnSync("git", args, { cwd: dest, encoding: "utf8" });
    const init = gitInDest(["init", "-b", "main"]);
    assert(init.status === 0, init.stderr || "git init failed");
    gitInDest(["config", "user.email", "staging-sync@example.com"]);
    gitInDest(["config", "user.name", "staging sync"]);
    const firstAdd = gitInDest(["add", "CNAME", "old.txt", ".github/workflows/pages.yml"]);
    assert(firstAdd.status === 0, firstAdd.stderr || "git add failed");
    const firstCommit = gitInDest(["commit", "-m", "seed staging workflow"]);
    assert(firstCommit.status === 0, firstCommit.stderr || "git commit failed");
    await syncStagingTree(source, dest);
    assert(await readFile(join(dest, ".github/workflows/pages.yml"), "utf8") === "dest-workflow\n", "dest workflow preserved");
    assert(!(await stat(join(dest, ".github/workflows/staging.yml")).then(() => true).catch(() => false)), "source workflow was not copied");
    assert(!(await stat(join(dest, "CNAME")).then(() => true).catch(() => false)), "CNAME was removed");
    assert(!(await stat(join(dest, "old.txt")).then(() => true).catch(() => false)), "stale file was removed");
    assert(await readFile(join(dest, "index.html"), "utf8") === "fresh\n", "site file was copied");
    const stage = spawnSync("git", ["add", "-A", "--", ".", ":!.github/workflows"], { cwd: dest, encoding: "utf8" });
    assert(stage.status === 0, stage.stderr || "git add of the staging tree failed");
    const stagedWorkflows = spawnSync("git", ["diff", "--cached", "--name-only", "--", ".github/workflows"], { cwd: dest, encoding: "utf8" });
    assert(stagedWorkflows.status === 0 && !stagedWorkflows.stdout.trim(), stagedWorkflows.stdout || "workflow path was staged");
    const porcelain = spawnSync("git", ["status", "--porcelain", "--", ".github/workflows"], { cwd: dest, encoding: "utf8" });
    assert(porcelain.status === 0 && !porcelain.stdout.trim(), porcelain.stdout || "workflow worktree changed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await checkAsync("staging publish sends basic auth without putting the token in the url", async () => {
  const token = "test-token-not-real";
  const encoded = Buffer.from(`x-access-token:${token}`, "utf8").toString("base64");
  const header = stagingAuthorizationHeader(token);
  assert(header === `AUTHORIZATION: basic ${encoded}`, "basic x-access-token header");
  assert(!/bearer/i.test(header), "git smart http auth is not bearer");
  const env = stagingGitEnv(token, {});
  assert(env.GIT_CONFIG_COUNT === "1", "git config count");
  assert(env.GIT_CONFIG_KEY_0 === "http.https://github.com/.extraheader", "host-scoped extraheader");
  assert(env.GIT_CONFIG_VALUE_0 === header, "header is the config value");
  assert(env.GIT_TERMINAL_PROMPT === "0", "prompts stay disabled");
  assert(redactStagingAuth(`url ${token} header ${encoded}`, token) === "url *** header ***", "token and base64 are redacted");
  const carried = stagingGitEnv(token, { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" });
  assert(carried.GIT_CONFIG_COUNT === "2", "existing git config entries stay");
  assert(carried.GIT_CONFIG_KEY_0 === "safe.directory", "existing key is kept");
  assert(carried.GIT_CONFIG_KEY_1 === "http.https://github.com/.extraheader", "auth header is appended");
  const source = await readText("scripts/publish-staging-repo.mjs");
  assert(source.includes("https://github.com/${repository}.git"), "remote stays a token-free https url");
  assert(!source.includes("@github.com"), "token is not embedded in the remote url");
  assert(!source.includes("http.extraheader="), "header is not passed with git -c");
  assert(source.includes(":!.github/workflows"), "workflow paths stay unstaged");
  assert(source.includes("Refusing to push workflow changes"), "staged workflows are still refused");

  const seen = [];
  const server = createServer((request, response) => {
    seen.push(request.headers.authorization || "");
    response.writeHead(401, { "Content-Type": "text/plain" });
    response.end("nope");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const local = stagingGitEnv(token, process.env);
    const index = Number(local.GIT_CONFIG_COUNT) - 1;
    local[`GIT_CONFIG_KEY_${index}`] = `http.http://127.0.0.1:${port}/.extraheader`;
    const url = `http://127.0.0.1:${port}/repo.git`;
    const result = await new Promise((resolve, reject) => {
      const child = spawn("git", ["ls-remote", url], { env: local, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => child.kill("SIGTERM"), 15000);
      child.stdout.on("data", (buf) => { stdout += buf; });
      child.stderr.on("data", (buf) => { stderr += buf; });
      child.on("error", reject);
      child.on("close", (status) => {
        clearTimeout(timer);
        resolve({ status, stdout, stderr });
      });
    });
    assert(result.status !== 0, "unauthorized probe should fail");
    const output = `${result.stdout}${result.stderr}`;
    assert(!output.includes(token), "git output must not include the token");
    assert(!output.includes(encoded), "git output must not include the encoded token");
    assert(seen.some((value) => value === `basic ${encoded}`), `wire header ${seen.join("|") || "(none)"}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

await checkAsync("promote ritual requires a live simpleliturgy.com check", async () => {
  const contributing = await readText("CONTRIBUTING.md");
  assert(contributing.includes("simpleliturgy.com"), "CONTRIBUTING must name the public hostname");
  assert(
    contributing.includes("Do not say the promote is live until the public hostname passes"),
    "push to prod must require a live-site check of simpleliturgy.com, not only Actions or localhost"
  );
});

await checkAsync("versioned assets use APP_VERSION", async () => {
  const unexpected = [];
  for (const file of versionedTextFiles) {
    const text = await readText(file);
    for (const match of text.matchAll(SEMVER_QUERY)) {
      if (match[1] !== APP_VERSION) unexpected.push(`${file} has ?v=${match[1]}`);
    }
  }
  assert(unexpected.length === 0, unexpected.join("; ") || "mixed versions");
  assert(workerSource.includes(`daily-office-reader-v${APP_VERSION}`), "service worker cache name must include APP_VERSION");
  assert(workerSource.includes(`?v=${APP_VERSION}`), "service worker must version the current release");
  assert(workerSource.includes("skipWaiting"), "a newly installed worker must activate without waiting for every client to close");
  assert(appJs.includes("controllerchange"), "the reader must reload when a new service worker takes control");
});

await checkAsync("iOS PWA avoids black-translucent status bar blur", async () => {
  const indexHtml = await readText("index.html");
  const appCss = await readText("app.css");
  const appJs = await readText("app.js");
  assert(
    !indexHtml.includes("black-translucent"),
    "black-translucent locks iOS 27 scroll-edge blur on"
  );
  assert(
    !indexHtml.includes("apple-mobile-web-app-status-bar-style"),
    "omit Apple status-bar-style so the platform keeps obscuredInsets and can hide the scroll-edge blur"
  );
  assert(indexHtml.includes("ios-pwa-status-strip"), "index must include the iOS PWA status strip");
  assert(indexHtml.includes("dataset.standalone"), "index must mark standalone before first paint");
  assert(appCss.includes("ios-pwa-status-strip"), "app.css must style the iOS PWA status strip");
  assert(appCss.includes("background-clip: text"), "status strip must use background-clip:text so it samples without painting");
  assert(appCss.includes("ios-pwa-blur-panel"), "app.css must style the iOS PWA blur kick panel");
  assert(appCss.includes("--reader-top"), "reader must share a --reader-top inset for header and menu");
  assert(
    /--reader-top:\s*max\(12px,\s*calc\(env\(safe-area-inset-top\) \+ 6px\)\)/.test(appCss),
    "portrait reader header must sit on the same high top inset as the menu"
  );
  assert(appJs.includes("kickIosPwaTopBlur"), "app.js must kick iOS PWA top blur on install");
});

check("JavaScript modules parse", () => {
  const errors = [];
  for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ["--check", repoPath(file)], { encoding: "utf8" });
    if (result.status !== 0) errors.push(`${file}: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  assert(errors.length === 0, errors.join("\n") || "syntax errors");
});

await checkAsync("module imports resolve to files", async () => {
  const missing = [];
  for (const file of jsFiles) {
    const text = await readText(file);
    for (const match of text.matchAll(IMPORT_REF)) {
      const target = stripQuery(match[1]);
      if (!await exists(target.slice(2))) missing.push(`${file} -> ${target}`);
    }
  }
  assert(missing.length === 0, `missing imports: ${missing.join(", ")}`);
});

await checkAsync("HTML, manifest, and worker assets exist", async () => {
  const missing = [];
  const manifest = JSON.parse(manifestText);
  assert(manifest.name === "Simple Liturgy", "manifest name");
  assert(manifest.start_url === "./", "manifest start_url");
  assert(manifest.display === "standalone", "manifest display");
  for (const icon of manifest.icons || []) {
    const path = stripQuery(icon.src);
    if (!await exists(path.slice(2))) missing.push(path);
  }
  for (const html of [indexHtml, privacyHtml, termsHtml]) {
    for (const match of html.matchAll(LOCAL_REF)) {
      const path = match[1];
      if (!await exists(path.slice(2))) missing.push(path);
    }
  }
  for (const path of extractShellPaths(workerSource)) {
    if (!await exists(path.slice(2))) missing.push(path);
  }
  assert(await exists(".nojekyll"), "GitHub Pages needs .nojekyll");
  assert(missing.length === 0, `missing assets: ${[...new Set(missing)].join(", ")}`);
});

check("index.html has the reader shell and settings controls", () => {
  for (const id of REQUIRED_HTML_IDS) {
    assert(indexHtml.includes(`id="${id}"`), `missing #${id}`);
  }
  assert(indexHtml.includes('class="reader"'), "missing reader root");
  assert(indexHtml.includes('src="./app.js'), "missing app module");
  const referenced = new Set(extractIds(appJs));
  const absent = [...referenced].filter(id => !indexHtml.includes(`id="${id}"`));
  assert(absent.length === 0, `app.js selectors missing from index.html: ${absent.join(", ")}`);
});

await checkAsync("icon catalog files exist", async () => {
  const absent = [];
  for (const path of ALL_ICON_ASSET_PATHS) {
    if (!await exists(path.slice(2))) absent.push(path);
  }
  const manifestCsv = await readText("assets/liturgical-icons/manifest.csv");
  for (const line of manifestCsv.trim().split("\n").slice(1)) {
    const [collection, , , filename] = line.split(",");
    if (!filename) continue;
    const path = `assets/liturgical-icons/${collection}/${filename}`;
    if (!await exists(path)) absent.push(`./${path}`);
  }
  assert(absent.length === 0, `missing icons: ${absent.join(", ")}`);
});

await checkAsync("reading pack, index, and collects can load today", async () => {
  const packText = await readText("firmware/circuitpython/readings.active.jsonl");
  const bundle = parseBundle(packText);
  const collects = parseCollects(await readText("data/collects/collects.json"));
  const indexBytes = await readFile(repoPath("firmware/circuitpython/readings.active.idx"));
  const entries = parseReadingIndex(indexBytes);
  const today = localIsoDate();
  const dates = [addDays(today, -1), today, addDays(today, 1), "2026-12-25", "2026-04-05"];

  assert(bundle.header.schema_version === 1, "reading pack schema");
  assert(bundle.dates.size > 0 && bundle.readings.size > 0, "reading pack is empty");
  assert(entries.length === bundle.dates.size, `index has ${entries.length} dates, pack has ${bundle.dates.size}`);

  const packBytes = new Uint8Array(await readFile(repoPath("firmware/circuitpython/readings.active.jsonl")));
  for (const iso of dates) {
    const day = bundle.dates.get(iso);
    assert(day, `pack is missing ${iso}`);
    const prayer = resolvePrayer(collects, day);
    assert(prayer?.text, `collect missing for ${iso} (${day.label})`);
    const view = model(bundle, stateForDate(today, iso), today, collects);
    assert(!view.error, `${iso}: ${view.error}`);
    assert(view.values?.OT && view.values?.NT && view.values?.GS, `${iso} is missing lesson citations`);
    const html = screenHtml(view);
    assert(typeof html === "string" && html.length > 40, `${iso} rendered an empty reader`);
    const entry = entries.find(item => item.date === iso);
    assert(entry, `reading index is missing ${iso}`);
    const indexedDay = recordAt(packBytes, entry.dateOffset);
    const indexedReading = recordAt(packBytes, entry.readingOffset);
    assert(indexedDay.date === iso, `index date mismatch for ${iso}`);
    assert(indexedReading.key === day.key, `index reading key mismatch for ${iso}`);
  }

  const feasts = upcomingFeastDays(bundle, today);
  assert(Array.isArray(feasts) && feasts.length > 0, "upcoming feast list is empty");
});

await checkAsync("traditional Daily Office composes for today", async () => {
  const today = localIsoDate();
  const bundle = parseBundle(await readText("firmware/circuitpython/readings.active.jsonl"));
  const collects = parseCollects(await readText("data/collects/collects.json"));
  const riteTwo = JSON.parse(await readText("data/daily-office/rite-two.json"));
  const psalter = JSON.parse(await readText("data/daily-office/psalter.json"));
  const appointments = JSON.parse(await readText("dor-engine/office-appointments.json"));
  const index = JSON.parse(await readText("dor-engine/daily-office-content.index.json"));

  assert(riteTwo.schema_version === "bcp1979-rite-two-daily-office-v1", "rite-two schema");
  assert(psalter.schema_version === "bcp1979-psalter-v1" && psalter.psalms.length === 150, "psalter schema");
  assert(appointments.schema_version === "office-appointments-v1", "appointments schema");
  assert(index.schema_version === "daily-office-content-index-v1", "full-office index schema");
  assert(appointments.contexts[today], `appointments missing ${today}`);
  assert(index.contexts[today], `full-office index missing ${today}`);

  for (const service of ["morning", "evening"]) {
    const document = composeDailyOffice({
      service,
      date: today,
      day: bundle.dates.get(today),
      collect: resolvePrayer(collects, bundle.dates.get(today)),
      riteTwo,
      psalter,
      appointments,
    });
    assert(document.schemaVersion === "office-document-v1", `${service} document schema`);
    assert(document.sections.length >= 8, `${service} office is missing sections`);
    const view = model(bundle, { offset: 0, focus: document.sections[0].key, focusPage: 0 }, today, collects, {
      service,
      officeDocument: document,
    });
    assert(!view.error, `${service}: ${view.error}`);
    assert(screenHtml(view).length > 40, `${service} rendered empty`);
  }
});

check("timed-office schedule helpers stay coherent", () => {
  const morning = new Date("2026-09-08T07:00:00");
  const noon = new Date("2026-09-08T12:00:00");
  const evening = new Date("2026-09-08T19:00:00");
  const night = new Date("2026-09-08T22:00:00");
  assert(officePeriodAt(morning) === "morning", "07:00 is morning");
  assert(officePeriodAt(noon) === "midday", "12:00 is midday");
  assert(officePeriodAt(evening) === "evening", "19:00 is evening");
  assert(officePeriodAt(night) === "night", "22:00 is night");
  assert(scheduledServiceAt(morning, { format: "simple", noondayEnabled: false, complineEnabled: false }) === "daily");
  assert(scheduledServiceAt(noon, { format: "simple", noondayEnabled: true, complineEnabled: false }) === "noonday");
  assert(scheduledServiceAt(night, { format: "simple", noondayEnabled: false, complineEnabled: true }) === "compline");
  assert(scheduledServiceAt(morning, { format: "full", noondayEnabled: false, complineEnabled: false }) === "morning");
  assert(scheduledServiceAt(evening, { format: "full", noondayEnabled: false, complineEnabled: false }) === "evening");
});

check("reader navigation helpers still map gestures", () => {
  assert(swipeEvent(200, 80) === "NEXT_DAY", "swipe left should advance");
  assert(swipeEvent(80, 200) === "PREV_DAY", "swipe right should go back");
  assert(keyboardEvent(null, "ArrowRight") === "NEXT_DAY", "right arrow");
  const next = handle({ offset: 0, focus: null, focusPage: 0 }, "NEXT_DAY");
  assert(next.offset === 1, "NEXT_DAY should increment the date offset");
  assert(dateWithOffset("2026-09-08", 1) === "2026-09-09", "date offset");
});

check("Simple Liturgy focus order includes The Lord's Prayer", () => {
  assert(
    DAILY_FOCUS_ORDER.join(",") === "PRAYER,PS,OT,NT,GS,LORDS_PRAYER,GLORIA",
    `focus order is ${DAILY_FOCUS_ORDER.join(",")}`,
  );
  const afterGospel = handle({ offset: 0, focus: "GS", focusPage: 0 }, "NEXT_READING");
  assert(afterGospel.focus === "LORDS_PRAYER", "next after Gospel must open The Lord's Prayer");
  const afterPrayer = handle({ offset: 0, focus: "LORDS_PRAYER", focusPage: 0 }, "NEXT_READING");
  assert(afterPrayer.focus === "GLORIA", "next after The Lord's Prayer must open Gloria");
  const previousFromGloria = handle({ offset: 0, focus: "GLORIA", focusPage: 0 }, "PREV_READING");
  assert(previousFromGloria.focus === "LORDS_PRAYER", "previous from Gloria must open The Lord's Prayer");
  const opened = handle({ offset: 0, focus: null, focusPage: 0 }, "LORDS_PRAYER");
  assert(opened.focus === "LORDS_PRAYER", "overview must focus The Lord's Prayer, not a reading");
  const afterOverview = handle({ offset: 0, focus: "LORDS_PRAYER", focusPage: 0 }, "OVERVIEW");
  assert(afterOverview.focus === null, "overview must clear Lord's Prayer focus");
  const afterDate = handle({ offset: 0, focus: "LORDS_PRAYER", focusPage: 0 }, "NEXT_DAY");
  assert(afterDate.focus === null, "date change must clear Lord's Prayer focus");
});

check("The Lord's Prayer heading uses a curly apostrophe", () => {
  assert(LORDS_PRAYER_HEADING === "The Lord\u2019s Prayer", "heading must be The Lord’s Prayer");
  assert(LORDS_PRAYER_HEADING.includes("\u2019"), "heading must use U+2019");
  assert(!LORDS_PRAYER_HEADING.includes("'"), "heading must not use a straight apostrophe");
});

await checkAsync("Simple Liturgy Lord's Prayer text, lineation, and Amen", async () => {
  const contemporary = "Our Father in heaven, hallowed be your Name, your kingdom come, your will be done, on earth as in heaven. Give us today our daily bread. Forgive us our sins as we forgive those who sin against us. Save us from the time of trial, and deliver us from evil. For the kingdom, the power, and the glory are yours, now and for ever. Amen.";
  const riteTwo = await readText("data/daily-office/rite-two.json");
  assert(riteTwo.includes(contemporary), "Rite II contemporary Lord's Prayer must still be present for comparison");
  assert(LORDS_PRAYER_TEXT.replaceAll("\n", " ") === contemporary, "Simple Liturgy wording must match Rite II contemporary once newlines are ignored");
  assert(!/who art|trespasses|temptation|this day/.test(LORDS_PRAYER_TEXT), "must not use traditional substitutions");
  const html = prayerLineationHtml(LORDS_PRAYER_TEXT);
  assert(html.includes("Our Father in heaven,<br> hallowed be your Name,"), "phrase breaks must be <br> after escaping");
  assert(html.includes("now and for ever.<span class=\"prayer-amen\">Amen.</span>"), "final Amen must be a block span");
  assert(!html.includes("now and for ever. Amen."), "Amen must be peeled off the last doxology line");
});

await checkAsync("Simple Liturgy Lord's Prayer renders in focus and overview", async () => {
  const bundle = parseBundle(await readText("firmware/circuitpython/readings.active.jsonl"));
  const collects = parseCollects(await readText("data/collects/collects.json"));
  const today = localIsoDate();
  const overview = screenHtml(model(bundle, { offset: 0, focus: null, focusPage: 0 }, today, collects));
  assert(overview.includes(`data-event="LORDS_PRAYER"`), "overview marker must open LORDS_PRAYER");
  assert(overview.includes(LORDS_PRAYER_HEADING), "overview must use the shared heading");
  assert(!overview.includes("Our Father in heaven"), "overview must be label-only");
  const focus = screenHtml(model(bundle, { offset: 0, focus: "LORDS_PRAYER", focusPage: 0 }, today, collects));
  assert(focus.includes(`data-reading="LORDS_PRAYER"`), "focus must target LORDS_PRAYER");
  assert(focus.includes(LORDS_PRAYER_HEADING), "focus label must use the shared heading");
  assert(focus.includes("prayer-text lords-prayer-text"), "focus body must use prayer-text plus lords-prayer-text");
  assert(focus.includes('<span class="prayer-amen">Amen.</span>'), "focus must include the block Amen");
  const noonday = screenHtml(model(bundle, { offset: 0, focus: "NOONDAY_LORDS_PRAYER", focusPage: 0 }, today, collects, { service: "noonday" }));
  assert(noonday.includes(LORDS_PRAYER_HEADING), "Noonday must keep The Lord’s Prayer heading");
  assert(!noonday.includes("For the kingdom, the power, and the glory are yours"), "Noonday must keep the doxology-free wording");
});

await checkAsync("Lord's Prayer typography inherits the shared prayer token", async () => {
  const css = await readText("app.css");
  assert(
    /\.grid \{\s*grid-template-columns: 1fr;\s*grid-template-rows: repeat\(7, auto\);/.test(css),
    "portrait Simple Liturgy overview must use repeat(7, auto)",
  );
  assert(css.includes(".prayer-amen { display: block; }"), "Amen must use the shared block treatment");
  assert(
    css.includes(".lords-prayer-text br { display: none; }"),
    "mobile must drop Lord's Prayer phrase breaks",
  );
  const modifierRules = [...css.matchAll(/\.lords-prayer-text\s*\{([^}]*)\}/g)].map(match => match[1]);
  assert(modifierRules.length > 0, "lords-prayer-text modifier must exist");
  assert(
    modifierRules.every(body => !/font-size|line-height|--type-reader-lords-prayer/.test(body)),
    "lords-prayer-text may not set font-size, line-height, or a private type token",
  );
  assert(!css.includes("--type-reader-lords-prayer"), "must not invent --type-reader-lords-prayer");
  assert(
    /function matchingPrayerLayout\(view\) \{\s*if \(view\.focus === "LORDS_PRAYER"\) return null;/.test(appJs),
    "collect cache must exclude LORDS_PRAYER",
  );
  assert(appJs.includes('screen.querySelector(".lords-prayer-text")'), "fitted size must apply only to .lords-prayer-text");
  assert(appJs.includes("matchingLordsPrayerLayout"), "Lord's Prayer must use a dedicated fitter");
  assert(appJs.includes("measuredLordsPrayerLayout"), "Lord's Prayer must measure its own HTML");
});

check("prayer reminder calendar can be generated", () => {
  const calendar = buildPrayerCalendar({
    selections: { morning: "07:00", evening: "18:00", noonday: "off", compline: "off" },
    appUrl: "https://simpleliturgy.com/",
  });
  assert(calendar.includes("BEGIN:VCALENDAR"), "ICS calendar header");
  assert(calendar.includes("Morning Prayer"), "morning event");
  assert(calendar.includes("Evening Prayer"), "evening event");
  assert(!calendar.includes("Noonday Prayer"), "disabled noonday should stay out");
  assert(!calendar.includes("Compline"), "disabled Compline should stay out");
});

check("scripture settings default Off and auto-fit", () => {
  assert(indexHtml.includes('name="scripture-mode" value="off" checked'), "Off must be the default scripture mode");
  assert(indexHtml.includes('name="scripture-mode" value="web"'), "WEB option must be present");
  assert(indexHtml.includes('name="scripture-mode" value="kjv"'), "KJV option must be present");
  assert(!indexHtml.includes('name="scripture-pagination"'), "fixed verse-count spike removed");
  assert(indexHtml.includes("auto-fit"), "settings note mentions auto-fit");
  const memory = new Map();
  const storage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
  };
  const controls = [
    { value: "off", checked: false },
    { value: "web", checked: false },
    { value: "kjv", checked: false },
  ];
  assert(initializeScripturePreference({ controls, storage }) === "off", "preference defaults to Off");
  assert(setScriptureMode({ controls, storage }, "web") === "web", "WEB persists");
  assert(initializeScripturePreference({ controls, storage }) === "web", "WEB restores");
});

check("product copy no longer claims Scripture is absent", () => {
  assert(!indexHtml.includes("meant to be paired with a physical Bible"), "FAQ must not claim Bible-only pairing");
  assert(indexHtml.includes("World English Bible (WEB)") || indexHtml.includes("WEB"), "FAQ mentions WEB");
  assert(indexHtml.includes("King James Version (KJV)") || indexHtml.includes("KJV"), "FAQ mentions KJV");
});

check("scripture verse markers encode split pages", () => {
  assert(formatVerseMarker(7) === "7", "complete verse");
  assert(formatVerseMarker(7, { starts: true, ends: false }) === `7${VERSE_ELLIPSIS}`, "starts only");
  assert(formatVerseMarker(7, { starts: false, ends: true }) === `${VERSE_ELLIPSIS}7`, "ends only");
  assert(formatVerseMarker(7, { starts: false, ends: false }) === `${VERSE_ELLIPSIS}7${VERSE_ELLIPSIS}`, "middle");
  const html = numberedLiturgicalTextHtml(`${VERSE_ELLIPSIS}7${VERSE_ELLIPSIS} middle fragment`);
  assert(html.includes(`${VERSE_ELLIPSIS}7${VERSE_ELLIPSIS}`), "HTML keeps middle marker");
});

await checkAsync("scripture packs resolve appointed lesson samples", async () => {
  const web = JSON.parse(await readText("data/scripture/engwebp.json"));
  const kjv = JSON.parse(await readText("data/scripture/eng-kjv.json"));
  assert(web.schema === "scripture-pack-v1" && kjv.schema === "scripture-pack-v1", "pack schema");
  assert(Object.keys(web.books).length === 66, `WEB protestant books: ${Object.keys(web.books).length}`);
  assert(Object.keys(kjv.books).length >= 66, "KJV includes Protestant canon");
  assert(kjv.books.WIS, "KJV includes Wisdom");
  assert(!web.books.WIS, "WEB omits Wisdom");

  const isaiah = "Isaiah 1:1-9";
  const webIsaiah = resolveCitation(isaiah, web);
  const kjvIsaiah = resolveCitation(isaiah, kjv);
  assert(webIsaiah.ok && webIsaiah.verses.length === 9, "WEB Isaiah 1:1-9");
  assert(kjvIsaiah.ok && kjvIsaiah.verses.length === 9, "KJV Isaiah 1:1-9");

  // Tiny height forces mid-verse splits so markers appear.
  let call = 0;
  const pages = paginateScriptureVersesByFit(webIsaiah.verses, candidate => {
    call += 1;
    const words = candidate.split(/\s+/).length;
    return words <= 12;
  });
  assert(pages.length > 1, "auto-fit yields multiple pages");
  assert(pages.some(page => page.includes(VERSE_ELLIPSIS)), "split pages keep ellipsis markers");
  assert(call > 0, "fit callback used");
  assert(versesToPageText(webIsaiah.verses).includes("1 "), "full page text includes verse 1");

  const wisdom = resolveCitation("Wisdom 1:1-5", web);
  assert(!wisdom.ok, "WEB misses Wisdom");
  const kjvWisdom = resolveCitation("Wisdom 1:1-5", kjv);
  assert(kjvWisdom.ok && kjvWisdom.verses.length === 5, "KJV Wisdom resolves");

  const hebrews = resolveCitation("Hebrews 11:32--12:2", web);
  assert(hebrews.ok && hebrews.verses.length > 10, "cross-chapter Hebrews");

  const ecclus = resolveCitation("Ecclus. 2:1-11", kjv);
  assert(ecclus.ok, `Ecclus. alias: ${ecclus.reason || "ok"}`);

  const llmsText = await readText("llms.txt");
  assert(!llmsText.includes("does not reproduce Scripture"), "llms.txt must not deny Scripture text");
  assert(llmsText.includes("WEB") && llmsText.includes("KJV"), "llms.txt mentions translations");
  const notice = await readText("NOTICE");
  assert(notice.includes("eBible") && notice.includes("engwebp"), "NOTICE attributes eBible packs");
  assert(workerSource.includes("data/scripture/engwebp.json"), "SW installs WEB pack");
  assert(workerSource.includes("data/scripture/eng-kjv.json"), "SW installs KJV pack");
  assert(workerSource.includes("scripture-resolve.js"), "SW shells scripture modules");
});

await checkAsync("scripture preference remaps Simple and Traditional lesson focus", async () => {
  const web = JSON.parse(await readText("data/scripture/engwebp.json"));
  const kjv = JSON.parse(await readText("data/scripture/eng-kjv.json"));
  const bundle = parseBundle(await readText("firmware/circuitpython/readings.active.jsonl"));
  const collects = parseCollects(await readText("data/collects/collects.json"));
  const today = localIsoDate();
  const offView = model(bundle, { offset: 0, focus: "OT", focusPage: 0 }, today, collects);
  const offHtml = screenHtml(offView);
  assert(offHtml.includes("Old Testament"), "Off focus shows OT label");
  assert(!offHtml.includes("scripture-lesson-text"), "Off has no scripture body");
  assert(!offHtml.includes("scripture-unavailable-note"), "Off has no unavailable note");

  const webView = applyScriptureToSimpleView(offView, {
    scriptureMode: "web",
    pack: web,
  });
  assert(webView.scripturePages?.OT?.verses?.length > 0, "WEB attaches OT verses");
  assert(webView.scripturePages?.OT?.pages?.length === 1, "initial paint is one unfitted page");
  const webHtml = screenHtml(webView);
  assert(webHtml.includes("scripture-lesson-text") || webHtml.includes("scripture-unavailable-note"), "WEB focus shows body or note");

  const psalmFocus = model(bundle, { offset: 0, focus: "PS", focusPage: 0 }, today, collects);
  assert(psalmTokensToCitation("66, 67") === "Psalm 66; Psalm 67", "plain psalm tokens become citations");
  assert(psalmTokensToCitation("119:1-24") === "Psalm 119:1-24", "ranged psalm tokens keep verses");
  assert(psalmTokensToCitation("21:1-7(8-14)").includes("(8-14)"), "optional psalm verses preserved for resolver");
  assert(psalmTokensToCitation("[59, 60] or 33") === "Psalm 59; Psalm 60", "bracketed or-alternatives take first choice");
  const webPsalms = applyScriptureToSimpleView(psalmFocus, {
    scriptureMode: "web",
    pack: web,
    psalmDisplayMode: "by-time-of-day",
    psalmOffice: "morning",
  });
  assert(webPsalms.scripturePages?.PS?.verses?.length > 0, "WEB attaches Psalm verses");
  assert(webPsalms.scripturePages?.PS?.chapterHeadings, "WEB Psalms insert per-chapter headings");
  assert(
    webPsalms.scripturePages.PS.verses[0]?.kind === "heading"
    && /^Psalm\s+\d+/.test(webPsalms.scripturePages.PS.verses[0].text || ""),
    "WEB Psalm body starts with a Psalm chapter heading",
  );
  const psalmHtml = screenHtml(webPsalms, { psalmDisplayMode: "by-time-of-day", psalmOffice: "morning" });
  assert(psalmHtml.includes("scripture-lesson-text"), "WEB Psalm focus shows body text");
  assert(psalmHtml.includes("Morning Psalms"), "WEB Psalm focus uses Morning/Evening label");
  assert(psalmHtml.includes("timed-office-psalm-heading"), "WEB Psalm focus renders chapter headings in body");
  assert(!psalmHtml.includes("focus-cite"), "WEB Psalm focus omits combined citation focus-cite");
  const morningOnly = applyScriptureToSimpleView(psalmFocus, {
    scriptureMode: "web",
    pack: web,
    psalmDisplayMode: "by-time-of-day",
    psalmOffice: "morning",
  });
  const eveningOnly = applyScriptureToSimpleView(psalmFocus, {
    scriptureMode: "web",
    pack: web,
    psalmDisplayMode: "by-time-of-day",
    psalmOffice: "evening",
  });
  assert(
    morningOnly.scripturePages?.PS?.verses?.length > 0
    && eveningOnly.scripturePages?.PS?.verses?.length > 0
    && morningOnly.scripturePages.PS.citation !== eveningOnly.scripturePages.PS.citation,
    "by-time Psalm scripture uses office-specific citations",
  );
  const morningHtml = screenHtml(morningOnly, { psalmDisplayMode: "by-time-of-day", psalmOffice: "morning" });
  assert(morningHtml.includes("Morning Psalms"), "by-time WEB Psalm focus uses Morning Psalms label");
  assert(morningHtml.includes("scripture-lesson-text"), "by-time WEB Psalm focus shows body");
  const multiPsalmDay = "2026-03-15";
  const multiPsalmFocus = model(bundle, { offset: 0, focus: "PS", focusPage: 0 }, multiPsalmDay, collects);
  const multiEvening = applyScriptureToSimpleView(multiPsalmFocus, {
    scriptureMode: "web",
    pack: web,
    psalmDisplayMode: "by-time-of-day",
    psalmOffice: "evening",
  });
  const eveningHtml = screenHtml(multiEvening, { psalmDisplayMode: "by-time-of-day", psalmOffice: "evening" });
  assert(eveningHtml.includes("Evening Psalms"), "evening WEB Psalm focus uses Evening Psalms label");
  assert(!eveningHtml.includes("Psalm 19; Psalm 46"), "evening WEB Psalm focus does not combine chapter titles");
  const eveningPage = multiEvening.scripturePages.PS.pages[0] || "";
  assert(
    eveningPage.includes("Psalm 19") && eveningPage.includes("Psalm 46")
    && eveningPage.indexOf("Psalm 19") < eveningPage.indexOf("Psalm 46"),
    "evening WEB Psalms sequence chapter headings in body",
  );
  const headed = withChapterHeadings([
    { bookId: "PSA", chapter: 19, verse: 1, text: "a" },
    { bookId: "PSA", chapter: 19, verse: 2, text: "b" },
    { bookId: "PSA", chapter: 46, verse: 1, text: "c" },
  ]);
  assert(headed[0]?.kind === "heading" && headed[0].text === "Psalm 19", "heading before first chapter");
  assert(headed[3]?.kind === "heading" && headed[3].text === "Psalm 46", "heading before next chapter");
  const multiLesson = scriptureLessonPages({
    citation: "Hebrews 11:32--12:2",
    scriptureMode: "web",
    pack: web,
  });
  assert(multiLesson.chapterHeadings, "multi-chapter lessons get chapter headings");
  assert(
    multiLesson.verses.some(verse => verse.kind === "heading" && verse.text === "Hebrews 11")
    && multiLesson.verses.some(verse => verse.kind === "heading" && verse.text === "Hebrews 12"),
    "multi-chapter lesson sequences Hebrews 11 then Hebrews 12",
  );
  const multiLessonHtml = numberedLiturgicalTextHtml(multiLesson.pages[0]);
  assert(multiLessonHtml.includes("Hebrews 11") && multiLessonHtml.includes("Hebrews 12"), "lesson chapter headings render");
  const singleLesson = scriptureLessonPages({
    citation: "Hosea 1:1-9",
    scriptureMode: "web",
    pack: web,
  });
  assert(!singleLesson.chapterHeadings, "single-chapter lessons keep citation chrome");
  assert(singleLesson.verses[0]?.kind !== "heading", "single-chapter lessons do not insert body headings");
  const offPsalmHtml = screenHtml(psalmFocus);
  assert(!offPsalmHtml.includes("scripture-lesson-text"), "Off Psalm focus stays citation-only");
  assert(
    appJs.includes("effectivePsalmDisplayMode")
    && appJs.includes('scriptureMode !== "off"')
    && appJs.includes("by-time-of-day"),
    "Scripture on forces morning/evening Psalms instead of combined",
  );

  const riteTwo = JSON.parse(await readText("data/daily-office/rite-two.json"));
  const psalter = JSON.parse(await readText("data/daily-office/psalter.json"));
  const appointments = JSON.parse(await readText("dor-engine/office-appointments.json"));
  const document = composeDailyOffice({
    service: "morning",
    date: today,
    day: bundle.dates.get(today),
    collect: resolvePrayer(collects, bundle.dates.get(today)),
    riteTwo,
    psalter,
    appointments,
  });
  const morning = model(bundle, { offset: 0, focus: document.sections.find(s => /_LESSON_1$/.test(s.key))?.key, focusPage: 0 }, today, collects, {
    service: "morning",
    officeDocument: document,
  });
  const withKjv = applyScriptureToTimedOffice(morning.office, {
    scriptureMode: "kjv",
    pack: kjv,
  });
  const lessonKey = Object.keys(withKjv.sections).find(key => /_LESSON_1$/.test(key));
  assert(lessonKey, "morning has lesson 1");
  assert(withKjv.sections[lessonKey].scriptureVerses?.length >= 1, "KJV lesson has verses for fit");
  assert(withKjv.sections[lessonKey].preservePages !== true, "available lessons are auto-fit, not preservePages");
  const kjvFocus = screenHtml({
    ...morning,
    office: withKjv,
    morning: withKjv,
    focus: lessonKey,
  });
  assert(
    kjvFocus.includes("scripture-lesson-text") || kjvFocus.includes("scripture-unavailable-note"),
    "Traditional KJV lesson shows body",
  );

  const wisdomOffice = {
    sections: {
      MORNING_LESSON_1: { citation: "Wisdom 1:1-5", pages: ["Wisdom 1:1-5"], label: "First Lesson" },
    },
  };
  const webMiss = applyScriptureToTimedOffice(wisdomOffice, {
    scriptureMode: "web",
    pack: web,
  });
  assert(webMiss.sections.MORNING_LESSON_1.scriptureUnavailable, "WEB Wisdom is unavailable");
  assert(webMiss.sections.MORNING_LESSON_1.pages[0] === unavailableNote(), "R8 note text");
  assert(webMiss.sections.MORNING_LESSON_1.preservePages === true, "unavailable note preserves pages");
});

await checkAsync("scripture lesson focus stays non-scrolling", async () => {
  const css = await readText("app.css");
  const engine = await readText("bookmark-engine.js");
  assert(css.includes(".focus {") && /overflow:\s*hidden/.test(css), "focus overflow hidden");
  assert(css.includes(".scripture-lesson-text") && css.includes("overflow: hidden"), "scripture body overflow hidden");
  assert(css.includes(".scripture-unavailable-note"), "unavailable note styled");
  assert(appJs.includes("paginateScriptureVersesByFit"), "app measures scripture with auto-fit");
  assert(appJs.includes("measuredScriptureSimpleLayout"), "Simple lessons measure fit");
  assert(
    engine.includes("page > 0") && engine.includes("escapeHtml(citationText)}") && engine.includes("READING_LABELS[key]"),
    "continuation pages use citation as the focus title",
  );
});

await checkAsync("critical URLs return HTTP 200 from a Pages-like server", async () => {
  const server = await startStaticServer();
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  try {
    const results = [];
    for (const path of SMOKE_PATHS) results.push(await fetchStatus(origin, path));
    const failed = results.filter(result => !result.ok);
    assert(failed.length === 0, failed.map(result => `${result.path} -> ${result.status}`).join(", "));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} failed, ${passed} passed`);
  process.exitCode = 1;
} else {
  console.log(`${passed} passed`);
}
