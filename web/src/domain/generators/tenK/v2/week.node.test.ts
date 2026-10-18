/* D7 taper, D8 + D20 + D23 trkačka nedelja, D13 dužine, D19 lagani dani, D14 WU/CD i oporavci, D15 Uslov 8 —
   nezavisne provere na uzorku mreže 02 (3/4/5/6 dana; brojevi iz odluka, ne iz koda generatora). */

import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, weekdayOf } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { grid02Inputs } from './testInputs.ts';
import type { PlanWeek, TenKV2Plan } from './types.ts';

/** Uzorak mreže 02 (svaki 10. ulaz po broju dana); odbijeni ulazi se beleže (test ispod). */
const rejected: string[] = [];
const plans: TenKV2Plan[] = ([3, 4, 5, 6] as const).flatMap((n) =>
  grid02Inputs(n)
    .filter((_, i) => i % 10 === 0)
    .flatMap(({ id, input }) => {
      const r = generateTenKV2(input);
      if (r.ok) return [r.plan];
      rejected.push(`${id}: ${r.reasons.map((x) => x.code).join(',')}`);
      return [];
    })
);

it('uzorak mreže 02 se generiše bez odbijanja', () => {
  expect(rejected).toEqual([]);
  expect(plans.length).toBe(1585);
});
const steady = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific');
const mid = (p: TenKV2Plan): number => (p.paces.E.fast + p.paces.E.slow) / 2;
const floor10 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
/** D17 nezavisno: udeo dugog (02b: 3 dana 0,45) i minimum nedelje po broju dana. */
const SHARE: Record<number, number> = { 3: 0.45, 4: 0.33, 5: 0.3, 6: 0.27 };
const WEEK_MIN: Record<number, number> = { 3: 9, 4: 12, 5: 15, 6: 18 };
const RP_LADDER = [2400, 3000, 4000, 4500, 5000, 6000];
const T_CRUISE = [2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000, 6400, 8000];
const down = (ladder: number[], last: number, floor: number): number =>
  ladder.filter((m) => m <= 0.6 * last + 1e-6 && m >= floor).pop() ?? floor;

describe('D7: taper', () => {
  it('cilj 0,75 × vrh; RP i T ≈ 60 % poslednje doze (3 dana samo RP); dugi ≤ 0,75 × najduži; svi dani trčanja', () => {
    const seen = { rpOnly: 0, none: 0 };
    for (const p of plans) {
      const n = p.input.runDays.length;
      const t = p.weeks[p.weeks.length - 2]!;
      expect(t.phase).toBe('taper');
      const nominal = Math.round(0.75 * Math.round(p.peakKm * 10)) / 10;
      if (t.fitted === null) expect(t.targetKm).toBe(nominal);
      else expect(t.targetKm).toBeLessThan(nominal);
      const last = p.weeks.filter(steady).pop()!;
      const lastRp = last.days.find((d) => d.role === 'q1')!.workout.dose!.doseM;
      const rp = t.days.find((d) => d.role === 'q1')?.workout.dose;
      const tt = t.days.find((d) => d.role === 'q2')?.workout.dose;
      const wantRp = down(RP_LADDER, lastRp, 2000);
      if (!rp) {
        // Odstupanje D7 (D11 ispred D7): ni RP po pravilu ne staje u plafon 10 % cilja.
        expect(wantRp).toBeGreaterThan(Math.floor(0.1 * t.targetKm * 1000 + 1e-6));
        expect(t.notes.some((x) => x.includes('bez kvaliteta'))).toBe(true);
        seen.none++;
      } else {
        expect(rp.zone).toBe('RP');
        expect(rp.doseM).toBe(wantRp);
        if (rp.doseM === 2000) expect(rp.structure).toEqual({ form: 'reps', reps: 2, repM: 1000 });
      }
      if (n === 3) expect(tt).toBeUndefined();
      else if (!tt) {
        // Odstupanje D7: samo RP kad sa RP i T nijedan cilj nije izvodljiv (napomena).
        expect(t.notes.some((x) => x.includes('samo RP') || x.includes('bez kvaliteta'))).toBe(
          true
        );
        if (rp) seen.rpOnly++;
      } else {
        const lastT = last.days.find((d) => d.role === 'q2')!.workout.dose!.doseM;
        expect(tt.zone).toBe('T');
        expect(tt.doseM).toBe(down(T_CRUISE, lastT, 2000));
      }
      const longest = Math.max(
        ...p.weeks.slice(0, -2).map((w) => w.days.find((d) => d.role === 'long')!.workout.km)
      );
      expect(t.days.find((d) => d.role === 'long')!.workout.km).toBeLessThanOrEqual(
        floor10(0.75 * longest) + 1e-9
      );
      expect(t.days.length).toBe(n);
    }
    expect(seen.none).toBeGreaterThan(0);
  });
});

