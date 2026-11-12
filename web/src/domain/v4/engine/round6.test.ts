import { describe, expect, it } from 'vitest';
import { buildCtx, type EasyRef, layoutWeek, weekSlots } from './build';
import { addDays, diffDays, weekdayOf } from './dates';
import { guard, validate, weekCost } from './guard';
import {
  buildState,
  canonical,
  deriveEvents,
  paceCtxOf,
  plan,
  renderPlan,
  replan,
  summarize
} from './index';
import { EXAMPLE } from './testdata/example';
import { facts, goalAt, HALF_M, runsAsPlanned } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type {
  DistanceData,
  Goal,
  PlanDay,
  PlanDoc,
  PlanEvent,
  Run,
  RunnerFacts,
  RunnerState,
  Weekday
} from './types';
import { effortResult, raceTimeSec } from './vdot';

/* KRUG 3: nalazi nezavisne recenzije (`docs/generators-v4/qa/QA1-ENGINE-REVIEW.md`) — po jedan test za svaki. */

const GOAL: Goal = goalAt('2027-01-24');
const EX_GOAL: Goal = { distanceId: EXAMPLE.id, raceDate: '2027-03-07' };
/** Jedno zaokruživanje laganog dana (0,5 km ili 5 min). */
const ROUND = 215;

function make(
  f: RunnerFacts,
  data: DistanceData = SYNTHETIC,
  goal: Goal = GOAL
): { doc: PlanDoc; state: RunnerState } {
  const state = buildState(f, goal, data);
  const result = plan(state, goal, data);
  if (!result.ok) throw new Error(`plan odbijen: ${result.errors.map((e) => e.code).join(',')}`);
  return { doc: result.doc, state };
}

const days = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);
const secOf = (doc: PlanDoc, day: PlanDay | undefined): number =>
  summarize(day?.workout ?? null, paceCtxOf(doc.header)).durationSec;
const isFast = (day: PlanDay | undefined): boolean =>
  day?.workout != null &&
  day.workout.kind !== 'race' &&
  (day.workout.kind === 'quality' || day.workout.kind === 'test' || day.workout.workSec > 0);
const withSafety = (over: Partial<DistanceData['safety']>): DistanceData => ({
  ...SYNTHETIC,
  safety: { ...SYNTHETIC.safety, ...over }
});
const synTemplate = SYNTHETIC.templates[1];
if (synTemplate === undefined) throw new Error('nema šablona');

/** Sintetička distanca sa proverom forme (test 3 km) u drugoj nedelji tela. */
const WITH_TEST: DistanceData = {
  ...SYNTHETIC,
  templates: [
    {
      ...synTemplate,
      recoveryEvery: 0,
      body: synTemplate.body.map((p, pi) => ({
        ...p,
        cycle: p.cycle.map((w, i) =>
          pi === 0 && i === 1
            ? { ...w, stimuli: [{ stimulus: 'test' }, { stimulus: 'ubrzanja' }] }
            : w
        )
      }))
    }
  ]
};

