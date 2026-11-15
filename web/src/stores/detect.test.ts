import { describe, expect, it } from 'vitest';
import { kindOfStoredPlan } from './detect';

/* Drugo puštanje, korak 1 (BRISANJE-PLAN § 2b „Test koji ga brani"): svi uzorci + granični slučajevi. */
type PlanFile = { plan: Record<string, unknown> };
const files = import.meta.glob<PlanFile>('../domain/v4/adapters/fixtures/*.json', {
  import: 'default',
  eager: true
});
const named = (prefix: string): Array<[string, PlanFile]> =>
  Object.entries(files).filter(([p]) => p.split('/').pop()!.startsWith(prefix));

const TODAY = '2026-11-15';
const kind = (genPlan: unknown, isOwner = false, today = TODAY) =>
  kindOfStoredPlan({ genPlan, isOwner }, today);
const meta = (p: PlanFile): Record<string, unknown> => p.plan['meta'] as Record<string, unknown>;

describe('kindOfStoredPlan', () => {
  it('uzorci: 8 × v2 → v2, lični → licni, 12 × stari format → stari', () => {
    const v2 = named('v2-');
    const legacy = named('legacy-');
    expect(v2).toHaveLength(8);
    expect(legacy).toHaveLength(12);
    for (const [p, f] of v2) expect(kind(f.plan), p).toBe('v2');
    for (const [p, f] of legacy) expect(kind(f.plan), p).toBe('stari');
    expect(kind(named('personal.json')[0]![1].plan)).toBe('licni');
  });

  it('nema plana → nema (i za tuđi nalog sa unosima na ugrađenom planu)', () => {
    expect(kind(null)).toBe('nema');
    expect(kind(undefined)).toBe('nema');
  });

  it('v2 ključ bez policyId → v2 (iako ga isLegacyPlan smatra starim)', () => {
    const [, f] = named('v2-hm-a')[0]!;
    const m = { ...meta(f) };
    delete m['policyId'];
    delete m['policyVersion'];
    expect(kind({ ...f.plan, meta: m })).toBe('v2');
  });

  it('trka danas nije prošla; juče jeste; bez datuma trke → prošla', () => {
    const [, f] = named('v2-5k-a')[0]!;
    const withRace = (raceDate: unknown) => ({ ...f.plan, meta: { ...meta(f), raceDate } });
    expect(kind(withRace(TODAY))).toBe('v2');
    expect(kind(withRace('2026-11-14'))).toBe('v2-prosla-trka');
    expect(kind(withRace(undefined))).toBe('v2-prosla-trka');
    expect(kind(withRace('nije-datum'))).toBe('v2-prosla-trka');
  });

  it('„danas" je datum koji šalje pozivalac (Beograd): 23:30 UTC 15. 11. je već 16. 11. u Beogradu', () => {
    const [, f] = named('v2-5k-a')[0]!;
    const p = { ...f.plan, meta: { ...meta(f), raceDate: '2026-11-15' } };
    expect(kind(p, false, '2026-11-15')).toBe('v2');
    expect(kind(p, false, '2026-11-16')).toBe('v2-prosla-trka');
  });

  it('nepoznat oblik ili politika → nepoznat', () => {
    const [, f] = named('legacy-02bcaaa2')[0]!;
    expect(kind({ ...f.plan, meta: { ...meta(f), policyId: '10k-v3' } })).toBe('nepoznat');
    expect(kind({ ...f.plan, meta: { ...meta(f), raceDistM: 7000 } })).toBe('nepoznat');
    expect(kind('plan')).toBe('nepoznat');
    expect(kind([])).toBe('nepoznat');
  });

  it('vlasnik: uvek licni (lični plan ima prednost i nad v2 i nad starim genPlan; vlasnik se nikad ne briše)', () => {
    expect(kind(null, true)).toBe('licni');
    expect(kind(named('v2-hm-a')[0]![1].plan, true)).toBe('licni');
    expect(kind(named('legacy-02bcaaa2')[0]![1].plan, true)).toBe('licni');
  });

  it('meta.licni na tuđem nalogu se ne briše', () => {
    expect(kind(named('personal.json')[0]![1].plan)).toBe('licni');
  });
});
