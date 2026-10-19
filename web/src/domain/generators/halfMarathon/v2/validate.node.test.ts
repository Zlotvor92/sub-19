/* Validator SAMO prijavljuje (Uslov 1): svaka odluka konstruktora ima proveru — mutacija ispravnog plana
   obara tačno pravilo koje krši; plan se ne menja. */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import type { HmV2Plan, PlanDay, PlanWeek } from './types.ts';
import {
  grid02Inputs,
  gridInputs,
  inputOf,
  SCHEDULES,
  SCHEDULES_BY_DAYS,
  timeForVdot
} from './testInputs.ts';
import { validatePlan } from './validate.ts';
import {
  easyWorkout,
  eveWorkout,
  longWorkout,
  qualityWorkout,
  warmupCooldown
} from './workouts.ts';

const GRID = [...gridInputs(), ...grid02Inputs()];
const SIX = SCHEDULES_BY_DAYS[6].A;
const base = (id = '12w-40km-v45-A-sun'): HmV2Plan => {
  const r = generateHmV2(GRID.find((g) => g.id === id)!.input);
  if (!r.ok) throw new Error(id);
  return r.plan;
};
const clone = (p: HmV2Plan): HmV2Plan => structuredClone(p);
const errors = (p: HmV2Plan): string[] =>
  [
    ...new Set(
      validatePlan(p)
        .filter((v) => v.severity === 'error')
        .map((v) => v.rule)
    )
  ].sort();
const week = (p: HmV2Plan, i: number): PlanWeek => p.weeks[i - 1]!;
const dayOf = (w: PlanWeek, role: string): PlanDay => w.days.find((d) => d.role === role)!;
/** Lagan/dugi dan sa novom dužinom i usklađen zbir nedelje (cilj = planirano). */
const setKm = (p: HmV2Plan, w: PlanWeek, role: 'easy' | 'long', km: number): void => {
  const d = dayOf(w, role);
  d.workout = role === 'easy' ? easyWorkout(km, p.paces) : longWorkout(km, p.paces);
  const planned = w.days.reduce(
    (a, x) => a + (x.countsToWeek ? Math.round(x.workout.km * 100) : 0),
    0
  );
  w.plannedKm = planned / 100;
};
const quality = (p: HmV2Plan, ladder: string, zone: string, structure: unknown) =>
  qualityWorkout(
    {
      ladder: ladder as never,
      zone: zone as never,
      doseM:
        (structure as { reps?: number; repM?: number; km?: number }).km !== undefined
          ? Math.round((structure as { km: number }).km * 1000)
          : (structure as { reps: number }).reps * (structure as { repM: number }).repM,
      structure: structure as never,
      step: 'next'
    },
    p.paces,
    warmupCooldown(p.input.currentWeeklyKm)
  );

