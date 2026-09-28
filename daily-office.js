import {
  OFFICE_DOCUMENT_SCHEMA,
  structuralPageAnchor,
  validateOfficeDocument,
} from "./office-document.js?v=staging-ace21f6cbd2ed40a35aef1ccb4d73e2bb58ba544";

const OFFICE_SOURCE = Object.freeze({
  morning: {
    id: "morning-prayer-rite-two",
    locator: "https://www.bcponline.org/DailyOffice/mp2.html",
  },
  evening: {
    id: "evening-prayer-rite-two",
    locator: "https://www.bcponline.org/DailyOffice/ep2.html",
  },
});

const MAJOR_SAINT_SLUGS = /all-saints|apostle|evangelist|martyr|saint|st-|visitation|annunciation|presentation|transfiguration|holy-cross|nativity-of-st-john/i;
const PSALTER_INDEXES = new WeakMap();
// Labels follow each canticle's cited source. Nulls continue the prior verse;
// comma labels identify BCP stanzas that combine or reorder source verses.
const CANTICLE_VERSE_LABELS = Object.freeze({
  8: [1, 2, null, 3, 4, 5, 6, 11, 12, 13, 17, null, 18, null],
  9: [2, null, 3, 4, null, 5, 6, null],
  10: [6, 7, null, 8, 9, 10, null, 11, null, null],
  11: [1, 2, null, 3, "11a", "14c", 18, null, 19, null, null],
  12: [35, 36, "37–39", "40–41", "42–44", 45, 46, "49–50", "47–48", 51, 52, "53–54", "55–57", 58, 59, 60, 61, "62–63", 64, 65, null, null],
  13: [29, 30, "31,33", 32, "32,34", null],
  14: [1, 2, 4, 6, 7, null, null, 11, 12, 13, null, null, 14, 15],
  15: ["46–48", "48–49", 50, 51, 52, 53, 54, 55, null],
  16: [68, 69, "70–71", 72, "73–74", 75, 76, 77, 78, 79, null],
  17: [29, "30–31", 32, null],
  18: ["4:11", null, "5:9", "5:10", "5:13", null],
  19: [3, null, 4, null, null],
});

function rotationIndex(date, length) {
  const day = Math.floor(new Date(`${date}T12:00:00Z`).getTime() / 86400000);
  return ((day % length) + length) % length;
}

function locatorFor(raw) {
  const locator = raw.source_locator || {};
  const anchor = locator.anchors?.[0];
  return `${locator.source_id || "bcp1979"}#${anchor || `element-${locator.element || 0}`}`;
}

function pairedResponseText(call, response) {
  if (call?.voice === "people" || response?.voice !== "people") return null;
  return `${call.text} *\n${response.text}`;
}

function dialogueText(dialogue) {
  if (!Array.isArray(dialogue) || dialogue.length === 0) return null;
  const exchanges = [];
  for (let index = 0; index < dialogue.length; index += 1) {
    const call = dialogue[index];
    const response = dialogue[index + 1];
    const paired = pairedResponseText(call, response);
    if (paired) {
      exchanges.push(paired);
      index += 1;
    } else {
      exchanges.push(call.text);
    }
  }
  return exchanges.join("\n\n");
}

function liturgicalSegmentText(segments, labels = []) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  return segments.map((segment, index) => {
    const label = labels[index] == null ? "" : `${labels[index]} `;
    return segment.kind === "call_response"
      ? `${label}${segment.call} *\n${segment.response}`
      : `${label}${segment.text}`;
  }).join("\n\n");
}

function rawBlock(raw, { kind, id, text, voice } = {}) {
  const mappedKind = kind || (
    raw.kind === "rubric"
      ? "rubric"
      : ["call_response", "table_row"].includes(raw.kind)
        ? "response"
        : "prose"
  );
  const mappedVoice = voice ?? raw.voice;
  return {
    id: id || raw.id,
    kind: mappedKind,
    text: text
      ?? dialogueText(raw.dialogue)
      ?? liturgicalSegmentText(raw.liturgical_segments)
      ?? raw.text,
    ...(mappedVoice ? { voice: mappedVoice } : {}),
    source: {
      id: raw.source_locator?.source_id || "bcp1979",
      locator: locatorFor(raw),
    },
  };
}

