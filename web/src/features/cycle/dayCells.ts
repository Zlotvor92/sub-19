/* ĆELIJE DANA: 7 po nedelji (po–ne), vrsta treninga u tri nivoa težine + stanje. Čisto čitanje plana i dnevnika. */

import type { IsoDate } from '../../domain/date';
import { dowShort } from '../../domain/format';
import { dayLabel, type ResolvedDay, type ResolvedWeek } from '../../domain/plan';
import type { LogEntry } from '../../domain/state';

export type Kind = 'q' | 'l' | 's' | 'e';
export type CellState = 'done' | 'skip' | 'miss' | 'today' | 'next' | 'rest';

export interface Cell {
  kind: Kind;
  state: CellState;
  /** Opis za čitač ekrana („Sre — Fartlek, urađeno"). */
  label: string;
}

/** Težina treninga za boju oznake: kvalitet (tempo, intervali, trka, test), dugo, snaga, lagano. Tri nivoa, ne devet. */
export function kindOf(tag: ResolvedDay['tag']): Kind {
  if (tag === 'tempo' || tag === 'int' || tag === 'trka' || tag === 'test') return 'q';
  if (tag === 'lr') return 'l';
  if (tag === 'snaga') return 's';
  return 'e';
}

const STATE_WORD: Readonly<Record<CellState, string>> = {
  done: 'urađeno',
  skip: 'preskočeno',
  miss: 'propušteno',
  today: 'danas',
  next: 'predstoji',
  rest: 'odmor'
};
const DOW = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'] as const;

export function weekCells(
  week: Pick<ResolvedWeek, 'days'>,
  log: Readonly<Record<string, LogEntry>>,
  today: IsoDate
): Cell[] {
  const byDow = new Map<number, ResolvedDay>();
  for (const d of week.days) if (!d.test && !byDow.has(d.dow)) byDow.set(d.dow, d);
  return DOW.map((name, i) => {
    const d = byDow.get(i);
    if (!d || d.rest) return { kind: 'e', state: 'rest', label: `${name} — odmor` };
    const status = log[d.id]?.status;
    const state: CellState =
      status === 'done'
        ? 'done'
        : status === 'skip'
          ? 'skip'
          : d.date === today
            ? 'today'
            : d.date && d.date < today
              ? 'miss'
              : 'next';
    return {
      kind: kindOf(d.tag),
      state,
      label: `${d.date ? dowShort(d.date) : name} — ${dayLabel(d, false)}, ${STATE_WORD[state]}`
    };
  });
}
