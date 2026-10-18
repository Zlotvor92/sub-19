/* Primeri 10K v2 (Segment 03, 10k-v2.3.0: plan po osećaju + test 5 km, početnik, bez trčanja/hodanja,
   ispravke RP i trkačke nedelje). Pokretanje iz korena repoa:
     node docs/10k-v2/artifacts/segment-03/run.ts
   (Node ≥ 22.18: TypeScript type stripping; potreban web/node_modules zbog prettier-a). Upisuje inputs.json,
   <id>.json (':' u id → '-', zbog Windows putanja) i plans.md pored skripte, formatirane prettier-om (isti
   izlaz kao --check); dva pokretanja daju bajt-isti izlaz. */

import { writeFileSync } from "node:fs";
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
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const prettier = (await import(
  new URL("../../../../web/node_modules/prettier/index.mjs", import.meta.url)
    .href
)) as {
  format: (src: string, opts: Record<string, unknown>) => Promise<string>;
  resolveConfig: (file: string) => Promise<Record<string, unknown> | null>;
};

const START = "2026-11-02"; // ponedeljak; trka nedelja = START + 7N − 1

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

interface Case {
  id: string;
  group: "po osećaju" | "početnik" | "odbijeni";
  note: string;
  input: Record<string, unknown>;
}

const D3 = ["tue", "thu", "sun"];
const D4 = ["tue", "thu", "sat", "sun"];
const D5 = ["mon", "tue", "thu", "sat", "sun"];
const D6 = ["mon", "tue", "wed", "thu", "sat", "sun"];

const base = (o: {
  weeks: number;
  km: number;
  days: string[];
  easy?: number;
  vdot?: number;
  resultTimeSec?: number;
  resultDaysBefore?: number;
  beginner?: boolean;
  runWalk?: boolean;
}): Record<string, unknown> => {
  const time =
    o.resultTimeSec ?? (o.vdot !== undefined ? timeForVdot(o.vdot) : null);
  return {
    startDate: START,
    raceDate: addDays(START, o.weeks * 7 - 1),
    runDays: o.days,
    currentWeeklyKm: o.km,
    recentResult:
      time === null
        ? null
        : {
            distanceM: 10000,
            timeSec: time,
            date: addDays(START, -(o.resultDaysBefore ?? 14)),
          },
    goalTimeSec: null,
    ...(o.easy !== undefined ? { easyPaceSecPerKm: o.easy } : {}),
    ...(o.beginner ? { experience: "beginner" } : {}),
    ...(o.runWalk ? { runWalk: true } : {}),
  };
};

