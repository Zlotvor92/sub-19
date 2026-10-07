import { describe, expect, it } from 'vitest';
import { createAccountStorage, LOCAL_OWNER_KEY } from './accountStorage';
import { LS_KEY, LS_RESCUE_KEY } from './keys';
import { createKeyValueStore } from './kv';

describe('account-scoped local data', () => {
  it('migrates a known legacy account and restores its own data after A → guest → B → A', () => {
    const base = createKeyValueStore();
    base.set(LS_KEY, 'private-A');
    const storage = createAccountStorage(base, 'A');
    expect(storage.kv.get(LS_KEY)).toBe('private-A');
    storage.select(null);
    expect(storage.kv.get(LS_KEY)).toBeNull();
    storage.select('B');
    expect(storage.kv.get(LS_KEY)).toBeNull();
    storage.kv.set(LS_KEY, 'private-B');
    storage.select('A');
    expect(storage.kv.get(LS_KEY)).toBe('private-A');
    storage.select('B');
    expect(storage.kv.get(LS_KEY)).toBe('private-B');
  });
  it('never auto-uploads unowned legacy data into a newly authenticated account', () => {
    const base = createKeyValueStore();
    base.set(LS_KEY, 'unknown-owner');
    const storage = createAccountStorage(base, null);
    storage.select('B');
    expect(storage.kv.get(LS_KEY)).toBeNull();
    storage.select(null);
    expect(storage.kv.get(LS_KEY)).toBe('unknown-owner');
  });
  it('does not trust a stale active mirror after an interrupted account switch', () => {
    const base = createKeyValueStore();
    base.set(LOCAL_OWNER_KEY, 'B');
    base.set(LS_KEY, 'private-A');
    const storage = createAccountStorage(base, 'B');
    expect(storage.kv.get(LS_KEY)).toBeNull();
  });
  it('rescue data and deletion are isolated to the active account', () => {
    const base = createKeyValueStore();
    const storage = createAccountStorage(base, 'A');
    storage.kv.set(LS_KEY, 'A');
    storage.kv.set(LS_RESCUE_KEY, 'broken-A');
    storage.select('B');
    storage.kv.set(LS_KEY, 'B');
    storage.forget();
    storage.select('A');
    expect(storage.kv.get(LS_KEY)).toBe('A');
    expect(storage.kv.get(LS_RESCUE_KEY)).toBe('broken-A');
  });
});
