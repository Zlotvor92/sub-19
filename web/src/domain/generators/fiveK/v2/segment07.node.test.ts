/* Segment 07 (5k-v2.6.0): ispravke adaptacije (Odluke 1–3) i plan trčanje/hodanje (Odluke 4–8).
   Testovi koriste samo module i izvoze koji postoje na c9003aa (adapt, generate, dates, policy,
   testInputs, validate), da bi na c9003aa padali pojedinačno na proveri (plan trčanje/hodanje tamo
   pada na RUN_WALK_NOT_SUPPORTED_YET), a ne na uvozu. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import * as policy from './policy.ts';
import { adaptNetwork, doneFacts, hasSecondEasy, historyFacts, START } from './testInputs.ts';
import type {
  AdaptFacts,
  AdaptResult,
  FactsCoverage,
  FiveKV2Plan,
  FiveKV2RunWalkPlan,
  PlanDay,
  RunWalkAdaptResult,
  RunWalkDay,
  WorkoutFact
} from './types.ts';
import { validatePlan } from './validate.ts';

type Ok = Extract<AdaptResult, { ok: true }>;
type RwOk = Extract<RunWalkAdaptResult, { ok: true }>;
type Session = Extract<RunWalkDay, { role: 'session' }>;
type Race = Extract<RunWalkDay, { role: 'race' }>;
const P = policy.FIVE_K_V2_POLICY;
const S = JSON.stringify;
const race = (weeks: number): string => addDays(START, weeks * 7 - 1);
const endOfWeek = (k: number): string => addDays(START, k * 7 - 1);
const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
const round1 = (x: number): number => Math.round(x * 10) / 10;

const DEV04 = {
  startDate: START,
  raceDate: race(14),
  runDays: ['mon', 'wed', 'fri', 'sat'],
  currentWeeklyKm: 35,
  recentResult: { distanceM: 5000, timeSec: 19 * 60 + 57, date: addDays(START, -14) },
  goalTimeSec: 19 * 60 + 30
};
const D5_30 = {
  startDate: START,
  raceDate: race(12),
  runDays: ['mon', 'tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 30,
  recentResult: { distanceM: 5000, timeSec: 1340, date: addDays(START, -14) }
};
const rwInput = (weeks: number, o: Record<string, unknown> = {}): Record<string, unknown> => ({
  startDate: START,
  raceDate: race(weeks),
  runDays: ['tue', 'thu', 'sat'],
  currentWeeklyKm: 0,
  canRun30Min: false,
  ...o
});

function planOf(input: Record<string, unknown>): FiveKV2Plan {
  const r = generateFiveKV2(input);
  if (!r.ok) throw new Error(S(r.reasons));
  if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
  return JSON.parse(S(r.plan)) as FiveKV2Plan;
}
function rwPlanOf(input: Record<string, unknown>): FiveKV2RunWalkPlan {
  const r = generateFiveKV2(input);
  if (!r.ok) throw new Error(S(r.reasons) + S(r.violations));
  if (r.plan.planType !== 'runWalk') throw new Error('očekivan plan trčanje/hodanje');
  return JSON.parse(S(r.plan)) as FiveKV2RunWalkPlan;
}
function adapt(plan: FiveKV2Plan, facts: AdaptFacts, asOf: string): Ok {
  const r = adaptFiveKV2(plan, facts, asOf);
  if (!r.ok) throw new Error(S(r.reasons) + S(r.violations.filter((v) => v.severity === 'error')));
  return JSON.parse(S(r)) as Ok;
}
function adaptRw(plan: FiveKV2RunWalkPlan, facts: AdaptFacts, asOf: string): RwOk {
  const r = adaptFiveKV2(plan, facts, asOf);
  if (!r.ok) throw new Error(S(r.reasons) + S(r.violations.filter((v) => v.severity === 'error')));
  return JSON.parse(S(r)) as RwOk;
}
const days = (p: FiveKV2Plan): PlanDay[] => p.weeks.flatMap((w) => w.days);
const done = (p: FiveKV2Plan, to: string): WorkoutFact[] => [
  ...historyFacts(p.input as unknown as Record<string, unknown>),
  ...doneFacts(p, to)
];
const missed = (p: FiveKV2Plan, from: string, to: string): WorkoutFact[] =>
  days(p)
    .filter((d) => d.countsToWeek && d.date >= from && d.date <= to)
    .map((d) => ({ date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }));
const pause = (p: FiveKV2Plan, asOf: string, n: number): WorkoutFact[] => [
  ...done(p, addDays(asOf, -n)),
  ...missed(p, addDays(asOf, -n + 1), asOf)
];
/** Potpun zapis od istorije (START − 28) do asOf; partial = isti opseg, ali nepotpun. */
const full = (asOf: string): FactsCoverage => ({
  from: addDays(START, -28),
  to: asOf,
  complete: true
});
const partial = (asOf: string): FactsCoverage => ({ ...full(asOf), complete: false });
const errors = (p: FiveKV2Plan | FiveKV2RunWalkPlan) =>
  validatePlan(p).filter((v) => v.severity === 'error');
