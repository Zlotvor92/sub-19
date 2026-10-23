/* D26 — plan po osećaju (lagan tempo, procena VDOT-a, RPE, bez prognoze); D27 — test 5 km (mesto,
   struktura, obim ne doza, progresija posle testa). Brojevi iz odluka, ne iz koda generatora. */

import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { feelPaces, pacesFromVdot, raceTimeForVdot, round1, vdotFromEasyPace } from './paces.ts';
import { inputOf, SCHEDULES_BY_DAYS, timeForVdot } from './testInputs.ts';
import type { PlanWeek, ReasonCode, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

type Days = 3 | 4 | 5 | 6;
const feelInput = (
  days: Days,
  o: { weeks: number; km: number; easy?: number | null; goal?: number }
): Record<string, unknown> => {
  const sc = SCHEDULES_BY_DAYS[days].A;
  return {
    ...inputOf({ weeks: o.weeks, km: o.km, days: sc.days, long: sc.long, goalTimeSec: o.goal }),
    recentResult: null,
    easyPaceSecPerKm: o.easy === undefined ? 360 : o.easy
  };
};
const plan = (raw: Record<string, unknown>): TenKV2Plan => {
  const r = generateTenKV2(raw);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const codes = (raw: unknown): ReasonCode[] => {
  const r = generateTenKV2(raw);
  return r.ok ? [] : r.reasons.map((x) => x.code);
};
const errors = (p: TenKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const steady = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific');

/** Nezavisna Daniels–Gilbert VO2 [ml/kg/min] pri brzini v [m/min]. */
const vo2 = (v: number): number => -4.6 + 0.182258 * v + 0.000104 * v * v;

describe('D26: plan po osećaju', () => {
  it('procena VDOT-a: brži kraj E (0,70) = lagan tempo; 270–510 s/km → 58,6–26,1; ograničenje 25–60 samo van opsega ulaza', () => {
    for (const e of [270, 315, 360, 405, 450, 510])
      expect(vdotFromEasyPace(e)).toBeCloseTo(vo2(60000 / e) / 0.7, 10);
    expect([270, 360, 450, 510].map((e) => round1(vdotFromEasyPace(e)))).toEqual([
      58.6, 41, 30.8, 26.1
    ]);
    // Opreznije od srednjeg E: ista brzina kao sredina E daje viši VDOT.
    expect(vdotFromEasyPace(360)).toBeLessThan(vo2(60000 / 360) / 0.66);
    expect(feelPaces(250)).toMatchObject({ capped: true, paces: { vdot: 60 } });
    expect(feelPaces(600)).toMatchObject({ capped: false, paces: { vdot: 25 } });
    expect(feelPaces(270).capped).toBe(false);
  });

  it('E = lagan tempo ± 15 s (srednji E = lagan tempo); T/I/R/RP iz procene VDOT-a; dugi ≤ 105 min sporim krajem E', () => {
    const p = plan(feelInput(4, { weeks: 12, km: 30, easy: 360 }));
    expect(p.paceBasis).toBe('feel');
    expect(p.paces.E).toEqual({ fast: 345, slow: 375 });
    expect((p.paces.E.fast + p.paces.E.slow) / 2).toBe(360);
    const z = pacesFromVdot(41);
    expect(p.vdot).toBe(41);
    expect([p.paces.T, p.paces.I, p.paces.R, p.paces.RP]).toEqual([z.T, z.I, z.R, z.RP]);
    for (const w of p.weeks)
      for (const d of w.days)
        if (d.role === 'long') expect(d.workout.km * 375).toBeLessThanOrEqual(6300 + 1e-6);
    // Lagani dani i WU/CD po srednjem E = lagan tempo.
    const e = p.weeks[0]!.days.find((d) => d.role === 'easy')!.workout.segments[0]!;
    expect(e.paceSecPerKm).toBe(360);
  });

  it('bez ocene cilja i prognoze 10K (null, napomena „posle testa"); svaki kvalitet nosi RPE zone; plan sa rezultatom bez RPE', () => {
    const p = plan(feelInput(5, { weeks: 14, km: 45, easy: 330, goal: 45 * 60 }));
    expect(p.predicted10kSec).toBeNull();
    expect(p.goal).toBeNull();
    expect(p.notes.some((n) => n.includes('posle testa'))).toBe(true);
    expect(p.notes.some((n) => n.includes('orijentir (procena)'))).toBe(true);
    const want: Record<string, [number, number, string]> = {
      T: [6, 7, 'udobno teško, kratke rečenice'],
      RP: [7, 8, 'ritam trke 10K'],
      I: [8, 8, 'teško, izdrživo 3–5 min'],
      R: [8, 8, 'brzo, opušteno']
    };
    const seen = new Set<string>();
    for (const w of p.weeks)
      for (const d of w.days) {
        if (d.workout.kind !== 'quality') {
          expect(d.workout.rpe).toBeUndefined();
          continue;
        }
        const z = d.workout.dose!.zone;
        seen.add(z);
        expect([d.workout.rpe!.min, d.workout.rpe!.max, d.workout.rpe!.cue]).toEqual(want[z]);
      }
    expect([...seen].sort()).toEqual(['I', 'R', 'RP', 'T']);
    const r = generateTenKV2(
      inputOf({ weeks: 14, km: 45, vdot: 45, days: SCHEDULES_BY_DAYS[5].A.days })
    );
    expect(r.ok && r.plan.paceBasis).toBe('result');
    if (r.ok)
      for (const w of r.plan.weeks) for (const d of w.days) expect(d.workout.rpe).toBeUndefined();
  });

  it('put: bez rezultata, rezultat > 84 dana ili VDOT < 30 → po osećaju; lagan tempo obavezan (270–510 s/km)', () => {
    const base = inputOf({ weeks: 12, km: 40, vdot: 45, days: SCHEDULES_BY_DAYS[5].A.days });
    const old = {
      ...inputOf({
        weeks: 12,
        km: 40,
        vdot: 45,
        days: SCHEDULES_BY_DAYS[5].A.days,
        resultDaysBefore: 120
      }),
      easyPaceSecPerKm: 330
    };
    expect(plan(old).paceBasis).toBe('feel');
    expect(plan(old).notes[0]).toMatch(/rezultat je star 120 dana \(> 84\)/);
    const low = {
      ...base,
      recentResult: { distanceM: 10000, timeSec: timeForVdot(30) + 60, date: '2026-10-19' },
      easyPaceSecPerKm: 495
    };
    expect(plan(low).paceBasis).toBe('feel');
    expect(plan(low).notes[0]).toMatch(/VDOT iz rezultata 29\.\d je ispod 30/);
    // Lagan tempo uz pouzdan rezultat se ne koristi (osnova je rezultat).
    expect(plan({ ...base, easyPaceSecPerKm: 330 }).paceBasis).toBe('result');
    expect(codes({ ...base, recentResult: null })).toEqual(['EASY_PACE_REQUIRED']);
    const r = generateTenKV2({ ...base, recentResult: null });
    expect(!r.ok && r.reasons[0]!.message).toMatch(
      /unesi lagan tempo .*4:30–8:30\/km.* ili rezultat/
    );
    expect(codes({ ...old, easyPaceSecPerKm: null })).toEqual(['EASY_PACE_REQUIRED']);
    expect(codes({ ...base, recentResult: null, easyPaceSecPerKm: 269 })).toEqual([
      'EASY_PACE_OUT_OF_RANGE'
    ]);
    expect(codes({ ...base, recentResult: null, easyPaceSecPerKm: 511 })).toEqual([
      'EASY_PACE_OUT_OF_RANGE'
    ]);
    expect(codes({ ...base, recentResult: null, easyPaceSecPerKm: 270 })).toEqual([]);
    expect(codes({ ...base, recentResult: null, easyPaceSecPerKm: 510 })).toEqual([]);
    expect(codes({ ...base, easyPaceSecPerKm: '5:30' })).toEqual(['INPUT_SHAPE']);
  });

  it('validator hvata: pogrešan E, tempo zone, prognoza, ocena cilja, RPE, osnova tempa', () => {
    const mut: [string, (p: TenKV2Plan) => void][] = [
      ['PACES', (p) => (p.paces.E.fast -= 5)],
      ['PACES', (p) => (p.paces.T -= 3)],
      ['PACES', (p) => (p.predicted10kSec = 3000)],
      [
        'GOAL',
        (p) =>
          (p.goal = {
            goalTimeSec: 3000,
            goalVdot: 33,
            vdotGap: 0,
            weeks: 12,
            status: 'realistic',
            message: ''
          })
      ],
      ['RPE', (p) => delete p.weeks[0]!.days.find((d) => d.role === 'q2')!.workout.rpe],
      [
        'RPE',
        (p) =>
          (p.weeks[0]!.days.find((d) => d.role === 'easy')!.workout.rpe = {
            min: 1,
            max: 2,
            cue: 'x'
          })
      ],
      ['PACE_BASIS', (p) => (p.paceBasis = 'result')]
    ];
    for (const [rule, m] of mut) {
      const p = plan(feelInput(4, { weeks: 12, km: 30 }));
      expect(errors(p)).toEqual([]);
      m(p);
      expect(errors(p), rule).toContain(rule);
    }
  });
});

describe('D27: test 5 km', () => {
  it('tačno jedan test u poslednjoj nedelji baze, na danu Q1; WU (pojas) + 5 km + CD; u obimu, nije doza', () => {
    for (const [days, weeks, km] of [
      [3, 10, 25],
      [4, 10, 30],
      [5, 16, 45],
      [6, 18, 60]
    ] as const) {
      const p = plan(feelInput(days, { weeks, km, easy: 390 }));
      const tests = p.weeks.flatMap((w) =>
        w.days.filter((d) => d.role === 'test').map((d) => ({ w, d }))
      );
      expect(tests.length).toBe(1);
      const { w, d } = tests[0]!;
      const lastBase = p.weeks.filter((x) => x.phase === 'base').pop()!;
      expect(w.index).toBe(lastBase.index);
      expect(w.deload).toBe(false);
      expect(d.weekday).toBe(p.pattern.q1);
      expect(w.days.some((x) => x.role === 'q1')).toBe(false);
      const wu = km < 35 ? 900 : km < 45 ? 1200 : 1500;
      const cd = km < 35 ? 600 : 900;
      expect(d.workout.segments.map((s) => [s.kind, s.kind === 'test' ? s.km : s.sec])).toEqual([
        ['warmup', wu],
        ['test', 5],
        ['cooldown', cd]
      ]);
      expect(d.workout.segments[1]!.sec).toBe(raceTimeForVdot(p.vdot, 5000));
      expect(d.workout.dose).toBeNull();
      expect(d.countsToWeek && d.hard).toBe(true);
      expect(Object.values(d.workout.workKm)).toEqual([0, 0, 0, 0]);
      // Q2 (4–6 dana) ostaje u nedelji testa.
      expect(w.days.some((x) => x.role === 'q2')).toBe(days > 3);
      expect(w.notes.some((n) => n.includes('Test 5 km (D27)'))).toBe(true);
    }
  });

  it('nedelja testa = rasterećenje (12 ned): test umesto kvaliteta rasterećenja, na danu T slota (Q2; 3 dana Q1)', () => {
    for (const days of [3, 4, 5, 6] as const) {
      const km = { 3: 25, 4: 35, 5: 45, 6: 55 }[days];
      const p = plan(feelInput(days, { weeks: 12, km, easy: 360 }));
      const w = p.weeks[3]!;
      expect([w.phase, w.deload, w.test]).toEqual(['base', true, true]);
      const t = w.days.find((d) => d.role === 'test')!;
      expect(t.weekday).toBe(days === 3 ? p.pattern.q1 : p.pattern.q2);
      expect(w.days.filter((d) => d.workout.kind === 'quality')).toEqual([]);
      expect(w.days.filter((d) => d.role === 'easy').length).toBe(days - 2);
    }
  });

  it('odstupanje D27 ispred D5: dugi rasterećenja sa testom skraćen da lagan ostane ≥ 3 km (3 dana, 20 km, 7:30, 12 ned)', () => {
    const p = plan(feelInput(3, { weeks: 12, km: 20, easy: 450 }));
    const w = p.weeks[3]!;
    expect([w.targetKm, w.fitted]).toEqual([18, null]);
    expect(w.days.map((d) => `${d.role}:${d.workout.km}`).sort()).toEqual([
      'easy:3.1',
      'long:6.6',
      'test:8.33'
    ]);
    expect(Math.floor(0.8 * 101) / 10).toBe(8);
    expect(w.notes.some((n) => n.includes('skraćen sa 0,8 ×'))).toBe(true);
    expect(p.warnings.filter((x) => x.rule === 'TEST_DELOAD_LONG').map((x) => x.week)).toEqual([4]);
  });

  it('progresija posle testa nastavlja od stanja pre testa (D12); „glavna doza ne opada" preskače test nedelju', () => {
    // 3 dana, 10 ned: baza 1–3, test ned 3 (umesto T kontinuirano) → ned 4 T cruise ≥ T ned 2.
    const p3 = plan(feelInput(3, { weeks: 10, km: 30, easy: 330 }));
    const s3 = p3.weeks.filter(steady);
    const t2 = s3[1]!.days.find((d) => d.role === 'q1')!.workout.dose!;
    expect(s3[2]!.test).toBe(true);
    const t4 = s3[3]!.days.find((d) => d.role === 'q1')!.workout.dose!;
    expect([t4.ladder, t4.doseM >= t2.doseM]).toEqual(['T_cruise', true]);
    expect(errors(p3)).toEqual([]);
    // 4 dana: Q2 napreduje i u nedelji testa; Q1 (R) posle testa prelazi na I (D16), stanje R se ne menja.
    const p4 = plan(feelInput(4, { weeks: 10, km: 40, easy: 330 }));
    const s4 = p4.weeks.filter(steady);
    const q2 = s4.slice(0, 4).map((w) => w.days.find((d) => d.role === 'q2')!.workout.dose!.doseM);
    expect(q2[2]).toBeGreaterThanOrEqual(q2[1]!);
    expect(s4[3]!.days.find((d) => d.role === 'q1')!.workout.dose!.ladder).toBe('I');
    expect(errors(p4)).toEqual([]);
  });

  it('validator hvata: test u drugoj nedelji, bez testa, test u planu sa rezultatom, pogrešna struktura testa', () => {
    const moved = plan(feelInput(4, { weeks: 10, km: 30 }));
    const tw = moved.weeks.find((w) => w.test)!;
    delete tw.test;
    moved.weeks[0]!.test = true;
    expect(errors(moved)).toContain('TEST');
    const none = plan(feelInput(4, { weeks: 10, km: 30 }));
    const d = none.weeks.find((w) => w.test)!.days.find((x) => x.role === 'test')!;
    d.role = 'easy';
    d.hard = false;
    expect(errors(none)).toEqual(expect.arrayContaining(['TEST']));
    const res = generateTenKV2(
      inputOf({ weeks: 10, km: 30, vdot: 40, days: SCHEDULES_BY_DAYS[4].A.days })
    );
    if (!res.ok) throw new Error('ulaz');
    res.plan.weeks[2]!.test = true;
    expect(errors(res.plan)).toContain('TEST');
    const bad = plan(feelInput(4, { weeks: 10, km: 30 }));
    const t = bad.weeks.find((w) => w.test)!.days.find((x) => x.role === 'test')!;
    (t.workout.segments[1] as { km: number }).km = 3;
    expect(errors(bad)).toContain('TEST');
  });
});
