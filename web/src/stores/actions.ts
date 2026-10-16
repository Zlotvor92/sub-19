/* RADNJE KOJE DOTIČU VIŠE STORE-OVA. Domen je čist; ovde se samo čita iz jednog store-a, poziva domen i piše u više njih. */

import type { GenPlanState, PersistedState } from '../domain/state';
import { planBaselineVdot, purgeGenPlanData } from '../domain/plan';
import { recomputeChain } from '../domain/day';
import { generatorForPlan, stampForStorage } from '../domain/generators/select';
import type { StoredPredRow } from '../domain/training/adaptation';
import { withoutPersist, requestPersist } from './persistence';
import { useRecoveryStore } from './recoveryStore';
import { useTrainingStore } from './trainingStore';

/**
 * Aktivira nov generisan plan (čarobnjak): stari `g` podaci odlaze (novi plan dobija ISTE ID-jeve), lanac forme se
 * preračunava iz onoga što je ostalo (test na 3 km ostaje) naspram polazne forme NOVOG plana — politikom forme generatora
 * novog plana (A1) — pa se upisuje plan sa fazom nedelja i oznakom politike tog generatora (A3/A7). Jedan upis na kraju.
 */
export function activateNewPlan(generated: GenPlanState): void {
  const plan = stampForStorage(generated);
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
  const baseline = planBaselineVdot(plan.meta);
  /* Klasa sesije se čita samo iz naziva reda (bez eksplicitne zone), kao ranije. */
  const rows = plan.pred
    .filter((p): p is StoredPredRow => typeof p.id === 'string')
    .map(({ zone: _zone, ...r }) => r);
  const chain = recomputeChain(purged.vdotLog, {
    form: generatorForPlan(plan),
    rows,
    baselineVdot: baseline,
    hasAlt: false
  });
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
