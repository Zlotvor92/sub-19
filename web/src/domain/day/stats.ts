/* STATISTIKE PLANA: kilometri po nedelji, brojevi trčanja, serija („dana po planu"), poslednjih sedam dana, sažetak plana. */

import { addDays, type IsoDate } from '../date';
import type { LogEntry } from '../state/types';
import type { ResolvedDay, ResolvedPlan, ResolvedWeek } from '../plan/types';
import { realKm } from '../recovery/load';

type Log = Readonly<Record<string, LogEntry>>;

const done = (log: Log, id: string): boolean => log[id]?.status === 'done';
export const statusOf = (log: Log, id: string): string => {
  const s = log[id]?.status;
  return s ? s : 'pending';
};

/** Kilometri koje plan traži za nedelju (trenutni, posle izmena). */
export const weekPlanKm = (w: Pick<ResolvedWeek, 'days'>): number =>
  w.days.reduce((s, d) => s + (d.km || 0), 0);

export const weekRealKm = (w: Pick<ResolvedWeek, 'days'>, log: Log): number =>
  w.days.reduce((s, d) => s + realKm(log, d), 0);

/** Dan snage na kom je upisano i trčanje broji se kao trčanje. */
const strengthWithRun = (d: ResolvedDay, log: Log): boolean =>
  d.tag === 'snaga' && !d.rest && log[d.id]?.status === 'done' && (log[d.id]?.km ?? 0) > 0;

/**
 * TRČANJA odvojeno od snage: korisnik koji je izabrao „4 dana trčanja" je s pravom prijavio da mu plan piše „5 tren." — peti je dan
 * snage, koji je u generisanom planu izričito OPCION. Brojač je isti, ali se prikazuje odvojeno.
 */
const isRun = (d: ResolvedDay, log: Log): boolean =>
  !d.rest && (d.tag !== 'snaga' || strengthWithRun(d, log));
export const weekRunCount = (w: Pick<ResolvedWeek, 'days'>, log: Log): number =>
  w.days.filter((d) => isRun(d, log)).length;
export const weekRunDone = (w: Pick<ResolvedWeek, 'days'>, log: Log): number =>
  w.days.filter((d) => isRun(d, log) && done(log, d.id)).length;

/**
 * Serija: uzastopni dani po planu (odrađen trening ili odmor po planu), unazad od danas. Ako je danas trening koji još nije odrađen,
 * počinje se od juče. Prazan dan posle trke se preskače, a van plana ispred prve nedelje serija staje.
 */
export function streak(plan: ResolvedPlan, log: Log, today: IsoDate, raceDate: IsoDate): number {
  const start = plan.weeks[0]?.start;
  if (!start) return 0;
  let cur = today;
  let n = 0;
  const t = plan.byDate.get(today);
  if (t && !t.rest && !done(log, t.id)) cur = addDays(today, -1);
  while (cur >= start) {
    const d = plan.byDate.get(cur);
    if (!d) {
      if (cur > raceDate) {
        cur = addDays(cur, -1);
        continue;
      }
      break;
    }
    if (d.rest) n++;
    else if (done(log, d.id)) n++;
    else break;
    cur = addDays(cur, -1);
  }
  return n;
}

export type DayState = 'da' | 'odmor' | 'ne' | 'danas' | 'van';

/** Poslednjih sedam dana (najstariji prvi, danas poslednji): odrađen, odmor po planu, propušten, danas, van plana. */
export function lastSevenDays(
  plan: ResolvedPlan,
  log: Log,
  today: IsoDate
): Array<{ date: IsoDate; state: DayState }> {
  const out: Array<{ date: IsoDate; state: DayState }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const d = plan.byDate.get(date);
    let state: DayState = 'van';
    if (d) {
      if (d.rest) state = 'odmor';
      else if (done(log, d.id)) state = 'da';
      else if (date === today) state = 'danas';
      else state = 'ne';
    }
    out.push({ date, state });
  }
  return out;
}

/** Koliko je plan TRAŽIO zaključno sa danas — završene nedelje u celosti, tekuća samo do današnjeg dana. */
export function plannedUntilToday(plan: ResolvedPlan, today: IsoDate): number {
  let km = 0;
  for (const w of plan.weeks) {
    const end = addDays(w.start, 6);
    if (end < today) km += weekPlanKm(w);
    else if (w.start <= today)
      km += w.days.reduce((s, d) => s + (d.date && d.date <= today ? d.km || 0 : 0), 0);
  }
  return km;
}

export interface PlanSummary {
  total: number;
  run: number;
  untilToday: number;
  /** % plana do danas koji je istrčan. */
  keepingPlanPct: number;
  wholePlanPct: number;
  /** Prosek preko ZAVRŠENIH nedelja; preskočena nedelja je nula, ne izuzetak (inače je prosek lažno visok). */
  average: number | null;
  strongest: ResolvedWeek | undefined;
  strongestKm: number;
  remaining: number;
  remainingWeeks: number;
  runsDone: number;
  runsTotal: number;
}

export function planSummary(plan: ResolvedPlan, log: Log, today: IsoDate): PlanSummary {
  const total = plan.weeks.reduce((s, w) => s + weekPlanKm(w), 0);
  const run = plan.weeks.reduce((s, w) => s + weekRealKm(w, log), 0);
  const untilToday = plannedUntilToday(plan, today);
  const finished = plan.weeks.filter((w) => addDays(w.start, 6) < today);
  const finishedKm = finished.reduce((a, w) => a + weekRealKm(w, log), 0);
  const strongest = plan.weeks.reduce<ResolvedWeek | undefined>(
    (a, w) => (!a || weekRealKm(w, log) > weekRealKm(a, log) ? w : a),
    plan.weeks[0]
  );
  return {
    total,
    run,
    untilToday,
    keepingPlanPct: untilToday > 0 ? Math.round((run / untilToday) * 100) : 0,
    wholePlanPct: total > 0 ? Math.round((run / total) * 100) : 0,
    average: finished.length ? finishedKm / finished.length : null,
    strongest,
    strongestKm: strongest ? weekRealKm(strongest, log) : 0,
    remaining: Math.max(0, total - run),
    remainingWeeks: plan.weeks.filter((w) => addDays(w.start, 6) >= today).length,
    runsDone: plan.weeks.reduce((s, w) => s + weekRunDone(w, log), 0),
    runsTotal: plan.weeks.reduce((s, w) => s + weekRunCount(w, log), 0)
  };
}

/** Sledeći trening posle datuma (za red „Sledeći trening" na odmoru). */
export function nextTraining(plan: ResolvedPlan, from: string): ResolvedDay | undefined {
  return plan.dated.find((x) => x.date > from && !x.rest);
}

/** Datum trke aktivnog plana: iz `meta.raceDate`, a kad ga nema (stariji planovi) poslednji dan poslednje nedelje. */
export function effectiveRaceDate(
  plan: ResolvedPlan | null,
  metaRaceDate: unknown
): IsoDate | null {
  if (typeof metaRaceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(metaRaceDate))
    return metaRaceDate as IsoDate;
  const last = plan?.weeks[plan.weeks.length - 1];
  return last ? addDays(last.start, 6) : null;
}
