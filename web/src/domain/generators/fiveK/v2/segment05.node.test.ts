/* Segment 05 (5k-v2.4.0): 3-dnevne dopune (Odluke 1–3), plan bez pouzdanog rezultata (Odluke 4–7),
   početnik (Odluke 8–10) i mreža po granama (sa rezultatom, bez rezultata, početnik sa/bez rezultata).
   Testovi koriste samo javni API i module koji postoje od 2.3.0, da bi na 7b4b574 padali na proveri,
   a ne na uvozu. */

import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import * as policy from './policy.ts';
import { inputOf, START, type Profile } from './testInputs.ts';
import type { FiveKV2Plan, Paces, PlanDay, PlanWeek, ReasonCode, Weekday } from './types.ts';
import { validatePlan } from './validate.ts';

const P = policy.FIVE_K_V2_POLICY;
const D3: Weekday[] = ['tue', 'thu', 'sun'];
const D4: Weekday[] = ['tue', 'thu', 'sat', 'sun'];
const D5: Weekday[] = ['mon', 'tue', 'thu', 'sat', 'sun'];

interface Spec {
  weeks: number;
  km: number;
  days: Weekday[];
  easy?: number;
  beginner?: boolean;
  can30?: boolean;
  /** 5K rezultat [s] i starost u danima (bez → nema rezultata). */
  result?: { timeSec: number; daysBefore: number };
  goal?: number;
}

function raw(s: Spec): Record<string, unknown> {
  return {
    startDate: START,
    raceDate: addDays(START, s.weeks * 7 - 1),
    runDays: s.days,
    currentWeeklyKm: s.km,
    ...(s.result
      ? {
          recentResult: {
            distanceM: 5000,
            timeSec: s.result.timeSec,
            date: addDays(START, -s.result.daysBefore)
          }
        }
      : {}),
    ...(s.easy !== undefined ? { typicalEasyPaceSecPerKm: s.easy } : {}),
    ...(s.beginner ? { experience: 'beginner' } : {}),
    ...(s.can30 !== undefined ? { canRun30Min: s.can30 } : s.beginner ? { canRun30Min: true } : {}),
    ...(s.goal ? { goalTimeSec: s.goal } : {})
  };
}

function planOf(input: Record<string, unknown>): FiveKV2Plan {
  const r = generateFiveKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons) + JSON.stringify(r.violations));
  return JSON.parse(JSON.stringify(r.plan)) as FiveKV2Plan;
}
const codesOf = (input: Record<string, unknown>): ReasonCode[] => {
  const r = generateFiveKV2(input);
  return r.ok ? [] : r.reasons.map((x) => x.code);
};
const errorsOf = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const quality = (w: PlanWeek): PlanDay[] => w.days.filter((d) => d.workout.kind === 'quality');
const roleDay = (w: PlanWeek, role: PlanDay['role']): PlanDay | undefined =>
  w.days.find((d) => d.role === role);
const build = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen';

/** Primeri iz zadatka (isti kao docs/5k-v2/artifacts/segment-05). */
const EX = {
  feel4: { weeks: 12, km: 25, days: D4, easy: 360 },
  feel3: { weeks: 10, km: 15, days: D3, easy: 420 },
  old4: { weeks: 12, km: 30, days: D4, easy: 345, result: { timeSec: 1380, daysBefore: 140 } },
  beg3: { weeks: 10, km: 12, days: D3, easy: 450, beginner: true },
  begRes4: {
    weeks: 12,
    km: 18,
    days: D4,
    beginner: true,
    result: { timeSec: 1800, daysBefore: 14 }
  }
} satisfies Record<string, Spec>;

/* ---------- A) 3-dnevne dopune ---------- */

