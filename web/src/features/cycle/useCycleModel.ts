import { useMemo } from 'react';
import { parseIsoDate } from '../../domain/date';
import { phaseReaderFor } from '../../domain/generators/select';
import { useActiveGenPlan, useResolvedPlan, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { cycleModel, type CycleModel } from './cycle';

/** Model ciklusa za tekući plan i današnji datum; `null` dok nema plana ili datuma. */
export function useCycleModel(): CycleModel | null {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const todayStr = useUIStore((s) => s.today);
  const genPlan = useActiveGenPlan();
  return useMemo(() => {
    const today = parseIsoDate(todayStr);
    return plan && today ? cycleModel(plan, log, today, phaseReaderFor(genPlan)) : null;
  }, [plan, log, todayStr, genPlan]);
}
