/* Kopija za HM v2 (segment HM-05): izvor `halfMarathon/recovery/index.ts` (HM v1) u 28da6af, iste vrednosti i pragovi (kopija,
   ne uvoz — HM v2 ne uvozi ništa van `halfMarathon/v2/`); tipovi formata su lokalni (`../types.ts`). Dalje se razvija samo ovde. */
/* Barel procene stanja u generatoru (isti skup imena koji je `features/recovery/readiness.ts` uvozio iz aplikacije). */
export * from './constants.ts';
export {
  acuteKm,
  acwrNow,
  acwrPlan,
  breakInfo,
  chronicKm,
  completion,
  daysWithoutRunning,
  largestWeeklyKm,
  plannedKm7,
  type Acwr,
  type BreakInfo,
  type LoadContext
} from './load.ts';
export {
  painStatus,
  returnToRunPhase,
  type PainStatus,
  type PainStatusClass,
  type ReturnPhase
} from './pain.ts';
export * from './view.ts';
