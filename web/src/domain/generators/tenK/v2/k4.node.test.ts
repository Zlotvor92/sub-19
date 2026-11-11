/* K4-B (10k-v2.16.0, glavni trener krug 3 § 3 B): kratak lagan dan je „odmor ili 20 min lagano po želji". Nezavisne
   invarijante (brojevi ispisani ovde, ne čitaju se iz policy.ts): 30 min, više od 2 nedelje, jedini lagan dan ostaje,
   minimum nedelje po broju dana. Izveštaj: docs/generators-v2/perfection/reports/K4-10K-REPORT.md. */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { grid02Inputs } from './testInputs.ts';
import type { TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const OPT = 'Kratak lagan dan';
const WEEK_MIN: Record<number, number> = { 3: 9, 4: 12, 5: 15, 6: 18 };
const build = (w: TenKV2Plan['weeks'][number]): boolean =>
  !w.deload && ['base', 'development', 'specific'].includes(w.phase);
const optW = (w: TenKV2Plan['weeks'][number]): boolean => w.notes.some((n) => n.startsWith(OPT));

const SAMPLE: { id: string; days: number; p: TenKV2Plan }[] = [];
for (const n of [3, 4, 5, 6] as const)
  for (const c of grid02Inputs(n).filter((_, i) => i % 6 === 1)) {
    const r = generateTenKV2(c.input);
    if (r.ok) SAMPLE.push({ id: c.id, days: n, p: r.plan });
  }

describe('K4-B: kratak lagan dan „po želji"', () => {
  it('p06 (P9): nedelje sa danom „po želji" — rečenica plana, dan šablona bez treninga, planirano ≤ cilj, validator bez grešaka', () => {
    const inputs = JSON.parse(
      readFileSync(
        new URL('../../../../../../docs/generators-v2/perfection/P9/inputs.json', import.meta.url),
        'utf8'
      )
    )['10K'] as { input: unknown }[];
    const r = generateTenKV2(inputs[5]!.input);
    if (!r.ok) throw new Error('p06');
    const ws = r.plan.weeks.filter(optW);
    expect(ws.length).toBeGreaterThan(0);
    expect(r.plan.notes.some((n) => n.startsWith('Mali obim: u nedeljama'))).toBe(true);
    for (const w of ws) {
      expect(w.plannedKm).toBeLessThan(w.targetKm);
      expect(w.days.filter((d) => d.role === 'easy').length).toBeGreaterThan(0);
    }
    expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
  });

  it('uzorak mreže 02: dan „po želji" samo u izgradnji, uz bar jedan preostali lagan (3 dana nikad), manjak ≤ 30 min laganog, nedelja ≥ minimum; bez pravila nema dana „po želji" u planu sa ≤ 2 kratke nedelje', () => {
    let hit = 0;
    for (const { id, days, p } of SAMPLE) {
      const ws = p.weeks.filter(optW);
      if (ws.length > 0) hit++;
      expect(
        p.notes.some((n) => n.startsWith('Mali obim: u nedeljama')),
        id
      ).toBe(ws.length > 0);
      for (const w of ws) {
        const tag = `${id} ned ${w.index}`;
        expect(build(w), tag).toBe(true);
        const easy = w.days.filter((d) => d.role === 'easy');
        expect(easy.length, tag).toBeGreaterThan(0);
        const long = w.days.find((d) => d.role === 'long')!;
        expect(w.plannedKm, tag).toBeLessThanOrEqual(w.targetKm + 0.1);
        expect(
          (w.targetKm - w.plannedKm) * (long.workout.sec / long.workout.km),
          tag
        ).toBeLessThanOrEqual(1860);
        expect(w.plannedKm + 1e-9, tag).toBeGreaterThanOrEqual(WEEK_MIN[days]!);
      }
      // Bez pravila (≤ 2 kratke nedelje) nema dana „po želji": kratke nedelje + nedelje „po želji" > 2.
      if (ws.length > 0) {
        const short = p.weeks.filter(
          (w) => build(w) && w.days.some((d) => d.role === 'easy' && d.workout.sec < 1800)
        ).length;
        expect(short + ws.length, id).toBeGreaterThan(2);
      }
      // 3 dana: jedan lagan dan — ostaje (km nema gde da pređu).
      if (days === 3) expect(ws.length, id).toBe(0);
    }
    expect(hit).toBeGreaterThan(0);
  });
});
