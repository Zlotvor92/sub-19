/* Jednakost u JSON zapisu: `same(a, b)` je isto što i `JSON.stringify(a) === JSON.stringify(b)` za svaku vrednost koju
   JSON.stringify može da zapiše (bez BigInt-a i ciklusa), ali bez pravljenja niski — oba stabla se prolaze redom i
   poređenje staje na prvoj razlici. Odluke koje ga čitaju (spajanje, konstruktor, validator) zato ostaju bajt-iste.
   Profil mreža: poređenje preko niski bilo je 9–28 % vremena generatora (sa GC-om i više).

   Pravila JSON-a koja se ovde poštuju: redosled ključeva se računa; član objekta sa `undefined`/funkcijom/simbolom
   se izostavlja, a u nizu se piše `null`; ne-konačan broj je `null`; -0 je 0. Vrednost koja nije niz ili običan objekat
   bez `toJSON` (Date, Map, klasa…), BigInt i preduboko stablo idu na JSON.stringify celog para.
   Kopija tenK/v2/same.ts (Uslov 7, ne uvoz). */

const OMIT = Symbol('izostavljeno');
const OTHER = Symbol('nije podatak');
const EQ = 1;
const NE = 0;
const UNKNOWN = -1;
const MAX_DEPTH = 100;

/** Niz ili običan objekat bez `toJSON` (podaci plana). */
function plain(v: object): boolean {
  if (typeof (v as { toJSON?: unknown }).toJSON === 'function') return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return Array.isArray(v)
    ? proto === Array.prototype
    : proto === Object.prototype || proto === null;
}

/** Vrednost kakva se zapisuje na svom mestu: ne-konačan broj → null; `undefined`/funkcija/simbol → null u nizu,
    inače izostavljeno; ono što nije podatak (`toJSON`, klasa, BigInt) → OTHER (poređenje preko JSON.stringify). */
function slot(v: unknown, inArray: boolean): unknown {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object') return v === null || plain(v) ? v : OTHER;
  if (v === undefined || typeof v === 'function' || typeof v === 'symbol')
    return inArray ? null : OMIT;
  return typeof v === 'bigint' ? OTHER : v;
}

/** `a`, `b` su vrednosti iz `slot` (bez OMIT). */
function cmp(a: unknown, b: unknown, depth: number): number {
  if (a === OTHER || b === OTHER) return UNKNOWN;
  if (a === b) return EQ;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return NE;
  if (depth > MAX_DEPTH) return UNKNOWN;
  const arr = Array.isArray(a);
  if (arr !== Array.isArray(b)) return NE;
  if (arr) {
    const x = a as readonly unknown[];
    const y = b as readonly unknown[];
    if (x.length !== y.length) return NE;
    for (let i = 0; i < x.length; i++) {
      const r = cmp(slot(x[i], true), slot(y[i], true), depth + 1);
      if (r !== EQ) return r;
    }
    return EQ;
  }
  const x = a as Readonly<Record<string, unknown>>;
  const y = b as Readonly<Record<string, unknown>>;
  const xs = Object.keys(x);
  const ys = Object.keys(y);
  let i = 0;
  let j = 0;
  for (;;) {
    let vx: unknown = OMIT;
    while (i < xs.length && (vx = slot(x[xs[i]!], false)) === OMIT) i++;
    let vy: unknown = OMIT;
    while (j < ys.length && (vy = slot(y[ys[j]!], false)) === OMIT) j++;
    if (vx === OTHER || vy === OTHER) return UNKNOWN;
    if (i === xs.length || j === ys.length) return i === xs.length && j === ys.length ? EQ : NE;
    if (xs[i] !== ys[j]) return NE;
    const r = cmp(vx, vy, depth + 1);
    if (r !== EQ) return r;
    i++;
    j++;
  }
}

/** `JSON.stringify(a) === JSON.stringify(b)`, bez pravljenja niski. */
export function same(a: unknown, b: unknown): boolean {
  const x = slot(a, false);
  const y = slot(b, false);
  if (x === OTHER || y === OTHER) return JSON.stringify(a) === JSON.stringify(b);
  if (x === OMIT || y === OMIT) return x === y;
  const r = cmp(x, y, 0);
  return r === UNKNOWN ? JSON.stringify(a) === JSON.stringify(b) : r === EQ;
}
