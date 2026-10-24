/* Segment 04 (5k-v2.3.0): 3 i 5 dana, kratka priprema (6–7 nedelja), trkačka nedelja, zamena u
   rasterećenju, R u bazi (Odluke 1–6) i mreža 3/4/5 dana × obim × {6, 7, 10, 16} × 4 rezultata × 2 rasporeda. */

import { describe, expect, it } from 'vitest';
import { generateFiveKV2 } from './generate.ts';
import { pacesFromVdot } from './paces.ts';
import * as periodizeMod from './periodize.ts';
import * as policy from './policy.ts';
import { inputOf, PROFILES, type Profile } from './testInputs.ts';
import type { FiveKV2Plan, PlanDay, PlanWeek, Weekday } from './types.ts';
import { validatePlan } from './validate.ts';
import * as volume from './volume.ts';

const P = policy.FIVE_K_V2_POLICY;
const days = P as unknown as {
  days: Record<number, { longMaxShare: number; maxWeekKm: number; minWeekKm: number }>;
};

function planOf(p: Profile): FiveKV2Plan {
  const r = generateFiveKV2(inputOf(p));
  if (!r.ok) throw new Error(JSON.stringify(r.reasons) + JSON.stringify(r.violations));
  return JSON.parse(JSON.stringify(r.plan)) as FiveKV2Plan;
}
const errorsOf = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const quality = (w: PlanWeek): PlanDay[] => w.days.filter((d) => d.workout.kind === 'quality');
const roleDay = (w: PlanWeek, role: PlanDay['role']): PlanDay | undefined =>
  w.days.find((d) => d.role === role);
const rKm = (w: PlanWeek): number => quality(w).reduce((a, d) => a + d.workout.workKm.R, 0);

/** Primeri iz zadatka (isti kao docs/5k-v2/artifacts/segment-04). */
const S04: Record<string, Profile> = {
  d3_15km_v38_10w: {
    weeks: 10,
    km: 15,
    distanceM: 5000,
    timeSec: 1500,
    days: ['tue', 'thu', 'sun']
  },
  d3_30km_v48_12w: {
    weeks: 12,
    km: 30,
    distanceM: 5000,
    timeSec: 1230,
    days: ['mon', 'wed', 'sat']
  },
  d5_40km_v50_14w: {
    weeks: 14,
    km: 40,
    distanceM: 5000,
    timeSec: 1197,
    days: ['mon', 'tue', 'thu', 'sat', 'sun']
  },
  d5_60km_v58_16w: {
    weeks: 16,
    km: 60,
    distanceM: 5000,
    timeSec: 1045,
    days: ['tue', 'wed', 'fri', 'sat', 'sun']
  },
  d4_30km_v49_6w: {
    weeks: 6,
    km: 30,
    distanceM: 5000,
    timeSec: 1215,
    days: ['tue', 'thu', 'sat', 'sun']
  },
  d3_25km_7w: { weeks: 7, km: 25, distanceM: 5000, timeSec: 1380, days: ['tue', 'thu', 'sun'] }
};
const S04_ALL = Object.entries(S04);
/** Brz trkač, mali obim (Segment 03). 5k-v2.12.0 (T4): plan trkača ≤ 8 nedelja nema rasterećenja, a 4 dana / 15 km
    sada nosi kvalitet u rasterećenju — rasterećenje samo sa ubrzanjima: 3 dana, 12 km, VDOT ~52, 9 ned (ned 5). */
const FAST_SMALL_8: Profile = {
  weeks: 9,
  km: 12,
  distanceM: 5000,
  timeSec: 1157,
  days: ['tue', 'thu', 'sun']
};

