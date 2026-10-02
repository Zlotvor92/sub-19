/* Rekalibracija plana u store-ovima: posle nje se plan i izmerena forma SLAŽU (nema predloga tempa), a lanac forme kreće od iste
   polazne tačke kao pre (`planBaselineVdot`) — inače bi se prošlost lanca pomerila. */

import { beforeEach, describe, expect, it } from 'vitest';
import { adaptGeneratedPlan, planBaselineVdot, resolvePlan } from '../domain/plan';
import { seedState, type PersistedState } from '../domain/state';
import { generatePlan } from '../domain/training/generator/generatePlan';
import type { PlanGenerationInput } from '../domain/training/types';
import { hydratePersisted, useTrainingStore } from './index';
import { workPaceContext } from './dayActions';
import { commitRecalibration, currentVdotProposal, previewRecalibration } from './raceActions';

const INPUT: PlanGenerationInput = {
  startDate: '2026-01-05',
  raceDate: '2026-05-31',
  raceDistM: 10000,
  pb: { distM: 10000, sec: 2700 },
  weeklyKm: 40,
  runDays: 5,
  quality: 2,
  intensity: 'std',
  trainedRecently: true
};
const TODAY = '2026-02-18';

function state(form: number): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const a = adaptGeneratedPlan(generatePlan(INPUT));
  if (!a) throw new Error('plan');
  s.genPlan = { ...a, ulaz: INPUT };
  s.vdotLog = [0, 1, 2, 3].map((i) => ({
    id: `t${i}`,
    ts: `2026-02-0${i + 1}`,
    vdot: form,
    prev: null,
    delta: null,
    measured: form
  }));
  return s;
}
const resolved = () => {
  const t = useTrainingStore.getState();
  if (!t.genPlan) throw new Error('nema plana');
  return resolvePlan(t.genPlan.weeks, { alts: t.alts, moves: t.moves });
};

beforeEach(() => hydratePersisted(state(50.5)));

describe('rekalibracija: plan i forma se posle nje slažu', () => {
  it('pre: postoji predlog tempa (razlika ≥ 1,5); posle rekalibracije: nema ga', () => {
    expect(currentVdotProposal(resolved(), TODAY)).not.toBeNull();
    const pv = previewRecalibration(resolved(), TODAY);
    if (!pv.ok) throw new Error(pv.reason);
    commitRecalibration(pv.result);
    expect(currentVdotProposal(resolved(), TODAY)).toBeNull();
    // i dalje nema izmene: plan i forma su na istoj putanji
    const again = previewRecalibration(resolved(), TODAY);
    expect(again.ok).toBe(false);
  });

  it('polazna forma za lanac ostaje stvarna (workPaceContext, planBaselineVdot)', () => {
    const before = planBaselineVdot(useTrainingStore.getState().genPlan?.meta);
    expect(workPaceContext({ id: '' }).baselineVdot).toBe(before);
    const pv = previewRecalibration(resolved(), TODAY);
    if (!pv.ok) throw new Error(pv.reason);
    commitRecalibration(pv.result);
    expect(workPaceContext({ id: '' }).baselineVdot).toBe(before);
    const m = useTrainingStore.getState().genPlan?.meta as { vdot0: number };
    expect(m.vdot0).not.toBe(before); // virtuelna polazna tačka putanje je drugačija
  });

  it('lanac forme, dnevnik i izmene se ne diraju', () => {
    const t0 = useTrainingStore.getState();
    const snap = JSON.stringify({
      log: t0.log,
      alts: t0.alts,
      moves: t0.moves,
      vdotLog: t0.vdotLog
    });
    const pv = previewRecalibration(resolved(), TODAY);
    if (!pv.ok) throw new Error(pv.reason);
    commitRecalibration(pv.result);
    const t1 = useTrainingStore.getState();
    expect(
      JSON.stringify({ log: t1.log, alts: t1.alts, moves: t1.moves, vdotLog: t1.vdotLog })
    ).toBe(snap);
  });

  it('bez izmerene forme nema pregleda', () => {
    hydratePersisted({ ...state(50.5), vdotLog: [] });
    const pv = previewRecalibration(resolved(), TODAY);
    expect(pv.ok).toBe(false);
  });
});
