/* MALI IndexedDB — jedini način da service worker vidi podatke aplikacije (u SW-u nema localStorage). Aplikacija upisuje ovde, `sw.js` čita i briše.
   Nijedna operacija ne baca: pozadina je DODATAK, i neuspeh IndexedDB-a nikad ne sme da zaustavi sinhronizaciju u prvom planu. */

export const IDB_NAME = 'sub19';
export const IDB_STORE = 'red';

/** Ključevi koje čita service worker (v. `sw/sw.js`). */
export const IDB_KEYS = {
  account: 'nalog',
  queuedState: 'stanje',
  unsentSubscription: 'pretplata-neposlata'
} as const;

export interface Idb {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<unknown>;
  remove(key: string): Promise<unknown>;
}

export function createIdb(factory: IDBFactory | undefined): Idb {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      if (!factory) {
        reject(new Error('nema IndexedDB'));
        return;
      }
      const req = factory.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
    });
  const run = (
    mode: IDBTransactionMode,
    job: (s: IDBObjectStore) => IDBRequest
  ): Promise<unknown> =>
    open()
      .then(
        (db) =>
          new Promise<unknown>((resolve, reject) => {
            const req = job(db.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
          })
      )
      .catch(() => null);
  return {
    read: (key) => run('readonly', (s) => s.get(key)),
    write: (key, value) => run('readwrite', (s) => s.put(value, key)),
    remove: (key) => run('readwrite', (s) => s.delete(key))
  };
}
