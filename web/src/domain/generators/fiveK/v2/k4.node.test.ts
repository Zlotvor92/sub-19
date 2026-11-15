/* K4-B (5k-v2.17.0, glavni trener krug 3 § B): mali obim — kratak lagan dan je „odmor ili 20 min lagano po želji".
   Nezavisne invarijante: brojevi pravila (30 min, više od 2 nedelje, početnik ne) ispisani su ovde, ne čitaju se iz
   policy.ts. Izveštaj: docs/generators-v2/perfection/reports/K4-5K-REPORT.md. */

import { describe, expect, it } from 'vitest';
import { generateFiveKV2 } from './generate.ts';
import { earlyGridInputs } from './testInputs.ts';
import type { FiveKV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';

const TAG = 'odmor ili 20 min lagano po želji';
const MIN_SEC = 30 * 60;
const k4Week = (w: PlanWeek): boolean => w.notes.some((n) => n.includes(TAG));
/** Nedelja na koju pravilo gleda: ne-rasteretna izgradnja, dan kvaliteta, bar dva lagana dana, najkraći < 30 min. */
const shortWeek = (w: PlanWeek): boolean => {
  if (w.deload || w.limits || !['base', 'peak', 'sharpen'].includes(w.phase)) return false;
  if (!w.days.some((d) => (d.role === 'q1' || d.role === 'q2') && d.workout.kind === 'quality'))
    return false;
  const e = w.days.filter((d) => d.role === 'easy' && d.countsToWeek).map((d) => d.workout.sec);
  return e.length >= 2 && Math.min(...e) < MIN_SEC;
};
const SAMPLE = earlyGridInputs()
  .map((c) => ({ id: c.id, r: generateFiveKV2(c.input) }))
  .filter(
    (x): x is { id: string; r: Extract<typeof x.r, { ok: true }> } =>
      x.r.ok && x.r.plan.planType !== 'runWalk'
  )
  .map((x) => ({ id: x.id, p: x.r.plan as FiveKV2Plan }));

describe('K4-B: mali obim — kratak lagan dan', () => {
  it('mreža: nedelje K4-B samo u planu sa > 2 takve nedelje (ne početnik), dan manje, planirano ≤ cilj bez upozorenja', () => {
    let hit = 0;
    for (const { id, p } of SAMPLE) {
      const k4 = p.weeks.filter(k4Week);
      expect(
        validatePlan(p).filter((v) => v.severity === 'error'),
        id
      ).toEqual([]);
      if (k4.length === 0) {
        // Plan bez pravila: redovan plan nema više od 2 nedelje sa laganim < 30 min (gde pravilo važi).
        if (p.experience !== 'beginner')
          expect(p.weeks.filter(shortWeek).length, id).toBeLessThanOrEqual(2);
        expect(
          p.notes.some((n) => n.includes(TAG)),
          id
        ).toBe(false);
        continue;
      }
      hit++;
      expect(p.experience, id).not.toBe('beginner');
      expect(k4.length, id).toBeGreaterThan(2);
      expect(
        p.notes.filter((n) => n.startsWith('Mali obim:') && n.includes(TAG)),
        id
      ).toHaveLength(1);
      for (const w of k4) {
        expect(w.deload, `${id} ned ${w.index}`).toBe(false);
        expect(['base', 'peak', 'sharpen']).toContain(w.phase);
        expect(w.days.length, `${id} ned ${w.index}`).toBeLessThanOrEqual(
          p.input.runDays.length - 1
        );
        expect(w.days.filter((d) => d.role === 'easy').length).toBeGreaterThanOrEqual(1);
        expect(w.plannedKm, `${id} ned ${w.index}`).toBeLessThanOrEqual(w.targetKm + 0.05);
        expect(
          p.warnings.filter((v) => v.rule === 'PLANNED_BELOW_TARGET' && v.week === w.index),
          `${id} ned ${w.index}`
        ).toEqual([]);
        // Dan odmora je jedan od datuma nedelje, bez treninga u planu.
        const date = /Mali obim: (\d{4}-\d{2}-\d{2}) /.exec(
          w.notes.find((n) => n.includes(TAG))!
        )?.[1];
        expect(date && date >= w.startDate && date <= w.endDate, `${id} ned ${w.index}`).toBe(true);
        expect(w.days.some((d) => d.date === date)).toBe(false);
      }
    }
    expect(hit).toBeGreaterThan(0);
  });

  it('p06 (5 dana, 25 km, 6 ned): ned 2–4 dan „odmor ili 20 min", 4 treninga, dugi isti', () => {
    const input = {
      startDate: '2026-11-02',
      raceDate: '2026-12-13',
      runDays: ['mon', 'tue', 'thu', 'sat', 'sun'],
      currentWeeklyKm: 25,
      goalTimeSec: null,
      recentResult: { distanceM: 5000, timeSec: 1053, date: '2026-10-19' }
    };
    const r = generateFiveKV2(input);
    expect(r.ok).toBe(true);
    if (!r.ok || r.plan.planType === 'runWalk') return;
    const p = r.plan;
    expect(p.weeks.filter(k4Week).map((w) => w.index)).toEqual([2, 3, 4]);
    for (const i of [2, 3, 4]) expect(p.weeks[i - 1]!.days).toHaveLength(4);
    expect(p.weeks.map((w) => w.days.find((d) => d.role === 'long')?.workout.km)).toEqual([
      7.5,
      6.9,
      7.9,
      8.9,
      8,
      undefined
    ]);
  });
});
