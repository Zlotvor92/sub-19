/* D7 taper, D8 trkačka nedelja, D13 dužine, D14 WU/CD i oporavci, D15 Uslov 8 — nezavisne provere na
   uzorku mreže (brojevi iz odluka, ne iz koda generatora). */

import { describe, expect, it } from 'vitest';
import { daysBetween, weekdayOf } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { gridInputs } from './testInputs.ts';
import type { PlanWeek, TenKV2Plan } from './types.ts';

/** Uzorak mreže; odbijeni ulazi se beleže (test ispod), ostali testovi rade nad planovima. */
const rejected: string[] = [];
const plans: TenKV2Plan[] = gridInputs()
  .filter((_, i) => i % 5 === 0)
  .flatMap(({ id, input }) => {
    const r = generateTenKV2(input);
    if (r.ok) return [r.plan];
    rejected.push(`${id}: ${r.reasons.map((x) => x.code).join(',')}`);
    return [];
  });

it('uzorak mreže se generiše bez odbijanja', () => {
  expect(rejected).toEqual([]);
  expect(plans.length).toBeGreaterThan(500);
});
const steady = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific');
const mid = (p: TenKV2Plan): number => (p.paces.E.fast + p.paces.E.slow) / 2;
const floor10 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
const RP_LADDER = [2400, 3000, 4000, 4500, 5000, 6000];
const T_CRUISE = [2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000, 6400, 8000];
const down = (ladder: number[], last: number, floor: number): number =>
  ladder.filter((m) => m <= 0.6 * last + 1e-6 && m >= floor).pop() ?? floor;

describe('D7: taper', () => {
  it('cilj 0,75 × vrh; RP i T ≈ 60 % poslednje doze (naniže, min 2 × 1000 / 2,0 km); dugi ≤ 0,75 × najduži; 4 dana', () => {
    for (const p of plans) {
      const t = p.weeks[p.weeks.length - 2]!;
      expect(t.phase).toBe('taper');
      const nominal = Math.round(7.5 * p.peakKm) / 10;
      if (t.fitted === null) expect(t.targetKm).toBe(nominal);
      else expect(t.targetKm).toBeLessThan(nominal);
      const last = p.weeks.filter(steady).pop()!;
      const lastRp = last.days.find((d) => d.role === 'q1')!.workout.dose!.doseM;
      const lastT = last.days.find((d) => d.role === 'q2')!.workout.dose!.doseM;
      const rp = t.days.find((d) => d.role === 'q1')!.workout.dose!;
      const tt = t.days.find((d) => d.role === 'q2')!.workout.dose!;
      expect(rp.zone).toBe('RP');
      expect(rp.doseM).toBe(down(RP_LADDER, lastRp, 2000));
      if (rp.doseM === 2000) expect(rp.structure).toEqual({ form: 'reps', reps: 2, repM: 1000 });
      expect(tt.zone).toBe('T');
      expect(tt.doseM).toBe(down(T_CRUISE, lastT, 2000));
      const longest = Math.max(
        ...p.weeks.slice(0, -2).map((w) => w.days.find((d) => d.role === 'long')!.workout.km)
      );
      expect(t.days.find((d) => d.role === 'long')!.workout.km).toBeLessThanOrEqual(
        floor10(0.75 * longest) + 1e-9
      );
      expect(t.days.length).toBe(4);
    }
  });
});

