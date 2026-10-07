import type { Day } from '../types';

export interface WeekKind {
  isDeload: boolean;
  isTaper1: boolean;
  isTaper2: boolean;
  isRace: boolean;
  isBase: boolean;
}

/**
 * Čemu nedelja služi — gradi se IZ STVARNIH sesija te nedelje (faza se već
 * prikazuje pored). „DELOAD" ostaje PREFIKS: `weekPhase` i dnevni izveštaj
 * prepoznaju rasterećenje po toj reči.
 */
export function weekFocus(days: readonly Day[], st: WeekKind): string {
  if (st.isRace) return 'TRKA';
  if (st.isDeload) return 'DELOAD — obim dole, ostaje kratka oštrina';
  if (st.isBase) return 'Baza — aerobni obim, bez kvaliteta';
  const kinds: string[] = [];
  for (const d of days) {
    const k = d.finish ? 'LR sa brzim završetkom' : d.session?.kind;
    if (k && !kinds.includes(k)) kinds.push(k);
  }
  if (!kinds.length) return st.isTaper1 || st.isTaper2 ? 'Taper — obim dole, oštrina ostaje' : '';
  const list = kinds.join(' + ');
  if (st.isTaper1 || st.isTaper2) return `Taper · ${list}`;
  return list;
}
