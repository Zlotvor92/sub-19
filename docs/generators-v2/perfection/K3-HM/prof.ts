/* K3-HM — mere K3 na 12 profila P9 (P9/inputs.json, HM). node docs/generators-v2/perfection/K3-HM/prof.ts <koren koda> */
import { readFileSync } from "node:fs";
import { metrics } from "./snap.ts";
const dir = new URL(".", import.meta.url).pathname;
const root = process.argv[2]!;
const gen = (await import(`${root}/web/src/domain/generators/halfMarathon/v2/generate.ts`)).generateHmV2;
const inputs = JSON.parse(readFileSync(`${dir}../P9/inputs.json`, "utf8")).HM as { title: string; input: any }[];
const keys = (process.argv[3] ?? "peak,longest,specDrop,taperRp,taperShare,easyLong,sameRun,blockKm,blocks,topRun,atTop,hardFromRace,lastPreShare,shortEasy").split(",");
inputs.forEach((x, i) => {
  const r = gen(x.input);
  const id = `p${String(i + 1).padStart(2, "0")}`;
  if (!r.ok) return console.log(id, "ODBIJEN", r.reasons[0].code);
  const m: any = metrics(r.plan, x.input);
  console.log(id, keys.map((k) => `${k} ${m[k]}`).join(" | "));
});
