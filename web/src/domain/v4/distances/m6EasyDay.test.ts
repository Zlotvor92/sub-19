/* R24 (M6 + P1, odluka vlasnika 14. 11. 2026) — svojstva nad mrežom ulaza SVIH distanci (profili × 4/5/6 dana):
   u nedelji gradnje/rasterećenja (ne trke, sužavanja, provere ni prozora povratka) sa ≥ `minEasyBuildFromRunDays`
   traženih dana lagan dan nije kraći od najkraćeg laganog nivoa, osim kad nedelja zadržava sve dane (dan manje ne bi
   doneo duže lagane dane — plafon dana); nedelja ima bar max(3, traženo − 1) dana; dopuna laganih dana ne diže nedelju
   preko cilja + 5 %; izostavljen dan predaje minute ostalim laganim danima (nedelja ne gubi obim). Sa potvrđenim danima (`confirmedRunDays`) broj dana == traženi, uvek. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
   -- profili su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, paceCtxOf, plan, summarize, type DistanceData } from '../engine';
import { buildMinEasyOf } from '../engine/decide';
import { adjustmentWindow } from '../engine/readiness';
import { addDays } from '../engine/dates';
import { estimateForm } from '../fitness';

const dataMods = import.meta.glob<Record<string, unknown>>('./*/index.ts', { eager: true });
const profMods = import.meta.glob<Record<string, unknown>>('./*/testdata/profiles.ts', {
  eager: true
});
const DIST = Object.entries(dataMods).map(([path, mod]) => {
  const data = Object.values(mod).find(
    (v): v is DistanceData => typeof v === 'object' && v !== null && 'adequate' in v && 'id' in v
  );
  if (data === undefined) throw new Error(path);
  const p = profMods[path.replace('index.ts', 'testdata/profiles.ts')] as any;
  return { data, profiles: p.PROFILES as any[], factsOf: p.factsOf as (x: any) => any };
});

const DAYSETS: Record<number, number[]> = {
  4: [1, 3, 5, 6],
  5: [0, 1, 3, 5, 6],
  6: [0, 1, 2, 3, 5, 6]
};

interface Case {
  id: string;
  doc: any;
}

/** Mreža: svaki profil sa svojim danima i sa 4, 5 i 6 dana (dugi nedeljom). */
function grid(d: (typeof DIST)[number], confirmed: boolean, data: DistanceData = d.data): Case[] {
  const out: Case[] = [];
  for (const p of d.profiles) {
    const variants: [string, number[], number][] = [['', p.runDays, p.longDay]];
    for (const n of [4, 5, 6])
      if (n !== p.runDays.length) variants.push([`/${String(n)}d`, DAYSETS[n] ?? [], 6]);
    for (const [tag, runDays, longDay] of variants) {
      const facts = d.factsOf(p);
      facts.availability = {
        runDays,
        longDay,
        ...(confirmed ? { confirmedRunDays: true } : {})
      };
      const res = plan(buildState(facts, p.goal, data, estimateForm), p.goal, data);
      if (res.ok) out.push({ id: `${String(p.id)}${tag}`, doc: res.doc });
    }
  }
  return out;
}

/** Isti podatak bez pravila M6 (dosadašnje pravilo laganih dana) — merilo poređenja. */
const withoutM6 = (data: DistanceData): DistanceData => {
  const { minEasyBuildFromRunDays: _off, ...safety } = data.safety;
  return { ...data, safety };
};

/** Nedelje u kojima M6 važi: gradnja/rasterećenje, cela u planu, pre silaska (−2, −1), bez provere i trke, van
    prozora povratka. */
function m6Weeks(doc: any): any[] {
  const h = doc.header;
  const adj = (h.adjustments ?? []) as any[];
  const raceMonday = (doc.weeks as any[]).find((w) =>
    (w.days as any[]).some((x) => x.date === h.goal.raceDate)
  )?.start as string | undefined;
  return (doc.weeks as any[]).filter((w) => {
    if (!['build', 'recovery'].includes(w.intent.kind)) return false;
    if (w.start < h.startDate) return false;
    if (raceMonday !== undefined && w.start >= addDays(raceMonday, -14)) return false;
    if ((w.days as any[]).some((x) => x.workout?.kind === 'test' || x.workout?.kind === 'race'))
      return false;
    return !adj.some((a) => {
      const win = adjustmentWindow(a);
      return win !== null && win.from <= addDays(w.start, 6) && win.rampEnd >= w.start;
    });
  });
}

