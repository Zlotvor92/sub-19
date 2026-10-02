/* NATPIS ISPOD NASLOVA: gde smo u planu. Izvedeno iz datuma — zato MORA da ide sa danom (posle ponoći je telo prešlo na
   novi dan, a zaglavlje ostalo na starom: dva različita broja dana do trke na istom ekranu). */

import { diffDays } from '../date';
import { fmtDayMonthYear, plDan } from '../format';
import { weekOf } from './resolve';
import type { ResolvedPlan } from './types';

export function headerSubtitle(
  plan: ResolvedPlan | null,
  raceDate: string | null,
  today: string
): string {
  if (!plan || !plan.weeks.length || !raceDate) return '';
  const start = plan.weeks[0]?.start as string;
  if (today < start) return `Start: ${fmtDayMonthYear(start)} · Trka: ${fmtDayMonthYear(raceDate)}`;
  if (today > raceDate) return `Plan završen · Trka: ${fmtDayMonthYear(raceDate)}`;
  const w = weekOf(plan, today);
  const dd = diffDays(today as never, raceDate as never);
  return `${w ? `Nedelja ${w.w} / ${plan.weeks.length} · ` : ''}${dd === 0 ? 'DANAS JE TRKA 🏁' : `${dd} ${plDan(dd)} do trke`}`;
}
