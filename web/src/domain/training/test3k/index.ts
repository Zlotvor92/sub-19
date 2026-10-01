/* TEST NA 3 KM — najpouzdaniji ulaz u lanac forme.

   VDOT se računa DIREKTNO iz 3000 m (`vdotFromRace(3000, vreme)`), bez prevoda na tempo i nazad: svaki
   prevod dodaje grešku, a formula prima distancu i vreme kakvi jesu. Trka na 3 km traje ~11–13 min za
   trkača ovog nivoa, dakle u sredini prozora (10–30 min) u kome je Daniels–Gilbertova formula
   najtačnija — zato mu lanac veruje više nego trenažnim sesijama (α = 0,6, v. `VDOT_ALPHA`).

   Test živi u `t3k`, ne u `pred`: kvalitetne sesije su vezane za dan plana, a test se može istrčati kad
   god, više puta, i na planu koji nema test-dan. U lanac ulazi preko sopstvenog ID-ja (`t3k-…`). */

import { isIsoDate } from '../../date';
import { fmtDayMonth, r1 } from '../../format';
import type { T3kRecord, VdotRecord } from '../../state/types';
import { T3K_DIST_M, T3K_ID_PREFIX } from '../constants/product';
import type { PredictionRow } from '../types';
import { vdotFromRace } from '../vdot/calculateVDOT';
import { t3kPossible, vdotPossible } from '../vdot/limits';

/** VDOT testa, ili `null` kad vreme nije verodostojno. */
export function t3kVdot(sec: number): number | null {
  if (!(sec > 0)) return null;
  const v = r1(vdotFromRace(T3K_DIST_M, sec));
  return vdotPossible(v) ? v : null;
}

/** Verodostojni testovi, po datumu (stabilno). */
export function t3kSeries(list: readonly T3kRecord[] | null | undefined): T3kRecord[] {
  return (list ?? [])
    .filter((t) => t && t3kPossible(t.sec) && isIsoDate(t.date))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** ID novog testa. `suffix` daje pozivalac (nasumično), da domen ostane čist. */
export const newT3kId = (date: string, suffix: string): string =>
  `${T3K_ID_PREFIX}${date}-${suffix}`;

export interface T3kState {
  t3k: readonly T3kRecord[];
  vdotLog: readonly VdotRecord[];
}

/**
 * Dodaje test. Nemoguć test se NE upisuje ni u listu: da se upisao a samo ne bi ušao u lanac, stajao bi
 * na kartici kao priznat. Lanac se posle preračunava iz izmerenog (`recomputeVdotChain`).
 */
export function addT3k(
  state: T3kState,
  date: string,
  sec: number,
  suffix: string
): (T3kState & { id: string; measured: number }) | null {
  const s = Math.round(sec);
  if (!t3kPossible(s)) return null;
  const measured = t3kVdot(s);
  if (measured == null) return null;
  const id = newT3kId(date, suffix);
  return {
    id,
    measured,
    t3k: [...state.t3k, { id, date, sec: s }],
    vdotLog: upsertMeasurement(state.vdotLog, id, date, measured)
  };
}

/** Zapis u lancu: samo izmereno; `vdotMigrated` označava da zapis ne treba preračunavati zonama. */
export function upsertMeasurement(
  log: readonly VdotRecord[],
  id: string,
  ts: string,
  measured: number
): VdotRecord[] {
  const entry: VdotRecord = {
    id,
    ts,
    vdot: null,
    prev: null,
    delta: null,
    measured,
    vdotMigrated: true
  };
  const ix = log.findIndex((e) => e && e.id === id);
  return ix >= 0 ? log.map((e, i) => (i === ix ? entry : e)) : [...log, entry];
}

/** Uklanja test iz liste i iz lanca. */
export function removeT3k(state: T3kState, id: string): T3kState {
  return {
    t3k: state.t3k.filter((t) => t && t.id !== id),
    vdotLog: state.vdotLog.filter((e) => e && e.id !== id)
  };
}

export interface T3kRow extends Omit<PredictionRow, 'p5k'> {
  id: string;
  test3k: true;
  sec: number;
  date: string;
}

/**
 * Test kao red predikcije. Nedelja se traži po datumu (`weekOfDate`) da bi tačka pala na pravo mesto na
 * grafikonu; test van plana pada na najbližu ivicu, jer bi bez nedelje ispao iz grafikona sasvim.
 */
export function t3kRows(
  list: readonly T3kRecord[] | null | undefined,
  weekOfDate: (date: string) => number | null,
  planStart: string,
  planWeeks: number
): T3kRow[] {
  return t3kSeries(list).map((t) => ({
    id: t.id,
    w: weekOfDate(t.date) ?? (t.date < planStart ? 1 : planWeeks),
    l: `Test 3 km · ${fmtDayMonth(t.date)}`,
    q: T3K_DIST_M / 1000,
    pt: Math.round(t.sec / (T3K_DIST_M / 1000)),
    test3k: true,
    sec: t.sec,
    date: t.date
  }));
}
