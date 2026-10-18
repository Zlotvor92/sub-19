/* Primeri 10K v2 (Segment 06b, 10k-v2.4.1: bol — povratak od nedelje sidra r, osnova 70 % nivoa pre bola).
   Slučajevi A–E iz nalaza organizatora: isti ulaz, bol na dan iz zapisa bez trčanja. Pokretanje iz korena repoa:
     git worktree add --detach /tmp/wt-e65 e6540a5
     ln -s "$PWD/web/node_modules" /tmp/wt-e65/web/node_modules
     node docs/10k-v2/artifacts/segment-06b/run.ts /tmp/wt-e65
   „pre" = adaptTenKV2 KODOM IZ e6540a5 (10k-v2.4.0), „posle" = adaptTenKV2 iz ovog stabla (10k-v2.4.1); bazni plan
   je isti (generator bajt-isti osim oznake verzije). Upisuje inputs.json (ulaz, činjenice, asOf), cases.json (po
   nedelji: cilj, planirano, nominal, dani — pre/posle; korak i poruka PAIN) i examples.md pored skripte, formatirane
   prettier-om; dva pokretanja daju bajt-isti izlaz. regression-e6540a5.ts piše heševe regresije
   (web/src/domain/generators/tenK/v2/segment06b.adapt-hashes-e6540a5.json). */

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEN_K_V2_POLICY,
  adaptTenKV2,
  generateTenKV2,
} from "../../../../web/src/domain/generators/tenK/v2/index.ts";
import type {
  AdaptResult,
  PlanWeek,
  TenKV2Plan,
} from "../../../../web/src/domain/generators/tenK/v2/index.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const old = resolve(process.argv[2] ?? "");
const prev = (await import(
  join(old, "web/src/domain/generators/tenK/v2/index.ts")
)) as {
  TEN_K_V2_POLICY: { version: string };
  adaptTenKV2: (plan: unknown, facts: unknown, asOf: string) => AdaptResult;
};
const prettier = (await import(
  new URL("../../../../web/node_modules/prettier/index.mjs", import.meta.url)
    .href
)) as {
  format: (src: string, opts: Record<string, unknown>) => Promise<string>;
  resolveConfig: (file: string) => Promise<Record<string, unknown> | null>;
};

const km = (x: number): string => x.toFixed(1).replace(".", ",");
const PHASE: Record<string, string> = {
  base: "baza",
  development: "razvoj",
  specific: "specifično",
  taper: "taper",
  race: "trka",
};

const INPUT = {
  startDate: "2026-10-26",
  raceDate: "2027-01-24",
  runDays: ["tue", "thu", "sat", "sun"],
  currentWeeklyKm: 40,
  recentResult: { distanceM: 10000, timeSec: 2700, date: "2026-10-10" },
  goalTimeSec: 2580,
};
const CASES = [
  {
    id: "A",
    asOf: "2026-11-15",
    day: "2026-11-14",
    pain: 5,
    note: "nedelja; bol dan ranije, u subotu",
  },
  {
    id: "B",
    asOf: "2026-11-15",
    day: "2026-11-14",
    pain: 8,
    note: "nedelja; bol dan ranije, u subotu",
  },
  {
    id: "C",
    asOf: "2026-11-18",
    day: "2026-11-18",
    pain: 5,
    note: "sreda; bol istog dana",
  },
  {
    id: "D",
    asOf: "2026-11-18",
    day: "2026-11-18",
    pain: 8,
    note: "sreda; bol istog dana",
  },
  {
    id: "E",
    asOf: "2026-11-13",
    day: "2026-11-13",
    pain: 7,
    note: "petak; bol istog dana",
  },
] as const;
const factsOf = (day: string, pain: number) => ({
  workouts: [{ date: day, km: 0, durationSec: 0, completed: false, pain }],
});

const quality = (w: PlanWeek): number =>
  w.days.filter((d) => d.workout.kind === "quality").length;
const dayText = (w: PlanWeek): string[] =>
  w.days.map(
    (d) =>
      `${d.date} ${d.role} ${km(d.workout.km)}${d.workout.kind === "quality" ? ` (${d.workout.dose!.zone})` : ""}`,
  );
const weekRow = (w: PlanWeek) => ({
  week: w.index,
  phase: w.phase,
  deload: w.deload,
  targetKm: w.targetKm,
  plannedKm: w.plannedKm,
  nominalKm: w.nominalKm,
  quality: quality(w),
  pain: w.limits?.pain ?? [],
  rest: w.limits?.rest ?? [],
  days: dayText(w),
});
const stepOf = (r: AdaptResult) => {
  if (!r.ok) return { rejected: r.reasons };
  const s = r.plan.adaptation!.steps.at(-1)!;
  return {
    policyVersion: r.plan.policyVersion,
    firstWeek: s.firstWeek,
    fromWeek: s.fromWeek,
    rest: s.rest,
    pain: s.pain,
    levelKm: s.levelKm,
    returnFrom: s.returnFrom,
    message: r.reasons.find((x) => x.condition === "PAIN")?.message ?? null,
  };
};

