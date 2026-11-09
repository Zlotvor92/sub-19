/* P0 — merna osnova trenerskih metrika (SAMO ČITANJE: uvozi v2 foldere distanci, ništa ne menja).
   Zajednički kod: ulazi mreže P0, imenovani profili, metrike M1–M8 po planu, uzrok doze vrha zone („šta drži dozu").
   Pokreće se iz web/ (npr. node ../docs/generators-v2/perfection/P0/measure.ts). */

import { addDays, distOf, type Plan } from "../../final-check/lib.ts";
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";

import { FIVE_K_V2_POLICY as P5 } from "../../../../web/src/domain/generators/fiveK/v2/policy.ts";
import * as W5 from "../../../../web/src/domain/generators/fiveK/v2/workouts.ts";
import { TEN_K_V2_POLICY as P10 } from "../../../../web/src/domain/generators/tenK/v2/policy.ts";
import * as Q10 from "../../../../web/src/domain/generators/tenK/v2/quality.ts";
import { HM_V2_POLICY as PHM } from "../../../../web/src/domain/generators/halfMarathon/v2/policy.ts";
import * as QHM from "../../../../web/src/domain/generators/halfMarathon/v2/quality.ts";
import * as WHM from "../../../../web/src/domain/generators/halfMarathon/v2/workouts.ts";
import { MARATHON_V2_POLICY as PM } from "../../../../web/src/domain/generators/marathon/v2/policy.ts";
import * as QM from "../../../../web/src/domain/generators/marathon/v2/quality.ts";
import * as WM from "../../../../web/src/domain/generators/marathon/v2/workouts.ts";

export type DName = "5K" | "10K" | "HM" | "MAR";
export const RACE_M: Record<DName, number> = { "5K": 5000, "10K": 10000, HM: 21097.5, MAR: 42195 };
export const START = "2026-11-02"; // ponedeljak, kao START mreža distanci
export const SCHED: Record<number, string[]> = {
  3: ["tue", "thu", "sun"],
  4: ["tue", "thu", "sat", "sun"],
  5: ["mon", "tue", "thu", "sat", "sun"],
  6: ["mon", "tue", "wed", "thu", "sat", "sun"],
};
/** Red tabele dana: [dno, vrh] obima; nedelje [najkraća, najduža] (policy.ts svake distance). */
export function table(d: DName): { days: number[]; km: Record<number, [number, number]>; weeks: [number, number];
  beg: { days: number[]; km: Record<number, [number, number]>; weeksMin: number } | null } {
  if (d === "5K") {
    const km: Record<number, [number, number]> = {};
    for (const n of [3, 4, 5]) { const r = P5.days[n as 3 | 4 | 5].weeklyKm; km[n] = [r.min, r.max]; }
    // 5K početnik: nema posebne tabele obima; uzimamo red dana 3/4 (lib.ts grid5k: početnik d ≤ 4, km ≤ 30, ≥ 8 ned).
    return { days: [3, 4, 5], km, weeks: [P5.input.planWeeks.min, P5.input.planWeeks.max],
      beg: { days: [3, 4], km: { 3: [12, 30], 4: [15, 30] }, weeksMin: 8 } };
  }
  const P = d === "10K" ? P10 : d === "HM" ? PHM : PM;
  const km: Record<number, [number, number]> = {};
  for (const n of [3, 4, 5, 6]) { const r = (P.days as Record<number, { kmMin: number; kmMax: number }>)[n]!; km[n] = [r.kmMin, r.kmMax]; }
  const bk: Record<number, [number, number]> = {};
  const bd = P.beginner.days as Record<number, { kmMin: number; kmMax: number }>;
  for (const n of Object.keys(bd)) bk[+n] = [bd[+n]!.kmMin, bd[+n]!.kmMax];
  return { days: [3, 4, 5, 6], km, weeks: [P.input.weeksMin, P.input.weeksMax],
    beg: { days: Object.keys(bd).map(Number), km: bk, weeksMin: P.beginner.weeksMin } };
}

export interface Case { id: string; family: "R" | "F" | "B"; days: number; band: "dno" | "sredina" | "vrh"; weeks: number; input: Record<string, unknown> }

