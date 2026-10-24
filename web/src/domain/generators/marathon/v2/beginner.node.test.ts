import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { planRule } from './policy.ts';
import { buildLadder, pickDeload, startLevel } from './quality.ts';
import { inputOf, SCHEDULES_BY_DAYS, START, type Profile } from './testInputs.ts';
import type { MarathonV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { doseOf, ladderLevels } from './workouts.ts';

/* M17: početnik — 4–5 dana, 16–24 ned, obim 25–45 / 30–50 km, uvod 2 ned bez kvaliteta, jedan kvalitet (T kont. →
   T cruise → MP, bez I/R), T kont. od 1,5 km, rast +5 % (1,0–2,5), vrh min(1,5×; +25), WU/CD 15/10, bez testa,
   prag dugog 26 km, vrh dugog 3 nedelje pred taperom do 50 % / 180 min (F2) („cilj: završiti"); trčanje/hodanje odbijeno. */

const begInput = (pr: Partial<Profile> = {}): Record<string, unknown> =>
  inputOf({
    weeks: 18,
    km: 35,
    vdot: 35,
    days: SCHEDULES_BY_DAYS[4].A.days,
    long: 'sun',
    experience: 'beginner',
    ...pr
  });
function plan(raw: Record<string, unknown>): MarathonV2Plan {
  const r = generateMarathonV2(raw);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
const codes = (raw: unknown): string[] => {
  const r = checkInput(raw);
  return r.ok ? [] : r.reasons.map((x) => x.code);
};
const message = (raw: unknown, code: string): string => {
  const r = checkInput(raw);
  return r.ok ? '' : (r.reasons.find((x) => x.code === code)?.message ?? '');
};
const errors = (p: MarathonV2Plan): string[] =>
  [
    ...new Set(
      validatePlan(p)
        .filter((v) => v.severity === 'error')
        .map((v) => v.rule)
    )
  ].sort();
const mutate = (p0: MarathonV2Plan, fn: (p: MarathonV2Plan) => void): string[] => {
  const p = structuredClone(p0);
  fn(p);
  return errors(p);
};
const steady = (p: MarathonV2Plan): PlanWeek[] =>
  p.weeks.filter((w) => !w.deload && ['base', 'development', 'specific'].includes(w.phase));

const B4 = plan(begInput());
const B5F = plan(
  begInput({
    km: 45,
    weeks: 20,
    days: SCHEDULES_BY_DAYS[5].B.days,
    easyPace: 420,
    vdot: undefined
  })
);

describe('M17 ulaz', () => {
  it('4–5 dana (3 i 6 → BEGINNER_DAYS sa preporukom), 16–24 ned (BEGINNER_SHORT), obim 25–45 / 30–50 km', () => {
    expect(codes(begInput())).toEqual([]);
    expect(codes(begInput({ days: SCHEDULES_BY_DAYS[3].A.days }))).toEqual(['BEGINNER_DAYS']);
    expect(message(begInput({ days: SCHEDULES_BY_DAYS[6].A.days }), 'BEGINNER_DAYS')).toMatch(
      /preporuka 4–5 dana/
    );
    expect(codes(begInput({ weeks: 15 }))).toEqual(['BEGINNER_SHORT']);
    expect(codes(begInput({ weeks: 16 }))).toEqual([]);
    expect(codes(begInput({ km: 24.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(message(begInput({ km: 24.9 }), 'WEEKLY_KM_TOO_LOW')).toMatch(/kraća distanca/);
    expect(codes(begInput({ km: 45 }))).toEqual([]);
    expect(codes(begInput({ km: 45.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
    expect(message(begInput({ km: 46 }), 'WEEKLY_KM_TOO_HIGH')).toMatch(/bez oznake početnika/);
    const five = SCHEDULES_BY_DAYS[5].A.days;
    expect(codes(begInput({ days: five, km: 29.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(codes(begInput({ days: five, km: 50 }))).toEqual([]);
    expect(codes(begInput({ days: five, km: 50.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
  });

  it('trčanje/hodanje → RUN_WALK_NOT_SUPPORTED (preporuka kraće distance), i za početnika i za redovan plan', () => {
    for (const raw of [
      { ...begInput(), runWalk: true },
      {
        ...inputOf({ weeks: 16, km: 45, vdot: 45, days: SCHEDULES_BY_DAYS[4].A.days }),
        runWalk: true
      }
    ]) {
      expect(codes(raw)).toEqual(['RUN_WALK_NOT_SUPPORTED']);
      expect(message(raw, 'RUN_WALK_NOT_SUPPORTED')).toMatch(/kraća distanca/);
      expect(generateMarathonV2(raw).ok).toBe(false);
    }
  });

  it('početnik po osećaju i sa rezultatom; bez pouzdanog rezultata lagan tempo obavezan', () => {
    expect(B4.paceBasis).toBe('result');
    expect(B5F.paceBasis).toBe('feel');
    expect(
      codes({
        ...begInput(),
        recentResult: { distanceM: 10000, timeSec: 3600, date: addDays(START, -100) }
      })
    ).toEqual(['EASY_PACE_REQUIRED']);
  });
});

describe('M17 plan', () => {
  it('uvod: nedelje 1–2 bez kvaliteta (dan kvaliteta lagan), uz napomenu; zatim jedan kvalitet nedeljno, bez I i R', () => {
    for (const p of [B4, B5F]) {
      for (const w of p.weeks.slice(0, 2)) {
        expect(w.days.some((d) => d.workout.kind === 'quality')).toBe(false);
        expect(w.days.filter((d) => d.role === 'easy')).toHaveLength(p.input.runDays.length - 1);
        expect(w.notes.some((n) => n.startsWith('Uvod (M17)'))).toBe(true);
      }
      for (const w of p.weeks) {
        const q = w.days.filter((d) => d.workout.kind === 'quality');
        expect(q.length).toBeLessThanOrEqual(1);
        for (const d of q) expect(d.workout.workKm.I + d.workout.workKm.R).toBe(0);
      }
      for (const w of steady(p).filter((x) => x.index > 2))
        expect(w.days.filter((d) => d.workout.kind === 'quality')).toHaveLength(1);
      expect(errors(p)).toEqual([]);
    }
  });

  it('lestvica T kont. početnika [1,5; 2,0; …]; prvi kvalitet = prvi nivo (60 % plafona ne važi)', () => {
    expect(ladderLevels('T_continuous', true).map((s) => doseOf(s))).toEqual([
      1500, 2000, 3000, 4000, 5000, 6000, 8000
    ]);
    expect(doseOf(startLevel('T_continuous', 45, true)!)).toBe(1500);
    expect(doseOf(startLevel('T_continuous', 45)!)).toBe(2000);
    const first = steady(B4).find((w) => w.index === 3)!;
    expect(first.days.find((d) => d.role === 'q1')!.workout.dose!.doseM).toBe(1500);
  });

  it('T kont. umesto lestvice faze kad prvi nivo ne staje u plafon (MP 2 × 3000 m traži cilj ≥ 30 km); bez kvaliteta kad ni 1,5 km ne staje', () => {
    const rule = planRule(4, 'beginner')!;
    expect(buildLadder('specific', 30, rule)).toBe('MP');
    expect(buildLadder('specific', 29.9, rule)).toBe('T_continuous');
    expect(buildLadder('development', 24, rule)).toBe('T_cruise');
    expect(buildLadder('development', 23.9, rule)).toBe('T_continuous');
    expect(buildLadder('base', 14.9, rule)).toBeNull();
    expect(buildLadder('specific', 29.9, planRule(4)!)).toBe('MP');
    // Rasterećenje početnika: T ≈ 60 % poslednje T doze, min 1,5 km.
    const d = pickDeload({ q1: null, q2: null, t: 2000 }, 'base', 25, true)!;
    expect(d.doseM).toBe(1500);
  });

  it('rast +5 % (min 1,0, max 2,5 km), vrh min(1,5×; +25; max; kapacitet); WU/CD 15/10 i pri 45–50 km', () => {
    for (const p of [B4, B5F]) {
      const s = steady(p);
      for (let i = 1; i < s.length; i++) {
        const a = Math.round(s[i - 1]!.targetKm * 10);
        const nominal = Math.round(s[i]!.nominalKm * 10);
        const g = Math.min(25, Math.max(10, Math.round(a * 0.05)));
        expect(nominal).toBe(Math.min(a + g, Math.round(p.peakCapKm * 10)));
      }
      const s10 = Math.round(p.startKm * 10);
      expect(Math.round(p.peakCapKm * 10)).toBe(Math.min(Math.floor(s10 * 1.5), s10 + 250, 800));
      for (const d of p.weeks.flatMap((w) => w.days).filter((x) => x.workout.kind === 'quality')) {
        const k = d.workout.segments;
        expect([k[0]!.sec, k[k.length - 1]!.sec]).toEqual([900, 600]);
      }
    }
  });

  it('bez testa (i po osećaju); najduži dugi < 26 km ograničen trajanjem 180 min (F2) → rečenica plana („cilj: završiti")', () => {
    expect(B5F.weeks.some((w) => w.test || w.days.some((d) => d.role === 'test'))).toBe(false);
    const longest = Math.max(
      ...B4.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
    );
    expect(longest).toBeLessThan(26);
    expect(longest).toBeGreaterThanOrEqual(24);
    // N11 (MAR-07): najduži dugi početnika na 150 min → rečenica u opisu plana, ne upozorenje.
    expect(B4.warnings.some((x) => x.rule === 'MARATHON_LONG_SHORT')).toBe(false);
    const w = B4.notes.find((n) => n.startsWith('Najduže dugo trčanje je'))!;
    expect(w).toMatch(/preporučenih 26,0 km/);
    expect(w).toMatch(/≤ 180 min/);
    expect(w).toMatch(/M17/);
    expect(w).toMatch(/cilj je završiti maraton/);
    expect(B4.notes.some((n) => n.startsWith('Početnik (M17)'))).toBe(true);
  });
});

describe('M17 validator hvata', () => {
  it('kvalitet u uvodu, I kod početnika, WU 20 min, test kod početnika', () => {
    expect(
      mutate(B4, (p) => {
        const w1 = p.weeks[0]!;
        const src = p.weeks[2]!.days.find((d) => d.role === 'q1')!;
        const e = w1.days.find((d) => d.weekday === p.pattern.q1)!;
        e.role = 'q1';
        e.hard = true;
        e.workout = structuredClone(src.workout);
      })
    ).toContain('ROLES');
    expect(
      mutate(B4, (p) => {
        const d = p.weeks
          .find((w) => w.phase === 'development' && !w.deload)!
          .days.find((x) => x.role === 'q1')!;
        d.workout.qualityType = 'I';
      })
    ).toContain('PHASE_QUALITY');
    expect(
      mutate(B4, (p) => {
        const d = p.weeks[2]!.days.find((x) => x.role === 'q1')!;
        d.workout.segments[0]!.sec = 1200;
      })
    ).toContain('WARMUP');
    expect(mutate(B4, (p) => (p.weeks[3]!.test = true))).toContain('TEST');
  });
});
