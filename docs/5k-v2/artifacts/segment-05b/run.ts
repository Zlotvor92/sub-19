/* Primeri 5K v2 (Segment 05b, 5k-v2.4.1: kopija segment-05/run.ts — isti ulazi — + tabela kapaciteta
   na vrhu plans.md). Segment 05: kopija segment-04/run.ts + plan bez pouzdanog rezultata, početnik,
   odbijanja run/walk i bez E tempa).
   Pokretanje iz korena repoa:  node docs/5k-v2/artifacts/segment-05b/run.ts
   (Node ≥ 22.18: TypeScript type stripping). Upisuje inputs.json, <id>.json i plans.md pored skripte. */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIVE_K_V2_POLICY,
  generateFiveKV2,
} from "../../../../web/src/domain/generators/fiveK/v2/index.ts";
import { pacesFromVdot } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";
import { capacityKm } from "../../../../web/src/domain/generators/fiveK/v2/volume.ts";
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
  group: "razvojni" | "granični" | "odbijeni" | "bez rezultata" | "početnik";
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

/** 2.4.0: plan bez pouzdanog rezultata / početnik. */
const feel = (o: {
  weeks: number;
  km: number;
  days: string[];
  easy?: number;
  beginner?: boolean;
  canRun30Min?: boolean;
  result?: { dist: number; time: number; daysBefore: number };
  goal?: number;
}): Record<string, unknown> => ({
  startDate: START,
  raceDate: race(o.weeks),
  runDays: o.days,
  currentWeeklyKm: o.km,
  ...(o.result
    ? {
        recentResult: {
          distanceM: o.result.dist,
          timeSec: o.result.time,
          date: addDays(START, -o.result.daysBefore),
        },
      }
    : {}),
  ...(o.easy !== undefined ? { typicalEasyPaceSecPerKm: o.easy } : {}),
  ...(o.beginner ? { experience: "beginner" } : {}),
  ...(o.canRun30Min !== undefined ? { canRun30Min: o.canRun30Min } : {}),
  ...(o.goal ? { goalTimeSec: o.goal } : {}),
});

