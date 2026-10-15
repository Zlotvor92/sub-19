import { describe, expect, it } from 'vitest';
import {
  basisFromPlan,
  buildPreparationChoice,
  isLimitedLongPreparation,
  preparationDecision
} from '@/domain/plan/preparationDecision';
import { legacyApi, type GeneratorApi } from '@/test/fiveK/legacyApi';
import { loadOtherReference, otherRows } from '@/test/fiveK/otherReference';
import type { ReferenceRow } from '@/test/fiveK/reference';
import type { GenPlanState } from '../state';
import {
  FIVE_K_GENERATOR,
  LEGACY_GENERATOR,
  generatorForDistance,
  generatorForPlan,
  generatorIdFor
} from './select';

/* 10K, POLUMARATON I MARATON POSLE IZDVAJANJA 5K. Referenca je uzeta iz starog koda na polaznom commitu, u zasebnom
   worktree-ju (`src/test/fiveK/captureOtherReference.node.test.ts`). Pozivi idu kroz aplikacioni izbor generatora — isti
   put kao u produkciji. Odluka o pripremi uključuje opciju „kraća distanca: 5K", koju sada pravi izdvojeni 5K generator
   (`handoff.ts`); i njen rezultat mora biti identičan. */

const byInput = (input: unknown) =>
  generatorForDistance((input as { raceDistM?: unknown } | null)?.raceDistM);
const byPlan = (plan: unknown) => generatorForPlan(plan as GenPlanState);

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
  it('5K (i ulaz bez distance) ide izdvojenom generatoru, ostalo starom mehanizmu', () => {
    expect(generatorIdFor(5000)).toBe('5k');
    expect(generatorIdFor(undefined)).toBe('5k');
    expect(generatorIdFor(0)).toBe('5k');
    for (const d of [10000, 21097.5, 42195, 7000]) expect(generatorIdFor(d)).toBe('legacy');
    expect(generatorForPlan(null)).toBe(LEGACY_GENERATOR);
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 5000 } } as never)).toBe(
      FIVE_K_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 5000 } })).toBe(
      FIVE_K_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 21097.5 } } as never)).toBe(
      LEGACY_GENERATOR
    );
  });
});

describe('10K/HM/maraton nepromenjeni (polazni commit)', () => {
  it('referenca postoji', () => {
    expect(reference?.baselineSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
  });

  it('generisanje, adaptacija i odluke o pripremi su identični', { timeout: 900_000 }, () => {
    const now = otherRows(routed, {
      basisFromPlan,
      preparationDecision,
      buildPreparationChoice,
      isLimitedLongPreparation
    });
    const diff = [
      ...compare(now.generation, reference!.generation),
      ...compare(now.adaptation, reference!.adaptation),
      ...compare(now.decisions, reference!.decisions)
    ];
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(
      Object.keys(now.decisions).some((k) => k.includes('"kind":"shorter","raceDistM":5000'))
    ).toBe(true);
  });
});
