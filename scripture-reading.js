import { editionForMode } from "./scripture-preference.js?v=staging-8ec26f8d746b35e87b7c646089861f4d35805cb9";
import { resolveCitation, unavailableNote } from "./scripture-resolve.js?v=staging-8ec26f8d746b35e87b7c646089861f4d35805cb9";

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
    .map(verse => `${formatVerseMarker(verse.verse)} ${verse.text}`.trim())
    .join("\n\n");
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
 */
export function paginateScriptureVersesByFit(verses, fits) {
  if (!verses?.length) return [];
  const pages = [];
  let blocks = [];

  const pageText = list => list.map(block => `${block.marker} ${block.text}`.trim()).join("\n\n");
  const tryFit = list => fits(pageText(list), pages.length);
  const commit = () => {
    if (!blocks.length) return;
    pages.push(pageText(blocks));
    blocks = [];
  };

  for (const verse of verses) {
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
  return pages;
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
  return {
    pages: [versesToPageText(resolved.verses)],
    verses: resolved.verses,
    citation: resolved.citation,
    unavailable: false,
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
    };
  }
  return { ...office, sections };
}
