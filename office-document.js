export const OFFICE_DOCUMENT_SCHEMA = "office-document-v1";

const BLOCK_KINDS = new Set([
  "prose",
  "rubric",
  "response",
  "psalm-verse",
  "citation",
  "canticle",
  "conclusion",
]);

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new TypeError(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

export function structuralPageAnchor(sectionId, blockId, continuationIndex = 0) {
  requiredString(sectionId, "section id");
  requiredString(blockId, "block id");
  if (!Number.isInteger(continuationIndex) || continuationIndex < 0) {
    throw new TypeError("continuation index must be a non-negative integer");
  }
  return { sectionId, firstBlockId: blockId, continuationIndex };
}

export function validateOfficeDocument(document) {
  if (!document || document.schemaVersion !== OFFICE_DOCUMENT_SCHEMA) {
    throw new TypeError("Unsupported office document");
  }
  requiredString(document.id, "office id");
  requiredString(document.service, "office service");
  requiredString(document.title, "office title");
  requiredString(document.date, "office date");
  requiredString(document.source?.id, "office source id");
  requiredString(document.source?.locator, "office source locator");
  if (!Array.isArray(document.sections) || document.sections.length === 0) {
    throw new TypeError("Office document must have ordered sections");
  }
  unique(document.sections.map(section => section.id), "section id");
  const allBlockIds = [];
  for (const [sectionIndex, section] of document.sections.entries()) {
    requiredString(section.id, `section ${sectionIndex} id`);
    requiredString(section.label, `section ${section.id} label`);
    if (!Array.isArray(section.blocks) || section.blocks.length === 0) {
      throw new TypeError(`Section ${section.id} must have ordered blocks`);
    }
    for (const [blockIndex, block] of section.blocks.entries()) {
      requiredString(block.id, `section ${section.id} block ${blockIndex} id`);
      if (!BLOCK_KINDS.has(block.kind)) {
        throw new TypeError(`Unsupported block kind ${block.kind}`);
      }
      requiredString(block.text, `block ${block.id} text`);
      requiredString(block.source?.id, `block ${block.id} source id`);
      requiredString(block.source?.locator, `block ${block.id} source locator`);
      allBlockIds.push(block.id);
    }
    if (!Array.isArray(section.pageAnchors) || section.pageAnchors.length === 0) {
      throw new TypeError(`Section ${section.id} must have structural page anchors`);
    }
    for (const anchor of section.pageAnchors) {
      if (anchor.sectionId !== section.id) {
        throw new TypeError(`Page anchor does not belong to section ${section.id}`);
      }
      if (!section.blocks.some(block => block.id === anchor.firstBlockId)) {
        throw new TypeError(`Page anchor references missing block ${anchor.firstBlockId}`);
      }
      if (!Number.isInteger(anchor.continuationIndex) || anchor.continuationIndex < 0) {
        throw new TypeError("Page anchor continuation index is invalid");
      }
    }
  }
  unique(allBlockIds, "block id");
  return document;
}

function legacyBlockKind(text, key) {
  if (key.endsWith("_PSALM")) return "psalm-verse";
  if (key.endsWith("_READING")) return "citation";
  if (/\*\s*/.test(text)) return "response";
  return "prose";
}

export function adaptLegacyTimedOffice({
  service,
  date,
  title,
  source,
  focusOrder,
  sections,
}) {
  const ordered = focusOrder.map(key => {
    const legacy = sections[key];
    if (!legacy) throw new TypeError(`Missing legacy timed-office section ${key}`);
    const pageTexts = legacy.pages?.length ? legacy.pages : [legacy.text];
    const blocks = pageTexts.map((text, pageIndex) => ({
      id: `${service}.${key.toLowerCase()}.page-${pageIndex + 1}`,
      kind: legacyBlockKind(text, key),
      text,
      source,
    }));
    return {
      id: `${service}.${key.toLowerCase()}`,
      key,
      label: legacy.label,
      blocks,
      pageAnchors: blocks.map(block => structuralPageAnchor(
        `${service}.${key.toLowerCase()}`,
        block.id,
      )),
      legacy: {
        ...legacy,
        pages: [...pageTexts],
        pageGroups: legacy.pageGroups?.map(group => ({ ...group })),
      },
    };
  });
  return validateOfficeDocument({
    schemaVersion: OFFICE_DOCUMENT_SCHEMA,
    id: `${service}-${date}`,
    service,
    date,
    title,
    source,
    audit: { adapter: "legacy-timed-office-v1" },
    sections: ordered,
  });
}

export function officeDocumentToViewSections(document) {
  validateOfficeDocument(document);
  return Object.fromEntries(document.sections.map(section => {
    const defaultPages = section.legacy?.pages?.length
      ? [...section.legacy.pages]
      : section.blocks.map(block => block.text);
    const pages = section.view?.pages?.length ? [...section.view.pages] : defaultPages;
    return [
      section.key || section.id,
      {
        ...(section.legacy || {}),
        label: section.label,
        text: section.view?.text
          ?? section.legacy?.text
          ?? section.blocks.map(block => block.text).join("\n\n"),
        pages,
        ...(section.view || {}),
        page: 0,
        pageAnchors: section.pageAnchors.map(anchor => ({ ...anchor })),
        documentSectionId: section.id,
      },
    ];
  }));
}

export function officeDocumentFocusOrder(document) {
  validateOfficeDocument(document);
  return document.sections.map(section => section.key || section.id);
}