describe('Odluka 1: šablon po broju dana', () => {
  it('3 dana: 1 kvalitet + dugi + lagan sa ubrzanjima; baza R/T naizmenično, vrhunac I, oštrenje RP', () => {
    const plan = planOf(S04['d3_15km_v38_10w']!);
    expect(plan.pattern.q2).toBeNull();
    expect(plan.pattern.easy).toHaveLength(1);
    const baseTypes: string[] = [];
    for (const w of plan.weeks.filter((x) => x.phase !== 'race')) {
      expect(w.days).toHaveLength(3);
      expect(quality(w).length).toBe(w.stridesOnly ? 0 : 1);
      const long = roleDay(w, 'long')!.workout;
      // 2.4.1: 3 dana 45% (bilo 40%).
      expect(long.km).toBeLessThanOrEqual(w.targetKm * P.days[3].longMaxShare + 1e-9);
      expect(long.km * plan.paces.E.slow).toBeLessThanOrEqual(P.long.maxSec);
      for (const e of w.days.filter((d) => d.role === 'easy')) {
        expect(e.workout.segments.some((s) => s.kind === 'stride')).toBe(true);
        expect(e.workout.km).toBeLessThanOrEqual(long.km + 1e-9);
      }
      const q = quality(w)[0]?.workout.qualityType;
      if (w.phase === 'base' && !w.deload) baseTypes.push(q === 'R' ? 'R' : 'T');
      if (w.phase === 'peak' && !w.deload) expect(q).toBe('I');
      if (w.phase === 'sharpen') expect(q).toBe('RP');
    }
    expect(baseTypes.length).toBeGreaterThanOrEqual(2);
    baseTypes.forEach((t, i) => expect(t).toBe(i % 2 === 0 ? 'R' : 'T'));
  });

  it('5 dana: 2 kvaliteta + dugi + 2 lagana; dugi ≤ 30% i ≤ 90 min', () => {
    const plan = planOf(S04['d5_40km_v50_14w']!);
    expect(plan.pattern.q2).not.toBeNull();
    expect(plan.pattern.easy).toHaveLength(2);
    for (const w of plan.weeks.filter((x) => x.phase !== 'race')) {
      expect(w.days).toHaveLength(5);
      expect(quality(w).length).toBe(w.deload || w.taperStep === 2 ? 1 : 2);
      const long = roleDay(w, 'long')!.workout;
      expect(long.km).toBeLessThanOrEqual(w.targetKm * 0.3 + 1e-9);
      expect(long.km * plan.paces.E.slow).toBeLessThanOrEqual(P.long.maxSec);
    }
  });

  it.each(S04_ALL)('%s: zahtevni dani nisu uzastopni (ciklično), 0 grešaka validatora', (_, p) => {
    const plan = planOf(p);
    expect(errorsOf(plan)).toEqual([]);
    const hard = plan.weeks.flatMap((w) => w.days.filter((d) => d.hard)).map((d) => d.date);
    hard.sort();
    for (let i = 1; i < hard.length; i++)
      expect(Date.parse(hard[i]!) - Date.parse(hard[i - 1]!)).toBeGreaterThanOrEqual(2 * 86400000);
  });

  it('validator: drugi kvalitet u 3 dana → ROLES', () => {
    const plan = planOf(S04['d3_15km_v38_10w']!);
    const w = plan.weeks[0]!;
    const e = roleDay(w, 'easy')!;
    e.workout = quality(w)[0]!.workout;
    expect(errorsOf(plan)).toContain('ROLES');
  });

  it('validator: dugi > 45% u 3 dana → LONG_SHARE', () => {
    const plan = planOf(S04['d3_15km_v38_10w']!);
    const w = plan.weeks[1]!;
    roleDay(w, 'long')!.workout.km = Math.ceil(w.targetKm * P.days[3].longMaxShare + 1);
    expect(errorsOf(plan)).toContain('LONG_SHARE');
  });
});

