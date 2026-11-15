/* 24 + 3 scenarija prilagođavanja za 5 km (po obrascu coach/SCENARIOS-V4.md § 2, događaji u istoj FAZI plana 5 km) —
   definicije, deljene između testova (`scenarios.test.ts`: R1, R2, R5, Z4) i ispisa
   (`docs/generators-v4/plans/scenarios.ts --dist fivek`). Profili: p01 (12 ned, provera u ned 8), p04 (16 ned,
   provera u ned 12), p11 (početnik, 3 dana, 16 ned), p12 (početnik po osećaju, 4 dana, 10 ned).
   Trkač do događaja radi tačno ono što piše u planu; događaj se zadaje činjenicama, a `deriveEvents` iz njih izvodi
   događaje — osim bola, koji se prijavljuje. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-argument */
import * as E from '../../../engine/index';
import { estimateForm } from '../../../fitness/index';
import { fivek } from '../index';
import { PROFILES, factsOf } from './profiles';
import { addDays as addIso } from '../../../engine/dates';

type Any = any;
const TEN = 10000;
const FIVE = 5000;

const addDays = (iso: string, days: number): string => addIso(iso, days);

export const profile = (id: string): Any => PROFILES.find((p: Any) => p.id === id);
const allDays = (doc: Any): Any[] => doc.weeks.flatMap((w: Any) => w.days);
const weekOf = (doc: Any, n: number): Any => doc.weeks[n - 1];
const sundayOf = (doc: Any, n: number): string => addDays(weekOf(doc, n).start, 6);

function startPlan(
  id: string,
  extraRuns: Any[] = []
): { facts: Any; state: Any; doc: Any; goal: Any } {
  const p = profile(id);
  const facts = { ...factsOf(p), runs: extraRuns };
  const state = E.buildState(facts, p.goal, fivek, estimateForm);
  const r = E.plan(state, p.goal, fivek);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return { facts, state, doc: r.doc, goal: p.goal };
}

/** Trčanja tačno po planu do `through` (uključivo), osim dana koje `skip` izbaci. Test iz plana se beleži samo
    deo punim naporom u tempu današnje forme: ništa se nije desilo znači i da test nije doneo novu formu. */
function runsAsPlanned(doc: Any, through: string, skip: (d: Any) => boolean = () => false): Any[] {
  const ctx = E.paceCtxOf(doc.header);
  const runs: Any[] = [];
  for (const day of allDays(doc)) {
    if (day.workout === null || day.date > through || skip(day)) continue;
    if (day.workout.kind === 'race') continue;
    const c = E.summarize(day.workout, ctx);
    /* test iz plana: beleži se samo deo punim naporom, u tempu današnje forme (bez zagrevanja i hlađenja — inače
       ga forma čita kao trku na celu dužinu treninga) */
    const work = day.workout.kind === 'test' ? testPart(day.workout, c) : null;
    runs.push({
      id: `run-${day.id}`,
      date: day.date,
      distanceM: Math.round(work?.distanceM ?? c.distanceM),
      durationSec: Math.round(work?.durationSec ?? c.durationSec),
      dayId: day.id
    });
  }
  return runs;
}

/** Deo testa punim naporom: dužina iz koraka, trajanje = rad treninga. */
function testPart(w: Any, c: Any): { distanceM: number; durationSec: number } | null {
  const step = w.steps.find((x: Any) => x.role === 'work' && x.extent?.distanceM !== undefined);
  return step === undefined ? null : { distanceM: step.extent.distanceM, durationSec: c.workSec };
}

/** Dan kvaliteta nedelje (prvi trening vrste quality/test), dugi nedelje. */
const qualityDay = (doc: Any, n: number): Any =>
  weekOf(doc, n).days.find((d: Any) => d.workout?.kind === 'quality' || d.workout?.kind === 'test');
const longDay = (doc: Any, n: number): Any =>
  weekOf(doc, n).days.find((d: Any) => d.workout?.kind === 'long');

export interface Scenario {
  no: number;
  id: string;
  title: string;
  run: () => {
    before: Any;
    after: Any;
    beforeState: Any;
    afterState: Any;
    changes: Any[];
    note: string;
  };
}

