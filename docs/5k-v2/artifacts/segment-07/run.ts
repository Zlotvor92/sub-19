/* Primeri Segmenta 07 (5k-v2.6.0): ispravke adaptacije (povratni rast, donja granica, coverage) i plan
   trčanje/hodanje (projekcija, napredak, trka, prelaz na kontinuirano).
   Pokretanje iz korena repoa:  node docs/5k-v2/artifacts/segment-07/run.ts   (Node ≥ 22.18)
   Upisuje inputs.json (ulazi, asOf, činjenice), <primer>.json (reasons, koraci, nedelje) i examples.md.
   Kolona „c9003aa" se čita iz c9003aa.json (iste činjenice iz inputs.json, pokrenute na c9003aa —
   v. examples.md); bez tog fajla izostaje. */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  FiveKV2RunWalkPlan,
  PlanWeek,
  RunWalkWeek,
  WorkoutFact,
} from "../../../../web/src/domain/generators/fiveK/v2/index.ts";
import { addDays } from "../../../../web/src/domain/generators/fiveK/v2/dates.ts";
import {
  doneFacts,
  historyFacts,
  START,
} from "../../../../web/src/domain/generators/fiveK/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const race = (weeks: number): string => addDays(START, weeks * 7 - 1);
const endOfWeek = (k: number): string => addDays(START, k * 7 - 1);
const S = JSON.stringify;

function gen(input: Record<string, unknown>): FiveKV2Plan | FiveKV2RunWalkPlan {
  const r = generateFiveKV2(input);
  if (!r.ok) throw new Error(S(r.reasons) + S(r.violations));
  return JSON.parse(S(r.plan)) as FiveKV2Plan | FiveKV2RunWalkPlan;
}
const cont = (p: FiveKV2Plan | FiveKV2RunWalkPlan): FiveKV2Plan => {
  if (p.planType === "runWalk") throw new Error("očekivan kontinuirani plan");
  return p;
};
const rw = (p: FiveKV2Plan | FiveKV2RunWalkPlan): FiveKV2RunWalkPlan => {
  if (p.planType !== "runWalk") throw new Error("očekivan plan trčanje/hodanje");
  return p;
};
const done = (p: FiveKV2Plan, to: string): WorkoutFact[] => [
  ...historyFacts(p.input as unknown as Record<string, unknown>),
  ...doneFacts(p, to),
];
const missed = (p: FiveKV2Plan, from: string, to: string): WorkoutFact[] =>
  p.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.countsToWeek && d.date >= from && d.date <= to)
    .map((d) => ({ date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }));
const pause = (p: FiveKV2Plan, asOf: string, n: number): WorkoutFact[] => [
  ...done(p, addDays(asOf, -n)),
  ...missed(p, addDays(asOf, -n + 1), asOf),
];
const coverage = (asOf: string, complete = true) => ({
  from: addDays(START, -28),
  to: asOf,
  complete,
});
const sessionFacts = (
  p: FiveKV2RunWalkPlan,
  to: string,
  rpe: (i: number) => number = () => 5,
): WorkoutFact[] =>
  p.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.role === "session" && d.date <= to)
    .map((d, i) => ({
      date: d.date,
      dayId: d.date,
      km: 0,
      durationSec: d.role === "session" ? d.session.totalSec : 0,
      completed: true,
      rpe: rpe(i),
    }));

const DEV04 = {
  startDate: START,
  raceDate: race(14),
  runDays: ["mon", "wed", "fri", "sat"],
  currentWeeklyKm: 35,
  recentResult: { distanceM: 5000, timeSec: 19 * 60 + 57, date: addDays(START, -14) },
  goalTimeSec: 19 * 60 + 30,
};
const D5_30 = {
  startDate: START,
  raceDate: race(12),
  runDays: ["mon", "tue", "thu", "sat", "sun"],
  currentWeeklyKm: 30,
  recentResult: { distanceM: 5000, timeSec: 1340, date: addDays(START, -14) },
};
const RW10 = {
  startDate: START,
  raceDate: race(10),
  runDays: ["tue", "thu", "sat"],
  currentWeeklyKm: 0,
  experience: "beginner",
  canRun30Min: false,
};
const RW16 = { ...RW10, raceDate: race(16), typicalEasyPaceSecPerKm: 420 };

