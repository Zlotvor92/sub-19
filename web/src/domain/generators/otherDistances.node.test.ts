import { describe, expect, it } from 'vitest';
import { legacyApi, type GeneratorApi } from '@/test/fiveK/legacyApi';
import { loadOtherReference, otherRows } from '@/test/fiveK/otherReference';
import type { ReferenceRow } from '@/test/fiveK/reference';
import type { GenPlanState } from '../state';
import {
  FIVE_K_GENERATOR,
  HALF_MARATHON_GENERATOR,
  HALF_MARATHON_PREPARATION,
  LEGACY_GENERATOR,
  LEGACY_PREPARATION,
  TEN_K_GENERATOR,
  generatorForDistance,
  generatorForPlan,
  generatorIdFor,
  preparationForPlan
} from './select';

/* 10K, POLUMARATON I MARATON POSLE IZDVAJANJA 5K. Referenca je uzeta iz starog koda na polaznom commitu, u zasebnom
   worktree-ju (`src/test/fiveK/captureOtherReference.node.test.ts`). Pozivi idu kroz aplikacioni izbor generatora — isti
   put kao u produkciji, pa 10K deo reference od segmenta 2/5 proverava izdvojeni 10K generator. Odluka o pripremi uključuje
   opcije „kraća distanca: 5K" i „kraća distanca: 10K", koje sada prave izdvojeni 5K i 10K generator (`handoff.ts`); i
   njihov rezultat mora biti identičan. Od segmenta 3/5 HM deo reference (generisanje, adaptacija i odluka o pripremi —
   `preparationForPlan`) proverava izdvojeni HM generator, a maratonska opcija „kraća distanca: polumaraton" ide HM
   generatoru kroz `handoff.ts`. */

const byInput = (input: unknown) =>
  generatorForDistance((input as { raceDistM?: unknown } | null)?.raceDistM);
const byPlan = (plan: unknown) => generatorForPlan(plan as GenPlanState);

/** Odluka o pripremi ide kroz `preparationForPlan` (HM → HM generator, maraton → stari mehanizam), kao u store-u. */
const routedDecisions = {
  basisFromPlan: ((current: unknown, today: unknown) =>
    preparationForPlan(current as GenPlanState).basisFromPlan(
      current as never,
      today as never
    )) as never,
  preparationDecision: ((current: unknown, ...rest: unknown[]) =>
    (
      preparationForPlan(current as GenPlanState).preparationDecision as (
        ...x: unknown[]
      ) => unknown
    )(current, ...rest)) as never,
  buildPreparationChoice: ((current: unknown, ...rest: unknown[]) =>
    (
      preparationForPlan(current as GenPlanState).buildPreparationChoice as (
        ...x: unknown[]
      ) => unknown
    )(current, ...rest)) as never,
  isLimitedLongPreparation: ((meta: { raceDistM?: unknown } | undefined) =>
    preparationForPlan({ weeks: [], pred: [], meta } as never).isLimitedLongPreparation(
      meta as never
    )) as never
};

/** Svaki poziv ide kroz `select.ts`; pomoćne funkcije harnesa koje nisu ugovor generatora ostaju stare. */
const routed: GeneratorApi = {
  ...legacyApi,
  generatePlan: (input: unknown) => byInput(input).generatePlan(input as never),
  assess: (...a: Parameters<GeneratorApi['assess']>) => generatorForDistance(a[4]).assess(...a),
  adaptGeneratedPlan: ((gen: { meta?: { raceDistM?: unknown } }) =>
    generatorForDistance(gen.meta?.raceDistM).adaptGeneratedPlan(gen as never)) as never,
  executionModel: legacyApi.executionModel,
  buildExecutionAdjustment: ((current: unknown, ...rest: unknown[]) =>
    (byPlan(current).buildExecutionAdjustment as (...x: unknown[]) => unknown)(
      current,
      ...rest
    )) as never,
  buildRunWalkAdjustment: ((current: unknown, ...rest: unknown[]) =>
    (byPlan(current).buildRunWalkAdjustment as (...x: unknown[]) => unknown)(
      current,
      ...rest
    )) as never,
  planWithNewGoal: ((current: unknown, ...rest: unknown[]) =>
    (byPlan(current).planWithNewGoal as (...x: unknown[]) => unknown)(current, ...rest)) as never,
  planRecalibrated: ((current: unknown, ...rest: unknown[]) =>
    (byPlan(current).planRecalibrated as (...x: unknown[]) => unknown)(current, ...rest)) as never,
  graftFuturePlan: ((current: unknown, fresh: unknown, ...rest: unknown[]) =>
    (byPlan(fresh).graftFuturePlan as (...x: unknown[]) => unknown)(
      current,
      fresh,
      ...rest
    )) as never,
  alignAutomaticOverlays: ((current: unknown, result: unknown, ...rest: unknown[]) =>
    (byPlan(result).alignAutomaticOverlays as (...x: unknown[]) => unknown)(
      current,
      result,
      ...rest
    )) as never
};