const targets = (p: FiveKV2Plan): number[] => p.weeks.map((w) => w.targetKm);
const applied = (r: Ok | RwOk, c: string): boolean =>
  r.reasons.some((x) => x.condition === c && x.applied);

const sessions = (p: FiveKV2RunWalkPlan): Session[] =>
  p.weeks.flatMap((w) => w.days).filter((d): d is Session => d.role === 'session');
const raceOf = (p: FiveKV2RunWalkPlan): Race =>
  p.weeks.flatMap((w) => w.days).find((d): d is Race => d.role === 'race')!;
/** Sesije plana do `to` kao zapisi (vremenski: km 0, trajanje sesije). */
const sessionFacts = (
  p: FiveKV2RunWalkPlan,
  to: string,
  extra: (i: number) => Partial<WorkoutFact> = () => ({ rpe: 5 }),
  from = '0000-01-01'
): WorkoutFact[] =>
  sessions(p)
    .filter((d) => d.date >= from && d.date <= to)
    .map((d, i) => ({
      date: d.date,
      dayId: d.date,
      km: 0,
      durationSec: d.session.totalSec,
      completed: true,
      ...extra(i)
    }));
const rwCov = (asOf: string, complete = true): FactsCoverage => ({
  from: START,
  to: asOf,
  complete
});
/** Odluka 5: nivo k-te sesije (od 1) bez adaptacije. */
const projected = (k: number): number => Math.min(12, 1 + Math.floor((k - 1) / 2));

/* ---------- A) ispravke adaptacije ---------- */

describe('Odluka 1: povratni rast do nivoa pre smanjenja (+10%/ned, i oštrenje)', () => {
  const plan = planOf(DEV04);

  it('dev-04 pauza 20 dana: nedelje 9–11 rastu iznad 25,5 km (i u oštrenju), do nivoa 40,8', () => {
    const asOf = endOfWeek(7);
    const r = adapt(plan, { workouts: pause(plan, asOf, 20), coverage: full(asOf) }, asOf);
    expect(errors(r.plan)).toEqual([]);
    const step = r.plan.adaptation!.steps[0]!;
    // Nivo pre smanjenja = poslednja ne-rasteretna nedelja izgradnje završena pre pauze (ned 3).
    expect(step.levelKm).toBe(40.8);
    const t = targets(r.plan);
    expect(t.slice(7, 11)).toEqual([23.7, 26, 28.6, 31.4]);
    for (const i of [8, 9, 10]) {
      expect(t[i]).toBeGreaterThan(25.5);
      expect(t[i]).toBe(Math.min(floor1(t[i - 1]! * 1.1), 40.8));
    }
    expect([r.plan.weeks[9]!.phase, r.plan.weeks[10]!.phase]).toEqual(['sharpen', 'sharpen']);
    // Taper i trka od novog vrha (31,4), ne od 25,5.
    expect(t[11]).toBe(round1(31.4 * 0.85));
  });

  it('kad cilj dostigne nivo, važe redovna pravila (oštrenje drži); povratak ne usporava rast', () => {
    const asOf = endOfWeek(5);
    const w = done(plan, asOf).map((x) =>
      x.date > addDays(asOf, -7) ? { ...x, km: x.km * 0.4 } : x
    );
    const r = adapt(plan, { workouts: w, coverage: full(asOf) }, asOf);
    expect(errors(r.plan)).toEqual([]);
    const t = targets(r.plan);
    expect(t[5]).toBe(36.4); // izvršenje: 80% planiranog
    expect(t[6]).toBe(floor1(36.4 * 1.1)); // +10% (ispod nivoa 40,8)
    expect(t[8]).toBe(43.2); // redovnih +8% (veće od povratka ograničenog nivoom)
    expect([t[9], t[10]]).toEqual([43.2, 43.2]); // iznad nivoa oštrenje drži
  });

  // 5k-v2.6.1 (Segment 08d, Odluka 1 dopuna): osnova = min(0,7 × nivo pre bola 40,8, cilj nedelje sidra
  // 44) = 28,6 (bilo 0,7 × 44 = 30,8): t[5] 33,8 → 31,4, t[8] 40,8 → 37,9 (nivo se dostiže u ned 10).
  it('bol: nedelja sidra zadržava cilj, rast posle nje kreće od 70% nivoa pre bola do nivoa', () => {
    const asOf = endOfWeek(4);
    const w = done(plan, asOf).map((x) => (x.date === addDays(asOf, -1) ? { ...x, pain: 5 } : x));
    const r = adapt(plan, { workouts: w, coverage: full(asOf) }, asOf);
    expect(errors(r.plan)).toEqual([]);
    const t = targets(r.plan);
    expect(t[4]).toBe(44);
    expect(r.plan.weeks[4]!.plannedKm).toBeLessThan(44);
    expect(t[5]).toBe(floor1(round1(0.7 * 40.8) * 1.1));
    expect(t[8]).toBe(37.9);
    expect([t[9], t[10]]).toEqual([40.8, 40.8]);
    expect(r.plan.adaptation!.steps[0]!.returnFrom).toEqual({ week: 5, share: 0.7 });
  });
});

