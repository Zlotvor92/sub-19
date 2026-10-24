/* Ugao 4 (jedan vlasnik), maraton v2 — slučajna pretraga REALNIH ulaza generatora (van mreža testInputs: bilo koji dan
   starta, bilo koji podskup dana, obim u koraku 0,5 km, VDOT 30–70 u koraku 0,1, rezultat 5/10/21,1/42,2 km, po
   osećaju 270–510 s/km, recentLongRunKm 5–42 u odnosu prema obimu). Validator i konstruktor dele veličine; svaka
   greška validatora (PLAN_VIOLATES_POLICY) na izvodljivom ulazu = dve definicije koje se razilaze.
   Takođe: nedelja 1 spuštena ispod trenutnog obima — čime je dugi ograničen (VOLUME_START, validate.ts:1284-1293,
   validator sam zaključuje razlog: dugi = 150 min ili plafon skoka; konstruktor fit10 spušta iz bilo kog razloga).
   Iz web/: node ../docs/generators-v2/audit/owner/mar-gen-search.ts <broj ulaza> [seed]   (podrazumevano 20000, 4004) */

import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import { longShareCap10, longTimeCap10, longJumpCap10 } from "../../../../web/src/domain/generators/marathon/v2/lengths.ts";
import { MARATHON_V2_POLICY as P, planRule } from "../../../../web/src/domain/generators/marathon/v2/policy.ts";
import { raceTimeForVdot } from "../../../../web/src/domain/generators/marathon/v2/paces.ts";
import { addDays } from "../../../../web/src/domain/generators/marathon/v2/dates.ts";
import type { MarathonV2Plan, Weekday } from "../../../../web/src/domain/generators/marathon/v2/types.ts";

const N = Number(process.argv[2] ?? 20000);
const SEED = Number(process.argv[3] ?? 4004);
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const WD: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function randomInput(): Record<string, unknown> {
  const beginner = rnd() < 0.25;
  const days = beginner ? ri(4, 5) : ri(3, 6);
  const rule = planRule(days, beginner ? "beginner" : "regular")!;
  const weeks = ri(rule.weeksMin, P.input.weeksMax);
  const km = Math.round((rule.kmMin + rnd() * (rule.kmMax - rule.kmMin)) * 2) / 2;
  const startDate = addDays("2026-11-02", ri(0, 13));
  const raceDate = addDays(startDate, weeks * 7 - 1);
  const runDays = [...WD].sort(() => rnd() - 0.5).slice(0, days);
  const longRunDay = rnd() < 0.5 ? pick(runDays) : null;
  const feel = rnd() < 0.3;
  const vdot = Math.round((30 + rnd() * ((beginner ? 45 : 70) - 30)) * 10) / 10;
  const dist = pick([5000, 10000, 21097.5, 42195]);
  const easy = beginner ? ri(330, 510) : ri(270, 510);
  // Skorašnji najduži u razumnom odnosu prema obimu: 0,15–0,5 × obim, unutar 5–42 km (pola ulaza bez njega).
  const rl = rnd() < 0.5 ? null : Math.max(5, Math.min(42, Math.round(km * (0.15 + rnd() * 0.35) * 10) / 10));
  return {
    startDate,
    raceDate,
    runDays,
    longRunDay,
    currentWeeklyKm: km,
    recentResult: feel ? null : { distanceM: dist, timeSec: Math.round(raceTimeForVdot(vdot, dist)), date: addDays(startDate, -ri(1, 80)) },
    goalTimeSec: rnd() < 0.5 ? null : Math.round(raceTimeForVdot(vdot + (rnd() * 4 - 1), 42195)),
    ...(rl !== null ? { recentLongRunKm: rl } : {}),
    ...(feel ? { easyPaceSecPerKm: easy } : {}),
    ...(beginner ? { experience: "beginner" } : {}),
  };
}

const isMain = process.argv[1]?.endsWith("mar-gen-search.ts");
if (isMain) {
  const t0 = Date.now();
  const codes: Record<string, number> = {};
  const viol: Record<string, { n: number; ex: number }> = {};
  const week1: Record<string, number> = {};
  let ok = 0;
  for (let i = 0; i < N; i++) {
    const inp = randomInput();
    const r = generateMarathonV2(inp);
    if (!r.ok) {
      for (const x of r.reasons) {
        codes[x.code] = (codes[x.code] ?? 0) + 1;
        if (x.code === "PLAN_VIOLATES_POLICY") {
          const k = x.message.split(":")[0]!;
          viol[k] ??= { n: 0, ex: i };
          viol[k].n++;
        }
      }
      continue;
    }
    ok++;
    const p = r.plan as MarathonV2Plan;
    const w = p.weeks[0]!;
    if (Math.round(w.targetKm * 10) < Math.round(p.input.currentWeeklyKm * 10)) {
      const rule = planRule(p.input.runDays.length, p.input.experience ?? "regular")!;
      const l = w.days.find((d) => d.role === "long");
      const l10 = l ? Math.round(l.workout.km * 10) : null;
      const why =
        l10 === null ? "bez dugog"
        : l10 === longTimeCap10(p.paces) ? "150 min"
        : l10 === longJumpCap10([], 1, p.input.recentLongRunKm) ? "plafon skoka"
        : l10 === longShareCap10(Math.round(w.targetKm * 10), rule) ? "udeo (validator ga ne priznaje)"
        : "drugo";
      week1[why] = (week1[why] ?? 0) + 1;
    }
  }
  console.log(JSON.stringify({ seed: SEED, inputs: N, ok, rejectCodes: codes, violations: viol, week1Below: week1, sec: (Date.now() - t0) / 1000 }, null, 1));
}