function canticleVerseText(raw, number, verseState) {
  if (!verseState) return null;
  const segments = raw.liturgical_segments || [];
  const labels = verseState.labels.slice(
    verseState.index,
    verseState.index + segments.length,
  );
  if (labels.length !== segments.length) {
    throw new Error(`Canticle ${number} verse labels do not match ${raw.id}`);
  }
  verseState.index += segments.length;
  if (segments.length === 0) return null;
  return liturgicalSegmentText(segments, labels);
}

function customBlock(id, kind, text, source) {
  return { id, kind, text, source };
}

function displayUnits(blocks) {
  const units = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const response = blocks[index + 1];
    if (
      block.kind === "response"
      && response?.kind === "response"
    ) {
      const paired = pairedResponseText(block, response);
      if (paired) {
        units.push(paired);
        index += 1;
        continue;
      }
    }
    units.push(block.text);
  }
  return units;
}

function splitAtAmens(text) {
  const matches = [...text.matchAll(
    /\bAmen\.?(?:\s+Alleluia(?:,\s*alleluia)*\.?)?/gi,
  )];
  if (matches.length <= 1) return [text];
  const parts = [];
  let start = 0;
  for (const match of matches) {
    const end = match.index + match[0].length;
    parts.push(text.slice(start, end).trim());
    start = end;
  }
  const remainder = text.slice(start).trim();
  if (remainder) parts.push(remainder);
  return parts.filter(Boolean);
}

function combineAmenAndAlleluia(units) {
  const combined = [];
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const alleluia = units[index + 1];
    if (
      /\bAmen\.?/i.test(unit)
      && /^Alleluia(?:,\s*alleluia)*\.?$/i.test(alleluia || "")
    ) {
      combined.push(`${unit}\n${alleluia}`);
      index += 1;
    } else {
      combined.push(unit);
    }
  }
  return combined;
}

function prayerPageGroups(blocks) {
  const groups = [];
  let units = combineAmenAndAlleluia(displayUnits(blocks));
  if (
    /^The Lord be with you\. \*\nAnd also with you\.$/i.test(units[0] || "")
    && /^Let us pray\.$/i.test(units[1] || "")
  ) {
    groups.push({
      text: `${units[0]}\n\n${units[1]}`,
      standalone: true,
    });
    units = units.slice(2);
  }

  let current = [];
  for (const unit of units.flatMap(splitAtAmens)) {
    current.push(unit);
    if (/\bAmen\.?/i.test(unit)) {
      groups.push({ text: current.join("\n\n") });
      current = [];
    }
  }
  if (current.length > 0) groups.push({ text: current.join("\n\n") });
  return groups;
}

function creedText(text) {
  return text.replace(/([.;])\s+(?=I believe\b)/g, "$1\n\n");
}

function confessionBlock(raw) {
  if (raw.kind === "rubric" && raw.text === "Silence may be kept.") {
    return rawBlock(raw, { text: `[${raw.text}]` });
  }
  if (raw.voice === "priest") {
    return rawBlock(raw, {
      voice: "officiant",
      text: raw.text
        .replace(/\byou\b/g, "us")
        .replace(/\byour\b/g, "our"),
    });
  }
  return rawBlock(raw);
}

function confessionPageGroups(blocks) {
  const units = displayUnits(blocks);
  return [
    {
      text: units.slice(0, 2).join("\n\n"),
      standalone: true,
    },
    {
      text: units.slice(2).join("\n\n"),
    },
  ];
}

function section(service, id, key, label, blocks, view = {}) {
  const sectionId = `${service}.${id}`;
  const pageGroups = view.pageGroups
    ?? (view.pages?.length ? null : prayerPageGroups(blocks));
  return {
    id: sectionId,
    key,
    label,
    blocks,
    pageAnchors: blocks.map(block => structuralPageAnchor(sectionId, block.id)),
    view: {
      ...(pageGroups ? {
        text: pageGroups.map(group => group.text).join("\n\n"),
        pageGroups,
      } : {}),
      ...view,
    },
  };
}

function cleanConditionalAlleluia(text, inEaster) {
  return text
    .replaceAll("[Alleluia.]", inEaster ? "Alleluia." : "")
    .replace(/\s+/g, " ")
    .trim();
}

function isMajorSaint(context) {
  return MAJOR_SAINT_SLUGS.test(context.feast_slug || "");
}

