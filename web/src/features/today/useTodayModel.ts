import { useMemo } from 'react';
import { effectiveRaceDate } from '../../domain/day';
import { diffDays, parseIsoDate, type IsoDate } from '../../domain/date';
import type { ResolvedDay, ResolvedPlan } from '../../domain/plan';
import { useActiveGenPlan, useResolvedPlan } from '../../stores';
import { useUIStore } from '../../stores/uiStore';

export interface TodayModel {
  today: IsoDate;
  plan: ResolvedPlan;
  raceDate: IsoDate;
  daysToRace: number;
  day: ResolvedDay | undefined;
}

/** Sve što ekran Danas čita, izvedeno iz store-ova. `null` dok nema plana ili datuma. */
export function useTodayModel(): TodayModel | null {
  const plan = useResolvedPlan();
  const metaRace = useActiveGenPlan()?.meta?.['raceDate'];
  const todayStr = useUIStore((s) => s.today);
  return useMemo(() => {
    const today = parseIsoDate(todayStr);
    if (!plan || !today) return null;
    const raceDate = effectiveRaceDate(plan, metaRace);
    if (!raceDate) return null;
    return {
      today,
      plan,
      raceDate,
      daysToRace: diffDays(today, raceDate),
      day: plan.byDate.get(today)
    };
  }, [plan, metaRace, todayStr]);
}
