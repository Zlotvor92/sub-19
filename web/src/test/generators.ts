/* GENERATORI ZA TESTOVE (posle brisanja starog zajedničkog engine-a).

   Testovi koji su ulazne planove pravili starim `training/generator/generatePlan` + `plan/adapt` sada ih prave generatorom
   distance ulaza — istim putem kao aplikacija (`domain/generators/select.ts`). Za sve četiri distance izlaz je dokazano
   identičan starom engine-u (`domain/generators/<distanca>/equivalence.node.test.ts`, tačan zapis, bez izuzetih polja).
   Ulaz bez distance (ili sa 0) je 5K, kao u starom engine-u; distanca bez generatora daje grešku „Nepodržana distanca",
   kao što ju je davao i stari engine. */
import {
  generatorForDistance,
  generatorForPlan,
  preparationForPlan,
  type PlanGenerator,
  type PreparationApi
} from '@/domain/generators/select';
import type { GenPlanState } from '@/domain/state';
import * as fiveK from '@/domain/generators/fiveK';
import * as halfMarathon from '@/domain/generators/halfMarathon';
import { regeneratorForDistance } from '@/domain/generators/handoff';
import * as marathon from '@/domain/generators/marathon';
import * as tenK from '@/domain/generators/tenK';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import * as fiveKDistances from '@/domain/generators/fiveK/training/distances';
import * as tenKDistances from '@/domain/generators/tenK/training/distances';
import * as hmDistances from '@/domain/generators/halfMarathon/training/distances';
import * as marathonDistances from '@/domain/generators/marathon/training/distances';
import * as fiveKExecution from '@/domain/generators/fiveK/training/execution';
import * as fiveKFinalize from '@/domain/generators/fiveK/plan/finalize';
import * as fiveKPrediction from '@/domain/generators/fiveK/training/prediction';
import * as fiveKRunWalk from '@/domain/generators/fiveK/plan/runWalkAdjustment';
import * as hmExecution from '@/domain/generators/halfMarathon/training/execution';
import * as hmFinalize from '@/domain/generators/halfMarathon/plan/finalize';
import * as hmPrediction from '@/domain/generators/halfMarathon/training/prediction';
import * as hmRunWalk from '@/domain/generators/halfMarathon/plan/runWalkAdjustment';
import * as marathonExecution from '@/domain/generators/marathon/training/execution';
import * as marathonFinalize from '@/domain/generators/marathon/plan/finalize';
import * as marathonPrediction from '@/domain/generators/marathon/training/prediction';
import * as marathonRunWalk from '@/domain/generators/marathon/plan/runWalkAdjustment';
import * as tenKExecution from '@/domain/generators/tenK/training/execution';
import * as tenKFinalize from '@/domain/generators/tenK/plan/finalize';
import * as tenKPrediction from '@/domain/generators/tenK/training/prediction';
import * as tenKRunWalk from '@/domain/generators/tenK/plan/runWalkAdjustment';
import * as fiveKEvidence from '@/domain/generators/fiveK/training/adaptation/evidence';
import * as fiveKProposal from '@/domain/generators/fiveK/training/adaptation/proposal';
import * as hmEvidence from '@/domain/generators/halfMarathon/training/adaptation/evidence';
import * as hmProposal from '@/domain/generators/halfMarathon/training/adaptation/proposal';
import * as marathonEvidence from '@/domain/generators/marathon/training/adaptation/evidence';
import * as marathonProposal from '@/domain/generators/marathon/training/adaptation/proposal';
import * as tenKEvidence from '@/domain/generators/tenK/training/adaptation/evidence';
import * as tenKProposal from '@/domain/generators/tenK/training/adaptation/proposal';

const UNSUPPORTED =
  'Nepodržana distanca. Generator pravi planove za 5K, 10K, polumaraton i maraton.';

const byDistance = (raceDistM: unknown): PlanGenerator | null => generatorForDistance(raceDistM);

function byPlan(plan: unknown, what: string): PlanGenerator {
  const g = generatorForPlan(plan as GenPlanState);
  if (!g) throw new Error(`${what}: plan nema podržanu distancu`);
  return g;
}

/** Plan iz ulaza, generatorom ciljne distance. */
export const generatePlan: PlanGenerator['generatePlan'] = (input) => {
  const g = byDistance((input as { raceDistM?: unknown } | null | undefined)?.raceDistM);
  return g ? g.generatePlan(input) : { error: UNSUPPORTED };
};

/** Izlaz generatora → perzistirani plan, adapterom generatora te distance. */
export const adaptGeneratedPlan: PlanGenerator['adaptGeneratedPlan'] = (gen) => {
  const g = byDistance(
    (gen as { meta?: { raceDistM?: unknown } } | null | undefined)?.meta?.raceDistM
  );
  if (!g) throw new Error('adaptGeneratedPlan: plan nema podržanu distancu');
  return g.adaptGeneratedPlan(gen);
};

