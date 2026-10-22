/* Faza 4 pre-final (22. 10.), zadatak organizatora „ivice" — mreža lib.ts (all()) prema opsezima ulaza iz policy.ts.
   (1) Pokrivenost: po distanci i (iskustvo, broj dana): opseg mreže (km, nedelje, VDOT iz rezultata, lak tempo, dan trke,
       skorašnji najduži) prema opsegu politike → spisak NEPOKRIVENIH ivica.
   (2) Ivični ulazi (kombinacije ivica, ne pun proizvod): po (iskustvo, dani) km ∈ {min, max} × nedelje ∈ {min, max}
       × osnova ∈ {VDOT min, VDOT max (rezultat), lak tempo 270, 510 (po osećaju)} × trka {sub, ned}; HM/maraton i
       skorašnji najduži 5/42 km (km max, nedelje min). Ulaz je „nepokriven" kad bar jedna vrednost leži van opsega mreže.
       Odbijanje generatora = dokumentovano ograničenje ulaza (broji se po kodu, nije tok).
   (3) Tokovi: svih 17 scenarija (lib SCENARIOS; 'chain' + drugi korak) + rezultat do ivice VDOT opsega (edgeSlow =
       VDOT min, edgeFast = VDOT max; trka, datum asOf) na asOf start − 1, start, sreda ned 1, kraj ned 2, kraj ned ⌊N/2⌋.
   Iz web/: node ../docs/generators-v2/final-check/edges.ts <5K|10K|HM|MAR> > out.json (GEN_ONLY=1: samo generator) */

import { addDays, distOf, SCENARIOS, wedOf, weekdayOf, type Base, type Plan } from "./lib.ts";
import { flow, print, tally } from "./pre-lib.ts";
import { FIVE_K_V2_POLICY as P5 } from "../../../web/src/domain/generators/fiveK/v2/policy.ts";
import * as P10 from "../../../web/src/domain/generators/tenK/v2/policy.ts";
import * as PHM from "../../../web/src/domain/generators/halfMarathon/v2/policy.ts";
import * as PM from "../../../web/src/domain/generators/marathon/v2/policy.ts";
import * as V5 from "../../../web/src/domain/generators/fiveK/v2/paces.ts";
import * as V10 from "../../../web/src/domain/generators/tenK/v2/paces.ts";
import * as VHM from "../../../web/src/domain/generators/halfMarathon/v2/paces.ts";
import * as VM from "../../../web/src/domain/generators/marathon/v2/paces.ts";

const name = process.argv[2] as "5K" | "10K" | "HM" | "MAR";
const d = distOf(name);
const t0 = Date.now();
type Exp = "regular" | "beginner";
interface Rng { km: [number, number]; weeks: [number, number] }
const V = { "5K": V5, "10K": V10, HM: VHM, MAR: VM }[name];
const resM = name === "5K" ? 5000 : 10000;

/* ---------- opsezi politike ---------- */
const pol: Record<string, Rng> = {};
let vdotR: [number, number];
let easyR: [number, number];
let weeksMax: number;
if (name === "5K") {
  const days = (P5 as unknown as { days: Record<number, { weeklyKm: { min: number; max: number } }> }).days;
  weeksMax = P5.input.planWeeks.max;
  for (const c of [3, 4, 5]) pol[`regular/${c}`] = { km: [days[c]!.weeklyKm.min, days[c]!.weeklyKm.max], weeks: [P5.input.planWeeks.min, weeksMax] };
  for (const c of [3, 4]) pol[`beginner/${c}`] = { km: [days[c]!.weeklyKm.min, days[c]!.weeklyKm.max], weeks: [P5.input.planWeeks.min, weeksMax] };
  vdotR = [P5.input.vdot.min, P5.input.vdot.max];
  easyR = [P5.input.easyPaceSecPerKm.min, P5.input.easyPaceSecPerKm.max];
} else {
  const M = { "10K": P10, HM: PHM, MAR: PM }[name] as unknown as { planRule: (c: number, e: Exp) => { kmMin: number; kmMax: number; weeksMin: number } | null };
  const inp = ({ "10K": P10.TEN_K_V2_POLICY, HM: PHM.HM_V2_POLICY, MAR: PM.MARATHON_V2_POLICY }[name] as unknown as { input: { weeksMax: number; vdotMin: number; vdotMax: number } }).input;
  weeksMax = inp.weeksMax;
  for (const e of ["regular", "beginner"] as const)
    for (const c of [3, 4, 5, 6]) {
      const r = M.planRule(c, e);
      if (r) pol[`${e}/${c}`] = { km: [r.kmMin, r.kmMax], weeks: [r.weeksMin, weeksMax] };
    }
  vdotR = [inp.vdotMin, inp.vdotMax];
  easyR = [270, 510];
}

