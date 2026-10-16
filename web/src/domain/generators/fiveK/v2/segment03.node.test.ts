/* Segment 03 (5k-v2.2.0): preostale trenerske odluke 4-dnevnog jezgra (Odluke 1–6) i mreža 240 ulaza. */

import { describe, expect, it } from 'vitest';
import { generateFiveKV2 } from './generate.ts';
import { pacesFromVdot } from './paces.ts';
import { periodize } from './periodize.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { inputOf, PROFILES, type Profile } from './testInputs.ts';
import type { FiveKV2Plan, PlanDay, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import * as volume from './volume.ts';

function planOf(p: Profile): FiveKV2Plan {
  const r = generateFiveKV2(inputOf(p));
  if (!r.ok) throw new Error(JSON.stringify(r.reasons) + JSON.stringify(r.violations));
  return JSON.parse(JSON.stringify(r.plan)) as FiveKV2Plan;
}
const errorsOf = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const roleDay = (w: PlanWeek, role: PlanDay['role']): PlanDay =>
  w.days.find((d) => d.role === role)!;
const quality = (w: PlanWeek): PlanDay[] => w.days.filter((d) => d.workout.kind === 'quality');
const ALL = Object.entries(PROFILES);
/** Spor trkač, veliki obim (VDOT ~30, 45 km). */
const SLOW_BIG: Profile = {
  weeks: 12,
  km: 45,
  distanceM: 5000,
  timeSec: 1838,
  days: ['tue', 'thu', 'sat', 'sun']
};
/** Brz trkač, mali obim (15 km, VDOT ~53). */
const FAST_SMALL = (weeks: number): Profile => ({
  weeks,
  km: 15,
  distanceM: 5000,
  timeSec: 1110,
  days: ['tue', 'thu', 'sat', 'sun']
});

const SETS: Profile['days'][] = [
  ['tue', 'thu', 'sat', 'sun'],
  ['mon', 'wed', 'fri', 'sat'],
  ['mon', 'tue', 'thu', 'sat']
];
/** Mreža iz generate.node.test.ts: 5 obima × 4 trajanja × 4 rezultata × 3 rasporeda = 240. */
const GRID: Profile[] = [];
for (const km of [15, 22, 30, 38, 45])
  for (const weeks of [8, 11, 13, 16])
    for (const timeSec of [1100, 1300, 1600, 1830])
      for (const days of SETS) GRID.push({ weeks, km, distanceM: 5000, timeSec, days });

describe('Odluka 1: pošten cilj obima — kapacitet 4 dana ograničava cilj na ulazu', () => {
  it('spor + veliki obim: start = kapacitet < trenutni obim, napomena, svaka nedelja planirano = cilj', () => {
    const plan = planOf(SLOW_BIG);
    const capacity = volume.capacityKm(plan.paces, 4);
    expect(capacity).toBeLessThan(SLOW_BIG.km);
    expect(plan.capacityKm).toBe(capacity);
    expect(plan.startKm).toBe(capacity);
    expect(plan.weeks[0]!.notes.some((n) => n.includes('Za veći obim izaberi više dana'))).toBe(
      true
    );
    expect(plan.warnings.map((v) => v.rule)).toContain('START_ABOVE_CAPACITY');
    for (const w of plan.weeks) {
      expect(w.targetKm).toBeLessThanOrEqual(capacity);
      expect(w.easyCappedAtLong).toBe(false);
      if (w.phase !== 'race') expect(Math.abs(w.plannedKm - w.targetKm)).toBeLessThan(0.06);
    }
  });

  // 2.4.0 (Segment 05, Odluka 1): kapacitet se računa iz stvarne konstrukcije nedelje (ne iz
  // nejednačine sa 10% kvaliteta) i više nije monoton po VDOT-u; detalji u segment05.node.test.ts.
  it('kapacitet: dugi na kapacitetu ≤ 90 min, kapacitet ≤ apsolutnog vrha 4 dana', () => {
    for (const vdot of [30, 35, 40, 45, 50, 55, 60]) {
      const p = pacesFromVdot(vdot);
      const t = volume.capacityKm(p, 4);
      expect(volume.longCapKm(t, p, 4) * p.E.slow).toBeLessThanOrEqual(P.long.maxSec);
      expect(t).toBeLessThanOrEqual(50);
    }
  });

  it('validator: cilj iznad kapaciteta → VOLUME_CAPACITY', () => {
    const plan = planOf(SLOW_BIG);
    plan.weeks[1]!.targetKm = plan.capacityKm + 2;
    expect(errorsOf(plan)).toContain('VOLUME_CAPACITY');
  });
});

describe('Odluka 2: rasterećenje nije prva nedelja vrhunca ni oštrenja', () => {
  it('8–16 nedelja: nijedno rasterećenje u prvoj nedelji faze', () => {
    for (let n = P.input.planWeeks.min; n <= P.input.planWeeks.max; n++) {
      const frames = periodize('2026-11-02', n);
      for (const f of frames.filter((x) => x.deload))
        expect(frames[f.index - 2]!.phase, `${n} ned, nedelja ${f.index}`).toBe(f.phase);
    }
  });

  it('11 i 16 nedelja: rasterećenje pomereno na poslednju nedelju prethodne faze', () => {
    const at = (n: number): number[] =>
      periodize('2026-11-02', n)
        .filter((f) => f.deload)
        .map((f) => f.index);
    expect(at(11)).toEqual([3]);
    expect(at(16)).toEqual([4, 7, 11]);
  });

  it('validator: rasterećenje na početku faze → DELOAD_PHASE_START', () => {
    const plan = planOf(PROFILES['vdot55_40km_16w']!);
    const first = plan.weeks.find((w) => w.phase === 'peak')!;
    first.deload = true;
    expect(errorsOf(plan)).toContain('DELOAD_PHASE_START');
  });
});

describe('Odluka 3: nema dugog platoa u bazi', () => {
  const baseDose = (w: PlanWeek): string => {
    const q = quality(w);
    const t = q.find((d) => d.workout.workKm.T > 0)!.workout;
    return `${q.reduce((a, d) => a + d.workout.workKm.R, 0).toFixed(2)}|${t.qualityType}|${t.workKm.T}`;
  };

  it.each([...ALL, ['slow-big', SLOW_BIG] as [string, Profile]])(
    '%s: ista doza baze najviše 2 ne-rasteretne nedelje zaredom',
    (_, p) => {
      const base = planOf(p).weeks.filter((w) => w.phase === 'base' && !w.deload);
      for (let i = 2; i < base.length; i++)
        expect(
          baseDose(base[i]!) === baseDose(base[i - 1]!) &&
            baseDose(base[i - 1]!) === baseDose(base[i - 2]!)
        ).toBe(false);
    }
  );

  it('kontinuirani T u bazi raste za 0,5 km dok ne stigne do svog limita', () => {
    const plan = planOf(PROFILES['edge_45km_16w']!);
    const t = plan.weeks
      .filter((w) => w.phase === 'base' && !w.deload)
      .map((w) => quality(w).find((d) => d.workout.workKm.T > 0)!.workout);
    expect(t[0]!.qualityType).toBe('T_short');
    expect(t[1]!.workKm.T - t[0]!.workKm.T).toBeCloseTo(P.quality.tStepKm, 5);
    for (const x of t) expect(x.maxBoutSec.T).toBeLessThanOrEqual(P.quality.tContinuousMaxSec.base);
  });

  it('validator: tri iste nedelje baze → BASE_PLATEAU', () => {
    const plan = planOf(PROFILES['edge_45km_16w']!);
    const base = plan.weeks.filter((w) => w.phase === 'base' && !w.deload);
    expect(base.length).toBeGreaterThanOrEqual(3);
    const src = base[0]!;
    for (const w of base.slice(1, 3))
      w.days = w.days.map((d) =>
        d.workout.kind === 'quality' ? { ...d, workout: roleDay(src, d.role).workout } : d
      );
    expect(errorsOf(plan)).toContain('BASE_PLATEAU');
  });
});

describe('Odluka 4: jedan T limit po fazi, jedan vrh obima', () => {
  it('policy: tContinuousMaxSec je tabela po fazi; nema dvojnika shortTMaxSec', () => {
    expect(P.quality.tContinuousMaxSec).toEqual({
      base: 900,
      peak: 1200,
      sharpen: 900,
      taper: 600
    });
    expect('shortTMaxSec' in P.quality).toBe(false);
  });

  it.each(ALL)('%s: T blok ≤ limit faze; vrh = peakKm(start)', (_, p) => {
    const plan = planOf(p);
    for (const w of plan.weeks)
      for (const d of w.days)
        if (w.phase !== 'race')
          expect(d.workout.maxBoutSec.T).toBeLessThanOrEqual(P.quality.tContinuousMaxSec[w.phase]);
    expect(plan.peakKm).toBeLessThanOrEqual(volume.peakKm(plan.startKm, plan.capacityKm, 4));
  });

  it('peakKm = min(1,3 × start, kapacitet, 50) za 4 dana', () => {
    expect(volume.peakKm(20, 100, 4)).toBe(26);
    expect(volume.peakKm(45, 100, 4)).toBe(50);
    expect(volume.peakKm(45, 47, 4)).toBe(47);
  });
});

describe('Odluka 5: brz trkač sa malim obimom (15 km, VDOT ~53)', () => {
  it.each([8, 11, 13, 16])('%i ned: plan, ne odbijanje', (weeks) => {
    const plan = planOf(FAST_SMALL(weeks));
    expect(plan.vdot).toBeGreaterThan(52);
    expect(errorsOf(plan)).toEqual([]);
  });

  it('8 ned: rasteretni vrhunac bez I — zamena (2.3.0: samo ubrzanja, R 4 × 150 m nije zamena)', () => {
    const w = planOf(FAST_SMALL(8)).weeks.find((x) => x.phase === 'peak' && x.deload)!;
    expect(quality(w)).toHaveLength(0);
    expect(w.stridesOnly).toBe(true);
    expect(w.notes.some((n) => n.includes('samo ubrzanja'))).toBe(true);
    expect(
      w.days.some((d) => d.role === 'easy' && d.workout.segments.some((s) => s.kind === 'stride'))
    ).toBe(true);
  });

  // 2.4.0 (Segment 05, Odluka 3): bez višeg nivoa I više nije zadržan — ista doza druge strukture
  // (ovde kraći oporavak); identičan I dve nedelje zaredom ne postoji.
  it('11 ned: I neopadajući; bez višeg nivoa ista doza druge strukture (ne zadržan I)', () => {
    const peak = planOf(FAST_SMALL(11)).weeks.filter((w) => w.phase === 'peak' && !w.deload);
    let alt = 0;
    for (let i = 1; i < peak.length; i++) {
      const a = roleDay(peak[i - 1]!, 'q1').workout;
      const b = roleDay(peak[i]!, 'q1').workout;
      expect(b.workKm.I).toBeGreaterThanOrEqual(a.workKm.I);
      expect(JSON.stringify(b.blocks)).not.toBe(JSON.stringify(a.blocks));
      if (Math.abs(b.workKm.I - a.workKm.I) < 1e-9) alt++;
    }
    expect(alt).toBeGreaterThan(0);
  });
});

describe('Odluka 6: trkačka nedelja', () => {
  it.each([...ALL, ['slow-big', SLOW_BIG] as [string, Profile]])(
    '%s: lagan ≤ 50 min i ≤ 50% dugog prethodne nedelje',
    (_, p) => {
      const plan = planOf(p);
      const race = plan.weeks[plan.weeks.length - 1]!;
      const prevLong = roleDay(plan.weeks[plan.weeks.length - 2]!, 'long').workout.km;
      for (const d of race.days.filter((x) => x.role === 'easy')) {
        expect(d.workout.km).toBeLessThanOrEqual(prevLong * 0.5 + 1e-9);
        expect(d.workout.km * plan.paces.E.slow).toBeLessThanOrEqual(3000 + 1e-6);
      }
      if (race.plannedKm < race.targetKm - 0.05)
        expect(race.notes.some((n) => n.includes('ostatak se ne raspoređuje'))).toBe(true);
    }
  );

  it('validator: predug lagan dan trkačke nedelje → RACE_WEEK_EASY', () => {
    const plan = planOf(PROFILES['vdot48_30km_9w']!);
    const race = plan.weeks[plan.weeks.length - 1]!;
    const easy = race.days.find((d) => d.role === 'easy')!;
    easy.workout = roleDay(plan.weeks[0]!, 'long').workout;
    expect(errorsOf(plan)).toContain('RACE_WEEK_EASY');
  });
});

describe('mreža 240 ulaza (segment02): Odluke 1, 2 i 5', () => {
  it('svi planovi; 0 „lagan = dugi" van trkačke nedelje; planirano < cilj samo u trkačkoj', () => {
    let capped = 0;
    let belowOutsideRace = 0;
    let deloadAtPhaseStart = 0;
    const rejectedFastSmall: string[] = [];
    for (const p of GRID) {
      const r = generateFiveKV2(inputOf(p));
      if (!r.ok) {
        if (p.km === 15 && p.timeSec === 1100) rejectedFastSmall.push(`${p.weeks}`);
        expect(r.reasons.map((x) => x.code)).toEqual([]);
        continue;
      }
      expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
      for (const w of r.plan.weeks) {
        if (w.phase === 'race') continue;
        if (w.easyCappedAtLong && w.plannedKm < w.targetKm) capped++;
        if (w.plannedKm < w.targetKm - 0.05) belowOutsideRace++;
        const prev = r.plan.weeks[w.index - 2];
        if (w.deload && prev?.phase !== w.phase) deloadAtPhaseStart++;
      }
      expect(
        r.plan.warnings.filter((v) => v.rule === 'PLANNED_BELOW_TARGET').map((v) => v.week)
      ).toEqual([]);
    }
    expect({ capped, belowOutsideRace, deloadAtPhaseStart, rejectedFastSmall }).toEqual({
      capped: 0,
      belowOutsideRace: 0,
      deloadAtPhaseStart: 0,
      rejectedFastSmall: []
    });
  });
});
