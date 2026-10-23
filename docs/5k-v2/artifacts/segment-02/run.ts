/* Primeri 5K v2 (Segment 02; kopija segment-01/run.ts + kolona „lagan max" i ukupno km).
   Pokretanje iz korena repoa:  node docs/5k-v2/artifacts/segment-02/run.ts
   (Node ≥ 22.18: TypeScript type stripping). Upisuje inputs.json, <id>.json i plans.md pored skripte. */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIVE_K_V2_POLICY,
  generateFiveKV2,
} from "../../../../web/src/domain/generators/fiveK/v2/index.ts";
import type {
  FiveKV2Plan,
  GenerateResult,
} from "../../../../web/src/domain/generators/fiveK/v2/index.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const START = "2026-11-02"; // ponedeljak

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
const race = (weeks: number): string => addDays(START, weeks * 7 - 1);

interface Case {
  id: string;
  group: "razvojni" | "granični" | "odbijeni";
  note: string;
  input: Record<string, unknown>;
}

const base = (o: {
  weeks: number;
  km: number;
  dist: number;
  time: number;
  days: string[];
  resultDaysBefore?: number;
  goal?: number;
}): Record<string, unknown> => ({
  startDate: START,
  raceDate: race(o.weeks),
  runDays: o.days,
  currentWeeklyKm: o.km,
  recentResult: {
    distanceM: o.dist,
    timeSec: o.time,
    date: addDays(START, -(o.resultDaysBefore ?? 14)),
  },
  goalTimeSec: o.goal ?? null,
});

const CASES: Case[] = [
  {
    id: "dev-01",
    group: "razvojni",
    note: "VDOT ~32, 20 km, 10 ned",
    input: base({
      weeks: 10,
      km: 20,
      dist: 5000,
      time: 29 * 60 + 5,
      days: ["tue", "thu", "sat", "sun"],
      goal: 28 * 60,
    }),
  },
  {
    id: "dev-02",
    group: "razvojni",
    note: "VDOT ~40, 25 km, 12 ned",
    input: base({
      weeks: 12,
      km: 25,
      dist: 10000,
      time: 50 * 60,
      days: ["mon", "wed", "fri", "sun"],
      goal: 23 * 60 + 30,
    }),
  },
  {
    id: "dev-03",
    group: "razvojni",
    note: "VDOT ~48, 30 km, 9 ned",
    input: base({
      weeks: 9,
      km: 30,
      dist: 3000,
      time: 12 * 60,
      days: ["tue", "thu", "sat", "sun"],
      goal: 20 * 60 + 30,
    }),
  },
  {
    id: "dev-04",
    group: "razvojni",
    note: "VDOT ~50, 35 km, 14 ned",
    input: base({
      weeks: 14,
      km: 35,
      dist: 5000,
      time: 19 * 60 + 57,
      days: ["mon", "wed", "fri", "sat"],
      goal: 19 * 60 + 30,
    }),
  },
  {
    id: "dev-05",
    group: "razvojni",
    note: "VDOT ~55, 40 km, 16 ned",
    input: base({
      weeks: 16,
      km: 40,
      dist: 10000,
      time: 38 * 60,
      days: ["tue", "wed", "fri", "sun"],
    }),
  },
  {
    id: "dev-06",
    group: "razvojni",
    note: "VDOT ~58, 42 km, 11 ned",
    input: base({
      weeks: 11,
      km: 42,
      dist: 5000,
      time: 17 * 60 + 25,
      days: ["mon", "tue", "thu", "sat"],
      goal: 16 * 60 + 30,
    }),
  },
  {
    id: "edge-15km-8w",
    group: "granični",
    note: "najmanji obim i najkraći plan",
    input: base({
      weeks: 8,
      km: 15,
      dist: 5000,
      time: 30 * 60,
      days: ["tue", "thu", "sat", "sun"],
    }),
  },
  {
    id: "edge-45km-16w",
    group: "granični",
    note: "najveći obim i najduži plan",
    input: base({
      weeks: 16,
      km: 45,
      dist: 5000,
      time: 18 * 60,
      days: ["mon", "wed", "fri", "sun"],
    }),
  },
  {
    id: "edge-result-12w",
    group: "granični",
    note: "rezultat star tačno 12 nedelja",
    input: base({
      weeks: 10,
      km: 28,
      dist: 10000,
      time: 46 * 60,
      days: ["tue", "thu", "sat", "sun"],
      resultDaysBefore: 84,
    }),
  },
  {
    id: "edge-vdot30",
    group: "granični",
    note: "VDOT 30,0",
    input: base({
      weeks: 12,
      km: 22,
      dist: 5000,
      time: 30 * 60 + 40,
      days: ["mon", "wed", "fri", "sun"],
    }),
  },
  {
    id: "rej-3-days",
    group: "odbijeni",
    note: "3 dana nedeljno",
    input: base({
      weeks: 10,
      km: 25,
      dist: 5000,
      time: 25 * 60,
      days: ["tue", "thu", "sun"],
    }),
  },
  {
    id: "rej-consecutive-days",
    group: "odbijeni",
    note: "pon–čet: nema 3 nesusedna zahtevna dana",
    input: base({
      weeks: 10,
      km: 25,
      dist: 5000,
      time: 25 * 60,
      days: ["mon", "tue", "wed", "thu"],
    }),
  },
  {
    id: "rej-old-fast-long",
    group: "odbijeni",
    note: "rezultat 13 ned, VDOT > 60, 17 ned, 50 km",
    input: base({
      weeks: 17,
      km: 50,
      dist: 5000,
      time: 16 * 60 + 30,
      days: ["tue", "thu", "sat", "sun"],
      resultDaysBefore: 91,
    }),
  },
];

