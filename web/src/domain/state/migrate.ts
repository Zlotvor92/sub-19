/* Migracija i čišćenje stanja: `unknown` → `PersistedState` (schema v11) ili `null` ako se stanje
   ne može prihvatiti (nije objekat, nema `log`, ili je iz NOVIJE šeme).

   Port starog `migrate()` — isti redosled koraka. Ne mutira ulaz (stari kod jeste), nepoznata
   polja prvog nivoa se ČUVAJU (novija verzija ih možda koristi; stariji klijent ih ne sme brisati).
   Namerno strože od starog koda: v. oznake „STROŽE". */

import { isIsoDate } from '../date';
import { idToString, isValidId } from './ids';
import {
  cleanAlts,
  cleanDated,
  cleanNumberField,
  cleanOutOfPlanKm,
  cleanT3k,
  cleanVdotLog,
  cleanWellness,
  isPlainObject
} from './clean';
import { vdotPossible } from '../training/vdot/limits';
import {
  SCHEMA_VERSION,
  type GenPlanState,
  type PainRecord,
  type PersistedState,
  type UiState,
  type WeightRecord
} from './types';

type Obj = Record<string, unknown>;

const isLegacyPersonalId = (k: unknown): boolean => typeof k === 'string' && k.charAt(0) === 'n';
const isLegacyPredId = (k: unknown): boolean => typeof k === 'string' && k.charAt(0) === 'p';

/**
 * v10 → v11: lični (hardkodovan) plan „Bokeški polumaraton" je prethodno bio zamenjen; njegovi unosi
 * (ID-jevi `n…`, PRED `p…`) se brišu, a bol/masa sa tih dana ostaju kao arhiva.
 */
function dropOldPersonalPlan(o: Obj): void {
  const drop = (m: unknown, test: (k: string) => boolean): void => {
    if (isPlainObject(m)) for (const k of Object.keys(m)) if (test(k)) delete m[k];
  };
  drop(o['log'], isLegacyPersonalId);
  drop(o['alts'], isLegacyPersonalId);
  drop(o['moves'], isLegacyPersonalId);
  drop(o['pred'], isLegacyPredId);
  drop(o['predLock'], isLegacyPredId);
  if (Array.isArray(o['vdotLog'])) {
    o['vdotLog'] = (o['vdotLog'] as unknown[]).filter(
      (e) => !(e && isLegacyPredId((e as Obj)['id']))
    );
  }
  if (Array.isArray(o['knee'])) {
    o['knee'] = (o['knee'] as unknown[]).map((k) =>
      k && isLegacyPersonalId((k as Obj)['src'])
        ? {
            ...(k as Obj),
            src: 'arhiva',
            id: idToString((k as Obj)['id']).replace(/^kt-/, 'kt-arhiva-')
          }
        : k
    );
  }
  if (Array.isArray(o['kg'])) {
    o['kg'] = (o['kg'] as unknown[]).map((x) =>
      x && isLegacyPersonalId((x as Obj)['src']) ? { ...(x as Obj), src: 'arhiva' } : x
    );
  }
}

