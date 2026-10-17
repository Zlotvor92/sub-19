/* Segment 06 (5k-v2.5.0): adaptacija. Tok assess → construct (isti konstruktor kao generate) → spajanje
   → validate; odluke 1–7 (DECISIONS 5k-v2.5.0); mreža 60 planova × 7 scenarija. Na e008c03 ceo fajl
   pada (adapt.ts / assess.ts ne postoje). */

import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { construct, generateFiveKV2 } from './generate.ts';
import { raceTimeForVdot } from './paces.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { adaptNetwork, doneFacts, historyFacts, START } from './testInputs.ts';
import type {
  AdaptFacts,
  AdaptResult,
  FiveKV2Plan,
  PlanDay,
  PlanWeek,
  WorkoutFact
} from './types.ts';
import { validatePlan } from './validate.ts';

type Ok = Extract<AdaptResult, { ok: true }>;
const S = JSON.stringify;
const race = (weeks: number): string => addDays(START, weeks * 7 - 1);
const endOfWeek = (k: number): string => addDays(START, k * 7 - 1);

const DEV04 = {
  startDate: START,
  raceDate: race(14),
  runDays: ['mon', 'wed', 'fri', 'sat'],
  currentWeeklyKm: 35,
  recentResult: { distanceM: 5000, timeSec: 19 * 60 + 57, date: addDays(START, -14) },
  goalTimeSec: 19 * 60 + 30
};
const FEEL = {
  startDate: START,
  raceDate: race(12),
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 25,
  typicalEasyPaceSecPerKm: 360,
  goalTimeSec: 1500
};

function planOf(input: Record<string, unknown>): FiveKV2Plan {
  const r = generateFiveKV2(input);
  if (!r.ok) throw new Error(S(r.reasons));
  return JSON.parse(S(r.plan)) as FiveKV2Plan;
}
function adapt(plan: FiveKV2Plan, facts: AdaptFacts, asOf: string): Ok {
  const r = adaptFiveKV2(plan, facts, asOf);
  if (!r.ok) throw new Error(S(r.reasons) + S(r.violations.filter((v) => v.severity === 'error')));
  return JSON.parse(S(r)) as Ok;
}
const days = (p: FiveKV2Plan): PlanDay[] => p.weeks.flatMap((w) => w.days);
const missed = (p: FiveKV2Plan, from: string, to: string): WorkoutFact[] =>
  days(p)
    .filter((d) => d.countsToWeek && d.date >= from && d.date <= to)
    .map((d) => ({ date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }));
const done = (p: FiveKV2Plan, to: string): WorkoutFact[] => [
  ...historyFacts(p.input as unknown as Record<string, unknown>),
  ...doneFacts(p, to)
];
/** Pauza `n` dana do asOf: plan izvršen do asOf − n, dalje propušten. */
const pause = (p: FiveKV2Plan, asOf: string, n: number): WorkoutFact[] => [
  ...done(p, addDays(asOf, -n)),
  ...missed(p, addDays(asOf, -n + 1), asOf)
];
const qualityDays = (w: PlanWeek): PlanDay[] => w.days.filter((d) => d.workout.kind === 'quality');
const hasStrides = (d: PlanDay): boolean => d.workout.segments.some((x) => x.kind === 'stride');
const errors = (p: FiveKV2Plan) => validatePlan(p).filter((v) => v.severity === 'error');

