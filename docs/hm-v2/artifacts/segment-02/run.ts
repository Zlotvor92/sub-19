/* Primeri HM v2 Segment 02 (hm-v2.1.0). Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-02/run.ts
   (Node ≥ 22.18, type stripping; prettier iz web/node_modules). Upisuje inputs.json, <id>.json i plans.md pored
   skripte, formatirane prettier-om; dva pokretanja daju bajt-isti izlaz. */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/index.ts";
import type {
  HmV2Plan,
  PlanWeek,
} from "../../../../web/src/domain/generators/halfMarathon/v2/index.ts";
import {
  grid02Inputs,
  inputOf,
  SCHEDULES_BY_DAYS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const prettier = (await import(
  new URL("../../../../web/node_modules/prettier/index.mjs", import.meta.url)
    .href
)) as {
  format: (src: string, opts: Record<string, unknown>) => Promise<string>;
};

const CASES: { id: string; label: string; input?: Record<string, unknown> }[] =
  [
    {
      id: "d3-12w-30km-v45-A-sun",
      label: "3 dana, mali obim (30 km, VDOT 45, 12 ned)",
    },
    {
      id: "d3-16w-45km-v30-C-sun",
      label: "3 dana, spor trkač (45 km, VDOT 30, 16 ned)",
    },
    {
      id: "d4-18w-60km-v55-B-sun",
      label: "4 dana, veliki obim (60 km, VDOT 55; HM-01 dugi 28 km)",
    },
    { id: "d5-14w-55km-v50-A-sun", label: "5 dana (55 km, VDOT 50, 14 ned)" },
    {
      id: "d6-18w-90km-v60-B-sun",
      label: "6 dana, veliki obim (90 km, VDOT 60, 18 ned)",
    },
    {
      id: "r-d4-12w-40km-v45-r10",
      label: "4 dana sa skorašnjim najdužim 10 km (pouka 28)",
      input: inputOf({
        weeks: 12,
        km: 40,
        vdot: 45,
        days: SCHEDULES_BY_DAYS[4].A.days,
        recentLongRunKm: 10,
      }),
    },
  ];

const f1 = (x: number): string => x.toFixed(1).replace(".", ",");
const work = (w: PlanWeek, role: string): string => {
  const d = w.days.find((x) => x.role === role);
  if (!d) return "—";
  const t = d.workout.title
    .replace(/^WU \d+ min \+ /, "")
    .replace(/ \+ CD \d+ min$/, "");
  return t.replace(/ \(oporavak [^)]*\)/, "");
};
const phaseSr: Record<string, string> = {
  base: "baza",
  development: "razvoj",
  specific: "spec.",
  taper: "taper",
  race: "trka",
};

function table(p: HmV2Plan): string {
  const rows = p.weeks.map((w) => {
    const long = w.days.find((d) => d.role === "long");
    const easy = w.days
      .filter((d) => d.role === "easy")
      .map((d) => f1(d.workout.km));
    const note = w.deload
      ? "rasterećenje"
      : w.fitted
        ? `izvodljiv (pravilo ${f1(w.nominalKm)})`
        : w.phase === "race"
          ? `oštrenje ${work(w, "sharpener")}; trka van obima`
          : "";
    return `| ${w.index} | ${phaseSr[w.phase]} | ${f1(w.targetKm)} / ${f1(w.plannedKm)} | ${work(w, "q1")} | ${work(w, "q2")} | ${long ? f1(long.workout.km) : "—"} | ${easy.join(" + ") || "—"} | ${note} |`;
  });
  return [
    "| ned | faza | cilj / plan km | Q1 | Q2 | dugi | lagani | napomena |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

const md: string[] = [
  "# HM v2 Segment 02 — primeri (hm-v2.1.0)",
  "",
  "Izvor: `node docs/hm-v2/artifacts/segment-02/run.ts` (ulazi iz mreže 02, `testInputs.ts`; poslednji sa `recentLongRunKm`).",
];
const inputs: Record<string, unknown> = {};
for (const c of CASES) {
  const input = c.input ?? grid02Inputs().find((x) => x.id === c.id)!.input;
  inputs[c.id] = input;
  const r = generateHmV2(input);
  if (!r.ok) throw new Error(`${c.id}: ${JSON.stringify(r.reasons)}`);
  const p = r.plan;
  writeFileSync(
    join(OUT, `${c.id}.json`),
    await prettier.format(JSON.stringify(p), { parser: "json" }),
  );
  const warn = [...new Set(p.warnings.map((w) => w.rule))].join(", ") || "—";
  md.push(
    "",
    `## ${c.id} — ${c.label}`,
    "",
    `VDOT ${f1(p.vdot)}, RP ${Math.floor(p.paces.RP / 60)}:${String(p.paces.RP % 60).padStart(2, "0")}/km, prognoza ${Math.floor(p.predictedHmSec / 3600)}:${String(Math.floor((p.predictedHmSec % 3600) / 60)).padStart(2, "0")}:${String(p.predictedHmSec % 60).padStart(2, "0")}; vrh ${f1(p.peakKm)} km (granica ${f1(p.peakCapKm)}); upozorenja: ${warn}.`,
    "",
    table(p),
  );
}
writeFileSync(
  join(OUT, "inputs.json"),
  await prettier.format(JSON.stringify(inputs), { parser: "json" }),
);
writeFileSync(
  join(OUT, "plans.md"),
  await prettier.format(md.join("\n") + "\n", { parser: "markdown" }),
);
