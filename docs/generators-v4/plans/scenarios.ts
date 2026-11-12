/* 24 scenarija prilagođavanja za polumaraton (coach/SCENARIOS-V4.md § 2): plan PRE i POSLE događaja sa spiskom
   promena. Pokretanje iz korena repozitorijuma:  node docs/generators-v4/plans/scenarios.ts
   Piše docs/generators-v4/plans/HM/scenarios/s01.txt … s24.txt i pregled.txt.
   Trkač do događaja radi tačno ono što piše u planu (trčanja vezana za dan plana); događaj se zadaje činjenicama
   (trka, pauza, propušteni dani, bol) i `deriveEvents` iz njih izvodi događaje — osim bola, koji se prijavljuje. */
import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.')) return next(`${specifier}.ts`, context);
      throw error;
    }
  }
});

const here = dirname(fileURLToPath(import.meta.url));
const v4 = join(here, '../../../web/src/domain/v4');
const E = await import(join(v4, 'engine/index.ts'));
const { estimateForm } = await import(join(v4, 'fitness/index.ts'));
const { hm } = await import(join(v4, 'distances/hm/index.ts'));
const { PROFILES, factsOf } = await import(join(v4, 'distances/hm/testdata/profiles.ts'));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const HALF = 21097.5;
const out = join(here, 'HM/scenarios');
mkdirSync(out, { recursive: true });

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

const profile = (id: string): Any => PROFILES.find((p: Any) => p.id === id);
const allDays = (doc: Any): Any[] => doc.weeks.flatMap((w: Any) => w.days);
const weekOf = (doc: Any, n: number): Any => doc.weeks[n - 1];
const sundayOf = (doc: Any, n: number): string => addDays(weekOf(doc, n).start, 6);

function startPlan(id: string, extraRuns: Any[] = []): { facts: Any; state: Any; doc: Any; goal: Any } {
  const p = profile(id);
  const facts = { ...factsOf(p), runs: extraRuns };
  const state = E.buildState(facts, p.goal, hm, estimateForm);
  const r = E.plan(state, p.goal, hm);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return { facts, state, doc: r.doc, goal: p.goal };
}

/** Trčanja tačno po planu do `through` (uključivo), osim dana koje `skip` izbaci. Test iz plana se beleži
    kao obično trčanje (bez oznake punog napora): ništa se nije desilo znači i da test nije doneo novu formu. */
function runsAsPlanned(doc: Any, through: string, skip: (d: Any) => boolean = () => false): Any[] {
  const ctx = E.paceCtxOf(doc.header);
  const runs: Any[] = [];
  for (const day of allDays(doc)) {
    if (day.workout === null || day.date > through || skip(day)) continue;
    if (day.workout.kind === 'race') continue;
    const c = E.summarize(day.workout, ctx);
    runs.push({
      id: `run-${day.id}`,
      date: day.date,
      distanceM: Math.round(c.distanceM),
      durationSec: Math.round(c.durationSec),
      dayId: day.id,
    });
  }
  return runs;
}

/** Dan kvaliteta nedelje (prvi trening vrste quality/test), dugi nedelje. */
const qualityDay = (doc: Any, n: number): Any =>
  weekOf(doc, n).days.find((d: Any) => d.workout?.kind === 'quality' || d.workout?.kind === 'test');
const longDay = (doc: Any, n: number): Any => weekOf(doc, n).days.find((d: Any) => d.workout?.kind === 'long');

interface Scenario {
  no: number;
  id: string;
  title: string;
  run: () => { before: Any; after: Any; beforeState: Any; afterState: Any; changes: Any[]; note: string };
}

function replanWith(start: Any, facts: Any, extraEvents: Any[] = []): Any {
  /* `doc`: forma vidi odrađeni kvalitet i pauze u odnosu na plan */
  const state = E.buildState(facts, start.goal, hm, estimateForm, start.doc);
  const events = E.sortEvents([...E.deriveEvents(start.doc, state), ...extraEvents]);
  const result = E.replan(start.doc, state, events, hm);
  return { state, events, result };
}

