/**
 * Resolve BCP-shaped lesson citations against scripture packs.
 * Pack shape: data/scripture/{edition}.json (scripture-pack-v1).
 */

const MISS = Object.freeze({
  UNKNOWN_BOOK: "unknown_book",
  MISSING_VERSES: "missing_verses",
  PACK_UNAVAILABLE: "pack_unavailable",
  EMPTY: "empty",
});

/** Map common lectionary names / abbreviations → USFX OSIS ids. */
const BOOK_ALIASES = Object.freeze({
  genesis: "GEN", gen: "GEN",
  exodus: "EXO", exo: "EXO", ex: "EXO",
  leviticus: "LEV", lev: "LEV",
  numbers: "NUM", num: "NUM", nu: "NUM",
  deuteronomy: "DEU", deut: "DEU", deu: "DEU", dt: "DEU",
  joshua: "JOS", josh: "JOS", jos: "JOS",
  judges: "JDG", judg: "JDG", jdg: "JDG",
  ruth: "RUT", rut: "RUT",
  "1 samuel": "1SA", "1 sam": "1SA", "1sa": "1SA", "i samuel": "1SA", "i sam": "1SA",
  "2 samuel": "2SA", "2 sam": "2SA", "2sa": "2SA", "ii samuel": "2SA", "ii sam": "2SA",
  "1 kings": "1KI", "1 kgs": "1KI", "1ki": "1KI", "i kings": "1KI",
  "2 kings": "2KI", "2 kgs": "2KI", "2ki": "2KI", "ii kings": "2KI",
  "1 chronicles": "1CH", "1 chron": "1CH", "1chr": "1CH", "1ch": "1CH", "i chronicles": "1CH",
  "2 chronicles": "2CH", "2 chron": "2CH", "2chr": "2CH", "2ch": "2CH", "ii chronicles": "2CH",
  ezra: "EZR", ezr: "EZR",
  nehemiah: "NEH", neh: "NEH",
  esther: "EST", est: "EST",
  job: "JOB",
  psalm: "PSA", psalms: "PSA", psa: "PSA", ps: "PSA",
  proverb: "PRO", proverbs: "PRO", prov: "PRO", pro: "PRO",
  ecclesiastes: "ECC", eccles: "ECC", ecc: "ECC", qoheleth: "ECC",
  "song of solomon": "SNG", "song of songs": "SNG", canticles: "SNG", cant: "SNG", sng: "SNG", ss: "SNG",
  isaiah: "ISA", isa: "ISA", is: "ISA",
  jeremiah: "JER", jer: "JER",
  lamentations: "LAM", lam: "LAM",
  ezekiel: "EZK", ezek: "EZK", eze: "EZK", ezk: "EZK",
  daniel: "DAN", dan: "DAN",
  hosea: "HOS", hos: "HOS",
  joel: "JOL", jol: "JOL",
  amos: "AMO", amo: "AMO",
  obadiah: "OBA", obad: "OBA", oba: "OBA",
  jonah: "JON", jon: "JON",
  micah: "MIC", mic: "MIC",
  nahum: "NAM", nah: "NAM", nam: "NAM",
  habakkuk: "HAB", hab: "HAB",
  zephaniah: "ZEP", zeph: "ZEP", zep: "ZEP",
  haggai: "HAG", hag: "HAG",
  zechariah: "ZEC", zech: "ZEC", zec: "ZEC",
  malachi: "MAL", mal: "MAL",
  matthew: "MAT", matt: "MAT", mat: "MAT", mt: "MAT",
  mark: "MRK", mk: "MRK", mrk: "MRK",
  luke: "LUK", luk: "LUK", lk: "LUK",
  john: "JHN", jn: "JHN", jhn: "JHN",
  acts: "ACT", act: "ACT",
  romans: "ROM", rom: "ROM",
  "1 corinthians": "1CO", "1 cor": "1CO", "1cor": "1CO", "1co": "1CO", "i corinthians": "1CO",
  "2 corinthians": "2CO", "2 cor": "2CO", "2cor": "2CO", "2co": "2CO", "ii corinthians": "2CO",
  galatians: "GAL", gal: "GAL",
  ephesians: "EPH", eph: "EPH",
  philippians: "PHP", phil: "PHP", php: "PHP",
  colossians: "COL", col: "COL",
  "1 thessalonians": "1TH", "1 thess": "1TH", "1th": "1TH", "i thessalonians": "1TH",
  "2 thessalonians": "2TH", "2 thess": "2TH", "2th": "2TH", "ii thessalonians": "2TH",
  "1 timothy": "1TI", "1 tim": "1TI", "1ti": "1TI", "i timothy": "1TI",
  "2 timothy": "2TI", "2 tim": "2TI", "2ti": "2TI", "ii timothy": "2TI",
  titus: "TIT", tit: "TIT",
  philemon: "PHM", phlm: "PHM", phm: "PHM",
  hebrews: "HEB", heb: "HEB",
  james: "JAS", jas: "JAS", jm: "JAS",
  "1 peter": "1PE", "1 pet": "1PE", "1pe": "1PE", "i peter": "1PE",
  "2 peter": "2PE", "2 pet": "2PE", "2pe": "2PE", "ii peter": "2PE",
  "1 john": "1JN", "1 jn": "1JN", "1jn": "1JN", "i john": "1JN",
  "2 john": "2JN", "2 jn": "2JN", "2jn": "2JN", "ii john": "2JN",
  "3 john": "3JN", "3 jn": "3JN", "3jn": "3JN", "iii john": "3JN",
  jude: "JUD", jud: "JUD",
  revelation: "REV", rev: "REV", apocalypse: "REV",
  // Deuterocanon / Apocrypha (KJV / BCP)
  wisdom: "WIS", wis: "WIS", "wisdom of solomon": "WIS",
  ecclus: "SIR", "ecclus.": "SIR", sirach: "SIR", sir: "SIR", ecclesiasticus: "SIR",
  baruch: "BAR", bar: "BAR",
  tobit: "TOB", tob: "TOB",
  judith: "JDT", jdt: "JDT",
  "1 maccabees": "1MA", "1 macc": "1MA", "1ma": "1MA", "i maccabees": "1MA",
  "2 maccabees": "2MA", "2 macc": "2MA", "2ma": "2MA", "ii maccabees": "2MA",
  "1 esdras": "1ES", "1 esd": "1ES", "i esdras": "1ES",
  "2 esdras": "2ES", "2 esd": "2ES", "ii esdras": "2ES",
  "song of the three": "DAG", susanna: "DAG", "bel and the dragon": "DAG",
});

