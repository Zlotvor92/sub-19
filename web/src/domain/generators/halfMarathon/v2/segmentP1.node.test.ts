import { describe, expect, it } from 'vitest';
import { adaptHmV2 } from './adapt.ts';
import { workoutStructure } from './app/structure.ts';
import { dayWorkoutText } from './app/watch.ts';
import { generateHmV2 } from './generate.ts';
import { checkPlan, emptyStats } from './gridInvariants.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { capM, capShare } from './quality.ts';
import { mainDoseM, scheduledType } from './specific.ts';
import { beginnerInputs, feelInputs, grid02Inputs } from './testInputs.ts';
import type { HmV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';

/* Segment P1 (hm-v2.9.0) — specifičnost polumaratona: S1 nedelja tipa B (RP trening + Q2 lagan + blok RP na kraju
   dugog; raspored unazad od poslednje ne-rasteretne nedelje izgradnje), S2 plafon RP po pojasu cilja i lestvica do
   3 × 5000 m, S3 adaptacija (umor ne broji dugi sa blokom kao lagan), S4 prikaz; H12 O1 (glavna doza unutar tipa). */

type Ok = { ok: true; plan: HmV2Plan };
const ok = (r: unknown): HmV2Plan => {
  const x = r as Ok | { ok: false; reasons: { message: string }[] };
  if (!x.ok) throw new Error(x.reasons.map((m) => m.message).join(' | '));
  return x.plan;
};
const ALL = [...grid02Inputs(), ...feelInputs(), ...beginnerInputs()];
const input = (id: string): Record<string, unknown> => ALL.find((x) => x.id === id)!.input;
const blockOf = (w: PlanWeek): number =>
  w.days.find((d) => d.role === 'long' && d.workout.kind === 'long')?.workout.workKm.RP ?? 0;
const errors = (p: HmV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
/** Uzorak mreže 02 + 03 (svaki 23. ulaz, svi brojevi dana, sa rezultatom, po osećaju, početnik). */
const SAMPLE = ALL.filter((_, i) => i % 23 === 0);

describe('P1-S1: nedelja tipa B', () => {
  const plans = SAMPLE.map((g) => ({ id: g.id, plan: ok(generateHmV2(g.input)) }));

  it('uzorak: 0 odbijanja, validator bez grešaka, nezavisne invarijante 0', () => {
    expect(plans.length).toBeGreaterThan(500);
    const bad: Record<string, string[]> = {};
    const st = emptyStats();
    for (const { id, plan } of plans) {
      expect(errors(plan)).toEqual([]);
      checkPlan(id, plan, bad, st);
    }
    expect(bad).toEqual({});
  });

  it('blok samo u nedelji po rasporedu B (poslednja ne-rasteretna specifična, unazad A, B), plan 3–6 dana (K4-A), ne početnik', () => {
    let bWeeks = 0;
    let b3 = 0;
    for (const { plan } of plans) {
      const one = plan.input.experience === 'beginner';
      const three = plan.pattern.q2 === null;
      plan.weeks.forEach((w, i) => {
        const bk = blockOf(w);
        if (bk === 0) return;
        bWeeks++;
        expect(one).toBe(false);
        expect(w.phase).toBe('specific');
        expect(w.deload).toBe(false);
        expect(scheduledType(plan.weeks, i)).toBe('B');
        expect(P.specific.blockKm).toContain(bk);
        const long = w.days.find((d) => d.role === 'long')!;
        expect(bk).toBeLessThanOrEqual(P.specific.blockMaxLongShare * long.workout.km + 1e-9);
        expect(Math.round(bk * 1000)).toBeLessThanOrEqual(capM('RP', w.targetKm));
        // RP trening ostaje, drugi dan kvaliteta (T) je lagan; dugi ostaje najduži trening.
        // K4-A: 3 dana — jedini dan kvaliteta je lagan.
        if (three) {
          b3++;
          expect(w.days.filter((d) => d.workout.kind === 'quality')).toEqual([]);
          expect(w.days.find((d) => d.weekday === plan.pattern.q1)!.role).toBe('easy');
        } else {
          expect(w.days.filter((d) => d.workout.kind === 'quality').map((d) => d.role)).toEqual([
            'q1'
          ]);
          expect(w.days.find((d) => d.role === 'q1')!.workout.dose!.zone).toBe('RP');
          expect(w.days.find((d) => d.weekday === plan.pattern.q2)!.role).toBe('easy');
        }
        expect(long.workout.title).toMatch(
          /^Dugi \d+,\d km: \d+,\d km lagano \+ \d,\d km u trkačkom tempu$/
        );
      });
      // Blokovi rastu redom nedelja B (jedan nivo po nedelji B).
      const bs = plan.weeks.map(blockOf).filter((x) => x > 0);
      for (let k = 1; k < bs.length; k++) expect(bs[k]!).toBeGreaterThanOrEqual(bs[k - 1]!);
      // Rasterećenje, taper i trkačka nedelja: dugi lagan.
      for (const w of plan.weeks)
        if (w.deload || w.phase === 'taper' || w.phase === 'race') expect(blockOf(w)).toBe(0);
    }
    expect(bWeeks).toBeGreaterThan(100);
    expect(b3).toBeGreaterThan(0);
  });

  it('profil 4 dana, 16 ned: raspored A, B, rasterećenje, A, B i blokovi 4 → 6 km', () => {
    const p = ok(generateHmV2(input('d4-16w-40km-v45-A-sun')));
    const spec = p.weeks.filter((w) => w.phase === 'specific');
    expect(spec.map((w) => (w.deload ? 'R' : blockOf(w) > 0 ? 'B' : 'A')).join('')).toMatch(/B$/);
    // P8-HM (b): rad u trkačkom tempu nedelje sa blokom ≤ 22 % vremena nedelje — drugi blok ostaje 4 km (bilo 6 km).
    const blocks = spec.filter((w) => blockOf(w) > 0);
    expect(blocks.map(blockOf)).toEqual([4, 4]);
    for (const w of blocks) {
      const sec = w.days.reduce((a, d) => a + d.workout.sec, 0);
      const rp = w.days.reduce(
        (a, d) =>
          a +
          d.workout.segments
            .filter((x) => x.zone === 'RP' && (x.kind === 'rep' || x.kind === 'continuous'))
            .reduce((c, x) => c + x.sec, 0),
        0
      );
      expect(rp / sec).toBeLessThanOrEqual(0.22 + 0.005);
    }
  });

  it('H12 O1: glavna doza (sa blokom) ne opada unutar tipa; RP trening ne opada iz nedelje u nedelju', () => {
    for (const { plan } of plans) {
      let lastA = -1;
      let lastB = -1;
      let lastRp = 0;
      for (const w of plan.weeks) {
        if (w.deload || w.test || !['base', 'development', 'specific'].includes(w.phase)) continue;
        if (w.notes.some((n) => n.includes('pouka 35') || n.includes('pouka 32, plafon zone')))
          continue;
        if (w.days.some((d) => d.workout.dose?.step === 'drop')) continue;
        const m = mainDoseM(w);
        if (blockOf(w) > 0) {
          expect(m).toBeGreaterThanOrEqual(lastB);
          lastB = m;
        } else if (w.days.some((d) => d.workout.kind === 'quality')) {
          expect(m).toBeGreaterThanOrEqual(lastA);
          lastA = m;
        }
        const rp = w.days.find((d) => d.role === 'q1' && d.workout.dose?.zone === 'RP');
        if (rp) {
          expect(rp.workout.dose!.doseM).toBeGreaterThanOrEqual(lastRp);
          lastRp = rp.workout.dose!.doseM;
        }
      }
    }
  });
});

describe('P1-S2: plafon RP po pojasu cilja i lestvica', () => {
  it('cilj < 40 km 15 %, ≥ 40 km 20 %; lestvica do 3 × 5000 m', () => {
    expect(capShare('RP', 39.9)).toBe(0.15);
    expect(capShare('RP', 40)).toBe(0.2);
    expect(capM('RP', 39.9)).toBe(5985);
    expect(capM('RP', 75)).toBe(15000);
    expect(P.ladders.RP.at(-1)).toEqual({ reps: 3, repM: 5000 });
  });

  it('nijedan trening (ni blok) preko plafona RP pojasa', () => {
    for (const g of SAMPLE) {
      const p = ok(generateHmV2(g.input));
      for (const w of p.weeks)
        if (w.phase !== 'race')
          for (const d of w.days)
            // P8 G2: najmanja doza trkačkog tempa (2 × 2000 m; oštrenje je manje) uvek staje — osim bloka u dugom.
            expect(Math.round(d.workout.workKm.RP * 1000)).toBeLessThanOrEqual(
              Math.max(
                d.role === 'long' || w.deload ? 0 : 4000,
                Math.floor((w.targetKm >= 40 ? 0.2 : 0.15) * w.targetKm * 1000 + 1e-6)
              )
            );
    }
  });
});

describe('P1-T: taper', () => {
  it('RP tapera ≤ plafon RP cilja tapera; taper ima RP kad 2 × 2000 m staje u plafon', () => {
    for (const g of SAMPLE) {
      const p = ok(generateHmV2(g.input));
      const t = p.weeks.find((w) => w.phase === 'taper')!;
      const rp = t.days.find((d) => d.workout.dose?.zone === 'RP');
      if (rp)
        expect(rp.workout.dose!.doseM).toBeLessThanOrEqual(capM('RP', t.targetKm, undefined, 4000)); // P8 G2: 2 × 2000 m uvek staje
      else if (g.input['experience'] !== 'beginner')
        expect(4000).toBeGreaterThan(capM('RP', t.targetKm));
    }
  });
});

describe('P1-S3: adaptacija', () => {
  // Plan u kome posle nedelje B dolazi ne-rasteretna nedelja izgradnje (tamo A5 pravi prinudno rasterećenje).
  const found = grid02Inputs()
    .filter((g) => g.id.startsWith('d4-') && g.id.endsWith('-A-sun'))
    .map((g) => ok(generateHmV2(g.input)))
    .map((plan) => ({
      plan,
      i: plan.weeks.findIndex(
        (w, i) =>
          blockOf(w) > 0 && plan.weeks[i + 1]?.phase === 'specific' && !plan.weeks[i + 1]!.deload
      )
    }))
    .find((x) => x.i >= 0)!;
  const p = found.plan;
  const bw = p.weeks[found.i]!;
  const long = bw.days.find((d) => d.role === 'long')!;
  // Lagani dani nedelje B (i dan Q2, koji je lagan); dva poslednja pre dugog.
  const easies = bw.days.filter((d) => d.role === 'easy' && d.date < long.date);
  const easy = easies.at(-1)!;
  const easy2 = easies.at(-2)!;
  const fact = (d: typeof long) => ({
    date: d.date,
    dayId: d.date,
    km: d.workout.km,
    durationSec: d.workout.sec,
    completed: true,
    rpe: 8
  });

  it('umor (A5): dugi sa blokom RP i RPE 8 nije lagan trening — sa jednim laganim RPE 8 nema prinudnog rasterećenja', () => {
    const plan = ok(adaptHmV2(p, { workouts: [fact(easy), fact(long)] }, long.date));
    expect(plan.adaptation!.steps.at(-1)!.deload).toBe(false);
    // Kontrola: dva lagana sa RPE 8 u istom prozoru daju prinudno rasterećenje sledeće nedelje.
    expect(easy2.date).not.toBe(easy.date);
    const c = ok(adaptHmV2(p, { workouts: [fact(easy2), fact(easy)] }, long.date));
    expect(c.adaptation!.steps.at(-1)!.deload).toBe(true);
  });

  it('bol (A4) u nedelji B: dugi te nedelje je lagan, validator bez grešaka', () => {
    const p = ok(generateHmV2(input('d4-16w-40km-v45-A-sun')));
    const bw = p.weeks.find((w) => blockOf(w) > 0)!;
    const asOf = bw.startDate;
    const r = adaptHmV2(
      p,
      { workouts: [{ date: asOf, km: 5, durationSec: 1800, completed: true, pain: 5 }] },
      asOf
    );
    const plan = ok(r);
    const w = plan.weeks[bw.index - 1]!;
    expect(blockOf(w)).toBe(0);
    expect(errors(plan)).toEqual([]);
  });
});

describe('P1-S4: prikaz dugog sa blokom', () => {
  it('struktura: lagan deo (opseg E) + rad RP (tempo RP); tekst za sat postoji', () => {
    const p = ok(generateHmV2(input('d4-16w-40km-v45-A-sun')));
    const w = p.weeks.find((x) => blockOf(x) > 0)!;
    const long = w.days.find((d) => d.role === 'long')!;
    const s = workoutStructure(long.workout, p.paces, false);
    expect(s.title).toBe(long.workout.title);
    expect(s.blocks.map((b) => [b.step.kind, b.step.zone])).toEqual([
      ['long', 'E'],
      ['work', 'RP']
    ]);
    expect(s.blocks[1]!.step.paceSec).toBe(p.paces.RP);
    expect(s.blocks[0]!.step.paceRange).toEqual({ fast: p.paces.E.fast, slow: p.paces.E.slow });
    expect(dayWorkoutText({ rest: false, tag: 'lr', structure: s })).toContain('\n');
    expect(s.title).not.toMatch(/P1|S1|RP\b|pouka|H\d/);
  });
});
