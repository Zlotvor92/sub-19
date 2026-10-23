/* TAČAN ZAPIS za poređenje 5K pre/posle izdvajanja.

   Ništa se ne zaokružuje i nijedno polje se ne izostavlja: redosled ključeva je redosled umetanja (od njega zavise
   `JSON.stringify` poređenja u samom kodu, npr. broj promenjenih dana), `undefined` vrednost ključa se beleži, a -0, NaN i
   ±Infinity imaju sopstveni zapis. Kategorije služe samo da pad pokaže GDE se razlikuje; svaki list ide u tačno jednu. */
import { createHash } from 'node:crypto';

export function exact(x: unknown): string {
  if (x === undefined) return '~u';
  if (x === null) return 'null';
  if (typeof x === 'number') {
    if (Object.is(x, -0)) return '-0';
    return Number.isFinite(x) ? JSON.stringify(x) : `~${String(x)}`;
  }
  if (typeof x === 'string' || typeof x === 'boolean') return JSON.stringify(x);
  if (Array.isArray(x)) return `[${x.map(exact).join(',')}]`;
  if (x instanceof Map)
    return `~map[${[...x].map(([k, v]) => `${exact(k)}:${exact(v)}`).join(',')}]`;
  if (x instanceof Set) return `~set[${[...x].map(exact).join(',')}]`;
  if (typeof x === 'object')
    return `{${Object.keys(x)
      .map((k) => `${JSON.stringify(k)}:${exact((x as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return `~${typeof x}`;
}

export const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

export type Category =
  | 'schedule'
  | 'dates'
  | 'km'
  | 'segments'
  | 'pace'
  | 'rest'
  | 'taper'
  | 'warnings'
  | 'adaptation'
  | 'other';

export const CATEGORIES: readonly Category[] = [
  'schedule',
  'dates',
  'km',
  'segments',
  'pace',
  'rest',
  'taper',
  'warnings',
  'adaptation',
  'other'
];

/** Kategorija lista po imenu ključa (poslednji segment putanje koji nije indeks). */
function categoryOf(path: readonly string[]): Category {
  const key = [...path].reverse().find((p) => !/^\d+$/.test(p)) ?? '';
  const inside = (name: string): boolean => path.includes(name);
  if (inside('dayWarnings') || inside('reasons') || inside('notes') || inside('conflicts'))
    return 'warnings';
  if (/^(desc|summary|title|message|statement|reason|error|label|focus)$/.test(key))
    return key === 'focus' ? 'taper' : 'warnings';
  if (
    inside('futureChanges') ||
    inside('finalization') ||
    inside('executionAdjustment') ||
    inside('fatigueRecovery') ||
    inside('goalChange') ||
    inside('recalibration') ||
    inside('cycleDecision') ||
    inside('analysis') ||
    inside('recommendation') ||
    inside('changes') ||
    inside('alts')
  )
    return 'adaptation';
  if (/(pace|Pace|^pt$|^p5k$|^pg$|vdot|Vdot|^zone$)/.test(key)) return 'pace';
  if (/^(restSec|rest|recSec|recovery|restM)$/.test(key)) return 'rest';
  if (/^(taper|deload)$/.test(key)) return 'taper';
  if (/(date|Date|^start$|^end$|^dow$|^w$|^weeks$|^week$|^ts$|^id$|^cutoff$)/.test(key))
    return 'dates';
  if (/(km|Km|^vol$|^q$|M$|^reps$|^repSec$|^runSec$|^walkSec$|Sec$)/.test(key)) return 'km';
  if (/^(tag|kind|type|mlr|finish|strides|session|runWalk|overrides|nemeri|l)$/.test(key))
    return 'segments';
  if (/^(dayWarnings)$/.test(key)) return 'warnings';
  if (/^(rest)$/.test(key)) return 'rest';
  return 'other';
}

/** SHA po kategoriji (bez ukupnog). */
function partsOf(x: unknown): Record<Category, string> {
  const lists: Record<Category, string[]> = Object.fromEntries(
    CATEGORIES.map((c) => [c, [] as string[]])
  ) as Record<Category, string[]>;
  const walk = (v: unknown, path: string[]): void => {
    if (v !== null && typeof v === 'object' && !(v instanceof Map) && !(v instanceof Set)) {
      const keys = Object.keys(v);
      if (!keys.length) lists[categoryOf(path)].push(`${path.join('.')}=${exact(v)}`);
      for (const k of keys) walk((v as Record<string, unknown>)[k], [...path, k]);
      return;
    }
    lists[categoryOf(path)].push(`${path.join('.')}=${exact(v)}`);
  };
  walk(x, []);
  return Object.fromEntries(CATEGORIES.map((c) => [c, sha(lists[c].join('\n'))])) as Record<
    Category,
    string
  >;
}

/** SHA po kategoriji + ukupan SHA. */
export function digest(x: unknown): { full: string; parts: Record<Category, string> } {
  return { full: sha(exact(x)), parts: partsOf(x) };
}

/** Red reference: ukupan SHA i SHA po kategoriji, skraćeni na 20 znakova (oblik `ReferenceRow`). */
export interface DigestRow {
  full: string;
  parts: Partial<Record<Category, string>>;
  pure: boolean;
}

const short = (s: string): string => s.slice(0, 20);

/**
 * Red reference za vrednost (isto što su `row()` u `src/test/<distanca>/reference.ts` računali). Kad je dat očekivani red
 * `expected` sa ISTIM ukupnim SHA, kategorije se preuzimaju iz njega umesto da se ponovo obilazi stablo: isti tačan zapis
 * (`exact`) znači isto stablo vrednosti, a kategorije su funkcija tog stabla; testovi ih gledaju samo kad se ukupni SHA
 * razlikuje — tada se računaju kao i ranije. Ishod svakog poređenja je isti kao bez `expected`
 * (docs/testing/TEST-SPEED.md, „čist višak"). `EXACT_VERIFY_PARTS=1`: kategorije se ipak računaju i porede sa
 * preuzetim (provera ove tvrdnje).
 */
export function referenceRow(value: unknown, pure: boolean, expected?: DigestRow): DigestRow {
  const full = short(sha(exact(value)));
  const same = expected !== undefined && expected.full === full;
  if (same && process.env['EXACT_VERIFY_PARTS'] !== '1')
    return { full, parts: expected.parts, pure };
  const all = partsOf(value);
  const parts = Object.fromEntries(CATEGORIES.map((c) => [c, short(all[c])]));
  if (same)
    for (const c of Object.keys(expected.parts) as Category[])
      if (parts[c] !== expected.parts[c])
        throw new Error(`EXACT_VERIFY_PARTS: kategorija ${c} ≠ referenca uz isti ukupni SHA`);
  return { full, parts, pure };
}
