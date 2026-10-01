/* IZMENA TRENINGA — stanje nacrta u ekranu „Izmeni trening" kao čiste funkcije (bez DOM-a).

   Kratak dodir bira JEDAN tip i skida dodatu snagu; DUGO DRŽANJE uz trkački tip dodaje snagu (ili uz snagu trkački tip) — dan
   tada nosi trčanje (km, tempo, sinhronizacija, obim), a oznaka kaže „+ Snaga". Opis se menja u šablon SAMO ako ga korisnik
   nije već dirao (još je opis iz plana). */

import { extractPaceFromDesc } from '../activities';
import { fmtKm } from '../format';
import { STRENGTH_WITH, type AltRecord } from '../state';
import type { ResolvedDay } from './types';

export const ALT_TYPES: ReadonlyArray<readonly [tag: string, label: string]> = [
  ['lako', 'Lako'],
  ['int', 'Intervali'],
  ['tempo', 'Tempo'],
  ['lr', 'Dugo'],
  ['snaga', 'Snaga'],
  ['odmor', 'Odmor'],
  ['trka', 'Trka']
];

/** Distance koje se nude kad je izabrana Trka (kilometraža ostaje i ručno upisiva, za nestandardne trke). */
export const RACE_DISTANCES: ReadonlyArray<readonly [km: number, label: string]> = [
  [5, '5 km'],
  [10, '10 km'],
  [21.1, 'Polumaraton'],
  [42.2, 'Maraton']
];

/** Koliko se drži dugme (ms) da bi se tip DODAO, ne izabrao. */
export const ALT_HOLD_MS = 600;

export function raceNameForKm(km: number | null | undefined): string {
  const t = RACE_DISTANCES.find(([k]) => km != null && Math.abs(k - km) < 0.05);
  if (t) return t[1];
  return km != null && Number.isFinite(km) ? `${fmtKm(km)} km` : '';
}

const hasKm = (km: unknown): boolean => km != null && km !== '';

/** Šablon opisa za tip (opis iz plana se menja u njega tek kad ga korisnik nije dirao). */
export function altDescTemplate(tag: string, km: number | string | null | undefined): string {
  const k = hasKm(km) ? `${fmtKm(km)} km ` : '';
  switch (tag) {
    case 'lako':
      return `${k}lako (Z2)`;
    case 'lr':
      return `${k}LR (Z2)`;
    case 'int':
      return 'Intervali — unesi strukturu';
    case 'tempo':
      return 'Tempo — unesi strukturu';
    case 'snaga':
      return 'Snaga / mobilnost';
    case 'odmor':
      return 'Odmor';
    case 'trka': {
      if (!hasKm(km)) return '🏁 Trka';
      const n = Number(km);
      const exact = RACE_DISTANCES.some(
        ([d, name]) => name !== `${fmtKm(d)} km` && Math.abs(d - n) < 0.05
      );
      return `🏁 Trka — ${raceNameForKm(n)}${exact ? ` (${fmtKm(n)} km)` : ''}`;
    }
    default:
      return '';
  }
}

export interface AltDraft {
  tag: string;
  km: number | null;
  desc: string;
  pace: number | null;
  snaga: boolean;
}

/** Polazni nacrt: dan kakav je sada; ručni cilj tempa i run/walk žive u `alts`; bez njih bi se „Ciljni tempo" otvarao prazan. */
export function initialAltDraft(
  day: Pick<ResolvedDay, 'rest' | 'tag' | 'km' | 'desc'>,
  existing: AltRecord | undefined,
  fallbackPace: number | null
): AltDraft {
  const pace =
    existing && existing.pace != null
      ? existing.pace
      : (extractPaceFromDesc(day.desc) ?? fallbackPace);
  return {
    tag: day.rest ? 'odmor' : (day.tag ?? 'lako'),
    km: day.km,
    desc: day.desc || '',
    pace,
    snaga: !!existing?.snaga
  };
}

/** Kratak dodir na tip. */
export function chooseType(d: AltDraft, tag: string, originalDesc: string | null): AltDraft {
  const keepsDesc = d.desc && d.desc !== (originalDesc ?? '');
  return { ...d, tag, snaga: false, desc: keepsDesc ? d.desc : altDescTemplate(tag, d.km) };
}

/** Dugo držanje tipa: dodaje snagu uz trkački tip (ili trkački tip uz snagu). `null` kad držanje ne znači ništa. */
export function holdType(d: AltDraft, tag: string): AltDraft | null {
  const cur = d.tag;
  if (tag === 'snaga' && STRENGTH_WITH.has(cur)) return { ...d, snaga: !d.snaga };
  if (STRENGTH_WITH.has(tag) && (cur === 'snaga' || (STRENGTH_WITH.has(cur) && d.snaga)))
    return { ...d, tag, snaga: true };
  return null;
}

/** Izbor dužine trke; opis prati dužinu dok ga korisnik sam nije menjao. */
export function chooseRaceKm(d: AltDraft, km: number, originalDesc: string | null): AltDraft {
  const untouched =
    d.desc === altDescTemplate('trka', d.km) || d.desc === (originalDesc ?? '') || !d.desc;
  return { ...d, km, desc: untouched ? altDescTemplate('trka', km) : d.desc };
}

/** „🔍 Iz opisa": tempo iz opisa („@ m:ss/km") ili poruka zašto nije prepoznat. */
export function paceFromDraftDesc(
  d: AltDraft
): { ok: true; draft: AltDraft } | { ok: false; err: string } {
  const found = extractPaceFromDesc(d.desc);
  return found != null
    ? { ok: true, draft: { ...d, pace: found } }
    : { ok: false, err: 'Nije prepoznat tempo u opisu (format „@ m:ss/km") — unesi ručno.' };
}
