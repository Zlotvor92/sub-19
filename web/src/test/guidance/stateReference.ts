import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { ReferenceRow } from '@/test/fiveK/reference';

/* Referenca stanja trkača (bol, opterećenje, spremnost) iz aplikacionog koda pre prenosa u generatore. */
export const STATE_REFERENCE_FILE = fileURLToPath(
  new URL('../fixtures/state-reference.json.gz', import.meta.url)
);

export interface StateReferenceFile {
  baselineSha: string;
  tz: string;
  flows: Record<string, ReferenceRow>;
}

export function loadStateReference(): StateReferenceFile | null {
  if (!existsSync(STATE_REFERENCE_FILE)) return null;
  return JSON.parse(
    gunzipSync(readFileSync(STATE_REFERENCE_FILE)).toString('utf8')
  ) as StateReferenceFile;
}

export function writeStateReference(file: StateReferenceFile): void {
  writeFileSync(STATE_REFERENCE_FILE, gzipSync(JSON.stringify(file), { level: 9 }));
}