export const SCRIPTURE_MISS = MISS;

export function normalizeCitation(citation) {
  let s = String(citation || "").trim();
  s = s.replace(/\*+\s*$/g, "");
  s = s.replace(/^or\s+/i, "");
  // Prefer the first alternative when Simple packs embed "A, or B" / "A or B".
  const orSplit = s.split(/\s*,\s*or\s+|\s+or\s+/i);
  if (orSplit.length > 1) s = orSplit[0].trim();
  s = s.replace(/--+/g, "–").replace(/—/g, "–").replace(/-/g, "–");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function expandOptionals(citation) {
  // Include parenthetical optional material by default.
  // Mid-verse: "18-28(29-30)31-35" → "18-28,29-30,31-35"
  // Leading chapter range: "Colossians (3:18-4:1)2-18" → "Colossians 3:18-4:1,2-18"
  return citation
    .replace(/\(([^)]+)\)/g, (_, inner) => {
      const t = inner.trim();
      return /^\d+:/.test(t) ? `${t},` : `,${t},`;
    })
    .replace(/,+/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ",")
    .replace(/(\d),(\d)/g, "$1,$2")
    .replace(/,+/g, ",")
    .replace(/,\s*$/g, "")
    .replace(/^\s*,/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitSegments(citation) {
  return citation.split(/\s*;\s*/).map(part => part.trim()).filter(Boolean);
}

function splitCommaSegments(segment) {
  const m = segment.match(/^(.+?)\s+(\d+):(.*)$/);
  if (!m) return [segment];
  const book = m[1].trim();
  let chapter = Number(m[2]);
  const rest = `${m[2]}:${m[3]}`;
  const pieces = rest.split(/\s*,\s*/).map(p => p.trim()).filter(Boolean);
  return pieces.map(p => {
    if (/^\d+:/.test(p)) {
      const cross = p.match(/^(\d+):(?:\d+[a-z]?)(?:\s*[–-]\s*(?:(\d+):)?(?:\d+[a-z]?))?$/i);
      if (cross) chapter = cross[2] ? Number(cross[2]) : Number(cross[1]);
      return `${book} ${p}`;
    }
    if (/^\d+[a-z]?(?:\s*[–-]\s*\d+[a-z]?)?$/i.test(p)) return `${book} ${chapter}:${p}`;
    return `${book} ${p}`;
  });
}

function parseVerseToken(token) {
  // "12", "12a", "12b"
  const m = String(token).trim().match(/^(\d+)([a-z]?)$/i);
  if (!m) return null;
  return { verse: Number(m[1]), half: (m[2] || "").toLowerCase() };
}

function resolveBookId(name) {
  const key = String(name || "").trim().toLowerCase().replace(/\./g, "");
  if (BOOK_ALIASES[key]) return BOOK_ALIASES[key];
  // Try without trailing period variants already stripped; numbered books with loose spacing.
  const compact = key.replace(/\s+/g, " ");
  if (BOOK_ALIASES[compact]) return BOOK_ALIASES[compact];
  return null;
}

/**
 * Parse one segment like "Isaiah 1:1–9" or "Hebrews 11:32–12:2" or "Luke 21:5–19".
 * Also "Isaiah 2" (whole chapter) and continuation "18–23" with prior book/chapter context.
 */
function parseSegment(raw, context = {}) {
  let text = String(raw || "").trim();
  if (!text) return [];

  // Full form: Book chapter:verse[-verse] [– chapter:verse]
  let m = text.match(/^(.+?)\s+(\d+):(\d+[a-z]?)(?:\s*[–-]\s*(?:(\d+):)?(\d+[a-z]?))?$/i);
  if (m) {
    const bookId = resolveBookId(m[1]);
    if (!bookId) return { error: MISS.UNKNOWN_BOOK, book: m[1] };
    const startChapter = Number(m[2]);
    const startVerse = parseVerseToken(m[3]);
    const endChapter = m[4] ? Number(m[4]) : startChapter;
    const endVerse = m[5] ? parseVerseToken(m[5]) : startVerse;
    return {
      bookId,
      ranges: [{
        startChapter,
        startVerse: startVerse.verse,
        endChapter,
        endVerse: endVerse.verse,
      }],
      context: { bookId, chapter: endChapter },
    };
  }

  // Book chapter (whole chapter)
  m = text.match(/^(.+?)\s+(\d+)$/);
  if (m && !/^\d/.test(m[1])) {
    const bookId = resolveBookId(m[1]);
    if (!bookId) return { error: MISS.UNKNOWN_BOOK, book: m[1] };
    const chapter = Number(m[2]);
    return {
      bookId,
      ranges: [{ startChapter: chapter, startVerse: 1, endChapter: chapter, endVerse: null }],
      context: { bookId, chapter },
    };
  }

  // Continuation with context: "18–23" or "2:1–3" or "12:1–10"
  if (context.bookId) {
    m = text.match(/^(\d+):(\d+[a-z]?)(?:\s*[–-]\s*(?:(\d+):)?(\d+[a-z]?))?$/i);
    if (m) {
      const startChapter = Number(m[1]);
      const startVerse = parseVerseToken(m[2]);
      const endChapter = m[3] ? Number(m[3]) : startChapter;
      const endVerse = m[4] ? parseVerseToken(m[4]) : startVerse;
      return {
        bookId: context.bookId,
        ranges: [{
          startChapter,
          startVerse: startVerse.verse,
          endChapter,
          endVerse: endVerse.verse,
        }],
        context: { bookId: context.bookId, chapter: endChapter },
      };
    }
    m = text.match(/^(\d+[a-z]?)(?:\s*[–-]\s*(\d+[a-z]?))?$/i);
    if (m && context.chapter) {
      const startVerse = parseVerseToken(m[1]);
      const endVerse = m[2] ? parseVerseToken(m[2]) : startVerse;
      return {
        bookId: context.bookId,
        ranges: [{
          startChapter: context.chapter,
          startVerse: startVerse.verse,
          endChapter: context.chapter,
          endVerse: endVerse.verse,
        }],
        context: { bookId: context.bookId, chapter: context.chapter },
      };
    }
  }

  return { error: MISS.EMPTY, raw: text };
}

function versesInChapter(pack, bookId, chapter) {
  const ch = pack?.books?.[bookId]?.[chapter] || pack?.books?.[bookId]?.[String(chapter)];
  if (!ch) return [];
  return Object.keys(ch).map(Number).sort((a, b) => a - b);
}

function expandRange(pack, bookId, range) {
  const out = [];
  let { startChapter, startVerse, endChapter, endVerse } = range;
  for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
    const nums = versesInChapter(pack, bookId, chapter);
    if (nums.length === 0) continue;
    const from = chapter === startChapter ? startVerse : nums[0];
    const to = chapter === endChapter
      ? (endVerse == null ? nums[nums.length - 1] : endVerse)
      : nums[nums.length - 1];
    for (const n of nums) {
      if (n < from || n > to) continue;
      const text = pack.books[bookId][chapter]?.[n] || pack.books[bookId][String(chapter)]?.[String(n)];
      if (text) out.push({ bookId, chapter, verse: n, text });
    }
  }
  return out;
}

/**
 * @param {string} citation
 * @param {object|null} pack scripture-pack-v1
 * @returns {{ ok: true, verses: Array, citation: string } | { ok: false, reason: string, citation: string, detail?: string }}
 */
export function resolveCitation(citation, pack) {
  const normalized = normalizeCitation(citation);
  if (!normalized) return { ok: false, reason: MISS.EMPTY, citation: String(citation || "") };
  if (!pack?.books) return { ok: false, reason: MISS.PACK_UNAVAILABLE, citation: normalized };

  const topSegments = splitSegments(expandOptionals(normalized));
  const verses = [];
  let context = {};
  for (const top of topSegments) {
    for (const piece of splitCommaSegments(top)) {
      const parsed = parseSegment(piece, context);
      if (parsed.error) {
        if (parsed.error === MISS.UNKNOWN_BOOK) {
          return { ok: false, reason: MISS.UNKNOWN_BOOK, citation: normalized, detail: parsed.book };
        }
        continue;
      }
      context = parsed.context || context;
      if (!pack.books[parsed.bookId]) {
        return { ok: false, reason: MISS.UNKNOWN_BOOK, citation: normalized, detail: parsed.bookId };
      }
      for (const range of parsed.ranges) {
        verses.push(...expandRange(pack, parsed.bookId, range));
      }
    }
  }

  if (verses.length === 0) {
    return { ok: false, reason: MISS.MISSING_VERSES, citation: normalized };
  }
  return { ok: true, verses, citation: normalized };
}

export function unavailableNote() {
  return "This passage is not in this translation.";
}
