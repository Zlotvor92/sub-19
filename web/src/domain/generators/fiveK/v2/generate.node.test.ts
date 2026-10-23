import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, weekdayOf } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { periodize, phaseCounts } from './periodize.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { inputOf, PROFILES, START, type Profile } from './testInputs.ts';
import type { FiveKV2Plan, ReasonCode } from './types.ts';
import { validatePlan } from './validate.ts';

function planOf(p: Profile): FiveKV2Plan {
  const r = generateFiveKV2(inputOf(p));
  if (!r.ok) throw new Error(JSON.stringify(r.reasons) + JSON.stringify(r.violations));
  if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
  return r.plan;
}

function codesOf(raw: unknown): ReasonCode[] {
  const r = generateFiveKV2(raw);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.reasons.map((x) => x.code);
}

const ALL = Object.entries(PROFILES);

describe('determinizam', () => {
  it.each(ALL)('%s: isti ulaz → isti JSON', (_, p) => {
    const a = JSON.stringify(generateFiveKV2(inputOf(p)));
    const b = JSON.stringify(generateFiveKV2(JSON.parse(JSON.stringify(inputOf(p)))));
    expect(a).toBe(b);
  });

  it('redosled izabranih dana ne menja plan', () => {
    const p = PROFILES['vdot50_35km_14w']!;
    const a = JSON.stringify(generateFiveKV2(inputOf(p)));
    const b = JSON.stringify(generateFiveKV2(inputOf({ ...p, days: [...p.days].reverse() })));
    expect(a).toBe(b);
  });

  it('cilj ne menja tempo ni treninge', () => {
    const p = PROFILES['vdot40_25km_12w']!;
    const a = planOf({ ...p, goalTimeSec: null });
    const b = planOf({ ...p, goalTimeSec: 21 * 60 });
    expect(b.paces).toEqual(a.paces);
    expect(b.weeks).toEqual(a.weeks);
    expect(b.goal?.status).toBe('unrealistic');
  });
});

describe('datumi, faze, trkačka nedelja', () => {
  it.each(ALL)('%s', (_, p) => {
    const plan = planOf(p);
    expect(plan.policyVersion).toBe(P.version);
    expect(plan.weeks).toHaveLength(p.weeks);
    plan.weeks.forEach((w, i) => {
      expect(w.startDate).toBe(addDays(START, i * 7));
      expect(w.endDate).toBe(addDays(START, i * 7 + 6));
    });
    const last = plan.weeks[plan.weeks.length - 1]!;
    expect(last.endDate).toBe(plan.input.raceDate);
    expect(last.phase).toBe('race');
    expect(plan.weeks.slice(-3, -1).map((w) => [w.phase, w.taperStep])).toEqual([
      ['taper', 1],
      ['taper', 2]
    ]);
    const races = plan.weeks.flatMap((w) => w.days.filter((d) => d.role === 'race'));
    expect(races.map((d) => d.date)).toEqual([plan.input.raceDate]);
    expect(races[0]!.countsToWeek).toBe(false);
    // Faza je podatak plana: ista kao periodizacija iz ulaza.
    expect(plan.weeks.map((w) => [w.phase, w.deload])).toEqual(
      periodize(START, p.weeks).map((f) => [f.phase, f.deload])
    );
    // Faze idu redom i nema dana posle trke.
    const order = ['base', 'peak', 'sharpen', 'taper', 'race'];
    const idx = plan.weeks.map((w) => order.indexOf(w.phase));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    for (const d of plan.weeks.flatMap((w) => w.days))
      expect(daysBetween(d.date, plan.input.raceDate)).toBeGreaterThanOrEqual(0);
  });

  it('raspodela faza za 8–16 nedelja (6–7: segment04.node.test.ts)', () => {
    for (let n = 8; n <= P.input.planWeeks.max; n++) {
      const c = phaseCounts(n);
      expect(c.base + c.peak + c.sharpen + c.taper + c.race).toBe(n);
      expect(c.base).toBeGreaterThanOrEqual(1);
      expect(c.peak).toBeGreaterThanOrEqual(1);
      expect(c.sharpen).toBeGreaterThanOrEqual(1);
      const frames = periodize(START, n);
      // Rasterećenje samo u izgradnji, na svakoj 4. nedelji, nikad u poslednjoj nedelji izgradnje;
      // 2.2.0: sa početka vrhunca/oštrenja pomereno na poslednju nedelju prethodne faze.
      const lastBuild = c.base + c.peak + c.sharpen;
      const expected = new Set<number>();
      for (let k = 4; k <= lastBuild; k += 4) {
        const at = frames[k - 1]!.phase !== frames[k - 2]!.phase ? k - 1 : k;
        if (at !== lastBuild) expected.add(at);
      }
      expect(frames.filter((f) => f.deload).map((f) => f.index)).toEqual([...expected]);
      for (const f of frames.filter((x) => x.deload))
        expect(frames[f.index - 2]!.phase).toBe(f.phase);
    }
  });
});

