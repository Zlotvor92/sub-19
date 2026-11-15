/* P0 — imenovani profili (a) i (b): pun ispis po nedelji + metrike. Iz web/:
   node ../docs/generators-v2/perfection/P0/profiles.ts   → P0/profile-a-<D>.txt, P0/profile-b-<D>.txt, P0/profiles.json */
import { writeFileSync } from "node:fs";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { metrics, profileA, profileB, weekly, type DName } from "./common.ts";

const dir = new URL(".", import.meta.url).pathname;
const out: Record<string, unknown> = {};
for (const D of ["5K", "10K", "HM", "MAR"] as DName[])
  for (const [tag, f] of [["a", profileA], ["b", profileB]] as const) {
    const input = f(D);
    const r = distOf(D).generate(input);
    const head = `profil (${tag}) ${D}\nulaz: ${JSON.stringify(input)}\n`;
    if (!r.ok) {
      writeFileSync(`${dir}profile-${tag}-${D}.txt`, `${head}ODBIJENO: ${r.reasons.map((x) => `${x.code}: ${x.message}`).join(" | ")}\n`);
      out[`${tag}-${D}`] = { input, rejected: r.reasons.map((x) => x.code) };
      continue;
    }
    const m = metrics(D, r.plan as Plan);
    const goal = (r.plan as Record<string, unknown>)["goal"];
    writeFileSync(`${dir}profile-${tag}-${D}.txt`, `${head}cilj: ${JSON.stringify(goal)}\n${weekly(r.plan as Plan)}\n\nmetrike: ${JSON.stringify(m)}\n`);
    out[`${tag}-${D}`] = { input, goal, metrics: m };
  }
writeFileSync(`${dir}profiles.json`, JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => `${k}: ${(v as { rejected?: string[] }).rejected ? "odbijeno " + (v as { rejected: string[] }).rejected : "ok"}`).join("\n"));
