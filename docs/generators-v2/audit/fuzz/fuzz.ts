/* Dubinska provera v2 — UGAO 2 (fuzz). SAMO ČITANJE: uvozi v2 foldere distanci, ništa ne menja.
   Nasumični DOZVOLJENI ulazi generatora (domen iz input.ts/policy.ts, REPORT.md), van mreža testInputs/adaptInputs.
   Svaki ulaz je ponovljiv iz (seed, indeks): rng = mulberry32(mix(seed, indeks)).
   Iz web/: node ../docs/generators-v2/audit/fuzz/fuzz.ts <5K|10K|HM|MAR> <seed> <od> <do> > out.json
            node ../docs/generators-v2/audit/fuzz/fuzz.ts <dist> <seed> <indeks> --show   (jedan ulaz + nalazi) */

import { DISTS, addDays, weekdayOf } from "../../final-check/lib.ts";
import { FIVE_K_V2_POLICY as P5, daysRule as daysRule5 } from "../../../../web/src/domain/generators/fiveK/v2/policy.ts";
import * as P10 from "../../../../web/src/domain/generators/tenK/v2/policy.ts";
import * as PHM from "../../../../web/src/domain/generators/halfMarathon/v2/policy.ts";
import * as PM from "../../../../web/src/domain/generators/marathon/v2/policy.ts";
import * as V5 from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";
import * as V10 from "../../../../web/src/domain/generators/tenK/v2/paces.ts";
import * as VHM from "../../../../web/src/domain/generators/halfMarathon/v2/paces.ts";
import * as VM from "../../../../web/src/domain/generators/marathon/v2/paces.ts";
import { validatePlan as val5 } from "../../../../web/src/domain/generators/fiveK/v2/validate.ts";
import { validatePlan as val10 } from "../../../../web/src/domain/generators/tenK/v2/validate.ts";
import { validatePlan as valHm } from "../../../../web/src/domain/generators/halfMarathon/v2/validate.ts";
import { validatePlan as valMar } from "../../../../web/src/domain/generators/marathon/v2/validate.ts";
import * as G10 from "../../../../web/src/domain/generators/tenK/v2/gridInvariants.ts";
import * as GHM from "../../../../web/src/domain/generators/halfMarathon/v2/gridInvariants.ts";

type Name = "5K" | "10K" | "HM" | "MAR";
type Exp = "regular" | "beginner";
const name = process.argv[2] as Name;
const SEED = Number(process.argv[3]);
const FROM = Number(process.argv[4]);
const SHOW = process.argv[5] === "--show";
const TO = SHOW ? FROM + 1 : Number(process.argv[5]);
const dist = DISTS.find((d) => d.name === name)!;

/* ---------- RNG ---------- */
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mix = (s: number, i: number): number => (Math.imul(s ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35)) | 0;