describe('Odluka 1: kapacitet iz stvarne konstrukcije nedelje', () => {
  // 2.4.1 (Segment 05b): kapacitet 3 dana ≈ 17 km i „start = kapacitet" za 3 d / 30 km ukinuti —
  // v. segment05b.node.test.ts.
  it('3 dana, 30 km, VDOT ~48: svaka nedelja planirano = cilj, bez „lagan = dugi"', () => {
    const plan = planOf(
      inputOf({ weeks: 12, km: 30, distanceM: 5000, timeSec: 1230, days: ['mon', 'wed', 'sat'] })
    );
    for (const w of plan.weeks) {
      expect(w.easyCappedAtLong).toBe(false);
      expect(w.plannedKm).toBeCloseTo(w.targetKm, 2);
    }
  });

  it('mreža sa rezultatom 3/4/5 dana: 0 nedelja „lagan = dugi" (PLANNED_BELOW_TARGET) van trkačke', () => {
    const KM = { 3: [12, 15, 22, 28, 35], 4: [15, 22, 30, 38, 45], 5: [25, 35, 45, 55, 65] };
    let capped = 0;
    let weeks = 0;
    for (const n of [3, 4, 5] as const)
      for (const km of KM[n])
        for (const w of [6, 10, 16])
          for (const timeSec of [1100, 1300, 1600, 1830]) {
            const days = { 3: D3, 4: D4, 5: D5 }[n];
            const r = generateFiveKV2(inputOf({ weeks: w, km, distanceM: 5000, timeSec, days }));
            if (!r.ok || r.plan.planType === 'runWalk') continue;
            for (const x of r.plan.weeks.filter((y) => y.phase !== 'race')) {
              weeks++;
              if (x.easyCappedAtLong) capped++;
            }
            expect(r.plan.warnings.filter((v) => v.rule === 'PLANNED_BELOW_TARGET')).toEqual([]);
          }
    expect(weeks).toBeGreaterThan(1000);
    expect(capped).toBe(0);
  });
});

describe('Odluka 2: 3 dana 12–35 km', () => {
  it('11 km → WEEKLY_KM_OUT_OF_RANGE sa porukom; 12 km u opsegu', () => {
    const r = generateFiveKV2(
      inputOf({ weeks: 10, km: 11, distanceM: 5000, timeSec: 1500, days: D3 })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const x = r.reasons.find((y) => y.code === 'WEEKLY_KM_OUT_OF_RANGE');
      expect(x?.message).toContain(
        'ispod 12 km na 3 dana nema prostora za kvalitet; počni laganim trčanjem ili izaberi 4 dana'
      );
    }
    expect(
      codesOf(inputOf({ weeks: 10, km: 12, distanceM: 5000, timeSec: 1500, days: D3 }))
    ).not.toContain('WEEKLY_KM_OUT_OF_RANGE');
    expect(P.days[3].weeklyKm.min).toBe(12);
  });
});

describe('Odluka 3: bez višeg nivoa — ista doza druge strukture (vrhunac I i oštrenje RP)', () => {
  const FAST_SMALL_11: Profile = { weeks: 11, km: 15, distanceM: 5000, timeSec: 1110, days: D4 };

  it('4 dana, 15 km, VDOT ~53, 11 ned: I nije zadržan identičan; druga struktura iste doze', () => {
    const plan = planOf(inputOf(FAST_SMALL_11));
    expect(plan.weeks.some((w) => w.notes.some((n) => n.includes('I zadržan')))).toBe(false);
    const peak = plan.weeks.filter((w) => w.phase === 'peak' && !w.deload);
    expect(peak.some((w) => w.notes.some((n) => n.includes('ista doza')))).toBe(true);
    for (let i = 1; i < peak.length; i++) {
      const a = roleDay(peak[i - 1]!, 'q1')!.workout;
      const b = roleDay(peak[i]!, 'q1')!.workout;
      expect(b.workKm.I).toBeGreaterThanOrEqual(a.workKm.I - 1e-9);
      expect(JSON.stringify(b.blocks)).not.toBe(JSON.stringify(a.blocks));
    }
  });

  it('3 dana, 15 km, VDOT ~59, 16 ned: plan (ranije QUALITY_INFEASIBLE); I/RP neopadajući, bez ponavljanja', () => {
    const plan = planOf(inputOf({ weeks: 16, km: 15, distanceM: 5000, timeSec: 1100, days: D3 }));
    expect(errorsOf(plan)).toEqual([]);
    expect(
      plan.weeks.some((w) =>
        w.notes.some((n) => /ista doza, (kraći oporavak|druga struktura)/.test(n))
      )
    ).toBe(true);
  });
});

