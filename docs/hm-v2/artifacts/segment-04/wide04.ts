/* HM v2 Segment 04 — ŠIROKA PRETRAGA pre predaje (MASTER § 3): svaki n-ti plan svih mreža (02, 03 po osećaju,
   početnik, gusta nedelja 1 po broju dana, skorašnji najduži trk) × asOf sreda i kraj svake nedelje 1…N − 2 ×
   svih 17 scenarija mreže 04 (+ drugi korak lanca). Broji tokove, odbijanja po klasi i prekršaje adaptInvariants.
   Pokretanje iz korena repoa (delovi paralelno, pa spajanje):
     node docs/hm-v2/artifacts/segment-04/wide04.ts <deo 0…K−1> <K> > /tmp/wide.<deo>.json
     node docs/hm-v2/artifacts/segment-04/wide04.ts merge /tmp/wide.*.json */

import { readFileSync } from "node:fs";
import { adaptHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/adapt.ts";
import { adaptInvariants } from "../../../../web/src/domain/generators/halfMarathon/v2/adaptInvariants.ts";
import {
  chainSecond,
  factsOf,
  SCENARIOS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/adaptInputs.ts";
import {
  addDays,
  weekdayOf,
} from "../../../../web/src/domain/generators/halfMarathon/v2/dates.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import {
  beginnerInputs,
  DAY_COUNTS,
  denseInputs,
  feelInputs,
  grid02Inputs,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import type { HmV2Plan } from "../../../../web/src/domain/generators/halfMarathon/v2/types.ts";

interface Out {
  plans: number;
  flows: number;
  rejected: Record<string, number>;
  examples: Record<string, string>;
  invariants: Record<string, number>;
  invExamples: Record<string, string>;
  seconds: number;
}

/** Korak po mreži: svaki n-ti plan. */
export const EVERY = {
  grid02: 150,
  feel: 60,
  beginner: 25,
  dense: 4000,
  recent: 500,
};

function bases(): { id: string; input: Record<string, unknown> }[] {
  const every = <X>(xs: readonly X[], k: number): X[] =>
    xs.filter((_, i) => i % k === 0);
  const g02 = grid02Inputs();
  return [
    ...every(g02, EVERY.grid02).map((g) => ({ id: g.id, input: g.input })),
    ...every(feelInputs(), EVERY.feel).map((g) => ({
      id: g.id,
      input: g.input,
    })),
    ...every(beginnerInputs(), EVERY.beginner).map((g) => ({
      id: g.id,
      input: g.input,
    })),
    ...DAY_COUNTS.flatMap((d) => every(denseInputs(d), EVERY.dense)).map(
      (g) => ({ id: g.id, input: g.input }),
    ),
    ...every(g02, EVERY.recent).flatMap((g) =>
      [8, 15].map((r) => ({
        id: `r${r}-${g.id}`,
        input: { ...g.input, recentLongRunKm: r },
      })),
    ),
  ];
}

function run(partIndex: number, K: number): Out {
  const t0 = Date.now();
  const out: Out = {
    plans: 0,
    flows: 0,
    rejected: {},
    examples: {},
    invariants: {},
    invExamples: {},
    seconds: 0,
  };
  const add = (o: Record<string, number>, k: string) =>
    (o[k] = (o[k] ?? 0) + 1);
  const flow = (
    pl: HmV2Plan,
    f: Record<string, unknown>,
    at: string,
    key: string,
  ): HmV2Plan | null => {
    out.flows++;
    const r = adaptHmV2(pl, f, at);
    if (!r.ok) {
      for (const x of r.reasons) {
        // Klasa = pravilo validatora (početak poruke) ili kod odbijanja.
        const k =
          x.code === "PLAN_VIOLATES_POLICY" ? x.message.split(":")[0]! : x.code;
        add(out.rejected, k);
        out.examples[k] ??= `${key}: ${x.message}`;
      }
      return null;
    }
    for (const v of adaptInvariants(pl, r.plan, at, f as never)) {
      const k = v.replace(/[0-9-]+/g, "#");
      add(out.invariants, k);
      out.invExamples[k] ??= `${key}: ${v}`;
    }
    return r.plan;
  };
  bases()
    .filter((_, i) => i % K === partIndex)
    .forEach((b) => {
      const g = generateHmV2(b.input);
      if (!g.ok) return;
      out.plans++;
      const plan = g.plan;
      const N = plan.weeks.length;
      for (let i = 1; i <= N - 2; i++) {
        const w = plan.weeks[i - 1]!;
        let wed = w.startDate;
        while (weekdayOf(wed) !== "wed") wed = addDays(wed, 1);
        for (const [tag, at] of [
          [`w${i}wed`, wed],
          [`w${i}end`, w.endDate],
        ] as const)
          for (const s of SCENARIOS) {
            const key = `${b.id}/${tag}/${s}`;
            const p1 = flow(plan, factsOf(plan, s, at), at, key);
            if (s === "chain" && p1) {
              const at2 = addDays(at, 7);
              if (at2 < plan.input.raceDate)
                flow(p1, chainSecond(plan, at2), at2, `${key}/2`);
            }
          }
      }
    });
  out.seconds = (Date.now() - t0) / 1000;
  return out;
}

if (process.argv[2] === "merge") {
  const parts = process.argv
    .slice(3)
    .map((f) => JSON.parse(readFileSync(f, "utf8")) as Out);
  const m: Out = {
    plans: 0,
    flows: 0,
    rejected: {},
    examples: {},
    invariants: {},
    invExamples: {},
    seconds: 0,
  };
  for (const p of parts) {
    m.plans += p.plans;
    m.flows += p.flows;
    m.seconds = Math.max(m.seconds, p.seconds);
    for (const [k, v] of Object.entries(p.rejected))
      m.rejected[k] = (m.rejected[k] ?? 0) + v;
    for (const [k, v] of Object.entries(p.invariants))
      m.invariants[k] = (m.invariants[k] ?? 0) + v;
    Object.assign(m.examples, { ...p.examples, ...m.examples });
    Object.assign(m.invExamples, { ...p.invExamples, ...m.invExamples });
  }
  console.log(JSON.stringify({ parts: parts.length, ...m }, null, 1));
} else {
  const res = run(Number(process.argv[2] ?? 0), Number(process.argv[3] ?? 1));
  console.log(JSON.stringify(res, null, 1));
}
