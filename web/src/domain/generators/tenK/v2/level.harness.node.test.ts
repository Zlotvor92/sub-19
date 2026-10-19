/* Brz i pun nivo mreža 10K v2 (src/test/level.ts, docs/testing/TEST-SPEED.md): tvrdnje nad brojkama celog skupa.

   Mreža se računa u `beforeAll` (ne u telu `describe`): vitest raspoređuje fajlove po zabeleženom trajanju, a ono
   ne uključuje fazu collect; uz to filter imena / `--bail` ne računa mrežu za describe čiji se testovi ne pokreću. */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { FULL } from '@/test/level';

/** Timeout `beforeAll` koji računa mrežu (hookTimeout je podrazumevano 10 s). */
export const GRID_TIMEOUT = 600_000;

/** Fajlovi delova 2…`count` punog nivoa (`<ime>.<k>.full.node.test.ts` pored glavnog) koji NE postoje — unija
    delova je ceo skup samo ako postoje svi. */
export const missingParts = (dir: string, name: string, count: number): string[] =>
  Array.from({ length: count - 1 }, (_, i) => `${name}.${i + 2}.full.node.test.ts`).filter(
    (f) => !existsSync(join(dir, f))
  );

/**
 * Brojke celog skupa (`full`) prema brojkama izračunatim nad `got`.
 * - Pun nivo: tačno jednako (današnja tvrdnja).
 * - Brz nivo (uzorak): ista struktura i kvalitativno isto — svaki broj je ceo, 0 ≤ broj ≤ broj celog skupa, 0 ostaje 0
 *   (bez nove kategorije). Uz `n` (broj elemenata uzorka / celog skupa; samo kad je svaka brojka broj ELEMENATA, npr.
 *   planova ili tokova, ne nedelja): nijedan broj nije veći od uzorka, a broj koji u celom skupu obuhvata sve elemente
 *   obuhvata sve i u uzorku. Ostale vrednosti (niske, logičke) jednake.
 */
export function expectCounts(got: unknown, full: unknown, n?: { got: number; full: number }): void {
  if (FULL) {
    expect(got).toEqual(full);
    return;
  }
  expect(countViolations(got, full, n, '')).toEqual([]);
}

/** Prekršaji pravila brzog nivoa iz `expectCounts` (prazno = u redu). */
export function countViolations(
  got: unknown,
  full: unknown,
  n: { got: number; full: number } | undefined,
  path: string
): string[] {
  if (typeof full === 'number') {
    const g = got ?? 0;
    const bad =
      typeof g !== 'number' ||
      !Number.isInteger(full) ||
      !Number.isInteger(g) ||
      g < 0 ||
      g > full ||
      (full === 0 && g !== 0) ||
      (n !== undefined && (g > n.got || (full === n.full && g !== n.got)));
    return bad ? [`${path || '·'}: uzorak ${String(got)}, ceo skup ${full}`] : [];
  }
  if (Array.isArray(full)) {
    const arr: unknown = got;
    if (!Array.isArray(arr) || arr.length !== full.length)
      return [`${path || '·'}: ${JSON.stringify(got)} ≠ oblik ${JSON.stringify(full)}`];
    return full.flatMap((f: unknown, i) => countViolations(arr[i], f, n, `${path}[${i}]`));
  }
  if (full !== null && typeof full === 'object') {
    if (got === undefined) got = {};
    if (got === null || typeof got !== 'object' || Array.isArray(got))
      return [`${path || '·'}: ${JSON.stringify(got)} nije objekat`];
    const f = full as Record<string, unknown>;
    const g = got as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(f), ...Object.keys(g)])];
    return keys.flatMap((k) => countViolations(g[k], f[k] ?? 0, n, path ? `${path}.${k}` : k));
  }
  return Object.is(got, full) ? [] : [`${path || '·'}: ${String(got)} ≠ ${String(full)}`];
}

/**
 * Tabela po broju dana (`table[i]` za `all[i]`), za izračunate dane `days` (deo punog nivoa ili svi u brzom). Pun nivo:
 * `days.map(get)` = deo tabele, tačno. Brz nivo: `expectCounts` po danu, uz `n(dan)` = broj planova uzorka / celog skupa
 * (samo za brojke planova).
 */
export function expectByDays<D extends number>(
  all: readonly D[],
  days: readonly D[],
  get: (n: D) => unknown,
  table: readonly unknown[],
  n?: (d: D) => { got: number; full: number }
): void {
  const want = days.map((d) => table[all.indexOf(d)]);
  if (FULL) {
    expect(days.map(get)).toEqual(want);
    return;
  }
  expect(days.flatMap((d, i) => countViolations(get(d), want[i], n?.(d), `${d} dana`))).toEqual([]);
}

/** Zbir vrednosti izabranih ključeva (deo tabele po scenariju / broju dana). */
export const sumOf = (t: Readonly<Record<string, number>>, keys: readonly string[]): number =>
  keys.reduce((a, k) => a + (t[k] ?? 0), 0);

/** Deo tabele: samo izabrani ključevi (redosled tabele). */
export function pick<T>(
  t: Readonly<Record<string, T>>,
  keys: readonly string[]
): Record<string, T> {
  return Object.fromEntries(Object.entries(t).filter(([k]) => keys.includes(k)));
}
