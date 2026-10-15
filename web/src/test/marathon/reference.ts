/* Referentni rezultati maratona: SHA tačnog zapisa (`fiveK/exact.ts`) po scenariju i po kategoriji. Uzimaju se SAMO iz
   starog zajedničkog mehanizma (`legacyApi` + `domain/plan/preparationDecision`) na polaznom stanju (pre izdvajanja maratona);
   fajl se ne osvežava iz novog maratonskog koda. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { CATEGORIES, digest } from '@/test/fiveK/exact';
import type { ReferenceRow } from '@/test/fiveK/reference';
import type { FlowResult } from '@/test/fiveK/scenarios';
import {
  marathonAdaptationFlows,
  marathonDecisionFlows,
  marathonGenerationCases,
  type MarathonApi
} from './scenarios';

export const MARATHON_REFERENCE_FILE = fileURLToPath(
  new URL('../fixtures/marathon-reference.json.gz', import.meta.url)
);

export interface MarathonReferenceFile {
  /** Commit na kome je stari mehanizam bio izvor (grana 5K+10K+HM, pre izdvajanja maratona). */
  baselineSha: string;
  /** Commit na kome je ista referenca ponovo snimljena u čistom worktree-ju (izvorni `main`). */
  crossCheckedSha?: string;
  capturedWith: string;
  tz: string;
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

export function marathonGenerationRows(
  api: Pick<MarathonApi, 'generatePlan'>,
  pick: (name: string) => boolean = () => true
): Record<string, ReferenceRow> {
  const out: Record<string, ReferenceRow> = {};
  for (const c of marathonGenerationCases().filter((x) => pick(x.name))) {
    const input = JSON.parse(JSON.stringify(c.input)) as Record<string, unknown>;
    // NaN se ne serijalizuje JSON-om; prenosi se ručno da granični ulaz ostane isti.
    for (const [k, v] of Object.entries(c.input)) if (Number.isNaN(v)) input[k] = v;
    let value: unknown;
    try {
      value = api.generatePlan(input as never);
    } catch (e) {
      value = { thrown: e instanceof Error ? e.message : String(e) };
    }
    if (out[c.name]) throw new Error(`dupli scenario ${c.name}`);
    out[c.name] = row(value, true);
  }
  return out;
}

export const marathonAdaptationRows = (
  api: MarathonApi,
  limitBases?: number
): Record<string, ReferenceRow> => rows(marathonAdaptationFlows(api, limitBases));

export const marathonDecisionRows = (api: MarathonApi): Record<string, ReferenceRow> =>
  rows(marathonDecisionFlows(api));

export function loadMarathonReference(): MarathonReferenceFile | null {
  if (!existsSync(MARATHON_REFERENCE_FILE)) return null;
  return JSON.parse(
    gunzipSync(readFileSync(MARATHON_REFERENCE_FILE)).toString('utf8')
  ) as MarathonReferenceFile;
}

export function writeMarathonReference(file: MarathonReferenceFile): void {
  writeFileSync(MARATHON_REFERENCE_FILE, gzipSync(JSON.stringify(file), { level: 9 }));
}
