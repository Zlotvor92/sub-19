/* Kopija za maraton v2 (segment MAR-05): izvor `marathon/recovery/index.ts` (maraton v1) u 9443676, iste vrednosti i pragovi (kopija,
   ne uvoz — maraton v2 ne uvozi ništa van `marathon/v2/`); tipovi formata su lokalni (`../types.ts`). Dalje se razvija samo ovde. */
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
