/* Faza 4a, zadatak 2 — učestalost upozorenja generatora po mreži i distanci (HM, maraton).
   Po porodici mreže (R = mreža 02, F = po osećaju, B = početnik; maraton i M13a = skorašnji najduži trk):
   % planova sa pravilom, broj pojava, i koliko redova „Na šta da paziš" aplikacija prikaže (plan.notes +
   warnings, bez ponavljanja — isto kao halfMarathon/v2/app/plan.ts planWarnings).
   Iz korena repoa: node docs/generators-v2/final-check/warnings.ts <HM|MAR> [k = svaki k-ti plan] > out.json */

import * as TM from "../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import { distOf, type Base } from "./lib.ts";

const name = process.argv[2]!;
const k = Number(process.argv[3] ?? "1");
const d = distOf(name);
const fams: Record<string, Base[]> = { R: [], F: [], B: [] };
for (const b of d.all()) fams[b.family]!.push(b);
if (name === "MAR") fams["M13a"] = TM.recentInputs().map((c) => ({ id: c.id, family: "M13a", input: c.input }));
const t0 = Date.now();
const out: Record<string, unknown> = { dist: name, k };
for (const [fam, xs] of Object.entries(fams)) {
  let plans = 0;
  let rejected = 0;
  const rej: Record<string, number> = {};
  const withRule: Record<string, number> = {};
  const inst: Record<string, number> = {};
  const lines: number[] = [];
  const ex: Record<string, string> = {};
  for (const b of xs.filter((_, i) => i % k === 0)) {
    const g = d.generate(b.input);
    if (!g.ok) {
      rejected++;
      for (const r of g.reasons) rej[r.code] = (rej[r.code] ?? 0) + 1;
      continue;
    }
    plans++;
    const p = g.plan as unknown as { notes: string[]; warnings: { rule: string; message: string; week?: number }[] };
    const seen = new Set<string>();
    for (const v of p.warnings) {
      inst[v.rule] = (inst[v.rule] ?? 0) + 1;
      if (!seen.has(v.rule)) withRule[v.rule] = (withRule[v.rule] ?? 0) + 1;
      seen.add(v.rule);
      ex[v.rule] ??= `${b.id} (ned ${v.week ?? "-"}): ${v.message}`;
    }
    lines.push(new Set([...p.notes, ...p.warnings.map((v) => v.message)].filter(Boolean)).size);
  }
  lines.sort((a, b) => a - b);
  const pct = (n: number) => Math.round((1000 * n) / Math.max(1, plans)) / 10;
  out[fam] = {
    plans,
    rejected,
    rej,
    rules: Object.fromEntries(
      Object.entries(withRule)
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => [r, { plansPct: pct(n), plans: n, perPlan: Math.round((10 * inst[r]!) / n) / 10 }]),
    ),
    shownLines: { median: lines[lines.length >> 1] ?? 0, p90: lines[Math.floor(lines.length * 0.9)] ?? 0, max: lines[lines.length - 1] ?? 0 },
    examples: ex,
  };
}
out["seconds"] = (Date.now() - t0) / 1000;
console.log(JSON.stringify(out, null, 1));
