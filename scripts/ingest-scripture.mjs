#!/usr/bin/env node
/**
 * Build compact verse packs from eBible USFX ZIPs.
 *
 * Usage:
 *   node scripts/ingest-scripture.mjs
 *   node scripts/ingest-scripture.mjs --cache-dir /tmp/ebible
 *
 * Downloads engwebp + eng-kjv USFX from eBible when missing from --cache-dir,
 * parses verses, writes data/scripture/{engwebp,eng-kjv}.json.
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "scripture");
const EBIBLE = "https://ebible.org/Scriptures";

const EDITIONS = [
  {
    id: "engwebp",
    label: "WEB",
    zip: "engwebp_usfx.zip",
    xml: "engwebp_usfx.xml",
    expectMinBooks: 66,
  },
  {
    id: "eng-kjv",
    label: "KJV",
    zip: "eng-kjv_usfx.zip",
    xml: "eng-kjv_usfx.xml",
    expectMinBooks: 66,
  },
];

/** OSIS / USFX ids that are Scripture books (skip FRT, GLO, etc.). */
const FRONT_MATTER = new Set([
  "FRT", "INT", "BAK", "CNC", "GLO", "TDX", "NDX", "OTH", "XXA", "XXB", "XXC", "XXD", "XXE", "XXF", "XXG",
]);

/** Protestant 66-book OSIS set for engwebp (USFX may still carry empty DC stubs). */
const PROTESTANT_66 = new Set([
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH",
  "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN",
  "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
  "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL",
  "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
]);

function cacheDirFromArgs(argv) {
  const i = argv.indexOf("--cache-dir");
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  return join(ROOT, ".cache", "ebible");
}

async function ensureZip(cacheDir, edition) {
  mkdirSync(cacheDir, { recursive: true });
  const path = join(cacheDir, edition.zip);
  if (existsSync(path)) return path;
  const url = `${EBIBLE}/${edition.zip}`;
  console.error(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${url} (${res.status})`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
  return path;
}

function unzipXml(zipPath, xmlName, workDir) {
  execFileSync("unzip", ["-qo", zipPath, xmlName, "-d", workDir], { stdio: ["ignore", "ignore", "inherit"] });
  const extracted = join(workDir, xmlName);
  if (!existsSync(extracted)) throw new Error(`Missing ${xmlName} in ${zipPath}`);
  return extracted;
}

function stripMarkup(fragment) {
  return fragment
    .replace(/<f\b[\s\S]*?<\/f>/gi, "")
    .replace(/<note\b[\s\S]*?<\/note>/gi, "")
    .replace(/<fig\b[\s\S]*?<\/fig>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseUsfx(xml) {
  const books = Object.create(null);
  let bookId = null;
  let chapter = 0;
  let verse = 0;
  let collecting = false;
  let buf = "";

  const flush = () => {
    if (!collecting || !bookId || !chapter || !verse) {
      collecting = false;
      buf = "";
      return;
    }
    const text = stripMarkup(buf);
    collecting = false;
    buf = "";
    if (!text) return;
    if (!books[bookId]) books[bookId] = Object.create(null);
    if (!books[bookId][chapter]) books[bookId][chapter] = Object.create(null);
    books[bookId][chapter][verse] = text;
  };

  const tokenRe = /<\/?book\b[^>]*>|<c\b[^/]*\/>|<v\b[^/]*\/>|<ve\s*\/>|[^<]+|<[^>]+>/g;
  let m;
  while ((m = tokenRe.exec(xml))) {
    const tok = m[0];
    if (tok.startsWith("<book")) {
      flush();
      const idMatch = tok.match(/\bid="([A-Z0-9]+)"/i);
      bookId = idMatch ? idMatch[1].toUpperCase() : null;
      if (bookId && FRONT_MATTER.has(bookId)) bookId = null;
      chapter = 0;
      verse = 0;
      continue;
    }
    if (tok.startsWith("</book")) {
      flush();
      bookId = null;
      continue;
    }
    if (!bookId) continue;
    if (tok.startsWith("<c ")) {
      flush();
      const idMatch = tok.match(/\bid="(\d+)"/);
      chapter = idMatch ? Number(idMatch[1]) : 0;
      verse = 0;
      continue;
    }
    if (tok.startsWith("<v ")) {
      flush();
      const idMatch = tok.match(/\bid="(\d+)"/);
      verse = idMatch ? Number(idMatch[1]) : 0;
      collecting = true;
      buf = "";
      continue;
    }
    if (tok.startsWith("<ve")) {
      flush();
      continue;
    }
    if (collecting) buf += tok;
  }
  flush();
  return books;
}

function countVerses(books) {
  let n = 0;
  for (const chapters of Object.values(books)) {
    for (const verses of Object.values(chapters)) n += Object.keys(verses).length;
  }
  return n;
}

function assertSmoke(books, editionId) {
  const g11 = books.GEN?.[1]?.[1];
  const j316 = books.JHN?.[3]?.[16];
  if (!g11) throw new Error(`${editionId}: missing Genesis 1:1`);
  if (!/beginning/i.test(g11)) throw new Error(`${editionId}: Genesis 1:1 unexpected: ${g11.slice(0, 80)}`);
  if (!j316) throw new Error(`${editionId}: missing John 3:16`);
  if (!/world/i.test(j316)) throw new Error(`${editionId}: John 3:16 unexpected: ${j316.slice(0, 80)}`);
  if (editionId === "eng-kjv") {
    const w = books.WIS?.[1]?.[1];
    if (!w) throw new Error("eng-kjv: expected Wisdom 1:1 (Apocrypha)");
  }
}

function filterEditionBooks(editionId, books) {
  if (editionId !== "engwebp") return books;
  const filtered = Object.create(null);
  for (const id of Object.keys(books)) {
    if (PROTESTANT_66.has(id)) filtered[id] = books[id];
  }
  return filtered;
}

async function buildEdition(cacheDir, edition) {
  const zipPath = await ensureZip(cacheDir, edition);
  const workDir = join(cacheDir, "extracted", edition.id);
  mkdirSync(workDir, { recursive: true });
  const xmlPath = unzipXml(zipPath, edition.xml, workDir);
  const xml = readFileSync(xmlPath, "utf8");
  let books = parseUsfx(xml);
  books = filterEditionBooks(edition.id, books);
  const bookIds = Object.keys(books);
  if (bookIds.length < edition.expectMinBooks) {
    throw new Error(`${edition.id}: only ${bookIds.length} books (expected >= ${edition.expectMinBooks})`);
  }
  assertSmoke(books, edition.id);
  const pack = {
    schema: "scripture-pack-v1",
    edition: edition.id,
    label: edition.label,
    source: `eBible ${edition.id} USFX`,
    book_count: bookIds.length,
    verse_count: countVerses(books),
    books,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${edition.id}.json`);
  writeFileSync(outPath, JSON.stringify(pack));
  console.error(
    `Wrote ${outPath} (${pack.book_count} books, ${pack.verse_count} verses, ${(Buffer.byteLength(JSON.stringify(pack)) / 1024 / 1024).toFixed(2)} MB)`,
  );
  return pack;
}

async function main() {
  const cacheDir = cacheDirFromArgs(process.argv.slice(2));
  for (const edition of EDITIONS) {
    await buildEdition(cacheDir, edition);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
