/* Lokalne kopije pravila zapisa koja 10K adaptacija koristi pri upisu ručne izmene (`plan/edit.ts`).
   Izvor: `domain/state/types.ts` (DAY_TAGS, STRENGTH_WITH) i `domain/state/clean.ts` (cleanRunWalk, isObject,
   toNumberOrNull); namerno duplirano, bez deljenja sa aplikacionim skladištem ni sa drugim generatorom. */
import type { DayTag } from '../exchange';
import { runWalkText } from '../training/generator/runWalk';

export const DAY_TAGS: readonly DayTag[] = [
  'lako',
  'rw',
  'tempo',
  'int',
  'lr',
  'snaga',
  'odmor',
  'trka',
  'test'
];
/** Tipovi dana uz koje se može dodati „+ Snaga". */
export const STRENGTH_WITH: ReadonlySet<string> = new Set(['lako', 'int', 'tempo', 'lr']);

type Obj = Record<string, unknown>;
const isObject = (x: unknown): x is Obj => x !== null && typeof x === 'object';

/** Isto što stari `broj`: ono što se ne da pretvoriti u broj postaje `null`, ostalo `+v`. */
function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function cleanRunWalk(
  rw: unknown
): { runSec: number; walkSec: number; label: string } | null {
  if (!isObject(rw)) return null;
  const b = (v: unknown): number | null => {
    const n = toNumberOrNull(v);
    return n === null ? null : Math.round(n);
  };
  const r = b(rw['runSec']);
  const w = b(rw['walkSec']);
  if (!(r !== null && r > 0 && r <= 3600) || !(w !== null && w > 0 && w <= 3600)) return null;
  return { runSec: r, walkSec: w, label: runWalkText({ runSec: r, walkSec: w }) };
}
