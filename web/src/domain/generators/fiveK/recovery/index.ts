/* Kopija za generator `fiveK` (prenos procene stanja u generatore). Izvor: aplikacioni kod u trenutku prenosa
   (`5f56a52`); dalje se razvija samo ovde. */
/* Barel procene stanja u generatoru (isti skup imena koji je `features/recovery/readiness.ts` uvozio iz aplikacije). */
export * from './constants';
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
} from './load';
export {
  painStatus,
  returnToRunPhase,
  type PainStatus,
  type PainStatusClass,
  type ReturnPhase
} from './pain';
export * from './view';