/* Organizator (22. 10.): ivice ulaza samo do STVARNOG trkača — VDOT 80 je svetska elita (maraton ≈ 2:08), početnik sa
   lakim tempom 4:30 ne postoji. Gornja ivica: iskusan VDOT ≤ 70, početnik VDOT ≤ 45 i lak tempo ≥ 330 s/km. Opseg politike
   ostaje u izveštaju pokrivenosti; tokovi se grade samo na realnim ivicama. */
const REAL = { vdotMaxRegular: 70, vdotMaxBeginner: 45, easyMinBeginner: 330 };
const vdotFor = (e: string): [number, number] => [vdotR[0], Math.min(vdotR[1], e === "beginner" ? REAL.vdotMaxBeginner : REAL.vdotMaxRegular)];
const easyFor = (e: string): [number, number] => [Math.max(easyR[0], e === "beginner" ? REAL.easyMinBeginner : easyR[0]), easyR[1]];

/* ---------- pokrivenost mreže ---------- */
const weeksOf = (i: Record<string, unknown>): number =>
  Math.round((Date.parse(i["raceDate"] as string) - Date.parse(i["startDate"] as string)) / 86_400_000 / 7 + 1 / 7);
const expOf = (i: Record<string, unknown>): Exp => (i["experience"] === "beginner" ? "beginner" : "regular");
const easyOf = (i: Record<string, unknown>): number | null => (i["easyPaceSecPerKm"] ?? i["typicalEasyPaceSecPerKm"] ?? null) as number | null;
const vdotOf = (i: Record<string, unknown>): number | null => {
  const r = i["recentResult"] as { distanceM: number; timeSec: number } | null | undefined;
  return r ? Math.round(V.vdotFromResult(r.distanceM, r.timeSec) * 10) / 10 : null;
};
type Cov = { n: number; km: [number, number]; weeks: [number, number]; vdot: [number, number]; easy: [number, number]; race: Set<string>; recentLong: [number, number] };
const cov: Record<string, Cov> = {};
const mm = (a: [number, number], v: number | null): void => {
  if (v === null) return;
  a[0] = Math.min(a[0], v);
  a[1] = Math.max(a[1], v);
};
const grid: Base[] = d.all();
for (const b of grid) {
  const i = b.input;
  const k = `${expOf(i)}/${(i["runDays"] as string[]).length}`;
  const c = (cov[k] ??= { n: 0, km: [1e9, -1e9], weeks: [1e9, -1e9], vdot: [1e9, -1e9], easy: [1e9, -1e9], race: new Set(), recentLong: [1e9, -1e9] });
  c.n++;
  mm(c.km, i["currentWeeklyKm"] as number);
  mm(c.weeks, weeksOf(i));
  mm(c.vdot, vdotOf(i));
  mm(c.easy, easyOf(i));
  c.race.add(weekdayOf(i["raceDate"] as string));
  mm(c.recentLong, (i["recentLongRunKm"] as number | undefined) ?? null);
}
const uncovered: string[] = [];
for (const [k, r] of Object.entries(pol)) {
  const c = cov[k];
  if (!c) {
    uncovered.push(`${k}: mreža nema nijedan ulaz`);
    continue;
  }
  if (c.km[0] > r.km[0]) uncovered.push(`${k}: km min ${r.km[0]} (mreža od ${c.km[0]})`);
  if (c.km[1] < r.km[1]) uncovered.push(`${k}: km max ${r.km[1]} (mreža do ${c.km[1]})`);
  if (c.weeks[0] > r.weeks[0]) uncovered.push(`${k}: nedelje min ${r.weeks[0]} (mreža od ${c.weeks[0]})`);
  if (c.weeks[1] < r.weeks[1]) uncovered.push(`${k}: nedelje max ${r.weeks[1]} (mreža do ${c.weeks[1]})`);
  if (c.vdot[0] > vdotR[0] + 0.5) uncovered.push(`${k}: VDOT min ${vdotR[0]} (mreža od ${c.vdot[0] === 1e9 ? "—" : c.vdot[0]})`);
  if (c.vdot[1] < vdotR[1] - 0.5) uncovered.push(`${k}: VDOT max ${vdotR[1]} (mreža do ${c.vdot[1] === -1e9 ? "—" : c.vdot[1]})`);
  if (c.easy[0] > easyR[0]) uncovered.push(`${k}: lak tempo min ${easyR[0]} (mreža od ${c.easy[0] === 1e9 ? "—" : c.easy[0]})`);
  if (c.easy[1] < easyR[1]) uncovered.push(`${k}: lak tempo max ${easyR[1]} (mreža do ${c.easy[1] === -1e9 ? "—" : c.easy[1]})`);
  for (const w of ["sat", "sun"]) if (!c.race.has(w)) uncovered.push(`${k}: trka ${w} (mreža nema)`);
  if (name === "HM" || name === "MAR") {
    if (c.recentLong[0] > 5) uncovered.push(`${k}: skorašnji najduži 5 km (mreža od ${c.recentLong[0] === 1e9 ? "—" : c.recentLong[0]})`);
    if (c.recentLong[1] < 42) uncovered.push(`${k}: skorašnji najduži 42 km (mreža do ${c.recentLong[1] === -1e9 ? "—" : c.recentLong[1]})`);
  }
}

