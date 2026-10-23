import { generatePlan, adaptGeneratedPlan, routedEngine, profileFor } from '@/test/generators';
import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import {
  initialWizard,
  outlook,
  toGenerationInput,
  weeksHint,
  wizardWarnings
} from '../../onboarding';

/* Stari zajednički engine je obrisan: promena cilja ide generatoru distance plana. */
const { planWithNewGoal } = routedEngine();
import { sessKm } from '../sessions/calc';
import type { PlanGenerationInput } from '../types';

const start = parseIsoDate('2026-10-05') as IsoDate;
const distances = [5000, 10000, 21097.5, 42195];
const input = (dist: number, weeks: number, trainedRecently = true): PlanGenerationInput => ({
  startDate: start,
  raceDate: addDays(start, weeks * 7 - 1),
  raceDistM: dist,
  pb: { distM: 5000, sec: 1320 },
  weeklyKm: 40,
  runDays: 4,
  quality: 2,
  intensity: 'std',
  trainedRecently,
  goalSec: (dist / 1000) * 300
});

describe('short preparation is advisory for every distance', () => {
  it.each(distances)(
    '%s: every shorter cycle, including race week, produces a finite plan and keeps date/goal',
    (dist) => {
      const recommended = profileFor(dist)!.product.minWeeks;
      for (let weeks = 1; weeks < recommended; weeks++)
        for (const trained of [true, false]) {
          const inp = input(dist, weeks, trained);
          const plan = generatePlan(inp);
          if ('error' in plan) throw new Error(`${dist}/${weeks}: ${plan.error}`);
          expect(plan.weeks).toHaveLength(weeks);
          expect(plan.meta.raceDate).toBe(inp.raceDate);
          expect(plan.meta.goalSec).toBe(inp.goalSec);
          expect(plan.meta.dayWarnings.join(' ')).toContain('Skraćena priprema');
          expect(plan.weeks.flatMap((w) => w.days).filter((d) => d.tag === 'trka')).toHaveLength(1);
          for (const week of plan.weeks) {
            expect(Number.isFinite(week.vol)).toBe(true);
            for (const day of week.days) {
              expect(day.desc ?? '').not.toMatch(/NaN|Infinity/);
              if (day.km != null) expect(Number.isFinite(day.km)).toBe(true);
              if (day.session) expect(day.km).toBeCloseTo(sessKm(day.session), 1);
            }
          }
        }
    }
  );
  it.each(distances)(
    '%s: wizard keeps form reference and warning; generation and goal change stay available',
    (dist) => {
      const weeks = profileFor(dist)!.product.minWeeks - 1;
      const w = {
        ...initialWizard(),
        raceDist: dist,
        raceDate: input(dist, weeks).raceDate,
        pbMin: '22',
        pbSec: '00',
        weeklyKm: '40',
        trainedRecently: true
      };
      expect(weeksHint(w, start).kind).toBe('too-short');
      expect(outlook(w, start)?.rows).toHaveLength(3);
      expect(wizardWarnings(w, start)?.join(' ')).toContain('Skraćena priprema');
      const inp = toGenerationInput(w, start)!;
      const stored = adaptGeneratedPlan(generatePlan(inp))!;
      expect(stored).toBeTruthy();
      stored.ulaz = inp;
      const changed = planWithNewGoal(stored, (dist / 1000) * 300, start);
      expect(changed).not.toHaveProperty('error');
    }
  );
  it('nine-week half-marathon is allowed; past and invalid dates remain invalid', () => {
    expect(generatePlan(input(21097.5, 9))).not.toHaveProperty('error');
    expect(
      generatePlan({ ...input(5000, 1), startDate: addDays(start, 4), raceDate: addDays(start, 3) })
    ).toHaveProperty('error');
    expect(generatePlan({ ...input(5000, 1), raceDate: 'bad-date' })).toHaveProperty('error');
  });
});
