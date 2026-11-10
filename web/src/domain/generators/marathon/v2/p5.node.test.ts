import { describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { userText } from './app/format.ts';
import { addDays, daysBetween } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { testKindOf, testWeekOf } from './periodize.ts';
import { pacesFromVdot } from './paces.ts';
import { MARATHON_V2_POLICY as P, planRule } from './policy.ts';
import { pickSlot, startLevel, startShareOf } from './quality.ts';
import { stridesDateOf } from './strides.ts';
import { inputOf, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { MarathonV2Facts, MarathonV2Plan, PlanDay, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { TEST_NOTE_RESULT } from './week.ts';
import { doseOf, easyWorkout } from './workouts.ts';

/** P8-G4: brz tempo — član plafona u minutima ne veže (testovi udela M11). */
const FASTP = pacesFromVdot(75, 75);

/* P5 (marathon-v2.10.0): F1 kontrolni test u planu sa rezultatom, F2 (A18) kvalitet u adaptaciji, F3 ubrzanja na
   laganom danu, F4 početna doza T/I ≤ 80 % plafona. */

const PROFILE_A = {
  startDate: '2026-11-02',
  raceDate: '2027-02-21',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  longRunDay: 'sun',
  currentWeeklyKm: 40,
  recentResult: { distanceM: 10000, timeSec: 2760, date: '2026-10-19' },
  goalTimeSec: null,
  recentLongRunKm: 14
};
const gen = (x: unknown): MarathonV2Plan => {
  const r = generateMarathonV2(x);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const errors = (p: MarathonV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => `${v.rule}@${v.week ?? '-'}`);
const A = gen(PROFILE_A);
const strided = (w: PlanWeek): PlanDay[] =>
  w.days.filter((d) => d.role === 'easy' && d.workout.segments.some((s) => s.kind === 'stride'));

describe('F1: kontrolni test u planu sa rezultatom', () => {
  it('profil (a): tačno jedan test, poslednja ne-rasteretna nedelja razvoja, dan Q1, napomena; plan ispravan', () => {
    const tw = A.weeks.filter((w) => w.days.some((d) => d.role === 'test'));
    expect(tw).toHaveLength(1);
    const w = tw[0]!;
    const lastDev = [...A.weeks].reverse().find((x) => x.phase === 'development' && !x.deload)!;
    expect(w.index).toBe(lastDev.index);
    expect(w.test).toBe(true);
    expect(w.days.find((d) => d.role === 'test')!.weekday).toBe(A.pattern.q1);
    expect(w.notes).toContain(TEST_NOTE_RESULT);
    expect(userText(TEST_NOTE_RESULT)).not.toMatch(/M16|F1/);
    expect(errors(A)).toEqual([]);
  });
  it('vrsta testa: po osećaju (kraj baze), sa rezultatom (razvoj), početnik bez testa', () => {
    const reg = planRule(4)!;
    const beg = planRule(4, 'beginner')!;
    expect(testKindOf(reg, true, 16)).toBe('feel');
    expect(testKindOf(reg, false, 12)).toBe('result');
    expect(testKindOf(beg, false, 16)).toBeNull();
    expect(testKindOf(beg, true, 16)).toBeNull();
    expect(
      testWeekOf(['base', 'base', 'base', 'development', 'development', 'specific'], 'result', [5])
    ).toBe(4);
    // P8-G7: test koji bi pao pre nedelje 4 — prva ne-rasteretna nedelja ≥ 4 iste faze, inače bez testa.
    expect(testWeekOf(['base', 'development', 'development', 'specific'], 'result', [3])).toBe(0);
    expect(testWeekOf(['base', 'base', 'base', 'development'], 'feel', [])).toBe(0);
    expect(testWeekOf(['base', 'base', 'base', 'base', 'base', 'development'], 'feel', [5])).toBe(
      5
    );
    expect(testWeekOf(['base', 'specific'], 'result', [])).toBe(0);
  });
  it('rezultat testa ulazi postojećim putem (A1): tempo od sledeće nedelje, test ne ostaje u budućnosti', () => {
    const tw = A.weeks.find((w) => w.test)!;
    const td = tw.days.find((d) => d.role === 'test')!;
    const facts: MarathonV2Facts = {
      results: [{ distM: 5000, sec: 1260, date: td.date, kind: 'test' }]
    };
    const r = adaptMarathonV2(A, facts, td.date);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons).slice(0, 800));
    expect(r.reasons.find((x) => x.condition === 'NEW_RESULT')?.applied).toBe(true);
    expect(r.plan.weeks.filter((w) => w.days.some((d) => d.role === 'test'))).toHaveLength(1);
    expect(r.plan.weeks[tw.index]!.days[0]!.workout).not.toEqual(
      A.weeks[tw.index]!.days[0]!.workout
    );
  });
  it('bol u nedelji testa: test plana sa rezultatom otpada (ne premešta se) uz poruku', () => {
    const tw = A.weeks.find((w) => w.test)!;
    const at = A.weeks[tw.index - 2]!.endDate;
    const facts: MarathonV2Facts = {
      workouts: [{ date: at, dayId: at, km: 5, durationSec: 1800, completed: true, pain: 5 }]
    };
    const r = adaptMarathonV2(A, facts, at);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons).slice(0, 800));
    expect(r.plan.weeks.some((w) => w.days.some((d) => d.role === 'test'))).toBe(false);
    const m = r.reasons.find((x) => x.condition === 'TEST_MOVED')!;
    expect(m.message).toContain('Kontrolni test 5 km');
  });
  it('sabotaža: test pomeren u drugu nedelju → TEST', () => {
    const q = structuredClone(A);
    const tw = q.weeks.find((w) => w.test)!;
    delete tw.test;
    q.weeks[tw.index - 2]!.test = true;
    expect(errors(q).some((e) => e.startsWith('TEST'))).toBe(true);
  });
});