function replanWith(start: Any, facts: Any, extraEvents: Any[] = []): Any {
  /* `doc`: forma vidi odrađeni kvalitet i pauze u odnosu na plan */
  const state = E.buildState(facts, start.goal, fivek, estimateForm, start.doc);
  const events = E.sortEvents([...E.deriveEvents(start.doc, state), ...extraEvents]);
  const result = E.replan(start.doc, state, events, fivek);
  return { state, events, result };
}

/* E1 — rezultat pripremne trke na danu provere forme */
/** `time`: sekunde, ili `{ share }` = udeo očekivanog vremena na toj dužini po ličnoj krivi plana (F4-K2: očekivano
    se računa istim `effortTimeSec` kao pun napor u planu). */
function e1(
  id: string,
  week: number,
  distanceM: number,
  time: number | { share: number }
): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const h = start.doc.header;
    const timeSec =
      typeof time === 'number'
        ? time
        : Math.round(time.share * E.effortTimeSec(h.form.paceVdot, distanceM, h.form.transfer));
    const day =
      weekOf(start.doc, week).days.find((d: Any) => d.workout?.kind === 'test') ??
      qualityDay(start.doc, week);
    const runs = runsAsPlanned(start.doc, addDays(day.date, -1));
    runs.push({
      id: `trka-${day.date}`,
      date: day.date,
      distanceM,
      durationSec: timeSec,
      dayId: day.id,
      effort: 'race'
    });
    const facts = { ...start.facts, today: day.date, runs };
    const { state, events, result } = replanWith(start, facts);
    return {
      before: start.doc,
      beforeState: start.state,
      after: result.doc,
      afterState: state,
      changes: result.changes,
      note: `Trka ${String(distanceM / 1000)} km za ${clock(timeSec)} na ${day.date} (dan provere forme u ${String(week)}. nedelji). Događaji: ${events.map((e: Any) => e.id).join(', ') || 'nema'}.`
    };
  };
}

/* E2 — sedam dana bolesti (pon–ned zadate nedelje), bez trčanja */
function e2(id: string, week: number): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const from = weekOf(start.doc, week).start;
    const to = addDays(from, 6);
    const facts = {
      ...start.facts,
      today: to,
      runs: runsAsPlanned(start.doc, addDays(from, -1)),
      pauses: [{ from, to, reason: 'bolest' }]
    };
    const { state, events, result } = replanWith(start, facts);
    return {
      before: start.doc,
      beforeState: start.state,
      after: result.doc,
      afterState: state,
      changes: result.changes,
      note: `Bolest ${from} – ${to} (${String(week)}. nedelja), bez treninga. Događaji: ${events.map((e: Any) => e.id).join(', ')}.`
    };
  };
}

/* E3 — propušteni ključni treninzi (kvalitet usred nedelje i dugi) u zadatim nedeljama */
function e3(id: string, weeks: number[], what: 'oba' | 'dugi'): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const skipped = new Set<string>();
    for (const w of weeks) {
      if (what === 'oba') {
        const q = qualityDay(start.doc, w);
        if (q !== undefined) skipped.add(q.id);
      }
      const l = longDay(start.doc, w);
      if (l !== undefined) skipped.add(l.id);
    }
    const last = weeks[weeks.length - 1] ?? 1;
    const today = addDays(sundayOf(start.doc, last), 1);
    const facts = {
      ...start.facts,
      today,
      runs: runsAsPlanned(start.doc, today, (d) => skipped.has(d.id))
    };
    const { state, events, result } = replanWith(start, facts);
    return {
      before: start.doc,
      beforeState: start.state,
      after: result.doc,
      afterState: state,
      changes: result.changes,
      note: `Propušteno: ${[...skipped].join(', ')}; sve ostalo urađeno; danas ${today}. Događaji: ${events.map((e: Any) => e.id).join(', ')}.`
    };
  };
}

