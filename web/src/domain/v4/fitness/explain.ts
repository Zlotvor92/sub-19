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

export interface ResultContext {
  /** Deo razlike koji je usvojen (0–1). */
  k: number;
  /** Prvi rezultat (pre njega nije bilo ni trke ni testa u aplikaciji). */
  first: boolean;
  /** Dokaz preveden na dužinu cilja (F4-K2); bez njega = `ev.vdot`. */
  target?: Vdot;
  /** Dužina 0,5–2 × cilja. */
  inRange?: boolean;
  /** Toplota je zadržala pad procene (upola ili potpuno). */
  hotHeld?: boolean;
  /** Umanjenje pri prenosu na dužu ciljnu dužinu (VDOT). */
  transferLoss?: number;
  weeklyKm?: number | null;
  /** β je delom iz trkačevih rezultata na dve dužine. */
  personalBeta?: boolean;
}

/** Test ili trka upisani kao jedna aktivnost sa zagrevanjem: nije dokaz forme dok trkač ne unese vreme (K1). */
export function explainUnusable(
  kind: 'trka' | 'test',
  date: IsoDate,
  activityM: Meters,
  plannedM: Meters
): string {
  const what = kind === 'trka' ? 'Trka' : 'Test';
  return `${what} ${shortDate(date)} je upisan${kind === 'trka' ? 'a' : ''} kao jedna aktivnost od ${km(activityM)} zajedno sa zagrevanjem i hlađenjem, pa iz nje ne mogu da izdvojim vreme na ${km(plannedM)}. Upiši vreme na ${km(plannedM)} da bih prilagodio tempa i prognozu; do tada procena ostaje ista.`;
}

export function explainResult(
  kind: 'trka' | 'test',
  date: IsoDate,
  distanceM: Meters,
  timeSec: Seconds,
  ev: ResultEvidence,
  ctx: ResultContext,
  before: Vdot,
  after: Vdot,
  goalM: Meters
): string {
  const what = kind === 'trka' ? 'Trka' : 'Test';
  const parts = [`${what} ${shortDate(date)}: ${km(distanceM)} za ${clock(timeSec)}.`];
  if (ev.walking) {
    parts.push(
      'U trci je bilo hodanja, pa se rezultat uzima kakav je, bez ikakve korekcije, a procena ima srednju pouzdanost dok je ne potvrdi još jedan test ili trka.'
    );
  } else if (ctx.first) {
    parts.push(
      'Ovo je prvi rezultat koji imam, pa procena ima srednju pouzdanost dok je ne potvrdi još jedan test ili trka.'
    );
  }
  if (ev.splitBonus > 0) {
    const asRun = clock(raceTimeSec(ev.rawVdot, distanceM));
    const corrected = clock(raceTimeSec(ev.vdot, distanceM));
    parts.push(
      `Druga polovina je bila izrazito brža od prve: deo snage je ostao neiskorišćen, pa se ${asRun} računa kao ${corrected}.`
    );
  }
  const loss = ctx.transferLoss ?? 0;
  if (loss <= -0.01) {
    parts.push(
      `Rezultat sa ${km(distanceM)} prenosim na kraću ${km(goalM)}: na kraćoj trci tempo je brži, pa se forma računa nešto bolje.`
    );
  } else if (loss >= 0.01) {
    const why =
      ctx.personalBeta === true
        ? 'tvoji rezultati na kraćoj i dužoj trci pokazuju koliko ti tempo pada sa dužinom'
        : ctx.weeklyKm !== undefined && ctx.weeklyKm !== null
          ? `uz oko ${String(Math.round(ctx.weeklyKm))} km nedeljno izdržljivost za dužu trku još nije na nivou brzine sa kraće`
          : 'izdržljivost za dužu trku se sa kraće trke ne vidi';
    parts.push(`Rezultat sa ${km(distanceM)} prenosim na ${km(goalM)} uz umanjenje, jer ${why}.`);
  }
  if (ev.hot && ctx.hotHeld === true && ctx.inRange !== false) {
    parts.push(
      'Bilo je vruće (25 °C ili više), pa se rezultat usvaja samo upola: stvarna forma je verovatno nešto bolja.'
    );
  } else if (ev.hot && ctx.hotHeld === true) {
    parts.push(
      'Bilo je vruće (25 °C ili više), a trka je druge dužine, pa rezultat procenu ne spušta: forma je verovatno bolja od ovog vremena.'
    );
  } else if (ev.hot && after < before) {
    parts.push(
      'Bilo je vruće (25 °C ili više), pa je stvarna forma verovatno nešto bolja od ovog rezultata.'
    );
  } else if (ev.hot) {
    parts.push('Bilo je vruće (25 °C ili više), pa se rezultat uzima kao donja granica forme.');
  }
  const target = ctx.target ?? ev.vdot;
  if (ctx.k < 1 && Math.abs(after - target) >= 0.01) {
    parts.push(
      `Usvaja se ${String(Math.round(ctx.k * 100))} % razlike, jer je i ranija procena imala osnov u rezultatima i treninzima.`
    );
  }
  parts.push(`${capital(move(before, after, goalM))}.`);
  return parts.join(' ');
}

