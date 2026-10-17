/* Validator SAMO prijavljuje: ne menja plan, a svaku pokvarenu odluku hvata kao grešku. */

import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { inputOf, SCHEDULES } from './testInputs.ts';
import type { PlanWeek, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const fresh = (): TenKV2Plan => {
  const r = generateTenKV2(
    inputOf({ weeks: 14, km: 40, vdot: 50, days: SCHEDULES.A.days, goalTimeSec: 41 * 60 })
  );
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const errors = (p: TenKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const week = (p: TenKV2Plan, pred: (w: PlanWeek) => boolean): PlanWeek => p.weeks.find(pred)!;
const steady = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific');

describe('validator', () => {
  it('ispravan plan: 0 grešaka; plan se ne menja', () => {
    const p = fresh();
    const before = JSON.stringify(p);
    expect(errors(p)).toEqual([]);
    expect(JSON.stringify(p)).toBe(before);
  });

  const cases: [string, string, (p: TenKV2Plan) => void][] = [
    [
      'D4/Uslov 6 nedelja bez faze',
      'NO_PHASE',
      (p) => ((p.weeks[3] as { phase: string }).phase = '')
    ],
    ['D4 pogrešna faza', 'PHASES', (p) => (p.weeks[0]!.phase = 'development')],
    ['D5 rasterećenje u ned 2', 'DELOAD_PLACEMENT', (p) => (p.weeks[1]!.deload = true)],
    [
      'D5 rasterećenje na prvoj nedelji faze',
      'DELOAD_PLACEMENT',
      (p) => (week(p, (w) => w.phase === 'specific').deload = true)
    ],
    [
      'D12 spuštanje doze bez razloga',
      'DOSE_DROP',
      (p) => {
        const w = p.weeks.filter(steady)[3]!;
        w.days.find((d) => d.role === 'q2')!.workout.dose!.step = 'drop';
      }
    ],
    [
      'D5 > 3 uzastopne izgradnje',
      'DELOAD_RUN',
      (p) => {
        for (const w of p.weeks) w.deload = false;
      }
    ],
    ['D6 cilj promenjen bez oznake', 'VOLUME_RULE', (p) => (p.weeks[2]!.targetKm += 1)],
    ['planirano ≠ cilj', 'PLANNED_VS_TARGET', (p) => (p.weeks[2]!.plannedKm += 0.5)],
    [
      'D7 taper bez smanjenja doze',
      'TAPER_QUALITY',
      (p) => {
        const t = week(p, (w) => w.phase === 'taper');
        const last = p.weeks.filter(steady).pop()!;
        t.days.find((d) => d.role === 'q1')!.workout = last.days.find(
          (d) => d.role === 'q1'
        )!.workout;
      }
    ],
    [
      'D8 oštrenje 2 dana pre trke',
      'RACE_SHARPENER',
      (p) => {
        const r = p.weeks[p.weeks.length - 1]!;
        const s = r.days.find((d) => d.role === 'sharpener')!;
        const e = r.days.find(
          (d) => d.role !== 'sharpener' && d.role !== 'race' && d.date > s.date
        )!;
        [s.role, e.role] = [e.role, s.role];
        [s.workout, e.workout] = [e.workout, s.workout];
        [s.hard, e.hard] = [e.hard, s.hard];
      }
    ],
    [
      'D8 trka u obimu',
      'RACE_DAY',
      (p) => (p.weeks[p.weeks.length - 1]!.days.find((d) => d.role === 'race')!.countsToWeek = true)
    ],
    [
      'D9 susedni zahtevni dani',
      'HARD_ADJACENT',
      (p) => {
        const w = p.weeks[2]!;
        const e = w.days.find((d) => d.role === 'easy')!;
        e.hard = true;
        e.role = 'q1';
      }
    ],
    [
      'D11 doza iznad plafona',
      'ZONE_CAP',
      (p) => (p.weeks[0]!.days.find((d) => d.role === 'q2')!.workout.workKm.T = 5)
    ],
    [
      'D12 doza pada',
      'DOSE_DECREASE',
      (p) => {
        const s = p.weeks.filter(steady);
        const w = s[2]!;
        w.days.find((d) => d.role === 'q2')!.workout = s[0]!.days.find(
          (d) => d.role === 'q2'
        )!.workout;
      }
    ],
    [
      'D12 identične uzastopne nedelje',
      'IDENTICAL_WEEKS',
      (p) => {
        const s = p.weeks.filter(steady);
        for (const r of ['q1', 'q2'] as const)
          s[1]!.days.find((d) => d.role === r)!.workout = s[0]!.days.find(
            (d) => d.role === r
          )!.workout;
      }
    ],
    [
      'D13 dugi < lagan',
      'LONG_SHORTER_THAN_EASY',
      (p) => {
        const w = p.weeks[0]!;
        w.days.find((d) => d.role === 'easy')!.workout.km = 30;
      }
    ],
    [
      'D13 dugi > 33 %',
      'LONG_SHARE',
      (p) => (p.weeks[0]!.days.find((d) => d.role === 'long')!.workout.km = 20)
    ],
    [
      'D14 zagrevanje skraćeno',
      'WARMUP',
      (p) => {
        const s = p.weeks[0]!.days.find((d) => d.role === 'q1')!.workout.segments[0]!;
        (s as { sec: number }).sec = 600;
      }
    ],
    [
      'D14 oporavak pogrešan',
      'RECOVERY',
      (p) => {
        const w = p.weeks[0]!.days.find((d) => d.role === 'q1')!.workout;
        const r = w.segments.find((x) => x.kind === 'recovery')!;
        (r as { km: number }).km = 0.1;
      }
    ],
    [
      'Uslov 8 nedelja < 12 km',
      'WEEK_MIN_VOLUME',
      (p) => {
        p.weeks[0]!.plannedKm = 10;
      }
    ],
    [
      'Uslov 8 prazan trening',
      'EMPTY_WORKOUT',
      (p) =>
        ((
          p.weeks[0]!.days.find((d) => d.role === 'easy')!.workout as unknown as {
            segments: unknown[];
          }
        ).segments = [])
    ],
    [
      'Uslov 8 lagan < 3 km',
      'EASY_MIN',
      (p) => (p.weeks[0]!.days.find((d) => d.role === 'easy')!.workout.km = 2)
    ],
    ['Uslov 6 oznaka politike', 'POLICY_STAMP', (p) => (p.policyVersion = '10k-v1')],
    [
      'D3 ocena cilja',
      'GOAL',
      (p) => (p.goal!.status = p.goal!.status === 'realistic' ? 'unrealistic' : 'realistic')
    ]
  ];

  for (const [name, rule, mutate] of cases)
    it(`hvata: ${name} → ${rule}`, () => {
      const p = fresh();
      mutate(p);
      expect(errors(p)).toContain(rule);
    });

  it('odstupanje D11 ispred D12 (van mreže): doza se spušta samo kad nijedan cilj nije izvodljiv', () => {
    // 14 ned, 30 km, VDOT 31: T 4,0 km staje u plafon samo od 40 km, a kapacitet specifične nedelje je
    // ispod 40 km (dugi na 105 min, RP lakši od I) → bez spuštanja nijedan cilj nije izvodljiv.
    const r = generateTenKV2(inputOf({ weeks: 14, km: 30, vdot: 31, days: SCHEDULES.A.days }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const dropped = r.plan.weeks.filter((w) => w.days.some((d) => d.workout.dose?.step === 'drop'));
    expect(dropped.length).toBeGreaterThan(0);
    for (const w of dropped) expect(w.notes.some((n) => n.includes('spušten sa'))).toBe(true);
    expect(r.plan.warnings.some((w) => w.rule === 'DOSE_DROPPED')).toBe(true);
    expect(errors(r.plan)).toEqual([]);
  });

  it('upozorenja: nerealan cilj, spuštena nedelja, kapacitet (ne greške)', () => {
    const r = generateTenKV2(
      inputOf({ weeks: 18, km: 55, vdot: 30, days: SCHEDULES.A.days, goalTimeSec: 50 * 60 })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rules = r.plan.warnings.map((w) => w.rule);
    expect(rules).toContain('GOAL_UNREALISTIC');
    expect(rules).toContain('WEEK_FITTED');
    expect(rules).toContain('CAPACITY_LIMITED');
    expect(r.plan.warnings.every((w) => w.severity === 'warning')).toBe(true);
  });
});
