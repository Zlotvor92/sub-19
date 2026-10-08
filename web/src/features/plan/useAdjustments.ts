import { useMemo } from 'react';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { currentVdotProposal } from '../../stores/raceActions';
import { useUIStore } from '../../stores/uiStore';

/* PREDLOG PRILAGOĐAVANJA TEMPA FORMI — jedan izvor za Danas (jedan red kad predlog postoji) i Plan → Prilagodi plan (radnja). Isti proračun kao ranije na
   ekranu Trka (`currentVdotProposal`); ništa se ne računa novo. `adjusted` je tačno kad postoji bar jedan automatski prilagođen tempo (može da se vrati).
   `currentVdotProposal` čita store direktno, pa se ulazi koje čita ovde pretplaćuju samo da bi se proračun ponovio kad se promene. */
export function useAdjustments() {
  const plan = useResolvedPlan();
  const alts = useTrainingStore((s) => s.alts);
  const log = useTrainingStore((s) => s.log);
  const pred = useTrainingStore((s) => s.pred);
  const vdotLog = useTrainingStore((s) => s.vdotLog);
  const genPlan = useTrainingStore((s) => s.genPlan);
  const todayStr = useUIStore((s) => s.today);
  return useMemo(
    () => ({
      proposal: plan ? currentVdotProposal(plan, todayStr) : null,
      adjusted: Object.values(alts).some((a) => a && a.paceAuto)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ulazi koje proračun čita iz store-a (v. komentar iznad)
    [plan, alts, log, pred, vdotLog, genPlan, todayStr]
  );
}