function baseInput(d: DName, o: { weeks: number; km: number; days: number; vdot?: number; easy?: number; beg?: boolean }): Record<string, unknown> {
  const runDays = SCHED[o.days]!;
  const x: Record<string, unknown> = {
    startDate: START,
    raceDate: addDays(START, o.weeks * 7 - 1),
    runDays,
    currentWeeklyKm: o.km,
    goalTimeSec: null,
  };
  if (d !== "5K") x["longRunDay"] = "sun";
  const res = o.vdot !== undefined ? { distanceM: 10000, timeSec: timeForVdot(o.vdot, 10000), date: addDays(START, -14) } : null;
  if (d === "5K") {
    if (res) x["recentResult"] = res; else x["typicalEasyPaceSecPerKm"] = o.easy;
    if (o.beg) { x["experience"] = "beginner"; x["canRun30Min"] = true; }
  } else {
    x["recentResult"] = res;
    if (!res) x["easyPaceSecPerKm"] = o.easy;
    if (o.beg) x["experience"] = "beginner";
  }
  return x;
}

/** Mreža P0: dani × 3 obima (dno/sredina/vrh) × VDOT 35/45/55/65 × najkraća/srednja/najduža priprema;
    po osećaju (lagan 330/450 s/km) i početnik (lagan 420 s/km i VDOT 35) na užem skupu (dno/vrh × najkraća/najduža). */
export function grid(d: DName): Case[] {
  const t = table(d);
  const out: Case[] = [];
  const bands = (r: [number, number]): ["dno" | "sredina" | "vrh", number][] => [["dno", r[0]], ["sredina", Math.round((r[0] + r[1]) / 2)], ["vrh", r[1]]];
  const wk = [t.weeks[0], Math.round((t.weeks[0] + t.weeks[1]) / 2), t.weeks[1]];
  for (const days of t.days)
    for (const [band, km] of bands(t.km[days]!))
      for (const weeks of wk) {
        for (const vdot of [35, 45, 55, 65])
          out.push({ id: `R-d${days}-${km}km-${weeks}w-v${vdot}`, family: "R", days, band, weeks, input: baseInput(d, { weeks, km, days, vdot }) });
        if (band !== "sredina" && weeks !== wk[1])
          for (const easy of [330, 450])
            out.push({ id: `F-d${days}-${km}km-${weeks}w-e${easy}`, family: "F", days, band, weeks, input: baseInput(d, { weeks, km, days, easy }) });
      }
  if (t.beg)
    for (const days of t.beg.days)
      for (const [band, km] of bands(t.beg.km[days]!))
        for (const weeks of [Math.max(t.beg.weeksMin, t.weeks[0]), t.weeks[1]]) {
          if (band === "sredina") continue;
          out.push({ id: `B-d${days}-${km}km-${weeks}w-e420`, family: "B", days, band, weeks, input: baseInput(d, { weeks, km, days, easy: 420, beg: true }) });
          out.push({ id: `B-d${days}-${km}km-${weeks}w-v35`, family: "B", days, band, weeks, input: baseInput(d, { weeks, km, days, vdot: 35, beg: true }) });
        }
  return out;
}

/** Profil (a): 10 km 46:00, 40 km, 4 dana (uto/čet/sub/ned), 16 nedelja, skorašnji najduži 14 km; cilj HM 1:40,
    ostale distance cilj = prognoza generatora × 0,98 (prognoza iz istog ulaza bez cilja). */
export function profileA(d: DName): Record<string, unknown> {
  const x: Record<string, unknown> = {
    startDate: START, raceDate: addDays(START, 16 * 7 - 1), runDays: SCHED[4], currentWeeklyKm: 40,
    recentResult: { distanceM: 10000, timeSec: 2760, date: addDays(START, -14) }, goalTimeSec: null,
  };
  if (d !== "5K") x["longRunDay"] = "sun";
  if (d === "HM" || d === "MAR") x["recentLongRunKm"] = 14;
  if (d === "HM") return { ...x, goalTimeSec: 6000 };
  const r = distOf(d).generate(x);
  if (!r.ok) return x;
  const pk = ["predicted5kSec", "predicted10kSec", "predictedMarathonSec"].map((k) => r.plan[k]).find((v) => typeof v === "number") as number | undefined;
  return { ...x, goalTimeSec: pk ? Math.round(pk * 0.98) : null };
}
/** Profil (b) iz audit/coach-final/BRIEF.md: 5K 20:25, cilj < 20:00, 30 km, 4 dana, start 19. 10. 2026, trka 13. 12. 2026. */
export function profileB(d: DName): Record<string, unknown> {
  const x: Record<string, unknown> = {
    startDate: "2026-10-19", raceDate: "2026-12-13", runDays: SCHED[4], currentWeeklyKm: 30,
    recentResult: { distanceM: 5000, timeSec: 1225, date: "2026-10-12" }, goalTimeSec: d === "5K" ? 1199 : null,
  };
  if (d !== "5K") x["longRunDay"] = "sun";
  return x;
}