/* ---------- domen po distanci (izvor: input.ts / policy.ts; REPORT.md) ---------- */
const WD = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
interface Dom {
  days: Record<Exp, number[]>;
  km: (n: number, e: Exp) => [number, number];
  weeks: (e: Exp) => [number, number];
  vdot: [number, number];
  resDist: readonly number[];
  raceM: number;
  V: { raceTimeForVdot: (v: number, d: number) => number; vdotFromResult: (d: number, t: number) => number };
  longDay: boolean;
  recentLong: [number, number] | null;
  minWeek: (n: number) => number;
  validate: (p: unknown) => { rule: string; severity: string; message: string; week?: number }[];
}
const rule = (M: { planRule: (c: number, e: Exp) => { kmMin: number; kmMax: number; weeksMin: number } | null }, n: number, e: Exp) => M.planRule(n, e)!;
const D: Record<Name, Dom> = {
  "5K": {
    days: { regular: [3, 4, 5], beginner: [3, 4] },
    km: (n) => [daysRule5(n as 3).weeklyKm.min, daysRule5(n as 3).weeklyKm.max],
    weeks: () => [P5.input.planWeeks.min, P5.input.planWeeks.max],
    vdot: [P5.input.vdot.min, P5.input.vdot.max],
    resDist: P5.input.resultDistancesM,
    raceM: 5000,
    V: V5,
    longDay: false,
    recentLong: null,
    minWeek: (n) => (P5.days as Record<number, { minWeekKm: number }>)[n]!.minWeekKm,
    validate: (p) => val5(p as never),
  },
  "10K": {
    days: { regular: [3, 4, 5, 6], beginner: [3, 4] },
    km: (n, e) => [rule(P10 as never, n, e).kmMin, rule(P10 as never, n, e).kmMax],
    weeks: (e) => [e === "beginner" ? P10.TEN_K_V2_POLICY.beginner.weeksMin : P10.TEN_K_V2_POLICY.input.weeksMin, P10.TEN_K_V2_POLICY.input.weeksMax],
    vdot: [P10.TEN_K_V2_POLICY.input.vdotMin, P10.TEN_K_V2_POLICY.input.vdotMax],
    resDist: P10.TEN_K_V2_POLICY.input.resultDistancesM,
    raceM: 10000,
    V: V10,
    longDay: true,
    recentLong: null,
    minWeek: (n) => (P10.TEN_K_V2_POLICY.days as Record<number, { weekMinKm: number }>)[n]!.weekMinKm,
    validate: (p) => val10(p as never),
  },
  HM: {
    days: { regular: [3, 4, 5, 6], beginner: [4, 5] },
    km: (n, e) => [rule(PHM as never, n, e).kmMin, rule(PHM as never, n, e).kmMax],
    weeks: (e) => [e === "beginner" ? PHM.HM_V2_POLICY.beginner.weeksMin : PHM.HM_V2_POLICY.input.weeksMin, PHM.HM_V2_POLICY.input.weeksMax],
    vdot: [PHM.HM_V2_POLICY.input.vdotMin, PHM.HM_V2_POLICY.input.vdotMax],
    resDist: PHM.HM_V2_POLICY.input.resultDistancesM,
    raceM: 21097.5,
    V: VHM,
    longDay: true,
    recentLong: [PHM.HM_V2_POLICY.recentLong.minKm, PHM.HM_V2_POLICY.recentLong.maxKm],
    minWeek: (n) => (PHM.HM_V2_POLICY.days as Record<number, { weekMinKm: number }>)[n]!.weekMinKm,
    validate: (p) => valHm(p as never),
  },
  MAR: {
    days: { regular: [3, 4, 5, 6], beginner: [4, 5] },
    km: (n, e) => [rule(PM as never, n, e).kmMin, rule(PM as never, n, e).kmMax],
    weeks: (e) => [e === "beginner" ? PM.MARATHON_V2_POLICY.beginner.weeksMin : PM.MARATHON_V2_POLICY.input.weeksMin, PM.MARATHON_V2_POLICY.input.weeksMax],
    vdot: [PM.MARATHON_V2_POLICY.input.vdotMin, PM.MARATHON_V2_POLICY.input.vdotMax],
    resDist: PM.MARATHON_V2_POLICY.input.resultDistancesM,
    raceM: 42195,
    V: VM,
    longDay: true,
    recentLong: [PM.MARATHON_V2_POLICY.input.recentLongMinKm, PM.MARATHON_V2_POLICY.input.recentLongMaxKm],
    minWeek: (n) => (PM.MARATHON_V2_POLICY.days as Record<number, { weekMinKm: number }>)[n]!.weekMinKm,
    validate: (p) => valMar(p as never),
  },
};
const dom = D[name];