describe('raspored: 4 dana, zahtevni dani nisu uzastopni', () => {
  it.each(ALL)('%s', (_, p) => {
    const plan = planOf(p);
    for (const w of plan.weeks) {
      for (const d of w.days) {
        expect(weekdayOf(d.date)).toBe(d.weekday);
        if (d.role !== 'race') expect(p.days).toContain(d.weekday);
      }
      if (w.phase !== 'race') {
        expect(w.days).toHaveLength(4);
        expect(w.days.filter((d) => d.role === 'long')).toHaveLength(1);
        expect(w.days.filter((d) => d.hard)).toHaveLength(w.deload || w.taperStep === 2 ? 2 : 3);
      }
    }
    const hard = plan.weeks.flatMap((w) => w.days.filter((d) => d.hard).map((d) => d.date)).sort();
    for (let i = 1; i < hard.length; i++)
      expect(daysBetween(hard[i - 1]!, hard[i]!)).toBeGreaterThanOrEqual(2);
  });
});

describe('aritmetika komponenti', () => {
  it.each(ALL)('%s', (_, p) => {
    const plan = planOf(p);
    for (const w of plan.weeks) {
      for (const d of w.days) {
        const s = d.workout.segments;
        expect(Math.abs(s.reduce((a, x) => a + x.km, 0) - d.workout.km)).toBeLessThan(0.011);
        expect(s.reduce((a, x) => a + x.sec, 0)).toBe(d.workout.sec);
        expect(d.workout.kmBasis).toBe(
          s.some((x) => x.kmBasis === 'estimated') ? 'estimated' : 'exact'
        );
        expect(d.workout.secBasis).toBe(
          s.some((x) => x.secBasis === 'estimated') ? 'estimated' : 'exact'
        );
      }
      const planned = w.days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0);
      expect(Math.abs(planned - w.plannedKm)).toBeLessThan(0.011);
    }
  });
});

describe('pravila iz policy.ts (validate.ts) na generisanim planovima', () => {
  it.each(ALL)('%s: nema grešaka', (_, p) => {
    const plan = planOf(p);
    expect(validatePlan(plan).filter((v) => v.severity === 'error')).toEqual([]);
  });

  it('mreža podržanih ulaza: plan bez grešaka ili strukturisano odbijanje', () => {
    const sets: Profile['days'][] = [
      ['tue', 'thu', 'sat', 'sun'],
      ['mon', 'wed', 'fri', 'sat'],
      ['mon', 'tue', 'thu', 'sat']
    ];
    let ok = 0;
    for (const km of [15, 22, 30, 38, 45])
      for (const weeks of [8, 11, 13, 16])
        for (const timeSec of [1100, 1300, 1600, 1830])
          for (const days of sets) {
            const r = generateFiveKV2(inputOf({ weeks, km, distanceM: 5000, timeSec, days }));
            if (r.ok) {
              ok++;
              expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
            } else {
              expect(r.reasons.length).toBeGreaterThan(0);
              for (const x of r.reasons)
                expect(['QUALITY_INFEASIBLE', 'WEEK_INFEASIBLE']).toContain(x.code);
            }
          }
    expect(ok).toBeGreaterThan(200);
  });
});

