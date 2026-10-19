import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { inputOf, SCHEDULES, SCHEDULES_BY_DAYS, START, timeForVdot } from './testInputs.ts';

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

  it('obim po redu M15 (3 d 30–50, 4 d 35–65, 5 d 40–85, 6 d 50–110); van reda preporuka broja dana koji nosi obim; < 30 km polumaraton ili osnova', () => {
    const at = (n: 3 | 4 | 5 | 6, km: number) =>
      base({ runDays: SCHEDULES_BY_DAYS[n].A.days, currentWeeklyKm: km });
    for (const [n, lo, hi] of [
      [3, 30, 50],
      [4, 35, 65],
      [5, 40, 85],
      [6, 50, 110]
    ] as const) {
      expect(codes(at(n, lo)), `${n}`).toEqual([]);
      expect(codes(at(n, hi)), `${n}`).toEqual([]);
      expect(codes(at(n, lo - 0.1)), `${n}`).toEqual(['WEEKLY_KM_TOO_LOW']);
      expect(codes(at(n, hi + 0.1)), `${n}`).toEqual(['WEEKLY_KM_TOO_HIGH']);
    }
    expect(message(at(4, 34.9), 'WEEKLY_KM_TOO_LOW')).toMatch(/nosi 3 dana/);
    expect(message(at(4, 65.1), 'WEEKLY_KM_TOO_HIGH')).toMatch(/nosi 5–6 dana/);
    expect(message(at(6, 45), 'WEEKLY_KM_TOO_LOW')).toMatch(/nosi 3–5 dana/);
    expect(message(at(3, 29.9), 'WEEKLY_KM_TOO_LOW')).toMatch(/polumaraton ili izgradnja osnove/);
    expect(message(at(6, 110.1), 'WEEKLY_KM_TOO_HIGH')).toMatch(/van opsega plana/);
  });

  it('M13a: recentLongRunKm opcion, 5–42 km; van opsega odbijanje', () => {
    expect(codes(base({ recentLongRunKm: 5 }))).toEqual([]);
    expect(codes(base({ recentLongRunKm: 42 }))).toEqual([]);
    expect(codes(base({ recentLongRunKm: 4.9 }))).toEqual(['RECENT_LONG_INVALID']);
    expect(codes(base({ recentLongRunKm: 42.1 }))).toEqual(['RECENT_LONG_INVALID']);
    expect(codes(base({ recentLongRunKm: '12' }))).toEqual(['INPUT_SHAPE']);
    const r = checkInput(base({ recentLongRunKm: 12 }));
    expect(r.ok && r.input.recentLongRunKm).toBe(12);
    // Bez ulaza ključ ne postoji u normalizovanom ulazu (plan bez pouke 28 ostaje isti).
    const n = checkInput(base());
    expect(n.ok && 'recentLongRunKm' in n.input).toBe(false);
  });

  it('dani: 3, 4, 5, 6 prolaze (M15); 1, 2, 7 trajno; dupli/nepostojeći dani; dan dugog van dana', () => {
    for (const n of [3, 5, 6] as const) {
      const r = checkInput(
        base({
          runDays: SCHEDULES_BY_DAYS[n].A.days,
          currentWeeklyKm: n === 6 ? 60 : 45
        })
      );
      expect(r.ok, `${n}`).toBe(true);
    }
    const three = checkInput(base({ runDays: ['tue', 'thu', 'sun'] }));
    expect(three.ok && three.pattern).toEqual({
      long: 'sun',
      q1: 'thu',
      q2: null,
      easy: ['tue']
    });
    expect(message(base({ runDays: ['mon', 'thu'] }), 'RUN_DAYS_COUNT')).toMatch(/najmanje 3 dana/);
    expect(codes(base({ runDays: ['mon', 'thu'] }))).toEqual(['RUN_DAYS_COUNT']);
    expect(
      message(
        base({ runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }),
        'RUN_DAYS_COUNT'
      )
    ).toMatch(/dan odmora/);
    expect(codes(base({ runDays: ['mon', 'mon', 'thu', 'sat'] }))).toEqual(['RUN_DAYS_INVALID']);
    expect(codes(base({ longRunDay: 'mon' }))).toEqual(['LONG_DAY_INVALID']);
  });

  it('M9: raspored bez dana oporavka → SCHEDULE_NO_RECOVERY sa predlogom (4 i 3 dana)', () => {
    const raw = base({ runDays: ['thu', 'fri', 'sat', 'sun'] });
    expect(codes(raw)).toEqual(['SCHEDULE_NO_RECOVERY']);
    expect(message(raw, 'SCHEDULE_NO_RECOVERY')).toMatch(/Predlog:/);
    const three = base({ runDays: ['sat', 'sun', 'mon'], longRunDay: 'sun' });
    expect(codes(three)).toEqual(['SCHEDULE_NO_RECOVERY']);
    expect(message(three, 'SCHEDULE_NO_RECOVERY')).toMatch(/kvalitet i dugi.*Predlog:/);
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

  it('rezultat: bez rezultata, stariji od 84 dana, VDOT < 30 → plan po osećaju (M16: lagan tempo obavezan); VDOT > 80 trajno', () => {
    expect(codes(base({ recentResult: null }))).toEqual(['EASY_PACE_REQUIRED']);
    const res = (vdot: number, daysBefore: number) => ({
      distanceM: 21097.5,
      timeSec: timeForVdot(vdot),
      date: addDays(START, -daysBefore)
    });
    expect(codes(base({ recentResult: res(45, 84) }))).toEqual([]);
    expect(codes(base({ recentResult: res(45, 85) }))).toEqual(['EASY_PACE_REQUIRED']);
    expect(message(base({ recentResult: res(45, 85) }), 'EASY_PACE_REQUIRED')).toMatch(
      /star 85 dana/
    );
    expect(codes(base({ recentResult: res(29.9, 7) }))).toEqual(['EASY_PACE_REQUIRED']);
    for (const r of [null, res(45, 85), res(29.9, 7)]) {
      const c = checkInput(base({ recentResult: r, easyPaceSecPerKm: 360 }));
      expect(c.ok && c.pace.kind).toBe('feel');
    }
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

  it('oblik, datumi, cilj, trčanje/hodanje (M17)', () => {
    expect(codes({})).toEqual(['INPUT_SHAPE']);
    expect(codes(base({ startDate: '2026-02-30' }))).toEqual(['DATE_INVALID']);
    expect(codes(base({ raceDate: START }))).toEqual(['RACE_NOT_AFTER_START']);
    expect(codes(base({ goalTimeSec: -1 }))).toEqual(['GOAL_INVALID']);
    expect(codes(base({ runWalk: true }))).toEqual(['RUN_WALK_NOT_SUPPORTED']);
    expect(codes(base({ experience: 'pro' }))).toEqual(['INPUT_SHAPE']);
    expect(codes(base({ easyPaceSecPerKm: '6:00' }))).toEqual(['INPUT_SHAPE']);
  });

  it('pouka 6: odbijen ulaz ne daje plan (generate vraća razloge)', () => {
    const r = generateMarathonV2(base({ currentWeeklyKm: 20 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]!.code).toBe('WEEKLY_KM_TOO_LOW');
  });
});