/** Stalni uslovi na adaptiranom planu: 0 grešaka, Uslov 6, Uslov 8 (van mešovitih nedelja). */
function checkAdapted(before: FiveKV2Plan, r: Ok, asOf: string): void {
  const p = r.plan;
  expect(errors(p)).toEqual([]);
  expect([p.policyId, p.policyVersion]).toEqual([P.id, P.version]);
  expect(p.input).toEqual(before.input);
  expect(p.weeks.at(-1)!.endDate).toBe(before.input.raceDate);
  expect(
    days(p)
      .filter((d) => d.role === 'race')
      .map((d) => d.date)
  ).toEqual([before.input.raceDate]);
  // Taper i trkačka nedelja na mestu.
  const tail = (x: FiveKV2Plan) =>
    x.weeks.filter((w) => w.phase === 'taper' || w.phase === 'race').map((w) => [w.index, w.phase]);
  expect(tail(p)).toEqual(tail(before));
  // Prošlost bajt-ista.
  for (const d of days(before))
    if (d.date <= asOf) expect(S(days(p).find((x) => x.date === d.date))).toBe(S(d));
  for (const w of p.weeks) {
    expect(['base', 'peak', 'sharpen', 'taper', 'race']).toContain(w.phase);
    if (p.adaptation!.mixedWeeks.includes(w.index)) continue;
    const long = w.days.find((d) => d.role === 'long');
    for (const d of w.days) {
      expect(d.workout.km).toBeGreaterThan(0);
      if (long && d.role === 'easy')
        expect(d.workout.km).toBeLessThanOrEqual(long.workout.km + 1e-9);
    }
  }
}

describe('Tok i zaštita (Uslov 4)', () => {
  const plan = planOf(DEV04);
  const asOf = endOfWeek(4);

  it('generate = construct(input, []) (isti konstruktor)', () => {
    const c = construct(plan.input);
    expect(c.ok && S(c.c.weeks)).toBe(S(plan.weeks));
  });

  it('prazne činjenice: budućnost bajt-ista (asOf na kraju i usred nedelje)', () => {
    for (const a of [asOf, addDays(asOf, 3), addDays(START, -3)]) {
      const r = adapt(plan, {}, a);
      expect(S(r.plan.weeks)).toBe(S(plan.weeks));
      expect(r.changes.filter((c) => c.week > 0)).toEqual([]);
      expect(r.reasons.map((x) => x.condition)).toEqual(['NO_FACTS']);
    }
  });

  it('plan izvršen kako je planiran: bez promena', () => {
    const r = adapt(plan, { workouts: done(plan, asOf) }, asOf);
    expect(S(r.plan.weeks)).toBe(S(plan.weeks));
  });

  it('dani ≤ asOf i zaključani dani ostaju bajt-isti; urađeni dan posle zaključavanja takođe', () => {
    const locked = days(plan)
      .filter((d) => d.date > asOf && d.role !== 'race')
      .filter((_, i) => i % 2 === 0)
      .map((d) => d.date);
    const r = adapt(plan, { workouts: pause(plan, asOf, 20), lockedDayIds: locked }, asOf);
    checkAdapted(plan, r, asOf);
    for (const id of locked)
      expect(S(days(r.plan).find((d) => d.date === id))).toBe(
        S(days(plan).find((d) => d.date === id))
      );
    expect(r.plan.adaptation!.lockedDayIds).toEqual(locked);
  });

  it('determinizam: isti ulaz → isti JSON; bez sata', () => {
    const f = { workouts: pause(plan, asOf, 35) };
    expect(S(adaptFiveKV2(plan, f, asOf))).toBe(S(adaptFiveKV2(plan, f, asOf)));
  });

  it('ponovna adaptacija (lanac) čuva prethodne korake i prošlost', () => {
    const r1 = adapt(plan, { workouts: pause(plan, asOf, 20) }, asOf);
    const a2 = addDays(asOf, 7);
    const f2 = {
      workouts: [...pause(plan, asOf, 20), ...doneFacts(r1.plan, a2, addDays(asOf, 1))]
    };
    const r2 = adapt(r1.plan, f2, a2);
    checkAdapted(r1.plan, r2, a2);
    expect(r2.plan.adaptation!.steps).toHaveLength(2);
    // Bez novih ograničenja budućnost posle a2 ostaje kao u r1.
    for (const w of r1.plan.weeks.filter((x) => x.startDate > a2))
      expect(S(r2.plan.weeks[w.index - 1])).toBe(S(w));
  });

  it('odbijanja: asOf na dan trke, činjenica posle asOf, nepoznat dan, loš rezultat', () => {
    const code = (r: AdaptResult) => (r.ok ? 'ok' : r.reasons.map((x) => x.code).join(','));
    expect(code(adaptFiveKV2(plan, {}, plan.input.raceDate))).toBe('ADAPT_AS_OF_INVALID');
    expect(code(adaptFiveKV2(plan, {}, '2026-13-01'))).toBe('ADAPT_AS_OF_INVALID');
    expect(
      code(
        adaptFiveKV2(
          plan,
          { workouts: [{ date: addDays(asOf, 1), km: 5, durationSec: 1800, completed: true }] },
          asOf
        )
      )
    ).toBe('ADAPT_FACT_AFTER_AS_OF');
    expect(code(adaptFiveKV2(plan, { lockedDayIds: ['2026-11-03'] }, asOf))).toBe(
      'ADAPT_DAY_UNKNOWN'
    );
    expect(
      code(
        adaptFiveKV2(plan, { results: [{ distM: 4000, sec: 900, date: asOf, kind: 'test' }] }, asOf)
      )
    ).toBe('ADAPT_RESULT_INVALID');
    expect(
      code(
        adaptFiveKV2(plan, { results: [{ distM: 5000, sec: 900, date: asOf, kind: 'race' }] }, asOf)
      )
    ).toBe('VDOT_OUT_OF_RANGE');
    expect(code(adaptFiveKV2({ ...plan, policyId: 'x' }, {}, asOf))).toBe('ADAPT_PLAN_INVALID');
  });
});