function separateTrailingCitation(raw, text = raw.text) {
  const footnote = raw.citations?.join("; ");
  return {
    text: footnote && text.endsWith(footnote)
      ? text.slice(0, -footnote.length).trim()
      : text,
    footnote,
  };
}

function seasonalSentence(riteTwo, context) {
  const sentences = riteTwo.offices.morning.sections[1].blocks;
  let index = 35;
  if (isMajorSaint(context)) index = 29;
  else if (context.season === "advent") index = 2;
  else if (context.season === "christmas") index = 4;
  else if (context.season === "epiphany") index = 7;
  else if (context.season === "lent") index = 11;
  else if (context.season === "holy-week") index = 17;
  else if (context.season === "easter") index = 20;
  else if (context.season === "pentecost") index = 25;
  else if (context.season === "trinity") index = 27;
  const raw = sentences[index];
  const { text, footnote } = separateTrailingCitation(
    raw,
    raw.text.replace(/^(Advent|Christmas)\s+/, ""),
  );
  return {
    block: rawBlock(raw, { text }),
    footnote,
  };
}

function invitatoryAntiphonBlock(riteTwo, context) {
  const blocks = riteTwo.offices.morning.sections[3].blocks;
  const inEaster = ["easter", "pentecost"].includes(context.season);
  let index = 26;
  if (["transfiguration", "holy-cross"].includes(context.feast_slug)) index = 14;
  else if (isMajorSaint(context)) index = 35;
  else if (context.season === "advent") index = 10;
  else if (context.season === "christmas") index = 12;
  else if (context.week === "dated-01-06"
    || (context.week === "epiphany-1" && context.weekday === "sunday")) index = 14;
  else if (["lent", "holy-week"].includes(context.season)) index = 16;
  else if (context.season === "pentecost") index = 22;
  else if (context.season === "trinity") index = 24;
  else if (context.season === "easter" && (
    context.feast_slug === "ascension"
      || context.week === "easter-7"
      || (context.week === "easter-6" && ["thursday", "friday", "saturday"].includes(context.weekday))
  )) index = 20;
  else if (context.season === "easter") index = 18;
  const raw = blocks[index];
  return rawBlock(raw, { text: cleanConditionalAlleluia(raw.text, inEaster) });
}

function appointedPsalmTokens(officeAppointment, date) {
  const tokens = [];
  for (const selection of officeAppointment.psalms) {
    const choices = selection.alternatives?.length
      ? selection.alternatives
      : [selection.appointed || selection.raw];
    const chosen = choices[rotationIndex(date, choices.length)]
      .replace(/[\[\]]/g, "")
      .replace(/(\d+):\d+:(\d+\s*[-–—])/g, "$1:$2")
      .replace(
        /(\d+):(\d+)-(\d+)\)(\d+)-(\d+)\)/g,
        (_, psalm, first, _requiredEnd, _continuationFirst, continuationEnd) => `${psalm}:${first}-${continuationEnd}`,
      )
      .replace(
        /(\d+):(\d+)-(\d+)\)?\((\d+)(?:-(\d+))?\)(\d+)-(\d+)\)?/g,
        (_, psalm, first, _requiredEnd, _optionalFirst, _optionalEnd, _continuationFirst, continuationEnd) => `${psalm}:${first}-${continuationEnd}`,
      )
      .replace(
        /(\d+):(\d+)-(\d+)\((\d+)(?:-(\d+))?\)/g,
        (_, psalm, first, _requiredEnd, optionalFirst, optionalEnd) => `${psalm}:${first}-${optionalEnd || optionalFirst}`,
      );
    const parsed = [...chosen.matchAll(/(\d+)(?:\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\*?/g)]
      .map(match => ({
        number: Number(match[1]),
        firstVerse: match[2] ? Number(match[2]) : null,
        lastVerse: match[3] ? Number(match[3]) : match[2] ? Number(match[2]) : null,
        invitatory: Boolean(selection.invitatory_marker && Number(match[1]) === 95),
      }));
    tokens.push(...parsed);
  }
  return tokens;
}

export function selectAppointedPsalms(officeAppointment, date) {
  return appointedPsalmTokens(officeAppointment, date);
}