/* ---------- B) plan bez pouzdanog rezultata ---------- */

describe('Odluka 4: bez rezultata — E iz korisnikovog tempa, kvalitet po osećaju', () => {
  it.each([
    ['bez rezultata', EX.feel4],
    ['star rezultat (20 ned)', EX.old4]
  ] as const)(
    '%s: E = tempo ± 15 s, bez VDOT-a, kvalitet bez brojčanog tempa, km procenjeni',
    (_, s) => {
      const plan = planOf(raw(s));
      expect(plan.paceMode).toBe('feel');
      expect(plan.vdot).toBeNull();
      expect(plan.paces).toEqual({ vdot: null, E: { fast: s.easy - 15, slow: s.easy + 15 } });
      expect(errorsOf(plan)).toEqual([]);
      const types = new Set<string>();
      for (const w of plan.weeks)
        for (const d of quality(w)) {
          types.add(d.workout.qualityType!);
          for (const x of d.workout.segments.filter((y) => y.zone !== 'E' && y.zone !== 'jog')) {
            expect(x.paceSecPerKm).toBeNull();
            expect(x.effort?.cue.length).toBeGreaterThan(0);
            if (x.kind === 'rep') {
              expect(x.kmBasis).toBe('estimated');
              expect(x.km).toBe(Math.round((x.sec / s.easy) * 100) / 100);
            }
          }
          if (d.workout.qualityType !== 'TEST_3K') expect(d.workout.title).toMatch(/RPE \d/);
        }
      for (const t of ['HILLS', 'TEMPO_FEEL', 'FARTLEK', 'FARTLEK_RP']) expect(types).toContain(t);
      for (const w of plan.weeks)
        for (const d of w.days) {
          const t = d.workout.blocks.find(
            (b) => b.kind === 'reps' && d.workout.qualityType === 'TEMPO_FEEL'
          );
          if (t && t.kind === 'reps' && 'sec' in t.rep) {
            expect(t.rep.sec).toBeLessThanOrEqual(1200);
            if (t.reps === 1) expect(t.rep.sec).toBeGreaterThanOrEqual(600);
          }
          if (d.workout.qualityType === 'FARTLEK')
            expect(d.workout.title).toContain('brzo ali kontrolisano');
          if (d.workout.qualityType === 'HILLS')
            for (const b of d.workout.blocks)
              if (b.kind === 'reps' && 'sec' in b.rep) expect([30, 45]).toContain(b.rep.sec);
        }
    }
  );

  it('star rezultat se samo prikazuje (napomena), ne utiče na tempo', () => {
    const plan = planOf(raw(EX.old4));
    expect(
      plan.notes.some((n) => n.includes('stariji od 12 nedelja') && n.includes('5K 23:00'))
    ).toBe(true);
    const fresh = planOf(raw({ ...EX.old4, result: { timeSec: 1380, daysBefore: 14 } }));
    expect(fresh.paceMode).toBe('vdot');
  });

  it('bez E tempa → MISSING_EASY_PACE; van 4:30–8:30 → EASY_PACE_OUT_OF_RANGE', () => {
    expect(codesOf(raw({ ...EX.feel4, easy: undefined }))).toContain('MISSING_EASY_PACE');
    expect(
      codesOf(raw({ ...EX.old4, easy: undefined, result: { timeSec: 1380, daysBefore: 85 } }))
    ).toContain('MISSING_EASY_PACE');
    expect(codesOf(raw({ ...EX.feel4, easy: 269 }))).toContain('EASY_PACE_OUT_OF_RANGE');
    expect(codesOf(raw({ ...EX.feel4, easy: 511 }))).toContain('EASY_PACE_OUT_OF_RANGE');
    expect(codesOf(raw({ ...EX.feel4, easy: 270 }))).toEqual([]);
    expect(codesOf(raw({ ...EX.feel4, easy: 510 }))).toEqual([]);
  });

  it('validator: brojčani tempo u planu po osećaju → FEEL_NUMERIC_PACE', () => {
    const plan = planOf(raw(EX.feel4));
    const seg = quality(plan.weeks[0]!)[0]!.workout.segments.find((x) => x.kind === 'rep')!;
    seg.paceSecPerKm = 300;
    expect(errorsOf(plan)).toContain('FEEL_NUMERIC_PACE');
  });
});

