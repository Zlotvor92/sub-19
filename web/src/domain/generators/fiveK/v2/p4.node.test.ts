/* P4 (5k-v2.13.0, program „trenerski kvalitet v2"): S1 budžet I/RP po cilju nedelje (10 % / 12 %), S2 VDOT do 70,
   B2 odbijanje 3 dana / 12 km / VDOT ≥ 66, O-d oštrenje trkačke nedelje. Brojevi i merne skripte:
   docs/generators-v2/perfection/reports/P4-REPORT.md. */

import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { lowVolumeForPace } from './input.ts';
import { raceTimeForVdot } from './paces.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { earlyFlows, earlyGridBases, START } from './testInputs.ts';
import type { FiveKV2Plan, PlanWeek, Weekday } from './types.ts';
import { validatePlan } from './validate.ts';
import { iMaxShareOf, qualityBudgets } from './workouts.ts';

const DAYS: Record<number, Weekday[]> = {
  3: ['tue', 'thu', 'sun'],
  4: ['tue', 'thu', 'sat', 'sun'],
  5: ['mon', 'tue', 'thu', 'sat', 'sun']
};
const inp = (days: number, km: number, weeks: number, vdot: number): Record<string, unknown> => ({
  startDate: START,
  raceDate: addDays(START, weeks * 7 - 1),
  runDays: DAYS[days],
  currentWeeklyKm: km,
  goalTimeSec: null,
  recentResult: {
    distanceM: 10000,
    timeSec: Math.round(raceTimeForVdot(vdot, 10000)),
    date: addDays(START, -14)
  }
});
const planOf = (x: Record<string, unknown>): FiveKV2Plan => {
  const r = generateFiveKV2(x);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
  return r.plan;
};
const iWork = (w: PlanWeek): number =>
  w.days.reduce((a, d) => a + (d.countsToWeek ? d.workout.workKm.I + d.workout.workKm.RP : 0), 0);
const build = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen');

describe('P4 S1 — budžet I/RP po cilju nedelje', () => {
  it('tabela: cilj < 40 km 10 %, ≥ 40 km 12 % (bilo 8 %)', () => {
    expect(iMaxShareOf(39.9)).toBe(0.1);
    expect(iMaxShareOf(40)).toBe(0.12);
    expect(qualityBudgets(30)).toEqual({ I: 3, T: 3, R: 1.5 });
    expect(qualityBudgets(50)).toEqual({ I: 6, T: 5, R: 2.5 });
  });

  it('plan koristi veći budžet, a I/RP nedelje ≤ udeo tabele', () => {
    let above8 = 0;
    for (const [d, km] of [
      [3, 25],
      [4, 30],
      [4, 45],
      [5, 50]
    ] as const)
      for (const v of [45, 55]) {
        const p = planOf(inp(d, km, 12, v));
        for (const w of p.weeks) {
          if (w.phase === 'race') continue;
          const lim = w.targetKm < 40 ? 0.1 : 0.12;
          expect(iWork(w)).toBeLessThanOrEqual(w.targetKm * lim + 1e-6);
          if (iWork(w) > w.targetKm * 0.08 + 1e-6) above8++;
        }
      }
    expect(above8).toBeGreaterThan(20);
  });

  it('profil (b) 5K 20:25, 30 km, 4 dana, 8 ned: vrh I ≥ 12 min rada, najveći RP trening ≥ 3 km', () => {
    const p = planOf({
      startDate: '2026-10-19',
      raceDate: '2026-12-13',
      runDays: DAYS[4],
      currentWeeklyKm: 30,
      goalTimeSec: 1199,
      recentResult: { distanceM: 5000, timeSec: 1225, date: '2026-10-12' }
    });
    const days = p.weeks.flatMap((w) => w.days);
    const iMin = Math.max(
      ...days.map(
        (d) =>
          d.workout.segments
            .filter((s) => s.kind === 'rep' && s.zone === 'I')
            .reduce((a, s) => a + s.sec, 0) / 60
      )
    );
    const rpKm = Math.max(
      ...days.filter((d) => d.workout.qualityType === 'RP').map((d) => d.workout.workKm.RP)
    );
    expect(iMin).toBeGreaterThanOrEqual(12);
    expect(rpKm).toBeGreaterThanOrEqual(3);
  });

  it('validator obara I/RP iznad udela tabele', () => {
    const p = planOf(inp(4, 30, 12, 50));
    const w = p.weeks.find((x) => build(x) && x.phase === 'peak')!;
    const q = w.days.find((d) => d.workout.qualityType === 'I')!;
    q.workout.workKm.I = w.targetKm * 0.1 + 0.5;
    expect(validatePlan(p).some((v) => v.rule === 'I_SHARE' && v.severity === 'error')).toBe(true);
  });
});

