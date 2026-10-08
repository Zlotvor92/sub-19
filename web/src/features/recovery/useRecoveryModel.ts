import { useMemo } from 'react';
import { parseIsoDate, type IsoDate } from '../../domain/date';
import {
  BODY_PARTS,
  acwrNow,
  acwrPlan,
  injuryProposal,
  painModel,
  painStatus,
  partLevel,
  type LoadContext
} from '../../domain/recovery';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import { readinessModel } from './readiness';

/* MODEL OPORAVKA — jedan izvor za sve što o oporavku govore Danas (upozorenje), Napredak → Oporavak, Bol i Plan → Prilagodi plan. Isti ulazi i
   iste funkcije domena kao ranije na tabu Oporavak; ništa se ne računa novo. `null` dok nema plana ili datuma. */
export function useRecoveryModel() {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const pain = useRecoveryStore((s) => s.knee);
  const wellness = useRecoveryStore((s) => s.wellness);
  const outOfPlan = useRecoveryStore((s) => s.vanPlana);
  const todayStr = useUIStore((s) => s.today);
  return useMemo(() => {
    const today = parseIsoDate(todayStr);
    if (!plan || !today) return null;
    const ctx: LoadContext & { pain: typeof pain } = { plan, log, outOfPlan, pain };
    const status = painStatus(pain, today);
    const now = acwrNow(ctx, today);
    return {
      plan,
      today,
      ctx,
      status,
      proposal: injuryProposal(ctx, today),
      now,
      ahead: acwrPlan(ctx, today),
      /** Delovi tela sa bolom u poslednjih 14 dana, najjači prvi. */
      active: Object.keys(BODY_PARTS)
        .map((p) => ({ p, lv: partLevel(pain, p, today) }))
        .filter((x): x is { p: string; lv: number } => x.lv != null && x.lv >= 1)
        .sort((a, b) => b.lv - a.lv),
      chart: painModel(pain, today),
      ready: readinessModel({ status, load: now, wellness, today: todayStr as IsoDate })
    };
  }, [plan, log, pain, wellness, outOfPlan, todayStr]);
}
