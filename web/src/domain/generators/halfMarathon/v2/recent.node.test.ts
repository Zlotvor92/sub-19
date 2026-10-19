/* Pouka 28 (HI7, HI8): mreža skorašnjeg najdužeg trka — svaki broj dana × obim reda H15 (korak 5) × VDOT {30, 35,
   40, 45, 50, 55, 60, 70} × recentLongRunKm {5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 30, 42} × 12 nedelja, raspored
   A = 3072 plana: K1 = 0, nezavisne invarijante (dugi nedelje 1 ≤ max(1,1 × r, r + 1,0)), nedelja 1 ispod obima
   samo uz dugi na apsolutnom plafonu; sa ulazom ≥ dugi nedelje 1 bez ulaza plan ostaje isti (osim ulaza i
   napomene nedelje 1). Brz nivo: svaki 4. unutar dana × obima; pun: sve. */

import { beforeAll, describe, expect, it } from 'vitest';
import { sample } from '@/test/level';
import { generateHmV2 } from './generate.ts';
import { checkPlan, emptyStats, type GridStats } from './gridInvariants.ts';
import {
  DAY_COUNTS,
  GRID,
  inputOf,
  KM_BY_DAYS,
  planHashNorm,
  SCHEDULES_BY_DAYS
} from './testInputs.ts';
import type { HmV2Plan } from './types.ts';

const RECENT = [5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 30, 42];
const ALL = DAY_COUNTS.flatMap((days) => {
  const out: { id: string; days: number; km: number; vdot: number; r: number }[] = [];
  for (let km = KM_BY_DAYS[days].min; km <= KM_BY_DAYS[days].max; km += 5)
    for (const vdot of GRID.vdot)
      for (const r of RECENT)
        out.push({ id: `d${days}-${km}km-v${vdot}-r${r}`, days, km, vdot, r });
  return out;
});
const input = (g: (typeof ALL)[number], r?: number) =>
  inputOf({
    weeks: 12,
    km: g.km,
    vdot: g.vdot,
    days: SCHEDULES_BY_DAYS[g.days as 3 | 4 | 5 | 6].A.days,
    ...(r !== undefined ? { recentLongRunKm: r } : {})
  });
const long1 = (p: HmV2Plan): number => p.weeks[0]!.days.find((d) => d.role === 'long')!.workout.km;

describe('pouka 28: mreža skorašnjeg najdužeg trka (3072 plana)', () => {
  const inputs = sample(ALL, 4, (g) => `${g.days}/${g.km}`);
  const rejected: string[] = [];
  const bad: Record<string, string[]> = {};
  let st: GridStats = emptyStats();
  const sameAsFree: string[] = [];
  let capped = 0;
  beforeAll(() => {
    st = emptyStats();
    const free = new Map<string, HmV2Plan>();
    for (const g of inputs) {
      const r = generateHmV2(input(g, g.r));
      if (!r.ok) {
        rejected.push(`${g.id}: ${r.reasons.map((x) => x.message).join(' | ')}`);
        continue;
      }
      checkPlan(g.id, r.plan, bad, st);
      const key = `${g.days}/${g.km}/${g.vdot}`;
      if (!free.has(key)) {
        const f = generateHmV2(input(g));
        if (f.ok) free.set(key, f.plan);
      }
      const f = free.get(key)!;
      // Granica ≥ dugi nedelje 1 bez ulaza → isti plan (normalizovan heš: bez ulaza i napomene nedelje 1).
      const cap10 = Math.max(Math.floor(1.1 * g.r * 10 + 1e-9), g.r * 10 + 10);
      if (cap10 >= Math.round(long1(f) * 10)) {
        const withFreeInput: HmV2Plan = { ...r.plan, input: f.input };
        if (planHashNorm(withFreeInput) !== planHashNorm(f)) sameAsFree.push(g.id);
      } else capped++;
    }
  }, 120_000);

  it('K1: odbijanja samo sudar pouke 28 (ned 1, r ≤ 6 km, 3–4 dana; čeka odluku organizatora, SEGMENT-02-STOP.md); invarijante 0; K2 samo uz dugi na apsolutnom plafonu', () => {
    expect(inputs.length).toBeGreaterThan(0);
    // STANI (HM-02): granica dugog ned 1 × lagan ≤ dugi × plafon H11 × minimum nedelje.
    const other = rejected.filter(
      (x) => !/^d[34]-\d+km-v\d+-r[56]: Nedelja 1: nijedan cilj/.test(x)
    );
    expect(other).toEqual([]);
    expect(bad).toEqual({});
    expect(st.week1BelowNotTime).toBe(0);
    expect(st.week1BelowAt.recent).toBeGreaterThan(0);
    expect(capped).toBeGreaterThan(0);
  });

  it('granica iznad dugog nedelje 1 ne menja plan (osim ulaza i napomene nedelje 1)', () => {
    expect(sameAsFree).toEqual([]);
  });

  it('mreža ima 3072 ulaza', () => {
    expect(ALL).toHaveLength(3072);
  });
});