describe('Odluka 5: kontrolno trčanje 3 km u 3. ili 4. nedelji (ne rasteretnoj)', () => {
  it.each([
    ['4 dana, 12 ned', EX.feel4],
    ['3 dana, 10 ned', EX.feel3]
  ] as const)('%s', (_, s) => {
    const plan = planOf(raw(s));
    const tests = plan.weeks.filter((w) => w.days.some((d) => d.workout.qualityType === 'TEST_3K'));
    expect(tests).toHaveLength(1);
    const w = tests[0]!;
    expect([3, 4]).toContain(w.index);
    expect(w.deload).toBe(false);
    expect(w.test).toBe(true);
    if (w.index === 4) expect(plan.weeks[2]!.deload).toBe(true);
    const t = quality(w).find((d) => d.workout.qualityType === 'TEST_3K')!.workout;
    expect(t.blocks.map((b) => b.kind)).toEqual(['warmup', 'test', 'cooldown']);
    expect(t.segments.find((x) => x.kind === 'test')!.km).toBe(3);
    expect(t.workKm).toEqual({ E: 0, T: 0, I: 0, R: 0, RP: 0 });
    expect(plan.notes.some((n) => n.includes('ostaje po osećaju') && n.includes('adaptacij'))).toBe(
      true
    );
  });

  // 5k-v2.11.0 (C13, MASTER pouka 13): početnik po osećaju nema kontrolno trčanje.
  it('početnik 3 dana, 10 ned (po osećaju): bez kontrolnog trčanja', () => {
    const plan = planOf(raw(EX.beg3));
    expect(plan.paceMode).toBe('feel');
    expect(plan.weeks.some((w) => w.test)).toBe(false);
    expect(plan.weeks.flatMap((w) => w.days).some((d) => d.workout.qualityType === 'TEST_3K')).toBe(
      false
    );
  });

  it('plan sa rezultatom nema test; validator: test premešten → TEST_WEEK', () => {
    expect(
      planOf(inputOf({ weeks: 12, km: 25, distanceM: 5000, timeSec: 1500, days: D4 })).weeks.some(
        (w) => w.test
      )
    ).toBe(false);
    const plan = planOf(raw(EX.feel4));
    const w = plan.weeks.find((x) => x.test)!;
    w.test = false;
    plan.weeks[w.index]!.test = true;
    expect(errorsOf(plan)).toContain('TEST_WEEK');
  });
});

describe('Odluka 6: prognoza i cilj — „nedovoljno podataka"', () => {
  it('bez broja, bez ocene izvodljivosti', () => {
    const plan = planOf(raw({ ...EX.feel4, goal: 1500 }));
    expect(plan.predicted5kSec).toBeNull();
    expect(plan.goal).toMatchObject({
      goalTimeSec: 1500,
      goalVdot: null,
      vdotGap: null,
      status: 'insufficient_data'
    });
    expect(plan.goal!.message).toContain('Nedovoljno podataka');
    expect(plan.notes.some((n) => n.includes('nedovoljno podataka'))).toBe(true);
    const bad = planOf(raw({ ...EX.feel4, goal: 1500 }));
    bad.goal = { ...bad.goal!, status: 'feasible' };
    expect(errorsOf(bad)).toContain('FEEL_GOAL');
  });
});