describe('P4 S2 — VDOT do 70', () => {
  it('VDOT 70 daje plan, iznad 70 odbijanje VDOT_OUT_OF_RANGE', () => {
    expect(P.input.vdot.max).toBe(70);
    expect(generateFiveKV2(inp(4, 35, 12, 70)).ok).toBe(true);
    const r = generateFiveKV2(inp(4, 35, 12, 72));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.map((x) => x.code)).toContain('VDOT_OUT_OF_RANGE');
  });

  it('VDOT 62–70: nema degenerisane nedelje, I/RP deonica u izgradnji ≥ 60 s, oporavak ≤ 2 × rad', () => {
    for (const v of [62, 65, 68, 70])
      for (const [d, km] of [
        [3, 13],
        [3, 25],
        [4, 15],
        [4, 35],
        [5, 25],
        [5, 50]
      ] as const)
        for (const weeks of [6, 7, 12]) {
          const p = planOf(inp(d, km, weeks, v));
          expect(p.warnings.map((x) => x.rule)).not.toContain('WEEK_DEGENERATE');
          for (const w of p.weeks) {
            if (w.phase === 'race') continue;
            expect(w.plannedKm).toBeGreaterThanOrEqual(P.days[d].minWeekKm);
            const long = w.days.find((x) => x.role === 'long')!.workout.km;
            for (const x of w.days) {
              expect(x.workout.km).toBeGreaterThan(0);
              if (x.role === 'easy') expect(x.workout.km).toBeLessThanOrEqual(long + 1e-9);
              for (const b of x.workout.blocks) {
                if (b.kind !== 'reps' || b.zone === 'R') continue;
                const rep = x.workout.segments.find((s) => s.kind === 'rep' && s.zone === b.zone)!;
                if (build(w) && (b.zone === 'I' || b.zone === 'RP'))
                  expect(rep.sec).toBeGreaterThanOrEqual(60);
                expect('sec' in b.recovery ? b.recovery.sec : 0).toBeLessThanOrEqual(2 * rep.sec);
              }
            }
          }
        }
  });

  it('O-d: oštrenje trkačke nedelje 300 m RP ispod 60 s je dozvoljeno (svesna odluka)', () => {
    const p = planOf(inp(4, 18, 8, 66));
    const sh = p.weeks.at(-1)!.days.find((d) => d.workout.qualityType === 'RP_sharpener')!;
    const rep = sh.workout.segments.find((s) => s.kind === 'rep')!;
    expect(rep.sec).toBeLessThan(60);
    expect(validatePlan(p).filter((v) => v.severity === 'error')).toEqual([]);
  });
});

describe('P4 B2 — 3 dana, 12 km, VDOT ≥ 66', () => {
  it('klasa: samo 3 dana, < 12,1 km, VDOT ≥ 66', () => {
    expect(lowVolumeForPace(3, 12, 66)).toBe(true);
    expect(lowVolumeForPace(3, 12, 65.9)).toBe(false);
    expect(lowVolumeForPace(3, 12.1, 70)).toBe(false);
    expect(lowVolumeForPace(4, 12, 70)).toBe(false);
  });

  it('ulaz se odbija sa preporukom; 12,1 km i VDOT 65 daju plan', () => {
    for (const weeks of [6, 7, 16]) {
      const r = generateFiveKV2(inp(3, 12, weeks, 68));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reasons.map((x) => x.code)).toEqual(['VOLUME_LOW_FOR_PACE']);
        expect(r.reasons[0]!.message).toContain('4 dana');
      }
    }
    for (const x of [inp(3, 12.1, 6, 68), inp(3, 12, 6, 65)]) {
      const p = planOf(x);
      expect(p.warnings.map((w) => w.rule)).not.toContain('WEEK_DEGENERATE');
    }
  });

  it('validator obara plan te klase (ista funkcija kao ulaz)', () => {
    const p = planOf(inp(3, 12, 6, 65));
    const x = JSON.parse(JSON.stringify(p)) as FiveKV2Plan;
    x.vdot = 68;
    x.input = {
      ...x.input,
      recentResult: { ...x.input.recentResult!, timeSec: Math.round(raceTimeForVdot(68, 10000)) }
    };
    expect(validatePlan(x).map((v) => v.rule)).toContain('VOLUME_LOW_FOR_PACE');
  });

  it('adaptacija: nov rezultat VDOT 68 na planu 3 dana / 12 km se ne primenjuje (RESULT_IGNORED)', () => {
    const p = planOf(inp(3, 12, 8, 60));
    const r = adaptFiveKV2(
      p,
      {
        results: [
          {
            kind: 'race',
            distM: 5000,
            sec: Math.round(raceTimeForVdot(68, 5000)),
            date: addDays(START, 8)
          }
        ]
      },
      addDays(START, 9)
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(
        r.reasons.some((x) => x.condition === 'RESULT_IGNORED' && x.message.includes('4 dana'))
      ).toBe(true);
      expect(r.reasons.some((x) => x.condition === 'NEW_RESULT')).toBe(false);
    }
  });
});

describe('P4 F1 — zadržana I doza posle sporijeg rezultata staje u iRepMaxSec na tekućem tempu (pouka 23)', () => {
  it('r-d5-12w-60km-v38-1 i r-d5-13w-50km-v38-0, sporiji rezultat u vrhuncu: plan bez I_REP (bilo 10 odbijanja)', () => {
    const api = { generate: generateFiveKV2, adapt: adaptFiveKV2 };
    let n = 0;
    for (const id of ['r-d5-12w-60km-v38-1', 'r-d5-13w-50km-v38-0']) {
      const eb = earlyGridBases().find((x) => x.id === id)!;
      for (const f of earlyFlows(eb.id, eb.input, api)) {
        if (!f.key.endsWith('/slower')) continue;
        const r = f.res as { ok: boolean; plan?: FiveKV2Plan; violations?: { rule: string }[] };
        expect([f.key, r.ok, (r.violations ?? []).map((v) => v.rule)]).toEqual([f.key, true, []]);
        for (const w of r.plan!.weeks)
          for (const d of w.days)
            expect(d.workout.maxBoutSec.I).toBeLessThanOrEqual(P.quality.iRepMaxSec);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });
});
