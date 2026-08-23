/** Deterministic synchronous "IndexedDB" for tests: enough surface for the promise wrappers. */
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
      queueMicrotask(() => { req.result = result;  req.onsuccess?.(); });
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