const g = generateTenKV2(INPUT);
if (!g.ok) throw new Error(JSON.stringify(g.reasons));
const base: TenKV2Plan = g.plan;
const lim = (w: PlanWeek): string =>
  [
    w.deload ? "rasterećenje" : "",
    w.limits?.rest ? `odmor ${w.limits.rest.length} d` : "",
    w.limits?.pain ? `bol ${w.limits.pain.length} d` : "",
  ]
    .filter(Boolean)
    .join(", ") || "—";
const cell = (w: PlanWeek): string =>
  `${km(w.targetKm)} / ${km(w.plannedKm)} · ${quality(w)} kv`;

const md: string[] = [
  `# 10K v2 — primeri segmenta 06b (${prev.TEN_K_V2_POLICY.version} → ${TEN_K_V2_POLICY.version}): bol, povratak od nedelje sidra`,
  "",
  'Generisano: `node docs/10k-v2/artifacts/segment-06b/run.ts <checkout e6540a5>`. Ulaz: 4 dana (uto/čet/sub/ned, dugi nedelja), start 2026-10-26, trka 2027-01-24 (13 ned), 40 km, 10 km 45:00 (2026-10-10), cilj 43:00. Činjenica: jedan zapis bez trčanja sa bolom (`km 0, completed false, pain N`). Ćelija = cilj / planirano · broj kvaliteta. „pre" = e6540a5, „posle" = 10k-v2.4.1. Ograničenje (posle) = rasterećenje i broj dana trčanja nedelje u periodu odmora/bola.',
  "",
  `Bazni plan: ${base.weeks.map((w) => `${w.index}${w.deload ? "R" : ""} ${km(w.targetKm)}`).join(" · ")} (R = rasterećenje).`,
  "",
];
const cases: unknown[] = [];
for (const c of CASES) {
  const facts = factsOf(c.day, c.pain);
  const before = prev.adaptTenKV2(base, facts, c.asOf);
  const after = adaptTenKV2(base, facts, c.asOf);
  if (!before.ok || !after.ok) throw new Error(`${c.id}: odbijeno`);
  const sb = stepOf(before);
  const sa = stepOf(after);
  cases.push({
    id: c.id,
    asOf: c.asOf,
    painDay: c.day,
    pain: c.pain,
    before: { step: sb, weeks: before.plan.weeks.map(weekRow) },
    after: { step: sa, weeks: after.plan.weeks.map(weekRow) },
  });
  const s = after.plan.adaptation!.steps.at(-1)!;
  const sOld = before.plan.adaptation!.steps.at(-1)!;
  md.push(
    `## ${c.id}: asOf ${c.asOf} (${c.note}), bol ${c.pain}/10 na dan ${c.day}`,
    "",
    `- Odmor: ${s.rest ? `${s.rest.from} – ${s.rest.to}` : "nema"}; period bola ${s.pain!.from} – ${s.pain!.to}; nedelja r (asOf + 1) = ${s.firstWeek}.`,
    `- Sidro: e6540a5 nedelja ${sOld.returnFrom?.week ?? "—"} (poslednja nedelja bola, 0,7 × njen cilj) → 10k-v2.4.1 nedelja ${s.returnFrom?.week ?? "—"}; nivo pre bola ${s.levelKm === null ? "—" : `${km(s.levelKm)} km`}.`,
    `- Poruka posle: ${sa.message}`,
    "",
    "| ned | faza | pre (e6540a5) | posle (10k-v2.4.1) | ograničenje |",
    "|---|---|---|---|---|",
    ...after.plan.weeks.map((w, i) => {
      const o = before.plan.weeks[i]!;
      return `| ${w.index} | ${PHASE[w.phase]}${w.deload ? " (R)" : ""} | ${cell(o)} | ${cell(w)}${JSON.stringify(o) === JSON.stringify(w) ? " (isto)" : ""} | ${lim(w)} |`;
    }),
    "",
  );
}

async function write(name: string, text: string): Promise<void> {
  const file = join(OUT, name);
  const opts = (await prettier.resolveConfig(file)) ?? {};
  writeFileSync(file, await prettier.format(text, { ...opts, filepath: file }));
}
await write(
  "inputs.json",
  JSON.stringify(
    {
      input: INPUT,
      cases: CASES.map((c) => ({
        id: c.id,
        asOf: c.asOf,
        facts: factsOf(c.day, c.pain),
      })),
    },
    null,
    2,
  ) + "\n",
);
await write("cases.json", JSON.stringify(cases, null, 2) + "\n");
await write("examples.md", md.join("\n"));
for (const c of CASES) console.log(c.id);
