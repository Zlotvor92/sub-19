/* Ugao 5 (consistency), odložena odluka d): plauzibilnost ulaza mreža. SAMO ČITANJE, deterministički (sve mreže).
   Iz web/: node ../docs/generators-v2/audit/consistency/plausibility.ts
   Pravila (izvor u REPORT.md): L1 najduži skorašnji > nedeljni obim; L2 najduži skorašnji < obim/dani (najduži < prosečan
   trening); B1 početnik sa VDOT > 45; B2 početnik sa laganim < 330 s/km; V1 VDOT > 70; M1 (mišljenje) VDOT ≥ 60 uz obim ≤ 30 km. */
import { DISTS } from "../../final-check/lib.ts";
import { vdotFromResult } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
type In = Record<string, any>;
const out: Record<string, any> = {};
function scan(name: string, xs: In[]) {
  const c = { n: xs.length, L1: 0, L2: 0, withRecentLong: 0, B1: 0, B2: 0, beginners: 0, V1: 0, M1: 0, any: 0, ex: {} as Record<string, string> };
  for (const i of xs) {
    const km = i.currentWeeklyKm as number, days = (i.runDays as string[]).length;
    const rl = i.recentLongRunKm as number | undefined;
    const r = i.recentResult; const v = r ? vdotFromResult(r.distanceM, r.timeSec) : null;
    const easy = (i.typicalEasyPaceSecPerKm ?? i.easyPaceSecPerKm) as number | undefined;
    const beg = i.experience === "beginner";
    const hit: string[] = [];
    if (rl != null) { c.withRecentLong++; if (rl > km + 1e-9) hit.push("L1"); if (rl < km / days - 1e-9) hit.push("L2"); }
    if (beg) { c.beginners++; if (v != null && v > 45 + 1e-9) hit.push("B1"); if (easy != null && easy < 330) hit.push("B2"); }
    if (v != null && v > 70 + 1e-9) hit.push("V1");
    if (v != null && v >= 60 - 0.05 && km <= 30) hit.push("M1");
    for (const h of hit) { (c as any)[h]++; c.ex[h] ??= JSON.stringify({ km, days, rl, v: v && Math.round(v * 10) / 10, easy, beg }); }
    if (hit.some((h) => h !== "M1")) c.any++;
  }
  out[name] = c;
}
for (const d of DISTS) scan(d.name + " mreže generatora (lib.all)", d.all().map((b) => b.input as In));
scan("MAR recentInputs (M13a)", TM.recentInputs().map((g: any) => g.input));
console.log(JSON.stringify(out, null, 1));
