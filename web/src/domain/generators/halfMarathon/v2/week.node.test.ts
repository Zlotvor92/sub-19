/* Sastav nedelje: H13 dužine (pouka 2), H14 WU/CD, H5 rasterećenje, H7 taper, H8 trkačka nedelja (pouka 5),
   Uslov 8. Primeri iz mreže 01. */

import { describe, expect, it } from 'vitest';
import { daysBetween } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import type { HmV2Plan, PlanWeek } from './types.ts';
import { gridInputs } from './testInputs.ts';
import { warmupCooldown } from './workouts.ts';

const GRID = gridInputs();
const plan = (id: string): HmV2Plan => {
  const r = generateHmV2(GRID.find((g) => g.id === id)!.input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const km = (w: PlanWeek, role: string): number[] =>
  w.days.filter((d) => d.role === role).map((d) => d.workout.km);

describe('H14 WU/CD po pojasu trenutnog obima', () => {
  it('< 40 km 15/10; 40–59,9 km 20/15; ≥ 60 km 25/15 (0,1 km)', () => {
    expect(warmupCooldown(39.9)).toEqual({ warmupSec: 900, cooldownSec: 600 });
    expect(warmupCooldown(40)).toEqual({ warmupSec: 1200, cooldownSec: 900 });
    expect(warmupCooldown(59.9)).toEqual({ warmupSec: 1200, cooldownSec: 900 });
    expect(warmupCooldown(60)).toEqual({ warmupSec: 1500, cooldownSec: 900 });
  });

  it('isti pojas za ceo plan, i za oštrenje', () => {
    const p = plan('12w-60km-v45-A-sun');
    for (const w of p.weeks)
      for (const d of w.days.filter((x) => x.workout.kind === 'quality')) {
        expect(d.workout.segments[0]!.sec).toBe(1500);
        expect(d.workout.segments.at(-1)!.sec).toBe(900);
      }
  });
});

describe('H13 dužine (pouka 2)', () => {
  it('dugi ≤ 40 % cilja i ≤ 150 min sporim E, ≥ lagan; lagan ≥ 4 km; korak 0,1 km', () => {
    for (const id of ['10w-30km-v70-A-sun', '16w-50km-v30-C-sat', '20w-60km-v55-B-sun']) {
      const p = plan(id);
      for (const w of p.weeks.filter((x) => x.phase !== 'race')) {
        const long = km(w, 'long')[0]!;
        expect(long * 10, `${id} ${w.index}`).toBeLessThanOrEqual(
          Math.floor(0.4 * w.targetKm * 10 + 1e-9)
        );
        expect(long * p.paces.E.slow).toBeLessThanOrEqual(9000);
        for (const e of km(w, 'easy')) {
          expect(e).toBeLessThanOrEqual(long);
          expect(e).toBeGreaterThanOrEqual(4);
          expect(Math.round(e * 10)).toBeCloseTo(e * 10, 6);
        }
      }
    }
  });

  it('spor trkač velikog obima: dugi na 150 min (ograničenje kapaciteta, CAPACITY_LIMITED)', () => {
    const p = plan('16w-50km-v30-C-sat');
    const cap = Math.floor((9000 / p.paces.E.slow) * 10) / 10;
    expect(km(p.weeks[0]!, 'long')[0]).toBe(cap);
    expect(p.warnings.some((w) => w.rule === 'CAPACITY_LIMITED')).toBe(true);
    expect(p.notes.join()).toContain('uz dugi ≤ 150 min');
  });
});

describe('H5 rasterećenje i H7 taper', () => {
  const p = plan('12w-40km-v45-A-sun');
  const w = (i: number): PlanWeek => p.weeks[i - 1]!;

  it('rasterećenje: cilj 0,8 × poslednji ne-rasteretni, jedan T kvalitet na danu Q2, dugi 0,8 × poslednji', () => {
    const d = p.weeks.filter((x) => x.deload).map((x) => x.index);
    expect(d).toEqual([5, 9]);
    expect(w(5).targetKm).toBe(Math.round(0.8 * w(4).targetKm * 10) / 10);
    const q = w(5).days.filter((x) => x.workout.kind === 'quality');
    expect(q.map((x) => [x.role, x.workout.dose!.zone, x.workout.dose!.doseM])).toEqual([
      ['q2', 'T', 2000]
    ]);
    expect(km(w(5), 'long')[0]).toBe(Math.floor(0.8 * km(w(4), 'long')[0]! * 10) / 10);
    expect(km(w(5), 'easy')).toHaveLength(2);
  });

  it('taper: 0,7 × vrh; RP i T ≈ 60 %; dugi ≤ 0,6 × najduži; svi dani', () => {
    const t = p.weeks.find((x) => x.phase === 'taper')!;
    expect(t.targetKm).toBe(Math.round(0.7 * p.peakKm * 10) / 10);
    expect(t.days).toHaveLength(4);
    const longest = Math.max(...p.weeks.flatMap((x) => km(x, 'long')));
    expect(km(t, 'long')[0]!).toBeLessThanOrEqual(Math.floor(0.6 * longest * 10) / 10);
    const doses = t.days.filter((x) => x.workout.dose).map((x) => [x.role, x.workout.dose!.zone]);
    expect(doses).toEqual([
      ['q1', 'RP'],
      ['q2', 'T']
    ]);
  });
});

describe('H8 trkačka nedelja (pouka 5)', () => {
  it('trka nedelja: oštrenje 2 × 2000 m RP (2:00) ≥ 3 dana pre trke, dan pred trku 20 min + 4 × 20 s, lagan ≤ taper', () => {
    for (const id of [
      '12w-40km-v45-A-sun',
      '12w-40km-v45-B-sun',
      '12w-40km-v45-C-sat',
      '12w-40km-v45-A-sat'
    ]) {
      const p = plan(id);
      const r = p.weeks.at(-1)!;
      const t = p.weeks.at(-2)!;
      const race = r.days.find((d) => d.role === 'race')!;
      expect(race.date).toBe(p.input.raceDate);
      expect(race.countsToWeek).toBe(false);
      expect(race.workout.segments.map((s) => [s.kind, s.kind === 'race' ? s.km : s.sec])).toEqual([
        ['warmup', 600],
        ['race', 21.1],
        ['cooldown', 600]
      ]);
      expect(r.days).toHaveLength(4); // min(4, 5) dana sa trkom
      expect(r.days.some((d) => d.role === 'long')).toBe(false);
      const sh = r.days.filter((d) => d.role === 'sharpener');
      expect(sh, id).toHaveLength(1);
      expect(daysBetween(sh[0]!.date, p.input.raceDate)).toBeGreaterThanOrEqual(3);
      expect(sh[0]!.workout.blocks[1]).toEqual({
        kind: 'reps',
        zone: 'RP',
        reps: 2,
        rep: { m: 2000 },
        recovery: { sec: 120 }
      });
      const tRp = t.days.find((d) => d.role === 'q1')!.workout.dose!.doseM;
      expect(sh[0]!.workout.dose!.doseM).toBeLessThanOrEqual(tRp);
      const eve = r.days.find((d) => daysBetween(d.date, p.input.raceDate) === 1);
      if (eve) {
        expect(eve.role).toBe('eve');
        expect(eve.workout.sec).toBeLessThanOrEqual(1800);
      }
      const tEasy = Math.min(...km(t, 'easy'));
      for (const e of r.days.filter((d) => d.role === 'easy')) {
        expect(e.workout.km).toBeLessThanOrEqual(tEasy);
        expect(e.workout.sec).toBeLessThanOrEqual(2100);
      }
      expect(r.plannedKm).toBeLessThanOrEqual(t.plannedKm);
      expect(r.targetKm).toBe(Math.round(r.plannedKm * 10) / 10);
      expect(r.plannedKm + 21.1).toBeGreaterThanOrEqual(16); // Uslov 8 sa trkom
    }
  });

  it('kratak lagan tapera: lagan trkačke nedelje u km (= najkraći lagan tapera)', () => {
    const p = plan('10w-30km-v45-A-sun');
    const r = p.weeks.at(-1)!;
    const t = p.weeks.at(-2)!;
    const e = r.days.find((d) => d.role === 'easy')!;
    expect(e.workout.blocks[0]!.kind).toBe('easy');
    expect(e.workout.km).toBe(Math.min(...km(t, 'easy')));
  });
});

describe('Uslov 8: upotrebljivost', () => {
  it('nema praznog treninga; nedelja ≥ 16 km; dugi ≥ lagan; planirano = cilj', () => {
    for (const id of ['10w-30km-v30-A-sun', '20w-60km-v70-C-sat']) {
      const p = plan(id);
      for (const w of p.weeks) {
        for (const d of w.days) expect(d.workout.km).toBeGreaterThan(0);
        if (w.phase !== 'race') expect(w.plannedKm).toBeGreaterThanOrEqual(16);
        expect(Math.abs(w.plannedKm - w.targetKm)).toBeLessThanOrEqual(0.1 + 1e-9);
      }
    }
  });
});
