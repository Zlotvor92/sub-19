import { describe, expect, it } from 'vitest';
import { diffDays } from './dates';
import { count, DAYS, fmtDate, fmtNumber, KM, pluralForm, WEEKS, WORKOUTS } from './format';
import { deriveEvents, paceCtxOf, renderPlan, replan, summarize } from './index';
import { advance, build, facts, goalAt, grid, runsAsPlanned } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type { PlanDoc } from './types';

const FORMS = { nedelj: WEEKS, dan: DAYS, trening: WORKOUTS } as const;

/** Svaki „<broj> <imenica>" u tekstu mora imati oblik koji daje pravilo množine: nominativ, ili akuzativ
    posle „za", „planiraj", „imaš" („za 1 nedelju", „planiraj 21 nedelju"). */
function pluralErrors(text: string): string[] {
  const errors: string[] = [];
  const re =
    /(?:(za|planiraj|imaš) )?(?<![\d,.:])(\d+) (nedelj[a-z]+|dan[a-z]*|trening[a-z]*)(?![a-zčćšđž])/g;
  for (const m of text.matchAll(re)) {
    const n = Number(m[2]);
    const word = m[3] ?? '';
    const forms = Object.entries(FORMS).find(([stem]) => word.startsWith(stem))?.[1];
    if (forms === undefined) continue;
    const want = pluralForm(n, forms, m[1] === undefined ? 'nom' : 'acc');
    if (word !== want) errors.push(`${String(n)} ${word}`);
  }
  return errors;
}

const INTERNAL = [
  /\d{4}-\d{2}-\d{2}/,
  /\bBO\b/,
  /stimulus/i,
  /\bw\d+d\d\b/,
  /undefined|NaN|null|\[object/,
  /libraryId|dosePct|loadPct/
];

describe('množina i oblikovanje (K4)', () => {
  it('1 nedelja, 2 nedelje, 5 nedelja, 11 nedelja, 21 nedelja, 22 nedelje', () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25, 101, 111].map((n) => count(n, WEEKS))).toEqual([
      '1 nedelja',
      '2 nedelje',
      '5 nedelja',
      '11 nedelja',
      '12 nedelja',
      '21 nedelja',
      '22 nedelje',
      '25 nedelja',
      '101 nedelja',
      '111 nedelja'
    ]);
    expect([1, 3, 5, 21].map((n) => count(n, DAYS))).toEqual([
      '1 dan',
      '3 dana',
      '5 dana',
      '21 dan'
    ]);
    expect([1, 4, 5].map((n) => count(n, WORKOUTS))).toEqual([
      '1 trening',
      '4 treninga',
      '5 treninga'
    ]);
    expect([1, 2, 7].map((n) => count(n, KM))).toEqual([
      '1 kilometar',
      '2 kilometra',
      '7 kilometara'
    ]);
  });

  it('decimalni zarez, bez nula na kraju, datum bez godine', () => {
    expect([4.5, 10, 20, 100, 28.44, 0.96].map((n) => fmtNumber(n))).toEqual([
      '4,5',
      '10',
      '20',
      '100',
      '28,4',
      '1'
    ]);
    expect(fmtNumber(20, 0)).toBe('20');
    expect(fmtDate('2026-11-07')).toBe('7. 11.');
  });

  it('provera množine hvata pogrešan oblik (nominativ i akuzativ)', () => {
    expect(pluralErrors('traje 21 nedelje i 5 trening, pa 1 dana')).toEqual([
      '21 nedelje',
      '5 trening',
      '1 dana'
    ]);
    expect(pluralErrors('traje 21 nedelja, 2 nedelje, 5 treninga, 17. 11. dan')).toEqual([]);
    expect(pluralErrors('produži za 1 nedelja, planiraj 21 nedelja')).toEqual([
      '1 nedelja',
      '21 nedelja'
    ]);
    expect(
      pluralErrors('produži za 1 nedelju, planiraj 21 nedelju, imaš 2 nedelje, za 5 nedelja')
    ).toEqual([]);
  });
});

