import { afterEach, describe, expect, it } from 'vitest';
import { seedState, type PersistedState } from '../domain/state';
import { ADMIN_UID } from '../services/config';
import { discardLegacyPlan, guardStoredPlan } from './actions';
import { useAuthStore } from './authStore';
import { collectPersisted, hydratePersisted } from './index';

/* Drugo puštanje, korak 1 (BRISANJE-PLAN § 2b, § 2d): posle radnje ostaju TAČNO polja iz § 2d „ostaje", ostalo je
   prazno; v2 i lični plan čuvar ne dira (bajt-isto). */
type PlanFile = { plan: Record<string, unknown> };
type StateFile = { plan: string; today: string; state: Record<string, unknown> };
const plans = import.meta.glob<PlanFile>('../domain/v4/adapters/fixtures/*.json', {
  import: 'default',
  eager: true
});
const states = import.meta.glob<StateFile>('../domain/v4/adapters/fixtures/states/*.json', {
  import: 'default',
  eager: true
});
const planOf = (name: string): Record<string, unknown> => {
  const f = plans[`../domain/v4/adapters/fixtures/${name}.json`];
  if (!f) throw new Error(name);
  return f.plan;
};
const base = (p: string): string => p.replace(/^.*\//, '').replace(/\.json$/, '');
const TODAY = '2026-11-15';

/** Puno stanje: plan + snimljeni unosi uz njega + sve što mora da ostane (merenja, podešavanja, ručni unosi). */
function fullState(genPlan: unknown, extra: Record<string, unknown> = {}): PersistedState {
  const s = seedState('2026-01-01');
  return {
    ...s,
    ...extra,
    genPlan: genPlan as PersistedState['genPlan'],
    log: { g1d1: { km: 8, ts: '2026-01-06' }, n1d1: { km: 5 }, ...(extra['log'] as object) },
    alts: { g1d2: { desc: 'izmena' }, ...(extra['alts'] as object) },
    moves: { g1d3: 'g1d4', ...(extra['moves'] as object) },
    pred: { g1d1: { sec: 1 } },
    predLock: { g1d1: true },
    vdotLog: [{ date: '2026-01-06', vdot: 47, src: 'g1d1' }],
    vanPlana: { '2026-01-07': 6, ...(extra['vanPlana'] as object) },
    vanPlanaV2: { 'strava:1': { date: '2026-01-07', km: 6 } },
    knee: [
      { date: '2026-01-06', pain: 2, src: 'g1d1' },
      { date: '2026-01-08', pain: 1, src: null, part: 'koleno' },
      { date: '2026-01-09', pain: 3 }
    ],
    kg: [
      { date: '2026-01-06', kg: 70, src: 'g1d1' },
      { date: '2026-01-08', kg: 69.5, src: null }
    ],
    t3k: [{ id: 't1', date: '2026-01-02', sec: 720 }],
    wellness: { '2026-01-06': { hrv: 60, rhr: 48 } },
    vreme: { at: 1, sati: {} },
    strava: null,
    icu: null,
    zajed: { vidljiv: true, nadimak: 'trkac' },
    ui: {
      ...s.ui,
      lastBackup: '2026-01-05',
      snooze: { do: '2026-01-10' },
      seenWeek: 3,
      geo: { lat: 44.8, lon: 20.4 },
      satTreninga: 7,
      novo: 'x'
    },
    nepoznatoPolje: { a: 1 }
  } as unknown as PersistedState;
}

const KEPT = ['v', 't3k', 'wellness', 'vreme', 'zajed', 'icu', 'strava', 'nepoznatoPolje'] as const;

afterEach(() => {
  useAuthStore.setState({ hasSession: false, userId: null });
  hydratePersisted(seedState(null));
});

const legacyStates = (): Array<[string, PersistedState]> => [
  ...Object.keys(plans)
    .map(base)
    .filter((n) => n.startsWith('legacy-'))
    .map((n): [string, PersistedState] => [n, fullState(planOf(n))]),
  ...Object.entries(states)
    .filter(([p]) => base(p).startsWith('legacy-'))
    .map(([p, f]): [string, PersistedState] => [base(p), fullState(planOf(f.plan), f.state)])
];

describe('discardLegacyPlan / guardStoredPlan', () => {
  it('stari format: ostaju tačno polja iz § 2d, ostalo prazno (svih 12 uzoraka + snimljena stanja)', () => {
    const all = legacyStates();
    expect(all.length).toBeGreaterThanOrEqual(16);
    for (const [name, before] of all) {
      hydratePersisted(before);
      expect(guardStoredPlan(TODAY), name).toBe('stari');
      const after = collectPersisted() as unknown as Record<string, unknown>;
      const b = before as unknown as Record<string, unknown>;
      for (const k of KEPT)
        expect(JSON.stringify(after[k]), `${name}: ${k}`).toBe(JSON.stringify(b[k]));
      expect(after['genPlan'], name).toBeNull();
      for (const k of ['log', 'alts', 'moves', 'pred', 'predLock', 'vanPlana'])
        expect(after[k], `${name}: ${k}`).toEqual({});
      expect(after['vdotLog'], name).toEqual([]);
      expect(
        (JSON.parse(JSON.stringify(after)) as Record<string, unknown>)['vanPlanaV2'],
        name
      ).toBeUndefined();
      expect(after['knee'], name).toEqual([
        { date: '2026-01-08', pain: 1, src: null, part: 'koleno' },
        { date: '2026-01-09', pain: 3 }
      ]);
      expect(after['kg'], name).toEqual([{ date: '2026-01-08', kg: 69.5, src: null }]);
      expect(after['ui'], name).toEqual({ ...(b['ui'] as object), seenWeek: null, snooze: null });
      expect(Object.keys(JSON.parse(JSON.stringify(after)) as object).sort(), name).toEqual(
        Object.keys(b)
          .filter((k) => k !== 'vanPlanaV2')
          .sort()
      );
    }
  });

  it('v2 sa prošlom trkom i nepoznat oblik → uklanja se', () => {
    const v2 = planOf('v2-hm-a');
    const past = { ...v2, meta: { ...(v2['meta'] as object), raceDate: '2026-11-14' } };
    hydratePersisted(fullState(past));
    expect(guardStoredPlan(TODAY)).toBe('v2-prosla-trka');
    expect(collectPersisted().genPlan).toBeNull();
    const legacy = planOf('legacy-02bcaaa2');
    hydratePersisted(
      fullState({ ...legacy, meta: { ...(legacy['meta'] as object), policyId: '10k-v3' } })
    );
    expect(guardStoredPlan(TODAY)).toBe('nepoznat');
    expect(collectPersisted().genPlan).toBeNull();
  });

  it('v2 (trka nije prošla), lični plan, nema plana, vlasnik: čuvar ne dira ništa (bajt-isto)', () => {
    const cases: Array<[string, PersistedState, boolean, string]> = [
      ...Object.keys(plans)
        .map(base)
        .filter((n) => n.startsWith('v2-'))
        .map((n): [string, PersistedState, boolean, string] => [
          n,
          fullState(planOf(n)),
          false,
          'v2'
        ]),
      ['personal', fullState(planOf('personal')), false, 'licni'],
      ['nema', fullState(null), false, 'nema'],
      ['vlasnik bez genPlan', fullState(null), true, 'licni'],
      ['vlasnik sa starim genPlan', fullState(planOf('legacy-02bcaaa2')), true, 'licni']
    ];
    for (const [name, st, owner, kind] of cases) {
      useAuthStore.setState(
        owner ? { hasSession: true, userId: ADMIN_UID } : { hasSession: false, userId: null }
      );
      hydratePersisted(st);
      const before = JSON.stringify(collectPersisted());
      expect(guardStoredPlan(TODAY), name).toBe(kind);
      expect(JSON.stringify(collectPersisted()), name).toBe(before);
    }
  });

  it('radnja sama (bez čuvara) radi isto i nad praznim stanjem', () => {
    hydratePersisted(seedState('2026-01-01'));
    discardLegacyPlan();
    const s = collectPersisted();
    expect(s.genPlan).toBeNull();
    expect(s.log).toEqual({});
  });
});
