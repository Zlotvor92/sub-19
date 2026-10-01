/* SPAJANJE DANA SA PREDIKCIJSKIM REDOM.

   Red predikcije („N5 · Intervali") nosi naziv iz PLANA, a korisnik je dan mogao da prebaci u drugi tip.
   Dan se zato spaja sa redom u četiri prolaza, od najpouzdanijeg: (1) tačan naziv sesije, (2) isti tip kao
   po planu, (3) isti tip kao sada, (4) tip koji je dan imao po planu. Jedan red pripada najviše jednom danu. */

import type { ResolvedDay, ResolvedPlan, ResolvedWeek } from '../../plan/types';
import type { PredictionRow } from '../types';
import { zoneForPredLabel } from './chain';
import type { Zone } from '../types';

export type StoredPredRow = PredictionRow & { id: string };

const kindMatch = (d: ResolvedDay, r: StoredPredRow): boolean | null => {
  const k = d.session?.kind;
  if (!k) return null;
  return r.l === `N${d.w} · ${k}`;
};

/** Grubo slaganje po tipu: intervalski dan ↔ intervalski redovi, tempo dan ↔ pragovski redovi. */
const tagMatch = (tag: string | undefined, r: StoredPredRow): boolean => {
  const l = r.l.toLowerCase();
  return tag === 'int'
    ? l.includes('intervali') ||
        l.includes('repeticije') ||
        l.includes('fartlek') ||
        l.includes('piramida') ||
        l.includes('ritam') ||
        l.includes('maratonski tempo') ||
        l.includes('tempo trke')
    : l.includes('tempo') ||
        l.includes('ritam') ||
        l.includes('progresivno') ||
        l.includes('kontrolna');
};

/** `dayId → ID reda` za jednu nedelju. */
export function matchWeekRows(
  week: ResolvedWeek,
  pred: readonly StoredPredRow[]
): Record<string, string[]> {
  const days = week.days
    .filter((x) => !x.test && (x.tag === 'int' || x.tag === 'tempo'))
    .slice()
    .sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1));
  const rows = pred.filter((r) => r.w === week.w);
  const map: Record<string, string[]> = {};
  const taken = new Set<string>();
  const take = (d: ResolvedDay, find: (r: StoredPredRow) => boolean): void => {
    if (map[d.id]) return;
    const t = rows.find((r) => !taken.has(r.id) && find(r));
    if (t) {
      map[d.id] = [t.id];
      taken.add(t.id);
    }
  };
  days.forEach((d) => take(d, (r) => kindMatch(d, r) === true));
  days.forEach((d) => {
    if (d.origin.tag === d.tag) take(d, (r) => tagMatch(d.tag, r));
  });
  days.forEach((d) => take(d, (r) => tagMatch(d.tag, r)));
  days.forEach((d) => {
    if (d.origin.tag && d.origin.tag !== d.tag) take(d, (r) => tagMatch(d.origin.tag, r));
  });
  return map;
}

/** Redovi predikcije koji pripadaju danu (kvalitetne sesije). */
export function predRowsForDay(
  plan: Pick<ResolvedPlan, 'weeks'>,
  day: ResolvedDay,
  rows: readonly StoredPredRow[]
): StoredPredRow[] {
  if (day.tag !== 'int' && day.tag !== 'tempo') return [];
  const week = plan.weeks.find((w) => w.w === day.w);
  if (!week) return [];
  const ids = matchWeekRows(week, rows)[day.id] ?? [];
  return ids.flatMap((id) => rows.filter((r) => r.id === id));
}

/** Spajanje za ceo plan odjednom (jedan prolaz po nedelji). */
export function matchPlanRows(
  weeks: readonly ResolvedWeek[],
  pred: readonly StoredPredRow[]
): Map<string, StoredPredRow> {
  const byId = new Map(pred.map((r) => [r.id, r] as const));
  const out = new Map<string, StoredPredRow>();
  for (const w of weeks) {
    const m = matchWeekRows(w, pred);
    for (const d of w.days) {
      if (d.tag !== 'int' && d.tag !== 'tempo') continue;
      const rowId = m[d.id]?.[0];
      const row = rowId ? byId.get(rowId) : undefined;
      if (row) out.set(d.id, row);
    }
  }
  return out;
}

/** Zona dana preko njegovog PRED reda; bez zone se tempo ne sme prevoditi u VDOT ni obrnuto. */
export function dayZone(
  matched: ReadonlyMap<string, StoredPredRow>,
  d: ResolvedDay
): { row: StoredPredRow; zone: Zone } | null {
  const row = matched.get(d.id);
  if (!row) return null;
  const zone = zoneForPredLabel(row.l);
  return zone ? { row, zone } : null;
}
