/* Primeri 10K v2 (Segment 02b, 10k-v2.2.1: udeo dugog 3 dana, trkačka ≤ taper, RP struktura, D25).
   Pokretanje iz korena repoa:
     node docs/10k-v2/artifacts/segment-02b/run.ts
   (Node ≥ 22.18: TypeScript type stripping; potreban web/node_modules zbog prettier-a). Ulazi segmenta 02
   + 3 nova. Upisuje inputs.json, <id>.json i plans.md pored skripte, formatirane prettier-om (isti izlaz
   kao --check); dva pokretanja daju bajt-isti izlaz. Tabela poređenja 02 → 02b čita compare-49ad476.json
   (upisuje ga regression-49ad476.ts iz checkouta 49ad476, za ulaze iz inputs.json). */

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
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
import { type ExampleSummary, summarize } from "./summary.ts";

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
  group: "plan" | "kratka priprema" | "granični" | "odbijeni";
  note: string;
  input: Record<string, unknown>;
}

const D3 = ["tue", "thu", "sun"];
const D3B = ["mon", "wed", "sat"];
const D4 = ["tue", "thu", "sat", "sun"];
const D5 = ["mon", "tue", "thu", "sat", "sun"];
const D5B = ["tue", "wed", "thu", "sat", "sun"];
const D6 = ["mon", "tue", "wed", "thu", "sat", "sun"];
const D6C = ["mon", "tue", "wed", "thu", "fri", "sat"];

const base = (o: {
  weeks: number;
  km: number;
  vdot: number;
  days: string[];
  race?: "sat" | "sun";
  goal?: number;
}): Record<string, unknown> => {
  const start = o.race === "sat" ? addDays(START, -1) : START;
  return {
    startDate: start,
    raceDate: addDays(start, o.weeks * 7 - 1),
    runDays: o.days,
    currentWeeklyKm: o.km,
    recentResult: {
      distanceM: 10000,
      timeSec: timeForVdot(o.vdot),
      date: addDays(start, -14),
    },
    goalTimeSec: o.goal ?? null,
  };
};

