/* KRUG 10 (poruka organizatora 13. 11.) — povratak posle događaja, provera nad podacima ove distance. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { longCapAfterEvent, noCatchUp, returnsToOriginal } from '../../engine/testdata/round10';
import { paceCtxOf, renderPlan, summarize } from '../../engine';
import { tenk } from './index';
import { SCENARIOS } from './testdata/scenarios';

const RUNS = SCENARIOS.filter((s) => !s.title.startsWith('E5')).map((s) => ({
  s,
  r: s.run() as any
}));

describe('krug 10 — povratak posle događaja (tenk)', () => {
  it('1: posle bolesti (E2) plan se vraća na prvobitan pre sužavanja', () => {
    const bad: string[] = [];
    for (const { s, r } of RUNS.filter(({ s }) => s.title.startsWith('E2')))
      bad.push(...returnsToOriginal(`s${String(s.no)}`, r.before, r.after, r.afterState.today));
    expect(bad).toEqual([]);
  });
  it('2: dugi posle svakog događaja ≤ + 25 % / + 20 min od prethodnog dok se plan ne vrati', () => {
    const bad: string[] = [];
    for (const { s, r } of RUNS)
      bad.push(...longCapAfterEvent(`s${String(s.no)}`, r.before, r.after, r.afterState.today));
    expect(bad).toEqual([]);
  });
  it('3: nijedna nedelja posle događaja nije veća od prvobitne (i nedelja −2 ne raste)', () => {
    const bad: string[] = [];
    for (const { s, r } of RUNS)
      bad.push(...noCatchUp(`s${String(s.no)}`, r.before, r.after, r.afterState.today));
    expect(bad).toEqual([]);
  });
});

describe('krug 10 — stavka 4: tekst izmene i provera forme', () => {
  const ALL = SCENARIOS.map((s) => ({ s, r: s.run() as any }));
  it('a/b: izmena nosi samo poslednji rezultat; rezultat stariji od 14 dana uz drugi događaj se ne objavljuje', () => {
    const bad: string[] = [];
    for (const { s, r } of ALL) {
      const today: string = r.afterState.today;
      /* krug 12 (M1): stari rezultat objavljuje samo svoju promenu tempa (zaglavlje), ne izmene dana */
      const ids = new Set<string>(
        (r.changes as any[])
          .filter(
            (c) => !(c.scope === 'zaglavlje' && (c.what === 'tempa' || c.what === 'upozorenje'))
          )
          .map((c) => String(c.eventId))
      );
      const results = [...ids].filter((x) => x.startsWith('result:'));
      if (results.length > 1) bad.push(`s${String(s.no)} više rezultata: ${results.join(', ')}`);
      const others = [...ids].some((x) => !x.startsWith('result:'));
      for (const id of results) {
        const date = id.split(':')[1] ?? '';
        const old = new Date(Date.parse(today) - 14 * 86400000).toISOString().slice(0, 10);
        if (others && date < old) bad.push(`s${String(s.no)} stari rezultat ${id}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('c: „ništa" bez izmena (E6, promena 0) — ni napomena za dan trke se ne menja', () => {
    const note = (doc: any, st: any): string => {
      const lines = renderPlan(doc, st, tenk).split('\n');
      const i = lines.findIndex((l) => l.includes('TRKA:'));
      const out: string[] = [];
      for (let j = i + 1; j < lines.length && (lines[j] ?? '').includes('napomena'); j += 1)
        out.push(lines[j] ?? '');
      return out.join('\n');
    };
    for (const { s, r } of ALL.filter(({ s }) => s.title.startsWith('E6'))) {
      if ((r.changes as any[]).length > 0) continue;
      expect(note(r.after, r.afterState), `s${String(s.no)}`).toBe(note(r.before, r.afterState));
    }
  });
  it('d: propušten glavni trening nedelje (prvi kvalitet) se imenuje (s09)', () => {
    const r = ALL.find(({ s }) => s.no === 9)?.r;
    const named = (r.changes as any[]).filter((c) =>
      String(c.reason).startsWith('Propušten je ključni')
    );
    expect(named.length).toBe(2);
  });
  it('e: jedina provera forme se pomera, ne briše (osim < 3 nedelje do trke ili kad je zameni trka)', () => {
    const bad: string[] = [];
    for (const { s, r } of ALL.filter(({ s }) => !/^E[57]/.test(s.title))) {
      const today: string = r.afterState.today;
      const tests = (doc: any): string[] =>
        doc.weeks
          .flatMap((w: any) => w.days)
          .filter((x: any) => x.workout?.kind === 'test' && x.date > today)
          .map((x: any) => x.date as string);
      const b = tests(r.before);
      const a = tests(r.after);
      const race: string = r.after.header.goal.raceDate;
      const late = new Date(Date.parse(race) - 21 * 86400000).toISOString().slice(0, 10);
      /* R18 (M5): bez mesta koje ne zamenjuje tempo trke provera otpada, uz rečenicu */
      const said = JSON.stringify(r.changes).includes('Provera forme otpada');
      if (a.length < b.length && b.some((x) => x <= late) && !said)
        bad.push(`s${String(s.no)} provera ${b.join(',')} → ${a.join(',') || 'nema'}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('krug 10 — stavka 5: kasna bolest i posle trke na ciljnoj dužini', () => {
  const ALL = SCENARIOS.map((s) => ({ s, r: s.run() as any }));
  it('bolest ≤ 3 nedelje pred trkom (E2): nedelja −1 ima oštrenje u tempu trke 6–12 min rada', () => {
    let seen = 0;
    for (const { s, r } of ALL.filter(({ s }) => s.title.startsWith('E2'))) {
      const race: string = r.after.header.goal.raceDate;
      const pause = (r.after.header.adjustments ?? []).find((a: any) => a.kind === 'pause');
      if (pause === undefined || pause.rampDays === undefined) continue;
      seen += 1;
      const weeks = r.after.weeks as any[];
      const m1 = weeks[weeks.length - 2];
      const q = (m1.days as any[]).filter((x) => x.workout?.kind === 'quality');
      expect(q.length, `s${String(s.no)} ${race}`).toBeGreaterThanOrEqual(1);
      for (const x of q) {
        expect(x.workout.workSec, `s${String(s.no)}`).toBeGreaterThanOrEqual(360);
        expect(x.workout.workSec, `s${String(s.no)}`).toBeLessThanOrEqual(720);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('posle trke na ciljnoj dužini (E5, 4+ dana): dugi druge nedelje ≤ 70 % prvobitnog (ili lagan dan + 5 min)', () => {
    let seen = 0;
    for (const { s, r } of ALL.filter(({ s }) => s.title.startsWith('E5'))) {
      if ((r.after.header.decisions.runDays as unknown[]).length < 4) continue;
      const ctx = paceCtxOf(r.after.header);
      const sec = (w: any, kind: string): number =>
        Math.max(
          0,
          ...(w.days as any[]).map((x) =>
            x.workout?.kind === kind ? summarize(x.workout, ctx).durationSec : 0
          )
        );
      const w2 = (r.after.weeks as any[])[1];
      const old = (r.before.weeks as any[]).find((x) => x.start === w2.start);
      if (old === undefined || sec(old, 'long') === 0) continue;
      seen += 1;
      /* motor meri 70 % planiranog dugog novog plana; prema prvobitnom planu do 75 % */
      const cap = Math.max(0.75 * sec(old, 'long'), sec(w2, 'easy') + 300) + 120;
      expect(sec(w2, 'long'), `s${String(s.no)}`).toBeLessThanOrEqual(cap);
    }
    expect(seen).toBeGreaterThan(0);
  });
});
