/* Primeri 10K v2 (Segment 04, 10k-v2.4.0: adaptacija — assess → construct → zaštita → validate). Pokretanje
   iz korena repoa:
     node docs/10k-v2/artifacts/segment-04/run.ts
   (Node ≥ 22.18: TypeScript type stripping; potreban web/node_modules zbog prettier-a). Upisuje inputs.json
   (ulaz, činjenice, asOf), <id>.json (rezultat adaptacije) i examples.md (reasons + tabela nedelja pre →
   posle: cilj, kvalitet, dugi) pored skripte, formatirane prettier-om; dva pokretanja daju bajt-isti izlaz.
   regression-b13ca17.ts piše heševe regresije generate (segment04.plan-hashes-b13ca17.json). */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEN_K_V2_POLICY,
  adaptTenKV2,
  generateTenKV2,
} from "../../../../web/src/domain/generators/tenK/v2/index.ts";
import type {
  AdaptResult,
  PlanWeek,
  TenKV2Facts,
  TenKV2Plan,
} from "../../../../web/src/domain/generators/tenK/v2/index.ts";
import { addDays } from "../../../../web/src/domain/generators/tenK/v2/dates.ts";
import {
  inputOf,
  runsIn,
  SCHEDULES_BY_DAYS,
} from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const prettier = (await import(
  new URL("../../../../web/node_modules/prettier/index.mjs", import.meta.url)
    .href
)) as {
  format: (src: string, opts: Record<string, unknown>) => Promise<string>;
  resolveConfig: (file: string) => Promise<Record<string, unknown> | null>;
};

