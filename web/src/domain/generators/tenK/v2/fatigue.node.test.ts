/* Segment 06f (10k-v2.6.0): pouka 36 — umor vezan za ZAPISE (sidro = prva puna nedelja posle poslednjeg RPE zapisa
   umora; rasterećenje koje je već u planu pokriva iste zapise), pouka 20 — traka „Plan treba prilagoditi" samo u domenu
   (adaptBanner + steps.newLimits, oblik maraton v2 MAR-06), pouka 25 — minimum nedelje važi za cilj (dani bola bez
   odmora: upozorenje). Trajna mreža ponovljenog umora (asOf + 1 … + 7): earlyGrid.harness.node.test.ts. */

import { describe, expect, it } from 'vitest';
import { adaptBanner, adaptTenKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { dayRule } from './policy.ts';
import { newLimits } from './steps.ts';
import { adaptBases, beginnerGridInputs, factsOf, painFacts } from './testInputs.ts';
import type { AdaptResult, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const plan = (id: string): TenKV2Plan => {
  const r = generateTenKV2(adaptBases().find((b) => b.id === id)!.input);
  if (!r.ok) throw new Error(id);
  return r.plan;
};
const ok = (r: AdaptResult) => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 800));
  return r;
};
const deloads = (p: TenKV2Plan): number[] => p.weeks.filter((w) => w.deload).map((w) => w.index);

describe('pouka 36: umor vezan za zapise, ne za dan adaptacije', () => {
  // d4-r-14w: redovna rasterećenja 4, 8, 11.
  const p = plan('d4-r-14w');

  it('umor kraj ned 2 → prinudno ned 3; isti zapisi sutra (preko granice nedelje) → isti plan, bez trake', () => {
    expect(deloads(p)).toEqual([4, 8, 11]);
    const at = p.weeks[1]!.endDate;
    const f = factsOf(p, 'fatigue', at);
    const a1 = ok(adaptTenKV2(p, f, at));
    expect(deloads(a1.plan)).toEqual([3, 8, 11]);
    expect(adaptBanner(p, a1, f, at)).toHaveLength(1);
    for (let d = 1; d <= 6; d++) {
      const a2 = ok(adaptTenKV2(a1.plan, f, addDays(at, d)));
      expect(a2.plan.weeks).toEqual(a1.plan.weeks);
      // Zapisi (asOf − 1, − 3) su umor do asOf + 3 (7 dana); posle toga umora nema.
      const fat = a2.reasons.find((x) => x.condition === 'FATIGUE');
      expect(fat !== undefined).toBe(d <= 3);
      if (fat)
        expect([fat.applied, fat.message.includes('već u planu (nedelja 3, A5)')]).toEqual([
          false,
          true
        ]);
      expect(adaptBanner(a1.plan, a2, f, addDays(at, d))).toEqual([]);
    }
  });

  it('umor kraj ned 3 (ned 4 redovno rasterećenje) → bez prinudnog; isti zapisi u ned 4 → i dalje bez novog (na 7ba9717: ned 5)', () => {
    const at = p.weeks[2]!.endDate;
    const f = factsOf(p, 'fatigue', at);
    const a1 = ok(adaptTenKV2(p, f, at));
    expect(deloads(a1.plan)).toEqual([4, 8, 11]);
    const a2 = ok(adaptTenKV2(a1.plan, f, addDays(at, 1)));
    expect(deloads(a2.plan)).toEqual([4, 8, 11]);
    expect(a2.reasons.find((x) => x.condition === 'FATIGUE')!.applied).toBe(false);
  });

  it('nov zapis umora posle rasterećenja (sidro posle njega) → novo rasterećenje i traka', () => {
    const at = p.weeks[1]!.endDate;
    const a1 = ok(adaptTenKV2(p, factsOf(p, 'fatigue', at), at));
    const at2 = p.weeks[5]!.endDate;
    const f2 = factsOf(p, 'fatigue', at2);
    const a2 = ok(adaptTenKV2(a1.plan, f2, at2));
    expect(deloads(a2.plan)).toContain(7);
    expect(adaptBanner(a1.plan, a2, f2, at2)).toHaveLength(1);
  });
});

describe('pouka 20: traka u domenu (adaptBanner, steps.newLimits)', () => {
  const p = plan('d4-r-14w');
  const at = p.weeks[4]!.endDate;

  it('newLimits = novi datumi ograničenja poslednjeg koraka; sutra bez činjenica → prazno, bez trake', () => {
    const r1 = ok(adaptTenKV2(p, painFacts(at, 5), at));
    const steps = r1.plan.adaptation!.steps;
    expect(newLimits(steps).some((x) => x.startsWith('pain:'))).toBe(true);
    const r2 = ok(adaptTenKV2(r1.plan, {}, addDays(at, 1)));
    expect(newLimits(r2.plan.adaptation!.steps)).toEqual([]);
    expect(adaptBanner(r1.plan, r2, {}, addDays(at, 1))).toEqual([]);
  });

  it('bol → traka; isti dan posle primene → ništa; isti stari zapis bola kasnije → ništa', () => {
    const f = painFacts(at, 5);
    const r1 = ok(adaptTenKV2(p, f, at));
    expect(adaptBanner(p, r1, f, at)).toHaveLength(1);
    expect(adaptBanner(r1.plan, ok(adaptTenKV2(r1.plan, f, at)), f, at)).toEqual([]);
    const b = addDays(at, 2);
    expect(adaptBanner(r1.plan, ok(adaptTenKV2(r1.plan, f, b)), f, b)).toEqual([]);
  });

  it('odbijena adaptacija ili rezultat stariji od 84 dana → bez trake', () => {
    const old = { results: [{ distM: 10000, sec: 2700, date: '2026-01-01', kind: 'race' }] };
    expect(adaptBanner(p, ok(adaptTenKV2(p, old, at)), {}, at)).toEqual([]);
    const bad = adaptTenKV2(p, {}, p.input.raceDate);
    expect(bad.ok).toBe(false);
    expect(adaptBanner(p, bad, {}, p.input.raceDate)).toEqual([]);
  });
});

