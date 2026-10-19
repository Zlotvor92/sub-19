/* Mreže planova 10K v2 (sa rezultatom, po osećaju, početnik) — zajednički računar za grid / feelGrid / beginnerGrid
   (glavni fajl i delovi punog nivoa `*.full.node.test.ts`). Isti redosled i iste provere po planu kao ranije petlje
   u telu `describe`; računa se samo zadat skup ulaza (uzorak brzog nivoa ili deo punog). */

import { generateTenKV2 } from './generate.ts';
import {
  checkPlan,
  type Days,
  emptyStats,
  type GridStats,
  type Row,
  summaryRow
} from './gridInvariants.ts';
import { fnv1a, type GridCase, planHash81 } from './testInputs.ts';
import type { GenerateResult, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { sample } from '@/test/level';

export interface PlanGrid {
  /** Izračunati ulazi (redosled mreže). */
  cases: GridCase[];
  rows: Record<string, Row>;
  /** fnv1a(JSON) rezultata po ulazu (redosled `cases`) — determinizam. */
  hashes: number[];
  h81: Record<string, number>;
  rejected: string[];
  errors: Record<string, number>;
  /** `<dana>:<pravilo upozorenja>` → broj planova. */
  warned: Record<string, number>;
  bad: Record<string, string[]>;
  stats: Record<Days, GridStats>;
}

/**
 * Deterministički uzorak brzog nivoa: unutar (broj dana × nedelje) svaki `k`-ti ulaz (prvi uvek) + imenovani (`keep`).
 * `k` uzajamno prost sa brojem kombinacija unutrašnjih osa (tempo × raspored × trka), da uzorak obiđe sve kombinacije.
 */
export const planGridSample = (
  cases: readonly GridCase[],
  k: number,
  keep: (c: GridCase) => boolean = () => false
): GridCase[] => sample(cases, k, (c) => `${c.days}/${c.weeks}`, keep);

/** Generisanje, validator, red bazne linije i nezavisne invarijante (gridInvariants.ts) za `cases`; `each` dodaje
    podatke testa po uspešnom planu. */
export function runPlanGrid(
  cases: GridCase[],
  each: (c: GridCase, plan: TenKV2Plan, r: GenerateResult) => void = () => {}
): PlanGrid {
  const g: PlanGrid = {
    cases,
    rows: {},
    hashes: [],
    h81: {},
    rejected: [],
    errors: {},
    warned: {},
    bad: {},
    stats: { 3: emptyStats(), 4: emptyStats(), 5: emptyStats(), 6: emptyStats() }
  };
  for (const c of cases) {
    const r = generateTenKV2(c.input);
    g.hashes.push(fnv1a(JSON.stringify(r)));
    g.h81[c.id] = planHash81(r);
    if (!r.ok) {
      g.rejected.push(`${c.id}: ${r.reasons.map((x) => x.code).join(',')}`);
      continue;
    }
    for (const v of validatePlan(r.plan))
      if (v.severity === 'error') g.errors[v.rule] = (g.errors[v.rule] ?? 0) + 1;
    for (const k of new Set(r.plan.warnings.map((w) => w.rule)))
      g.warned[`${c.days}:${k}`] = (g.warned[`${c.days}:${k}`] ?? 0) + 1;
    g.rows[c.id] = summaryRow(r.plan);
    checkPlan(c.id, c.days as Days, r.plan, g.bad, g.stats[c.days as Days]);
    each(c, r.plan, r);
  }
  return g;
}

/** Drugo generisanje istih ulaza (determinizam). */
export const hashesAgain = (cases: readonly GridCase[]): number[] =>
  cases.map(({ input }) => fnv1a(JSON.stringify(generateTenKV2(input))));

/** Prekršaji invarijanti: broj i prva 3 po invarijanti. */
export const summaryBad = (bad: Record<string, string[]>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(bad).map(([k, v]) => [k, `${v.length}: ${v.slice(0, 3).join(' | ')}`])
  );

/** Deo zapisa po ključu: samo ključevi iz `ids` (redosled zapisa). */
export function only<T>(
  rec: Readonly<Record<string, T>>,
  ids: ReadonlySet<string>
): Record<string, T> {
  return Object.fromEntries(Object.entries(rec).filter(([id]) => ids.has(id)));
}
