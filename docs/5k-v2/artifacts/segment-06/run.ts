/* Primeri adaptacije 5K v2 (Segment 06, 5k-v2.5.0): dev-04 i plan bez rezultata (4 dana, 25 km, E 6:00),
   7 scenarija (bez promena, propuštena nedelja, pauza 10 / 20 / 35 dana, bol 5, test 3 km), par pre/posle.
   Pokretanje iz korena repoa:  node docs/5k-v2/artifacts/segment-06/run.ts   (Node ≥ 22.18)
   Upisuje inputs.json (ulazi plana, asOf, činjenice), <plan>-<scenario>.json (reasons, changes) i
   examples.md pored skripte. */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adaptFiveKV2,
  FIVE_K_V2_POLICY,
  generateFiveKV2,
} from "../../../../web/src/domain/generators/fiveK/v2/index.ts";
import type {
  AdaptFacts,
  FiveKV2Plan,
  PlanWeek,
  WorkoutFact,
} from "../../../../web/src/domain/generators/fiveK/v2/index.ts";
import { addDays } from "../../../../web/src/domain/generators/fiveK/v2/dates.ts";
import { raceTimeForVdot } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";
import {
  doneFacts,
  historyFacts,
  START,
} from "../../../../web/src/domain/generators/fiveK/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const race = (weeks: number): string => addDays(START, weeks * 7 - 1);
const endOfWeek = (k: number): string => addDays(START, k * 7 - 1);

const PLANS: { id: string; note: string; input: Record<string, unknown>; testWeek: number }[] = [
  {
    id: "dev-04",
    note: "VDOT ~50 (5K 19:57), 35 km, 4 dana, 14 ned, cilj 19:30",
    input: {
      startDate: START,
      raceDate: race(14),
      runDays: ["mon", "wed", "fri", "sat"],
      currentWeeklyKm: 35,
      recentResult: { distanceM: 5000, timeSec: 19 * 60 + 57, date: addDays(START, -14) },
      goalTimeSec: 19 * 60 + 30,
    },
    testWeek: 7,
  },
  {
    id: "feel-d4-25km-e600-12w",
    note: "bez rezultata, E 6:00, 25 km, 4 dana, 12 ned, cilj 25:00",
    input: {
      startDate: START,
      raceDate: race(12),
      runDays: ["tue", "thu", "sat", "sun"],
      currentWeeklyKm: 25,
      typicalEasyPaceSecPerKm: 360,
      goalTimeSec: 1500,
    },
    testWeek: 3,
  },
];

function planOf(input: Record<string, unknown>): FiveKV2Plan {
  const r = generateFiveKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return JSON.parse(JSON.stringify(r.plan)) as FiveKV2Plan;
}

const missed = (p: FiveKV2Plan, from: string, to: string): WorkoutFact[] =>
  p.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.countsToWeek && d.date >= from && d.date <= to)
    .map((d) => ({ date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }));

function scenarios(p: FiveKV2Plan, testWeek: number): { id: string; asOf: string; facts: AdaptFacts }[] {
  const asOf = endOfWeek(Math.max(2, Math.floor(p.weeks.length / 2)));
  const hist = historyFacts(p.input as unknown as Record<string, unknown>);
  const done = (to: string): WorkoutFact[] => [...hist, ...doneFacts(p, to)];
  const pause = (n: number): WorkoutFact[] => [
    ...done(addDays(asOf, -n)),
    ...missed(p, addDays(asOf, -n + 1), asOf),
  ];
  const tAsOf = endOfWeek(testWeek);
  const v = p.vdot ?? 40;
  return [
    { id: "bez-promena", asOf, facts: { workouts: done(asOf) } },
    { id: "propustena-nedelja", asOf, facts: { workouts: pause(7) } },
    { id: "pauza-10", asOf, facts: { workouts: pause(10) } },
    { id: "pauza-20", asOf, facts: { workouts: pause(20) } },
    { id: "pauza-35", asOf, facts: { workouts: pause(35) } },
    {
      id: "bol-5",
      asOf,
      facts: {
        workouts: done(asOf).map((x, i, a) => (i === a.length - 1 ? { ...x, pain: 5 } : x)),
      },
    },
    {
      id: "test-3km",
      asOf: tAsOf,
      facts: {
        workouts: done(tAsOf),
        results: [
          {
            distM: 3000,
            sec: p.vdot === null ? 13 * 60 + 30 : raceTimeForVdot(v + 1, 3000),
            date: addDays(tAsOf, -1),
            kind: "test",
          },
        ],
      },
    },
  ];
}

