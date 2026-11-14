import { describe, expect, it } from 'vitest';
import { belgradeDate, v4Startup } from './integrations';
import type { PlanRow } from '../services/v4';

const ROW = { doc: { engineVersion: 'x' }, rev: 3, otisak: 'o' } as unknown as PlanRow;
const base = {
  online: true,
  today: '2026-11-14',
  access: () => Promise.resolve({ enabled: true }),
  load: () => Promise.resolve({ ok: true as const, row: ROW }),
  same: () => true
};

describe('F9 korak 7 · učitavač V4 pri pokretanju', () => {
  it('uključen + red → enabled, red i današnji dan', async () => {
    expect(await v4Startup(base)).toEqual({ enabled: true, row: ROW, today: '2026-11-14' });
  });
  it('uključen bez reda u plan_v4 → enabled, row null', async () => {
    const r = await v4Startup({ ...base, load: () => Promise.resolve({ ok: true, row: null }) });
    expect(r).toEqual({ enabled: true, row: null, today: '2026-11-14' });
  });
  it('bez mreže → isključeno, servis se ne pita', async () => {
    let asked = false;
    const r = await v4Startup({
      ...base,
      online: false,
      access: () => {
        asked = true;
        return Promise.resolve({ enabled: true });
      }
    });
    expect(r).toEqual({ enabled: false, row: null, today: '2026-11-14' });
    expect(asked).toBe(false);
  });
  it('zastavica isključena (nema reda, WITHOUT_ROW = false) → isključeno', async () => {
    const r = await v4Startup({ ...base, access: () => Promise.resolve({ enabled: false }) });
    expect(r?.enabled).toBe(false);
  });
  it('greška pri čitanju plana ili izuzetak → isključeno', async () => {
    const http = await v4Startup({
      ...base,
      load: () => Promise.resolve({ ok: false, reason: 'http', status: 500, retryable: true })
    });
    expect(http?.enabled).toBe(false);
    const thrown = await v4Startup({ ...base, access: () => Promise.reject(new Error('x')) });
    expect(thrown?.enabled).toBe(false);
  });
  it('nalog promenjen usred učitavanja → ništa se ne upisuje', async () => {
    expect(await v4Startup({ ...base, same: () => false })).toBeNull();
  });
  it('dan je po Beogradu, ne po UTC', () => {
    expect(belgradeDate(Date.parse('2026-11-14T23:30:00Z'))).toBe('2026-11-15');
    expect(belgradeDate(Date.parse('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(belgradeDate(Date.parse('2026-07-01T22:01:00Z'))).toBe('2026-07-02');
  });
});