describe('K1: provera forme upisana kao jedna aktivnost sa zagrevanjem', () => {
  const start = make(facts(), WITH_TEST);
  const testDay = days(start.doc).find((d) => d.workout?.kind === 'test');
  if (testDay === undefined) throw new Error('plan nema proveru forme');
  const cost = summarize(testDay.workout, paceCtxOf(start.doc.header));
  const stateWith = (over: Partial<Run>): RunnerState => {
    const before = runsAsPlanned(start.doc, addDays(testDay.date, -1));
    const run: Run = {
      id: 'test',
      date: testDay.date,
      distanceM: Math.round(cost.distanceM),
      durationSec: Math.round(cost.durationSec),
      dayId: testDay.id,
      effort: 'test',
      ...over
    };
    return buildState(
      { ...facts(), today: testDay.date, runs: [...before, run] },
      GOAL,
      WITH_TEST,
      undefined,
      start.doc
    );
  };

  it('`effortResult`: izričit rezultat, krugovi rada, najbrži niz kilometara, pa cela aktivnost samo kad je ≈ planirana', () => {
    const base: Run = { id: 'x', date: '2026-11-20', distanceM: 9200, durationSec: 2831 };
    expect(effortResult(base)).toEqual({ distanceM: 9200, durationSec: 2831 });
    const tied = { ...base, plannedEffortM: 3000 };
    expect(effortResult(tied)).toBeNull();
    expect(effortResult({ ...tied, distanceM: 3300, durationSec: 800 })).toEqual({
      distanceM: 3300,
      durationSec: 800
    });
    expect(effortResult({ ...tied, resultSec: 765 })).toEqual({
      distanceM: 3000,
      durationSec: 765
    });
    expect(effortResult({ ...tied, resultSec: 765, resultDistanceM: 3100 })).toEqual({
      distanceM: 3100,
      durationSec: 765
    });
    const laps: Run['laps'] = [
      { role: 'other', distanceM: 3000, durationSec: 1050 },
      { role: 'work', distanceM: 3000, durationSec: 770 },
      { role: 'other', distanceM: 3200, durationSec: 1011 }
    ];
    expect(effortResult({ ...tied, laps })).toEqual({ distanceM: 3000, durationSec: 770 });
    const splits = [350, 352, 348, 262, 258, 256, 340, 345, 350].map((paceSec) => ({ paceSec }));
    expect(effortResult({ ...tied, splits })).toEqual({ distanceM: 3000, durationSec: 776 });
  });

  it('cela aktivnost ne obara formu ni tempa; plan ostaje na brojevima, bez sporijih tempa', () => {
    const state = stateWith({});
    expect(state.runs.find((r) => r.id === 'test')?.plannedEffortM).toBe(3000);
    expect(state.form.current.vdot).toBeCloseTo(start.state.form.current.vdot, 5);
    const r = replan(start.doc, state, deriveEvents(start.doc, state), WITH_TEST);
    expect(r.doc.header.paces).toEqual(start.doc.header.paces);
    expect(r.doc.header.form.paceVdot).toBe(start.doc.header.form.paceVdot);
  });

  it('isti test sa krugom rada ili izričitim vremenom pomera formu i tempa', () => {
    const fasterSec = Math.round(raceTimeSec(start.state.form.current.vdot + 2, 3000));
    for (const over of [
      { resultSec: fasterSec },
      {
        laps: [
          { role: 'other' as const, distanceM: 2500, durationSec: 900 },
          { role: 'work' as const, distanceM: 3000, durationSec: fasterSec },
          { role: 'other' as const, distanceM: 1700, durationSec: 620 }
        ]
      }
    ]) {
      const state = stateWith(over);
      expect(state.form.current.vdot).toBeGreaterThan(start.state.form.current.vdot + 1);
      const r = replan(start.doc, state, deriveEvents(start.doc, state), WITH_TEST);
      expect(r.doc.header.paces.T).toBeLessThan(start.doc.header.paces.T);
      expect(r.changes.some((c) => c.reason.includes('Rezultat 3 km za'))).toBe(true);
    }
  });
});