describe('D8: trkačka nedelja', () => {
  it('≤ 4 dana sa trkom; trka zamenjuje dugi; oštrenje ≤ RP doza tapera; dan pred trku; 35 min E; trka van obima; cilj = planirano', () => {
    const reps = [0, 0, 0, 0];
    for (const p of plans) {
      const w = p.weeks[p.weeks.length - 1]!;
      const race = p.input.raceDate;
      expect(w.phase).toBe('race');
      expect(w.days.length).toBeLessThanOrEqual(4);
      expect(w.days.some((d) => d.role === 'long')).toBe(false);
      const rd = w.days.find((d) => d.role === 'race')!;
      expect(rd.date).toBe(race);
      expect(rd.countsToWeek).toBe(false);
      expect(rd.workout.segments.map((s) => [s.kind, s.kind === 'race' ? s.km : s.sec])).toEqual([
        ['warmup', 900],
        ['race', 10],
        ['cooldown', 600]
      ]);
      // Dani: izabrani dani nedelje bez dana trke; kad bi bilo 5, otpada dan dugog → uvek 3 + trka.
      const days = w.days.filter((d) => d.role !== 'race');
      expect(days.length).toBe(3);
      if (!p.input.runDays.includes(weekdayOf(race)))
        expect(days.some((d) => d.weekday === p.pattern.long)).toBe(false);
      else
        expect(days.map((d) => d.weekday).sort()).toEqual(
          p.input.runDays.filter((x) => x !== weekdayOf(race)).sort()
        );
      const sharp = days.filter((d) => d.role === 'sharpener');
      expect(sharp.length).toBe(1);
      const latest = days
        .filter((d) => daysBetween(d.date, race) >= 3)
        .map((d) => d.date)
        .sort()
        .pop();
      expect(sharp[0]!.date).toBe(latest);
      // Oštrenje ≤ RP doza tapera: 3 × 1000 m ako je RP tapera ≥ 3,0 km, inače 2 × 1000 m (01b).
      const taperRp = p.weeks[p.weeks.length - 2]!.days.find((d) => d.role === 'q1')!.workout.dose!;
      const st = sharp[0]!.workout.dose!.structure;
      expect(st).toEqual({ form: 'reps', reps: taperRp.doseM >= 3000 ? 3 : 2, repM: 1000 });
      expect(sharp[0]!.workout.dose!.doseM).toBeLessThanOrEqual(taperRp.doseM);
      const k = st.form === 'reps' ? st.reps : 0;
      reps[k] = (reps[k] ?? 0) + 1;
      expect(
        sharp[0]!.workout.segments.filter((s) => s.kind === 'recovery').every((s) => s.sec === 90)
      ).toBe(true);
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
          expect(d.role).toBe('easy');
          expect(d.workout.segments.map((s) => [s.zone, s.sec])).toEqual([['E', 2100]]);
        }
      }
      const planned = days.reduce((a, d) => a + Math.round(d.workout.km * 100), 0) / 100;
      expect(w.plannedKm).toBe(planned);
      expect(w.targetKm).toBe(Math.round(planned * 10) / 10);
    }
    expect(reps[2]).toBeGreaterThan(0);
    expect(reps[3]).toBeGreaterThan(0);
  });
});

describe('D13: dužine', () => {
  it('dugi ≤ 33 % i ≤ 105 min sporim E, korak 0,1; dugi ≥ lagan; lagan ≥ 3 km; dugi = najduži dozvoljen', () => {
    for (const p of plans)
      for (const w of p.weeks) {
        if (w.phase === 'race') continue;
        const long = w.days.find((d) => d.role === 'long')!.workout.km;
        const cap = Math.min(floor10(0.33 * w.targetKm), floor10(6300 / p.paces.E.slow));
        expect(long, `ned ${w.index}`).toBeLessThanOrEqual(cap + 1e-9);
        expect(Math.abs(long * 10 - Math.round(long * 10))).toBeLessThan(1e-9);
        for (const d of w.days.filter((x) => x.role === 'easy')) {
          expect(d.workout.km).toBeLessThanOrEqual(long);
          expect(d.workout.km).toBeGreaterThanOrEqual(3);
          expect(Math.abs(d.workout.km * 10 - Math.round(d.workout.km * 10))).toBeLessThan(1e-9);
        }
        if (steady(w)) {
          const q100 = w.days
            .filter((d) => d.workout.kind === 'quality')
            .reduce((a, d) => a + Math.round(d.workout.km * 100), 0);
          const rest3 = Math.floor((Math.round(w.targetKm * 100) - q100 - 300) / 10) / 10;
          expect(long).toBe(Math.min(cap, rest3));
        }
      }
  });
});

/** D14 (01b): WU/CD po pojasu trenutnog obima [s]; trka ostaje 15/10 min (D8). */
const band = (km: number): [number, number] =>
  km < 35 ? [900, 600] : km < 45 ? [1200, 900] : [1500, 900];

describe('D14: WU/CD i oporavci', () => {
  it('WU/CD po pojasu obima (< 35: 15/10, 35–44,9: 20/15, ≥ 45: 25/15 min; trka 15/10); oporavci R/I/T/RP po pravilu; I deljiv sa 15 s', () => {
    const seen = new Set<string>();
    let iRecs = 0;
    for (const p of plans) {
      const m = mid(p);
      for (const w of p.weeks)
        for (const d of w.days) {
          const wo = d.workout;
          if (wo.kind !== 'quality' && wo.kind !== 'race') continue;
          const [wu, cdSec] = wo.kind === 'race' ? [900, 600] : band(p.input.currentWeeklyKm);
          seen.add(`${wu}/${cdSec}`);
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
    expect([...seen].sort()).toEqual(['1200/900', '1500/900', '900/600']);
    expect(iRecs).toBeGreaterThan(0);
  });
});

describe('D15: Uslov 8', () => {
  it('svaka nedelja ≥ 12 km (trkačka bez trke), nijedan prazan trening', () => {
    for (const p of plans)
      for (const w of p.weeks) {
        expect(w.plannedKm).toBeGreaterThanOrEqual(12);
        for (const d of w.days) {
          expect(d.workout.segments.length).toBeGreaterThan(0);
          expect(d.workout.km).toBeGreaterThan(0);
          expect(d.workout.segments.every((s) => s.km > 0 && s.sec > 0)).toBe(true);
        }
      }
  });
});
