/* Kopija za 5K v2 (segment 08a): izvor `fiveK/recovery/index.ts` u 7fa61eb, iste vrednosti i pragovi (posebna kopija, ne uvoz —
   5K v2 je vlasnik); dalje se razvija samo ovde. */
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