/* E4 — bol 4/10 prijavljen posle zadatog treninga */
function e4(
  id: string,
  week: number,
  pick: 'kvalitet' | 'dugi' | 'lagan',
  part: string
): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const w = weekOf(start.doc, week);
    const day =
      pick === 'kvalitet'
        ? qualityDay(start.doc, week)
        : pick === 'dugi'
          ? longDay(start.doc, week)
          : w.days.find((d: Any) => d.workout?.kind === 'easy');
    const facts = {
      ...start.facts,
      today: day.date,
      runs: runsAsPlanned(start.doc, day.date),
      pain: [{ date: day.date, level: 4, part }]
    };
    const pain = { id: `pain:${day.date}`, date: day.date, kind: 'pain', level: 4, part };
    const { state, events, result } = replanWith(start, facts, [pain]);
    return {
      before: start.doc,
      beforeState: start.state,
      after: result.doc,
      afterState: state,
      changes: result.changes,
      note: `Bol 4/10 (${part}) posle treninga ${day.date} („${String(day.workout?.text)}"). Događaji: ${events.map((e: Any) => e.id).join(', ')}.`
    };
  };
}

/* E5 — plan počinje dan posle trke (trka je juče, 1. 11.): 10 km ili 5 km */
function e5(id: string, distanceM: number, timeSec: number, label: string): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const race = {
      id: 'trka-2026-11-01',
      date: '2026-11-01',
      distanceM,
      durationSec: timeSec,
      effort: 'race'
    };
    const after = startPlan(id, [race]);
    return {
      before: start.doc,
      beforeState: start.state,
      after: after.doc,
      afterState: after.state,
      changes: [],
      note: `Juče (1. 11.) trka ${String(distanceM / 1000)} km ${clock(timeSec)} ${label}. POSLE je nov plan iz stanja sa tom trkom (isti ulazi).`
    };
  };
}

/* E6 — ništa se nije desilo: sve urađeno kako piše do kraja 6. nedelje */
function e6(id: string): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const today = sundayOf(start.doc, 6);
    const facts = { ...start.facts, today, runs: runsAsPlanned(start.doc, today) };
    const { state, events, result } = replanWith(start, facts);
    const same = E.fingerprint(start.doc, facts) === E.fingerprint(result.doc, facts);
    return {
      before: start.doc,
      beforeState: start.state,
      after: result.doc,
      afterState: state,
      changes: result.changes,
      note: `Sve urađeno po planu do ${today}. Događaji: ${events.map((e: Any) => e.id).join(', ') || 'nema'}. Otisak plana pre = posle: ${same ? 'DA' : 'NE'}; promena: ${String(result.changes.length)}.`
    };
  };
}

/* E7 (krug 7, Z10) — više događaja zaredom. Prvi događaj → plan A; trkač radi po planu A do drugog događaja →
   plan B. PRE je početni plan, POSLE plan B; izmene su obe liste. */
function chain(
  start: Any,
  first: (s: Any) => { facts: Any; extra?: Any[] },
  second: (doc: Any, facts: Any) => { facts: Any; extra?: Any[] }
): Any {
  const a = first(start);
  const one = replanWith(start, a.facts, a.extra ?? []);
  const b = second(one.result.doc, a.facts);
  const state = E.buildState(b.facts, start.goal, fivek, estimateForm, one.result.doc);
  const events = E.sortEvents([...E.deriveEvents(one.result.doc, state), ...(b.extra ?? [])]);
  const two = E.replan(one.result.doc, state, events, fivek);
  return {
    state,
    events: [...one.events, ...events],
    /* R20 (A6): jedan dan — jedan red */
    changes: E.mergeChanges(one.result.changes, two.changes),
    doc: two.doc
  };
}

