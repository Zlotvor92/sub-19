/* P3: stanje 38fd091 za planove mreže 02 (R) koje menja samo P3 — id → [planHashes21 (pun, bez RACE_WEEK_SHORT),
   RP deonica < 1000 m] (grid02.harness reg). Pokrenuti nad stablom 38fd091:
   node grid02-dump.ts <tenK/v2 stabla 38fd091> <segmentP3.changed-38fd091.json> <segment08.changed-b9c4728.json> > izlaz.json */
import { readFileSync } from "node:fs";
const [root, p3f, c08f] = process.argv.slice(2) as [string, string, string];
const { generateTenKV2 } = await import(root + "/generate.ts");
const T = await import(root + "/testInputs.ts");
const W = await import(root + "/workouts.ts");
const p3 = JSON.parse(readFileSync(p3f, "utf8")).gen as Record<string, unknown>;
const c08 = JSON.parse(readFileSync(c08f, "utf8")).gen as Record<string, unknown>;
const out: Record<string, [number, number, boolean]> = {};
for (const d of [3, 4, 5, 6] as const)
  for (const c of T.grid02Inputs(d)) {
    if (!p3[c.id] || c08[c.id]) continue;
    const r = generateTenKV2(c.input);
    const h = T.planHashes21(r) as [number, number];
    const rp800 = r.ok && r.plan.weeks.some((w: any) => w.days.some((x: any) => {
      const s = x.workout.dose?.zone === "RP" ? x.workout.dose.structure : null;
      return !!s && W.repsOf(s).some((m: number) => m < 1000);
    }));
    out[c.id] = [h[0], h[1], rp800];
  }
process.stdout.write(JSON.stringify({ against: "38fd091", note: "P3: stanje 38fd091 (planHashes21 pun i bez RACE_WEEK_SHORT, RP deonica < 1000 m) planova mreže 02 koje menja samo P3; grid02.harness ih čita umesto današnjih. Piše docs/generators-v2/perfection/P3/grid02-dump.ts.", plans: out }) + "\n");
