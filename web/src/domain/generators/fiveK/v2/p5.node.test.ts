/* P5 (5k-v2.14.0, program „trenerski kvalitet v2"): F1 kontrolni test u planu sa rezultatom ≥ 10 nedelja (poslednja
   ne-rasteretna nedelja vrhunca, dan Q1 umesto I); F2 (Odluka 10) dva uzastopna kvaliteta preteška ili preskočena →
   sledeća nedelja izgradnje ne podiže dozu. Brojevi i merne skripte: docs/generators-v2/perfection/reports/P5-5K-REPORT.md. */

import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { raceTimeForVdot } from './paces.ts';
import { resultTestWeekOf, testKindOf } from './periodize.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { START } from './testInputs.ts';
import type { FiveKV2Plan, PlanDay, PlanWeek, Weekday } from './types.ts';
import { validatePlan } from './validate.ts';
import { warmupBand } from './workouts.ts';

const DAYS: Record<number, Weekday[]> = {
  3: ['tue', 'thu', 'sun'],
  4: ['tue', 'thu', 'sat', 'sun'],
  5: ['mon', 'tue', 'thu', 'sat', 'sun']
};
const inp = (days: number, km: number, weeks: number, vdot: number): Record<string, unknown> => ({
  startDate: START,
  raceDate: addDays(START, weeks * 7 - 1),
  runDays: DAYS[days],
  currentWeeklyKm: km,
  goalTimeSec: null,
  recentResult: {
    distanceM: 10000,
    timeSec: Math.round(raceTimeForVdot(vdot, 10000)),
    date: addDays(START, -14)
  }
});
const planOf = (x: Record<string, unknown>): FiveKV2Plan => {
  const r = generateFiveKV2(x);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
  return r.plan;
};
const errors = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const testDays = (p: FiveKV2Plan): PlanDay[] =>
  p.weeks.flatMap((w) => w.days).filter((d) => d.workout.qualityType === 'TEST_3K');
const zone = (w: PlanWeek): { I: number; T: number; R: number } => {
  const z = { I: 0, T: 0, R: 0 };
  for (const d of w.days)
    if (d.countsToWeek && d.workout.kind === 'quality') {
      z.I += d.workout.workKm.I + d.workout.workKm.RP;
      z.T += d.workout.workKm.T;
      z.R += d.workout.workKm.R;
    }
  return z;
};
const GRID: [number, number][] = [
  [3, 15],
  [3, 30],
  [4, 20],
  [4, 40],
  [5, 30],
  [5, 60]
];

describe('P5 F1 — kontrolni test u planu sa rezultatom', () => {
  it('≥ 10 nedelja: tačno jedan test, poslednja ne-rasteretna nedelja vrhunca, dan Q1; < 10 i početnik: bez testa', () => {
    for (const [d, km] of GRID)
      for (const weeks of [8, 9, 10, 12, 14, 16])
        for (const v of [35, 50, 65]) {
          const plan = planOf(inp(d, km, weeks, v));
          expect(errors(plan)).toEqual([]);
          const t = testDays(plan);
          if (weeks < P.feel.resultTest.minWeeks) {
            expect(t).toHaveLength(0);
            expect(plan.weeks.some((w) => w.test)).toBe(false);
            continue;
          }
          expect(t).toHaveLength(1);
          const w = plan.weeks.find((x) => x.days.includes(t[0]!))!;
          expect(w.test).toBe(true);
          expect(w.phase).toBe('peak');
          expect(w.deload).toBe(false);
          expect(w.index).toBe(resultTestWeekOf(plan.weeks));
          expect(plan.weeks.filter((x) => x.phase === 'peak' && !x.deload).at(-1)!.index).toBe(
            w.index
          );
          expect(t[0]!.role).toBe('q1');
          // Isti test kao plan po osećaju: WU/CD pojasa nedelje (ili najniži, T2), 3 km maksimalno ravnomerno.
          const blocks = t[0]!.workout.blocks;
          expect(blocks.map((b) => b.kind)).toEqual(['warmup', 'test', 'cooldown']);
          expect(blocks[1]).toMatchObject({ km: P.feel.test.km, effort: P.feel.effort.test });
          const band = w.wuMin ? P.warmup.bands[0] : warmupBand(w.targetKm);
          expect(blocks[0]).toMatchObject({ kind: 'warmup', km: band.warmupKm });
          // Uslov 8: nedelja testa nije degenerisana.
          expect(w.plannedKm).toBeGreaterThanOrEqual(P.days[d as 3 | 4 | 5].minWeekKm);
          const long = w.days.find((x) => x.role === 'long')!;
          for (const e of w.days.filter((x) => x.role === 'easy'))
            expect(e.workout.km).toBeLessThanOrEqual(long.workout.km + 1e-9);
          for (const x of w.days) expect(x.workout.km).toBeGreaterThan(0);
          expect(w.notes).toContain(P.feel.resultTestWeekNote);
          expect(plan.notes.some((n) => n.startsWith('Kontrolno trčanje 3 km u nedelji'))).toBe(
            true
          );
          // Ostale nedelje vrhunca/oštrenja imaju I/RP (progresija se nastavlja od stanja pre testa).
          for (const x of plan.weeks.filter(
            (y) => (y.phase === 'peak' || y.phase === 'sharpen') && !y.deload && !y.test
          ))
            expect(x.days.some((y) => ['I', 'RP'].includes(y.workout.qualityType ?? ''))).toBe(
              true
            );
        }
  });

  it('vrsta testa: početnik nikad, po osećaju uvek (nedelja 3/4), sa rezultatom od 10 nedelja', () => {
    expect(testKindOf({ feel: false, beginner: true }, 16)).toBeNull();
    expect(testKindOf({ feel: true, beginner: true }, 16)).toBeNull();
    expect(testKindOf({ feel: true, beginner: false }, 6)).toBe('feel');
    expect(testKindOf({ feel: false, beginner: false }, 9)).toBeNull();
    expect(testKindOf({ feel: false, beginner: false }, 10)).toBe('result');
    const beg = planOf({ ...inp(3, 20, 12, 35), experience: 'beginner', canRun30Min: true });
    expect(testDays(beg)).toHaveLength(0);
  });

  it('validator: test pomeren (oznaka i dan) ili dodat u kraći plan → TEST_WEEK', () => {
    const plan = planOf(inp(4, 30, 12, 45));
    const w = plan.weeks.find((x) => x.test)!;
    const moved = structuredClone(plan);
    const [a, b] = [moved.weeks[w.index - 2]!, moved.weeks[w.index - 1]!];
    const qa = a.days.find((d) => d.role === 'q1')!;
    const qb = b.days.find((d) => d.role === 'q1')!;
    [qa.workout, qb.workout] = [qb.workout, qa.workout];
    [a.test, b.test] = [true, false];
    expect(errors(moved)).toContain('TEST_WEEK');
    const short = planOf(inp(4, 30, 9, 45));
    short.weeks.find((x) => x.phase === 'peak' && !x.deload)!.test = true;
    expect(errors(short)).toContain('TEST_WEEK');
  });
});

