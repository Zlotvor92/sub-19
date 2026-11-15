/* P5-MAR — profil (a) za maraton (P0/common.ts profileA): pun ispis po nedelji. Iz web/:
   [P2_EXP=O2] node ../docs/generators-v2/perfection/P2/profile.ts <oznaka>   → P5-MAR/profile-a-<oznaka>.txt */
import { writeFileSync } from "node:fs";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { metrics, profileA, weekly } from "../P0/common.ts";
const tag = process.argv[2] ?? "posle";
const dir = new URL(".", import.meta.url).pathname;
const input = profileA("MAR");
const r = distOf("MAR").generate(input);
const out = r.ok ? `ulaz: ${JSON.stringify(input)}\n${weekly(r.plan as Plan)}\n\nmetrike: ${JSON.stringify(metrics("MAR", r.plan as Plan))}\n` : `ODBIJENO ${JSON.stringify(r.reasons)}`;
writeFileSync(`${dir}profile-a-${tag}.txt`, out);
console.log(`profil (a) ${tag}: ${r.ok ? "ok" : "odbijeno"}`);