describe('F3: ubrzanja na laganom danu', () => {
  it('svaka nedelja osim trkačke: tačno jedan lagan dan, baza 4 × 20 s, dalje 6 × 20 s; km dana isti; na kraju', () => {
    for (const w of A.weeks) {
      const s = strided(w);
      if (w.phase === 'race') {
        expect(s).toHaveLength(0);
        continue;
      }
      expect(s, `ned ${w.index}`).toHaveLength(1);
      const k = s[0]!.workout.segments.filter((x) => x.kind === 'stride');
      expect(k).toHaveLength(w.phase === 'base' ? 4 : 6);
      expect(k.every((x) => x.sec === 20 && x.zone === 'R')).toBe(true);
      expect(s[0]!.workout.segments.at(-1)!.kind).toBe('stride');
      const km100 = s[0]!.workout.segments.reduce((a, x) => a + Math.round(x.km * 100), 0);
      expect(km100).toBe(Math.round(s[0]!.workout.km * 100));
      expect(Math.round(s[0]!.workout.km * 10)).toBe(s[0]!.workout.km * 10);
    }
  });
  it('dan: najveći razmak od prethodnog zahtevnog dana, pri jednakom raniji', () => {
    const d = (date: string, role: PlanDay['role'], hard: boolean): PlanDay =>
      ({ date, weekday: 'mon', role, hard, countsToWeek: true, workout: {} }) as unknown as PlanDay;
    // ned (dugi) → pon lagan (1), uto Q1, sre lagan (1), čet lagan (2), pet Q2, sub lagan (1)
    const days = [
      d('2026-11-02', 'easy', false),
      d('2026-11-03', 'q1', true),
      d('2026-11-04', 'easy', false),
      d('2026-11-05', 'easy', false),
      d('2026-11-06', 'q2', true),
      d('2026-11-07', 'easy', false)
    ];
    expect(stridesDateOf(days, {}, '2026-11-01')).toBe('2026-11-05');
    expect(stridesDateOf(days, { limits: { noQuality: ['2026-11-05'] } }, '2026-11-01')).toBe(
      '2026-11-02'
    );
    expect(stridesDateOf(days.slice(0, 2), {}, null)).toBe('2026-11-02');
    expect(stridesDateOf([days[1]!], {}, null)).toBeNull();
  });
  it('početnik: uvod bez ubrzanja, zatim 4 × 20 s', () => {
    const b = gen(
      inputOf({
        weeks: 16,
        km: 35,
        vdot: 35,
        days: SCHEDULES_BY_DAYS[4].A.days,
        experience: 'beginner'
      })
    );
    for (const w of b.weeks.filter((x) => x.phase !== 'race'))
      expect(strided(w).length, `ned ${w.index}`).toBe(w.index <= 2 ? 0 : 1);
    for (const w of b.weeks.slice(2, -1))
      expect(strided(w)[0]!.workout.segments.filter((x) => x.kind === 'stride')).toHaveLength(4);
  });
  it('sabotaža: dan bez ubrzanja (lagan iste dužine) → STRIDES', () => {
    const q = structuredClone(A);
    const s = strided(q.weeks[0]!)[0]!;
    s.workout = easyWorkout(s.workout.km, q.paces);
    expect(errors(q)).toContain('STRIDES@1');
  });
});

