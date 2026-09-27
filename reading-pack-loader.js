const INDEX_MAGIC = "DORIDX1\n";
const INDEX_HEADER_BYTES = 8;
const INDEX_ENTRY_BYTES = 18;
const RECORD_WINDOW_BYTES = 4096;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const TEXT_DECODER = new TextDecoder();

function bytesFor(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("Reading index must be binary data");
}

export function parseReadingIndex(value) {
  const bytes = bytesFor(value);
  const magic = TEXT_DECODER.decode(bytes.subarray(0, INDEX_HEADER_BYTES));
  if (magic !== INDEX_MAGIC || (bytes.length - INDEX_HEADER_BYTES) % INDEX_ENTRY_BYTES !== 0) {
    throw new Error("Unsupported reading index");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = [];
  for (let offset = INDEX_HEADER_BYTES; offset < bytes.length; offset += INDEX_ENTRY_BYTES) {
    entries.push({
      date: TEXT_DECODER.decode(bytes.subarray(offset, offset + 10)),
      dateOffset: view.getUint32(offset + 10, true),
      readingOffset: view.getUint32(offset + 14, true),
    });
  }
  return entries;
}

export function prioritizedDates(entries, today) {
  const todayTime = Date.parse(`${today}T12:00:00Z`);
  return entries
    .map(entry => ({
      date: entry.date,
      distance: Math.round((Date.parse(`${entry.date}T12:00:00Z`) - todayTime) / DAY_MILLISECONDS),
    }))
    .filter(entry => entry.distance !== 0)
    .sort((left, right) => Math.abs(left.distance) - Math.abs(right.distance) || right.distance - left.distance)
    .map(entry => entry.date);
}

function firstRecord(bytes, offset, partialResponse) {
  const start = partialResponse ? 0 : offset;
  if (start >= bytes.length) throw new Error("Reading record is outside the returned pack");
  const newline = bytes.indexOf(10, start);
  const end = newline === -1 ? bytes.length : newline;
  if (partialResponse && newline === -1 && bytes.length >= RECORD_WINDOW_BYTES) {
    throw new Error("Reading record exceeds the indexed fetch window");
  }
  return JSON.parse(TEXT_DECODER.decode(bytes.subarray(start, end)));
}

export function mergeReadingBundle(target, source) {
  if (source.header) target.header = source.header;
  for (const [date, day] of source.dates) target.dates.set(date, day);
  for (const [key, reading] of source.readings) target.readings.set(key, reading);
  return target;
}

export function createReadingPackLoader({ indexUrl, packUrl, fetchImpl = globalThis.fetch, parseBundle }) {
  let indexPromise = null;
  let fullBundlePromise = null;
  let fullPackBytesPromise = null;
  const dayPromises = new Map();

  async function loadIndex() {
    if (!indexPromise) {
      indexPromise = (async () => {
        const response = await fetchImpl(indexUrl, { priority: "high" });
        if (!response.ok) throw new Error(`Reading index could not be loaded (${response.status})`);
        const entries = parseReadingIndex(await response.arrayBuffer());
        return { entries, byDate: new Map(entries.map(entry => [entry.date, entry])) };
      })().catch(error => {
        indexPromise = null;
        throw error;
      });
    }
    return indexPromise;
  }

  async function recordAt(offset) {
    const response = await fetchImpl(packUrl, {
      headers: { Range: `bytes=${offset}-${offset + RECORD_WINDOW_BYTES - 1}` },
      priority: "high",
    });
    if (!response.ok) throw new Error(`Reading record could not be loaded (${response.status})`);
    if (response.status === 200) {
      if (!fullPackBytesPromise) {
        const bytesPromise = response.arrayBuffer().then(buffer => new Uint8Array(buffer));
        fullPackBytesPromise = bytesPromise;
        bytesPromise.catch(() => {
          if (fullPackBytesPromise === bytesPromise) fullPackBytesPromise = null;
        });
      } else {
        response.body?.cancel().catch(() => {});
      }
      return firstRecord(await fullPackBytesPromise, offset, false);
    }
    return firstRecord(new Uint8Array(await response.arrayBuffer()), offset, true);
  }

  async function loadDay(date) {
    if (!dayPromises.has(date)) {
      const promise = (async () => {
        const { byDate } = await loadIndex();
        const entry = byDate.get(date);
        if (!entry) throw new Error(`Date ${date} is outside the installed reading pack`);
        const [day, reading] = await Promise.all([recordAt(entry.dateOffset), recordAt(entry.readingOffset)]);
        if (day.type !== "date" || day.date !== date) throw new Error(`Reading index date mismatch for ${date}`);
        if (reading.type !== "reading" || reading.key !== day.key) throw new Error(`Reading index key mismatch for ${date}`);
        return {
          header: null,
          dates: new Map([[day.date, day]]),
          readings: new Map([[reading.key, reading]]),
        };
      })().catch(error => {
        dayPromises.delete(date);
        throw error;
      });
      dayPromises.set(date, promise);
    }
    return dayPromises.get(date);
  }

  async function loadFullBundle() {
    if (!fullBundlePromise) {
      fullBundlePromise = (async () => {
        if (fullPackBytesPromise) {
          const bytesPromise = fullPackBytesPromise;
          try {
            return parseBundle(TEXT_DECODER.decode(await bytesPromise));
          } catch (error) {
            if (fullPackBytesPromise === bytesPromise) fullPackBytesPromise = null;
            throw error;
          }
        }
        const response = await fetchImpl(packUrl, { priority: "low" });
        if (!response.ok) throw new Error(`Readings could not be loaded (${response.status})`);
        return parseBundle(await response.text());
      })().catch(error => {
        fullBundlePromise = null;
        throw error;
      });
    }
    return fullBundlePromise;
  }

  return {
    loadDay,
    loadFullBundle,
    prioritizedDates: async today => prioritizedDates((await loadIndex()).entries, today),
  };
}

export async function loadAroundToday(loader, today, { warmDayCount = 2, onDay = () => {} } = {}) {
  const dates = await loader.prioritizedDates(today);
  const warmCount = Math.min(Math.max(0, warmDayCount), dates.length);
  for (const date of dates.slice(0, warmCount)) {
    const partial = await loader.loadDay(date);
    await onDay(date, partial);
  }

  let fullBundle = null;
  let fullPackFailed = false;
  const fullResult = loader.loadFullBundle()
    .then(bundle => {
      fullBundle = bundle;
      return { kind: "full", bundle };
    })
    .catch(error => {
      fullPackFailed = true;
      return { kind: "full-error", error };
    });

  for (const date of dates.slice(warmCount)) {
    if (fullBundle) return fullBundle;
    if (fullPackFailed) {
      await onDay(date, await loader.loadDay(date));
      continue;
    }
    const result = await Promise.race([
      fullResult,
      loader.loadDay(date).then(partial => ({ kind: "day", date, partial })),
    ]);
    if (result.kind === "full") return result.bundle;
    if (result.kind === "full-error") {
      await onDay(date, await loader.loadDay(date));
      continue;
    }
    await onDay(result.date, result.partial);
    await Promise.resolve();
  }
  return fullBundle || (await fullResult).bundle || null;
}
