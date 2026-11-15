/* P5-MAR — mreža P0 za maraton (P0/common.ts grid, metrics) + metrike P5: test (broj, nedelja, nedelja do trke), T/I
   rad nedelje 1 i prvog dana zone, udeo rada prvog kvalitetnog dana, laganih dana sa ubrzanjima, % km bržih od E po
   fazi, nedelje > 25 % brzih km, vrh obima, nedelje sa napomenom WEEK_FITTED (fitted ≠ null), nedelja 1 ispod cilja.
   Iz web/: node ../docs/generators-v2/perfection/P5-MAR/measure.ts <oznaka>  → P5-MAR/raw-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { grid, metrics } from "../P0/common.ts";

const tag = process.argv[2] ?? "posle";
const dist = distOf("MAR");
const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; zone?: string; km: number; sec: number };
type Day = {
  role: string;
  date: string;
  workout: { kind: string; km: number; sec: number; segments: Seg[] };
};
type Wk = {
  index: number;
  phase: string;
  deload: boolean;
  test?: boolean;
  targetKm: number;
  plannedKm: number;
  fitted: unknown;
  days: Day[];
};
const FAST = (s: Seg) => !!s.zone && !["E", "jog", "walk"].includes(s.zone);
const WORK = (s: Seg) =>
  s.kind === "rep" || s.kind === "continuous" || s.kind === "test";
const r1 = (x: number) => Math.round(x * 10) / 10;
const rows: Record<string, unknown>[] = [];
const t0 = Date.now();
for (const c of grid("MAR")) {
  const r = dist.generate(c.input);
  if (!r.ok) {
    rows.push({
      id: c.id,
      family: c.family,
      days: c.days,
      weeks: c.weeks,
      rejected: r.reasons.map((x) => `${x.code}: ${x.message}`.slice(0, 200)),
    });
    continue;
  }
  const plan = r.plan as Plan;
  const W = plan.weeks as unknown as Wk[];
  const N = W.length;
  const zoneMin = (d: Day, z: string) =>
    r1(
      d.workout.segments
        .filter((s) => WORK(s) && s.zone === z)
        .reduce((a, s) => a + s.sec, 0) / 60,
    );
  const first: Record<string, { week: number; min: number } | null> = {
    T: null,
    I: null,
  };
  for (const w of W)
    for (const d of w.days)
      if (d.workout.kind === "quality")
        for (const z of ["T", "I"]) {
          const m = zoneMin(d, z);
          if (m > 0 && !first[z]) first[z] = { week: w.index, min: m };
        }
  const w1 = W[0]!;
  const w1Work = r1(
    w1.days
      .filter((d) => d.workout.kind === "quality")
      .reduce(
        (a, d) =>
          a + d.workout.segments.filter(WORK).reduce((x, s) => x + s.sec, 0),
        0,
      ) / 60,
  );
  const testWeeks = W.filter((w) => w.days.some((d) => d.role === "test")).map(
    (w) => ({ week: w.index, phase: w.phase, toRace: N - w.index }),
  );
  const strideWeeks = W.filter((w) =>
    w.days.some(
      (d) =>
        d.role === "easy" &&
        d.workout.segments.some((s) => s.kind === "stride"),
    ),
  );
  const strideDays = W.reduce(
    (a, w) =>
      a +
      w.days.filter(
        (d) =>
          d.role === "easy" &&
          d.workout.segments.some((s) => s.kind === "stride"),
      ).length,
    0,
  );
  const strideReps = W.map(
    (w) =>
      w.days
        .filter((d) => d.role === "easy")
        .map(
          (d) => d.workout.segments.filter((s) => s.kind === "stride").length,
        )
        .find((n) => n > 0) ?? 0,
  );
  const fastPct: number[] = [];
  const fastByPhase: Record<string, [number, number]> = {};
  for (const w of W) {
    let f = 0,
      t = 0;
    for (const d of w.days)
      if (d.role !== "race")
        for (const s of d.workout.segments) {
          t += s.km;
          if (FAST(s)) f += s.km;
        }
    if (w.phase !== "race")
      fastPct.push(t > 0 ? Math.round((1000 * f) / t) / 10 : 0);
    const a = (fastByPhase[w.phase] ??= [0, 0]);
    a[0] += f;
    a[1] += t;
  }
  rows.push({
    id: c.id,
    family: c.family,
    days: c.days,
    weeks: c.weeks,
    km: c.input["currentWeeklyKm"],
    policyVersion: plan["policyVersion"],
    m: metrics("MAR", plan),
    p5: {
      testWeeks,
      firstT: first.T,
      firstI: first.I,
      w1Work,
      strideDays,
      strideWeeks: strideWeeks.length,
      strideReps,
      buildTaperWeeks: W.filter((w) => w.phase !== "race").length,
      fastByPhase: Object.fromEntries(
        Object.entries(fastByPhase).map(([k, [f, t]]) => [
          k,
          t > 0 ? Math.round((1000 * f) / t) / 10 : 0,
        ]),
      ),
      over25: fastPct.filter((x) => x > 25).length,
      peakKm: Math.max(...W.map((w) => w.plannedKm)),
      fittedWeeks: W.filter((w) => w.fitted !== null && w.fitted !== undefined)
        .length,
      w1Under: w1.plannedKm + 0.1 < w1.targetKm,
      w1Target: w1.targetKm,
      peakCapKm: plan["peakCapKm"],
    },
    weeksJson: JSON.stringify(W.map((w) => w.days)),
  });
}
writeFileSync(`${dir}raw-${tag}.json`, JSON.stringify(rows));
console.log(
  `MAR ${tag}: ulaza ${rows.length}, ok ${rows.filter((r) => r["m"]).length}, odbijeno ${rows.filter((r) => r["rejected"]).length}, ${((Date.now() - t0) / 1000).toFixed(1)} s`,
);