const CASES: Case[] = [
  {
    id: "feel-d4-30km-e6:00-12w",
    group: "po osećaju",
    note: "4 dana uto/čet/sub/ned, 30 km, lagan 6:00/km, bez rezultata, 12 ned",
    input: base({ weeks: 12, km: 30, days: D4, easy: 360 }),
  },
  {
    id: "feel-d3-20km-e7:30-10w",
    group: "po osećaju",
    note: "3 dana uto/čet/ned, 20 km, lagan 7:30/km, bez rezultata, 10 ned",
    input: base({ weeks: 10, km: 20, days: D3, easy: 450 }),
  },
  {
    id: "feel-d6-60km-e5:00-16w",
    group: "po osećaju",
    note: "6 dana pon–čet/sub/ned, 60 km, lagan 5:00/km, bez rezultata, 16 ned",
    input: base({ weeks: 16, km: 60, days: D6, easy: 300 }),
  },
  {
    id: "feel-old-result-d5-40km-e5:30-14w",
    group: "po osećaju",
    note: "5 dana pon/uto/čet/sub/ned, 40 km, lagan 5:30/km, rezultat 10 km VDOT 45 star 120 dana, 14 ned",
    input: base({
      weeks: 14,
      km: 40,
      days: D5,
      easy: 330,
      vdot: 45,
      resultDaysBefore: 120,
    }),
  },
  {
    id: "feel-vdot-lt30-d3-20km-e8:15-12w",
    group: "po osećaju",
    note: "3 dana uto/čet/ned, 20 km, lagan 8:15/km, rezultat 10 km sa VDOT < 30, 12 ned",
    input: base({
      weeks: 12,
      km: 20,
      days: D3,
      easy: 495,
      resultTimeSec: timeForVdot(30) + 60,
    }),
  },
  {
    id: "beg-d3-15km-e7:30-12w",
    group: "početnik",
    note: "početnik, 3 dana uto/čet/ned, 15 km, lagan 7:30/km, bez rezultata, 12 ned",
    input: base({ weeks: 12, km: 15, days: D3, easy: 450, beginner: true }),
  },
  {
    id: "beg-d4-25km-result-v35-14w",
    group: "početnik",
    note: "početnik, 4 dana uto/čet/sub/ned, 25 km, rezultat 10 km VDOT 35, 14 ned",
    input: base({ weeks: 14, km: 25, days: D4, vdot: 35, beginner: true }),
  },
  {
    id: "beg-d4-18km-e8:00-10w",
    group: "početnik",
    note: "početnik, 4 dana uto/čet/sub/ned, 18 km, lagan 8:00/km, bez rezultata, 10 ned",
    input: base({ weeks: 10, km: 18, days: D4, easy: 480, beginner: true }),
  },
  {
    id: "rej-feel-no-easy-pace",
    group: "odbijeni",
    note: "bez rezultata i bez laganog tempa",
    input: base({ weeks: 12, km: 30, days: D4 }),
  },
  {
    id: "rej-beginner-5-days",
    group: "odbijeni",
    note: "početnik, 5 dana",
    input: base({ weeks: 12, km: 30, days: D5, easy: 390, beginner: true }),
  },
  {
    id: "rej-beginner-8-weeks",
    group: "odbijeni",
    note: "početnik, 8 nedelja",
    input: base({ weeks: 8, km: 20, days: D3, easy: 390, beginner: true }),
  },
  {
    id: "rej-beginner-d3-12km",
    group: "odbijeni",
    note: "početnik, 3 dana, 12 km",
    input: base({ weeks: 12, km: 12, days: D3, easy: 450, beginner: true }),
  },
  {
    id: "rej-run-walk",
    group: "odbijeni",
    note: "trčanje/hodanje",
    input: base({ weeks: 12, km: 20, days: D3, easy: 480, runWalk: true }),
  },
];

