/* D4 — faze; D5 — gde su rasterećenja (i sadržaj rasteretne nedelje na generisanim planovima). */

import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { buildAllowed, deloadAllowed, deloadWeeks, phaseCounts, phasesOf } from './periodize.ts';
import { inputOf, SCHEDULES } from './testInputs.ts';
import type { Phase, PlanWeek, TenKV2Plan } from './types.ts';

const build = (ph: readonly Phase[]): number =>
  ph.filter((p) => p === 'base' || p === 'development' || p === 'specific').length;
const first = (ph: readonly Phase[], w: number): boolean => w === 1 || ph[w - 2] !== ph[w - 1];

/** Nezavisna provera D5 za skup rasterećenja. */
function legal(ph: readonly Phase[], deloads: readonly number[]): boolean {
  const B = build(ph);
  for (const d of deloads) if (d < 3 || d > B - 1 || first(ph, d)) return false;
  let run = 0;
  for (let w = 1; w <= B; w++) {
    if (deloads.includes(w)) run = 0;
    else {
      run++;
      if (run > 4 || (run === 4 && !first(ph, w))) return false;
    }
  }
  return true;
}

describe('D4: faze', () => {
  it('primeri iz odluke: N=10 → 3/2/3/1/1, N=14 → 4/4/4/1/1, N=18 → 6/6/4/1/1', () => {
    expect(phaseCounts(10)).toEqual({ base: 3, development: 2, specific: 3, taper: 1, race: 1 });
    expect(phaseCounts(14)).toEqual({ base: 4, development: 4, specific: 4, taper: 1, race: 1 });
    expect(phaseCounts(18)).toEqual({ base: 6, development: 6, specific: 4, taper: 1, race: 1 });
  });

  it('za N = 10–18: specifično 3 (B ≤ 11) ili 4, baza = ceil((B − spec)/2), razvoj ostatak', () => {
    for (let N = 10; N <= 18; N++) {
      const B = N - 2;
      const spec = B <= 11 ? 3 : 4;
      const c = phaseCounts(N);
      expect(c, `N=${N}`).toEqual({
        base: Math.ceil((B - spec) / 2),
        development: B - spec - Math.ceil((B - spec) / 2),
        specific: spec,
        taper: 1,
        race: 1
      });
      const ph = phasesOf(N);
      expect(ph.length).toBe(N);
      expect(ph[N - 1]).toBe('race');
      expect(ph[N - 2]).toBe('taper');
    }
  });

  it('svaka nedelja generisanog plana nosi fazu iz odluke generatora (Uslov 6)', () => {
    const r = generateTenKV2(inputOf({ weeks: 15, km: 40, vdot: 50, days: SCHEDULES.B.days }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.weeks.map((w) => w.phase)).toEqual(phasesOf(15));
    expect(r.plan.policyId).toBe('10k-v2');
    expect(r.plan.policyVersion).toBe('10k-v2.1.0');
  });
});

describe('D5: gde su rasterećenja', () => {
  it('N = 10–18: raspored je legalan i ima najmanji mogući broj rasterećenja', () => {
    for (let N = 10; N <= 18; N++) {
      const ph = phasesOf(N);
      const d = deloadWeeks(ph)!;
      expect(d, `N=${N}`).not.toBeNull();
      expect(legal(ph, d), `N=${N} ${d.join()}`).toBe(true);
      // Iscrpno: nijedan legalan raspored sa manje rasterećenja.
      const B = build(ph);
      let best = Infinity;
      for (let m = 0; m < 1 << B; m++) {
        const s = Array.from({ length: B }, (_, i) => i + 1).filter((w) => (m >> (w - 1)) & 1);
        if (s.length < best && legal(ph, s)) best = s.length;
      }
      expect(d.length, `N=${N}`).toBe(best);
    }
  });

  it('nikad: prva nedelja faze, ned 1–2, poslednja nedelja pre tapera, taper, trka; izuzetak 4 samo na prvoj nedelji faze', () => {
    for (let N = 10; N <= 18; N++) {
      const ph = phasesOf(N);
      const B = build(ph);
      for (let w = 1; w <= N; w++) {
        const want = w >= 3 && w <= B - 1 && !first(ph, w);
        expect(deloadAllowed(ph, w), `N=${N} ned ${w}`).toBe(want);
        expect(buildAllowed(ph, w, 2)).toBe(true);
        expect(buildAllowed(ph, w, 3), `N=${N} ned ${w}`).toBe(first(ph, w));
        expect(buildAllowed(ph, w, 4)).toBe(false);
      }
    }
  });

  it('primeri: N=10 → [5], N=14 → [4, 8, 11], N=18 → [4, 8, 12, 15]', () => {
    expect(deloadWeeks(phasesOf(10))).toEqual([5]);
    expect(deloadWeeks(phasesOf(14))).toEqual([4, 8, 11]);
    expect(deloadWeeks(phasesOf(18))).toEqual([4, 8, 12, 15]);
  });

  const plans: TenKV2Plan[] = [];
  for (const N of [10, 13, 16, 18])
    for (const km of [25, 40, 55])
      for (const vdot of [30, 50, 70]) {
        const r = generateTenKV2(inputOf({ weeks: N, km, vdot, days: SCHEDULES.A.days }));
        if (r.ok) plans.push(r.plan);
      }

  it('sadržaj: cilj 0,8 × poslednji ne-rasteretni, 1 kvalitet T ≈ 60 % (naniže, min 2,0), dugi 0,8 ×, ostalo lagano', () => {
    expect(plans.length).toBe(36);
    for (const p of plans) {
      let last: PlanWeek | null = null;
      for (const w of p.weeks) {
        if (w.deload && last) {
          const nominal = Math.round(0.8 * last.targetKm * 10) / 10;
          if (w.fitted === null) expect(w.targetKm).toBe(nominal);
          else expect(w.targetKm).toBeLessThan(nominal);
          const q = w.days.filter((d) => d.workout.kind === 'quality');
          expect(q.length).toBe(1);
          expect(q[0]!.workout.dose!.zone).toBe('T');
          const lastT = last.days.find((d) => d.role === 'q2')!.workout.dose!.doseM;
          const t = q[0]!.workout.dose!.doseM;
          expect(t).toBeGreaterThanOrEqual(2000);
          expect(t <= Math.max(0.6 * lastT, 2000) + 1e-6).toBe(true);
          const lastLong = last.days.find((d) => d.role === 'long')!.workout.km;
          const long = w.days.find((d) => d.role === 'long')!.workout.km;
          expect(long).toBeLessThanOrEqual(Math.floor(8 * lastLong + 1e-9) / 10 + 1e-9);
          expect(w.days.filter((d) => d.role === 'easy').length).toBe(2);
        }
        if (
          !w.deload &&
          (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific')
        )
          last = w;
      }
    }
  });
});
