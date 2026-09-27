#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SEMVER = /^\d+\.\d+\.\d+$/;

const nextVersion = process.argv[2];
if (!nextVersion || !SEMVER.test(nextVersion)) {
  console.error("Usage: node scripts/bump-version.mjs <x.y.z>");
  process.exit(1);
}

const versionSource = await readFile(join(ROOT, "version.js"), "utf8");
const currentMatch = versionSource.match(/export const APP_VERSION = "(\d+\.\d+\.\d+)"/);
if (!currentMatch) {
  console.error("Could not read APP_VERSION from version.js");
  process.exit(1);
}

const currentVersion = currentMatch[1];
if (currentVersion === nextVersion) {
  console.error(`APP_VERSION is already ${nextVersion}`);
  process.exit(1);
}

const entries = await readdir(ROOT, { withFileTypes: true });
const jsFiles = entries.filter(entry => entry.isFile() && entry.name.endsWith(".js")).map(entry => entry.name);
const targets = [
  "version.js",
  "index.html",
  "privacy.html",
  "terms.html",
  "manifest.webmanifest",
  "service-worker.js",
  ...jsFiles.filter(name => name !== "version.js" && name !== "service-worker.js"),
];

const versionQuery = new RegExp(`\\?v=${currentVersion.replaceAll(".", "\\.")}`, "g");
const cacheName = new RegExp(`daily-office-reader-v${currentVersion.replaceAll(".", "\\.")}`, "g");
const appVersionAssign = new RegExp(`export const APP_VERSION = "${currentVersion}"`);

let changed = 0;
for (const file of targets) {
  const path = join(ROOT, file);
  const before = await readFile(path, "utf8");
  let next = before.replace(versionQuery, `?v=${nextVersion}`);
  next = next.replace(cacheName, `daily-office-reader-v${nextVersion}`);
  if (file === "version.js") {
    next = next.replace(appVersionAssign, `export const APP_VERSION = "${nextVersion}"`);
  }
  if (next !== before) {
    await writeFile(path, next);
    changed += 1;
  }
}

if (changed === 0) {
  console.error(`No files still used ${currentVersion}`);
  process.exit(1);
}

console.log(`Bumped ${currentVersion} -> ${nextVersion} in ${changed} files`);
