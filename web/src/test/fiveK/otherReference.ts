/* Referenca za 10K/HM/maraton, uzeta na polaznom commitu (pre izdvajanja 5K) — v. `captureOtherReference.node.test.ts`. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { CATEGORIES, digest } from './exact';
import type { GeneratorApi } from './legacyApi';
import {
  decisionFlows,
  otherAdaptationFlows,
  otherGenerationCases,
  type DecisionApi
} from './otherScenarios';
import type { ReferenceRow } from './reference';
import type { FlowResult } from './scenarios';

export const OTHER_REFERENCE_FILE = fileURLToPath(
  new URL('../fixtures/otherDistances-reference.json.gz', import.meta.url)
);

export interface OtherReferenceFile {
  baselineSha: string;
  generation: Record<string, ReferenceRow>;
  adaptation: Record<string, ReferenceRow>;
  decisions: Record<string, ReferenceRow>;
}

const short = (s: string): string => s.slice(0, 20);
function row(value: unknown, pure: boolean): ReferenceRow {
  const d = digest(value);
  return {
    full: short(d.full),
    parts: Object.fromEntries(CATEGORIES.map((c) => [c, short(d.parts[c])])),
    pure
  };
}
function rows(flows: FlowResult[]): Record<string, ReferenceRow> {
  const out: Record<string, ReferenceRow> = {};
  for (const f of flows) {
    if (out[f.name]) throw new Error(`dupli tok ${f.name}`);
    out[f.name] = row(f.value, f.pure);
  }
  return out;
}

export function otherRows(
  api: GeneratorApi,
  decisions: DecisionApi
): Omit<OtherReferenceFile, 'baselineSha'> {
  const generation: Record<string, ReferenceRow> = {};
  for (const c of otherGenerationCases()) {
    if (generation[c.name]) throw new Error(`dupli scenario ${c.name}`);
    let value: unknown;
    try {
      value = api.generatePlan(JSON.parse(JSON.stringify(c.input)) as never);
    } catch (e) {
      value = { thrown: e instanceof Error ? e.message : String(e) };
    }
    generation[c.name] = row(value, true);
  }
  return {
    generation,
    adaptation: rows(otherAdaptationFlows(api)),
    decisions: rows(decisionFlows(api, decisions))
  };
}

export function loadOtherReference(): OtherReferenceFile | null {
  if (!existsSync(OTHER_REFERENCE_FILE)) return null;
  return JSON.parse(
    gunzipSync(readFileSync(OTHER_REFERENCE_FILE)).toString('utf8')
  ) as OtherReferenceFile;
}

export function writeOtherReference(file: OtherReferenceFile): void {
  writeFileSync(OTHER_REFERENCE_FILE, gzipSync(JSON.stringify(file), { level: 9 }));
}
