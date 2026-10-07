import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../../date';
import { profileFor } from '../distances';
import { sessQKm } from '../sessions/calc';
import type { PlanGenerationInput, TrainingPlan } from '../types';
import { paceForZone } from '../vdot/paceForZone';
import { generatePlan } from './generatePlan';

const START = '2026-10-05' as IsoDate;
function plan(over: Partial<PlanGenerationInput> = {}, weeks = 16): TrainingPlan {
  const result = generatePlan({
    startDate: START,
    raceDate: addDays(START, weeks * 7 - 1),
    raceDistM: 5000,
    pb: { distM: 5000, sec: 1225 },
    weeklyKm: 40,
    runDays: 4,
    quality: 2,
    intensity: 'std',
    _noSuggest: true,
    ...over
  });
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('Audit: current fitness, readiness and independently bounded workouts', () => {
  it('a projected improvement never accelerates prescribed I/T/R paces', () => {
    const p = plan();
    expect(p.meta.vdotGoal).toBeGreaterThan(p.meta.vdot0);
    for (const w of p.weeks.slice(0, -1))
      for (const d of w.days) {
        const s = d.session;
        if (s?.zone === 'I' || s?.zone === 'T' || s?.zone === 'R')
          expect(s.paceSec).toBe(paceForZone(p.meta.vdot0, s.zone));
      }
  });
  it('an aspirational 15-minute goal cannot prescribe 3:00/km to a 25-minute runner', () => {
    const p = plan(
      { pb: { distM: 5000, sec: 1500 }, goalSec: 900, weeklyKm: 35, intensity: 'kons' },
      12
    );
    expect(p.meta.goalSec).toBe(900);
    expect(p.meta.racePace).toBeGreaterThanOrEqual(298);
    expect(p.weeks.flatMap((w) => w.days).some((d) => d.session?.paceSec === 180)).toBe(false);
  });
  it('six-week beginner plan retains four run/walk weeks and no threshold in week one', () => {
    const p = plan(
      {
        trainedRecently: false,
        weeklyKm: 10,
        runDays: 3,
        quality: 1,
        pb: { distM: 5000, sec: 1800 }
      },
      6
    );
    expect(p.meta.baseWeeks).toBe(5);
    for (const w of p.weeks.slice(0, 4)) {
      expect(w.days.some((d) => d.tag === 'rw')).toBe(true);
      expect(w.days.some((d) => d.session)).toBe(false);
    }
  });
  it('12 km of current mileage does not qualify for two quality workouts', () => {
    const p = plan({ weeklyKm: 12, pb: { distM: 5000, sec: 1800 } });
    expect(p.weeks[0]?.days.filter((d) => d.session).length).toBeLessThanOrEqual(1);
  });
  it('480 combinations obey duration and per-session budgets, including low mileage', () => {
    let intervals = 0;
    for (const raceDistM of [5000, 10000, 21097.5, 42195])
      for (const sec of [1000, 1225, 1500, 1800, 2100])
        for (const weeklyKm of [12, 25, 40, 60, 90, 120])
          for (const runDays of [3, 4, 5, 6]) {
            const p = plan({ raceDistM, pb: { distM: 5000, sec }, weeklyKm, runDays });
            for (const w of p.weeks)
              for (const d of w.days) {
                if (d.finish) expect(d.finish.km).toBeLessThan(d.km!);
                expect(
                  w.days.filter((day) => day.session || day.finish).length
                ).toBeLessThanOrEqual(2);
                const s = d.session;
                if (!s) continue;
                const context = `${raceDistM}/${sec}/${weeklyKm}/${runDays} week ${w.w} ${s.kind}`;
                const work = sessQKm(s);
                if (s.zone === 'I') {
                  intervals++;
                  expect(work, context).toBeLessThanOrEqual(Math.min(10, w.vol * 0.08) + 0.051);
                  if (s.type === 'int')
                    expect((s.repM * s.paceSec) / 1000, context).toBeLessThanOrEqual(300);
                  if (s.type === 'pyramid')
                    for (const m of s.reps)
                      expect((m * s.paceSec) / 1000, context).toBeLessThanOrEqual(300);
                }
                if (s.zone === 'R') {
                  expect(work, context).toBeLessThanOrEqual(Math.min(8, w.vol * 0.05) + 0.051);
                  if (s.type === 'int')
                    expect((s.repM * s.paceSec) / 1000, context).toBeLessThanOrEqual(120);
                }
                if (s.zone === 'T') {
                  expect(work, context).toBeLessThanOrEqual(w.vol * 0.1 + 0.051);
                  if (s.type === 'tempo')
                    expect(s.qKm * s.paceSec, context).toBeLessThanOrEqual(
                      profileFor(raceDistM)!.heuristic.tempoMaxSec + 0.1
                    );
                }
              }
          }
    expect(intervals).toBeGreaterThan(1000);
  });
  it('fast finish is structured and replaces the second quality workout', () => {
    const p = plan(
      { raceDistM: 42195, pb: { distM: 42195, sec: 14400 }, weeklyKm: 70, runDays: 5 },
      20
    );
    const weeks = p.weeks.filter((w) => w.days.some((d) => d.finish));
    expect(weeks.length).toBeGreaterThan(0);
    for (const w of weeks) {
      expect(w.days.filter((d) => d.session || d.finish).length).toBeLessThanOrEqual(2);
      for (const d of w.days) if (d.finish) expect(d.finish.km).toBeLessThan(d.km!);
    }
  });
  it('race preparation respects three-day frequency and recovery gaps', () => {
    const p = plan({ runDays: 3, runDows: [1, 3, 7] });
    const running = p.weeks.at(-1)!.days.filter((d) => !!d.km);
    expect(running.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < running.length; i++)
      expect(running[i]!.dow - running[i - 1]!.dow).toBeGreaterThanOrEqual(2);
  });
});
