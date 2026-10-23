/* Primeri 10K v2 (Segment 01). Pokretanje iz korena repoa:  node docs/10k-v2/artifacts/segment-01/run.ts
   (Node ≥ 22.18: TypeScript type stripping; potreban web/node_modules zbog prettier-a). Upisuje
   inputs.json, <id>.json i plans.md pored skripte, formatirane prettier-om (isti izlaz kao --check). */

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
  group: "razvojni" | "granični" | "odbijeni";
  note: string;
  input: Record<string, unknown>;
}

const A = ["tue", "thu", "sat", "sun"];
const B = ["mon", "wed", "fri", "sun"];
const C = ["mon", "tue", "thu", "sat"];

const base = (o: {
  weeks: number;
  km: number;
  dist?: number;
  time?: number;
  days: string[];
  race?: "sat" | "sun";
  resultDaysBefore?: number;
  goal?: number;
  noResult?: boolean;
}): Record<string, unknown> => {
  const start = o.race === "sat" ? addDays(START, -1) : START;
  return {
    startDate: start,
    raceDate: addDays(start, o.weeks * 7 - 1),
    runDays: o.days,
    currentWeeklyKm: o.km,
    recentResult: o.noResult
      ? null
      : {
          distanceM: o.dist ?? 10000,
          timeSec: o.time ?? 50 * 60,
          date: addDays(start, -(o.resultDaysBefore ?? 14)),
        },
    goalTimeSec: o.goal ?? null,
  };
};

