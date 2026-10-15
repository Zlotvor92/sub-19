import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate } from '../date';
import type { GenPlanState } from '../state';
import { matchPlanRows } from '../training/adaptation/matching';
import { sessKm } from '../training/sessions/calc';
import { resolvePlan } from './resolve';
import type { PlanGenerationInput } from '../training/types';
import { routedEngine } from '@/test/generators';

/* Stari zajednički engine je obrisan: svaka funkcija ide generatoru distance plana o kome je reč (`routedEngine`). */
const {
  adaptGeneratedPlan,
  generatePlan,
  graftFuturePlan,
  mergeOverrides,
  planRecalibrated,
  planWithNewGoal,
  reentryPlan
} = routedEngine(5000);

const start = parseIsoDate('2026-10-05')!;
const input: PlanGenerationInput = {
  startDate: start,
  raceDate: addDays(start, 23 * 7 + 6),
  pb: { distM: 5000, sec: 1237 },
  weeklyKm: 40,
  runDays: 5,
  quality: 2,
  intensity: 'std'
};
const stored = (): GenPlanState => ({ ...adaptGeneratedPlan(generatePlan(input))!, ulaz: input });
const recalibrate = (p: GenPlanState, today = addDays(start, 6 * 7 + 2), ctx = {}) => {
  const result = planRecalibrated(p, 56, today, ctx);
  if ('error' in result) throw new Error(result.error);
  return result;
};

