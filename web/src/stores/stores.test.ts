import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adaptGeneratedPlan } from '../domain/plan/adapt';
import { migrateState, seedState, type GenPlanState, type PersistedState } from '../domain/state';
import { generatePlan } from '../domain/training/generator/generatePlan';
import { activateNewPlan } from './actions';
import {
  collectPersisted,
  hydratePersisted,
  onPersistRequest,
  useResolvedPlan,
  useTrainingStore,
  useRecoveryStore,
  useSettingsStore,
  useCommunityStore
} from './index';
import { renderHook } from '@testing-library/react';

/* parity: test/state.test.mjs (migracija zadržava nepoznata polja), test/potvrda, test/snaga-trka-polazna (purge). */

function plan(startDate = '2026-01-05', goalSec?: number): GenPlanState {
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate,
      raceDate: '2026-04-12',
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      weeklyKm: 40,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true,
      ...(goalSec ? { goalSec } : {})
    })
  );
  if (!a) throw new Error('plan');
  return a;
}

function fullState(): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  s.genPlan = plan();
  s.log = { g1d1: { status: 'done', km: 8 }, n3d3: { status: 'done' } };
  s.knee = [
    { date: '2026-01-06', pain: 3, part: 'koleno-L' },
    { date: '2026-01-07', pain: 2, src: 'g1d1' }
  ];
  s.kg = [
    { date: '2026-01-06', kg: 72 },
    { date: '2026-01-07', kg: 71.5, src: 'g1d1' }
  ];
  s.t3k = [{ id: 't3k-2026-01-10-ab', date: '2026-01-10', sec: 700 }];
  s.vdotLog = [{ id: 'g1_0', ts: '2026-01-07', vdot: 45, prev: 44, delta: 1, measured: 46 }];
  s.strava = { access: 'x' };
  s.icu = { token: 't', athleteId: 'i1' };
  s.ui = { ...s.ui, geo: { lat: 1, lon: 2 }, satTreninga: 7 };
  s.zajed = { vidljiv: true, nadimak: 'Marko' };
  s['buduce'] = { n: 1 };
  return s;
}

beforeEach(() => hydratePersisted(seedState()));

describe('sklapanje i raspodela stanja', () => {
  it('hydrate → collect vraća ISTO stanje (uključujući nepoznata polja prvog nivoa iz novije verzije)', () => {
    const s = fullState();
    hydratePersisted(s);
    expect(collectPersisted()).toEqual(s);
  });

  it('učitavanje NE okida upis (inače bi se učitano stanje odmah upisalo nazad i poslalo na server)', () => {
    const spy = vi.fn();
    const off = onPersistRequest(spy);
    hydratePersisted(fullState());
    off();
    expect(spy).not.toHaveBeenCalled();
  });

  it('svaka izmena store-a okida upis; kucanje ide odloženo', () => {
    const spy = vi.fn();
    const off = onPersistRequest(spy);
    useTrainingStore.getState().patchLog('g1d1', { note: 'a' }, 'soon');
    useRecoveryStore.getState().setWeight([{ date: '2026-01-06', kg: 70 }]);
    useSettingsStore.getState().patchUi({ lastBackup: '2026-01-08' });
    useCommunityStore.getState().patchSettings({ nadimak: 'x' });
    off();
    expect(spy.mock.calls.map((c) => c[0] as unknown)).toEqual(['soon', 'now', 'now', 'now']);
  });

  it('migrirano stanje prolazi kroz store-ove nepromenjeno', () => {
    const s = migrateState(fullState()) as PersistedState;
    hydratePersisted(s);
    expect(collectPersisted()).toEqual(s);
  });
});

