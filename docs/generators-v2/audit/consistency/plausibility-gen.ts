/* Ugao 5 (consistency) d): kako generator maratona i HM odgovaraju na ulaze M13a koji krše L1/L2 (plausibility.ts).
   SAMO ČITANJE, deterministički: svaki 5. ulaz M13a; HM: isti ulaz (obim/dani/rl/VDOT) preveden u HM v2 ulaz nije
   pravljen — meri se samo maraton. Iz web/: node ../docs/generators-v2/audit/consistency/plausibility-gen.ts */
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
const o: Record<string, Record<string, number>> = { L1: {}, L2: {}, ok: {} };
const xs = TM.recentInputs();
for (const [i, g] of xs.entries()) {
  if (i % 5) continue;
  const inp: any = g.input; const km = inp.currentWeeklyKm, days = inp.runDays.length, rl = inp.recentLongRunKm;
  const cls = rl > km ? "L1" : rl < km / days ? "L2" : "ok";
  const r: any = generateMarathonV2(inp);
  const key = r.ok ? "plan" : r.reasons.map((x: any) => x.code).join("+");
  o[cls]![key] = (o[cls]![key] ?? 0) + 1;
}
console.log(JSON.stringify(o));