describe('Odluka 2: kapacitet i vrh obima po broju dana', () => {
  it('peakKm = min(1,3 × start, kapacitet, apsolutni vrh 40/50/65)', () => {
    expect(volume.peakKm(60, 200, 3)).toBe(40);
    expect(volume.peakKm(60, 200, 4)).toBe(50);
    expect(volume.peakKm(60, 200, 5)).toBe(65);
    expect(volume.peakKm(20, 200, 5)).toBe(26);
    expect(volume.peakKm(60, 44, 5)).toBe(44);
  });

  // 2.4.0 (Segment 05, Odluka 1): kapacitet iz stvarne konstrukcije nedelje (segment05.node.test.ts);
  // stara nejednačina (10% kvaliteta) i rast sa brojem dana više nisu pravilo.
  it('kapacitet ≤ apsolutnog vrha po broju dana; dugi na kapacitetu ≤ 90 min', () => {
    for (const vdot of [30, 40, 50, 60]) {
      const p = pacesFromVdot(vdot);
      for (const n of [3, 4, 5] as const) {
        const t = volume.capacityKm(p, n);
        expect(t).toBeLessThanOrEqual(days.days[n]!.maxWeekKm);
        expect(volume.longCapKm(t, p, n) * p.E.slow).toBeLessThanOrEqual(P.long.maxSec);
      }
    }
  });

  it.each(S04_ALL)('%s: vrh ≤ peakKm(start, kapacitet, dani), svaki cilj ≤ kapaciteta', (_, p) => {
    const plan = planOf(p);
    const n = p.days.length as 3 | 4 | 5;
    expect(plan.peakKm).toBeLessThanOrEqual(volume.peakKm(plan.startKm, plan.capacityKm, n));
    expect(plan.peakKm).toBeLessThanOrEqual(days.days[n]!.maxWeekKm);
    for (const w of plan.weeks) expect(w.targetKm).toBeLessThanOrEqual(plan.capacityKm);
  });

  it('validator: vrh iznad apsolutnog vrha 3 dana → VOLUME_PEAK', () => {
    const plan = planOf(S04['d3_30km_v48_12w']!);
    plan.startKm = 10;
    expect(errorsOf(plan)).toContain('VOLUME_PEAK');
  });
});

describe('Odluka 3: kratka priprema 6–7 nedelja', () => {
  it('6 ned = baza 2, vrhunac 2, taper 1, trka 1; 7 ned + oštrenje 1; bez rasterećenja; 8 ned isto kao ranije', () => {
    const ph = (n: number): string[] =>
      periodizeMod.periodize('2026-11-02', n).map((f) => f.phase + (f.deload ? '*' : ''));
    expect(ph(6)).toEqual(['base', 'base', 'peak', 'peak', 'taper', 'race']);
    expect(ph(7)).toEqual(['base', 'base', 'peak', 'peak', 'sharpen', 'taper', 'race']);
    expect(periodizeMod.phaseCounts(8)).toEqual({
      base: 2,
      peak: 2,
      sharpen: 1,
      taper: 2,
      race: 1
    });
  });

  it.each([
    ['6 ned, 4 dana', S04['d4_30km_v49_6w']!],
    ['7 ned, 3 dana', S04['d3_25km_7w']!]
  ])('%s: plan sa napomenom kratke pripreme, bez rasterećenja', (_, p) => {
    const plan = planOf(p);
    expect(plan.weeks).toHaveLength(p.weeks);
    expect(plan.notes).toEqual([P.phases.shortNote]);
    expect(plan.weeks.some((w) => w.deload)).toBe(false);
    expect(plan.weeks.filter((w) => w.phase === 'taper')).toHaveLength(1);
    expect(errorsOf(plan)).toEqual([]);
  });

  it('8+ nedelja: bez napomene kratke pripreme', () => {
    expect(planOf(PROFILES['edge_15km_8w']!).notes).toEqual([]);
  });

  it('validator: rasterećenje u kratkoj pripremi → DELOAD_SHORT', () => {
    const plan = planOf(S04['d4_30km_v49_6w']!);
    plan.weeks[1]!.deload = true;
    expect(errorsOf(plan)).toContain('DELOAD_SHORT');
  });
});

describe('Odluka 4: trkačka nedelja — cilj = planirano, 50% vrha je gornja granica', () => {
  it.each([...Object.entries(PROFILES), ...S04_ALL])('%s', (_, p) => {
    const plan = planOf(p);
    const race = plan.weeks[plan.weeks.length - 1]!;
    expect(race.targetKm).toBe(race.plannedKm);
    expect(race.targetKm).toBeLessThanOrEqual(Math.round(plan.peakKm * 5) / 10 + 1e-9);
    expect(plan.warnings.filter((v) => v.rule === 'PLANNED_VS_TARGET')).toEqual([]);
  });

  it('validator: cilj iznad granice → VOLUME_RACE_WEEK; cilj ≠ planirano → PLANNED_VS_TARGET', () => {
    const plan = planOf(PROFILES['vdot48_30km_9w']!);
    const race = plan.weeks[plan.weeks.length - 1]!;
    race.targetKm = plan.peakKm;
    expect(errorsOf(plan)).toEqual(
      expect.arrayContaining(['VOLUME_RACE_WEEK', 'PLANNED_VS_TARGET'])
    );
  });
});