describe('Odluka 2: donja granica cilja = minimum nedelje (izgradnja: broj dana × 3 km)', () => {
  it('5 dana, 30 km, pauza ≥ 28 → nov start 15 km (50%), ne 25 km (83%)', () => {
    const plan = planOf(D5_30);
    const asOf = endOfWeek(6);
    const r = adapt(plan, { workouts: pause(plan, asOf, 35), coverage: full(asOf) }, asOf);
    expect(errors(r.plan)).toEqual([]);
    expect(r.plan.adaptation!.steps[0]!.startKm).toBe(15);
    expect(r.plan.weeks[6]!.targetKm).toBe(15);
  });

  it('taper ispod starih 25 km (≥ 12,5); izgradnja ≥ 15; kvalitet otpada gde ne staje (f)', () => {
    const plan = planOf(D5_30);
    const asOf = endOfWeek(6);
    const r = adapt(plan, { workouts: pause(plan, asOf, 35), coverage: full(asOf) }, asOf);
    const after = r.plan.weeks.filter((w) => w.index > 6);
    const taper = after.filter((w) => w.phase === 'taper');
    expect(taper.length).toBe(2);
    for (const w of taper) {
      expect(w.targetKm).toBeLessThan(25);
      expect(w.targetKm).toBeGreaterThanOrEqual(12.5);
    }
    for (const w of after.filter((x) => x.phase !== 'taper' && x.phase !== 'race'))
      expect(w.targetKm).toBeGreaterThanOrEqual(15);
  });

  it('3 dana, 15 km, pauza 35 → 9 km (3 × 3 km), ne 12 km', () => {
    const plan = planOf({ ...D5_30, runDays: ['tue', 'thu', 'sun'], currentWeeklyKm: 15 });
    const asOf = endOfWeek(6);
    const r = adapt(plan, { workouts: pause(plan, asOf, 35), coverage: full(asOf) }, asOf);
    expect(errors(r.plan)).toEqual([]);
    expect(r.plan.adaptation!.steps[0]!.startKm).toBe(9);
  });
});

describe('Odluka 3: potpunost činjenica (coverage) i eksplicitna pauza', () => {
  const plan = planOf(DEV04);
  const asOf = endOfWeek(7);

  it('nepotpun unos poslednjih 5 dana (complete = false): bez promena obima', () => {
    const r = adapt(
      plan,
      { workouts: done(plan, addDays(asOf, -5)), coverage: partial(asOf) },
      asOf
    );
    expect(S(r.plan.weeks)).toBe(S(plan.weeks));
    expect(applied(r, 'UNDER_EXECUTION') || applied(r, 'PAUSE')).toBe(false);
  });

  it('bez coverage dan bez zapisa je nepoznat: poslednji zapis pre 20 dana nije pauza', () => {
    const r = adapt(plan, { workouts: done(plan, addDays(asOf, -20)) }, asOf);
    expect(S(r.plan.weeks)).toBe(S(plan.weeks));
  });

  it('potpuna pokrivenost: dan bez zapisa = bez trčanja (pauza se priznaje)', () => {
    const r = adapt(plan, { workouts: done(plan, addDays(asOf, -10)), coverage: full(asOf) }, asOf);
    expect(applied(r, 'PAUSE')).toBe(true);
  });

  it('eksplicitna pauza {kind: break} priznaje se bez coverage (i kad je trčanje nastavljeno)', () => {
    const f: AdaptFacts = {
      workouts: [...done(plan, addDays(asOf, -13)), ...doneFacts(plan, asOf, addDays(asOf, -2))],
      breaks: [{ kind: 'break', from: addDays(asOf, -12), to: addDays(asOf, -3) }]
    };
    const r = adapt(plan, f, asOf);
    expect(errors(r.plan)).toEqual([]);
    const p = r.reasons.find((x) => x.condition === 'PAUSE');
    expect(p?.applied).toBe(true);
    expect(p?.message).toContain('prijavljena');
    expect(r.plan.weeks[8]!.targetKm).toBeLessThan(plan.weeks[8]!.targetKm);
  });

  it('odluka 6 („više od plana") ne važi za nepokriven deo', () => {
    const a = endOfWeek(5);
    const w = done(plan, a).map((x) => (x.date > addDays(a, -14) ? { ...x, km: x.km * 1.2 } : x));
    const r = adapt(plan, { workouts: w, coverage: partial(a) }, a);
    expect(r.reasons.some((x) => x.condition === 'OVER_EXECUTION')).toBe(false);
    expect(S(r.plan.weeks)).toBe(S(plan.weeks));
  });

  it('bol, umor i rezultat su eksplicitni: primenjuju se i bez pokrivenosti', () => {
    const a = endOfWeek(4);
    const w = done(plan, a).map((x) => (x.date === addDays(a, -1) ? { ...x, pain: 5 } : x));
    const res = { distM: 5000, sec: 1180, date: a, kind: 'race' as const };
    const r = adapt(plan, { workouts: w, results: [res] }, a);
    expect(applied(r, 'PAIN')).toBe(true);
    expect(applied(r, 'NEW_RESULT')).toBe(true);
  });
});

