import { normalizeEditionDescriptor, normalizeEditionCorpus, describeEditionBook, parseSblgntBookText,
  canonicalizeEditionTextBytes } from '../core/editions.js';

export const getEditionKey = edition => `${edition.id}@${edition.source.version}`;

/** Load the local catalog. No Bible data is fetched from third-party services. */
export async function loadBundledEditionCatalog({ fetchRef = globalThis.fetch,
  registryUrl = new URL('../../data/editions.json', import.meta.url) } = {}) {
  const response = await fetchRef(registryUrl);
  if (!response.ok) throw new Error('The bundled edition catalog could not be loaded.');
  const registry = await response.json();
  if (registry.format !== 'discourse-edition-registry-v1' || !Array.isArray(registry.editions)) throw new Error('Invalid bundled edition catalog.');
  return registry.editions.map(value => ({ ...normalizeEditionDescriptor(value), format: value.format,
    capabilities: value.capabilities, books: value.books, registryUrl: String(registryUrl), bundled: true }));
}

/** A lazy, retryable book loader with optional local imported corpora.
 * @param {object} options Explicit catalog, fetch, digest and imported data dependencies.
 * @returns {object} list/addCorpus/loadBook operations; no DOM or project-state mutation.
 */
export function createEditionLibrary({ catalog = [], corpora = [], fetchRef = globalThis.fetch,
  digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('') } = {}) {
  const entries = new Map(catalog.map(edition => [getEditionKey(edition), edition]));
  const local = new Map();
  const pending = new Map();

  function addCorpus(input) {
    const corpus = normalizeEditionCorpus(input);
    const key = getEditionKey(corpus.edition);
    if (entries.has(key)) throw new Error('This edition version is already in the library. Use a new version for changed source data.');
    local.set(key, corpus);
    entries.set(key, { ...corpus.edition, books: corpus.books.map(describeEditionBook), bundled: false });
    return corpus;
  }
  for (const corpus of corpora) addCorpus(corpus);

  async function fetchBook(edition, descriptor) {
    const url = new URL(descriptor.path, edition.registryUrl);
    const allowed = new URL('./editions/', edition.registryUrl);
    if (url.origin !== allowed.origin || !url.pathname.startsWith(allowed.pathname)) throw new Error('Book assets must stay inside the local edition directory.');
    const response = await fetchRef(url);
    if (!response.ok) throw new Error(`Could not load ${descriptor.name}. Open the drawer and try again.`);
    const bytes = canonicalizeEditionTextBytes(await response.arrayBuffer());
    if (await digest(bytes) !== descriptor.sha256) throw new Error('Book integrity check failed. Reload the application before retrying.');
    if (edition.format !== 'sblgnt-tab-text') throw new Error('Unsupported bundled book format.');
    const book = parseSblgntBookText(new TextDecoder('utf-8', { fatal: true }).decode(bytes), descriptor);
    return book;
  }

  return {
    list: () => structuredClone([...entries.values()]), addCorpus,
    async loadBook(key, bookId) {
      const edition = entries.get(key);
      const descriptor = edition?.books.find(book => book.id === bookId);
      if (!descriptor) throw new Error('This edition does not contain the selected book.');
      if (local.has(key)) return structuredClone(local.get(key).books.find(book => book.id === bookId));
      const cacheKey = `${key}:${bookId}`;
      if (!pending.has(cacheKey)) pending.set(cacheKey, fetchBook(edition, descriptor).catch(error => { pending.delete(cacheKey); throw error; }));
      return structuredClone(await pending.get(cacheKey));
    },
  };
}