describe('O2: izjavljen obim i retka istorija', () => {
  const profile = { weeklyKm: 40, recentResult: { distanceM: HALF_M, timeSec: 6060 } };
  const old = (age: number): Run => ({
    id: `staro-${String(age)}`,
    date: addDays('2026-11-15', -age),
    distanceM: 8000,
    durationSec: 2800
  });

  it('jedno staro trčanje ne obara bazu: izjava je seme, prva nedelja ≈ izjavljeni obim', () => {
    const clean = make(facts({ profile }));
    for (const age of [200, 50, 20, 3]) {
      const { doc, state } = make(facts({ profile, runs: [old(age)] }));
      expect(state.load.seeded, String(age)).toBe(true);
      expect(doc.header.decisions.baseLoad, String(age)).toBeCloseTo(
        clean.doc.header.decisions.baseLoad,
        1
      );
      const first = doc.weeks[0];
      const km = first === undefined ? 0 : weekCost(first, GOAL.raceDate, paceCtxOf(doc.header)).km;
      expect(km, String(age)).toBeGreaterThanOrEqual(38);
      expect(guard(doc, state, SYNTHETIC).filter((x) => x.check === 'prazan')).toEqual([]);
    }
  });

  it('merodavna istorija (≥ 6 trčanja u ≥ 21 danu) određuje bazu; ispod polovine izjave → upozorenje', () => {
    const runs: Run[] = Array.from({ length: 16 }, (_, i) => 2 + 6 * i).map((age) => ({
      id: `r${String(age)}`,
      date: addDays('2026-11-15', -age),
      distanceM: 4000,
      durationSec: 1400
    }));
    const { doc, state } = make(facts({ profile, runs }));
    expect(state.load.seeded).toBe(false);
    const w = doc.header.warnings.find((x) => x.code === 'baza-ispod-izjave');
    expect(w?.problem).toContain('Naveo si 40 km nedeljno');
    expect(make(facts({ profile })).doc.header.warnings.map((x) => x.code)).not.toContain(
      'baza-ispod-izjave'
    );
    /* Pet trčanja ili kraći raspon nisu merodavni. */
    expect(make(facts({ profile, runs: runs.slice(0, 5) })).state.load.seeded).toBe(true);
    expect(
      make(
        facts({
          profile,
          runs: runs.slice(0, 6).map((r, i) => ({ ...r, date: addDays('2026-11-15', -i) }))
        })
      ).state.load.seeded
    ).toBe(true);
  });

  it('nijedan trening iz `plan` nije kraći od najkraćeg smislenog trčanja; čuvar `prazan` hvata kraći', () => {
    const least = Math.min(SYNTHETIC.safety.minEasySec, 1200) - ROUND;
    for (const km of [5, 12, 30, 80]) {
      for (const runDays of [
        [1, 3, 6],
        [1, 3, 5, 6],
        [0, 1, 2, 3, 5, 6]
      ] as Weekday[][]) {
        const { doc } = make(
          facts({
            availability: { runDays, longDay: 6 },
            profile: { weeklyKm: km, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
          })
        );
        for (const day of days(doc)) {
          if (day.workout === null || day.workout.kind === 'race') continue;
          expect(secOf(doc, day), `${String(km)} km ${day.date}`).toBeGreaterThanOrEqual(least);
        }
        /* S13: dugi nije kraći od najkraćeg laganog trčanja. */
        for (const week of doc.weeks) {
          if (week.longSec > 0)
            expect(week.longSec).toBeGreaterThanOrEqual(SYNTHETIC.safety.minEasySec);
        }
      }
    }
    const { doc, state } = make(facts());
    const victim = days(doc).find((d) => d.workout?.kind === 'easy' && d.date > '2026-11-20');
    const broken: PlanDoc = {
      ...doc,
      weeks: doc.weeks.map((w) => ({
        ...w,
        days: w.days.map((d) =>
          d.id === victim?.id && d.workout !== null
            ? {
                ...d,
                workout: {
                  ...d.workout,
                  steps: [
                    {
                      role: 'steady' as const,
                      target: { type: 'zone' as const, zone: 'E' as const },
                      extent: { durationSec: 905 }
                    }
                  ]
                }
              }
            : d
        )
      }))
    };
    expect(guard(broken, state, SYNTHETIC).map((x) => x.check)).toContain('prazan');
  });
});

describe('O3: poslednji dani pre trke važe po datumu, preko granice nedelje', () => {
  const big = { weeklyKm: 55, recentResult: { distanceM: HALF_M, timeSec: 6060 } };

  it('trka svakog dana u nedelji: dan pred trku je odmor ili lagano ≤ 20 min, bez dugog u 6 dana, bez kvaliteta u 2 dana', () => {
    let eves = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      const raceDate = addDays('2027-01-25', offset);
      for (const runDays of [
        [1, 3, 5, 6],
        [0, 2, 4, 6],
        [0, 1, 2, 3, 4, 5, 6]
      ] as Weekday[][]) {
        const f = facts({ availability: { runDays, longDay: 6 }, profile: big });
        const { doc, state } = make(f, SYNTHETIC, goalAt(raceDate));
        const name = `trka ${raceDate}, dani ${runDays.join('')}`;
        for (const day of days(doc)) {
          const left = diffDays(raceDate, day.date);
          if (left < 1 || day.workout === null) continue;
          if (left === 1) {
            expect(day.workout.kind, name).toBe('easy');
            expect(day.workout.stimulus, name).toBeNull();
            expect(secOf(doc, day), name).toBeLessThanOrEqual(1200 + ROUND);
            eves += 1;
          }
          if (left <= 2) expect(isFast(day), `${name} ${day.date}`).toBe(false);
          if (left <= 6) expect(day.workout.kind, `${name} ${day.date}`).not.toBe('long');
        }
        const found = guard(doc, state, SYNTHETIC).map((x) => x.check);
        expect(found, name).not.toContain('dan-pred-trku');
        expect(found, name).not.toContain('dugi-pred-trku');
      }
    }
    expect(eves).toBeGreaterThan(8);
  });

  it('trka u ponedeljak: nedelja pre nje nema dugi dan pred trku (bilo: dugi 10 km)', () => {
    const { doc } = make(facts({ profile: big }), SYNTHETIC, goalAt('2027-01-25'));
    const sunday = days(doc).find((d) => d.date === '2027-01-24');
    expect(sunday?.workout?.kind ?? 'easy').toBe('easy');
    expect(secOf(doc, sunday)).toBeLessThanOrEqual(1200 + ROUND);
  });

  it('čuvar prijavljuje dug dan pred trku i dugi u poslednjih 6 dana', () => {
    const { doc, state } = make(facts({ profile: big }));
    const long = days(doc).find((d) => d.workout?.kind === 'long');
    const eve = addDays(GOAL.raceDate, -1);
    const broken: PlanDoc = {
      ...doc,
      weeks: doc.weeks.map((w) => ({
        ...w,
        days: w.days.map((d) => (d.date === eve ? { ...d, workout: long?.workout ?? null } : d))
      }))
    };
    const found = guard(broken, state, SYNTHETIC).map((x) => x.check);
    expect(found).toContain('dan-pred-trku');
    expect(found).toContain('dugi-pred-trku');
  });
});