const km = (x: number): string => x.toFixed(1).replace(".", ",");
const fmt = (sec: number): string => {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const PHASE: Record<string, string> = {
  base: "baza",
  development: "razvoj",
  specific: "specifično",
  taper: "taper",
  race: "trka",
};

interface Step {
  asOf: string;
  facts: TenKV2Facts;
}
interface Example {
  id: string;
  note: string;
  input: Record<string, unknown>;
  /** Koraci adaptacije redom (lanac: više koraka); svaki se gradi iz plana posle prethodnog koraka. */
  steps: ((p: TenKV2Plan) => Step)[];
}

const sc = (d: 3 | 4 | 5 | 6) => SCHEDULES_BY_DAYS[d].A;
const result = (d: 3 | 4 | 5 | 6, weeks: number, km0: number, vdot = 45) =>
  inputOf({ weeks, km: km0, vdot, days: sc(d).days, long: sc(d).long });
const back = (asOf: string, n: number): string => addDays(asOf, -n);
const covered = (asOf: string, n: number) => ({
  from: back(asOf, n),
  to: asOf,
  complete: true,
});
const facts = (x: unknown): TenKV2Facts => x as TenKV2Facts;

const EXAMPLES: Example[] = [
  {
    id: "d4-rezultat-14w-pauza20",
    note: "4 dana, 14 ned, VDOT 45, 35 km — prijavljena pauza 20 dana (bez zapisa i coverage), asOf kraj ned 7",
    input: result(4, 14, 35),
    steps: [
      (p) => {
        const asOf = p.weeks[6]!.endDate;
        return {
          asOf,
          facts: facts({
            breaks: [{ kind: "break", from: back(asOf, 19), to: asOf }],
          }),
        };
      },
    ],
  },
  {
    id: "d5-rezultat-16w-manjak-lanac",
    note: "5 dana, 16 ned, VDOT 45, 45 km — manjak 50 % (pokriveno) na kraju ned 5, pa nedelju kasnije opet manjak (lanac, 2 koraka)",
    input: result(5, 16, 45),
    steps: [5, 6].map((w) => (p: TenKV2Plan): Step => {
      const asOf = p.weeks[w - 1]!.endDate;
      return {
        asOf,
        facts: facts({
          workouts: [
            ...runsIn(p, back(asOf, 13), back(asOf, 7)),
            ...runsIn(p, back(asOf, 6), asOf, 0.5),
          ],
          coverage: covered(asOf, 13),
        }),
      };
    }),
  },
  {
    id: "d3-osecaj-12w-test5km",
    note: "3 dana, 12 ned, po osećaju lagan 6:00, 25 km — test 5 km 24:30 u ned 4 (asOf kraj ned 4)",
    input: {
      ...result(3, 12, 25),
      recentResult: null,
      easyPaceSecPerKm: 360,
    },
    steps: [
      (p) => {
        const asOf = p.weeks[3]!.endDate;
        const test = p.weeks[3]!.days.find((d) => d.role === "test")!.date;
        return {
          asOf,
          facts: facts({
            workouts: runsIn(p, test, test),
            results: [{ distM: 5000, sec: 1470, date: test, kind: "test" }],
          }),
        };
      },
    ],
  },
  {
    id: "d6-rezultat-18w-bol8",
    note: "6 dana, 18 ned, VDOT 45, 55 km — bol 8/10 u sredu ned 9 (asOf sreda ned 9)",
    input: result(6, 18, 55),
    steps: [
      (p) => {
        const asOf = addDays(p.weeks[8]!.startDate, 2);
        return {
          asOf,
          facts: facts({
            workouts: runsIn(p, p.weeks[8]!.startDate, asOf).map((w) =>
              w["date"] === asOf ? { ...w, pain: 8 } : w,
            ),
          }),
        };
      },
    ],
  },
  {
    id: "pocetnik-d4-12w-pauza35",
    note: "početnik 4 dana, 12 ned, VDOT 35, 25 km — pauza 35 dana (pokriveno), asOf kraj ned 5: nov start, < 8 ned do trke → orijentir",
    input: {
      ...inputOf({
        weeks: 12,
        km: 25,
        vdot: 35,
        days: sc(4).days,
        long: sc(4).long,
      }),
      experience: "beginner",
      goalTimeSec: 3600,
    },
    steps: [
      (p) => {
        const asOf = p.weeks[4]!.endDate;
        return {
          asOf,
          facts: facts({
            workouts: runsIn(p, back(asOf, 48), back(asOf, 35)),
            coverage: covered(asOf, 48),
          }),
        };
      },
    ],
  },
  {
    id: "d4-nepotpuna-pokrivenost",
    note: "4 dana, 14 ned, VDOT 45, 35 km — u 14 dana do asOf (kraj ned 6) zapisana su samo 3 treninga, coverage complete = false: nije pauza ni manjak",
    input: result(4, 14, 35),
    steps: [
      (p) => {
        const asOf = p.weeks[5]!.endDate;
        return {
          asOf,
          facts: facts({
            workouts: runsIn(p, back(asOf, 13), asOf).slice(0, 3),
            coverage: { from: back(asOf, 13), to: asOf, complete: false },
          }),
        };
      },
    ],
  },
];

const qual = (w: PlanWeek): string =>
  w.days
    .filter((d) => d.workout.kind === "quality" || d.workout.kind === "test")
    .map((d) =>
      d.workout.kind === "test"
        ? "test 5 km"
        : d.workout.title
            .replace(/^WU \d+ min \+ /, "")
            .replace(/ \+ CD \d+ min$/, "")
            .replace(/ \(oporavak [^)]*\)/, ""),
    )
    .join(" + ") || "—";
const longKm = (w: PlanWeek): string => {
  const l = w.days.find((d) => d.role === "long");
  return l ? km(l.workout.km) : "—";
};

function table(before: TenKV2Plan, after: TenKV2Plan): string {
  const mixed = new Set(after.adaptation?.mixedWeeks ?? []);
  const rows = [
    "| ned | faza | cilj pre → posle (planirano) | kvalitet pre → posle | dugi pre → posle | ograničenje |",
    "|---|---|---|---|---|---|",
  ];
  after.weeks.forEach((w, i) => {
    const o = before.weeks[i]!;
    const same = JSON.stringify(o) === JSON.stringify(w);
    const lim = [
      w.deload ? "rasterećenje" : "",
      w.limits?.quality === "none"
        ? "bez kvaliteta"
        : w.limits?.quality === "one"
          ? "1 kvalitet"
          : "",
      w.limits?.rest ? `odmor ${w.limits.rest.length} d` : "",
      w.limits?.pain ? `bol ${w.limits.pain.length} d` : "",
      w.test ? "test" : "",
      mixed.has(w.index) ? "mešovita" : "",
      w.notes.some((n) => n.includes("(A9)")) ? "A9" : "",
    ]
      .filter(Boolean)
      .join(", ");
    rows.push(
      same
        ? `| ${w.index} | ${PHASE[w.phase]} | ${km(w.targetKm)} (isto) | ${qual(w)} | ${longKm(w)} | ${lim || "—"} |`
        : `| ${w.index} | ${PHASE[o.phase]}${o.phase !== w.phase ? ` → ${PHASE[w.phase]}` : ""} | ${km(o.targetKm)} → ${km(w.targetKm)} (${km(w.plannedKm)}) | ${qual(o)} → ${qual(w)} | ${longKm(o)} → ${longKm(w)} | ${lim || "—"} |`,
    );
  });
  return rows.join("\n");
}

