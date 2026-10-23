import type { Day } from '../types';

export interface WeekKind {
  isDeload: boolean;
  isTaper1: boolean;
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
  /* 10K generator ne pravi brz završetak dugog trčanja; nedelju opisuju njene sesije. */
  for (const d of days) {
    const k = d.session?.kind;
    if (k && !kinds.includes(k)) kinds.push(k);
  }
  if (!kinds.length) return st.isTaper1 ? 'Taper — obim dole, oštrina ostaje' : '';
  const list = kinds.join(' + ');
  if (st.isTaper1) return `Taper · ${list}`;
  return list;
}

/** Final delivered focus also covers unstructured manual types and removed quality. */
export function deliveredWeekFocus(days: readonly Day[], st: WeekKind): string {
  if (st.isRace) return 'TRKA';
  const kinds: string[] = [];
  for (const d of days) {
    if (d.rest) continue;
    const k = d.finish
      ? 'LR sa brzim završetkom'
      : (d.session?.kind ??
        (d.tag === 'tempo'
          ? 'Tempo'
          : d.tag === 'int'
            ? 'Intervali'
            : d.strides
              ? 'Ubrzanja'
              : undefined));
    if (k && !kinds.includes(k)) kinds.push(k);
  }
  const list = kinds.length ? kinds.join(' + ') : 'Lagano trčanje — bez kvaliteta i ubrzanja';
  if (st.isDeload) return `DELOAD · ${list}`;
  if (st.isTaper1) return `Taper · ${list}`;
  return list;
}
