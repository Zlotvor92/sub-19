/* PODACI O OPTEREĆENJU: datum treninga, istrčani km, trčanja van plana (procena opterećenja je u generatoru).

   Sve su ČISTE funkcije (plan, dnevnik, trčanja pre plana) → broj. Stari kod ih je čitao iz globalnog
   stanja; ovde je kontekst eksplicitan, pa su testabilne bez ekrana.

   ACWR (acute:chronic workload ratio): pojam i pojas 0,8–1,3 su iz literature, ali DOKAZ da odnos
   predviđa povredu je sporan (Impellizzeri i sar., 2020: matematička povezanost brojioca i imenioca).
   Ovde se koristi kao ograda za doziranje povratka, ne kao predviđanje. */

import { addDays, isIsoDate, type IsoDate } from '../date';
import type { LogEntry } from '../state';
import type { ResolvedDay, ResolvedPlan } from '../plan/types';

export interface LoadContext {
  plan: ResolvedPlan;
  log: Readonly<Record<string, LogEntry>>;
  /** `datum → km` trčanja PRE prvog dana plana (sinhronizacija ih puni). */
  outOfPlan: Readonly<Record<string, number>>;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

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

/* Ostvarenost, najveća nedelja, dani bez trčanja, prekid, hronično/akutno opterećenje i ACWR su trenerska procena i od
   prenosa pripadaju generatoru distance plana (`domain/generators/<distanca>/recovery/load.ts`). Ovde ostaju podaci:
   datum treninga, istrčani km, trčanja van plana i granica plana. */