describe('D8 + D20 + D23: trkačka nedelja', () => {
  it('dana sa trkom = min(broj dana, 5): otpada dugi, pa najraniji lagan dan; oštrenje ≤ RP doza tapera; dan pred trku; lagan = min(35 min E, najkraći lagan tapera); trka van obima; trkačka ≤ taper', () => {
    const reps: Record<number, number> = { 0: 0, 2: 0, 3: 0 };
    let droppedEasy = 0;
    const easyKind = { time: 0, km: 0 };
    for (const p of plans) {
      const n = p.input.runDays.length;
      const w = p.weeks[p.weeks.length - 1]!;
      const race = p.input.raceDate;
      expect(w.phase).toBe('race');
      expect(w.days.length).toBe(Math.min(n, 5));
      expect(w.days.some((d) => d.role === 'long')).toBe(false);
      const rd = w.days.find((d) => d.role === 'race')!;
      expect(rd.date).toBe(race);
      expect(rd.countsToWeek).toBe(false);
      expect(rd.workout.segments.map((s) => [s.kind, s.kind === 'race' ? s.km : s.sec])).toEqual([
        ['warmup', 900],
        ['race', 10],
        ['cooldown', 600]
      ]);
      // D20 nezavisno: datumi dana trčanja u nedelji bez trke; otpada dugi, pa najraniji lagan dan.
      const dateOf = (wd: string): string =>
        Array.from({ length: 7 }, (_, i) => addDays(w.startDate, i)).find(
          (d) => weekdayOf(d) === wd
        )!;
      const runs = p.input.runDays.map(dateOf).filter((d) => d !== race);
      const order = [dateOf(p.pattern.long), ...p.pattern.easy.map(dateOf).sort()].filter((d) =>
        runs.includes(d)
      );
      const drop = order.slice(0, runs.length - (Math.min(n, 5) - 1));
      if (drop.some((d) => d !== dateOf(p.pattern.long))) droppedEasy++;
      const days = w.days.filter((d) => d.role !== 'race');
      expect(days.map((d) => d.date).sort()).toEqual(runs.filter((d) => !drop.includes(d)).sort());
      // Oštrenje: najkasniji dan ≥ 3 dana pre trke, nesusedan poslednjem zahtevnom danu tapera.
      const taper = p.weeks[p.weeks.length - 2]!;
      const prevHard = taper.days.filter((d) => d.hard).pop()!.date;
      const taperRp = taper.days.find((d) => d.role === 'q1')?.workout.dose?.doseM ?? 0;
      const k = taperRp >= 3000 ? 3 : taperRp >= 2000 ? 2 : 0;
      const latest = days
        .filter((d) => daysBetween(d.date, race) >= 3 && daysBetween(prevHard, d.date) >= 2)
        .map((d) => d.date)
        .sort()
        .pop();
      const sharp = days.filter((d) => d.role === 'sharpener');
      if (k === 0 || latest === undefined) expect(sharp.length).toBe(0);
      else {
        expect(sharp.length).toBe(1);
        expect(sharp[0]!.date).toBe(latest);
        expect(sharp[0]!.workout.dose!.structure).toEqual({ form: 'reps', reps: k, repM: 1000 });
        expect(sharp[0]!.workout.dose!.doseM).toBeLessThanOrEqual(taperRp);
        expect(
          sharp[0]!.workout.segments.filter((s) => s.kind === 'recovery').every((s) => s.sec === 90)
        ).toBe(true);
      }
      reps[sharp.length === 0 ? 0 : k]!++;
      for (const d of days) {
        if (d.role === 'sharpener') continue;
        if (daysBetween(d.date, race) === 1) {
          expect(d.role).toBe('eve');
          expect(d.workout.sec).toBeLessThanOrEqual(1800);
          expect(d.workout.segments.filter((s) => s.kind === 'easy').map((s) => s.sec)).toEqual([
            1200
          ]);
          expect(d.workout.segments.filter((s) => s.kind === 'stride').map((s) => s.sec)).toEqual([
            20, 20, 20, 20
          ]);
        } else {
          // D23: min(35 min E, najkraći lagan tapera); kad je lagan tapera kraći — zadat u km.
          expect(d.role).toBe('easy');
          const taperEasy = Math.min(
            ...taper.days.filter((x) => x.role === 'easy').map((x) => x.workout.km)
          );
          if (Math.round(taperEasy * 100) < Math.round((2100 * 100) / mid(p))) {
            expect(d.workout.segments.map((s) => [s.zone, s.kind, s.km])).toEqual([
              ['E', 'easy', taperEasy]
            ]);
            easyKind.km++;
          } else {
            expect(d.workout.segments.map((s) => [s.zone, s.sec])).toEqual([['E', 2100]]);
            easyKind.time++;
          }
        }
      }
      const planned = days.reduce((a, d) => a + Math.round(d.workout.km * 100), 0) / 100;
      expect(w.plannedKm).toBe(planned);
      expect(w.targetKm).toBe(Math.round(planned * 10) / 10);
      // D23 invarijanta: planirano trkačke nedelje (bez trke) ≤ planirano tapera.
      expect(w.plannedKm, p.input.raceDate).toBeLessThanOrEqual(taper.plannedKm);
    }
    expect(reps[2]).toBeGreaterThan(0);
    expect(reps[3]).toBeGreaterThan(0);
    expect(droppedEasy).toBeGreaterThan(0);
    expect(easyKind.km).toBeGreaterThan(0);
    expect(easyKind.time).toBeGreaterThan(0);
  });
});

