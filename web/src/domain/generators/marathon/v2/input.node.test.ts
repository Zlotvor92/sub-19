import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { inputOf, SCHEDULES, START, timeForVdot } from './testInputs.ts';

/* M1: opseg ulaza i strukturisano odbijanje sa preporukom. */

const base = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...inputOf({ weeks: 16, km: 45, vdot: 45, days: SCHEDULES.A.days }),
  ...over
});
const codes = (raw: unknown): string[] => {
  const r = checkInput(raw);
  return r.ok ? [] : r.reasons.map((x) => x.code);
};
const message = (raw: unknown, code: string): string => {
  const r = checkInput(raw);
  return r.ok ? '' : (r.reasons.find((x) => x.code === code)?.message ?? '');
};

describe('M1 ulaz', () => {
  it('ispravan ulaz prolazi (4 dana, 16 ned, 45 km, polumaraton)', () => {
    const r = checkInput(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.weeks).toBe(16);
      expect(r.pattern).toEqual({ long: 'sun', q1: 'tue', q2: 'thu', easy: ['sat'] });
      expect(r.shortResult).toBe(false);
    }
  });

  it('nedelje: < 12 trajno sa preporukom polumaratona, > 24 „počni kasnije", 12 i 24 prolaze', () => {
    const w = (weeks: number) => base({ raceDate: addDays(START, weeks * 7 - 1) });
    expect(codes(w(11))).toEqual(['PLAN_TOO_SHORT']);
    expect(message(w(11), 'PLAN_TOO_SHORT')).toMatch(/polumaraton/);
    expect(codes(w(25))).toEqual(['PLAN_TOO_LONG']);
    expect(message(w(25), 'PLAN_TOO_LONG')).toMatch(/počni plan kasnije, najranije/);
    expect(codes(w(12))).toEqual([]);
    expect(codes(w(24))).toEqual([]);
    expect(codes(base({ raceDate: addDays(START, 16 * 7) }))).toEqual(['PLAN_NOT_WHOLE_WEEKS']);
  });

  it('obim: < 35 km preporuka polumaraton ili osnova; > 65 km za 4 dana; 35 i 65 prolaze', () => {
    expect(codes(base({ currentWeeklyKm: 34.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(message(base({ currentWeeklyKm: 30 }), 'WEEKLY_KM_TOO_LOW')).toMatch(
      /polumaraton ili izgradnja osnove/
    );
    expect(codes(base({ currentWeeklyKm: 65.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
    expect(codes(base({ currentWeeklyKm: 35 }))).toEqual([]);
    expect(codes(base({ currentWeeklyKm: 65 }))).toEqual([]);
  });

  it('dani: 1, 2, 7 trajno; 3, 5, 6 segment 02; dupli/nepostojeći dani; dan dugog van dana', () => {
    expect(codes(base({ runDays: ['mon', 'thu'] }))).toEqual(['RUN_DAYS_COUNT']);
    expect(
      message(
        base({ runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }),
        'RUN_DAYS_COUNT'
      )
    ).toMatch(/dan odmora/);
    expect(message(base({ runDays: ['tue', 'thu', 'sun'] }), 'RUN_DAYS_COUNT')).toMatch(
      /segmentu 02/
    );
    expect(codes(base({ runDays: ['mon', 'mon', 'thu', 'sat'] }))).toEqual(['RUN_DAYS_INVALID']);
    expect(codes(base({ longRunDay: 'mon' }))).toEqual(['LONG_DAY_INVALID']);
  });

  it('M9: raspored bez dana oporavka → SCHEDULE_NO_RECOVERY sa predlogom', () => {
    const raw = base({ runDays: ['thu', 'fri', 'sat', 'sun'] });
    expect(codes(raw)).toEqual(['SCHEDULE_NO_RECOVERY']);
    expect(message(raw, 'SCHEDULE_NO_RECOVERY')).toMatch(/Predlog:/);
  });

  it('rezultat: 10 km, HM, maraton prolaze; 5 km uz upozorenje; 3 km nije podržan', () => {
    for (const d of [10000, 21097.5, 42195]) {
      const raw = base({
        recentResult: { distanceM: d, timeSec: timeForVdot(45, d), date: addDays(START, -7) }
      });
      expect(codes(raw), String(d)).toEqual([]);
    }
    const five = base({
      recentResult: { distanceM: 5000, timeSec: timeForVdot(45, 5000), date: addDays(START, -7) }
    });
    const r = checkInput(five);
    expect(r.ok && r.shortResult).toBe(true);
    const g = generateMarathonV2(five);
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.plan.warnings.map((w) => w.rule)).toContain('RESULT_5K');
    expect(
      codes(base({ recentResult: { distanceM: 3000, timeSec: 700, date: addDays(START, -7) } }))
    ).toEqual(['RESULT_DISTANCE_UNSUPPORTED']);
  });

  it('rezultat: bez rezultata, stariji od 84 dana, VDOT < 30 → odbijanje (plan po osećaju: segment 03); VDOT > 80 trajno', () => {
    expect(codes(base({ recentResult: null }))).toEqual(['RESULT_REQUIRED']);
    const res = (vdot: number, daysBefore: number) => ({
      distanceM: 21097.5,
      timeSec: timeForVdot(vdot),
      date: addDays(START, -daysBefore)
    });
    expect(codes(base({ recentResult: res(45, 84) }))).toEqual([]);
    expect(codes(base({ recentResult: res(45, 85) }))).toEqual(['RESULT_TOO_OLD']);
    expect(codes(base({ recentResult: res(29.9, 7) }))).toEqual(['VDOT_TOO_LOW']);
    expect(codes(base({ recentResult: res(30, 7) }))).toEqual([]);
    expect(codes(base({ recentResult: res(80, 7) }))).toEqual([]);
    expect(codes(base({ recentResult: res(80.1, 7) }))).toEqual(['VDOT_TOO_HIGH']);
    expect(codes(base({ recentResult: { ...res(45, 7), date: addDays(START, 1) } }))).toEqual([
      'RESULT_AFTER_START'
    ]);
    expect(codes(base({ recentResult: { ...res(45, 7), timeSec: 0 } }))).toEqual([
      'RESULT_TIME_INVALID'
    ]);
  });

  it('oblik, datumi, cilj, trčanje/hodanje (M17) i početnik (segment 03)', () => {
    expect(codes({})).toEqual(['INPUT_SHAPE']);
    expect(codes(base({ startDate: '2026-02-30' }))).toEqual(['DATE_INVALID']);
    expect(codes(base({ raceDate: START }))).toEqual(['RACE_NOT_AFTER_START']);
    expect(codes(base({ goalTimeSec: -1 }))).toEqual(['GOAL_INVALID']);
    expect(codes(base({ runWalk: true }))).toEqual(['RUN_WALK_NOT_SUPPORTED']);
    expect(codes(base({ experience: 'beginner' }))).toEqual(['BEGINNER_SEGMENT_03']);
  });

  it('pouka 6: odbijen ulaz ne daje plan (generate vraća razloge)', () => {
    const r = generateMarathonV2(base({ currentWeeklyKm: 20 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]!.code).toBe('WEEKLY_KM_TOO_LOW');
  });
});
