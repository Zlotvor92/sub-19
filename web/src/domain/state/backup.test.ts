import { describe, expect, it } from 'vitest';
import {
  backupPayload,
  buildBackup,
  importBackup,
  migrateState,
  seedState,
  type PersistedState
} from './index';

/* parity: test/bezbednost.test.mjs (uvoz backupa), test/otpornost.test.mjs, test/istorija.test.mjs.
   Svi ovi testovi opisuju GRANICU POVERENJA: uvezeni fajl je proizvoljan JSON. */

function baseState(): PersistedState {
  const s = migrateState({ ...seedState(), v: 11, log: {} }) as PersistedState;
  return s;
}

const withTokens = (): PersistedState => ({
  ...baseState(),
  strava: { access_token: 'STRAVA-SECRET', refresh_token: 'STRAVA-REFRESH' },
  icu: { token: 'ICU-SECRET', apiKey: 'ICU-KEY', athleteId: 'i123' }
});

describe('izvoz', () => {
  it('ne nosi nijedan token, i ne menja stanje', () => {
    const s = withTokens();
    const before = JSON.stringify(s);
    const out = JSON.stringify(backupPayload(s));
    expect(JSON.stringify(s)).toBe(before);
    for (const secret of ['STRAVA-SECRET', 'STRAVA-REFRESH', 'ICU-SECRET', 'ICU-KEY'])
      expect(out).not.toContain(secret);
    expect(out).not.toContain('"strava"');
    expect(out).not.toContain('"icu"');
  });

  it('fajl nosi naziv aplikacije, vreme izvoza i stanje', () => {
    const f = buildBackup(withTokens(), '2026-07-12T10:00:00.000Z');
    expect(f).toMatchObject({ app: 'SUB-19', exportedAt: '2026-07-12T10:00:00.000Z' });
    expect(f.state.v).toBe(11);
  });
});

describe('uvoz', () => {
  it('izvoz → uvoz vraća iste podatke; veze ostaju one koje uređaj već ima', () => {
    const src: PersistedState = {
      ...withTokens(),
      log: { g1d1: { status: 'done', km: 8 } },
      knee: [{ date: '2026-07-01', pain: 3 }],
      kg: [{ date: '2026-07-01', kg: 72 }]
    };
    const file = JSON.parse(
      JSON.stringify(buildBackup(src, '2026-07-12T10:00:00.000Z'))
    ) as unknown;
    const current: PersistedState = {
      ...baseState(),
      strava: { mine: true },
      icu: { token: 'MY-ICU' }
    };
    const r = importBackup(file, current);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.log).toEqual(src.log);
    expect(r.counts).toEqual({ workouts: 1, pain: 1, weight: 1 });
    expect(r.state.strava).toEqual({ mine: true });
    expect(r.state.icu).toEqual({ token: 'MY-ICU' });
  });

  it('TUĐ TOKEN IZ FAJLA NIKAD NE ULAZI U STANJE (stari backup nosi intervals.icu OAuth token koji ne ističe)', () => {
    const foreign = {
      ...baseState(),
      strava: { access_token: 'THEIRS' },
      icu: { token: 'THEIR-ICU', athleteId: 'x' }
    };
    const file = { app: 'SUB-19', state: foreign };
    const current = { ...baseState(), strava: null, icu: null };
    const r = importBackup(file, current);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.strava).toBeNull();
    expect(r.state.icu).toBeNull();
    expect(JSON.stringify(r.state)).not.toContain('THEIR');
  });

  it('prihvata i goli objekat stanja (bez omotača)', () => {
    expect(importBackup(baseState(), baseState()).ok).toBe(true);
  });

  it('ne menja trenutno stanje ni fajl', () => {
    const current = withTokens();
    const file = JSON.parse(JSON.stringify(buildBackup(baseState(), 'x'))) as unknown;
    const a = JSON.stringify(current);
    const b = JSON.stringify(file);
    importBackup(file, current);
    expect(JSON.stringify(current)).toBe(a);
    expect(JSON.stringify(file)).toBe(b);
  });

  it('ne prepoznaje: ne-objekat, stanje iz novije verzije', () => {
    for (const bad of [
      null,
      5,
      'x',
      [],
      { state: 7 },
      { app: 'SUB-19', state: { v: 99, log: {} } }
    ])
      expect(importBackup(bad, baseState()), JSON.stringify(bad)).toEqual({
        ok: false,
        reason: 'unrecognized'
      });
  });

  it('oštećen generisan plan se odbija u celini (nema „skoro ispravnog")', () => {
    const broken = { ...baseState(), genPlan: { weeks: [{ start: 'sutra', days: [] }], pred: [] } };
    expect(importBackup(broken, baseState())).toEqual({ ok: false, reason: 'broken-plan' });
    const numDesc = {
      ...baseState(),
      genPlan: {
        weeks: [{ start: '2026-01-05', days: [{ dow: 0, km: 5, desc: 42, id: 'g1d1' }] }],
        pred: []
      }
    };
    expect(importBackup(numDesc, baseState())).toEqual({ ok: false, reason: 'broken-plan' });
  });

  describe('NAPAD: ID koji izlazi iz HTML atributa se odbija pre nego što dodirne stanje', () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const cases: Array<[string, (s: PersistedState) => unknown]> = [
      ['ključ u log', (s) => ({ ...s, log: { [evil]: { status: 'done' } } })],
      [
        'ključ u alts',
        (s) => ({
          ...s,
          alts: { [evil]: { tag: 'lako', km: 5, desc: 'x', pace: null, rw: null, paceAuto: false } }
        })
      ],
      ['ključ u moves', (s) => ({ ...s, moves: { [evil]: '2026-01-05' } })],
      [
        'id dana u genPlan',
        (s) => ({
          ...s,
          genPlan: {
            weeks: [
              {
                w: 1,
                start: '2026-01-05',
                deload: false,
                focus: '',
                days: [{ dow: 0, km: 5, desc: 'x', id: evil, tag: 'lako' }]
              }
            ],
            pred: []
          }
        })
      ],
      [
        'id PRED reda',
        (s) => ({
          ...s,
          genPlan: {
            weeks: [
              {
                w: 1,
                start: '2026-01-05',
                deload: false,
                focus: '',
                days: [{ dow: 0, km: 5, desc: 'x', id: 'g1d1', tag: 'lako' }]
              }
            ],
            pred: [{ id: evil, w: 1, l: 'x', q: 1, pt: 1, p5k: 1 }]
          }
        })
      ]
    ];
    for (const [name, make] of cases)
      it(name, () => {
        const r = importBackup(make(baseState()), baseState());
        /* Ili se fajl odbija, ili čišćenje (alts/moves) izbaci sumnjiv unos pre nego što stanje nastane —
           bitno je samo da napadačev ID NIKAD ne stigne u stanje. */
        if (r.ok) expect(JSON.stringify(r.state), name).not.toContain('onerror');
        else expect(r.reason, name).toMatch(/bad-id|broken-plan/);
      });
  });
});