function psalmBlocks(service, tokens, psalter) {
  let psalms = PSALTER_INDEXES.get(psalter);
  if (!psalms) {
    psalms = new Map(psalter.psalms.map(psalm => [psalm.number, psalm]));
    PSALTER_INDEXES.set(psalter, psalms);
  }
  const blocks = [];
  for (const token of tokens) {
    const psalm = psalms.get(token.number);
    if (!psalm) throw new Error(`Missing Psalm ${token.number}`);
    blocks.push(customBlock(
      `${service}.psalm-${token.number}.heading`,
      "prose",
      `Psalm ${token.number} · ${psalm.latin_title}`,
      { id: "psalter", locator: `psalter#psalm-${token.number}` },
    ));
    const verses = psalm.verses.filter(verse => (
      token.firstVerse === null
      || (verse.number >= token.firstVerse && verse.number <= token.lastVerse)
    ));
    if (verses.length === 0) throw new Error(`Psalm ${token.number} has no appointed verses`);
    for (const verse of verses) {
      blocks.push(customBlock(
        `${service}.psalm-${token.number}.verse-${verse.number}`,
        "psalm-verse",
        `${verse.number} ${verse.text}`,
        { id: "psalter", locator: locatorFor(verse) },
      ));
    }
  }
  return blocks;
}

function numberedInvitatoryPsalm(blocks, start, end) {
  const heading = blocks[start];
  const citation = heading.citations?.[0];
  let verseNumber = 0;
  const verses = blocks.slice(start + 1, end).flatMap(raw => (
    (raw.liturgical_segments || []).map(segment => {
      verseNumber += 1;
      return rawBlock(raw, {
        id: `${raw.id}.verse-${verseNumber}`,
        kind: "psalm-verse",
        text: `${verseNumber} ${liturgicalSegmentText([segment])}`,
      });
    })
  ));
  return {
    name: heading.strong_text?.[0],
    blocks: verses,
    view: {
      summary: citation,
      pageGroups: [{
        text: [citation, ...verses.map(block => block.text)].join("\n\n"),
      }],
    },
    omitPsalm95: false,
  };
}

function morningInvitatory(riteTwo, context, date, appointedTokens, psalter) {
  const blocks = riteTwo.offices.morning.sections[3].blocks;
  const christOurPassover = () => {
    const heading = blocks[47];
    const body = blocks.slice(48, 51).map(raw => rawBlock(raw, { kind: "canticle" }));
    return {
      name: "Christ our Passover",
      blocks: body,
      view: {
        subtitle: "Pascha nostrum",
        citation: heading.citations?.[0].replace(/^Pascha nostrum\s+/, ""),
        pageGroups: prayerPageGroups(body),
      },
      omitPsalm95: false,
    };
  };
  if (context.week === "easter-week") return christOurPassover();

  const appointed95 = appointedTokens.find(token => token.invitatory);
  if (appointed95) {
    const appointed = psalmBlocks("morning-invitatory", [appointed95], psalter);
    return {
      name: "Invitatory Psalm",
      blocks: appointed,
      view: {
        summary: "Psalm 95",
        pageGroups: psalmPageGroups(appointed, true),
      },
      omitPsalm95: true,
    };
  }

  const inEasterSeason = ["easter", "pentecost"].includes(context.season);
  const choice = rotationIndex(date, inEasterSeason ? 3 : 2);
  if (choice === 2) return christOurPassover();
  const range = choice === 1 ? [41, 46] : [36, 40];
  return numberedInvitatoryPsalm(blocks, ...range);
}

function canticleNumbers(service, context, date) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (isMajorSaint(context)) return service === "morning" ? [16, 21] : [15, 17];
  if (service === "morning") {
    const numbers = [
      [16, 21],
      [9, 19],
      [13, 18],
      [11, 16],
      [8, 20],
      [10, 18],
      [12, 19],
    ][weekday];
    if (["lent", "holy-week"].includes(context.season) && [0, 3, 5].includes(weekday)) {
      numbers[0] = 14;
    }
    if (["advent", "lent", "holy-week"].includes(context.season) && [0, 4].includes(weekday)) {
      numbers[1] = weekday === 0 ? 16 : 19;
    }
    if (context.season === "easter" && weekday === 0) numbers[0] = 8;
    return numbers;
  }
  const numbers = [
    [15, 17],
    [8, 17],
    [10, 15],
    [12, 17],
    [11, 15],
    [13, 17],
    [9, 15],
  ][weekday];
  if (["lent", "holy-week"].includes(context.season) && weekday === 1) numbers[0] = 14;
  return numbers;
}

