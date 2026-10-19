import { describe, expect, it } from 'vitest';
import { generateMarathonV2 } from './generate.ts';
import { inputOf, SCHEDULES, SCHEDULES_BY_DAYS, timeForVdot, type Profile } from './testInputs.ts';
import type { MarathonV2Plan, PlanDay, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';

/* Validator samo prijavljuje (Uslov 1): plan se ne menja; svaka odluka M1–M15 ima proveru koja obara
   pokvaren plan (mutacija ispravnog plana). */

function plan(pr: Partial<Profile> = {}): MarathonV2Plan {
  const r = generateMarathonV2(
    inputOf({ weeks: 16, km: 45, vdot: 45, days: SCHEDULES.A.days, long: 'sun', ...pr })
  );
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
const BASE = plan();
const errors = (p: MarathonV2Plan): string[] =>
  [
    ...new Set(
      validatePlan(p)
        .filter((v) => v.severity === 'error')
        .map((v) => v.rule)
    )
  ].sort();
const warnings = (p: MarathonV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'warning')
    .map((v) => v.rule);
const mutate = (fn: (p: MarathonV2Plan) => void, from: MarathonV2Plan = BASE): string[] => {
  const p = structuredClone(from);
  fn(p);
  return errors(p);
};
const steady = (p: MarathonV2Plan): PlanWeek[] =>
  p.weeks.filter((w) => !w.deload && ['base', 'development', 'specific'].includes(w.phase));
const dayOf = (w: PlanWeek, role: string): PlanDay => w.days.find((d) => d.role === role)!;
const N = BASE.weeks.length;

describe('validator samo prijavljuje', () => {
  it('ispravan plan: 0 grešaka; validator ne menja plan', () => {
    const before = JSON.stringify(BASE);
    expect(errors(BASE)).toEqual([]);
    expect(JSON.stringify(BASE)).toBe(before);
  });
});

describe('svaka odluka ima proveru (mutacija → greška)', () => {
  const cases: [string, string, (p: MarathonV2Plan) => void][] = [
    ['Uslov 6', 'POLICY_STAMP', (p) => (p.policyVersion = 'marathon-v2.9.9')],
    ['M2', 'PACES', (p) => (p.paces.MP += 1)],
    [
      'M3',
      'GOAL',
      (p) =>
        (p.goal = {
          goalTimeSec: 1,
          goalVdot: 1,
          vdotGap: 0,
          weeks: 1,
          status: 'realistic',
          message: ''
        })
    ],
    ['M4', 'PHASES', (p) => (p.weeks[N - 3]!.phase = 'specific')],
    ['M4/M7', 'TAPER_WEEKS', (p) => (p.weeks[N - 3]!.phase = 'specific')],
    ['M5 gde', 'DELOAD_PLACEMENT', (p) => (p.weeks[1]!.deload = true)],
    ['M5 niz', 'DELOAD_RUN', (p) => (p.weeks.find((w) => w.deload)!.deload = false)],
    ['M9 uloge', 'ROLES', (p) => (dayOf(p.weeks[0]!, 'easy').role = 'q2')],
    [
      'M9 susedni',
      'HARD_ADJACENT',
      (p) => {
        const d = dayOf(p.weeks[0]!, 'easy');
        [d.role, d.hard] = ['q2', true];
      }
    ],
    [
      'Uslov 8 prazan',
      'EMPTY_WORKOUT',
      (p) => (dayOf(p.weeks[0]!, 'easy').workout.segments[0]!.km = 0)
    ],
    ['aritmetika', 'ARITHMETIC', (p) => (dayOf(p.weeks[0]!, 'easy').workout.km += 1)],
    [
      'M13 lagan ≥ 5 km',
      'EASY_MIN',
      (p) => {
        const w = dayOf(p.weeks[0]!, 'easy').workout;
        w.km = 4.9;
        w.segments[0]!.km = 4.9;
      }
    ],
    ['planirano = cilj', 'PLANNED_VS_TARGET', (p) => (p.weeks[0]!.targetKm += 1)],
    [
      'M15 min nedelje',
      'WEEK_MIN_VOLUME',
      (p) => {
        const w = p.weeks[0]!;
        w.days = [dayOf(w, 'easy')];
        w.plannedKm = w.days[0]!.workout.km;
        w.targetKm = w.plannedKm;
      }
    ],
    [
      'M13 udeo',
      'LONG_SHARE',
      (p) => {
        const l = dayOf(p.weeks[0]!, 'long').workout;
        l.km += 5;
        l.segments[0]!.km += 5;
      }
    ],
    [
      'M13 150 min',
      'LONG_DURATION',
      (p) => {
        const l = dayOf(p.weeks[0]!, 'long').workout;
        l.km = 30;
        l.segments[0]!.km = 30;
      }
    ],
    [
      'pouka 2 dugi ≥ lagan',
      'LONG_SHORTER_THAN_EASY',
      (p) => {
        const e = dayOf(p.weeks[0]!, 'easy').workout;
        e.km = 25;
        e.segments[0]!.km = 25;
      }
    ],
    [
      'M11 plafon MP 20 %',
      'ZONE_CAP',
      (p) => (dayOf(steady(p).at(-1)!, 'q1').workout.workKm.MP = 20)
    ],
    [
      'M10 tip po fazi',
      'PHASE_QUALITY',
      (p) => (dayOf(p.weeks[0]!, 'q1').workout.qualityType = 'MP')
    ],
    ['M14 WU', 'WARMUP', (p) => (dayOf(p.weeks[0]!, 'q1').workout.segments[0]!.sec += 60)],
    ['M14 CD', 'COOLDOWN', (p) => (dayOf(p.weeks[0]!, 'q1').workout.segments.at(-1)!.sec += 60)],
    [
      'M14 oporavak',
      'RECOVERY',
      (p) =>
        (dayOf(p.weeks[0]!, 'q1').workout.segments.find((s) => s.kind === 'recovery')!.km += 0.1)
    ],
    [
      'M10 najmanja deonica MP',
      'REP_MIN',
      (p) => {
        const d = dayOf(steady(p).at(-1)!, 'q1').workout.dose!;
        d.structure = { form: 'reps', reps: 6, repM: 2000 };
      }
    ],
    [
      'M12 doza ne opada',
      'DOSE_DECREASE',
      (p) => {
        const d = dayOf(steady(p)[2]!, 'q2').workout.dose!;
        d.doseM = 1000;
        d.structure = { form: 'continuous', km: 1 };
      }
    ],
    [
      'M12 glavna doza',
      'MAIN_DOSE_DECREASE',
      (p) => (dayOf(steady(p)[2]!, 'q2').workout.workKm.T = 0.5)
    ],
    [
      'M12 ≤ 1 nivo',
      'DOSE_JUMP',
      (p) => {
        const d = dayOf(steady(p)[1]!, 'q2').workout.dose!;
        d.doseM = 8000;
        d.structure = { form: 'continuous', km: 8 };
      }
    ],
    [
      'M12 sledeći nivo',
      'DOSE_STALL',
      (p) => {
        const [a, b] = [
          dayOf(steady(p)[0]!, 'q2').workout.dose!,
          dayOf(steady(p)[1]!, 'q2').workout.dose!
        ];
        b.doseM = a.doseM;
        b.structure = { form: 'reps', reps: 2, repM: 1000 };
      }
    ],
    [
      'M12 nema identičnih',
      'IDENTICAL_WEEKS',
      (p) => {
        const s = steady(p);
        s[1]!.days = structuredClone(s[0]!.days).map((d, i) => ({
          ...d,
          date: s[1]!.days[i]!.date
        }));
      }
    ],
    [
      'M12 početni nivo',
      'START_LEVEL',
      (p) => {
        const d = dayOf(p.weeks[0]!, 'q1').workout.dose!;
        d.doseM = 1600;
        d.structure = { form: 'reps', reps: 8, repM: 200 };
      }
    ],
    ['M6 pravilo', 'VOLUME_RULE', (p) => (p.weeks[2]!.nominalKm += 2)],
    [
      'M6 najbliži izvodljiv',
      'VOLUME_FIT',
      (p) => {
        const w = p.weeks[2]!;
        w.targetKm -= 0.5;
      }
    ],
    ['M6 vrh', 'VOLUME_PEAK', (p) => (p.peakKm += 1)],
    [
      'M5 sadržaj',
      'DELOAD_CONTENT',
      (p) => {
        const d = dayOf(
          p.weeks.find((w) => w.deload)!,
          'q2'
        ).workout.dose!;
        d.doseM += 1000;
      }
    ],
    [
      'M5 dugi',
      'DELOAD_LONG',
      (p) => {
        const l = dayOf(
          p.weeks.find((w) => w.deload)!,
          'long'
        ).workout;
        l.km -= 0.5;
        l.segments[0]!.km -= 0.5;
      }
    ],
    [
      'M7 doza tapera',
      'TAPER_QUALITY',
      (p) => (dayOf(p.weeks[N - 2]!, 'q1').workout.dose!.doseM = 8000)
    ],
    [
      'M7 dugi tapera',
      'TAPER_LONG',
      (p) => {
        const l = dayOf(p.weeks[N - 2]!, 'long').workout;
        l.km += 8;
        l.segments[0]!.km += 8;
      }
    ],
    [
      'M7 svi dani',
      'TAPER_DAYS',
      (p) => (p.weeks[N - 2]!.days = p.weeks[N - 2]!.days.filter((d) => d.role !== 'easy'))
    ],
    ['M8 trka', 'RACE_DAY', (p) => (dayOf(p.weeks[N - 1]!, 'race').countsToWeek = true)],
    [
      'M8 dani',
      'RACE_WEEK',
      (p) => (p.weeks[N - 1]!.days = p.weeks[N - 1]!.days.filter((d) => d.role !== 'easy'))
    ],
    ['M8 oštrenje', 'RACE_SHARPENER', (p) => (dayOf(p.weeks[N - 1]!, 'sharpener').role = 'easy')],
    [
      'M8 dan pred trku',
      'RACE_EVE',
      (p) => (dayOf(p.weeks[N - 1]!, 'eve').workout.segments[0]!.sec = 1500)
    ],
    ['M8 lagan ≤ N−1', 'RACE_WEEK_EASY', (p) => (dayOf(p.weeks[N - 1]!, 'easy').workout.km = 9)],
    ['M8 trkačka ≤ taper', 'RACE_WEEK_OVER_TAPER', (p) => (p.weeks[N - 1]!.plannedKm = 99)],
    [
      'M13a napomena ned 1',
      'RECENT_LONG',
      (p) => (p.weeks[0]!.notes = p.weeks[0]!.notes.filter((n) => !n.includes('(M13a)')))
    ],
    [
      'M10a piramida u opsegu zone',
      'REP_MIN',
      (p) => {
        const d = dayOf(
          steady(p).find((w) => w.phase === 'development')!,
          'q1'
        ).workout.dose!;
        d.structure = { form: 'pyramid', repsM: [600, 1000, 1400] };
      }
    ]
  ];
  for (const [decision, rule, fn] of cases)
    it(`${decision}: ${rule}`, () => expect(mutate(fn)).toContain(rule));
});

describe('3/5/6 dana (M15) i M13a: mutacija → greška', () => {
  const at = (n: 3 | 5 | 6, over: Partial<Profile> = {}) =>
    plan({
      days: SCHEDULES_BY_DAYS[n].A.days,
      long: SCHEDULES_BY_DAYS[n].A.long,
      km: n === 6 ? 70 : 45,
      ...over
    });
  const D3 = at(3);
  const D5 = at(5);
  const D6 = at(6);

  it('ispravni planovi 3/5/6 dana: 0 grešaka; 3 dana jedan kvalitet bez I/R, 5/6 dana lagani jednaki', () => {
    for (const p of [D3, D5, D6]) expect(errors(p)).toEqual([]);
    for (const w of steady(D3))
      expect(w.days.filter((d) => d.workout.kind === 'quality').map((d) => d.role)).toEqual(['q1']);
    expect(
      D3.weeks.some((w) => w.days.some((d) => d.workout.workKm.I + d.workout.workKm.R > 0))
    ).toBe(false);
    expect(D3.pattern.q2).toBeNull();
  });

  it('3 dana: I/R u izgradnji → PHASE_QUALITY; drugi kvalitet → ROLES; doza tapera ≠ MP M7 → TAPER_QUALITY', () => {
    const dev = steady(D3).find((w) => w.phase === 'development')!.index;
    expect(mutate((p) => (dayOf(p.weeks[dev - 1]!, 'q1').workout.qualityType = 'I'), D3)).toContain(
      'PHASE_QUALITY'
    );
    expect(
      mutate((p) => {
        const e = dayOf(p.weeks[0]!, 'easy');
        e.role = 'q2';
        e.hard = true;
      }, D3)
    ).toContain('ROLES');
    expect(mutate((p) => (dayOf(p.weeks.at(-3)!, 'q1').workout.dose!.doseM = 4000), D3)).toContain(
      'TAPER_QUALITY'
    );
  });

  it('3 dana: rasterećenje na danu Q1 (T); udeo dugog 50 %', () => {
    const dl = D3.weeks.find((w) => w.deload)!;
    expect(dayOf(dl, 'q1').workout.dose!.zone).toBe('T');
    expect(mutate((p) => (dayOf(p.weeks[dl.index - 1]!, 'q1').role = 'q2'), D3)).toContain(
      'PHASE_QUALITY'
    );
    expect(
      mutate((p) => {
        const l = dayOf(p.weeks[0]!, 'long').workout;
        l.km += 3;
        l.segments[0]!.km += 3;
      }, D3)
    ).toContain('LONG_SHARE');
  });

  it('5/6 dana: nejednaki lagani → EASY_UNEQUAL', () => {
    for (const p of [D5, D6])
      expect(
        mutate((q) => {
          const e = q.weeks[0]!.days.filter((d) => d.role === 'easy');
          e[0]!.workout.km += 0.3;
          e[0]!.workout.segments[0]!.km += 0.3;
          e[1]!.workout.km -= 0.3;
          e[1]!.workout.segments[0]!.km -= 0.3;
        }, p)
      ).toContain('EASY_UNEQUAL');
  });

  it('M13a: dugi iznad plafona skoka → LONG_JUMP; ned 1 ispod obima bez dugog na plafonu → VOLUME_START', () => {
    const p = plan({ recentLongRunKm: 12 });
    expect(errors(p)).toEqual([]);
    expect(Math.round(dayOf(p.weeks[0]!, 'long').workout.km * 10)).toBe(132);
    expect(
      mutate((q) => {
        const l = dayOf(q.weeks[0]!, 'long').workout;
        l.km += 0.5;
        l.segments[0]!.km += 0.5;
      }, p)
    ).toContain('LONG_JUMP');
    expect(
      mutate((q) => {
        const l = dayOf(q.weeks[2]!, 'long').workout;
        l.km += 1.5;
        l.segments[0]!.km += 1.5;
      })
    ).toContain('LONG_JUMP');
    expect(
      mutate(
        (q) => (q.weeks[1]!.notes = q.weeks[1]!.notes.filter((n) => !n.includes('plafon skoka'))),
        p
      )
    ).toContain('LONG_JUMP');
    expect(mutate((q) => (q.input.recentLongRunKm = 20), p)).toContain('VOLUME_START');
  });
});

describe('upozorenja (plan ostaje ispravan)', () => {
  it('MARATHON_LONG_SHORT, RESULT_5K, GOAL_UNREALISTIC', () => {
    expect(warnings(BASE)).toContain('MARATHON_LONG_SHORT');
    const five = plan({
      result: { distanceM: 5000, timeSec: timeForVdot(45, 5000) },
      goalTimeSec: 2 * 3600
    });
    expect(warnings(five)).toEqual(expect.arrayContaining(['RESULT_5K', 'GOAL_UNREALISTIC']));
    expect(errors(five)).toEqual([]);
  });

  it('CAPACITY_LIMITED i DOSE_DROPPED (M11 ispred M12, samo u nedelji ograničenoj kapacitetom)', () => {
    const r = generateMarathonV2(inputOf({ weeks: 24, km: 65, vdot: 30, days: SCHEDULES.A.days }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = warnings(r.plan);
    expect(w).toContain('CAPACITY_LIMITED');
    expect(mutate((p) => (p.notes = []), r.plan)).toContain('CAPACITY_NOTE');
    const drops = r.plan.warnings.filter((x) => x.rule === 'DOSE_DROPPED').map((x) => x.week);
    for (const wk of drops) expect(r.plan.weeks[wk! - 1]!.fitted).toBe('down');
  });

  it('M7a: 12 ned / 35 km — MP N−1 6,0 km iznad plafona 20 % (5,96 km): TAPER_MP_OVER_CAP, MP u N−1 i oštrenje 2 × 2000 m', () => {
    const p = plan({ weeks: 12, km: 35, vdot: 45 });
    const t1 = p.weeks.at(-2)!;
    expect(t1.targetKm).toBe(29.8);
    expect(t1.days.find((d) => d.role === 'q1')!.workout.dose!.doseM).toBe(6000);
    expect(warnings(p)).toContain('TAPER_MP_OVER_CAP');
    expect(errors(p)).toEqual([]);
    const s = p.weeks.at(-1)!.days.find((d) => d.role === 'sharpener')!;
    expect(s.workout.dose!.structure).toEqual({ form: 'reps', reps: 2, repM: 2000 });
    expect(mutate((q) => (q.weeks.at(-2)!.notes = []), p)).toContain('TAPER_QUALITY');
    // MP izgradnje i dalje pod plafonom 20 %.
    expect(mutate((q) => (dayOf(steady(q).at(-1)!, 'q1').workout.workKm.MP = 20), p)).toContain(
      'ZONE_CAP'
    );
  });

  it('MARATHON_LONG_SHORT: tekst navodi najduži dugi i ograničenje (150 min ili 40 % nedelje)', () => {
    const slow = plan({ weeks: 16, km: 55, vdot: 30 });
    const m1 = slow.warnings.find((w) => w.rule === 'MARATHON_LONG_SHORT')!.message;
    expect(m1).toMatch(
      /^Najduži dugi trk u planu je \d+,\d km; za maraton se preporučuje bar 26 km/
    );
    expect(m1).toMatch(/150 min laganim tempom/);
    const fast = plan({ weeks: 16, km: 35, vdot: 70 });
    const m2 = fast.warnings.find((w) => w.rule === 'MARATHON_LONG_SHORT')!.message;
    expect(m2).toMatch(
      /40 % nedelje sa 4 dana\): veći nedeljni obim \(više dana trčanja nose veći obim\)/
    );
    const six = plan({ weeks: 16, km: 50, vdot: 70, days: SCHEDULES_BY_DAYS[6].A.days });
    const m3 = six.warnings.find((w) => w.rule === 'MARATHON_LONG_SHORT')?.message ?? '';
    expect(m3).not.toMatch(/više dana/);
  });

  it('LONG_SHORTER_THAN_QUALITY (pouka 14): kvalitetni dan duži od dugog po trajanju', () => {
    const p = structuredClone(BASE);
    dayOf(p.weeks[0]!, 'q1').workout.sec = 99999;
    expect(warnings(p)).toContain('LONG_SHORTER_THAN_QUALITY');
  });
});
