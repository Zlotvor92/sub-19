/* H1, H15, H17: opseg ulaza i strukturisano odbijanje sa preporukom. */

import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { checkInput } from './input.ts';
import { generateHmV2 } from './generate.ts';
import { inputOf, SCHEDULES, START, timeForVdot } from './testInputs.ts';

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

  it('obim: < 30 km preporuka 10K ili osnove; > 60 km sa 4 dana (segment 02); 30 i 60 prolaze', () => {
    expect(codes(base({ currentWeeklyKm: 29.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(message(base({ currentWeeklyKm: 29.9 }))).toMatch(/10K plan ili izgradnja osnove/);
    expect(codes(base({ currentWeeklyKm: 60.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
    expect(message(base({ currentWeeklyKm: 60.1 }))).toContain('segment 02');
    expect(codes(base({ currentWeeklyKm: 30 }))).toEqual([]);
    expect(codes(base({ currentWeeklyKm: 60 }))).toEqual([]);
  });

  it('dani: 1, 2, 7 trajno; 3/5/6 do segmenta 02; dupli ili nepoznat dan', () => {
    for (const d of [['sun'], ['tue', 'sun'], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']])
      expect(codes(base({ runDays: d })), d.join()).toEqual(['RUN_DAYS_COUNT']);
    expect(message(base({ runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }))).toContain(
      'jedan dan odmora'
    );
    for (const d of [
      ['tue', 'thu', 'sun'],
      ['mon', 'tue', 'thu', 'sat', 'sun'],
      ['mon', 'tue', 'wed', 'thu', 'sat', 'sun']
    ]) {
      expect(codes(base({ runDays: d }))).toEqual(['RUN_DAYS_COUNT']);
      expect(message(base({ runDays: d }))).toContain('segmentu 02');
    }
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
  });

  it('odbijanje je strukturisano i kroz generateHmV2 (nikad degenerisan plan)', () => {
    const r = generateHmV2(base({ currentWeeklyKm: 25 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]!.code).toBe('WEEKLY_KM_TOO_LOW');
  });
});
