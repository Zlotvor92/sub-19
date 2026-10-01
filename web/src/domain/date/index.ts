/* ============================================================
   DATUMI — čist kalendarski račun, nezavisan od vremenske zone.

   Zašto postoji: stari kod meša dve konvencije. `addD`/`diffD`/`s2d` rade sa
   LOKALNIM datumom (`new Date(y, m, d)`), a `mondayOfWeek`/`nextMonday` sa UTC
   (`new Date('YYYY-MM-DD')`). Za čiste datume su ekvivalentne, ali samo zato
   što se greške poništavaju; komentar u `nextMonday` beleži da je mešanje
   jednom davalo pogrešan dan u svakoj zoni ispred UTC.

   Ovde se datum je string `YYYY-MM-DD`, a sav račun ide preko "epoch-dana"
   (broj celih dana od 1970-01-01), pa vremenska zona ne postoji kao pojam.
   Domen NE čita sat: "danas" je argument.

   STROGOST: `parseIsoDate('2026-02-31')` je `null`. Stari `s2d` ga je tiho
   prelivao u 03.03. (v. docs/TRAINING_ENGINE_AUDIT.md, G2).
   ============================================================ */

declare const isoDateBrand: unique symbol;
/** Kalendarski ispravan datum u obliku `YYYY-MM-DD`. */
export type IsoDate = string & { readonly [isoDateBrand]: true };

const ISO_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Pon=0 … Ned=6 (konvencija stare aplikacije: `DOW`, `(getDay()+6)%7`). */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** Epoch-dan za kalendarski datum; `null` ako takav datum ne postoji. */
function ymdToEpochDay(y: number, m: number, d: number): number | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, m - 1, d);
  /* Date.UTC godine 0..99 tumači kao 1900..1999 — a mi ih ionako ne prihvatamo
     (`\d{4}` dozvoljava "0099"), pa se proverava povratkom. */
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return ms / MS_PER_DAY;
}

/** Strogo parsiranje. Vraća `null` za sve što nije postojeći kalendarski datum. */
export function parseIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== 'string') return null;
  const m = ISO_SHAPE.exec(value);
  if (!m) return null;
  const epoch = ymdToEpochDay(Number(m[1]), Number(m[2]), Number(m[3]));
  return epoch === null ? null : (value as IsoDate);
}

export function isIsoDate(value: unknown): value is IsoDate {
  return parseIsoDate(value) !== null;
}

/** Epoch-dan (celi dani od 1970-01-01). Baca za neispravan datum — pozivalac je već validirao. */
export function toEpochDay(date: IsoDate): number {
  const m = ISO_SHAPE.exec(date);
  const epoch = m ? ymdToEpochDay(Number(m[1]), Number(m[2]), Number(m[3])) : null;
  if (epoch === null) throw new RangeError(`Neispravan datum: ${date}`);
  return epoch;
}

export function fromEpochDay(epochDay: number): IsoDate {
  if (!Number.isInteger(epochDay))
    throw new RangeError(`Epoch-dan mora biti ceo broj: ${epochDay}`);
  const d = new Date(epochDay * MS_PER_DAY);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}` as IsoDate;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Broj dana od `from` do `to` (pozitivan ako je `to` kasnije). Isto značenje kao stari `diffD(a, b)`. */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function weekdayIndex(date: IsoDate): WeekdayIndex {
  /* 1970-01-01 je bio četvrtak (Pon=0 → Čet=3). */
  const idx = (((toEpochDay(date) + 3) % 7) + 7) % 7;
  return idx as WeekdayIndex;
}

/** Ponedeljak nedelje kojoj datum pripada (stari `mondayOfWeek`). */
export function mondayOnOrBefore(date: IsoDate): IsoDate {
  return addDays(date, -weekdayIndex(date));
}

/** Prvi ponedeljak na ili posle datuma (stari `nextMonday`; ponedeljak vraća isti dan). */
export function mondayOnOrAfter(date: IsoDate): IsoDate {
  const w = weekdayIndex(date);
  return w === 0 ? date : addDays(date, 7 - w);
}