/* ---------------- metrike ---------------- */
type Seg = { kind: string; zone?: string; km: number; sec: number; paceSecPerKm?: number };
type AnyDay = Plan["weeks"][number]["days"][number] & { workout: Plan["weeks"][number]["days"][number]["workout"] & { segments?: Seg[]; dose?: Dose; blocks?: Record<string, unknown>[] } };
interface Dose { ladder: string; zone: string; doseM: number; structure: Record<string, unknown>; step: string }
const segs = (x: AnyDay): Seg[] => x.workout.segments ?? [];
const WORK = (s: Seg) => s.kind !== "recovery" && s.kind !== "warmup" && s.kind !== "cooldown" && s.kind !== "stride" && s.zone !== undefined && !["E", "jog", "walk"].includes(s.zone);
export const ZONES = ["T", "I", "R", "RP"] as const; // RP = MP za maraton
const zn = (z?: string) => (z === "MP" ? "RP" : z);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const isQ = (x: AnyDay) => x.workout.kind === "quality" && x.role !== "race";
const BUILD = (w: Plan["weeks"][number]) => !w.deload && w.phase !== "taper" && w.phase !== "race";

export interface Metrics {
  weeks: number;
  m1: Record<string, { firstWeek: number; firstMin: number; maxMin: number; maxWeek: number } | null>;
  m2: { first: number | null; atMax: number | null };
  m3: { maxKm: number; maxPct: number; totalKm: number; weeksWith: number };
  m4: { maxKm: number; maxMin: number; pct: number; withFast: number; plateau: number };
  m5: number;
  m6: { tests: number; weeksToRace: number; paceVariants: Record<string, number> };
  m7: Record<string, number>;
  m8: { peakOverStart: number; peakOverCurrent: number; longShareAtPeak: number };
  hold: Record<string, string>;
  repro: { checked: number; same: number; diff: string[] };
}

