/* V4 — FORMA: rečenice za `FormChange.reason` („zašto se promenilo", SPEC § 7.1, § 14.2).
   Srpski, latinica, ekavica; pravilna množina; decimalni zarez; datumi „3. 10."; bez internih izraza. */
import { raceTimeSec } from '../engine/vdot';
import type { IsoDate, Meters, Seconds, Vdot } from '../engine/types';
import type { ResultEvidence } from './types';

/** Oblik imenice uz broj: 1 nedelja, 2 nedelje, 5 nedelja (11–14 uvek treći oblik). */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const d10 = abs % 10;
  const d100 = abs % 100;
  if (d10 === 1 && d100 !== 11) return one;
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
  return many;
}

export const days = (n: number): string => `${n} ${plural(n, 'dan', 'dana', 'dana')}`;
export const weeks = (n: number): string => `${n} ${plural(n, 'nedelja', 'nedelje', 'nedelja')}`;

export function shortDate(iso: IsoDate): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)}. ${Number(m)}.`;
}

export function clock(sec: Seconds): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function km(m: Meters): string {
  const v = Math.round(m / 100) / 10;
  return `${String(v).replace('.', ',')} km`;
}

function pct(x: number): string {
  return `${String(Math.round(x * 1000) / 10).replace('.', ',')} %`;
}

/** „procena za 21,1 km: 1:44:10 → 1:42:30" — forma se trkaču kaže kao vreme na distanci cilja (§ 0). */
function move(before: Vdot, after: Vdot, goalM: Meters): string {
  const b = clock(raceTimeSec(before, goalM));
  const a = clock(raceTimeSec(after, goalM));
  if (b === a) return `procena za ${km(goalM)} ostaje ${a}`;
  return `procena za ${km(goalM)}: ${b} → ${a}`;
}

export function explainStart(
  source: 'rezultat' | 'lagani-tempo' | 'trcanja' | 'nista',
  vdot: Vdot,
  goalM: Meters
): string {
  const t = clock(raceTimeSec(vdot, goalM));
  switch (source) {
    case 'rezultat':
      return `Polazna procena je iz rezultata koji si uneo: oko ${t} za ${km(goalM)}.`;
    case 'lagani-tempo':
      return `Polazna procena je iz laganog tempa koji si uneo: oko ${t} za ${km(goalM)}. Prvi test ili trka je preciziraju.`;
    case 'trcanja':
      return `Polazna procena je iz tempa tvojih laganih trčanja: oko ${t} za ${km(goalM)}. Prvi test ili trka je preciziraju.`;
    case 'nista':
      return `Nema rezultata ni trčanja, pa je polazna procena opšta (oko ${t} za ${km(goalM)}); tempa su po osećaju dok ne stigne prvi test.`;
  }
}

export function explainResult(
  kind: 'trka' | 'test',
  date: IsoDate,
  distanceM: Meters,
  timeSec: Seconds,
  ev: ResultEvidence,
  before: Vdot,
  after: Vdot,
  goalM: Meters
): string {
  const what = kind === 'trka' ? 'Trka' : 'Test';
  const parts = [`${what} ${shortDate(date)}: ${km(distanceM)} za ${clock(timeSec)}.`];
  if (ev.splitBonus > 0) {
    parts.push(
      'Druga polovina je bila izrazito brža od prve, pa rezultat malo potcenjuje formu i računa se nešto bolje.'
    );
  }
  if (ev.hot && after < before) {
    parts.push('Bilo je toplo, pa je stvarna forma verovatno nešto bolja od ovog rezultata.');
  } else if (ev.hot) {
    parts.push('Bilo je toplo, pa se rezultat uzima kao donja granica forme.');
  }
  parts.push(`${capital(move(before, after, goalM))}.`);
  return parts.join(' ');
}

export function explainQuality(
  date: IsoDate,
  held: boolean,
  before: Vdot,
  after: Vdot,
  goalM: Meters
): string {
  const head = held
    ? `Trening kvaliteta ${shortDate(date)} odrađen brže od zadatog tempa`
    : `Trening kvaliteta ${shortDate(date)} nije odrađen u zadatom tempu`;
  return `${head}; jedan trening pomera procenu samo malo — ${move(before, after, goalM)}.`;
}

export function explainHeartRate(
  date: IsoDate,
  trend: number,
  before: Vdot,
  after: Vdot,
  goalM: Meters
): string {
  const dir = trend > 0 ? 'niži' : 'viši';
  return `Na laganim trčanjima je puls pri istom tempu ${dir} nego pre nekoliko nedelja (${pct(Math.abs(trend))}); ${move(before, after, goalM)} (stanje ${shortDate(date)}).`;
}

export function explainPause(
  from: IsoDate,
  to: IsoDate,
  n: number,
  before: Vdot,
  after: Vdot,
  goalM: Meters
): string {
  return `Bez trčanja ${days(n)} (${shortDate(from)} – ${shortDate(to)}); posle petog dana forma polako opada — ${move(before, after, goalM)}.`;
}

function capital(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
