/* Ugao 4 (jedan vlasnik), 5K v2 — dve definicije veličina obima posle adaptacije. SAMO ČITANJE (uvozi web/, ništa ne menja).
   Za svaki uspešan tok adapt(plan, činjenice, asOf) poredi:
   (a) vrh za taper/trkačku: validator `peakRefAt(N)` (validate.ts, prepisano doslovno) vs konstruktor `c.peakRefKm`
       (volume.adaptVolume preko generate.construct, isti ulaz kao adapt.ts);
   (b) taper: cilj ≠ fit(peakRefAt × faktor) tačno (validator ga pušta tolerancijom factorTolerance);
   (c) rasterećenje: cilj ≠ fit(osnova × 0,8) tačno, osnova = validator `lastBuildBefore` (prepisano);
   (d) „poslednja nedelja izgradnje": assess.ts lastBuild (assess:221) vs validator lastBuildBefore(n) na adaptiranom planu
       (ulaz sledećeg koraka); i da li se min(cilj n, lastBuild) razlikuje (uslov da odluka manjka/viška bude drugačija);
   (e) minimum nedelje: adaptiran cilj nedelje izgradnje u [days.minWeekKm, adaptFloorKm(∞)) (validator WEEK_MIN pušta,
       konstruktor ga ne bi trebalo da sastavi);
   (f) trkačka nedelja: lagan dan u (floor1(cap), cap] — cap konstruktora (week.ts, floor1) vs validatora (bez floor1).
   Tokovi: mreža lib.grid5k (svaki k-ti po porodici, pomak k/2), 17 scenarija × asOf (sreda ned 2, kraj ned 3, sreda ned ⌊N/2⌋,
   kraj ned N − 4, sreda ned N − 2), + drugi korak (chain2 lib, i scenario s2 po LCG seed 20261023) na asOf + 7.
   Iz web/: node ../docs/generators-v2/audit/owner/fiveK-volume-refs.ts <kR> <kF> <kB> */

import { DISTS, SCENARIOS, addDays, wedOf, type Plan as LPlan } from "../../final-check/lib.ts";
import { adaptFiveKV2 } from "../../../../web/src/domain/generators/fiveK/v2/adapt.ts";
import { assess, checkFacts, factKmOf } from "../../../../web/src/domain/generators/fiveK/v2/assess.ts";
import { mustDay } from "../../../../web/src/domain/generators/fiveK/v2/dates.ts";
import { construct } from "../../../../web/src/domain/generators/fiveK/v2/generate.ts";
import { periodize } from "../../../../web/src/domain/generators/fiveK/v2/periodize.ts";
import { FIVE_K_V2_POLICY as P, rulesOf } from "../../../../web/src/domain/generators/fiveK/v2/policy.ts";
import { athleteAt, baseAthlete, pacesAt } from "../../../../web/src/domain/generators/fiveK/v2/steps.ts";
import type { AdaptStep, FiveKV2Plan, PlanDay, PlanWeek } from "../../../../web/src/domain/generators/fiveK/v2/types.ts";
import {
  adaptFloorKm,
  capacityKm,
  fitTargetKm,
  pauseRemainderKm,
  planVolume,
  returnBaseKm,
} from "../../../../web/src/domain/generators/fiveK/v2/volume.ts";

const [kR, kF, kB] = process.argv.slice(2, 5).map(Number) as [number, number, number];
const SEED = 20261023;
let s = SEED;
const rnd = (): number => ((s = (s * 1103515245 + 12345) % 2147483648), s / 2147483648);
const EPS = 1e-6;
const d5 = DISTS.find((d) => d.name === "5K")!;
const isBuild = (w: { phase: string }): boolean => w.phase === "base" || w.phase === "peak" || w.phase === "sharpen";
const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;