/* ---------- generator ulaza ---------- */
export interface Meta {
  exp: Exp;
  n: number;
  weeks: number;
  km: number;
  basis: "result" | "stale" | "lowVdot" | "feel" | "runWalk";
  vdot: number | null;
  easy: number | null;
  recentLong: number | null;
  real: boolean;
  why: string[];
}
const EPOCH = Date.parse("2026-10-24T00:00:00Z");
function makeInput(i: number): { input: Record<string, unknown>; meta: Meta } {
  const r = mulberry32(mix(SEED, i));
  const pick = <X>(xs: readonly X[]): X => xs[Math.floor(r() * xs.length)]!;
  const uni = (a: number, b: number): number => a + r() * (b - a);
  const int = (a: number, b: number): number => Math.floor(uni(a, b + 1));
  /** Vrednost u [a, b]: 30 % tačno na granici, inače ravnomerno (korak `step`). */
  const edgy = (a: number, b: number, step: number): number => {
    const u = r();
    if (u < 0.15) return a;
    if (u < 0.3) return b;
    return Math.round(uni(a, b) / step) * step;
  };
  const exp: Exp = r() < 0.25 ? "beginner" : "regular";
  const runWalk = name === "5K" && r() < 0.08;
  const n = runWalk ? 3 : pick(dom.days[exp]);
  // dani: nasumičan podskup veličine n (bilo koji dani); run/walk: 3 nesusedna dana (ciklično).
  let runDays: string[];
  if (runWalk) {
    const opts: string[][] = [];
    for (let a = 0; a < 7; a++) for (let b = a + 2; b < 7; b++) for (let c = b + 2; c < 7; c++) if (c - a <= 5) opts.push([WD[a]!, WD[b]!, WD[c]!]);
    runDays = pick(opts);
  } else {
    const xs = [...WD];
    for (let k = xs.length - 1; k > 0; k--) {
      const j = Math.floor(r() * (k + 1));
      [xs[k], xs[j]] = [xs[j]!, xs[k]!];
    }
    runDays = xs.slice(0, n);
  }
  const [w0, w1] = dom.weeks(exp);
  const weeks = r() < 0.3 ? pick([w0, w1]) : int(w0, w1);
  const startDate = new Date(EPOCH + int(0, 800) * 86_400_000).toISOString().slice(0, 10);
  const raceDate = addDays(startDate, weeks * 7 - 1);
  const [k0, k1] = runWalk ? [0, daysRule5(3).weeklyKm.max] : dom.km(n, exp);
  const km = edgy(k0, k1, r() < 0.5 ? 1 : 0.1);
  const input: Record<string, unknown> = { startDate, raceDate, runDays, currentWeeklyKm: Math.round(km * 10) / 10 };
  if (dom.longDay && r() < 0.7) input["longRunDay"] = pick(runDays);
  // osnova tempa
  const u = r();
  let basis: Meta["basis"];
  let vdot: number | null = null;
  let easy: number | null = null;
  const easyKey = name === "5K" ? "typicalEasyPaceSecPerKm" : "easyPaceSecPerKm";
  const resultOf = (v: number, age: number) => {
    const dM = pick(dom.resDist);
    return { distanceM: dM, timeSec: Math.round(dom.V.raceTimeForVdot(v, dM)), date: addDays(startDate, -age) };
  };
  if (runWalk) {
    basis = "runWalk";
    if (r() < 0.5) {
      easy = edgy(270, 510, 1);
      input[easyKey] = easy;
    }
  } else if (u < 0.55) {
    basis = "result";
    vdot = Math.round(edgy(dom.vdot[0], dom.vdot[1], 0.1) * 10) / 10;
    input["recentResult"] = resultOf(vdot, edgy(0, 84, 1));
  } else if (u < 0.65) {
    // rezultat stariji od 84 dana → plan po osećaju (rezultat samo informacija)
    basis = "stale";
    input["recentResult"] = resultOf(Math.round(uni(dom.vdot[0], 70) * 10) / 10, int(85, 365));
    easy = edgy(270, 510, 1);
    input[easyKey] = easy;
  } else if (u < 0.7 && name !== "5K") {
    // VDOT rezultata ispod vdotMin → plan po osećaju (10K/HM/MAR)
    basis = "lowVdot";
    input["recentResult"] = resultOf(Math.round(uni(25, dom.vdot[0] - 0.1) * 10) / 10, int(0, 84));
    easy = edgy(270, 510, 1);
    input[easyKey] = easy;
  } else {
    basis = "feel";
    if (name !== "5K") input["recentResult"] = null;
    easy = edgy(270, 510, 1);
    input[easyKey] = easy;
  }
  if (exp === "beginner") {
    input["experience"] = "beginner";
    if (name === "5K") input["canRun30Min"] = !runWalk;
  } else if (runWalk) input["canRun30Min"] = false;
  // cilj (opciono): oko trenutne forme
  if (r() < 0.3 && basis !== "runWalk") {
    const v0 = vdot ?? 40;
    input["goalTimeSec"] = Math.round(dom.V.raceTimeForVdot(Math.max(26, Math.min(84, v0 + uni(-3, 6))), dom.raceM));
  } else input["goalTimeSec"] = null;
  // skorašnji najduži (HM/MAR, opciono)
  let recentLong: number | null = null;
  if (dom.recentLong && r() < 0.45) {
    const [a, b] = dom.recentLong;
    recentLong =
      r() < 0.6
        ? Math.round(Math.max(a, Math.min(b, uni(km / n, Math.max(km / n, 0.6 * km)))) * 10) / 10
        : Math.round(edgy(a, b, 0.5) * 10) / 10;
    input["recentLongRunKm"] = recentLong;
  }
  // realan trkač (zajednička pravila): VDOT ≤ 70; početnik VDOT ≤ 45 i lagan ≥ 330 s/km; najduži skorašnji u odnosu
  // prema obimu i danima: prosečan trening (km/dani) ≤ najduži ≤ max(0,6 × km, 5 km) (prag ovog ugla, REPORT.md).
  const why: string[] = [];
  if (vdot !== null && vdot > 70) why.push("VDOT>70");
  if (exp === "beginner" && vdot !== null && vdot > 45) why.push("početnik VDOT>45");
  if (exp === "beginner" && easy !== null && easy < 330) why.push("početnik lagan<330");
  if (recentLong !== null && (recentLong + 1e-9 < km / n || recentLong > Math.max(0.6 * km, 5) + 1e-9)) why.push("najduži van odnosa sa obimom");
  return { input, meta: { exp, n, weeks, km: input["currentWeeklyKm"] as number, basis, vdot, easy, recentLong, real: why.length === 0, why } };
}