function canticleContent(riteTwo, number, position) {
  const canticle = riteTwo.canticles[String(number)];
  if (!canticle) throw new Error(`Missing Canticle ${number}`);
  const verseLabels = CANTICLE_VERSE_LABELS[number];
  const verseState = verseLabels ? { labels: verseLabels, index: 0 } : null;
  const blocks = canticle.blocks.map(raw => {
    const numberedText = canticleVerseText(raw, number, verseState);
    return rawBlock(raw, {
      id: `${raw.id}.position-${position}`,
      kind: raw.kind === "rubric" ? "rubric" : "canticle",
      ...(numberedText ? { text: numberedText } : {}),
    });
  });
  if (verseState && verseState.index !== verseState.labels.length) {
    throw new Error(
      `Canticle ${number} consumed ${verseState.index} of ${verseState.labels.length} verse labels`,
    );
  }
  const heading = canticle.blocks[0];
  const title = heading.strong_text?.find(text => text !== String(number));
  const latinTitle = heading.italic_text?.find(text => (
    !heading.citations?.includes(text)
  ));
  const bodyBlocks = blocks.slice(1).filter((_, index) => {
    const sourceBlock = canticle.blocks[index + 1];
    return !(
      sourceBlock.kind === "rubric"
      && /^Especially suitable\b/i.test(sourceBlock.text)
    );
  });
  const bodyPageGroups = prayerPageGroups(bodyBlocks);
  return {
    blocks,
    view: {
      heading: title,
      subtitle: latinTitle,
      citation: heading.citations?.join("; "),
      numberedVerses: Boolean(CANTICLE_VERSE_LABELS[number]),
      pageGroups: bodyPageGroups,
      pages: bodyPageGroups.map(group => group.text),
    },
  };
}

function conclusionBlocks(service, riteTwo, context, date) {
  const office = riteTwo.offices[service];
  const raw = office.sections[service === "morning" ? 8 : 7].blocks;
  const blessingIndexes = service === "morning" ? [34, 35, 36] : [33, 34, 35];
  const dismissalIndex = service === "morning" ? 31 : 30;
  const dismissal = raw[dismissalIndex];
  const blessing = raw[blessingIndexes[rotationIndex(date, blessingIndexes.length)]];
  const { text: blessingText, footnote } = separateTrailingCitation(blessing);
  const inEaster = ["easter", "pentecost"].includes(context.season);
  const dismissalResponse = inEaster
    ? "Thanks be to God. Alleluia, alleluia."
    : "Thanks be to God.";
  return {
    blocks: [
      rawBlock(dismissal, {
        text: `Let us bless the Lord. *\n${dismissalResponse}`,
        kind: "conclusion",
      }),
      rawBlock(blessing, { kind: "conclusion", text: blessingText }),
    ],
    footnote,
  };
}

function collectBlocks(service, riteTwo, date, collect) {
  const raw = riteTwo.offices[service].sections[service === "morning" ? 8 : 7].blocks;
  const officeIndexes = [9, 11, 13, 15];
  const missionIndexes = [17, 19, 21];
  const dateCollect = customBlock(
    `${service}.collect-of-day`,
    "prose",
    collect.text,
    {
      id: "collects-contemporary",
      locator: `collects:${collect.title}`,
    },
  );
  return [
    dateCollect,
    rawBlock(raw[officeIndexes[rotationIndex(date, officeIndexes.length)]]),
    rawBlock(raw[missionIndexes[rotationIndex(date, missionIndexes.length)]]),
  ];
}

