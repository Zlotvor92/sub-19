/* MODEL CIKLUSA ZA PRIKAZ: pet faza (BAZA · RAZVOJ · VRHUNAC · TAPER · TRKA), svaka nedelja sa stanjem (urađena / tekuća / buduća) i kilometrima.
   Samo čitanje postojećih funkcija domena (`weekPhase`, `weekOf`, `weekPlanKm`, `weekRealKm`) — nijedno pravilo plana se ovde ne menja ni ne dodaje.
   Rasterećenje (DELOAD) pripada fazi u kojoj se nalazi po redosledu, kao u `planPhases`; za razliku od njega, TAPER i TRKA ostaju zasebne faze. */

import { addDays, type IsoDate } from '../../domain/date';
import { weekPlanKm, weekRealKm } from '../../domain/day';
import { weekOf, weekPhase, type ResolvedPlan } from '../../domain/plan';
import type { LogEntry } from '../../domain/state';
import { PHASE_COLOR, PHASE_LINE, PHASE_ORDER, type PhaseKey } from '../../components/ui/phase';

export type CycleState = 'done' | 'now' | 'future';

export { PHASE_COLOR, PHASE_LINE, PHASE_ORDER, type PhaseKey };

export interface CycleWeek {
  w: number;
  phase: PhaseKey;
  deload: boolean;
  state: CycleState;
  start: IsoDate;
  planKm: number;
  realKm: number;
}
export interface CyclePhase {
  key: PhaseKey;
  from: number;
  to: number;
  weeks: CycleWeek[];
  planKm: number;
  realKm: number;
  state: CycleState;
}
export interface CycleModel {
  weeks: CycleWeek[];
  phases: CyclePhase[];
  current: CycleWeek | null;
  total: number;
}

/** Faza nedelje za prikaz: rasterećenje nasleđuje fazu prethodne nedelje (nedelja 1 bez prethodne je BAZA). */
function phaseOfWeek(
  w: Parameters<typeof weekPhase>[0],
  total: number,
  prev: PhaseKey | null
): PhaseKey {
  const p = weekPhase(w, total);
  if (p === 'DELOAD' || p === '') return prev ?? 'BAZA';
  return p;
}

export function cycleModel(
  plan: ResolvedPlan,
  log: Readonly<Record<string, LogEntry>>,
  today: IsoDate
): CycleModel {
  const total = plan.weeks.length;
  const now = weekOf(plan, today);
  const first = plan.weeks[0]?.start;
  const last = plan.weeks[total - 1];
  const afterPlan = !!last && today > addDays(last.start, 6);
  let prev: PhaseKey | null = null;
  const weeks: CycleWeek[] = plan.weeks.map((wk) => {
    const phase = phaseOfWeek(wk, total, prev);
    prev = phase;
    const state: CycleState = afterPlan
      ? 'done'
      : now
        ? wk.w < now.w
          ? 'done'
          : wk.w === now.w
            ? 'now'
            : 'future'
        : first && today < first
          ? 'future'
          : 'done';
    return {
      w: wk.w,
      phase,
      deload: wk.deload || /^DELOAD/i.test(wk.focus),
      state,
      start: wk.start,
      planKm: weekPlanKm(wk),
      realKm: weekRealKm(wk, log)
    };
  });
  const phases: CyclePhase[] = [];
  for (const wk of weeks) {
    const cur = phases[phases.length - 1];
    if (cur && cur.key === wk.phase) {
      cur.weeks.push(wk);
      cur.to = wk.w;
    } else
      phases.push({
        key: wk.phase,
        from: wk.w,
        to: wk.w,
        weeks: [wk],
        planKm: 0,
        realKm: 0,
        state: 'future'
      });
  }
  for (const p of phases) {
    p.planKm = p.weeks.reduce((s, x) => s + x.planKm, 0);
    p.realKm = p.weeks.reduce((s, x) => s + x.realKm, 0);
    p.state = p.weeks.some((x) => x.state === 'now')
      ? 'now'
      : p.weeks.every((x) => x.state === 'done')
        ? 'done'
        : 'future';
  }
  return { weeks, phases, current: weeks.find((x) => x.state === 'now') ?? null, total };
}

/** Kratak natpis za zaglavlje: „N6/12 · RAZVOJ"; `null` kad plan još nije počeo ili je završen. */
export function cycleCaption(m: CycleModel): { week: string; phase: PhaseKey } | null {
  const c = m.current;
  return c ? { week: `N${c.w}/${m.total}`, phase: c.phase } : null;
}
