/* RADNJE KOJE DOTIČU VIŠE STORE-OVA. Domen je čist; ovde se samo čita iz jednog store-a, poziva domen i piše u više njih. */

import type { GenPlanState, PersistedState } from '../domain/state';
import { purgeGenPlanData } from '../domain/plan';
import { recomputeVdotChain, sessionClassFor } from '../domain/training/adaptation';
import { isT3kId } from '../domain/training/vdot/limits';
import { withoutPersist, requestPersist } from './persistence';
import { useRecoveryStore } from './recoveryStore';
import { useTrainingStore } from './trainingStore';

/**
 * Aktivira nov generisan plan (čarobnjak): stari `g` podaci odlaze (novi plan dobija ISTE ID-jeve), lanac forme se
 * preračunava iz onoga što je ostalo (test na 3 km ostaje) naspram polazne forme NOVOG plana, pa se upisuje plan.
 * Jedan upis na kraju.
 */
export function activateNewPlan(plan: GenPlanState): void {
  const t = useTrainingStore.getState();
  const r = useRecoveryStore.getState();
  const purged = purgeGenPlanData({
    log: t.log,
    pred: t.pred,
    predLock: t.predLock,
    alts: t.alts,
    moves: t.moves,
    vdotLog: t.vdotLog,
    knee: r.knee,
    kg: r.kg
  });
  const baseline = (plan.meta as { vdot0?: number } | undefined)?.vdot0 ?? null;
  const preds = plan.pred as Array<{ id?: string; l: string }>;
  const chain = recomputeVdotChain(purged.vdotLog, baseline, (id) =>
    sessionClassFor(isT3kId(id), preds.find((p) => p.id === id)?.l)
  );
  withoutPersist(() => {
    useTrainingStore.setState({
      log: purged.log,
      pred: purged.pred,
      predLock: purged.predLock,
      alts: purged.alts,
      moves: purged.moves,
      vdotLog: chain,
      genPlan: plan
    });
    useRecoveryStore.setState({ knee: purged.knee, kg: purged.kg });
  });
  requestPersist('now');
}

export type { PersistedState };

/**
 * „Napravi novi plan": stari plan i svi unosi uz njega se TRAJNO brišu (nema arhive) — generisani dani nose ID-jeve po istom obrascu
 * („g3d5"), pa bi se unosi starog plana zalepili za dane novog. Test na 3 km ostaje. Jedan upis.
 */
export function discardPlan(): void {
  const t = useTrainingStore.getState();
  const r = useRecoveryStore.getState();
  const purged = purgeGenPlanData({
    log: t.log,
    pred: t.pred,
    predLock: t.predLock,
    alts: t.alts,
    moves: t.moves,
    vdotLog: t.vdotLog,
    knee: r.knee,
    kg: r.kg
  });
  withoutPersist(() => {
    useTrainingStore.setState({
      log: purged.log,
      pred: purged.pred,
      predLock: purged.predLock,
      alts: purged.alts,
      moves: purged.moves,
      vdotLog: purged.vdotLog,
      genPlan: null
    });
    useRecoveryStore.setState({ knee: purged.knee, kg: purged.kg });
  });
  requestPersist('now');
}