/* ---------- F2 ---------- */

/** Zapisi: svi dani plana [asOf − 13, asOf] urađeni (RPE 5), poslednja dva dana kvaliteta po `mode`. */
function factsOf(
  plan: FiveKV2Plan,
  asOf: string,
  mode: 'ctl' | 'rpe9' | 'miss',
  extra: 'pain' | null = null
): Record<string, unknown> {
  const from = addDays(asOf, -13);
  const days = plan.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.date >= from && d.date <= asOf && d.countsToWeek);
  const q = days.filter(
    (d) =>
      (d.role === 'q1' || d.role === 'q2') &&
      d.workout.kind === 'quality' &&
      d.workout.qualityType !== 'TEST_3K'
  );
  const hard = new Set(q.slice(-2).map((d) => d.date));
  const workouts: Record<string, unknown>[] = days.map((d) =>
    hard.has(d.date) && mode === 'miss'
      ? { date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }
      : {
          date: d.date,
          dayId: d.date,
          km: d.workout.km,
          durationSec: d.workout.sec,
          completed: true,
          rpe: hard.has(d.date) && mode === 'rpe9' ? 9 : 5
        }
  );
  if (extra === 'pain')
    workouts.push({ date: asOf, km: 0, durationSec: 0, completed: false, pain: 5 });
  return { workouts, coverage: { from, to: asOf, complete: true } };
}
const adapted = (plan: FiveKV2Plan, facts: Record<string, unknown>, asOf: string) => {
  const r = adaptFiveKV2(plan, facts, asOf);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
  return { plan: r.plan, reasons: r.reasons };
};
const hq = (r: { reasons: { condition: string; applied: boolean; message: string }[] }) =>
  r.reasons.filter((x) => x.condition === 'HARD_QUALITY');

