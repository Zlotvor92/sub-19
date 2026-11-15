/* V4 ADAPTER — PLAN STAROG FORMATA (v1 generatori, obe podvrste; SPEC § 9.1). Podvrsta `legacy-a`: `meta` bez
   `athlete`/`preparation`; `legacy-b`: sa njima (procena trkača iz čarobnjaka). Nedelja nema `phase`; dan
   `{ id, dow, rest, tag, km | null, desc, session?, strides?, runWalk?, finish?, mlr? }`. */
import { DEFAULT_VDOT } from '../engine/constants';
import type { RunnerProfile } from '../engine/types';
import { isRec, num, type ReadPlan } from './read';
import type { FormatSpec } from './shared';

export const isLegacyB = (plan: ReadPlan): boolean =>
  isRec(plan.meta['athlete']) || isRec(plan.meta['preparation']);

export function legacySpec(
  plan: ReadPlan,
  distance: { id: string; distanceM: number }
): FormatSpec {
  const meta = plan.meta;
  const athlete = isRec(meta['athlete']) ? meta['athlete'] : {};
  const profile: RunnerProfile = {};
  const weeklyKm = num(athlete['weeklyBaseKm']);
  const longKm = num(athlete['repeatableLongRunKm']);
  if (weeklyKm !== null && weeklyKm > 0) profile.weeklyKm = weeklyKm;
  if (longKm !== null && longKm > 0) profile.longestRecentKm = longKm;
  return {
    format: isLegacyB(plan) ? 'legacy-b' : 'legacy-a',
    policyVersion: 'v1',
    protected: false,
    distanceId: distance.id,
    distanceM: distance.distanceM,
    vdot: num(meta['trainingVdot']) ?? num(meta['vdot0']) ?? DEFAULT_VDOT,
    profile
  };
}