/* ---------- B) trčanje/hodanje ---------- */

describe('Odluka 4: lestvica trčanja/hodanja (policy.runWalk, jedna tabela)', () => {
  it('12 nivoa; L1 1:00/2:00 × 8, L10/L11/L12 kontinuirano 20/25/30 min; aktivno 20–35 min', () => {
    const L = P.runWalk.levels;
    expect(L).toHaveLength(12);
    expect(L[0]).toEqual({ level: 1, runSec: 60, walkSec: 120, reps: 8 });
    expect(L.slice(9).map((l) => [l.runSec, l.walkSec, l.reps])).toEqual([
      [1200, 0, 1],
      [1500, 0, 1],
      [1800, 0, 1]
    ]);
    L.forEach((l, i) => {
      const active = l.reps * l.runSec + (l.reps - 1) * l.walkSec;
      expect(active).toBeGreaterThanOrEqual(20 * 60);
      expect(active).toBeLessThanOrEqual(35 * 60);
      if (i > 0) {
        expect(l.runSec).toBeGreaterThan(L[i - 1]!.runSec);
        expect(l.walkSec).toBeLessThanOrEqual(L[i - 1]!.walkSec);
      }
    });
  });

  it('sesija: 5 min hoda pre i posle, RPE 3–4 razgovorno, bez kvaliteta i tempa; km samo procena', () => {
    const noPace = rwPlanOf(rwInput(10));
    const pace = rwPlanOf(rwInput(10, { typicalEasyPaceSecPerKm: 420 }));
    expect(errors(noPace)).toEqual([]);
    for (const d of sessions(noPace)) {
      const s = d.session;
      expect([s.warmupWalkSec, s.cooldownWalkSec]).toEqual([300, 300]);
      expect([s.effort.rpeMin, s.effort.rpeMax]).toEqual([3, 4]);
      expect(s.effort.cue).toContain('razgovorno');
      expect(s.estRunKm).toBeNull();
      expect(S(s)).not.toMatch(/pace|quality/i);
    }
    for (const d of sessions(pace))
      expect(d.session.estRunKm).toBe(Math.round((d.session.runTotalSec / 420) * 100) / 100);
    expect(noPace.goal.status).toBe('finish');
  });
});

describe('Odluka 5: projekcija — +1 nivo na svake 2 odrađene sesije, nivo za svaki dan', () => {
  it.each([6, 8, 10, 12, 16])('%i nedelja', (weeks) => {
    const p = rwPlanOf(rwInput(weeks));
    expect(errors(p)).toEqual([]);
    expect(p.weeks).toHaveLength(weeks);
    const build = sessions(p).filter((d) => d.date < p.weeks.at(-1)!.startDate);
    expect(build).toHaveLength((weeks - 1) * 3);
    build.forEach((d, i) => {
      expect(d.level).toBe(projected(i + 1));
      expect(d.projection).toBe(i >= 2);
      expect(['tue', 'thu', 'sat']).toContain(d.weekday);
    });
  });
});

