/* ZAMRZNUT PREVOD STAROG (v1) FORMATA PLANA ZA ORACLE TESTOVE (V1b).

   Oracle testovi (`*.oracle.test.ts`) prave ulaz zamrznutim generatorom APP_VERSION 282 (`legacyGenerator.ts`) i porede
   prikaz/stanje sa snimcima starog frontenda. Izlaz generatora u perzistirani plan je prevodio v1 generator distance
   (`adaptGeneratedPlan`), koji je V1b obrisao. Ovde je taj prevod zamrznut: za svaki izlaz koji oracle testovi daju
   snimljen je plan koji je v1 vratio (`fixtures/legacy-adapt.json.gz`, ključ = SHA-256 JSON-a izlaza), pa testovi vide
   bajt-isti plan starog formata — isti format kakav imaju stari planovi u bazi, koji se i dalje prikazuju.

   Snimak je napravljen JEDNOM, pre brisanja v1 (V1b), i ne pravi se ponovo: nepoznat izlaz je greška testa (ulaz
   oracle testa se promenio — snimci starog frontenda važe samo za iste ulaze). */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import type { GenPlanState } from '@/domain/state';

const FIXTURE = fileURLToPath(new URL('./fixtures/legacy-adapt.json.gz', import.meta.url));

export const legacyKey = (gen: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(gen) ?? 'undefined')
    .digest('hex');

let table: Record<string, GenPlanState | null> | null = null;
const load = (): Record<string, GenPlanState | null> =>
  (table ??= JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString('utf8')) as Record<
    string,
    GenPlanState | null
  >);

/** Izlaz zamrznutog generatora → plan starog formata, onakav kakav ga je vratio v1 (nova kopija pri svakom pozivu). */
export function adaptGeneratedPlan(gen: unknown): GenPlanState | null {
  const key = legacyKey(gen);
  const t = load();
  if (!(key in t))
    throw new Error(
      `legacyAdapt: nepoznat izlaz generatora (${key.slice(0, 12)}); snimci starog frontenda važe samo za iste ulaze`
    );
  const plan = t[key];
  return plan ? (JSON.parse(JSON.stringify(plan)) as GenPlanState) : null;
}