const runsOf = (w: any): number => (w.days as any[]).filter((x) => x.workout !== null).length;

/** Kratki lagani dani (kraći od najkraćeg nivoa za više od 90 s) u nedeljama M6. */
function shortDays(doc: any, m6: number): number {
  const ctx = paceCtxOf(doc.header);
  let n = 0;
  for (const w of m6Weeks(doc))
    for (const x of w.days as any[])
      if (x.workout?.kind === 'easy' && summarize(x.workout, ctx).durationSec < m6 - 90) n += 1;
  return n;
}

describe('R24 (M6 + P1) — najkraći lagan dan, tri koraka, pa dan manje (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: dana ≥ max(3, traženo − 1); manje kratkih laganih dana nego bez M6; dopuna ≤ cilj + 5 %; dan manje ne gubi obim',
    (_id, d) => {
      const bad: string[] = [];
      const off = new Map(grid(d, false, withoutM6(d.data)).map((c) => [c.id, c.doc]));
      let before = 0;
      let after = 0;
      for (const c of grid(d, false)) {
        const h = c.doc.header;
        const asked = h.decisions.runDays.length as number;
        const m6 = buildMinEasyOf(d.data.safety, h.decisions.level, asked);
        const old = off.get(c.id);
        if (m6 === null || old === undefined) continue;
        before += shortDays(old, m6);
        after += shortDays(c.doc, m6);
        const ctx = paceCtxOf(h);
        const oldWeeks = new Map((old.weeks as any[]).map((w) => [w.index, w]));
        const octx = paceCtxOf(old.header);
        const secOf = (w: any, x: any): number => {
          let sec = 0;
          for (const y of w.days as any[])
            if (y.workout !== null) sec += summarize(y.workout, x).durationSec;
          return sec;
        };
        for (const w of m6Weeks(c.doc)) {
          const runs = runsOf(w);
          const ow = oldWeeks.get(w.index);
          const oldRuns = ow === undefined ? runs : runsOf(ow);
          /* M6 ne spušta nedelju ispod max(3, traženo − 1) dana */
          if (runs < oldRuns && runs < Math.max(3, asked - 1))
            bad.push(`${c.id} n${String(w.index)}: ${String(runs)} dana`);
          /* dan manje zbog M6: njegovi minuti idu u ostale lagane dane — nedelja ≥ 85 % obima bez M6 (zaokruživanje na
             0,5 km, plafon dana; dugi može da se razlikuje kroz lanac dugog) */
          if (runs < oldRuns && ow !== undefined) {
            const now = secOf(w, ctx);
            const was = secOf(ow, octx);
            if (now < 0.85 * was)
              bad.push(
                `${c.id} n${String(w.index)}: ${String(Math.round(now / 60))} < ${String(Math.round(was / 60))} min`
              );
          }
          /* korak 1: nedelja bez izostavljenog dana nije iznad cilja + 5 % zbog M6 */
          if (runs === oldRuns && ow !== undefined && w.volumeMin !== undefined) {
            const now = secOf(w, ctx) / 60;
            const was = secOf(ow, octx) / 60;
            /* zaokruživanje laganog dana na 0,5 km: do 2 min po danu */
            if (now > was + 1 && now > 1.05 * w.volumeMin + 2 * runs)
              bad.push(`${c.id} n${String(w.index)}: ${String(Math.round(now))} min > 1,05 × cilj`);
          }
        }
      }
      expect(bad).toEqual([]);
      /* pravilo nešto radi na svakoj distanci sa pragom od 4 dana, i nikad ne dodaje kratke dane */
      expect(after).toBeLessThanOrEqual(before);
      if (d.data.safety.minEasyBuildFromRunDays === 4) expect(after).toBeLessThan(before);
    },
    180_000
  );

  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: sa potvrđenim danima broj dana == traženi (gradnja/rasterećenje)',
    (_id, d) => {
      const bad: string[] = [];
      for (const c of grid(d, true)) {
        const asked = c.doc.header.decisions.runDays.length as number;
        expect(c.doc.header.decisions.confirmedRunDays).toBe(true);
        for (const w of m6Weeks(c.doc))
          if (runsOf(w) !== asked)
            bad.push(`${c.id} n${String(w.index)}: ${String(runsOf(w))}/${String(asked)}`);
      }
      expect(bad).toEqual([]);
    },
    120_000
  );
});