describe('O4: posle prvog usvojenog rezultata tempa nisu po osećaju', () => {
  const feel = facts({ profile: { weeklyKm: 30, easyPaceSecPerKm: 372 } });
  const start = make(feel);

  it('plan po osećaju ima upozorenje `nema-podataka`; rezultat ga uklanja i uključuje tempa — i kad je razlika mala', () => {
    expect(start.doc.header.paces.byFeel).toBe(true);
    expect(start.doc.header.warnings.map((w) => w.code)).toContain('nema-podataka');
    const vdot = start.state.form.current.vdot;
    for (const delta of [3, 0.1]) {
      const test: Run = {
        id: 't5',
        date: '2026-11-20',
        distanceM: 5000,
        durationSec: Math.round(raceTimeSec(vdot + delta, 5000)),
        effort: 'test'
      };
      const state = buildState(
        { ...feel, today: '2026-11-20', runs: [...runsAsPlanned(start.doc, '2026-11-19'), test] },
        GOAL,
        SYNTHETIC,
        undefined,
        start.doc
      );
      const r = replan(start.doc, state, deriveEvents(start.doc, state), SYNTHETIC);
      expect(r.doc.header.paces.byFeel, String(delta)).toBe(false);
      expect(
        r.doc.header.warnings.map((w) => w.code),
        String(delta)
      ).not.toContain('nema-podataka');
      expect(renderPlan(r.doc, state, SYNTHETIC)).not.toContain('zadati po osećaju');
    }
  });
});

