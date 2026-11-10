import { describe, expect, it } from 'vitest';
import { adaptBanner, adaptHmV2 } from './adapt.ts';
import { workoutStructure } from './app/structure.ts';
import { addDays, daysBetween, mustDay } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { capM, startLevel } from './quality.ts';
import { beginnerInputs, feelInputs, grid02Inputs, gridInputs } from './testInputs.ts';
import type { HmV2Plan, PlanDay, PlanWeek } from './types.ts';
import { userText } from './userText.ts';
import { validatePlan } from './validate.ts';
import { HOLD_NOTE, RESULT_TEST_NOTE } from './week.ts';
import { doseOf, ladderLevels, stridesOf } from './workouts.ts';

/* Segment P5 (hm-v2.10.0) — F1 kontrolni test u planu sa rezultatom (≥ 12 ned, poslednja ne-rasteretna nedelja razvoja),
   F2 kvalitet u adaptaciji (dva uzastopna zahtevna dana preskočena ili RPE ≥ 9 → nedelja bez rasta doze), F3 ubrzanja na
   jednom laganom danu nedelje, F4 početni nivo T i I ≤ 80 % plafona. */

type Ok = { ok: true; plan: HmV2Plan };
const ok = (r: unknown): HmV2Plan => {
  const x = r as Ok | { ok: false; reasons: { message: string }[] };
  if (!x.ok) throw new Error(x.reasons.map((m) => m.message).join(' | '));
  return x.plan;
};
const ALL = [...grid02Inputs(), ...feelInputs(), ...beginnerInputs()];
const SAMPLE = ALL.filter((_, i) => i % 37 === 0);
const errors = (p: HmV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'development' || w.phase === 'specific';
const plans = SAMPLE.map((g) => ({ id: g.id, input: g.input, plan: ok(generateHmV2(g.input)) }));
const result = (p: HmV2Plan): boolean => !!p.input.recentResult && p.paceBasis === undefined;
const beginner = (p: HmV2Plan): boolean => p.input.experience === 'beginner';

describe('P5-F1: kontrolni test u planu sa rezultatom', () => {
  it('≥ 12 nedelja, ne početnik: tačno jedan test, poslednja ne-rasteretna nedelja razvoja, dan Q1, napomena', () => {
    let n = 0;
    for (const { plan } of plans.filter((x) => result(x.plan) && !beginner(x.plan))) {
      const tests = plan.weeks.filter((w) => w.days.some((d) => d.role === 'test'));
      if (plan.weeks.length < P.test.resultMinWeeks) {
        expect(tests).toEqual([]);
        continue;
      }
      n++;
      const lastDev = plan.weeks.filter((w) => w.phase === 'development' && !w.deload).pop()!;
      expect(tests.map((w) => w.index)).toEqual([lastDev.index]);
      const t = lastDev.days.find((d) => d.role === 'test')!;
      expect(t.weekday).toBe(plan.pattern.q1);
      expect([t.workout.kind, t.workout.dose, t.countsToWeek, t.workout.rpe]).toEqual([
        'test',
        null,
        true,
        undefined
      ]);
      expect(lastDev.test).toBe(true);
      expect(lastDev.notes).toContain(RESULT_TEST_NOTE);
      expect(lastDev.days.some((d) => d.role === 'q1')).toBe(false);
    }
    expect(n).toBeGreaterThan(50);
  });

  it('progresija Q1 posle testa nastavlja od stanja pre testa (prelaz I → RP od poslednjeg I pre testa)', () => {
    const p = ok(generateHmV2(gridInputs().find((g) => g.id === '16w-50km-v45-A-sun')!.input));
    const tw = p.weeks.find((w) => w.test)!;
    const before = p.weeks
      .slice(0, tw.index - 1)
      .filter((w) => isBuild(w) && !w.deload)
      .map((w) => w.days.find((d) => d.role === 'q1')?.workout.dose)
      .filter((d) => d)
      .pop()!;
    const after = p.weeks
      .slice(tw.index)
      .find((w) => isBuild(w) && !w.deload)!
      .days.find((d) => d.role === 'q1')!.workout.dose!;
    expect(before.zone).toBe('I');
    expect(after.zone).toBe('RP');
    expect(after.step).toBe('transition');
    expect(after.doseM).toBeGreaterThanOrEqual(before.doseM);
  });

  it('početnik i plan kraći od 12 nedelja: bez testa; rezultat testa ulazi putem adaptacije (A1)', () => {
    for (const { plan } of plans.filter((x) => beginner(x.plan) && result(x.plan)))
      expect(plan.weeks.some((w) => w.days.some((d) => d.role === 'test'))).toBe(false);
    const p = ok(generateHmV2(gridInputs().find((g) => g.id === '14w-40km-v45-A-sun')!.input));
    const t = p.weeks.flatMap((w) => w.days).find((d) => d.role === 'test')!;
    const r = adaptHmV2(
      p,
      { results: [{ distM: 5000, sec: 1260, date: t.date, kind: 'test' }] },
      t.date
    ) as Ok & { reasons: { condition: string; applied: boolean }[] };
    expect(r.ok).toBe(true);
    expect(r.reasons.find((x) => x.condition === 'NEW_RESULT')!.applied).toBe(true);
    expect(r.plan.vdot).not.toBe(p.vdot);
  });
});

describe('P5-F3: ubrzanja na laganom danu', () => {
  it('svaka nedelja osim trkačke i uvoda: tačno jedan lagan dan; baza/početnik 4 × 20 s, od razvoja 6; km dana isti', () => {
    for (const { plan } of plans) {
      let prevHard: string | null = null;
      for (const w of plan.weeks) {
        const sd = w.days.filter((d) => stridesOf(d.workout) > 0);
        const easy = w.days.filter((d) => d.role === 'easy');
        if (w.phase === 'race' || (beginner(plan) && w.index <= 2) || easy.length === 0)
          expect(sd.filter((d) => d.role === 'easy')).toEqual([]);
        else {
          expect(sd).toHaveLength(1);
          const d = sd[0]!;
          expect(stridesOf(d.workout)).toBe(beginner(plan) || w.phase === 'base' ? 4 : 6);
          // Najveći razmak od prethodnog zahtevnog dana, pri jednakom raniji.
          const gap = (x: PlanDay): number => {
            const h = [
              ...(prevHard ? [prevHard] : []),
              ...w.days.filter((y) => y.hard).map((y) => y.date)
            ]
              .filter((y) => y < x.date)
              .sort()
              .pop();
            return h ? daysBetween(h, x.date) : Infinity;
          };
          const best = Math.max(...easy.map(gap));
          expect(d.date).toBe(easy.find((x) => gap(x) === best)!.date);
          // Dužina dana iz lengths.ts: segmenti u zbiru = km dana, kao lagan dan iste nedelje (5–6 dana: jednaki).
          const sum = Math.round(d.workout.segments.reduce((a, s) => a + s.km, 0) * 100);
          expect(sum).toBe(Math.round(d.workout.km * 100));
          expect(d.workout.workKm).toEqual({ T: 0, I: 0, R: 0, RP: 0 });
        }
        prevHard = w.days.filter((x) => x.hard).pop()?.date ?? prevHard;
      }
      expect(errors(plan)).toEqual([]);
    }
  });

  it('prikaz: blok ubrzanja u strukturi (vrsta stride), naslov bez internih oznaka', () => {
    const { plan } = plans.find((x) => result(x.plan) && x.plan.weeks.length >= 14)!;
    const d = plan.weeks[5]!.days.find((x) => stridesOf(x.workout) > 0)!;
    const s = workoutStructure(d.workout, plan.paces, false);
    expect(s.blocks.some((b) => b.step.kind === 'stride' && b.reps === 6)).toBe(true);
    expect(d.workout.title).toMatch(/^Lagano \d+,\d km, na kraju 6 × 20 s ubrzanja$/);
  });

  it('bol (A4): dan bola nema ubrzanja; ubrzanja idu na drugi slobodan lagan dan', () => {
    const p = ok(generateHmV2(ALL.find((g) => g.id.startsWith('d6-14w-60km'))!.input));
    const w = p.weeks[4]!;
    const asOf = addDays(w.startDate, -1);
    const r = ok(
      adaptHmV2(
        p,
        { workouts: [{ date: asOf, km: 5, durationSec: 1800, completed: true, pain: 5 }] },
        asOf
      )
    );
    let painEasy = 0;
    for (const x of r.weeks)
      for (const d of x.days)
        if (x.limits?.pain?.includes(d.date)) {
          expect(stridesOf(d.workout)).toBe(0);
          if (d.role === 'easy') painEasy++;
        }
    expect(painEasy).toBeGreaterThan(0);
    // Nedelja posle perioda bola opet ima ubrzanja.
    const after = r.weeks.find((x) => x.index > 6 && x.phase !== 'race')!;
    expect(after.days.filter((d) => stridesOf(d.workout) > 0)).toHaveLength(1);
    expect(errors(r)).toEqual([]);
  });
});

describe('P5-F4: početni nivo T i I ≤ 80 % plafona', () => {
  it('prva nedelja T i prvi I: najviši nivo ≤ 80 % plafona; R i RP ostaju 60 %; početnik prvi nivo', () => {
    let tChecked = 0;
    let lowered = 0;
    for (const { plan } of plans.filter((x) => !beginner(x.plan))) {
      const w1 = plan.weeks[0]!;
      for (const d of w1.days.filter((x) => x.workout.dose)) {
        const dose = d.workout.dose!;
        // Pouka 32 sme da spusti početnu dozu (dan kvaliteta ≤ dugi) — korak 'drop', napomena; ovde se ne sudi.
        if (dose.step === 'drop') continue;
        expect(dose.step).toBe('start');
        // P8 G4/G2: plafon zone je min(udeo, minuti po tempu plana), najmanje prvi nivo lestvice.
        const s = startLevel(dose.ladder as never, w1.targetKm, false, undefined, plan.paces)!;
        const share = dose.zone === 'T' || dose.zone === 'I' ? 0.8 : 0.6;
        const cap = capM(
          dose.zone,
          w1.targetKm,
          plan.paces,
          doseOf(ladderLevels(dose.ladder as never)[0]!)
        );
        // Najmanje prvi nivo lestvice (i kad je iznad udela).
        if (doseOf(s) > share * cap) {
          expect(dose.doseM).toBe(doseOf(s));
          continue;
        }
        expect(dose.doseM).toBeLessThanOrEqual(share * cap + 1e-6);
        // Najviši takav nivo (nezavisno od startLevel): sledeći nivo lestvice je iznad udela — osim kad bi dan bio duži
        // od dugog (odluka F4 × pouka 32): tada nivo između 60 % i 80 % ili nivo po 60 %.
        const next = ladderLevels(dose.ladder as never)
          .map(doseOf)
          .find((m) => m > dose.doseM);
        if (dose.doseM < doseOf(s)) {
          expect(dose.doseM).toBeGreaterThanOrEqual(
            doseOf(startLevel(dose.ladder as never, w1.targetKm, false, 0.6, plan.paces)!)
          );
          lowered++;
        } else if (next !== undefined) expect(next).toBeGreaterThan(share * cap + 1e-6);
        if (dose.zone === 'T') tChecked++;
      }
    }
    expect(tChecked).toBeGreaterThan(30);
    expect(lowered).toBeLessThan(tChecked);
    for (const { plan } of plans.filter((x) => beginner(x.plan))) {
      const q = plan.weeks.flatMap((w) => w.days).find((d) => d.workout.dose)!;
      expect(q.workout.dose!.doseM).toBe(1500);
    }
  });
});

describe('P5-F2: kvalitet u adaptaciji', () => {
  const p = ok(generateHmV2(gridInputs().find((g) => g.id === '16w-50km-v45-A-sun')!.input));
  const qd = p.weeks
    .filter((w) => w.phase === 'base' && !w.deload)
    .flatMap((w) => w.days.filter((d) => d.role === 'q1' || d.role === 'q2'));
  const [d1, d2] = [qd[0]!, qd[1]!];
  const asOf = d2.date;
  const from = addDays(asOf, -13);
  const days = p.weeks
    .flatMap((w) => w.days)
    .filter((d) => mustDay(d.date) <= mustDay(asOf) && mustDay(d.date) >= mustDay(from));
  const facts = (rpe: (d: PlanDay) => number | null, extra: object[] = []) => ({
    workouts: [
      ...days.map((d) =>
        rpe(d) === null
          ? { date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }
          : {
              date: d.date,
              dayId: d.date,
              km: d.workout.km,
              durationSec: d.workout.sec,
              completed: true,
              rpe: rpe(d)
            }
      ),
      ...extra
    ],
    coverage: { from: p.weeks[0]!.startDate, to: asOf, complete: true }
  });
  const hard = (d: PlanDay): number => (d.date === d1.date || d.date === d2.date ? 9 : 4);
  const adapt = (f: unknown, at = asOf) =>
    adaptHmV2(p, f, at) as Ok & {
      reasons: { condition: string; applied: boolean; message: string }[];
    };

  it('dva uzastopna RPE ≥ 9 → nedelja n bez rasta doze (napomena, traka); cilj obima isti', () => {
    const r = adapt(facts(hard));
    expect(r.ok).toBe(true);
    const q = r.reasons.find((x) => x.condition === 'QUALITY_STRAIN')!;
    expect(q.applied).toBe(true);
    expect(q.message).toContain(P.adapt.strainMessage);
    const step = r.plan.adaptation!.steps.at(-1)!;
    const n = step.qualityHold!;
    expect(n).toBe(step.fromWeek);
    const w = r.plan.weeks[n - 1]!;
    const prev = r.plan.weeks
      .slice(0, n - 1)
      .filter((x) => isBuild(x) && !x.deload)
      .pop()!;
    for (const role of ['q1', 'q2'] as const) {
      const a = prev.days.find((d) => d.role === role)?.workout.dose;
      const b = w.days.find((d) => d.role === role)?.workout.dose;
      if (a && b && a.ladder === b.ladder) expect(b.doseM).toBeLessThanOrEqual(a.doseM);
    }
    expect(w.notes).toContain(HOLD_NOTE);
    expect(userText(HOLD_NOTE)).not.toMatch(/F2/);
    expect(w.targetKm).toBe(p.weeks[n - 1]!.targetKm);
    // Bez okidača ista nedelja raste (dokaz da je efekat od F2).
    const r0 = adapt(facts(() => 4));
    expect(r0.reasons.some((x) => x.condition === 'QUALITY_STRAIN')).toBe(false);
    expect(JSON.stringify(r0.plan.weeks[n - 1]!.days)).not.toBe(JSON.stringify(w.days));
    expect(adaptBanner(p, r as never, facts(hard) as never, asOf)).toContain(q.message);
    expect(errors(r.plan)).toEqual([]);
  });

  it('preskočeni (bez zapisa) i jedan RPE ≥ 9 okidaju; RPE 8 ne; isti zapisi sutra ne prave nov korak', () => {
    const skip = adapt(facts((d) => (d.date === d1.date ? null : hard(d))));
    expect(skip.reasons.find((x) => x.condition === 'QUALITY_STRAIN')!.applied).toBe(true);
    // Odluka 10. 11. 00:41: trčanje van plana (uvoz, bez dayId) na dan kvaliteta = odrađen dan — bez okidača.
    const offPlan = adapt(
      facts(
        (d) => (d.date === d1.date || d.date === d2.date ? null : 4),
        [d1, d2].map((d) => ({ date: d.date, km: 8, durationSec: 2700, completed: true }))
      )
    );
    expect(offPlan.reasons.some((x) => x.condition === 'QUALITY_STRAIN')).toBe(false);
    const bothSkipped = adapt(facts((d) => (d.date === d1.date || d.date === d2.date ? null : 4)));
    expect(bothSkipped.reasons.find((x) => x.condition === 'QUALITY_STRAIN')!.applied).toBe(true);
    const eight = adapt(facts((d) => (hard(d) === 9 ? 8 : 4)));
    expect(eight.reasons.some((x) => x.condition === 'QUALITY_STRAIN')).toBe(false);
    const r = adapt(facts(hard));
    const next = addDays(asOf, 1);
    const f2 = {
      ...facts(hard),
      coverage: { from: p.weeks[0]!.startDate, to: next, complete: true }
    };
    const r2 = adaptHmV2(r.plan, f2, next) as Ok & {
      reasons: { condition: string; applied: boolean }[];
    };
    expect(r2.ok).toBe(true);
    expect(r2.reasons.find((x) => x.condition === 'QUALITY_STRAIN')!.applied).toBe(false);
    expect(r2.plan.adaptation!.steps.at(-1)!.qualityHold).toBeUndefined();
  });

  it('prioritet: bol i umor nadjačavaju (applied false); nepotpuna pokrivenost — bez okidača', () => {
    const pain = adapt(
      facts(hard, [{ date: asOf, km: 3, durationSec: 1200, completed: true, pain: 5 }])
    );
    expect(pain.reasons.find((x) => x.condition === 'PAIN')!.applied).toBe(true);
    expect(pain.reasons.find((x) => x.condition === 'QUALITY_STRAIN')!.applied).toBe(false);
    expect(pain.plan.adaptation!.steps.at(-1)!.qualityHold).toBeUndefined();
    const fat = adapt(
      facts(hard, [
        { date: addDays(asOf, -1), km: 5, durationSec: 1800, completed: true, rpe: 7 },
        { date: addDays(asOf, -3), km: 5, durationSec: 1800, completed: true, rpe: 7 }
      ])
    );
    expect(fat.reasons.find((x) => x.condition === 'FATIGUE')!.applied).toBe(true);
    expect(fat.reasons.find((x) => x.condition === 'QUALITY_STRAIN')!.applied).toBe(false);
    const nocov = adapt({ workouts: facts(hard).workouts });
    expect(nocov.reasons.some((x) => x.condition === 'QUALITY_STRAIN')).toBe(false);
  });

  it('nedelja n taper: bez efekta', () => {
    const tw = p.weeks.find((w) => w.phase === 'taper')!;
    const spec = p.weeks
      .filter((w) => w.index < tw.index && isBuild(w))
      .flatMap((w) =>
        w.days.filter(
          (d) =>
            d.role === 'q1' || d.role === 'q2' || (d.role === 'long' && d.workout.workKm.RP > 0)
        )
      )
      .slice(-2);
    const at = addDays(tw.startDate, -1);
    const ws = p.weeks
      .flatMap((w) => w.days)
      .filter((d) => mustDay(d.date) <= mustDay(at) && mustDay(d.date) > mustDay(at) - 14)
      .map((d) => ({
        date: d.date,
        dayId: d.date,
        km: d.workout.km,
        durationSec: d.workout.sec,
        completed: true,
        rpe: spec.some((x) => x.date === d.date) ? 9 : 4
      }));
    const r = adapt(
      { workouts: ws, coverage: { from: addDays(at, -13), to: at, complete: true } },
      at
    );
    expect(r.reasons.find((x) => x.condition === 'QUALITY_STRAIN')!.applied).toBe(false);
  });
});