describe('Odluka 6: napredak kroz adaptFiveKV2 (isto API)', () => {
  // Plan se pravi u testu (na c9003aa generisanje pada pojedinačno, ne pri učitavanju fajla).
  let cached: FiveKV2RunWalkPlan | null = null;
  const plan10 = (): FiveKV2RunWalkPlan => (cached ??= rwPlanOf(rwInput(10)));
  const asOf = endOfWeek(3);
  const next = (r: RwOk): Session => sessions(r.plan).find((d) => d.date > asOf)!;

  it('2 uzastopne dobre sesije → +1 (sve odrađeno RPE 5 = projekcija)', () => {
    const r = adaptRw(
      plan10(),
      { workouts: sessionFacts(plan10(), asOf), coverage: rwCov(asOf) },
      asOf
    );
    expect(errors(r.plan)).toEqual([]);
    expect(r.plan.adaptation!.steps[0]).toMatchObject({ level: 5, good: 1 });
    expect(sessions(r.plan).map((d) => d.level)).toEqual(sessions(plan10()).map((d) => d.level));
    expect(next(r).projection).toBe(false);
  });

  it('RPE ≥ 7 → isti nivo (ostatak projekcije od L1)', () => {
    const f = sessionFacts(plan10(), asOf, () => ({ rpe: 7 }));
    const r = adaptRw(plan10(), { workouts: f, coverage: rwCov(asOf) }, asOf);
    expect(r.plan.adaptation!.steps[0]!.level).toBe(1);
    expect(
      sessions(r.plan)
        .filter((d) => d.date > asOf)
        .map((d) => d.level)
        .slice(0, 3)
    ).toEqual([1, 1, 2]);
  });

  it('bol ≥ 4 → −1', () => {
    const f = sessionFacts(plan10(), asOf, (i) => (i === 8 ? { rpe: 5, pain: 5 } : { rpe: 5 }));
    const r = adaptRw(plan10(), { workouts: f, coverage: rwCov(asOf) }, asOf);
    expect(r.plan.adaptation!.steps[0]!.level).toBe(4);
    expect(next(r).level).toBe(4);
    expect(r.reasons.find((x) => x.condition === 'PAIN')!.message).toContain('stručni pregled');
  });

  it('pauza 7–13 dana → −1', () => {
    const f = sessionFacts(plan10(), addDays(asOf, -10));
    const r = adaptRw(plan10(), { workouts: f, coverage: rwCov(asOf) }, asOf);
    expect(r.plan.adaptation!.steps[0]!.level).toBe(2); // 5 sesija → L3, pauza → L2
    expect(applied(r, 'PAUSE')).toBe(true);
  });

  it('pauza ≥ 14 dana → −2, ne ispod L1', () => {
    const a = endOfWeek(5);
    const r = adaptRw(
      plan10(),
      { workouts: sessionFacts(plan10(), addDays(a, -15)), coverage: rwCov(a) },
      a
    );
    expect(r.plan.adaptation!.steps[0]!.level).toBe(3); // 9 sesija → L5, pauza 15 → L3
    const b = endOfWeek(4);
    const r2 = adaptRw(
      plan10(),
      { workouts: sessionFacts(plan10(), addDays(b, -20)), coverage: rwCov(b) },
      b
    );
    expect(r2.plan.adaptation!.steps[0]!.level).toBe(1);
  });

  it('nepotpun unos: dani bez zapisa nisu pauza ni propuštena sesija', () => {
    const f = sessionFacts(plan10(), addDays(asOf, -5));
    const r = adaptRw(plan10(), { workouts: f, coverage: rwCov(asOf, false) }, asOf);
    expect(r.plan.adaptation!.steps[0]).toMatchObject({ level: 4, good: 1, pauseDays: 0 });
    expect(r.reasons.some((x) => x.condition === 'PAUSE')).toBe(false);
  });
});

describe('Odluka 7: trka — odnos poslednjeg nivoa ako je < L12, cilj „završiti"; 2 lakše sesije', () => {
  it('6 nedelja: L8 → trka 10:00 trčanje / 1:30 hod, sesije trkačke nedelje L7 (bez dana pred trku)', () => {
    const p = rwPlanOf(rwInput(6));
    const r = raceOf(p);
    expect(r.date).toBe(race(6));
    expect(r.level).toBe(8);
    expect(r.race).toMatchObject({ distanceKm: 5, runSec: 600, walkSec: 90, continuous: false });
    expect(r.race.goal).toBe('finish');
    expect(S(r.race)).not.toMatch(/timeSec|goalTime|pace/);
    const rw = p.weeks.at(-1)!.days.filter((d): d is Session => d.role === 'session');
    expect(rw.map((d) => [d.weekday, d.level])).toEqual([
      ['tue', 7],
      ['thu', 7]
    ]);
  });

  it('8 nedelja: kontinuiran nivo < L12 (L11) → 25:00 trčanje / 1:00 hod', () => {
    const r = raceOf(rwPlanOf(rwInput(8)));
    expect([r.level, r.race.runSec, r.race.walkSec, r.race.continuous]).toEqual([
      11,
      1500,
      60,
      false
    ]);
  });

  it('12 nedelja: L12 → trka bez hodanja; pon/sre/pet → sesije sre i pet', () => {
    const p = rwPlanOf(rwInput(12, { runDays: ['mon', 'wed', 'fri'] }));
    expect(raceOf(p).race.continuous).toBe(true);
    expect(
      p.weeks
        .at(-1)!
        .days.filter((d) => d.role === 'session')
        .map((d) => [d.weekday, d.level])
    ).toEqual([
      ['wed', 11],
      ['fri', 11]
    ]);
  });
});

