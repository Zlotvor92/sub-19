/* Izlaz generatora → perzistirani plan.

   Generator ne daje `id` dana ni `start` nedelje — dodeljuju se JEDNOM ovde, istom konvencijom
   (`g{nedelja}d{dan}`, dow 1–7 → 0–6), da SVI sistemi vezani za ID (`alts`, `moves`, `log`,
   `vdotLog`, predikcija) rade nad generisanim planom. */

import { addDays } from '../date';
import type { GenPlanState, StoredWeek } from '../state';
import { isPlanError, type PlanGenerationResult } from '../training/types';

export function adaptGeneratedPlan(gen: PlanGenerationResult): GenPlanState | null {
  if (isPlanError(gen) || !Array.isArray(gen.weeks)) return null;
  const startMon = gen.meta.start;
  if (!startMon) return null;
  const weeks: StoredWeek[] = gen.weeks.map((w, wi) => {
    const num = w.w != null ? w.w : wi + 1;
    return {
      w: num,
      start: addDays(startMon, wi * 7),
      /* `deload` SE PRENOSI: zastavica je izvor istine, `focus` je prikaz — prepoznavanje rasterećenja
         samo po tekstu bi palo čim `focus` dobije pun tekst. */
      deload: !!w.deload,
      focus: w.focus || (w.deload ? 'DELOAD' : ''),
      days: w.days.map((d) => {
        const dow0 = d.dow - 1; // generator: 1–7 (Pon=1), aplikacija: 0–6 (Pon=0)
        return { ...d, dow: dow0, id: `g${num}d${dow0 + 1}` };
      })
    };
  });
  const pred = gen.pred.map((r, i) => ({ ...r, id: `g${r.w}_${i}` }));
  /* `qs` ključevi iz „n" prostora ('n3d5') u „g" prostor ('g3d5'); brojni deo je isti. */
  const qs: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(gen.qs)) qs[k.replace(/^n/, 'g')] = v;
  return { weeks, pred, qs, meta: gen.meta as GenPlanState['meta'] };
}
