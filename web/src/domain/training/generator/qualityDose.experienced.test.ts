import { generatePlan } from '@/test/generators';
import { describe, expect, it } from 'vitest';
import { sessQKm } from '../sessions/calc';
import { applyQualityDose } from '@/domain/generators/tenK/training/distances/qualityDose';
import { PROFILE_10K } from '@/domain/generators/tenK/training/distances/profile10k';
import type { QualityRequest } from '@/domain/generators/tenK/training/distances/types';
import { sessInt } from '@/domain/generators/tenK/training/sessions/build';
import { zoneBudgetKm } from '@/domain/generators/tenK/training/sessions/constraints';
import { validIntervalLeg } from '@/domain/generators/tenK/training/sessions/prescription';
import { HM_WEEKLY_FAST_SHARE } from '@/domain/generators/halfMarathon/training/distances/hmProgression';
import * as hmLoad from '@/domain/generators/halfMarathon/training/generator/weeklyLoad';
import * as marathonLoad from '@/domain/generators/marathon/training/generator/weeklyLoad';
import type { PlanGenerationInput, TrainingPlan, Week } from '../types';
import { paceForZone } from '../vdot/paceForZone';

/* Stari zajednički engine je obrisan: 10K doza ide 10K generatoru, nedeljni omotač brzog rada generatoru distance plana
   (polumaraton/maraton). Jedinični testovi omotača (M završnica) koriste maratonsku kopiju. */
const { finishLoadSec, weeklyFastEnvelopeSec } = marathonLoad;

/* Locked generator-ab QA inputs (docs/qa/generator-ab/inputs.json, commit f8cb208). */
const QA_BASE = {
  startDate: '2026-10-12',
  raceDate: '2027-01-31',
  breakWeeks: 0,
  quality: 2,
  intensity: 'std',
  volIntensity: 'std',
  trainedRecently: true,
  lrDow: 7
} as const;
const U03: PlanGenerationInput = {
  ...QA_BASE,
  raceDistM: 5000,
  pb: { distM: 5000, sec: 1235, date: '2026-09-20' },
  weeklyKm: 50,
  recentLongRunKm: 14,
  consistentWeeks: 24,
  qualityExperience: 'experienced',
  runDays: 5,
  goalSec: 1139
};
const U05: PlanGenerationInput = {
  ...QA_BASE,
  raceDistM: 10000,
  pb: { distM: 10000, sec: 2700, date: '2026-09-20' },
  weeklyKm: 45,
  recentLongRunKm: 14,
  consistentWeeks: 24,
  qualityExperience: 'experienced',
  runDays: 5,
  goalSec: 2520
};

const plan = (inp: PlanGenerationInput): TrainingPlan => {
  const p = generatePlan(structuredClone(inp));
  if ('error' in p) throw new Error(p.error);
  return p;
};
const fastMin = (w: Week): number =>
  w.days.reduce(
    (n, d) =>
      n +
      (d.session ? sessQKm(d.session) * d.session.paceSec : 0) +
      (d.finish ? d.finish.km * d.finish.paceSec : 0),
    0
  ) / 60;
const normal = (p: TrainingPlan): Week[] =>
  p.weeks.filter((w) => !w.deload && !w.taper && w.w < p.meta.weeks);

