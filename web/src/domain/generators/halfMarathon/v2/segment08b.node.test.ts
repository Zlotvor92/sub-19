/* HM v2 Segment HM-08b (hm-v2.6.1): nalazi ranog prolaza završne provere.
   - K1 (pouka 38): test čiji je dan zaštićen (≤ asOf, zaključan, urađen) se ne premešta i nijedan okvir ne nosi drugi
     test (steps.protectedTestDate — jedna funkcija, framesFor u konstruktoru i validatoru). Na 836a5cd: locked-test.ts
     HM 97 3193 / 4550 i locked-pause.ts HM 258 / 35 408 odbijeno (TEST).
   - K2: trkačka nedelja sa danima odmora bola (A4) sme ispod minimuma uz RACE_WEEK_SHORT — invarijanta je odstupala
     (last-weeks.ts HM: 6 / 74 836).
   - K3: lanac bol pre starta → bol / umor u nedelji 1: (a) nedelja čiji su svi dani trčanja dani odmora bola =
     WEEK_ALL_REST upozorenje, ne EMPTY_WEEK; (b) rasterećenje bez upisanog dugog izgradnje uzima dugi poslednje
     izgradnje generatora (steps.deloadRefLong10). Na 836a5cd prestart-chain HM: 61 EMPTY_WEEK + 116 WEEK_INFEASIBLE.
   Trajne mreže: segment08b.harness (brz nivo ovde; pun nivo delovi 1 … 8). */

import { describe, expect, it } from 'vitest';
import { adaptHmV2 } from './adapt.ts';
import { adaptBases, factsOf } from './adaptInputs.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays, weekdayOf } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import { codes, describeSegment08bNet, mergeFacts } from './segment08b.harness.node.test.ts';
import { feelInputs, grid02Inputs } from './testInputs.ts';
import type { HmV2Facts, HmV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const planOf = (id: string): HmV2Plan => {
  const b = [...grid02Inputs(), ...feelInputs()].find((x) => x.id === id)!;
  const g = generateHmV2(b.input);
  if (!g.ok) throw new Error(id);
  return g.plan;
};
const wed = (p: HmV2Plan, i: number): string => {
  let d = p.weeks[i - 1]!.startDate;
  while (weekdayOf(d) !== 'wed') d = addDays(d, 1);
  return d;
};

describe('HM-08b primeri iz nalaza', () => {
  it('K3: d3-10w-25km-v30-A-sat bol 8 pre starta → bol 8 u sredu ned 1: WEEK_ALL_REST (ne EMPTY_WEEK); → umor: rasterećenje ned 2 izvodljivo', () => {
    const p = planOf('d3-10w-25km-v30-A-sat');
    const at1 = addDays(p.input.startDate, -1);
    const f1 = factsOf(p, 'pain8', at1);
    const r1 = adaptHmV2(p, f1, at1);
    if (!r1.ok) throw new Error(codes(r1));
    const at2 = wed(p, 1);
    const fp = mergeFacts(f1, factsOf(r1.plan, 'pain8', at2));
    const a = adaptHmV2(r1.plan, fp, at2);
    if (!a.ok) throw new Error(codes(a));
    expect(a.plan.warnings.some((v) => v.rule === 'WEEK_ALL_REST' && v.week === 1)).toBe(true);
    expect(adaptInvariants(r1.plan, a.plan, at2, fp as HmV2Facts)).toEqual([]);
    const ff = mergeFacts(f1, factsOf(r1.plan, 'fatigue', at2));
    const b = adaptHmV2(r1.plan, ff, at2);
    if (!b.ok) throw new Error(codes(b));
    const w2 = b.plan.weeks[1]!;
    expect(w2.deload).toBe(true);
    expect(b.plan.adaptation!.steps.at(-1)!.deloadRefLongKm).toBeGreaterThan(0);
    expect(validatePlan(b.plan).filter((v) => v.severity === 'error')).toEqual([]);
    expect(adaptInvariants(r1.plan, b.plan, at2, ff as HmV2Facts)).toEqual([]);
  });

  it('K1: f-d3-15w-30km-e270-B, pauza 20, asOf 2026-11-18, zaključan dan testa → jedan test, ne premešta se', () => {
    const p = planOf('f-d3-15w-30km-e270-B');
    const td = p.weeks.flatMap((w) => w.days).find((d) => d.role === 'test')!.date;
    const at = '2026-11-18';
    const facts = { ...factsOf(p, 'pause20', at), lockedDayIds: [td] };
    const r = adaptHmV2(p, facts, at);
    if (!r.ok) throw new Error(codes(r));
    const t = r.plan.weeks.flatMap((w) => w.days).filter((d) => d.role === 'test');
    expect(t.map((d) => d.date)).toEqual([td]);
    expect(adaptInvariants(p, r.plan, at, facts as HmV2Facts)).toEqual([]);
  });

  it('K1: zaključan dan testa, pa nov rezultat (lanac, činjenice kumulativne) → zaštićen test ostaje jedini, bez odbijanja', () => {
    const p = planOf('f-d3-12w-35km-e405-C');
    const at = wed(p, 2);
    const f1 = factsOf(p, 'locked', at);
    const r1 = adaptHmV2(p, f1, at);
    if (!r1.ok) throw new Error(codes(r1));
    const at2 = addDays(at, 3);
    const f2 = mergeFacts(f1, factsOf(r1.plan, 'faster', at2));
    const r2 = adaptHmV2(r1.plan, f2, at2);
    if (!r2.ok) throw new Error(codes(r2));
    const t = r2.plan.weeks.flatMap((w) => w.days).filter((d) => d.role === 'test');
    expect(t).toHaveLength(1);
    expect((f1 as { lockedDayIds: string[] }).lockedDayIds).toContain(t[0]!.date);
  });

  it('K2: d6-10w-40km-v35-B-sun bol 8 asOf 2027-01-05 (trkačka nedelja sa danima odmora) → RACE_WEEK_SHORT, invarijanta prazna', () => {
    const p = planOf('d6-10w-40km-v35-B-sun');
    const at = '2027-01-05';
    const facts = factsOf(p, 'pain8', at);
    const r = adaptHmV2(p, facts, at);
    if (!r.ok) throw new Error(codes(r));
    expect(r.plan.warnings.some((v) => v.rule === 'RACE_WEEK_SHORT')).toBe(true);
    expect(adaptInvariants(p, r.plan, at, facts as HmV2Facts)).toEqual([]);
  });
});

describe('HM-08b dan poznat iz potpune pokrivenosti bez zapisa = 0 (dopuna pouke 37, 5K-08i-b)', () => {
  it('pauza 10 (pokrivenost do asOf, bez zapisa): zaštićeni dani nedelje = 0 km → preostali dani nisu stisnuti', () => {
    const b = adaptBases().find((x) => x.id === 'd3-r-10w')!;
    const g = generateHmV2(b.input);
    if (!g.ok) throw new Error('generator');
    const p = g.plan;
    const at = wed(p, 4);
    const facts = factsOf(p, 'pause10', at);
    const r = adaptHmV2(p, facts, at);
    if (!r.ok) throw new Error(codes(r));
    const w = r.plan.weeks[3]!;
    const first = w.days[0]!;
    expect(r.plan.adaptation!.factKm?.[first.date]).toBe(0);
    expect(w.notes.some((t) => t.includes('mešovita nedelja (pouka 37)'))).toBe(false);
    expect(adaptInvariants(p, r.plan, at, facts as HmV2Facts)).toEqual([]);
  });
});

describeSegment08bNet(1);
