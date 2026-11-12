/* V4 ADAPTERI — USKI TIPOVI „ONO ŠTO ČITAM" iz stanja korisnika starog oblika (SPEC § 9.1). Ulaz je `unknown`;
   ovde se proverava oblik i ništa se ne menja. Ovo je jedino mesto (uz `shared.ts`) koje zna ključeve starog oblika:
   `genPlan` (plan), `log` (urađeno po ID-ju dana), `alts` (ručne izmene), `moves` (pomeranja), `vanPlana` i
   `vanPlanaV2` (trčanja van plana), `knee` (bol). Nepoznata polja se ne gube: prenose se kao `JsonValue`. */
import { isValidDate } from '../engine/dates';
import type { IsoDate, JsonValue } from '../engine/types';

export type Rec = Readonly<Record<string, unknown>>;

export const isRec = (x: unknown): x is Rec =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export const num = (x: unknown): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? x : null;

export const str = (x: unknown): string | null => (typeof x === 'string' ? x : null);

/** Prvih 10 znakova kao datum (`runDate`, `ts`), ako je ispravan dan. */
export const isoPrefix = (x: unknown): IsoDate | null => {
  if (typeof x !== 'string') return null;
  const head = x.slice(0, 10);
  return isValidDate(head) ? head : null;
};

/** Duboka kopija u `JsonValue` (bez `undefined`, funkcija i nekonačnih brojeva). */
export function toJson(x: unknown): JsonValue {
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return x;
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  if (Array.isArray(x)) return x.map(toJson);
  if (isRec(x)) {
    const out: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(x)) {
      const v = x[key];
      if (v !== undefined && typeof v !== 'function') out[key] = toJson(v);
    }
    return out;
  }
  return null;
}

/** Polja zapisa osim navedenih, kao `JsonValue` (nepoznato se ne gubi). */
export function rest(x: Rec, known: readonly string[]): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const key of Object.keys(x)) {
    if (known.includes(key)) continue;
    const v = x[key];
    if (v !== undefined && typeof v !== 'function') out[key] = toJson(v);
  }
  return out;
}

/* ------------------------------------------------------------------ plan */

export interface ReadDay {
  raw: Rec;
  id: string;
  dow: number;
  rest: boolean;
  tag: string | undefined;
  km: number | null;
  desc: string | null;
}

export interface ReadWeek {
  raw: Rec;
  w: number;
  start: IsoDate;
  deload: boolean;
  taper: boolean;
  phase: string | null;
  days: ReadDay[];
}

export interface ReadPlan {
  raw: Rec;
  meta: Rec;
  weeks: ReadWeek[];
}

export type ReadError = { code: AdoptErrorCode; message: string };

export type AdoptErrorCode =
  'datum-neispravan' | 'nema-plana' | 'oblik-neispravan' | 'nepoznata-distanca' | 'nepoznat-format';

const fail = (code: AdoptErrorCode, message: string): { error: ReadError } => ({
  error: { code, message }
});

function readDay(x: unknown, where: string): ReadDay | { error: ReadError } {
  if (!isRec(x)) return fail('oblik-neispravan', `${where}: dan nije zapis.`);
  const id = str(x['id']);
  const dow = num(x['dow']);
  if (id === null || id === '') return fail('oblik-neispravan', `${where}: dan nema ID.`);
  if (dow === null || !Number.isInteger(dow) || dow < 0 || dow > 6) {
    return fail('oblik-neispravan', `${where}: dan ${id} nema ispravan dan u nedelji.`);
  }
  const tag = str(x['tag']);
  return {
    raw: x,
    id,
    dow,
    rest: Boolean(x['rest']),
    tag: tag ?? undefined,
    km: num(x['km']),
    desc: str(x['desc'])
  };
}

/** Plan starog oblika (`genPlan`): nedelje sa ispravnim početkom i dani sa ID-jem i danom u nedelji. */
export function readPlan(x: unknown): ReadPlan | { error: ReadError } {
  if (x === null || x === undefined) return fail('nema-plana', 'Stanje nema plan.');
  if (!isRec(x)) return fail('oblik-neispravan', 'Plan nije zapis.');
  const weeksRaw = x['weeks'];
  if (!Array.isArray(weeksRaw) || weeksRaw.length === 0) {
    return fail('oblik-neispravan', 'Plan nema nedelja.');
  }
  const ids = new Set<string>();
  const weeks: ReadWeek[] = [];
  for (const [i, wk] of (weeksRaw as unknown[]).entries()) {
    const where = `Nedelja ${i + 1}`;
    if (!isRec(wk)) return fail('oblik-neispravan', `${where}: nije zapis.`);
    const start = str(wk['start']);
    if (start === null || !isValidDate(start)) {
      return fail('oblik-neispravan', `${where}: neispravan datum početka.`);
    }
    const daysRaw = wk['days'];
    if (!Array.isArray(daysRaw)) return fail('oblik-neispravan', `${where}: nema dana.`);
    const days: ReadDay[] = [];
    for (const d of daysRaw as unknown[]) {
      const day = readDay(d, where);
      if ('error' in day) return day;
      if (ids.has(day.id)) return fail('oblik-neispravan', `${where}: dan ${day.id} se ponavlja.`);
      ids.add(day.id);
      days.push(day);
    }
    weeks.push({
      raw: wk,
      w: num(wk['w']) ?? i + 1,
      start,
      deload: Boolean(wk['deload']),
      taper: wk['taper'] === true,
      phase: str(wk['phase']),
      days
    });
  }
  return { raw: x, meta: isRec(x['meta']) ? x['meta'] : {}, weeks };
}

/* ------------------------------------------------------------------ stanje uz plan */

export interface ReadState {
  plan: ReadPlan;
  log: Readonly<Record<string, Rec>>;
  alts: Readonly<Record<string, Rec>>;
  moves: Rec;
  vanPlana: Rec;
  vanPlanaV2: Rec;
  knee: readonly Rec[];
}

const records = (x: unknown): Record<string, Rec> => {
  const out: Record<string, Rec> = {};
  if (!isRec(x)) return out;
  for (const key of Object.keys(x)) {
    const v = x[key];
    if (isRec(v)) out[key] = v;
  }
  return out;
};

/** Stanje korisnika: plan + `log` + `alts` + `moves` + `vanPlana` (+ `vanPlanaV2`, `knee`). */
export function readState(x: unknown): ReadState | { error: ReadError } {
  if (!isRec(x)) return fail('oblik-neispravan', 'Stanje nije zapis.');
  const plan = readPlan(x['genPlan']);
  if ('error' in plan) return plan;
  return {
    plan,
    log: records(x['log']),
    alts: records(x['alts']),
    moves: isRec(x['moves']) ? x['moves'] : {},
    vanPlana: isRec(x['vanPlana']) ? x['vanPlana'] : {},
    vanPlanaV2: isRec(x['vanPlanaV2']) ? x['vanPlanaV2'] : {},
    knee: Array.isArray(x['knee']) ? (x['knee'] as unknown[]).filter(isRec) : []
  };
}