const fmt = (sec: number): string => {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
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

function wuCd(p: TenKV2Plan): string {
  const q = p.weeks
    .flatMap((w) => w.days)
    .find((d) => d.workout.kind === "quality" || d.workout.kind === "test");
  if (!q) return "—";
  const s = q.workout.segments;
  return `${s[0]!.sec / 60}/${s[s.length - 1]!.sec / 60} min`;
}

function roles(p: TenKV2Plan): string {
  const pt = p.pattern;
  return [
    `Q1 ${SR[pt.q1]}`,
    ...(pt.q2 ? [`Q2 ${SR[pt.q2]}`] : []),
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
    if (w.test) notes.push("test 5 km (D27)");
    if (w.fitted)
      notes.push(
        `izvodljiv cilj (pravilo ${km(w.nominalKm)} km, ${w.fitted === "down" ? "naniže" : "naviše"})`,
      );
    for (const n of w.notes)
      if (n.startsWith("Uvod (D28)")) notes.push("uvod bez kvaliteta (D28)");
      else if (n.startsWith("Bez kvaliteta"))
        notes.push("bez kvaliteta (D11 ispred D28)");
      else if (n.includes("skraćen sa"))
        notes.push("dugi skraćen (D27 ispred D5)");
      else if (n.includes("bez kvaliteta"))
        notes.push("bez kvaliteta (D11 ispred D5/D7)");
      else if (n.includes("samo RP")) notes.push("samo RP (odstupanje D7)");
      else if (n.includes("bez oštrenja")) notes.push("bez oštrenja (D8)");
      else if (n.includes("ponovljen") || n.includes("spušten sa"))
        notes.push(n.split(" — ")[0]!);
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
  const t = p.weeks.find((w) => w.test);
  const td = t?.days.find((d) => d.role === "test");
  const r = TEN_K_V2_POLICY.feel.rpe;
  const z = (k: keyof typeof r): string =>
    `${k} ${r[k].min === r[k].max ? r[k].min : `${r[k].min}–${r[k].max}`} („${r[k].cue}")`;
  return [
    feel
      ? `- Osnova tempa: po osećaju (paceBasis feel) · procena VDOT ${km(p.vdot)} (orijentir) · prognoza 10K i ocena cilja: posle testa`
      : `- Osnova tempa: rezultat (paceBasis result) · VDOT ${km(p.vdot)} · prognoza 10K ${fmt(p.predicted10kSec!)}`,
    `- Tempo /km: E ${fmt(pc.E.fast)}–${fmt(pc.E.slow)}${feel ? ` (lagan ${fmt(p.input.easyPaceSecPerKm!)} ± ${TEN_K_V2_POLICY.feel.eRangeSec} s)` : ""}; ${feel ? "orijentir (procena)" : "iz VDOT-a"}: T ${fmt(pc.T)}, I ${fmt(pc.I)}, R ${fmt(pc.R)}, RP ${fmt(pc.RP)}`,
    `- RPE: ${feel ? `${z("T")}, ${z("RP")}, ${z("I")}, ${z("R")}` : "— (plan sa rezultatom)"}`,
    `- Dani (${p.input.runDays.length}${p.input.experience === "beginner" ? ", početnik" : ""}): ${roles(p)}; WU/CD ${wuCd(p)}`,
    `- Obim: start ${km(p.startKm)} → vrh ${km(p.peakKm)} km (granica izgradnje ${km(p.peakCapKm)} km)`,
    `- Test 5 km: ${t && td ? `nedelja ${t.index} (${PHASE[t.phase]}${t.deload ? ", rasterećenje" : ""}), ${SR[td.weekday]} ${td.date}` : "nema (plan sa rezultatom)"}`,
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

const results: { c: Case; r: GenerateResult }[] = CASES.map((c) => ({
  c,
  r: generateTenKV2(c.input),
}));

async function write(name: string, text: string): Promise<void> {
  const file = join(OUT, name);
  const opts = (await prettier.resolveConfig(file)) ?? {};
  writeFileSync(file, await prettier.format(text, { ...opts, filepath: file }));
}

await write("inputs.json", JSON.stringify(CASES, null, 2) + "\n");
const md: string[] = [
  `# 10K v2 — primeri segmenta 03 (${TEN_K_V2_POLICY.version})`,
  "",
  "Generisano: `node docs/10k-v2/artifacts/segment-03/run.ts`. Start: " +
    START +
    " (ponedeljak); trka u nedelju. Km cilj/plan = cilj nedelje / planirano; trka i njen WU/CD nisu u obimu. Lagani sa * su zadati vremenom (trkačka nedelja). U planu po osećaju tempo T/I/R/RP je orijentir (procena), trening vodi RPE. JSON fajlovi: `:` u id → `-`.",
  "",
];
for (const { c, r } of results) {
  await write(
    `${c.id.replace(/:/g, "-")}.json`,
    JSON.stringify(r, null, 2) + "\n",
  );
  md.push(`## ${c.id} — ${c.group}: ${c.note}`, "");
  if (!r.ok) {
    md.push("**Odbijeno:**", "");
    for (const x of r.reasons)
      md.push(
        `- \`${x.code}\`${x.week ? ` (ned ${x.week})` : ""}: ${x.message}`,
      );
    md.push("");
    continue;
  }
  md.push(...header(r.plan), "", table(r.plan), "");
}
await write("plans.md", md.join("\n"));
for (const { c, r } of results)
  console.log(
    c.id,
    r.ok
      ? `OK ${r.plan.paceBasis} ${r.plan.weeks.length}w ${r.plan.startKm}→${r.plan.peakKm} warn=${r.plan.warnings.length}`
      : `REJ ${r.reasons.map((x) => x.code).join(",")}`,
  );
