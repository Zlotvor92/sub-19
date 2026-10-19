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

  it('HI7 (pouka 28): recentLongRunKm opcion, 5–42 km; u ulazu plana samo kad je dat', () => {
    expect(codes(base({ recentLongRunKm: 5 }))).toEqual([]);
    expect(codes(base({ recentLongRunKm: 42 }))).toEqual([]);
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

  it('rezultat: 5/10 km, HM, maraton; bez rezultata, stariji od 84 dana ili VDOT < 30 → RESULT_REQUIRED (segment 03)', () => {
    for (const d of [5000, 10000, 21097.5, 42195])
      expect(
        codes(base({ recentResult: { distanceM: d, timeSec: timeForVdot(45, d), date: START } }))
      ).toEqual([]);
    expect(codes(base({ recentResult: { distanceM: 3000, timeSec: 700, date: START } }))).toEqual([
      'RESULT_DISTANCE_UNSUPPORTED'
    ]);
    expect(codes(base({ recentResult: null }))).toEqual(['RESULT_REQUIRED']);
    expect(message(base({ recentResult: null }))).toContain('segmentu 03');
    const old = { distanceM: 10000, timeSec: 2700, date: addDays(START, -85) };
    expect(codes(base({ recentResult: old }))).toEqual(['RESULT_REQUIRED']);
    expect(codes(base({ recentResult: { ...old, date: addDays(START, -84) } }))).toEqual([]);
    const slow = { distanceM: 10000, timeSec: timeForVdot(29.9), date: START };
    expect(codes(base({ recentResult: slow }))).toEqual(['RESULT_REQUIRED']);
    const fast = { distanceM: 10000, timeSec: timeForVdot(80.1), date: START };
    expect(codes(base({ recentResult: fast }))).toEqual(['VDOT_TOO_HIGH']);
    expect(
      codes(base({ recentResult: { distanceM: 10000, timeSec: 2700, date: addDays(START, 1) } }))
    ).toEqual(['RESULT_AFTER_START']);
    expect(codes(base({ recentResult: { distanceM: 10000, timeSec: 0, date: START } }))).toEqual([
      'RESULT_TIME_INVALID'
    ]);
  });

  it('H17 trčanje/hodanje i početnik (segment 03); oblik ulaza; cilj', () => {
    expect(codes(base({ runWalk: true }))).toEqual(['RUN_WALK_NOT_SUPPORTED']);
    expect(message(base({ runWalk: true }))).toContain('5K plan trčanja/hodanja');
    expect(codes(base({ experience: 'beginner' }))).toEqual(['BEGINNER_NOT_SUPPORTED']);
    expect(codes(base({ experience: 'regular', runWalk: false }))).toEqual([]);
    expect(codes(null)).toEqual(['INPUT_SHAPE']);
    expect(codes(base({ currentWeeklyKm: '40' }))).toEqual(['INPUT_SHAPE']);
    expect(codes(base({ goalTimeSec: -1 }))).toEqual(['GOAL_INVALID']);
    expect(codes(base({ startDate: '2026-02-30' }))).toEqual(['DATE_INVALID']);
    expect(codes(base({ raceDate: START }))).toEqual(['RACE_NOT_AFTER_START']);
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