/** Procena forme za ciljnu distancu (poslednji argument). */
export const assess: PlanGenerator['assess'] = (...a) => {
  const g = byDistance(a[4]);
  if (!g) throw new Error('assess: nepodržana distanca');
  return g.assess(...a);
};

/** Generator plana (sačuvanog ili napravljenog u testu). */
export const generatorOf = (plan: unknown): PlanGenerator => byPlan(plan, 'generator');

/** Odluka o pripremi plana (samo polumaraton i maraton). */
export function preparationOf(plan: unknown): PreparationApi {
  const p = preparationForPlan(plan as GenPlanState);
  if (!p) throw new Error('odluka o pripremi postoji samo za polumaraton i maraton');
  return p;
}

/* ------------------------------------------------------------------ usmereni API (harnesi referenci) */

type Mod = typeof halfMarathon;
const MODS: Readonly<Record<number, Mod>> = {
  5000: fiveK as unknown as Mod,
  10000: tenK as unknown as Mod,
  21097.5: halfMarathon,
  42195: marathon as unknown as Mod
};
const handoff = regeneratorForDistance as halfMarathon.ShorterDistanceHandoff;
const distOf = (x: unknown): number | undefined => {
  const o = x as {
    meta?: { raceDistM?: unknown };
    ulaz?: { raceDistM?: unknown };
    raceDistM?: unknown;
  };
  const d = o?.meta?.raceDistM ?? o?.ulaz?.raceDistM ?? o?.raceDistM;
  return typeof d === 'number' ? d || 5000 : undefined;
};

/**
 * Isti oblik kao stari zajednički API, ali svaki poziv ide generatoru distance plana/ulaza o kome je reč. Funkcije bez
 * plana u argumentima (npr. `executionModel` nad razrešenim planom) idu generatoru plana koji je harnes poslednji
 * napravio ili adaptirao — harnesi obrađuju plan po plan, pa je to uvek plan iz istog toka.
 */
export function routedGeneratorApi(): GeneratorApi & { track: (planOrInput: unknown) => void } {
  let current: Mod = fiveK as unknown as Mod;
  const pick = (...xs: unknown[]): Mod => {
    for (const x of xs) {
      const d = distOf(x);
      if (d !== undefined) {
        const m = MODS[d];
        if (!m) throw new Error(`Nepodržana distanca ${d}`);
        current = m;
        return m;
      }
    }
    return current;
  };
  const call =
    <K extends keyof Mod>(k: K, ...planArgs: number[]) =>
    (...a: unknown[]): unknown =>
      (pick(...planArgs.map((i) => a[i]))[k] as (...x: unknown[]) => unknown)(...a);
  return {
    /** Ručno označava plan/ulaz toka (kad plan pravi pozivalac, npr. kroz `select.ts`). */
    track: (x: unknown) => {
      try {
        pick(x);
      } catch {
        /* nepodržana distanca: generator tog toka vraća grešku sam */
      }
    },
    generatePlan: (input: unknown) => {
      const d = distOf(input) ?? 5000;
      const m = MODS[d];
      if (!m) return { error: UNSUPPORTED };
      current = m;
      return m.generatePlan(input as never);
    },
    assess: ((...a: unknown[]) => {
      const m = MODS[(a[4] as number) || 5000];
      if (!m) throw new Error('assess: nepodržana distanca');
      return (m.assess as (...x: unknown[]) => unknown)(...a);
    }) as never,
    adaptGeneratedPlan: call('adaptGeneratedPlan', 0) as never,
    resolvePlan: call('resolvePlan') as never,
    executionModel: call('executionModel') as never,
    buildExecutionAdjustment: (...a: unknown[]) => {
      const m = pick(a[0]);
      return m.buildExecutionAdjustment(...(a as [never, never, never, never, never]), handoff);
    },
    buildRunWalkAdjustment: call('buildRunWalkAdjustment', 0) as never,
    assessRunWalkProgress: call('assessRunWalkProgress') as never,
    qualityEntryGate: call('qualityEntryGate') as never,
    hasRecentMeasuredForm: call('hasRecentMeasuredForm') as never,
    planWithNewGoal: call('planWithNewGoal', 0) as never,
    planRecalibrated: call('planRecalibrated', 0) as never,
    recalibratedPlan: call('recalibratedPlan', 0) as never,
    reentryPlan: call('reentryPlan', 0) as never,
    graftFuturePlan: call('graftFuturePlan', 1, 0) as never,
    alignAutomaticOverlays: call('alignAutomaticOverlays', 1, 0) as never,
    vdotProposal: call('vdotProposal', 0) as never,
    applyVdotProposal: call('applyVdotProposal', 4) as never,
    undoVdotAdjustments: call('undoVdotAdjustments', 2) as never,
    fitnessEvidence: call('fitnessEvidence', 0) as never,
    planVdotNow: call('planVdotNow', 0) as never,
    matchPlanRows: call('matchPlanRows') as never,
    sessKm: call('sessKm') as never,
    sessDesc: call('sessDesc') as never,
    t3kVdot: call('t3kVdot') as never
  };
}

