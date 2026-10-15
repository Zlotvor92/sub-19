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

/** SHA po kategoriji + ukupan SHA. */
export function digest(x: unknown): { full: string; parts: Record<Category, string> } {
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
  const parts = Object.fromEntries(CATEGORIES.map((c) => [c, sha(lists[c].join('\n'))])) as Record<
    Category,
    string
  >;
  return { full: sha(exact(x)), parts };
}