describe('validator', () => {
  it('ispravan plan: 0 grešaka; validator ne menja plan', () => {
    const p = base();
    const before = JSON.stringify(p);
    expect(errors(p)).toEqual([]);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('Uslov 6: oznaka politike i faza svake nedelje', () => {
    const a = clone(base());
    a.policyVersion = 'hm-v2.9.9';
    expect(errors(a)).toContain('POLICY_STAMP');
    const b = clone(base());
    week(b, 4).phase = 'base';
    expect(errors(b)).toContain('PHASES');
  });

  it('H5 (pouka 4): rasterećenje na pogrešnom mestu / uklonjeno', () => {
    const a = clone(base());
    week(a, 4).deload = true; // prva nedelja razvoja
    expect(errors(a)).toEqual(expect.arrayContaining(['DELOAD_PLACEMENT', 'DELOAD_SCHEDULE']));
    const b = clone(base());
    week(b, 5).deload = false;
    expect(errors(b)).toEqual(expect.arrayContaining(['DELOAD_RUN']));
  });

  it('H5 sadržaj rasterećenja: doza T i dugi', () => {
    const a = clone(base());
    const w5 = week(a, 5);
    dayOf(w5, 'q2').workout = quality(a, 'T_cruise', 'T', { form: 'reps', reps: 3, repM: 1000 });
    expect(errors(a)).toContain('DELOAD_CONTENT');
    const b = clone(base());
    setKm(b, week(b, 5), 'long', dayOf(week(b, 5), 'long').workout.km - 1);
    expect(errors(b)).toContain('DELOAD_LONG');
  });

  it('H9: zahtevni dani susedni; uloga van šablona', () => {
    const a = clone(base());
    a.pattern = { ...a.pattern, q2: 'sat', easy: ['thu'] };
    expect(errors(a)).toEqual(expect.arrayContaining(['HARD_ADJACENT', 'ROLES']));
  });

  it('H13 (pouka 2): dugi < lagan; dugi > 40 %; lagan < 4 km', () => {
    const a = clone(base());
    const w = week(a, 2);
    setKm(a, w, 'easy', dayOf(w, 'long').workout.km + 0.1);
    expect(errors(a)).toContain('LONG_SHORTER_THAN_EASY');
    const b = clone(base());
    week(b, 2).targetKm = 30;
    expect(errors(b)).toEqual(expect.arrayContaining(['LONG_SHARE', 'PLANNED_VS_TARGET']));
    const c = clone(base());
    setKm(c, week(c, 2), 'easy', 3.9);
    expect(errors(c)).toContain('EASY_MIN');
  });

  it('H11: jedan plafon po zoni', () => {
    const a = clone(base());
    const w = week(a, 8);
    dayOf(w, 'q1').workout = quality(a, 'RP', 'RP', { form: 'reps', reps: 3, repM: 3000 });
    expect(errors(a)).toEqual(expect.arrayContaining(['ZONE_CAP']));
  });

  it('H10/H14: deonica ispod najmanje, oporavak, WU/CD', () => {
    const a = clone(base());
    dayOf(week(a, 7), 'q1').workout = quality(a, 'RP', 'RP', { form: 'reps', reps: 4, repM: 1000 });
    expect(errors(a)).toContain('REP_MIN');
    const b = clone(base());
    const q = dayOf(week(b, 2), 'q2');
    q.workout = qualityWorkout(q.workout.dose!, b.paces, { warmupSec: 900, cooldownSec: 600 });
    expect(errors(b)).toEqual(expect.arrayContaining(['WARMUP', 'COOLDOWN']));
  });

  it('H12 (pouka 3): plato u bazi / ista doza dok sledeći nivo staje; skok > 1 nivo; početni nivo', () => {
    const a = clone(base());
    dayOf(week(a, 3), 'q2').workout = structuredClone(dayOf(week(a, 2), 'q2').workout);
    expect(errors(a)).toEqual(expect.arrayContaining(['DOSE_STALL']));
    const b = clone(base());
    dayOf(week(b, 2), 'q2').workout = quality(b, 'T_continuous', 'T', {
      form: 'continuous',
      km: 4
    });
    expect(errors(b)).toEqual(expect.arrayContaining(['DOSE_JUMP']));
    const c = clone(base());
    dayOf(week(c, 1), 'q2').workout = quality(c, 'T_continuous', 'T', {
      form: 'continuous',
      km: 2.5
    });
    expect(errors(c)).toContain('START_LEVEL');
    const d = clone(base());
    dayOf(week(d, 3), 'q2').workout = quality(d, 'T_continuous', 'T', {
      form: 'continuous',
      km: 2
    });
    expect(errors(d)).toEqual(expect.arrayContaining(['DOSE_DECREASE', 'MAIN_DOSE_DECREASE']));
  });

  it('H7 taper: doza, dugi, dani', () => {
    const a = clone(base());
    const t = a.weeks.find((w) => w.phase === 'taper')!;
    dayOf(t, 'q1').workout = quality(a, 'RP', 'RP', { form: 'reps', reps: 2, repM: 2500 });
    expect(errors(a)).toContain('TAPER_QUALITY');
    const b = clone(base());
    const tb = b.weeks.find((w) => w.phase === 'taper')!;
    setKm(b, tb, 'long', 17);
    expect(errors(b)).toContain('TAPER_LONG');
  });

  it('H8 (pouka 5): oštrenje, dan pred trku, lagan trkačke, trkačka ≤ taper', () => {
    const a = clone(base());
    const r = a.weeks.at(-1)!;
    dayOf(r, 'sharpener').workout = quality(a, 'RP_sharpener', 'RP', {
      form: 'reps',
      reps: 3,
      repM: 2000
    });
    expect(errors(a)).toContain('RACE_SHARPENER');
    const b = clone(base());
    const rb = b.weeks.at(-1)!;
    const eve = dayOf(rb, 'eve');
    eve.workout = { ...eveWorkout(b.paces), sec: 1900 };
    expect(errors(b)).toContain('RACE_EVE');
    const c = clone(base());
    const rc = c.weeks.at(-1)!;
    const e = dayOf(rc, 'easy');
    e.workout = easyWorkout(30, c.paces);
    rc.plannedKm = rc.days.reduce((s, d) => s + (d.countsToWeek ? d.workout.km : 0), 0);
    rc.targetKm = Math.round(rc.plannedKm * 10) / 10;
    expect(errors(c)).toEqual(expect.arrayContaining(['RACE_WEEK_EASY', 'RACE_WEEK_OVER_TAPER']));
  });

  it('H6 (pouke 1 i 9): cilj van pravila; nedelja 1 ispod obima bez dugog na 150 min; granica', () => {
    const a = clone(base());
    week(a, 2).nominalKm = 43;
    expect(errors(a)).toContain('VOLUME_RULE');
    const b = clone(base());
    const w1 = week(b, 1);
    setKm(b, w1, 'easy', dayOf(w1, 'easy').workout.km - 1);
    w1.targetKm = Math.round(w1.plannedKm * 10) / 10;
    w1.fitted = 'down';
    w1.notes.unshift('… najbliži izvodljiv cilj …');
    expect(errors(b)).toContain('WEEK1_BELOW_START');
    const c = clone(base());
    c.peakCapKm = 60;
    expect(errors(c)).toContain('VOLUME_PEAK');
  });

  it('Uslov 8: nedelja ispod minimuma, prazan trening', () => {
    const a = clone(base());
    const w = week(a, 5);
    w.days = w.days.filter((d) => d.role === 'long');
    setKm(a, w, 'long', 12);
    w.targetKm = w.plannedKm;
    expect(errors(a)).toContain('WEEK_MIN_VOLUME');
    const b = clone(base());
    const d = dayOf(week(b, 2), 'easy');
    d.workout = { ...d.workout, km: 0, segments: [] };
    expect(errors(b)).toContain('EMPTY_WORKOUT');
  });

  it('H13: dugi > 24 km (odluka HM-01 → 02); HI7: dugi > kotrljajuća granica (skorašnji najduži, prethodne 4 ned)', () => {
    const a = clone(base('16w-60km-v60-A-sun'));
    const w = week(a, 2);
    setKm(a, w, 'long', 24.1);
    w.targetKm = Math.round(w.plannedKm * 10) / 10;
    expect(errors(a)).toContain('LONG_KM');
    const b = clone(base());
    b.input = { ...b.input, recentLongRunKm: 8 }; // granica 9,0 < dugi 16,0
    expect(errors(b)).toEqual(expect.arrayContaining(['LONG_ROLLING']));
    // Bez ulaza: dugi nedelje 3 > max(1,1 × L, L + 1), L = najduži nedelja 1–2.
    const c = clone(base());
    const w3 = week(c, 3);
    const l2 = Math.max(dayOf(week(c, 1), 'long').workout.km, dayOf(week(c, 2), 'long').workout.km);
    const over = Math.floor(Math.max(1.1 * l2, l2 + 1) * 10 + 1e-9) / 10 + 0.1;
    setKm(c, w3, 'long', over);
    w3.targetKm = Math.round(w3.plannedKm * 10) / 10;
    expect(errors(c)).toContain('LONG_ROLLING');
  });

  it('HI8 (pouka 9): nedelja 1 ispod obima ispravna uz dugi na granici skorašnjeg najdužeg, ne bez nje', () => {
    const r = generateHmV2(
      inputOf({ weeks: 12, km: 40, vdot: 45, days: SCHEDULES.A.days, recentLongRunKm: 8 })
    );
    if (!r.ok) throw new Error('odbijen');
    expect(r.plan.weeks[0]!.targetKm).toBeLessThan(40);
    expect(errors(r.plan)).toEqual([]);
    const a = clone(r.plan);
    delete a.input.recentLongRunKm;
    expect(errors(a)).toContain('WEEK1_BELOW_START');
  });

  it('H15/HI6: 3 dana — I/R ili drugi kvalitet, kvalitet rasterećenja van Q1, taper sa T', () => {
    const p3 = base('d3-14w-35km-v45-A-sun');
    expect(errors(p3)).toEqual([]);
    const a = clone(p3);
    dayOf(week(a, 1), 'q1').workout = quality(a, 'R', 'R', { form: 'reps', reps: 6, repM: 200 });
    expect(errors(a)).toContain('PHASE_QUALITY');
    const b = clone(p3);
    b.pattern = { ...b.pattern, q2: b.pattern.easy[0]!, easy: [] };
    expect(errors(b)).toContain('ROLES');
    const c = clone(p3);
    const d = c.weeks.find((w) => w.deload)!;
    const q = d.days.find((x) => x.role === 'q1')!;
    q.role = 'q2';
    expect(errors(c)).toContain('ROLES');
    const e = clone(p3);
    const t = e.weeks.find((w) => w.phase === 'taper')!;
    const easy = dayOf(t, 'easy');
    easy.role = 'q2';
    easy.workout = quality(e, 'T_cruise', 'T', { form: 'reps', reps: 2, repM: 1000 });
    expect(errors(e)).toEqual(expect.arrayContaining(['TAPER_QUALITY']));
  });

  it('H15: 5/6 dana lagani jednaki (razlika ≤ 0,1 km)', () => {
    const a = clone(base('d6-12w-60km-v50-B-sun'));
    const w = week(a, 2);
    const e = w.days.filter((d) => d.role === 'easy');
    e[0]!.workout = easyWorkout(e[0]!.workout.km + 0.5, a.paces);
    e[1]!.workout = easyWorkout(e[1]!.workout.km - 0.5, a.paces);
    expect(errors(a)).toEqual(['EASY_UNEQUAL']);
  });

  it('pouka 32 (HI15): dan iznad najnižeg nivoa duži od dugog i pad doze ispod najvišeg nivoa koji staje', () => {
    const p = generateHmV2(
      inputOf({ weeks: 13, km: 40, vdot: 70, days: SIX.days, long: SIX.long, race: 'sat' })
    );
    if (!p.ok) throw new Error('plan');
    expect(errors(p.plan)).toEqual([]);
    // Ned 8: Q2 T iznad najnižeg nivoa staje (hm-v2.3.0: 2 × 1600 m; hm-v2.4.0, pouka 35 u ranijim nedeljama: duži
    // dugi → viši nivo); spuštanje na 2 × 1200 m (najniži) sa napomenom nije najviši nivo.
    const a = clone(p.plan);
    const w = week(a, 8);
    const q2 = dayOf(w, 'q2');
    expect(q2.workout.dose!.doseM).toBeGreaterThan(2400);
    q2.workout.dose = {
      ...q2.workout.dose!,
      doseM: 2400,
      structure: { form: 'reps', reps: 2, repM: 1200 },
      step: 'drop'
    };
    w.notes.push(
      'Q2: T 2,4 km — viša doza bi dan kvaliteta učinila dužim od dugog (pouka 32, plafon zone).'
    );
    expect(errors(a)).toContain('DOSE_DROP');
    // Dan iznad najnižeg nivoa duži od dugog: dugi ned 8 skraćen na 8 km.
    const b = clone(p.plan);
    dayOf(week(b, 8), 'long').workout = longWorkout(8, b.paces);
    expect(errors(b)).toContain('QUALITY_OVER_LONG');
  });

  it('H2/H3: tempo iz rezultata, prognoza, ocena cilja', () => {
    const a = clone(base());
    a.paces = { ...a.paces, RP: a.paces.RP - 5 };
    expect(errors(a)).toContain('PACES');
    const b = clone(base());
    b.input = { ...b.input, goalTimeSec: timeForVdot(46, 21097.5) };
    expect(errors(b)).toContain('GOAL');
  });
});