/* ------------------------------------------------------------------ predlog tempa i dokaz forme po distanci plana */

type Proposal = typeof hmProposal & typeof hmEvidence;
const PROPOSALS: Readonly<Record<number, Proposal>> = {
  5000: { ...fiveKProposal, ...fiveKEvidence },
  10000: { ...tenKProposal, ...tenKEvidence },
  21097.5: { ...hmProposal, ...hmEvidence },
  42195: { ...marathonProposal, ...marathonEvidence }
};
function proposalFor(x: unknown): Proposal {
  const d = distOf(x) ?? 5000;
  const p = PROPOSALS[d];
  if (!p) throw new Error(`predlog tempa: nepodržana distanca ${d}`);
  return p;
}

/** Predlog tempa, dokaz forme i planska forma — funkcije generatora distance plana iz konteksta (`ctx.meta`). */
export const byPlanProposal = {
  planVdotNow: (ctx: Parameters<Proposal['planVdotNow']>[0]) => proposalFor(ctx).planVdotNow(ctx),
  formVsPlan: (ctx: Parameters<Proposal['formVsPlan']>[0]) => proposalFor(ctx).formVsPlan(ctx),
  vdotProposal: (ctx: Parameters<Proposal['vdotProposal']>[0]) =>
    proposalFor(ctx).vdotProposal(ctx),
  fitnessEvidence: (ctx: Parameters<Proposal['fitnessEvidence']>[0]) =>
    proposalFor(ctx).fitnessEvidence(ctx),
  applyVdotProposal: (...a: Parameters<Proposal['applyVdotProposal']>) =>
    proposalFor(a[4]).applyVdotProposal(...a),
  undoVdotAdjustments: (...a: Parameters<Proposal['undoVdotAdjustments']>) =>
    proposalFor(a[2]).undoVdotAdjustments(...a)
};

/* ------------------------------------------------------------------ usmereni engine (testovi prilagođavanja) */

type Engine = typeof halfMarathon &
  typeof hmExecution &
  typeof hmFinalize &
  typeof hmPrediction &
  typeof hmRunWalk;
const ENGINES: Readonly<Record<number, Engine>> = {
  5000: {
    ...fiveK,
    ...fiveKExecution,
    ...fiveKFinalize,
    ...fiveKPrediction,
    ...fiveKRunWalk
  } as unknown as Engine,
  10000: {
    ...tenK,
    ...tenKExecution,
    ...tenKFinalize,
    ...tenKPrediction,
    ...tenKRunWalk
  } as unknown as Engine,
  21097.5: { ...halfMarathon, ...hmExecution, ...hmFinalize, ...hmPrediction, ...hmRunWalk },
  42195: {
    ...marathon,
    ...marathonExecution,
    ...marathonFinalize,
    ...marathonPrediction,
    ...marathonRunWalk
  } as unknown as Engine
};

/**
 * Funkcije prilagođavanja kao u starom zajedničkom engine-u, ali svaka ide generatoru distance plana o kome je reč.
 * Funkcije koje plan ne dobijaju (npr. `isDemanding` nad danom, `analyzeExecution` nad razrešenim planom) idu generatoru
 * plana iz istog toka — poslednjeg plana/ulaza koji je prošao kroz ovaj engine. HM i maraton dobijaju predaju
 * „kraća distanca" kao u produkciji (`handoff.ts`).
 */
