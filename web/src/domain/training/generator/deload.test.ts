/* Deload repeats an already introduced stimulus at a reduced dose, or remains
   easy when no usable quality dose has been introduced. It must not introduce
   R pace merely because the calendar says "deload". Volume and work are
   checked separately: extra WU/CD cannot make an increased work dose acceptable.
   The 58–92% delivered-volume band is a product regression guard, not a
   universal physiological threshold. */

import { generatePlan } from '@/test/generators';
import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import type { Day, PlanGenerationInput, Session, Week } from '../types';
import { ZONE_FOR_KIND } from '../vdot/zoneForKind';

const PB: Record<number, { distM: number; sec: number }> = {
  5000: { distM: 5000, sec: 1290 },
  10000: { distM: 10000, sec: 2700 },
  21097.5: { distM: 21097.5, sec: 5700 },
  42195: { distM: 42195, sec: 12000 }
};
const DISTANCES: Array<[string, number, number, number]> = [
  ['5K', 5000, 16, 45],
  ['10K', 10000, 18, 50],
  ['Polumaraton', 21097.5, 20, 70],
  ['Maraton', 42195, 20, 70]
];
const START = parseIsoDate('2026-08-17') as IsoDate;
const dateIn = (n: number): string => addDays(START, n * 7 - 2);

function plan(
  distM: number,
  weeks: number,
  km: number,
  extra: Partial<PlanGenerationInput> = {}
): Week[] {
  const g = generatePlan({
    startDate: START,
    raceDate: dateIn(weeks),
    raceDistM: distM,
    pb: PB[distM] as { distM: number; sec: number },
    weeklyKm: km,
    runDays: 5,
    quality: 2,
    intensity: 'std',
    trainedRecently: true,
    ...extra
  });
  if ('error' in g) throw new Error(`plan se nije napravio: ${g.error}`);
  return g.weeks;
}

const weekKm = (w: Week): number => w.days.reduce((s, d) => s + (d.km || 0), 0);
const quality = (w: Week): Day[] => w.days.filter((d) => d.tag === 'int' || d.tag === 'tempo');

const established: Partial<PlanGenerationInput> = {
  consistentWeeks: 12,
  qualityExperience: 'experienced'
};
const workSeconds = (s: Session): number => {
  switch (s.type) {
    case 'int':
      return (s.reps * s.repM * s.paceSec) / 1000;
    case 'pyramid':
      return (s.reps.reduce((sum, m) => sum + m, 0) * s.paceSec) / 1000;
    case 'fartlek':
      return s.reps * s.repSec;
    case 'prog':
      return (s.qKm * s.paceSec) / 3;
    case 'tempo':
      return s.qKm * s.paceSec;
  }
};
const zone = (s: Session): string | undefined => s.zone ?? ZONE_FOR_KIND[s.kind];

function assertReducedPreviouslyIntroducedQuality(weeks: Week[], label: string): void {
  for (let i = 0; i < weeks.length; i++) {
    const current = weeks[i]!;
    if (!current.deload) continue;
    const sessions = current.days.filter((day) => day.session);
    expect(sessions.length, `${label} N${current.w}: at most one quality day`).toBeLessThanOrEqual(
      1
    );
    const prior = weeks
      .slice(0, i)
      .flatMap((week) => week.days)
      .filter((day) => day.session)
      .at(-1)?.session;
    if (!prior) {
      expect(sessions, `${label} N${current.w}: no new stimulus before first quality`).toHaveLength(
        0
      );
      continue;
    }
    for (const day of sessions) {
      const session = day.session!;
      expect(zone(session), `${label} N${current.w}: previously introduced zone`).toBe(zone(prior));
      expect(session.paceSec, `${label} N${current.w}: no faster work`).toBeGreaterThanOrEqual(
        prior.paceSec
      );
      expect(
        workSeconds(session),
        `${label} N${current.w}: reduced actual work`
      ).toBeLessThanOrEqual(workSeconds(prior) * 0.6 + 1e-8);
      expect(day.desc, `${label} N${current.w}: visible recovery purpose`).toContain(
        'Rasterećenje'
      );
    }
  }
}

