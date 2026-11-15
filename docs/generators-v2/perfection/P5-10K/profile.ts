/* P5-10K — profil (a) 10K: pun ispis po nedelji + metrike (kao P0/profiles.ts, samo 10K). Iz web/:
   node ../docs/generators-v2/perfection/P5-10K/profile.ts <oznaka>   → P5-10K/profile-a-10K-<oznaka>.txt */
import { writeFileSync } from "node:fs";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { metrics, profileA, weekly } from "../P0/common.ts";
const tag = process.argv[2] ?? "posle";
const dir = new URL(".", import.meta.url).pathname;
const input = profileA("10K");
const r = distOf("10K").generate(input);
const head = `profil (a) 10K\nulaz: ${JSON.stringify(input)}\n`;
const notes = (p: Plan) => (p.weeks as unknown as { index: number; notes: string[] }[]).flatMap((w) => w.notes.map((n) => `  #${w.index} ${n}`)).join("\n");
writeFileSync(`${dir}profile-a-10K-${tag}.txt`, r.ok
  ? `${head}politika: ${String(r.plan["policyVersion"])}\n${weekly(r.plan as Plan)}\n\nnapomene:\n${notes(r.plan as Plan)}\n\nmetrike: ${JSON.stringify(metrics("10K", r.plan as Plan))}\n`
  : `${head}ODBIJENO: ${r.reasons.map((x) => `${x.code}: ${x.message}`).join(" | ")}\n`);
console.log(r.ok ? "ok" : "odbijeno");