describe('Odluka 1: novi rezultat', () => {
  it('plan po osećaju → tempo od sledeće nedelje posle testa 3 km; cilj i prognoza iz testa', () => {
    const plan = planOf(FEEL);
    const asOf = endOfWeek(3);
    const test = { distM: 3000, sec: 13 * 60 + 30, date: addDays(asOf, -1), kind: 'test' as const };
    const r = adapt(plan, { workouts: done(plan, asOf), results: [test] }, asOf);
    checkAdapted(plan, r, asOf);
    expect(plan.paceMode).toBe('feel');
    expect(r.plan.paceMode).toBe('vdot');
    expect(r.plan.vdot).toBe(41.8);
    expect(r.plan.predicted5kSec).toBe(raceTimeForVdot(41.8, 5000));
    expect(r.plan.goal?.status).not.toBe('insufficient_data');
    expect(r.plan.notes).not.toContain(P.feel.forecastNote);
    for (const w of r.plan.weeks) {
      const numeric = w.days.some((d) =>
        d.workout.segments.some(
          (x) => x.zone !== 'E' && x.zone !== 'jog' && x.paceSecPerKm !== null
        )
      );
      // Do asOf po osećaju (bez brojčanog tempa), od nedelje 4 tempo iz VDOT-a.
      if (w.index <= 3) expect(numeric).toBe(false);
      if (w.index >= 4 && qualityDays(w).length > 0) expect(numeric).toBe(true);
      if (w.index >= 4) expect(w.test).toBe(false);
    }
  });

  it('plan sa rezultatom: nov VDOT od sledeće nedelje, tekuća nedelja po starom tempu', () => {
    const plan = planOf(DEV04);
    const asOf = addDays(endOfWeek(4), 3);
    const res = { distM: 5000, sec: 19 * 60 + 20, date: asOf, kind: 'race' as const };
    const r = adapt(plan, { workouts: done(plan, asOf), results: [res] }, asOf);
    checkAdapted(plan, r, asOf);
    expect(r.plan.vdot).toBeGreaterThan(plan.vdot!);
    const ePace = (w: PlanWeek) =>
      w.days.find((d) => d.role === 'long')!.workout.segments[0]!.paceSecPerKm;
    expect(ePace(r.plan.weeks[4]!)).toBe(ePace(plan.weeks[4]!));
    expect(ePace(r.plan.weeks[5]!)).toBeLessThan(ePace(plan.weeks[5]!)!);
  });

  it('rezultat stariji od 12 nedelja ili ne noviji od postojećeg ne menja tempo', () => {
    const plan = planOf(DEV04);
    const asOf = endOfWeek(4);
    const old = { distM: 5000, sec: 1150, date: addDays(asOf, -90), kind: 'race' as const };
    const r = adapt(plan, { results: [old] }, asOf);
    expect(r.plan.vdot).toBe(plan.vdot);
    expect(r.reasons.map((x) => [x.condition, x.applied])).toEqual([['RESULT_IGNORED', false]]);
  });
});

