/* Primeri A–E (Segment 08d, 5k-v2.6.1): isti ulaz iz nalaza organizatora, bol na dan iz zapisa bez trčanja.
   „pre" = adaptFiveKV2 KODOM IZ bf47249 (5k-v2.6.0), „posle" = ovo stablo (5k-v2.6.1); bazni plan je isti
   (generator bajt-isti osim oznake verzije). Pokretanje iz korena repoa:
     git worktree add --detach /tmp/wt-bf4 bf47249
     ln -s "$PWD/web/node_modules" /tmp/wt-bf4/web/node_modules
     node docs/5k-v2/artifacts/segment-08d/examples.ts /tmp/wt-bf4
   Upisuje examples.md pored skripte (cilj/planirano/kvalitet po nedelji 3–7, korak i poruka PAIN). */

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Week = {
  index: number;
  phase: string;
  deload: boolean;
  targetKm: number;
  plannedKm: number;
  days: { workout: { kind: string } }[];
};
type Plan = {
  policyVersion: string;
  weeks: Week[];
  adaptation: {
    steps: {
      firstWeek: number;
      fromWeek: number;
      levelKm: number | null;
      returnFrom: { week: number; share: number } | null;
    }[];
  };
};
type Api = {
  generateFiveKV2: (input: unknown) => { ok: boolean; plan: Plan };
  adaptFiveKV2: (
    plan: unknown,
    facts: unknown,
    asOf: string,
  ) => {
    ok: boolean;
    plan: Plan;
    reasons: { condition: string; message: string }[];
  };
};
const old = resolve(process.argv[2] ?? "");
const prev = (await import(
  join(old, "web/src/domain/generators/fiveK/v2/index.ts")
)) as Api;
const cur = (await import(
  new URL(
    "../../../../web/src/domain/generators/fiveK/v2/index.ts",
    import.meta.url,
  ).href
)) as Api;

const INPUT = {
  startDate: "2026-10-26",
  raceDate: "2027-01-24",
  runDays: ["tue", "thu", "sat", "sun"],
  currentWeeklyKm: 40,
  recentResult: { distanceM: 5000, timeSec: 1260, date: "2026-10-10" },
  goalTimeSec: 1200,
};
const CASES = [
  ["A", "2026-11-15", "2026-11-14", 5, "nedelja; bol dan ranije (subota)"],
  ["B", "2026-11-15", "2026-11-14", 8, "nedelja; bol dan ranije (subota)"],
  ["C", "2026-11-18", "2026-11-18", 5, "sreda; bol istog dana"],
  ["D", "2026-11-18", "2026-11-18", 8, "sreda; bol istog dana"],
  ["E", "2026-11-13", "2026-11-13", 7, "petak; bol istog dana"],
] as const;
const km = (x: number): string => String(x).replace(".", ",");
const cell = (w: Week): string =>
  `${km(w.targetKm)} / ${km(w.plannedKm)} / ${w.days.filter((d) => d.workout.kind === "quality").length}`;

const out: string[] = [
  "# Segment 08d — primeri A–E (5k-v2.6.0 → 5k-v2.6.1)",
  "",
  "Ulaz: 4 dana (uto/čet/sub/ned), start 2026-10-26, trka 2027-01-24 (13 ned), 40 km, 5 km 21:00 (2026-10-10), cilj 20:00.",
  "Činjenica: `{ workouts: [{ date: <dan bola>, km: 0, durationSec: 0, completed: false, pain: N }] }`.",
  "Ćelija: cilj / planirano / broj kvaliteta. Generisano: `examples.ts` (pre = kod iz bf47249).",
  "",
];
for (const api of [prev, cur]) {
  const p = api.generateFiveKV2(INPUT).plan;
  out.push(
    `Bazni plan (${p.policyVersion}): ` +
      p.weeks
        .slice(0, 8)
        .map(
          (w) =>
            `${w.index} ${w.phase}${w.deload ? " (rast.)" : ""} ${km(w.targetKm)}`,
        )
        .join(" · "),
    "",
  );
}
for (const [id, asOf, day, pain, note] of CASES) {
  out.push(
    `## ${id}: asOf ${asOf} (${note}), bol ${pain}`,
    "",
    "| | ned 3 | ned 4 | ned 5 | ned 6 | ned 7 | korak |",
    "|---|---|---|---|---|---|---|",
  );
  const msgs: string[] = [];
  for (const [label, api] of [
    ["pre (bf47249)", prev],
    ["posle", cur],
  ] as const) {
    const p0 = api.generateFiveKV2(INPUT).plan;
    const r = api.adaptFiveKV2(
      p0,
      {
        workouts: [
          { date: day, km: 0, durationSec: 0, completed: false, pain },
        ],
      },
      asOf,
    );
    if (!r.ok) throw new Error(`${id} ${label}: ${JSON.stringify(r)}`);
    const st = r.plan.adaptation.steps[0]!;
    out.push(
      `| ${label} | ${[3, 4, 5, 6, 7].map((i) => cell(r.plan.weeks[i - 1]!)).join(" | ")} | r=${st.firstWeek}, sidro=${st.returnFrom?.week ?? "—"}, nivo ${km(st.levelKm ?? 0)} |`,
    );
    msgs.push(
      `- ${label}: ${r.reasons.find((x) => x.condition === "PAIN")!.message}`,
    );
  }
  out.push("", ...msgs, "");
}
const file = new URL("./examples.md", import.meta.url);
writeFileSync(file, out.join("\n"));
console.log(out.join("\n"));