export function routedEngine(start = 5000) {
  let cur: Engine = ENGINES[start]!;
  const set = (...xs: unknown[]): Engine => {
    for (const x of xs) {
      const d = distOf(x);
      if (d !== undefined) {
        const e = ENGINES[d];
        if (!e) throw new Error(`Nepodržana distanca ${d}`);
        cur = e;
        return e;
      }
    }
    return cur;
  };
  const fn =
    <K extends keyof Engine>(k: K, ...planArgs: number[]) =>
    (...a: unknown[]): never =>
      (set(...planArgs.map((i) => a[i]))[k] as (...x: unknown[]) => never)(...a);
  const withHandoff =
    <K extends keyof Engine>(k: K, arity: number) =>
    (...a: unknown[]): never => {
      const e = set(a[0]);
      const args = [...a];
      while (args.length < arity) args.push(undefined);
      return (e[k] as (...x: unknown[]) => never)(...args.slice(0, arity), handoff);
    };
  return {
    /** Ručno označava plan toka (npr. plan iz QA događaja). */
    use: (planOrInput: unknown): void => void set(planOrInput),
    generatePlan: ((input: unknown) => {
      const d = distOf(input) ?? 5000;
      const e = ENGINES[d];
      if (!e) return { error: UNSUPPORTED };
      cur = e;
      return e.generatePlan(input as never);
    }) as PlanGenerator['generatePlan'],
    adaptGeneratedPlan: fn('adaptGeneratedPlan', 0) as PlanGenerator['adaptGeneratedPlan'],
    buildExecutionAdjustment: withHandoff(
      'buildExecutionAdjustment',
      5
    ) as PlanGenerator['buildExecutionAdjustment'],
    executionBasis: fn('executionBasis', 0) as PlanGenerator['executionBasis'],
    executionModel: fn('executionModel') as PlanGenerator['executionModel'],
    basisFromPlan: fn('basisFromPlan', 0) as PreparationApi['basisFromPlan'],
    preparationDecision: withHandoff('preparationDecision', 6) as (
      current: Parameters<PreparationApi['preparationDecision']>[0],
      today: Parameters<PreparationApi['preparationDecision']>[1],
      basis: Parameters<PreparationApi['preparationDecision']>[2],
      context: Parameters<PreparationApi['preparationDecision']>[3],
      status: Parameters<PreparationApi['preparationDecision']>[4],
      delivered?: Parameters<PreparationApi['preparationDecision']>[5]
    ) => ReturnType<PreparationApi['preparationDecision']>,
    buildPreparationChoice: withHandoff(
      'buildPreparationChoice',
      5
    ) as PreparationApi['buildPreparationChoice'],
    isLimitedLongPreparation: ((meta: unknown) =>
      set({ meta }).isLimitedLongPreparation(
        meta as never
      )) as PreparationApi['isLimitedLongPreparation'],
    graftFuturePlan: fn('graftFuturePlan', 1, 0) as PlanGenerator['graftFuturePlan'],
    alignAutomaticOverlays: fn(
      'alignAutomaticOverlays',
      1,
      0
    ) as PlanGenerator['alignAutomaticOverlays'],
    planWithNewGoal: fn('planWithNewGoal', 0) as PlanGenerator['planWithNewGoal'],
    planRecalibrated: fn('planRecalibrated', 0) as PlanGenerator['planRecalibrated'],
    recalibratedPlan: fn('recalibratedPlan', 0) as Engine['recalibratedPlan'],
    reentryPlan: fn('reentryPlan', 0) as Engine['reentryPlan'],
    mergeOverrides: fn('mergeOverrides') as Engine['mergeOverrides'],
    buildRunWalkAdjustment: fn(
      'buildRunWalkAdjustment',
      0
    ) as PlanGenerator['buildRunWalkAdjustment'],
    assessRunWalkProgress: fn('assessRunWalkProgress') as PlanGenerator['assessRunWalkProgress'],
    runWalkLadderFor: fn('runWalkLadderFor') as Engine['runWalkLadderFor'],
    deliveredWeeks: fn('deliveredWeeks', 0) as Engine['deliveredWeeks'],
    isDemanding: fn('isDemanding') as Engine['isDemanding'],
    analyzeExecution: fn('analyzeExecution') as Engine['analyzeExecution'],
    recommendExecution: fn('recommendExecution') as Engine['recommendExecution'],
    planVdotForWeek: fn('planVdotForWeek', 0) as Engine['planVdotForWeek'],
    predRow: fn('predRow') as Engine['predRow'],
    resolvePlan: fn('resolvePlan') as Engine['resolvePlan']
  };
}

/* PROFILI DISTANCI. Stari engine je imao jednu tabelu profila za sve distance; sada svaki generator poznaje samo svoj
   profil (`<generator>/training/distances`). Testovi koji prolaze kroz sve distance dobijaju profil iz generatora te
   distance. Tip je unija tipova četiri kopije. */
export type DistanceProfile =
  | NonNullable<ReturnType<typeof fiveKDistances.profileFor>>
  | NonNullable<ReturnType<typeof tenKDistances.profileFor>>
  | NonNullable<ReturnType<typeof hmDistances.profileFor>>
  | NonNullable<ReturnType<typeof marathonDistances.profileFor>>;

export const DISTANCE_PROFILES: Readonly<Record<string, DistanceProfile>> = {
  5000: fiveKDistances.profileFor(5000)!,
  10000: tenKDistances.profileFor(10000)!,
  21097.5: hmDistances.profileFor(21097.5)!,
  42195: marathonDistances.profileFor(42195)!
};

export function profileFor(raceDistM: number): DistanceProfile | undefined {
  return DISTANCE_PROFILES[String(raceDistM)];
}
