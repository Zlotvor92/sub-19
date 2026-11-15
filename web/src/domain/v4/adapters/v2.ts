/* V4 ADAPTER — v2 PLAN (sve distance; SPEC § 9.1): `meta.policyId`/`policyVersion`, `weeks[].phase`, dan sa
   `structure` (blokovi koraka sa km/sec/zonom). Izlazi generatora v2 (`fiveKV2`, `tenKV2`, `hmV2`, `marathonV2`)
   se ne tumače: idu doslovno u `carried`. Kod v2 se ne uvozi. */
import { DEFAULT_VDOT } from '../engine/constants';
import { num, str, type ReadPlan } from './read';
import type { FormatSpec } from './shared';

const V2_OUTPUTS = ['fiveKV2', 'tenKV2', 'hmV2', 'marathonV2'];

export const isV2 = (plan: ReadPlan): boolean =>
  /-v2\./.test(str(plan.meta['policyId']) ?? '') ||
  /-v2\./.test(str(plan.meta['policyVersion']) ?? '') ||
  V2_OUTPUTS.some((k) => plan.raw[k] !== undefined);

export function v2Spec(plan: ReadPlan, distance: { id: string; distanceM: number }): FormatSpec {
  const meta = plan.meta;
  return {
    format: 'v2',
    policyVersion: str(meta['policyVersion']) ?? str(meta['policyId']) ?? 'v2',
    protected: false,
    distanceId: distance.id,
    distanceM: distance.distanceM,
    vdot: num(meta['trainingVdot']) ?? num(meta['vdot']) ?? num(meta['vdot0']) ?? DEFAULT_VDOT,
    profile: {}
  };
}