describe('O5: neispravan datum bilo gde u ulazu se odbija, nikad izuzetak', () => {
  it('`buildState` i `plan` ne bacaju; `validate` imenuje polje', () => {
    const cases: RunnerFacts[] = [
      { ...facts(), today: 'abc' },
      { ...facts(), today: '2026-02-30' },
      { ...facts(), pain: [{ date: 'x', level: Number.NaN }] },
      { ...facts(), pain: [{ date: '2026-11-10', level: 4, resolvedOn: 'juče' }] },
      { ...facts(), pauses: [{ from: '2026-13-01', to: '2026-11-10', reason: 'bolest' }] },
      { ...facts(), pauses: [{ from: '2026-11-10', to: '2026-11-01', reason: 'put' }] },
      { ...facts(), runs: [{ id: 'r', date: 'nikad', distanceM: 5000, durationSec: 1500 }] }
    ];
    for (const f of cases) {
      const state = buildState(f, GOAL, SYNTHETIC);
      const result = plan(state, GOAL, SYNTHETIC);
      expect(result.ok, JSON.stringify(f).slice(0, 80)).toBe(false);
      const errors = validate(f, GOAL, SYNTHETIC);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every((e) => ['datum-neispravan', 'broj-neispravan'].includes(e.code))).toBe(
        true
      );
    }
    expect(() => buildState(facts(), goalAt('kasnije'), SYNTHETIC)).not.toThrow();
    expect(
      plan(buildState(facts(), goalAt('kasnije'), SYNTHETIC), goalAt('kasnije'), SYNTHETIC).ok
    ).toBe(false);
    expect(
      validate({ ...facts(), pain: [{ date: '2026-11-10', level: 11 }] }, GOAL, SYNTHETIC)[0]?.field
    ).toBe('pain[0].level');
  });
});

describe('O6: trka ili test na dan nastanka plana', () => {
  const race: Run = {
    id: 'trka',
    date: '2026-11-15',
    distanceM: 10000,
    durationSec: 2580,
    effort: 'race'
  };

  it('upisana POSLE nastanka plana daje događaj `result` i rampu', () => {
    const start = make(facts());
    const state = buildState({ ...facts(), runs: [race] }, GOAL, SYNTHETIC, undefined, start.doc);
    const events = deriveEvents(start.doc, state);
    expect(events.map((e) => e.kind)).toEqual(['result']);
    const r = replan(start.doc, state, events, SYNTHETIC);
    expect(r.changes.length).toBeGreaterThan(0);
    expect(deriveEvents(r.doc, state)).toEqual([]);
  });

  it('poznata pri nastanku plana ne daje nov događaj (plan ju je već uzeo u obzir)', () => {
    const start = make(facts({ runs: [race] }));
    expect(deriveEvents(start.doc, start.state)).toEqual([]);
  });
});