export function metrics(d: DName, plan: Plan): Metrics {
  const W = plan.weeks;
  const N = W.length;
  const days = (w: Plan["weeks"][number]) => w.days as AnyDay[];
  // M1
  const m1: Metrics["m1"] = {};
  for (const z of ZONES) {
    let first: { firstWeek: number; firstMin: number } | null = null;
    let max = 0, maxWeek = 0;
    for (const w of W) for (const x of days(w)) if (isQ(x)) {
      const sec = segs(x).filter((s) => WORK(s) && zn(s.zone) === z).reduce((a, s) => a + s.sec, 0);
      if (sec <= 0) continue;
      if (!first) first = { firstWeek: w.index, firstMin: r1(sec / 60) };
      if (sec > max) { max = sec; maxWeek = w.index; }
    }
    m1[z] = first ? { ...first, maxMin: r1(max / 60), maxWeek } : null;
  }
  // M2
  let firstShare: number | null = null, atMax: number | null = null, bestWork = 0;
  for (const w of W) for (const x of days(w)) if (isQ(x) && x.role !== "sharpener") {
    const work = segs(x).filter(WORK).reduce((a, s) => a + s.sec, 0);
    const share = x.workout.sec > 0 ? r2(work / x.workout.sec) : 0;
    if (firstShare === null) firstShare = share;
    if (work > bestWork) { bestWork = work; atMax = share; }
  }
  // M3
  let rpMax = 0, rpTot = 0; const rpWeeks = new Set<number>();
  for (const w of W) for (const x of days(w)) if (x.role !== "race") {
    const km = segs(x).filter((s) => WORK(s) && zn(s.zone) === "RP").reduce((a, s) => a + s.km, 0);
    if (km > 0) { rpTot += km; rpWeeks.add(w.index); rpMax = Math.max(rpMax, km); }
  }
  // M4
  let lMax = 0, lMin = 0, fast = 0, plateau = 0, run = 0, prev = -1;
  for (const w of W) {
    const L = days(w).find((x) => x.role === "long");
    if (!L) continue;
    if (L.workout.km > lMax) { lMax = L.workout.km; lMin = Math.round(L.workout.sec / 60); }
    if (segs(L).some((s) => s.zone && !["E", "jog", "walk"].includes(s.zone))) fast++;
    if (!BUILD(w)) continue;
    run = prev >= 0 && Math.abs(L.workout.km - prev) <= 0.1 + 1e-9 ? run + 1 : 1;
    prev = L.workout.km;
    plateau = Math.max(plateau, run);
  }
  // M5
  const race = W[N - 1]!.days.find((x) => x.role === "race")?.date ?? plan.input.raceDate;
  let strides = 0;
  for (const w of W) for (const x of days(w))
    if (x.role === "easy" && addDays(x.date, 1) !== race && segs(x).some((s) => s.kind === "stride")) strides++;
  // M6
  const testWeeks = W.filter((w) => w.test || w.days.some((x) => x.role === "test")).map((w) => w.index);
  const last = testWeeks.length ? Math.max(...testWeeks) : 0;
  const pv: Record<string, Set<number>> = {};
  for (const w of W) for (const x of days(w)) if (x.role !== "race")
    for (const s of segs(x)) if (WORK(s) && s.paceSecPerKm) (pv[zn(s.zone)!] ??= new Set()).add(s.paceSecPerKm);
  // M7
  const m7: Record<string, number> = {};
  const acc: Record<string, [number, number]> = {};
  for (const w of W) for (const x of days(w)) if (x.countsToWeek && x.role !== "race") {
    const a = (acc[w.phase] ??= [0, 0]);
    for (const s of segs(x)) { a[1] += s.km; if (s.zone && !["E", "jog", "walk"].includes(s.zone)) a[0] += s.km; }
  }
  for (const [ph, [f, t]] of Object.entries(acc)) m7[ph] = t > 0 ? Math.round((1000 * f) / t) / 10 : 0;
  // M8
  const peak = W.reduce((a, w) => (w.plannedKm > a.plannedKm ? w : a), W[0]!);
  const pL = days(peak).find((x) => x.role === "long");
  return {
    weeks: N,
    m1,
    m2: { first: firstShare, atMax },
    m3: { maxKm: r2(rpMax), maxPct: Math.round((1000 * rpMax * 1000) / RACE_M[d]) / 10, totalKm: r1(rpTot), weeksWith: rpWeeks.size },
    m4: { maxKm: r1(lMax), maxMin: lMin, pct: Math.round((1000 * lMax * 1000) / RACE_M[d]) / 10, withFast: fast, plateau },
    m5: strides,
    m6: { tests: testWeeks.length, weeksToRace: N - (last || 1) + (last ? 0 : 1), paceVariants: Object.fromEntries(Object.entries(pv).map(([k, v]) => [k, v.size])) },
    m7,
    m8: { peakOverStart: r2(peak.plannedKm / W[0]!.plannedKm), peakOverCurrent: r2(peak.plannedKm / plan.input.currentWeeklyKm), longShareAtPeak: pL ? r2(pL.workout.km / peak.plannedKm) : 0 },
    ...holdOf(d, plan),
  };
}

/* ---------------- šta drži dozu ---------------- */
/* Lestvice (10K, HM, MAR): za nedelju vrha zone (poslednja nedelja izgradnje sa najvećom dozom zone) — kontračinjenica
   „sledeći nivo" (quality.ts nextLevel) proverena redom: kraj lestvice → plafon udela zone (capM) → dan ≤ dugi (pouka 32;
   HM/MAR, procena: qualityDaySec sledećeg nivoa > trajanje dugog iste nedelje) → korak izbora nedelje vrha (step iz plana).
   Dokaz kopije: izvezena funkcija jezgra pickSlot sa stanjem slota rekonstruisanim iz plana (bez drugog člana pouke 32,
   allowDrop = false) mora da vrati istu strukturu kao plan; razlike se broje (repro). */
