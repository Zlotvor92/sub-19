/* Pouka 32 (HM-04 korak A, hm-v2.2.1): dugi ostaje najduži trening nedelje — plafon zone je jedna funkcija sa dva
   člana (H11 udeo i trajanje dana ≤ trajanje dugog iste nedelje); najniži nivo zone je izuzet (upozorenje po
   pouci 14); nedelja testa: dugi naviše u granicama gde je izvodljivo. Ulazi iz merenja pre izmene
   (docs/hm-v2/artifacts/segment-03b/measure-32.ts): svaki je na 5e09a02 imao dan iznad najnižeg nivoa duži od
   dugog. */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { deloadLengths, rollingLongCap10 } from './lengths.ts';
import { pacesFromVdot } from './paces.ts';
import { HM_V2_POLICY as P, planRule } from './policy.ts';
import { inputOf, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { Dose, HmV2Plan, PlanDay, PlanWeek } from './types.ts';
import { buildDayLimit } from './week.ts';
import { doseOf, ladderLevels, qualityDaySec, warmupCooldown } from './workouts.ts';

const plan = (x: Record<string, unknown>): HmV2Plan => {
  const r = generateHmV2(x);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const beginner = (p: HmV2Plan): boolean => p.input.experience === 'beginner';

/** Najniži nivo zone za dan (nezavisno od konstruktora): izgradnja — prvi nivo lestvice doze; rasterećenje i
    taper — T 2,0 km (početnik 1,5), RP 2 × 2000 m. */
function lowest(p: HmV2Plan, w: PlanWeek, d: PlanDay): boolean {
  const dose = d.workout.dose!;
  const b = beginner(p);
  if (w.deload || w.phase === 'taper')
    return dose.zone === 'RP'
      ? dose.doseM <= P.taper.rpMin.reps * P.taper.rpMin.repM
      : dose.doseM <= (b ? P.beginner.tFirstKm : P.deload.tMinKm) * 1000;
  return dose.doseM <= doseOf(ladderLevels(dose.ladder as never, b)[0]!);
}

/** Dani kvaliteta iznad najnižeg nivoa zone duži od dugog (trajanje sporim krajem tempa zone). */
function overLong(p: HmV2Plan): string[] {
  const wc = (d: PlanDay) => ({
    warmupSec: d.workout.segments[0]!.sec,
    cooldownSec: d.workout.segments[d.workout.segments.length - 1]!.sec
  });
  const out: string[] = [];
  for (const w of p.weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (!long) continue;
    for (const d of w.days)
      if (
        d.workout.kind === 'quality' &&
        !lowest(p, w, d) &&
        qualityDaySec(d.workout.dose!, p.paces, wc(d)) > long.workout.sec
      )
        out.push(`ned ${w.index} ${d.workout.title} > dugi ${long.workout.km} km`);
  }
  return out;
}

const d = SCHEDULES_BY_DAYS;
const CASES: [string, Record<string, unknown>][] = [
  [
    '6 d 40 km VDOT 70 (izgradnja T, I, RP)',
    inputOf({ weeks: 10, km: 40, vdot: 70, days: d[6].A.days, long: d[6].A.long, race: 'sat' })
  ],
  [
    '6 d 40 km VDOT 60 (rasterećenje T)',
    inputOf({ weeks: 10, km: 40, vdot: 60, days: d[6].A.days, long: d[6].A.long, race: 'sat' })
  ],
  [
    '4 d 60 km VDOT 70 (taper RP 2 × 3000)',
    inputOf({ weeks: 16, km: 60, vdot: 70, days: d[4].A.days, long: d[4].A.long, race: 'sat' })
  ],
  [
    '4 d 40 km VDOT 70, skorašnji najduži 5 km (pouka 28)',
    inputOf({ weeks: 10, km: 40, vdot: 70, days: d[4].A.days, recentLongRunKm: 5 })
  ],
  [
    '4 d 30,2 km VDOT 79 (Q2 najniže doze druge strukture skraćuje dugi: Q1 R 6 × 200)',
    inputOf({ weeks: 10, km: 30.2, vdot: 79, days: d[4].A.days, long: d[4].A.long })
  ],
  [
    'po osećaju 6 d 40 km 4:30 (RP 2 × 4000)',
    inputOf({ weeks: 13, km: 40, days: d[6].A.days, long: d[6].A.long, easyPaceSecPerKm: 270 })
  ]
];

describe('pouka 32: kvalitetni dan ≤ dugi (osim najnižeg nivoa zone)', () => {
  for (const [name, x] of CASES)
    it(name, () => {
      expect(overLong(plan(x))).toEqual([]);
    });

  it('pad doze zbog trajanja: napomena i upozorenje DOSE_DROPPED, plan prihvaćen', () => {
    const p = plan(
      inputOf({ weeks: 13, km: 40, vdot: 70, days: d[6].A.days, long: d[6].A.long, race: 'sat' })
    );
    const drops = p.weeks.flatMap((w) =>
      w.days.filter((x) => x.workout.dose?.step === 'drop').map(() => w)
    );
    expect(drops.length).toBeGreaterThan(0);
    for (const w of drops) {
      expect(w.notes.some((n) => n.includes('pouka 32'))).toBe(true);
      expect(p.warnings.some((v) => v.rule === 'DOSE_DROPPED' && v.week === w.index)).toBe(true);
    }
    expect(overLong(p)).toEqual([]);
  });

  it('najniži nivo zone ostaje i kad je duži od dugog — upozorenje po pouci 14', () => {
    const p = plan(CASES[3]![1]);
    const w1 = p.weeks[0]!;
    const long = w1.days.find((x) => x.role === 'long')!;
    const q = w1.days.filter((x) => x.workout.kind === 'quality');
    expect(q.some((x) => x.workout.sec > long.workout.sec)).toBe(true);
    for (const x of q) expect(lowest(p, w1, x)).toBe(true);
    expect(p.warnings.some((v) => v.rule === 'LONG_SHORTER_THAN_QUALITY')).toBe(true);
  });

  it('predikat izgradnje (buildDayLimit): Q1 uz Q2 najniže doze sa najviše km; izuzet Q2 i dalje čuva Q1', () => {
    // 4 d 30,2 km VDOT 79, ned 2 (cilj 32,0 km, 1 lagan, granica pouke 28 9,5 km): Q2 T 2,0 km najniže doze
    // ima strukturu 2 × 1000 m (džog, više km) — Q1 R 8 × 200 m bi uz nju bio duži od dugog.
    const p = plan(CASES[4]![1]);
    const w = p.weeks[1]!;
    const longs = p.weeks.map((x) => {
      const l = x.days.find((y) => y.role === 'long');
      return l ? Math.round(l.workout.km * 10) : null;
    });
    const c = { paces: p.paces, wc: warmupCooldown(30.2), rule: planRule(4, 'regular')! };
    const lim = buildDayLimit(c, 320, 1, rollingLongCap10(2, longs, null), 'T_continuous', null);
    expect(w.targetKm).toBe(32);
    expect(lim.q1('R', { form: 'reps', reps: 8, repM: 200 }, false)).toBe('over');
    const q1: Dose = {
      ladder: 'R',
      zone: 'R',
      doseM: 1600,
      structure: { form: 'reps', reps: 8, repM: 200 },
      step: 'next'
    };
    // Izuzet sopstveni dan (najniži nivo Q2) ne izuzima Q1: 2 × 1000 m skraćuje dugi ispod Q1.
    expect(lim.q2(q1)('T_continuous', { form: 'reps', reps: 2, repM: 1000 }, true)).toBe('over');
    expect(lim.q2(q1)('T_continuous', { form: 'continuous', km: 2 }, true)).toBe('fits');
  });

  it('rasterećenje sa testom: dugi naviše do trajanja testa u granicama (deloadLengths, pouka 32)', () => {
    const rule = planRule(4, 'regular')!;
    const p = pacesFromVdot(45);
    // Cilj 40 km, test 9 km, 2 lagana, poslednji dugi 14 km → 0,8 × = 11,2 km; traži se 13,0 km.
    const base = deloadLengths(400, 900, 2, 140, rule, p)!;
    expect(base.long10).toBe(112);
    const up = deloadLengths(400, 900, 2, 140, rule, p, Infinity, 130)!;
    expect(up.long10).toBe(130);
    expect(up.easy10.reduce((a, x) => a + x, 0)).toBe(400 - 90 - 130);
    // Granica udela (40 % cilja = 16,0 km): najduži mogući; lagani 2 × 7,5 km.
    expect(deloadLengths(400, 900, 2, 140, rule, p, Infinity, 250)!.long10).toBe(160);
    // Granica laganih ≥ 4 km (cilj 26 km): 26 − 9 − 2 × 4 = 9,0 km (udeo bi dao 10,4).
    expect(deloadLengths(260, 900, 2, 140, rule, p, Infinity, 250)!.long10).toBe(90);
    // Ništa se ne podiže kad dugi već traje bar koliko test.
    expect(deloadLengths(400, 900, 2, 140, rule, p, Infinity, 100)).toEqual(base);
  });

  it('dan testa duži od dugog ostaje (fiksna doza) — upozorenje po pouci 14', () => {
    const p = plan(
      inputOf({ weeks: 13, km: 25, days: d[3].A.days, long: d[3].A.long, easyPaceSecPerKm: 270 })
    );
    const w = p.weeks.find((x) => x.test)!;
    const test = w.days.find((x) => x.role === 'test')!;
    const long = w.days.find((x) => x.role === 'long')!;
    expect(test.workout.sec).toBeGreaterThan(long.workout.sec);
    expect(p.warnings.some((v) => v.rule === 'LONG_SHORTER_THAN_QUALITY')).toBe(true);
  });
});