describe('F4: početna doza T i I ≤ 80 % plafona, R i MP 60 %, početnik prvi nivo', () => {
  it('udeli i nivoi', () => {
    expect(startShareOf('T_continuous')).toBe(0.8);
    expect(startShareOf('T_cruise')).toBe(0.8);
    expect(startShareOf('I')).toBe(0.8);
    expect(startShareOf('R')).toBe(0.6);
    expect(startShareOf('MP')).toBe(0.6);
    // 50 km: T 5000 m → 4000 → T kont. 4,0; I 4000 → 3200 → 3 × 1000; R 2500 → 1500 → 6 × 200.
    expect(doseOf(startLevel('T_continuous', 50, FASTP)!)).toBe(4000);
    expect(doseOf(startLevel('I', 50, FASTP)!)).toBe(3000);
    expect(doseOf(startLevel('R', 50, FASTP)!)).toBe(1200);
    expect(doseOf(startLevel('T_continuous', 50, FASTP, true)!)).toBe(1500);
  });
  it('profil (a): prvi T 4,0 km ili više nego pre (2,0 km na marathon-v2.9.0); plan ispravan', () => {
    const t = A.weeks.flatMap((w) => w.days).find((d) => d.workout.dose?.zone === 'T')!.workout
      .dose!;
    expect(t.doseM).toBeGreaterThan(2000);
  });
});

