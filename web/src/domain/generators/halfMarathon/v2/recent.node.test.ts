/* Pouka 28 (HI7, HI8, P1): mreža skorašnjeg najdužeg trka — recentLongRunKm 5–42 (korak 1) × svaki broj dana ×
   obim reda H15 (korak 5) × VDOT {30, 45, 70} × nedelje {10, 14, 20}, raspored A = 10 944 plana: jedina odbijanja
   su RECENT_LONG_TOO_SHORT (sa pragom; izmereno: samo nedelja 1, r ≤ 6 km, 3–4 dana); nezavisne invarijante
   (dugi svake nedelje ≤ max(1,1 × L, L + 1,0)); nedelja 1 ispod obima samo uz dugi na apsolutnom plafonu; skok
   dugog nedelja 1 → 2 ≤ max(10 %, 1 km). Brz nivo: svaki 8. unutar dana × r; pun: sve. */

import { beforeAll, describe, expect, it } from 'vitest';
import { sample } from '@/test/level';
import { generateHmV2 } from './generate.ts';
import { checkPlan, emptyStats, type GridStats } from './gridInvariants.ts';
import { DAY_COUNTS, inputOf, KM_BY_DAYS, SCHEDULES_BY_DAYS } from './testInputs.ts';

const ALL = DAY_COUNTS.flatMap((days) => {
  const out: { id: string; days: number; km: number; vdot: number; weeks: number; r: number }[] =
    [];
  for (let r = 5; r <= 42; r++)
    for (let km = KM_BY_DAYS[days].min; km <= KM_BY_DAYS[days].max; km += 5)
      for (const vdot of [30, 45, 70])
        for (const weeks of [10, 14, 20])
          out.push({ id: `d${days}-${weeks}w-${km}km-v${vdot}-r${r}`, days, km, vdot, weeks, r });
  return out;
});

describe('pouka 28: mreža skorašnjeg najdužeg trka (10 944 plana)', () => {
  const inputs = sample(ALL, 8, (g) => `${g.days}/${g.r}`);
  const tooShort: { id: string; r: number; days: number; week?: number; message: string }[] = [];
  const other: string[] = [];
  const bad: Record<string, string[]> = {};
  let st: GridStats = emptyStats();
  beforeAll(() => {
    st = emptyStats();
    for (const g of inputs) {
      const res = generateHmV2(
        inputOf({
          weeks: g.weeks,
          km: g.km,
          vdot: g.vdot,
          days: SCHEDULES_BY_DAYS[g.days as 3 | 4 | 5 | 6].A.days,
          recentLongRunKm: g.r
        })
      );
      if (res.ok) checkPlan(g.id, res.plan, bad, st);
      else if (res.reasons.length === 1 && res.reasons[0]!.code === 'RECENT_LONG_TOO_SHORT')
        tooShort.push({ id: g.id, r: g.r, days: g.days, ...res.reasons[0]! });
      else other.push(`${g.id}: ${res.reasons.map((x) => `${x.code} ${x.message}`).join(' | ')}`);
    }
  }, 120_000);

  it('K1: jedino odbijanje je RECENT_LONG_TOO_SHORT sa pragom (izmereno: ned 1, r ≤ 6 km, 3–4 dana)', () => {
    expect(inputs.length).toBeGreaterThan(0);
    expect(other).toEqual([]);
    expect(
      tooShort.filter(
        (x) => x.week !== 1 || x.r > 6 || x.days > 4 || !/izvodljiv od \d+,\d km/.test(x.message)
      )
    ).toEqual([]);
  });

  it('invarijante 0 (LONG_ROLLING); K2 samo uz dugi na apsolutnom plafonu; skok ned 1 → 2 ≤ max(10 %, 1 km)', () => {
    expect(bad).toEqual({});
    expect(st.week1BelowNotTime).toBe(0);
    expect(st.week1BelowAt.recent).toBeGreaterThan(0);
    // Najveći odnos uz pravilo „+1 km": 6 → 7 km (× 1,167).
    expect(st.longJump12Max).toBeLessThanOrEqual(7 / 6 + 1e-9);
  });

  it('mreža ima 10 944 ulaza', () => {
    expect(ALL).toHaveLength(10944);
  });
});
