import { describe, expect, it } from 'vitest';
import { belgradeDate, readV4Cache, v4Startup } from './integrations';
import type { PlanRow } from '../services/v4';
import { WITHOUT_ROW } from '../services/v4';

const ROW = { doc: { engineVersion: 'x' }, rev: 3, otisak: 'o' } as unknown as PlanRow;
const OLD = { doc: { engineVersion: 'staro' }, rev: 2, otisak: 's' } as unknown as PlanRow;
const base = {
  online: true,
  today: '2026-11-14',
  access: () => Promise.resolve({ enabled: true, state: 'ukljucen' }),
  load: () => Promise.resolve({ ok: true as const, row: ROW }),
  same: () => true
};

describe('F9 · učitavač V4 pri pokretanju (puštanje svima)', () => {
  it('puštanje svima: nema reda u v4_pristup = uključen', () => {
    expect(WITHOUT_ROW).toBe(true);
  });
  it('uključen + red → enabled, red, današnji dan; keš se upisuje', async () => {
    expect(await v4Startup(base)).toEqual({
      enabled: true,
      row: ROW,
      today: '2026-11-14',
      cache: 'upisi'
    });
  });
  it('uključen bez reda u plan_v4 → enabled, row null', async () => {
    const r = await v4Startup({ ...base, load: () => Promise.resolve({ ok: true, row: null }) });
    expect(r).toEqual({ enabled: true, row: null, today: '2026-11-14', cache: 'upisi' });
  });
  it('bez mreže i bez keša → isključeno, servis se ne pita', async () => {
    let asked = false;
    const r = await v4Startup({
      ...base,
      online: false,
      access: () => {
        asked = true;
        return Promise.resolve({ enabled: true, state: 'ukljucen' });
      }
    });
    expect(r).toEqual({ enabled: false, row: null, today: '2026-11-14', cache: 'zadrzi' });
    expect(asked).toBe(false);
  });
  it('bez mreže sa kešom → poslednji učitani V4 plan se vidi (korisnik sa samo plan_v4 nije bez plana)', async () => {
    const r = await v4Startup({ ...base, online: false, cached: { row: OLD } });
    expect(r).toEqual({ enabled: true, row: OLD, today: '2026-11-14', cache: 'zadrzi' });
  });
  it('greška mreže pri čitanju zastavice ili plana → keš, a bez keša isključeno', async () => {
    const access = () => Promise.resolve({ enabled: false, state: 'nepoznato' });
    expect(await v4Startup({ ...base, access, cached: { row: OLD } })).toMatchObject({
      enabled: true,
      row: OLD
    });
    expect((await v4Startup({ ...base, access }))?.enabled).toBe(false);
    const thrown = await v4Startup({ ...base, access: () => Promise.reject(new Error('x')) });
    expect(thrown?.enabled).toBe(false);
    const http = await v4Startup({
      ...base,
      load: () => Promise.resolve({ ok: false, reason: 'http', status: 500, retryable: true }),
      cached: { row: OLD }
    });
    expect(http).toMatchObject({ enabled: true, row: OLD, cache: 'zadrzi' });
  });
  it('izričito isključen (red ukljuceno=false) → isključeno i keš se briše, i kad postoji', async () => {
    const r = await v4Startup({
      ...base,
      access: () => Promise.resolve({ enabled: false, state: 'iskljucen' }),
      cached: { row: OLD }
    });
    expect(r).toEqual({ enabled: false, row: null, today: '2026-11-14', cache: 'obrisi' });
  });
  it('nalog promenjen usred učitavanja → ništa se ne upisuje', async () => {
    expect(await v4Startup({ ...base, same: () => false })).toBeNull();
  });
  it('keš: ispravan zapis se čita, pokvaren ili tuđ oblik = nema keša', () => {
    const store = new Map<string, string>();
    const kv = {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => void store.set(k, v),
      remove: (k: string) => void store.delete(k)
    } as never;
    expect(readV4Cache(kv, 'u')).toBeNull();
    store.set('sub19-v1:v4-plan:u', JSON.stringify({ v: 1, row: OLD }));
    expect(readV4Cache(kv, 'u')).toEqual({ row: OLD });
    store.set('sub19-v1:v4-plan:u', '{nije json');
    expect(readV4Cache(kv, 'u')).toBeNull();
    store.set('sub19-v1:v4-plan:u', JSON.stringify({ v: 1, row: { rev: 'x' } }));
    expect(readV4Cache(kv, 'u')).toBeNull();
  });
  it('dan je po Beogradu, ne po UTC', () => {
    expect(belgradeDate(Date.parse('2026-11-14T23:30:00Z'))).toBe('2026-11-15');
    expect(belgradeDate(Date.parse('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(belgradeDate(Date.parse('2026-07-01T22:01:00Z'))).toBe('2026-07-02');
  });
});
