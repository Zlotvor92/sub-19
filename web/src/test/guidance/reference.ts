/* Referenca zajedničke trenerske logike pre premeštanja u generatore: SHA tačnog zapisa (`fiveK/exact.ts`) po toku.
   Uzima se SAMO iz aplikacionog koda pre premeštanja; ne osvežava se iz koda generatora. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { referenceRow } from '@/test/fiveK/exact';
import type { ReferenceRow } from '@/test/fiveK/reference';
import type { FlowResult } from '@/test/fiveK/scenarios';

export const GUIDANCE_REFERENCE_FILE = fileURLToPath(
  new URL('../fixtures/guidance-reference.json.gz', import.meta.url)
);

export interface GuidanceReferenceFile {
  baselineSha: string;
  capturedWith: string;
  tz: string;
  flows: Record<string, ReferenceRow>;
  formPreview: Record<string, ReferenceRow>;
}

/** Redovi reference (`exact.ts` › `referenceRow`, isto što je ranije računato preko `digest`). `expected` (očekivani
    redovi, npr. `reference.flows`) samo štedi ponovni obilazak stabla kad je ukupni SHA isti; ishod poređenja je isti. */
export function rowsOf(
  flows: FlowResult[],
  expected?: Record<string, ReferenceRow>
): Record<string, ReferenceRow> {
  const out: Record<string, ReferenceRow> = {};
  for (const f of flows) {
    if (out[f.name]) throw new Error(`dupli tok ${f.name}`);
    out[f.name] = referenceRow(f.value, f.pure, expected?.[f.name]);
  }
  return out;
}

export function loadGuidanceReference(): GuidanceReferenceFile | null {
  if (!existsSync(GUIDANCE_REFERENCE_FILE)) return null;
  return JSON.parse(
    gunzipSync(readFileSync(GUIDANCE_REFERENCE_FILE)).toString('utf8')
  ) as GuidanceReferenceFile;
}

export function writeGuidanceReference(file: GuidanceReferenceFile): void {
  writeFileSync(GUIDANCE_REFERENCE_FILE, gzipSync(JSON.stringify(file), { level: 9 }));
}
