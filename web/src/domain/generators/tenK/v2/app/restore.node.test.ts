import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from '../adapt.ts';
import { addDays } from '../dates.ts';
import { generateTenKV2 } from '../generate.ts';
import { adaptBases, asOfOf, factsOf } from '../testInputs.ts';
import type { TenKV2Plan } from '../types.ts';
import { validatePlan } from '../validate.ts';
import { restoreMerge } from './adapt.ts';
import { generatedPlan, storedPlan } from './plan.ts';

/* 10K-07 stavka 1 (provera owner O-3, Z4): vraćanje revizije ide kroz jezgro (`adaptTenKV2`: writtenWeeks +
   validatePlan). Ulaz iz nalaza: d3-r-10w, trenutni = adaptacija scenarija na kraju ned 2 (i sreda ned 6), snimak =
   revizija 1 (generisan plan), vraćanje +1/+4/+8 dana. Pre ispravke: vraćen plan krši validator, sledeća adaptacija
   odbijena (TRANSITION_DOSE „T_cruise 2000 m < poslednje T_continuous 2500 m"). Posle: vraćen plan prolazi validator,
   sledeća adaptacija nije odbijena; verzija koju jezgro ne može da spoji se ne vraća (poruka, plan ostaje). */

const store = (p: unknown) => storedPlan(generatedPlan(p as TenKV2Plan));
const SC = [
  'none',
  'under50',
  'pause10',
  'pause20',
  'pain5',
  'fatigue',
  'faster',
  'locked'
] as const;

describe('10K v2 — vraćanje revizije kroz jezgro (10K-07, O-3)', () => {
  it('d3-r-10w: vraćen plan prolazi validatePlan, sledeća adaptacija nije odbijena', () => {
    const b = adaptBases().find((x) => x.id === 'd3-r-10w')!;
    const g = generateTenKV2(b.input);
    if (!g.ok) throw new Error('generate');
    let restored = 0;
    let refused = 0;
    for (const kind of ['w2end', 'w6wed'] as const) {
      const asOf = asOfOf(g.plan, kind);
      for (const s of SC) {
        const cur = adaptTenKV2(g.plan, factsOf(g.plan, s, asOf), asOf);
        if (!cur.ok) continue;
        for (const k of [1, 4, 8]) {
          const today = addDays(asOf, k);
          const r = restoreMerge(store(cur.plan), store(g.plan), today, {});
          const fc = (r.meta as unknown as Record<string, unknown>)['futureChanges'] as {
            conflicts: string[];
          };
          const id = `${kind} ${s} +${k}`;
          if (fc.conflicts.length > 0) {
            refused++;
            expect(fc.conflicts[0], id).toMatch(/ne može vratiti/);
            expect(fc.conflicts[0], id).not.toMatch(/\(D\d+|\bA\d+\b/);
            expect(r.weeks, id).toEqual(store(cur.plan).weeks);
            continue;
          }
          restored++;
          const core = (r as { tenKV2: TenKV2Plan }).tenKV2;
          const errs = validatePlan(core).filter((v) => v.severity === 'error');
          expect(
            errs.map((v) => `${v.rule}@${v.week}`),
            id
          ).toEqual([]);
          expect(adaptTenKV2(core, {}, today).ok, id).toBe(true);
          // Prošlost (dani ≤ danas) ostaje iz trenutnog plana.
          const past = (p: TenKV2Plan) =>
            p.weeks.flatMap((w) => w.days).filter((d) => d.date <= today);
          expect(past(core), id).toEqual(past(cur.plan));
        }
      }
    }
    expect(restored).toBeGreaterThan(30);
    expect(refused).toBeGreaterThan(0);
  });
});
