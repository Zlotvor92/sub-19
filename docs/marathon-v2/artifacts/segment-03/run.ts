/* Primeri maraton v2 (Segment 03, marathon-v2.2.0): plan po osećaju + test 5 km (M16), početnik (M17).
   Pokretanje iz korena repoa:
     node --experimental-strip-types docs/marathon-v2/artifacts/segment-03/run.ts
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
  SCHEDULES_BY_DAYS as S,
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
    id: "feel-d4-16w-45km-e360",
    note: "Po osećaju, 4 dana: 45 km, lagan 6:00/km, 16 ned, uto/čet/sub/ned — test 5 km u rasterećenju (ned 4, dan Q2)",
    profile: {
      weeks: 16,
      km: 45,
      easyPace: 360,
      days: S[4].A.days,
      long: "sun",
    },
  },
  {
    id: "feel-d3-12w-30km-e450",
    note: "Po osećaju, 3 dana, mali obim: 30 km, lagan 7:30/km, 12 ned, uto/čet/ned — test na danu Q1 (ned 3)",
    profile: {
      weeks: 12,
      km: 30,
      easyPace: 450,
      days: S[3].A.days,
      long: "sun",
    },
  },
  {
    id: "feel-d3-14w-30km-e270",
    note: "Po osećaju, 3 dana, brz lagan 4:30/km, 30 km, 14 ned — rasterećenje sa testom, dugi skraćen (odstupanje M16 ispred M5)",
    profile: {
      weeks: 14,
      km: 30,
      easyPace: 270,
      days: S[3].A.days,
      long: "sun",
    },
  },
  {
    id: "feel-d6-20w-90km-e315",
    note: "Po osećaju, 6 dana, veliki obim: 90 km, lagan 5:15/km, 20 ned, pon/uto/sre/čet/sub/ned",
    profile: {
      weeks: 20,
      km: 90,
      easyPace: 315,
      days: S[6].A.days,
      long: "sun",
    },
  },
  {
    id: "beg-d4-18w-35km-v35",
    note: "Početnik sa rezultatom, 4 dana: 35 km, VDOT 35, 18 ned, uto/čet/sub/ned",
    profile: {
      weeks: 18,
      km: 35,
      vdot: 35,
      days: S[4].A.days,
      long: "sun",
      experience: "beginner",
    },
  },
  {
    id: "beg-d4-16w-25km-e450",
    note: "Početnik po osećaju, 4 dana, najmanji obim: 25 km, lagan 7:30/km, 16 ned — rasterećenje sa skraćenim dugim (S2), N−1 T kont. bez MP i trkačka bez oštrenja (S3)",
    profile: {
      weeks: 16,
      km: 25,
      easyPace: 450,
      days: S[4].A.days,
      long: "sun",
      experience: "beginner",
    },
  },
  {
    id: "beg-d5-20w-45km-e420",
    note: "Početnik po osećaju, 5 dana: 45 km, lagan 7:00/km, 20 ned, uto/sre/čet/sub/ned (bez testa)",
    profile: {
      weeks: 20,
      km: 45,
      easyPace: 420,
      days: S[5].B.days,
      long: "sun",
      experience: "beginner",
    },
  },
];

const work = (w: PlanWeek, role: string): string => {
  const d = w.days.find((x) => x.role === role);
  if (d?.workout.kind === "test") return "test 5 km";
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
    const test = w.days.find((d) => d.role === "test");
    const note = [
      w.deload ? "rasterećenje" : "",
      test ? `test ${test.weekday}` : "",
      w.notes.some((n) => n.includes("skraćen sa 0,8 ×")) ? "dugi skraćen" : "",
      w.notes.some((n) => n.startsWith("Uvod (M17)")) ? "uvod" : "",
      w.notes.some((n) => n.startsWith("T kontinuirano (M17)"))
        ? "T kont. umesto lestvice faze"
        : "",
      w.fitted ? `izvodljiv (pravilo ${km(w.nominalKm)})` : "",
      w.phase === "race"
        ? `${w.days.map((d) => `${d.weekday} ${d.role}`).join(", ")}; maraton van obima`
        : "",
    ]
      .filter(Boolean)
      .join("; ");
    const q1 =
      w.phase === "race"
        ? work(w, "sharpener")
        : test && !w.deload
          ? "test 5 km"
          : work(w, "q1");
    const q2 = test && w.deload ? "test 5 km" : work(w, "q2");
    return `| ${w.index} | ${PHASE[w.phase]} | ${km(w.targetKm)}/${km(w.plannedKm)} | ${q1} | ${q2} | ${long ? km(long.workout.km) : "—"} | ${easy.join(" / ") || "—"} | ${note || "—"} |`;
  });
  return [
    "| ned | faza | cilj/plan | Q1 | Q2 | dugi | lagan | napomena |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

const inputs: Record<string, unknown> = {};
const md: string[] = [
  "# Maraton v2 — primeri Segmenta 03 (marathon-v2.2.0)",
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
    `${p.paceBasis === "feel" ? "Po osećaju: procena VDOT" : "VDOT"} ${km(p.vdot)}, maratonski VDOT ${km(p.paces.mpVdot)} (M2); MP ${pace(p.paces.MP)}/km, T ${pace(p.paces.T)}, I ${pace(p.paces.I)}, R ${pace(p.paces.R)}${p.paceBasis === "feel" ? " (orijentir, RPE)" : ""}, E ${pace(p.paces.E.fast)}–${pace(p.paces.E.slow)}; prognoza ${p.predictedMarathonSec === null ? "— (posle testa)" : hms(p.predictedMarathonSec)}. Start ${km(p.startKm)} km, granica izgradnje ${km(p.peakCapKm)}, vrh ${km(p.peakKm)} km.`,
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
