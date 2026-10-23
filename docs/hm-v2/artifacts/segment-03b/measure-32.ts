/* HM v2 Segment 03b — pouka 32: nedelje u kojima je kvalitetni dan (ili dan testa) duži od dugog po trajanju.
   Mreže 02 (16 896), r (10 944), gusta ned 1 (141 804), 03 po osećaju (6336) i početnik (1890). Pokretanje iz
   korena repoa: node docs/hm-v2/artifacts/segment-03b/measure-32.ts <izlaz.json> [koren v2]
   Izlaz: brojevi po vrsti nedelje / zoni / najnižem nivou / dugom na plafonu i spisak planova (id) sa bar jednom
   takvom nedeljom — osnova regresije (menjaju se samo ti planovi). */

import { writeFileSync } from "node:fs";
import {
  beginnerInputs,
  DAY_COUNTS,
  denseInputs,
  feelInputs,
  grid02Inputs,
  inputOf,
  KM_BY_DAYS,
  resultHash,
  SCHEDULES_BY_DAYS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const [out, rootArg] = process.argv.slice(2);
if (!out) throw new Error("upotreba: measure-32.ts <izlaz.json> [koren v2]");
const root = rootArg ?? "../../../../web/src/domain/generators/halfMarathon/v2";
const { generateHmV2 } = (await import(`${root}/generate.ts`)) as {
  generateHmV2: (raw: unknown) => any;
};
const { ladderLevels, doseOf } = (await import(`${root}/workouts.ts`)) as any;
const L = (await import(`${root}/lengths.ts`)) as any;
const { planRule } = (await import(`${root}/policy.ts`)) as any;

const inputs: [string, string, Record<string, unknown>][] = [
  ...grid02Inputs().map(
    (g) => ["02", g.id, g.input] as [string, string, Record<string, unknown>],
  ),
  ...DAY_COUNTS.flatMap((days) => {
    const xs: [string, string, Record<string, unknown>][] = [];
    for (let r = 5; r <= 42; r++)
      for (let km = KM_BY_DAYS[days].min; km <= KM_BY_DAYS[days].max; km += 5)
        for (const vdot of [30, 45, 70])
          for (const weeks of [10, 14, 20])
            xs.push([
              "r",
              `r-d${days}-${weeks}w-${km}km-v${vdot}-r${r}`,
              inputOf({
                weeks,
                km,
                vdot,
                days: SCHEDULES_BY_DAYS[days].A.days,
                recentLongRunKm: r,
              }),
            ]);
    return xs;
  }),
  ...DAY_COUNTS.flatMap((n) =>
    denseInputs(n).map(
      (g) =>
        ["dense", g.id, g.input] as [string, string, Record<string, unknown>],
    ),
  ),
  ...feelInputs().map(
    (g) => ["feel", g.id, g.input] as [string, string, Record<string, unknown>],
  ),
  ...beginnerInputs().map(
    (g) =>
      ["beginner", g.id, g.input] as [string, string, Record<string, unknown>],
  ),
];

const t0 = Date.now();
const count: Record<string, number> = {};
const add = (k: string): void => {
  count[k] = (count[k] ?? 0) + 1;
};
const plans: Record<string, string> = {};
const hashes: Record<string, string> = {};
const examples: Record<string, string> = {};
let maxDiff = 0;
for (const [grid, id, input] of inputs) {
  const r = generateHmV2(input);
  hashes[id] = resultHash(r);
  if (!r.ok) {
    add(`${grid} odbijen`);
    continue;
  }
  const beg = r.plan.input.experience === "beginner";
  if (r.plan.warnings.some((v: any) => v.rule === "LONG_SHORTER_THAN_QUALITY"))
    add(`${grid} upozorenje pouke 14 (planova)`);
  const rule = planRule(
    r.plan.input.runDays.length,
    beg ? "beginner" : "regular",
  );
  const longs = r.plan.weeks.map((w: any) => {
    const l = w.days.find((d: any) => d.role === "long");
    return l ? Math.round(l.workout.km * 10) : null;
  });
  let longest = 0;
  let hit = false;
  for (const w of r.plan.weeks) {
    const l10 = longs[w.index - 1];
    const roll = L.rollingLongCap10(
      w.index,
      longs,
      r.plan.input.recentLongRunKm,
    );
    const cap = L.longCap10(Math.round(w.targetKm * 10), rule, r.plan.paces);
    // Uzrok kratkog dugog: pouka 28 (kotrljajuća granica ispod ostalih), taper (0,6 × najduži), rasterećenje
    // (0,8 × / HI14), plafon (udeo/150 min/24 km), inače lagani ≥ 4 km (ostatak).
    const cause =
      l10 === null
        ? "—"
        : w.phase === "taper" && l10 === L.taperLongCap10(longest)
          ? "taper 0,6×"
          : w.deload
            ? "rasterećenje"
            : l10 === roll && roll < cap
              ? "pouka 28"
              : l10 === cap
                ? "udeo/vreme/24 km"
                : "lagani ≥ 4 km";
    if (l10 !== null) longest = Math.max(longest, l10);
    const long = w.days.find((d: any) => d.role === "long");
    if (!long) continue;
    for (const d of w.days) {
      const k = d.workout.kind;
      if (k !== "quality" && k !== "test") continue;
      if (d.workout.sec <= long.workout.sec) continue;
      hit = true;
      const kind = w.deload
        ? "deload"
        : w.phase === "taper"
          ? "taper"
          : "build";
      const dose = d.workout.dose;
      // Najniži nivo zone: izgradnja — prvi nivo lestvice; rasterećenje/taper — T 2,0 km (početnik 1,5), RP 2 × 2000.
      const floor = !dose
        ? 0
        : kind === "build"
          ? doseOf(ladderLevels(dose.ladder, beg)[0])
          : dose.zone === "RP"
            ? 4000
            : beg
              ? 1500
              : 2000;
      const lowest = dose && dose.doseM <= floor ? "najniži" : "viši";
      const key = `${grid} ${kind} ${k === "test" ? "test" : `${dose.zone} ${lowest}`} ned${w.index === 1 ? "1" : ">1"}`;
      add(key);
      add(`${grid} uzrok: ${cause}`);
      const diff = (d.workout.sec - long.workout.sec) / 60;
      const dk = `${grid} ${kind} ${k === "test" ? "test" : lowest} ned${w.index === 1 ? "1" : ">1"} max min`;
      count[dk] = Math.max(count[dk] ?? 0, +diff.toFixed(1));
      if (diff > maxDiff) maxDiff = diff;
      examples[key] ??=
        `${id} ned ${w.index}: ${d.workout.title} ${Math.round(d.workout.sec / 60)} > dugi ${long.workout.km} km ${Math.round(long.workout.sec / 60)} min`;
    }
  }
  if (hit) {
    add(`${grid} planova`);
    plans[id] = grid;
  }
}
writeFileSync(
  out,
  JSON.stringify({
    count,
    examples,
    maxDiffMin: +maxDiff.toFixed(1),
    plans,
    hashes,
  }),
);
console.log(
  JSON.stringify(
    {
      count,
      examples,
      maxDiffMin: +maxDiff.toFixed(1),
      seconds: (Date.now() - t0) / 1000,
    },
    null,
    1,
  ),
);