type Q = { pickSlot: (...a: never[]) => Dose | null; nextLevel: (l: string, d: number, b?: boolean) => Record<string, unknown> | null; capM: (z: string, t: number) => number };
const QL: Partial<Record<DName, Q>> = { "10K": Q10 as unknown as Q, HM: QHM as unknown as Q, MAR: QM as unknown as Q };
const ZONE_OF: Record<string, string> = { R: "R", I: "I", T_continuous: "T", T_cruise: "T", RP: "RP", MP: "RP" };

function holdOf(d: DName, plan: Plan): { hold: Record<string, string>; repro: Metrics["repro"] } {
  return d === "5K" ? hold5k(plan) : holdLadder(d, plan);
}

function holdLadder(d: DName, plan: Plan): { hold: Record<string, string>; repro: Metrics["repro"] } {
  const q = QL[d]!;
  const beginner = plan.input["experience"] === "beginner";
  const one = plan.input.runDays.length === 3 || beginner;
  const paces = plan["paces"] as never;
  const state: Record<string, { ladder: string; doseM: number; structure: Record<string, unknown> } | null> = { q1: null, q2: null };
  const repro = { checked: 0, same: 0, diff: [] as string[] };
  // per zone: poslednja nedelja izgradnje sa najvećom dozom
  const top: Record<string, { w: Plan["weeks"][number]; x: AnyDay; prev: typeof state.q1 } | undefined> = {};
  for (const w of plan.weeks) {
    if (!BUILD(w)) continue;
    for (const role of ["q1", "q2"]) {
      const x = (w.days as AnyDay[]).find((y) => y.role === role && y.workout.dose);
      if (!x) continue;
      const dose = x.workout.dose!;
      const prev = state[role]!;
      const call = q.pickSlot as unknown as (...a: unknown[]) => Dose | null;
      const free = call(prev, dose.ladder, w.targetKm, paces, false, role === "q1" && one, role === "q1" && beginner);
      repro.checked++;
      if (free && JSON.stringify(free.structure) === JSON.stringify(dose.structure)) repro.same++;
      else repro.diff.push(`${w.index}:${role}:${dose.step}:${free ? free.doseM : "null"}→${dose.doseM}`);
      const z = ZONE_OF[dose.ladder]!;
      const cur = top[z];
      if (!cur || dose.doseM >= cur.x.workout.dose!.doseM) top[z] = { w, x, prev };
      state[role] = { ladder: dose.ladder, doseM: dose.doseM, structure: dose.structure };
    }
  }
  const hold: Record<string, string> = {};
  for (const [z, t] of Object.entries(top)) {
    if (!t) continue;
    const dose = t.x.workout.dose!;
    const lb = t.x.role === "q1" && beginner;
    const next = q.nextLevel(dose.ladder, dose.doseM, lb);
    const cap = q.capM(ZONE_OF[dose.ladder] === "RP" ? (d === "MAR" ? "MP" : "RP") : ZONE_OF[dose.ladder]!, t.w.targetKm);
    if (!next) { hold[z] = "kraj lestvice"; continue; }
    const nDose = sumDose(next);
    if (nDose > cap) { hold[z] = "plafon udela zone"; continue; }
    if (d === "HM" || d === "MAR") {
      const L = (t.w.days as AnyDay[]).find((y) => y.role === "long");
      const segsQ = segs(t.x);
      const wc = { warmupSec: segsQ.filter((s) => s.kind === "warmup").reduce((a, s) => a + s.sec, 0), cooldownSec: segsQ.filter((s) => s.kind === "cooldown").reduce((a, s) => a + s.sec, 0) };
      const nd = { ladder: dose.ladder, zone: dose.zone, doseM: nDose, structure: next, step: "next" };
      const sec = (d === "HM" ? WHM.qualityDaySec : WM.qualityDaySec)(nd as never, paces, wc as never);
      if (L && sec > L.workout.sec) { hold[z] = "dan ≤ dugi (pouka 32)"; continue; }
    }
    hold[z] = dose.step === "next" ? "≤ 1 nivo nedeljno (faza se završila)"
      : dose.step === "start" ? "početni nivo 60 % (faza se završila)"
      : dose.step === "transition" ? "prelaz faze (faza se završila)"
      : dose.step === "drop" ? "pad doze (kapacitet / pouka 32)"
      : `drugo (${dose.step})`;
  }
  return { hold, repro };
}
function sumDose(s: Record<string, unknown>): number {
  // isto kao workouts.doseOf: continuous km×1000; reps reps×repM; piramida/stepenice: zbir deonica
  if (s["form"] === "continuous") return Math.round((s["km"] as number) * 1000);
  if (s["form"] === "reps") return (s["reps"] as number) * (s["repM"] as number);
  const reps = (s["repsM"] ?? s["steps"]) as number[] | undefined;
  return reps ? reps.reduce((a, b) => a + b, 0) : NaN;
}

