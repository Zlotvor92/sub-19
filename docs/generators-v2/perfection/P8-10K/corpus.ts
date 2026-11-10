/* P8-10K — korpus teksta za trkača (G3): napomene plana i nedelja i upozorenja (poruke) kakve aplikacija prikazuje
   (app/plan.ts: notes + warnings → userText), brojevi zamenjeni sa #; broj planova po obrascu i najveći broj
   ponavljanja istog upozorenja u jednom planu. Iz web/: node ../docs/generators-v2/perfection/P8-10K/corpus.ts <oznaka> [brzo|sve] [sirovo]
   (sirovo = plan.notes/warnings doslovno, kao pre G3; inače kroz userNotes kao aplikacija) */
import { writeFileSync } from "node:fs";
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";
import { userText } from "../../../../web/src/domain/generators/tenK/v2/app/format.ts";
import { userPlanMessages, userWeekNotes } from "../../../../web/src/domain/generators/tenK/v2/userNotes.ts";
import { beginnerGridInputs, feelGridInputs, grid02Inputs, gridInputs } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
import { grid } from "../P0/common.ts";
const tag = process.argv[2] ?? "posle";
const quick = process.argv[3] === "brzo";
const dir = new URL(".", import.meta.url).pathname;
const inputs = [
  ...grid("10K").map((c) => c.input as Record<string, unknown>),
  ...(quick ? [] : [...gridInputs(), ...([3, 4, 5, 6] as const).flatMap((d) => grid02Inputs(d)), ...([3, 4, 5, 6] as const).flatMap((d) => feelGridInputs(d)), ...([3, 4] as const).flatMap((d) => beginnerGridInputs(d))].map((c) => c.input)),
];
const norm = (s: string) => s.replace(/\d+([.,]\d+)?/g, "#").replace(/\b(pon|uto|sre|čet|pet|sub|ned)\b/g, "@");
const C = new Map<string, { kind: string; plans: number; maxPerPlan: number; ex: string }>();
const user = process.argv[4] !== "sirovo";
for (const inp of inputs) {
  const r = generateTenKV2(inp);
  if (!r.ok) continue;
  const p = r.plan;
  const per = new Map<string, number>();
  const add = (kind: string, raw: string) => { const t = userText(raw); const k = `${kind}\t${norm(t)}`; per.set(k, (per.get(k) ?? 0) + 1); if (!C.has(k)) C.set(k, { kind, plans: 0, maxPerPlan: 0, ex: t }); };
  if (user) for (const n of userPlanMessages(p)) add("plan", n);
  else { for (const n of p.notes) add("plan", n); for (const w of p.warnings) add(`upoz:${w.rule}`, w.message); }
  for (const w of p.weeks) for (const n of user ? userWeekNotes(w.notes) : w.notes) add("nedelja", n);
  for (const [k, v] of per) { const c = C.get(k)!; c.plans++; c.maxPerPlan = Math.max(c.maxPerPlan, v); }
}
const rows = [...C.values()].sort((a, b) => a.kind.localeCompare(b.kind) || b.plans - a.plans);
writeFileSync(`${dir}corpus-${tag}.tsv`, rows.map((r) => `${r.kind}\t${r.plans}\t${r.maxPerPlan}\t${r.ex}`).join("\n") + "\n");
console.log(`obrazaca ${rows.length}, planova ${inputs.length}`);
