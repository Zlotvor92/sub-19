/* Validator SAMO prijavljuje: ne menja plan, a svaku pokvarenu odluku hvata kao grešku. */

import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { inputOf, SCHEDULES, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { PlanWeek, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { easyTimeWorkout } from './workouts.ts';

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
      'D14 WU 15 min pri obimu 40 km (pojas 35–44,9 km traži 20 min)',
      'WARMUP',
      (p) => {
        const s = p.weeks[0]!.days.find((d) => d.role === 'q1')!.workout.segments[0]!;
        (s as { sec: number }).sec = 900;
      }
    ],
    [
      'D16 početni nivo T nije ≤ 60 % plafona',
      'START_LEVEL',
      (p) => {
        const q2 = p.weeks[0]!.days.find((d) => d.role === 'q2')!;
        q2.workout = p.weeks[2]!.days.find((d) => d.role === 'q2')!.workout;
      }
    ],
    [
      'D8 oštrenje veće/manje od pravila RP doze tapera',
      'RACE_SHARPENER',
      (p) => {
        const r = p.weeks[p.weeks.length - 1]!;
        const st = r.days.find((d) => d.role === 'sharpener')!.workout.dose!.structure;
        if (st.form === 'reps') st.reps = st.reps === 2 ? 3 : 2;
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

  it('D11 ispred D12 (usvojeno, D12): doza se spušta samo kad nijedan cilj nije izvodljiv', () => {
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
    expect(r.plan.warnings.find((w) => w.rule === 'CAPACITY_LIMITED')!.message).toBe(
      '4 dana ne nose ovaj obim uz dugi ≤ 105 min; preporuka 5–6 dana.'
    );
    expect(r.plan.warnings.every((w) => w.severity === 'warning')).toBe(true);
  });

  /** Plan za broj dana (raspored A mreže 02). */
  const planOf = (
    days: 3 | 4 | 5 | 6,
    o: { weeks: number; km: number; vdot: number; race?: 'sat' | 'sun' }
  ): TenKV2Plan => {
    const sc = SCHEDULES_BY_DAYS[days].A;
    const r = generateTenKV2(inputOf({ ...o, days: sc.days, long: sc.long }));
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    return r.plan;
  };

  it('D22: baza bez platoa je ponovo tvrda — ista T doza iste strukture u bazi je greška i uz napomenu „ponovljen"', () => {
    const p = planOf(4, { weeks: 18, km: 25, vdot: 30 });
    expect(errors(p)).toEqual([]);
    const s = p.weeks.filter((w) => steady(w) && w.phase === 'base');
    const i = s.findIndex(
      (w, k) =>
        k > 0 &&
        w.days.find((d) => d.role === 'q2')!.workout.dose!.doseM ===
          s[k - 1]!.days.find((d) => d.role === 'q2')!.workout.dose!.doseM
    );
    expect(i).toBeGreaterThan(0);
    const b = s[i]!;
    b.days.find((d) => d.role === 'q2')!.workout = s[i - 1]!.days.find(
      (d) => d.role === 'q2'
    )!.workout;
    b.notes.push('Q2: T ponovljen — druga struktura iste doze ne postoji (D10).');
    expect(errors(p)).toContain('BASE_PLATEAU');
  });

  it('D19: lagani dani nejednaki (razlika > 0,1 km) → EASY_UNEQUAL', () => {
    const p = planOf(6, { weeks: 12, km: 50, vdot: 45 });
    expect(errors(p)).toEqual([]);
    const easy = p.weeks[0]!.days.filter((d) => d.role === 'easy');
    easy[0]!.workout.km += 0.3;
    easy[1]!.workout.km -= 0.3;
    expect(errors(p)).toContain('EASY_UNEQUAL');
  });

  it('D18: 3 dana — I/R ili drugi kvalitet u nedelji izgradnje → greška', () => {
    const p = planOf(3, { weeks: 12, km: 30, vdot: 45 });
    expect(errors(p)).toEqual([]);
    const four = fresh();
    const w = p.weeks[0]!;
    const q = w.days.find((d) => d.role === 'q1')!;
    q.workout = four.weeks[0]!.days.find((d) => d.role === 'q1')!.workout; // R
    expect(errors(p)).toContain('PHASE_QUALITY');
  });

  it('D20: trkačka nedelja 6 dana sa 5 dana trčanja bez trke (> min(6, 5)) → RACE_WEEK', () => {
    const p = planOf(6, { weeks: 12, km: 50, vdot: 45 });
    const rw = p.weeks[p.weeks.length - 1]!;
    const taper = p.weeks[p.weeks.length - 2]!;
    expect(rw.days.length).toBe(5);
    // Dan šablona koji je D20 izbacio (najraniji lagan) vraća se kao 35 min E.
    const dropped = taper.days.find(
      (d) => d.role === 'easy' && !rw.days.some((x) => x.weekday === d.weekday)
    )!;
    rw.days.push({
      ...rw.days.find((d) => d.role === 'easy')!,
      date: addDays(dropped.date, 7),
      weekday: dropped.weekday
    });
    rw.days.sort((a, b) => a.date.localeCompare(b.date));
    expect(errors(p)).toContain('RACE_WEEK');
  });

  it('D30a: REP_MIN po zoni — RP deonica < 800 m (5 × 500 m kao u 10k-v2.2.0) i T deonica < 1000 m su greška; RP 800–999 m nije', () => {
    const p = planOf(3, { weeks: 17, km: 20, vdot: 45 });
    expect(errors(p)).toEqual([]);
    const d = p.weeks
      .flatMap((w) => w.days)
      .find((x) => x.workout.dose?.zone === 'RP' && x.workout.dose.doseM === 2500)!;
    expect(d.workout.dose!.structure).toEqual({ form: 'reps', reps: 2, repM: 1250 });
    d.workout.dose!.structure = { form: 'reps', reps: 5, repM: 500 };
    expect(errors(p)).toContain('REP_MIN');
    // RP 3 × 800 m (D30a) u planu: bez greške; ista struktura u T zoni: REP_MIN.
    const q = planOf(4, { weeks: 16, km: 35, vdot: 35 });
    const rp = q.weeks
      .flatMap((w) => w.days)
      .find(
        (x) =>
          x.workout.dose?.zone === 'RP' &&
          x.workout.dose.structure.form === 'reps' &&
          x.workout.dose.structure.repM < 1000
      );
    expect(rp).toBeDefined();
    expect(errors(q)).toEqual([]);
    const t = q.weeks
      .flatMap((w) => w.days)
      .find((x) => x.workout.dose?.zone === 'T' && x.workout.dose.structure.form === 'reps')!;
    t.workout.dose!.structure = { form: 'reps', reps: 5, repM: 800 };
    expect(errors(q)).toContain('REP_MIN');
  });

  it('D23: lagan trkačke nedelje 35 min E kad je lagan tapera kraći → RACE_WEEK_EASY i RACE_WEEK_OVER_TAPER', () => {
    // 5 dana, 10 ned, 30 km, VDOT 70, trka subota: u 10k-v2.2.0 trkačka 31,27 km > taper (35 min E = 8,8 km).
    const p = planOf(5, { weeks: 10, km: 30, vdot: 70, race: 'sat' });
    expect(errors(p)).toEqual([]);
    const rw = p.weeks[p.weeks.length - 1]!;
    const taper = p.weeks[p.weeks.length - 2]!;
    const easy = rw.days.filter((d) => d.role === 'easy');
    expect(easy.length).toBeGreaterThan(0);
    expect(easy.every((d) => d.workout.blocks[0]!.kind === 'easy')).toBe(true);
    expect(rw.plannedKm).toBeLessThanOrEqual(taper.plannedKm);
    for (const d of easy) d.workout = easyTimeWorkout(2100, p.paces);
    rw.plannedKm =
      rw.days.reduce((a, d) => a + (d.countsToWeek ? Math.round(d.workout.km * 100) : 0), 0) / 100;
    rw.targetKm = Math.round(rw.plannedKm * 10) / 10;
    expect(errors(p)).toEqual(expect.arrayContaining(['RACE_WEEK_EASY', 'RACE_WEEK_OVER_TAPER']));
  });

  it('D25: kvalitetni dan duži od dugog po trajanju → upozorenje LONG_SHORTER_THAN_QUALITY (ne greška) sa preporukom manje dana', () => {
    const warns = (p: TenKV2Plan) =>
      p.warnings.filter((w) => w.rule === 'LONG_SHORTER_THAN_QUALITY');
    // 4 dana, 25 km, VDOT 70: WU/CD 15/10 min + rad > dugi 5,6 km; red 3 dana (20–40 km) podržava 25 km.
    const p4 = planOf(4, { weeks: 10, km: 25, vdot: 70 });
    expect(errors(p4)).toEqual([]);
    expect(warns(p4).map((w) => [w.severity, w.week, w.message])).toEqual([
      [
        'warning',
        1,
        'Kvalitetni dan duži od dugog po trajanju u 3 od 7 nedelja izgradnje (ned 1: 32 > 23 min; D25); preporuka 3 dana (red D17 sa manje dana podržava obim 25 km, dugi dobija veći udeo).'
      ]
    ]);
    // 6 dana, 35 km, VDOT 70: preporuka 3–5 dana; 3 dana nema manji red — bez preporuke (i bez upozorenja).
    const p6 = planOf(6, { weeks: 12, km: 35, vdot: 70 });
    expect(warns(p6)[0]!.message).toMatch(/; preporuka 3–5 dana \(red D17/);
    expect(warns(planOf(3, { weeks: 12, km: 20, vdot: 70 }))).toEqual([]);
    // Plan se ne menja: upozorenje nastaje samo iz validatora.
    const before = JSON.stringify(p4.weeks);
    validatePlan(p4);
    expect(JSON.stringify(p4.weeks)).toBe(before);
    // Isti plan sa dugim dužim od svakog kvaliteta → bez upozorenja.
    for (const w of p4.weeks.filter(steady)) {
      const long = w.days.find((d) => d.role === 'long')!.workout;
      (long as { sec: number }).sec = 99999;
    }
    expect(validatePlan(p4).some((v) => v.rule === 'LONG_SHORTER_THAN_QUALITY')).toBe(false);
  });

  it('D7: taper 5 dana bez jednog dana → TAPER_DAYS', () => {
    const p = planOf(5, { weeks: 12, km: 45, vdot: 50 });
    const t = p.weeks[p.weeks.length - 2]!;
    t.days = t.days.filter(
      (d, i) => !(d.role === 'easy' && i === t.days.findIndex((x) => x.role === 'easy'))
    );
    expect(errors(p)).toContain('TAPER_DAYS');
  });

  it('odstupanja (opreznije) su upozorenja, ne greške: rasterećenje/taper bez kvaliteta, taper samo RP; D30b: trkačka + trka ≥ minimum', () => {
    const p3 = planOf(3, { weeks: 8, km: 20, vdot: 30 });
    const rules = p3.warnings.map((w) => w.rule);
    expect(rules).toEqual(expect.arrayContaining(['DELOAD_NO_QUALITY', 'TAPER_NO_QUALITY']));
    // D30b: 2 × 35 min E = 8,7 km + trka 10 km ≥ 9 km (10k-v2.2.1: RACE_WEEK_SHORT).
    const rw = p3.weeks.at(-1)!;
    expect(rw.plannedKm).toBeLessThan(9);
    expect(rules).not.toContain('RACE_WEEK_SHORT');
    expect(errors(p3)).toEqual([]);
    // Planirano + trka < minimum → i dalje samo upozorenje (nedelja je zadata, D15).
    rw.plannedKm = -1.5;
    rw.targetKm = -1.5;
    const v = validatePlan(p3).filter((x) => x.rule === 'RACE_WEEK_SHORT');
    expect(v.map((x) => [x.severity, x.message])).toEqual([
      ['warning', 'Trkačka nedelja -1.5 km + trka 10 km < 9 km (Uslov 8, D17, D30).']
    ]);
    // Rasterećenje bez kvaliteta kad T 2,0 km STAJE u plafon → greška.
    const p = fresh();
    const dl = p.weeks.find((w) => w.deload)!;
    const q = dl.days.find((d) => d.workout.kind === 'quality')!;
    q.role = 'easy';
    q.hard = false;
    q.workout = dl.days.find((d) => d.role === 'easy')!.workout;
    dl.notes.push('Rasterećenje: bez kvaliteta');
    expect(errors(p)).toContain('DELOAD_CONTENT');
    const p6 = planOf(6, { weeks: 8, km: 35, vdot: 70 });
    expect(p6.warnings.map((w) => w.rule)).toContain('TAPER_RP_ONLY');
    expect(errors(p6)).toEqual([]);
  });
});