describe('D13 + D19: dužine', () => {
  it('dugi ≤ udeo po broju dana i ≤ 105 min sporim E; dugi ≥ lagan ≥ 3 km; dugi = najduži dozvoljen; lagani jednaki (raniji +0,1)', () => {
    let multi = 0;
    for (const p of plans) {
      const n = p.input.runDays.length;
      for (const w of p.weeks) {
        if (w.phase === 'race') continue;
        const long = w.days.find((d) => d.role === 'long')!.workout.km;
        const cap = Math.min(floor10(SHARE[n]! * w.targetKm), floor10(6300 / p.paces.E.slow));
        expect(long, `ned ${w.index}`).toBeLessThanOrEqual(cap + 1e-9);
        expect(Math.abs(long * 10 - Math.round(long * 10))).toBeLessThan(1e-9);
        const easy = w.days.filter((x) => x.role === 'easy');
        for (const d of easy) {
          expect(d.workout.km).toBeLessThanOrEqual(long);
          expect(d.workout.km).toBeGreaterThanOrEqual(3);
          expect(Math.abs(d.workout.km * 10 - Math.round(d.workout.km * 10))).toBeLessThan(1e-9);
        }
        // D19: razlika ≤ 0,1 km; višak dobija raniji dan.
        const km10 = easy.map((d) => Math.round(d.workout.km * 10));
        if (km10.length > 1) {
          multi++;
          expect(Math.max(...km10) - Math.min(...km10)).toBeLessThanOrEqual(1);
          expect([...km10].sort((a, b) => b - a)).toEqual(km10);
        }
        if (steady(w)) {
          const q100 = w.days
            .filter((d) => d.workout.kind === 'quality')
            .reduce((a, d) => a + Math.round(d.workout.km * 100), 0);
          const rest =
            Math.floor((Math.round(w.targetKm * 100) - q100 - 300 * easy.length) / 10) / 10;
          expect(long).toBe(Math.min(cap, rest));
          expect(easy.length).toBe(n === 3 ? 1 : n - 3);
        }
      }
    }
    expect(multi).toBeGreaterThan(0);
  });
});

/** D14 (01b): WU/CD po pojasu trenutnog obima [s], isti za sve brojeve dana; trka ostaje 15/10 min (D8). */
const band = (km: number): [number, number] =>
  km < 35 ? [900, 600] : km < 45 ? [1200, 900] : [1500, 900];

