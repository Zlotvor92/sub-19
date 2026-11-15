/* P5: stanje 72003c1 za planove mreže 02 (R) koje menja P5, a nisu već u fixture-ima 10K-08 ni P3 (grid02) — id →
   [planHashes21 (pun, bez RACE_WEEK_SHORT), RP deonica < 1000 m] (grid02.harness reg). Pokrenuti nad stablom 72003c1:
   node grid02-dump.ts <tenK/v2 stabla 72003c1> <segmentP5.changed-72003c1.json> > izlaz.json */
import { readFileSync } from "node:fs";
const [root, p5f] = process.argv.slice(2) as [string, string];
const { generateTenKV2 } = await import(root + "/generate.ts");
const T = await import(root + "/testInputs.ts");
const W = await import(root + "/workouts.ts");
const p5 = JSON.parse(readFileSync(p5f, "utf8")).gen as Record<string, unknown>;
const c08 = JSON.parse(readFileSync(root + "/segment08.changed-b9c4728.json", "utf8")).gen as Record<string, unknown>;
const p3g = JSON.parse(readFileSync(root + "/segmentP3.grid02-38fd091.json", "utf8")).plans as Record<string, unknown>;
const out: Record<string, [number, number, boolean]> = {};
for (const d of [3, 4, 5, 6] as const)
  for (const c of T.grid02Inputs(d)) {
    if (!p5[c.id] || c08[c.id] || p3g[c.id]) continue;
    const r = generateTenKV2(c.input);
    const h = T.planHashes21(r) as [number, number];
    const rp800 = r.ok && r.plan.weeks.some((w: any) => w.days.some((x: any) => {
      const s = x.workout.dose?.zone === "RP" ? x.workout.dose.structure : null;
      return !!s && W.repsOf(s).some((m: number) => m < 1000);
    }));
    out[c.id] = [h[0], h[1], rp800];
  }
process.stdout.write(JSON.stringify({ against: "72003c1", note: "P5: stanje 72003c1 (planHashes21 pun i bez RACE_WEEK_SHORT, RP deonica < 1000 m) planova mreže 02 koje menja P5, a nisu u fixture-ima 10K-08 ni P3; grid02.harness ih čita umesto današnjih. Piše docs/generators-v2/perfection/P5-10K/grid02-dump.ts.", plans: out }) + "\n");