/** `null` ako stanje nije prihvatljivo. Ulaz se ne menja. */
export function migrateState(input: unknown): PersistedState | null {
  if (!input || typeof input !== 'object') return null;
  const log = (input as Obj)['log'];
  if (!log || typeof log !== 'object' || Array.isArray(log)) return null;

  /* Dubinska kopija: stari kod je mutirao ulaz (i njegove ugnežđene mape). */
  const o = JSON.parse(JSON.stringify(input)) as Obj;

  /* `o.v` može biti broj, string („11"), ili izostati. Ono što se ne da pročitati je „verzija 1". */
  const rawV = o['v'];
  const vReadable =
    (typeof rawV === 'number' || typeof rawV === 'string') && rawV !== '' && Number.isFinite(+rawV);
  let v = vReadable ? +(rawV as number) : 1;
  /* Stanje iz NOVIJE šeme se odbija: bezuslovno `v = SCHEMA` bi ga tiho „spustilo" i prepisalo. */
  if (v > SCHEMA_VERSION) return null;

  if (v < 2) {
    o['strava'] = o['strava'] || null;
    o['predLock'] = o['predLock'] || {};
    v = 2;
  }
  if (v < 3) {
    o['vdotLog'] = o['vdotLog'] || [];
    v = 3;
  }
  if (v < 4) {
    o['moves'] = o['moves'] || {};
    v = 4;
  }
  if (v < 5) {
    o['alts'] = o['alts'] || {};
    v = 5;
  }
  if (v < 6) {
    o['genPlan'] = o['genPlan'] || null;
    v = 6;
  }
  if (v < 7) {
    o['wellness'] = o['wellness'] || {};
    o['icu'] = o['icu'] !== undefined ? o['icu'] : null;
    v = 7;
  }
  if (v < 8) {
    o['t3k'] = o['t3k'] || [];
    v = 8;
  }
  if (v < 9) {
    o['vreme'] = o['vreme'] || null;
    v = 9;
  }
  if (v < 10) {
    /* Zajednica: `vidljiv:false` je JEDINO ispravno početno stanje. Postojeći izbor se prenosi
       samo ako je verzija stvarno čitljiva (`o.v` je upravo ono što je ovde u pitanju). */
    o['zajed'] =
      !vReadable && isPlainObject(o['zajed']) ? o['zajed'] : { vidljiv: false, nadimak: '' };
    v = 10;
  }
  if (v < 11) {
    dropOldPersonalPlan(o);
    v = 11;
  }

  o['t3k'] = cleanT3k(o['t3k']);
  o['wellness'] = cleanWellness(o['wellness']);
  o['vanPlana'] = cleanOutOfPlanKm(o['vanPlana']);
  /* Zapis lanca forme čiji je `measured` nemoguć (ili, bez `measured`, `vdot`) se odbacuje. */
  o['vdotLog'] = cleanVdotLog(o['vdotLog'])
    .filter((e) => !(e.measured != null && !vdotPossible(e.measured)))
    .filter((e) => !(e.measured == null && e.vdot != null && !vdotPossible(e.vdot)));
  o['knee'] = cleanNumberField(cleanDated<PainRecord>(o['knee']), 'pain', 0, 10);
  o['kg'] = cleanNumberField(cleanDated<WeightRecord>(o['kg']), 'kg', 20, 300);
  const vreme = o['vreme'];
  o['vreme'] =
    isPlainObject(vreme) && vreme['sati'] && typeof vreme['sati'] === 'object' ? vreme : null;
  o['alts'] = cleanAlts(o['alts']);

  o['pred'] = o['pred'] || {};
  o['predLock'] = o['predLock'] || {};
  o['moves'] = o['moves'] || {};
  o['genPlan'] = o['genPlan'] !== undefined ? o['genPlan'] : null;
  o['wellness'] = o['wellness'] || {};
  o['icu'] = o['icu'] !== undefined ? o['icu'] : null;

  /* STROŽE: `zajed` i `ui` koji nisu običan objekat (niz, string) postaju podrazumevani — stari kod je
     `Object.assign`-om kopirao indekse niza/niske u njih. */
  const zajed: Obj = {
    vidljiv: false,
    nadimak: '',
    ...(isPlainObject(o['zajed']) ? o['zajed'] : {})
  };
  zajed['vidljiv'] = zajed['vidljiv'] === true;
  zajed['nadimak'] = typeof zajed['nadimak'] === 'string' ? zajed['nadimak'].slice(0, 24) : '';
  o['zajed'] = zajed;

  const ui: UiState = {
    firstRun: null,
    lastBackup: null,
    snooze: null,
    seenWeek: null,
    geo: null,
    satTreninga: null,
    novo: null,
    ...(isPlainObject(o['ui']) ? o['ui'] : {})
  };
  o['ui'] = ui;
  o['v'] = SCHEMA_VERSION;

  return o as unknown as PersistedState;
}

