/* Brz i pun nivo mreža 10K v2 (src/test/level.ts, docs/testing/TEST-SPEED.md): tvrdnje nad brojkama celog skupa.

   Mreža se računa u `beforeAll` (ne u telu `describe`): vitest raspoređuje fajlove po zabeleženom trajanju, a ono
   ne uključuje fazu collect; uz to filter imena / `--bail` ne računa mrežu za describe čiji se testovi ne pokreću. */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { FULL } from '@/test/level';

/** Timeout `beforeAll` koji računa mrežu (hookTimeout je podrazumevano 10 s). */
export const GRID_TIMEOUT = 600_000;

/** Segment 06f (10k-v2.6.0, pouka 35): planovi generatora sa nedeljom pouke 35 na 7ba9717 (mreže 01, 02, F, B;
    segment06f.p35-plans-7ba9717.json) — jedini planovi generatora koji se menjaju. Starije regresije generatora ih
    izuzimaju; tačan skup promenjenih proverava p35.node.test.ts. */
export const P35_PLANS: ReadonlySet<string> = new Set(
  Object.keys(
    (
      JSON.parse(
        readFileSync(
          fileURLToPath(new URL('./segment06f.p35-plans-7ba9717.json', import.meta.url)),
          'utf8'
        )
      ) as { plans: Record<string, number[]> }
    ).plans
  )
);
/** Segment 06f: tokovi trajnih mreža adaptacije koje 10k-v2.6.0 menja (pouka 35) → heš na 7ba9717
    (segment06f.adapt-changed-7ba9717.json). Starije regresije adaptacije porede stanje 7ba9717 (`at7ba`); tačan
    skup proverava `expectP35Flows`. */
export const ADAPT_CHANGED_7BA = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('./segment06f.adapt-changed-7ba9717.json', import.meta.url)),
      'utf8'
    )
  ) as {
    against: string;
    flows: Record<'grid04' | 'early' | 'relief' | 'pain', Record<string, number>>;
  }
).flows;
/** Segment 06i (10k-v2.8.0, pouka 37): tokovi trajnih mreža adaptacije koje 10k-v2.8.0 menja → heš na 46e72eb
    (segment06i.adapt-changed-46e72eb.json) — svi sa mešovitom nedeljom pouke 37 (week.MIXED_NOTE). Starije regresije
    porede stanje 46e72eb (`at46e`, u lancu `at7ba`); tačan skup proverava `p37FlowErrors`. */
export const ADAPT_CHANGED_46E = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('./segment06i.adapt-changed-46e72eb.json', import.meta.url)),
      'utf8'
    )
  ) as {
    against: string;
    flows: Record<'grid04' | 'early' | 'relief' | 'pain' | 'start0', Record<string, number>>;
  }
).flows;
/** Segment 10K-07 (10k-v2.9.0): tokovi trajnih mreža adaptacije koje 10K-07 menja posle undo07 → [heš na c13c258,
    uzrok] (segment07.adapt-changed-c13c258.json). Starije regresije porede stanje c13c258 (`atC13`, u lancu
    `at46e`); tačan skup i uzrok proverava `p07FlowErrors`. */
export const ADAPT_CHANGED_07 = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('./segment07.adapt-changed-c13c258.json', import.meta.url)),
      'utf8'
    )
  ) as {
    against: string;
    flows: Partial<
      Record<'grid04' | 'early' | 'relief' | 'start0', Record<string, [number, string]>>
    >;
  }
).flows;
/** Heš toka u stanju c13c258: promenjen u 10K-07 → heš iz fixture-a, inače današnji. */
export const atC13 = (net: string, key: string, h: number): number =>
  (ADAPT_CHANGED_07 as Record<string, Record<string, [number, string]> | undefined>)[net]?.[
    key
  ]?.[0] ?? h;
/** 10K-07: tok mreže `net` je u fixture-u tačno kad se razlikuje od c13c258, sa uzrokom: oznaka mark07 (Z1, F3, O-1b,
    C7, C8, Z7) ili ranije odbijen tok (Z6/C3, heš 0 u mreži E / oznaka u fixture-u). Vraća prekršaje. */