/* ---------- ivični ulazi ---------- */
const DAYS: Record<number, string[]> = {
  3: ["tue", "thu", "sun"],
  4: ["tue", "thu", "sat", "sun"],
  5: ["mon", "tue", "thu", "sat", "sun"],
  6: ["mon", "tue", "wed", "thu", "sat", "sun"],
};
const RACE_SUN = "2027-03-07";
const edgeIn: { id: string; input: Record<string, unknown>; uncov: string[] }[] = [];
for (const [k, r] of Object.entries(pol)) {
  const [e, cs] = k.split("/") as [Exp, string];
  const c = Number(cs);
  const g = cov[k];
  for (const km of r.km)
    for (const weeks of r.weeks)
      for (const basis of ["vmin", "vmax", "e270", "e510"] as const)
        if (basis === "vmax" && vdotFor(e)[1] <= vdotR[0]) continue;
        else
        for (const rw of ["sat", "sun"] as const) {
          const race = rw === "sun" ? RACE_SUN : addDays(RACE_SUN, -1);
          const start = addDays(race, -7 * weeks + 1);
          const runDays = DAYS[c]!;
          const input: Record<string, unknown> = {
            startDate: start,
            raceDate: race,
            runDays,
            ...(name === "5K" ? {} : { longRunDay: "sun" }),
            currentWeeklyKm: km,
            goalTimeSec: null,
          };
          if (basis === "vmin" || basis === "vmax")
            input["recentResult"] = { distanceM: resM, timeSec: Math.round(V.raceTimeForVdot(basis === "vmin" ? vdotR[0] : vdotFor(e)[1], resM)), date: addDays(start, -14) };
          else if (name === "5K") input["typicalEasyPaceSecPerKm"] = basis === "e270" ? easyFor(e)[0] : 510;
          else {
            input["recentResult"] = null;
            input["easyPaceSecPerKm"] = basis === "e270" ? easyFor(e)[0] : 510;
          }
          if (e === "beginner") Object.assign(input, { experience: "beginner" }, name === "5K" ? { canRun30Min: true } : {});
          const un: string[] = [];
          if (!g || km < g.km[0] || km > g.km[1]) un.push(`km${km}`);
          if (!g || weeks < g.weeks[0] || weeks > g.weeks[1]) un.push(`w${weeks}`);
          if (basis === "vmin" && (!g || g.vdot[0] > vdotR[0] + 0.5)) un.push("vdotMin");
          if (basis === "vmax" && (!g || g.vdot[1] < vdotR[1] - 0.5)) un.push("vdotMax");
          if (basis === "e270" && (!g || g.easy[0] > 270)) un.push("e270");
          if (basis === "e510" && (!g || g.easy[1] < 510)) un.push("e510");
          if (!g || !g.race.has(rw)) un.push(`race-${rw}`);
          edgeIn.push({ id: `${k}/${km}km/${weeks}w/${basis}/${rw}`, input, uncov: un });
          if ((name === "HM" || name === "MAR") && km === r.km[1] && weeks === r.weeks[0] && basis === "vmax" && rw === "sun")
            for (const rl of [5, 42])
              edgeIn.push({ id: `${k}/${km}km/${weeks}w/${basis}/${rw}/rl${rl}`, input: { ...input, recentLongRunKm: rl }, uncov: [...un, `rl${rl}`] });
        }
}

