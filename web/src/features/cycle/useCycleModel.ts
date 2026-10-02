import { useMemo } from 'react';
import { parseIsoDate } from '../../domain/date';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { cycleModel, type CycleModel } from './cycle';

/** Model ciklusa za tekući plan i današnji datum; `null` dok nema plana ili datuma. */
export function useCycleModel(): CycleModel | null {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const todayStr = useUIStore((s) => s.today);
  return useMemo(() => {
    const today = parseIsoDate(todayStr);
    return plan && today ? cycleModel(plan, log, today) : null;
  }, [plan, log, todayStr]);
}
