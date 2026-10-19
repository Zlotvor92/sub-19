/* Primeri HM v2 Segment 03 (hm-v2.2.0): plan po osećaju (H16) i početnik (H17). Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-03/run.ts
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
  beginnerInputs,
  feelInputs,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const prettier = (await import(
  new URL("../../../../web/node_modules/prettier/index.mjs", import.meta.url)
    .href
)) as {
  format: (src: string, opts: Record<string, unknown>) => Promise<string>;
};

const CASES: { id: string; label: string }[] = [
  {
    id: "f-d4-12w-40km-e360-A",
    label: "po osećaju, 4 dana, 40 km, lagan 6:00, 12 ned (test u izgradnji)",
  },
  {
    id: "f-d3-13w-25km-e270-A",
    label:
      "po osećaju, 3 dana, 25 km, lagan 4:30 (test u rasterećenju, dugi skraćen)",
  },
  {
    id: "f-d6-20w-90km-e270-A",
    label: "po osećaju, 6 dana, 90 km, lagan 4:30, 20 ned",
  },
  {
    id: "b-d4-16w-30km-e450-A",
    label: "početnik po osećaju, 4 dana, 30 km, lagan 7:30, 16 ned",
  },
  {
    id: "b-d4-12w-25km-e330-A",
    label: "početnik po osećaju, 4 dana, 25 km, lagan 5:30 (taper T 1,5 km)",
  },
  {
    id: "b-d5-20w-45km-v40-B",
    label: "početnik sa rezultatom (VDOT 40), 5 dana, 45 km, 20 ned",
  },
];

const f1 = (x: number): string => x.toFixed(1).replace(".", ",");
const pace = (s: number): string =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const work = (w: PlanWeek, role: string): string => {
  const d = w.days.find((x) => x.role === role);
  if (!d) return "—";
  const t = d.workout.title
    .replace(/^WU \d+ min \+ /, "")
    .replace(/ \+ CD \d+ min$/, "");
  const rpe = d.workout.rpe
    ? ` (RPE ${d.workout.rpe.min}–${d.workout.rpe.max})`
    : "";
  return t.replace(/ \(oporavak [^)]*\)/, "") + rpe;
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
    const q1 = w.days.some((d) => d.role === "test")
      ? work(w, "test")
      : work(w, "q1");
    const note = [
      w.index <= (p.input.experience === "beginner" ? 2 : 0) ? "uvod" : "",
      w.deload ? "rasterećenje" : "",
      w.test ? "test" : "",
      w.fitted ? `izvodljiv (pravilo ${f1(w.nominalKm)})` : "",
      w.phase === "race"
        ? `oštrenje ${work(w, "sharpener")}; trka van obima`
        : "",
    ]
      .filter(Boolean)
      .join(", ");
    return `| ${w.index} | ${phaseSr[w.phase]} | ${f1(w.targetKm)} / ${f1(w.plannedKm)} | ${q1} | ${work(w, "q2")} | ${long ? f1(long.workout.km) : "—"} | ${easy.join(" + ") || "—"} | ${note} |`;
  });
  return [
    "| ned | faza | cilj / plan km | Q1 / test | Q2 | dugi | lagani | napomena |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

const all = [...feelInputs(), ...beginnerInputs()];
const md: string[] = [
  "# HM v2 Segment 03 — primeri (hm-v2.2.0)",
  "",
  "Izvor: `node docs/hm-v2/artifacts/segment-03/run.ts` (ulazi iz mreže 03, `testInputs.ts`).",
];
const inputs: Record<string, unknown> = {};
for (const c of CASES) {
  const input = all.find((x) => x.id === c.id)!.input;
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
    `${p.paceBasis === "feel" ? `Po osećaju: E ${pace(p.paces.E.fast)}–${pace(p.paces.E.slow)}/km, procena VDOT ${f1(p.vdot)} (orijentir T ${pace(p.paces.T)}, RP ${pace(p.paces.RP)}/km), bez prognoze do testa` : `VDOT ${f1(p.vdot)}, RP ${pace(p.paces.RP)}/km`}; vrh ${f1(p.peakKm)} km (granica ${f1(p.peakCapKm)}); upozorenja: ${warn}.`,
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