/* ---- prepis validator formula (validate.ts 640–760) ---- */
function vref(plan: FiveKV2Plan) {
  const weeks = plan.weeks;
  const steps = plan.adaptation?.steps ?? [];
  const build = weeks.filter(isBuild);
  const resetKm = (i: number): number | null => {
    let x: number | null = null;
    for (const st of steps) if (st.startKm !== null && st.fromWeek === i) x = st.startKm;
    return x;
  };
  const anchorAt = (i: number, km: number): number | null => {
    let base: number | null = null;
    for (const st of steps)
      if (st.returnFrom && st.returnFrom.week === i) base = returnBaseKm(st.returnFrom.share, st.levelKm, km);
    return base;
  };
  const buildMax = (from: number): number => Math.max(...build.filter((w) => w.index >= from).map((w) => w.targetKm));
  const peakRefAt = (i: number): number => {
    let from = 1;
    let cap: number | null = null;
    let ref = buildMax(1);
    for (const st of steps) {
      if (st.firstWeek > i) break;
      const back = st.returnFrom ?? null;
      if (st.startKm !== null) {
        const fw = weeks[st.fromWeek - 1];
        if (fw && isBuild(fw)) {
          from = st.fromWeek;
          cap = null;
        } else cap = Math.min(ref, st.startKm);
      } else if (back && weeks[back.week] && isBuild(weeks[back.week]!)) {
        from = back.week + 1;
        cap = null;
      }
      ref = cap ?? buildMax(from);
    }
    return ref;
  };
  const lastBuildBefore = (i: number): number | null => {
    let x: number | null = null;
    for (const v of weeks.slice(0, i - 1)) {
      if (isBuild(v) && (!v.deload || resetKm(v.index) !== null)) x = v.targetKm;
      const base = anchorAt(v.index, v.targetKm);
      if (base !== null && isBuild(v)) x = base;
    }
    return x;
  };
  const pw = (w: PlanWeek) => pacesAt(plan.input, steps, w.index);
  const aw = (w: PlanWeek) => athleteAt(plan.input, steps, w.index);
  const fit = (w: PlanWeek, t: number): number => fitTargetKm(Math.round(t * 10) / 10, pw(w), aw(w));
  const a0 = baseAthlete(plan.input);
  const base0 = planVolume(
    periodize(plan.input.startDate, weeks.length, rulesOf(a0).deloadEvery, a0.feel),
    plan.input.currentWeeklyKm,
    pacesAt(plan.input, [], 1),
    a0,
  ).targets;
  const floored = (w: PlanWeek): boolean =>
    Math.abs(w.targetKm - fit(w, adaptFloorKm(base0[w.index - 1]!, aw(w), w.phase))) < EPS ||
    Math.abs(w.targetKm - fit(w, capacityKm(pw(w), aw(w)))) < EPS;
  const remainderOk = (w: PlanWeek): boolean =>
    steps.some((st) => {
      const km = st.firstWeek === w.index ? pauseRemainderKm(st, w, w.targetKm) : null;
      return km !== null && Math.abs(w.targetKm - fit(w, km)) < EPS;
    });
  return { peakRefAt, lastBuildBefore, fit, floored, remainderOk, resetKm };
}

/* ---- prepis assess.ts lastBuild (221) i n (215–218) ---- */
function assessLastBuild(plan: FiveKV2Plan, asOf: string): { n: number; lastBuild: number | null } {
  const weeks = plan.weeks;
  const N = weeks.length;
  const next = addDays(asOf, 1);
  const day = (d: string) => mustDay(d);
  const i = weeks.findIndex((w) => day(next) >= day(w.startDate) && day(next) <= day(w.endDate));
  const r = i >= 0 ? i + 1 : day(next) < day(weeks[0]!.startDate) ? 1 : N + 1;
  const n = r <= N && day(weeks[r - 1]!.startDate) < day(next) ? r + 1 : r;
  let lastBuild: number | null = null;
  for (const w of weeks) if (w.index < n && !w.deload && isBuild(w)) lastBuild = w.targetKm;
  return { n, lastBuild };
}

const cnt: Record<string, number> = {};
const ex: Record<string, string[]> = {};
const hit = (k: string, e: string): void => {
  cnt[k] = (cnt[k] ?? 0) + 1;
  const xs = (ex[k] ??= []);
  if (xs.length < 4) xs.push(e);
};
let flows = 0;
let okFlows = 0;
let plans = 0;