describe('Deload reduces a previously introduced stimulus', () => {
  for (const [name, distM, weeks, km] of DISTANCES) {
    it(`${name}: experienced and missing-history runners keep at most one familiar quality dose`, () => {
      for (const history of [established, {}]) {
        const all = plan(distM, weeks, km, history);
        expect(all.some((week) => week.deload)).toBe(true);
        assertReducedPreviouslyIntroducedQuality(all, name);
      }
    });
  }

  it('deload still delivers less mileage than its preceding full week', () => {
    for (const [name, distM, weeks, km] of DISTANCES) {
      for (const history of [established, {}]) {
        const all = plan(distM, weeks, km, history);
        for (let i = 1; i < all.length; i++) {
          const current = all[i]!;
          if (!current.deload) continue;
          expect(weekKm(current), `${name} N${current.w}`).toBeLessThan(weekKm(all[i - 1]!));
        }
      }
    }
  });

  it('the delivered recovery week stays in its intended mileage band', () => {
    for (const [name, distM, weeks] of DISTANCES) {
      for (const runDays of [3, 4, 5]) {
        for (const km of [12, 22, 45, 70]) {
          for (const history of [established, {}]) {
            const all = plan(distM, weeks, km, { runDays, ...history });
            for (let i = 1; i < all.length; i++) {
              const current = all[i]!;
              if (!current.deload) continue;
              const share = weekKm(current) / weekKm(all[i - 1]!);
              const label = `${name} ${runDays}d ${km}km N${current.w} ${history.qualityExperience ?? 'missing history'}`;
              expect(share, `${label}: too little recovery mileage`).toBeGreaterThanOrEqual(0.58);
              expect(share, `${label}: insufficient unloading`).toBeLessThanOrEqual(0.92);
            }
          }
        }
      }
    }
  });

  it('beginner W8 does not increase work or mileage after its first introductory quality', () => {
    const all = plan(5000, 16, 8, {
      runDays: 3,
      quality: 1,
      pb: { distM: 5000, sec: 2100 },
      intensity: 'kons',
      volIntensity: 'kons',
      trainedRecently: false,
      consistentWeeks: 0,
      qualityExperience: 'none'
    });
    const before = all[6]!;
    const recovery = all[7]!;
    expect(before.days.some((day) => day.session)).toBe(true);
    expect(recovery.deload).toBe(true);
    expect(weekKm(recovery)).toBeLessThan(weekKm(before));
    const beforeWork = before.days.reduce(
      (sum, day) => sum + (day.session ? workSeconds(day.session) : 0),
      0
    );
    const recoveryWork = recovery.days.reduce(
      (sum, day) => sum + (day.session ? workSeconds(day.session) : 0),
      0
    );
    expect(recoveryWork).toBeLessThanOrEqual(beforeWork * 0.6);
    expect(recovery.days.some((day) => day.session && zone(day.session) === 'R')).toBe(false);
    assertReducedPreviouslyIntroducedQuality(all, 'beginner');
  });

  it('returning W4 stays easy when no quality has yet been introduced', () => {
    const all = plan(10000, 18, 15, {
      runDays: 3,
      quality: 1,
      pb: { distM: 5000, sec: 1620 },
      volIntensity: 'kons',
      consistentWeeks: 1,
      breakWeeks: 8,
      qualityExperience: 'experienced',
      recentLongRunKm: 5
    });
    expect(all.slice(0, 3).every((week) => !week.days.some((day) => day.session))).toBe(true);
    const recovery = all[3]!;
    expect(recovery.deload).toBe(true);
    expect(recovery.days.some((day) => day.session)).toBe(false);
    expect(weekKm(recovery)).toBeLessThan(weekKm(all[2]!));
    assertReducedPreviouslyIntroducedQuality(all, 'returning');
  });

  it('the beginner base does not introduce a quality session on recovery weeks', () => {
    const all = plan(5000, 20, 25, { trainedRecently: false });
    const base = all.slice(0, 6);
    expect(base.length).toBe(6);
    for (const week of base)
      expect(
        week.days.some((day) => day.session),
        `N${week.w}`
      ).toBe(false);
  });
});

describe('Nedelja kaže čemu služi', () => {
  it('nijedna nedelja nije bez oznake', () => {
    for (const [name, distM, weeks, km] of DISTANCES) {
      for (const w of plan(distM, weeks, km)) expect(w.focus, `${name} N${w.w}`).toMatch(/\S/);
    }
  });

  it('oznaka imenuje ono što u nedelji STVARNO stoji', () => {
    const all = plan(5000, 16, 45);
    for (const w of all) {
      /* Trkačka nedelja nosi „TRKA" i to je cela poruka. */
      if (w.deload || w.w === all.length || !quality(w).length) continue;
      for (const d of quality(w)) expect(w.focus, `N${w.w}`).toContain(d.session?.kind ?? '');
    }
  });

  it('trkačka nedelja i taper nose svoje ime', () => {
    const w = plan(5000, 16, 45);
    expect((w[w.length - 1] as Week).focus).toMatch(/TRKA/);
    expect((w[w.length - 2] as Week).focus).toMatch(/Taper/i);
  });
});