const fmt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const PHASE: Record<string, string> = {
  base: "baza",
  peak: "vrhunac",
  sharpen: "oštrenje",
  taper: "taper",
  race: "trka",
};

function table(plan: FiveKV2Plan): string {
  const rows = [
    "| ned | faza | km cilj/planirano | kvalitet | dugi | lagan max | napomena |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const w of plan.weeks) {
    const q = w.days
      .filter((d) => d.workout.kind === "quality")
      .map((d) => `${d.weekday}: ${d.workout.title}`);
    const long = w.days.find((d) => d.role === "long");
    const notes = [
      ...(w.deload ? ["rasterećenje"] : []),
      ...w.notes.filter((n) => !n.startsWith("Rasterećenje")),
    ];
    const easy = w.days
      .filter((d) => d.role === "easy")
      .map((d) => d.workout.km);
    notes.push(`lagano: ${easy.join(", ") || "—"}`);
    const easyMax = easy.length ? `${Math.max(...easy)} km` : "—";
    rows.push(
      `| ${w.index} | ${PHASE[w.phase]} | ${w.targetKm} / ${w.plannedKm} | ${q.join("<br>") || "—"} | ${long ? `${long.workout.km} km` : "—"} | ${easyMax} | ${notes.join("; ")} |`,
    );
  }
  const target = plan.weeks.reduce((a, w) => a + w.targetKm, 0);
  const planned = plan.weeks.reduce((a, w) => a + w.plannedKm, 0);
  rows.push(
    "",
    `Ukupno km plana (bez trke): cilj ${target.toFixed(1)} / planirano ${planned.toFixed(1)}`,
  );
  return rows.join("\n");
}

const results: { c: Case; r: GenerateResult }[] = CASES.map((c) => ({
  c,
  r: generateFiveKV2(c.input),
}));
writeFileSync(join(OUT, "inputs.json"), JSON.stringify(CASES, null, 2) + "\n");
const md: string[] = [
  `# 5K v2 — primeri (${FIVE_K_V2_POLICY.version})`,
  "",
  "Generisano: `node docs/5k-v2/artifacts/segment-02/run.ts`. Start svih planova: " +
    START +
    ".",
  "",
];
for (const { c, r } of results) {
  writeFileSync(join(OUT, `${c.id}.json`), JSON.stringify(r, null, 2) + "\n");
  md.push(`## ${c.id} — ${c.group}: ${c.note}`, "");
  if (!r.ok) {
    md.push("**Odbijeno:**", "");
    for (const x of r.reasons)
      md.push(
        `- \`${x.code}\`${x.week ? ` (ned ${x.week})` : ""}: ${x.message}`,
      );
    for (const v of r.violations)
      md.push(
        `- prekršaj \`${v.rule}\`${v.week ? ` (ned ${v.week})` : ""}: ${v.message}`,
      );
    md.push("");
    continue;
  }
  const p = r.plan;
  md.push(
    `VDOT ${p.vdot} · prognoza 5K ${fmt(p.predicted5kSec)} · tempo E ${fmt(p.paces.E.fast)}–${fmt(p.paces.E.slow)}, T ${fmt(p.paces.T)}, I ${fmt(p.paces.I)}, R ${fmt(p.paces.R)}, RP ${fmt(p.paces.RP)} /km`,
    `Dani: q1 ${p.pattern.q1}, q2 ${p.pattern.q2}, dugi ${p.pattern.long}, lagan ${p.pattern.easy} · obim start ${p.startKm} → vrh ${p.peakKm} km`,
    `Cilj: ${p.goal ? `${fmt(p.goal.goalTimeSec)} → ${p.goal.status} (VDOT cilja ${p.goal.goalVdot}, razlika ${p.goal.vdotGap})` : "nije zadat"}`,
    `Politika: ${p.policyId} ${p.policyVersion} · Upozorenja: ${p.warnings.length === 0 ? "nema" : p.warnings.map((w) => `${w.rule}${w.week ? `@${w.week}` : ""}`).join(", ")}`,
    "",
    table(p),
    "",
  );
}
writeFileSync(join(OUT, "plans.md"), md.join("\n"));
for (const { c, r } of results)
  console.log(
    c.id,
    r.ok
      ? `OK ${r.plan.weeks.length}w warn=${r.plan.warnings.length}`
      : `REJ ${r.reasons.map((x) => x.code + (x.week ? "@" + x.week : "")).join(",")} ${r.violations
          .filter((v) => v.severity === "error")
          .map((v) => v.rule + "@" + v.week)
          .join(",")}`,
  );