describe('experienced dose: U03/U05 get a progressive specific dose', () => {
  it('U05 W1 threshold pair is no longer two ~6 min blocks, and still shares one 10 % budget', () => {
    const w1 = plan(U05).weeks[0]!;
    const t = w1.days.filter((d) => d.session?.zone === 'T');
    expect(t).toHaveLength(2);
    // Before: 2×700 m (6.4 min) + 1.2 km (5.5 min) from 0.6/0.4 share × 0.72 dose × floor.
    for (const d of t)
      expect((sessQKm(d.session!) * d.session!.paceSec) / 60).toBeGreaterThanOrEqual(7);
    expect(fastMin(w1)).toBeGreaterThanOrEqual(17);
    expect(t.reduce((n, d) => n + sessQKm(d.session!), 0)).toBeLessThanOrEqual(w1.vol * 0.1 + 0.1);
  });

  it('U03 aerobic intervals keep three or more 3–5 min repetitions from the build onward', () => {
    const p = plan(U03);
    const intervals = normal(p)
      .filter((w) => w.w >= 5)
      .flatMap((w) => w.days.map((d) => ({ w, d })))
      .filter(({ d }) => d.session?.zone === 'I' && d.session.type === 'int');
    expect(intervals.length).toBeGreaterThanOrEqual(4);
    for (const { w, d } of intervals) {
      const s = d.session!;
      if (s.type !== 'int') continue;
      // Before: 2×1200 m (9.5 min) repeated W5/W7/W11 after dose × floor rounding.
      expect(s.reps).toBeGreaterThanOrEqual(3);
      expect(validIntervalLeg(s.repM, s.paceSec)).toBe(true);
      expect(sessQKm(s)).toBeLessThanOrEqual(zoneBudgetKm(s, w.vol) + 1e-9);
      expect((sessQKm(s) * s.paceSec) / 60).toBeGreaterThanOrEqual(12);
    }
  });

  for (const [id, inp] of [
    ['U03', U03],
    ['U05', U05]
  ] as const) {
    it(`${id}: weekly specific work progresses, deloads recover and the final taper is unchanged`, () => {
      const p = plan(inp);
      const n = normal(p);
      const first = fastMin(n[0]!);
      const build = n.filter((w) => w.w >= 5 && w.w <= 11).map(fastMin);
      expect(build.reduce((a, b) => a + b, 0) / build.length).toBeGreaterThan(first);
      expect(Math.max(...build)).toBeGreaterThanOrEqual(30);
      for (const w of p.weeks.filter((x) => x.deload)) expect(fastMin(w)).toBeLessThan(first);
      const taper = p.weeks.find((w) => w.w === p.meta.weeks - 1)!;
      expect(fastMin(taper)).toBeLessThan(Math.max(...build));
      const race = p.weeks.at(-1)!;
      expect(
        race.days.filter((d) => d.session).every((d) => d.session!.kind === 'Aktivacija')
      ).toBe(true);
    });
  }
});

describe('experienced dose depends on continuity, intensity and the shared budget', () => {
  const req = (extra: Partial<QualityRequest> = {}): QualityRequest => ({
    qualW: 1,
    qualWeeks: 16,
    slotRole: 'q1',
    effQ: 2,
    vol: 47.5,
    pI: 230,
    pT: 245,
    pE: 320,
    pR: 215,
    racePace: 270,
    dow: 2,
    isTaper1: false,
    // `ctx` (nedelje bloka) 10K kopija ne koristi, pa ga njen tip nema.
    readiness: 'experienced',
    qualityIntensity: 'std',
    consistentWeeks: 24,
    ...extra
  });

  it('a floor-rounded 2×1000 m cruise is re-fitted inside its 60 % share, not cut further', () => {
    const day = sessInt(2, 3, 2, 1000, 245, 90, 2, 'Tempo isprekidan');
    const s = applyQualityDose(day, req({ workShare: 0.6 })).session;
    expect(s.type).toBe('int');
    if (s.type !== 'int') return;
    expect(sessQKm(s)).toBeGreaterThan(2);
    expect(sessQKm(s)).toBeLessThanOrEqual(47.5 * 0.1 * 0.6 + 1e-9);
    expect(s.reps).toBe(2);
    expect(s.restSec).toBe(90);
  });

  it('8 consistent weeks start lower than 24; kons stays below std', () => {
    const work = (extra: Partial<QualityRequest>): number =>
      sessQKm(PROFILE_10K.buildQuality(req(extra)).session);
    expect(work({ consistentWeeks: 8 })).toBeLessThanOrEqual(work({ consistentWeeks: 24 }));
    expect(work({ qualityIntensity: 'kons' })).toBeLessThan(work({}));
  });

  it('race-specific RP work is never grown above the builder amount', () => {
    const day = sessInt(2, 3, 3, 1200, 270, 60, 2, 'Trkački ritam', 'RP');
    const s = applyQualityDose(day, req({ qualW: 12 })).session;
    expect(sessQKm(s)).toBeLessThanOrEqual(3.6);
    if (s.type === 'int') expect(s.restSec).toBe(60);
  });

  it('a weekly allowance only lowers the dose', () => {
    const free = sessQKm(PROFILE_10K.buildQuality(req({ qualW: 2 })).session);
    const capped = PROFILE_10K.buildQuality(req({ qualW: 2, maxWorkSec: 8 * 60 })).session;
    expect(sessQKm(capped) * capped.paceSec).toBeLessThanOrEqual(8 * 60 + 1e-6);
    expect(sessQKm(capped)).toBeLessThan(free);
  });
});

