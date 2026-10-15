import { useMemo } from 'react';
import { parseIsoDate, type IsoDate } from '../../domain/date';
import { BODY_PARTS, painModel, partLevel, type LoadContext } from '../../domain/recovery';
import { generatorForPlan } from '../../domain/generators/select';
import { useActiveGenPlan, useResolvedPlan, useTrainingStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';

/* MODEL OPORAVKA — jedan izvor za sve što o oporavku govore Danas (upozorenje), Napredak → Oporavak, Bol i Plan → Prilagodi plan. Isti ulazi i
   iste funkcije domena kao ranije na tabu Oporavak; ništa se ne računa novo. `null` dok nema plana ili datuma. */
export function useRecoveryModel() {
  const plan = useResolvedPlan();
  const genPlan = useActiveGenPlan();
  const log = useTrainingStore((s) => s.log);
  const pain = useRecoveryStore((s) => s.knee);
  const wellness = useRecoveryStore((s) => s.wellness);
  const outOfPlan = useRecoveryStore((s) => s.vanPlana);
  const todayStr = useUIStore((s) => s.today);
  return useMemo(() => {
    const today = parseIsoDate(todayStr);
    // Procena stanja (bol, opterećenje, spremnost) i predlog pripadaju generatoru distance aktivnog plana.
    const generator = generatorForPlan(genPlan);
    if (!plan || !today || !generator) return null;
    const ctx: LoadContext & { pain: typeof pain } = { plan, log, outOfPlan, pain };
    const status = generator.painStatus(pain, today);
    const now = generator.acwrNow(ctx, today);
    return {
      plan,
      today,
      ctx,
      status,
      // Predlog izmene plana zbog bola/prekida pravi generator distance aktivnog plana; bez generatora nema predloga.
      proposal: generator.injuryProposal(ctx, today),
      assess: generator,
      now,
      ahead: generator.acwrPlan(ctx, today),
      /** Delovi tela sa bolom u poslednjih 14 dana, najjači prvi. */
      active: Object.keys(BODY_PARTS)
        .map((p) => ({ p, lv: partLevel(pain, p, today) }))
        .filter((x): x is { p: string; lv: number } => x.lv != null && x.lv >= 1)
        .sort((a, b) => b.lv - a.lv),
      chart: painModel(pain, today),
      ready: generator.readinessModel({ status, load: now, wellness, today: todayStr as IsoDate })
    };
  }, [plan, genPlan, log, pain, wellness, outOfPlan, todayStr]);
}
