/* Referentni rezultati 5K: SHA tačnog zapisa (`exact.ts`) po scenariju i po kategoriji. Uzimaju se SAMO iz starog zajedničkog
   mehanizma (`legacyApi`) na polaznom commitu; fajl se ne osvežava iz novog 5K koda. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { CATEGORIES, digest, type Category } from './exact';
import type { GeneratorApi } from './legacyApi';
import { adaptationFlows, generationCases } from './scenarios';

export const REFERENCE_FILE = fileURLToPath(
  new URL('../fixtures/fiveK-reference.json.gz', import.meta.url)
);

export interface ReferenceRow {
  full: string;
  parts: Partial<Record<Category, string>>;
  pure: boolean;
}
export interface ReferenceFile {
  baselineSha: string;
  capturedWith: string;
  tz: string;
  generation: Record<string, ReferenceRow>;
  adaptation: Record<string, ReferenceRow>;
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

export function generationRows(
  api: GeneratorApi,
  pick: (name: string) => boolean = () => true
): Record<string, ReferenceRow> {
  const out: Record<string, ReferenceRow> = {};
  for (const c of generationCases().filter((x) => pick(x.name))) {
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

export function adaptationRows(
  api: GeneratorApi,
  limitBases?: number
): Record<string, ReferenceRow> {
  const out: Record<string, ReferenceRow> = {};
  for (const f of adaptationFlows(api, limitBases)) {
    if (out[f.name]) throw new Error(`dupli tok ${f.name}`);
    out[f.name] = row(f.value, f.pure);
  }
  return out;
}

export function loadReference(): ReferenceFile | null {
  if (!existsSync(REFERENCE_FILE)) return null;
  return JSON.parse(gunzipSync(readFileSync(REFERENCE_FILE)).toString('utf8')) as ReferenceFile;
}

export function writeReference(file: ReferenceFile): void {
  writeFileSync(REFERENCE_FILE, gzipSync(JSON.stringify(file), { level: 9 }));
}
