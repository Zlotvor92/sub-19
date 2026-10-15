import { describe, expect, it } from 'vitest';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import { routedGeneratorApi } from '@/test/generators';
import { loadOtherReference, otherRows } from '@/test/fiveK/otherReference';
import type { ReferenceRow } from '@/test/fiveK/reference';
import type { GenPlanState } from '../state';
import {
  FIVE_K_GENERATOR,
  HALF_MARATHON_GENERATOR,
  HALF_MARATHON_PREPARATION,
  MARATHON_GENERATOR,
  MARATHON_PREPARATION,
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
   generatoru kroz `handoff.ts`. Od segmenta 4/5 i maratonski deo reference (generisanje, adaptacija, odluka o pripremi)
   proverava izdvojeni maratonski generator; referenca nije menjana. */

const must = <T>(value: T | null, what: string): T => {
  if (!value) throw new Error(`nema generatora za ${what}`);
  return value;
};
const byInput = (input: unknown) =>
  must(generatorForDistance((input as { raceDistM?: unknown } | null)?.raceDistM), 'ulaz');
const byPlan = (plan: unknown) => must(generatorForPlan(plan as GenPlanState), 'plan');
/* Odluka o pripremi postoji samo za HM i maraton; za 5K/10K store ne nudi odluku (`preparationForPlan` → `null`), što je
   ono što je stari mehanizam za njih uvek odlučivao (`isLimitedLongPreparation` = false). */
const prep = (plan: unknown) => must(preparationForPlan(plan as GenPlanState), 'odluku');

/** Odluka o pripremi ide kroz `preparationForPlan` (HM → HM generator, maraton → maratonski generator), kao u store-u. */
const routedDecisions = {
  basisFromPlan: ((current: unknown, today: unknown) =>
    prep(current).basisFromPlan(current as never, today as never)) as never,
  preparationDecision: ((current: unknown, ...rest: unknown[]) =>
    (prep(current).preparationDecision as (...x: unknown[]) => unknown)(current, ...rest)) as never,
  buildPreparationChoice: ((current: unknown, ...rest: unknown[]) =>
    (prep(current).buildPreparationChoice as (...x: unknown[]) => unknown)(
      current,
      ...rest
    )) as never,
  isLimitedLongPreparation: ((meta: { raceDistM?: unknown } | undefined) =>
    preparationForPlan({ weeks: [], pred: [], meta } as never)?.isLimitedLongPreparation(
      meta as never
    ) ?? false) as never
};

/** Ugovor generatora ide kroz `select.ts`; pomoćne funkcije harnesa (razrešavanje, obračun sesije, model izvršenja…)
    idu generatoru plana iz istog toka (`routedGeneratorApi`) — stari zajednički engine više ne postoji. */
const helpers = routedGeneratorApi();
const routed: GeneratorApi = {
  ...helpers,
  generatePlan: (input: unknown) => {
    helpers.track(input ?? { raceDistM: 5000 });
    return byInput(input).generatePlan(input as never);
  },
  assess: (...a: Parameters<GeneratorApi['assess']>) => byInput({ raceDistM: a[4] }).assess(...a),
  adaptGeneratedPlan: ((gen: { meta?: { raceDistM?: unknown } }) => {
    helpers.track(gen);
    return byInput(gen.meta).adaptGeneratedPlan(gen as never);
  }) as never,
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
  /* Segment 4/5: maraton je izdvojen, pa 42195 više ne ide starom mehanizmu (pravilo izbora, ne trenerski rezultat). */
  /* Segment 5/5: stari mehanizam više nije rezerva. Distanca bez generatora daje `null` (aplikacija to prikazuje), nema
     plana → `null`; 5K/10K nemaju odluku o pripremi (`null`). */
  it('5K (i ulaz bez distance), 10K, HM i maraton idu izdvojenim generatorima; ostalo nema generator', () => {
    expect(generatorIdFor(5000)).toBe('5k');
    expect(generatorIdFor(undefined)).toBe('5k');
    expect(generatorIdFor(0)).toBe('5k');
    expect(generatorIdFor(10000)).toBe('10k');
    expect(generatorIdFor(21097.5)).toBe('hm');
    expect(generatorIdFor(42195)).toBe('marathon');
    for (const d of [7000, 10000.5, 21097, 21098, 42194, 42195.5])
      expect(generatorIdFor(d)).toBeNull();
    for (const d of [7000, 21097, 42194]) {
      expect(generatorForDistance(d)).toBeNull();
      expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: d } } as never)).toBeNull();
    }
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 10000 } } as never)).toBe(
      TEN_K_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 10000 } })).toBe(
      TEN_K_GENERATOR
    );
    expect(generatorForPlan(null)).toBeNull();
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
      MARATHON_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 42195 } })).toBe(
      MARATHON_GENERATOR
    );
    // Odluka o pripremi: HM plan → HM generator, maraton → maratonski; 5K/10K je nemaju (null).
    expect(preparationForPlan({ weeks: [], pred: [], meta: { raceDistM: 21097.5 } } as never)).toBe(
      HALF_MARATHON_PREPARATION
    );
    expect(preparationForPlan({ weeks: [], pred: [], meta: { raceDistM: 42195 } } as never)).toBe(
      MARATHON_PREPARATION
    );
    for (const raceDistM of [10000, 5000])
      expect(preparationForPlan({ weeks: [], pred: [], meta: { raceDistM } } as never)).toBeNull();
    expect(preparationForPlan(null)).toBeNull();
  });
});

describe('10K/HM/maraton nepromenjeni (polazni commit; kroz izdvojene generatore)', () => {
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
