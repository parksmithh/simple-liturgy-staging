import { wikipediaUrlForFeast } from "./feast-wikipedia.js?v=staging-6e407f1601ea49b90c16d572c4409a52d8cbf9d7";
import {
  adaptLegacyTimedOffice,
  officeDocumentToViewSections,
} from "./office-document.js?v=staging-6e407f1601ea49b90c16d572c4409a52d8cbf9d7";
import { scripturePageBodyText } from "./scripture-reading.js?v=staging-6e407f1601ea49b90c16d572c4409a52d8cbf9d7";

export function parseBundle(text) {
  const readings = new Map();
  const dates = new Map();
  let header = null;
  for (const line of text.trim().split("\n")) {
    const record = JSON.parse(line);
    if (record.type === "header") header = record;
    if (record.type === "reading") readings.set(record.key, record);
    if (record.type === "date") dates.set(record.date, record);
  }
  if (!header || header.schema_version !== 1) throw new Error("Unsupported bundle");
  return { header, readings, dates };
}

function normalizedPrayerTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bst\./g, "saint")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PRAYER_TEXT_STARTS = {
  "First Sunday after Christmas Day": "Almighty God,",
  "Last Sunday after the Epiphany": "O God,",
  "Ash Wednesday": "Almighty and everlasting God,",
  "Sunday of the Passion: Palm Sunday": "Almighty and everliving God,",
  "Maundy Thursday": "Almighty Father,",
  "Good Friday": "Almighty God,",
  "Holy Saturday": "O God, Creator",
  "The Day of Pentecost: Whitsunday": "Almighty God, on this day",
};

function prayerOnly(prayer) {
  const marker = PRAYER_TEXT_STARTS[prayer.title];
  if (!marker) return prayer;
  const start = prayer.text.indexOf(marker);
  return start === -1 ? prayer : { ...prayer, text: prayer.text.slice(start) };
}

export function parseCollects(text) {
  const source = JSON.parse(text);
  if (!source?.contemporary || typeof source.contemporary !== "object") throw new Error("Unsupported prayer collection");
  return new Map(Object.values(source.contemporary).map(prayer => {
    const cleaned = prayerOnly(prayer);
    return [normalizedPrayerTitle(cleaned.title), cleaned];
  }));
}

const ORDINALS = {
  1: "first", 2: "second", 3: "third", 4: "fourth",
  5: "fifth", 6: "sixth", 7: "seventh", 8: "eighth",
};

function prayerTitleForDay(day) {
  if (day.feast === "Christmas Day") return "The Nativity of Our Lord: Christmas Day";
  if (day.feast === "Nativity of St. John the Baptist") return "The Nativity of Saint John the Baptist";
  if (day.feast) return day.feast;

  const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
  if (day.label === "Holy Week") {
    return [
      "Sunday of the Passion: Palm Sunday", "Monday in Holy Week", "Tuesday in Holy Week",
      "Wednesday in Holy Week", "Maundy Thursday", "Good Friday", "Holy Saturday",
    ][weekday];
  }
  if (day.label === "Easter Week") {
    return [
      "Easter Day", "Monday in Easter Week", "Tuesday in Easter Week", "Wednesday in Easter Week",
      "Thursday in Easter Week", "Friday in Easter Week", "Saturday in Easter Week",
    ][weekday];
  }
  if (day.label === "Week of 6 Easter" && weekday === 4) return "Ascension Day";
  if (day.label === "Christmas and Following") return "The Nativity of Our Lord: Christmas Day";
  if (day.label === "First Sunday after Christmas") return "First Sunday after Christmas Day";
  if (day.label === "Second Sunday after Christmas") return "Second Sunday after Christmas Day";
  if (day.label === "The Epiphany and Following") return "The Epiphany";
  if (day.label === "Ash Wednesday and Following") return "Ash Wednesday";
  if (day.label === "The Day of Pentecost") return "The Day of Pentecost: Whitsunday";
  if (day.label === "Trinity Sunday") return "First Sunday after Pentecost: Trinity Sunday";
  if (day.label === "Week of Last Epiphany") return "Last Sunday after the Epiphany";

  const proper = day.label.match(/^Week of Proper (\d+)$/)?.[1];
  if (proper) return `Proper ${proper}`;
  const advent = day.label.match(/^Week of ([1-4]) Advent$/)?.[1];
  if (advent) return `${ORDINALS[advent]} Sunday of Advent`;
  const epiphany = day.label.match(/^Week of ([1-8]) Epiphany$/)?.[1];
  if (epiphany === "1") return "First Sunday after the Epiphany: The Baptism of our Lord";
  if (epiphany) return `${ORDINALS[epiphany]} Sunday after the Epiphany`;
  const lent = day.label.match(/^Week of ([1-5]) Lent$/)?.[1];
  if (lent) return `${ORDINALS[lent]} Sunday in Lent`;
  const easter = day.label.match(/^Week of ([2-7]) Easter$/)?.[1];
  if (easter === "7") return "Seventh Sunday of Easter: The Sunday after Ascension Day";
  if (easter) return `${ORDINALS[easter]} Sunday of Easter`;
  return null;
}

export function resolvePrayer(collects, day) {
  if (!collects || !day) return null;
  const title = prayerTitleForDay(day);
  return title ? collects.get(normalizedPrayerTitle(title)) || null : null;
}

