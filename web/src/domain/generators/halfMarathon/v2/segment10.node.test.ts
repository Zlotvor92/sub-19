import { describe, expect, it } from 'vitest';
import { adaptHmV2 } from './adapt.ts';
import { factsOf } from './adaptInputs.ts';
import { addDays } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import { checkPlan, emptyStats } from './gridInvariants.ts';
import { buildEasyCap10, buildEasyMin10, buildLengths } from './lengths.ts';
import { pacesFromVdot } from './paces.ts';
import { planRule } from './policy.ts';
import { feelInputs, grid02Inputs } from './testInputs.ts';
import type { HmV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { easyWorkout } from './workouts.ts';

/* Segment HM-10 (hm-v2.8.0, krug T) — trenerska pravila T1, T3, C4, C12 (T7: input.node.test.ts). Ulazi su iz
   nalaza (coach-hm-mar 1b #4, coach-HM pauza 35, consistency C4/C12); svaki test pada na kodu pre ispravke
   (b9c4728). */

type Ok = { ok: true; plan: HmV2Plan };
const ok = (r: unknown): HmV2Plan => {
  const x = r as Ok | { ok: false; reasons: { message: string }[] };
  if (!x.ok) throw new Error(x.reasons.map((m) => m.message).join(' | '));
  return x.plan;
};
const input = (id: string): Record<string, unknown> =>
  [...grid02Inputs(), ...feelInputs()].find((x) => x.id === id)!.input;
const build = (w: PlanWeek): boolean =>
  !w.deload && ['base', 'development', 'specific'].includes(w.phase);
const longKm = (w: PlanWeek): number => w.days.find((d) => d.role === 'long')!.workout.km;
const errors = (p: HmV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);

describe('HM-10 T1: lagan prema dugom u nedeljama izgradnje', () => {
  it('f-d4-18w-55km-e360-A (1b #4: lagan 23,5 / dugi 24): svaki lagan ≤ 0,8 × dugi i ≥ 20 min; validator EASY_BUILD', () => {
    const p = ok(generateHmV2(input('f-d4-18w-55km-e360-A')));
    for (const w of p.weeks.filter(build))
      for (const d of w.days.filter((x) => x.role === 'easy')) {
        expect(Math.round(d.workout.km * 10)).toBeLessThanOrEqual(
          buildEasyCap10(Math.round(longKm(w) * 10))
        );
        expect(d.workout.sec).toBeGreaterThanOrEqual(1200);
      }
    const bad: Record<string, string[]> = {};
    checkPlan('t1', p, bad, emptyStats());
    expect(bad).toEqual({});
    // Lagan jednak dugom (stari plan) → greška validatora.
    const a = structuredClone(p);
    const w = a.weeks.find((x) => build(x) && x.days.some((d) => d.role === 'easy'))!;
    const e = w.days.find((d) => d.role === 'easy')!;
    e.workout = easyWorkout(longKm(w), a.paces);
    expect(errors(a)).toContain('EASY_BUILD');
  });

  it('manje laganih dana kad najkraći lagan ne staje ispod 0,8 × dugi (16 km, 3 lagana → 2, dugi se ne podiže iznad svog plafona)', () => {
    const rule = planRule(4, 'beginner')!;
    const p = pacesFromVdot(35);
    const len = buildLengths(160, 0, 3, rule, p)!;
    expect(len.easy10.length).toBe(2);
    for (const e of len.easy10) {
      expect(e).toBeLessThanOrEqual(buildEasyCap10(len.long10));
      expect(e).toBeGreaterThanOrEqual(buildEasyMin10(p));
    }
    expect(len.long10).toBeLessThanOrEqual(Math.floor(rule.longMaxShare * 160 + 1e-9));
    // Brz trkač: najkraći lagan 20 min (VDOT 70 > 4 km).
    expect(buildEasyMin10(pacesFromVdot(70))).toBeGreaterThan(40);
  });

  it('nedelja na minimumu (3 dana, 12 km) posle pauze 35: plan prihvaćen, upozorenje EASY_BUILD_MIN_WEEK (izuzetak, pitanje organizatoru)', () => {
    const p0 = ok(generateHmV2(input('d3-10w-25km-v30-A-sat')));
    const at = addDays(p0.input.startDate, -1);
    const p = ok(adaptHmV2(p0, factsOf(p0, 'pause35', at), at));
    expect(p.warnings.some((v) => v.rule === 'EASY_BUILD_MIN_WEEK')).toBe(true);
  });
});

describe('HM-10 T3: posle novog starta taper zadržava 1 kvalitet, trkačka kratko oštrenje', () => {
  it('d3-10w-45km-v35-B-sat, pauza 35 do 2026-11-07: taper T ≈ 60 % (bilo bez kvaliteta), trkačka sa oštrenjem', () => {
    const p0 = ok(generateHmV2(input('d3-10w-45km-v35-B-sat')));
    const at = '2026-11-07';
    const p = ok(adaptHmV2(p0, factsOf(p0, 'pause35', at), at));
    expect(p.adaptation!.steps.some((s) => s.restart)).toBe(true);
    const taper = p.weeks.find((w) => w.phase === 'taper')!;
    const q = taper.days.filter((d) => d.workout.kind === 'quality');
    expect(q.length).toBe(1);
    expect(q[0]!.workout.dose!.zone).toBe('T');
    expect(q[0]!.workout.dose!.doseM).toBeGreaterThanOrEqual(2000);
    const race = p.weeks.find((w) => w.phase === 'race')!;
    expect(race.days.some((d) => d.role === 'sharpener')).toBe(true);
    expect(errors(p)).toEqual([]);
    // Taper bez tog kvaliteta → greška validatora (ista funkcija restartTaperT).
    const a = structuredClone(p);
    const t = a.weeks.find((w) => w.phase === 'taper')!;
    t.days = t.days.map((d) =>
      d.workout.kind === 'quality'
        ? { ...d, role: 'easy', workout: easyWorkout(d.workout.km, a.paces) }
        : d
    );
    expect(errors(a)).toContain('TAPER_QUALITY');
  });
});

describe('HM-10 C4: urađen dan posle asOf u zbiru zaštićenih = planirani km (MASTER pouka 37)', () => {
  it('zapis ≤ asOf sa dayId budućeg dana i km ≠ plan: factKm ga nema (bilo upisani km)', () => {
    const p0 = ok(generateHmV2(input('d4-14w-40km-v45-A-sun')));
    const w = p0.weeks[2]!;
    const asOf = w.days[0]!.date;
    const future = w.days.find((d) => d.date > asOf && d.role === 'easy')!;
    const facts = {
      workouts: [
        {
          date: asOf,
          dayId: future.date,
          km: future.workout.km + 3,
          durationSec: 3000,
          completed: true
        }
      ]
    };
    const p = ok(adaptHmV2(p0, facts, asOf));
    expect(p.adaptation!.factKm?.[future.date]).toBeUndefined();
    expect(errors(p)).toEqual([]);
  });
});

describe('HM-10 C12: najniži nivo RP se u mešovitoj nedelji ne odbacuje (kao MAR MP)', () => {
  it('d3-10w-25km-v55-B-sun ned 6, urađeni dani × 1,6 do 2026-12-07: RP 2 × 2000 m ostaje (bilo lagan)', () => {
    const p0 = ok(generateHmV2(input('d3-10w-25km-v55-B-sun')));
    const w = p0.weeks[5]!;
    const asOf = '2026-12-07';
    const rp = w.days.find((d) => d.workout.dose?.zone === 'RP')!;
    expect(rp.workout.dose!.doseM).toBe(4000);
    const facts = {
      workouts: w.days
        .filter((d) => d.date <= asOf)
        .map((d) => ({
          date: d.date,
          dayId: d.date,
          km: Math.round(d.workout.km * 16) / 10,
          durationSec: Math.round(d.workout.sec * 1.6),
          completed: true
        }))
    };
    const p = ok(adaptHmV2(p0, facts, asOf));
    const kept = p.weeks[5]!.days.find((d) => d.date === rp.date)!;
    expect(kept.workout.dose?.zone).toBe('RP');
    expect(errors(p)).toEqual([]);
  });
});
