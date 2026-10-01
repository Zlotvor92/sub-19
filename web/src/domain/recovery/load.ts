/* OPTEREĆENJE: akutno, hronično, ostvarenost i prekid.

   Sve su ČISTE funkcije (plan, dnevnik, trčanja pre plana) → broj. Stari kod ih je čitao iz globalnog
   stanja; ovde je kontekst eksplicitan, pa su testabilne bez ekrana.

   ACWR (acute:chronic workload ratio): pojam i pojas 0,8–1,3 su iz literature, ali DOKAZ da odnos
   predviđa povredu je sporan (Impellizzeri i sar., 2020: matematička povezanost brojioca i imenioca).
   Ovde se koristi kao ograda za doziranje povratka, ne kao predviđanje. */

import { addDays, diffDays, isIsoDate, type IsoDate } from '../date';
import type { LogEntry } from '../state';
import type { ResolvedDay, ResolvedPlan } from '../plan/types';
import { BREAK_THRESHOLD, BREAK_WINDOW_DAYS } from './constants';

export interface LoadContext {
  plan: ResolvedPlan;
  log: Readonly<Record<string, LogEntry>>;
  /** `datum → km` trčanja PRE prvog dana plana (sinhronizacija ih puni). */
  outOfPlan: Readonly<Record<string, number>>;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;
const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * Kog je DANA trening stvarno odrađen: pravi datum iz Strave, pa ručno uneti, pa planski. Prihvata se
 * samo niska oblika GGGG-MM-DD jer se datumi porede kao niske; u starijim zapisima `ts` ume da bude
 * broj (epoch), a `'1785834000' >= '2026-…'` je poređenje koje uvek laže.
 */
export function workoutDate(
  l: Pick<LogEntry, 'runDate' | 'ts'> | null | undefined,
  d: Pick<ResolvedDay, 'date'> | null | undefined
): string | null {
  const k = [l?.runDate, l?.ts, d?.date].find(
    (x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x)
  );
  return k ? k.slice(0, 10) : null;
}

/** Km koji je dan stvarno odrađen: upisano ili, kad nije upisano, planirano. */
export function realKm(
  log: Readonly<Record<string, LogEntry>>,
  d: Pick<ResolvedDay, 'id' | 'km'>
): number {
  const l = log[d.id];
  if (!l || l.status !== 'done') return 0;
  return l.km != null ? l.km : d.km || 0;
}

const doneKm = (l: LogEntry, d: ResolvedDay): number => (l.km != null ? l.km : d.km || 0);

/** Zbir trčanja pre plana u zatvorenom opsegu datuma. */
export function outOfPlanKm(
  outOfPlan: Readonly<Record<string, number>>,
  from: string,
  to: string
): number {
  let km = 0;
  for (const dt in outOfPlan) if (dt >= from && dt <= to) km += +(outOfPlan[dt] as number) || 0;
  return round1(km);
}

/**
 * Upis trčanja pre plana iz sinhronizacije (`datum → km`). Starije od 35 dana pre plana se ne čuva;
 * trčanja od prvog dana plana nemaju šta da traže ovde (imaju dan plana). Vraća novu mapu ili `null`
 * kad nema promene.
 */
export function recordOutOfPlan(
  current: Readonly<Record<string, number>>,
  kmByDay: Readonly<Record<string, number>>,
  planStart: IsoDate
): Record<string, number> | null {
  const oldest = addDays(planStart, -35);
  const next: Record<string, number> = { ...current };
  let changed = false;
  for (const dt of Object.keys(kmByDay)) {
    if (!isIsoDate(dt) || dt >= planStart || dt < oldest) continue;
    const v = Math.round((kmByDay[dt] as number) * 100) / 100;
    if (v > 0 && next[dt] !== v) {
      next[dt] = v;
      changed = true;
    }
  }
  for (const dt of Object.keys(next)) {
    if (dt < oldest || dt >= planStart) {
      delete next[dt];
      changed = true;
    }
  }
  return changed ? next : null;
}

/** Prvi dan plana (granica „van plana"). */
export const planBoundary = (plan: ResolvedPlan): string | null =>
  plan.dated[0]?.date ?? plan.weeks[0]?.start ?? null;

/**
 * Koliko je od PLANIRANOG obima u prozoru zaista odrađeno. Meri se od ORIGINALNE kilometraže (ne
 * trenutne): da se gleda trenutna, prihvaćen predlog bi sam sebi podigao ostvarenost na 100 % i sakrio
 * prekid koji je do njega i doveo.
 */
export function completion(
  ctx: LoadContext,
  today: IsoDate,
  windowDays = BREAK_WINDOW_DAYS
): number | null {
  const from = addDays(today, -windowDays);
  const to = addDays(today, -1);
  let planned = 0;
  let real = 0;
  for (const w of ctx.plan.weeks)
    for (const d of w.days) {
      if (d.rest || d.tag === 'trka') continue;
      /* Snaga nema planske km, ali trčanje upisano na taj dan jeste istrčano. */
      if (d.tag !== 'snaga' && d.date >= from && d.date <= to)
        planned += (d.origin.km != null ? d.origin.km : d.km) || 0;
      const l = ctx.log[d.id];
      if (!l || l.status !== 'done') continue;
      const dat = workoutDate(l, d);
      if (dat && dat >= from && dat <= to) real += doneKm(l, d);
    }
  if (!(planned > 0)) return null;
  return round2(real / planned);
}

/**
 * NAJVEĆI ZAISTA ODRAĐEN NEDELJNI OBIM u poslednjih `daysBack` dana — najveći zbir bilo kojih sedam
 * uzastopnih dana. Zašto ne prosto akutni obim: on se KOTRLJA i opada svakog dana, pa bi isti predlog u
 * ponedeljak nudio 22 km a u sredu 16 km bez ijednog novog podatka. Najveći blok u prozoru je stabilan.
 */
export function largestWeeklyKm(ctx: LoadContext, today: IsoDate, daysBack = 14): number {
  const perDay: Record<string, number> = {};
  for (const w of ctx.plan.weeks)
    for (const d of w.days) {
      const l = ctx.log[d.id];
      if (!l || l.status !== 'done') continue;
      const dat = workoutDate(l, d);
      if (dat) perDay[dat] = (perDay[dat] || 0) + doneKm(l, d);
    }
  let best = 0;
  for (let k = 0; k <= daysBack - 7; k++) {
    const end = addDays(today, -k);
    let s = 0;
    for (let i = 0; i < 7; i++) s += perDay[addDays(end, -i)] || 0;
    if (s > best) best = s;
  }
  return round1(best);
}

/** Dana od poslednjeg odrađenog trčanja. `null` = u dnevniku nema nijednog. */
export function daysWithoutRunning(ctx: LoadContext, today: IsoDate): number | null {
  let last: string | null = null;
  for (const w of ctx.plan.weeks)
    for (const d of w.days) {
      const l = ctx.log[d.id];
      if (!l || l.status !== 'done') continue;
      const dat = workoutDate(l, d);
      if (dat && dat <= today && (last == null || dat > last)) last = dat;
    }
  return last == null || !isIsoDate(last) ? null : diffDays(last, today);
}

export interface BreakInfo {
  completion: number;
  daysWithoutRunning: number | null;
}

/**
 * Prekid postoji kad je u odrađenom stvaran manjak (ostvarenost ≤ 0,70). Da li je OPASAN odlučuje ACWR
 * granica u `injuryProposal`: ako sledećih sedam dana staju u 1,3 × hronično, ništa se ne predlaže.
 * Dva uslova zajedno su obavezna: samo ACWR bi okidao i kod trkača koji nije propustio nijedan trening.
 */
export function breakInfo(ctx: LoadContext, today: IsoDate): BreakInfo | null {
  const o = completion(ctx, today);
  if (o == null || o > BREAK_THRESHOLD) return null;
  return { completion: o, daysWithoutRunning: daysWithoutRunning(ctx, today) };
}

/**
 * HRONIČNO OPTEREĆENJE — prosek stvarno odrađenog obima poslednje 4 ZAVRŠENE nedelje.
 *
 * Samo završene nedelje: sa tekućom bi imenilac u utorak preko noći pao 17–18 %, a odnos skočio kod
 * čoveka koji nije propustio nijedan trening. Plan nema četiri završene nedelje na početku, pa se
 * nedostajuće dopunjuju kalendarskim nedeljama PRE plana iz `outOfPlan` (bez tih podataka — samo
 * završene nedelje plana). Nule se broje (tri nedelje pauze zaista spuštaju opterećenje); ako je sve
 * nula, nema od čega da se računa → `null`.
 */
export function chronicKm(ctx: LoadContext, today: IsoDate): number | null {
  const finished = ctx.plan.weeks.filter((w) => addDays(w.start, 6) < today);
  const hasOutside = Object.keys(ctx.outOfPlan).length > 0;
  const weekKm = (w: { start: IsoDate; days: ResolvedDay[] }): number =>
    w.days.reduce((s, d) => s + realKm(ctx.log, d), 0) +
    outOfPlanKm(ctx.outOfPlan, w.start, addDays(w.start, 6));
  const weeks = finished.slice(-4).map(weekKm);
  const start = ctx.plan.weeks[0]?.start;
  if (hasOutside && start) {
    for (let k = 1; weeks.length < 4; k++) {
      const from = addDays(start, -7 * k);
      weeks.unshift(outOfPlanKm(ctx.outOfPlan, from, addDays(from, 6)));
    }
  }
  if (!weeks.length) return null;
  if (!weeks.some((v) => v > 0)) return null;
  return round1(weeks.reduce((a, b) => a + b, 0) / weeks.length);
}

/**
 * AKUTNO OPTEREĆENJE — km poslednjih sedam dana, kotrljajuće (danas i šest dana unazad). Namerno NE
 * „tekuća nedelja": u utorak bi ona sadržala jedan trening, pa bi odnos ispao bezopasan baš onda kad je
 * najkorisniji.
 */
export function acuteKm(ctx: LoadContext, today: IsoDate): number {
  const from = addDays(today, -6);
  let km = outOfPlanKm(ctx.outOfPlan, from, today);
  for (const w of ctx.plan.weeks)
    for (const d of w.days) {
      const l = ctx.log[d.id];
      if (!l || l.status !== 'done') continue;
      const dat = workoutDate(l, d);
      if (dat && dat >= from && dat <= today) km += doneKm(l, d);
    }
  return round1(km);
}

export interface Acwr {
  acute: number;
  chronic: number | null;
  /** `null` kad hronične osnove nema — bolje ne prikazati broj nego izmisliti imenilac. */
  ratio: number | null;
}

export function acwrNow(ctx: LoadContext, today: IsoDate): Acwr {
  const acute = acuteKm(ctx, today);
  const chronic = chronicKm(ctx, today);
  return {
    acute,
    chronic,
    ratio: chronic != null && chronic > 0 ? round2(acute / chronic) : null
  };
}

/**
 * Šta plan traži narednih sedam dana (danas i šest dana unapred). Akutni obim gleda UNAZAD i kao
 * upozorenje stiže prekasno (u ponedeljak pokazuje nulu, 2,4 se pojavi tek u nedelju uveče). Trka se ne
 * broji: 42 km trke nije trenažno opterećenje koje se poredi sa nedeljnim prosekom.
 */
export function plannedKm7(ctx: Pick<LoadContext, 'plan'>, today: IsoDate): number {
  const to = addDays(today, 6);
  let km = 0;
  for (const w of ctx.plan.weeks)
    for (const d of w.days) {
      if (d.rest || d.tag === 'trka') continue;
      if (d.date >= today && d.date <= to) km += d.km || 0;
    }
  return round1(km);
}

export function acwrPlan(
  ctx: LoadContext,
  today: IsoDate
): { planned: number; chronic: number | null; ratio: number | null } {
  const planned = plannedKm7(ctx, today);
  const chronic = chronicKm(ctx, today);
  return {
    planned,
    chronic,
    ratio: chronic != null && chronic > 0 ? round2(planned / chronic) : null
  };
}