describe('odbijanje nepodržanog i neizvodljivog ulaza', () => {
  const ok = PROFILES['vdot40_25km_12w']!;
  it('granični ulazi su prihvaćeni', () => {
    for (const p of [
      { ...ok, km: 15 },
      { ...ok, km: 45 },
      { ...ok, weeks: 8 },
      { ...ok, weeks: 16 },
      { ...ok, resultDaysBefore: 84 },
      { ...ok, resultDaysBefore: 0 }
    ])
      expect(generateFiveKV2(inputOf(p)).ok).toBe(true);
    expect(planOf(PROFILES['edge_vdot30']!).vdot).toBe(30);
  });

  it.each<[string, Record<string, unknown>, ReasonCode]>([
    ['2 dana', inputOf({ ...ok, days: ['tue', 'sun'] }), 'RUN_DAYS_COUNT'],
    [
      '6 dana',
      inputOf({ ...ok, days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'] }),
      'RUN_DAYS_COUNT'
    ],
    ['ponovljen dan', inputOf({ ...ok, days: ['mon', 'mon', 'thu', 'sat'] }), 'RUN_DAYS_INVALID'],
    ['uzastopni dani', inputOf({ ...ok, days: ['mon', 'tue', 'wed', 'thu'] }), 'RUN_DAYS_SPACING'],
    ['obim 14,9', inputOf({ ...ok, km: 14.9 }), 'WEEKLY_KM_OUT_OF_RANGE'],
    ['obim 45,1', inputOf({ ...ok, km: 45.1 }), 'WEEKLY_KM_OUT_OF_RANGE'],
    ['5 nedelja', inputOf({ ...ok, weeks: 5 }), 'PLAN_LENGTH_OUT_OF_RANGE'],
    ['17 nedelja', inputOf({ ...ok, weeks: 17 }), 'PLAN_LENGTH_OUT_OF_RANGE'],
    // 2.4.0: star rezultat više nije odbijanje — bez laganog tempa traži se MISSING_EASY_PACE.
    ['rezultat 85 dana', inputOf({ ...ok, resultDaysBefore: 85 }), 'MISSING_EASY_PACE'],
    ['rezultat posle starta', inputOf({ ...ok, resultDaysBefore: -1 }), 'RESULT_AFTER_START'],
    // 5k-v2.11.0 (C8, kao 10K): VDOT < 30 → plan po osećaju; bez laganog tempa MISSING_EASY_PACE.
    ['VDOT < 30', inputOf({ ...ok, distanceM: 5000, timeSec: 1860 }), 'MISSING_EASY_PACE'],
    ['VDOT > 60', inputOf({ ...ok, distanceM: 5000, timeSec: 1000 }), 'VDOT_OUT_OF_RANGE'],
    [
      'polumaraton',
      { ...inputOf(ok), recentResult: { distanceM: 21097, timeSec: 6000, date: '2026-10-20' } },
      'RESULT_DISTANCE_UNSUPPORTED'
    ],
    ['nisu cele nedelje', { ...inputOf(ok), raceDate: addDays(START, 80) }, 'PLAN_NOT_WHOLE_WEEKS'],
    ['trka pre starta', { ...inputOf(ok), raceDate: addDays(START, -7) }, 'RACE_NOT_AFTER_START'],
    ['neispravan datum', { ...inputOf(ok), startDate: '2026-02-30' }, 'DATE_INVALID'],
    ['cilj 0', inputOf({ ...ok, goalTimeSec: 0 }), 'GOAL_INVALID']
  ])('%s → %s', (_, raw, code) => {
    expect(codesOf(raw)).toContain(code);
  });

  it('svi razlozi odjednom, bez plana', () => {
    const r = generateFiveKV2({ ...inputOf({ ...ok, km: 70, days: ['mon'] }), startDate: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.length).toBeGreaterThanOrEqual(3);
    expect(codesOf(null)).toEqual(['INPUT_SHAPE']);
  });

  it('2.2.0: 15 km i VDOT ~53 → I ne staje u rasteretnu nedelju, zamena umesto odbijanja', () => {
    const r = generateFiveKV2(inputOf({ ...PROFILES['edge_15km_8w']!, timeSec: 1110 }));
    expect(r.ok).toBe(true);
    if (r.ok && r.plan.planType !== 'runWalk') {
      const w4 = r.plan.weeks[3]!;
      expect(w4.deload).toBe(true);
      expect(w4.days.find((d) => d.role === 'q1')?.workout.qualityType).not.toBe('I');
    }
  });
});