describe('Odluka 5: zamena u rasterećenju — R ≥ 1,2 km, inače samo ubrzanja 6 × 20 s', () => {
  it('15 km + VDOT ~53, 8 ned: rasteretni vrhunac = samo ubrzanja 6 × 20 s, ne R 4 × 150 m', () => {
    const plan = planOf(FAST_SMALL_8);
    const w = plan.weeks.find((x) => x.phase === 'peak' && x.deload)!;
    expect(w.stridesOnly).toBe(true);
    expect(quality(w)).toEqual([]);
    const so = w.days.filter(
      (d) => d.workout.segments.filter((s) => s.kind === 'stride').length === 6
    );
    expect(so).toHaveLength(1);
    expect(so[0]!.workout.segments.find((s) => s.kind === 'stride')!.sec).toBe(20);
    expect(w.notes.some((n) => n.includes('samo ubrzanja 6 × 20 s'))).toBe(true);
    expect(errorsOf(plan)).toEqual([]);
  });

  it('nijedan plan nema R zamenu < 1,2 km u rasterećenju vrhunca/oštrenja', () => {
    for (const p of [...Object.values(PROFILES), ...Object.values(S04), FAST_SMALL_8]) {
      const plan = planOf(p);
      for (const w of plan.weeks.filter((x) => x.deload && x.phase !== 'base')) {
        const r = rKm(w);
        if (r > 0) expect(r).toBeGreaterThanOrEqual(1.2 - 1e-9);
      }
    }
  });

  it('validator: R 0,6 km kao zamena → DELOAD_R_MIN; nedelja samo sa ubrzanjima van rasterećenja → DELOAD_STRIDES_ONLY', () => {
    const plan = planOf(FAST_SMALL_8);
    const w = plan.weeks.find((x) => x.phase === 'peak' && x.deload)!;
    const base = plan.weeks.find((x) => x.phase === 'base' && !x.deload)!;
    const r = quality(base).find((d) => d.workout.qualityType === 'R')!;
    w.stridesOnly = false;
    w.days[0] = { ...w.days[0]!, role: 'q1', hard: true, workout: r.workout };
    expect(errorsOf(plan)).toContain('DELOAD_R_MIN');
    const plan2 = planOf(FAST_SMALL_8);
    plan2.weeks.find((x) => x.stridesOnly)!.deload = false;
    expect(errorsOf(plan2)).toContain('DELOAD_STRIDES_ONLY');
  });
});

describe('2.3.0 dopuna: RP u oštrenju bez višeg nivoa — druga struktura umesto odbijanja', () => {
  it('15 km, 10 ned (3 i 4 dana): plan; RP neopadajući, različita struktura', () => {
    for (const d of [
      ['tue', 'thu', 'sun'],
      ['tue', 'thu', 'sat', 'sun']
    ] as Weekday[][]) {
      const plan = planOf({ weeks: 10, km: 15, distanceM: 5000, timeSec: 1500, days: d });
      const sh = plan.weeks.filter((w) => w.phase === 'sharpen');
      expect(sh).toHaveLength(2);
      const [a, b] = sh.map((w) => roleDay(w, 'q1')!.workout);
      expect(b!.workKm.RP).toBeGreaterThanOrEqual(a!.workKm.RP);
      expect(b!.title).not.toBe(a!.title);
    }
  });
});