describe('Odluka 2: izvršenje < 60%', () => {
  it('sledeća nedelja ne raste: cilj = max(izvršeno, 80% planiranog), dalje rast po pravilima', () => {
    const plan = planOf(DEV04);
    const asOf = endOfWeek(5);
    const w = done(plan, asOf).map((x) =>
      x.date > addDays(asOf, -7) ? { ...x, km: x.km * 0.4 } : x
    );
    const r = adapt(plan, { workouts: w }, asOf);
    checkAdapted(plan, r, asOf);
    const t6 = plan.weeks[5]!.targetKm;
    expect(r.plan.weeks[5]!.targetKm).toBeCloseTo(Math.round(0.8 * t6 * 10) / 10, 5);
    expect(r.plan.weeks[5]!.targetKm).toBeLessThanOrEqual(plan.weeks[4]!.targetKm);
    expect(r.plan.weeks[6]!.targetKm).toBeLessThanOrEqual(
      Math.floor(r.plan.weeks[5]!.targetKm * 1.08 * 10 + 1e-9) / 10 + 1e-9
    );
    expect(r.reasons.find((x) => x.condition === 'UNDER_EXECUTION')?.applied).toBe(true);
  });
});

describe('Odluka 3: pauza', () => {
  const plan = planOf(DEV04);
  const asOf = endOfWeek(4);

  it('7–13 dana: 80% obima 7 dana pre pauze, prva nedelja 1 kvalitet', () => {
    const r = adapt(plan, { workouts: pause(plan, asOf, 10) }, asOf);
    checkAdapted(plan, r, asOf);
    const w5 = r.plan.weeks[4]!;
    const lastRun = addDays(asOf, -11); // poslednji dan trčanja pre pauze (sub)
    const pre7 = doneFacts(plan, lastRun, addDays(lastRun, -6)).reduce((a, x) => a + x.km, 0);
    expect(w5.targetKm).toBeCloseTo(Math.round(pre7 * 0.8 * 10) / 10, 5);
    expect(qualityDays(w5)).toHaveLength(1);
    expect(qualityDays(r.plan.weeks[5]!)).toHaveLength(2);
  });

  it('14–27 dana: 70%, prva nedelja bez kvaliteta, druga jedan kvalitet', () => {
    const r = adapt(plan, { workouts: pause(plan, asOf, 20) }, asOf);
    checkAdapted(plan, r, asOf);
    expect(qualityDays(r.plan.weeks[4]!)).toHaveLength(0);
    expect(r.plan.weeks[4]!.days.some(hasStrides)).toBe(false);
    expect(qualityDays(r.plan.weeks[5]!)).toHaveLength(1);
    expect(r.plan.weeks[4]!.targetKm).toBe(Math.round(35 * 0.7 * 10) / 10);
  });

  it('pauza pred redovno rasterećenje: rast dalje od cilja pauze, ne od obima pre pauze', () => {
    const a = endOfWeek(7);
    expect(plan.weeks[7]!.deload).toBe(true);
    const r = adapt(plan, { workouts: pause(plan, a, 20) }, a);
    checkAdapted(plan, r, a);
    const [w8, w9] = [r.plan.weeks[7]!, r.plan.weeks[8]!];
    expect(w8.targetKm).toBe(r.plan.adaptation!.steps[0]!.startKm);
    expect(w9.targetKm).toBeLessThanOrEqual(Math.floor(w8.targetKm * 1.08 * 10 + 1e-9) / 10);
  });

  it('≥ 28 dana: nov start = min(14 dana pre pauze / 2, 50%), faze preostale izgradnje ponovo', () => {
    const a = endOfWeek(7);
    const r = adapt(plan, { workouts: pause(plan, a, 35) }, a);
    checkAdapted(plan, r, a);
    const step = r.plan.adaptation!.steps[0]!;
    expect(step.restart).toBe(true);
    expect(r.plan.weeks[7]!.phase).toBe('base');
    expect(r.plan.weeks[7]!.targetKm).toBe(step.startKm);
    // min(14 dana pre pauze / 2, 50% od 7 dana pre pauze), ne ispod donje granice ulaza (4 dana: 15 km).
    expect(step.startKm).toBe(Math.max(15, Math.min(step.startKm!, 0.5 * 44)));
    expect(step.startKm).toBeLessThanOrEqual(22);
    expect(r.plan.goal?.status).not.toBe('orientation'); // ostaje 7 nedelja
  });

  it('≥ 28 dana i < 6 nedelja do trke: plan se gradi, cilj „orijentir" + napomena', () => {
    const a = endOfWeek(9);
    const r = adapt(plan, { workouts: pause(plan, a, 30) }, a);
    checkAdapted(plan, r, a);
    expect(r.plan.goal?.status).toBe('orientation');
    expect(r.plan.notes).toContain(P.adapt.orientationMessage);
    expect(r.plan.weeks.length).toBe(plan.weeks.length);
  });

  it('propuštena nedelja (7 dana bez trčanja) = pauza 7–13', () => {
    const r = adapt(plan, { workouts: pause(plan, asOf, 7) }, asOf);
    expect(r.reasons.find((x) => x.condition === 'PAUSE')?.applied).toBe(true);
    checkAdapted(plan, r, asOf);
  });
});

