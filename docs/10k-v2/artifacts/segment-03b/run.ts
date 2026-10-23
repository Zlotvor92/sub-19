/* Primeri 10K v2 (Segment 03b, 10k-v2.3.1: početnik — T 1,5 km pri malom obimu, bez testa). Pokretanje iz
   korena repoa:
     node docs/10k-v2/artifacts/segment-03b/run.ts
   (Node ≥ 22.18: TypeScript type stripping; potreban web/node_modules zbog prettier-a). Upisuje inputs.json,
   <id>.json (':' u id → '-', zbog Windows putanja) i plans.md pored skripte, formatirane prettier-om (isti
   izlaz kao --check); dva pokretanja daju bajt-isti izlaz. Tabela poređenja 03 → 03b čita
   compare-81bd351.json (piše ga regression-81bd351.ts iz checkouta 81bd351). */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEN_K_V2_POLICY,
  generateTenKV2,
} from "../../../../web/src/domain/generators/tenK/v2/index.ts";
import type {
  GenerateResult,
  TenKV2Plan,
} from "../../../../web/src/domain/generators/tenK/v2/index.ts";
import { CASES, START } from "./cases.ts";
import { type ExampleSummary, summarize } from "./summary.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const prettier = (await import(
  new URL("../../../../web/node_modules/prettier/index.mjs", import.meta.url)
    .href
)) as {
  format: (src: string, opts: Record<string, unknown>) => Promise<string>;
  resolveConfig: (file: string) => Promise<Record<string, unknown> | null>;
};

const fmt = (sec: number): string => {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};
const km = (x: number): string => x.toFixed(1).replace(".", ",");
const SR: Record<string, string> = {
  mon: "pon",
  tue: "uto",
  wed: "sre",
  thu: "čet",
  fri: "pet",
  sat: "sub",
  sun: "ned",
};
const PHASE: Record<string, string> = {
  base: "baza",
  development: "razvoj",
  specific: "specifično",
  taper: "taper",
  race: "trka",
};
const short = (title: string): string =>
  title.replace(/^WU \d+ min \+ /, "").replace(/ \+ CD \d+ min$/, "");
const rpe = (r: { min: number; max: number } | undefined): string =>
  r ? ` · RPE ${r.min === r.max ? r.min : `${r.min}–${r.max}`}` : "";

function roles(p: TenKV2Plan): string {
  const pt = p.pattern;
  return [
    `Q1 ${SR[pt.q1]}`,
    `dugi ${SR[pt.long]}`,
    `lagani ${pt.easy.map((d) => SR[d]).join(", ")}`,
  ].join(", ");
}

function table(plan: TenKV2Plan): string {
  const rows = [
    "| nedelja | faza | km cilj/plan | kvalitet | dugi | lagani | napomena |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const w of plan.weeks) {
    const q = w.days
      .filter((d) => d.workout.kind === "quality" || d.workout.kind === "test")
      .map(
        (d) =>
          `${SR[d.weekday]}: ${short(d.workout.title)}${rpe(d.workout.rpe)}`,
      );
    const long = w.days.find((d) => d.role === "long");
    const race = w.days.find((d) => d.role === "race");
    const easy = w.days
      .filter((d) => d.role === "easy" || d.role === "eve")
      .map(
        (d) =>
          `${SR[d.weekday]} ${d.role === "eve" || d.workout.blocks[0]?.kind === "easy_time" ? `${km(d.workout.km)}*` : km(d.workout.km)}`,
      );
    const notes: string[] = [];
    if (w.deload) notes.push("rasterećenje");
    if (w.fitted)
      notes.push(
        `izvodljiv cilj (pravilo ${km(w.nominalKm)} km, ${w.fitted === "down" ? "naniže" : "naviše"})`,
      );
    for (const n of w.notes)
      if (n.startsWith("Uvod (D28)")) notes.push("uvod bez kvaliteta (D28)");
      else if (n.startsWith("T kontinuirano (D31)"))
        notes.push(n.replace(/ cilja .*$/, ""));
      else if (n.startsWith("Taper (D31)"))
        notes.push("taper: RP ne staje — T kontinuirano (D31)");
      else if (n.startsWith("Bez kvaliteta"))
        notes.push("bez kvaliteta (D11 ispred D28)");
      else if (n.includes("bez kvaliteta"))
        notes.push("bez kvaliteta (D11 ispred D5/D7)");
      else if (n.includes("bez oštrenja")) notes.push("bez oštrenja (D8)");
      else if (n.includes("ponovljen")) notes.push(n.split(" — ")[0]!);
    if (race) notes.push(`trka ${SR[race.weekday]} (van obima)`);
    rows.push(
      `| ${w.index} | ${PHASE[w.phase]} | ${km(w.targetKm)} / ${km(w.plannedKm)} | ${q.join("<br>") || "—"} | ${long ? `${km(long.workout.km)} km` : "—"} | ${easy.join(", ") || "—"} | ${notes.join("; ") || "—"} |`,
    );
  }
  return rows.join("\n");
}

