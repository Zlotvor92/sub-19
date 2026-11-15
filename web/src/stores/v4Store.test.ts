import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import hmFixture from '../domain/v4/adapters/fixtures/v2-hm-a.json';
import { resolvePlan } from '../domain/plan';
import { personalPlan } from '../domain/personal';
import type { GenPlanState } from '../domain/state';
import { adoptActive, toResolved } from '../integrations/v4';
import { currentPlan, useHasPlan, useResolvedPlan, useTrainingStore } from './trainingStore';
import { useRecoveryStore } from './recoveryStore';
import { useV4Store, v4DocOf } from './v4Store';

const plan = (hmFixture as unknown as { plan: GenPlanState }).plan;
const TODAY = plan.weeks[0]?.start ?? '2026-01-05';
const shape = (p: ReturnType<typeof currentPlan>) =>
  p?.dated.map((d) => [d.id, d.date, d.rest, d.km, d.desc]);

function setPlan(p: GenPlanState | null): void {
  useTrainingStore.setState({ genPlan: p, alts: {}, moves: {}, log: {} });
  useRecoveryStore.setState({ knee: [], vanPlana: {} });
}

afterEach(() => {
  useV4Store.setState({ enabled: false, row: null, today: null });
  setPlan(null);
});

describe('grananje prikaza plana (F9 korak 7)', () => {
  it('zastavica ugašena (podrazumevano): isto kao pre, i kad postoji red plana V4', () => {
    setPlan(plan);
    const old = resolvePlan(plan.weeks, { alts: {}, moves: {} });
    expect(shape(currentPlan())).toEqual(shape(old));
    const a = adoptActive({ plan, log: {}, alts: {}, moves: {}, vanPlana: {}, knee: [] }, TODAY);
    if (a.status !== 'preuzet') throw new Error(a.status);
    useV4Store.setState({ row: { doc: a.doc, rev: 1, otisak: a.fingerprint }, today: TODAY });
    expect(useV4Store.getState().enabled).toBe(false);
    expect(shape(currentPlan())).toEqual(shape(old));
    const { result } = renderHook(() => useResolvedPlan());
    expect(shape(result.current)).toEqual(shape(old));
  });

  it('upaljena, bez reda: postojeći plan preuzet adapterom — prikaz dan po dan isti', () => {
    setPlan(plan);
    useV4Store.setState({ enabled: true, today: TODAY });
    const old = resolvePlan(plan.weeks, { alts: {}, moves: {} });
    expect(shape(currentPlan())).toEqual(shape(old));
    const { result } = renderHook(() => useResolvedPlan());
    expect(shape(result.current)).toEqual(shape(old));
  });

  it('upaljena, sa redom plana V4: prikaz iz V4 dokumenta', () => {
    setPlan(null);
    const a = adoptActive({ plan, log: {}, alts: {}, moves: {}, vanPlana: {}, knee: [] }, TODAY);
    if (a.status !== 'preuzet') throw new Error(a.status);
    useV4Store.setState({
      enabled: true,
      today: TODAY,
      row: { doc: a.doc, rev: 3, otisak: a.fingerprint }
    });
    expect(shape(currentPlan())).toEqual(shape(toResolved(a.doc)));
  });

  it('drugo puštanje: zaštita ličnog plana do 13. 12. je ukinuta — uz zastavicu i red prikaz je iz plan_v4', () => {
    const personal = personalPlan(47);
    setPlan(personal);
    const a = adoptActive({ plan, log: {}, alts: {}, moves: {}, vanPlana: {}, knee: [] }, TODAY);
    if (a.status !== 'preuzet') throw new Error(a.status);
    useV4Store.setState({
      enabled: true,
      today: '2026-12-13',
      row: { doc: a.doc, rev: 1, otisak: 'x' }
    });
    expect(shape(currentPlan())).toEqual(shape(toResolved(a.doc)));
  });

  it('pokvaren V4 dokument ne obara prikaz: ostaje stari', () => {
    setPlan(plan);
    useV4Store.setState({
      enabled: true,
      today: TODAY,
      row: { doc: { weeks: 'x' } as never, rev: 1, otisak: 'x' }
    });
    expect(shape(currentPlan())).toEqual(shape(resolvePlan(plan.weeks, { alts: {}, moves: {} })));
  });

  it('useHasPlan: bez plana false; samo plan_v4 → true SAMO pod zastavicom; generisan plan → true', () => {
    setPlan(null);
    const a = adoptActive({ plan, log: {}, alts: {}, moves: {}, vanPlana: {}, knee: [] }, TODAY);
    if (a.status !== 'preuzet') throw new Error(a.status);
    expect(renderHook(() => useHasPlan()).result.current).toBe(false);
    useV4Store.setState({ row: { doc: a.doc, rev: 1, otisak: a.fingerprint }, today: TODAY });
    expect(renderHook(() => useHasPlan()).result.current).toBe(false);
    useV4Store.setState({ enabled: true });
    expect(renderHook(() => useHasPlan()).result.current).toBe(true);
    expect(currentPlan()?.weeks.length).toBe(a.doc.weeks.length);
    useV4Store.setState({ enabled: false, row: null });
    setPlan(plan);
    expect(renderHook(() => useHasPlan()).result.current).toBe(true);
  });

  it('drugo puštanje: lični plan bez reda se preuzima adapterom (isti otisak), prikaz isti kao stari', () => {
    const own = personalPlan(45);
    setPlan(own);
    const snap = { plan: own, log: {}, alts: {}, moves: {}, vanPlana: {}, knee: [] };
    const v4 = { enabled: true, row: null, today: '2026-11-14' };
    const got = v4DocOf(v4, snap);
    expect(got?.source).toBe('preuzet');
    expect(v4DocOf({ ...v4, today: '2026-12-14' }, snap)?.source).toBe('preuzet');
    useV4Store.setState(v4);
    expect(shape(currentPlan())).toEqual(shape(toResolved(got!.doc)));
    const days = (p: ReturnType<typeof currentPlan>) => p?.dated.map((d) => [d.id, d.date, d.km]);
    expect(days(currentPlan())).toEqual(days(resolvePlan(own.weeks, { alts: {}, moves: {} })));
  });
});
