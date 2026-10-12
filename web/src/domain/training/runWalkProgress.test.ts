import { describe, expect, it } from 'vitest';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { ResolvedPlan } from '../plan/types';
import type { LogEntry } from '../state/types';
import { generatePlan } from './generator/generatePlan';
import { assessRunWalkProgress } from './runWalkProgress';
import type { PlanGenerationInput } from './types';

const U01: PlanGenerationInput = {
  startDate: '2026-10-12',
  raceDate: '2027-01-03',
  raceDistM: 5000,
  pb: { distM: 5000, sec: 2100, date: '2026-09-13' },
  weeklyKm: 8,
  recentLongRunKm: 3,
  consistentWeeks: 0,
  qualityExperience: 'none',
  runDays: 3,
  quality: 1,
  intensity: 'kons',
  volIntensity: 'kons',
  trainedRecently: false,
  goalSec: 1800,
  lrDow: 7
};
const generated = generatePlan(U01);
if ('error' in generated) throw new Error(generated.error);
const stored = adaptGeneratedPlan(generated)!;
const plan: ResolvedPlan = resolvePlan(stored.weeks, { alts: {}, moves: {} });
const rwDays = (rung: number) =>
  plan.dated.filter(
    (d) => d.tag === 'rw' && d.runWalk && d.runWalk.runSec === [60, 120, 180, 300][rung - 1]!
  );
const log = (rung: number, entries: Array<Partial<LogEntry>>): Record<string, LogEntry> =>
  Object.fromEntries(
    entries.map((e, i) => [rwDays(rung)[i]!.id, { status: 'done', km: 2.5, ...e }])
  );
const lastOf = (rung: number): string => rwDays(rung).at(-1)!.date;

describe('procena tolerancije trčanja/hoda', () => {
  it('bez započetog run/walk-a nema šta da se oceni', () => {
    const r = assessRunWalkProgress({ plan, log: {}, today: '2026-10-11' });
    expect(r.decision).toBe('not-applicable');
  });

  it('prazan dnevnik je nepoznat podatak: ne napreduje i ne računa se kao neuspeh', () => {
    const r = assessRunWalkProgress({ plan, log: {}, today: lastOf(4) });
    expect(r.decision).toBe('unknown');
    expect(r.rung).toBe(4);
    expect(r.finalRung).toBe(true);
    expect(r.missed).toBe(0);
    expect(r.advice).toMatch(/ostaje nepotvrđen/);
  });

  it('završeno bez upisanog napora ostaje nepoznato', () => {
    const r = assessRunWalkProgress({
      plan,
      log: log(4, [{}, {}, {}]),
      today: lastOf(4)
    });
    expect(r.unreported).toBe(3);
    expect(r.tolerated).toBe(0);
    expect(r.decision).toBe('unknown');
  });

  it('tri trčanja uz napor do 5/10 potvrđuju prelaz na neprekidno trčanje', () => {
    const r = assessRunWalkProgress({
      plan,
      log: log(4, [{ rpe: 3 }, { rpe: 4 }, { rpe: 5, knee: 1 }]),
      today: lastOf(4)
    });
    expect(r.decision).toBe('advance');
    expect(r.advice).toMatch(/prelaz na neprekidno lagano trčanje je opravdan/);
  });

  it('visok napor ili bol zadržavaju korak, a dva takva na višem koraku vraćaju korak', () => {
    const hold = assessRunWalkProgress({
      plan,
      log: log(4, [{ rpe: 3 }, { rpe: 7 }, { rpe: 3 }]),
      today: lastOf(4)
    });
    expect(hold.decision).toBe('hold');
    const back = assessRunWalkProgress({
      plan,
      log: log(4, [{ rpe: 8 }, { rpe: 3, knee: 5 }, { rpe: 3 }]),
      today: lastOf(4)
    });
    expect(back.decision).toBe('step-back');
    const first = assessRunWalkProgress({
      plan,
      log: log(1, [{ rpe: 8 }, { rpe: 9 }, { rpe: 3 }]),
      today: lastOf(1)
    });
    expect(first.decision).toBe('hold');
  });

  it('dva preskočena, dva granična trčanja ili noviji bol zadržavaju korak', () => {
    const skips = Object.fromEntries(
      rwDays(3)
        .slice(0, 2)
        .map((d) => [d.id, { status: 'skip' }])
    );
    expect(assessRunWalkProgress({ plan, log: skips, today: lastOf(3) }).decision).toBe('hold');
    expect(
      assessRunWalkProgress({
        plan,
        log: log(3, [{ rpe: 6 }, { rpe: 6 }, { rpe: 3 }]),
        today: lastOf(3)
      }).decision
    ).toBe('hold');
    expect(
      assessRunWalkProgress({
        plan,
        log: log(3, [{ rpe: 3 }, { rpe: 3 }, { rpe: 3 }]),
        today: lastOf(3),
        recentPainMax: 5
      }).decision
    ).toBe('hold');
  });

  it('ocenjuje se samo trenutni korak: težak raniji korak ne kvari novi', () => {
    const r = assessRunWalkProgress({
      plan,
      log: {
        ...log(3, [{ rpe: 9 }, { rpe: 9 }, { rpe: 9 }]),
        ...log(4, [{ rpe: 3 }, { rpe: 3 }, { rpe: 4 }])
      },
      today: lastOf(4)
    });
    expect(r.rung).toBe(4);
    expect(r.hard).toBe(0);
    expect(r.decision).toBe('advance');
  });
});
