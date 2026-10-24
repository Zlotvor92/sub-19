import { describe, expect, it } from 'vitest';
import { generateFiveKV2 } from './generate.ts';
import { inputOf, PROFILES } from './testInputs.ts';
import type { FiveKV2Plan, PlanDay, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';

function base(): FiveKV2Plan {
  const r = generateFiveKV2(inputOf(PROFILES['vdot50_35km_14w']!));
  if (!r.ok) throw new Error('profil mora dati plan');
  return JSON.parse(JSON.stringify(r.plan)) as FiveKV2Plan;
}
const rulesOf = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const week = (p: FiveKV2Plan, pred: (w: PlanWeek) => boolean): PlanWeek => p.weeks.find(pred)!;
const dayOf = (w: PlanWeek, role: PlanDay['role']): PlanDay => w.days.find((d) => d.role === role)!;
const peakWeek = (p: FiveKV2Plan): PlanWeek => week(p, (w) => w.phase === 'peak' && !w.deload);

describe('validate.ts prijavljuje svako pravilo i ne menja plan', () => {
  it('ispravan plan nema grešaka; validacija ne menja plan', () => {
    const p = base();
    const before = JSON.stringify(p);
    expect(rulesOf(p)).toEqual([]);
    expect(JSON.stringify(p)).toBe(before);
  });

  it.each<[string, (p: FiveKV2Plan) => void]>([
    [
      'HARD_ADJACENT',
      (p) => {
        const w = p.weeks[0]!;
        const e = dayOf(w, 'easy');
        e.hard = true;
      }
    ],
    [
      'RUN_DAYS',
      (p) => {
        dayOf(p.weeks[0]!, 'easy').weekday = 'sun';
      }
    ],
    [
      'RACE_DAY',
      (p) => {
        const w = p.weeks[p.weeks.length - 1]!;
        w.days = w.days.filter((d) => d.role !== 'race');
      }
    ],
    [
      'PHASE_ORDER',
      (p) => {
        p.weeks[1]!.phase = 'base';
        p.weeks[0]!.phase = 'peak';
      }
    ],
    [
      'ROLES',
      (p) => {
        const w = p.weeks[0]!;
        dayOf(w, 'q2').workout.kind = 'easy';
      }
    ],
    [
      'ARITHMETIC',
      (p) => {
        dayOf(p.weeks[0]!, 'q1').workout.km += 0.5;
      }
    ],
    [
      'PLANNED_VS_TARGET',
      (p) => {
        p.weeks[1]!.targetKm *= 1.2;
        p.weeks[1]!.easyCappedAtLong = false; // 5k-v2.12.0 (T1): bez oznake granice laganog
      }
    ],
    [
      'VOLUME_GROWTH',
      (p) => {
        p.weeks[1]!.targetKm = p.weeks[0]!.targetKm * 1.1;
        p.weeks[1]!.plannedKm = p.weeks[1]!.targetKm;
      }
    ],
    [
      'VOLUME_PEAK',
      (p) => {
        p.startKm = 20;
      }
    ],
    [
      'VOLUME_DELOAD',
      (p) => {
        week(p, (w) => w.deload).targetKm *= 1.1;
      }
    ],
    [
      'VOLUME_TAPER',
      (p) => {
        week(p, (w) => w.taperStep === 1).targetKm *= 1.2; // 5k-v2.12.0 (T4): taper 1 nedelja
      }
    ],
    [
      'VOLUME_RACE_WEEK',
      (p) => {
        week(p, (w) => w.phase === 'race').targetKm *= 1.2;
      }
    ],
    [
      'I_SHARE',
      (p) => {
        dayOf(peakWeek(p), 'q1').workout.workKm.I = 10;
      }
    ],
    [
      'I_REP',
      (p) => {
        dayOf(peakWeek(p), 'q1').workout.maxBoutSec.I = 301;
      }
    ],
    [
      'T_SHARE',
      (p) => {
        dayOf(peakWeek(p), 'q2').workout.workKm.T = 10;
      }
    ],
    [
      'T_CONTINUOUS',
      (p) => {
        dayOf(peakWeek(p), 'q2').workout.maxBoutSec.T = 1201;
      }
    ],
    [
      'R_SHARE',
      (p) => {
        dayOf(p.weeks[0]!, 'q1').workout.workKm.R = 5;
      }
    ],
    [
      'R_REP',
      (p) => {
        dayOf(p.weeks[0]!, 'q1').workout.maxBoutSec.R = 121;
      }
    ],
    [
      'BUDGETS',
      (p) => {
        peakWeek(p).budgets.I += 1;
      }
    ],
    [
      'PEAK_MAIN_FLOOR',
      (p) => {
        dayOf(peakWeek(p), 'q1').workout.workKm.I = 0.5;
      }
    ],
    [
      'PHASE_QUALITY',
      (p) => {
        dayOf(peakWeek(p), 'q1').workout.qualityType = 'R';
      }
    ],
    [
      'LONG_SHARE',
      (p) => {
        const l = dayOf(p.weeks[0]!, 'long').workout;
        l.km = 20;
      }
    ],
    [
      'LONG_DURATION',
      (p) => {
        const l = dayOf(p.weeks[0]!, 'long').workout;
        l.km = 17;
        p.weeks[0]!.plannedKm = 100;
      }
    ],
    [
      'LONG_NOT_EASY',
      (p) => {
        const l = dayOf(p.weeks[0]!, 'long').workout;
        (l.segments as unknown as { zone: string }[])[0]!.zone = 'T';
      }
    ],
    [
      'EASY_MIN',
      (p) => {
        const e = dayOf(p.weeks[0]!, 'easy').workout;
        e.km = 1;
      }
    ],
    [
      'WARMUP',
      (p) => {
        (dayOf(p.weeks[0]!, 'q1').workout.segments as unknown as { km: number }[])[0]!.km = 4;
      }
    ],
    [
      'SHARPENER_GAP',
      (p) => {
        const w = p.weeks[p.weeks.length - 1]!;
        dayOf(w, 'q1').date = '2027-02-06';
      }
    ]
  ])('%s', (rule, mutate) => {
    const p = base();
    mutate(p);
    expect(rulesOf(p)).toContain(rule);
  });

  it('2.1.0: lagan trk duži od dugog je GREŠKA (ranije upozorenje)', () => {
    const p = base();
    const w = p.weeks[0]!;
    dayOf(w, 'easy').workout.km = dayOf(w, 'long').workout.km + 1;
    const v = validatePlan(p).filter((x) => x.rule === 'EASY_LONGER_THAN_LONG');
    expect(v.length).toBeGreaterThan(0);
    expect(v.every((x) => x.severity === 'error')).toBe(true);
  });
});
