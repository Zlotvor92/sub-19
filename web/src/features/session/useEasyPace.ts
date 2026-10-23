import { useMemo } from 'react';
import { generatorForPlan, type RpeTarget } from '../../domain/generators/select';
import { planBaselineVdot, type ResolvedDay } from '../../domain/plan';
import { useActiveGenPlan, useTrainingStore } from '../../stores';

/**
 * Lagan tempo [s/km] iz tekuće forme (lanac VDOT-a, a kad ga nema polazna forma plana). Zonu računa generator distance
 * aktivnog plana. `null` kad nema osnove (npr. lični plan bez forme) ili plan nema podržanu distancu.
 */
export function useEasyPace(): number | null {
  const chain = useTrainingStore((s) => s.vdotLog);
  const genPlan = useActiveGenPlan();
  return useMemo(() => {
    const generator = generatorForPlan(genPlan);
    // Trenutna forma iz lanca je politika generatora aktivnog plana (A1).
    const v = (generator ? generator.currentVdot(chain) : null) ?? planBaselineVdot(genPlan?.meta);
    return generator && v != null && Number.isFinite(v) ? generator.paceForZone(v, 'E') : null;
  }, [chain, genPlan]);
}

const NO_RPE = (): RpeTarget | null => null;

/** Ciljni napor (RPE) po danu — smernica generatora distance aktivnog plana; bez generatora nema smernice. */
export function usePlanRpe(): (
  d: Pick<ResolvedDay, 'rest' | 'tag'> | null | undefined
) => RpeTarget | null {
  const genPlan = useActiveGenPlan();
  return useMemo(() => generatorForPlan(genPlan)?.rpeTarget ?? NO_RPE, [genPlan]);
}
