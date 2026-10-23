/* Ugao 4, maraton v2 — ciljana pretraga nalaza O3: bol 7/8 na kraj nedelje N−2 → 3 dana odmora pokriju sve dane
   trčanja tapera N−1 (3 dana) → pouka 30 (week.raceWeekRest, cap = planirano N−1 = 0) isprazni trkačku nedelju, a izuzetak
   validatora week.raceOnlyWeek traži dane odmora U trkačkoj nedelji → EMPTY_WEEK → adaptacija odbijena.
   Mreža: svi skupovi od 3 dana × dan dugog (patternOf) × 7 početaka nedelje × N {12, 16, 20, 24} × obim {30, 45} × osnova
   {VDOT 45 (polumaraton), po osećaju 375} × bol 8; asOf = kraj N−2 (i kraj N−1 za poređenje sa poznatim N1).
   Iz web/: node ../docs/generators-v2/audit/owner/mar-emptyweek-search.ts */
import { adaptMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/adapt.ts";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import { addDays } from "../../../../web/src/domain/generators/marathon/v2/dates.ts";
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import type { MarathonV2Plan, Weekday } from "../../../../web/src/domain/generators/marathon/v2/types.ts";
const WD: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const t0 = Date.now();
let plans = 0, flows = 0;
const res: Record<string, { flows: number; rejected: number; codes: Record<string, number>; ex?: string }> = {};
for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 7; c++) {
  const days = [WD[a]!, WD[b]!, WD[c]!];
  for (const long of days) for (let s0 = 0; s0 < 7; s0++) for (const N of [12, 16, 20, 24]) for (const km of [30, 45]) for (const basis of ["v45", "feel375"]) {
    const startDate = addDays("2026-11-02", s0);
    const input = {
      startDate, raceDate: addDays(startDate, 7 * N - 1), runDays: days, longRunDay: long, currentWeeklyKm: km,
      recentResult: basis === "v45" ? { distanceM: 21097.5, timeSec: TM.timeForVdot(45), date: addDays(startDate, -14) } : null,
      goalTimeSec: null, ...(basis === "feel375" ? { easyPaceSecPerKm: 375 } : {}),
    };
    const g = generateMarathonV2(input);
    if (!g.ok) continue;
    plans++;
    const p = g.plan as MarathonV2Plan;
    for (const [tag, wk] of [["endN-2", N - 2], ["endN-1", N - 1]] as const)
      for (const lvl of [8]) {
        const asOf = p.weeks[wk - 1]!.endDate;
        const r = adaptMarathonV2(p, TM.painFacts(asOf, lvl), asOf);
        flows++;
        const k = `${tag} pain${lvl}`;
        res[k] ??= { flows: 0, rejected: 0, codes: {} };
        res[k].flows++;
        if (!r.ok) {
          res[k].rejected++;
          for (const x of r.reasons) { const c = x.code + ":" + x.message.split(":")[0]; res[k].codes[c] = (res[k].codes[c] ?? 0) + 1; }
          res[k].ex ??= `asOf=${asOf} input=${JSON.stringify(input)}`;
        }
      }
  }
}
console.log(JSON.stringify({ plans, flows, res, sec: (Date.now() - t0) / 1000 }, null, 1));
