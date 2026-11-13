/* KRUG 6 (briefs/R6-ROUND6.md) — opšta svojstva ponovnog planiranja nad svih 24 scenarija.
   R1: van prozora izmene nijedan dugi nije kraći od prvobitnog i nijedna nedelja nije manja.
   R2: na izlasku iz prozora dugi raste najviše + 25 % ili + 20 min, nedelja najviše + 20 % (prema najvećoj od
       prethodne 3) — osim kad isti skok ima i prvobitan plan na tom mestu.
   R5: nijedna rečenica u upozorenjima ne pominje datum u prošlosti; „oporavak do X" ⇒ prvi brzi trening posle X. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { describe, expect, it } from 'vitest';
import { paceCtxOf, renderPlan, summarize, type PlanDoc, type PlanWeek } from '../../engine';
import { addDays } from '../../engine/dates';
import { weekCost } from '../../engine/guard';
import { adjustmentWindow } from '../../engine/readiness';
import { hm } from './index';
import { SCENARIOS } from './testdata/scenarios';

const RUNS = SCENARIOS.map((s) => ({ s, r: s.run() }));
/* E5 (s17–s20) je nov plan iz novog stanja, ne ponovno planiranje */
const REPLANS = RUNS.filter(({ s }) => !s.title.startsWith('E5'));
const name = (no: number): string => `s${String(no).padStart(2, '0')}`;

function windowEnd(r: any): string | null {
  const ends: string[] = r.changes.map((c: any) => c.until as string);
  return ends.length === 0 ? null : ends.reduce((a, b) => (a > b ? a : b));
}
/* `by`: plan čija tempa važe za merenje (prvobitan plan se meri tempima novog — rezultat menja tempa, ne obim) */
const longSec = (w: PlanWeek, doc: PlanDoc, by: PlanDoc = doc): number => {
  const ctx = paceCtxOf(by.header);
  const day = w.days.find((d) => d.workout?.kind === 'long');
  return day?.workout === undefined || day.workout === null
    ? 0
    : summarize(day.workout, ctx).durationSec;
};
const weekKm = (w: PlanWeek, doc: PlanDoc, by: PlanDoc = doc): number =>
  weekCost(w, doc.header.goal.raceDate, paceCtxOf(by.header)).km;

