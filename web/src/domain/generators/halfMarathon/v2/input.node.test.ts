/* H1, H15, H17, HI7: opseg ulaza i strukturisano odbijanje sa preporukom. */

import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { checkInput } from './input.ts';
import { generateHmV2 } from './generate.ts';
import { inputOf, SCHEDULES, SCHEDULES_BY_DAYS, START, timeForVdot } from './testInputs.ts';

const base = (o: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  ...inputOf({ weeks: 12, km: 40, vdot: 45, days: SCHEDULES.A.days }),
  ...o
});
const codes = (raw: unknown): string[] => {
  const r = checkInput(raw);
  return r.ok ? [] : r.reasons.map((x) => x.code);
};
const message = (raw: unknown): string => {
  const r = checkInput(raw);
  return r.ok ? '' : r.reasons.map((x) => x.message).join(' | ');
};

describe('H1 opseg ulaza', () => {
  it('ispravan ulaz prolazi (4 dana, 12 ned, 40 km, rezultat 10 km)', () => {
    const r = checkInput(base());
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.weeks, r.rule.weekMinKm, r.pattern.long]).toEqual([12, 16, 'sun']);
  });

  it('nedelje: < 10 trajno (preporuka 10K), > 20 „počni kasnije" sa datumom, 10 i 20 prolaze', () => {
    const w = (weeks: number) => base({ raceDate: addDays(START, weeks * 7 - 1) });
    expect(codes(w(9))).toEqual(['PLAN_TOO_SHORT']);
    expect(message(w(9))).toContain('10K');
    expect(codes(w(21))).toEqual(['PLAN_TOO_LONG']);
    expect(message(w(21))).toContain(`najranije ${addDays(START, 7)}`);
    expect(codes(w(10))).toEqual([]);
    expect(codes(w(20))).toEqual([]);
    expect(codes(base({ raceDate: addDays(START, 80) }))).toEqual(['PLAN_NOT_WHOLE_WEEKS']);
  });

  it('obim po redu H15 (4 dana 30–60): van reda preporuka brojeva dana čiji red podržava obim', () => {
    expect(codes(base({ currentWeeklyKm: 29.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(message(base({ currentWeeklyKm: 29.9 }))).toContain('Obim podržava 3 dana trčanja');
    expect(codes(base({ currentWeeklyKm: 60.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
    expect(message(base({ currentWeeklyKm: 60.1 }))).toContain('Obim podržava 5–6 dana trčanja');
    expect(codes(base({ currentWeeklyKm: 30 }))).toEqual([]);
    expect(codes(base({ currentWeeklyKm: 60 }))).toEqual([]);
  });

  it('H15 granice obima 3/5/6 dana; ispod 25 km 10K ili osnova; iznad 90 km najviše 90 (6 dana)', () => {
    const d = (n: 3 | 5 | 6, km: number) =>
      base({ runDays: SCHEDULES_BY_DAYS[n].A.days, currentWeeklyKm: km });
    for (const [n, lo, hi] of [
      [3, 25, 45],
      [5, 35, 75],
      [6, 40, 90]
    ] as const) {
      expect(codes(d(n, lo)), `${n} ${lo}`).toEqual([]);
      expect(codes(d(n, hi)), `${n} ${hi}`).toEqual([]);
      expect(codes(d(n, lo - 0.1)), `${n} < ${lo}`).toEqual(['WEEKLY_KM_TOO_LOW']);
      expect(codes(d(n, hi + 0.1)), `${n} > ${hi}`).toEqual(['WEEKLY_KM_TOO_HIGH']);
    }
    expect(message(d(3, 24.9))).toMatch(/10K plan ili izgradnja osnove/);
    expect(message(d(6, 39.9))).toContain('Obim podržava 3–5 dana trčanja');
    expect(message(d(3, 45.1))).toContain('Obim podržava 4–6 dana trčanja');
    expect(message(d(6, 90.1))).toContain('najviše 90 km (6 dana)');
  });

  it('T7 (krug T): skorašnji najduži > trenutni nedeljni obim → odbijanje RECENT_LONG_OVER_WEEKLY (proveri unos)', () => {
    expect(codes(base({ recentLongRunKm: 40 }))).toEqual([]);
    expect(codes(base({ recentLongRunKm: 40.1 }))).toEqual(['RECENT_LONG_OVER_WEEKLY']);
    expect(message(base({ recentLongRunKm: 40.1 }))).toBe(
      'Skorašnje najduže trčanje (40,1 km) je duže od trenutnog nedeljnog obima (40 km) — proveri unos.'
    );
    // Van opsega 5–42 ostaje samo RECENT_LONG_INVALID.
    expect(codes(base({ recentLongRunKm: 42.1 }))).toEqual(['RECENT_LONG_INVALID']);
  });

  it('HI7 (pouka 28): recentLongRunKm opcion, 5–42 km; u ulazu plana samo kad je dat', () => {
    expect(codes(base({ recentLongRunKm: 5 }))).toEqual([]);
    expect(codes(base({ recentLongRunKm: 42, currentWeeklyKm: 45 }))).toEqual([]);
    expect(codes(base({ recentLongRunKm: null }))).toEqual([]);
    expect(codes(base({ recentLongRunKm: 4.9 }))).toEqual(['RECENT_LONG_INVALID']);
    expect(codes(base({ recentLongRunKm: 42.1 }))).toEqual(['RECENT_LONG_INVALID']);
    expect(codes(base({ recentLongRunKm: '12' }))).toEqual(['INPUT_SHAPE']);
    const a = checkInput(base({ recentLongRunKm: 12 }));
    const b = checkInput(base());
    expect(a.ok && a.input.recentLongRunKm).toBe(12);
    expect(b.ok && 'recentLongRunKm' in b.input).toBe(false);
  });

  it('dani: 3, 4, 5, 6 prolaze; 1, 2, 7 trajno; dupli ili nepoznat dan', () => {
    for (const d of [['sun'], ['tue', 'sun'], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']])
      expect(codes(base({ runDays: d })), d.join()).toEqual(['RUN_DAYS_COUNT']);
    expect(message(base({ runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }))).toContain(
      'jedan dan odmora'
    );
    for (const [d, km] of [
      [['tue', 'thu', 'sun'], 40],
      [['mon', 'tue', 'thu', 'sat', 'sun'], 40],
      [['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], 40]
    ] as const) {
      const r = checkInput(base({ runDays: d, currentWeeklyKm: km }));
      expect(r.ok, d.join()).toBe(true);
      if (r.ok) expect(r.rule.weekMinKm).toBe(d.length * 4);
    }
    expect(message(base({ runDays: ['tue', 'sun'] }))).toContain('3, 4, 5, 6 dana');
    expect(codes(base({ runDays: ['tue', 'tue', 'sat', 'sun'] }))).toEqual(['RUN_DAYS_INVALID']);
    expect(codes(base({ runDays: ['tue', 'xyz', 'sat', 'sun'] }))).toEqual(['RUN_DAYS_INVALID']);
    expect(codes(base({ longRunDay: 'mon' }))).toEqual(['LONG_DAY_INVALID']);
  });

  it('rezultat: 5/10 km, HM, maraton; bez rezultata, stariji od 84 dana ili VDOT < 30 → plan po osećaju (H16: lagan tempo obavezan)', () => {
    for (const d of [5000, 10000, 21097.5, 42195])
      expect(
        codes(base({ recentResult: { distanceM: d, timeSec: timeForVdot(45, d), date: START } }))
      ).toEqual([]);
    expect(codes(base({ recentResult: { distanceM: 3000, timeSec: 700, date: START } }))).toEqual([
      'RESULT_DISTANCE_UNSUPPORTED'
    ]);
    expect(codes(base({ recentResult: null }))).toEqual(['EASY_PACE_REQUIRED']);
    expect(message(base({ recentResult: null }))).toContain('bez rezultata trke');
    expect(codes(base({ recentResult: null, easyPaceSecPerKm: 360 }))).toEqual([]);
    const old = { distanceM: 10000, timeSec: 2700, date: addDays(START, -85) };
    expect(codes(base({ recentResult: old }))).toEqual(['EASY_PACE_REQUIRED']);
    expect(message(base({ recentResult: old }))).toContain('star 85 dana');
    expect(codes(base({ recentResult: old, easyPaceSecPerKm: 360 }))).toEqual([]);
    expect(codes(base({ recentResult: { ...old, date: addDays(START, -84) } }))).toEqual([]);
    const slow = { distanceM: 10000, timeSec: timeForVdot(29.9), date: START };
    expect(codes(base({ recentResult: slow }))).toEqual(['EASY_PACE_REQUIRED']);
    expect(codes(base({ recentResult: slow, easyPaceSecPerKm: 450 }))).toEqual([]);
    const fast = { distanceM: 10000, timeSec: timeForVdot(80.1), date: START };
    expect(codes(base({ recentResult: fast }))).toEqual(['VDOT_TOO_HIGH']);
    expect(
      codes(base({ recentResult: { distanceM: 10000, timeSec: 2700, date: addDays(START, 1) } }))
    ).toEqual(['RESULT_AFTER_START']);
    expect(codes(base({ recentResult: { distanceM: 10000, timeSec: 0, date: START } }))).toEqual([
      'RESULT_TIME_INVALID'
    ]);
  });

  it('H16: lagan tempo 270–510 s/km (granice uključene); uz pouzdan rezultat se ne traži', () => {
    const feel = (e: unknown) => base({ recentResult: null, easyPaceSecPerKm: e });
    expect(codes(feel(270))).toEqual([]);
    expect(codes(feel(510))).toEqual([]);
    expect(codes(feel(269))).toEqual(['EASY_PACE_OUT_OF_RANGE']);
    expect(codes(feel(511))).toEqual(['EASY_PACE_OUT_OF_RANGE']);
    expect(message(feel(511))).toContain('4:30–8:30/km');
    expect(codes(feel('6:00'))).toEqual(['INPUT_SHAPE']);
    // Uz pouzdan rezultat lagan tempo van opsega ne smeta (ne koristi se).
    expect(codes(base({ easyPaceSecPerKm: 900 }))).toEqual([]);
  });

  it('H17 trčanje/hodanje (sa preporukom 5K) pre svega ostalog; oblik ulaza; cilj', () => {
    expect(codes(base({ runWalk: true }))).toEqual(['RUN_WALK_NOT_SUPPORTED']);
    expect(message(base({ runWalk: true }))).toContain('5K plan trčanja/hodanja');
    expect(codes(base({ runWalk: true, experience: 'beginner', runDays: ['sun'] }))).toEqual([
      'RUN_WALK_NOT_SUPPORTED'
    ]);
    expect(codes(base({ experience: 'regular', runWalk: false }))).toEqual([]);
    expect(codes(null)).toEqual(['INPUT_SHAPE']);
    expect(codes(base({ currentWeeklyKm: '40' }))).toEqual(['INPUT_SHAPE']);
    expect(codes(base({ experience: 'pro' }))).toEqual(['INPUT_SHAPE']);
    expect(codes(base({ goalTimeSec: -1 }))).toEqual(['GOAL_INVALID']);
    expect(codes(base({ startDate: '2026-02-30' }))).toEqual(['DATE_INVALID']);
    expect(codes(base({ raceDate: START }))).toEqual(['RACE_NOT_AFTER_START']);
  });

  it('H17 početnik: 4–5 dana, 12–20 nedelja, obim 4 d 20–40 / 5 d 25–45 km (ispod → 10K, iznad → bez oznake)', () => {
    const b = (o: Record<string, unknown>) => base({ experience: 'beginner', ...o });
    expect(codes(b({ currentWeeklyKm: 30 }))).toEqual([]);
    expect(codes(b({ currentWeeklyKm: 20 }))).toEqual([]);
    expect(codes(b({ currentWeeklyKm: 40 }))).toEqual([]);
    expect(codes(b({ currentWeeklyKm: 19.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(message(b({ currentWeeklyKm: 19.9 }))).toContain('10K plan');
    expect(codes(b({ currentWeeklyKm: 40.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
    expect(message(b({ currentWeeklyKm: 40.1 }))).toContain('bez oznake početnika');
    const five = ['mon', 'tue', 'thu', 'sat', 'sun'];
    expect(codes(b({ runDays: five, currentWeeklyKm: 25 }))).toEqual([]);
    expect(codes(b({ runDays: five, currentWeeklyKm: 45 }))).toEqual([]);
    expect(codes(b({ runDays: five, currentWeeklyKm: 24.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(codes(b({ runDays: five, currentWeeklyKm: 45.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
    for (const days of [
      ['tue', 'thu', 'sun'],
      ['mon', 'tue', 'wed', 'thu', 'sat', 'sun']
    ]) {
      expect(codes(b({ runDays: days }))).toEqual(['BEGINNER_DAYS']);
      expect(message(b({ runDays: days }))).toContain('preporuka 4–5 dana');
    }
    expect(codes(b({ raceDate: addDays(START, 7 * 11 - 1) }))).toEqual(['BEGINNER_SHORT']);
    expect(codes(b({ raceDate: addDays(START, 7 * 12 - 1) }))).toEqual([]);
    expect(codes(b({ raceDate: addDays(START, 7 * 9 - 1) }))).toEqual(['PLAN_TOO_SHORT']);
    expect(codes(b({ raceDate: addDays(START, 7 * 21 - 1) }))).toEqual(['PLAN_TOO_LONG']);
    // Početnik po osećaju: lagan tempo obavezan kao i za redovan plan.
    expect(codes(b({ recentResult: null }))).toEqual(['EASY_PACE_REQUIRED']);
    expect(codes(b({ recentResult: null, easyPaceSecPerKm: 450 }))).toEqual([]);
  });

  it('H9: raspored bez nesusednih teških dana → SCHEDULE_NO_RECOVERY sa predlogom', () => {
    const days = ['thu', 'fri', 'sat', 'sun'];
    expect(codes(base({ runDays: days }))).toEqual(['SCHEDULE_NO_RECOVERY']);
    expect(message(base({ runDays: days }))).toContain('Predlog:');
    // 3 dana: jedini kvalitet ne može biti nesusedan dugom.
    const three = base({ runDays: ['sat', 'sun', 'mon'], longRunDay: 'sun', currentWeeklyKm: 30 });
    expect(codes(three)).toEqual(['SCHEDULE_NO_RECOVERY']);
    expect(message(three)).toContain('kvalitet i dugi ne mogu biti nesusedni');
  });

  it('odbijanje je strukturisano i kroz generateHmV2 (nikad degenerisan plan)', () => {
    const r = generateHmV2(base({ currentWeeklyKm: 20 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]!.code).toBe('WEEKLY_KM_TOO_LOW');
  });
});
