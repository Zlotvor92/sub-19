/* Segment 06f (10k-v2.6.0): pouka 36 — umor vezan za ZAPISE (sidro = prva puna nedelja posle poslednjeg RPE zapisa
   umora; rasterećenje koje je već u planu pokriva iste zapise), pouka 20 — traka „Plan treba prilagoditi" samo u domenu
   (adaptBanner + steps.newLimits, oblik maraton v2 MAR-06), pouka 25 — minimum nedelje važi za cilj (dani bola bez
   odmora: upozorenje). Trajna mreža ponovljenog umora (asOf + 1 … + 7): earlyGrid.harness.node.test.ts. */

import { describe, expect, it } from 'vitest';
import { adaptBanner, adaptTenKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { dayRule, TEN_K_V2_POLICY as P } from './policy.ts';
import { newLimits } from './steps.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { adaptBases, beginnerGridInputs, factsOf, grid02Inputs, painFacts } from './testInputs.ts';
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
        expect([fat.applied, fat.message.includes('već u planu (nedelja 3)')]).toEqual([
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
      `Bol 8/10 (${at}): već u planu — period bola iz prilagođavanja ${at} ostaje.`
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

describe('06g (pouke 23 i 30): trkačka nedelja samo sa danom pred trku i trkom', () => {
  const b = ([3, 4] as const)
    .flatMap((d) => beginnerGridInputs(d))
    .find((x) => x.id === 'b-d4-11w-18km-v35-B-sat')!;
  const g = generateTenKV2(b.input);
  if (!g.ok) throw new Error('generator');
  const p = g.plan;
  const at = p.weeks[8]!.endDate;
  const pain = (date: string) => ({ date, km: 0, durationSec: 0, completed: false, pain: 8 });

  it('b-d4-11w-18km-v35-B-sat: bol 8 kraj ned 9, NOV bol 8 sutra — na 10k-v2.6.0 RACE_WEEK_OVER_TAPER (3,3 > 3 km); sada upozorenje RACE_WEEK_OVER_TAPER_EVE', () => {
    const a1 = ok(adaptTenKV2(p, { workouts: [pain(at)] }, at));
    const b1 = addDays(at, 1);
    const a2 = ok(adaptTenKV2(a1.plan, { workouts: [pain(at), pain(b1)] }, b1));
    const race = a2.plan.weeks.at(-1)!;
    expect(race.days.map((d) => d.role)).toEqual(['eve', 'race']);
    expect(race.plannedKm).toBeGreaterThan(a2.plan.weeks.at(-2)!.plannedKm);
    const v = a2.plan.warnings.find((x) => x.rule === 'RACE_WEEK_OVER_TAPER_EVE');
    expect(v).toMatchObject({ severity: 'warning', week: race.index });
  });

  it('validator: trkačka > tapera sa još jednim laganim danom → greška RACE_WEEK_OVER_TAPER (izuzetak samo kad je ostao dan pred trku)', () => {
    const a1 = ok(adaptTenKV2(p, { workouts: [pain(at)] }, at));
    const b1 = addDays(at, 1);
    const a2 = ok(adaptTenKV2(a1.plan, { workouts: [pain(at), pain(b1)] }, b1));
    const race = a2.plan.weeks.at(-1)!;
    const eve = race.days.find((d) => d.role === 'eve')!;
    const extra = { ...eve, role: 'easy' as const, date: addDays(eve.date, -2) };
    const bad: TenKV2Plan = {
      ...a2.plan,
      weeks: a2.plan.weeks.map((w) =>
        w !== race
          ? w
          : {
              ...w,
              days: [extra, ...w.days],
              plannedKm: Math.round((w.plannedKm + extra.workout.km) * 100) / 100
            }
      )
    };
    expect(
      validatePlan(bad).some((x) => x.rule === 'RACE_WEEK_OVER_TAPER' && x.severity === 'error')
    ).toBe(true);
  });
});

describe('06h (pouke 23, 34, 36): umor pre starta sa asOf = prvi dan plana', () => {
  // Organizator (22. 10.): na 10k-v2.6.1 WEEK_INFEASIBLE u 1245/1245 planova (fatigue-startday.ts 10K 25).
  const g = generateTenKV2(grid02Inputs(3).find((c) => c.id === 'd3-8w-20km-v30-A-sat')!.input);
  if (!g.ok) throw new Error('d3-8w-20km-v30-A-sat');
  const p = g.plan;
  const s = p.weeks[0]!.startDate;

  it('d3-8w-20km-v30-A-sat (start ned 2026-11-01, dan 1 dugi 9 km): asOf = start → rasterećenje ned 1 kao start − 1, dan 1 upisan', () => {
    expect([s, p.weeks[0]!.days[0]!.date, p.weeks[0]!.days[0]!.role]).toEqual([
      '2026-11-01',
      '2026-11-01',
      'long'
    ]);
    const before = addDays(s, -1);
    const a0 = ok(adaptTenKV2(p, factsOf(p, 'fatigue', before), before));
    const f = factsOf(p, 'fatigue', s);
    const a = ok(adaptTenKV2(p, f, s));
    const w1 = a.plan.weeks[0]!;
    expect([w1.deload, w1.targetKm, a0.plan.weeks[0]!.targetKm]).toEqual([true, 16, 16]);
    // Dan 1 (≤ asOf, zaštićen) ostaje kakav je bio; nedelje 2…N kao start − 1.
    expect(w1.days[0]).toEqual(p.weeks[0]!.days[0]);
    expect(a.plan.weeks.slice(1)).toEqual(a0.plan.weeks.slice(1));
    expect(w1.notes.some((n) => n.startsWith('Umor pre starta:'))).toBe(true);
    // 06i (pouka 37): cilj 16,0 važi za celu nedelju — upisan dugi 9,0 + lagani 3,5 + 3,5 (start − 1: 4,4 + 4,4; na
    // 10k-v2.6.2 planirano 17,8, A20).
    expect(a0.plan.weeks[0]!.days.slice(1).map((d) => d.workout.km)).toEqual([4.4, 4.4]);
    expect(w1.days.slice(1).map((d) => `${d.role} ${d.workout.km}`)).toEqual([
      'easy 3.5',
      'easy 3.5'
    ]);
    expect([w1.plannedKm, w1.keptKm]).toEqual([16, 9]);
    expect(adaptInvariants(p, a.plan, s, f)).toEqual([]);
  });

  it('svaki 397. plan mreže 02 (3–6 dana, 40 planova): asOf = start, umor → 0 odbijanja, ned 2…N kao start − 1', () => {
    let n = 0;
    for (const [i, c] of ([3, 4, 5, 6] as const).flatMap((d) => grid02Inputs(d)).entries()) {
      if (i % 397 !== 0) continue;
      const r = generateTenKV2(c.input);
      if (!r.ok) continue;
      const q = r.plan;
      const at = q.weeks[0]!.startDate;
      const a = adaptTenKV2(q, factsOf(q, 'fatigue', at), at);
      expect(a.ok, `${c.id} ${a.ok ? '' : a.reasons[0]!.message}`).toBe(true);
      if (!a.ok) continue;
      const b = ok(adaptTenKV2(q, factsOf(q, 'fatigue', addDays(at, -1)), addDays(at, -1)));
      expect(a.plan.weeks.slice(1), c.id).toEqual(b.plan.weeks.slice(1));
      expect(a.plan.weeks[0]!.deload, c.id).toBe(true);
      n++;
    }
    expect(n).toBe(40);
  });
});

describe('06i (organizator, rani prolaz K2): trkačka nedelja sa danima odmora bola ispod minimuma — upozorenje, ne prekršaj invarijante', () => {
  it('d5-11w-30km-v40-A-sat, bol 8 asOf 2027-01-09 (subota, ned N − 1): trkačka 3 dana odmora, WEEK_MIN_REST; adaptInvariants prazno (isti predikat week.restDaysWeek)', () => {
    const g = generateTenKV2(grid02Inputs(5).find((c) => c.id === 'd5-11w-30km-v40-A-sat')!.input);
    if (!g.ok) throw new Error('d5-11w-30km-v40-A-sat');
    const at = '2027-01-09';
    const f = factsOf(g.plan, 'pain8', at);
    const a = ok(adaptTenKV2(g.plan, f, at));
    const race = a.plan.weeks[a.plan.weeks.length - 1]!;
    expect(race.limits?.rest?.length).toBe(3);
    expect(race.plannedKm + P.raceWeek.raceKm).toBeLessThan(dayRule(5)!.weekMinKm);
    expect(a.plan.warnings.some((v) => v.rule === 'WEEK_MIN_REST' && v.week === race.index)).toBe(
      true
    );
    expect(adaptInvariants(g.plan, a.plan, at, f)).toEqual([]);
  });
});