/* s25: bolest 5 dana (pon–pet zadate nedelje), pa 10 dana posle povratka propušten dugi */
function e7illnessThenMissed(id: string, week: number): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const from = weekOf(start.doc, week).start;
    const to = addDays(from, 4);
    const r = chain(
      start,
      () => ({
        facts: {
          ...start.facts,
          today: to,
          runs: runsAsPlanned(start.doc, addDays(from, -1)),
          pauses: [{ from, to, reason: 'bolest' }]
        }
      }),
      (doc, facts) => {
        const long = allDays(doc).find(
          (d: Any) => d.workout?.kind === 'long' && d.date >= addDays(to, 10)
        );
        const today = addDays(long.date, 1);
        const runs = runsAsPlanned(
          doc,
          today,
          (d) => d.id === long.id || (d.date >= from && d.date <= to)
        );
        return { facts: { ...facts, today, runs } };
      }
    );
    return {
      before: start.doc,
      beforeState: start.state,
      after: r.doc,
      afterState: r.state,
      changes: r.changes,
      note: `Bolest ${from} – ${to}, pa propušten dugi 10+ dana posle povratka. Događaji: ${r.events.map((e: Any) => e.id).join(', ')}.`
    };
  };
}

/* s26: bol 4/10 posle kvaliteta, pa dve nedelje kasnije neplanirana trka 5 km */
function e7painThenRace(id: string, week: number, timeSec: number): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const q = qualityDay(start.doc, week);
    const pain = { id: `pain:${q.date}`, date: q.date, kind: 'pain', level: 4, part: 'koleno' };
    const r = chain(
      start,
      () => ({
        facts: {
          ...start.facts,
          today: q.date,
          runs: runsAsPlanned(start.doc, q.date),
          pain: [{ date: q.date, level: 4, part: 'koleno' }]
        },
        extra: [pain]
      }),
      (doc, facts) => {
        const day = allDays(doc).find(
          (d: Any) =>
            d.date >= addDays(q.date, 14) && d.workout !== null && d.workout.kind !== 'long'
        );
        const runs = runsAsPlanned(doc, addDays(day.date, -1));
        runs.push({
          id: `trka-${day.date}`,
          date: day.date,
          distanceM: FIVE,
          durationSec: timeSec,
          effort: 'race'
        });
        return { facts: { ...facts, today: day.date, runs } };
      }
    );
    return {
      before: start.doc,
      beforeState: start.state,
      after: r.doc,
      afterState: r.state,
      changes: r.changes,
      note: `Bol 4/10 ${q.date}, pa trka 5 km ${clock(timeSec)} dve nedelje kasnije. Događaji: ${r.events.map((e: Any) => e.id).join(', ')}.`
    };
  };
}

/* s27: propuštena dva kvaliteta (dve nedelje zaredom), pa pauza zbog puta 6 dana */
function e7missedThenTrip(id: string, week: number): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const q1 = qualityDay(start.doc, week);
    const q2 = qualityDay(start.doc, week + 1);
    const skip = new Set([q1?.id, q2?.id]);
    const after = addDays(sundayOf(start.doc, week + 1), 1);
    const r = chain(
      start,
      () => ({
        facts: {
          ...start.facts,
          today: after,
          runs: runsAsPlanned(start.doc, after, (d) => skip.has(d.id))
        }
      }),
      (doc, facts) => {
        const from = addDays(after, 7);
        const to = addDays(from, 5);
        const runs = runsAsPlanned(doc, addDays(from, -1), (d) => skip.has(d.id));
        return { facts: { ...facts, today: to, runs, pauses: [{ from, to, reason: 'put' }] } };
      }
    );
    return {
      before: start.doc,
      beforeState: start.state,
      after: r.doc,
      afterState: r.state,
      changes: r.changes,
      note: `Propuštena dva kvaliteta (${String(q1?.date)}, ${String(q2?.date)}), pa put 6 dana. Događaji: ${r.events.map((e: Any) => e.id).join(', ')}.`
    };
  };
}

