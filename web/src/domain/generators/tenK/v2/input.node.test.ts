/* D1 — opseg ulaza: granice prolaze, sve van opsega daje strukturisano odbijanje (kod + poruka). */

import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { inputOf, SCHEDULES, START, timeForVdot } from './testInputs.ts';
import type { ReasonCode } from './types.ts';

const A = SCHEDULES.A.days;
const base = (o: Partial<Parameters<typeof inputOf>[0]> = {}): Record<string, unknown> =>
  inputOf({ weeks: 12, km: 35, vdot: 45, days: A, ...o });
const codes = (raw: unknown): ReasonCode[] => {
  const r = generateTenKV2(raw);
  return r.ok ? [] : r.reasons.map((x) => x.code);
};

describe('D1: opseg ulaza', () => {
  it('granice opsega daju plan', () => {
    for (const raw of [
      base({ weeks: 10 }),
      base({ weeks: 18 }),
      base({ km: 25 }),
      base({ km: 55 }),
      base({ resultDaysBefore: 84 }),
      base({ resultDaysBefore: 0 }),
      base({ vdot: 30 }),
      base({ vdot: 80, km: 55 }),
      base({ result: { distanceM: 3000, timeSec: 13 * 60 } }),
      base({ result: { distanceM: 5000, timeSec: 22 * 60 } }),
      base({ result: { distanceM: 21097.5, timeSec: 95 * 60 } }),
      base({ goalTimeSec: 45 * 60 })
    ]) {
      const r = generateTenKV2(raw);
      expect(r.ok, JSON.stringify(r.ok ? '' : r.reasons)).toBe(true);
    }
  });

  it('3/5/6 dana i 8–9 nedelja → privremeno „podržano od segmenta 02"', () => {
    expect(codes(base({ days: ['tue', 'thu', 'sun'] }))).toEqual(['SUPPORTED_FROM_SEGMENT_02']);
    expect(codes(base({ days: ['mon', 'tue', 'thu', 'sat', 'sun'] }))).toEqual([
      'SUPPORTED_FROM_SEGMENT_02'
    ]);
    expect(codes(base({ days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'] }))).toEqual([
      'SUPPORTED_FROM_SEGMENT_02'
    ]);
    expect(codes(base({ weeks: 8 }))).toEqual(['SUPPORTED_FROM_SEGMENT_02']);
    expect(codes(base({ weeks: 9 }))).toEqual(['SUPPORTED_FROM_SEGMENT_02']);
    const r = generateTenKV2(base({ weeks: 9 }));
    expect(!r.ok && r.reasons[0]!.message).toMatch(/segmenta 02/);
  });

  it('< 8 nedelja trajno; > 18 „počni plan kasnije"; ostali brojevi dana trajno', () => {
    expect(codes(base({ weeks: 7 }))).toEqual(['PLAN_TOO_SHORT']);
    expect(codes(base({ weeks: 19 }))).toEqual(['PLAN_TOO_LONG']);
    const r = generateTenKV2(base({ weeks: 19 }));
    expect(!r.ok && r.reasons[0]!.message).toMatch(/počni plan kasnije/);
    expect(codes(base({ days: ['tue', 'sun'] }))).toEqual(['RUN_DAYS_COUNT']);
    expect(codes(base({ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }))).toEqual([
      'RUN_DAYS_COUNT'
    ]);
    expect(codes(base({ days: ['tue', 'tue', 'sat', 'sun'] }))).toEqual(['RUN_DAYS_INVALID']);
  });

  it('obim < 25 km → preporuka 5K plana ili izgradnje osnove; > 55 km odbijen', () => {
    expect(codes(base({ km: 24.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    const r = generateTenKV2(base({ km: 20 }));
    expect(!r.ok && r.reasons[0]!.message).toMatch(/5K plan ili izgradnja osnove/);
    expect(codes(base({ km: 55.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
  });

  it('bez rezultata, rezultat stariji od 84 dana ili VDOT < 30 → plan po osećaju (segment 03)', () => {
    const noRes = { ...base(), recentResult: null };
    expect(codes(noRes)).toEqual(['FEEL_PLAN_SEGMENT_03']);
    expect(codes(base({ resultDaysBefore: 85 }))).toEqual(['FEEL_PLAN_SEGMENT_03']);
    expect(codes(base({ result: { distanceM: 10000, timeSec: timeForVdot(30) + 30 } }))).toEqual([
      'FEEL_PLAN_SEGMENT_03'
    ]);
    const r = generateTenKV2(noRes);
    expect(!r.ok && r.reasons[0]!.message).toMatch(/segmentu 03/);
  });

  it('ostala odbijanja: rezultat posle starta, distanca, vreme, VDOT > 80, cilj, datumi', () => {
    expect(codes(base({ resultDaysBefore: -1 }))).toEqual(['RESULT_AFTER_START']);
    expect(codes(base({ result: { distanceM: 8000, timeSec: 1800 } }))).toEqual([
      'RESULT_DISTANCE_UNSUPPORTED'
    ]);
    expect(codes(base({ result: { distanceM: 10000, timeSec: 0 } }))).toEqual([
      'RESULT_TIME_INVALID'
    ]);
    expect(codes(base({ result: { distanceM: 10000, timeSec: timeForVdot(80) - 20 } }))).toEqual([
      'VDOT_TOO_HIGH'
    ]);
    expect(codes(base({ goalTimeSec: -5 }))).toEqual(['GOAL_INVALID']);
    expect(codes({ ...base(), raceDate: addDays(START, 7 * 12) })).toEqual([
      'PLAN_NOT_WHOLE_WEEKS'
    ]);
    expect(codes({ ...base(), raceDate: START })).toEqual(['RACE_NOT_AFTER_START']);
    expect(codes({ ...base(), startDate: '2026-02-30' })).toEqual(['DATE_INVALID']);
    expect(codes({ ...base(), longRunDay: 'mon' })).toEqual(['LONG_DAY_INVALID']);
    expect(codes(null)).toEqual(['INPUT_SHAPE']);
    expect(codes({ ...base(), currentWeeklyKm: '30' })).toEqual(['INPUT_SHAPE']);
  });

  it('svaka poruka odbijanja je na srpskom i neprazna; ulaz se ne menja', () => {
    const raw = base({ weeks: 19, km: 20, days: ['tue', 'sun'] });
    const copy = JSON.stringify(raw);
    const r = checkInput(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons.map((x) => x.code)).toEqual([
        'PLAN_TOO_LONG',
        'RUN_DAYS_COUNT',
        'WEEKLY_KM_TOO_LOW'
      ]);
      for (const x of r.reasons) expect(x.message.length).toBeGreaterThan(20);
    }
    expect(JSON.stringify(raw)).toBe(copy);
  });
});