describe('Odluka 4: bol', () => {
  const plan = planOf(DEV04);
  const asOf = endOfWeek(4);
  const withPain = (pain: number, at = asOf): WorkoutFact[] =>
    done(plan, at).map((x) => (x.date === addDays(at, -1) ? { ...x, pain } : x));
  const inRange = (d: string, from: string, to: string) => d >= from && d <= to;

  it('bol ≥ 4: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani −30%; poruka', () => {
    const r = adapt(plan, { workouts: withPain(5) }, asOf);
    checkAdapted(plan, r, asOf);
    const span = days(r.plan).filter((d) => inRange(d.date, addDays(asOf, 1), addDays(asOf, 7)));
    expect(span.length).toBeGreaterThan(0);
    for (const d of span) {
      expect(d.workout.kind).not.toBe('quality');
      expect(hasStrides(d)).toBe(false);
      if (d.role === 'long') expect(d.workout.km * r.plan.paces.E.slow).toBeLessThanOrEqual(3600);
    }
    const easyBefore = days(plan).filter(
      (d) => d.role === 'easy' && span.some((x) => x.date === d.date)
    );
    for (const d of easyBefore) {
      const after = span.find((x) => x.date === d.date)!;
      expect(after.workout.km).toBeLessThan(d.workout.km);
    }
    expect(r.reasons.find((x) => x.condition === 'PAIN')!.message).toContain('stručni pregled');
    expect(qualityDays(r.plan.weeks[5]!).length).toBe(2); // posle perioda kvalitet se vraća
  });

  it('bol ≥ 7: 3 dana odmora, pa 7 dana kao bol ≥ 4', () => {
    const r = adapt(plan, { workouts: withPain(8) }, asOf);
    checkAdapted(plan, r, asOf);
    expect(days(r.plan).filter((d) => inRange(d.date, addDays(asOf, 1), addDays(asOf, 3)))).toEqual(
      []
    );
    const span = days(r.plan).filter((d) => inRange(d.date, addDays(asOf, 4), addDays(asOf, 10)));
    expect(span.every((d) => d.workout.kind !== 'quality' && !hasStrides(d))).toBe(true);
  });

  it('ponovni bol produžava period (prethodni korak ostaje, novi period od novog asOf)', () => {
    const r1 = adapt(plan, { workouts: withPain(5) }, asOf);
    const a2 = addDays(asOf, 5);
    const f2 = {
      workouts: [
        ...withPain(5),
        ...doneFacts(r1.plan, a2, addDays(asOf, 1)).map((x) =>
          x.date === a2 ? { ...x, pain: 4 } : x
        )
      ]
    };
    const r2 = adapt(r1.plan, f2, a2);
    checkAdapted(r1.plan, r2, a2);
    const span = days(r2.plan).filter((d) => inRange(d.date, addDays(a2, 1), addDays(a2, 7)));
    expect(span.every((d) => d.workout.kind !== 'quality')).toBe(true);
    expect(
      days(r1.plan).some(
        (d) => inRange(d.date, addDays(asOf, 8), addDays(a2, 7)) && d.workout.kind === 'quality'
      )
    ).toBe(true);
  });

  it('bol bez dijagnoze: poruka ne sadrži nazive povreda', () => {
    const r = adapt(plan, { workouts: withPain(9) }, asOf);
    const m = r.reasons
      .map((x) => x.message)
      .join(' ')
      .toLowerCase();
    for (const w of ['tendin', 'fraktur', 'istegnuć', 'dijagnoz']) expect(m).not.toContain(w);
  });
});