function check(before: FiveKV2Plan, facts: unknown, at: string, after: FiveKV2Plan, id: string): void {
  // (a) peakRefKm konstruktora: isti put kao adapt.ts (checkFacts → keep → construct).
  const ids = new Set(before.weeks.flatMap((w) => w.days.map((d) => d.date)));
  const cf = checkFacts(facts, at, ids);
  if (!cf.ok) return;
  const f = cf.facts;
  const t = mustDay(at);
  const done = new Set(f.workouts.filter((x) => x.completed).map((x) => x.dayId ?? x.date));
  const locked = new Set(f.lockedDayIds);
  const keep = (d: PlanDay): boolean => mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date);
  const steps = after.adaptation!.steps as AdaptStep[];
  const built = construct(after.input, steps, { weeks: before.weeks, keep, asOf: t, at, factKm: factKmOf(f, at) });
  const v = vref(after);
  const N = after.weeks.length;
  const mixed = new Set(after.adaptation?.mixedWeeks ?? []);
  if (built.ok) {
    const pv = v.peakRefAt(N);
    if (Math.abs(pv - built.c.peakRefKm) > EPS) hit("a_peakRef_validator≠konstruktor", `${id}: validator ${pv} vs konstruktor ${built.c.peakRefKm}`);
  } else hit("a_construct_odbijen", id);
  for (const w of after.weeks) {
    if (mixed.has(w.index)) continue;
    const adaptive = w.index >= steps[0]!.firstWeek;
    // (b) taper
    if (w.phase === "taper" && w.taperStep && adaptive) {
      const peak = v.peakRefAt(w.index);
      const want = v.fit(w, peak * P.volume.taperFactors[w.taperStep - 1]!);
      if (Math.abs(w.targetKm - want) > EPS && !v.floored(w)) {
        const fr = Math.abs(w.targetKm / peak - P.volume.taperFactors[w.taperStep - 1]!);
        hit(fr <= P.volume.factorTolerance ? "b_taper≠fit(vrh×f)_pod_tolerancijom" : "b_taper≠fit(vrh×f)_greška", `${id} ned ${w.index}: cilj ${w.targetKm} vs ${want} (vrh ${peak})`);
      }
    }
    // (c) rasterećenje
    if (w.deload && adaptive && isBuild(w)) {
      const prev = after.weeks.slice(0, w.index - 1).reverse().find((x) => !x.deload) ?? after.weeks[w.index - 2];
      if (!prev) continue;
      const prevKm = v.lastBuildBefore(w.index) ?? prev.targetKm;
      const want = v.fit(w, prevKm * P.volume.deloadFactor);
      if (Math.abs(w.targetKm - want) > EPS && !v.floored(w) && v.resetKm(w.index) === null && !v.remainderOk(w)) {
        const fr = Math.abs(w.targetKm / prevKm - P.volume.deloadFactor);
        hit(fr <= P.volume.factorTolerance ? "c_rasterećenje≠fit(osnova×0,8)_pod_tolerancijom" : "c_rasterećenje_greška", `${id} ned ${w.index}: cilj ${w.targetKm} vs ${want} (osnova ${prevKm})`);
      }
    }
    // (e) minimum nedelje
    if (isBuild(w) && adaptive) {
      const a = athleteAt(after.input, steps, w.index);
      const floorInf = adaptFloorKm(Infinity, a, w.phase);
      if (w.targetKm + EPS < floorInf && w.targetKm + EPS >= rulesOf(a).minWeekKm)
        hit("e_cilj_u_[minWeekKm,adaptFloor)", `${id} ned ${w.index}: ${w.targetKm} < ${floorInf}`);
    }
  }
  // (d) poslednja izgradnja za sledeći korak (asOf + 7 na adaptiranom planu)
  const at2 = addDays(at, 7);
  if (at2 < after.input.raceDate) {
    const { n, lastBuild: la } = assessLastBuild(after, at2);
    if (n <= N && isBuild(after.weeks[n - 1]!)) {
      const lv = v.lastBuildBefore(n);
      if (la !== lv) {
        hit("d_lastBuild_assess≠validator", `${id} (sledeći asOf ${at2}, n ${n}): assess ${la} vs validator ${lv}`);
        const tn = after.weeks[n - 1]!.targetKm;
        if (Math.min(tn, la ?? tn) !== Math.min(tn, lv ?? tn))
          hit("d_min(cilj_n,lastBuild)_različit", `${id} (asOf ${at2}, n ${n}): cilj n ${tn}, assess ${la}, validator ${lv}`);
      }
    }
  }
  // (f) trkačka nedelja
  const rw = after.weeks[N - 1]!;
  const prevLong = after.weeks[N - 2]?.days.find((d) => d.role === "long")?.workout.km ?? 0;
  const E = pacesAt(after.input, steps, N).E.slow;
  const raw = Math.max(P.easy.taperMinKm, Math.min(P.easy.raceWeekMaxSec / E, prevLong * P.easy.raceWeekMaxShareOfPrevLong));
  const cons = Math.max(P.easy.taperMinKm, floor1(Math.min(P.easy.raceWeekMaxSec / E, prevLong * P.easy.raceWeekMaxShareOfPrevLong)));
  if (raw - cons > EPS) cnt["f_cap_razlika_>0"] = (cnt["f_cap_razlika_>0"] ?? 0) + 1;
  for (const d of rw.days)
    if (d.role === "easy" && d.date > at && d.workout.km > cons + EPS && d.workout.km <= raw + EPS)
      hit("f_lagan_u_(cap_konstr,cap_valid]", `${id}: ${d.date} ${d.workout.km} km, cap ${cons}/${raw}`);
}

