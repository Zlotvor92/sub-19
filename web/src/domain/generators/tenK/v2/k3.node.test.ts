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