describe('Odluka 8: L12 i ≥ 6 nedelja do trke → ostatak kao početnik (isti konstruktor)', () => {
  let cached: FiveKV2RunWalkPlan | null = null;
  const plan16 = (): FiveKV2RunWalkPlan =>
    (cached ??= rwPlanOf(rwInput(16, { typicalEasyPaceSecPerKm: 420 })));
  const asOf = endOfWeek(8);
  const facts = (): AdaptFacts => ({
    workouts: sessionFacts(plan16(), asOf),
    coverage: rwCov(asOf)
  });

  it('prelaz od nedelje 9: kontinuirani plan = generateFiveKV2(početnik po osećaju); reasons', () => {
    const r = adaptRw(plan16(), facts(), asOf);
    expect(errors(r.plan)).toEqual([]);
    expect(applied(r, 'TRANSITION')).toBe(true);
    const c = r.plan.continuous!;
    expect(c.fromWeek).toBe(9);
    expect(r.plan.weeks).toHaveLength(8);
    const same = planOf({
      startDate: addDays(START, 8 * 7),
      raceDate: race(16),
      runDays: ['tue', 'thu', 'sat'],
      currentWeeklyKm: round1((3 * 1800) / 420),
      typicalEasyPaceSecPerKm: 420,
      experience: 'beginner',
      canRun30Min: true
    });
    expect(S(c.plan)).toBe(S(same));
    expect([c.plan.experience, c.plan.paceMode]).toEqual(['beginner', 'feel']);
    for (const w of plan16().weeks.slice(0, 8)) expect(S(r.plan.weeks[w.index - 1])).toBe(S(w));
  });

  it('bez uobičajenog tempa ili sa < 6 nedelja do trke: bez prelaza (reason applied = false)', () => {
    const q = rwPlanOf(rwInput(16));
    const r = adaptRw(q, { workouts: sessionFacts(q, asOf), coverage: rwCov(asOf) }, asOf);
    expect(r.plan.continuous).toBeNull();
    expect(r.reasons.find((x) => x.condition === 'TRANSITION')?.applied).toBe(false);
    const s = rwPlanOf(rwInput(12, { typicalEasyPaceSecPerKm: 420 }));
    const a = endOfWeek(8);
    const r2 = adaptRw(s, { workouts: sessionFacts(s, a), coverage: rwCov(a) }, a);
    expect(r2.plan.continuous).toBeNull();
    expect(r2.reasons.find((x) => x.condition === 'TRANSITION')?.message).toContain('< 6');
  });

  it('posle prelaza adaptira se kontinuirani deo; deo trčanja/hodanja ostaje bajt-isti', () => {
    const r = adaptRw(plan16(), facts(), asOf);
    const a2 = endOfWeek(9);
    const sub = r.plan.continuous!.plan;
    const f2 = {
      workouts: [...sessionFacts(plan16(), asOf), ...doneFacts(sub, a2)],
      coverage: rwCov(a2)
    };
    const r2 = adaptRw(r.plan, f2, a2);
    expect(errors(r2.plan)).toEqual([]);
    expect(S(r2.plan.weeks)).toBe(S(r.plan.weeks));
    expect(S(r2.plan.continuous!.plan.weeks)).toBe(S(sub.weeks));
  });
});

describe('Uslov 8: validator obara degenerisan plan trčanja/hodanja', () => {
  it('prazna sesija, skok nivoa > 1, sesija van tabele', () => {
    const p = rwPlanOf(rwInput(8));
    const bad = JSON.parse(S(p)) as FiveKV2RunWalkPlan;
    const s = sessions(bad);
    s[0]!.session.activeSec = 0;
    s[3]!.level = s[2]!.level + 3;
    const rules = errors(bad).map((v) => v.rule);
    expect(rules).toContain('EMPTY_WORKOUT');
    expect(rules).toContain('RW_LEVEL_JUMP');
    expect(rules).toContain('RW_SESSION');
  });
});

/* ---------- Mreže ---------- */

