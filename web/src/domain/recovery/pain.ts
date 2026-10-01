/* STATUS BOLA I FAZA POVRATKA. Sve se izvodi iz istorije bola — nikakvo novo stanje se ne čuva, pa nema
   migracije šeme ni rizika da marker ostane zaglavljen; ispravi se samo ako korisnik obriše ili izmeni
   unos. Ime polja `S.knee` je istorijsko: nosi mapu tela, ne samo jedan zglob. */

import { addDays, diffDays, isIsoDate, type IsoDate } from '../date';
import type { PainRecord } from '../state';
import {
  PAIN_DAYS_SEE_PHYSIO,
  PAIN_STOP,
  PAIN_WATCH,
  PAIN_WINDOW_DAYS,
  RETURN_LADDER,
  RETURN_LOOKBACK_DAYS
} from './constants';
import { isLoadBearing, partName } from './bodyParts';

export type PainStatusClass = 'ok' | 'warn' | 'stop';

export interface PainStatus {
  cls: PainStatusClass;
  /** Naslov kartice. */
  t: string;
  /** Pojašnjenje. */
  s: string;
}

const num = (x: unknown): x is number => typeof x === 'number';

/** Zapisi bola sa nosivim delovima u zatvorenom opsegu datuma. Oštećen unos (null) se preskače. */
export function loadBearingEntries(
  pain: readonly PainRecord[] | null | undefined,
  from: string,
  to: string
): PainRecord[] {
  return (pain ?? []).filter((k) => k && k.date >= from && k.date <= to && isLoadBearing(k.part));
}

/** Bol koji NE nosi trčanje — za poruku, da se ne pravimo da ga nema. */
export function nonLoadBearingPain(
  pain: readonly PainRecord[] | null | undefined,
  from: string,
  to: string
): { max: number; parts: string[] } | null {
  const w = (pain ?? []).filter(
    (k) => k && k.date >= from && k.date <= to && !isLoadBearing(k.part) && k.pain >= PAIN_WATCH
  );
  if (!w.length) return null;
  return {
    max: w.reduce((m, k) => Math.max(m, k.pain), 0),
    parts: [...new Set(w.map((k) => partName(k.part)))]
  };
}

export function painStatus(
  pain: readonly PainRecord[] | null | undefined,
  today: IsoDate
): PainStatus {
  const from = addDays(today, -(PAIN_WINDOW_DAYS - 1));
  const win = loadBearingEntries(pain, from, today);
  const mx = win.reduce((m, k) => Math.max(m, k.pain), 0);
  const ge3 = win.filter((k) => k.pain >= PAIN_WATCH).length;
  if (ge3 >= PAIN_DAYS_SEE_PHYSIO)
    return {
      cls: 'stop',
      t: 'FIZIJATAR',
      s: '3+ dana sa bolom ≥3 u poslednjih 7 dana — zakaži pregled.'
    };
  if (mx >= PAIN_STOP)
    return { cls: 'stop', t: 'STANI', s: 'Bol 6+ u poslednjih 7 dana. Pravilo iz plana: stani.' };
  if (mx >= PAIN_WATCH)
    return { cls: 'warn', t: 'PAZI', s: 'Bol 3–5 u poslednjih 7 dana. Prati i smanji ako raste.' };
  return {
    cls: 'ok',
    t: 'Bez povreda',
    s: '0 = bez bola · 3–5 = pazi · 6+ = stani · 3+ dana ≥3 u 7 dana = fizijatar'
  };
}

export interface ReturnPhase {
  /** 1–3 lestvica, 4 = lestvica prošla (važi samo ACWR granica). */
  week: 1 | 2 | 3 | 4;
  /** Udeo planiranog obima; u četvrtoj fazi 1 (bez procenta). */
  pct: number;
  daysSince: number;
  since: string;
}

/**
 * Faza povratka posle ozbiljne epizode bola. Nagli povratak na pun obim je klasičan način da se povreda
 * vrati — zato postepeno: 50 → 70 → 85 % → pun obim, po nedelju dana svaki korak (heuristika, ne nauka).
 *
 * Pojasevi se mere od KRAJA akutne faze (7 dana posle poslednjeg bola), ne od poslednjeg bola: inače bi
 * prva nedelja trajala tačno jedan dan. Lestvica se NE završava po kalendaru: u četvrtoj fazi važi
 * samo ACWR granica, pa se povratak sam završava kad hronično opterećenje sustigne plan (inače plan
 * skoči +40–70 % obima čoveku koji se upravo oporavio — izmereno na sve četiri distance).
 */
export function returnToRunPhase(
  pain: readonly PainRecord[] | null | undefined,
  today: IsoDate
): ReturnPhase | null {
  const all = (pain ?? []).filter((k) => k && isIsoDate(k.date) && num(k.pain));
  if (!all.length) return null;

  const lookback = addDays(today, -RETURN_LOOKBACK_DAYS);
  const inWindow = all.filter((k) => k.date >= lookback && k.date <= today);
  const hadSerious =
    inWindow.some((k) => k.pain >= PAIN_STOP) ||
    inWindow.filter((k) => k.pain >= PAIN_WATCH).length >= PAIN_DAYS_SEE_PHYSIO;
  if (!hadSerious) return null;

  /* Ako bol JOŠ traje, ovo je aktivna povreda — tim se bavi `injuryProposal`. */
  if (painStatus(pain, today).cls !== 'ok') return null;

  const painful = inWindow
    .filter((k) => k.pain >= PAIN_WATCH)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = painful[0];
  if (!latest) return null;
  const daysSince = diffDays(latest.date as IsoDate, today);
  const sinceClear = daysSince - PAIN_WINDOW_DAYS;
  if (sinceClear < 0) return null;

  const base = { daysSince, since: latest.date };
  if (sinceClear <= 6) return { week: 1, pct: RETURN_LADDER[0], ...base };
  if (sinceClear <= 13) return { week: 2, pct: RETURN_LADDER[1], ...base };
  if (sinceClear <= 20) return { week: 3, pct: RETURN_LADDER[2], ...base };
  return { week: 4, pct: 1, ...base };
}