/* E1 — rezultat pripremne trke na danu provere forme */
function e1(id: string, week: number, distanceM: number, timeSec: number): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const day = weekOf(start.doc, week).days.find((d: Any) => d.workout?.kind === 'test') ?? qualityDay(start.doc, week);
    const runs = runsAsPlanned(start.doc, addDays(day.date, -1));
    runs.push({ id: `trka-${day.date}`, date: day.date, distanceM, durationSec: timeSec, dayId: day.id, effort: 'race' });
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
    const facts = { ...start.facts, today, runs: runsAsPlanned(start.doc, today, (d) => skipped.has(d.id)) };
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
function e4(id: string, week: number, pick: 'kvalitet' | 'dugi' | 'lagan', part: string): Scenario['run'] {
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

/* E5 — plan počinje dan posle polumaratona (trka je juče, 1. 11.) */
function e5(id: string, timeSec: number, label: string): Scenario['run'] {
  return () => {
    const start = startPlan(id);
    const race = { id: 'trka-2026-11-01', date: '2026-11-01', distanceM: HALF, durationSec: timeSec, effort: 'race' };
    const after = startPlan(id, [race]);
    return {
      before: start.doc,
      beforeState: start.state,
      after: after.doc,
      afterState: after.state,
      changes: [],
      note: `Juče (1. 11.) polumaraton ${clock(timeSec)} ${label}. POSLE je nov plan iz stanja sa tom trkom (isti ulazi).`
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

function clock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  return `${h > 0 ? `${String(h)}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

const SCENARIOS: Scenario[] = [
  { no: 1, id: 'p01', title: 'E1: ned 8, trka 10 km 44:40 (očekivano 46:00)', run: e1('p01', 8, 10000, 2680) },
  { no: 2, id: 'p04', title: 'E1: ned 12, trka 10 km 54:20 (očekivano 56:02)', run: e1('p04', 12, 10000, 3260) },
  { no: 3, id: 'p11', title: 'E1: ned 12, trka 5 km 26:05 (očekivano 26:59)', run: e1('p11', 12, 5000, 1565) },
  { no: 4, id: 'p12', title: 'E1: ned 8, prva trka u životu, 10 km 58:00', run: e1('p12', 8, 10000, 3480) },
  { no: 5, id: 'p01', title: 'E2: bolest 7 dana u ned 6', run: e2('p01', 6) },
  { no: 6, id: 'p04', title: 'E2: bolest 7 dana u ned 14', run: e2('p04', 14) },
  { no: 7, id: 'p11', title: 'E2: bolest 7 dana u ned 10', run: e2('p11', 10) },
  { no: 8, id: 'p12', title: 'E2: bolest 7 dana u ned 13 (najteža)', run: e2('p12', 13) },
  { no: 9, id: 'p01', title: 'E3: ned 13 (najteža): propušteni RP usred nedelje i dugi sa blokom', run: e3('p01', [13], 'oba') },
  { no: 10, id: 'p04', title: 'E3: ned 10: propušteni kvalitet i dugi', run: e3('p04', [10], 'oba') },
  { no: 11, id: 'p11', title: 'E3: ned 14: propušteni kvalitet i dugi', run: e3('p11', [14], 'oba') },
  { no: 12, id: 'p12', title: 'E3: ned 9–10: propušten po jedan dugi u obe nedelje', run: e3('p12', [9, 10], 'dugi') },
  { no: 13, id: 'p01', title: 'E4: ned 10, bol u kolenu 4/10 posle kvaliteta', run: e4('p01', 10, 'kvalitet', 'koleno') },
  { no: 14, id: 'p04', title: 'E4: ned 7, bol 4/10 posle kvaliteta (brzina/usponi)', run: e4('p04', 7, 'kvalitet', 'koleno') },
  { no: 15, id: 'p11', title: 'E4: ned 11, bol 4/10 posle dugog', run: e4('p11', 11, 'dugi', 'koleno') },
  { no: 16, id: 'p12', title: 'E4: ned 5, bol 4/10 posle laganog dana', run: e4('p12', 5, 'lagan', 'koleno') },
  { no: 17, id: 'p01', title: 'E5: juče polumaraton 1:42:30', run: e5('p01', 6150, '') },
  { no: 18, id: 'p04', title: 'E5: juče polumaraton 2:04:13', run: e5('p04', 7453, '') },
  { no: 19, id: 'p11', title: 'E5: juče polumaraton 2:12 uz hodanje (prvi)', run: e5('p11', 7920, '(prvi, uz hodanje)') },
  { no: 20, id: 'p12', title: 'E5: juče polumaraton 2:20 (prvi rezultat)', run: e5('p12', 8400, '(prvi rezultat)') },
  { no: 21, id: 'p01', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p01') },
  { no: 22, id: 'p04', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p04') },
  { no: 23, id: 'p11', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p11') },
  { no: 24, id: 'p12', title: 'E6: ništa se nije desilo do kraja ned 6', run: e6('p12') }
];

const summary: string[] = ['# Scenariji prilagođavanja — polumaraton (pregled)', ''];
for (const s of SCENARIOS) {
  const r = s.run();
  const name = `s${String(s.no).padStart(2, '0')}`;
  const text = [
    `${name.toUpperCase()} — ${s.id}, ${s.title}`,
    r.note,
    '',
    '==================== POSLE (sa spiskom promena) ====================',
    E.renderPlan(r.after, r.afterState, hm, { changes: r.changes }),
    '',
    '==================== PRE ====================',
    E.renderPlan(r.before, r.beforeState, hm)
  ].join('\n');
  writeFileSync(join(out, `${name}.txt`), `${text}\n`);
  const findings = E.guard(r.after, r.afterState, hm).map((f: Any) => `${f.check}@${String(f.weekIndex)}`);
  summary.push(
    `${name} ${s.id} ${s.title} — promena: ${String(r.changes.length)}; nalazi čuvara posle: ${findings.join(' ') || '0'}`
  );
}
writeFileSync(join(out, 'pregled.txt'), `${summary.join('\n')}\n`);
console.log(summary.join('\n'));
