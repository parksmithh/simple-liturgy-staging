/**
 * Load scripture-pack-v1 JSON from versioned URLs (SW-cached).
 */

const packs = new Map();
const inflight = new Map();

export function createScripturePackLoader({ urls, fetchImpl = globalThis.fetch }) {
  async function loadEdition(editionId) {
    if (packs.has(editionId)) return packs.get(editionId);
    if (inflight.has(editionId)) return inflight.get(editionId);
    const url = urls[editionId];
    if (!url) {
      const err = new Error(`No scripture pack URL for ${editionId}`);
      return Promise.reject(err);
    }
    const promise = (async () => {
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`Scripture pack ${editionId} failed (${response.status})`);
      const pack = await response.json();
      if (pack?.schema !== "scripture-pack-v1") throw new Error(`Unsupported scripture pack ${editionId}`);
      packs.set(editionId, pack);
      return pack;
    })().finally(() => inflight.delete(editionId));
    inflight.set(editionId, promise);
    return promise;
  }

  return {
    loadEdition,
    getCached(editionId) {
      return packs.get(editionId) || null;
    },
    async prefetchAll() {
      const ids = Object.keys(urls);
      await Promise.all(ids.map(id => loadEdition(id).catch(() => null)));
    },
    clear() {
      packs.clear();
      inflight.clear();
    },
  };
}
