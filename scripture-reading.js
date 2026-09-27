import { editionForMode } from "./scripture-preference.js?v=staging-6810a8e5b1c9761f2ebd4c7130de12b9baa693ce";
import { resolveCitation, unavailableNote } from "./scripture-resolve.js?v=staging-6810a8e5b1c9761f2ebd4c7130de12b9baa693ce";

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
