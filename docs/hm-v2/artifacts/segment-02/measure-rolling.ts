/* HM v2 Segment 02 — merenje pouke 28 kao kotrljajućeg pravila (HI7, odluka organizatora posle MAR-02).
   Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-02/measure-rolling.ts
   (A) Mreža 02 (16 896) BEZ recentLongRunKm: isti kod, pravilo isključeno (`recentLong.factor` privremeno 100,
       samo u ovom procesu) vs uključeno — po broju dana: planova promenjenih (normalizovan heš, bez teksta),
       vrh niži, najveći pomak dugog (km), najveći skok dugog ned 1 → 2 (odnos) pre/posle.
   (B) Mreža r: recentLongRunKm 5–42 (korak 1) × dani × obim reda (korak 5) × VDOT {30, 45, 70} × nedelje {10, 14, 20}:
       odbijanja RECENT_LONG_TOO_SHORT po r / danima / nedeljama, ostala odbijanja, najveći skok dugog ned 1 → 2. */

import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import { HM_V2_POLICY } from "../../../../web/src/domain/generators/halfMarathon/v2/policy.ts";
import {
  DAY_COUNTS,
  grid02Inputs,
  inputOf,
  KM_BY_DAYS,
  planHashNorm,
  SCHEDULES_BY_DAYS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import type { HmV2Plan } from "../../../../web/src/domain/generators/halfMarathon/v2/types.ts";

const rl = HM_V2_POLICY.recentLong as { factor: number };
const longs = (p: HmV2Plan): number[] =>
  p.weeks.map((w) => w.days.find((d) => d.role === "long")?.workout.km ?? 0);
const jump12 = (p: HmV2Plan): number => {
  const [a, b] = longs(p);
  return a && b ? b / a : 0;
};

// (A)
const grid = grid02Inputs();
const run = (): Map<string, HmV2Plan> => {
  const m = new Map<string, HmV2Plan>();
  for (const g of grid) {
    const r = generateHmV2(g.input);
    if (!r.ok) throw new Error(`${g.id}: ${r.reasons[0]!.message}`);
    m.set(g.id, r.plan);
  }
  return m;
};
rl.factor = 100;
const off = run();
rl.factor = 1.1;
const on = run();
const A: Record<string, unknown> = {};
for (const days of DAY_COUNTS) {
  const s = {
    plans: 0,
    changed: 0,
    peakLower: 0,
    maxLongShiftKm: 0,
    maxLongShiftId: "",
    jump12Max: [0, 0],
  };
  for (const g of grid.filter((x) => x.days === days)) {
    const a = off.get(g.id)!;
    const b = on.get(g.id)!;
    s.plans++;
    s.jump12Max[0] = Math.max(s.jump12Max[0]!, +jump12(a).toFixed(3));
    s.jump12Max[1] = Math.max(s.jump12Max[1]!, +jump12(b).toFixed(3));
    if (planHashNorm(a) === planHashNorm(b)) continue;
    s.changed++;
    if (b.peakKm < a.peakKm) s.peakLower++;
    const la = longs(a);
    const lb = longs(b);
    const shift = Math.max(...la.map((x, i) => Math.abs(x - lb[i]!)));
    if (shift > s.maxLongShiftKm) {
      s.maxLongShiftKm = +shift.toFixed(1);
      s.maxLongShiftId = g.id;
    }
  }
  A[`${days} dana`] = s;
}

// (B)
const B: Record<string, unknown> = {};
for (const days of DAY_COUNTS) {
  const byR: Record<string, number> = {};
  const byWeeks: Record<string, number> = {};
  const other: Record<string, number> = {};
  let total = 0;
  let tooShort = 0;
  let jumpMax = 0;
  let jumpId = "";
  let example = "";
  for (let r = 5; r <= 42; r++)
    for (let km = KM_BY_DAYS[days].min; km <= KM_BY_DAYS[days].max; km += 5)
      for (const vdot of [30, 45, 70])
        for (const weeks of [10, 14, 20]) {
          total++;
          const res = generateHmV2(
            inputOf({
              weeks,
              km,
              vdot,
              days: SCHEDULES_BY_DAYS[days].A.days,
              recentLongRunKm: r,
            }),
          );
          if (res.ok) {
            const j = jump12(res.plan);
            if (j > jumpMax) {
              jumpMax = +j.toFixed(3);
              jumpId = `${days} d, ${weeks} ned, ${km} km, VDOT ${vdot}, r ${r}: ${longs(res.plan).slice(0, 3).join(" → ")}`;
            }
            continue;
          }
          const code = res.reasons[0]!.code;
          if (code !== "RECENT_LONG_TOO_SHORT") {
            other[code] = (other[code] ?? 0) + 1;
            continue;
          }
          tooShort++;
          byR[r] = (byR[r] ?? 0) + 1;
          byWeeks[weeks] = (byWeeks[weeks] ?? 0) + 1;
          if (!example)
            example = `${days} d, ${weeks} ned, ${km} km, VDOT ${vdot}, r ${r}: ${res.reasons[0]!.message}`;
        }
  B[`${days} dana`] = {
    total,
    tooShort,
    byR,
    byWeeks,
    other,
    jump12Max: jumpMax,
    jumpId,
    example,
  };
}
console.log(JSON.stringify({ A, B }, null, 1));
