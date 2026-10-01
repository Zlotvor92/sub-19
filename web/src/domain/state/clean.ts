/* Čišćenje nepouzdanog ulaza (uvezen backup, `user_state.data` sa servera, `localStorage`).

   Svaka funkcija prima `unknown` i vraća tipiziran, očišćen rezultat. ODBACUJE ono što ne može da
   popravi (zapis bez upotrebljivog datuma se ne „popravlja" — pogođen datum bi bio izmišljen podatak o
   nečijem bolu ili masi). Semantika je ista kao u starim `cist*` funkcijama (v. oracle test); jedina
   razlika su namerno strože provere navedene uz funkciju. */

import { isIsoDate } from '../date';
import { runWalkText } from '../training/generator/runWalk';
import { isT3kId, t3kPossible } from '../training/vdot/limits';
import { isValidId } from './ids';
import {
  DAY_TAGS,
  STRENGTH_WITH,
  type AltRecord,
  type DayTag,
  type T3kRecord,
  type VdotRecord,
  type WellnessRecord
} from './types';

type Obj = Record<string, unknown>;
export const isPlainObject = (x: unknown): x is Obj =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const isObject = (x: unknown): x is Obj => x !== null && typeof x === 'object';

/** Isto što stari `broj`: ono što se ne da pretvoriti u broj postaje `null`, ostalo `+v`. */
function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v as number);
  return Number.isNaN(n) ? null : n;
}

const WELLNESS_FIELDS = [
  'hrv',
  'pulsUMiru',
  'sanH',
  'sanOcena',
  'tezina',
  'ctl',
  'atl',
  'svezina'
] as const;

/**
 * Zapisi o oporavku SU BROJEVI — i to se nameće. Server ih već pretvara u brojeve, ali uvoz backupa
 * i sync upisuju šta god stoji u JSON-u, a te vrednosti su išle pravo u HTML (dokazano napadom:
 * `hrv = "\"><img src=x onerror=…>"`). Sve što nije broj postaje `null`.
 */
export function cleanWellness(w: unknown): Record<string, WellnessRecord> {
  const out: Record<string, WellnessRecord> = {};
  if (!isPlainObject(w)) return out;
  for (const k of Object.keys(w)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue; // ključ je datum, ništa drugo
    const z = w[k];
    if (!isObject(z)) continue;
    const c: WellnessRecord = {
      datum: k,
      hrv: null,
      pulsUMiru: null,
      sanH: null,
      sanOcena: null,
      tezina: null,
      ctl: null,
      atl: null,
      svezina: null
    };
    for (const f of WELLNESS_FIELDS) c[f] = toNumberOrNull((z as Obj)[f]);
    out[k] = c;
  }
  return out;
}

/** Zapisi lanca forme su brojevi — nametnuto, ne pretpostavljeno (isti napad kao kod oporavka). */
export function cleanVdotLog(v: unknown): VdotRecord[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .filter(isObject)
    .map((e): VdotRecord => {
      const c: VdotRecord = {
        id: e['id'],
        ts: typeof e['ts'] === 'string' ? e['ts'] : '',
        vdot: toNumberOrNull(e['vdot']),
        prev: toNumberOrNull(e['prev']),
        delta: toNumberOrNull(e['delta']),
        measured: toNumberOrNull(e['measured'])
      };
      if (e['vdotMigrated']) c.vdotMigrated = true;
      return c;
    })
    .filter((e) => e.id != null && e.ts);
}

/** Zapis bez upotrebljivog (kalendarski ispravnog) datuma se ODBACUJE; ostalo prolazi netaknuto. */
export function cleanDated<T extends Obj>(arr: unknown): T[] {
  if (!Array.isArray(arr)) return [];
  return (arr as unknown[]).filter((x): x is T => isObject(x) && isIsoDate(x['date']));
}