describe('future replacement protects real history and measurement identities', () => {
  it('freezes today and earlier days inside the current week, with identical PRED and QS', () => {
    const p = stored();
    const today = addDays(start, 6 * 7 + 2);
    const r = recalibrate(p, today);
    const oldRows = matchPlanRows(
      resolvePlan(p.weeks, { alts: {}, moves: {} }).weeks,
      p.pred.map((x) => ({ ...x, id: x.id! }))
    );
    for (const w of p.weeks)
      for (const d of w.days) {
        if (addDays(parseIsoDate(w.start)!, d.dow) > today) continue;
        expect(r.weeks.find((x) => x.w === w.w)?.days.find((x) => x.id === d.id)).toEqual(d);
        const row = oldRows.get(d.id!);
        if (row) expect(r.pred.find((x) => x.id === row.id)).toEqual(row);
        if (p.qs?.[d.id!]) expect(r.qs[d.id!]).toEqual(p.qs[d.id!]);
      }
  });

  it('protects a future done day, a measured session, a day moved into the past, and a manual session', () => {
    const p = stored();
    const today = addDays(start, 6 * 7 + 2);
    const candidates = p.weeks[8]!.days.filter((d) => d.session);
    const done = p.weeks[9]!.days.find((d) => !d.rest)!;
    const measured = candidates[0]!;
    const manual = candidates[1]!;
    manual.session!.overrides = { paceSec: true };
    manual.session!.paceSec += 20;
    const moved = p.weeks[10]!.days.find((d) => d.session)!;
    const matches = matchPlanRows(
      resolvePlan(p.weeks, { alts: {}, moves: {} }).weeks,
      p.pred.map((x) => ({ ...x, id: x.id! }))
    );
    const row = matches.get(measured.id!)!;
    const context = {
      log: { [done.id!]: { status: 'done' as const } },
      pred: { [row.id]: 245 },
      predLock: {},
      moves: { [moved.id!]: addDays(today, -1) }
    };
    const before = JSON.stringify(p);
    const r = recalibrate(p, today, context);
    for (const d of [done, measured, manual, moved])
      expect(r.weeks.flatMap((w) => w.days).find((x) => x.id === d.id)).toEqual(d);
    expect(r.pred.find((x) => x.id === row.id)).toEqual(row);
    expect(r.meta.dayWarnings.some((x) => x.includes('Ručno'))).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('creates distinct future PRED IDs when prescription changes and remains idempotent', () => {
    const p = stored();
    const r = recalibrate(p);
    const original = new Map(p.pred.map((x) => [x.id, x]));
    for (const row of r.pred) if (original.has(row.id)) expect(row).toEqual(original.get(row.id));
    expect(r.pred.some((row) => !original.has(row.id))).toBe(true);
    expect(new Set(r.pred.map((row) => row.id)).size).toBe(r.pred.length);
    const again = recalibrate(r);
    expect(again.pred).toEqual(r.pred);
    expect(again.weeks).toEqual(r.weeks);
  });

  it('maps remaining generator weeks by calendar date and excludes historic LR from preparation', () => {
    const p = stored();
    const today = addDays(start, 6 * 7 + 2);
    const nextInput = {
      ...input,
      startDate: addDays(today, 1),
      weeklyKm: 10,
      recentLongRunKm: 3,
      consistentWeeks: 0,
      breakWeeks: 4,
      trainedRecently: false
    };
    const fresh = adaptGeneratedPlan(generatePlan(nextInput))!;
    expect(fresh).toBeTruthy();
    const r = graftFuturePlan(p, fresh, today);
    expect(r.weeks.map((w) => [w.w, w.start])).toEqual(p.weeks.map((w) => [w.w, w.start]));
    expect(r.weeks[7]!.days.map((d) => d.id)).toEqual(p.weeks[7]!.days.map((d) => d.id));
    expect(r.meta!.preparation!.peakWeeklyKm).toBeLessThan(30);
    expect(r.weeks[0]).toEqual(p.weeks[0]);
  });
});

describe('return regenerates the actual training dose', () => {
  it('does not restore the former volume in the next week and keeps session/km arithmetic coherent', () => {
    const result = reentryPlan(input, 7, 10, 47.3);
    if ('error' in result) throw new Error(result.error);
    expect(result.weeks[0]!.vol).toBeLessThanOrEqual(12);
    expect(result.weeks[1]!.vol).toBeLessThanOrEqual(result.weeks[0]!.vol * 1.15);
    for (const w of result.weeks) {
      expect(w.vol).toBeCloseTo(
        w.days.reduce((n, d) => n + (d.km ?? 0), 0),
        0
      );
      for (const d of w.days) if (d.session) expect(d.km).toBeCloseTo(sessKm(d.session), 0);
    }
    expect(result.meta.athlete!.qualityReadiness).toBe('returning');
  });
  it('rejects invalid base, form and week instead of silently repairing them', () => {
    for (const km of [0, -1, NaN, Infinity])
      expect(reentryPlan(input, 7, km, 47)).toHaveProperty('error');
    for (const form of [0, NaN, Infinity, 90])
      expect(reentryPlan(input, 7, 10, form)).toHaveProperty('error');
    for (const week of [0, 1.5, Infinity, 25])
      expect(reentryPlan(input, week, 10, 47)).toHaveProperty('error');
  });
});

describe('recalibration uses actual base only with adequately covered weeks', () => {
  it('uses two complete measured weeks instead of the original declared 40 km', () => {
    const p = stored();
    const log: Record<string, { status: 'done'; km: number }> = {};
    for (const w of p.weeks.slice(4, 6))
      for (const d of w.days) if (!d.rest && d.km) log[d.id!] = { status: 'done', km: d.km * 0.5 };
    const result = recalibrate(p, addDays(start, 6 * 7 + 2), { log });
    expect(result.meta.athlete!.weeklyBaseKm).toBeLessThan(30);
    expect(result.meta.athlete!.consistentWeeks).toBe(2);
    expect(result.weeks[7]!.days.reduce((n, d) => n + (d.km ?? 0), 0)).toBeLessThan(30);
    expect(result.meta.dayWarnings.some((x) => x.includes('prijavljena polazna baza'))).toBe(false);
  });
  it('leaves missing entries unknown and explicitly marks the declared-base fallback', () => {
    const result = recalibrate(stored());
    expect(result.meta.athlete!.weeklyBaseKm).toBe(40);
    expect(result.meta.dayWarnings.some((x) => x.includes('prijavljena polazna baza'))).toBe(true);
  });
  it('does not transplant a locked R prescription onto an I session and recomputes legacy volume', () => {
    const p = stored();
    const day = p.weeks.flatMap((w) => w.days).find((d) => d.session?.type === 'int')!;
    const session = day.session!;
    const fresh = [
      {
        w: 1,
        vol: 999,
        days: [
          { ...day, session: { ...session, kind: 'Intervali', zone: 'I' as const, paceSec: 230 } }
        ]
      }
    ];
    const old = [
      {
        w: 1,
        days: [
          {
            ...day,
            session: {
              ...session,
              kind: 'Repeticije',
              zone: 'R' as const,
              paceSec: 333,
              overrides: { paceSec: true }
            }
          }
        ]
      }
    ];
    const result = mergeOverrides(fresh, old);
    expect(result[0]!.days[0]!.session.paceSec).toBe(230);
    expect(result[0]!.vol).toBeCloseTo(day.km!, 1);
  });
});

it('keeps a hybrid manual overlay when automatic pace adjustment is also present, including restore', () => {
  const p = stored();
  const today = addDays(start, 6 * 7 + 2);
  const day = p.weeks[9]!.days.find((d) => d.session)!;
  const alts = {
    [day.id!]: {
      tag: 'rw' as const,
      km: 3.2,
      desc: 'Moj trening sa hodanjem',
      pace: 270,
      paceAuto: true,
      rw: { runSec: 120, walkSec: 60, label: '2 min trčanje / 1 min hod' },
      snaga: true as const
    }
  };
  const before = JSON.stringify(alts);
  const result = recalibrate(p, today, { alts });
  expect(result.weeks.flatMap((w) => w.days).find((d) => d.id === day.id)).toEqual(day);
  expect(result.meta.dayWarnings.some((x) => x.includes('Ručno'))).toBe(true);
  const restored = graftFuturePlan(result, p, today, { alts });
  expect(restored.weeks.flatMap((w) => w.days).find((d) => d.id === day.id)).toEqual(day);
  expect(JSON.stringify(alts)).toBe(before);
  const displayed = resolvePlan(restored.weeks, { alts, moves: {} }).byId.get(day.id!)!;
  expect(displayed.tag).toBe('rw');
  expect(displayed.km).toBe(3.2);
  expect(displayed.runWalk).toEqual(alts[day.id!]!.rw);
  expect(displayed.snaga).toBe(true);
});

it('keeps an unmatched historical prediction row without assigning it new meaning', () => {
  const p = stored();
  const orphan = {
    id: 'historic-unmatched',
    w: 1,
    l: 'N1 · Legacy zapis',
    q: 1,
    pt: 245,
    p5k: 1200
  };
  p.pred.push(orphan);
  const result = recalibrate(p);
  expect(result.pred.find((row) => row.id === orphan.id)).toEqual(orphan);
});

it('carries compatible manual locks from legacy sessions without an explicit zone', () => {
  const p = stored();
  const day = p.weeks
    .flatMap((w) => w.days)
    .find((d) => d.session?.type === 'int' && d.session.kind === 'Intervali')!;
  const session = day.session!;
  const legacy = { ...session, paceSec: 333, overrides: { paceSec: true } };
  delete legacy.zone;
  const result = mergeOverrides(
    [{ w: 1, days: [{ ...day, session: { ...session, paceSec: 230, zone: 'I' as const } }] }],
    [{ w: 1, days: [{ ...day, session: legacy }] }]
  );
  expect(result[0]!.days[0]!.session.paceSec).toBe(333);
  expect(result[0]!.days[0]!.session.zone).toBe('I');
});

it('keeps a measured low base and its remaining ramp through recalibration and later goal change', () => {
  const p = stored();
  const today = addDays(start, 6 * 7 + 2);
  const log: Record<string, { status: 'done'; km: number }> = {};
  for (const w of p.weeks.slice(4, 6)) {
    const running = w.days.filter((d) => !d.rest && d.km);
    for (const d of running) log[d.id!] = { status: 'done', km: 10 / running.length };
  }
  const result = recalibrate(p, today, { log });
  expect(result.ulaz.startDate).toBe(addDays(today, 1));
  expect(result.meta.start).toBe(p.meta!.start);
  const complete = result.weeks.filter((w) => w.start > today && !w.taper && !w.deload);
  let base = 10;
  for (const w of complete) {
    const km = w.days.reduce((n, d) => n + (d.km ?? 0), 0);
    expect(km).toBeLessThanOrEqual(base * 1.08 + 0.11);
    base = km;
    for (const d of w.days) if (d.session) expect(d.km).toBeCloseTo(sessKm(d.session), 1);
  }
  const fallback = recalibrate(result, today);
  const firstFullFallback = fallback.weeks.find((w) => w.start > today && !w.deload && !w.taper)!;
  expect(firstFullFallback.days.reduce((n, d) => n + (d.km ?? 0), 0)).toBeLessThanOrEqual(10.91);
  const changed = planWithNewGoal(result, 1300, today, { log });
  if ('error' in changed) throw new Error(changed.error);
  expect(changed.ulaz.startDate).toBe(result.ulaz.startDate);
  expect(changed.weeks.map((w) => [w.w, w.start])).toEqual(result.weeks.map((w) => [w.w, w.start]));
  base = 10;
  for (const w of changed.weeks.filter((w) => w.start > today && !w.taper && !w.deload)) {
    const km = w.days.reduce((n, d) => n + (d.km ?? 0), 0);
    expect(km).toBeLessThanOrEqual(base * 1.08 + 0.11);
    base = km;
  }
});