/* 5K (trkač sa rezultatom, workouts.vdotWeekQuality): doza = ponavljanja u budžetu zone (udeo × cilj nedelje).
   Vrh zone R/I/RP: kontračinjenica chooseProgressiveReps (izvezena, jezgro) od izabrane doze — postoji veća u budžetu →
   „≤ 1 korak nedeljno (faza se završila)"; nema u budžetu, ima uz neograničen budžet → „plafon udela zone"; nema ni
   tada → „kraj ponude (maxReps / trajanje ponavljanja)". T: +tStepKm kontinuirano prema budžetu T i plafonu trajanja
   T bloka faze (tContinuousMaxSec). Po osećaju i početnik (feel.ts) — nije instrumentisano. Dokaz kopije: I i RP
   nedelje vrhunca/oštrenja iz prethodne nedelje iste faze ('strict', peakMainMinShare pa mainMinShareOfBudget). */
function hold5k(plan: Plan): { hold: Record<string, string>; repro: Metrics["repro"] } {
  const repro = { checked: 0, same: 0, diff: [] as string[] };
  const hold: Record<string, string> = {};
  if (plan["paceMode"] === "feel" || plan.vdot === null) return { hold: { _: "nije instrumentisano (po osećaju)" }, repro };
  if (plan.input["experience"] === "beginner") return { hold: { _: "nije instrumentisano (početnik)" }, repro };
  const q = P5.quality;
  const p = plan["paces"] as { T: number; I: number; R: number; RP: number };
  const repOf = (x: AnyDay, zone: string): { reps: number; repKm: number; form?: string } | null => {
    const b = (x.workout.blocks ?? []).find((b) => (b["zone"] === zone) && (b["kind"] === "reps" || b["kind"] === "continuous"));
    if (!b) return null;
    if (b["kind"] === "continuous") return { reps: 1, repKm: b["km"] as number, form: "continuous" };
    return { reps: b["reps"] as number, repKm: (b["rep"] as { km: number }).km, form: "reps" };
  };
  const top: Record<string, { w: Plan["weeks"][number]; c: { reps: number; repKm: number; form?: string } } | undefined> = {};
  let prevMain: { phase: string; c: { reps: number; repKm: number } } | null = null;
  for (const w of plan.weeks) {
    if (!BUILD(w)) continue;
    for (const x of w.days as AnyDay[]) {
      if (!isQ(x) || x.role === "test") continue;
      for (const z of ["R", "I", "RP", "T"]) {
        const c = repOf(x, z);
        if (!c) continue;
        const work = c.reps * c.repKm;
        const cur = top[z];
        if (!cur || work >= cur.c.reps * cur.c.repKm - 1e-9) top[z] = { w, c };
        if ((z === "I" && w.phase === "peak") || (z === "RP" && w.phase === "sharpen")) {
          if (prevMain && prevMain.phase === w.phase) {
            const b = W5.qualityBudgets(w.targetKm).I;
            const isI = z === "I";
            const args = [b, isI ? q.repOptionsKm.I : q.repOptionsKm.RP, isI ? p.I : p.RP, isI ? q.minReps.I : q.minReps.RP, isI ? q.maxReps.I : q.maxReps.RP, q.iRepMaxSec, isI ? q.iRepMinSec : 0] as const;
            const ch = W5.chooseProgressiveReps(...args, q.peakMainMinShare, prevMain.c, "strict") ?? W5.chooseProgressiveReps(...args, q.mainMinShareOfBudget, prevMain.c, "strict");
            repro.checked++;
            if (ch && ch.reps === c.reps && Math.abs(ch.repKm - c.repKm) < 1e-9) repro.same++;
            else repro.diff.push(`${w.index}:${z}:${ch ? ch.reps + "x" + ch.repKm : "null(alt/held)"}→${c.reps}x${c.repKm}`);
          }
          prevMain = { phase: w.phase, c };
        }
      }
    }
  }
  for (const [z, t] of Object.entries(top)) {
    if (!t) continue;
    const B = W5.qualityBudgets(t.w.targetKm);
    if (z === "T") {
      const capKm = Math.floor((W5.tMaxSec(t.w.phase as never) / p.T) * 2) / 2;
      const budKm = Math.floor(B.T * 2) / 2;
      if (t.c.form === "continuous") {
        const nl = t.c.repKm + q.tStepKm;
        hold[z] = nl > budKm + 1e-9 ? "plafon udela zone" : nl > capKm + 1e-9 ? "plafon trajanja T bloka faze" : "korak +0,5 km nedeljno / izbor faze";
      } else {
        const g = W5.chooseProgressiveReps(B.T, q.repOptionsKm.Tcruise, p.T, q.minReps.T, q.maxReps.T, W5.tMaxSec(t.w.phase as never), 0, 0, t.c, "grow");
        const gi = W5.chooseProgressiveReps(1e6, q.repOptionsKm.Tcruise, p.T, q.minReps.T, q.maxReps.T, W5.tMaxSec(t.w.phase as never), 0, 0, t.c, "grow");
        hold[z] = g ? "≤ 1 korak nedeljno (faza se završila)" : gi ? "plafon udela zone" : "kraj ponude (maxReps / trajanje ponavljanja)";
      }
      continue;
    }
    const bud = z === "R" ? B.R : B.I;
    const opts = z === "R" ? q.repOptionsKm.R : z === "I" ? q.repOptionsKm.I : q.repOptionsKm.RP;
    const pace = z === "R" ? p.R : z === "I" ? p.I : p.RP;
    const minR = z === "R" ? q.minReps.R : z === "I" ? q.minReps.I : q.minReps.RP;
    const maxR = z === "R" ? q.maxReps.R : z === "I" ? q.maxReps.I : q.maxReps.RP;
    const maxS = z === "R" ? q.rRepMaxSec : q.iRepMaxSec;
    const minS = z === "I" ? q.iRepMinSec : 0;
    const mode = z === "R" ? "grow" : "strict";
    const g = W5.chooseProgressiveReps(bud, opts, pace, minR, maxR, maxS, minS, 0, t.c, mode);
    const gi = W5.chooseProgressiveReps(1e6, opts, pace, minR, maxR, maxS, minS, 0, t.c, mode);
    hold[z] = g ? "≤ 1 korak nedeljno (faza se završila)" : gi ? "plafon udela zone" : "kraj ponude (maxReps / trajanje ponavljanja)";
  }
  return { hold, repro };
}