/**
 * Broj koji se crta i po kome se odlučuje, iz zapisa koji je mogao doći iz proizvoljnog JSON-a.
 * Zapis bez broja u opsegu se odbacuje: grafikon bi crtao `cy="NaN"`, a `partLevel` bi vratio
 * `undefined` pa bi `bol >= 6` bilo netačno — unos o povredi POSTOJI, a plan se ponaša kao da ga nema.
 */
export function cleanNumberField<T extends Obj>(
  arr: T[],
  field: string,
  min: number,
  max: number
): T[] {
  return arr.filter((x) => {
    const v = x[field];
    return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  });
}

/** run/walk struktura iz `alts`: granica poverenja ista kao kod oporavka. */
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

const isDayTag = (t: unknown): t is DayTag =>
  typeof t === 'string' && (DAY_TAGS as readonly string[]).includes(t);

/**
 * Izmene tipa treninga (`alts`) — POSLEDNJA mapa koja je ulazila neproverena, sa težom posledicom:
 * `desc` koji nije niska rušio je `dayCard` → `renderDanas` → `setPage` i aplikacija je ostajala bez
 * ekrana trajno (izmereno na hladnom startu sa `alts.desc = 123`).
 *
 * NAMERNO STROŽE od starog koda: tip se proverava vlastitom listom (`DAY_TAGS`), ne `TAGS[tag]` — stari
 * kod je prihvatao `'constructor'`/`'toString'` jer su nasleđena svojstva objekta.
 */
export function cleanAlts(a: unknown): Record<string, AltRecord> {
  const out: Record<string, AltRecord> = {};
  if (!isPlainObject(a)) return out;
  for (const id of Object.keys(a)) {
    if (!isValidId(id)) continue;
    const v = a[id];
    if (!isPlainObject(v)) continue;
    const tag = v['tag'];
    if (!isDayTag(tag)) continue;
    const kmRaw = v['km'];
    const km =
      kmRaw == null ||
      kmRaw === '' ||
      typeof kmRaw === 'boolean' ||
      !Number.isFinite(+(kmRaw as number))
        ? null
        : Math.min(500, Math.max(0, +(kmRaw as number)));
    const paceRaw = v['pace'];
    const pace =
      paceRaw == null || !Number.isFinite(+(paceRaw as number)) || +(paceRaw as number) <= 0
        ? null
        : Math.round(+(paceRaw as number));
    const alt: AltRecord = {
      tag,
      km: tag === 'odmor' ? null : km,
      desc: typeof v['desc'] === 'string' ? v['desc'] : '',
      pace,
      rw: tag === 'odmor' ? null : cleanRunWalk(v['rw']),
      paceAuto: pace != null && v['paceAuto'] === true
    };
    /* „+ Snaga" uz trčanje. Samo uz trkački tip. */
    if (v['snaga'] === true && STRENGTH_WITH.has(tag)) alt.snaga = true;
    out[id] = alt;
  }
  return out;
}

/** Trčanja PRE prvog dana plana: `{datum: km}`, km ∈ (0, 300]. */
export function cleanOutOfPlanKm(m: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isPlainObject(m)) return out;
  for (const k of Object.keys(m)) {
    const raw = m[k];
    const v = +(raw as number);
    if (isIsoDate(k) && typeof raw === 'number' && Number.isFinite(v) && v > 0 && v <= 300) {
      out[k] = Math.round(v * 100) / 100;
    }
  }
  return out;
}

/** Testovi na 3 km: zapis mora imati datum, ID sa prefiksom `t3k-` i verodostojno vreme. */
export function cleanT3k(arr: unknown): T3kRecord[] {
  return cleanDated<Obj>(arr)
    .map((t) => ({
      id: String(t['id'] || ''),
      date: t['date'] as string,
      sec: Math.round(+(t['sec'] as number))
    }))
    .filter((t) => isT3kId(t.id) && isValidId(t.id) && t3kPossible(t.sec));
}

export function cleanDescription(x: unknown): string {
  return typeof x === 'string' ? x : '';
}