async function write(name: string, text: string): Promise<void> {
  const file = join(OUT, name);
  const opts = (await prettier.resolveConfig(file)) ?? {};
  writeFileSync(file, await prettier.format(text, { ...opts, filepath: file }));
}

const md: string[] = [
  `# 10K v2 — primeri segmenta 04 (${TEN_K_V2_POLICY.version}): adaptacija`,
  "",
  "Generisano: `node docs/10k-v2/artifacts/segment-04/run.ts`. Start 2026-11-02 (ponedeljak), trka u nedelju. Plan pre = generateTenKV2(ulaz) (lanac: plan posle prethodnog koraka); plan posle = adaptTenKV2(plan, činjenice, asOf). Cilj = cilj nedelje (planirano u zagradi kad se razlikuje: dani bola/odmora, mešovita nedelja sa zadržanim danima do asOf). „(isto)“ = nedelja bajt-ista. Kvalitet bez WU/CD i oporavka.",
  "",
];
const inputs: unknown[] = [];
for (const ex of EXAMPLES) {
  const g = generateTenKV2(ex.input);
  if (!g.ok) throw new Error(`${ex.id}: ${JSON.stringify(g.reasons)}`);
  let plan = g.plan;
  const results: AdaptResult[] = [];
  md.push(`## ${ex.id}`, "", ex.note, "");
  for (const [k, make] of ex.steps.entries()) {
    const st = make(plan);
    const f = st.facts;
    const r = adaptTenKV2(plan, f, st.asOf);
    results.push(r);
    inputs.push({
      id: ex.id,
      step: k + 1,
      input: ex.input,
      asOf: st.asOf,
      facts: f,
    });
    md.push(`### Korak ${k + 1}: asOf ${st.asOf}`, "");
    if (!r.ok) {
      md.push("**Odbijeno:**", "");
      for (const x of r.reasons) md.push(`- \`${x.code}\`: ${x.message}`);
      md.push("");
      break;
    }
    md.push(
      `- Tempo: ${r.plan.paceBasis === "feel" ? `po osećaju (procena VDOT ${km(r.plan.vdot)})` : `rezultat, VDOT ${km(r.plan.vdot)}, prognoza 10K ${fmt(r.plan.predicted10kSec!)}`}${plan.paceBasis !== r.plan.paceBasis ? ` (bilo: ${plan.paceBasis === "feel" ? "po osećaju" : "rezultat"})` : ""}; cilj: ${r.plan.goal ? `${r.plan.goal.status}` : "—"}`,
      `- Koraci u planu: ${r.plan.adaptation!.steps.length}; mešovite nedelje: ${r.plan.adaptation!.mixedWeeks.join(", ") || "nema"}; promena (changes): ${r.changes.length}`,
      `- Upozorenja: ${[...new Set(r.plan.warnings.map((w) => w.rule))].join(", ") || "nema"}`,
      "",
      "Reasons:",
      "",
      ...(r.reasons.length === 0
        ? ["- nema (nijedan uslov iz činjenica)"]
        : []),
      ...r.reasons.map(
        (x) =>
          `- \`${x.condition}\` (${x.applied ? "primenjeno" : "nije primenjeno"}): ${x.message}`,
      ),
      "",
      table(plan, r.plan),
      "",
    );
    plan = r.plan;
  }
  await write(`${ex.id}.json`, JSON.stringify(results, null, 2) + "\n");
}
await write("inputs.json", JSON.stringify(inputs, null, 2) + "\n");
await write("examples.md", md.join("\n"));
for (const ex of EXAMPLES) console.log(ex.id);