describe('Odluka 5: umor', () => {
  const plan = planOf(DEV04);
  it('2+ lagana sa RPE ≥ 7 u 7 dana → sledeća nedelja rasterećenje', () => {
    const asOf = endOfWeek(5);
    const w = done(plan, asOf).map((x) => {
      const d = days(plan).find((y) => y.date === x.date);
      return x.date > addDays(asOf, -7) && d?.role !== 'q1' && d?.role !== 'q2'
        ? { ...x, rpe: 7 }
        : x;
    });
    const r = adapt(plan, { workouts: w }, asOf);
    checkAdapted(plan, r, asOf);
    expect(plan.weeks[5]!.deload).toBe(false);
    expect(r.plan.weeks[5]!.deload).toBe(true);
    expect(r.plan.weeks[5]!.targetKm).toBeCloseTo(
      Math.round(plan.weeks[4]!.targetKm * 0.8 * 10) / 10,
      5
    );
  });

  it('jedan lagan sa RPE ≥ 7 nije dovoljan; u taperu se ne primenjuje', () => {
    const asOf = endOfWeek(5);
    const one = done(plan, asOf).map((x, i, a) => (i === a.length - 1 ? { ...x, rpe: 9 } : x));
    expect(S(adapt(plan, { workouts: one }, asOf).plan.weeks)).toBe(S(plan.weeks));
    const a11 = endOfWeek(11);
    const hard = done(plan, a11).map((x) => (x.date > addDays(a11, -7) ? { ...x, rpe: 8 } : x));
    const r = adapt(plan, { workouts: hard }, a11);
    expect(r.reasons.find((x) => x.condition === 'FATIGUE')?.applied).toBe(false);
    expect(r.plan.weeks[11]!.deload).toBe(false);
  });
});

describe('Odluka 6: više od plana', () => {
  it('> 115% dve nedelje zaredom → sledeća nedelja bez rasta, napomena', () => {
    const plan = planOf(DEV04);
    const asOf = endOfWeek(5);
    const w = done(plan, asOf).map((x) =>
      x.date > addDays(asOf, -14) ? { ...x, km: x.km * 1.2 } : x
    );
    const r = adapt(plan, { workouts: w }, asOf);
    checkAdapted(plan, r, asOf);
    expect(r.plan.weeks[5]!.targetKm).toBeLessThanOrEqual(plan.weeks[4]!.targetKm);
    expect(plan.weeks[5]!.targetKm).toBeGreaterThan(plan.weeks[4]!.targetKm);
    expect(r.plan.notes.some((n) => n.includes('ne povećava'))).toBe(true);
  });
});

