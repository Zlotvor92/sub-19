/* P5-10K — udeo rada prvog T dana i prvog I dana (rad zone / trajanje dana), mreža P0 R (144). Iz web/:
   node ../docs/generators-v2/perfection/P5-10K/tshare.ts */
import { grid } from "../P0/common.ts";
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";
const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? `${Math.round(s[Math.floor(s.length / 2)]! * 100)} [${Math.round(s[0]! * 100)}–${Math.round(s[s.length - 1]! * 100)}]` : "—"; };
const out: Record<string, number[]> = { T: [], I: [] };
for (const c of grid("10K").filter((x) => x.family === "R")) {
  const r = generateTenKV2(c.input); if (!r.ok) continue;
  for (const z of ["T", "I"] as const) {
    const d = r.plan.weeks.flatMap((w) => w.days).find((x) => x.workout.kind === "quality" && x.workout.dose?.zone === z);
    if (!d) continue;
    const work = d.workout.segments.filter((s) => (s.kind === "rep" || s.kind === "continuous") && s.zone === z).reduce((a, s) => a + s.sec, 0);
    out[z]!.push(work / d.workout.sec);
  }
}
console.log(`udeo rada prvog T dana %: ${med(out.T!)}; prvog I dana %: ${med(out.I!)}`);