function lessonAndCanticleSections(
  service,
  riteTwo,
  officeAppointment,
  context,
  date,
  lessonCitations = null,
) {
  const source = {
    id: officeAppointment.source.id,
    locator: officeAppointment.source.label || officeAppointment.source.locator,
  };
  const numbers = canticleNumbers(service, context, date);
  const lessonGroups = [];
  for (const lesson of officeAppointment[service].lessons) {
    if (lesson.alternative && lessonGroups.length > 0) lessonGroups.at(-1).push(lesson);
    else lessonGroups.push([lesson]);
  }
  const appointedLessons = lessonGroups.map(group => group[rotationIndex(date, group.length)]);
  const selectedLessons = Array.isArray(lessonCitations) && lessonCitations.length > 0
    ? lessonCitations.map(citation => ({ citation }))
    : appointedLessons;
  return selectedLessons.flatMap((lesson, index) => {
    const position = index + 1;
    const citation = lesson.citation;
    const lessonBlock = customBlock(
      `${service}.lesson-${position}`,
      "citation",
      citation,
      source,
    );
    const lessonSection = section(
      service,
      `lesson-${position}`,
      `${service.toUpperCase()}_LESSON_${position}`,
      ["First Lesson", "Second Lesson", "Third Lesson"][index] || `Lesson ${position}`,
      [lessonBlock],
      { citation, pages: [citation] },
    );
    if (selectedLessons.length > 2 && index >= 2) return [lessonSection];
    const canticleNumber = numbers[index] || numbers.at(-1);
    const canticle = canticleContent(riteTwo, canticleNumber, position);
    return [
      lessonSection,
      section(
        service,
        `canticle-${position}`,
        `${service.toUpperCase()}_CANTICLE_${position}`,
        `Canticle ${canticleNumber}`,
        canticle.blocks,
        canticle.view,
      ),
    ];
  });
}

function psalmPageGroups(blocks, includeHeadings) {
  const groups = [];
  let current = [];
  for (const block of blocks) {
    if (block.id.endsWith(".heading")) {
      if (current.length > 0) groups.push({ text: current.join("\n\n") });
      current = includeHeadings ? [block.text] : [];
    } else {
      current.push(block.text);
    }
  }
  if (current.length > 0) groups.push({ text: current.join("\n\n") });
  return groups;
}

