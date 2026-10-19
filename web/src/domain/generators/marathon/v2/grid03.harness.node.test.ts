/* Zajednički kod mreže 03 (MASTER § 3: po osećaju i početnik) — feelGrid*.node.test.ts i beginnerGrid*.node.test.ts;
   bez testova. K1, invarijante (grid.harness: nezavisno od validatora, uključujući M16/M17), determinizam, bazna
   linija; brojke K2–K6 u artifacts/segment-03/metrics.ts. */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeGrid, type GridRun } from './grid.harness.node.test.ts';
import { beginnerInputs, feelInputs, type GridInput } from './testInputs.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FEEL_PARTS = 3;
export const FEEL: readonly GridInput[] = feelInputs();
export const FEEL_BASELINE = join(HERE, 'segment03-feel.baseline.json');
export const BEGINNER: readonly GridInput[] = beginnerInputs();
export const BEGINNER_BASELINE = join(HERE, 'segment03-beginner.baseline.json');

export function describeFeel(
  title: string,
  inputs: readonly GridInput[],
  extra?: (run: GridRun) => void
): void {
  describeGrid(title, inputs, extra, FEEL_BASELINE, FEEL, false);
}

export function describeBeginner(
  title: string,
  inputs: readonly GridInput[],
  extra?: (run: GridRun) => void
): void {
  describeGrid(title, inputs, extra, BEGINNER_BASELINE, BEGINNER, false);
}