describe('sitno (S1, S3, S6, S7, S9, S10, S11)', () => {
  it('S1: redosled pauza i bola u ulazu ne menja plan (bajt-isti)', () => {
    const pauses: RunnerFacts['pauses'] = [
      { from: '2026-10-20', to: '2026-10-26', reason: 'put' },
      { from: '2026-11-08', to: '2026-11-13', reason: 'bolest' }
    ];
    const pain: RunnerFacts['pain'] = [
      { date: '2026-11-12', level: 2 },
      { date: '2026-11-14', level: 5 }
    ];
    const a = make(facts({ pauses, pain }));
    const b = make(facts({ pauses: [...pauses].reverse(), pain: [...pain].reverse() }));
    expect(canonical(b.doc)).toBe(canonical(a.doc));
  });

  it('S3: promena samo naziva trke ne kaže da je ciljno vreme promenjeno', () => {
    const { doc, state } = make(facts(), SYNTHETIC, { ...GOAL, targetTimeSec: 2130 });
    const event: PlanEvent = {
      id: 'goal-change:2026-11-15',
      date: '2026-11-15',
      kind: 'goal-change',
      goal: { ...GOAL, targetTimeSec: 2130, raceName: 'Novogodišnja trka' }
    };
    const r = replan(doc, state, [event], SYNTHETIC);
    expect(r.changes.length).toBeGreaterThan(0);
    for (const c of r.changes) expect(c.reason).not.toContain('Ciljno vreme');
  });

  it('S6: bol van 1–10 i forma van 20–90 VDOT se ne primenjuju', () => {
    const { doc, state } = make(facts());
    const events: PlanEvent[] = [
      { id: 'pain:2026-11-15:11', date: '2026-11-15', kind: 'pain', level: 11 },
      { id: 'form-update:2026-11-15', date: '2026-11-15', kind: 'form-update', vdot: 300 },
      { id: 'form-update:2026-11-15:b', date: '2026-11-15', kind: 'form-update', vdot: 5 }
    ];
    const r = replan(doc, state, events, SYNTHETIC);
    expect(r.changes).toEqual([]);
    expect(r.doc).toBe(doc);
  });

  it('S7 + R8a: propušten dugi pred rasterećenje — plan ostaje isti, ali trkač dobija rečenicu', () => {
    const start = make(facts(), EXAMPLE, EX_GOAL).doc;
    const recovery = start.weeks.find((w) => w.intent.kind === 'recovery');
    const before = start.weeks.find((w) => w.index === (recovery?.index ?? 0) - 1);
    const missed = before?.days.find((d) => d.workout?.kind === 'long');
    if (missed === undefined) throw new Error('nema dugog pred rasterećenje');
    const today = addDays(missed.date, 1);
    const state = buildState(
      { ...facts(), today, runs: runsAsPlanned(start, today, (d) => d === missed.date) },
      EX_GOAL,
      EXAMPLE,
      undefined,
      start
    );
    const events = deriveEvents(start, state);
    expect(events.map((e) => e.kind)).toEqual(['missed']);
    const r = replan(start, state, events, EXAMPLE);
    expect(days(r.doc).map((d) => canonical(d.workout))).toEqual(
      days(start).map((d) => canonical(d.workout))
    );
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]?.what).toBe('obavestenje');
    expect(r.changes[0]?.reason).toContain('Propušten je ključni trening');
    expect(r.changes[0]?.reason).toContain('ionako kraći, pa plan ostaje isti');
    expect(r.changes[0]?.reason).not.toContain('umesto da raste');
    expect(renderPlan(r.doc, state, EXAMPLE, { changes: r.changes })).toContain(
      'Propušten je ključni trening'
    );
    expect(deriveEvents(r.doc, state)).toEqual([]);
  });

  it('S9, S10: glagol i zamenica uz broj („su 2 nedelje", „sva 3 dana", „svih 5 dana")', () => {
    const short = make(facts(), SYNTHETIC, goalAt('2026-11-29')).doc.header.warnings;
    expect(short.find((w) => w.code === 'kratka-priprema')?.problem).toContain(
      'Do trke su 2 nedelje'
    );
    const one = make(facts(), SYNTHETIC, goalAt('2026-11-22')).doc.header.warnings;
    expect(one.find((w) => w.code === 'kratka-priprema')?.problem).toContain(
      'Do trke je 1 nedelja'
    );
    const dropped = (runDays: Weekday[]): string =>
      make(
        facts({
          availability: { runDays, longDay: 6 },
          profile: { weeklyKm: 8, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
        })
      ).doc.header.warnings.find((w) => w.code === 'dan-izostavljen')?.proposal ?? '';
    expect(dropped([1, 3, 6])).toContain('sva 3 dana');
    expect(dropped([0, 1, 3, 5, 6])).toContain('svih 5 dana');
  });

  it('S11: poruke nalaza čuvara nemaju ISO datum', () => {
    const { doc, state } = make(facts());
    const eve = addDays(GOAL.raceDate, -1);
    const long = days(doc).find((d) => d.workout?.kind === 'long');
    const broken: PlanDoc = {
      ...doc,
      weeks: doc.weeks.map((w) => ({
        ...w,
        days: w.days.map((d) => (d.date === eve ? { ...d, workout: long?.workout ?? null } : d))
      }))
    };
    const findings = guard(broken, state, SYNTHETIC);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(f.message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('pravila koja nisu imala test (sabotaže koje su prolazile)', () => {
  it('R2b veže samostalno: lagan dan ≤ 1,25 × najduži lagan dan prethodne nedelje (bez njega bi bio duži)', () => {
    const data = withSafety({ easyMaxShareOfLong: 5, dayBeforeLongMaxShare: 5 });
    const f = facts({
      profile: { weeklyKm: 60, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
    });
    const { doc } = make(f, data);
    const week = doc.weeks[2];
    if (week === undefined) throw new Error('nema nedelje');
    const ctx = buildCtx(doc.header, data);
    const span = { startDate: doc.header.startDate, raceDate: GOAL.raceDate };
    const slots = weekSlots(week, span, ctx, () => 0);
    const easy = (previous: EasyRef | null): number[] =>
      [...layoutWeek(week, ctx, slots, previous).values()].flatMap((r) =>
        r.type === 'easy' || r.type === 'addon' ? [r.sec] : []
      );
    const free = easy(null);
    const capped = easy({ byWeekday: new Map(), max: 1500 });
    expect(Math.max(...free)).toBeGreaterThan(1.25 * 1500 + 600);
    expect(capped.length).toBe(free.length);
    for (const sec of capped) expect(sec).toBeLessThanOrEqual(1.25 * 1500 + 1);
  });

  it('dan pred trku ≤ 20 min veže: bez tog plafona isti dan bi bio duži', () => {
    const f = facts({
      availability: { runDays: [0, 1, 2, 3, 4, 5, 6], longDay: 6 },
      profile: { weeklyKm: 90, recentResult: { distanceM: HALF_M, timeSec: 5400 } }
    });
    const { doc } = make(f);
    const eve = days(doc).find((d) => d.date === addDays(GOAL.raceDate, -1));
    const twoBefore = days(doc).find((d) => d.date === addDays(GOAL.raceDate, -2));
    expect(eve?.workout).not.toBeNull();
    expect(secOf(doc, eve)).toBeLessThanOrEqual(1200 + 1);
    /* Dva dana pred trku isti trkač trči duže — dan pred trku je skraćen pravilom, ne budžetom. */
    expect(secOf(doc, twoBefore)).toBeGreaterThan(1200 + ROUND);
  });

  it('histereza tempa: `form-update` tek posle 14 dana od poslednje promene tempa (§ 7.6)', () => {
    const { doc, state } = make(facts());
    const at = (today: string): RunnerState => {
      const s = buildState(
        { ...facts(), today, runs: runsAsPlanned(doc, today) },
        GOAL,
        SYNTHETIC,
        undefined,
        doc
      );
      const vdot = doc.header.form.paceVdot + 1;
      return {
        ...s,
        form: { ...s.form, current: { ...s.form.current, vdot, confidence: 'srednja' } }
      };
    };
    expect(state.form.current.confidence).not.toBe('niska');
    const early = deriveEvents(doc, at('2026-11-28')).map((e) => e.kind);
    expect(early).not.toContain('form-update');
    const late = deriveEvents(doc, at('2026-11-29')).map((e) => e.kind);
    expect(late).toContain('form-update');
  });

  it('nepotpuna prva nedelja: cilj i obim srazmerni broju dana koje plan pokriva', () => {
    /* Danas je četvrtak: plan počinje u petak, od 4 dana trčanja (uto, čet, sub, ned) ostaju sub i ned. */
    const today = '2026-11-19';
    expect(weekdayOf(today)).toBe(3);
    const partial = make({ ...facts(), today });
    const full = make(facts());
    const first = partial.doc.weeks[0];
    const fullFirst = full.doc.weeks[0];
    expect(first?.days).toHaveLength(3);
    expect(first?.days.filter((d) => d.workout !== null)).toHaveLength(2);
    expect(first?.targetLoad ?? 0).toBeLessThanOrEqual(0.55 * (fullFirst?.targetLoad ?? 0));
    expect(first?.targetLoad ?? 0).toBeGreaterThanOrEqual(0.45 * (fullFirst?.targetLoad ?? 0));
    const ctx = paceCtxOf(partial.doc.header);
    const minutes = first === undefined ? 0 : weekCost(first, GOAL.raceDate, ctx).durationSec / 60;
    expect(minutes).toBeLessThanOrEqual(0.65 * partial.doc.header.decisions.baseLoad);
    expect(guard(partial.doc, partial.state, SYNTHETIC)).toEqual([]);
  });
});

describe('šira mreža: svaki dan kao „danas", start usred nedelje, trka svakog dana, dugi van nedelje', () => {
  const never = [
    'doza-plafon',
    'dugi-plafon',
    'dugi-korak',
    'prazan',
    'teski-uzastopno',
    'trka',
    'nema-treninga',
    'rucno',
    'dan-pred-trku',
    'dugi-pred-trku'
  ];
  const sets: { runDays: Weekday[]; longDay: Weekday }[] = [
    { runDays: [1, 3, 5, 6], longDay: 6 },
    { runDays: [0, 2, 5], longDay: 5 },
    { runDays: [0, 1, 2, 3, 4, 5, 6], longDay: 2 }
  ];
  const profiles = [
    { weeklyKm: 35, recentResult: { distanceM: 10000, timeSec: 2760 } },
    { weeklyKm: 60, easyPaceSecPerKm: 330 }
  ];

  it('isti ulaz → bajt-isti plan; jedna trka na dan trke; bez nalaza o dozi, dugom, praznom treningu i danu pred trku', () => {
    let plans = 0;
    for (let t = 0; t < 7; t += 1) {
      const today = addDays('2026-11-09', t);
      for (let r = 0; r < 7; r += 1) {
        const raceDate = addDays('2027-02-01', r + 7 * (t % 3));
        for (const availability of sets) {
          const profile = profiles[(t + r) % profiles.length] ?? {};
          const f: RunnerFacts = { ...facts({ availability, profile }), today };
          const goal = goalAt(raceDate);
          const name = `danas ${today}, trka ${raceDate}, dani ${availability.runDays.join('')}`;
          const a = make(f, SYNTHETIC, goal);
          const b = make(f, SYNTHETIC, goal);
          expect(canonical(b.doc), name).toBe(canonical(a.doc));
          expect(a.doc.header.startDate, name).toBe(addDays(today, 1));
          const races = days(a.doc).filter((d) => d.workout?.kind === 'race');
          expect(
            races.map((d) => d.date),
            name
          ).toEqual([raceDate]);
          const hit = guard(a.doc, a.state, SYNTHETIC).filter((x) => never.includes(x.check));
          expect(
            hit.map((x) => `${x.check}@${String(x.weekIndex)}`),
            name
          ).toEqual([]);
          expect(replan(a.doc, a.state, deriveEvents(a.doc, a.state), SYNTHETIC).doc, name).toBe(
            a.doc
          );
          plans += 1;
        }
      }
    }
    expect(plans).toBe(147);
  });
});