export function p07FlowErrors(
  net: 'grid04' | 'early' | 'relief' | 'start0',
  flows: readonly { key: string; hash: number; m07: string }[]
): string[] {
  const fx = ADAPT_CHANGED_07[net] ?? {};
  const bad: string[] = [];
  for (const f of flows) {
    const e = fx[f.key];
    if (!e) continue;
    if (e[0] === f.hash) bad.push(`${f.key}: u fixture-u 10K-07, heš isti`);
    else if (e[1] !== 'Z6/C3' && !e[1].split('+').some((c) => f.m07.split('+').includes(c)))
      bad.push(`${f.key}: uzrok ${e[1]}, oznaka toka „${f.m07}"`);
  }
  return bad;
}
/** Heš toka u stanju 46e72eb: promenjen u 06i → heš iz fixture-a, inače stanje c13c258 (10K-07). */
export const at46e = (net: keyof typeof ADAPT_CHANGED_46E, key: string, h: number): number =>
  ADAPT_CHANGED_46E[net][key] ?? atC13(net, key, h);
/** Pouka 37 u adaptiranom rezultatu (napomena konstruktora, week.MIXED_NOTE). */
export const hasP37 = (r: unknown): boolean =>
  JSON.stringify(r).includes('Mešovita nedelja (pouka 37)');
/** 06i: tok mreže `net` se razlikuje od 46e72eb (u fixture-u, heš drugačiji) tačno kad ima mešovitu nedelju pouke 37.
    Vraća prekršaje. */
export function p37FlowErrors(
  net: keyof typeof ADAPT_CHANGED_46E,
  flows: readonly { key: string; hash: number; res: unknown }[]
): string[] {
  const bad: string[] = [];
  for (const f of flows) {
    const old = ADAPT_CHANGED_46E[net][f.key];
    if (old !== undefined && (old === f.hash || !hasP37(f.res)))
      bad.push(`${f.key}: u fixture-u 06i, ${old === f.hash ? 'heš isti' : 'bez pouke 37'}`);
    if (old === undefined && hasP37(f.res)) bad.push(`${f.key}: pouka 37, a nije u fixture-u 06i`);
  }
  return bad;
}
/** Heš toka u stanju 7ba9717 (za starije regresije): promenjen u 06f → heš iz fixture-a, inače stanje 46e72eb (06i). */
export const at7ba = (net: keyof typeof ADAPT_CHANGED_7BA, key: string, h: number): number =>
  ADAPT_CHANGED_7BA[net][key] ?? at46e(net, key, h);
/** 06f: tok mreže `net` se razlikuje od 7ba9717 (u fixture-u, heš drugačiji) tačno kad ima pouku 35 (nedelja
    pouke 35 u rezultatu ili bazni plan iz P35_PLANS). Vraća prekršaje. */
export function p35FlowErrors(
  net: keyof typeof ADAPT_CHANGED_7BA,
  flows: readonly { key: string; id: string; hash: number; res: unknown }[]
): string[] {
  const bad: string[] = [];
  for (const f of flows) {
    const old = ADAPT_CHANGED_7BA[net][f.key];
    const p35 = hasP35(f.res) || P35_PLANS.has(f.id);
    if (old !== undefined && (old === f.hash || !p35))
      bad.push(`${f.key}: u fixture-u, ${old === f.hash ? 'heš isti' : 'bez pouke 35'}`);
    if (old === undefined && hasP35(f.res)) bad.push(`${f.key}: pouka 35, a nije u fixture-u`);
  }
  return bad;
}
/** Pouka 35 u adaptiranom rezultatu (napomena konstruktora, week.ts) — tok sme da se razlikuje od starijih
    regresija adaptacije; bazni plan iz P35_PLANS takođe. */
export const hasP35 = (r: unknown): boolean => JSON.stringify(r).includes('Pouka 35:');

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