describe('Mreža A: adaptNetwork × (nepotpun unos 5 dana, eksplicitna pauza) → 0 grešaka', () => {
  const net = adaptNetwork();
  it.each(net.map((x) => [x.id, x.input] as const))('%s', (_, input) => {
    const plan = planOf(input);
    const N = plan.weeks.length;
    const asOf = endOfWeek(Math.max(2, Math.floor(N / 2)));
    const incomplete = adapt(
      plan,
      { workouts: done(plan, addDays(asOf, -5)), coverage: partial(asOf) },
      asOf
    );
    expect(errors(incomplete.plan)).toEqual([]);
    expect(targets(incomplete.plan)).toEqual(targets(plan));
    expect(S(incomplete.plan.weeks)).toBe(S(plan.weeks));
    const brk = adapt(
      plan,
      {
        workouts: done(plan, addDays(asOf, -10)),
        breaks: [{ kind: 'break', from: addDays(asOf, -9), to: asOf }]
      },
      asOf
    );
    expect(errors(brk.plan)).toEqual([]);
    expect(applied(brk, 'PAUSE')).toBe(true);
    for (const d of days(plan))
      if (d.date <= asOf) expect(S(days(brk.plan).find((x) => x.date === d.date))).toBe(S(d));
    expect(brk.plan.weeks.at(-1)!.endDate).toBe(plan.input.raceDate);
  });
});

const RW_NET = [6, 8, 12, 16].flatMap((weeks) => [
  {
    id: `rw-${weeks}w-pocetnik-e420`,
    input: rwInput(weeks, { experience: 'beginner', typicalEasyPaceSecPerKm: 420 })
  },
  { id: `rw-${weeks}w-bez-tempa`, input: rwInput(weeks, { runDays: ['mon', 'wed', 'fri'] }) },
  {
    id: `rw-${weeks}w-pocetnik-e480`,
    input: rwInput(weeks, {
      experience: 'beginner',
      typicalEasyPaceSecPerKm: 480,
      runDays: ['mon', 'thu', 'sat']
    })
  },
  {
    id: `rw-${weeks}w-rezultat-e400`,
    input: rwInput(weeks, {
      typicalEasyPaceSecPerKm: 400,
      runDays: ['sun', 'tue', 'thu'],
      currentWeeklyKm: 8,
      recentResult: { distanceM: 5000, timeSec: 2700, date: addDays(START, -30) },
      goalTimeSec: 2400
    })
  }
]);

describe('Mreža B: trčanje/hodanje 6/8/12/16 ned × 6 scenarija → 0 grešaka validatora', () => {
  it('16 planova', () => expect(RW_NET).toHaveLength(16));
  it.each(RW_NET.map((x) => [x.id, x.input] as const))('%s', (_, input) => {
    const p = rwPlanOf(input);
    expect(errors(p)).toEqual([]);
    const N = p.weeks.length;
    const asOf = endOfWeek(Math.max(2, Math.floor(N / 2)));
    const scenarios: Record<string, AdaptFacts> = {
      sve: { workouts: sessionFacts(p, asOf), coverage: rwCov(asOf) },
      rpe7: { workouts: sessionFacts(p, asOf, () => ({ rpe: 7 })), coverage: rwCov(asOf) },
      bol5: {
        workouts: sessionFacts(p, asOf).map((x, i, a) =>
          i === a.length - 1 ? { ...x, pain: 5 } : x
        ),
        coverage: rwCov(asOf)
      },
      pauza10: { workouts: sessionFacts(p, addDays(asOf, -10)), coverage: rwCov(asOf) },
      pauza20: { workouts: sessionFacts(p, addDays(asOf, -20)), coverage: rwCov(asOf) },
      nepotpun: { workouts: sessionFacts(p, addDays(asOf, -5)), coverage: rwCov(asOf, false) }
    };
    for (const [name, facts] of Object.entries(scenarios)) {
      const r = adaptFiveKV2(p, facts, asOf);
      expect([name, r.ok ? 'ok' : S(r.reasons) + S(r.violations)]).toEqual([name, 'ok']);
      if (!r.ok) continue;
      expect([name, errors(r.plan)]).toEqual([name, []]);
      // Prošlost bajt-ista; trka na mestu (ili u kontinuiranom delu posle prelaza).
      const before = p.weeks.flatMap((w) => w.days).filter((d) => d.date <= asOf);
      const after = r.plan.weeks.flatMap((w) => w.days);
      for (const d of before) expect(S(after.find((x) => x.date === d.date))).toBe(S(d));
      const c = r.plan.continuous;
      if (c) {
        expect(r.plan.adaptation!.steps.at(-1)!.level).toBe(12);
        expect(c.plan.weeks.at(-1)!.endDate).toBe(p.input.raceDate);
      } else expect(raceOf(r.plan).date).toBe(p.input.raceDate);
      if (name === 'sve' && !c)
        expect(sessions(r.plan).map((d) => d.level)).toEqual(sessions(p).map((d) => d.level));
      if (name === 'rpe7') expect(r.plan.adaptation!.steps[0]!.level).toBe(1);
      if (name === 'bol5') expect(applied(r, 'PAIN')).toBe(true);
      if (name.startsWith('pauza')) expect(applied(r, 'PAUSE')).toBe(true);
      if (name === 'nepotpun') expect(r.reasons.some((x) => x.condition === 'PAUSE')).toBe(false);
      // Lanac: sledeća adaptacija posle 7 dana (sve odrađeno), prethodni korak ostaje.
      const a2 = addDays(asOf, 7);
      const more = c
        ? doneFacts(c.plan, a2)
        : sessionFacts(r.plan, a2, () => ({ rpe: 5 }), addDays(asOf, 1));
      const f2 = {
        ...facts,
        workouts: [...(facts.workouts ?? []), ...more],
        coverage: rwCov(a2, facts.coverage!.complete)
      };
      const r2 = adaptFiveKV2(r.plan, f2, a2);
      expect([name, r2.ok ? 'ok' : S(r2.reasons) + S(r2.violations)]).toEqual([name, 'ok']);
      if (r2.ok) {
        expect([name, errors(r2.plan)]).toEqual([name, []]);
        if (!c) expect(r2.plan.adaptation!.steps.slice(0, 1)).toEqual(r.plan.adaptation!.steps);
      }
    }
  });
});

