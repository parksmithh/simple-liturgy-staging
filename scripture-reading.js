import { editionForMode } from "./scripture-preference.js?v=staging-6e407f1601ea49b90c16d572c4409a52d8cbf9d7";
import { resolveCitation, unavailableNote } from "./scripture-resolve.js?v=staging-6e407f1601ea49b90c16d572c4409a52d8cbf9d7";

/** Unicode ellipsis used in split-verse markers (7… / …7 / …7…). */
export const VERSE_ELLIPSIS = "\u2026";

/**
 * Format a verse number for a page fragment.
 * - starts && ends → "7"
 * - starts && !ends → "7…"
 * - !starts && ends → "…7"
 * - !starts && !ends → "…7…"
 */
export function formatVerseMarker(verse, { starts = true, ends = true } = {}) {
  const n = String(verse);
  if (starts && ends) return n;
  if (starts && !ends) return `${n}${VERSE_ELLIPSIS}`;
  if (!starts && ends) return `${VERSE_ELLIPSIS}${n}`;
  return `${VERSE_ELLIPSIS}${n}${VERSE_ELLIPSIS}`;
}

export function versesToPageText(verses) {
  return (verses || [])
    .map(verse => {
      if (verse?.kind === "heading") return String(verse.text || "").trim();
      return `${formatVerseMarker(verse.verse)} ${verse.text}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Display titles for USFX / OSIS book ids used in scripture packs. */
const BOOK_LABELS = Object.freeze({
  GEN: "Genesis", EXO: "Exodus", LEV: "Leviticus", NUM: "Numbers", DEU: "Deuteronomy",
  JOS: "Joshua", JDG: "Judges", RUT: "Ruth", "1SA": "1 Samuel", "2SA": "2 Samuel",
  "1KI": "1 Kings", "2KI": "2 Kings", "1CH": "1 Chronicles", "2CH": "2 Chronicles",
  EZR: "Ezra", NEH: "Nehemiah", EST: "Esther", JOB: "Job", PSA: "Psalm", PRO: "Proverbs",
  ECC: "Ecclesiastes", SNG: "Song of Solomon", ISA: "Isaiah", JER: "Jeremiah", LAM: "Lamentations",
  EZK: "Ezekiel", DAN: "Daniel", HOS: "Hosea", JOL: "Joel", AMO: "Amos", OBA: "Obadiah",
  JON: "Jonah", MIC: "Micah", NAM: "Nahum", HAB: "Habakkuk", ZEP: "Zephaniah", HAG: "Haggai",
  ZEC: "Zechariah", MAL: "Malachi", MAT: "Matthew", MRK: "Mark", LUK: "Luke", JHN: "John",
  ACT: "Acts", ROM: "Romans", "1CO": "1 Corinthians", "2CO": "2 Corinthians", GAL: "Galatians",
  EPH: "Ephesians", PHP: "Philippians", COL: "Colossians", "1TH": "1 Thessalonians",
  "2TH": "2 Thessalonians", "1TI": "1 Timothy", "2TI": "2 Timothy", TIT: "Titus", PHM: "Philemon",
  HEB: "Hebrews", JAS: "James", "1PE": "1 Peter", "2PE": "2 Peter", "1JN": "1 John",
  "2JN": "2 John", "3JN": "3 John", JUD: "Jude", REV: "Revelation",
  WIS: "Wisdom", SIR: "Ecclesiasticus", BAR: "Baruch", TOB: "Tobit", JDT: "Judith",
  "1MA": "1 Maccabees", "2MA": "2 Maccabees", "1ES": "1 Esdras", "2ES": "2 Esdras", DAG: "Song of the Three",
});

export function chapterHeadingLabel(bookId, chapter) {
  const label = BOOK_LABELS[bookId] || String(bookId || "").trim() || "Chapter";
  return `${label} ${chapter}`;
}

function distinctChapterKeys(verses) {
  const keys = new Set();
  for (const verse of verses || []) {
    if (verse?.kind === "heading") continue;
    const chapter = Number(verse?.chapter);
    if (!verse?.bookId || !Number.isFinite(chapter)) continue;
    keys.add(`${verse.bookId}:${chapter}`);
  }
  return keys;
}

/**
 * Insert a book+chapter heading before each discrete chapter in a verse list.
 * e.g. Psalm 19, Hebrews 11, Hebrews 12.
 */
export function withChapterHeadings(verses) {
  const out = [];
  let lastKey = null;
  for (const verse of verses || []) {
    if (verse?.kind === "heading") {
      out.push(verse);
      lastKey = null;
      continue;
    }
    const chapter = Number(verse?.chapter);
    const bookId = verse?.bookId;
    if (bookId && Number.isFinite(chapter)) {
      const key = `${bookId}:${chapter}`;
      if (key !== lastKey) {
        out.push({ kind: "heading", text: chapterHeadingLabel(bookId, chapter) });
        lastKey = key;
      }
    }
    out.push(verse);
  }
  return out;
}

/** @deprecated Use withChapterHeadings */
export const withPsalmChapterHeadings = withChapterHeadings;

/**
 * Insert per-chapter body headings when a reading spans more than one chapter.
 * Single-chapter Psalms keep the full citation in focus chrome (e.g. Psalm 89:19–52)
 * instead of a bare "Psalm 89" body heading.
 */
export function decorateScriptureVerses(verses) {
  if (!verses?.length) return { verses: verses || [], chapterHeadings: false };
  const keys = distinctChapterKeys(verses);
  if (keys.size <= 1) return { verses: verses || [], chapterHeadings: false };
  return { verses: withChapterHeadings(verses), chapterHeadings: true };
}

/**
 * Split joined psalm token strings on commas that are not inside [] or ().
 * e.g. "66, 67" → ["66","67"]; "[59, 60] or 33, 146" → ["[59, 60] or 33","146"]
 */
function splitPsalmTokenString(value) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of String(value || "")) {
    if (ch === "[" || ch === "(") depth += 1;
    else if (ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Convert BCP Simple-liturgy psalm tokens into a resolver-ready citation.
 * Tokens may be an array ("66", "119:1-24") or a joined string ("66, 67").
 * @returns {string} e.g. "Psalm 66; Psalm 67" or "Psalm 119:1-24" (empty if none)
 */
export function psalmTokensToCitation(tokens) {
  const raw = Array.isArray(tokens)
    ? tokens.join(", ")
    : String(tokens || "").replace(/\n+/g, ", ");
  if (!raw.trim()) return "";

  const citations = [];
  for (const token of splitPsalmTokenString(raw)) {
    let cleaned = token.replace(/[\[\]]/g, "").replace(/\*+/g, "").trim();
    if (!cleaned) continue;
    const orSplit = cleaned.split(/\s+or\s+/i);
    if (orSplit.length > 1) cleaned = orSplit[0].trim();
    for (const piece of cleaned.split(/\s*,\s*/).map(part => part.trim()).filter(Boolean)) {
      if (/^\d/.test(piece)) citations.push(`Psalm ${piece}`);
    }
  }
  return citations.join("; ");
}

/** Citation for Simple PS focus given morning/evening token strings and display prefs. */
export function simplePsalmCitation(psalms, {
  psalmDisplayMode = "together",
  psalmOffice = "morning",
} = {}) {
  if (!psalms) return "";
  if (psalmDisplayMode === "by-time-of-day") {
    const office = psalmOffice === "evening" ? "evening" : "morning";
    return psalmTokensToCitation(psalms[office] || "");
  }
  return psalmTokensToCitation([psalms.morning, psalms.evening].filter(Boolean).join(", "));
}

/**
 * Pack verse fragments into pages that fill available height.
 * `fits(pageText, pageIndex)` returns true when the candidate fits.
 * Mid-verse splits keep the verse marker with leading/trailing ellipsis.
 * @returns {{ pages: string[], pageHeadings: (string|null)[] }}
 *   pageHeadings[i] is the chapter title in force at the start of page i
 *   (leading heading on that page, else the chapter continued from prior pages).
 */
export function paginateScriptureVersesByFit(verses, fits) {
  if (!verses?.length) return { pages: [], pageHeadings: [] };
  const pages = [];
  const pageHeadings = [];
  let blocks = [];
  let currentHeading = null;

  const pageText = list => list.map(block => `${block.marker} ${block.text}`.trim()).join("\n\n");
  const tryFit = list => fits(pageText(list), pages.length);
  const commit = () => {
    if (!blocks.length) return;
    const leading = blocks[0]?.heading ? blocks[0].marker : null;
    pageHeadings.push(leading || currentHeading);
    for (const block of blocks) {
      if (block.heading) currentHeading = block.marker;
    }
    pages.push(pageText(blocks));
    blocks = [];
  };

  for (const verse of verses) {
    if (verse?.kind === "heading") {
      const marker = String(verse.text || "").trim();
      if (!marker) continue;
      const next = [...blocks, { marker, text: "", heading: true }];
      if (blocks.length && !tryFit(next)) commit();
      blocks.push({ marker, text: "", heading: true });
      continue;
    }

    const words = String(verse.text || "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      const marker = formatVerseMarker(verse.verse);
      const next = [...blocks, { marker, text: "" }];
      if (blocks.length && !tryFit(next)) commit();
      blocks.push({ marker, text: "" });
      continue;
    }

    let start = 0;
    let isStart = true;
    while (start < words.length) {
      let bestEnd = start;
      for (let end = start + 1; end <= words.length; end += 1) {
        const marker = formatVerseMarker(verse.verse, {
          starts: isStart,
          ends: end === words.length,
        });
        const fragment = words.slice(start, end).join(" ");
        if (tryFit([...blocks, { marker, text: fragment }])) bestEnd = end;
        else break;
      }

      if (bestEnd === start) {
        if (blocks.length) {
          commit();
          continue;
        }
        // Empty page still cannot fit the next word — emit it to guarantee progress.
        bestEnd = start + 1;
      }

      const ends = bestEnd === words.length;
      blocks.push({
        marker: formatVerseMarker(verse.verse, { starts: isStart, ends }),
        text: words.slice(start, bestEnd).join(" "),
      });
      start = bestEnd;
      isStart = false;
      if (!ends) commit();
    }
  }
  commit();
  return { pages, pageHeadings };
}

/** Chapter title in force at the start of an unfitted (single) page. */
export function initialScripturePageHeading(verses) {
  for (const verse of verses || []) {
    if (verse?.kind === "heading" && verse.text) return String(verse.text);
  }
  return null;
}

/**
 * Body text for a scripture page. On continuation pages, a leading chapter
 * heading that already appears as the page title is omitted from the body.
 */
export function scripturePageBodyText(built, page) {
  let text = built?.pages?.[page] || "";
  if (!built?.chapterHeadings || page <= 0) return text;
  const title = built.pageHeadings?.[page];
  if (!title) return text;
  if (text === title) return "";
  if (text.startsWith(`${title}\n\n`)) return text.slice(title.length + 2);
  if (text.startsWith(`${title}\n`)) return text.slice(title.length + 1);
  return text;
}

/**
 * Build focus payload for a citation under the current scripture mode.
 * @returns {{ pages: string[], verses: Array|null, citation: string, unavailable: boolean } | null}
 *   null means Off (caller keeps citation-only UI).
 *   Available lessons ship all verses as one initial page; the UI measures and refits.
 */
export function scriptureLessonPages({
  citation,
  scriptureMode,
  pack,
}) {
  if (!scriptureMode || scriptureMode === "off") return null;
  const edition = editionForMode(scriptureMode);
  if (!edition) return null;
  if (!pack) {
    return {
      pages: [unavailableNote()],
      verses: null,
      citation: String(citation || ""),
      unavailable: true,
    };
  }
  const resolved = resolveCitation(citation, pack);
  if (!resolved.ok) {
    return {
      pages: [unavailableNote()],
      verses: null,
      citation: resolved.citation || String(citation || ""),
      unavailable: true,
    };
  }
  const decorated = decorateScriptureVerses(resolved.verses);
  return {
    pages: [versesToPageText(decorated.verses)],
    verses: decorated.verses,
    citation: resolved.citation,
    unavailable: false,
    chapterHeadings: decorated.chapterHeadings,
    pageHeadings: decorated.chapterHeadings
      ? [initialScripturePageHeading(decorated.verses)]
      : null,
  };
}

export function applyScriptureToSimpleView(view, {
  scriptureMode,
  pack,
  psalmDisplayMode = "together",
  psalmOffice = "morning",
}) {
  if (!view?.values) return view;
  const scripturePages = {};
  for (const key of ["OT", "NT", "GS"]) {
    const citation = view.values[key];
    if (!citation || citation === "-") continue;
    const built = scriptureLessonPages({
      citation,
      scriptureMode,
      pack,
    });
    if (built) scripturePages[key] = built;
  }
  const psalmCitation = simplePsalmCitation(view.psalms, { psalmDisplayMode, psalmOffice })
    || psalmTokensToCitation(view.values.PS);
  if (psalmCitation) {
    const built = scriptureLessonPages({
      citation: psalmCitation,
      scriptureMode,
      pack,
    });
    if (built) scripturePages.PS = built;
  }
  return { ...view, scripturePages };
}

export function applyScriptureToTimedOffice(office, {
  scriptureMode,
  pack,
}) {
  if (!office?.sections || scriptureMode === "off") return office;
  const sections = { ...office.sections };
  for (const [key, section] of Object.entries(sections)) {
    if (!/_LESSON_\d+$/.test(key) || !section.citation) continue;
    const built = scriptureLessonPages({
      citation: section.citation,
      scriptureMode,
      pack,
    });
    if (!built) continue;
    sections[key] = {
      ...section,
      pages: built.pages,
      scriptureVerses: built.verses,
      scriptureUnavailable: built.unavailable,
      numberedVerses: !built.unavailable,
      preservePages: built.unavailable,
      chapterHeadings: Boolean(built.chapterHeadings),
      pageHeadings: built.pageHeadings || null,
    };
  }
  return { ...office, sections };
}