const CASES: Case[] = [
  {
    id: "dev-01",
    group: "razvojni",
    note: "10 km 56:00, 25 km, 10 ned, cilj 54:00",
    input: base({ weeks: 10, km: 25, time: 56 * 60, days: A, goal: 54 * 60 }),
  },
  {
    id: "dev-02",
    group: "razvojni",
    note: "5 km 25:00, 30 km, 12 ned, cilj 50:00",
    input: base({
      weeks: 12,
      km: 30,
      dist: 5000,
      time: 25 * 60,
      days: B,
      goal: 50 * 60,
    }),
  },
  {
    id: "dev-03",
    group: "razvojni",
    note: "10 km 45:00, 40 km, 14 ned, cilj 43:30",
    input: base({
      weeks: 14,
      km: 40,
      time: 45 * 60,
      days: A,
      goal: 43 * 60 + 30,
    }),
  },
  {
    id: "dev-04",
    group: "razvojni",
    note: "polumaraton 1:35:00, 45 km, 16 ned, cilj 41:30",
    input: base({
      weeks: 16,
      km: 45,
      dist: 21097.5,
      time: 95 * 60,
      days: B,
      goal: 41 * 60 + 30,
    }),
  },
  {
    id: "dev-05",
    group: "razvojni",
    note: "10 km 38:00, 55 km, 18 ned, cilj 37:00",
    input: base({ weeks: 18, km: 55, time: 38 * 60, days: A, goal: 37 * 60 }),
  },
  {
    id: "dev-06",
    group: "razvojni",
    note: "3 km 13:00, 35 km, 12 ned, trka subota, pon/uto/čet/sub",
    input: base({
      weeks: 12,
      km: 35,
      dist: 3000,
      time: 13 * 60,
      days: C,
      race: "sat",
    }),
  },
  {
    id: "edge-25km-10w-vdot30",
    group: "granični",
    note: "najmanji obim, najkraći plan, VDOT 30",
    input: base({ weeks: 10, km: 25, time: timeForVdot(30), days: A }),
  },
  {
    id: "edge-55km-18w-vdot30",
    group: "granični",
    note: "kapacitet: spor E + 55 km (105 min seče dugi)",
    input: base({ weeks: 18, km: 55, time: timeForVdot(30), days: A }),
  },
  {
    id: "edge-55km-vdot75",
    group: "granični",
    note: "55 km, VDOT 75, 14 ned",
    input: base({ weeks: 14, km: 55, time: timeForVdot(75), days: B }),
  },
  {
    id: "edge-goal-unrealistic",
    group: "granični",
    note: "10 km 50:00, 35 km, 12 ned, cilj 40:00 (nerealan)",
    input: base({ weeks: 12, km: 35, time: 50 * 60, days: A, goal: 40 * 60 }),
  },
  {
    id: "rej-3-days",
    group: "odbijeni",
    note: "3 dana nedeljno",
    input: base({ weeks: 12, km: 35, days: ["tue", "thu", "sun"] }),
  },
  {
    id: "rej-8-weeks",
    group: "odbijeni",
    note: "8 nedelja",
    input: base({ weeks: 8, km: 35, days: A }),
  },
  {
    id: "rej-19-weeks",
    group: "odbijeni",
    note: "19 nedelja",
    input: base({ weeks: 19, km: 35, days: A }),
  },
  {
    id: "rej-20km",
    group: "odbijeni",
    note: "20 km nedeljno",
    input: base({ weeks: 12, km: 20, days: A }),
  },
  {
    id: "rej-no-result",
    group: "odbijeni",
    note: "bez rezultata",
    input: base({ weeks: 12, km: 35, days: A, noResult: true }),
  },
  {
    id: "rej-result-100d",
    group: "odbijeni",
    note: "rezultat star 100 dana",
    input: base({ weeks: 12, km: 35, days: A, resultDaysBefore: 100 }),
  },
  {
    id: "rej-vdot-below-30",
    group: "odbijeni",
    note: "VDOT < 30 (10 km 70:00)",
    input: base({ weeks: 12, km: 35, time: 70 * 60, days: A }),
  },
  {
    id: "rej-mon-tue-wed-thu",
    group: "odbijeni",
    note: "pon/uto/sre/čet: nema 3 nesusedna teška dana",
    input: base({ weeks: 12, km: 35, days: ["mon", "tue", "wed", "thu"] }),
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
  title.replace(/^WU 15 min \+ /, "").replace(/ \+ CD 10 min$/, "");

function table(plan: TenKV2Plan): string {
  const rows = [
    "| nedelja | faza | km cilj/plan | kvalitet | dugi | lagan max | napomena |",
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
      .map((d) => d.workout.km);
    const notes: string[] = [];
    if (w.deload) notes.push("rasterećenje");
    if (w.fitted)
      notes.push(
        `izvodljiv cilj (pravilo ${km(w.nominalKm)} km, ${w.fitted === "down" ? "naniže" : "naviše"})`,
      );
    for (const n of w.notes)
      if (n.includes("ponovljen")) notes.push(n.split(" — ")[0]!);
    if (race) notes.push(`trka ${SR[race.weekday]} (van obima)`);
    rows.push(
      `| ${w.index} | ${PHASE[w.phase]} | ${km(w.targetKm)} / ${km(w.plannedKm)} | ${q.join("<br>") || "—"} | ${long ? `${km(long.workout.km)} km` : "—"} | ${easy.length ? `${km(Math.max(...easy))} km` : "—"} | ${notes.join("; ") || "—"} |`,
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
const md: string[] = [
  `# 10K v2 — primeri (${TEN_K_V2_POLICY.version})`,
  "",
  "Generisano: `node docs/10k-v2/artifacts/segment-01/run.ts`. Start: " +
    START +
    " (ponedeljak; trka subota: dan ranije). Km cilj/plan = cilj nedelje / planirano; trka i njen WU/CD nisu u obimu.",
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
    `- Dani: Q1 ${SR[p.pattern.q1]}, Q2 ${SR[p.pattern.q2]}, dugi ${SR[p.pattern.long]}, lagan ${p.pattern.easy.map((d) => SR[d]).join(", ")} · obim start ${km(p.startKm)} → vrh ${km(p.peakKm)} km (granica izgradnje ${km(p.peakCapKm)} km)`,
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