const CASES: Case[] = [
  {
    id: "d3-20km-v35-12w",
    group: "plan",
    note: "3 dana uto/čet/ned, 20 km, VDOT 35, 12 ned, cilj 55:00",
    input: base({ weeks: 12, km: 20, vdot: 35, days: D3, goal: 55 * 60 }),
  },
  {
    id: "d3-35km-v45-10w",
    group: "plan",
    note: "3 dana pon/sre/sub, 35 km, VDOT 45, 10 ned, trka subota",
    input: base({ weeks: 10, km: 35, vdot: 45, days: D3B, race: "sat" }),
  },
  {
    id: "d5-35km-v40-12w",
    group: "plan",
    note: "5 dana pon/uto/čet/sub/ned, 35 km, VDOT 40, 12 ned",
    input: base({ weeks: 12, km: 35, vdot: 40, days: D5 }),
  },
  {
    id: "d5-60km-v55-16w",
    group: "plan",
    note: "5 dana uto/sre/čet/sub/ned, 60 km, VDOT 55, 16 ned, cilj 37:00",
    input: base({ weeks: 16, km: 60, vdot: 55, days: D5B, goal: 37 * 60 }),
  },
  {
    id: "d6-45km-v45-14w",
    group: "plan",
    note: "6 dana pon–čet/sub/ned, 45 km, VDOT 45, 14 ned",
    input: base({ weeks: 14, km: 45, vdot: 45, days: D6 }),
  },
  {
    id: "d6-80km-v65-18w",
    group: "plan",
    note: "6 dana pon–sub, 80 km, VDOT 65, 18 ned",
    input: base({ weeks: 18, km: 80, vdot: 65, days: D6C }),
  },
  {
    id: "short-8w-d4-35km-v45",
    group: "kratka priprema",
    note: "8 ned, 4 dana, 35 km, VDOT 45",
    input: base({ weeks: 8, km: 35, vdot: 45, days: D4 }),
  },
  {
    id: "short-9w-d5-45km-v50",
    group: "kratka priprema",
    note: "9 ned, 5 dana, 45 km, VDOT 50, cilj 41:00",
    input: base({ weeks: 9, km: 45, vdot: 50, days: D5, goal: 41 * 60 }),
  },
  {
    id: "short-8w-d3-25km-v38",
    group: "kratka priprema",
    note: "8 ned, 3 dana, 25 km, VDOT 38",
    input: base({ weeks: 8, km: 25, vdot: 38, days: D3 }),
  },
  {
    id: "d3-35km-v40-12w",
    group: "plan",
    note: "02b D17: 3 dana uto/čet/ned, 35 km, VDOT 40, 12 ned (udeo dugog 45 %)",
    input: base({ weeks: 12, km: 35, vdot: 40, days: D3 }),
  },
  {
    id: "d5-30km-v70-10w",
    group: "plan",
    note: "02b D23: 5 dana pon/uto/čet/sub/ned, 30 km, VDOT 70, 10 ned, trka subota (trkačka ≤ taper)",
    input: base({ weeks: 10, km: 30, vdot: 70, days: D5, race: "sat" }),
  },
  {
    id: "d4-25km-v70-10w",
    group: "plan",
    note: "02b D25: 4 dana uto/čet/sub/ned, 25 km, VDOT 70, 10 ned (kvalitetni dan duži od dugog)",
    input: base({ weeks: 10, km: 25, vdot: 70, days: D4 }),
  },
  {
    id: "edge-d6-80km-v30",
    group: "granični",
    note: "kapacitet: 6 dana, 80 km, VDOT 30, 14 ned (105 min seče dugi)",
    input: base({ weeks: 14, km: 80, vdot: 30, days: D6 }),
  },
  {
    id: "rej-2-days",
    group: "odbijeni",
    note: "2 dana nedeljno",
    input: base({ weeks: 12, km: 30, vdot: 45, days: ["tue", "sun"] }),
  },
  {
    id: "rej-7-days",
    group: "odbijeni",
    note: "7 dana nedeljno",
    input: base({
      weeks: 12,
      km: 50,
      vdot: 45,
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    }),
  },
  {
    id: "rej-3-days-45km",
    group: "odbijeni",
    note: "3 dana, 45 km",
    input: base({ weeks: 12, km: 45, vdot: 45, days: D3 }),
  },
  {
    id: "rej-6-days-30km",
    group: "odbijeni",
    note: "6 dana, 30 km",
    input: base({ weeks: 12, km: 30, vdot: 45, days: D6 }),
  },
  {
    id: "rej-7-weeks",
    group: "odbijeni",
    note: "7 nedelja",
    input: base({ weeks: 7, km: 35, vdot: 45, days: D4 }),
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
const GOAL: Record<string, string> = {
  realistic: "realističan",
  ambitious: "ambiciozan",
  unrealistic: "nerealan",
};
const short = (title: string): string =>
  title.replace(/^WU \d+ min \+ /, "").replace(/ \+ CD \d+ min$/, "");

function wuCd(p: TenKV2Plan): string {
  const q = p.weeks[0]!.days.find((d) => d.workout.kind === "quality")!;
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
    "| nedelja | faza | km cilj/plan | kvalitet | dugi | lagani (svi) | napomena |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const w of plan.weeks) {
    const q = w.days
      .filter((d) => d.workout.kind === "quality")
      .map((d) => `${SR[d.weekday]}: ${short(d.workout.title)}`);
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
      if (n.includes("bez kvaliteta"))
        notes.push("bez kvaliteta (D11 ispred D5/D7, odstupanje)");
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
const before = JSON.parse(
  readFileSync(join(OUT, "compare-49ad476.json"), "utf8"),
) as { against: string; cases: Record<string, ExampleSummary> };
const one = (
  s: ExampleSummary | undefined,
  f: (s: ExampleSummary) => string,
) => (s && s.ok ? f(s) : "odbijeno");
const warnText = (s: ExampleSummary): string =>
  Object.entries(s.warnings)
    .map(([rule, n]) => `${rule}${n > 1 ? ` ×${n}` : ""}`)
    .join(", ") || "—";
const w1 = (s: ExampleSummary): string =>
  `${km(s.week1!)} (${km(s.week1Long!)})`;
const compare: string[] = [
  "## Poređenje 02 (49ad476, 10k-v2.2.0) → 02b",
  "",
  "| primer | ned 1 km (dugi) | vrh km | trkačka / taper km | upozorenja 02 | upozorenja 02b |",
  "|---|---|---|---|---|---|",
];
for (const { c, r } of results) {
  const a = before.cases[c.id];
  const b = summarize(r);
  if (!b.ok && (!a || !a.ok)) continue;
  compare.push(
    `| ${c.id} | ${one(a, w1)} → ${one(b, w1)} | ${one(a, (s) => km(s.peak!))} → ${one(b, (s) => km(s.peak!))} | ${one(a, (s) => `${km(s.race!)} / ${km(s.taper!)}`)} → ${one(b, (s) => `${km(s.race!)} / ${km(s.taper!)}`)} | ${one(a, warnText)} | ${one(b, warnText)} |`,
  );
}
const md: string[] = [
  `# 10K v2 — primeri segmenta 02b (${TEN_K_V2_POLICY.version})`,
  "",
  "Generisano: `node docs/10k-v2/artifacts/segment-02b/run.ts`. Start: " +
    START +
    " (ponedeljak; trka subota: dan ranije). Km cilj/plan = cilj nedelje / planirano; trka i njen WU/CD nisu u obimu. Lagani sa * su zadati vremenom (trkačka nedelja: 35 min E ili dan pred trku 20 min E + ubrzanja); trkačka nedelja zadata u km kad je lagan tapera kraći od 35 min E (D23).",
  "",
  ...compare,
  "",
];
for (const { c, r } of results) {
  await write(`${c.id}.json`, JSON.stringify(r, null, 2) + "\n");
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
  const p = r.plan;
  const pc = p.paces;
  md.push(
    `- VDOT ${p.vdot} · prognoza 10K ${fmt(p.predicted10kSec)} · tempo /km: E ${fmt(pc.E.fast)}–${fmt(pc.E.slow)}, T ${fmt(pc.T)}, I ${fmt(pc.I)}, R ${fmt(pc.R)}, RP ${fmt(pc.RP)}`,
    `- Dani (${p.input.runDays.length}): ${roles(p)}`,
    `- WU/CD kvaliteta: ${wuCd(p)} (D14, pojas trenutnog obima)`,
    `- Obim: start ${km(p.startKm)} → vrh ${km(p.peakKm)} km (granica izgradnje ${km(p.peakCapKm)} km)`,
    `- Cilj: ${p.goal ? `${fmt(p.goal.goalTimeSec)} → ${GOAL[p.goal.status]} (VDOT cilja ${p.goal.goalVdot}, razlika ${p.goal.vdotGap})` : "nije zadat"}`,
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
    "",
    table(p),
    "",
  );
}
await write("plans.md", md.join("\n"));
for (const { c, r } of results)
  console.log(
    c.id,
    r.ok
      ? `OK ${r.plan.weeks.length}w ${r.plan.startKm}→${r.plan.peakKm} warn=${r.plan.warnings.length}`
      : `REJ ${r.reasons.map((x) => x.code).join(",")}`,
  );