describe('Odluka 7: isti procentualni budžeti, bez donjeg praga 70%', () => {
  it('rad po zoni ≤ udela; donji prag vrhunca/oštrenja se ne proverava', () => {
    const plan = planOf(raw(EX.feel4));
    for (const w of plan.weeks.filter((x) => x.phase !== 'race')) {
      const sum = { I: 0, T: 0, R: 0 };
      for (const d of w.days) {
        sum.I += d.workout.workKm.I + d.workout.workKm.RP;
        sum.T += d.workout.workKm.T;
        sum.R += d.workout.workKm.R;
      }
      expect(sum.I).toBeLessThanOrEqual(w.targetKm * P.quality.iMaxShare + 1e-6);
      expect(sum.T).toBeLessThanOrEqual(w.targetKm * P.quality.tMaxShare + 1e-6);
      expect(sum.R).toBeLessThanOrEqual(w.targetKm * P.quality.rMaxShare + 1e-6);
    }
    const w = plan.weeks.find((x) => x.phase === 'peak' && !x.deload && !x.test)!;
    const q1 = roleDay(w, 'q1')!.workout;
    q1.workKm = { ...q1.workKm, I: 0.1 };
    expect(errorsOf(plan)).not.toContain('PEAK_MAIN_FLOOR');
  });
});

/* ---------- C) početnik ---------- */

describe('Odluka 8: početnik — ≤ 4 dana, 1 kvalitet, nedelje 1–2 bez kvaliteta, bez I', () => {
  // 2.6.0: canRun30Min = false → plan trčanje/hodanje (Segment 07); početnik mora navesti canRun30Min.
  it('5 dana → RUN_DAYS_COUNT; početnik bez canRun30Min → INPUT_SHAPE; false → trčanje/hodanje', () => {
    expect(codesOf(raw({ ...EX.beg3, days: D5, km: 25 }))).toContain('RUN_DAYS_COUNT');
    const rw = generateFiveKV2(raw({ ...EX.beg3, can30: false }));
    expect(rw.ok && rw.plan.planType).toBe('runWalk');
    const noFlag = raw(EX.beg3);
    delete noFlag['canRun30Min'];
    expect(codesOf(noFlag)).toEqual(['INPUT_SHAPE']);
    expect(codesOf(raw({ ...EX.feel4, can30: false }))).toEqual(['RUN_DAYS_COUNT']);
  });

  it.each([
    ['bez rezultata, 3 dana', EX.beg3],
    ['sa rezultatom, 4 dana', EX.begRes4]
  ] as const)('%s', (_, s) => {
    const plan = planOf(raw(s));
    expect(plan.experience).toBe('beginner');
    expect(plan.pattern.q2).toBeNull();
    expect(errorsOf(plan)).toEqual([]);
    for (const w of plan.weeks) {
      expect(quality(w).length).toBeLessThanOrEqual(1);
      for (const d of w.days) {
        expect(d.workout.workKm.I).toBe(0);
        expect(d.workout.qualityType).not.toBe('I');
      }
      if (w.index <= 2) {
        expect(quality(w)).toEqual([]);
        expect(w.stridesOnly).toBe(true);
        expect(
          w.days.some((d) => d.workout.segments.filter((x) => x.kind === 'stride').length === 6)
        ).toBe(true);
      }
    }
    const peak = plan.weeks.filter((w) => w.phase === 'peak' && !w.test);
    for (const w of peak)
      for (const d of quality(w)) expect(['FARTLEK', 'HILLS']).toContain(d.workout.qualityType);
  });

  it('sa rezultatom: ubrzanja i RP u oštrenju po VDOT tempu; bez rezultata po osećaju', () => {
    const withRes = planOf(raw(EX.begRes4));
    const sh = withRes.weeks.find((w) => w.phase === 'sharpen')!;
    const rp = quality(sh)[0]!.workout;
    expect(rp.qualityType).toBe('RP');
    const paces = withRes.paces as Paces;
    expect(rp.segments.find((x) => x.kind === 'rep')!.paceSecPerKm).toBe(paces.RP);
    const strideOf = (p: FiveKV2Plan) =>
      p.weeks[0]!.days.flatMap((d) => d.workout.segments).find((x) => x.kind === 'stride')!;
    expect(strideOf(withRes).paceSecPerKm).toBe(paces.R);
    const noRes = planOf(raw(EX.beg3));
    const s2 = strideOf(noRes);
    expect(s2.paceSecPerKm).toBeNull();
    expect(quality(noRes.weeks.find((w) => w.phase === 'sharpen')!)[0]!.workout.qualityType).toBe(
      'FARTLEK_RP'
    );
  });

  it('validator: I kod početnika → BEGINNER_NO_I; kvalitet u 1. nedelji → BEGINNER_INTRO', () => {
    const plan = planOf(raw(EX.begRes4));
    const q = quality(plan.weeks.find((w) => w.phase === 'peak' && !w.deload)!)[0]!.workout;
    q.workKm = { ...q.workKm, I: 0.5 };
    expect(errorsOf(plan)).toContain('BEGINNER_NO_I');
    const p2 = planOf(raw(EX.begRes4));
    p2.weeks[0]!.stridesOnly = false;
    expect(errorsOf(p2)).toContain('BEGINNER_INTRO');
  });
});