describe('mašinske provere K1–K5 nad ispisom (SPEC § 14.2)', () => {
  const cases = grid().filter((_, i) => i % 3 === 0);
  const built = cases.map((c) => ({ c, b: build(c.facts, c.goal) }));

  it('K1: prognoza na dan trke ≠ današnja kad je plan ≥ 10 nedelja, uz rečenicu zašto', () => {
    let checked = 0;
    for (const { c, b } of built) {
      if (b.doc.weeks.length < 10) continue;
      /* M7 (krug 14): obim ili dugi daleko ispod adekvatnog — prognoza bez napretka, uz rečenicu zašto */
      if (b.doc.header.decisions.raceDayNoProgress === true) {
        expect(renderPlan(b.doc, b.state, SYNTHETIC), c.name).toMatch(/bez računanja napretka: /);
        /* ni prognoza ni tempo trke nisu brži od današnje forme */
        const h = b.doc.header;
        expect(h.form.raceDay.expectedSec, c.name).toBeGreaterThanOrEqual(
          h.form.current.raceTimeSec
        );
        continue;
      }
      checked += 1;
      const { form } = b.doc.header;
      expect(form.raceDay.expectedSec, c.name).toBeLessThan(form.current.raceTimeSec);
      expect(form.raceDay.lowSec, c.name).toBeLessThan(form.raceDay.highSec);
      const text = renderPlan(b.doc, b.state, SYNTHETIC);
      expect(text, c.name).toMatch(
        /Očekivano na dan trke: [\d:]+ \(raspon [\d:]+–[\d:]+\) — [\d:]+ brže od današnje prognoze, jer/
      );
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('K2: ništa brzo u 3 dana posle trke posle koje plan počinje', () => {
    let checked = 0;
    for (const { c, b } of built) {
      const effort = b.state.lastHardEffort;
      if (effort === null) continue;
      checked += 1;
      const ctx = paceCtxOf(b.doc.header);
      for (const day of b.doc.weeks.flatMap((w) => w.days)) {
        if (diffDays(day.date, effort.date) <= 3)
          expect(summarize(day.workout, ctx).workSec, `${c.name} ${day.date}`).toBe(0);
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('K3: upozorenje u ispisu ima problem, značenje i predlog sa brojem', () => {
    for (const { c, b } of built) {
      const text = renderPlan(b.doc, b.state, SYNTHETIC);
      for (const w of b.doc.header.warnings) {
        expect(text, c.name).toContain(`- ${w.problem} ${w.meaning} ${w.proposal}`);
        expect(/\d/.test(w.proposal), `${c.name} ${w.code}`).toBe(true);
        expect(w.proposal.split(/ ili /).length, `${c.name} ${w.code}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('K4: bez ISO datuma, internih izraza i pogrešne množine', () => {
    for (const { c, b } of built) {
      const text = renderPlan(b.doc, b.state, SYNTHETIC);
      for (const pattern of INTERNAL)
        expect(pattern.test(text), `${c.name} ${String(pattern)}`).toBe(false);
      expect(pluralErrors(text), c.name).toEqual([]);
      expect(/\d(km|min)\b/.test(text), c.name).toBe(false);
      expect(text.includes('.5 km') || /\d\.\d km/.test(text), c.name).toBe(false);
    }
  });

  it('K4: bodovi opterećenja samo pod zastavicom za sudiju', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    expect(renderPlan(b.doc, b.state, SYNTHETIC)).not.toMatch(/\bBO\b/);
    expect(renderPlan(b.doc, b.state, SYNTHETIC, { showLoad: true })).toMatch(
      /opterećenje \d+ BO \(cilj \d+\)/
    );
  });

  const parse = (value: string): number => Number(value.replace(',', '.'));

  it('K5: zbir km dana = km nedelje; tempo × km = vreme', () => {
    for (const { c, b } of built) {
      const lines = renderPlan(b.doc, b.state, SYNTHETIC).split('\n');
      let sum = 0;
      let weeks = 0;
      for (const line of lines) {
        const day = / — ([\d,]+) km, /.exec(line);
        if (day !== null) sum += parse(day[1] ?? '0');
        const total = /^ {2}Zbir: ([\d,]+) km, /.exec(line);
        if (total !== null) {
          expect(Math.abs(sum - parse(total[1] ?? '0')), `${c.name}: ${line}`).toBeLessThan(0.05);
          sum = 0;
          weeks += 1;
        }
      }
      expect(weeks, c.name).toBe(b.doc.weeks.length);
      const ctx = paceCtxOf(b.doc.header);
      for (const d of b.doc.weeks.flatMap((w) => w.days)) {
        const w = d.workout;
        if (w === null || w.kind !== 'easy' || w.steps.length !== 1) continue;
        const s = summarize(w, ctx);
        expect(Math.abs(s.durationSec - s.km * ctx.paces.easy), `${c.name} ${d.date}`).toBeLessThan(
          120
        );
      }
    }
  });

  it('K5: radni minuti odgovaraju deonicama', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    const ctx = paceCtxOf(b.doc.header);
    for (const d of b.doc.weeks.flatMap((w) => w.days)) {
      if (d.workout?.kind === 'quality') {
        expect(
          Math.abs(summarize(d.workout, ctx).workSec - d.workout.workSec),
          d.date
        ).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('tempo u redu dana (oznaka `{pace}` u šablonu teksta)', () => {
  const b = build(facts(), goalAt('2027-01-24'));
  const text = renderPlan(b.doc, b.state, SYNTHETIC);

  it('tempo stoji uz deonicu rada samo gde šablon ima oznaku; bez oznake nema tempa (usponi); lagani i dugi bez tempa', () => {
    expect(text).toContain('prag 2 × 7 min (4:40/km), oporavak 1:30 džog — ');
    const hills = text.split('\n').filter((l) => l.includes('uzbrdo'));
    expect(hills.length).toBeGreaterThan(0);
    for (const line of hills) expect(line).not.toMatch(/\/km/);
    expect(text).toMatch(/dugi [\d,]+ km, poslednjih [\d,]+ km \(4:30\/km\) u tempu trke — /);
    for (const line of text
      .split('\n')
      .filter((l) => /^ {2}\S+ \d+\. \d+\. {2}(lagano|dugi [\d,]+ km —)/.test(l))) {
      expect(line).not.toMatch(/\/km/);
    }
  });

  it('`Workout.text` i otisak ne nose tempo ni oznaku', () => {
    for (const day of b.doc.weeks.flatMap((w) => w.days)) {
      expect(day.workout?.text ?? '').not.toMatch(/\/km|\{|\}/);
    }
  });

  it('po osećaju: red dana nema ni tempo ni opis u zagradi — napor po zonama je u zaglavlju', () => {
    const feel = build(
      facts({ profile: { weeklyKm: 25, easyPaceSecPerKm: 400 } }),
      goalAt('2027-01-24')
    );
    const out = renderPlan(feel.doc, feel.state, SYNTHETIC);
    expect(feel.doc.header.paces.byFeel).toBe(true);
    expect(out).toMatch(/prag 2 × \d+ min, oporavak 1:30 džog — /);
    expect(out).toContain('NAPOR PO ZONAMA');
    expect(out).toContain('- prag: ugodno teško, par reči');
    for (const line of out.split('\n').filter((l) => / — [\d,]+ km, /.test(l))) {
      expect(line).not.toMatch(/\/km|\(/);
    }
    expect(out).toContain('Trku trči po osećaju');
    expect(
      out
        .split('\n')
        .filter((l) => l.includes('napomena:'))
        .join(' ')
    ).not.toMatch(/\/km/);
  });
});

describe('ispis posle ponovnog planiranja', () => {
  const b = build(facts(), goalAt('2027-01-24'));
  const today = '2026-12-20';
  const state = advance(b, today, {
    runs: runsAsPlanned(b.doc, '2026-12-13'),
    pauses: [{ from: '2026-12-14', to: today, reason: 'bolest' }]
  });
  const result = replan(b.doc, state, deriveEvents(b.doc, state), SYNTHETIC);
  const text = renderPlan(result.doc, state, SYNTHETIC, { changes: result.changes });

  it('ima spisak promena sa objašnjenjem, bez internih izraza i sa ispravnom množinom', () => {
    expect(text).toContain('PROMENE');
    expect(text).toContain('Pauza zbog bolesti trajala je 7 dana (14–20. 12.)');
    expect(text).toMatch(/- (uto|čet|sub|ned) \d+\. \d+\.: .+ → .+/);
    for (const pattern of INTERNAL) expect(pattern.test(text), String(pattern)).toBe(false);
    expect(pluralErrors(text)).toEqual([]);
  });

  it('svaka promena ima razlog od jedne rečenice i rok', () => {
    const doc: PlanDoc = result.doc;
    for (const change of result.changes) {
      expect(change.reason.endsWith('.')).toBe(true);
      expect(change.until >= today).toBe(true);
      expect(change.before).not.toBe(change.after);
    }
    expect(doc.header.appliedEvents).toHaveLength(1);
  });
});
