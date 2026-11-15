/* V4 ADAPTER — LIČNI PLAN VLASNIKA (zamrznut HM v1, `meta.licni`; SPEC § 9.4, AGENTS t. 8c). Aplikacija ga daje
   kao `genPlan = personalPlan(vdot)` (u bazi ga nema). Preuzet dokument je `header.protected = true`: motor ga
   nikad ne menja sam, čuvar samo upozorava (`rucno`). */
import { DEFAULT_VDOT } from '../engine/constants';
import { num, type ReadPlan } from './read';
import type { FormatSpec } from './shared';

export const isPersonal = (plan: ReadPlan): boolean => plan.meta['licni'] === true;

export function personalSpec(
  plan: ReadPlan,
  distance: { id: string; distanceM: number }
): FormatSpec {
  return {
    format: 'personal',
    policyVersion: 'hm-v1',
    protected: true,
    distanceId: distance.id,
    distanceM: distance.distanceM,
    vdot: num(plan.meta['vdot0']) ?? DEFAULT_VDOT,
    profile: {}
  };
}