describe('P5 F2 (Odluka 10) — kvalitet u adaptaciji', () => {
  const plan = planOf(inp(4, 30, 12, 45));
  const asOf = plan.weeks[1]!.endDate; // kraj nedelje 2 (baza); n = 3

  it('RPE ≥ 9 ili neodrađeno na dva uzastopna kvaliteta → nedelja 3 bez rasta doze, isti cilj; kontrola bez efekta', () => {
    const ctl = adapted(plan, factsOf(plan, asOf, 'ctl'), asOf);
    expect(hq(ctl)).toHaveLength(0);
    expect(ctl.plan.weeks.some((w) => w.hold)).toBe(false);
    for (const mode of ['rpe9', 'miss'] as const) {
      const r = adapted(plan, factsOf(plan, asOf, mode), asOf);
      expect(hq(r)).toEqual([expect.objectContaining({ applied: true })]);
      expect(hq(r)[0]!.message).toContain('doza nedelje 3 ne raste');
      expect(hq(r)[0]!.message).not.toMatch(/HARD_QUALITY|Odluka|F2/);
      const w = r.plan.weeks[2]!;
      expect(w.hold).toBe(true);
      expect(r.plan.weeks.filter((x) => x.hold).map((x) => x.index)).toEqual([3]);
      expect(w.targetKm).toBe(ctl.plan.weeks[2]!.targetKm);
      const prev = zone(r.plan.weeks[1]!);
      const now = zone(w);
      for (const z of ['I', 'T', 'R'] as const)
        if (prev[z] > 0) expect(now[z]).toBeLessThanOrEqual(prev[z] + 1e-9);
      const c = zone(ctl.plan.weeks[2]!);
      expect(now.R + now.T).toBeLessThanOrEqual(c.R + c.T + 1e-9);
      expect(errors(r.plan)).toEqual([]);
      // Uslov 8.
      for (const d of w.days) expect(d.workout.km).toBeGreaterThan(0);
      // Posle nedelje zadržavanja progresija se nastavlja od zadržane doze (nedelja 4 je rasterećenje ili raste).
      expect(w.notes.some((n) => n.startsWith('Doza kvaliteta ostaje kao prethodne nedelje'))).toBe(
        true
      );
    }
  });

  it('isti zapisi ne prave nov korak (sledeća adaptacija bez novih zapisa)', () => {
    const p16 = planOf(inp(4, 30, 16, 45));
    const at1 = p16.weeks[0]!.endDate;
    const r = adapted(p16, factsOf(p16, at1, 'rpe9'), at1);
    expect(r.plan.weeks.filter((w) => w.hold).map((w) => w.index)).toEqual([2]);
    const w3 = r.plan.weeks[2]!;
    expect(w3.phase === 'base' && !w3.deload).toBe(true);
    const again = adapted(r.plan, factsOf(p16, at1, 'rpe9'), p16.weeks[1]!.endDate);
    expect(hq(again)).toEqual([expect.objectContaining({ applied: false })]);
    expect(again.plan.weeks.filter((w) => w.hold).map((w) => w.index)).toEqual([2]);
  });

  it('ispod bola: applied false, bez zadržavanja; isti zapisi ne prave nov korak', () => {
    const p = adapted(plan, factsOf(plan, asOf, 'rpe9', 'pain'), asOf);
    expect(hq(p)).toEqual([expect.objectContaining({ applied: false })]);
    expect(hq(p)[0]!.message).toContain('nadjačano (bol)');
    expect(p.plan.weeks.some((w) => w.hold)).toBe(false);
    const r = adapted(plan, factsOf(plan, asOf, 'rpe9'), asOf);
    const at2 = addDays(asOf, 2);
    const again = adapted(r.plan, factsOf(plan, asOf, 'rpe9'), at2);
    expect(hq(again)).toEqual([expect.objectContaining({ applied: false })]);
    expect(again.plan.weeks.filter((w) => w.hold).map((w) => w.index)).toEqual([3]);
    expect(again.plan.adaptation!.steps.filter((s) => s.hard?.hold)).toHaveLength(1);
  });

  it('taper i trkačka nedelja: bez efekta', () => {
    const t = plan.weeks.find((w) => w.phase === 'taper')!;
    const at = addDays(t.startDate, -1);
    const r = adapted(plan, factsOf(plan, at, 'rpe9'), at);
    expect(hq(r)).toEqual([expect.objectContaining({ applied: false })]);
    expect(r.plan.weeks.some((w) => w.hold)).toBe(false);
  });

  it('po osećaju i početnik: zadržavanje bez odbijanja', () => {
    for (const x of [
      { ...inp(4, 30, 12, 45), recentResult: undefined, typicalEasyPaceSecPerKm: 360 },
      { ...inp(4, 25, 12, 35), experience: 'beginner', canRun30Min: true }
    ]) {
      const p0 = planOf(x);
      const at = p0.weeks[5]!.endDate;
      const r = adapted(p0, factsOf(p0, at, 'rpe9'), at);
      expect(errors(r.plan)).toEqual([]);
      expect(hq(r)).toHaveLength(1);
    }
  });

  it('validator: veća doza u nedelji zadržavanja ili oznaka bez koraka → DOSE_HOLD', () => {
    const r = adapted(plan, factsOf(plan, asOf, 'rpe9'), asOf);
    const lifted = structuredClone(r.plan);
    const q = lifted.weeks[2]!.days.find((d) => d.role === 'q1')!;
    q.workout.workKm.R += 0.4;
    expect(errors(lifted)).toContain('DOSE_HOLD');
    const flag = structuredClone(r.plan);
    flag.weeks[5]!.hold = true;
    expect(errors(flag)).toContain('DOSE_HOLD');
  });
});