function header(p: TenKV2Plan): string[] {
  const pc = p.paces;
  const feel = p.paceBasis === "feel";
  return [
    feel
      ? `- Osnova tempa: po osećaju (paceBasis feel) · procena VDOT ${km(p.vdot)} (orijentir) · prognoza 10K i ocena cilja: posle rezultata trke ili parkruna`
      : `- Osnova tempa: rezultat (paceBasis result) · VDOT ${km(p.vdot)} · prognoza 10K ${fmt(p.predicted10kSec!)}`,
    `- Tempo /km: E ${fmt(pc.E.fast)}–${fmt(pc.E.slow)}${feel ? ` (lagan ${fmt(p.input.easyPaceSecPerKm!)} ± ${TEN_K_V2_POLICY.feel.eRangeSec} s)` : ""}; ${feel ? "orijentir (procena)" : "iz VDOT-a"}: T ${fmt(pc.T)}, RP ${fmt(pc.RP)}`,
    `- Dani (${p.input.runDays.length}, početnik): ${roles(p)}; WU/CD 15/10 min`,
    `- Obim: start ${km(p.startKm)} → vrh ${km(p.peakKm)} km (granica izgradnje ${km(p.peakCapKm)} km)`,
    `- Test 5 km: nema (početnik, D32)`,
    `- Upozorenja: ${
      p.warnings.length === 0
        ? "nema"
        : [...new Set(p.warnings.map((w) => w.rule))]
            .map(
              (rule) =>
                `${rule} ×${p.warnings.filter((w) => w.rule === rule).length}`,
            )
            .join(", ")
    }`,
    ...p.notes.map((n) => `- Napomena plana: ${n}`),
  ];
}

const results: { id: string; note: string; r: GenerateResult }[] = CASES.map(
  (c) => ({ id: c.id, note: c.note, r: generateTenKV2(c.input) }),
);
const before = JSON.parse(
  readFileSync(join(OUT, "compare-81bd351.json"), "utf8"),
) as { against: string; cases: Record<string, ExampleSummary> };

function compare(): string[] {
  const rows = [
    "| primer | nedelje 3 … taper sa kvalitetom | test 5 km (nedelja) | najkraći dugi | dugi rasterećenja | vrh | taper / oštrenje |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const { id, r } of results) {
    const a = before.cases[id]!;
    const b = summarize(r) as ExampleSummary;
    const sharp = (s: ExampleSummary): string =>
      `${s.taper} / ${s.sharpener ? "da" : "ne"}`;
    rows.push(
      `| ${id} | ${a.qualityWeeks} / ${a.trainingWeeks} → ${b.qualityWeeks} / ${b.trainingWeeks} | ${a.test ?? "—"} → ${b.test ?? "—"} | ${km(a.shortestLong)} → ${km(b.shortestLong)} km | ${a.deloadLongs.map(km).join(", ")} → ${b.deloadLongs.map(km).join(", ")} km | ${km(a.peak)} → ${km(b.peak)} km | ${sharp(a)} → ${sharp(b)} |`,
    );
  }
  return rows;
}

async function write(name: string, text: string): Promise<void> {
  const file = join(OUT, name);
  const opts = (await prettier.resolveConfig(file)) ?? {};
  writeFileSync(file, await prettier.format(text, { ...opts, filepath: file }));
}

await write("inputs.json", JSON.stringify(CASES, null, 2) + "\n");
const md: string[] = [
  `# 10K v2 — primeri segmenta 03b (${TEN_K_V2_POLICY.version})`,
  "",
  "Generisano: `node docs/10k-v2/artifacts/segment-03b/run.ts`. Start: " +
    START +
    " (ponedeljak); trka u nedelju. Km cilj/plan = cilj nedelje / planirano; trka i njen WU/CD nisu u obimu. Lagani sa * su zadati vremenom (trkačka nedelja). Tempo T/RP u planu po osećaju je orijentir (procena), trening vodi RPE. JSON fajlovi: `:` u id → `-`.",
  "",
  `## Poređenje 03 (${before.against}, 10k-v2.3.0) → 03b (${TEN_K_V2_POLICY.version})`,
  "",
  ...compare(),
  "",
];
for (const { id, note, r } of results) {
  await write(
    `${id.replace(/:/g, "-")}.json`,
    JSON.stringify(r, null, 2) + "\n",
  );
  md.push(`## ${id}: ${note}`, "");
  if (!r.ok) {
    md.push("**Odbijeno:**", "");
    for (const x of r.reasons) md.push(`- \`${x.code}\`: ${x.message}`);
    md.push("");
    continue;
  }
  md.push(...header(r.plan), "", table(r.plan), "");
}
await write("plans.md", md.join("\n"));
for (const { id, r } of results)
  console.log(
    id,
    r.ok
      ? `OK ${r.plan.paceBasis} ${r.plan.weeks.length}w ${r.plan.startKm}→${r.plan.peakKm} warn=${r.plan.warnings.length}`
      : `REJ ${r.reasons.map((x) => x.code).join(",")}`,
  );
