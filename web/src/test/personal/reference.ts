/* Referenca ugrađenog ličnog plana: SHA tačnog zapisa (`fiveK/exact.ts`) po toku i kategoriji. Uzima se SAMO iz starog
   zajedničkog mehanizma (`legacyApi`) pre nego što segment 5 prebaci lični plan na HM generator; ne osvežava se iz novog
   koda. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { CATEGORIES, digest } from '@/test/fiveK/exact';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import type { ReferenceRow } from '@/test/fiveK/reference';
import { personalFlows } from './scenarios';

export const PERSONAL_REFERENCE_FILE = fileURLToPath(
  new URL('../fixtures/personal-reference.json.gz', import.meta.url)
);

export interface PersonalReferenceFile {
  baselineSha: string;
  crossCheckedSha?: string;
  capturedWith: string;
  tz: string;
  flows: Record<string, ReferenceRow>;
}

const short = (s: string): string => s.slice(0, 20);

export function personalRows(
  api: GeneratorApi,
  limitTodays?: number
): Record<string, ReferenceRow> {
  const out: Record<string, ReferenceRow> = {};
  for (const f of personalFlows(api, limitTodays)) {
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

export function loadPersonalReference(): PersonalReferenceFile | null {
  if (!existsSync(PERSONAL_REFERENCE_FILE)) return null;
  return JSON.parse(
    gunzipSync(readFileSync(PERSONAL_REFERENCE_FILE)).toString('utf8')
  ) as PersonalReferenceFile;
}

export function writePersonalReference(file: PersonalReferenceFile): void {
  writeFileSync(PERSONAL_REFERENCE_FILE, gzipSync(JSON.stringify(file), { level: 9 }));
}