export function paginatePrayer(text, maximumCharacters = 120) {
  const words = String(text || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const limit = Math.max(40, maximumCharacters);
  const pages = [];
  let start = 0;
  while (start < words.length) {
    let end = start;
    let length = 0;
    let naturalBoundary = null;
    while (end < words.length) {
      const nextLength = length + (length ? 1 : 0) + words[end].length;
      if (nextLength > limit && end > start) break;
      length = nextLength;
      end += 1;
      if (length >= limit * 0.6 && /[.;:!?]$/.test(words[end - 1])) naturalBoundary = end;
      if (nextLength > limit) break;
    }
    if (end < words.length && naturalBoundary !== null) end = naturalBoundary;
    pages.push(words.slice(start, end).join(" "));
    start = end;
  }
  return pages;
}

export function paginatePrayerByFit(text, fits) {
  const words = String(text || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const pages = [];
  let start = 0;
  while (start < words.length) {
    const prefix = pages.length > 0 ? "..." : "";
    const remaining = words.slice(start).join(" ");
    if (fits(`${prefix}${remaining}`)) {
      pages.push(remaining);
      break;
    }

    let end = start + 1;
    while (end <= words.length) {
      const candidate = `${prefix}${words.slice(start, end).join(" ")}...`;
      if (!fits(candidate)) break;
      end += 1;
    }
    const pageEnd = Math.max(start + 1, end - 1);
    pages.push(words.slice(start, pageEnd).join(" "));
    start = pageEnd;
  }
  return pages;
}

const RESPONSE_FRAGMENT_MARKER = "\u001e";

function numberedVerseParts(value) {
  return String(value || "").match(
    /^((?:\u2026|\.\.\.)?\d+(?::\d+)?[a-z]?(?:(?:[-–—]|,)\d+(?::\d+)?[a-z]*)*(?:\u2026|\.\.\.)?)(?:\s+([\s\S]*))?$/i,
  );
}

function markedNumberedResponseWords(block) {
  if (!block.includes("*")) return block;
  let inResponse = false;
  return block.split(/(\s+)/).map(token => {
    if (!token || /^\s+$/.test(token)) return token;
    if (inResponse) return `${RESPONSE_FRAGMENT_MARKER}${token}`;
    const marker = token.indexOf("*");
    if (marker < 0) return token;
    inResponse = true;
    return marker === token.length - 1
      ? token
      : `${token.slice(0, marker + 1)}${RESPONSE_FRAGMENT_MARKER}${token.slice(marker + 1)}`;
  }).join("");
}

export function paginateBlocksByFit(text, fits, options = {}) {
  const blocks = String(text || "").trim().split(/\n{2,}/).filter(Boolean);
  if (blocks.length === 0) return [];
  const pages = [];
  let page = "";
  const pushPage = () => {
    if (!page) return;
    pages.push(page);
    page = "";
  };
  for (const block of blocks) {
    const candidate = page ? `${page}\n\n${block}` : block;
    if (fits(candidate, pages.length)) {
      page = candidate;
      continue;
    }
    pushPage();
    if (fits(block, pages.length)) {
      page = block;
      continue;
    }

    const splittableBlock = options.preserveNumberedCallResponse
      ? markedNumberedResponseWords(block)
      : block;
    for (const line of splittableBlock.split("\n")) {
      const lineCandidate = page ? `${page}\n${line}` : line;
      if (fits(lineCandidate, pages.length)) {
        page = lineCandidate;
        continue;
      }
      pushPage();
      if (fits(line, pages.length)) {
        page = line;
        continue;
      }

      const words = line.trim().split(/\s+/).filter(Boolean);
      for (const word of words) {
        const wordCandidate = page ? `${page} ${word}` : word;
        if (fits(wordCandidate, pages.length)) {
          page = wordCandidate;
          continue;
        }
        pushPage();
        // An unbreakable word may exceed the layout, but emitting it still
        // guarantees forward progress for arbitrary source text.
        page = word;
      }
    }
  }
  pushPage();
  if (pages.length > 1) {
    const previousIndex = pages.length - 2;
    const finalIndex = pages.length - 1;
    const previousBlocks = pages[previousIndex].split(/\n{2,}/);
    const finalBlocks = pages[finalIndex].split(/\n{2,}/);
    if (previousBlocks.length >= 3 && finalBlocks.length === 1) {
      const balancedFinal = [previousBlocks.at(-1), ...finalBlocks].join("\n\n");
      if (fits(balancedFinal, finalIndex)) {
        pages[previousIndex] = previousBlocks.slice(0, -1).join("\n\n");
        pages[finalIndex] = balancedFinal;
      }
    }
  }
  return pages;
}

export function paginateTimedOfficeByFit(pageGroups, fits, options = {}) {
  const groups = Array.isArray(pageGroups) ? pageGroups.filter(group => group?.text) : [];
  const pages = [];
  for (const group of groups) {
    if (group.standalone) {
      pages.push(group.text);
      continue;
    }
    const groupPages = paginateBlocksByFit(group.text, (candidate, pageIndex) => (
      fits(candidate, pages.length + pageIndex)
    ), options);
    pages.push(...groupPages);
  }
  return pages;
}

export function createState() {
  return { offset: 0, focus: null, focusPage: 0 };
}

export function stateAfterDateChange(state, previousDate, currentDate) {
  return previousDate === currentDate ? state : createState();
}

export const DAILY_FOCUS_ORDER = ["PRAYER", "PS", "OT", "NT", "GS", "LORDS_PRAYER", "GLORIA"];
export const LORDS_PRAYER_HEADING = "The Lord’s Prayer";
export const LORDS_PRAYER_TEXT = [
  "Our Father in heaven,",
  "hallowed be your Name,",
  "your kingdom come,",
  "your will be done,",
  "on earth as in heaven.",
  "Give us today our daily bread.",
  "Forgive us our sins",
  "as we forgive those who sin against us.",
  "Save us from the time of trial,",
  "and deliver us from evil.",
  "For the kingdom, the power, and the glory are yours,",
  "now and for ever. Amen.",
].join("\n");
const NOONDAY_FOCUS_ORDER = [
  "NOONDAY_OPENING",
  "NOONDAY_PSALM",
  "NOONDAY_KYRIE",
  "NOONDAY_LORDS_PRAYER",
  "NOONDAY_CLOSING_PRAYER",
];
const COMPLINE_FOCUS_ORDER = [
  "COMPLINE_OPENING",
  "COMPLINE_CONFESSION",
  "COMPLINE_PSALM",
  "COMPLINE_READING",
  "COMPLINE_PRAYERS",
  "COMPLINE_COLLECT",
  "COMPLINE_CONCLUSION",
];
const GLORIA_TEXT = "Glory to the Father, to the Son, and to the Holy Spirit. Amen.";
const READING_LABELS = { OT: "Old Testament", PS: "Psalms", NT: "New Testament", GS: "Gospel", PRAYER: "Prayer", GLORIA: "Gloria" };
const PSALM_OFFICE_LABELS = { morning: "Morning", evening: "Evening" };
const GOSPEL_BOOKS = ["matthew", "mark", "luke", "john"];
const NEW_TESTAMENT_BOOKS = [
  ...GOSPEL_BOOKS,
  "acts", "romans", "1 corinthians", "2 corinthians", "galatians", "ephesians",
  "philippians", "colossians", "1 thessalonians", "2 thessalonians", "1 timothy",
  "2 timothy", "titus", "philemon", "hebrews", "heb", "james", "1 peter",
  "2 peter", "1 john", "2 john", "3 john", "jude", "revelation",
];

function normalizedCitation(citation) {
  return String(citation).trim().replace(/^or\s+/i, "").replace(/--+/g, "-");
}

export function scriptureCitationPresentation(citation) {
  const normalized = normalizedCitation(citation || "");
  if (!normalized.includes(":")) return normalized ? "heading" : null;
  const versePart = normalized.slice(normalized.lastIndexOf(":") + 1).trim();
  return /^\d+[a-z]?$/i.test(versePart) ? "footnote" : "heading";
}

function normalizedCitationStartsWithBook(citation, books) {
  const normalized = citation.toLowerCase();
  return books.some(book => normalized === book || normalized.startsWith(`${book} `) || normalized.startsWith(`${book},`));
}

function scriptureKeyForNormalizedCitation(citation) {
  if (normalizedCitationStartsWithBook(citation, GOSPEL_BOOKS)) return "GS";
  if (normalizedCitationStartsWithBook(citation, NEW_TESTAMENT_BOOKS)) return "NT";
  return "OT";
}

export function lessonValues(lessons = []) {
  const values = { OT: "-", NT: "-", GS: "-" };
  for (const citation of lessons) {
    const normalized = normalizedCitation(citation);
    const key = scriptureKeyForNormalizedCitation(normalized);
    if (values[key] === "-") values[key] = normalized;
  }
  return values;
}

function focusTargets(focusOrder = DAILY_FOCUS_ORDER, pageCounts = {}) {
  const targets = [];
  for (const focus of focusOrder) {
    const pageCount = Math.max(1, pageCounts[focus] || 0);
    for (let page = 0; page < pageCount; page += 1) targets.push({ focus, focusPage: page });
  }
  return targets;
}

function moveFocus(next, direction, context = {}, exitAtEnd = true) {
  const focusOrder = Array.isArray(context.focusOrder) && context.focusOrder.length > 0
    ? context.focusOrder
    : DAILY_FOCUS_ORDER;
  const targets = focusTargets(focusOrder, context.focusPageCounts);
  const index = targets.findIndex(target => target.focus === next.focus && target.focusPage === (next.focusPage || 0));
  if (index === -1) return false;
  const targetIndex = index + direction;
  if (targetIndex < 0) return false;
  if (targetIndex >= targets.length) {
    if (exitAtEnd) {
      next.focus = null;
      next.focusPage = 0;
    }
    return exitAtEnd;
  }
  const target = targets[targetIndex];
  next.focus = target.focus;
  next.focusPage = target.focusPage;
  return true;
}

export function handle(state, event, context = {}) {
  const next = { ...state };
  if (event === "PREV_DAY") {
    next.offset -= 1;
    next.focus = null;
    next.focusPage = 0;
  } else if (event === "NEXT_DAY") {
    next.offset += 1;
    next.focus = null;
    next.focusPage = 0;
  } else if (event === "NEXT_READING" || event === "PREV_READING") {
    if (event === "PREV_READING" && next.focus === "PRAYER" && (next.focusPage || 0) === 0) {
      next.focus = null;
      next.focusPage = 0;
    } else if (!moveFocus(next, event === "NEXT_READING" ? 1 : -1, context)) return state;
  }
  else if (event === "FOCUS") {
    if (!next.focus) {
      next.focus = context.focusOrder?.[0] || DAILY_FOCUS_ORDER[0];
      next.focusPage = 0;
    }
  }
  else if (event === "CENTER") {
    if (!next.focus) {
      next.focus = context.focusOrder?.[0] || DAILY_FOCUS_ORDER[0];
      next.focusPage = 0;
    } else {
      const focusOrder = context.focusOrder || DAILY_FOCUS_ORDER;
      moveFocus(next, 1, context, next.focus === focusOrder[focusOrder.length - 1]);
    }
  }
  else if (event === "OVERVIEW") {
    next.focus = null;
    next.focusPage = 0;
  }
  else if (event === "OPEN_PRAYER") {
    next.focus = context.focusOrder?.[0] || DAILY_FOCUS_ORDER[0];
    next.focusPage = 0;
  }
  else if ((context.focusOrder || DAILY_FOCUS_ORDER).includes(event)) {
    next.focus = context.focusOrder?.[0] || DAILY_FOCUS_ORDER[0];
    next.focusPage = 0;
  }
  else if (event === "TODAY") return createState();
  return next;
}

export function controlModel(viewOrFocus) {
  const focus = typeof viewOrFocus === "string" ? viewOrFocus : viewOrFocus?.focus;
  if (focus) {
    const prayer = typeof viewOrFocus === "object" ? viewOrFocus.prayer : null;
    const timedOfficeSection = typeof viewOrFocus === "object"
      ? (
        viewOrFocus[viewOrFocus.service]
        || viewOrFocus.office
        || viewOrFocus.noonday
        || viewOrFocus.compline
      )?.sections?.[focus]
      : null;
    const scriptureBuilt = typeof viewOrFocus === "object" ? viewOrFocus.scripturePages?.[focus] : null;
    const paginatedSection = focus === "PRAYER"
      ? prayer
      : timedOfficeSection || (scriptureBuilt ? {
        page: Math.min(viewOrFocus.focusPage || 0, Math.max(0, (scriptureBuilt.pages?.length || 1) - 1)),
        pages: scriptureBuilt.pages || [""],
      } : null);
    const focusOrder = typeof viewOrFocus === "object" && Array.isArray(viewOrFocus.focusOrder)
      ? viewOrFocus.focusOrder
      : DAILY_FOCUS_ORDER;
    const currentPage = paginatedSection?.page || 0;
    const pageCount = paginatedSection?.pages?.length || 1;
    const firstFocus = focus === focusOrder[0] && currentPage === 0;
    const lastFocus = focus === focusOrder[focusOrder.length - 1] && currentPage === pageCount - 1;
    const previousLabel = firstFocus && focus === "PRAYER"
      ? "Overview"
      : firstFocus ? "start of focus" : currentPage > 0 ? "previous page" : "previous reading";
    const nextLabel = lastFocus ? "exit focus" : currentPage < pageCount - 1 ? "next page" : "next reading";
    const centerLabel = lastFocus ? "Overview" : nextLabel;
    return [
      { event: "PREV_READING", key: "←", label: previousLabel },
      { event: "CENTER", key: "↵", label: centerLabel },
      { event: "NEXT_READING", key: "→", label: nextLabel },
    ];
  }
  const todayRelation = typeof viewOrFocus === "object" ? viewOrFocus?.todayRelation || "today" : "today";
  const centerControl = todayRelation !== "today"
    ? { event: "TODAY", key: "↵", label: "Today" }
    : { event: "FOCUS", key: "↵", label: "Focus" };
  return [
    { event: "PREV_DAY", key: "←", label: "previous day" },
    centerControl,
    { event: "NEXT_DAY", key: "→", label: "next day" },
  ];
}

export function swipeEvent(startX, endX, startY = 0, endY = 0, minimumDistance = 48) {
  const horizontalDistance = endX - startX;
  const verticalDistance = endY - startY;
  if (Math.abs(horizontalDistance) < minimumDistance || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return null;
  return horizontalDistance < 0 ? "NEXT_DAY" : "PREV_DAY";
}

export function focusSwipeEvent(focus, swipe) {
  if (!focus || !swipe) return swipe;
  if (swipe === "NEXT_DAY") return "NEXT_READING";
  if (swipe === "PREV_DAY") return "PREV_READING";
  return swipe;
}

export function keyboardEvent(focus, key, doublePress = false) {
  if (key === "ArrowLeft") return focus ? "PREV_READING" : "PREV_DAY";
  if (key === "ArrowRight") return focus ? "NEXT_READING" : "NEXT_DAY";
  if (key === "Enter") return focus ? "CENTER" : "FOCUS";
  if (key === "ArrowUp") return focus ? null : doublePress ? "TODAY" : "OVERVIEW";
  if (key === "ArrowDown") return doublePress && focus ? "OPEN_PRAYER" : "FOCUS";
  return null;
}

export function screenTapEvent(focus, clientX, screenLeft, screenWidth, edgeRatio = 0.25) {
  if (!Number.isFinite(screenWidth) || screenWidth <= 0) return null;
  if (!focus) return "FOCUS";
  const position = (clientX - screenLeft) / screenWidth;
  if (position <= edgeRatio) return "PREV_READING";
  if (position >= 1 - edgeRatio) return "NEXT_READING";
  return "CENTER";
}

export function screenClickEvent(focus, clientX, screenLeft, screenWidth, { detail = 1, fromPointer = true, reading = false } = {}) {
  if (!fromPointer && detail === 0) {
    if (!reading) return null;
    return focus ? "CENTER" : "FOCUS";
  }
  return screenTapEvent(focus, clientX, screenLeft, screenWidth);
}

export function screenClickDecision(
  { focus, clientX, screenLeft, screenWidth },
  { suppressed = false, link = false, controlEvent = null, detail = 1, fromPointer = true, reading = false } = {},
) {
  if (suppressed) return { action: null, preventDefault: link };
  if (link) return { action: null, preventDefault: false };
  if (controlEvent) return { action: controlEvent, preventDefault: false };
  return {
    action: screenClickEvent(focus, clientX, screenLeft, screenWidth, { detail, fromPointer, reading }),
    preventDefault: false,
  };
}

export function prayerAvailableHeight({
  focusHeight,
  paddingTop,
  paddingBottom,
  labelHeight,
  textMarginTop,
  feastLinkHeight = 0,
  feastLinkMarginTop = 0,
  feastLinkMarginBottom = 0,
}) {
  return focusHeight - paddingTop - paddingBottom - labelHeight - textMarginTop
    - feastLinkHeight - feastLinkMarginTop - feastLinkMarginBottom;
}

export function timedOfficeAvailableHeight({
  focusBottom,
  paddingBottom,
  textTop,
  reservedFooterHeight = 0,
}) {
  return focusBottom - paddingBottom - textTop
    - reservedFooterHeight;
}

export function dateWithOffset(isoDate, offset) {
  const date = new Date(isoDate + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function stateForDate(today, targetDate) {
  const dayMilliseconds = 24 * 60 * 60 * 1000;
  const todayTime = Date.parse(`${today}T12:00:00Z`);
  const targetTime = Date.parse(`${targetDate}T12:00:00Z`);
  return { ...createState(), offset: Math.round((targetTime - todayTime) / dayMilliseconds) };
}

export function liturgicalSeason(label) {
  if (/Advent/i.test(label)) return "Advent";
  if (/Christmas/i.test(label)) return "Christmas";
  if (/Epiphany/i.test(label)) return "Epiphany";
  if (/Holy Week/i.test(label)) return "Holy Week";
  if (/Ash Wednesday|Lent/i.test(label)) return "Lent";
  if (/Easter/i.test(label)) return "Easter";
  if (/Day of Pentecost/i.test(label)) return "Pentecost";
  if (/Trinity|Proper/i.test(label)) return "After Pentecost";
  return label;
}

function seasonalTitleForDay(day) {
  const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
  if (day.label === "Ash Wednesday and Following" && weekday === 3) return "Ash Wednesday";
  if (day.label === "Holy Week") {
    return ["Palm Sunday", null, null, null, "Maundy Thursday", "Good Friday", "Holy Saturday"][weekday];
  }
  if (day.label === "Easter Week" && weekday === 0) return "Easter Day";
  if (day.label === "Week of 6 Easter" && weekday === 4) return "Ascension Day";
  if (day.label === "The Day of Pentecost" && weekday === 0) return "Day of Pentecost";
  if (day.label === "Trinity Sunday" && weekday === 0) return "Trinity Sunday";
  if (day.label === "Week of 1 Advent" && weekday === 0) return "First Sunday of Advent";
  return null;
}

export function upcomingFeastDays(bundle, today) {
  return [...bundle.dates.values()]
    .filter(day => day.date >= today)
    .map(day => {
      const churchFeast = day.feast && day.occasion_type === "church";
      const title = churchFeast ? day.feast : seasonalTitleForDay(day);
      if (!title) return null;
      return {
        date: day.date,
        title,
        season: liturgicalSeason(day.label),
        kind: churchFeast ? "Feast day" : "Seasonal day",
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function saintNameForFeast(feast) {
  if (feast === "All Saints' Day") return "All Saints";
  if (feast === "The Holy Innocents") return "the Holy Innocents";
  const saintIndex = String(feast || "").indexOf("St.");
  return saintIndex === -1 ? null : feast.slice(saintIndex);
}

const NOONDAY_PSALMS = [
  {
    citation: "Psalm 119:105–112",
    subtitle: "Lucerna pedibus meis",
    text: [
      "105  Your word is a lantern to my feet *\nand a light upon my path.",
      "106  I have sworn and am determined *\nto keep your righteous judgments.",
      "107  I am deeply troubled; *\npreserve my life, O LORD, according to your word.",
      "108  Accept, O LORD, the willing tribute of my lips, *\nand teach me your judgments.",
      "109  My life is always in my hand, *\nyet I do not forget your law.",
      "110  The wicked have set a trap for me, *\nbut I have not strayed from your commandments.",
      "111  Your decrees are my inheritance for ever; *\ntruly, they are the joy of my heart.",
      "112  I have applied my heart to fulfill your statutes *\nfor ever and to the end.",
    ].join("\n\n"),
  },
  {
    citation: "Psalm 121",
    subtitle: "Levavi oculos",
    text: [
      "1  I lift up my eyes to the hills; *\nfrom where is my help to come?",
      "2  My help comes from the LORD, *\nthe maker of heaven and earth.",
      "3  He will not let your foot be moved *\nand he who watches over you will not fall asleep.",
      "4  Behold, he who keeps watch over Israel *\nshall neither slumber nor sleep;",
      "5  The LORD himself watches over you; *\nthe LORD is your shade at your right hand,",
      "6  So that the sun shall not strike you by day, *\nnor the moon by night.",
      "7  The LORD shall preserve you from all evil; *\nit is he who shall keep you safe.",
      "8  The LORD shall watch over your going out and your coming in, *\nfrom this time forth for evermore.",
    ].join("\n\n"),
  },
  {
    citation: "Psalm 126",
    subtitle: "In convertendo",
    text: [
      "1  When the LORD restored the fortunes of Zion, *\nthen were we like those who dream.",
      "2  Then was our mouth filled with laughter, *\nand our tongue with shouts of joy.",
      "3  Then they said among the nations, *\n\"The LORD has done great things for them.\"",
      "4  The LORD has done great things for us, *\nand we are glad indeed.",
      "5  Restore our fortunes, O LORD, *\nlike the watercourses of the Negev.",
      "6  Those who sowed with tears *\nwill reap with songs of joy.",
      "7  Those who go out weeping, carrying the seed, *\nwill come again with joy, shouldering their sheaves.",
    ].join("\n\n"),
  },
].map(psalm => ({ ...psalm, pages: [psalm.text] }));

const TIMED_OFFICE_GLORIA = "Glory to the Father, and to the Son, and to the Holy Spirit: as it was in the beginning, is now, and will be for ever.\n\nAmen.";
const TIMED_OFFICE_OPENING_VERSICLE = "O God, make speed to save us. *\nO Lord, make haste to help us.";
const TIMED_OFFICE_KYRIE = "Lord, have mercy. *\nChrist, have mercy.\n\nLord, have mercy.";
const TIMED_OFFICE_LORDS_PRAYER = "Our Father in heaven, hallowed be your Name, your kingdom come, your will be done, on earth as in heaven. Give us today our daily bread. Forgive us our sins as we forgive those who sin against us. Save us from the time of trial, and deliver us from evil.";

function timedOfficeGloria(withAlleluia = false) {
  return `${TIMED_OFFICE_GLORIA}${withAlleluia ? "\nAlleluia." : ""}`;
}

const NOONDAY_CLOSING_PRAYERS = [
  "Heavenly Father, send your Holy Spirit into our hearts, to direct and rule us according to your will, to comfort us in all our afflictions, to defend us from all error, and to lead us into all truth; through Jesus Christ our Lord. Amen.",
  "Blessed Savior, at this hour you hung upon the cross, stretching out your loving arms: Grant that all the peoples of the earth may look to you and be saved; for your tender mercies’ sake. Amen.",
  "Almighty Savior, who at noonday called your servant Saint Paul to be an apostle to the Gentiles: We pray you to illumine the world with the radiance of your glory, that all nations may come and worship you; for you live and reign for ever and ever. Amen.",
  "Lord Jesus Christ, you said to your apostles, \"Peace I give to you; my peace I leave with you:\" Regard not our sins, but the faith of your Church, and give to us the peace and unity of that heavenly city, where with the Father and the Holy Spirit you live and reign, now and for ever. Amen.",
];
function dailyRotationIndex(date, count) {
  const epochDay = Math.floor(Date.parse(`${date}T12:00:00Z`) / (24 * 60 * 60 * 1000));
  return ((epochDay % count) + count) % count;
}

function noondayPsalm(date) {
  return NOONDAY_PSALMS[dailyRotationIndex(date, NOONDAY_PSALMS.length)];
}

function noondayClosingPrayer(date) {
  return NOONDAY_CLOSING_PRAYERS[dailyRotationIndex(date, NOONDAY_CLOSING_PRAYERS.length)];
}

function noondayOffice(day) {
  const inLent = /ash-wednesday|lent|holy-week/i.test(`${day.label} ${day.key}`);
  const openingPageGroups = [
    { text: TIMED_OFFICE_OPENING_VERSICLE },
    { text: timedOfficeGloria(!inLent), standalone: true },
  ];
  const openingPages = openingPageGroups.map(group => group.text);
  const openingText = openingPages.join("\n\n");
  const psalm = noondayPsalm(day.date);
  const kyriePageGroups = [
    { text: "[Moment of prayer.]" },
    { text: TIMED_OFFICE_KYRIE, standalone: true },
  ];
  const kyriePages = kyriePageGroups.map(group => group.text);
  const kyrie = kyriePages.join("\n\n");
  const closingPrayerText = noondayClosingPrayer(day.date);

  return {
    sections: {
      NOONDAY_OPENING: {
        label: "Noonday Prayer",
        text: openingText,
        pageGroups: openingPageGroups,
        pages: openingPages,
        page: 0,
      },
      NOONDAY_PSALM: {
        label: "Noonday Psalm",
        ...psalm,
        summary: psalm.citation.replace("Psalm ", ""),
        page: 0,
      },
      NOONDAY_KYRIE: {
        label: "Kyrie",
        text: kyrie,
        pageGroups: kyriePageGroups,
        pages: kyriePages,
        page: 0,
      },
      NOONDAY_LORDS_PRAYER: {
        label: LORDS_PRAYER_HEADING,
        text: TIMED_OFFICE_LORDS_PRAYER,
        pages: [TIMED_OFFICE_LORDS_PRAYER],
        preservePages: true,
        page: 0,
      },
      NOONDAY_CLOSING_PRAYER: {
        label: "Closing Prayer",
        text: closingPrayerText,
        pages: [closingPrayerText],
        page: 0,
      },
    },
  };
}

const COMPLINE_PSALMS = [
  {
    citation: "Psalm 4",
    subtitle: "Cum invocarem",
    text: [
      "1  Answer me when I call, O God, defender of my cause; *\nyou set me free when I am hard-pressed; have mercy on me and hear my prayer.",
      "2  You mortals, how long will you dishonor my glory; *\nhow long will you worship dumb idols and run after false gods?",
      "3  Know that the LORD does wonders for the faithful; *\nwhen I call upon the LORD, he will hear me.",
      "4  Tremble, then, and do not sin; *\nspeak to your heart in silence upon your bed.",
      "5  Offer the appointed sacrifices *\nand put your trust in the LORD.",
      "6  Many are saying, “Oh, that we might see better times!” *\nLift up the light of your countenance upon us, O LORD.",
      "7  You have put gladness in my heart, *\nmore than when grain and wine and oil increase.",
      "8  I lie down in peace; at once I fall asleep; *\nfor only you, LORD, make me dwell in safety.",
    ].join("\n\n"),
  },
  {
    citation: "Psalm 31:1–5",
    subtitle: "In te, Domine, speravi",
    text: [
      "1  In you, O LORD, have I taken refuge; let me never be put to shame: *\ndeliver me in your righteousness.",
      "2  Incline your ear to me; *\nmake haste to deliver me.",
      "3  Be my strong rock, a castle to keep me safe, for you are my crag and my stronghold; *\nfor the sake of your Name, lead me and guide me.",
      "4  Take me out of the net that they have secretly set for me, *\nfor you are my tower of strength.",
      "5  Into your hands I commend my spirit, *\nfor you have redeemed me, O LORD, O God of truth.",
    ].join("\n\n"),
  },
  {
    citation: "Psalm 91",
    subtitle: "Qui habitat",
    text: [
      "1  He who dwells in the shelter of the Most High *\nabides under the shadow of the Almighty.",
      "2  He shall say to the LORD, “You are my refuge and my stronghold, *\nmy God in whom I put my trust.”",
      "3  He shall deliver you from the snare of the hunter *\nand from the deadly pestilence.",
      "4  He shall cover you with his pinions, and you shall find refuge under his wings; *\nhis faithfulness shall be a shield and buckler.",
      "5  You shall not be afraid of any terror by night, *\nnor of the arrow that flies by day;",
      "6  Of the plague that stalks in the darkness, *\nnor of the sickness that lays waste at mid-day.",
      "7  A thousand shall fall at your side and ten thousand at your right hand, *\nbut it shall not come near you.",
      "8  Your eyes have only to behold *\nto see the reward of the wicked.",
      "9  Because you have made the LORD your refuge, *\nand the Most High your habitation,",
      "10  There shall no evil happen to you, *\nneither shall any plague come near your dwelling.",
      "11  For he shall give his angels charge over you, *\nto keep you in all your ways.",
      "12  They shall bear you in their hands, *\nlest you dash your foot against a stone.",
      "13  You shall tread upon the lion and the adder; *\nyou shall trample the young lion and the serpent under your feet.",
      "14  Because he is bound to me in love, therefore will I deliver him; *\nI will protect him, because he knows my Name.",
      "15  He shall call upon me, and I will answer him; *\nI am with him in trouble;\nI will rescue him and bring him to honor.",
      "16  With long life will I satisfy him, *\nand show him my salvation.",
    ].join("\n\n"),
  },
  {
    citation: "Psalm 134",
    subtitle: "Ecce nunc",
    text: [
      "1  Behold now, bless the LORD, all you servants of the LORD, *\nyou that stand by night in the house of the LORD.",
      "2  Lift up your hands in the holy place and bless the LORD; *\nthe LORD who made heaven and earth bless you out of Zion.",
    ].join("\n\n"),
  },
];

const COMPLINE_READINGS = [
  {
    citation: "Jeremiah 14:9, 22",
    text: "Lord, you are in the midst of us, and we are called by your Name: Do not forsake us, O Lord our God.",
  },
  {
    citation: "Matthew 11:28–30",
    text: "Come to me, all who labor and are heavy-laden, and I will give you rest. Take my yoke upon you, and learn from me; for I am gentle and lowly in heart, and you will find rest for your souls. For my yoke is easy, and my burden is light.",
  },
  {
    citation: "Hebrews 13:20–21",
    text: "May the God of peace, who brought again from the dead our Lord Jesus, the great shepherd of the sheep, by the blood of the eternal covenant, equip you with everything good that you may do his will, working in you that which is pleasing in his sight; through Jesus Christ, to whom be glory for ever and ever.",
  },
  {
    citation: "1 Peter 5:8–9a",
    text: "Be sober, be watchful. Your adversary the devil prowls around like a roaring lion, seeking someone to devour. Resist him, firm in your faith.",
  },
];

const COMPLINE_COLLECTS = [
  "Be our light in the darkness, O Lord, and in your great mercy defend us from all perils and dangers of this night; for the love of your only Son, our Savior Jesus Christ. Amen.",
  "Be present, O merciful God, and protect us through the hours of this night, so that we who are wearied by the changes and chances of this life may rest in your eternal changelessness; through Jesus Christ our Lord. Amen.",
  "Look down, O Lord, from your heavenly throne, and illumine this night with your celestial brightness; that by night as by day your people may glorify your holy Name; through Jesus Christ our Lord. Amen.",
  "Visit this place, O Lord, and drive far from it all snares of the enemy; let your holy angels dwell with us to preserve us in peace; and let your blessing be upon us always; through Jesus Christ our Lord. Amen.",
];
const COMPLINE_SATURDAY_COLLECT = "We give you thanks, O God, for revealing your Son Jesus Christ to us by the light of his resurrection: Grant that as we sing your glory at the close of this day, our joy may abound in the morning as we celebrate the Paschal mystery; through Jesus Christ our Lord. Amen.";

function complineOffice(day) {
  const inLent = /ash-wednesday|lent|holy-week/i.test(`${day.label} ${day.key}`);
  const inEaster = /easter/i.test(`${day.label} ${day.key}`);
  const opening = [
    "The Lord Almighty grant us a peaceful night and a perfect end. Amen.",
    "Our help is in the Name of the Lord. *\nThe maker of heaven and earth.",
  ].join("\n\n");
  const confessionBeforeGloria = [
    "Let us confess our sins to God.",
    "[Silence may be kept.]",
    "Almighty God, our heavenly Father: We have sinned against you, through our own fault, in thought, and word, and deed, and in what we have left undone. For the sake of your Son our Lord Jesus Christ, forgive us all our offenses; and grant that we may serve you in newness of life, to the glory of your Name. Amen.",
    "May the Almighty God grant us forgiveness of all our sins, and the grace and comfort of the Holy Spirit. Amen.",
    TIMED_OFFICE_OPENING_VERSICLE,
  ].join("\n\n");
  const confessionPageGroups = [
    { text: confessionBeforeGloria },
    { text: timedOfficeGloria(!inLent), standalone: true },
  ];
  const confession = confessionPageGroups.map(group => group.text).join("\n\n");
  const psalm = COMPLINE_PSALMS[dailyRotationIndex(day.date, COMPLINE_PSALMS.length)];
  const reading = COMPLINE_READINGS[dailyRotationIndex(day.date, COMPLINE_READINGS.length)];
  const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
  const collect = weekday === 6
    ? COMPLINE_SATURDAY_COLLECT
    : COMPLINE_COLLECTS[dailyRotationIndex(day.date, COMPLINE_COLLECTS.length)];
  const prayerPageGroups = [
    {
      text: [
        "Into your hands, O Lord, I commend my spirit. *\nFor you have redeemed me, O Lord, O God of truth.",
        "Keep us, O Lord, as the apple of your eye. *\nHide us under the shadow of your wings.",
      ].join("\n\n"),
    },
    { text: TIMED_OFFICE_KYRIE, standalone: true },
    { text: TIMED_OFFICE_LORDS_PRAYER, standalone: true },
    {
      text: [
        "Lord, hear our prayer. *\nAnd let our cry come to you.",
        "Let us pray.",
      ].join("\n\n"),
    },
  ];
  const prayers = prayerPageGroups.map(group => group.text).join("\n\n");
  const antiphon = `Guide us waking, O Lord, and guard us sleeping; that awake we may watch with Christ, and asleep we may rest in peace.${inEaster ? " Alleluia, alleluia, alleluia." : ""}`;
  const conclusionPageGroups = [
    {
      text: [
        antiphon,
        "Lord, you now have set your servant free *\nto go in peace as you have promised;\n\nFor these eyes of mine have seen the Savior, *\nwhom you have prepared for all the world to see:\n\nA Light to enlighten the nations, *\nand the glory of your people Israel.",
      ].join("\n\n"),
    },
    { text: TIMED_OFFICE_GLORIA, standalone: true },
    {
      text: [
        antiphon,
        "Let us bless the Lord. *\nThanks be to God.",
        "The almighty and merciful Lord, Father, Son, and Holy Spirit, bless us and keep us. Amen.",
      ].join("\n\n"),
    },
  ];
  const conclusion = conclusionPageGroups.map(group => group.text).join("\n\n");
  const section = (label, text, details = {}) => ({
    label,
    text,
    pages: details.closingPage
      ? [text, details.closingPage]
      : details.pageGroups?.map(group => group.text) || [text],
    page: 0,
    ...details,
  });

  return {
    sections: {
      COMPLINE_OPENING: section("Compline", opening),
      COMPLINE_CONFESSION: section("Confession", confession, {
        pageGroups: confessionPageGroups,
      }),
      COMPLINE_PSALM: section("Psalm", psalm.text, {
        ...psalm,
        summary: psalm.citation.replace("Psalm ", ""),
        closingPage: TIMED_OFFICE_GLORIA,
      }),
      COMPLINE_READING: section("Reading", reading.text, {
        ...reading,
        summary: reading.citation,
        response: "Thanks be to God.",
      }),
      COMPLINE_PRAYERS: section("Prayers", prayers, {
        pageGroups: prayerPageGroups,
      }),
      COMPLINE_COLLECT: section("Collect", collect),
      COMPLINE_CONCLUSION: section("Song of Simeon", conclusion, {
        pageGroups: conclusionPageGroups,
      }),
    },
  };
}

export function model(bundle, state, today, collects = null, options = {}) {
  const date = dateWithOffset(today, state.offset);
  const todayRelation = state.offset < 0 ? "past" : state.offset > 0 ? "future" : "today";
  const day = bundle.dates.get(date);
  if (!day) return { date, todayRelation, error: "DATE OUTSIDE INSTALLED PACK" };
  if (["morning", "evening", "noonday", "compline"].includes(options.service)) {
    const service = options.service;
    const fullOffice = service === "morning" || service === "evening";
    let document = options.officeDocument;
    if (!fullOffice) {
      const legacyOffice = service === "compline" ? complineOffice(day) : noondayOffice(day);
      const legacyFocusOrder = service === "compline" ? COMPLINE_FOCUS_ORDER : NOONDAY_FOCUS_ORDER;
      document = adaptLegacyTimedOffice({
        service,
        date,
        title: service === "compline" ? "Compline" : "Noonday Prayer",
        source: {
          id: service,
          locator: service === "compline"
            ? "https://www.bcponline.org/DailyOffice/compline.html"
            : "https://www.bcponline.org/DailyOffice/noonday.html",
        },
        focusOrder: legacyFocusOrder,
        sections: legacyOffice.sections,
      });
    }
    if (!document) return { date, todayRelation, service, error: "FULL DAILY OFFICE UNAVAILABLE" };
    const office = { sections: officeDocumentToViewSections(document) };
    const focusedSection = office.sections[state.focus];
    if (focusedSection?.pages) {
      const measuredPages = (
        fullOffice
          ? options.officePages
          : service === "compline"
            ? options.complinePages
            : options.noondayPages
      )?.[state.focus];
      if (Array.isArray(measuredPages) && measuredPages.length > 0) focusedSection.pages = measuredPages;
      focusedSection.page = Math.min(state.focusPage || 0, focusedSection.pages.length - 1);
    }
    return {
      date,
      todayRelation,
      label: day.label,
      year: `Year ${day.lectionary_year[0].toUpperCase()}${day.lectionary_year.slice(1)}`,
      feast: day.feast,
      occasionType: day.occasion_type || null,
      focus: state.focus,
      focusOrder: document.sections.map(section => section.key || section.id),
      service,
      officeDocument: document,
      noondayPreviewRelation: options.noondayPreviewRelation || null,
      complinePreviewRelation: options.complinePreviewRelation || null,
      office,
      [service]: office,
    };
  }
  const reading = bundle.readings.get(day.key);
  const prayerEntry = resolvePrayer(collects, day);
  const prayerPages = prayerEntry
    ? (Array.isArray(options.prayerPages) && options.prayerPages.length > 0 ? options.prayerPages : paginatePrayer(prayerEntry.text))
    : [];
  const prayerPage = Math.min(state.focusPage || 0, Math.max(0, prayerPages.length - 1));
  const prayer = prayerEntry ? { ...prayerEntry, pages: prayerPages, page: prayerPage, saintName: saintNameForFeast(day.feast) } : null;
  const dayView = {
    date,
    todayRelation,
    label: day.label,
    year: `Year ${day.lectionary_year[0].toUpperCase()}${day.lectionary_year.slice(1)}`,
    feast: day.feast,
    occasionType: day.occasion_type || null,
    focus: state.focus,
    focusPage: state.focusPage || 0,
    focusOrder: DAILY_FOCUS_ORDER,
    service: "daily",
    prayer,
  };
  if (!reading) return { ...dayView, error: "READINGS NOT IN INSTALLED PACK" };
  const morningPsalms = reading.psalms_morning.join(", ");
  const eveningPsalms = reading.psalms_evening.join(", ");
  const lessons = lessonValues(reading.lessons);
  return {
    ...dayView,
    psalms: { morning: morningPsalms, evening: eveningPsalms },
    values: { PS: `${morningPsalms}\n${eveningPsalms}`, OT: lessons.OT, NT: lessons.NT, GS: lessons.GS },
  };
}

export function focusPageCounts(view, measuredPages = {}) {
  const pageCounts = { PRAYER: view.prayer?.pages.length || 1 };
  for (const key of ["PS", "OT", "NT", "GS"]) {
    if (measuredPages[key]?.length) pageCounts[key] = measuredPages[key].length;
    else {
      const built = view.scripturePages?.[key];
      if (built?.pages?.length) pageCounts[key] = built.pages.length;
    }
  }
  const timedOffice = view[view.service] || view.office || view.noonday || view.compline;
  for (const [focus, section] of Object.entries(timedOffice?.sections || {})) {
    if (measuredPages[focus]?.length) pageCounts[focus] = measuredPages[focus].length;
    else if (section.pages?.length) pageCounts[focus] = section.pages.length;
  }
  return pageCounts;
}

export function remapFocusPageAfterLayout(page, previousPages, nextPages, closingPage = null) {
  const lastPage = Math.max(0, nextPages.length - 1);
  const previousPage = previousPages?.[page];
  const matchingPage = previousPage ? nextPages.indexOf(previousPage) : -1;
  if (matchingPage >= 0) return matchingPage;
  const wasOnClosingPage = Boolean(closingPage && previousPages?.[page] === closingPage);
  return wasOnClosingPage ? lastPage : Math.min(page, lastPage);
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function prayerLineationHtml(text) {
  return escapeHtml(text)
    .replaceAll("\n", "<br> ")
    .replace(/ Amen\.$/, '<span class="prayer-amen">Amen.</span>');
}

export function numberedLiturgicalTextHtml(text) {
  const verses = String(text || "").trim().split(/\n{2,}/).filter(Boolean);
  return `<span class="noonday-psalm-verses">${verses.map(verse => {
    // Scripture / psalm chapter headings: "Psalm 19", "Hebrews 11", "1 Corinthians 13", optional · subtitle
    const heading = verse.match(
      /^((?:[1-3]\s+)?[A-Za-z][A-Za-z']*(?:\s+[A-Za-z][A-Za-z']*)*)\s+(\d+)(?:\s+·\s+(.+))?$/,
    );
    if (heading) {
      const subtitle = heading[3]
        ? `<span class="timed-office-psalm-subtitle">${escapeHtml(heading[3])}</span>`
        : "";
      return `<span class="timed-office-psalm-heading"><span>${escapeHtml(`${heading[1]} ${heading[2]}`)}</span>${subtitle}</span>`;
    }
    const match = numberedVerseParts(verse);
    const number = match?.[1] || "";
    const { call, response } = callResponseParts(match?.[2] || verse);
    return `<span class="noonday-psalm-verse"><span class="noonday-psalm-number">${escapeHtml(number)}</span><span class="noonday-call-response"><span class="noonday-psalm-call">${escapeHtml(call)}</span><strong class="noonday-psalm-response">${escapeHtml(response)}</strong></span></span>`;
  }).join("")}</span>`;
}

export const noondayPsalmHtml = numberedLiturgicalTextHtml;

export function usesNumberedVerseLayout(section, key) {
  return /_PSALMS?$/.test(key) || Boolean(section.numberedVerses);
}

function normalizedLiturgicalText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function timedOfficeAmenParts(value) {
  const match = String(value || "").trim().match(
    /^([\s\S]*?)(?:\s+|^)(Amen\.?)(?:\s+(Alleluia(?:,\s*alleluia)*\.?))?$/i,
  );
  if (!match) return null;
  return {
    lead: normalizedLiturgicalText(match[1]),
    amen: match[2],
    continuation: normalizedLiturgicalText(match[3]),
  };
}

function timedOfficeAmenParagraphHtml(parts, emphasized = false) {
  const tag = emphasized ? "strong" : "span";
  const continuation = parts.continuation
    ? `<br class="timed-office-soft-break">${escapeHtml(parts.continuation)}`
    : "";
  return `<${tag} class="noonday-prose-block timed-office-amen-paragraph"><span class="timed-office-amen">${escapeHtml(parts.amen)}</span>${continuation}</${tag}>`;
}

function timedOfficeProseHtml(value) {
  const amen = timedOfficeAmenParts(value);
  if (!amen) {
    const text = normalizedLiturgicalText(value);
    const leaderCue = /^Let us pray\.$/i.test(text) ? " timed-office-leader-cue" : "";
    return `<span class="noonday-prose-block${leaderCue}">${escapeHtml(text)}</span>`;
  }
  const lead = amen.lead ? `<span class="noonday-prose-block">${escapeHtml(amen.lead)}</span>` : "";
  return `${lead}${timedOfficeAmenParagraphHtml(amen)}`;
}

function callResponseParts(value) {
  const text = String(value || "");
  const explicitResponse = text.startsWith(RESPONSE_FRAGMENT_MARKER);
  const cleanText = text.replaceAll(RESPONSE_FRAGMENT_MARKER, "");
  if (explicitResponse) return { call: "", response: normalizedLiturgicalText(cleanText) };
  const marker = cleanText.indexOf("*");
  if (marker < 0) return { call: normalizedLiturgicalText(cleanText), response: "" };
  return {
    call: normalizedLiturgicalText(cleanText.slice(0, marker)),
    response: normalizedLiturgicalText(cleanText.slice(marker + 1)),
  };
}

export function timedOfficeTextHtml(text) {
  const blocks = String(text || "").trim().split(/\n{2,}/).filter(Boolean);
  return `<span class="noonday-liturgical-blocks">${blocks.map(block => {
    const asideMatch = block.match(/^\s*\[([^\[\]]+)\]\s*$/);
    if (asideMatch) {
      return `<span class="timed-office-aside">${escapeHtml(normalizedLiturgicalText(asideMatch[1]))}</span>`;
    }
    const { call, response } = callResponseParts(block);
    if (!response) return timedOfficeProseHtml(block);
    const responseAmen = timedOfficeAmenParts(response);
    const responseText = responseAmen ? responseAmen.lead : response;
    const responseLine = responseText ? `<strong class="noonday-psalm-response">${escapeHtml(responseText)}</strong>` : "";
    const callResponse = `<span class="noonday-call-response"><span class="noonday-psalm-call">${escapeHtml(call)}</span>${responseLine}</span>`;
    return `${callResponse}${responseAmen ? timedOfficeAmenParagraphHtml(responseAmen, true) : ""}`;
  }).join("")}</span>`;
}

function citationHtml(view, key, className) {
  if (key !== "PS" || !view.psalms) return `<span class="${className}">${escapeHtml(view.values[key])}</span>`;
  return `<span class="${className} psalm-cite"><span class="psalm-office"><span class="office-icon" aria-label="Morning">☀</span><span>${escapeHtml(view.psalms.morning)}</span></span><span class="psalm-office"><span class="office-icon" aria-label="Evening">☾</span><span>${escapeHtml(view.psalms.evening)}</span></span></span>`;
}

function readingContentHtml(view, key, className, psalmPresentation) {
  const built = view.scripturePages?.[key];
  const showingScriptureBody = Boolean(built && view.focus === key);

  if (key === "PS" && view.psalms && psalmPresentation.byTime && !showingScriptureBody) {
    const label = PSALM_OFFICE_LABELS[psalmPresentation.office];
    const citation = view.psalms[psalmPresentation.office] || `No ${label} Psalms listed`;
    return `<span class="label">${label} Psalms</span><span class="${className} psalm-cite psalm-cite-single">${escapeHtml(citation)}</span>`;
  }

  if (showingScriptureBody) {
    const page = Math.min(view.focusPage || 0, built.pages.length - 1);
    const pageIndex = built.pages.length > 1 ? ` (${page + 1}/${built.pages.length})` : "";
    const citationText = built.citation || view.values[key] || "";
    const pageText = scripturePageBodyText(built, page);
    const body = built.unavailable
      ? `<span class="prayer-text scripture-unavailable-note">${escapeHtml(built.pages[page] || "")}</span>`
      : `<span class="prayer-text noonday-text timed-office-numbered-verses scripture-lesson-text">${numberedLiturgicalTextHtml(pageText)}</span>`;
    // Scripture Psalm body is always one office; label that office even when the
    // overview still groups morning and evening together.
    const sectionLabel = key === "PS"
      ? `${PSALM_OFFICE_LABELS[psalmPresentation.office]} Psalms`
      : READING_LABELS[key];
    // Multi-chapter / Psalm streams: page 1 uses the section label + full citation;
    // later pages use the active chapter title (Psalm 19, Hebrews 12, …).
    if (built.chapterHeadings) {
      if (page > 0) {
        const chapterTitle = built.pageHeadings?.[page] || citationText;
        return `<span class="label">${escapeHtml(chapterTitle)}${pageIndex}</span>${body}`;
      }
      const citation = citationText
        ? `<span class="focus-cite">${escapeHtml(citationText)}</span>`
        : "";
      return `<span class="label">${sectionLabel}${pageIndex}</span>${citation}${body}`;
    }
    if (page > 0) {
      return `<span class="label">${escapeHtml(citationText)}${pageIndex}</span>${body}`;
    }
    const citation = citationText
      ? `<span class="focus-cite">${escapeHtml(citationText)}</span>`
      : "";
    return `<span class="label">${sectionLabel}${pageIndex}</span>${citation}${body}`;
  }

  return `<span class="label">${READING_LABELS[key]}</span>${citationHtml(view, key, className)}`;
}

function prayerPageHtml(prayer) {
  const ellipsis = '<span class="continuation-ellipsis" aria-hidden="true">...</span>';
  const prefix = prayer.page > 0 ? ellipsis : "";
  const suffix = prayer.page < prayer.pages.length - 1 ? ellipsis : "";
  return `${prefix}${escapeHtml(prayer.pages[prayer.page])}${suffix}`;
}

function prayerHeading(prayer, includeArticle = false) {
  if (prayer.saintName) return `Prayer of ${prayer.saintName}`;
  return `${includeArticle ? "A " : ""}Prayer for ${prayer.title}`;
}

function feastAboutHtml(feast, occasionType, enabled) {
  if (!enabled || occasionType !== "church") return "";
  const wikipediaUrl = wikipediaUrlForFeast(feast);
  if (!wikipediaUrl) return "";
  return `<a class="feast-about-link" href="${wikipediaUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(`About ${feast} →`)}</a>`;
}

function compactYear(year) {
  if (year === "Year One") return "Y1";
  if (year === "Year Two") return "Y2";
  return year;
}

function isScriptureLesson(key, section) {
  return /_LESSON_\d+$/.test(key) && Boolean(section.citation);
}

function timedOfficeFocusHtml(section, key) {
  const pageIndex = section.pages?.length > 1 ? ` (${section.page + 1}/${section.pages.length})` : "";
  const isPsalm = /_PSALMS?$/.test(key);
  const hasNumberedVerses = usesNumberedVerseLayout(section, key);
  const isScriptureCitation = isScriptureLesson(key, section);
  const isContinuation = section.page > 0;
  const citation = section.citation && !key.endsWith("_PSALMS") && !section.chapterHeadings && !isContinuation
    ? `<span class="focus-cite${isPsalm ? " noonday-psalm-cite" : section.heading ? " timed-office-section-cite" : ""}">${escapeHtml(normalizedCitation(section.citation))}</span>`
    : "";
  const heading = section.heading && !isContinuation
    ? `<span class="timed-office-section-title">${escapeHtml(section.heading)}</span>`
    : "";
  const subtitle = section.subtitle && !isContinuation
    ? `<span class="noonday-subtitle${section.heading ? " timed-office-section-subtitle" : ""}">${escapeHtml(section.subtitle)}</span>`
    : "";
  const rawPageText = section.pages ? section.pages[section.page] : section.text;
  const pageText = isScriptureCitation && section.chapterHeadings
    ? scripturePageBodyText(section, section.page || 0)
    : rawPageText;
  const isClosingPage = Boolean(section.closingPage && section.page === section.pages.length - 1);
  const lastPage = !section.pages || section.page === section.pages.length - 1;
  const isGloriaPage = isClosingPage && /^Glory to the Father\b/i.test(String(rawPageText || "").trim());
  const isConclusionClosingPage = key.endsWith("_CONCLUSION") && lastPage;
  let textClass = "prayer-text noonday-text";
  if (key.endsWith("_OPENING")) textClass += " noonday-opening-text";
  else if (!hasNumberedVerses || isClosingPage) textClass += " noonday-prayer-text";
  if (section.numberedVerses && !isClosingPage) textClass += " timed-office-numbered-verses";
  if (isGloriaPage) textClass += " timed-office-gloria-text";
  if (isConclusionClosingPage) textClass += " timed-office-closing-text";
  const renderedPageText = isGloriaPage ? String(pageText || "").replace(/\s*\*\s*/g, " ") : pageText;
  const content = isScriptureCitation
    ? (section.scriptureUnavailable
      ? `<span class="prayer-text scripture-unavailable-note">${escapeHtml(rawPageText || "")}</span>`
      : section.numberedVerses
        ? `<span class="${textClass} scripture-lesson-text">${numberedLiturgicalTextHtml(renderedPageText)}</span>`
        : "")
    : `<span class="${textClass}">${hasNumberedVerses && !isClosingPage ? numberedLiturgicalTextHtml(renderedPageText) : timedOfficeTextHtml(renderedPageText)}</span>`;
  const scripturePresentation = scriptureCitationPresentation(section.footnote);
  const scriptureCitationPage = key.endsWith("_OPENING")
    ? scripturePresentation === "footnote" ? lastPage : !isContinuation
    : lastPage;
  const scriptureHeading = section.footnote && scriptureCitationPage && scripturePresentation === "heading"
    ? `<span class="focus-cite timed-office-scripture-heading">${escapeHtml(normalizedCitation(section.footnote))}</span>`
    : "";
  const scriptureFootnote = section.footnote && scriptureCitationPage && scripturePresentation === "footnote"
    ? `<span class="focus-cite timed-office-scripture-footnote">${escapeHtml(`– ${normalizedCitation(section.footnote)}`)}</span>`
    : "";
  const response = section.response && lastPage
    ? `<span class="noonday-response">${escapeHtml(section.response)}</span>`
    : "";
  const header = heading ? `${heading}${subtitle}${citation}` : `${citation}${subtitle}`;
  const chapterContinuation = isScriptureCitation && section.chapterHeadings && isContinuation
    ? (section.pageHeadings?.[section.page] || section.citation)
    : null;
  const pageLabel = isGloriaPage
    ? "Gloria"
    : chapterContinuation
      ? `${chapterContinuation}${pageIndex}`
      : (isScriptureCitation && isContinuation && section.citation)
        ? `${normalizedCitation(section.citation)}${pageIndex}`
        : `${section.label}${pageIndex}`;
  return `<button class="reading focus prayer-focus noonday-focus" data-reading="${key}" type="button"><span class="label">${escapeHtml(pageLabel)}</span>${header}${scriptureHeading}${content}${scriptureFootnote}${response}</button>`;
}

function timedOfficeOverviewHtml(sections, service = "noonday") {
  const fullOffice = ["morning", "evening"].includes(service);
  const serviceClass = service === "compline"
    ? " compline-grid"
    : fullOffice
      ? " full-office-grid"
      : "";
  return `<div class="grid noonday-grid${serviceClass}">${Object.entries(sections).map(([key, section]) => {
    const lesson = fullOffice && isScriptureLesson(key, section);
    const lessonCitation = lesson ? normalizedCitation(section.citation) : "";
    const label = lesson ? READING_LABELS[scriptureKeyForNormalizedCitation(lessonCitation)] : section.label;
    const summaryText = fullOffice ? "" : lesson ? lessonCitation : section.summary;
    const summary = summaryText ? `<span class="cite">${escapeHtml(summaryText)}</span>` : "";
    return `<button class="reading" data-reading="${key}" data-event="FOCUS" type="button"><span class="label">${escapeHtml(label)}</span>${summary}</button>`;
  }).join("")}</div>`;
}

function readerLeadHtml(view, serviceLabel, occasionType) {
  if (view.focus) {
    const backLabel = view.focus === "PRAYER" && (view.prayer?.page || 0) === 0
      ? "Return to overview"
      : "Previous page or reading";
    return `<div class="focus-toolbar" aria-label="Focus navigation"><button class="focus-back" data-event="PREV_READING" type="button" aria-label="${backLabel}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><button class="focus-service-label" data-event="OVERVIEW" type="button" aria-label="Return to overview">${escapeHtml(serviceLabel)}</button><button class="focus-next" data-event="NEXT_READING" type="button" aria-label="Next page or reading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div>`;
  }

  const date = new Date(`${view.date}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
  const mediumDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  const occasionTypeAttribute = occasionType ? ` data-occasion-type="${occasionType}"` : "";
  const feastBanner = view.feast ? `<span class="feast-banner"${occasionTypeAttribute}>${escapeHtml(view.feast)}</span>` : "";
  const previewRelation = view.todayRelation === "today"
    ? view.complinePreviewRelation || view.noondayPreviewRelation
    : null;
  const previewTarget = view.complinePreviewRelation ? "Compline" : "noon";
  const meta = [view.label, compactYear(view.year)].filter(Boolean).join(" · ");
  const beforeToday = view.todayRelation === "past";
  const afterToday = view.todayRelation === "future";
  let relationLabel = "";
  if (previewRelation === "past") relationLabel = ` Today's ${previewTarget} is in the past.`;
  else if (previewRelation === "future") relationLabel = ` Today's ${previewTarget} is in the future.`;
  else if (beforeToday) relationLabel = " Shown date is before today.";
  else if (afterToday) relationLabel = " Shown date is after today.";
  const beforeChevron = previewRelation === "past" || (!previewRelation && afterToday)
    ? '<span class="today-chevron today-chevron-before" aria-hidden="true">&lt;</span>'
    : "";
  const afterChevron = previewRelation === "future" || (!previewRelation && beforeToday)
    ? '<span class="today-chevron today-chevron-after" aria-hidden="true">&gt;</span>'
    : "";
  const weekdayLine = `<span class="weekday-line">${beforeChevron}<span class="weekday">${escapeHtml(weekday)}</span>${afterChevron}</span>`;
  const primaryHeader = `<span class="header-primary">${weekdayLine}${feastBanner}</span>`;
  const secondaryHeader = `<span class="header-secondary"><span class="date-value">${escapeHtml(mediumDate)}<span class="service-separator" aria-hidden="true">·</span><span class="service-label">${serviceLabel}</span></span>${meta ? `<span class="meta"><span class="meta-separator" aria-hidden="true">· </span>${escapeHtml(meta)}</span>` : ""}</span>`;
  const dateLine = `<button class="date-line" data-event="TODAY" type="button" aria-label="Return to today.${relationLabel}">${primaryHeader}${secondaryHeader}</button>`;
  return `<div class="screen-header-copy"><div class="header-summary">${dateLine}</div></div><span class="pixel-art-stack" aria-label="Liturgical calendar artwork"></span>`;
}

function readerProgressHintHtml(focus) {
  if (!focus) return '<span class="overview-focus-hint">Tap to focus</span>';
  return '<span class="focus-continue-hint">Continue</span>';
}

export function screenHtml(view, { feastLinksEnabled = true, psalmDisplayMode = "together", psalmOffice = "morning" } = {}) {
  const psalmPresentation = {
    byTime: psalmDisplayMode === "by-time-of-day",
    office: psalmOffice === "evening" ? "evening" : "morning",
  };
  const occasionType = view.occasionType || null;
  const timedOfficeLabel = {
    morning: "Morning Prayer",
    evening: "Evening Prayer",
    noonday: "Noonday",
    compline: "Compline",
  }[view.service];
  const serviceLabel = timedOfficeLabel || (psalmPresentation.office === "evening" ? "Evening" : "Morning");
  const screenLead = readerLeadHtml(view, serviceLabel, occasionType);
  const timedOffice = view[view.service] || view.office || view.noonday || view.compline;
  if (["morning", "evening", "noonday", "compline"].includes(view.service) && timedOffice) {
    const sections = timedOffice.sections;
    const body = view.focus && sections[view.focus]
      ? timedOfficeFocusHtml(sections[view.focus], view.focus)
      : timedOfficeOverviewHtml(sections, view.service);
    return `${screenLead}${body}${readerProgressHintHtml(view.focus)}`;
  }
  if (view.error && !(view.focus === "PRAYER" && view.prayer)) return `${screenLead}<h2 class="warning">${escapeHtml(view.error)}</h2>`;
  const prayerIndex = view.prayer?.pages.length > 1 ? ` (${view.prayer.page + 1}/${view.prayer.pages.length})` : "";
  const prayerFocus = view.focus === "PRAYER" && view.prayer
    ? `<div class="reading focus prayer-focus"><button class="prayer-content" data-reading="PRAYER" type="button"><span class="label">${escapeHtml(prayerHeading(view.prayer))}${prayerIndex}</span><span class="prayer-text">${prayerPageHtml(view.prayer)}</span></button>${feastAboutHtml(view.feast, occasionType, feastLinksEnabled)}</div>`
    : null;
  const gloriaFocus = view.focus === "GLORIA"
    ? `<button class="reading focus prayer-focus" data-reading="GLORIA" type="button"><span class="label">Gloria</span><span class="prayer-text gloria-text">${escapeHtml(GLORIA_TEXT)}</span></button>`
    : null;
  const lordsPrayerFocus = view.focus === "LORDS_PRAYER"
    ? `<button class="reading focus prayer-focus" data-reading="LORDS_PRAYER" type="button"><span class="label">${escapeHtml(LORDS_PRAYER_HEADING)}</span><span class="prayer-text lords-prayer-text">${prayerLineationHtml(LORDS_PRAYER_TEXT)}</span></button>`
    : null;
  const openingPrayerOverview = '<button class="reading overview-marker opening-prayer-marker" data-event="FOCUS" type="button"><span class="label">Opening Prayer</span></button>';
  const lordsPrayerOverview = `<button class="reading overview-marker lords-prayer-marker" data-event="FOCUS" type="button"><span class="label">${escapeHtml(LORDS_PRAYER_HEADING)}</span></button>`;
  const gloriaOverview = '<button class="reading overview-marker gloria-marker" data-event="FOCUS" type="button"><span class="label">Gloria</span></button>';
  const body = view.focus
    ? prayerFocus || lordsPrayerFocus || gloriaFocus || `<button class="reading focus" data-reading="${view.focus}" type="button">${readingContentHtml(view, view.focus, "focus-cite", psalmPresentation)}</button>`
    : `<div class="grid">${openingPrayerOverview}${Object.keys(view.values).map(key => `<button class="reading" data-reading="${key}" data-event="FOCUS" type="button">${readingContentHtml(view, key, "cite", psalmPresentation)}</button>`).join("")}${lordsPrayerOverview}${gloriaOverview}</div>`;
  return `${screenLead}${body}${readerProgressHintHtml(view.focus)}`;
}
