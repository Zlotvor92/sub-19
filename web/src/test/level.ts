/* NIVO TESTOVA (docs/testing/TEST-SPEED.md).

   - BRZ (podrazumevano: `npm run test:fast`, `npm run check`, `npx vitest run …`): skupi testovi (ekvivalencija prema
     zamrznutim referencama, izolacija u izvršavanju, determinizam mreža) porede DETERMINISTIČKI UZORAK — svaki k-ti
     element unutar svake kategorije (prvi uvek, pa je svaka kategorija zastupljena) + svi imenovani rubni slučajevi.
     Tvrdnje su iste; poredi se manje redova. Isti uzorak pri svakom pokretanju (bez slučajnosti).
   - PUN (`TEST_FULL=1`: `npm test`, `npm run check:full`, CI): svi redovi svih referenci. Veliki `it` je podeljen na
     delove u fajlovima `*.full.node.test.ts` (uključeni samo u punom nivou, v. vitest.config.ts) da se paralelizuju;
     unija delova = ceo skup, bez preklapanja (`part`). */

import { appendFileSync } from 'node:fs';

export const FULL = process.env['TEST_FULL'] === '1';

/**
 * Deterministički uzorak brzog nivoa: unutar svake kategorije (`categoryOf`) svaki k-ti element počev od prvog, plus
 * elementi koje `keep` zadrži (imenovani rubni slučajevi). Redosled ulaza se čuva. U punom nivou (ili k ≤ 1) — sve.
 */
export function sample<T>(
  xs: readonly T[],
  k: number,
  categoryOf: (x: T) => string = () => '',
  keep: (x: T) => boolean = () => false
): T[] {
  if (FULL || k <= 1) return [...xs];
  const seen = new Map<string, number>();
  return xs.filter((x) => {
    const c = categoryOf(x);
    const i = seen.get(c) ?? 0;
    seen.set(c, i + 1);
    return i % k === 0 || keep(x);
  });
}

/** Isto kao `sample`, kao predikat po imenu (za postojeće `pick` parametre harnesa). */
export function samplePick(
  names: readonly string[],
  k: number,
  categoryOf: (name: string) => string = () => '',
  keep: (name: string) => boolean = () => false
): (name: string) => boolean {
  const picked = new Set(sample(names, k, categoryOf, keep));
  return (name) => picked.has(name);
}

/**
 * Deo `index` (1…`count`) punog skupa: elementi na pozicijama i sa i % count === index − 1. Delovi 1…count su
 * disjunktni i zajedno daju ceo niz — svaki element tačno jednom.
 */
export function part<T>(xs: readonly T[], index: number, count: number): T[] {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    !Number.isInteger(index) ||
    index < 1 ||
    index > count
  )
    throw new Error(`neispravan deo ${index}/${count}`);
  return xs.filter((_, i) => i % count === index - 1);
}

/**
 * Evidencija poređenih redova reference (docs/testing/TEST-SPEED.md, „redovi po referenci"): uz `TEST_ROWS_LOG=<fajl>`
 * svaki poziv dopisuje jedan JSON red `{ ref, full, names }` — `ref` imenuje deo reference (npr. `marathon.adaptation`),
 * `names` su imena redova koje je test uporedio. Bez promenljive ne radi ništa.
 */
export function logCompared(ref: string, names: Iterable<string>): void {
  const file = process.env['TEST_ROWS_LOG'];
  if (!file) return;
  appendFileSync(file, `${JSON.stringify({ ref, full: FULL, names: [...names] })}\n`);
}