const q = (w: PlanWeek): string =>
  w.days
    .filter((d) => d.workout.kind === "quality")
    .map((d) => d.workout.qualityType)
    .join(" + ") || (w.stridesOnly ? "ubrzanja" : "—");
const long = (w: PlanWeek): string => {
  const d = w.days.find((x) => x.role === "long");
  return d ? String(d.workout.km) : "—";
};
const ph = (w: PlanWeek): string => `${w.phase}${w.deload ? " (r)" : ""}${w.test ? " T" : ""}`;
const fmt = (s: number | null): string =>
  s === null ? "—" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const md: string[] = [
  `# 5K v2 — primeri adaptacije (${FIVE_K_V2_POLICY.version})`,
  "",
  "Generisano: `node docs/5k-v2/artifacts/segment-06/run.ts`. Činjenice: `inputs.json`; reasons/changes:",
  "`<plan>-<scenario>.json`. Kolone „posle\": faza ((r) = rasterećenje, T = test), cilj / planirano km,",
  "kvalitet, dugi km. `*` = nedelja promenjena; (asOf) = nedelja koja sadrži asOf.",
  "",
];
const inputs: Record<string, unknown> = {};
for (const pl of PLANS) {
  const before = planOf(pl.input);
  inputs[pl.id] = { input: pl.input, scenarios: {} };
  md.push(`## ${pl.id} — ${pl.note}`, "");
  for (const sc of scenarios(before, pl.testWeek)) {
    (inputs[pl.id] as { scenarios: Record<string, unknown> }).scenarios[sc.id] = {
      asOf: sc.asOf,
      facts: sc.facts,
    };
    const r = adaptFiveKV2(before, sc.facts, sc.asOf);
    md.push(`### ${pl.id} / ${sc.id} (asOf ${sc.asOf})`, "");
    if (!r.ok) {
      md.push("ODBIJENO: " + JSON.stringify(r.reasons), "");
      writeFileSync(join(OUT, `${pl.id}-${sc.id}.json`), JSON.stringify(r, null, 2) + "\n");
      continue;
    }
    const after = r.plan;
    md.push(
      `Tempo: ${before.paceMode} → ${after.paceMode}; VDOT ${before.vdot ?? "—"} → ${after.vdot ?? "—"}; ` +
        `prognoza ${fmt(before.predicted5kSec)} → ${fmt(after.predicted5kSec)}; cilj ${before.goal?.status ?? "—"} → ${after.goal?.status ?? "—"}; ` +
        `promena: ${r.changes.length}.`,
      "",
      "Reasons:",
      ...r.reasons.map((x) => `- ${x.condition}${x.applied ? "" : " (nije primenjeno)"}: ${x.message}`),
      ...(r.reasons.length === 0 ? ["- — (nijedan uslov nije aktivan)"] : []),
      "",
      "| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |",
      "|---|---|---|---|---|---|---|---|---|",
    );
    after.weeks.forEach((w, i) => {
      const b = before.weeks[i]!;
      const changed = JSON.stringify(b) !== JSON.stringify(w) ? "*" : "";
      const cut =
        b.startDate <= sc.asOf && b.endDate >= sc.asOf ? " (asOf)" : "";
      md.push(
        `| ${w.index}${changed}${cut} | ${ph(b)} | ${b.targetKm} | ${q(b)} | ${long(b)} | ${ph(w)} | ${w.targetKm} / ${w.plannedKm} | ${q(w)} | ${long(w)} |`,
      );
    });
    const byWeek = new Map<number, number>();
    for (const c of r.changes) byWeek.set(c.week, (byWeek.get(c.week) ?? 0) + 1);
    md.push(
      "",
      `Changes po nedelji: ${[...byWeek].map(([w, n]) => `${w === 0 ? "plan" : w}: ${n}`).join(", ") || "—"}.`,
      "",
    );
    writeFileSync(
      join(OUT, `${pl.id}-${sc.id}.json`),
      JSON.stringify(
        { asOf: sc.asOf, reasons: r.reasons, changes: r.changes, steps: after.adaptation!.steps },
        null,
        2,
      ) + "\n",
    );
  }
}
writeFileSync(join(OUT, "inputs.json"), JSON.stringify(inputs, null, 2) + "\n");
writeFileSync(join(OUT, "examples.md"), md.join("\n") + "\n");
console.log("ok");
