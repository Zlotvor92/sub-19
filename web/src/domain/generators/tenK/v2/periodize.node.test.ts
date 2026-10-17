/* D4 — faze, D21 — kratka priprema 8–9 ned; D5 — gde su rasterećenja (i sadržaj rasteretne nedelje). */

import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { buildAllowed, deloadAllowed, deloadWeeks, phaseCounts, phasesOf } from './periodize.ts';
import { GRID_02, inputOf, SCHEDULES, SCHEDULES_BY_DAYS } from './testInputs.ts';
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

  it('D21: B ≤ 7 → specifično 2, razvoj ceil((B − 2)/2), baza ostatak: 8 → 2/2/2/1/1, 9 → 2/3/2/1/1', () => {
    expect(phaseCounts(8)).toEqual({ base: 2, development: 2, specific: 2, taper: 1, race: 1 });
    expect(phaseCounts(9)).toEqual({ base: 2, development: 3, specific: 2, taper: 1, race: 1 });
    expect(phasesOf(8).join()).toBe(
      'base,base,development,development,specific,specific,taper,race'
    );
    expect(phasesOf(9).join()).toBe(
      'base,base,development,development,development,specific,specific,taper,race'
    );
  });

  it('D21: tačno jedno rasterećenje u 8–9 ned — druga nedelja razvoja, ne prva nedelja faze ni ned 1–2', () => {
    for (const N of [8, 9]) {
      const ph = phasesOf(N);
      const d = deloadWeeks(ph)!;
      expect(d, `N=${N}`).toEqual([4]);
      const dev = ph.indexOf('development') + 1;
      expect(d[0]).toBe(dev + 1);
      expect(first(ph, d[0]!)).toBe(false);
      expect(d[0]).toBeGreaterThanOrEqual(3);
      expect(legal(ph, d)).toBe(true);
    }
  });

  it('svaka nedelja generisanog plana nosi fazu iz odluke generatora (Uslov 6)', () => {
    const r = generateTenKV2(inputOf({ weeks: 15, km: 40, vdot: 50, days: SCHEDULES.B.days }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.weeks.map((w) => w.phase)).toEqual(phasesOf(15));
    expect(r.plan.policyId).toBe('10k-v2');
    expect(r.plan.policyVersion).toBe('10k-v2.2.0');
  });
});

describe('D5: gde su rasterećenja', () => {
  it('N = 8–18: raspored je legalan i ima najmanji mogući broj rasterećenja', () => {
    for (let N = 8; N <= 18; N++) {
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
    for (let N = 8; N <= 18; N++) {
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

  it('primeri: N=8 → [4], N=9 → [4], N=10 → [5], N=14 → [4, 8, 11], N=18 → [4, 8, 12, 15]', () => {
    expect(deloadWeeks(phasesOf(8))).toEqual([4]);
    expect(deloadWeeks(phasesOf(9))).toEqual([4]);
    expect(deloadWeeks(phasesOf(10))).toEqual([5]);
    expect(deloadWeeks(phasesOf(14))).toEqual([4, 8, 11]);
    expect(deloadWeeks(phasesOf(18))).toEqual([4, 8, 12, 15]);
  });

  const plans: TenKV2Plan[] = [];
  for (const days of [3, 4, 5, 6] as const)
    for (const N of [8, 10, 13, 16, 18])
      for (const k of [0, 1, 2])
        for (const vdot of [30, 50, 70]) {
          const km = GRID_02.km[days];
          const r = generateTenKV2(
            inputOf({
              weeks: N,
              km: km[Math.round((k * (km.length - 1)) / 2)]!,
              vdot,
              days: SCHEDULES_BY_DAYS[days].A.days,
              long: SCHEDULES_BY_DAYS[days].A.long
            })
          );
          if (r.ok) plans.push(r.plan);
        }

  it('sadržaj: cilj 0,8 × poslednji ne-rasteretni, 1 kvalitet T ≈ 60 % (naniže, min 2,0; bez kvaliteta samo kad 2,0 km > 10 % cilja), dugi 0,8 ×, ostalo lagano', () => {
    expect(plans.length).toBe(4 * 5 * 3 * 3);
    let none = 0;
    for (const p of plans) {
      let last: PlanWeek | null = null;
      const tSlot = p.input.runDays.length === 3 ? 'q1' : 'q2';
      for (const w of p.weeks) {
        if (w.deload && last) {
          const nominal = Math.round(0.8 * last.targetKm * 10) / 10;
          if (w.fitted === null) expect(w.targetKm).toBe(nominal);
          else expect(w.targetKm).toBeLessThan(nominal);
          const q = w.days.filter((d) => d.workout.kind === 'quality');
          const lastT = last.days.find((d) => d.role === tSlot)!.workout.dose!.doseM;
          if (q.length === 0) {
            // Odstupanje D5 (D11 ispred D5): ni T 2,0 km ne staje u plafon 10 % cilja.
            expect(2000).toBeGreaterThan(Math.floor(0.1 * w.targetKm * 1000 + 1e-6));
            none++;
          } else {
            expect(q.length).toBe(1);
            expect(q[0]!.role).toBe(tSlot);
            expect(q[0]!.workout.dose!.zone).toBe('T');
            const t = q[0]!.workout.dose!.doseM;
            expect(t).toBeGreaterThanOrEqual(2000);
            expect(t <= Math.max(0.6 * lastT, 2000) + 1e-6).toBe(true);
          }
          const lastLong = last.days.find((d) => d.role === 'long')!.workout.km;
          const long = w.days.find((d) => d.role === 'long')!.workout.km;
          expect(long).toBeLessThanOrEqual(Math.floor(8 * lastLong + 1e-9) / 10 + 1e-9);
          expect(w.days.filter((d) => d.role === 'easy').length).toBe(
            p.input.runDays.length - 1 - q.length
          );
        }
        if (
          !w.deload &&
          (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific')
        )
          last = w;
      }
    }
    expect(none).toBeGreaterThan(0);
  });
});