describe('pouka 25: minimum nedelje važi za cilj; planirano ispod zbog dana bola = upozorenje', () => {
  it('nedelja sa danima bola (bez odmora) planirano < minimum → WEEK_MIN_REST (upozorenje), ne WEEK_MIN_VOLUME', () => {
    const p = plan('d4-r-14w');
    const at = p.weeks[4]!.endDate;
    const r = ok(adaptTenKV2(p, painFacts(at, 5), at));
    const w = r.plan.weeks.find((x) => (x.limits?.pain ?? []).length > 0 && !x.limits?.rest)!;
    expect(w).toBeDefined();
    const min = dayRule(p.input.runDays.length)!.weekMinKm;
    // Isti plan sa nedeljom bola skraćenom ispod minimuma (lagani i dugi 1 km): cilj ostaje ≥ minimum.
    const cut = {
      ...r.plan,
      weeks: r.plan.weeks.map((x) => {
        if (x !== w) return x;
        const days = x.days.map((d) =>
          d.role === 'easy' || d.role === 'long'
            ? {
                ...d,
                workout: {
                  ...d.workout,
                  km: 1,
                  segments: d.workout.segments.map((s) => ({ ...s, km: 1 }))
                }
              }
            : d
        );
        const planned = days.reduce((s, d) => s + (d.countsToWeek ? d.workout.km : 0), 0);
        return { ...x, days, plannedKm: Math.round(planned * 100) / 100 };
      })
    };
    const cw = cut.weeks[w.index - 1]!;
    expect(cw.plannedKm).toBeLessThan(min);
    expect(cw.targetKm).toBeGreaterThanOrEqual(min);
    const v = validatePlan(cut).filter((x) => x.week === w.index);
    expect(v.some((x) => x.rule === 'WEEK_MIN_VOLUME')).toBe(false);
    expect(v.find((x) => x.rule === 'WEEK_MIN_REST')).toMatchObject({ severity: 'warning' });
    expect(v.find((x) => x.rule === 'WEEK_MIN_REST')!.message).toContain('dani bola');
  });
});

describe('nalaz 3 (pouke 18 i 23): isti zapis bola poslat ponovo ne pravi nov period', () => {
  it('b-d4-11w-18km-v35-B-sat, bol 8 kraj ned 9, isti zapis sutra — na 7ba9717 RACE_WEEK_OVER_TAPER (trkačka 9,3 > taper 3 km); sada isti plan', () => {
    const b = ([3, 4] as const)
      .flatMap((d) => beginnerGridInputs(d))
      .find((x) => x.id === 'b-d4-11w-18km-v35-B-sat')!;
    const r0 = generateTenKV2(b.input);
    if (!r0.ok) throw new Error('generator');
    const p = r0.plan;
    const at = p.weeks[8]!.endDate;
    const f = factsOf(p, 'pain8', at);
    const a1 = ok(adaptTenKV2(p, f, at));
    const a2 = ok(adaptTenKV2(a1.plan, f, addDays(at, 1)));
    expect(a2.plan.weeks).toEqual(a1.plan.weeks);
    const pain = a2.reasons.find((x) => x.condition === 'PAIN')!;
    expect([pain.applied, pain.message]).toEqual([
      false,
      `Bol 8/10 (${at}): već u planu — period bola iz prilagođavanja ${at} ostaje (A4).`
    ]);
    expect(adaptBanner(a1.plan, a2, f, addDays(at, 1))).toEqual([]);
  });

  it('nov zapis bola posle prilagođavanja → nov period (bol primenjen)', () => {
    const p = plan('d4-r-14w');
    const at = p.weeks[4]!.endDate;
    const a1 = ok(adaptTenKV2(p, painFacts(at, 5), at));
    const b = addDays(at, 2);
    const f2 = {
      workouts: [
        { date: at, km: 5, durationSec: 1800, completed: true, pain: 5 },
        { date: b, km: 5, durationSec: 1800, completed: true, pain: 6 }
      ]
    };
    const a2 = ok(adaptTenKV2(a1.plan, f2, b));
    expect(a2.reasons.find((x) => x.condition === 'PAIN')!.applied).toBe(true);
    expect(a2.plan.adaptation!.steps.at(-1)!.pain).not.toBeNull();
  });
});