/* ---------- nezavisne provere plana ---------- */
interface Dy { date: string; weekday: string; role: string; hard?: boolean; countsToWeek: boolean; workout: { km: number; sec: number; kind: string; title: string; segments?: { kind: string; km?: number }[]; blocks?: unknown[]; qualityType?: string | null } }
interface Wk { index: number; phase: string; deload: boolean; startDate: string; endDate: string; targetKm: number; plannedKm: number; days: Dy[] }
const PHASES = new Set(["base", "development", "specific", "peak", "sharpen", "taper", "race"]);
/** 5K trčanje/hodanje: faza nedelje je 'runWalk' (types.ts RunWalkWeek). */
const PHASES_RW = new Set(["runWalk", "race"]);
const QL_WARN = new Set(["LONG_SHORTER_THAN_QUALITY", "QUALITY_OVER_LONG", "TWO_QUALITY_LONGER", "LONG_NOT_LONGEST"]);
const EPS = 1e-6;
function checks(p: { policyId?: string; policyVersion?: string; weeks: Wk[]; input: Record<string, unknown> }, m: Meta, isRunWalk: boolean, warn: Set<string>): string[] {
  const bad: string[] = [];
  const no = (c: string) => bad.push(c);
  const inp = p.input;
  if (!p.policyId || !p.policyVersion) no("B:BEZ_POLICY_ID");
  const start = inp["startDate"] as string;
  const race = inp["raceDate"] as string;
  if (p.weeks.length !== m.weeks) no("B:BROJ_NEDELJA");
  const seen = new Set<string>();
  let raceDays = 0;
  let lastDate = "";
  for (const [k, w] of p.weeks.entries()) {
    if (!w.phase || !(isRunWalk ? PHASES_RW : PHASES).has(w.phase)) no(`B:FAZA_NEDELJE:${w.phase}`);
    if (w.startDate !== addDays(start, 7 * k) || w.endDate !== addDays(start, 7 * k + 6)) no("B:GRANICE_NEDELJE");
    for (const d of w.days) {
      if (d.date < start || d.date > race) no("B:DAN_VAN_PLANA");
      if (d.date < w.startDate || d.date > w.endDate) no("B:DAN_VAN_NEDELJE");
      if (seen.has(d.date)) no("B:DUPLI_DAN");
      seen.add(d.date);
      if (d.date > lastDate) lastDate = d.date;
      if (d.role === "race") {
        raceDays++;
        if (d.date !== race) no("B:TRKA_NIJE_DAN_TRKE");
        continue;
      }
      if (!(inp["runDays"] as string[]).includes(weekdayOf(d.date))) no("B:DAN_VAN_RASPOREDA");
      if (isRunWalk) {
        const ss = (d as unknown as { session?: { totalSec?: number; activeSec?: number; title?: string } }).session;
        if (!ss || !(ss.totalSec! > 0) || !(ss.activeSec! > 0) || !ss.title) no("B:PRAZAN_TRENING");
        continue;
      }
      if (!(d.workout.km > 0) || !(d.workout.sec > 0) || !(d.workout.segments?.length || d.workout.blocks?.length)) no("B:PRAZAN_TRENING");
      if (d.workout.kind === "quality" && !isRunWalk) {
        const s = d.workout.segments ?? [];
        if (!s.some((x) => x.kind === "warmup") || !s.some((x) => x.kind === "cooldown")) no("B:KVALITET_BEZ_WU_CD");
      }
    }
    if (isRunWalk) continue;
    if (w.phase !== "race") {
      const minW = dom.minWeek(m.n);
      if (w.plannedKm + EPS < minW) no("B:NEDELJA_ISPOD_MINIMUMA");
      const long = w.days.find((d) => d.role === "long");
      if (!long) no("B:NEDELJA_BEZ_DUGOG");
      else {
        if (w.days.some((d) => d.role === "easy" && d.workout.km > long.workout.km + EPS)) no("B:DUGI<LAGAN");
        // Pouke 14/32/35: dugi najduži PO TRAJANJU u nedeljama izgradnje (taper/trkačka izuzeti); inače upozorenje.
        const q = w.days.filter((d) => d.workout.kind === "quality" || d.workout.kind === "test");
        const over = Math.max(0, ...q.map((d) => d.workout.sec - long.workout.sec));
        const kinds = [...new Set(q.filter((d) => d.workout.sec > long.workout.sec).map((d) => d.workout.kind))].sort().join("+");
        if (w.phase !== "taper" && over > 0)
          no(`${[...warn].some((x) => QL_WARN.has(x)) ? "i:KVALITET>DUGI_TRAJANJE_sa_upozorenjem" : "T:KVALITET>DUGI_TRAJANJE_bez_upozorenja"}@${kinds}@${w.phase}${w.deload ? "-rasterećenje" : ""}${over > 300 ? ">5min" : "≤5min"}`);
      }
    }
  }
  if (raceDays !== 1) no("B:BROJ_DANA_TRKE");
  if (lastDate !== race) no("B:TRKA_NIJE_POSLEDNJA");
  if (dom.longDay && inp["longRunDay"])
    for (const w of p.weeks) for (const d of w.days) if (d.role === "long" && weekdayOf(d.date) !== inp["longRunDay"]) { no("B:DUGI_NIJE_NA_DANU_DUGOG"); break; }
  if (!isRunWalk) {
    // T: nagli skok obima (> 25 % i > 4 km) prema poslednjoj nedelji izgradnje koja nije rasterećenje; ned 1 prema
    // trenutnom obimu (> 25 % i > 4 km).
    const w1 = p.weeks[0]!;
    if (w1.plannedKm > 1.25 * m.km + 4) no("T:SKOK_NED1");
    let ref: number | null = null;
    for (const w of p.weeks) {
      if (w.phase === "race" || w.phase === "taper") break;
      if (ref !== null && !w.deload && w.plannedKm > 1.25 * ref && w.plannedKm - ref > 4) no("T:SKOK_OBIMA");
      if (!w.deload) ref = w.plannedKm;
    }
    // T: dugi skače > 30 % i > 3 km prema najdužem dosadašnjem
    let L: number | null = m.recentLong;
    for (const w of p.weeks) {
      const l = w.days.find((d) => d.role === "long")?.workout.km;
      if (l === undefined) continue;
      if (L !== null && l > 1.3 * L && l - L > 3) no("T:SKOK_DUGOG");
      L = Math.max(L ?? 0, l);
    }
  }
  return [...new Set(bad)];
}

