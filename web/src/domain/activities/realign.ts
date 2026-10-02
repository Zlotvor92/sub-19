/* TRČANJE BEZ DIREKTNOG POKLAPANJA DATUMA (npr. trčao utorak umesto planiranog ponedeljka): nađe najbliži
   neodrađen trkački dan ISTE nedelje sa sličnom kilometražom i pomeri plan preko POSTOJEĆE `swapDays`
   (uvek reverzibilno preko „Vrati raspored nedelje"). Konzervativni pragovi (±2 dana, razlika km ≤ 30 %) —
   bolje da propusti nesiguran slučaj nego da pogrešno zameni dane. */

import type { IsoDate } from '../date';
import { diffDays } from '../date';
import { swapDays } from '../plan/edit';
import { resolvePlan, weekOf } from '../plan/resolve';
import type { AltRecord, LogEntry, StoredWeek } from '../state';

/** Najviše koliko dana od trčanja sme biti dan koji se pomera na njegovo mesto. */
export const REALIGN_DAY_WINDOW = 2;
/** Najveća relativna razlika kilometraže (|plan − trčano| / plan). */
export const REALIGN_KM_TOLERANCE = 0.3;

export interface RealignInput {
  weeks: readonly StoredWeek[];
  alts: Readonly<Record<string, AltRecord>>;
  moves: Readonly<Record<string, unknown>>;
  log: Readonly<Record<string, LogEntry>>;
  /** Trčanja po datumu (`distance` u metrima). Redosled ključeva je redosled obrade. */
  runsByDate: Readonly<Record<string, ReadonlyArray<{ distance: number }>>>;
}

export interface RealignResult {
  moves: Record<string, unknown>;
  moved: number;
}

/**
 * Pomera plan tako da trčanja bez para nađu svoj dan. Radi PRE glavne petlje upisa, pa je ovo jedino mesto
 * odakle se zna koji dani u OVOM paketu imaju svoje trčanje — dan sa sopstvenim trčanjem nikad nije kandidat
 * (inače bi njegovo trčanje ostalo bez dana i tiho nestalo: izmereno 15–18 % niži obim nedelje, baš bez
 * kvalitetne sesije).
 *
 * Neriješen izbor se lomi po KILOMETRAŽI, ne po redosledu u nizu: dugo trčanje od 14,7 km odrađeno dan
 * ranije mora na dugo trčanje od 14,7 km, ne na tempo dan od 11,6 km koji je isto tako udaljen.
 */
export function realignPlan(input: RealignInput): RealignResult {
  const { weeks, alts, log } = input;
  let moves: Record<string, unknown> = { ...input.moves };
  const used = new Set<string>();
  let moved = 0;
  for (const date of Object.keys(input.runsByDate)) {
    const plan = resolvePlan(weeks, { alts, moves });
    const occupant = plan.byDate.get(date as IsoDate);
    /* već ima pravi trkački dan — glavna petlja to rešava */
    if (occupant && !occupant.rest && occupant.km != null) continue;
    /* DAN SNAGE PRIMA TRČANJE: dan ostaje Snaga, a km se broje. */
    if (occupant && occupant.tag === 'snaga') continue;
    if (occupant && occupant.test) continue; // test dan se ne pomera
    const orphanWeek = weekOf(plan, date);
    if (!orphanWeek) continue; // van opsega plana — nema gde da se pomeri
    const runs = input.runsByDate[date] ?? [];
    const runKm = Math.max(...runs.map((a) => a.distance / 1000));
    let best: { id: string } | null = null;
    let bestDiff = Infinity;
    let bestKm = Infinity;
    for (const d of plan.dated) {
      if (d.rest || d.km == null) continue;
      if (d.w !== orphanWeek.w) continue; // swapDays zahteva istu nedelju
      if (used.has(d.id)) continue;
      if (log[d.id]?.status === 'done') continue; // odrađeno se ne dira
      if (input.runsByDate[d.date]) continue; // dan sa sopstvenim trčanjem u ovom paketu
      const dd = Math.abs(diffDays(d.date, date as IsoDate));
      if (dd === 0 || dd > REALIGN_DAY_WINDOW) continue;
      const kmDiff = Math.abs(d.km - runKm);
      if (kmDiff / d.km > REALIGN_KM_TOLERANCE) continue;
      if (dd < bestDiff || (dd === bestDiff && kmDiff < bestKm)) {
        bestDiff = dd;
        bestKm = kmDiff;
        best = d;
      }
    }
    if (best && occupant) {
      const res = swapDays(plan, log, moves, best.id, occupant.id);
      if (res.ok) {
        moves = res.moves;
        used.add(best.id);
        moved++;
      }
    }
  }
  return { moves, moved };
}
