import { useMemo } from 'react';
import { planBaselineVdot } from '../../domain/plan';
import { currentVdot } from '../../domain/training/adaptation';
import { paceForZone } from '../../domain/training/vdot/paceForZone';
import { useActiveGenPlan, useTrainingStore } from '../../stores';

/** Lagan tempo [s/km] iz tekuće forme (lanac VDOT-a, a kad ga nema polazna forma plana). `null` kad nema osnove (npr. lični plan bez forme). */
export function useEasyPace(): number | null {
  const chain = useTrainingStore((s) => s.vdotLog);
  const meta = useActiveGenPlan()?.meta;
  return useMemo(() => {
    const v = currentVdot(chain) ?? planBaselineVdot(meta);
    return v != null && Number.isFinite(v) ? paceForZone(v, 'E') : null;
  }, [chain, meta]);
}
