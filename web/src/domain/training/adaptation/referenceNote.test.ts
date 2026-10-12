import { describe, expect, it } from 'vitest';
import { adaptGeneratedPlan } from '../../plan/adapt';
import type { GenPlanState } from '../../state/types';
import { generatePlan } from '../generator/generatePlan';
import type { PlanGenerationInput } from '../types';
import { refreshSessionPace, restoreSessionPace } from './proposal';

const U06: PlanGenerationInput = {
  startDate: '2026-10-12',
  raceDate: '2027-01-31',
  raceDistM: 10000,
  pb: { distM: 5000, sec: 1620, date: '2025-10-12' },
  weeklyKm: 15,
  recentLongRunKm: 4,
  consistentWeeks: 1,
  breakWeeks: 8,
  qualityExperience: 'some',
  runDays: 3,
  quality: 1,
  intensity: 'std',
  trainedRecently: false
};

describe('napomena o nepotvrđenoj formi i prihvatanje merene forme', () => {
  const plan = adaptGeneratedPlan(generatePlan(U06)) as GenPlanState;
  const day = plan.weeks.flatMap((w) => w.days).find((d) => d.session)!;

  it('merenje menja ritam i uklanja tvrdnju da je ritam samo referenca; poništavanje je vraća', () => {
    expect(day.session!.paceBasis).toBe('reference');
    expect(day.desc).toMatch(/Forma nije potvrđena/);
    const refreshed = refreshSessionPace(plan, day.id!, day.session!.paceSec - 10);
    expect(refreshed.changed).toBe(true);
    const after = refreshed.genPlan.weeks.flatMap((w) => w.days).find((d) => d.id === day.id)!;
    expect(after.session!.paceSec).toBe(day.session!.paceSec - 10);
    expect(after.session!.paceBasis).toBe('measured');
    expect(after.desc).not.toMatch(/Forma nije potvrđena|Uvodi se tek kad/);
    const restored = restoreSessionPace(refreshed.genPlan, day.id!);
    const back = restored.genPlan.weeks.flatMap((w) => w.days).find((d) => d.id === day.id)!;
    expect(back.session!.paceSec).toBe(day.session!.paceSec);
    expect(back.session!.paceBasis).toBe('reference');
    expect(back.desc).toMatch(/Forma nije potvrđena/);
  });
});