describe('D14: WU/CD i oporavci', () => {
  it('WU/CD po pojasu obima za sve brojeve dana (< 35: 15/10, 35–44,9: 20/15, ≥ 45: 25/15 min; trka 15/10); oporavci po pravilu', () => {
    const seen = new Set<string>();
    let iRecs = 0;
    for (const p of plans) {
      const m = mid(p);
      for (const w of p.weeks)
        for (const d of w.days) {
          const wo = d.workout;
          if (wo.kind !== 'quality' && wo.kind !== 'race') continue;
          const [wu, cdSec] = wo.kind === 'race' ? [900, 600] : band(p.input.currentWeeklyKm);
          if (wo.kind === 'quality') seen.add(`${p.input.runDays.length}:${wu}/${cdSec}`);
          const s = wo.segments;
          expect([s[0]!.kind, s[0]!.sec, s[0]!.km]).toEqual([
            'warmup',
            wu,
            Math.round((wu * 100) / m) / 100
          ]);
          const cd = s[s.length - 1]!;
          expect([cd.kind, cd.sec, cd.km]).toEqual([
            'cooldown',
            cdSec,
            Math.round((cdSec * 100) / m) / 100
          ]);
          if (wo.kind === 'quality')
            expect(wo.title).toMatch(
              new RegExp(`^WU ${wu / 60} min \\+ .* \\+ CD ${cdSec / 60} min$`)
            );
          if (wo.kind === 'race' || !wo.dose || wo.dose.structure.form === 'continuous') continue;
          const reps = s.filter((x) => x.kind === 'rep').map((x) => Math.round(x.km * 1000));
          const want = (repM: number): { km: number } | { sec: number } =>
            wo.dose!.ladder === 'R'
              ? { km: repM / 1000 }
              : wo.dose!.ladder === 'I'
                ? { sec: Math.min(Math.floor((repM * p.paces.I) / 1000 / 15) * 15, 240) }
                : wo.dose!.ladder === 'RP_sharpener'
                  ? { sec: 90 }
                  : wo.dose!.zone === 'RP'
                    ? { sec: repM <= 1200 ? 60 : repM <= 2000 ? 90 : 120 }
                    : { sec: 60 };
          s.filter((x) => x.kind === 'recovery').forEach((r, i) => {
            const wnt = want(reps[i]!);
            if ('km' in wnt) expect(r.km).toBe(wnt.km);
            else {
              expect(r.sec).toBe(wnt.sec);
              expect(r.km).toBe(Math.round((wnt.sec * 100) / m) / 100);
            }
            if (wo.dose!.zone === 'I') {
              iRecs++;
              expect(r.sec % 15).toBe(0);
              expect(r.sec).toBeLessThanOrEqual(240);
            }
          });
        }
    }
    expect([...seen].sort()).toEqual([
      '3:1200/900',
      '3:900/600',
      '4:1200/900',
      '4:1500/900',
      '4:900/600',
      '5:1200/900',
      '5:1500/900',
      '5:900/600',
      '6:1200/900',
      '6:1500/900'
    ]);
    expect(iRecs).toBeGreaterThan(0);
  });
});

describe('D15: Uslov 8', () => {
  it('svaka nedelja ≥ minimum po broju dana (trkačka: planirano + trka 10 km, D30; inače upozorenje RACE_WEEK_SHORT), nijedan prazan trening', () => {
    for (const p of plans) {
      const n = p.input.runDays.length;
      for (const w of p.weeks) {
        if (w.phase !== 'race') expect(w.plannedKm).toBeGreaterThanOrEqual(WEEK_MIN[n]!);
        else expect(w.plannedKm + 10).toBeGreaterThanOrEqual(WEEK_MIN[n]!);
        if (w.phase === 'race')
          expect(p.warnings.some((x) => x.rule === 'RACE_WEEK_SHORT')).toBe(false);
        for (const d of w.days) {
          expect(d.workout.segments.length).toBeGreaterThan(0);
          expect(d.workout.km).toBeGreaterThan(0);
          expect(d.workout.segments.every((s) => s.km > 0 && s.sec > 0)).toBe(true);
        }
      }
    }
  });
});
