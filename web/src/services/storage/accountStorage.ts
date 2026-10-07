import { LS_KEY, LS_RESCUE_KEY } from './keys';
import type { KeyValueStore } from './kv';

export const LOCAL_OWNER_KEY = 'sub19-local-owner';
const GUEST = '__guest__';

/** Keep the legacy active key, but never assign its data to a newly signed-in account. */
export function createAccountStorage(base: KeyValueStore, previousSessionUser: string | null) {
  const recordedOwner = base.get(LOCAL_OWNER_KEY);
  let owner = recordedOwner ?? previousSessionUser ?? GUEST;
  const scoped = (key: string, user = owner): string => `${key}:account:${user}`;
  const stateKeys: readonly string[] = [LS_KEY, LS_RESCUE_KEY];
  const archive = (): void => {
    for (const key of stateKeys) {
      const value = base.get(key);
      if (value != null) base.set(scoped(key), value);
    }
  };
  if (recordedOwner == null) archive();
  base.set(LOCAL_OWNER_KEY, owner);
  const kv: KeyValueStore = {
    get persistent() {
      return base.persistent;
    },
    get: (key) => (stateKeys.includes(key) ? base.get(scoped(key)) : base.get(key)),
    set(key, value) {
      if (!stateKeys.includes(key)) return base.set(key, value);
      const saved = base.set(scoped(key), value);
      return base.set(key, value) && saved;
    },
    remove(key) {
      if (stateKeys.includes(key)) base.remove(scoped(key));
      base.remove(key);
    }
  };
  return {
    kv,
    owner: () => (owner === GUEST ? null : owner),
    select(userId: string | null): boolean {
      const next = userId ?? GUEST;
      if (next === owner) return false;
      owner = next;
      base.set(LOCAL_OWNER_KEY, owner);
      for (const key of stateKeys) {
        const value = base.get(scoped(key));
        if (value == null) base.remove(key);
        else base.set(key, value);
      }
      return true;
    },
    forget() {
      for (const key of stateKeys) {
        base.remove(scoped(key));
        base.remove(key);
      }
      base.remove(LOCAL_OWNER_KEY);
    }
  };
}