/* ---------- tokovi ---------- */
const t = tally();
const genRej: Record<string, number> = {};
const genRejEx: Record<string, string[]> = {};
const uncovFlows = { flows: 0, rejected: 0 };
let plans = 0;
let plansUncovered = 0;
for (const x of edgeIn) {
  const g = d.generate(x.input);
  if (!g.ok) {
    for (const r of g.reasons) {
      genRej[r.code] = (genRej[r.code] ?? 0) + 1;
      const xs = (genRejEx[r.code] ??= []);
      if (xs.length < 30) xs.push(`${x.id}${x.uncov.length ? " [" + x.uncov.join(",") + "]" : ""}: ${r.message.slice(0, 160)}`);
    }
    continue;
  }
  plans++;
  if (x.uncov.length) plansUncovered++;
  if (process.env["GEN_ONLY"]) continue;
  const p = g.plan as Plan;
  const N = p.weeks.length;
  const ats: [string, string][] = [
    ["start-1", addDays(p.input.startDate, -1)],
    ["start", p.input.startDate],
    ["w1wed", wedOf(p.weeks[0]!.startDate)],
    ["w2end", p.weeks[1]!.endDate],
    [`w${Math.floor(N / 2)}end`, p.weeks[Math.floor(N / 2) - 1]!.endDate],
  ];
  for (const [tag, at] of ats) {
    const sets: [string, Record<string, unknown>][] = SCENARIOS.map((s) => [s, d.facts(p, s, at)]);
    for (const [s, v] of [["edgeSlow", vdotR[0]], ["edgeFast", vdotFor(x.id.split("/")[0]!)[1]]] as const)
      sets.push([s, { results: [{ distM: resM, sec: Math.round(V.raceTimeForVdot(v, resM)), date: at, kind: "race" }] }]);
    for (const [s, f] of sets) {
      const before = t.rejectedFlows;
      const k = `${x.id}${x.uncov.length ? " [" + x.uncov.join(",") + "]" : ""}/${tag} ${at}/${s}`;
      const p1 = flow(d, t, p, f, at, k, s);
      if (x.uncov.length) {
        uncovFlows.flows++;
        if (t.rejectedFlows > before) uncovFlows.rejected++;
      }
      if (p1 && s === "chain") {
        const at2 = addDays(at, 7);
        if (at2 < p.input.raceDate) flow(d, t, p1, d.chain2(p1, at2), at2, `${k}/chain2 ${at2}`, "chain2");
      }
    }
  }
}
const covOut = Object.fromEntries(Object.entries(cov).map(([k, c]) => [k, { ...c, race: [...c.race] }]));
print({ dist: name, policy: pol, vdot: vdotR, easy: easyR, gridCoverage: covOut, uncovered, edgeInputs: edgeIn.length, generatorRejected: genRej, generatorRejectedEx: genRejEx, plans, plansUncovered, uncoveredFlows: uncovFlows, ...t, seconds: (Date.now() - t0) / 1000 });
