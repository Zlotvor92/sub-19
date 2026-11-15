/// <reference types="node" />
/* ZAMRZNUTI PLANOVI STAROG (v1) FORMATA ZA TESTOVE PRIKAZA I STANJA (V1b).

   Neki testovi deljenog koda aplikacije (prikaz, stanje, lanac forme, uvoz) proveravaju ponašanje nad planom starog
   formata — onakvim kakav imaju planovi starih korisnika u bazi, koji se i dalje otvaraju. Takav plan je pravio v1
   generator distance, koji je V1b obrisao. Ovde su zamrznuti tačni izlazi v1 za ulaze tih testova
   (`fixtures/legacy-plans.json.gz`: `gen` = SHA-256 JSON-a ulaza → izlaz generatora, `adapt` = SHA-256 JSON-a izlaza →
   plan za upis), snimljeni JEDNOM pre brisanja v1 i nikad ponovo. Nepoznat ulaz je greška testa.

   Novi planovi u testovima idu kroz v2 (`./generators.ts`); ovaj modul je samo za stari format. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import type { GenPlanState } from '@/domain/state';

/* Putanja od korena `web/` (vitest se pokreće odatle): u jsdom okruženju `import.meta.url` nije `file:` adresa. */
const FIXTURE = resolve(process.cwd(), 'src/test/fixtures/legacy-plans.json.gz');

const key = (x: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(x) ?? 'undefined')
    .digest('hex');

type Table = { gen: Record<string, unknown>; adapt: Record<string, GenPlanState | null> };
let table: Table | null = null;
const load = (): Table =>
  (table ??= JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString('utf8')) as Table);

function lookup<T>(kind: keyof Table, x: unknown): T {
  const k = key(x);
  const t = load()[kind];
  if (!(k in t))
    throw new Error(
      `legacyPlans: nepoznat ${kind} (${k.slice(0, 12)}); zamrznuti su samo ulazi snimljeni pre V1b`
    );
  return JSON.parse(JSON.stringify(t[k])) as T;
}

/** Izlaz v1 generatora za ulaz (`{ error }` kad ga je v1 odbio). */
export const generatePlan = (input: unknown): { error: string } | Record<string, unknown> =>
  lookup('gen', input);

/** Izlaz v1 generatora → plan starog formata za upis (`null` za odbijanje). */
export const adaptGeneratedPlan = (gen: unknown): GenPlanState | null => lookup('adapt', gen);