describe('Odluka 9: početnik — rast ≤ 5%, dugi ≤ 60 min, vrh ≤ 1,2 × start, rasterećenje svake 3.', () => {
  it.each([
    ['bez rezultata, 3 dana, 12 km', EX.beg3],
    ['sa rezultatom, 4 dana, 18 km', EX.begRes4],
    ['bez rezultata, 4 dana, 30 km, 16 ned', { ...EX.beg3, days: D4, km: 30, weeks: 16 }]
  ] as const)('%s', (_, s) => {
    const plan = planOf(raw(s));
    expect(plan.peakKm).toBeLessThanOrEqual(Math.floor(plan.startKm * 1.2 * 10 + 1e-9) / 10);
    let last: number | null = null;
    for (const w of plan.weeks.filter((x) => build(x) && !x.deload)) {
      if (last !== null) expect(w.targetKm).toBeLessThanOrEqual(last * 1.05 + 1e-9);
      last = w.targetKm;
    }
    for (const w of plan.weeks) {
      const long = roleDay(w, 'long');
      if (long) expect(long.workout.km * plan.paces.E.slow).toBeLessThanOrEqual(3600);
    }
    const deloads = plan.weeks.filter((w) => w.deload).map((w) => w.index);
    if (s.weeks >= 8) expect(deloads[0]).toBe(3);
    for (let i = 1; i < deloads.length; i++)
      expect(deloads[i]! - deloads[i - 1]!).toBeLessThanOrEqual(3);
  });
});

describe('Odluka 10: cilj početnika najviše „orijentir"', () => {
  it('izvodljiv cilj (sa rezultatom) → orientation; validator: feasible → BEGINNER_GOAL', () => {
    const plan = planOf(raw({ ...EX.begRes4, goal: 1800 }));
    expect(plan.goal!.status).toBe('orientation');
    expect(plan.goal!.message).toContain('orijentir');
    expect(JSON.stringify(plan)).not.toContain('izvodljiv)');
    const regular = planOf(raw({ ...EX.begRes4, beginner: false, goal: 1800 }));
    expect(regular.goal!.status).toBe('feasible');
    plan.goal = { ...plan.goal!, status: 'feasible' };
    expect(errorsOf(plan)).toContain('BEGINNER_GOAL');
  });
});

/* ---------- Mreža po granama ---------- */

const SETS: Record<3 | 4 | 5, Weekday[][]> = {
  3: [D3, ['mon', 'wed', 'sat']],
  4: [D4, ['mon', 'wed', 'fri', 'sat']],
  5: [D5, ['tue', 'wed', 'fri', 'sat', 'sun']]
};
const KM: Record<3 | 4 | 5, number[]> = {
  3: [12, 15, 22, 28, 35],
  4: [15, 22, 30, 38, 45],
  5: [25, 35, 45, 55, 65]
};
type Branch = 'feel' | 'beginnerFeel' | 'beginnerResult';
const VARIANTS: Record<Branch, number[]> = {
  /** tipični E tempo [s/km] */
  feel: [300, 390, 480],
  beginnerFeel: [330, 420, 480],
  /** 5K [s] (VDOT ~38 / ~34 / ~31) */
  beginnerResult: [1500, 1650, 1800]
};

