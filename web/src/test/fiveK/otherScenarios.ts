/* 10K, POLUMARATON, MARATON: dokaz da izdvajanje 5K nije promenilo ostale distance. Isti tokovi kao za 5K (`scenarios.ts`)
   plus odluka o ograničenoj pripremi (produženje, kraća distanca — uključujući predaju 5K generatoru —, povratni režim).
   Pozivi idu kroz APLIKACIONI izbor generatora kad postoji (`apiFor`), da bi se proverio i stvarni put. */
import { scenariji } from '@/test/generatorScenarios';
import {
  adaptationFlows,
  attempt,
  qaInputs,
  seededInputs,
  type FlowResult,
  type GenerationCase
} from './scenarios';
import type { GeneratorApi } from './legacyApi';

export const OTHER_DISTANCES = [10000, 21097.5, 42195] as const;

export interface DecisionApi {
  basisFromPlan: (current: never, today: never) => unknown;
  preparationDecision: (...a: never[]) => unknown;
  buildPreparationChoice: (...a: never[]) => unknown;
  isLimitedLongPreparation: (meta: never) => boolean;
}

export function otherGenerationCases(): GenerationCase[] {
  const out: GenerationCase[] = [];
  for (const dist of OTHER_DISTANCES) {
    out.push(
      ...scenariji()
        .filter((s) => s.inp['raceDistM'] === dist)
        .map((s) => ({ name: `fingerprint · ${s.ime}`, input: s.inp })),
      ...qaInputs(dist).map((c) => ({ ...c, name: `${c.name} · ${dist}` })),
      ...seededInputs(150, dist, 7000 + Math.round(dist))
    );
  }
  return out;
}

export function otherAdaptationBases(): GenerationCase[] {
  const out: GenerationCase[] = [];
  for (const dist of OTHER_DISTANCES) {
    out.push(...qaInputs(dist).map((c) => ({ ...c, name: `${c.name} · ${dist}` })));
    out.push(...seededInputs(150, dist, 7000 + Math.round(dist)).filter((_, i) => i % 19 === 0));
  }
  return out;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Odluka o pripremi nad ograničenim HM/M planovima (i svaka ponuđena opcija). */
export function decisionFlows(api: GeneratorApi, d: DecisionApi): FlowResult[] {
  const out: FlowResult[] = [];
  for (const base of otherAdaptationBases()) {
    const gen = api.generatePlan(clone(base.input) as never);
    if ('error' in gen) continue;
    const stored0 = api.adaptGeneratedPlan(gen);
    if (!stored0?.meta) continue;
    const stored = { ...stored0, ulaz: clone(base.input) };
    const meta = stored0.meta;
    const limited = d.isLimitedLongPreparation(meta as never);
    out.push({ name: `${base.name} · limited`, value: limited, pure: true });
    if (!limited) continue;
    const today = stored.weeks[1]?.start ?? meta.start;
    const basis = attempt(() => d.basisFromPlan(stored as never, today as never));
    out.push({ name: `${base.name} · basis`, value: basis, pure: true });
    if (!basis) continue;
    const decision = attempt(() =>
      d.preparationDecision(
        stored as never,
        today as never,
        basis as never,
        {} as never,
        'limited' as never,
        meta.preparation as never
      )
    ) as { options?: Array<{ choice: unknown }> };
    out.push({ name: `${base.name} · decision`, value: decision, pure: true });
    for (const option of decision.options ?? [])
      out.push({
        name: `${base.name} · choice ${JSON.stringify(option.choice)}`,
        value: attempt(() =>
          d.buildPreparationChoice(
            stored as never,
            today as never,
            basis as never,
            option.choice as never,
            {} as never
          )
        ),
        pure: true
      });
  }
  return out;
}

export function otherAdaptationFlows(api: GeneratorApi): FlowResult[] {
  return adaptationFlows(api, undefined, otherAdaptationBases());
}
