/* POLUMARATON PRE/POSLE IZDVAJANJA — podešavanje nivoa testa ekvivalencije (`./equivalenceKit.ts`).

   Deli ga glavni fajl `domain/generators/halfMarathon/equivalence.node.test.ts` i delovi punog nivoa
   `equivalence.<deo>.full.node.test.ts`. Ugovor koji test poziva (`HmApi`) je isti kao ranije u glavnom fajlu:
   izdvojeni HM generator, a „kraća distanca" (10K/5K) ide kroz aplikacioni `handoff.ts`.

   BRZ nivo (obrazloženje uzorka): v. `FAST` niže. */
import { expect } from 'vitest';
import { regeneratorForDistance } from '@/domain/generators/handoff';
import * as hm from '@/domain/generators/halfMarathon';
import { adaptationFlows } from '@/test/fiveK/scenarios';
import type { EquivalenceSetup } from './equivalenceKit';
import { hmGenerationRows, loadHmReference } from './reference';
import {
  hmAdaptationBases,
  hmDecisionBases,
  hmDecisionFlows,
  hmEventFlows,
  hmGenerationCases,
  hmTaperFlows,
  type HmApi
} from './scenarios';

const handoff = regeneratorForDistance;

export const hmApi: HmApi = {
  generatePlan: hm.generatePlan,
  assess: hm.assess,
  adaptGeneratedPlan: hm.adaptGeneratedPlan,
  resolvePlan: hm.resolvePlan,
  executionModel: hm.executionModel,
  buildExecutionAdjustment: ((...a: Parameters<typeof hm.buildExecutionAdjustment>) =>
    hm.buildExecutionAdjustment(a[0], a[1], a[2], a[3], a[4], handoff)) as never,
  buildRunWalkAdjustment: hm.buildRunWalkAdjustment,
  assessRunWalkProgress: hm.assessRunWalkProgress,
  qualityEntryGate: hm.qualityEntryGate,
  hasRecentMeasuredForm: hm.hasRecentMeasuredForm,
  planWithNewGoal: hm.planWithNewGoal,
  planRecalibrated: hm.planRecalibrated,
  recalibratedPlan: hm.recalibratedPlan,
  reentryPlan: hm.reentryPlan,
  graftFuturePlan: hm.graftFuturePlan,
  alignAutomaticOverlays: hm.alignAutomaticOverlays,
  vdotProposal: hm.vdotProposal,
  applyVdotProposal: hm.applyVdotProposal,
  undoVdotAdjustments: hm.undoVdotAdjustments,
  fitnessEvidence: hm.fitnessEvidence,
  planVdotNow: hm.planVdotNow,
  matchPlanRows: hm.matchPlanRows,
  sessKm: hm.sessKm,
  sessDesc: hm.sessDesc,
  t3kVdot: hm.t3kVdot,
  executionBasis: hm.executionBasis,
  basisFromPlan: hm.basisFromPlan,
  preparationDecision: (...a: Parameters<typeof hm.preparationDecision>) =>
    hm.preparationDecision(a[0], a[1], a[2], a[3], a[4], a[5], handoff),
  buildPreparationChoice: (...a: Parameters<typeof hm.buildPreparationChoice>) =>
    hm.buildPreparationChoice(a[0], a[1], a[2], a[3], a[4], handoff),
  isLimitedLongPreparation: hm.isLimitedLongPreparation
};

export const hmReference = loadHmReference();

const api = hmApi;

/** BRZ nivo:
 *  - generisanje: svaki 8. ulaz u kategorijama `fingerprint` / `hmTrack` / `seededHm`, SVI `edgeHm` i `qa`;
 *  - adaptacija: bazni planovi `qa` / `seededHm` / `hmTrack` / `edgeHm` — prvi u svakoj kategoriji i svaki 18. (jedan
 *    bazni plan = ceo skup tokova, ~360 redova, 0,2–6 s; HM ih ima 75), plus imenovani rubni `početnik` (run/walk
 *    lestvica: run/walk tokove ima samo 6 od 75 baznih planova) i `povratak` (pauza, kontinuitet 2 ned.). Prvi `edgeHm` je `trka za 3 ned · q2` (najkraća
 *    priprema). Događaji `event · …` uvek;
 *  - odluke: prvi i svaki 6. bazni plan po kategoriji (`qa` / `edgeHm` / `seededHm`; jeftine; uzorak `edgeHm` sadrži
 *    `početnik`);
 *  - vremenska zona: sve četiri zone; svaki 8. ulaz današnjeg izbora generisanja i jedan bazni plan adaptacije (6 ned.).
 *  Vreme brzog fajla određuje adaptacija (bazni plan ~2,8 s CPU): sa k = 18 to je 7 baznih planova (~16 s CPU). */
const FAST: EquivalenceSetup['fast'] = {
  generationK: 8,
  generationKeep: (n) => /^(edgeHm|qa) · /.test(n),
  adaptationK: 18,
  adaptationKeep: (n) => /^edgeHm · (početnik|povratak)$/.test(n),
  decisionK: 6,
  decisionKeep: () => false,
  tzGenerationK: 8,
  tzAdaptationBase: 'edgeHm · trka za 6 ned · q2'
};

export const hmSetup: EquivalenceSetup = {
  id: 'halfMarathon',
  label: 'HM generatoru',
  reference: {
    generation: hmReference?.generation ?? {},
    adaptation: hmReference?.adaptation ?? {},
    decisions: hmReference?.decisions ?? {}
  },
  generationNames: () => hmGenerationCases().map((c) => c.name),
  generationRows: (pick, expected) => hmGenerationRows(api, pick, expected),
  adaptationBases: hmAdaptationBases,
  adaptationFlows: (bases) => [
    ...adaptationFlows(api, undefined, bases),
    ...hmTaperFlows(api, bases)
  ],
  eventFlows: () => hmEventFlows(api),
  eventCount: 4,
  decisionBases: hmDecisionBases,
  decisionFlows: (bases) => hmDecisionFlows(api, bases),
  decisionCounts: (keys) => {
    expect(
      keys.filter((k) => k.includes('"kind":"shorter","raceDistM":10000')).length
    ).toBeGreaterThan(20);
    expect(keys.some((k) => k.includes('"kind":"shorter","raceDistM":5000'))).toBe(true);
    expect(keys.filter((k) => k.endsWith('base · decision')).length).toBeGreaterThan(20);
  },
  tzGenerationPick: (n) => /^(edgeHm|qa) /.test(n) || /^hmTrack · .* · (7|14)n · /.test(n),
  parts: { adaptation: 7, decisions: 1, timezone: 4 },
  fast: FAST
};
