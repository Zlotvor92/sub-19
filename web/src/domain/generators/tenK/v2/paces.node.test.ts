/* D2 — VDOT i tempo (fiksan kroz plan, RP iz trenutnog VDOT-a); D3 — ocena cilja. */

import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { assessGoal, pacesFromVdot, raceTimeForVdot, round1, vdotFromResult } from './paces.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import { inputOf, SCHEDULES, timeForVdot } from './testInputs.ts';
import type { TenKV2Plan } from './types.ts';

const plan = (o: Partial<Parameters<typeof inputOf>[0]> = {}): TenKV2Plan => {
  const r = generateTenKV2(inputOf({ weeks: 12, km: 40, vdot: 50, days: SCHEDULES.A.days, ...o }));
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};

/** Nezavisna Daniels–Gilbert brzina [m/min] za VO2 (pozitivan koren). */
const speed = (vo2: number): number =>
  (-0.182258 + Math.sqrt(0.182258 ** 2 - 4 * 0.000104 * (-4.6 - vo2))) / (2 * 0.000104);

describe('D2: VDOT i tempo', () => {
  it('VDOT iz rezultata i prognoza su inverzni (Daniels–Gilbert)', () => {
    for (const v of [30, 40, 50, 60, 70, 80]) {
      expect(round1(vdotFromResult(10000, raceTimeForVdot(v, 10000)))).toBe(v);
      expect(round1(vdotFromResult(5000, raceTimeForVdot(v, 5000)))).toBe(v);
    }
  });

  it('zone su udeli VDOT-a iz policy (10K odluka); RP = tempo prognoze 10K', () => {
    for (const v of [30, 45, 60, 75]) {
      const p = pacesFromVdot(v);
      const pace = (f: number): number => Math.round(60000 / speed(v * f));
      expect(p.E).toEqual({ fast: pace(P.paces.eFractionFast), slow: pace(P.paces.eFractionSlow) });
      expect(p.T).toBe(pace(P.paces.tFraction));
      expect(p.I).toBe(pace(P.paces.iFraction));
      expect(p.R).toBe(pace(P.paces.rFraction));
      expect(p.RP).toBe(Math.round(raceTimeForVdot(v, 10000) / 10));
      expect(p.R).toBeLessThan(p.I);
      expect(p.I).toBeLessThan(p.RP);
      expect(p.RP).toBeLessThan(p.T);
      expect(p.T).toBeLessThan(p.E.fast);
      expect(p.E.fast).toBeLessThan(p.E.slow);
    }
  });

  it('RP iz TRENUTNOG VDOT-a: cilj ne menja tempo ni plan', () => {
    const a = plan();
    const b = plan({ goalTimeSec: 38 * 60 });
    expect(b.paces).toEqual(a.paces);
    expect(JSON.stringify(b.weeks)).toBe(JSON.stringify(a.weeks));
  });

  it('tempo je fiksan kroz plan: svaki segment zone koristi tempo plana', () => {
    const p = plan({ weeks: 18, km: 50, vdot: 55 });
    for (const w of p.weeks)
      for (const d of w.days)
        for (const s of d.workout.segments) {
          if (s.kind === 'race') continue;
          const want =
            s.zone === 'E' || s.zone === 'jog'
              ? (p.paces.E.fast + p.paces.E.slow) / 2
              : p.paces[s.zone];
          expect(s.paceSecPerKm, `${w.index} ${d.date} ${s.kind}`).toBe(want);
        }
  });

  it('VDOT plana je iz rezultata (svaka distanca)', () => {
    const p = plan({ result: { distanceM: 21097.5, timeSec: 95 * 60 } });
    expect(p.vdot).toBe(round1(vdotFromResult(21097.5, 95 * 60)));
    expect(p.predicted10kSec).toBe(raceTimeForVdot(p.vdot, 10000));
  });
});

describe('D3: ocena cilja', () => {
  /** Ciljno vreme za VDOT cilja tačno `v`. */
  const goal = (v: number): number => timeForVdot(v);

  it('pragovi 0,1·N i 0,2·N (u desetinkama VDOT-a)', () => {
    const N = 12;
    expect(assessGoal(45, goal(45 + 1.2), N).status).toBe('realistic');
    expect(assessGoal(45, goal(45 + 1.3), N).status).toBe('ambitious');
    expect(assessGoal(45, goal(45 + 2.4), N).status).toBe('ambitious');
    expect(assessGoal(45, goal(45 + 2.5), N).status).toBe('unrealistic');
    expect(assessGoal(45, goal(40), N).status).toBe('realistic');
    expect(assessGoal(45, goal(45 + 1.0), 10).status).toBe('realistic');
    expect(assessGoal(45, goal(45 + 1.1), 10).status).toBe('ambitious');
  });

  it('nerealan cilj = upozorenje, ne odbijanje, ne menja tempo; bez cilja bez ocene', () => {
    const p = plan({ vdot: 45, goalTimeSec: goal(52) });
    expect(p.goal?.status).toBe('unrealistic');
    expect(p.warnings.some((w) => w.rule === 'GOAL_UNREALISTIC' && w.severity === 'warning')).toBe(
      true
    );
    expect(p.paces).toEqual(pacesFromVdot(p.vdot));
    expect(plan({ vdot: 45 }).goal).toBeNull();
    const slow = plan({ vdot: 45, goalTimeSec: goal(40) });
    expect(slow.goal?.status).toBe('realistic');
    expect(slow.warnings.some((w) => w.rule === 'GOAL_UNREALISTIC')).toBe(false);
  });
});