const dev = cont(gen(DEV04));
const d5 = cont(gen(D5_30));
const rw10 = rw(gen(RW10));
const rw16 = rw(gen(RW16));

/** Pauza 10 dana posle 5 sesija (RPE 5, 5, 7, 5, 5); asOf = kraj nedelje 3. */
const rw10facts = (): AdaptFacts => {
  const asOf = endOfWeek(3);
  const s = sessionFacts(rw10, addDays(asOf, -10), (i) => (i === 2 ? 7 : 5));
  return { workouts: s, coverage: { from: START, to: asOf, complete: true } };
};

interface Example {
  id: string;
  note: string;
  input: Record<string, unknown>;
  plan: FiveKV2Plan | FiveKV2RunWalkPlan;
  asOf: string | null;
  facts: AdaptFacts | null;
}
const EX: Example[] = [
  {
    id: "dev-04-pauza-20",
    note: "dev-04 (VDOT ~50, 35 km, 4 dana, 14 ned), pauza 20 dana do kraja nedelje 7, potpun zapis",
    input: DEV04,
    plan: dev,
    asOf: endOfWeek(7),
    facts: { workouts: pause(dev, endOfWeek(7), 20), coverage: coverage(endOfWeek(7)) },
  },
  {
    id: "d5-30km-pauza-35",
    note: "5 dana, 30 km, VDOT ~45, 12 ned; pauza 35 dana do kraja nedelje 6, potpun zapis",
    input: D5_30,
    plan: d5,
    asOf: endOfWeek(6),
    facts: { workouts: pause(d5, endOfWeek(6), 35), coverage: coverage(endOfWeek(6)) },
  },
  {
    id: "dev-04-nepotpun-unos",
    note: "dev-04, asOf kraj nedelje 7; zapisi do asOf − 5, poslednjih 5 dana bez zapisa, coverage.complete = false",
    input: DEV04,
    plan: dev,
    asOf: endOfWeek(7),
    facts: {
      workouts: done(dev, addDays(endOfWeek(7), -5)),
      coverage: coverage(endOfWeek(7), false),
    },
  },
  {
    id: "rw-10-projekcija",
    note: "trčanje/hodanje, početnik, uto/čet/sub, 10 ned, bez tempa — projekcija generatora",
    input: RW10,
    plan: rw10,
    asOf: null,
    facts: null,
  },
  {
    id: "rw-10-posle-3-ned",
    note: "isti plan posle 3 nedelje: 5 sesija (RPE 5, 5, 7, 5, 5), zatim pauza 10 dana do kraja nedelje 3",
    input: RW10,
    plan: rw10,
    asOf: endOfWeek(3),
    facts: rw10facts(),
  },
  {
    id: "rw-16-prelaz",
    note: "trčanje/hodanje, početnik, E 7:00, 16 ned; sve sesije RPE 5 do kraja nedelje 8 → L12 → prelaz",
    input: RW16,
    plan: rw16,
    asOf: endOfWeek(8),
    facts: { workouts: sessionFacts(rw16, endOfWeek(8)), coverage: { from: START, to: endOfWeek(8), complete: true } },
  },
];

const q = (w: PlanWeek): string =>
  w.days
    .filter((d) => d.workout.kind === "quality")
    .map((d) => d.workout.qualityType)
    .join(" + ") || (w.stridesOnly ? "ubrzanja" : "—");
const ph = (w: PlanWeek): string => `${w.phase}${w.deload ? " (r)" : ""}${w.test ? " T" : ""}`;
const rwDays = (w: RunWalkWeek): string =>
  w.days
    .map((d) => `${d.role === "race" ? "trka " : ""}L${d.level}${d.projection ? "*" : ""}`)
    .join(", ");

const old: Record<string, { weeks: string[] }> = existsSync(join(OUT, "c9003aa.json"))
  ? (JSON.parse(readFileSync(join(OUT, "c9003aa.json"), "utf8")) as Record<string, { weeks: string[] }>)
  : {};
