/* Segment 04 (marathon-v2.3.0, M18): adaptacija — assess → isti konstruktor → spajanje upisanih dana → validate.
   Posebni testovi pouka 7, 16–20, 22, 23, 29, 30, 31 i odluka A1–A17; mreža 04: adaptGrid.node.test.ts; trajna
   mreža rane adaptacije: earlyGrid.node.test.ts. Na 5547285 fajl pada ceo (adapt.ts ne postoji). */

import { describe, expect, it } from 'vitest';
import { adaptBanner, adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays, mustDay } from './dates.ts';
import { construct, generateMarathonV2 } from './generate.ts';
import { pacesFromVdot } from './paces.ts';
import { newLimits } from './steps.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import {
  adaptBases,
  earlyFacts,
  factsOf,
  inputOf,
  painFacts,
  runsIn,
  SCHEDULES_BY_DAYS,
  timeForVdot
} from './testInputs.ts';
import type { AdaptResult, MarathonV2Facts, MarathonV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { longWorkout } from './workouts.ts';

const bases = adaptBases();
const cache = new Map<string, MarathonV2Plan>();
const plan = (id: string): MarathonV2Plan => {
  let p = cache.get(id);
  if (!p) {
    const r = generateMarathonV2(bases.find((b) => b.id === id)!.input);
    if (!r.ok) throw new Error(id);
    p = r.plan;
    cache.set(id, p);
  }
  return p;
};
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const adapt = (p: MarathonV2Plan, facts: Record<string, unknown>, asOf: string) =>
  ok(adaptMarathonV2(p, facts, asOf));
const applied = (r: AdaptResult, c: string): boolean =>
  r.ok && r.reasons.some((x) => x.condition === c && x.applied);
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'development' || w.phase === 'specific';
const steadyAfter = (p: MarathonV2Plan, from: number): PlanWeek[] =>
  p.weeks.filter((w) => w.index >= from && isBuild(w) && !w.deload);
const inv = (before: MarathonV2Plan, r: { plan: MarathonV2Plan }, asOf: string, f: unknown) =>
  adaptInvariants(before, r.plan, asOf, f as MarathonV2Facts);

describe('generator i adaptacija bez koraka (pouka 16, A14)', () => {
  it('construct(input, []) = generator; adaptacija bez činjenica: nedelje bajt-iste, NO_FACTS', () => {
    for (const b of bases.slice(0, 8)) {
      const p = plan(b.id);
      expect(JSON.stringify(construct(b.input, []))).toBe(
        JSON.stringify(generateMarathonV2(b.input))
      );
      const r = adapt(p, {}, p.weeks[3]!.endDate);
      expect(JSON.stringify(r.plan.weeks)).toBe(JSON.stringify(p.weeks));
      expect(applied(r, 'NO_FACTS')).toBe(true);
      expect(r.plan.policyVersion).toBe('marathon-v2.5.0');
    }
  });
  it('isti ulaz → isti JSON (A14); lanac čuva sve korake redom', () => {
    const p = plan('d4-r-16w');
    const a = p.weeks[2]!.endDate;
    const f = factsOf(p, 'pause10', a);
    expect(JSON.stringify(adaptMarathonV2(p, f, a))).toBe(JSON.stringify(adaptMarathonV2(p, f, a)));
    const r1 = adapt(p, f, a);
    const r2 = adapt(r1.plan, painFacts(addDays(a, 14), 5), addDays(a, 14));
    expect(r2.plan.adaptation!.steps.map((s) => s.asOf)).toEqual([a, addDays(a, 14)]);
  });
});

describe('pouka 7: povratak, donja granica, pokrivenost, eksplicitna pauza, prioritet, zaštita', () => {
  const p = plan('d4-r-16w');
  const asOf = p.weeks[4]!.endDate;
  it('(a) povratni rast do nivoa pre smanjenja: +10 %/ned (min 1 km), bez skoka preko nivoa', () => {
    const r = adapt(p, factsOf(p, 'pause20', asOf), asOf);
    const st = r.plan.adaptation!.steps[0]!;
    expect(st.reduced).toBe(true);
    const level = Math.round(st.levelKm! * 10);
    const s = steadyAfter(r.plan, st.fromWeek);
    expect(Math.round(s[0]!.targetKm * 10)).toBe(Math.round(st.startKm! * 10));
    for (let i = 1; i < s.length; i++) {
      const a10 = Math.round(s[i - 1]!.targetKm * 10);
      const b10 = Math.round(s[i]!.targetKm * 10);
      if (a10 < level)
        expect(b10).toBeLessThanOrEqual(Math.max(level, a10 + 10, a10 + Math.round(a10 * 0.1)));
    }
    expect(Math.max(...s.map((w) => w.targetKm))).toBeGreaterThan(st.startKm!);
    expect(inv(p, r, asOf, factsOf(p, 'pause20', asOf))).toEqual([]);
  });
  it('(b) donja granica = minimum nedelje broja dana (M15): manjak 10 % ne spušta cilj ispod 20 km', () => {
    const q = plan('beg-d4-f-16w');
    const a = q.weeks[6]!.endDate;
    const f = {
      workouts: runsIn(q, addDays(a, -6), a, 0.1),
      coverage: { from: addDays(a, -6), to: a, complete: true }
    };
    const r = adapt(q, f, a);
    expect(applied(r, 'UNDER_EXECUTION')).toBe(true);
    for (const w of r.plan.weeks.filter((x) => x.index > 7 && x.phase !== 'race'))
      expect(w.targetKm).toBeGreaterThanOrEqual(P.days[4].weekMinKm);
  });
  it('(c) nepotpun zapis ≠ pauza (A10): coverage complete false — plan isti; (d) eksplicitna pauza bez zapisa', () => {
    const r = adapt(p, factsOf(p, 'incomplete', asOf), asOf);
    expect(applied(r, 'PAUSE')).toBe(false);
    expect(JSON.stringify(r.plan.weeks)).toBe(JSON.stringify(p.weeks));
    const e = adapt(p, { breaks: [{ kind: 'break', from: addDays(asOf, -9), to: asOf }] }, asOf);
    expect(applied(e, 'PAUSE')).toBe(true);
  });
  it('(e) prioritet: bol > pauza > umor > izvršenje (A7)', () => {
    const f = {
      breaks: [{ kind: 'break', from: addDays(asOf, -9), to: asOf }],
      workouts: [
        { date: asOf, km: 0, durationSec: 0, completed: false, pain: 5 },
        { date: addDays(asOf, -11), km: 8, durationSec: 3000, completed: true, rpe: 8 },
        { date: addDays(asOf, -12), km: 8, durationSec: 3000, completed: true, rpe: 8 }
      ]
    };
    const r = adapt(p, f, addDays(asOf, 0));
    expect(applied(r, 'PAIN')).toBe(true);
    expect(applied(r, 'PAUSE')).toBe(true);
    const g = adapt(
      p,
      {
        breaks: [{ kind: 'break', from: addDays(asOf, -9), to: asOf }],
        workouts: [
          { date: addDays(asOf, -1), km: 8, durationSec: 3000, completed: true, rpe: 8 },
          { date: addDays(asOf, -2), km: 8, durationSec: 3000, completed: true, rpe: 8 }
        ]
      },
      asOf
    );
    expect(applied(g, 'PAUSE')).toBe(true);
    expect(g.reasons.find((x) => x.condition === 'FATIGUE')?.applied).toBe(false);
  });
  it('(f) zaštita: prošlost, urađeno i zaključano bajt-isto (A11)', () => {
    const f = factsOf(p, 'locked', asOf);
    const r = adapt(p, { ...f, ...factsOf(p, 'pain8', asOf) }, asOf);
    expect(inv(p, r, asOf, f)).toEqual([]);
    const locked = (f['lockedDayIds'] as string[])[0]!;
    const day = (x: MarathonV2Plan) =>
      x.weeks.flatMap((w) => w.days).find((d) => d.date === locked);
    expect(JSON.stringify(day(r.plan))).toBe(JSON.stringify(day(p)));
  });
});

describe('pouka 16–17 (A1): rezultat važi od sledeće nedelje; po osećaju ostaje po osećaju do nedelje rezultata', () => {
  it('trka 10 km: VDOT i MP po korekciji obima M2 od fromWeek; ranije nedelje bajt-iste', () => {
    const p = plan('d5-r-16w');
    const a = addDays(p.weeks[5]!.startDate, 2);
    const v = Math.round((p.vdot + 2) * 10) / 10;
    const r = adapt(
      p,
      { results: [{ distM: 10000, sec: timeForVdot(v, 10000), date: a, kind: 'race' }] },
      a
    );
    const st = r.plan.adaptation!.steps[0]!;
    expect(st.fromWeek).toBe(7);
    expect(r.plan.paces).toEqual(pacesFromVdot(v, p.input.currentWeeklyKm));
    expect(r.plan.paces.mpVdot).toBe(Math.round((v - 1) * 10) / 10);
    for (const w of r.plan.weeks.slice(0, 6))
      expect(JSON.stringify(w)).toBe(JSON.stringify(p.weeks[w.index - 1]));
    expect(r.plan.goal?.weeks).toBe(p.weeks.length - 7 + 1);
  });
  it('test 5 km u planu po osećaju: osnova result od sledeće nedelje, RPE samo u nedeljama po osećaju', () => {
    const p = plan('d4-f-16w');
    const tw = p.weeks.find((w) => w.test)!;
    const a = tw.endDate;
    const r = adapt(p, { results: [{ distM: 5000, sec: 1470, date: a, kind: 'test' }] }, a);
    expect(r.plan.paceBasis).toBe('result');
    expect(r.plan.predictedMarathonSec).not.toBeNull();
    for (const w of r.plan.weeks)
      for (const d of w.days)
        if (d.workout.kind === 'quality')
          expect(d.workout.rpe !== undefined, `${w.index}`).toBe(w.index <= tw.index);
  });
});

describe('pouka 18: bol u svakom danu nedelje daje isti plan', () => {
  for (const [id, wk] of [
    ['d4-r-16w', 5],
    ['d6-f-20w', 9],
    ['beg-d5-r-20w', 7]
  ] as const)
    for (const lvl of [5, 8])
      it(`${id}, bol ${lvl}, nedelja ${wk}: ciljevi od nedelje r, sidro i osnova isti za pon–sub`, () => {
        const p = plan(id);
        const out = [0, 1, 2, 3, 4, 5].map((i) => {
          const a = addDays(p.weeks[wk - 1]!.startDate, i);
          const r = adapt(p, painFacts(a, lvl), a);
          const st = r.plan.adaptation!.steps[0]!;
          expect(inv(p, r, a, painFacts(a, lvl))).toEqual([]);
          expect(st.returnFrom?.week).toBe(wk);
          return JSON.stringify({
            r: st.returnFrom,
            level: st.levelKm,
            t: r.plan.weeks.filter((w) => w.index >= wk).map((w) => w.targetKm)
          });
        });
        expect(new Set(out).size).toBe(1);
      });
});

describe('pouka 19: promena cilja uz zaključane buduće treninge', () => {
  it('treninzi bajt-isti, menja se samo ocena', () => {
    const p = plan('d4-r-20w');
    const a = p.weeks[5]!.endDate;
    const future = p.weeks
      .flatMap((w) => w.days)
      .filter((d) => mustDay(d.date) > mustDay(a))
      .map((d) => d.date);
    const changed = { ...p, input: { ...p.input, goalTimeSec: 11400 } };
    const r = adapt(changed, { lockedDayIds: future }, a);
    expect(JSON.stringify(r.plan.weeks.map((w) => w.days))).toBe(
      JSON.stringify(p.weeks.map((w) => w.days))
    );
    expect(r.plan.goal?.goalTimeSec).toBe(11400);
    expect(r.plan.goal?.status).not.toBe(p.goal?.status);
  });
});

describe('pouka 20: traka samo za novo ograničenje', () => {
  it('bol → traka; isti dan posle primene → ništa; rezultat stariji od 84 dana → ništa', () => {
    const p = plan('d4-r-16w');
    const a = p.weeks[4]!.endDate;
    const f = painFacts(a, 5);
    const r = adaptMarathonV2(p, f, a);
    expect(adaptBanner(p, r, f, a).length).toBe(1);
    const again = adaptMarathonV2(ok(r).plan, f, a);
    expect(adaptBanner(ok(r).plan, again, f, a)).toEqual([]);
    const old = { results: [{ distM: 10000, sec: 2700, date: '2026-01-01', kind: 'race' }] };
    expect(adaptBanner(p, adaptMarathonV2(p, old, a), {}, a)).toEqual([]);
  });

  it('MAR-06: newLimits = steps.newLimits poslednjeg koraka; sutra bez činjenica → prazno', () => {
    const p = plan('d4-r-16w');
    const a = p.weeks[4]!.endDate;
    const r1 = adapt(p, painFacts(a, 5), a);
    expect(r1.newLimits.length).toBeGreaterThan(0);
    expect(newLimits(r1.plan.adaptation!.steps)).toEqual(r1.newLimits);
    const r2 = adapt(r1.plan, {}, addDays(a, 1));
    expect(r2.newLimits).toEqual([]);
    expect(adaptBanner(r1.plan, r2, {}, addDays(a, 1))).toEqual([]);
  });

  it('MAR-06 (jedno pravilo trake): stari zapis bola kasnije — bol primenjen, plan se menja, ali bez trake; nov zapis → traka', () => {
    const p = plan('d4-r-16w');
    const a = p.weeks[4]!.endDate;
    const b = addDays(a, 2);
    // Isti stari zapis 2 dana kasnije pomera period bola (A4, asOf + 7): newLimits ga vidi, plan se menja posle asOf —
    // traka ne (zapis bola nije noviji od poslednje adaptacije).
    const pf = painFacts(a, 5);
    const pain1 = adapt(p, pf, a);
    const pain2 = adapt(pain1.plan, pf, b);
    expect(applied(pain2, 'PAIN')).toBe(true);
    expect(pain2.newLimits.length).toBeGreaterThan(0);
    expect(pain2.changes.some((c) => c.date !== undefined && c.date > b)).toBe(true);
    expect(adaptBanner(pain1.plan, pain2, pf, b)).toEqual([]);
    // Nov zapis bola posle primene (plan se menja posle asOf) → traka.
    const c = addDays(a, 4);
    const pain = (date: string, level: number) => ({
      date,
      km: 0,
      durationSec: 0,
      completed: false,
      pain: level
    });
    const pf2 = { workouts: [pain(a, 5), pain(c, 6)] };
    const pain3 = adapt(pain1.plan, pf2, c);
    expect(adaptBanner(pain1.plan, pain3, pf2, c)).toHaveLength(1);
    // Ista prijavljena pauza sutra: bez trake.
    const brk = { breaks: [{ kind: 'break', from: addDays(a, -9), to: a }] };
    const pause1 = adapt(p, brk, a);
    expect(adaptBanner(p, pause1, {}, a)).toHaveLength(1);
    expect(
      adaptBanner(pause1.plan, adapt(pause1.plan, brk, addDays(a, 1)), {}, addDays(a, 1))
    ).toEqual([]);
  });
});

describe('pouka 22 (A17): redovno rasterećenje odmah posle nedelje smanjenja otpada; prinudno nikad', () => {
  const p = plan('d4-r-16w');
  const dl = p.weeks.find((w) => w.deload)!.index;
  const before = p.weeks[dl - 3]!.endDate;
  for (const s of ['pause10', 'pain5', 'under'] as const)
    it(`${s} kraj nedelje ${dl - 2}: nedelja ${dl} nije rasterećenje, poruka A17`, () => {
      const f = earlyFacts(p, s, before);
      const r = adapt(p, f, before);
      expect(r.plan.weeks[dl - 1]!.deload).toBe(false);
      expect(r.plan.notes.some((n) => n.includes('(A17)'))).toBe(true);
      expect(inv(p, r, before, f)).toEqual([]);
    });
  it('višak (A6, reduced false) nije smanjenje: redovno rasterećenje ostaje', () => {
    const a = p.weeks[dl - 3]!.endDate;
    const f = factsOf(p, 'over120', a);
    const r = adapt(p, f, a);
    expect(applied(r, 'OVER_EXECUTION')).toBe(true);
    expect(r.plan.adaptation!.steps[0]!.reduced).toBe(false);
    expect(r.plan.weeks[dl - 1]!.deload).toBe(true);
  });
  it('prinudno rasterećenje se nikad ne ukida: bol u nedelji pre prinudnog', () => {
    // Pouka 36: rasterećenje = prva puna nedelja posle poslednjeg zapisa umora — zapisi u nedelji dl − 3 (asOf utorak).
    const tue = addDays(p.weeks[dl - 4]!.startDate, 1);
    const r1 = adapt(p, earlyFacts(p, 'fatigue', tue), tue);
    expect(r1.plan.weeks[dl - 3]!.deload).toBe(true);
    const thu = addDays(tue, 2);
    const r2 = adapt(r1.plan, painFacts(thu, 5), thu);
    expect(r2.plan.adaptation!.steps[1]!.returnFrom?.week).toBe(dl - 3);
    expect(r2.plan.weeks[dl - 3]!.deload).toBe(true);
  });
  it('umor (prinudno) pre redovnog: prinudno ostaje, redovno odmah posle otpada', () => {
    const f = earlyFacts(p, 'fatigue', p.weeks[dl - 3]!.endDate);
    const r = adapt(p, f, p.weeks[dl - 3]!.endDate);
    expect(r.plan.weeks[dl - 2]!.deload).toBe(true);
    expect(r.plan.weeks[dl - 1]!.deload).toBe(false);
    const g = adapt(
      r.plan,
      painFacts(r.plan.weeks[dl - 3]!.endDate, 5),
      r.plan.weeks[dl - 3]!.endDate
    );
    expect(g.plan.weeks[dl - 2]!.deload).toBe(true);
  });
});

describe('pouka 23: konstruktor ne sastavlja ono što validator odbija; odstupanje samo uz svojstvo', () => {
  it('dugi rasterećenja/tapera podignut na 5 km samo kad je 0,8 × / udeo × najduži < 5 km (A9)', () => {
    let seen = 0;
    // MAR-07: posle pouke 35 (duži dugi u izgradnji) svojstvo daje pauza 35 kasnije u planu (kraj ned 9).
    for (const b of bases)
      for (const [s, i] of [
        ['pause35', 2],
        ['pain8', 2],
        ['pause35', 9]
      ] as const) {
        const p = plan(b.id);
        if (i > p.weeks.length - 3) continue;
        const a = p.weeks[i - 1]!.endDate;
        const r = adaptMarathonV2(p, factsOf(p, s, a), a);
        expect(r.ok, b.id).toBe(true);
        for (const w of ok(r).plan.weeks)
          if (w.notes.some((n) => n.includes('A9: dugi ≥ lagan'))) {
            seen++;
            expect(w.days.find((d) => d.role === 'long')?.workout.km).toBe(P.lengths.easyMinKm);
          }
      }
    expect(seen).toBeGreaterThan(0);
  });
  it('MP nikad ispod najnižeg nivoa (2 × 3000 m) u izgradnji (A9: jedan kvalitet ili bez kvaliteta)', () => {
    const p = plan('d3-r-12w');
    const a = p.weeks[1]!.endDate;
    const r1 = adapt(p, factsOf(p, 'chain', a), a);
    const a2 = addDays(a, 7);
    const f2 = {
      workouts: [
        ...runsIn(r1.plan, addDays(a2, -13), addDays(a2, -7)),
        ...runsIn(r1.plan, addDays(a2, -6), a2, 0.5)
      ],
      coverage: { from: addDays(a2, -13), to: a2, complete: true }
    };
    const r = adapt(r1.plan, f2, a2);
    for (const w of r.plan.weeks.filter((x) => isBuild(x) && !x.deload))
      for (const d of w.days)
        if (d.workout.dose?.zone === 'MP')
          expect(d.workout.dose.doseM).toBeGreaterThanOrEqual(6000);
  });
});

describe('pouka 29: prošlost = upisani dani', () => {
  it('upisan dugi ≠ sastavljen (asOf usred nedelje): rasterećenje i validator čitaju upisani dugi', () => {
    const p0 = plan('d4-r-16w');
    const dl = p0.weeks.find((w) => w.deload)!.index;
    const wk = dl - 1;
    // Plan starije verzije (A15): upisani dugi nedelje wk kraći od onoga što bi konstruktor sastavio.
    const p: MarathonV2Plan = JSON.parse(JSON.stringify(p0)) as MarathonV2Plan;
    const long = p.weeks[wk - 1]!.days.find((d) => d.role === 'long')!;
    const shorter = generateMarathonV2(
      inputOf({ weeks: 16, km: 35, vdot: 45, days: ['tue', 'thu', 'sat', 'sun'], long: 'sun' })
    );
    const l2 = ok(shorter as AdaptResult).plan.weeks[wk - 1]!.days.find((d) => d.role === 'long')!;
    long.workout = l2.workout;
    const wkp = p.weeks[wk - 1]!;
    wkp.plannedKm =
      wkp.days.reduce((x, d) => x + (d.countsToWeek ? Math.round(d.workout.km * 100) : 0), 0) / 100;
    const a = long.date;
    const r = adapt(p, painFacts(addDays(a, -3), 4), a);
    const dlw = r.plan.weeks[dl - 1]!;
    expect(dlw.deload).toBe(true);
    const dlLong = dlw.days.find((d) => d.role === 'long')!.workout.km;
    expect(Math.round(dlLong * 10)).toBeLessThanOrEqual(
      Math.floor(0.8 * l2.workout.km * 10 + 1e-9)
    );
    expect(r.plan.weeks[wk - 1]!.days.find((d) => d.role === 'long')!.workout).toEqual(l2.workout);
    expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
  });
});

describe('pouka 29: najduži dugi i stanje doze iz upisanih dana', () => {
  const fix = (w: PlanWeek): void => {
    w.plannedKm =
      w.days.reduce((x, d) => x + (d.countsToWeek ? Math.round(d.workout.km * 100) : 0), 0) / 100;
  };
  it('upisani dugi pre tapera kraći od sastavljenih: taper ≤ 0,65 × upisani najduži, bez činjenica', () => {
    const p0 = plan('d5-r-20w');
    const N = p0.weeks.length;
    const p: MarathonV2Plan = JSON.parse(JSON.stringify(p0)) as MarathonV2Plan;
    const longs = p.weeks.slice(0, N - 3).map((w) => w.days.find((d) => d.role === 'long')!);
    const top = Math.max(...longs.map((d) => d.workout.km));
    const short = Math.round(0.7 * top * 10) / 10;
    let last = p.weeks[0]!.startDate;
    for (const w of p.weeks.slice(0, N - 3)) {
      const d = w.days.find((x) => x.role === 'long')!;
      if (d.workout.km > short) {
        d.workout = longWorkout(short, p.paces);
        fix(w);
        last = w.endDate;
      }
    }
    const r = adapt(p, {}, last);
    const t2 = r.plan.weeks[N - 3]!.days.find((d) => d.role === 'long')!.workout.km;
    expect(Math.round(t2 * 10)).toBeLessThanOrEqual(Math.floor(0.65 * short * 10 + 1e-9));
  });
  it('upisana doza Q2 viša od sastavljene: sledeća nedelja napreduje od upisane (stanje doze)', () => {
    const p0 = plan('d4-r-16w');
    const p: MarathonV2Plan = JSON.parse(JSON.stringify(p0)) as MarathonV2Plan;
    const q2 = (w: PlanWeek) => w.days.find((d) => d.role === 'q2')!;
    q2(p.weeks[1]!).workout = q2(p0.weeks[2]!).workout;
    fix(p.weeks[1]!);
    const r = adapt(p, {}, p.weeks[1]!.endDate);
    const got = q2(r.plan.weeks[2]!).workout;
    expect(JSON.stringify(got)).not.toBe(JSON.stringify(q2(p0.weeks[2]!).workout));
    expect(got.dose!.doseM).toBeGreaterThanOrEqual(q2(p0.weeks[2]!).workout.dose!.doseM);
  });
});

describe('pouka 30: trkačka ≤ poslednja nedelja tapera i kad taper ima dane odmora/bola', () => {
  it('d3-r-12w, bol 8 u ponedeljak N−1: višak laganih trkačke nedelje → odmor, dan pred trku i trka ostaju', () => {
    const p = plan('d3-r-12w');
    const N = p.weeks.length;
    const a = p.weeks[N - 2]!.startDate;
    const r = adapt(p, painFacts(a, 8), a);
    const rw = r.plan.weeks[N - 1]!;
    expect(rw.notes).toContain(
      'Trkačka nedelja skraćena: taper je imao dane odmora/bola (pouka 30).'
    );
    expect(rw.plannedKm).toBeLessThanOrEqual(r.plan.weeks[N - 2]!.plannedKm);
    expect(rw.days.some((d) => d.role === 'eve')).toBe(
      p.weeks[N - 1]!.days.some((d) => d.role === 'eve')
    );
    expect(rw.days.some((d) => d.role === 'race')).toBe(true);
    expect(inv(p, r, a, painFacts(a, 8))).toEqual([]);
  });
});

describe('pouka 31: prinudno rasterećenje u uvodu početnika', () => {
  it('umor kraj ned 1: ned 2 rasterećenje 0,8 ×, sadržaj uvoda (bez kvaliteta)', () => {
    const p = plan('beg-d4-f-16w');
    const a = p.weeks[0]!.endDate;
    const f = earlyFacts(p, 'fatigue', a);
    const r = adapt(p, f, a);
    const w2 = r.plan.weeks[1]!;
    expect(w2.deload).toBe(true);
    expect(w2.targetKm).toBe(Math.round(0.8 * p.weeks[0]!.targetKm * 10) / 10);
    expect(w2.days.filter((d) => d.workout.kind === 'quality')).toEqual([]);
    expect(w2.notes.some((n) => n.startsWith('Uvod (M17)'))).toBe(true);
    expect(inv(p, r, a, f)).toEqual([]);
  });
});

describe('A4 (M18): bol — dugi ≤ 60 min, lagani × 0,7 (≥ 5 km), bez kvaliteta; poruka sa osnovom povratka', () => {
  it('bol 5 i bol 8 (3 dana odmora)', () => {
    const p = plan('d5-r-20w');
    const a = p.weeks[6]!.endDate;
    for (const lvl of [5, 8]) {
      const r = adapt(p, painFacts(a, lvl), a);
      const st = r.plan.adaptation!.steps[0]!;
      expect(st.rest !== null).toBe(lvl >= 7);
      const msg = r.reasons.find((x) => x.condition === 'PAIN')!.message;
      expect(msg).toContain('Posle nedelje');
      for (const w of r.plan.weeks)
        for (const d of w.days)
          if (st.pain && d.date >= st.pain.from && d.date <= st.pain.to) {
            expect(d.workout.kind === 'quality' || d.workout.kind === 'test').toBe(false);
            if (d.role === 'long')
              expect(d.workout.km * r.plan.paces.E.slow).toBeLessThanOrEqual(3600 + 1e-6);
            if (d.role === 'easy' && w.phase !== 'race')
              expect(d.workout.km).toBeGreaterThanOrEqual(5);
          }
    }
  });
});

describe('A3: nov start (pauza ≥ 28 dana), orijentir < 12 nedelja do trke (M18)', () => {
  it('pauza 35 u ned 2 plana od 12 ned: orijentir; plan od 20 ned: bez orijentira', () => {
    const p12 = plan('d4-r-12w');
    const r12 = adapt(p12, factsOf(p12, 'pause35', p12.weeks[1]!.endDate), p12.weeks[1]!.endDate);
    expect(r12.plan.goal?.status).toBe('orientation');
    expect(r12.plan.adaptation!.steps[0]!.restart).toBe(true);
    const p20 = plan('d4-r-20w');
    const r20 = adapt(p20, factsOf(p20, 'pause35', p20.weeks[1]!.endDate), p20.weeks[1]!.endDate);
    expect(r20.plan.goal?.status).not.toBe('orientation');
  });
});

describe('A11/A15: neispravan ulaz adaptacije', () => {
  const p = plan('d4-r-16w');
  it('odbijanja sa kodom', () => {
    expect(adaptMarathonV2({ ...p, policyId: '10k-v2' }, {}, p.weeks[2]!.endDate)).toMatchObject({
      ok: false,
      reasons: [{ code: 'ADAPT_PLAN_INVALID' }]
    });
    expect(adaptMarathonV2(p, {}, p.input.raceDate)).toMatchObject({
      reasons: [{ code: 'ADAPT_AS_OF_INVALID' }]
    });
    expect(
      adaptMarathonV2(p, painFacts(p.weeks[4]!.endDate, 5), p.weeks[3]!.endDate)
    ).toMatchObject({
      reasons: [{ code: 'ADAPT_FACT_AFTER_AS_OF' }]
    });
    expect(
      adaptMarathonV2(
        p,
        { results: [{ distM: 3000, sec: 600, date: p.weeks[1]!.endDate, kind: 'race' }] },
        p.weeks[2]!.endDate
      )
    ).toMatchObject({ reasons: [{ code: 'ADAPT_RESULT_INVALID' }] });
    expect(adaptMarathonV2(p, { lockedDayIds: ['2020-01-01'] }, p.weeks[2]!.endDate)).toMatchObject(
      {
        reasons: [{ code: 'ADAPT_DAY_UNKNOWN' }]
      }
    );
  });
  it('raspored dana po šablonu ostaje (SCHEDULES_BY_DAYS)', () => {
    expect(p.input.runDays).toEqual(SCHEDULES_BY_DAYS[4].A.days);
  });
});
