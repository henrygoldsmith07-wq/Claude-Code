import { describe, it, expect } from 'vitest';
import {
  createForqDb, syncCollection, FORQ_DB_NAME, FORQ_STORES,
} from '../src/lib/idb.js';

/** Deterministic synchronous "IndexedDB": enough surface for the wrappers. */
export function fakeOpenFactory() {
  const databases = new Map();
  return (name) => Promise.resolve((() => {
    let db = databases.get(name);
    if (!db) {
      db = { stores: new Map(), objectStoreNames: { contains: (n) => db.stores.has(n) } };
      databases.set(name, db);
    }
    const getStoreMap = (storeName) => {
      let s = db.stores.get(storeName);
      if (!s) { s = new Map(); db.stores.set(storeName, s); }
      return s;
    };
    const wrap = (result) => {
      const req = {};
      queueMicrotask(() => { req.result = result; req.onsuccess?.(); });
      return req;
    };
    return {
      transaction: (storeName) => {
        const s = getStoreMap(storeName);
        const tx = { oncomplete: null, onerror: null, onabort: null };
        const finishLater = () => queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
        return Object.assign(tx, {
          objectStore: () => ({
            put: (value, key) => { s.set(value && value.id !== undefined ? value.id : key ?? 'singleton', JSON.parse(JSON.stringify(value))); finishLater(); },
            get: (key) => { const r = wrap(s.get(key)); finishLater(); return r; },
            getAll: () => { const r = wrap([...s.values()]); finishLater(); return r; },
            delete: (key) => { s.delete(key); finishLater(); },
            clear: () => { s.clear(); finishLater(); },
          }),
        });
      },
    };
  })());
}

describe('forq-db — the full target schema exists', () => {
  it('declares every collection from the migration plan', () => {
    const names = FORQ_STORES.map((s) => s.name);
    for (const expected of ['households', 'profiles', 'pantryItems', 'shoppingItems', 'purchaseRecords',
      'receipts', 'mealPlans', 'mealOutcomes', 'foodLogs', 'leftovers', 'wasteRecords', 'prices',
      'customRecipes', 'preferences', 'measurements', 'experiments', 'syncMetadata']) {
      expect(names).toContain(expected);
    }
    expect(FORQ_DB_NAME).toBe('forq-db');
  });

  it('creates stores on upgrade and round-trips records by id', async () => {
    const db = createForqDb({ openDb: fakeOpenFactory() });
    await db.put('mealOutcomes', { id: 'ole1', revision: 0 });
    await db.put('mealOutcomes', { id: 'ole2', revision: 3 });
    expect(await db.get('mealOutcomes', 'ole2')).toMatchObject({ revision: 3 });
    expect(await db.getAll('mealOutcomes')).toHaveLength(2);
    await db.delete('mealOutcomes', 'ole1');
    expect(await db.getAll('mealOutcomes')).toHaveLength(1);
    await expect(db.put('not-a-store', {})).rejects.toThrow(/Unknown forq-db store/);
  });

  it('keyed-by-string stores accept explicit keys (preferences)', async () => {
    const db = createForqDb({ openDb: fakeOpenFactory() });
    await db.put('preferences', { theme: 'forest' }, 'ui');
    expect(await db.get('preferences', 'ui')).toEqual({ theme: 'forest' });
  });
});

describe('syncCollection — update one row, not the whole world', () => {
  it('writes only new or changed rows and deletes vanished ids', async () => {
    const db = createForqDb({ openDb: fakeOpenFactory() });
    let prev = await syncCollection(db, 'pantryItems', [
      { id: 'a', qty: 1 }, { id: 'b', qty: 2 },
    ]);
    expect(prev.size).toBe(2);

    prev = await syncCollection(db, 'pantryItems', [
      { id: 'a', qty: 1 }, // unchanged
      { id: 'b', qty: 5 }, // changed
      { id: 'c', qty: 9 }, // new
    ], prev);
    expect((await db.getAll('pantryItems')).length).toBe(3);
    expect((await db.get('pantryItems', 'b')).qty).toBe(5);

    prev = await syncCollection(db, 'pantryItems', [{ id: 'a', qty: 1 }], prev);
    expect(await db.getAll('pantryItems')).toHaveLength(1); // b and c deleted
  });

  it('is a no-op passthrough when no database is available', async () => {
    const prev = await syncCollection(null, 'prices', [{ id: 'p', cost: 1 }]);
    expect(prev.get('p').cost).toBe(1);
  });
});