function run(before: FiveKV2Plan, facts: Record<string, unknown>, at: string, id: string): FiveKV2Plan | null {
  flows++;
  let r;
  try {
    r = adaptFiveKV2(before, facts, at);
  } catch (e) {
    hit("THROW", `${id}: ${String(e).slice(0, 80)}`);
    return null;
  }
  if (!r.ok) {
    hit("odbijen", `${id}: ${r.reasons.map((x) => x.code).join(",")}`);
    return null;
  }
  okFlows++;
  check(before, facts, at, r.plan as FiveKV2Plan, id);
  return r.plan as FiveKV2Plan;
}

const t0 = Date.now();
const all = d5.all();
const fam: Record<string, number> = { R: kR, F: kF, B: kB };
const bases = ["R", "F", "B"].flatMap((fm) => all.filter((b) => b.family === fm).filter((_, i) => i % fam[fm]! === Math.floor(fam[fm]! / 2)));
for (const b of bases) {
  const g = d5.generate(b.input);
  if (!g.ok) continue;
  plans++;
  const p = g.plan as unknown as FiveKV2Plan;
  const N = p.weeks.length;
  const asOfs: [string, string][] = [
    ["w2wed", wedOf(p.weeks[1]!.startDate)],
    ["w3end", p.weeks[2]!.endDate],
    [`w${Math.floor(N / 2)}wed`, wedOf(p.weeks[Math.floor(N / 2) - 1]!.startDate)],
    [`w${N - 4}end`, p.weeks[N - 5]!.endDate],
    [`w${N - 2}wed`, wedOf(p.weeks[N - 3]!.startDate)],
  ];
  for (const [tag, at] of asOfs)
    for (const sc of SCENARIOS) {
      const f1 = d5.facts(p as unknown as LPlan, sc, at);
      const id = `${b.id}/${tag}/${sc}`;
      const p1 = run(p, f1, at, id);
      if (!p1) continue;
      const at2 = addDays(at, 7);
      if (at2 >= p.input.raceDate) continue;
      const s2 = SCENARIOS[Math.floor(rnd() * SCENARIOS.length)]!;
      run(p1, d5.facts(p1 as unknown as LPlan, s2, at2), at2, `${id}→+7/${s2}`);
      if (sc === "chain") run(p1, d5.chain2(p1 as unknown as LPlan, at2), at2, `${id}→+7/chain2`);
    }
}
console.log(JSON.stringify({ seed: SEED, step: { R: kR, F: kF, B: kB }, bases: bases.length, plans, flows, okFlows, counts: cnt, examples: ex, seconds: (Date.now() - t0) / 1000 }, null, 1));
