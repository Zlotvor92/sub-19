/* Izmene plana kao čiste funkcije: (plan, stanje, zahtev) → novo stanje ili razlog odbijanja.
   Stari kod je mutirao `S.moves`/`S.alts` i pozivao `rebuildDateIndex()` + `save()`; novo stanje se
   vraća, a ko ga drži (store) odlučuje kad da ga sačuva. */

import { cleanRunWalk } from '../state/clean';
import { DAY_TAGS, STRENGTH_WITH, type AltRecord, type DayTag, type LogEntry } from '../state';
import type { ResolvedDay, ResolvedPlan, ResolvedWeek } from './types';

export type EditResult<T> = ({ ok: true } & T) | { ok: false; err: string };

const isDone = (log: Readonly<Record<string, LogEntry>>, id: string): boolean =>
  log[id]?.status === 'done';

type Moves = Record<string, unknown>;

/**
 * Zamena dva dana ISTE nedelje. Odrađen dan se ne pomera (istorija se ne menja). Mapa `moves` pamti
 * samo ODSTUPANJA od plana: dan koji se vrati na svoj datum se briše iz nje.
 */
export function swapDays(
  plan: ResolvedPlan,
  log: Readonly<Record<string, LogEntry>>,
  moves: Readonly<Moves>,
  idA: string,
  idB: string
): EditResult<{ moves: Moves }> {
  const a = plan.byId.get(idA);
  const b = plan.byId.get(idB);
  if (!a || !b || a.test || b.test) return { ok: false, err: 'nepostojeći dan' };
  if (idA === idB) return { ok: false, err: 'isti dan' };
  if (a.w !== b.w) return { ok: false, err: 'van iste nedelje' };
  if (isDone(log, idA) || isDone(log, idB)) return { ok: false, err: 'odrađen dan se ne pomera' };
  const next: Moves = { ...moves };
  if (b.date === a.origDate) delete next[idA];
  else next[idA] = b.date;
  if (a.date === b.origDate) delete next[idB];
  else next[idB] = a.date;
  return { ok: true, moves: next };
}

/** Vraća sve dane nedelje na planske datume. */
export function undoWeekMoves(
  week: ResolvedWeek,
  moves: Readonly<Moves>
): { changed: boolean; moves: Moves } {
  const next: Moves = { ...moves };
  let changed = false;
  for (const d of week.days) {
    if (!d.test && next[d.id] != null) {
      delete next[d.id];
      changed = true;
    }
  }
  return { changed, moves: next };
}

/** Ono što ekran „Izmeni trening" šalje. Polja koja nisu navedena se čuvaju (v. `rw`). */
export interface AltInput {
  tag: string;
  km?: number | string | null;
  desc?: string | null;
  pace?: number | string | null;
  /** `undefined` = ne diraj postojeći ritam; `null` = obriši ga. */
  rw?: unknown;
  paceAuto?: boolean;
  snaga?: boolean;
}

const isDayTag = (t: string): t is DayTag => (DAY_TAGS as readonly string[]).includes(t);
const isNumeric = (v: unknown): boolean => v != null && v !== '' && !Number.isNaN(Number(v));

/**
 * Ručna izmena tipa/km/opisa/tempa dana. Izmena identična planu (i bez ručnog tempa, ritma i snage) se
 * BRIŠE umesto da se čuva. Odrađen dan se ne menja. Run/walk se nosi KAO PODATAK (ne samo kao tekst u
 * opisu): ručna izmena kilometraže ne sme tiho da obriše ritam.
 */
export function setAlt(
  plan: ResolvedPlan,
  log: Readonly<Record<string, LogEntry>>,
  alts: Readonly<Record<string, AltRecord>>,
  id: string,
  alt: AltInput | null | undefined
): EditResult<{ alts: Record<string, AltRecord> }> {
  const d: ResolvedDay | undefined = plan.byId.get(id);
  if (!d || d.test) return { ok: false, err: 'nepostojeći dan' };
  if (isDone(log, id)) return { ok: false, err: 'odrađen trening se ne menja' };
  if (!alt || !alt.tag || !isDayTag(alt.tag)) return { ok: false, err: 'tip nije izabran' };
  const tag = alt.tag;
  const planTag = d.origin.rest ? 'odmor' : d.origin.tag;
  if (tag !== 'odmor' && isNumeric(alt.km) && Number(alt.km) < 0) {
    return { ok: false, err: 'kilometraža ne može biti negativna' };
  }
  const km = tag === 'odmor' ? null : isNumeric(alt.km) ? Number(alt.km) : null;
  const desc = tag === 'odmor' ? 'Odmor' : alt.desc || '';
  const pace =
    (tag === 'int' || tag === 'tempo') && isNumeric(alt.pace) && Number(alt.pace) > 0
      ? Math.round(Number(alt.pace))
      : null;
  const old = alts[id] ?? null;
  const rw = tag === 'odmor' ? null : alt.rw === undefined ? old?.rw || null : cleanRunWalk(alt.rw);
  const snaga = alt.snaga === true && STRENGTH_WITH.has(tag);
  const next: Record<string, AltRecord> = { ...alts };
  const sameAsPlan =
    tag === planTag &&
    km === (d.origin.km != null ? d.origin.km : null) &&
    desc === (d.origin.desc || (d.origin.rest ? 'Odmor' : '')) &&
    pace == null &&
    rw == null &&
    !snaga;
  if (sameAsPlan) {
    delete next[id];
  } else {
    const rec: AltRecord = { tag, km, desc, pace, rw, paceAuto: pace != null && !!alt.paceAuto };
    if (snaga) rec.snaga = true;
    next[id] = rec;
  }
  return { ok: true, alts: next };
}

export function clearAlt(
  alts: Readonly<Record<string, AltRecord>>,
  id: string
): { changed: boolean; alts: Record<string, AltRecord> } {
  if (alts[id] == null) return { changed: false, alts: { ...alts } };
  const next = { ...alts };
  delete next[id];
  return { changed: true, alts: next };
}