describe('Odluka 7: prioritet i kombinacije', () => {
  const plan = planOf(DEV04);
  const asOf = endOfWeek(4);

  it('bol + pauza: obe se primenjuju (bol najstroži po datumima, pauza obim)', () => {
    const f = {
      workouts: [
        ...pause(plan, asOf, 20),
        { date: asOf, km: 0, durationSec: 0, completed: false, pain: 8 }
      ]
    };
    const r = adapt(plan, f, asOf);
    checkAdapted(plan, r, asOf);
    expect(r.reasons.filter((x) => x.applied).map((x) => x.condition)).toEqual(['PAIN', 'PAUSE']);
    expect(r.plan.weeks[4]!.targetKm).toBe(24.5);
    expect(qualityDays(r.plan.weeks[5]!)).toHaveLength(0); // bol (do asOf+10) jači od „1 kvalitet"
  });

  it('pauza nadjačava umor i izvršenje; svi aktivni su navedeni', () => {
    const f = { workouts: pause(plan, asOf, 10).map((x) => (x.completed ? { ...x, rpe: 8 } : x)) };
    const r = adapt(plan, f, asOf);
    const c = r.reasons.map((x) => [x.condition, x.applied]);
    expect(c).toContainEqual(['PAUSE', true]);
    expect(c).toContainEqual(['UNDER_EXECUTION', false]);
    expect(r.plan.weeks[4]!.deload).toBe(false);
  });

  it('umor nadjačava izvršenje; tempo iz rezultata se ipak ažurira', () => {
    const a = endOfWeek(5);
    const w = done(plan, a).map((x) =>
      x.date > addDays(a, -7) ? { ...x, km: x.km * 0.5, rpe: 8 } : x
    );
    const r = adapt(
      plan,
      { workouts: w, results: [{ distM: 5000, sec: 1180, date: a, kind: 'race' }] },
      a
    );
    checkAdapted(plan, r, a);
    const c = r.reasons.map((x) => [x.condition, x.applied]);
    expect(c).toContainEqual(['FATIGUE', true]);
    expect(c).toContainEqual(['UNDER_EXECUTION', false]);
    expect(c).toContainEqual(['NEW_RESULT', true]);
    expect(r.plan.weeks[5]!.deload).toBe(true);
    expect(r.plan.vdot).not.toBe(plan.vdot);
  });
});

describe('Mreža: 60 planova × 7 scenarija → 0 grešaka validatora (stalni uslovi 1–8)', () => {
  const net = adaptNetwork();
  it('60 planova', () => expect(net).toHaveLength(60));
  it.each(net.map((x) => [x.id, x.input] as const))('%s', (_, input) => {
    const plan = planOf(input);
    const N = plan.weeks.length;
    const asOf = endOfWeek(Math.max(2, Math.floor(N / 2)));
    const v = plan.vdot ?? (plan.experience === 'beginner' ? 33 : 40);
    const scenarios: Record<string, AdaptFacts> = {
      none: { workouts: done(plan, asOf) },
      missedWeek: { workouts: pause(plan, asOf, 7) },
      pause10: { workouts: pause(plan, asOf, 10) },
      pause20: { workouts: pause(plan, asOf, 20) },
      pause35: { workouts: pause(plan, asOf, 35) },
      pain5: {
        workouts: done(plan, asOf).map((x, i, a) => (i === a.length - 1 ? { ...x, pain: 5 } : x))
      },
      test3k: {
        workouts: done(plan, asOf),
        results: [
          { distM: 3000, sec: raceTimeForVdot(v + 1, 3000), date: addDays(asOf, -1), kind: 'test' }
        ]
      }
    };
    for (const [name, facts] of Object.entries(scenarios)) {
      const r = adaptFiveKV2(plan, facts, asOf);
      expect([name, r.ok ? 'ok' : S(r.reasons)]).toEqual([name, 'ok']);
      if (!r.ok) continue;
      checkAdapted(plan, r, asOf);
      if (name === 'none') expect(S(r.plan.weeks)).toBe(S(plan.weeks));
      if (name === 'test3k') expect(r.plan.paceMode).toBe('vdot');
      if (name === 'pain5')
        for (const d of days(r.plan).filter((x) => x.date > asOf && x.date <= addDays(asOf, 7)))
          expect(d.workout.kind).not.toBe('quality');
    }
  });
});
