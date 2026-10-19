/* Kontrolne metrike K1–K6 mreže 04 (MASTER § 3, M18) i primeri pre/posle (bol 5, pauza 20) za izveštaj MAR-04.
   Iz korena: node --experimental-strip-types docs/marathon-v2/artifacts/segment-04/metrics.ts
   Upisuje metrics.json i examples.md pored skripte (bajt-isto pri svakom pokretanju). */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adaptMarathonV2,
  generateMarathonV2,
} from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import type {
  MarathonV2Facts,
  MarathonV2Plan,
  PlanWeek,
} from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import { adaptInvariants } from "../../../../web/src/domain/generators/marathon/v2/adaptInvariants.ts";
import { addDays } from "../../../../web/src/domain/generators/marathon/v2/dates.ts";
import {
  adaptBases,
  adaptCases,
  chainFacts,
  factsOf,
  painFacts,
} from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const BUILD = ["base", "development", "specific"];
const inc = (o: Record<string, number>, k: string, n = 1) =>
  (o[k] = (o[k] ?? 0) + n);
const per: Record<string, Record<string, number>> = {};
const tot: Record<string, number> = {};
for (const b of adaptBases()) {
  const g = generateMarathonV2(b.input);
  if (!g.ok) throw new Error(b.id);
  const p0 = g.plan;
  for (const c of adaptCases(b.id, p0)) {
    const s = per[c.s] ?? (per[c.s] = {});
    inc(s, "flows");
    let f = factsOf(p0, c.s, c.asOf);
    let r = adaptMarathonV2(p0, f, c.asOf);
    let before: MarathonV2Plan = p0;
    let at = c.asOf;
    if (r.ok && c.s === "chain") {
      [before, at] = [r.plan, addDays(c.asOf, 7)];
      f = chainFacts(r.plan, at);
      r = adaptMarathonV2(r.plan, f, at);
    }
    if (!r.ok) {
      inc(s, "K1");
      continue;
    }
    const p = r.plan;
    if (adaptInvariants(before, p, at, f as MarathonV2Facts).length)
      inc(s, "invariants");
    for (const x of r.reasons) if (x.applied) inc(s, x.condition);
    const N = p.weeks.length;
    const first = Math.min(...p.adaptation!.steps.map((x) => x.firstWeek));
    const mixed = new Set(p.adaptation!.mixedWeeks);
    if (p.weeks[N - 1]!.plannedKm > p.weeks[N - 2]!.plannedKm + 1e-6)
      inc(s, "K5 trkačka > N−1");
    if (p.notes.some((n) => n.includes("(A17)")))
      inc(s, "A17 ukinuto rasterećenje");
    if (
      p.weeks.some((w) => w.notes.some((n) => n.includes("A9: dugi ≥ lagan")))
    )
      inc(s, "A9 dugi 5 km");
    if (p.weeks[N - 1]!.notes.some((n) => n.includes("(pouka 30)")))
      inc(s, "pouka 30");
    if (p.weeks.some((w) => w.notes.some((n) => n.includes("(A9)"))))
      inc(s, "A9 manje kvaliteta");
    if (p.goal?.status === "orientation") inc(s, "orijentir");
    let q = 0;
    let mp = 0;
    for (const w of p.weeks as PlanWeek[]) {
      if (w.index < first || mixed.has(w.index) || !BUILD.includes(w.phase))
        continue;
      const long = w.days.find((d) => d.role === "long");
      if (!long) continue;
      for (const d of w.days) {
        if (d.role === "easy" && d.workout.km > long.workout.km + 1e-6)
          inc(s, "K5 dugi < lagan");
        if (d.workout.kind === "quality" && d.workout.sec > long.workout.sec) {
          if (d.workout.dose?.zone === "MP") mp++;
          else q++;
        }
      }
    }
    if (q) inc(s, "K6 T/I/R dan > dugi (tokova)");
    if (mp) inc(s, "K6 MP 2×3000 dan > dugi (tokova)");
    for (const v of p.warnings)
      if (
        [
          "CAPACITY_LIMITED",
          "PLANNED_BELOW_TARGET_LIMITS",
          "WEEK_MIN_LIMITS",
          "LONG_SHORTER_THAN_QUALITY",
          "DELOAD_LONG_SHORTENED",
        ].includes(v.rule)
      )
        inc(s, `w:${v.rule}`);
  }
}
for (const s of Object.values(per))
  for (const [k, v] of Object.entries(s)) inc(tot, k, v);
writeFileSync(
  join(OUT, "metrics.json"),
  JSON.stringify({ total: tot, perScenario: per }, null, 2) + "\n",
);

// Primer pre/posle: 4 dana sa rezultatom, 16 ned, asOf kraj ned 6 — bol 5 i pauza 20.
const b = adaptBases().find((x) => x.id === "d4-r-16w")!;
const p0 = (generateMarathonV2(b.input) as { ok: true; plan: MarathonV2Plan })
  .plan;
const asOf = p0.weeks[5]!.endDate;
const row = (w: PlanWeek) => {
  const q =
    w.days
      .filter((d) => d.workout.kind === "quality")
      .map((d) =>
        d.workout.title
          .replace(/^WU \d+ min \+ /, "")
          .replace(/ \+ CD \d+ min$/, "")
          .replace(/ \(oporavak[^)]*\)/, ""),
      )
      .join(" / ") || "—";
  const l = w.days.find((d) => d.role === "long")?.workout.km ?? "—";
  return `${w.phase}${w.deload ? " R" : ""} | ${w.targetKm} / ${w.plannedKm} | ${q} | ${l}`;
};
const md: string[] = [
  "# MAR-04 primeri pre/posle (d4-r-16w: 4 dana, 45 km, VDOT 45, asOf " +
    asOf +
    ")",
  "",
];
for (const [name, f] of [
  ["bol 5 na dan asOf", painFacts(asOf, 5)],
  ["pauza 20 dana do asOf", factsOf(p0, "pause20", asOf)],
] as const) {
  const r = adaptMarathonV2(p0, f, asOf);
  if (!r.ok) throw new Error(name);
  md.push(
    `## ${name}`,
    "",
    "| ned | pre: faza | cilj / plan | kvalitet | dugi | posle: faza | cilj / plan | kvalitet | dugi |",
    "|---|---|---|---|---|---|---|---|---|",
  );
  for (let i = 6; i < p0.weeks.length; i++)
    md.push(`| ${i + 1} | ${row(p0.weeks[i]!)} | ${row(r.plan.weeks[i]!)} |`);
  md.push(
    "",
    ...r.reasons
      .filter((x) => x.applied)
      .map((x) => `- ${x.condition}: ${x.message}`),
    "",
  );
}
writeFileSync(join(OUT, "examples.md"), md.join("\n"));
console.log(JSON.stringify(tot));
