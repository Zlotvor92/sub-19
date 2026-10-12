import { describe, expect, it } from 'vitest';
import { parseIsoDate } from '../date';
import type { AltRecord, GenPlanState } from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import { assessRunWalkProgress } from '../training/runWalkProgress';
import type { PlanGenerationInput } from '../training/types';
import { adaptGeneratedPlan } from './adapt';
import { buildRunWalkAdjustment, runWalkLadderFor } from './runWalkAdjustment';
import { resolvePlan } from './resolve';

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
const stored = (): GenPlanState => ({
  ...adaptGeneratedPlan(generatePlan(U01))!,
  ulaz: U01
});
// Sreda četvrte nedelje: poslednji korak lestvice (5:1) je u toku.
const today = parseIsoDate('2026-11-04')!;
const current = (p: GenPlanState) => resolvePlan(p.weeks, { alts: {}, moves: {} });

describe('lestvica za ponavljanje faze', () => {
  it('zadržavanje ponavlja korak, vraćanje ide jedan unazad, ponavljanje kreće iznova', () => {
    expect(runWalkLadderFor(3, 'hold')).toEqual([3, 3, 4]);
    expect(runWalkLadderFor(4, 'hold')).toEqual([4, 4]);
    expect(runWalkLadderFor(2, 'hold', 2)).toEqual([2, 2, 2, 3, 4]);
    expect(runWalkLadderFor(4, 'step-back')).toEqual([3, 4]);
    expect(runWalkLadderFor(1, 'step-back')).toEqual([1, 2, 3, 4]);
    expect(runWalkLadderFor(4, 'repeat-phase')).toEqual([1, 2, 3, 4]);
    expect(runWalkLadderFor(4, 'hold', 99)).toEqual([4, 4, 4, 4]);
  });
});

describe('buildRunWalkAdjustment', () => {
  const plan = stored();
  const resolved = current(plan);
  const assessment = assessRunWalkProgress({ plan: resolved, log: {}, today });

  it('pre: W5 izlazi iz run/walk-a; posle: zadržavanje produžava hod, a prelaz ostaje probni', () => {
    const before = resolved.dated.filter((d) => d.w === 5 && !d.rest && d.km);
    expect(before.every((d) => d.tag !== 'rw')).toBe(true);
    const built = buildRunWalkAdjustment(plan, today, assessment, { mode: 'hold' });
    if ('error' in built) throw new Error(built.error);
    const after = current(built.result).dated.filter((d) => d.w === 5 && !d.rest && d.km);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((d) => d.tag === 'rw' && d.runWalk?.runSec === 300)).toBe(true);
    const next = current(built.result).dated.filter((d) => d.w === 6 && !d.rest && d.km);
    expect(next.every((d) => d.tag !== 'rw')).toBe(true);
    expect(next.some((d) => /Prelaz na neprekidno trčanje je probni/.test(d.desc ?? ''))).toBe(
      true
    );
    expect(built.summary).toMatch(/Zadržavanje koraka/);
    expect(built.result.meta?.['runWalk']).toMatchObject({ ladder: [4, 4] });
    expect(built.result.meta?.['goalSec']).toBe(1800);
    expect(built.result.meta?.['raceDate']).toBe('2027-01-03');
  });

  it('čuva prošle i današnje dane, završene treninge, efektivni datum i ručne izmene', () => {
    const done = resolved.dated.find((d) => d.w === 5 && !d.rest && d.km)!;
    const manual = resolved.dated.find((d) => d.w === 5 && !d.rest && d.km && d.id !== done.id)!;
    const log = {
      [done.id]: { status: 'done', km: 2.4, sec: 1700, runDate: '2026-11-05' }
    };
    const alts: Record<string, AltRecord> = {
      [manual.id]: {
        tag: 'lako',
        km: 4.2,
        desc: 'Moja izmena 4.2 km',
        rw: null,
        pace: null,
        paceAuto: false
      }
    };
    const built = buildRunWalkAdjustment(plan, today, assessment, { mode: 'hold' }, { log, alts });
    if ('error' in built) throw new Error(built.error);
    const sameDay = (id: string) =>
      built.result.weeks.flatMap((w) => w.days).find((d) => d.id === id);
    for (const w of plan.weeks)
      for (const d of w.days) {
        const date = resolved.byId.get(d.id!)!.date;
        if (date <= today || d.id === done.id || d.id === manual.id)
          expect(sameDay(d.id!)).toEqual(d);
      }
    expect(
      (built.result.meta?.['futureChanges'] as { conflicts: string[] }).conflicts.join(' ')
    ).toMatch(/Ručno izmenjen trening/);
  });

  it('bez započete faze, bez sačuvanih ulaza i blizu trke vraća jasnu grešku', () => {
    const none = assessRunWalkProgress({ plan: resolved, log: {}, today: '2026-10-11' });
    expect(buildRunWalkAdjustment(plan, today, none, { mode: 'hold' })).toHaveProperty('error');
    expect(
      buildRunWalkAdjustment({ ...plan, ulaz: undefined }, today, assessment, { mode: 'hold' })
    ).toHaveProperty('error');
    const late = buildRunWalkAdjustment(plan, parseIsoDate('2026-12-14')!, assessment, {
      mode: 'hold'
    });
    expect('error' in late && late.error).toMatch(/manje od četiri nedelje/);
  });
});