export function composeDailyOffice({
  service,
  date,
  day,
  collect,
  riteTwo,
  psalter,
  appointments,
  lessonCitations = null,
}) {
  if (!["morning", "evening"].includes(service)) throw new TypeError("Full office service must be morning or evening");
  const context = appointments.contexts[date];
  if (!context) throw new Error(`No Daily Office context for ${date}`);
  const key = service === "morning" ? context.morning_key : context.evening_key;
  const appointment = appointments.appointments[key] || appointments.eves[key];
  if (!appointment) throw new Error(`No Daily Office appointment for ${key}`);
  if (!collect?.text || !collect?.title) throw new Error(`No collect for ${day?.label || date}`);

  const office = riteTwo.offices[service];
  const confession = office.sections[2].blocks;
  const invitatoryRaw = office.sections[3].blocks;
  const prayers = office.sections[service === "morning" ? 7 : 6].blocks;
  const creed = office.sections[service === "morning" ? 6 : 5].blocks;
  const suffrageIndexes = rotationIndex(date, 2) === 0 ? [9, 10] : [12];
  const appointedTokens = appointedPsalmTokens(appointment[service], date);
  const openingSentence = seasonalSentence(riteTwo, context);
  const confessionIndexes = service === "evening" ? [4, 5, 7, 8] : [4, 5, 7];
  const absolutionIndex = service === "evening" ? 10 : 9;
  const confessionBlocks = confessionIndexes.map(index => confessionBlock(confession[index]));
  const sections = [
    section(
      service,
      "opening",
      `${service.toUpperCase()}_OPENING`,
      "Opening Sentence",
      [openingSentence.block],
      { footnote: openingSentence.footnote },
    ),
    section(
      service,
      "confession",
      `${service.toUpperCase()}_CONFESSION`,
      "Confession",
      confessionBlocks,
      { pageGroups: confessionPageGroups(confessionBlocks) },
    ),
    section(
      service,
      "absolution",
      `${service.toUpperCase()}_ABSOLUTION`,
      "Absolution",
      [confessionBlock(confession[absolutionIndex])],
    ),
  ];

  let psalmTokens = appointedTokens;
  if (service === "morning") {
    const invitatory = morningInvitatory(riteTwo, context, date, appointedTokens, psalter);
    const openingBlocks = [
      invitatoryRaw[2],
      invitatoryRaw[3],
      invitatoryRaw[5],
    ].map(raw => rawBlock(raw));
    if (!["lent", "holy-week"].includes(context.season)) {
      openingBlocks.push(customBlock(
        "morning.invitatory.alleluia",
        "response",
        "Alleluia.",
        OFFICE_SOURCE.morning,
      ));
    }
    const antiphon = invitatoryAntiphonBlock(riteTwo, context);
    sections.push(section(
      service,
      "invitatory",
      "MORNING_INVITATORY",
      "Invitatory",
      [...openingBlocks, antiphon],
      {
        pageGroups: [
          ...prayerPageGroups(openingBlocks),
          { text: antiphon.text, standalone: true },
        ],
      },
    ));
    sections.push(section(
      service,
      "invitatory-psalm",
      "MORNING_INVITATORY_PSALM",
      invitatory.name,
      invitatory.blocks,
      invitatory.view,
    ));
    if (invitatory.omitPsalm95) psalmTokens = appointedTokens.filter(token => !token.invitatory);
  } else {
    const openingBlocks = [invitatoryRaw[2], invitatoryRaw[3], invitatoryRaw[5]].map(raw => rawBlock(raw));
    if (!["lent", "holy-week"].includes(context.season)) {
      openingBlocks.push(customBlock(
        "evening.invitatory.alleluia",
        "response",
        "Alleluia.",
        OFFICE_SOURCE.evening,
      ));
    }
    openingBlocks.push(...invitatoryRaw.slice(8, 10).map(raw => rawBlock(raw, { kind: "canticle" })));
    sections.push(section(
      service,
      "invitatory",
      "EVENING_INVITATORY",
      "O Gracious Light",
      openingBlocks,
    ));
  }

  const psalms = psalmBlocks(service, psalmTokens, psalter);
  const gloria = rawBlock(invitatoryRaw[service === "morning" ? 54 : 13], { kind: "conclusion" });
  const psalmGroups = psalmPageGroups(psalms, true);
  const psalmText = psalmGroups.map(group => group.text).join("\n\n");
  const psalmSummary = psalmTokens.map(token => (
    token.firstVerse === null
      ? `${token.number}`
      : `${token.number}:${token.firstVerse}-${token.lastVerse}`
  )).join(", ");
  sections.push(section(
    service,
    "psalms",
    `${service.toUpperCase()}_PSALMS`,
    "Psalms",
    [...psalms, gloria],
    {
      summary: psalmSummary,
      citation: `Psalm${psalmTokens.length === 1 ? "" : "s"} ${psalmSummary}`,
      text: psalmText,
      pageGroups: psalmGroups,
      pages: [psalmText, gloria.text],
      closingPage: gloria.text,
    },
  ));
  sections.push(...lessonAndCanticleSections(
    service,
    riteTwo,
    appointment,
    context,
    date,
    lessonCitations,
  ));
  const conclusion = conclusionBlocks(service, riteTwo, context, date);
  sections.push(
    section(
      service,
      "creed",
      `${service.toUpperCase()}_CREED`,
      "The Apostles’ Creed",
      [rawBlock(creed[2], { text: creedText(creed[2].text) })],
    ),
    section(
      service,
      "prayers",
      `${service.toUpperCase()}_PRAYERS`,
      "The Prayers",
      [
        ...[2, 3, 4].map(index => rawBlock(prayers[index])),
        rawBlock(prayers[6], {
          text: prayers[6].options[rotationIndex(date, prayers[6].options.length)].text,
        }),
        ...suffrageIndexes.map(index => rawBlock(prayers[index])),
      ],
    ),
    section(
      service,
      "collects",
      `${service.toUpperCase()}_COLLECTS`,
      "The Collects",
      collectBlocks(service, riteTwo, date, collect),
    ),
    section(
      service,
      "conclusion",
      `${service.toUpperCase()}_CONCLUSION`,
      "Conclusion",
      conclusion.blocks,
      {
        footnote: conclusion.footnote,
        pageGroups: conclusion.blocks.map(block => ({
          text: block.text,
          standalone: true,
        })),
      },
    ),
  );

  return validateOfficeDocument({
    schemaVersion: OFFICE_DOCUMENT_SCHEMA,
    id: `${service}-${date}`,
    service,
    date,
    title: `Daily ${service === "morning" ? "Morning" : "Evening"} Prayer: Rite Two`,
    source: OFFICE_SOURCE[service],
    audit: {
      appointmentKey: key,
      appointmentVerified: appointment.verified === true,
      season: context.season,
      feastSlug: context.feast_slug,
      eveOf: context.eve_of,
      nominalDate: context.nominal_date,
      observedDate: context.observed_date,
      transferred: context.transferred,
      transferRule: context.transfer_rule,
      sourceLocators: context.source_locators,
    },
    sections,
  });
}