/* ---------- glavna petlja ---------- */
interface Ex { i: number; size: number; s: string }
const out = {
  dist: name, seed: SEED, from: FROM, to: TO,
  inputs: 0, plans: 0, realInputs: 0, realPlans: 0,
  rejected: {} as Record<string, number>, rejectedReal: {} as Record<string, number>, rejectedEx: {} as Record<string, Ex[]>,
  throws: {} as Record<string, number>, throwEx: {} as Record<string, Ex[]>,
  validatorErr: {} as Record<string, number>, validatorWarn: {} as Record<string, number>, validatorErrEx: {} as Record<string, Ex[]>,
  inv: {} as Record<string, { real: number; unreal: number }>, invEx: {} as Record<string, Ex[]>,
  find: {} as Record<string, { real: number; unreal: number }>, findEx: {} as Record<string, Ex[]>,
  basis: {} as Record<string, number>,
  warnings: {} as Record<string, number>,
  seconds: 0,
};
const ex = (o: Record<string, Ex[]>, k: string, e: Ex) => {
  const xs = (o[k] ??= []);
  xs.push(e);
  xs.sort((a, b) => a.size - b.size || a.i - b.i);
  if (xs.length > 3) xs.length = 3;
};
const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
const t0 = Date.now();
for (let i = FROM; i < TO; i++) {
  const { input, meta } = makeInput(i);
  out.inputs++;
  if (meta.real) out.realInputs++;
  inc(out.basis, meta.basis);
  const size = meta.weeks * 1000 + meta.km;
  const tag = `${meta.real ? "realan" : "nerealan(" + meta.why.join(",") + ")"} ${JSON.stringify(input)}`;
  let res;
  try {
    res = dist.generate(input);
  } catch (e) {
    const k = String(e).slice(0, 80);
    inc(out.throws, k);
    ex(out.throwEx, k, { i, size, s: tag });
    if (SHOW) console.log("THROW", e);
    continue;
  }
  if (!res.ok) {
    for (const x of res.reasons) {
      const vs = ((res as { violations?: { rule: string; severity: string }[] }).violations ?? []).filter((v) => v.severity === "error");
      const k = x.code === "PLAN_VIOLATES_POLICY" && vs.length ? `PLAN_VIOLATES_POLICY:${vs.map((v) => v.rule).join("+")}` : `${x.code}:${x.message.replace(/[0-9]+([.,][0-9]+)?/g, "#").slice(0, 60)}`;
      inc(out.rejected, k);
      if (meta.real) inc(out.rejectedReal, k);
      ex(out.rejectedEx, `${k}${meta.real ? "" : "~nerealan"}`, { i, size, s: `${tag} → ${x.message.slice(0, 300)}` });
    }
    if (SHOW) console.log(JSON.stringify({ input, meta, reasons: res.reasons }, null, 1));
    continue;
  }
  out.plans++;
  if (meta.real) out.realPlans++;
  const p = res.plan as never as { policyId?: string; policyVersion?: string; weeks: Wk[]; input: Record<string, unknown>; paceMode?: string };
  const isRunWalk = meta.basis === "runWalk";
  const found: string[] = [];
  // Upozorenja plana (plan.warnings, polje rule) i validatora (npr. LONG_SHORTER_THAN_QUALITY iz validate.ts).
  const warn = new Set(((p as { warnings?: { rule?: string; code?: string }[] }).warnings ?? []).map((x) => (x.rule ?? x.code)!));
  for (const v of dom.validate(p)) {
    if (v.severity === "error") {
      inc(out.validatorErr, v.rule);
      ex(out.validatorErrEx, v.rule, { i, size, s: `${tag} → ${v.message.slice(0, 200)}` });
      found.push(`B:VALIDATOR_ERR_${v.rule}`);
    } else {
      inc(out.validatorWarn, v.rule);
      warn.add(v.rule);
    }
  }
  for (const c of warn) inc(out.warnings, c);
  // postojeće invarijante distance (mreže; pretpostavke mreže mogu dati lažne prijave van mreže — proveriti ručno)
  const bad: Record<string, string[]> = {};
  try {
    // Mreže pretpostavljaju „po osećaju ⇔ recentResult === null"; plan po osećaju zbog starog rezultata ili VDOT < min
    // invarijante dobijaju kopiju sa recentResult = null (rezultat je tada samo informacija, input.ts).
    const pi = meta.basis === "stale" || meta.basis === "lowVdot" ? { ...(p as object), input: { ...p.input, recentResult: null } } : p;
    if (name === "10K") G10.checkPlan(`#${i}`, meta.n as never, pi as never, bad, G10.emptyStats());
    if (name === "HM") GHM.checkPlan(`#${i}`, pi as never, bad, GHM.emptyStats());
  } catch (e) {
    bad[`THROW_INV:${String(e).slice(0, 40)}`] = [String(e)];
  }
  for (const [k, msgs] of Object.entries(bad)) {
    const o = (out.inv[`${k}[${meta.basis}]`] ??= { real: 0, unreal: 0 });
    meta.real ? o.real++ : o.unreal++;
    ex(out.invEx, `${k}[${meta.basis}${meta.exp === "beginner" ? ",početnik" : ""}]${meta.real ? "" : "~nerealan"}`, { i, size, s: `${tag} → ${msgs.slice(0, 2).join(" | ").slice(0, 300)}` });
  }
  found.push(...checks(p, meta, isRunWalk, warn));
  for (const f of found) {
    const o = (out.find[f] ??= { real: 0, unreal: 0 });
    meta.real ? o.real++ : o.unreal++;
    ex(out.findEx, `${f}${meta.real ? "" : "~nerealan"}`, { i, size, s: tag });
  }
  if (SHOW) {
    console.log(JSON.stringify({ input, meta, found, inv: bad }, null, 1));
    for (const w of p.weeks)
      console.log(w.index, w.phase, w.deload ? "D" : " ", "cilj", w.targetKm, "plan", w.plannedKm, w.days.map((d) => `${d.date.slice(5)} ${d.role}:${d.workout?.km}${d.workout?.kind === "quality" ? "Q" : ""}`).join("  "));
  }
}
out.seconds = (Date.now() - t0) / 1000;
if (!SHOW) console.log(JSON.stringify(out, null, 1));