function compare(
  actual: Record<string, ReferenceRow>,
  expected: Record<string, ReferenceRow>
): string[] {
  const out: string[] = [];
  for (const [name, ref] of Object.entries(expected)) {
    const got = actual[name];
    if (!got) out.push(`NEDOSTAJE: ${name}`);
    else if (got.full !== ref.full || got.pure !== ref.pure) {
      const parts = Object.keys(ref.parts).filter(
        (k) => got.parts[k as keyof typeof got.parts] !== ref.parts[k as keyof typeof ref.parts]
      );
      out.push(`${name}: razlika u [${parts.join(', ')}]`);
    }
  }
  for (const name of Object.keys(actual)) if (!expected[name]) out.push(`NOVO: ${name}`);
  return out;
}

const reference = loadOtherReference();

describe('izbor generatora', () => {
  /* Segment 2/5: 10K je izdvojen, pa 10000 više ne ide starom mehanizmu (ranije očekivanje 'legacy' je bilo pravilo
     izbora iz segmenta 1, ne trenerski rezultat). */
  /* Segment 3/5: polumaraton je izdvojen, pa 21097.5 više ne ide starom mehanizmu (pravilo izbora, ne trenerski rezultat). */
  it('5K (i ulaz bez distance), 10K i HM idu izdvojenim generatorima, ostalo starom mehanizmu', () => {
    expect(generatorIdFor(5000)).toBe('5k');
    expect(generatorIdFor(undefined)).toBe('5k');
    expect(generatorIdFor(0)).toBe('5k');
    expect(generatorIdFor(10000)).toBe('10k');
    expect(generatorIdFor(21097.5)).toBe('hm');
    for (const d of [42195, 7000, 10000.5, 21097, 21098]) expect(generatorIdFor(d)).toBe('legacy');
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 10000 } } as never)).toBe(
      TEN_K_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 10000 } })).toBe(
      TEN_K_GENERATOR
    );
    expect(generatorForPlan(null)).toBe(LEGACY_GENERATOR);
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 5000 } } as never)).toBe(
      FIVE_K_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 5000 } })).toBe(
      FIVE_K_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 21097.5 } } as never)).toBe(
      HALF_MARATHON_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 21097.5 } })).toBe(
      HALF_MARATHON_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 42195 } } as never)).toBe(
      LEGACY_GENERATOR
    );
    // Odluka o pripremi: HM plan → HM generator; maraton, 5K/10K i lični plan → stari mehanizam (kao pre).
    expect(preparationForPlan({ weeks: [], pred: [], meta: { raceDistM: 21097.5 } } as never)).toBe(
      HALF_MARATHON_PREPARATION
    );
    for (const raceDistM of [42195, 10000, 5000])
      expect(preparationForPlan({ weeks: [], pred: [], meta: { raceDistM } } as never)).toBe(
        LEGACY_PREPARATION
      );
    expect(preparationForPlan(null)).toBe(LEGACY_PREPARATION);
  });
});

describe('10K/HM/maraton nepromenjeni (polazni commit; 10K kroz izdvojeni generator)', () => {
  it('referenca postoji', () => {
    expect(reference?.baselineSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
  });

  it('generisanje, adaptacija i odluke o pripremi su identični', { timeout: 900_000 }, () => {
    const now = otherRows(routed, routedDecisions);
    const diff = [
      ...compare(now.generation, reference!.generation),
      ...compare(now.adaptation, reference!.adaptation),
      ...compare(now.decisions, reference!.decisions)
    ];
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(
      Object.keys(now.decisions).some((k) => k.includes('"kind":"shorter","raceDistM":5000'))
    ).toBe(true);
    // Predaja „kraća distanca: 10K" iz HM/maratona ide izdvojenom 10K generatoru (`handoff.ts`).
    expect(
      Object.keys(now.decisions).filter((k) => k.includes('"kind":"shorter","raceDistM":10000'))
        .length
    ).toBeGreaterThan(10);
    // Maratonska opcija „kraća distanca: polumaraton" ide izdvojenom HM generatoru (`handoff.ts`).
    expect(
      Object.keys(now.decisions).filter((k) => k.includes('"kind":"shorter","raceDistM":21097.5'))
        .length
    ).toBeGreaterThan(0);
  });
});
