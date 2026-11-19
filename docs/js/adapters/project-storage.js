import { openIndexedDbStore, resolveIdbRequest, runObjectStoreTransaction } from '../vendor/indexeddb/indexeddb-adapter.js';
import { restoreAnalysisProject } from '../core/project.js';
import { normalizeEditionCorpus } from '../core/editions.js';

/** Open a local project repository. Inject IndexedDB in headless tests. */
export async function openAnalysisRepository({ indexedDBRef = globalThis.indexedDB } = {}) {
  const db = await openIndexedDbStore({ name: 'discourse-analysis', version: 2,
    stores: [{ name: 'projects', options: { keyPath: 'id' } }, { name: 'editions' }] }, { indexedDBRef });
  db.onversionchange = () => db.close();
  const transact = (mode, operation) => runObjectStoreTransaction(db, 'projects', mode, operation);
  return {
    async list() { return transact('readonly', store => resolveIdbRequest(store.getAll())); },
    async get(id) {
      const record = await transact('readonly', store => resolveIdbRequest(store.get(id)));
      return record ? restoreAnalysisProject(record) : null;
    },
    async save(project) {
      const record = restoreAnalysisProject(project);
      await transact('readwrite', store => resolveIdbRequest(store.put(record)));
    },
    async delete(id) { await transact('readwrite', store => resolveIdbRequest(store.delete(id))); },
    async listEditions() { return runObjectStoreTransaction(db, 'editions', 'readonly', store => resolveIdbRequest(store.getAll())); },
    async saveEdition(input) {
      const corpus = normalizeEditionCorpus(input);
      const key = `${corpus.edition.id}@${corpus.edition.source.version}`;
      await runObjectStoreTransaction(db, 'editions', 'readwrite', store => resolveIdbRequest(store.add(corpus, key)));
    },
    close() { db.close(); },
  };
}
