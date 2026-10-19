/* H17 početnik: tabela i pravilo plana, uvod 2 nedelje, jedan kvalitet (T kont. → T cruise → RP) bez I/R, T
   kontinuirano od 1,5 km (HI10), rast 5 %, vrh 1,4× / +15, dugi ≤ 135 min, WU/CD 15/10, bez testa, upozorenje
   < 14 km; HI13 (pouka 31) rasterećenje u uvodu bez kvaliteta; trčanje/hodanje odbijeno; validator hvata. */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { feelPaces } from './paces.ts';
import { periodize } from './periodize.ts';
import { HM_V2_POLICY as P, planRule } from './policy.ts';
import { buildLadder, INITIAL_QUALITY, pickBuild, startLevel } from './quality.ts';
import { beginnerInputs } from './testInputs.ts';
import type { HmV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { predictedHm } from './paces.ts';
import { buildWeek, type WeekContext } from './week.ts';
import { doseOf, ladderLevels, qualityWorkout, warmupCooldown } from './workouts.ts';

const ALL = beginnerInputs();
const plan = (id: string): HmV2Plan => {
  const r = generateHmV2(ALL.find((g) => g.id === id)!.input);
  if (!r.ok) throw new Error(`${id}: ${r.reasons.map((x) => x.message).join(' | ')}`);
  return r.plan;
};
const errors = (p: HmV2Plan): string[] =>
  [
    ...new Set(
      validatePlan(p)
        .filter((v) => v.severity === 'error')
        .map((v) => v.rule)
    )
  ].sort();
const B4 = planRule(4, 'beginner')!;

describe('H17 pravilo plana početnika', () => {
  it('tabela: 4–5 dana, obim 20–40 / 25–45, 12 ned, uvod 2, rast 5 % (1,0–2,0), vrh 1,4× / +15, dugi 135 min, upozorenje 14 km, T 1,5 km', () => {
    expect(P.beginner).toEqual({
      days: { 4: { kmMin: 20, kmMax: 40 }, 5: { kmMin: 25, kmMax: 45 } },
      weeksMin: 12,
      introWeeks: 2,
      growth: 0.05,
      growthMinKm: 1.0,
      growthMaxKm: 2.0,
      peakFactor: 1.4,
      peakAddKm: 15,
      longMaxSec: 8100,
      longWarnKm: 14,
      tFirstKm: 1.5
    });
    expect(planRule(3, 'beginner')).toBeNull();
    expect(planRule(6, 'beginner')).toBeNull();
    const b5 = planRule(5, 'beginner')!;
    // Jedan kvalitet; udeo dugog, minimum i max nedelje iz reda H15.
    expect([B4.quality, B4.easy, B4.longMaxShare, B4.weekMinKm, B4.peakMaxKm]).toEqual([
      1, 2, 0.4, 16, 70
    ]);
    expect([b5.quality, b5.easy, b5.longMaxShare, b5.weekMinKm, b5.peakMaxKm]).toEqual([
      1, 3, 0.32, 20, 85
    ]);
    expect([B4.feelTest, B4.introWeeks, planRule(4, 'regular')!.feelTest]).toEqual([
      false,
      2,
      true
    ]);
    expect(warmupCooldown(45, true)).toEqual({ warmupSec: 900, cooldownSec: 600 });
    expect(warmupCooldown(45)).toEqual({ warmupSec: 1200, cooldownSec: 900 });
  });

  it('HI10: lestvica T kont. početnika [1,5; 2,0; …]; početni nivo = prvi nivo; T kont. kad prvi nivo faze ne staje', () => {
    expect(ladderLevels('T_continuous', true).map(doseOf).slice(0, 3)).toEqual([1500, 2000, 2500]);
    expect(ladderLevels('T_continuous').map(doseOf)[0]).toBe(2000);
    // Redovan plan bi pri 40 km krenuo od 2,0 km (≤ 60 % plafona 4,0 km); početnik od 1,5 km.
    expect(doseOf(startLevel('T_continuous', 40)!)).toBe(2000);
    expect(doseOf(startLevel('T_continuous', 40, true)!)).toBe(1500);
    // Razvoj 22 km: T cruise 2 × 1200 m > 2,2 km → T kontinuirano; specifično 26 km: RP 4,0 km > 3,9 km.
    expect(buildLadder('development', 22, B4)).toBe('T_continuous');
    expect(buildLadder('development', 24, B4)).toBe('T_cruise');
    expect(buildLadder('specific', 26, B4)).toBe('T_continuous');
    expect(buildLadder('specific', 26.7, B4)).toBe('RP');
    expect(buildLadder('base', 14, B4)).toBeNull();
    expect(buildLadder('development', 22, planRule(3, 'regular')!)).toBe('T_cruise');
    const w = pickBuild(
      {
        ...INITIAL_QUALITY,
        q1: { ladder: 'T_continuous', doseM: 2000, structure: { form: 'continuous', km: 2 } }
      },
      'development',
      22,
      feelPaces(450),
      B4
    )!;
    expect([w.q1!.ladder, w.q1!.doseM, w.q2]).toEqual(['T_continuous', 2000, null]);
  });
});

describe('H17 plan početnika', () => {
  it('uvod 2 ned bez kvaliteta; ned 3 T 1,5 km; jedan kvalitet bez I/R; WU/CD 15/10; bez testa (i po osećaju)', () => {
    const p = plan('b-d4-16w-30km-e450-A');
    const q = (i: number) => p.weeks[i - 1]!.days.filter((d) => d.workout.kind === 'quality');
    expect([q(1).length, q(2).length]).toEqual([0, 0]);
    expect(p.weeks[0]!.days.map((d) => d.role).sort()).toEqual(['easy', 'easy', 'easy', 'long']);
    expect(p.weeks[0]!.notes[0]).toBe(
      'Uvod (H17): nedelja 1 od 2 bez kvaliteta — dan kvaliteta je lagan.'
    );
    expect([q(3)[0]!.workout.dose!.ladder, q(3)[0]!.workout.dose!.doseM]).toEqual([
      'T_continuous',
      1500
    ]);
    for (const w of p.weeks) {
      expect(w.days.filter((d) => d.workout.kind === 'quality').length).toBeLessThanOrEqual(1);
      expect(w.days.some((d) => d.workout.workKm.I > 0 || d.workout.workKm.R > 0)).toBe(false);
      for (const d of w.days.filter((x) => x.workout.kind === 'quality'))
        expect([d.workout.segments[0]!.sec, d.workout.segments.at(-1)!.sec]).toEqual([900, 600]);
      expect(w.test).toBeUndefined();
      expect(w.days.some((d) => d.role === 'test')).toBe(false);
    }
    expect([p.paceBasis, p.predictedHmSec]).toEqual(['feel', null]);
    expect(p.notes[1]).toContain('Početnik bez testa 5 km (H17)');
    expect(p.notes[2]).toContain('Početnik (H17): nedelje 1–2 uvod bez kvaliteta');
  });

  it('rast 5 % (min 1,0, max 2,0 km); vrh min(1,4×, +15, max); dugi ≤ 135 min sporim E', () => {
    const p = plan('b-d4-16w-30km-e450-A');
    expect(p.weeks.slice(0, 3).map((w) => w.targetKm)).toEqual([30, 31.5, 33.1]);
    expect([p.peakCapKm, p.peakKm]).toEqual([42, 42]);
    const big = plan('b-d5-20w-45km-v40-B');
    expect(big.peakCapKm).toBe(60); // min(63, 45 + 15, 85)
    const builds = big.weeks.filter(
      (w) => ['base', 'development', 'specific'].includes(w.phase) && !w.deload
    );
    for (let i = 1; i < builds.length; i++)
      expect(Math.round((builds[i]!.targetKm - builds[i - 1]!.targetKm) * 10)).toBeLessThanOrEqual(
        20
      );
    for (const id of ['b-d4-16w-30km-e450-A', 'b-d5-20w-45km-v40-B', 'b-d4-12w-40km-e330-C']) {
      const x = plan(id);
      for (const w of x.weeks)
        for (const d of w.days.filter((y) => y.role === 'long'))
          expect(d.workout.km * x.paces.E.slow).toBeLessThanOrEqual(8100);
    }
  });

  it('početnik sa rezultatom: tempo iz rezultata (bez paceBasis i RPE), bez testa', () => {
    const p = plan('b-d5-20w-45km-v40-B');
    expect([p.paceBasis, p.vdot, p.input.experience]).toEqual([undefined, 40, 'beginner']);
    expect(p.predictedHmSec).toBe(predictedHm(p.paces));
    expect(p.weeks.some((w) => w.days.some((d) => d.workout.rpe || d.role === 'test'))).toBe(false);
  });

  it('HI10 taper: RP 2 × 2000 m ne staje → T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km), bez oštrenja', () => {
    const p = plan('b-d4-12w-25km-e330-A');
    const t = p.weeks.find((w) => w.phase === 'taper')!;
    const q = t.days.find((d) => d.role === 'q1')!.workout.dose!;
    expect([q.ladder, q.doseM, t.targetKm]).toEqual(['T_continuous', 1500, 24.5]);
    expect(t.notes[0]).toContain('Taper (HI10)');
    expect(p.weeks.at(-1)!.days.some((d) => d.role === 'sharpener')).toBe(false);
    // Rasterećenje u razvoju: 1,5 km kontinuirano pod lestvicom T cruise (nema nivo 1,5 km).
    const d5 = p.weeks[4]!.days.find((d) => d.workout.kind === 'quality')!.workout;
    expect([p.weeks[4]!.deload, d5.dose!.ladder, d5.qualityType, d5.dose!.doseM]).toEqual([
      true,
      'T_cruise',
      'T_continuous',
      1500
    ]);
  });

  it('upozorenje LONG_RUN_SHORT kad je najduži dugi < 14 km (redovan plan: 16 km)', () => {
    const p = plan('b-d5-12w-30km-e330-A');
    const w = p.warnings.find((v) => v.rule === 'LONG_RUN_SHORT')!;
    expect(w.message).toContain('< 14 km (H17)');
    const longest = Math.max(
      ...p.weeks.flatMap((x) => x.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
    );
    expect(longest).toBeLessThan(14);
    expect(plan('b-d4-16w-30km-e450-A').warnings.some((v) => v.rule === 'LONG_RUN_SHORT')).toBe(
      false
    );
  });

  it('trčanje/hodanje: RUN_WALK_NOT_SUPPORTED i za početnika (preporuka 5K plan trčanja/hodanja)', () => {
    const r = generateHmV2({ ...ALL[0]!.input, runWalk: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons.map((x) => x.code)).toEqual(['RUN_WALK_NOT_SUPPORTED']);
      expect(r.reasons[0]!.message).toContain('5K plan trčanja/hodanja');
    }
  });

  it('ZAUSTAVLJENO (SEGMENT-03-STOP.md): 4 d 20 km — prvo rasterećenje neizvodljivo (H5 × H13 × H17)', () => {
    const r = generateHmV2(ALL.find((g) => g.id === 'b-d4-13w-20km-e330-A')!.input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect([r.reasons[0]!.code, r.reasons[0]!.week]).toEqual(['WEEK_INFEASIBLE', 4]);
  });
});

describe('HI13 (pouka 31): rasterećenje u nedelji uvoda ima sadržaj uvoda', () => {
  it('nedelja uvoda označena kao rasteretna: bez kvaliteta, obim rasterećenja, dugi 0,8 × poslednji', () => {
    const chk = checkInput(ALL.find((g) => g.id === 'b-d4-16w-30km-e450-A')!.input);
    if (!chk.ok) throw new Error('ulaz');
    const paces = feelPaces(450);
    const ctx: WeekContext = {
      input: chk.input,
      paces,
      pattern: chk.pattern,
      raceSec: predictedHm(paces),
      wc: warmupCooldown(30, true),
      rule: chk.rule,
      feel: true
    };
    const frame = { ...periodize(chk.input.startDate, 16)![1]!, deload: true };
    const w = buildWeek(ctx, frame, 240, INITIAL_QUALITY, 120, 126)!;
    expect(w.days.filter((d) => d.workout.kind === 'quality')).toHaveLength(0);
    expect(w.days.find((d) => d.role === 'long')!.workout.km).toBe(9.6);
    expect(w.planned100).toBe(2400);
    expect(w.notes[0]).toContain('Rasterećenje u uvodu (HI13, pouka 31)');
  });
});

describe('H17 validator hvata', () => {
  it('kvalitet u uvodu, I kod početnika, dugi > 135 min, WU/CD 20/15, test', () => {
    const p = plan('b-d4-16w-30km-e450-A');
    const a = structuredClone(p);
    const d1 = a.weeks[0]!.days.find((d) => d.weekday === a.pattern.q1)!;
    d1.role = 'q1';
    d1.workout = qualityWorkout(
      {
        ladder: 'T_continuous',
        zone: 'T',
        doseM: 1500,
        structure: { form: 'continuous', km: 1.5 },
        step: 'start'
      },
      p.paces,
      warmupCooldown(30, true),
      true
    );
    expect(errors(a)).toContain('INTRO');
    const b = structuredClone(p);
    const q3 = b.weeks[2]!.days.find((d) => d.role === 'q1')!;
    q3.workout = qualityWorkout(
      {
        ladder: 'I',
        zone: 'I',
        doseM: 2000,
        structure: { form: 'reps', reps: 2, repM: 1000 },
        step: 'start'
      },
      p.paces,
      warmupCooldown(30, true),
      true
    );
    expect(errors(b)).toContain('PHASE_QUALITY');
    const c = structuredClone(p);
    c.paces = { ...c.paces, E: { ...c.paces.E, slow: 1000 } };
    expect(errors(c)).toContain('LONG_DURATION');
    const d = structuredClone(p);
    const q3d = d.weeks[2]!.days.find((x) => x.role === 'q1')!;
    q3d.workout = qualityWorkout(q3d.workout.dose!, p.paces, warmupCooldown(45), true);
    expect(errors(d)).toContain('WARMUP');
    const e = structuredClone(p);
    e.weeks[2]!.test = true;
    expect(errors(e)).toContain('TEST');
  });
});