const CASES: Case[] = [
  {
    id: "feel-d4-25km-e600-12w",
    group: "bez rezultata",
    note: "bez rezultata, 4 dana, 25 km, E 6:00, 12 ned, cilj 25:00",
    input: feel({
      weeks: 12,
      km: 25,
      days: ["tue", "thu", "sat", "sun"],
      easy: 360,
      goal: 25 * 60,
    }),
  },
  {
    id: "feel-d3-15km-e700-10w",
    group: "bez rezultata",
    note: "bez rezultata, 3 dana, 15 km, E 7:00, 10 ned",
    input: feel({ weeks: 10, km: 15, days: ["tue", "thu", "sun"], easy: 420 }),
  },
  {
    id: "old-result-20w-d4-30km",
    group: "bez rezultata",
    note: "star rezultat (5K 23:00, 20 ned), 4 dana, 30 km, E 5:45, 12 ned",
    input: feel({
      weeks: 12,
      km: 30,
      days: ["tue", "thu", "sat", "sun"],
      easy: 345,
      result: { dist: 5000, time: 23 * 60, daysBefore: 140 },
    }),
  },
  {
    id: "beg-feel-d3-12km-e730-10w",
    group: "početnik",
    note: "početnik bez rezultata, 3 dana, 12 km, E 7:30, 10 ned",
    input: feel({
      weeks: 10,
      km: 12,
      days: ["tue", "thu", "sun"],
      easy: 450,
      beginner: true,
      canRun30Min: true,
    }),
  },
  {
    id: "beg-result-d4-18km-12w",
    group: "početnik",
    note: "početnik sa rezultatom 5K 30:00, 4 dana, 18 km, 12 ned, cilj 29:00",
    input: feel({
      weeks: 12,
      km: 18,
      days: ["tue", "thu", "sat", "sun"],
      beginner: true,
      canRun30Min: true,
      result: { dist: 5000, time: 30 * 60, daysBefore: 14 },
      goal: 29 * 60,
    }),
  },
  {
    id: "rej-run-walk",
    group: "odbijeni",
    note: "početnik koji ne može 30 min kontinuirano (run/walk)",
    input: feel({
      weeks: 10,
      km: 12,
      days: ["tue", "thu", "sun"],
      easy: 480,
      beginner: true,
      canRun30Min: false,
    }),
  },
  {
    id: "rej-no-easy-pace",
    group: "odbijeni",
    note: "bez rezultata i bez uobičajenog laganog tempa",
    input: feel({ weeks: 12, km: 25, days: ["tue", "thu", "sat", "sun"] }),
  },
  {
    id: "rej-d3-11km",
    group: "odbijeni",
    note: "3 dana, 11 km (ispod 12 km)",
    input: base({
      weeks: 10,
      km: 11,
      dist: 5000,
      time: 25 * 60,
      days: ["tue", "thu", "sun"],
    }),
  },
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
    id: "edge-slow-45km",
    group: "granični",
    note: "VDOT ~30, 45 km, 12 ned (spor, veliki obim)",
    input: base({
      weeks: 12,
      km: 45,
      dist: 5000,
      time: 30 * 60 + 38,
      days: ["tue", "thu", "sat", "sun"],
    }),
  },
  {
    id: "edge-fast-15km-13w",
    group: "granični",
    note: "VDOT ~53, 15 km, 13 ned (brz, mali obim)",
    input: base({
      weeks: 13,
      km: 15,
      dist: 5000,
      time: 18 * 60 + 30,
      days: ["tue", "thu", "sat", "sun"],
    }),
  },
  {
    id: "d3-15km-v38-10w",
    group: "razvojni",
    note: "3 dana, VDOT ~38, 15 km, 10 ned",
    input: base({
      weeks: 10,
      km: 15,
      dist: 5000,
      time: 25 * 60,
      days: ["tue", "thu", "sun"],
    }),
  },
  {
    id: "d3-30km-v48-12w",
    group: "razvojni",
    note: "3 dana, VDOT ~48, 30 km, 12 ned",
    input: base({
      weeks: 12,
      km: 30,
      dist: 5000,
      time: 20 * 60 + 30,
      days: ["mon", "wed", "sat"],
      goal: 20 * 60,
    }),
  },
  {
    id: "d5-40km-v50-14w",
    group: "razvojni",
    note: "5 dana, VDOT ~50, 40 km, 14 ned",
    input: base({
      weeks: 14,
      km: 40,
      dist: 5000,
      time: 19 * 60 + 57,
      days: ["mon", "tue", "thu", "sat", "sun"],
      goal: 19 * 60 + 15,
    }),
  },
  {
    id: "d5-60km-v58-16w",
    group: "razvojni",
    note: "5 dana, VDOT ~58, 60 km, 16 ned",
    input: base({
      weeks: 16,
      km: 60,
      dist: 5000,
      time: 17 * 60 + 25,
      days: ["tue", "wed", "fri", "sat", "sun"],
    }),
  },
  {
    id: "short-6w-d4-30km-v49",
    group: "razvojni",
    note: "kratka priprema 6 ned, 4 dana, VDOT ~49, 30 km",
    input: base({
      weeks: 6,
      km: 30,
      dist: 5000,
      time: 20 * 60 + 15,
      days: ["tue", "thu", "sat", "sun"],
      goal: 19 * 60 + 45,
    }),
  },
  {
    id: "short-7w-d3-25km",
    group: "razvojni",
    note: "kratka priprema 7 ned, 3 dana, VDOT ~42, 25 km",
    input: base({
      weeks: 7,
      km: 25,
      dist: 5000,
      time: 23 * 60,
      days: ["tue", "thu", "sun"],
    }),
  },
  {
    id: "rej-2-days",
    group: "odbijeni",
    note: "2 dana nedeljno",
    input: base({
      weeks: 10,
      km: 20,
      dist: 5000,
      time: 25 * 60,
      days: ["tue", "sun"],
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
      ...(w.stridesOnly ? ["samo ubrzanja"] : []),
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

/** 5k-v2.4.1: kapacitet [km] po broju dana × VDOT. 7b4b574 i 2.4.0 izmereni na tim commitima
    (`capacityKm(pacesFromVdot(v), n)`); 2.4.1 računa ova skripta. */
const CAP_OLD: Record<string, [number, number]> = {
  "3/40": [32.7, 17.1],
  "3/50": [38.8, 17.1],
  "3/60": [45.5, 17.1],
  "4/40": [37.7, 33.8],
  "4/50": [45.5, 41.3],
  "4/60": [50, 41.3],
  "5/40": [54.4, 55.1],
  "5/50": [62.7, 64.4],
  "5/60": [71.1, 65],
};
function capacityTable(): string[] {
  const rows = ["## Kapacitet (km)", "", "| dana | VDOT | 7b4b574 | 2.4.0 | 2.4.1 |", "|---|---|---|---|---|"];
  for (const n of [3, 4, 5] as const)
    for (const v of [40, 50, 60]) {
      const [a, b] = CAP_OLD[`${n}/${v}`]!;
      rows.push(`| ${n} | ${v} | ${a} | ${b} | ${capacityKm(pacesFromVdot(v), n)} |`);
    }
  rows.push(
    "",
    "7b4b574: formula (nejednačina), bez ograničenja apsolutnim vrhom 40/50/65 — vrh plana ga ipak nije prelazio. 2.4.0: zatvoreno naniže. 2.4.1: najveći izvodljiv cilj (rupe se rešavaju po nedelji).",
    "",
  );
  return rows;
}

const results: { c: Case; r: GenerateResult }[] = CASES.map((c) => ({
  c,
  r: generateFiveKV2(c.input),
}));
writeFileSync(join(OUT, "inputs.json"), JSON.stringify(CASES, null, 2) + "\n");
const md: string[] = [
  `# 5K v2 — primeri (${FIVE_K_V2_POLICY.version})`,
  "",
  "Generisano: `node docs/5k-v2/artifacts/segment-05b/run.ts`. Start svih planova: " +
    START +
    ".",
  "",
  ...capacityTable(),
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
  const pc = p.paces;
  md.push(
    pc.vdot === null
      ? `Po osećaju (nema pouzdanog rezultata) · prognoza 5K: nedovoljno podataka · tempo E ${fmt(pc.E.fast)}–${fmt(pc.E.slow)} /km, ostalo RPE`
      : `VDOT ${p.vdot} · prognoza 5K ${fmt(p.predicted5kSec ?? 0)} · tempo E ${fmt(pc.E.fast)}–${fmt(pc.E.slow)}, T ${fmt(pc.T)}, I ${fmt(pc.I)}, R ${fmt(pc.R)}, RP ${fmt(pc.RP)} /km`,
    `Iskustvo: ${p.experience} · dani: q1 ${p.pattern.q1}, q2 ${p.pattern.q2 ?? "—"}, dugi ${p.pattern.long}, lagan ${p.pattern.easy.join(", ")} · obim start ${p.startKm} → vrh ${p.peakKm} km · kapacitet ${p.input.runDays.length} dana ${p.capacityKm} km`,
    `Cilj: ${p.goal ? `${fmt(p.goal.goalTimeSec)} → ${p.goal.status}${p.goal.goalVdot !== null ? ` (VDOT cilja ${p.goal.goalVdot}, razlika ${p.goal.vdotGap})` : ""}` : "nije zadat"}`,
    ...(p.notes.length ? [`Napomena plana: ${p.notes.join(" ")}`] : []),
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
