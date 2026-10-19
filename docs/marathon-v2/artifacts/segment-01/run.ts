/* Primeri maraton v2 (Segment 01, marathon-v2.0.0). Pokretanje iz korena repoa:
     node --experimental-strip-types docs/marathon-v2/artifacts/segment-01/run.ts
   (Node ≥ 22; potreban web/node_modules zbog prettier-a). Upisuje inputs.json, <id>.json (ceo plan) i
   examples.md (tabela po nedelji) pored skripte, formatirane prettier-om; dva pokretanja daju bajt-isti izlaz. */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import type {
  MarathonV2Plan,
  PlanWeek,
} from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import {
  inputOf,
  SCHEDULES,
  type Profile,
} from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const prettier = (await import(
  new URL("../../../../web/node_modules/prettier/index.mjs", import.meta.url)
    .href
)) as {
  format: (src: string, opts: Record<string, unknown>) => Promise<string>;
};

const km = (x: number): string => x.toFixed(1).replace(".", ",");
const hms = (sec: number): string => {
  const s = Math.round(sec);
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const pace = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const PHASE: Record<string, string> = {
  base: "baza",
  development: "razvoj",
  specific: "specifično",
  taper: "taper",
  race: "trka",
};

interface Example {
  id: string;
  note: string;
  profile: Profile;
}

const EXAMPLES: Example[] = [
  {
    id: "mali-obim-16w-35km-v45",
    note: "mali obim: 35 km, VDOT 45 (HM 1:42), 16 ned, uto/čet/sub/ned",
    profile: {
      weeks: 16,
      km: 35,
      vdot: 45,
      days: SCHEDULES.A.days,
      long: "sun",
    },
  },
  {
    id: "veliki-obim-20w-65km-v55",
    note: "veliki obim: 65 km, VDOT 55, 20 ned, uto/čet/sub/ned",
    profile: {
      weeks: 20,
      km: 65,
      vdot: 55,
      days: SCHEDULES.A.days,
      long: "sun",
    },
  },
  {
    id: "spor-18w-45km-v30",
    note: "spor trkač: 45 km, VDOT 30, 18 ned, pon/sre/pet/ned",
    profile: {
      weeks: 18,
      km: 45,
      vdot: 30,
      days: SCHEDULES.B.days,
      long: "sun",
    },
  },
  {
    id: "brz-18w-45km-v70",
    note: "brz trkač: 45 km, VDOT 70, 18 ned, pon/uto/čet/sub, trka subota",
    profile: {
      weeks: 18,
      km: 45,
      vdot: 70,
      days: SCHEDULES.C.days,
      long: "sat",
      race: "sat",
    },
  },
];

const work = (w: PlanWeek, role: string): string => {
  const d = w.days.find((x) => x.role === role);
  if (!d || d.workout.kind !== "quality") return "—";
  return d.workout.title
    .replace(/^WU \d+ min \+ /, "")
    .replace(/ \+ CD \d+ min$/, "");
};

function table(p: MarathonV2Plan): string {
  const rows = p.weeks.map((w) => {
    const long = w.days.find((d) => d.role === "long");
    const easy = w.days
      .filter((d) => d.role === "easy")
      .map((d) => km(d.workout.km));
    const note = [
      w.deload ? "rasterećenje" : "",
      w.fitted ? `izvodljiv (pravilo ${km(w.nominalKm)})` : "",
      w.phase === "race"
        ? `${w.days.map((d) => `${d.weekday} ${d.role}`).join(", ")}; maraton van obima`
        : "",
    ]
      .filter(Boolean)
      .join("; ");
    return `| ${w.index} | ${PHASE[w.phase]} | ${km(w.targetKm)}/${km(w.plannedKm)} | ${w.phase === "race" ? work(w, "sharpener") : work(w, "q1")} | ${work(w, "q2")} | ${long ? km(long.workout.km) : "—"} | ${easy.join(" / ") || "—"} | ${note || "—"} |`;
  });
  return [
    "| ned | faza | cilj/plan | Q1 | Q2 | dugi | lagan | napomena |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

const inputs: Record<string, unknown> = {};
const md: string[] = [
  "# Maraton v2 — primeri Segmenta 01 (marathon-v2.0.0)",
  "",
  "Generisano skriptom `run.ts` (bajt-isto pri svakom pokretanju).",
];
for (const ex of EXAMPLES) {
  const input = inputOf(ex.profile);
  inputs[ex.id] = input;
  const r = generateMarathonV2(input);
  writeFileSync(join(OUT, `${ex.id}.json`), `${JSON.stringify(r, null, 2)}\n`);
  md.push("", `## ${ex.id}`, "", ex.note);
  if (!r.ok) {
    md.push("", `ODBIJENO: ${r.reasons.map((x) => x.message).join("; ")}`);
    continue;
  }
  const p = r.plan;
  md.push(
    "",
    `VDOT ${km(p.vdot)}, maratonski VDOT ${km(p.paces.mpVdot)} (M2); MP ${pace(p.paces.MP)}/km, T ${pace(p.paces.T)}, I ${pace(p.paces.I)}, R ${pace(p.paces.R)}, E ${pace(p.paces.E.fast)}–${pace(p.paces.E.slow)}; prognoza ${hms(p.predictedMarathonSec)}. Start ${km(p.startKm)} km, granica izgradnje ${km(p.peakCapKm)}, vrh ${km(p.peakKm)} km.`,
    "",
    table(p),
    "",
    `Upozorenja: ${p.warnings.map((w) => w.rule).join(", ") || "—"}. Napomene plana: ${p.notes.join(" ") || "—"}`,
  );
}
writeFileSync(join(OUT, "inputs.json"), `${JSON.stringify(inputs, null, 2)}\n`);
writeFileSync(join(OUT, "examples.md"), `${md.join("\n")}\n`);
for (const f of [
  "inputs.json",
  "examples.md",
  ...EXAMPLES.map((e) => `${e.id}.json`),
]) {
  const path = join(OUT, f);
  const { readFileSync } = await import("node:fs");
  writeFileSync(
    path,
    await prettier.format(readFileSync(path, "utf8"), { filepath: path }),
  );
}
