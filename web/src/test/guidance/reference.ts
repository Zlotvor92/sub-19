/* Referenca zajedničke trenerske logike pre premeštanja u generatore: SHA tačnog zapisa (`fiveK/exact.ts`) po toku.
   Uzima se SAMO iz aplikacionog koda pre premeštanja; ne osvežava se iz koda generatora. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { CATEGORIES, digest } from '@/test/fiveK/exact';
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

const short = (s: string): string => s.slice(0, 20);

export function rowsOf(flows: FlowResult[]): Record<string, ReferenceRow> {
  const out: Record<string, ReferenceRow> = {};
  for (const f of flows) {
    if (out[f.name]) throw new Error(`dupli tok ${f.name}`);
    const d = digest(f.value);
    out[f.name] = {
      full: short(d.full),
      parts: Object.fromEntries(CATEGORIES.map((c) => [c, short(d.parts[c])])),
      pure: f.pure
    };
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