/* ---------------- ispis plana po nedelji ---------------- */
export function weekly(plan: Plan): string {
  const out: string[] = [];
  out.push(`policy ${plan["policyId"]} ${plan["policyVersion"]}; vdot ${plan.vdot}; nedelja ${plan.weeks.length}`);
  for (const w of plan.weeks) {
    out.push(`\nned ${w.index} ${w.startDate}…${w.endDate} faza ${w.phase}${w.deload ? " RASTEREĆENJE" : ""}${w.test ? " TEST" : ""} — cilj ${w.targetKm} / plan ${w.plannedKm} km`);
    for (const x of w.days as AnyDay[]) {
      const work = segs(x).filter(WORK);
      const wm = work.reduce((a, s) => a + s.sec, 0) / 60;
      const st = x.workout.dose ? ` [doza ${x.workout.dose.ladder} ${x.workout.dose.doseM} m, korak ${x.workout.dose.step}]` : "";
      out.push(`  ${x.date} ${x.role.padEnd(9)} ${x.workout.km.toFixed(2)} km ${Math.round(x.workout.sec / 60)} min${wm > 0 ? `, rad ${wm.toFixed(1)} min` : ""}${segs(x).some((s) => s.kind === "stride") ? ", ubrzanja" : ""} — ${x.workout.title}${st}`);
    }
    for (const n of w.notes) out.push(`  napomena: ${n}`);
  }
  for (const v of plan.warnings) out.push(`upozorenje ${v.code}: ${v.message}`);
  return out.join("\n");
}
