/** Align automatic pace overlays with replacement prescriptions; preserve all user fields. */
import type { AltRecord, GenPlanState } from '../state';
import type { ReplanContext } from './future';
import { resolvePlan } from './resolve';

export function alignAutomaticOverlays(
  current: GenPlanState | null,
  result: GenPlanState,
  today: string,
  context: ReplanContext
): Record<string, AltRecord> {
  const next = { ...context.alts };
  const moves = context.moves ?? {};
  const beforePlan = current ? resolvePlan(current.weeks, { moves, alts: {} }) : null;
  const afterPlan = resolvePlan(result.weeks, { moves, alts: {} });
  for (const [id, alt] of Object.entries(next)) {
    const before = beforePlan?.byId.get(id);
    const after = afterPlan.byId.get(id);
    if (
      !alt.paceAuto ||
      !before ||
      !after ||
      after.date <= today ||
      context.log?.[id]?.status === 'done'
    )
      continue;
    if (JSON.stringify(before.origin) === JSON.stringify(after.origin)) continue;
    const auto = after.session?.paceSec0 !== undefined;
    const replacement: AltRecord = {
      ...alt,
      tag:
        alt.tag === (before.rest ? 'odmor' : before.tag)
          ? after.rest
            ? 'odmor'
            : after.tag!
          : alt.tag,
      km: alt.km === before.km ? (after.km ?? null) : alt.km,
      desc: alt.desc === before.desc ? (after.desc ?? '') : alt.desc,
      pace: auto ? after.session!.paceSec : null,
      paceAuto: auto
    };
    if (
      !auto &&
      replacement.tag === (after.rest ? 'odmor' : after.tag) &&
      replacement.km === (after.km ?? null) &&
      replacement.desc === (after.desc ?? '') &&
      !replacement.rw &&
      !replacement.snaga
    )
      delete next[id];
    else next[id] = replacement;
  }
  return next;
}