/* ---------- Regresija: generisanje bez adaptacije ---------- */

function regressionInputs(): [string, Record<string, unknown>][] {
  const out: [string, Record<string, unknown>][] = [];
  const DAYS: Record<number, string[][]> = {
    3: [
      ['tue', 'thu', 'sun'],
      ['mon', 'wed', 'sat']
    ],
    4: [
      ['tue', 'thu', 'sat', 'sun'],
      ['mon', 'wed', 'fri', 'sat']
    ],
    5: [['mon', 'tue', 'thu', 'sat', 'sun']]
  };
  const KM: Record<number, number[]> = {
    3: [12, 18, 28, 35],
    4: [15, 22, 35, 45],
    5: [25, 38, 50, 65]
  };
  for (const d of [3, 4, 5])
    for (const days of DAYS[d]!)
      for (const km of KM[d]!)
        for (const weeks of [6, 7, 8, 10, 12, 14, 16])
          for (const mode of ['v45', 'v36', 'feel', 'beg', 'begRes']) {
            const input: Record<string, unknown> = {
              startDate: START,
              raceDate: addDays(START, weeks * 7 - 1),
              runDays: days,
              currentWeeklyKm: km
            };
            if (mode === 'v45')
              input['recentResult'] = { distanceM: 5000, timeSec: 1340, date: addDays(START, -14) };
            if (mode === 'v36')
              input['recentResult'] = {
                distanceM: 10000,
                timeSec: 3400,
                date: addDays(START, -20)
              };
            if (mode === 'feel') input['typicalEasyPaceSecPerKm'] = 375;
            if (mode === 'beg')
              Object.assign(input, {
                experience: 'beginner',
                canRun30Min: true,
                typicalEasyPaceSecPerKm: 430
              });
            if (mode === 'begRes')
              Object.assign(input, {
                experience: 'beginner',
                canRun30Min: true,
                recentResult: { distanceM: 5000, timeSec: 1800, date: addDays(START, -10) }
              });
            if (mode !== 'v45' && mode !== 'v36') input['goalTimeSec'] = 1600;
            out.push([`d${d}-${days.join('')}-${km}-${weeks}-${mode}`, input]);
          }
  return out;
}

/** 08h: broj planova regresione mreže sa drugim danom kvaliteta laganim (pouka 35). */
const P35_CHANGED = 14;

describe('Generisanje bez adaptacije: postojeće grane bajt-iste kao c9003aa (osim policyVersion)', () => {
  it('700 ulaza (640 planova): heš JSON-a = fixture sa c9003aa', () => {
    const fixture = JSON.parse(
      readFileSync(new URL('./segment07.generate-c9003aa.json', import.meta.url), 'utf8')
    ) as Record<string, string>;
    const got: Record<string, string> = {};
    for (const [id, input] of regressionInputs()) {
      const r = generateFiveKV2(input);
      got[id] = r.ok
        ? createHash('sha256')
            .update(S({ ...r.plan, policyVersion: '-' }))
            .digest('hex')
            .slice(0, 16)
        : `REJ:${r.reasons.map((x) => x.code).join(',')}`;
    }
    expect(Object.keys(got)).toHaveLength(700);
    expect(Object.values(got).filter((x) => !x.startsWith('REJ')).length).toBe(640);
    // 08h (5k-v2.8.1, pouka 35): planovi sa drugim danom kvaliteta laganim se menjaju (testInputs.hasSecondEasy),
    // svi ostali bajt-isti.
    const p35 = [...regressionInputs()]
      .filter(([, input]) => hasSecondEasy(generateFiveKV2(input)))
      .map(([id]) => id);
    for (const id of p35) {
      expect(got[id], id).not.toBe(fixture[id]);
      delete got[id];
      delete fixture[id];
    }
    expect(p35.length).toBe(P35_CHANGED);
    expect(got).toEqual(fixture);
  });
});
