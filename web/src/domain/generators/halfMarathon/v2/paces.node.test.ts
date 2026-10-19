/* H2 tempo (Daniels–Gilbert, udeli zona, RP = prognoza polumaratona iz trenutnog VDOT-a), H3 ocena cilja. */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import {
  assessGoal,
  pacesFromVdot,
  predictedHm,
  raceTimeForVdot,
  round1,
  vdotFromResult
} from './paces.ts';
import { inputOf, SCHEDULES, timeForVdot } from './testInputs.ts';

describe('H2 tempo', () => {
  it('VDOT iz rezultata (Daniels–Gilbert): 10 km 45:00 → 45,3; HM 1:30:00 → 51,0; maraton 3:30:00 → 44,6', () => {
    expect(round1(vdotFromResult(10000, 2700))).toBe(45.3);
    expect(round1(vdotFromResult(21097.5, 5400))).toBe(51);
    expect(round1(vdotFromResult(42195, 12600))).toBe(44.6);
  });

  it('zone kao udeo VDOT-a; poredak R < I < T, RP < E; RP = prognoza HM / 21,0975 (pri VDOT 80 RP brži od T)', () => {
    for (const v of [30, 45, 60, 80]) {
      const p = pacesFromVdot(v);
      expect(p.R).toBeLessThan(p.I);
      expect(p.I).toBeLessThan(p.T);
      if (v <= 60) expect(p.T).toBeLessThan(p.RP);
      expect(p.RP).toBeLessThan(p.E.fast);
      expect(p.E.fast).toBeLessThan(p.E.slow);
      expect(p.RP).toBe(Math.round(raceTimeForVdot(v, 21097.5) / 21.0975));
      expect(predictedHm(p)).toBe(raceTimeForVdot(v, 21097.5));
    }
    expect(pacesFromVdot(45)).toEqual({
      vdot: 45,
      E: { fast: 334, slow: 368 },
      T: 278,
      I: 256,
      R: 241,
      RP: 285
    });
    expect([pacesFromVdot(80).T, pacesFromVdot(80).RP]).toEqual([174, 173]);
  });

  it('RP iz trenutnog VDOT-a, nikad iz cilja; tempo fiksan kroz plan', () => {
    const inp = inputOf({ weeks: 12, km: 40, vdot: 45, days: SCHEDULES.A.days });
    const a = generateHmV2(inp);
    const b = generateHmV2({ ...inp, goalTimeSec: 5000 });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.plan.paces).toEqual(a.plan.paces);
    const rp = new Set(
      b.plan.weeks
        .flatMap((w) =>
          w.days.flatMap((d) =>
            d.workout.segments.filter((s) => s.zone === 'RP' && s.kind !== 'race')
          )
        )
        .map((s) => s.paceSecPerKm)
    );
    expect([...rp]).toEqual([a.plan.paces.RP]);
  });
});

describe('H3 ocena cilja', () => {
  it('Δ ≤ 0,1·N realističan, ≤ 0,2·N ambiciozan, više nerealan; sporiji od prognoze realističan', () => {
    const v = 45;
    const at = (gap: number): string => assessGoal(v, timeForVdot(v + gap, 21097.5), 12).status;
    expect(at(1.2)).toBe('realistic');
    expect(at(1.3)).toBe('ambitious');
    expect(at(2.4)).toBe('ambitious');
    expect(at(2.5)).toBe('unrealistic');
    expect(at(-3)).toBe('realistic');
  });

  it('nerealan cilj je upozorenje GOAL_UNREALISTIC, ne odbijanje', () => {
    const inp = inputOf({
      weeks: 10,
      km: 40,
      vdot: 45,
      days: SCHEDULES.A.days,
      goalTimeSec: timeForVdot(50, 21097.5)
    });
    const r = generateHmV2(inp);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.goal?.status).toBe('unrealistic');
      expect(r.plan.warnings.some((w) => w.rule === 'GOAL_UNREALISTIC')).toBe(true);
    }
  });
});
