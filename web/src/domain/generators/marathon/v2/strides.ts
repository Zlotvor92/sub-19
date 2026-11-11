/* P5-F3 — ubrzanja na laganom danu (jedino mesto odluke: koja nedelja, koliko ponavljanja, koji dan). Čitaju
   generate.ts (konstruktor) i validate.ts (STRIDES); sastav treninga: workouts.easyStridesWorkout. */

import { daysBetween, mustDay } from './dates.ts';
import { introPos } from './periodize.ts';
import { MARATHON_V2_POLICY as P, type PlanRule } from './policy.ts';
import type { IsoDate, PlanDay, WeekFrame } from './types.ts';

export interface StridesSpec {
  readonly reps: number;
  readonly sec: number;
}

/** Broj ubrzanja nedelje: izgradnja i taper; ne trkačka nedelja ni uvod početnika (M17). null = nedelja bez
    ubrzanja. */
export function stridesSpecOf(
  frame: Pick<WeekFrame, 'index' | 'phase'>,
  rule: PlanRule,
  /** W1-A: broj nedelja plana (uvod početnika, periodize.introPos). */
  weeks: number
): StridesSpec | null {
  const s = P.strides;
  if (frame.phase === 'race') return null;
  if (rule.beginner)
    return introPos(frame.index, weeks, rule) > 0 ? null : { reps: s.beginnerReps, sec: s.sec };
  return { reps: frame.phase === 'base' ? s.baseReps : s.laterReps, sec: s.sec };
}

/** Dan sa ubrzanjima: lagan dan (ne dan zabrane kvaliteta i ubrzanja — bol, odmor, zabrana kvaliteta) sa najvećim
    razmakom u danima od prethodnog zahtevnog dana (kvalitet, dugi, test — `hard`; i iz prethodne nedelje
    `prevHard`); bez prethodnog zahtevnog dana razmak je neograničen; pri jednakom razmaku raniji. null = nedelja
    bez laganog dana. Adaptacija: bira se na nedelji kakva se upisuje (zaštićeni dani prethodnog plana + sastavljeni);
    zaštićen izabran dan ostaje kakav je upisan i nijedan drugi dan nedelje ne dobija ubrzanja. */
export function stridesDateOf(
  days: readonly PlanDay[],
  frame: Pick<WeekFrame, 'limits'>,
  prevHard: IsoDate | null
): IsoDate | null {
  const banned = new Set(frame.limits?.noQuality ?? []);
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let best: { date: IsoDate; gap: number } | null = null;
  let last = prevHard;
  for (const d of sorted) {
    if (d.role === 'easy' && !banned.has(d.date)) {
      const gap = last === null ? Infinity : daysBetween(last, d.date);
      if (!best || gap > best.gap) best = { date: d.date, gap };
    }
    if (d.hard) last = d.date;
  }
  return best?.date ?? null;
}

/** Poslednji zahtevan dan pre `date` u danima (prethodna nedelja); null = nema ga. */
export const lastHardBefore = (days: readonly PlanDay[], date: IsoDate): IsoDate | null =>
  days
    .filter((d) => d.hard && mustDay(d.date) < mustDay(date))
    .map((d) => d.date)
    .sort()
    .pop() ?? null;
