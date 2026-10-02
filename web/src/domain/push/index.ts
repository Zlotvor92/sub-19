/* OBAVEŠTENJA: šta stoji u jutarnjem podsetniku. Računa se OVDE (na uređaju), ne na serveru: plan, tempo i tipovi sesija žive u aplikaciji i tu
   ostaju — serverska kopija te logike bi se razišla prvom izmenom plana. Prazan tekst = dan odmora; server ga vidi i tada ne šalje ništa. */

import { addDays, parseIsoDate } from '../date';
import { fmtKm } from '../format';
import { sessKind, type ResolvedPlan } from '../plan';

/** Koliko narednih dana nosi najava (danas + 7). */
export const ANNOUNCE_DAYS = 8;
export const ANNOUNCE_MAX_CHARS = 120;

export function weekAnnouncements(
  plan: Pick<ResolvedPlan, 'byDate'>,
  today: string,
  hasAlt: (id: string) => boolean
): Record<string, string> {
  const start = parseIsoDate(today);
  const out: Record<string, string> = {};
  if (!start) return out;
  for (let i = 0; i < ANNOUNCE_DAYS; i++) {
    const date = addDays(start, i);
    const d = plan.byDate.get(date);
    if (!d || d.rest) {
      out[date] = '';
      continue;
    }
    const kind = String(sessKind(d, hasAlt(d.id)) || 'Trening');
    out[date] = (d.km ? `${kind} · ${fmtKm(d.km)} km` : kind).slice(0, ANNOUNCE_MAX_CHARS);
  }
  return out;
}
