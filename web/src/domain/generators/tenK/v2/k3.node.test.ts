/* K3 (10k-v2.15.0, glavni trener krug 2 § 3–4): nezavisne invarijante mreže po pravilu K3-A … K3-C. Brojevi pravila su
   ispisani ovde i u testInputs.ts (k3RangeSec), ne čitaju se iz policy.ts. Izveštaj:
   docs/generators-v2/perfection/reports/K3-10K-REPORT.md. */

import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { grid02Inputs, k3RangeSec } from './testInputs.ts';
import type { PlanDay, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const SAMPLE: { id: string; p: TenKV2Plan }[] = [];
for (const n of [3, 4, 5, 6] as const)
  for (const c of grid02Inputs(n).filter((_, i) => i % 8 === 1)) {
    const r = generateTenKV2(c.input);
    if (r.ok) SAMPLE.push({ id: c.id, p: r.plan });
  }
/** Rad zone u treningu [s] (deonice i kontinuirano; bez ubrzanja). */
const workSec = (d: PlanDay, zone: string): number =>
  d.workout.segments
    .filter((s) => (s.kind === 'rep' || s.kind === 'continuous') && s.zone === zone)
    .reduce((a, s) => a + s.sec, 0);
const QUALITY_ROLES = new Set(['q1', 'q2']);

describe('K3-A: rad jednog I i RP treninga po cilju nedelje', () => {
  it('svaki I i RP trening ≤ gornja granica opsega; poslednji I razvoja ≥ donja granica u ≥ 90 % planova; RP specifične faze ≥ 22 min u ≥ 99 % nedelja', () => {
    let iSessions = 0;
    let plansWithLo = 0;
    let iAtLo = 0;
    let rpWeeks = 0;
    let rpAtLo = 0;
    for (const { id, p } of SAMPLE) {
      let lastI: { sec: number; lo: number } | null = null;
      for (const w of p.weeks)
        for (const d of w.days) {
          if (!QUALITY_ROLES.has(d.role)) continue;
          const i = workSec(d, 'I');
          const rp = workSec(d, 'RP');
          const ri = k3RangeSec('I', w.targetKm, p.paces.vdot);
          const rr = k3RangeSec('RP', w.targetKm, p.paces.vdot);
          if (i > 0 && ri) {
            iSessions++;
            expect(i, `${id} ned ${w.index} I`).toBeLessThanOrEqual(ri.hi + 1);
            if (w.phase === 'development' && !w.deload && ri.lo > 0) lastI = { sec: i, lo: ri.lo };
          }
          if (rp > 0 && rr) {
            expect(rp, `${id} ned ${w.index} RP`).toBeLessThanOrEqual(rr.hi + 1);
            if (w.phase === 'specific' && !w.deload) {
              rpWeeks++;
              if (rp >= rr.lo - 1) rpAtLo++;
            }
          }
        }
      if (lastI) {
        plansWithLo++;
        if (lastI.sec >= lastI.lo - 1) iAtLo++;
      }
    }
    expect(iSessions).toBeGreaterThan(2000);
    expect(plansWithLo).toBeGreaterThan(500);
    expect(iAtLo / plansWithLo).toBeGreaterThanOrEqual(0.9);
    expect(rpWeeks).toBeGreaterThan(1000);
    expect(rpAtLo / rpWeeks).toBeGreaterThanOrEqual(0.99);
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
  it('lagan ≤ 0,75 × dugi u ne-rasteretnoj nedelji izgradnje; koristi prostor iznad 0,70; 5+ dana ostaje ≤ 0,70', () => {
    let weeks4 = 0;
    let over070 = 0;
    for (const { id, p } of SAMPLE) {
      const n = p.input.runDays.length;
      if (n < 4) continue;
      for (const w of p.weeks) {
        if (w.deload || w.limits || !['base', 'development', 'specific'].includes(w.phase))
          continue;
        const long = w.days.find((d) => d.role === 'long')?.workout.km ?? 0;
        const share = n === 4 ? 0.75 : 0.7;
        for (const d of w.days.filter((x) => x.role === 'easy')) {
          expect(d.workout.km, `${id} ned ${w.index}`).toBeLessThanOrEqual(
            Math.floor(share * long * 10 + 1e-9) / 10 + 1e-9
          );
          if (n === 4 && d.workout.km > Math.floor(0.7 * long * 10 + 1e-9) / 10 + 1e-9) over070++;
        }
        if (n === 4) weeks4++;
      }
    }
    expect(weeks4).toBeGreaterThan(2000);
    // Pravilo zaista deluje: lagani iznad 0,70 × dugi postoje.
    expect(over070).toBeGreaterThan(200);
  });
});

describe('K3-C: redovan plan sa 3 dana — završni T deo dugog u specifičnoj fazi', () => {
  it('ne-rasteretna specifična nedelja: dugi = lagan deo + završnih 10 min (prva) / 15 min (ostale) T, u plafonu T (≤ 10 % cilja); van nje dugi samo lagan; dužina dana iz pravila dužina', () => {
    let withT = 0;
    for (const { id, p } of SAMPLE) {
      const three = p.input.runDays.length === 3;
      let seen = 0;
      for (const w of p.weeks) {
        const long = w.days.find((d) => d.role === 'long');
        if (!long) continue;
        const seg = long.workout.segments;
        const t = seg.filter((s) => s.zone === 'T').reduce((a, s) => a + s.km, 0);
        const on = three && w.phase === 'specific' && !w.deload && !w.limits;
        if (!on) {
          expect(t, `${id} ned ${w.index}`).toBe(0);
          continue;
        }
        const min = seen++ === 0 ? 10 : 15;
        const byMin = Math.floor(((min * 60) / p.paces.T) * 10 + 1e-9) / 10;
        const cap = Math.max(2, Math.floor(0.1 * w.targetKm * 10 + 1e-9) / 10);
        const want = Math.min(byMin, cap);
        expect(t, `${id} ned ${w.index}`).toBeCloseTo(want >= 1 ? want : 0, 6);
        if (t > 0) {
          withT++;
          expect(seg.at(-1)!.zone, `${id} ned ${w.index}`).toBe('T');
          expect(seg.slice(0, -1).every((s) => s.zone === 'E')).toBe(true);
        }
      }
    }
    expect(withT).toBeGreaterThan(300);
  });
});
