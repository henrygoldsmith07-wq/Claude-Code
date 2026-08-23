/**
 * forq-db — IndexedDB as Forq's primary local database.
 *
 * One database, named object stores per collection. Updates touch single
 * rows ("update one pantry row") instead of serialising the entire app into
 * localStorage. localStorage remains for the small preference shell during
 * the migration; collections move over incrementally starting with
 * mealOutcomes (the Outcome Ledger).
 */

export const FORQ_DB_NAME = 'forq-db';
export const FORQ_DB_VERSION = 1;

/** The full target schema. Stores use keyPath 'id' unless noted. */
export const FORQ_STORES = [
  { name: 'households' },
  { name: 'profiles' },
  { name: 'pantryItems' },
  { name: 'shoppingItems' },
  { name: 'purchaseRecords' },
  { name: 'receipts' },
  { name: 'mealPlans' },
  { name: 'mealOutcomes', options: { keyPath: 'id' } },
  { name: 'foodLogs' },
  { name: 'leftovers' },
  { name: 'wasteRecords' },
  { name: 'prices' },
  { name: 'customRecipes' },
  { name: 'preferences', options: null }, // keyed by string
  { name: 'measurements' },
  { name: 'experiments' },
  { name: 'syncMetadata' },
];

const STORE_BY_NAME = new Map(FORQ_STORES.map((s) => [s.name, s]));

function upgradeDatabase(event) {
  const db = event.target.result;
  for (const store of FORQ_STORES) {
    if (!db.objectStoreNames.contains(store.name)) {
      db.createObjectStore(store.name, store.options ?? {});
    }
  }
}

const defaultOpen = (databaseName, version) => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, version);
  request.onupgradeneeded = upgradeDatabase;
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
});

/**
 * A thin promise client. `openDb` is injectable so tests can supply an
 * in-memory implementation; production uses real IndexedDB.
 */
export function createForqDb({ databaseName = FORQ_DB_NAME, version = FORQ_DB_VERSION, openDb = defaultOpen } = {}) {
  let dbPromise = null;
  const getDb = () => {
    if (!dbPromise) dbPromise = Promise.resolve().then(() => openDb(databaseName, version));
    return dbPromise;
  };

  const withStore = async (storeName, mode, run) => {
    if (!STORE_BY_NAME.has(storeName)) throw new Error(`Unknown forq-db store: ${storeName}`);
    const db = await getDb();
    const tx = db.transaction(storeName, mode);
    // The operation's promise resolves with its result; transaction
    // completion just guarantees durability.
    const outcome = new Promise((resolve, reject) => {
      const request = run(tx.objectStore(storeName));
      if (!request) { resolve(undefined); return; }
      if (typeof request.then === 'function') {
        // Helper already promisified the request.
        request.then(resolve, reject);
        return;
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error(`forq-db ${storeName} request failed`));
    });
    const done = new Promise((resolve) => {
      // Durability gate: native transaction complete when it arrives, with a
      // short timer as a floor so test fakes can never hang the caller.
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      setTimeout(resolve, 25);
    });
    const [result] = await Promise.all([outcome, done]);
    return result;
  };

  const requestResult = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return {
    put: (storeName, value, key) => withStore(storeName, 'readwrite',
      (store) => (key !== undefined ? store.put(value, key) : store.put(value))),
    putMany: (storeName, pairs) => withStore(storeName, 'readwrite', (store) => {
      pairs.forEach(([value, key]) => (key !== undefined ? store.put(value, key) : store.put(value)));
    }),
    get: (storeName, key) => withStore(storeName, 'readonly',
      (store) => requestResult(store.get(key))),
    getAll: (storeName) => withStore(storeName, 'readonly',
      (store) => requestResult(store.getAll())),
    delete: (storeName, key) => withStore(storeName, 'readwrite', (store) => store.delete(key)),
    clear: (storeName) => withStore(storeName, 'readwrite', (store) => store.clear()),
  };
}

let shared = null;
/** Lazy shared client; safe on servers/tests without IndexedDB (returns null). */
export function getForqDb({ indexedDbFactory = typeof indexedDB !== 'undefined' ? indexedDB : null } = {}) {
  if (!indexedDbFactory) return null;
  if (!shared) {
    try {
      shared = createForqDb({ openDb: (name, version) => new Promise((resolve, reject) => {
        const request = indexedDbFactory.open(name, version);
        request.onupgradeneeded = upgradeDatabase;
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }) });
    } catch {
      shared = null;
    }
  }
  return shared;
}

/**
 * Diff-sync one collection: writes new/changed rows, deletes rows that
 * vanished. `previousById` is the caller's last-known snapshot (a Map).
 * Returns the fresh map for next time.
 */
export async function syncCollection(db, storeName, rows = [], previousById = new Map()) {
  const nextById = new Map();
  const writes = [];
  const deletes = [];
  for (const row of rows || []) {
    if (!row?.id) continue;
    nextById.set(row.id, row);
    const before = previousById.get(row.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(row)) {
      writes.push([row]);
    }
  }
  for (const id of previousById.keys()) {
    if (!nextById.has(id)) deletes.push(id);
  }
  if (!db) return nextById;
  if (writes.length) await db.putMany(storeName, writes);
  await Promise.all(deletes.map((id) => db.delete(storeName, id)));
  return nextById;
}
