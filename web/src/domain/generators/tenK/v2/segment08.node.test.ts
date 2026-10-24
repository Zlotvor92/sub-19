/* Segment 10K-08 (10k-v2.10.0, krug T): trenerska pravila T1, T3 i T6 (C3, C4, C6, C11) — ulazi iz nalaza
   (docs/generators-v2/audit: coach-5k-10k, consistency). Svaki test pada na b9c4728 (pre 10K-08) i prolazi posle. */

import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { adaptTenKV2 } from './adapt.ts';
import { generateTenKV2 } from './generate.ts';
import { midEasy } from './paces.ts';
import { factsOf, inputOf, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { PlanWeek, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const planOf = (
  days: 3 | 4 | 5 | 6,
  o: { weeks: number; km: number; vdot: number },
  s: 'A' | 'B' | 'C' = 'A',
  race: 'sat' | 'sun' = 'sun'
): TenKV2Plan => {
  const sc = SCHEDULES_BY_DAYS[days][s];
  const r = generateTenKV2(inputOf({ ...o, days: sc.days, long: sc.long, race }));
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const steady = (w: PlanWeek): boolean =>
  ['base', 'development', 'specific'].includes(w.phase) && !w.deload;
const rules = (p: TenKV2Plan): string[] => validatePlan(p).map((v) => `${v.severity}:${v.rule}`);
const errors = (p: TenKV2Plan) => validatePlan(p).filter((v) => v.severity === 'error');

describe('T1: lagan prema dugom u nedeljama izgradnje', () => {
  // Nalaz M1/M5 (coach-5k-10k): d4-14w-50km-v45-A-sun — subota lagan 17,1 km = nedelja dugi 17,1 km.
  const p = planOf(4, { weeks: 14, km: 50, vdot: 45 });

  it('d4-14w-50km-v45: svaki lagan ≤ 0,8 × dugi i ≥ max(3 km, 20 min); plan bez grešaka', () => {
    const bad: string[] = [];
    for (const w of p.weeks.filter(steady)) {
      const long = w.days.find((d) => d.role === 'long')!.workout;
      for (const d of w.days.filter((x) => x.role === 'easy'))
        if (
          d.workout.km > Math.floor(8 * long.km + 1e-9) / 10 + 1e-9 ||
          d.workout.sec < 1200 ||
          d.workout.km < 3
        )
          bad.push(`ned ${w.index}: lagan ${d.workout.km} / dugi ${long.km}`);
    }
    expect(bad).toEqual([]);
    expect(errors(p)).toEqual([]);
  });

  it('validator: lagan > 0,8 × dugi → EASY_VS_LONG (ista funkcija kao konstruktor)', () => {
    const i = p.weeks.findIndex(steady);
    const w = p.weeks[i]!;
    const long = w.days.find((d) => d.role === 'long')!;
    const bad: TenKV2Plan = {
      ...p,
      weeks: p.weeks.map((x, k) =>
        k !== i
          ? x
          : {
              ...x,
              days: x.days.map((d) =>
                d.role === 'easy'
                  ? {
                      ...d,
                      workout: {
                        ...d.workout,
                        km: long.workout.km,
                        segments: d.workout.segments.map((s) => ({ ...s, km: long.workout.km }))
                      }
                    }
                  : d
              )
            }
      )
    };
    expect(rules(bad)).toContain('error:EASY_VS_LONG');
  });

  it('d4-10w-25km-v70: ni jedan lagan od 20 min ne staje — lagani dani odmor, dugi po D13, planirano < cilj uz upozorenje', () => {
    const q = planOf(4, { weeks: 10, km: 25, vdot: 70 }, 'A', 'sat');
    const w = q.weeks[0]!;
    expect(w.days.map((d) => d.role).sort()).toEqual(['long', 'q1', 'q2']);
    expect(w.targetKm).toBe(25);
    expect(w.plannedKm).toBeLessThan(25);
    expect(w.days.find((d) => d.role === 'long')!.workout.km).toBe(8.2);
    expect(q.warnings.map((v) => v.rule)).toContain('EASY_REST_BELOW_TARGET');
    expect(errors(q)).toEqual([]);
  });

  it('najkraći lagan = 20 min laganim tempom (brz trkač: > 3 km)', () => {
    const q = planOf(4, { weeks: 12, km: 45, vdot: 70 });
    const minKm = Math.ceil((1200 / midEasy(q.paces)) * 10 - 1e-9) / 10;
    expect(minKm).toBeGreaterThan(3);
    for (const w of q.weeks.filter(steady))
      for (const d of w.days.filter((x) => x.role === 'easy'))
        expect(d.workout.km, `ned ${w.index}`).toBeGreaterThanOrEqual(minKm);
  });
});

describe('T3: posle novog starta (pauza ≥ 35 dana)', () => {
  // t3.ts: d3-8w-40km-v30-B-sat, pauza 35 do kraja ned 3 (2026-11-21) — na b9c4728 taper bez kvaliteta (RP 2 × 1000 m
  // iznad plafona 10 %), trkačka bez oštrenja.
  const p = planOf(3, { weeks: 8, km: 40, vdot: 30 }, 'B', 'sat');
  const asOf = p.weeks[2]!.endDate;
  const r = adaptTenKV2(p, factsOf(p, 'pause35', asOf), asOf);

  it('taper zadržava jedan kvalitet (RP ≈ 60 % poslednje doze, najmanje 2 × 1000 m); trkačka kratko oštrenje', () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.adaptation!.steps.some((s) => s.restart)).toBe(true);
    const taper = r.plan.weeks.find((w) => w.phase === 'taper')!;
    const q = taper.days.filter((d) => d.workout.kind === 'quality');
    expect(q.map((d) => d.workout.dose?.zone)).toEqual(['RP']);
    expect(q[0]!.workout.dose!.doseM).toBeGreaterThanOrEqual(2000);
    const race = r.plan.weeks[r.plan.weeks.length - 1]!;
    expect(race.days.some((d) => d.role === 'sharpener')).toBe(true);
    expect(errors(r.plan)).toEqual([]);
  });
});

describe('T6', () => {
  it('C3: plan po osećaju, višak (over120) dan pre testa — test ostaje (na b9c4728 otpada)', () => {
    // c3.ts: f-d3-8w-20km-e270-A-sat/over120@2026-11-11 (178 tokova na b9c4728 → 0).
    const sc = SCHEDULES_BY_DAYS[3].A;
    const start = addDays('2026-11-02', -1);
    const g = generateTenKV2({
      startDate: start,
      raceDate: addDays(start, 8 * 7 - 1),
      runDays: sc.days,
      longRunDay: sc.long,
      currentWeeklyKm: 20,
      easyPaceSecPerKm: 270
    });
    if (!g.ok) throw new Error(JSON.stringify(g.reasons));
    const td = g.plan.weeks.flatMap((w) => w.days).find((d) => d.role === 'test')!;
    const asOf = addDays(td.date, -1);
    const r = adaptTenKV2(g.plan, factsOf(g.plan, 'over120', asOf), asOf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.weeks.flatMap((w) => w.days).filter((d) => d.role === 'test')).toHaveLength(1);
    expect(errors(r.plan)).toEqual([]);
  });

  it('C4: urađen dan posle asOf (dayId budućeg dugog, km ≠ plan) u zbiru zaštićenih = planirani km', () => {
    const p = planOf(4, { weeks: 14, km: 40, vdot: 45 });
    const w3 = p.weeks[2]!;
    const long = w3.days.find((d) => d.role === 'long')!;
    const asOf = w3.days.find((d) => d.weekday === 'tue')!.date;
    const r = adaptTenKV2(
      p,
      {
        workouts: [
          {
            date: asOf,
            dayId: long.date,
            km: long.workout.km + 5,
            durationSec: 7000,
            completed: true
          }
        ]
      },
      asOf
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = r.plan.weeks[2]!;
    // Dugi urađen unapred ne „jede" cilj sa upisanim km: nedelja ostaje na cilju (b9c4728: zbir sa long + 5 km,
    // preostali dani skraćeni — planirano 39,86 < cilj 44,9).
    expect(Math.abs(w.plannedKm - w.targetKm)).toBeLessThanOrEqual(0.1 + 1e-9);
    if (w.keptKm !== undefined)
      expect(w.keptKm).toBeLessThanOrEqual(
        w.days
          .filter((d) => d.date <= asOf || d.date === long.date)
          .reduce((a, d) => a + d.workout.km, 0) + 1e-9
      );
  });

  it('C6: bol 5 u ned 6 (14 ned, 40 km) — doza posle sidra kreće iznova od r + 1 (ned 9 T 2 × 1000, b9c4728: 3 × 1200)', () => {
    const p = planOf(4, { weeks: 14, km: 40, vdot: 45 });
    const asOf = p.weeks[5]!.days.find((d) => d.role === 'q1')!.date;
    const r = adaptTenKV2(p, factsOf(p, 'pain5', asOf), asOf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t9 = r.plan.weeks[8]!.days.find((d) => d.workout.dose?.zone === 'T')!.workout.dose!;
    expect(t9.doseM).toBe(2000);
    expect(errors(r.plan)).toEqual([]);
  });

  it('C11: pouka 35 i u taperu — 10w-25km-v70-A-sat ned 9: samo RP, drugi dan lagan (b9c4728: RP + T, T duži od dugog)', () => {
    const p = planOf(4, { weeks: 10, km: 25, vdot: 70 }, 'A', 'sat');
    const taper = p.weeks[8]!;
    expect(taper.phase).toBe('taper');
    expect(taper.days.filter((d) => d.workout.kind === 'quality')).toHaveLength(1);
    expect(taper.notes.some((n) => n.includes('Drugi dan kvaliteta'))).toBe(true);
    expect(p.warnings.map((v) => v.rule)).toContain('TAPER_RP_ONLY');
    expect(errors(p)).toEqual([]);
  });
});
