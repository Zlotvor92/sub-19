/* MARATON PRE/POSLE IZDVAJANJA — podešavanje nivoa testa ekvivalencije (`halfMarathon/equivalenceKit.ts`).

   Deli ga glavni fajl `domain/generators/marathon/equivalence.node.test.ts` i delovi punog nivoa
   `equivalence.<deo>.full.node.test.ts`. Ugovor koji test poziva (`MarathonApi`) je isti kao ranije u glavnom fajlu:
   izdvojeni maratonski generator, a „kraća distanca" (polumaraton/10K) ide kroz aplikacioni `handoff.ts`.

   BRZ nivo (obrazloženje uzorka): v. `FAST` niže. */
import { expect } from 'vitest';
import { regeneratorForDistance } from '@/domain/generators/handoff';
import * as m from '@/domain/generators/marathon';
import type { EquivalenceSetup } from '@/test/halfMarathon/equivalenceKit';
import { adaptationFlows } from '@/test/fiveK/scenarios';
import { loadMarathonReference, marathonGenerationRows } from './reference';
import {
  marathonAdaptationBases,
  marathonDecisionBases,
  marathonDecisionFlows,
  marathonEventFlows,
  marathonGenerationCases,
  marathonTaperFlows,
  type MarathonApi
} from './scenarios';

const handoff = regeneratorForDistance;

export const marathonApi: MarathonApi = {
  generatePlan: m.generatePlan,
  assess: m.assess,
  adaptGeneratedPlan: m.adaptGeneratedPlan,
  resolvePlan: m.resolvePlan,
  executionModel: m.executionModel,
  buildExecutionAdjustment: ((...a: Parameters<typeof m.buildExecutionAdjustment>) =>
    m.buildExecutionAdjustment(a[0], a[1], a[2], a[3], a[4], handoff)) as never,
  buildRunWalkAdjustment: m.buildRunWalkAdjustment,
  assessRunWalkProgress: m.assessRunWalkProgress,
  qualityEntryGate: m.qualityEntryGate,
  hasRecentMeasuredForm: m.hasRecentMeasuredForm,
  planWithNewGoal: m.planWithNewGoal,
  planRecalibrated: m.planRecalibrated,
  recalibratedPlan: m.recalibratedPlan,
  reentryPlan: m.reentryPlan,
  graftFuturePlan: m.graftFuturePlan,
  alignAutomaticOverlays: m.alignAutomaticOverlays,
  vdotProposal: m.vdotProposal,
  applyVdotProposal: m.applyVdotProposal,
  undoVdotAdjustments: m.undoVdotAdjustments,
  fitnessEvidence: m.fitnessEvidence,
  planVdotNow: m.planVdotNow,
  matchPlanRows: m.matchPlanRows,
  sessKm: m.sessKm,
  sessDesc: m.sessDesc,
  t3kVdot: m.t3kVdot,
  executionBasis: m.executionBasis,
  basisFromPlan: m.basisFromPlan,
  preparationDecision: (...a: Parameters<typeof m.preparationDecision>) =>
    m.preparationDecision(a[0], a[1], a[2], a[3], a[4], a[5], handoff),
  buildPreparationChoice: (...a: Parameters<typeof m.buildPreparationChoice>) =>
    m.buildPreparationChoice(a[0], a[1], a[2], a[3], a[4], handoff),
  isLimitedLongPreparation: m.isLimitedLongPreparation
};

export const marathonReference = loadMarathonReference();

const api = marathonApi;

/** BRZ nivo:
 *  - generisanje: svaki 8. ulaz u kategorijama `fingerprint` / `mTrack` / `seededM`, SVI `edgeM` i `qa` (granice; jeftini);
 *  - adaptacija: bazni planovi `qa` / `seededM` / `mTrack` / `edgeM` — prvi u svakoj kategoriji i svaki 12. (jedan bazni
 *    plan = ceo skup tokova, ~360 redova, 0,2–9 s), plus imenovani rubni `početnik` (run/walk lestvica: run/walk tokove
 *    ima samo 6 od 70 baznih planova; ujedno 12. `edgeM`) i `povratak kratka priprema` (pauza + ograničena priprema →
 *    odluka o pripremi i predaja u izvršenju).
 *    Prvi `edgeM` je `trka za 3 ned · q2` (najkraća priprema). Događaji `event · …` uvek;
 *  - odluke: prvi i svaki 12. bazni plan po kategoriji (`qa` / `edgeM` / `seededM` / `mTrack`) + `povratak`;
 *  - vremenska zona: sve četiri zone; svaki 8. ulaz današnjeg izbora generisanja i jedan bazni plan adaptacije (6 ned.). */
const FAST: EquivalenceSetup['fast'] = {
  generationK: 8,
  generationKeep: (n) => /^(edgeM|qa) · /.test(n),
  adaptationK: 12,
  adaptationKeep: (n) => /^edgeM · (početnik|povratak kratka priprema)$/.test(n),
  decisionK: 12,
  decisionKeep: (n) => n === 'edgeM · povratak',
  tzGenerationK: 8,
  tzAdaptationBase: 'edgeM · trka za 6 ned · q2'
};

export const marathonSetup: EquivalenceSetup = {
  id: 'marathon',
  label: 'maratonskom generatoru',
  reference: {
    generation: marathonReference?.generation ?? {},
    adaptation: marathonReference?.adaptation ?? {},
    decisions: marathonReference?.decisions ?? {}
  },
  generationNames: () => marathonGenerationCases().map((c) => c.name),
  generationRows: (pick, expected) => marathonGenerationRows(api, pick, expected),
  adaptationBases: marathonAdaptationBases,
  adaptationFlows: (bases) => [
    ...adaptationFlows(api, undefined, bases),
    ...marathonTaperFlows(api, bases)
  ],
  eventFlows: () => marathonEventFlows(api),
  eventCount: 6,
  decisionBases: marathonDecisionBases,
  decisionFlows: (bases) => marathonDecisionFlows(api, bases),
  decisionCounts: (keys) => {
    expect(
      keys.filter((k) => k.includes('"kind":"shorter","raceDistM":21097.5')).length
    ).toBeGreaterThan(50);
    expect(
      keys.filter((k) => k.includes('"kind":"shorter","raceDistM":10000')).length
    ).toBeGreaterThan(20);
    expect(keys.some((k) => k.includes('"kind":"shorter","raceDistM":5000'))).toBe(false);
    expect(keys.filter((k) => k.endsWith('base · decision')).length).toBeGreaterThan(20);
  },
  tzGenerationPick: (n) => /^(edgeM|qa) /.test(n) || /^mTrack · .* · (8|14)n · /.test(n),
  parts: { adaptation: 9, decisions: 3, timezone: 4 },
  fast: FAST
};