describe('Odluka 6: R u bazi ne pada između ne-rasteretnih nedelja', () => {
  const DROP: Profile = {
    weeks: 12,
    km: 15,
    distanceM: 5000,
    timeSec: 1050,
    days: ['tue', 'thu', 'sat', 'sun']
  };
  it.each([...Object.entries(PROFILES), ...S04_ALL, ['15 km, 12 ned, brz', DROP] as const])(
    '%s',
    (_, p) => {
      const base = planOf(p).weeks.filter((w) => w.phase === 'base' && !w.deload && rKm(w) > 0);
      for (let i = 1; i < base.length; i++)
        expect(rKm(base[i]!)).toBeGreaterThanOrEqual(rKm(base[i - 1]!) - 1e-9);
    }
  );

  it('15 km, 12 ned: R 4 × 200 m se drži (ranije 5 × 150 m)', () => {
    const w3 = planOf(DROP).weeks[2]!;
    expect(roleDay(w3, 'q1')!.workout.title).toBe('R: 4 × 200 m (oporavak 200 m lagano)');
  });

  it('validator: manji R → BASE_R_DECREASE', () => {
    const plan = planOf(PROFILES['edge_45km_16w']!);
    const base = plan.weeks.filter((w) => w.phase === 'base' && !w.deload);
    const q = roleDay(base[1]!, 'q1')!.workout;
    // 2.8.0 (N2b): doza = zadata ponavljanja (jedinica doze), ne km procenjen tempom.
    q.blocks = q.blocks.map((b) => (b.kind === 'reps' && b.zone === 'R' ? { ...b, reps: 1 } : b));
    expect(errorsOf(plan)).toContain('BASE_R_DECREASE');
  });
});

/* ---------- Mreža 3/4/5 dana ---------- */

const SETS: Record<3 | 4 | 5, Weekday[][]> = {
  3: [
    ['tue', 'thu', 'sun'],
    ['mon', 'wed', 'sat']
  ],
  4: [
    ['tue', 'thu', 'sat', 'sun'],
    ['mon', 'wed', 'fri', 'sat']
  ],
  5: [
    ['mon', 'tue', 'thu', 'sat', 'sun'],
    ['tue', 'wed', 'fri', 'sat', 'sun']
  ]
};
const KM: Record<3 | 4 | 5, number[]> = {
  3: [10, 15, 22, 28, 35],
  4: [15, 22, 30, 38, 45],
  5: [25, 35, 45, 55, 65]
};

describe('mreža: 3/4/5 dana × 5 obima × {6, 7, 10, 16} ned × 4 rezultata × 2 rasporeda', () => {
  it.each([3, 4, 5] as const)(
    '%i dana: planovi bez grešaka validatora; stalni uslovi 1–8 (Uslov 8: minimum, prazan, dugi ≥ lagan)',
    (n) => {
      let plans = 0;
      let rejected = 0;
      const codes: Record<string, number> = {};
      for (const km of KM[n])
        for (const weeks of [6, 7, 10, 16])
          for (const timeSec of [1100, 1300, 1600, 1830])
            for (const d of SETS[n]) {
              const r = generateFiveKV2(inputOf({ weeks, km, distanceM: 5000, timeSec, days: d }));
              if (!r.ok) {
                rejected++;
                for (const x of r.reasons) codes[x.code] = (codes[x.code] ?? 0) + 1;
                continue;
              }
              plans++;
              if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
              const plan = r.plan;
              expect(validatePlan(plan).filter((v) => v.severity === 'error')).toEqual([]);
              expect([plan.policyId, plan.policyVersion]).toEqual([P.id, P.version]);
              for (const w of plan.weeks) {
                const min = w.phase === 'race' ? P.week.minRaceWeekKm : days.days[n]!.minWeekKm;
                expect(w.plannedKm).toBeGreaterThanOrEqual(min);
                const long = roleDay(w, 'long');
                for (const day of w.days) {
                  expect(day.workout.km).toBeGreaterThan(0);
                  if (long && day.role === 'easy')
                    expect(day.workout.km).toBeLessThanOrEqual(long.workout.km + 1e-9);
                }
              }
            }
      // Uslov: nijedno odbijanje nije PLAN_VIOLATES_POLICY (generator sam odlučuje; validator samo prijavljuje).
      expect(codes['PLAN_VIOLATES_POLICY']).toBeUndefined();
      expect({ plans, rejected }).toEqual(
        {
          // 2.4.0 (Segment 05): 3 dana 10 km je van opsega (32 odbijanja WEEKLY_KM_OUT_OF_RANGE);
          // kapacitet iz konstrukcije spušta 15–35 km na ~17 km, pa ti planovi prolaze.
          3: { plans: 128, rejected: 32 },
          4: { plans: 160, rejected: 0 },
          5: { plans: 160, rejected: 0 }
        }[n]
      );
    }
  );
});