describe('krug 6: ponovno planiranje nad 24 scenarija', () => {
  it('R1: van prozora izmene dugi nije kraći od prvobitnog, nedelja nije manja', () => {
    const bad: string[] = [];
    for (const { s, r } of REPLANS) {
      const end = windowEnd(r);
      if (end === null) continue;
      for (const w of r.after.weeks as PlanWeek[]) {
        if (w.start <= end) continue;
        const old = (r.before.weeks as PlanWeek[]).find((x) => x.start === w.start);
        if (old === undefined) continue;
        const a = longSec(w, r.after);
        const b = longSec(old, r.before, r.after);
        if (b > 0 && a < b - 60)
          bad.push(
            `${name(s.no)} n${String(w.index)} dugi ${String(Math.round(a / 60))} < ${String(Math.round(b / 60))} min`
          );
        const ka = weekKm(w, r.after);
        const kb = weekKm(old, r.before, r.after);
        if (ka < kb - 0.5)
          bad.push(
            `${name(s.no)} n${String(w.index)} nedelja ${ka.toFixed(1)} < ${kb.toFixed(1)} km`
          );
      }
    }
    /* propušten trening (E3): sledeći dugi nikad kraći od prvobitnog; sužavanje (nedelje −2 i −1) se ne dira */
    for (const { s, r } of REPLANS.filter(({ s }) => s.title.startsWith('E3'))) {
      const today: string = r.afterState.today;
      const n = r.after.weeks.length;
      const next = (r.after.weeks as PlanWeek[]).find(
        (w) => w.start >= today && w.days.some((d) => d.date > today && d.workout?.kind === 'long')
      );
      const old = (r.before.weeks as PlanWeek[]).find((w) => w.start === next?.start);
      if (
        next !== undefined &&
        old !== undefined &&
        longSec(next, r.after) < longSec(old, r.before, r.after) - 60
      )
        bad.push(`${name(s.no)} sledeći dugi n${String(next.index)} kraći od prvobitnog`);
      for (const c of r.changes) {
        const w = (r.after.weeks as PlanWeek[]).find((x) => x.days.some((d) => d.id === c.dayId));
        if (w !== undefined && w.index >= n - 2 && w.index < n)
          bad.push(`${name(s.no)} izmena u sužavanju n${String(w.index)} (${String(c.dayId)})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('R2: izlazak iz prozora bez skoka (dugi ≤ +25 % ili +20 min, nedelja ≤ +20 %)', () => {
    const bad: string[] = [];
    for (const { s, r } of REPLANS) {
      const end = windowEnd(r);
      if (end === null) continue;
      const after = r.after.weeks as PlanWeek[];
      const before = r.before.weeks as PlanWeek[];
      /* od današnje nedelje do dve nedelje posle prozora */
      const today: string = r.afterState.today;
      const firstOut = after.findIndex((w) => w.start > end);
      /* merilo je prva cela nedelja posle događaja; prelazi se mere od kraja rampe zaštite (rast unutar rampe je
         njena kriva) do dve nedelje posle prozora */
      const base = after.findIndex((w) => w.start > today);
      if (base < 0) continue;
      const rampEnd = ((r.after.header.adjustments ?? []) as any[])
        .map((a) => adjustmentWindow(a)?.rampEnd ?? '')
        .reduce((a: string, b: string) => (a > b ? a : b), '');
      const from = Math.max(
        base + 1,
        after.findIndex((w) => addDays(w.start, 6) > rampEnd)
      );
      const to = firstOut < 0 ? after.length : Math.min(after.length, firstOut + 2);
      for (let i = from; i < to; i += 1) {
        const w = after[i];
        if (w === undefined || w.intent.kind === 'race') continue;
        /* merilo: najveće od nedelje događaja (ne pre nje) — najviše 3 prethodne */
        const lo = Math.max(base, i - 3);
        const prevLong = Math.max(...after.slice(lo, i).map((x) => longSec(x, r.after)));
        const curLong = longSec(w, r.after);
        const oldPrev = Math.max(...before.slice(lo, i).map((x) => longSec(x, r.before)));
        const oldCur = longSec(before[i] as PlanWeek, r.before);
        const allowed = Math.max(
          prevLong * 1.25,
          prevLong + 1200,
          oldPrev > 0 ? (prevLong * oldCur) / oldPrev : 0
        );
        if (prevLong > 0 && curLong > allowed + 60)
          bad.push(
            `${name(s.no)} n${String(w.index)} dugi ${String(Math.round(prevLong / 60))} → ${String(Math.round(curLong / 60))} min`
          );
        const prevKm = Math.max(...after.slice(lo, i).map((x) => weekKm(x, r.after)));
        const oldPrevKm = Math.max(...before.slice(lo, i).map((x) => weekKm(x, r.before)));
        const km = weekKm(w, r.after);
        const allowedKm = Math.max(
          prevKm * 1.2,
          oldPrevKm > 0 ? (prevKm * weekKm(before[i] as PlanWeek, r.before)) / oldPrevKm : 0
        );
        if (km > allowedKm + 0.5)
          bad.push(
            `${name(s.no)} n${String(w.index)} nedelja ${prevKm.toFixed(1)} → ${km.toFixed(1)} km`
          );
      }
    }
    expect(bad).toEqual([]);
  });

  it('R5: upozorenja ne pominju datum u prošlosti; „oporavak do X" ⇒ prvi brzi posle X', () => {
    const bad: string[] = [];
    const isoOf = (d: string, m: string): string => {
      const month = Number(m);
      return `${month >= 9 ? '2026' : '2027'}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };
    for (const { s, r } of RUNS) {
      const today: string = r.afterState.today;
      for (const w of r.after.header.warnings) {
        const text = `${w.problem} ${w.meaning} ${w.proposal}`;
        for (const m of text.matchAll(/(\d{1,2})\. (\d{1,2})\./g)) {
          const iso = isoOf(m[1] ?? '', m[2] ?? '');
          if (iso < today) bad.push(`${name(s.no)} ${w.code}: ${m[0]} (danas ${today})`);
        }
      }
      const text = renderPlan(r.after, r.afterState, hm);
      const days = (r.after.weeks as PlanWeek[]).flatMap((w) => w.days);
      for (const m of text.matchAll(
        /(?:[Oo]porav\w* (?:traje )?do|Do) (\d{1,2})\. (\d{1,2})\.(?: traje oporavak)?/g
      )) {
        if (!m[0].includes('porav')) continue;
        const until = isoOf(m[1] ?? '', m[2] ?? '');
        const early = days.find(
          (d) =>
            d.date > today &&
            d.date <= until &&
            (d.workout?.kind === 'quality' || (d.workout?.kind === 'long' && d.workout.workSec > 0))
        );
        if (early !== undefined)
          bad.push(`${name(s.no)} oporavak do ${until}, a brzi ${early.date}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