export function clock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  return `${h > 0 ? `${String(h)}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export const SCENARIOS: Scenario[] = [
  {
    no: 1,
    id: 'p01',
    title: 'E1: ned 8 (provera), parkrun 5 km 3,0 % brže od očekivanog',
    run: e1('p01', 8, FIVE, { share: 0.97 })
  },
  {
    no: 2,
    id: 'p04',
    title: 'E1: ned 12 (provera), test 3 km 3,1 % brže od očekivanog',
    run: e1('p04', 12, 3000, { share: 0.969 })
  },
  {
    no: 3,
    id: 'p11',
    title: 'E1: ned 12 (provera), test 1,5 km 3,4 % brže od očekivanog',
    run: e1('p11', 12, 1500, { share: 0.966 })
  },
  {
    no: 4,
    id: 'p12',
    title: 'E1: ned 6 (provera), prva trka u životu, 5 km 33:00',
    run: e1('p12', 6, FIVE, 1980)
  },
  { no: 5, id: 'p01', title: 'E2: bolest 7 dana u ned 5 (razvoj, I blok)', run: e2('p01', 5) },
  {
    no: 6,
    id: 'p04',
    title: 'E2: bolest 7 dana u ned 13 (najteža)',
    run: e2('p04', 13)
  },
  { no: 7, id: 'p11', title: 'E2: bolest 7 dana u ned 9', run: e2('p11', 9) },
  { no: 8, id: 'p12', title: 'E2: bolest 7 dana u ned 7 (najteža)', run: e2('p12', 7) },
  {
    no: 9,
    id: 'p01',
    title: 'E3: ned 9 (najteža): propušteni tempo trke i dugi sa završnicom',
    run: e3('p01', [9], 'oba')
  },
  {
    no: 10,
    id: 'p04',
    title: 'E3: ned 10 (razvoj): propušteni kvalitet i dugi',
    run: e3('p04', [10], 'oba')
  },
  {
    no: 11,
    id: 'p11',
    title: 'E3: ned 13 (najteža): propušteni tempo trke i dugi',
    run: e3('p11', [13], 'oba')
  },
  {
    no: 12,
    id: 'p12',
    title: 'E3: ned 4–5: propušten po jedan dugi u obe nedelje',
    run: e3('p12', [4, 5], 'dugi')
  },
  {
    no: 13,
    id: 'p01',
    title: 'E4: ned 9, bol u kolenu 4/10 posle tempa trke',
    run: e4('p01', 9, 'kvalitet', 'koleno')
  },
  {
    no: 14,
    id: 'p04',
    title: 'E4: ned 6, bol 4/10 posle kvaliteta (osnova)',
    run: e4('p04', 6, 'kvalitet', 'koleno')
  },
  {
    no: 15,
    id: 'p11',
    title: 'E4: ned 10, bol 4/10 posle dugog',
    run: e4('p11', 10, 'dugi', 'koleno')
  },
  {
    no: 16,
    id: 'p12',
    title: 'E4: ned 4, bol 4/10 posle laganog dana',
    run: e4('p12', 4, 'lagan', 'koleno')
  },
  { no: 17, id: 'p01', title: 'E5: juče trka 10 km 46:00', run: e5('p01', TEN, 2760, '') },
  { no: 18, id: 'p04', title: 'E5: juče trka 5 km 26:30', run: e5('p04', FIVE, 1590, '') },
  {
    no: 19,
    id: 'p11',
    title: 'E5: juče prva trka 5 km 27:30',
    run: e5('p11', FIVE, 1650, '(prva trka)')
  },
  {
    no: 20,
    id: 'p12',
    title: 'E5: juče trka 10 km 70:00 (prvi rezultat)',
    run: e5('p12', TEN, 4200, '(prvi rezultat)')
  },
  { no: 21, id: 'p01', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p01') },
  { no: 22, id: 'p04', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p04') },
  { no: 23, id: 'p11', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p11') },
  { no: 24, id: 'p12', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p12') },
  /* E7 (Z10): više događaja zaredom, isti obrazac kao kod 10 km */
  {
    no: 25,
    id: 'p01',
    title: 'E7: bolest 5 dana u ned 5, pa propušten dugi 10 dana kasnije',
    run: e7illnessThenMissed('p01', 5)
  },
  {
    no: 26,
    id: 'p11',
    title: 'E7: bol 4/10 u ned 9, pa trka 5 km dve nedelje kasnije',
    run: e7painThenRace('p11', 9, 1680)
  },
  {
    no: 27,
    id: 'p04',
    title: 'E7: propuštena dva kvaliteta (ned 9–10), pa put 6 dana',
    run: e7missedThenTrip('p04', 9)
  }
];
