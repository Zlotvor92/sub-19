/* 24 + 3 scenarija prilagođavanja za 10 km (po obrascu coach/SCENARIOS-V4.md § 2, događaji u istoj FAZI plana 10 km) —
   definicije, deljene između testova (`scenarios.test.ts`: R1, R2, R5, Z4) i ispisa
   (`docs/generators-v4/plans/scenarios.ts --dist tenk`). Profili: p01 (16 ned), p04 (18 ned), p11 (početnik,
   18 ned), p12 (početnik po osećaju, 12 ned).
   Trkač do događaja radi tačno ono što piše u planu; događaj se zadaje činjenicama, a `deriveEvents` iz njih izvodi
   događaje — osim bola, koji se prijavljuje. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-argument */
import * as E from '../../../engine/index';
import { estimateForm } from '../../../fitness/index';
import { tenk } from '../index';
import { PROFILES, factsOf } from './profiles';
import { addDays as addIso } from '../../../engine/dates';

type Any = any;
const HALF = 21097.5;
const TEN = 10000;

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
  const state = E.buildState(facts, p.goal, tenk, estimateForm);
  const r = E.plan(state, p.goal, tenk);
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
  const state = E.buildState(facts, start.goal, tenk, estimateForm, start.doc);
  const events = E.sortEvents([...E.deriveEvents(start.doc, state), ...extraEvents]);
  const result = E.replan(start.doc, state, events, tenk);
  return { state, events, result };
}

/* E1 — rezultat pripremne trke na danu provere forme */
function e1(id: string, week: number, distanceM: number, timeSec: number): Scenario['run'] {
  return () => {
    const start = startPlan(id);
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

/* E5 — plan počinje dan posle trke (trka je juče, 1. 11.): polumaraton (dug napor) ili 10 km (kratak napor) */
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
      note: `Juče (1. 11.) ${distanceM === HALF ? 'polumaraton' : `trka ${String(distanceM / 1000)} km`} ${clock(timeSec)} ${label}. POSLE je nov plan iz stanja sa tom trkom (isti ulazi).`
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
  const state = E.buildState(b.facts, start.goal, tenk, estimateForm, one.result.doc);
  const events = E.sortEvents([...E.deriveEvents(one.result.doc, state), ...(b.extra ?? [])]);
  const two = E.replan(one.result.doc, state, events, tenk);
  return {
    state,
    events: [...one.events, ...events],
    changes: [...one.result.changes, ...two.changes],
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

/* s26: bol 4/10 posle kvaliteta, pa dve nedelje kasnije neplanirana trka 10 km */
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
          distanceM: 10000,
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
      note: `Bol 4/10 ${q.date}, pa trka 10 km ${clock(timeSec)} dve nedelje kasnije. Događaji: ${r.events.map((e: Any) => e.id).join(', ')}.`
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
    title: 'E1: ned 10, trka 5 km 21:30 (očekivano 22:10)',
    run: e1('p01', 10, 5000, 1290)
  },
  {
    no: 2,
    id: 'p04',
    title: 'E1: ned 12, trka 5 km 26:10 (očekivano 27:00)',
    run: e1('p04', 12, 5000, 1570)
  },
  {
    no: 3,
    id: 'p11',
    title: 'E1: ned 12, trka 5 km 26:05 umesto testa 3 km (očekivano 27:00)',
    run: e1('p11', 12, 5000, 1565)
  },
  {
    no: 4,
    id: 'p12',
    title: 'E1: ned 6, prva trka u životu, 5 km 28:30',
    run: e1('p12', 6, 5000, 1710)
  },
  { no: 5, id: 'p01', title: 'E2: bolest 7 dana u ned 6 (razvoj)', run: e2('p01', 6) },
  {
    no: 6,
    id: 'p04',
    title: 'E2: bolest 7 dana u ned 13 (specifična priprema)',
    run: e2('p04', 13)
  },
  { no: 7, id: 'p11', title: 'E2: bolest 7 dana u ned 10', run: e2('p11', 10) },
  { no: 8, id: 'p12', title: 'E2: bolest 7 dana u ned 9 (najteža)', run: e2('p12', 9) },
  {
    no: 9,
    id: 'p01',
    title: 'E3: ned 13 (najteža): propušteni tempo trke i dugi sa završnicom',
    run: e3('p01', [13], 'oba')
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
    title: 'E3: ned 14: propušteni tempo trke i dugi',
    run: e3('p11', [14], 'oba')
  },
  {
    no: 12,
    id: 'p12',
    title: 'E3: ned 7–8: propušten po jedan dugi u obe nedelje',
    run: e3('p12', [7, 8], 'dugi')
  },
  {
    no: 13,
    id: 'p01',
    title: 'E4: ned 11, bol u kolenu 4/10 posle tempa trke',
    run: e4('p01', 11, 'kvalitet', 'koleno')
  },
  {
    no: 14,
    id: 'p04',
    title: 'E4: ned 7, bol 4/10 posle kvaliteta (osnova)',
    run: e4('p04', 7, 'kvalitet', 'koleno')
  },
  {
    no: 15,
    id: 'p11',
    title: 'E4: ned 11, bol 4/10 posle dugog',
    run: e4('p11', 11, 'dugi', 'koleno')
  },
  {
    no: 16,
    id: 'p12',
    title: 'E4: ned 5, bol 4/10 posle laganog dana',
    run: e4('p12', 5, 'lagan', 'koleno')
  },
  { no: 17, id: 'p01', title: 'E5: juče polumaraton 1:42:30', run: e5('p01', HALF, 6150, '') },
  { no: 18, id: 'p04', title: 'E5: juče trka 10 km 56:02', run: e5('p04', TEN, 3362, '') },
  {
    no: 19,
    id: 'p11',
    title: 'E5: juče prva trka 10 km 58:30',
    run: e5('p11', TEN, 3510, '(prva trka)')
  },
  {
    no: 20,
    id: 'p12',
    title: 'E5: juče polumaraton 2:20 (prvi rezultat)',
    run: e5('p12', HALF, 8400, '(prvi rezultat)')
  },
  { no: 21, id: 'p01', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p01') },
  { no: 22, id: 'p04', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p04') },
  { no: 23, id: 'p11', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p11') },
  { no: 24, id: 'p12', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p12') },
  /* E7 (krug 7, Z10): više događaja zaredom, isti obrazac kao kod polumaratona */
  {
    no: 25,
    id: 'p01',
    title: 'E7: bolest 5 dana u ned 6, pa propušten dugi 10 dana kasnije',
    run: e7illnessThenMissed('p01', 6)
  },
  {
    no: 26,
    id: 'p11',
    title: 'E7: bol 4/10 u ned 9, pa trka 10 km dve nedelje kasnije',
    run: e7painThenRace('p11', 9, 3480)
  },
  {
    no: 27,
    id: 'p04',
    title: 'E7: propuštena dva kvaliteta (ned 9–10), pa put 6 dana',
    run: e7missedThenTrip('p04', 9)
  }
];