/** R12: odrađena nedelja plana. `share` = pridržavanje (0–1+). */
export function explainPlanWeek(
  from: IsoDate,
  to: IsoDate,
  share: number,
  before: Vdot,
  after: Vdot,
  goalM: Meters
): string {
  return `Nedelja ${shortDate(from)} – ${shortDate(to)} odrađena je po planu (oko ${pctWhole(share)} planiranog opterećenja): deo napretka koji plan očekuje do trke pripisuje se formi — ${move(before, after, goalM)}; očekivano vreme na dan trke ostaje isto.`;
}

/** R12: nedelja odrađena delimično ili nikako — očekivani napredak do trke je manji. */
export function explainPlanShortfall(
  from: IsoDate,
  to: IsoDate,
  share: number,
  lostSec: Seconds,
  before: Vdot,
  after: Vdot,
  goalM: Meters
): string {
  const credited =
    Math.abs(after - before) >= 0.01
      ? ` Deo napretka je ipak pripisan formi (${move(before, after, goalM)}).`
      : '';
  return `Nedelja ${shortDate(from)} – ${shortDate(to)} odrađena je oko ${pctWhole(share)} planiranog opterećenja, pa se očekivani napredak do trke smanjuje: očekivano vreme na dan trke je oko ${seconds(lostSec)} sporije.${credited}`;
}

/** § 14.6: 12 nedelja bez bržih treninga — veća rezerva napretka. */
export function explainNoQuality(fromDay: number, toDay: number): string {
  const iso = (n: number): IsoDate => new Date(n * 86_400_000).toISOString().slice(0, 10);
  return `Od ${shortDate(iso(fromDay))} do ${shortDate(iso(toDay))} nema nijednog bržeg treninga, pa je rezerva napretka veća: očekivano vreme na dan trke je zato nešto brže.`;
}

/** R13: pad baze. */
export function explainBaseDrop(ratio: number, before: Vdot, after: Vdot, goalM: Meters): string {
  return `Poslednjih šest nedelja trčiš znatno manje nego pre (oko ${pctWhole(ratio)} ranijeg obima); forma polako opada kad obim dugo stoji nisko — ${move(before, after, goalM)}. Kad se obim vrati, prvi test ili trka pokazuju pravo stanje.`;
}

function pctWhole(x: number): string {
  return `${String(Math.round(x * 100))} %`;
}

function seconds(sec: Seconds): string {
  const s = Math.max(1, Math.round(sec));
  return s >= 60 ? clock(s) : `${String(s)} ${plural(s, 'sekundu', 'sekunde', 'sekundi')}`;
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
