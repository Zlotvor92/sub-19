/* PODACI IZ ČAROBNJAKA kao čitljiv spisak (Ti → Moj profil): ono što je plan dobio kao ulaz. Samo čitanje — plan se ne može „urediti“ izvan čarobnjaka,
   jer ulaz određuje celu pripremu; menja se cilj (Ti → Cilj) ili se pravi novi plan (Plan → Prilagodi plan). Polje koje ne postoji ili nije ispravno se
   preskače, ne izmišlja se. */

import { parseIsoDate } from '../../domain/date';
import { fmtClock, fmtDayLong, fmtKm } from '../../domain/format';

export interface ProfileRow {
  label: string;
  value: string;
}

const obj = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const pos = (x: unknown): number | null =>
  typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : null;

/** „5 km“, „Polumaraton“, „Maraton“; neuobičajena distanca u kilometrima. */
export function distanceName(m: number): string {
  if (Math.abs(m - 5000) < 50) return '5 km';
  if (Math.abs(m - 10000) < 50) return '10 km';
  if (Math.abs(m - 21097.5) < 50) return 'Polumaraton';
  if (Math.abs(m - 42195) < 50) return 'Maraton';
  return `${fmtKm(m / 1000)} km`;
}

const RAMP: Readonly<Record<string, string>> = {
  kons: 'konzervativno',
  std: 'standardno',
  agr: 'agresivno'
};

export function profileRows(ulaz: unknown): ProfileRow[] {
  const u = obj(ulaz);
  if (!u) return [];
  const rows: ProfileRow[] = [];
  const raceM = pos(u['raceDistM']);
  if (raceM) rows.push({ label: 'Trka', value: distanceName(raceM) });
  const date = parseIsoDate(u['raceDate']);
  if (date) rows.push({ label: 'Datum trke', value: fmtDayLong(date).toLowerCase() });
  const goal = pos(u['goalSec']);
  if (goal) rows.push({ label: 'Ciljno vreme', value: fmtClock(goal) });
  const pb = obj(u['pb']);
  const pbM = pos(pb?.['distM']);
  const pbSec = pos(pb?.['sec']);
  if (pbM && pbSec)
    rows.push({ label: 'Polazni rezultat', value: `${distanceName(pbM)} · ${fmtClock(pbSec)}` });
  const weekly = pos(u['weeklyKm']);
  if (weekly) rows.push({ label: 'Nedeljni obim na startu', value: `${fmtKm(weekly)} km` });
  const days = pos(u['runDays']);
  if (days) rows.push({ label: 'Dana trčanja nedeljno', value: String(days) });
  const q = typeof u['quality'] === 'number' ? u['quality'] : null;
  if (q != null && q >= 0) rows.push({ label: 'Kvalitetnih treninga nedeljno', value: String(q) });
  const forma = typeof u['intensity'] === 'string' ? RAMP[u['intensity']] : undefined;
  if (forma) rows.push({ label: 'Tempo rasta forme', value: forma });
  const obim = typeof u['volIntensity'] === 'string' ? RAMP[u['volIntensity']] : undefined;
  if (obim) rows.push({ label: 'Tempo rasta obima', value: obim });
  return rows;
}
