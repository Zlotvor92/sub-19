/* Referentni rezultati 10K: SHA tačnog zapisa (`fiveK/exact.ts`) po scenariju i po kategoriji. Uzimaju se SAMO iz starog
   zajedničkog mehanizma (`legacyApi`) na polaznom stanju (pre izdvajanja 10K); fajl se ne osvežava iz novog 10K koda. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { referenceRow } from '@/test/fiveK/exact';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import type { ReferenceRow } from '@/test/fiveK/reference';
import type { GenerationCase } from '@/test/fiveK/scenarios';
import { tenKAdaptationFlows, tenKGenerationCases } from './scenarios';

export const TEN_K_REFERENCE_FILE = fileURLToPath(
  new URL('../fixtures/tenK-reference.json.gz', import.meta.url)
);

export interface TenKReferenceFile {
  /** Commit na kome je stari mehanizam bio izvor (5K grana pre izdvajanja 10K). */
  baselineSha: string;
  /** Commit na kome je ista referenca ponovo snimljena u čistom worktree-ju (izvorni `main`). */
  crossCheckedSha?: string;
  capturedWith: string;
  tz: string;
  generation: Record<string, ReferenceRow>;
  adaptation: Record<string, ReferenceRow>;
}

type Rows = Record<string, ReferenceRow>;
/** Red reference (`exact.ts` › `referenceRow`). `expected` (očekivani red istog imena) samo štedi ponovni obilazak
    stabla kad je ukupni SHA isti; ishod poređenja je isti. */
const row = (value: unknown, pure: boolean, expected?: ReferenceRow): ReferenceRow =>
  referenceRow(value, pure, expected);

export function tenKGenerationRows(
  api: GeneratorApi,
  pick: (name: string) => boolean = () => true,
  expected?: Rows
): Rows {
  const out: Record<string, ReferenceRow> = {};
  for (const c of tenKGenerationCases().filter((x) => pick(x.name))) {
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
    out[c.name] = row(value, true, expected?.[c.name]);
  }
  return out;
}

/** `select`: podskup baznih planova i da li idu i QA događaji (brz nivo i delovi punog nivoa, v. `./equivalence.ts`);
    bez njega — kao ranije (svi bazni planovi, događaji samo bez `limitBases`). */
export function tenKAdaptationRows(
  api: GeneratorApi,
  limitBases?: number,
  expected?: Rows,
  select?: { bases?: GenerationCase[]; events?: boolean }
): Rows {
  const out: Rows = {};
  for (const f of tenKAdaptationFlows(api, limitBases, select?.bases, select?.events)) {
    if (out[f.name]) throw new Error(`dupli tok ${f.name}`);
    out[f.name] = row(f.value, f.pure, expected?.[f.name]);
  }
  return out;
}

export function loadTenKReference(): TenKReferenceFile | null {
  if (!existsSync(TEN_K_REFERENCE_FILE)) return null;
  return JSON.parse(
    gunzipSync(readFileSync(TEN_K_REFERENCE_FILE)).toString('utf8')
  ) as TenKReferenceFile;
}

export function writeTenKReference(file: TenKReferenceFile): void {
  writeFileSync(TEN_K_REFERENCE_FILE, gzipSync(JSON.stringify(file), { level: 9 }));
}