describe('izvedeni plan', () => {
  it('izmene i pomeranja se primenjuju bez mutacije plana', () => {
    hydratePersisted(fullState());
    const before = JSON.stringify(useTrainingStore.getState().genPlan);
    const { result, rerender } = renderHook(() => useResolvedPlan());
    expect(result.current?.weeks.length).toBeGreaterThan(5);
    const day = result.current?.weeks[2]?.days.find((d) => !d.rest && d.tag === 'lako');
    if (!day) throw new Error('nema lakog dana');
    const r = useTrainingStore.getState().setAlt(day.id, { tag: 'odmor' });
    expect(r.ok).toBe(true);
    rerender();
    expect(result.current?.byId.get(day.id)?.rest).toBe(true);
    expect(JSON.stringify(useTrainingStore.getState().genPlan)).toBe(before);
  });

  it('pomeranje dana: ista nedelja da, odrađen dan ne, i poništavanje vraća raspored', () => {
    hydratePersisted(fullState());
    const { result, rerender } = renderHook(() => useResolvedPlan());
    const week = result.current?.weeks[3];
    const [a, b] = (week?.days ?? []).filter((d) => !d.test).slice(0, 2);
    if (!a || !b) throw new Error('dani');
    expect(useTrainingStore.getState().swapDays(a.id, b.id)).toEqual({ ok: true });
    rerender();
    expect(result.current?.byId.get(a.id)?.date).toBe(b.date);
    useTrainingStore.getState().patchLog(a.id, { status: 'done' });
    expect(useTrainingStore.getState().swapDays(a.id, b.id)).toMatchObject({ ok: false });
    useTrainingStore.getState().patchLog(a.id, { status: 'pending' });
    expect(useTrainingStore.getState().undoWeekMoves(week?.w as number)).toBe(true);
    rerender();
    expect(result.current?.byId.get(a.id)?.date).toBe(a.date);
  });

  it('bez plana ili sa pokvarenim planom: nema izvedenog plana, bez izuzetka', () => {
    const { result } = renderHook(() => useResolvedPlan());
    expect(result.current).toBeNull();
    const s = fullState();
    s.genPlan = {
      weeks: [{ w: 1, start: 'nije datum', deload: false, focus: '', days: [] }],
      pred: []
    };
    hydratePersisted(s);
    const again = renderHook(() => useResolvedPlan());
    expect(again.result.current).toBeNull();
    expect(useTrainingStore.getState().setAlt('g1d1', { tag: 'odmor' })).toEqual({
      ok: false,
      err: 'nema plana'
    });
  });
});

describe('aktivacija novog plana', () => {
  it('stari `g` podaci odlaze, lični i test na 3 km ostaju, ručni zapisi o telu ostaju; jedan upis', () => {
    hydratePersisted(fullState());
    const spy = vi.fn();
    const off = onPersistRequest(spy);
    activateNewPlan(plan('2026-02-02', 2400));
    off();
    expect(spy).toHaveBeenCalledTimes(1);
    const s = collectPersisted();
    expect(Object.keys(s.log)).toEqual(['n3d3']); // „g1d1" je otišao
    expect(s.knee).toEqual([{ date: '2026-01-06', pain: 3, part: 'koleno-L' }]); // samo ručni unos ostaje
    expect(s.kg).toEqual([{ date: '2026-01-06', kg: 72 }]);
    expect(s.t3k).toHaveLength(1);
    expect(s.vdotLog.map((e) => e.id)).toEqual([]); // „g1_0" je otišao, a t3k nije imao zapis u lancu
    expect(s.genPlan?.meta).toMatchObject({ start: '2026-02-02' });
  });

  it('lanac forme se preračunava naspram polazne forme NOVOG plana', () => {
    const s = fullState();
    s.vdotLog = [
      { id: 't3k-2026-01-10-ab', ts: '2026-01-10', vdot: 99, prev: 99, delta: 0, measured: 46 }
    ];
    hydratePersisted(s);
    const np = plan('2026-02-02');
    activateNewPlan(np);
    const chain = collectPersisted().vdotLog;
    const base = (np.meta as unknown as { vdot0: number }).vdot0;
    expect(chain).toHaveLength(1);
    expect(chain[0]?.prev).toBe(base);
    expect(chain[0]?.vdot).not.toBe(99);
  });
});