/* ---------------------------------------------------------------------------------------------
   Provere pri UVOZU backupa (strože od migracije): odbijaju se u celosti, pre nego što dodirnu stanje.
   --------------------------------------------------------------------------------------------- */

/**
 * Da li je `genPlan` iz uvezenog fajla upotrebljiv. Pokvaren ili ručno izmenjen backup je obarao
 * aplikaciju POSLE zamene stanja; zato se oblik proverava PRE zamene.
 */
export function isValidGenPlan(g: unknown): g is GenPlanState | null {
  if (g == null) return true; // nema generisanog plana — lični je aktivan
  if (!isPlainObject(g)) return false;
  const weeks = g['weeks'];
  if (!Array.isArray(weeks) || !weeks.length) return false;
  const daysOk = (weeks as unknown[]).every(
    (w) =>
      isPlainObject(w) &&
      isIsoDate(w['start']) &&
      Array.isArray(w['days']) &&
      w['days'].length > 0 &&
      (w['days'] as unknown[]).every(
        (d) =>
          isPlainObject(d) &&
          Number.isInteger(d['dow']) &&
          (d['dow'] as number) >= 0 &&
          (d['dow'] as number) <= 7 &&
          (d['km'] == null || (typeof d['km'] === 'number' && Number.isFinite(d['km']))) &&
          /* OPIS MORA BITI TEKST: broj umesto niske rušio je `setPage()` na četvrtoj liniji pokretanja. */
          (d['desc'] == null || typeof d['desc'] === 'string') &&
          (d['id'] == null || isValidId(d['id']))
      )
  );
  if (!daysOk) return false;
  const pred = g['pred'];
  if (pred != null) {
    if (!Array.isArray(pred)) return false;
    const predOk = (pred as unknown[]).every(
      (r) =>
        isPlainObject(r) &&
        isValidId(r['id']) &&
        (r['q'] == null || (typeof r['q'] === 'number' && Number.isFinite(r['q']))) &&
        (r['pt'] == null || (typeof r['pt'] === 'number' && Number.isFinite(r['pt']))) &&
        (r['l'] == null || typeof r['l'] === 'string')
    );
    if (!predOk) return false;
  }
  const qs = g['qs'];
  if (qs != null && !isPlainObject(qs)) return false;
  if (isPlainObject(qs) && Object.keys(qs).some((k) => !isValidId(k))) return false;
  return true;
}

/** Prvo problematično mesto sa neispravnim ID-jem, ili `null`. Za poruku korisniku. */
export function findInvalidId(st: unknown): string | null {
  if (!st || typeof st !== 'object') return 'stanje';
  const s = st as Obj;
  const maps: Array<[string, unknown]> = [
    ['log', s['log']],
    ['pred', s['pred']],
    ['predLock', s['predLock']],
    ['alts', s['alts']],
    ['moves', s['moves']]
  ];
  for (const [name, m] of maps) {
    if (m == null) continue;
    if (typeof m !== 'object' || Array.isArray(m)) return name;
    for (const k of Object.keys(m)) if (!isValidId(k)) return `${name} → ${String(k).slice(0, 40)}`;
  }
  const bad = (x: unknown): boolean => x != null && !isValidId(x);
  if (Array.isArray(s['vdotLog'])) {
    for (const e of s['vdotLog'] as unknown[]) if (e && bad((e as Obj)['id'])) return 'vdotLog';
  }
  if (Array.isArray(s['t3k'])) {
    for (const t of s['t3k'] as unknown[]) if (t && bad((t as Obj)['id'])) return 't3k.id';
  }
  if (Array.isArray(s['knee'])) {
    for (const k of s['knee'] as unknown[]) {
      if (k && bad((k as Obj)['id'])) return 'knee.id';
      if (k && bad((k as Obj)['src'])) return 'knee.src';
    }
  }
  if (Array.isArray(s['kg'])) {
    for (const x of s['kg'] as unknown[]) if (x && bad((x as Obj)['src'])) return 'kg.src';
  }
  return null;
}
