import { selectAppointedPsalms } from "./daily-office.js?v=staging-3c34cf2d9f218a2338d63fa67fd4b5336fc798ce";
import { prioritizedDates } from "./reading-pack-loader.js?v=staging-3c34cf2d9f218a2338d63fa67fd4b5336fc798ce";

const DEFAULT_CONTENT_URLS = Object.freeze({
  riteTwo: "data/daily-office/rite-two.json",
  psalter: "data/daily-office/psalter.json",
  appointments: "dor-engine/office-appointments.json",
});

const DAILY_OFFICE_PACK_SCHEMAS = Object.freeze({
  index: "daily-office-content-index-v1",
  pack: "daily-office-content-pack-v1",
});

const TEXT_DECODER = new TextDecoder();

const CONTENT_SCHEMAS = Object.freeze({
  riteTwo: "bcp1979-rite-two-daily-office-v1",
  psalter: "bcp1979-psalter-v1",
  appointments: "office-appointments-v1",
});

async function fetchJson(fetcher, url, label, { signal, requestCache }) {
  const response = await fetcher(url, {
    priority: "high",
    signal,
    cache: requestCache,
  });
  if (!response.ok) {
    const error = new Error(`${label} request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function isTransientLoadError(error) {
  return error?.message === "Full Daily Office request timed out"
    || error?.name === "TypeError"
    || error?.status === 408
    || error?.status === 429
    || error?.status >= 500;
}

function validateContent(content) {
  validateRiteTwo(content.riteTwo);
  if (content.psalter?.schema_version !== CONTENT_SCHEMAS.psalter
    || !Array.isArray(content.psalter.psalms)
    || content.psalter.psalms.length === 0
    || content.psalter.psalms.some(psalm => (
      !Number.isInteger(psalm.number)
      || !Array.isArray(psalm.verses)
      || psalm.verses.length === 0
    ))) {
    throw new Error("Unsupported Psalter corpus");
  }
  const { appointments } = content;
  const appointmentMap = appointments?.appointments;
  const eveMap = appointments?.eves;
  const contexts = appointments?.contexts;
  if (appointments?.schema_version !== CONTENT_SCHEMAS.appointments
    || !appointmentMap || Object.keys(appointmentMap).length === 0
    || !eveMap || Object.keys(eveMap).length === 0
    || !contexts || Object.keys(contexts).length === 0) {
    throw new Error("Unsupported or incomplete Daily Office appointments");
  }
  for (const [date, context] of Object.entries(contexts)) {
    for (const [service, key] of [
      ["morning", context.morning_key],
      ["evening", context.evening_key],
    ]) {
      const appointment = appointmentMap[key] || eveMap[key];
      if (!appointment?.[service]) {
        throw new Error(`Daily Office appointment ${key || "(missing)"} for ${date} is unavailable`);
      }
    }
  }
  return content;
}

async function loadDailyOfficeContentAttempt({
  fetcher = fetch,
  urls = DEFAULT_CONTENT_URLS,
  timeoutMs = 15000,
  requestCache = "default",
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const options = { signal: controller.signal, requestCache };
  try {
    const [riteTwo, psalter, appointments] = await Promise.all([
      fetchJson(fetcher, urls.riteTwo, "Rite II office", options),
      fetchJson(fetcher, urls.psalter, "Psalter", options),
      fetchJson(fetcher, urls.appointments, "Daily Office appointments", options),
    ]);
    return validateContent({ riteTwo, psalter, appointments });
  } catch (error) {
    controller.abort();
    if (timedOut && error?.name === "AbortError") {
      throw new Error("Full Daily Office request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadDailyOfficeContent(options = {}) {
  const requestCache = options.requestCache || "default";
  try {
    return await loadDailyOfficeContentAttempt({ ...options, requestCache });
  } catch (error) {
    if (requestCache !== "default" || !isTransientLoadError(error)) throw error;
    return loadDailyOfficeContentAttempt({ ...options, requestCache: "reload" });
  }
}

export function prioritizedDailyOfficeDates(dates, today) {
  return prioritizedDates(dates.map(date => ({ date })), today);
}

function emptyDailyOfficeContent(riteTwo) {
  return {
    riteTwo,
    psalter: {
      schema_version: CONTENT_SCHEMAS.psalter,
      psalms: [],
    },
    appointments: {
      schema_version: CONTENT_SCHEMAS.appointments,
      appointments: {},
      eves: {},
      contexts: {},
    },
  };
}

function validateRiteTwo(riteTwo) {
  const offices = riteTwo?.offices;
  const hasCompleteOffice = service => (
    Array.isArray(offices?.[service]?.sections)
    && offices[service].sections.length > 0
    && offices[service].sections.every(section => (
      Array.isArray(section.blocks) && section.blocks.length > 0
    ))
  );
  if (riteTwo?.schema_version !== CONTENT_SCHEMAS.riteTwo
    || !hasCompleteOffice("morning")
    || !hasCompleteOffice("evening")
    || !riteTwo.canticles
    || Object.keys(riteTwo.canticles).length === 0) {
    throw new Error("Unsupported or incomplete Rite II office corpus");
  }
  return riteTwo;
}

function validateIndex(index) {
  if (index?.schema_version !== DAILY_OFFICE_PACK_SCHEMAS.index
    || index.pack_schema_version !== DAILY_OFFICE_PACK_SCHEMAS.pack
    || index.appointments_schema_version !== CONTENT_SCHEMAS.appointments
    || index.psalter_schema_version !== CONTENT_SCHEMAS.psalter
    || !index.contexts
    || !index.appointments
    || !index.eves
    || !index.psalms) {
    throw new Error("Unsupported Full Daily Office content index");
  }
  return index;
}

function bytesFrom(buffer) {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function parseIndexedRecord(bytes, [offset, length], partialResponse) {
  const start = partialResponse ? 0 : offset;
  const end = start + length;
  if (start < 0 || end > bytes.length) {
    throw new Error("Full Daily Office record is outside the returned pack");
  }
  return JSON.parse(TEXT_DECODER.decode(bytes.subarray(start, end)));
}

function isExpectedRecord(record, section, key) {
  return record?.type === section.slice(0, -1) && record.key === key;
}

function parseFullContentPack(text, riteTwo, index) {
  const content = emptyDailyOfficeContent(riteTwo);
  let hasHeader = false;
  for (const line of text.split("\n")) {
    if (!line) continue;
    const record = JSON.parse(line);
    if (record.type === "header") {
      if (record.schema_version !== DAILY_OFFICE_PACK_SCHEMAS.pack) {
        throw new Error("Unsupported Full Daily Office content pack");
      }
      hasHeader = true;
    } else if (record.type === "appointment") {
      content.appointments.appointments[record.key] = record.value;
    } else if (record.type === "eve") {
      content.appointments.eves[record.key] = record.value;
    } else if (record.type === "psalm") {
      content.psalter.psalms.push(record.value);
    } else if (record.type === "context") {
      content.appointments.contexts[record.key] = record.value;
    }
  }
  content.psalter.psalms.sort((left, right) => left.number - right.number);
  const loadedKeys = {
    appointments: Object.keys(content.appointments.appointments),
    eves: Object.keys(content.appointments.eves),
    psalms: content.psalter.psalms.map(psalm => String(psalm.number)),
    contexts: Object.keys(content.appointments.contexts),
  };
  const isComplete = hasHeader && Object.entries(loadedKeys).every(([section, keys]) => (
    keys.length === Object.keys(index[section]).length
    && keys.every(key => index[section][key])
  ));
  if (!isComplete) {
    throw new Error("Incomplete Full Daily Office content pack");
  }
  return content;
}

export function mergeDailyOfficeContent(target, source) {
  if (!target.riteTwo) target.riteTwo = source.riteTwo;
  Object.assign(target.appointments.appointments, source.appointments.appointments);
  Object.assign(target.appointments.eves, source.appointments.eves);
  Object.assign(target.appointments.contexts, source.appointments.contexts);
  const psalms = new Map(target.psalter.psalms.map(psalm => [psalm.number, psalm]));
  for (const psalm of source.psalter.psalms) psalms.set(psalm.number, psalm);
  target.psalter.psalms = [...psalms.values()].sort((left, right) => left.number - right.number);
  return target;
}

export function createDailyOfficeDayLoader({
  indexUrl,
  packUrl,
  riteTwoUrl,
  fetcher = globalThis.fetch,
  timeoutMs = 15000,
}) {
  let indexPromise = null;
  let riteTwoPromise = null;
  let fullPackBytesPromise = null;
  let fullBundlePromise = null;
  const dayPromises = new Map();

  async function fetchWithRetry(url, options, label) {
    const attempt = async requestCache => {
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        const response = await fetcher(url, {
          ...options,
          cache: requestCache,
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = new Error(`${label} request failed (${response.status})`);
          error.status = response.status;
          throw error;
        }
        return response;
      } catch (error) {
        if (timedOut && error?.name === "AbortError") {
          const timedOutError = new Error(`${label} request timed out`);
          timedOutError.status = 408;
          throw timedOutError;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    };
    const requestCache = options.cache || "default";
    try {
      return await attempt(requestCache);
    } catch (error) {
      if (requestCache !== "default" || !isTransientLoadError(error)) throw error;
      return attempt("reload");
    }
  }

  async function loadIndex(requestCache = "default") {
    if (!indexPromise || requestCache === "reload") {
      const promise = fetchWithRetry(
        indexUrl,
        { priority: "high", cache: requestCache },
        "Full Daily Office index",
      ).then(response => response.json()).then(validateIndex);
      indexPromise = promise;
      promise.catch(() => {
        if (indexPromise === promise) indexPromise = null;
      });
    }
    return indexPromise;
  }

  async function loadRiteTwo(requestCache = "default") {
    if (!riteTwoPromise || requestCache === "reload") {
      const promise = fetchWithRetry(
        riteTwoUrl,
        { priority: "high", cache: requestCache },
        "Rite II office",
      ).then(response => response.json()).then(validateRiteTwo);
      riteTwoPromise = promise;
      promise.catch(() => {
        if (riteTwoPromise === promise) riteTwoPromise = null;
      });
    }
    return riteTwoPromise;
  }

  async function recordAt(index, section, key, requestCache) {
    const location = index[section]?.[key];
    if (!location) throw new Error(`Full Daily Office ${section.slice(0, -1)} ${key} is unavailable`);
    const [offset, length] = location;
    if (fullPackBytesPromise) {
      const record = parseIndexedRecord(await fullPackBytesPromise, location, false);
      if (!isExpectedRecord(record, section, key)) {
        throw new Error(`Full Daily Office index mismatch for ${key}`);
      }
      return record.value;
    }
    const response = await fetchWithRetry(packUrl, {
      headers: { Range: `bytes=${offset}-${offset + length - 1}` },
      priority: "high",
      cache: requestCache,
    }, `Full Daily Office ${section.slice(0, -1)}`);
    let bytes;
    if (response.status === 200) {
      if (!fullPackBytesPromise) {
        const promise = response.arrayBuffer().then(bytesFrom);
        fullPackBytesPromise = promise;
        promise.catch(() => {
          if (fullPackBytesPromise === promise) fullPackBytesPromise = null;
        });
      } else {
        response.body?.cancel().catch(() => {});
      }
      bytes = await fullPackBytesPromise;
    } else {
      bytes = bytesFrom(await response.arrayBuffer());
    }
    const record = parseIndexedRecord(bytes, location, response.status !== 200);
    if (!isExpectedRecord(record, section, key)) {
      throw new Error(`Full Daily Office index mismatch for ${key}`);
    }
    return record.value;
  }

  async function loadDay(date, { requestCache = "default" } = {}) {
    const cacheKey = `${requestCache}:${date}`;
    if (!dayPromises.has(cacheKey)) {
      const loading = (async () => {
        const [index, riteTwo] = await Promise.all([
          loadIndex(requestCache),
          loadRiteTwo(requestCache),
        ]);
        const context = await recordAt(index, "contexts", date, requestCache);
        const appointmentEntries = await Promise.all(
          [...new Set([context.morning_key, context.evening_key])].map(async key => {
            const section = index.appointments[key] ? "appointments" : "eves";
            return [key, {
              section,
              value: await recordAt(index, section, key, requestCache),
            }];
          }),
        );
        const keyedAppointments = new Map(appointmentEntries);
        const psalmNumbers = new Set();
        for (const [service, key] of [
          ["morning", context.morning_key],
          ["evening", context.evening_key],
        ]) {
          const office = keyedAppointments.get(key)?.value?.[service];
          if (!office) throw new Error(`Daily Office appointment ${key} for ${date} is unavailable`);
          for (const token of selectAppointedPsalms(office, date)) psalmNumbers.add(token.number);
        }
        const content = emptyDailyOfficeContent(riteTwo);
        content.appointments.contexts[date] = context;
        for (const [key, entry] of keyedAppointments) {
          content.appointments[entry.section][key] = entry.value;
        }
        content.psalter.psalms = await Promise.all(
          [...psalmNumbers].sort((left, right) => left - right)
            .map(number => recordAt(index, "psalms", String(number), requestCache)),
        );
        return content;
      });
      const promise = loading().then(
        content => {
          dayPromises.delete(cacheKey);
          return content;
        },
        error => {
          dayPromises.delete(cacheKey);
          throw error;
        },
      );
      dayPromises.set(cacheKey, promise);
    }
    return dayPromises.get(cacheKey);
  }

  async function loadFullBundle() {
    if (!fullBundlePromise) {
      const promise = (async () => {
        const [index, riteTwo] = await Promise.all([loadIndex(), loadRiteTwo()]);
        let text;
        if (fullPackBytesPromise) {
          text = TEXT_DECODER.decode(await fullPackBytesPromise);
        } else {
          const response = await fetchWithRetry(
            packUrl,
            { priority: "low", cache: "default" },
            "Full Daily Office pack",
          );
          text = await response.text();
        }
        return parseFullContentPack(text, riteTwo, index);
      })();
      fullBundlePromise = promise;
      promise.catch(() => {
        if (fullBundlePromise === promise) fullBundlePromise = null;
      });
    }
    return fullBundlePromise;
  }

  return {
    loadDay,
    loadFullBundle,
    prioritizedDates: async today => prioritizedDailyOfficeDates(
      Object.keys((await loadIndex()).contexts),
      today,
    ),
  };
}

export {
  CONTENT_SCHEMAS,
  DAILY_OFFICE_PACK_SCHEMAS,
  DEFAULT_CONTENT_URLS,
};