describe('F2 (A18): kvalitet u adaptaciji', () => {
  // Profil (a): zapisi do asOf, svi dani odrađeni po planu; dva poslednja kvalitetna dana RPE 9 (ili neodrađena).
  const qualityDays = (p: MarathonV2Plan, asOf: string): PlanDay[] =>
    p.weeks
      .flatMap((w) => w.days)
      .filter(
        (d) =>
          (d.role === 'q1' || d.role === 'q2' || (d.role === 'long' && d.workout.workKm.MP > 0)) &&
          d.workout.kind !== 'test' &&
          daysBetween(d.date, asOf) >= 0
      );
  const factsOf = (p: MarathonV2Plan, asOf: string, mode: 'rpe9' | 'skip' | 'one' | 'none') => {
    const from = addDays(asOf, -27);
    const q = qualityDays(p, asOf).slice(-2);
    const hard = new Set(
      mode === 'one' ? [q[1]!.date] : mode === 'none' ? [] : q.map((d) => d.date)
    );
    return {
      coverage: { from, to: asOf, complete: true },
      workouts: p.weeks
        .flatMap((w) => w.days)
        .filter((d) => d.date >= from && d.date <= asOf && d.role !== 'race')
        .map((d) =>
          hard.has(d.date) && mode === 'skip'
            ? { date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }
            : {
                date: d.date,
                dayId: d.date,
                km: d.workout.km,
                durationSec: d.workout.sec,
                completed: true,
                rpe: hard.has(d.date) ? 9 : 5
              }
        )
    };
  };
  const asOf = A.weeks[4]!.days.filter((d) => d.role === 'q2')[0]!.date;
  const run = (mode: 'rpe9' | 'skip' | 'one' | 'none', at = asOf, p = A) => {
    const r = adaptMarathonV2(p, factsOf(p, at, mode), at);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons).slice(0, 800));
    return r;
  };
  it('dva uzastopna RPE ≥ 9 ili preskočena → sledeća nedelja izgradnje bez rasta doze; cilj obima isti; poruka', () => {
    for (const mode of ['rpe9', 'skip'] as const) {
      const r = run(mode);
      const qr = r.reasons.find((x) => x.condition === 'QUALITY_HARD')!;
      // Preskočena dva kvaliteta mogu da daju i manjak izvršenja (A2), koji ima prednost.
      const under = r.reasons.find((x) => x.condition === 'UNDER_EXECUTION')?.applied === true;
      expect(qr.applied, mode).toBe(!under);
      if (under) continue;
      expect(userText(qr.message)).toContain('doza ove nedelje ne raste');
      const hw = r.plan.adaptation!.steps.at(-1)!.holdDose!;
      const w = r.plan.weeks[hw - 1]!;
      expect(w.deload).toBe(false);
      const prev = r.plan.weeks
        .slice(0, hw - 1)
        .filter((x) => !x.deload && !x.test)
        .pop()!;
      for (const role of ['q1', 'q2'] as const) {
        const a = prev.days.find((d) => d.role === role)?.workout.dose;
        const b = w.days.find((d) => d.role === role)?.workout.dose;
        if (a && b && a.ladder === b.ladder) expect(b.doseM).toBeLessThanOrEqual(a.doseM);
      }
      if (mode === 'rpe9') {
        const ref = run('none');
        expect(w.nominalKm).toBe(ref.plan.weeks[hw - 1]!.nominalKm);
      }
      expect(errors(r.plan)).toEqual([]);
    }
  });
  it('jedan preteški dan: bez okidača; isti zapisi drugi put: bez novog koraka', () => {
    expect(run('one').reasons.some((x) => x.condition === 'QUALITY_HARD')).toBe(false);
    const r1 = run('rpe9');
    const at2 = addDays(asOf, 1);
    const r2 = adaptMarathonV2(r1.plan, factsOf(r1.plan, asOf, 'rpe9'), at2);
    if (!r2.ok) throw new Error(JSON.stringify(r2.reasons).slice(0, 800));
    const q2 = r2.reasons.find((x) => x.condition === 'QUALITY_HARD');
    expect(q2?.applied ?? false).toBe(false);
    expect(r2.plan.adaptation!.steps.at(-1)!.holdDose).toBeUndefined();
  });
  it('trčanje van plana na datum kvalitetnog dana (uvoz bez dayId): dan je odrađen, bez okidača', () => {
    const f = factsOf(A, asOf, 'skip');
    const skipped = f.workouts.filter((x) => !x.completed);
    const workouts = [
      ...f.workouts.filter((x) => x.completed),
      ...skipped.map((x) => ({ date: x.date, km: 10, durationSec: 3600, completed: true, rpe: 6 }))
    ];
    const r = adaptMarathonV2(A, { ...f, workouts }, asOf);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons).slice(0, 800));
    expect(r.reasons.some((x) => x.condition === 'QUALITY_HARD')).toBe(false);
  });
  it('ispod umora: umor aktivan → QUALITY_HARD applied false', () => {
    const f = factsOf(A, asOf, 'rpe9');
    let k = 0;
    for (const x of f.workouts) {
      const d = A.weeks.flatMap((w) => w.days).find((y) => y.date === x.date)!;
      if (
        (d.role === 'easy' || (d.role === 'long' && d.workout.workKm.MP === 0)) &&
        daysBetween(x.date, asOf) < 7 &&
        k < 2 &&
        'rpe' in x
      ) {
        x.rpe = 7;
        k++;
      }
    }
    const r = adaptMarathonV2(A, f, asOf);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons).slice(0, 800));
    expect(r.reasons.find((x) => x.condition === 'FATIGUE')?.applied).toBe(true);
    expect(r.reasons.find((x) => x.condition === 'QUALITY_HARD')?.applied).toBe(false);
  });
  it('taper: bez efekta', () => {
    const N = A.weeks.length;
    const at = A.weeks[N - 3]!.days.filter((d) => d.role === 'q2').pop()!.date;
    const r = run('rpe9', at);
    const qr = r.reasons.find((x) => x.condition === 'QUALITY_HARD');
    expect(qr?.applied).toBe(false);
  });
  it('sabotaža: nedelja bez rasta sa višim nivoom → QUALITY_HOLD', () => {
    const r = run('rpe9');
    const hw = r.plan.adaptation!.steps.at(-1)!.holdDose!;
    const q = structuredClone(r.plan);
    const d = q.weeks[hw - 1]!.days.find((x) => x.role === 'q2')!.workout.dose!;
    d.doseM += 1000;
    expect(errors(q)).toContain(`QUALITY_HOLD@${hw}`);
  });
  it('pickSlot hold: ista lestvica bez sledećeg nivoa', () => {
    const p = A.paces;
    const prev = {
      ladder: 'T_cruise' as const,
      doseM: 4800,
      structure: { form: 'reps' as const, reps: 3, repM: 1600 }
    };
    const free = pickSlot(prev, 'T_cruise', 80, p)!;
    const held = pickSlot(prev, 'T_cruise', 80, p, false, false, false, undefined, 0, true)!;
    expect(free.doseM).toBeGreaterThan(4800);
    expect(held.doseM).toBe(4800);
    expect(P.adapt.qualityHard).toEqual({ rpe: 9, lookbackDays: 14 });
  });
});
