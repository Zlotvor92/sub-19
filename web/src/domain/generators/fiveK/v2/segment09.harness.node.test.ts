/* 5K-09 (5k-v2.11.0), 5K-10 (5k-v2.12.0) — regresija (zajednički kod; bez testova). Otisci segment10.<mreža>-b9c4728.json (5K-10;
   ranije segment09.<mreža>-c13c258.json)
   pravi docs/generators-v2/audit/fixes/5K/fixture10.ts (polazni kod b9c4728 i tekući, ista mreža). Kanon
   (testInputs.canon09) ne poredi korisnički tekst (Z2 ga menja u svakom planu), oznaku verzije ni peakKm (owner K;
   vrednost proverava segment09.node.test.ts). Tok van spiska `changed` je bajt-isti u kanonu; tok na spisku je
   promenjen i nosi razlog (testInputs.Why09) sa oznakom na tekućem rezultatu (testInputs.mark09) — CH: prvi korak
   lanca je na spisku. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canon09, mark09, type Why09 } from './testInputs.ts';

export interface Ref09 {
  against: string;
  canon: string;
  count: number;
  hashes?: Record<string, string>;
  plans?: Record<string, string>;
  changed: Record<string, { h: string; why: Why09 }>;
}

/** 5K-10 (krug T, 5k-v2.12.0): otisci prema b9c4728 (segment10.<mreža>-b9c4728.json, fixes/5K/fixture10.ts) zamenjuju
    otiske prema c13c258; razlozi promene Why09 T1/T2/T4/T5/C3/C5/C11 (testInputs.mark10). */
export const ref09 = (net: 'g07' | 'n08d' | 'e08e' | 'x08g'): Ref09 =>
  JSON.parse(
    readFileSync(new URL(`./segment10.${net}-b9c4728.json`, import.meta.url), 'utf8')
  ) as Ref09;

export const hash09 = (r: unknown): string =>
  createHash('sha256').update(canon09(r)).digest('hex').slice(0, 16);

/** Zbir nepromenjenih tokova grupe: sha256 sortiranog spiska „ključ:heš" (kao fixture09.ts). */
export const digest09 = (xs: readonly string[]): string =>
  createHash('sha256')
    .update([...xs].sort().join('\n'))
    .digest('hex')
    .slice(0, 16);

/** Provera promenjenog toka; prazno = u redu. */
function changedOk(ref: Ref09, key: string, got: string, res: unknown): string[] {
  const ch = ref.changed[key]!;
  const bad: string[] = [];
  if (ch.h === got) bad.push(`${key}: na spisku promenjenih (${ch.why}), a bajt-isti`);
  if (ch.why === 'CH') {
    if (!ref.changed[key.replace(/\/(\+\d+|chain)$/, '')])
      bad.push(`${key}: CH bez promene prvog koraka`);
  } else if (!mark09(ch.why, res)) bad.push(`${key}: ${ch.why} bez oznake na rezultatu`);
  return bad;
}

/** Tokovi sa otiskom po toku (`hashes`): vraća prekršaje. */
export function regress09(ref: Ref09, flows: readonly { key: string; res: unknown }[]): string[] {
  const bad: string[] = [];
  for (const f of flows) {
    const was = ref.hashes![f.key];
    if (was === undefined) {
      bad.push(`${f.key}: nema u otisku`);
      continue;
    }
    const got = hash09(f.res);
    if (ref.changed[f.key]) bad.push(...changedOk(ref, f.key, got, f.res));
    else if (got !== was) bad.push(`${f.key}: promenjen bez razloga segmenta 09`);
  }
  return bad;
}

/** Tokovi jedne grupe sa zbirom nepromenjenih (`plans`, mreža 08g): vraća prekršaje. */
export function regressGroup09(
  ref: Ref09,
  group: string,
  flows: readonly { key: string; res: unknown }[]
): string[] {
  const bad: string[] = [];
  const same: string[] = [];
  for (const f of flows) {
    const got = hash09(f.res);
    if (ref.changed[f.key]) bad.push(...changedOk(ref, f.key, got, f.res));
    else same.push(`${f.key}:${got}`);
  }
  if (ref.plans![group] === undefined) bad.push(`${group}: nema u otisku`);
  else if (digest09(same) !== ref.plans![group])
    bad.push(`${group}: nepromenjeni tokovi nisu bajt-isti prema b9c4728`);
  return bad;
}
