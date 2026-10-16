/* Segment 02 (5k-v2.1.0, ažurirano za 2.2.0): trenerske odluke 1–4 i Uslov 8 (upotrebljivost plana). */

import { describe, expect, it } from 'vitest';
import { daysBetween } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { periodize, phaseCounts } from './periodize.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { inputOf, PROFILES, START, type Profile } from './testInputs.ts';
import type { FiveKV2Plan, PlanDay, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { planVolume } from './volume.ts';
import { chooseProgressiveReps, easyRun, longRun, roundRecoverySec } from './workouts.ts';

function planOf(p: Profile): FiveKV2Plan {
  const r = generateFiveKV2(inputOf(p));
  if (!r.ok) throw new Error(JSON.stringify(r.reasons) + JSON.stringify(r.violations));
  return JSON.parse(JSON.stringify(r.plan)) as FiveKV2Plan;
}
const ALL = Object.entries(PROFILES);
const errorsOf = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const roleDay = (w: PlanWeek, role: PlanDay['role']): PlanDay =>
  w.days.find((d) => d.role === role)!;
const isSteadyBuild = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen');
const mainWork = (w: PlanWeek): number => {
  const k = roleDay(w, 'q1').workout.workKm;
  return w.phase === 'sharpen' ? k.RP : k.I;
};
/** Sporiji trkač sa visokim obimom: dugi udara u 90 min, pa lagan ≤ dugi skraćuje nedelju. */
const CAPPED: Profile = {
  weeks: 12,
  km: 45,
  distanceM: 5000,
  timeSec: 1830,
  days: ['tue', 'thu', 'sat', 'sun']
};

describe('plan nosi identitet politike (Uslov 6)', () => {
  it.each(ALL)('%s', (_, p) => {
    const plan = planOf(p);
    expect(plan.policyId).toBe('5k-v2');
    expect(plan.policyVersion).toBe('5k-v2.2.0');
  });
});

describe('Odluka 1: dugi ≥ svaki lagan trk; dugi ≤ 35% i ≤ 90 min', () => {
  it.each([...ALL, ['capped', CAPPED] as [string, Profile]])('%s', (_, p) => {
    const plan = planOf(p);
    for (const w of plan.weeks) {
      const long = w.days.find((d) => d.role === 'long');
      if (!long) continue;
      expect(long.workout.km).toBeLessThanOrEqual(w.targetKm * P.long.maxShare + 1e-9);
      expect(long.workout.km * plan.paces.E.slow).toBeLessThanOrEqual(P.long.maxSec);
      for (const d of w.days.filter((x) => x.role === 'easy'))
        expect(d.workout.km).toBeLessThanOrEqual(long.workout.km + 1e-9);
    }
  });

  it('2.2.0: „lagan = dugi" je samo zaštita — kapacitet 4 dana sprečava je na ulazu', () => {
    const plan = planOf(CAPPED);
    expect(plan.weeks.filter((w) => w.easyCappedAtLong)).toEqual([]);
    // Ciljevi su i dalje odluka volume.ts.
    expect(plan.weeks.map((w) => w.targetKm)).toEqual(
      planVolume(periodize(START, CAPPED.weeks), CAPPED.km, plan.paces).targets
    );
    expect(plan.warnings.filter((v) => v.rule === 'PLANNED_BELOW_TARGET')).toEqual([]);
  });

  it('validator: „lagan = dugi" uz oznaku → upozorenje; bez oznake → greška; lažna oznaka → greška', () => {
    const p = planOf(CAPPED);
    const w = p.weeks.find((x) => x.phase === 'base' && !x.deload)!;
    // Kao da je cilj iznad kapaciteta: dugi i lagan po 6 km.
    w.days = w.days.map((d) =>
      d.role === 'easy'
        ? { ...d, workout: easyRun(6, p.paces, false) }
        : d.role === 'long'
          ? { ...d, workout: longRun(6, p.paces) }
          : d
    );
    w.plannedKm = Math.round(w.days.reduce((a, d) => a + d.workout.km, 0) * 100) / 100;
    expect(w.plannedKm).toBeLessThan(w.targetKm * (1 - P.tolerance.plannedVsTarget));
    w.easyCappedAtLong = true;
    expect(errorsOf(p)).toEqual([]);
    expect(validatePlan(p).map((v) => v.rule)).toContain('PLANNED_BELOW_TARGET');
    w.easyCappedAtLong = false;
    expect(errorsOf(p)).toContain('PLANNED_VS_TARGET');
    const q = planOf(PROFILES['vdot50_35km_14w']!);
    q.weeks[0]!.easyCappedAtLong = true;
    expect(errorsOf(q)).toContain('EASY_CAP');
  });
});

describe('Odluka 2: progresija doze i bez ponavljanja para kvaliteta', () => {
  it.each(ALL)('%s', (_, p) => {
    const plan = planOf(p);
    const steady = plan.weeks.filter(isSteadyBuild);
    for (const w of steady.filter((x) => x.phase === 'peak' || x.phase === 'sharpen')) {
      expect(mainWork(w)).toBeGreaterThanOrEqual(
        w.budgets.I * P.quality.mainMinShareOfBudget - 1e-9
      );
      expect(mainWork(w)).toBeLessThanOrEqual(w.budgets.I + 1e-9);
    }
    for (let i = 1; i < steady.length; i++) {
      const a = steady[i - 1]!;
      const b = steady[i]!;
      if (a.phase === b.phase && (b.phase === 'peak' || b.phase === 'sharpen'))
        expect(mainWork(b)).toBeGreaterThanOrEqual(mainWork(a));
      const key = (w: PlanWeek): string =>
        JSON.stringify(
          w.days.filter((d) => d.workout.kind === 'quality').map((d) => d.workout.blocks)
        );
      expect(key(b)).not.toBe(key(a));
    }
  });

  it('vrhunac ≤ 4 nedelje (≤ 3 ne-rasteretne), višak u bazi', () => {
    for (let n = P.input.planWeeks.min; n <= P.input.planWeeks.max; n++) {
      expect(phaseCounts(n).peak).toBeLessThanOrEqual(P.phases.peakMaxWeeks);
      const steadyPeak = periodize(START, n).filter((f) => f.phase === 'peak' && !f.deload);
      expect(steadyPeak.length).toBeLessThanOrEqual(3);
    }
    expect(phaseCounts(16)).toMatchObject({ base: 7, peak: 4, sharpen: 2 });
  });

  it('validator: isti par dve nedelje vrhunca → QUALITY_REPEAT; manji I → DOSE_PROGRESSION', () => {
    const p = planOf(PROFILES['vdot50_35km_14w']!);
    const peak = p.weeks.filter((w) => w.phase === 'peak' && !w.deload);
    expect(peak.length).toBeGreaterThanOrEqual(2);
    const a = peak[0]!;
    const b = peak[1]!;
    b.days = b.days.map((d) =>
      d.workout.kind === 'quality' ? { ...d, workout: roleDay(a, d.role).workout } : d
    );
    b.plannedKm = b.days.reduce((s, d) => s + d.workout.km, 0);
    expect(errorsOf(p)).toContain('QUALITY_REPEAT');
    // 2.2.0: I u vrhuncu je neopadajući (isti I nije greška), manji I jeste.
    expect(errorsOf(p)).not.toContain('DOSE_PROGRESSION');
    const q = planOf(PROFILES['vdot50_35km_14w']!);
    const [qa, qb] = q.weeks.filter((w) => w.phase === 'peak' && !w.deload) as [PlanWeek, PlanWeek];
    expect(mainWork(qb)).toBeGreaterThan(mainWork(qa));
    const ia = roleDay(qa, 'q1');
    const ib = roleDay(qb, 'q1');
    [ia.workout, ib.workout] = [ib.workout, ia.workout];
    expect(errorsOf(q)).toContain('DOSE_PROGRESSION');
  });

  it('chooseProgressiveReps: najmanji veći rad u [70%, 100%] budžeta; bez većeg → null', () => {
    const I = [1.2, 1.0, 0.8, 0.7, 0.6, 0.5, 0.4];
    // VDOT 50, I 3:55/km; budžet 3,64 km → prag 2,55 km.
    const pick = (prev: { reps: number; repKm: number } | null) =>
      chooseProgressiveReps(3.64, I, 235, 2, 6, 300, 120, 0.7, prev, 'strict');
    expect(pick(null)).toEqual({ reps: 4, repKm: 0.7 });
    expect(pick({ reps: 4, repKm: 0.7 })).toEqual({ reps: 3, repKm: 1.0 });
    expect(pick({ reps: 3, repKm: 1.0 })).toEqual({ reps: 4, repKm: 0.8 });
    expect(pick({ reps: 4, repKm: 0.8 })).toEqual({ reps: 5, repKm: 0.7 });
    expect(pick({ reps: 5, repKm: 0.7 })).toEqual({ reps: 3, repKm: 1.2 });
    expect(pick({ reps: 3, repKm: 1.2 })).toBeNull();
    // Baza: drugačija struktura, doza ne pada, prednost dužem ponavljanju.
    const R = [0.4, 0.3, 0.2, 0.15];
    expect(
      chooseProgressiveReps(1.35, R, 264, 4, 10, 120, 0, 0.7, { reps: 4, repKm: 0.3 }, 'base')
    ).toEqual({ reps: 6, repKm: 0.2 });
  });
});

describe('Odluka 3: dan pred trku kratak, dva dana pred trku bez kvaliteta', () => {
  it.each(ALL)('%s', (_, p) => {
    const plan = planOf(p);
    const race = plan.weeks[plan.weeks.length - 1]!;
    for (const d of race.days) {
      const gap = daysBetween(d.date, plan.input.raceDate);
      if (d.workout.kind === 'quality') expect(gap).toBeGreaterThanOrEqual(3);
      if (gap === 1) {
        expect(d.workout.kind).toBe('easy');
        expect(d.workout.km).toBeLessThanOrEqual(P.easy.raceEveMaxKm);
        const strides = d.workout.segments.filter((s) => s.kind === 'stride');
        expect(strides.map((s) => s.sec)).toEqual([20, 20, 20, 20]);
      }
    }
  });

  it('profil sa trčanjem dan pred trku dobija istrčavanje ≤ 4 km', () => {
    const plan = planOf(PROFILES['vdot50_35km_14w']!);
    const race = plan.weeks[plan.weeks.length - 1]!;
    const eve = race.days.find((d) => daysBetween(d.date, plan.input.raceDate) === 1);
    expect(eve?.workout.km).toBe(4);
  });

  it('validator: dug dan pred trku → RACE_EVE; kvalitet 2 dana pred trku → SHARPENER_GAP', () => {
    const p = planOf(PROFILES['vdot50_35km_14w']!);
    const race = p.weeks[p.weeks.length - 1]!;
    const eve = race.days.find((d) => daysBetween(d.date, p.input.raceDate) === 1)!;
    eve.workout = roleDay(p.weeks[0]!, 'easy').workout;
    expect(errorsOf(p)).toContain('RACE_EVE');
    const q = planOf(PROFILES['vdot50_35km_14w']!);
    const qr = q.weeks[q.weeks.length - 1]!;
    roleDay(qr, 'q1').date = '2027-02-05'; // petak, trka u nedelju 2027-02-07
    expect(errorsOf(q)).toContain('SHARPENER_GAP');
  });
});

describe('Odluka 4: oporavak zadat vremenom zaokružen na 15 s', () => {
  it('roundRecoverySec', () => {
    expect(roundRecoverySec(202)).toBe(195);
    expect(roundRecoverySec(203)).toBe(210);
    expect(roundRecoverySec(4)).toBe(15);
  });

  it.each(ALL)('%s: obračun i prikaz isti', (_, p) => {
    const plan = planOf(p);
    for (const d of plan.weeks.flatMap((w) => w.days)) {
      const rec = d.workout.segments.filter((s) => s.kind === 'recovery' && s.secBasis === 'exact');
      for (const s of rec) expect(s.sec % 15).toBe(0);
      const shown = /oporavak (\d+) s/.exec(d.workout.title);
      if (shown && rec.length > 0) expect(rec.every((s) => s.sec === Number(shown[1]))).toBe(true);
    }
  });

  it('validator: oporavak 202 s → RECOVERY_ROUNDING', () => {
    const p = planOf(PROFILES['vdot50_35km_14w']!);
    const w = p.weeks.find((x) => x.phase === 'peak' && !x.deload)!;
    const rec = roleDay(w, 'q1').workout.segments.find((s) => s.kind === 'recovery')!;
    (rec as { sec: number }).sec = 202;
    expect(errorsOf(p)).toContain('RECOVERY_ROUNDING');
  });
});

describe('Uslov 8: degenerisan plan pada', () => {
  it.each(ALL)('%s: nijedna nedelja ispod minimuma, nijedan prazan trening', (_, p) => {
    const plan = planOf(p);
    for (const w of plan.weeks) {
      const min = w.phase === 'race' ? P.week.minRaceWeekKm : P.week.minTrainingKm;
      expect(w.plannedKm).toBeGreaterThanOrEqual(min);
      for (const d of w.days) {
        expect(d.workout.segments.length).toBeGreaterThan(0);
        expect(d.workout.km).toBeGreaterThan(0);
      }
    }
  });

  it.each<[string, (p: FiveKV2Plan) => void]>([
    [
      'WEEK_MIN_VOLUME',
      (p) => {
        const w = p.weeks[0]!;
        w.targetKm = 6;
        w.days = w.days.slice(0, 1);
        w.plannedKm = w.days[0]!.workout.km;
      }
    ],
    [
      'EMPTY_WORKOUT',
      (p) => {
        const d = roleDay(p.weeks[0]!, 'easy');
        d.workout = { ...d.workout, segments: [], km: 0, sec: 0 };
      }
    ],
    [
      'EASY_LONGER_THAN_LONG',
      (p) => {
        const w = p.weeks[1]!;
        const long = roleDay(w, 'long');
        const easy = roleDay(w, 'easy');
        [long.workout, easy.workout] = [easy.workout, long.workout];
      }
    ]
  ])('%s', (rule, mutate) => {
    const p = planOf(PROFILES['vdot50_35km_14w']!);
    mutate(p);
    expect(errorsOf(p)).toContain(rule);
  });
});
