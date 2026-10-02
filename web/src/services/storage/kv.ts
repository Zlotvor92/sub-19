/* KLJUČ-VREDNOST SKLADIŠTE sa rezervom u memoriji.

   `localStorage` ume da BACI (kvota puna, privatni režim koji dozvoljava probni 1-bajtni upis a odbija pravi teret) ili
   da ne postoji. Bez hvatanja, upis bi prekinuo pozivaoca na pola posla — a poziva se iz svakog upisa u aplikaciji
   (završen trening, bol, merenje mase): korisnik bi kliknuo, ništa se ne bi desilo, i nigde ne bi pisalo zašto. */

export interface KeyValueStore {
  get(key: string): string | null;
  /** `false` kad skladište odbije upis (vrednost tada ostaje samo u memoriji). */
  set(key: string, value: string): boolean;
  remove(key: string): void;
  /** Da li je trajno skladište uopšte upotrebljivo. */
  readonly persistent: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Probni upis: u nekim režimima `setItem` baca odmah, u nekim tek za pravi teret — ovo hvata prvi slučaj. */
function usable(storage: StorageLike | undefined): storage is StorageLike {
  if (!storage) return false;
  try {
    storage.setItem('__t', '1');
    storage.removeItem('__t');
    return true;
  } catch {
    return false;
  }
}

export function createKeyValueStore(storage?: StorageLike): KeyValueStore {
  const backend = usable(storage) ? storage : undefined;
  const memory = new Map<string, string>();
  return {
    persistent: !!backend,
    get(key) {
      /* Memorija ima prednost: ako je poslednji upis odbijen, tu je najnovija vrednost (u trajnom skladištu je starija). */
      const fresh = memory.get(key);
      if (fresh !== undefined) return fresh;
      if (!backend) return null;
      try {
        return backend.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      if (backend) {
        try {
          backend.setItem(key, value);
          memory.delete(key);
          return true;
        } catch {
          memory.set(key, value); // bar u memoriji, da rad u toku sesije ne propadne
          return false;
        }
      }
      memory.set(key, value);
      return false;
    },
    remove(key) {
      memory.delete(key);
      try {
        backend?.removeItem(key);
      } catch {
        /* nema šta da se uradi */
      }
    }
  };
}

/** Skladište pregledača (ili memorija kad ga nema). */
export function browserStore(): KeyValueStore {
  let ls: StorageLike | undefined;
  try {
    ls = typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    ls = undefined; // pristup samom `localStorage` ume da baci (blokirani kolačići)
  }
  return createKeyValueStore(ls);
}