describe('weekly envelope counts LR fast finishes and demanding long runs', () => {
  it('M-pace finish counts half; a 90+ min LR shrinks the envelope; other readiness has none', () => {
    expect(finishLoadSec({ km: 10, paceSec: 300, zone: 'M' })).toBe(1500);
    expect(finishLoadSec({ km: 5, paceSec: 280, zone: 'RP' })).toBe(1400);
    const x = {
      readiness: 'experienced',
      volKm: 60,
      easyPaceSec: 320,
      longRunPaceSec: 330
    } as const;
    expect(weeklyFastEnvelopeSec({ ...x, longRunKm: 16.5 })).toBeLessThan(
      weeklyFastEnvelopeSec({ ...x, longRunKm: 16 })
    );
    expect(weeklyFastEnvelopeSec({ ...x, readiness: 'developing', longRunKm: 16 })).toBe(Infinity);
  });

  it('experienced HM/marathon finish weeks stay within the envelope of the delivered week', () => {
    for (const inp of [
      {
        ...QA_BASE,
        raceDate: '2027-01-17',
        raceDistM: 21097.5,
        pb: { distM: 5000, sec: 1235, date: '2026-09-20' },
        weeklyKm: 55,
        recentLongRunKm: 16,
        consistentWeeks: 24,
        qualityExperience: 'experienced',
        runDays: 5,
        goalSec: 5700
      },
      {
        ...QA_BASE,
        raceDate: '2027-02-28',
        raceDistM: 42195,
        pb: { distM: 42195, sec: 13500, date: '2026-09-20' },
        weeklyKm: 60,
        recentLongRunKm: 24,
        consistentWeeks: 32,
        qualityExperience: 'experienced',
        runDays: 5,
        goalSec: 12600
      }
    ] as PlanGenerationInput[]) {
      const p = plan(inp);
      const v = p.meta.trainingVdot ?? p.meta.vdot0;
      const finishWeeks = normal(p).filter((w) => w.days.some((d) => d.finish));
      expect(finishWeeks.length).toBeGreaterThan(0);
      for (const w of normal(p)) {
        if (w.days.some((d) => d.session?.kind === 'Kontrolna trka')) continue;
        const lr = w.days.find((d) => d.tag === 'lr' && !d.mlr);
        const load_ = inp.raceDistM === 21097.5 ? hmLoad : marathonLoad;
        const envelope = load_.weeklyFastEnvelopeSec({
          readiness: 'experienced',
          volKm: w.vol,
          easyPaceSec: paceForZone(v, 'E'),
          longRunKm: lr?.km ?? 0,
          longRunPaceSec: paceForZone(v, 'LR'),
          // HM carries threshold + race-pace systems and has its own envelope share.
          share: inp.raceDistM === 21097.5 ? HM_WEEKLY_FAST_SHARE.performance : undefined
        });
        const load = w.days.reduce(
          (n, d) => n + (d.session ? load_.sessionLoadSec(d) : 0) + load_.finishLoadSec(d.finish),
          0
        );
        // The generator sizes against the allocated week; the delivered week may be up
        // to a few percent smaller after the final guards.
        expect(load).toBeLessThanOrEqual(envelope * 1.05);
      }
    }
  });
});
