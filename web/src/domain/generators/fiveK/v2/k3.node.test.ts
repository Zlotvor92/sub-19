/* K3 (5k-v2.16.0, glavni trener krug 2 § 3–4): nezavisne invarijante mreže po pravilu K3-A … K3-F. Brojevi pravila su
   ispisani ovde i u testInputs.ts (k3ILoMin / k3IHiMin), ne čitaju se iz policy.ts. Izveštaj:
   docs/generators-v2/perfection/reports/K3-5K-REPORT.md. */

import { describe, expect, it } from 'vitest';
import { generateFiveKV2 } from './generate.ts';
import { earlyGridInputs, k3IHiMin, k3ILoMin } from './testInputs.ts';
import type { FiveKV2Plan, PlanDay } from './types.ts';
import { validatePlan } from './validate.ts';

const EPS = 1e-6;
const SAMPLE = earlyGridInputs()
  .filter((_, i) => i % 3 === 0)
  .map((c) => ({ id: c.id, r: generateFiveKV2(c.input) }))
  .filter(
    (x): x is { id: string; r: Extract<typeof x.r, { ok: true }> } =>
      x.r.ok && x.r.plan.planType !== 'runWalk'
  )
  .map((x) => ({ id: x.id, p: x.r.plan as FiveKV2Plan }));
const iMin = (d: PlanDay): number =>
  d.workout.segments
    .filter((s) => s.kind === 'rep' && s.zone === 'I')
    .reduce((a, s) => a + s.sec, 0) / 60;
const regular = (p: FiveKV2Plan): boolean => p.paceMode === 'vdot' && p.experience !== 'beginner';

describe('K3-A: rad jednog I treninga po cilju nedelje', () => {
  it('svaki I trening vrhunca ≤ plafon opsega; ne-rasteretna nedelja vrhunca sa I ≥ donja granica', () => {
    let n = 0;
    let atLo = 0;
    for (const { id, p } of SAMPLE) {
      if (!regular(p)) continue;
      const v = p.vdot!;
      for (const w of p.weeks) {
        if (w.phase !== 'peak') continue;
        for (const d of w.days) {
          const m = iMin(d);
          if (m === 0) continue;
          n++;
          expect(m, `${id} ned ${w.index}`).toBeLessThanOrEqual(k3IHiMin(v, w.targetKm) + EPS);
          if (w.deload) continue;
          expect(m, `${id} ned ${w.index}`).toBeGreaterThanOrEqual(k3ILoMin(v, w.targetKm) - EPS);
          if (k3ILoMin(v, w.targetKm) > 0) atLo++;
        }
      }
    }
    expect(n).toBeGreaterThan(300);
    // Pravilo zaista deluje: ima I treninga sa donjom granicom.
    expect(atLo).toBeGreaterThan(100);
  });

  it('uzorak bez grešaka validatora', () => {
    for (const { id, p } of SAMPLE)
      expect(
        validatePlan(p).filter((v) => v.severity === 'error'),
        id
      ).toEqual([]);
  });
});

describe('K3-B: redovan plan sa tačno 4 dana', () => {
  it('lagan ≤ 0,75 × dugi u nedelji izgradnje (nedelja 1: 0,80); koristi prostor iznad 0,70', () => {
    let weeks = 0;
    let over070 = 0;
    let w1Over075 = 0;
    for (const { id, p } of SAMPLE) {
      if (p.input.runDays.length !== 4 || p.experience === 'beginner') continue;
      for (const w of p.weeks) {
        if (w.deload || !['base', 'peak', 'sharpen'].includes(w.phase)) continue;
        const long = w.days.find((d) => d.role === 'long');
        if (!long) continue;
        weeks++;
        const share = w.index === 1 ? 0.8 : 0.75;
        for (const d of w.days.filter((x) => x.role === 'easy')) {
          expect(d.workout.km, `${id} ned ${w.index}`).toBeLessThanOrEqual(
            Math.floor(long.workout.km * share * 10 + 1e-9) / 10 + EPS
          );
          const over = (x: number): boolean =>
            d.workout.km > Math.floor(long.workout.km * x * 10 + 1e-9) / 10 + EPS;
          if (w.index > 1 && over(0.7)) over070++;
          if (w.index === 1 && over(0.75)) w1Over075++;
        }
      }
    }
    expect(weeks).toBeGreaterThan(300);
    // Pravilo zaista deluje: posle nedelje 1 lagan iznad 0,70 × dugi, a u nedelji 1 iznad 0,75 × dugi.
    expect(over070).toBeGreaterThan(50);
    expect(w1Over075).toBeGreaterThan(5);
  });
});