const md: string[] = [
  `# 5K v2 — primeri Segmenta 07 (${FIVE_K_V2_POLICY.version})`,
  "",
  "Generisano: `node docs/5k-v2/artifacts/segment-07/run.ts`. Činjenice: `inputs.json`; reasons, koraci i",
  "nedelje: `<primer>.json`. Kontinuirani plan: faza ((r) = rasterećenje), cilj / planirano km, kvalitet.",
  "Trčanje/hodanje: nivo po danu (`*` = projekcija, nivo zavisi od pretpostavljenih sesija).",
  "Kolona „c9003aa\": iste činjenice na polaznom commitu (`c9003aa.json`, pokrenuto u worktree-ju c9003aa;",
  "tamo nema coverage, pa su činjenice potpune od prvog zapisa).",
  "",
];
const inputs: Record<string, unknown> = {};
for (const ex of EX) {
  inputs[ex.id] = { input: ex.input, asOf: ex.asOf, facts: ex.facts };
  md.push(`## ${ex.id}`, "", ex.note, "");
  let after: FiveKV2Plan | FiveKV2RunWalkPlan = ex.plan;
  let reasons: unknown[] = [];
  if (ex.asOf && ex.facts) {
    const r = adaptFiveKV2(ex.plan, ex.facts, ex.asOf);
    if (!r.ok) throw new Error(S(r.reasons) + S(r.violations));
    after = r.plan;
    reasons = r.reasons;
    md.push(
      "Reasons:",
      ...r.reasons.map((x) => `- ${x.condition}${x.applied ? "" : " (nije primenjeno)"}: ${x.message}`),
      ...(r.reasons.length === 0 ? ["- — (nijedan uslov nije aktivan)"] : []),
      "",
    );
  }
  const rows: string[] = [];
  if (after.planType === "runWalk") {
    const before = ex.plan as FiveKV2RunWalkPlan;
    md.push("| Ned | Pre (generator) | Posle | Napomena |", "|---|---|---|---|");
    const n = before.weeks.length;
    for (let i = 0; i < n; i++) {
      const b = before.weeks[i]!;
      const a = after.weeks[i];
      const c = after.continuous;
      const cw = c && i + 1 >= c.fromWeek ? c.plan.weeks[i + 1 - c.fromWeek] : undefined;
      const right = a ? rwDays(a) : cw ? `kontinuirano: ${ph(cw)} ${cw.targetKm} / ${cw.plannedKm} km, ${q(cw)}` : "—";
      const race = a?.days.find((d) => d.role === "race");
      const note = race && race.role === "race"
        ? race.race.title
        : cw
          ? "kontinuirani plan početnika (prelaz)"
          : a && S(a) !== S(b)
            ? "promenjeno"
            : "";
      const row = `| ${b.index} | ${rwDays(b)} | ${right} | ${note} |`;
      md.push(row);
      rows.push(row);
    }
    if (after.continuous) {
      const c = after.continuous.plan;
      md.push("", `Kontinuirani deo (od nedelje ${after.continuous.fromWeek}): ${c.experience}, ${c.paceMode}, start ${c.startKm} km, vrh ${c.peakKm} km.`);
    }
  } else {
    const before = ex.plan as FiveKV2Plan;
    const pre = old[ex.id]?.weeks;
    md.push(
      `| Ned | Plan generatora | ${pre ? "c9003aa (posle adaptacije) | " : ""}5k-v2.6.0 (posle adaptacije) |`,
      `|---|---|${pre ? "---|" : ""}---|`,
    );
    after.weeks.forEach((w, i) => {
      const b = before.weeks[i]!;
      const row = `| ${w.index} | ${ph(b)} ${b.targetKm}, ${q(b)} | ${pre ? `${pre[i]} | ` : ""}${ph(w)} ${w.targetKm} / ${w.plannedKm}, ${q(w)} |`;
      md.push(row);
      rows.push(row);
    });
  }
  md.push("");
  writeFileSync(
    join(OUT, `${ex.id}.json`),
    S(
      {
        asOf: ex.asOf,
        reasons,
        steps: after.adaptation?.steps ?? [],
        weeks: rows,
      },
      null,
      2,
    ) + "\n",
  );
}
writeFileSync(join(OUT, "inputs.json"), S(inputs, null, 2) + "\n");
writeFileSync(join(OUT, "examples.md"), md.join("\n") + "\n");
console.log("ok");