function specOf(b: Branch, km: number, weeks: number, v: number, d: Weekday[]): Spec {
  if (b === 'feel') return { weeks, km, days: d, easy: v };
  if (b === 'beginnerFeel') return { weeks, km, days: d, easy: v, beginner: true };
  return { weeks, km, days: d, beginner: true, result: { timeSec: v, daysBefore: 14 } };
}

/** Stalni uslovi 1–8 na planu (validator + nezavisne provere Uslova 6 i 8). */
function checkStanding(plan: FiveKV2Plan, n: 3 | 4 | 5): void {
  expect(validatePlan(plan).filter((v) => v.severity === 'error')).toEqual([]);
  expect([plan.policyId, plan.policyVersion]).toEqual([P.id, P.version]);
  expect(plan.warnings.filter((v) => v.rule === 'PLANNED_BELOW_TARGET')).toEqual([]);
  for (const w of plan.weeks) {
    expect(['base', 'peak', 'sharpen', 'taper', 'race']).toContain(w.phase);
    const min = w.phase === 'race' ? P.week.minRaceWeekKm : P.days[n].minWeekKm;
    expect(w.plannedKm).toBeGreaterThanOrEqual(min);
    if (w.phase !== 'race') expect(w.plannedKm).toBeCloseTo(w.targetKm, 2);
    const long = roleDay(w, 'long');
    for (const day of w.days) {
      expect(day.workout.km).toBeGreaterThan(0);
      expect(day.workout.segments.length).toBeGreaterThan(0);
      if (long && day.role === 'easy')
        expect(day.workout.km).toBeLessThanOrEqual(long.workout.km + 1e-9);
    }
  }
}

describe('mreža po granama: 3/4/5 dana × 5 obima × {6, 7, 10, 16} ned × 3 varijante × 2 rasporeda', () => {
  const EXPECTED: Record<Branch, Record<3 | 4 | 5, { plans: number; rejected: number }>> = {
    feel: {
      3: { plans: 120, rejected: 0 },
      4: { plans: 120, rejected: 0 },
      5: { plans: 120, rejected: 0 }
    },
    beginnerFeel: {
      3: { plans: 120, rejected: 0 },
      4: { plans: 120, rejected: 0 },
      5: { plans: 0, rejected: 120 }
    },
    beginnerResult: {
      3: { plans: 120, rejected: 0 },
      4: { plans: 120, rejected: 0 },
      5: { plans: 0, rejected: 120 }
    }
  };
  for (const b of ['feel', 'beginnerFeel', 'beginnerResult'] as const)
    it.each([3, 4, 5] as const)(`${b}: %i dana — stalni uslovi 1–8, 0 grešaka validatora`, (n) => {
      let plans = 0;
      let rejected = 0;
      const codes: Record<string, number> = {};
      for (const km of KM[n])
        for (const weeks of [6, 7, 10, 16])
          for (const v of VARIANTS[b])
            for (const d of SETS[n]) {
              const r = generateFiveKV2(raw(specOf(b, km, weeks, v, d)));
              if (!r.ok) {
                rejected++;
                for (const x of r.reasons) codes[x.code] = (codes[x.code] ?? 0) + 1;
                continue;
              }
              plans++;
              if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
              checkStanding(r.plan, n);
              expect(r.plan.paceMode).toBe(b === 'beginnerResult' ? 'vdot' : 'feel');
            }
      expect(codes['PLAN_VIOLATES_POLICY']).toBeUndefined();
      if (n === 5 && b !== 'feel') expect(Object.keys(codes)).toEqual(['RUN_DAYS_COUNT']);
      expect({ plans, rejected }).toEqual(EXPECTED[b][n]);
    });
});
