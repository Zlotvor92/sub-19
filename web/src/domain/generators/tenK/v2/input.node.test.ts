/* D1/D17/D21 — opseg ulaza: granice prolaze, van opsega strukturisano odbijanje (kod + poruka). */

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

  it('D17/D21: 3/5/6 dana (obim po redu tabele) i 8–9 nedelja daju plan', () => {
    for (const raw of [
      base({ days: ['tue', 'thu', 'sun'], km: 20 }),
      base({ days: ['tue', 'thu', 'sun'], km: 40 }),
      base({ days: ['mon', 'tue', 'thu', 'sat', 'sun'], km: 30 }),
      base({ days: ['mon', 'tue', 'thu', 'sat', 'sun'], km: 65 }),
      base({ days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], km: 35 }),
      base({ days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], km: 80 }),
      base({ weeks: 8 }),
      base({ weeks: 9 })
    ]) {
      const r = generateTenKV2(raw);
      expect(r.ok, JSON.stringify(r.ok ? '' : r.reasons)).toBe(true);
    }
  });

  it('D17: obim van reda broja dana → odbijanje sa brojevima dana koji ga podržavaju', () => {
    const r3 = generateTenKV2(base({ days: ['tue', 'thu', 'sun'], km: 45 }));
    expect(!r3.ok && r3.reasons.map((x) => x.code)).toEqual(['WEEKLY_KM_TOO_HIGH']);
    expect(!r3.ok && r3.reasons[0]!.message).toMatch(/iznad 40 km za 3 dana .* podržava 4–6 dana/);
    const r6 = generateTenKV2(base({ days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], km: 30 }));
    expect(!r6.ok && r6.reasons.map((x) => x.code)).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(!r6.ok && r6.reasons[0]!.message).toMatch(/ispod 35 km za 6 dana .* podržava 3–5 dana/);
    expect(codes(base({ days: ['mon', 'tue', 'thu', 'sat', 'sun'], km: 29.9 }))).toEqual([
      'WEEKLY_KM_TOO_LOW'
    ]);
    expect(codes(base({ days: ['mon', 'tue', 'thu', 'sat', 'sun'], km: 65.1 }))).toEqual([
      'WEEKLY_KM_TOO_HIGH'
    ]);
  });

  it('< 8 nedelja trajno; > 18 „počni plan kasnije"; 1, 2 i 7 dana trajno (7: dan odmora)', () => {
    expect(codes(base({ weeks: 7 }))).toEqual(['PLAN_TOO_SHORT']);
    expect(codes(base({ weeks: 19 }))).toEqual(['PLAN_TOO_LONG']);
    const r = generateTenKV2(base({ weeks: 19 }));
    expect(!r.ok && r.reasons[0]!.message).toMatch(/počni plan kasnije/);
    expect(codes(base({ days: ['sun'] }))).toEqual(['RUN_DAYS_COUNT']);
    expect(codes(base({ days: ['tue', 'sun'] }))).toEqual(['RUN_DAYS_COUNT']);
    const r2 = generateTenKV2(base({ days: ['tue', 'sun'] }));
    expect(!r2.ok && r2.reasons[0]!.message).toMatch(/3–6 dana trčanja \(izabrano 2\)/);
    const r7 = generateTenKV2(base({ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }));
    expect(!r7.ok && r7.reasons.map((x) => x.code)).toEqual(['RUN_DAYS_COUNT']);
    expect(!r7.ok && r7.reasons[0]!.message).toMatch(/najmanje jedan dan odmora/);
    expect(codes(base({ days: ['tue', 'tue', 'sat', 'sun'] }))).toEqual(['RUN_DAYS_INVALID']);
  });

  it('4 dana: obim < 25 km ili > 55 km odbijen; ispod 20 km (svi redovi D17) → 5K plan ili osnova', () => {
    expect(codes(base({ km: 24.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    const r24 = generateTenKV2(base({ km: 24 }));
    expect(!r24.ok && r24.reasons[0]!.message).toMatch(/podržava 3 dana/);
    const r = generateTenKV2(base({ km: 19 }));
    expect(!r.ok && r.reasons[0]!.message).toMatch(/5K plan ili izgradnja osnove/);
    expect(codes(base({ km: 55.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
    const r81 = generateTenKV2(base({ km: 81 }));
    expect(!r81.ok && r81.reasons[0]!.message).toMatch(/iznad 80 km nedeljno, van opsega/);
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
    const raw = base({ weeks: 19, km: 15, days: ['tue', 'sun'] });
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
