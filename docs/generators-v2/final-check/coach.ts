/* Faza 4a, zadatak 1 — trenersko čitanje HM v2 i maraton v2: 12 planova generatora (3/4/5/6 d; mali i veliki obim;
   spor i brz; po osećaju; početnik; kratka i duga priprema) i 6 adaptiranih (bol 5 usred izgradnje, pauza 20,
   pauza 35 nov start, umor pre starta, brži rezultat, lanac 2 adaptacije) po distanci.
   Izlaz: markdown tabele nedelja (faza, cilj/planirano, dugi, kvalitet sa dozom, napomene) + automatske zastavice
   (skok dugog/cilja, ista doza zaredom, lagan blizu dugog, dan kvaliteta duži od dugog) za ručno čitanje.
   Iz korena repoa: node docs/generators-v2/final-check/coach.ts <HM|MAR> > coach-<dist>.md */

import * as AHM from "../../../web/src/domain/generators/halfMarathon/v2/adaptInputs.ts";
import * as THM from "../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import * as TM from "../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import { addDays, distOf, wedOf, type Plan, type Week } from "./lib.ts";

const name = process.argv[2] as "HM" | "MAR";
const d = distOf(name);
const hm = name === "HM";
type P = Record<string, unknown>;
const S4 = THM.SCHEDULES_BY_DAYS;
const SM = TM.SCHEDULES_BY_DAYS;
const sch = (n: 3 | 4 | 5 | 6) => (hm ? S4[n].A : SM[n].A);
const inp = (o: { weeks: number; km: number; days: 3 | 4 | 5 | 6; vdot?: number; easy?: number; beg?: boolean; goal?: number }): P => {
  const s = sch(o.days);
  return hm
    ? THM.inputOf({ weeks: o.weeks, km: o.km, vdot: o.vdot, days: s.days, long: s.long, easyPaceSecPerKm: o.easy, beginner: o.beg, goalTimeSec: o.goal })
    : TM.inputOf({ weeks: o.weeks, km: o.km, vdot: o.vdot, days: s.days, long: s.long, easyPace: o.easy, experience: o.beg ? "beginner" : undefined, goalTimeSec: o.goal });
};
// 12 profila (obim i nedelje u opsegu H1/H15/H17 odn. M1/M15/M17).
const PROFILES: [string, P][] = hm
  ? [
      ["3d-mali-v40-14w", inp({ weeks: 14, km: 25, days: 3, vdot: 40 })],
      ["3d-veliki-v50-16w", inp({ weeks: 16, km: 45, days: 3, vdot: 50 })],
      ["4d-mali-spor-v32-14w", inp({ weeks: 14, km: 30, days: 4, vdot: 32 })],
      ["4d-veliki-brz-v62-16w", inp({ weeks: 16, km: 60, days: 4, vdot: 62 })],
      ["5d-srednji-v48-16w", inp({ weeks: 16, km: 50, days: 5, vdot: 48 })],
      ["6d-veliki-brz-v68-18w", inp({ weeks: 18, km: 85, days: 6, vdot: 68 })],
      ["6d-mali-spor-v35-14w", inp({ weeks: 14, km: 40, days: 6, vdot: 35 })],
      ["4d-osecaj-e360-14w", inp({ weeks: 14, km: 40, days: 4, easy: 360 })],
      ["5d-osecaj-spor-e480-16w", inp({ weeks: 16, km: 35, days: 5, easy: 480 })],
      ["pocetnik-4d-e420-16w", inp({ weeks: 16, km: 25, days: 4, easy: 420, beg: true })],
      ["kratka-4d-v45-10w", inp({ weeks: 10, km: 40, days: 4, vdot: 45 })],
      ["duga-5d-v45-20w", inp({ weeks: 20, km: 45, days: 5, vdot: 45 })],
    ]
  : [
      ["3d-mali-v40-16w", inp({ weeks: 16, km: 30, days: 3, vdot: 40 })],
      ["3d-veliki-v50-18w", inp({ weeks: 18, km: 50, days: 3, vdot: 50 })],
      ["4d-mali-spor-v32-18w", inp({ weeks: 18, km: 35, days: 4, vdot: 32 })],
      ["4d-veliki-brz-v62-18w", inp({ weeks: 18, km: 65, days: 4, vdot: 62 })],
      ["5d-srednji-v48-18w", inp({ weeks: 18, km: 60, days: 5, vdot: 48 })],
      ["6d-veliki-brz-v68-20w", inp({ weeks: 20, km: 100, days: 6, vdot: 68 })],
      ["6d-mali-spor-v35-16w", inp({ weeks: 16, km: 50, days: 6, vdot: 35 })],
      ["4d-osecaj-e360-16w", inp({ weeks: 16, km: 45, days: 4, easy: 360 })],
      ["5d-osecaj-spor-e480-18w", inp({ weeks: 18, km: 40, days: 5, easy: 480 })],
      ["pocetnik-4d-e420-20w", inp({ weeks: 20, km: 30, days: 4, easy: 420, beg: true })],
      ["kratka-4d-v45-12w", inp({ weeks: 12, km: 45, days: 4, vdot: 45 })],
      ["duga-5d-v45-24w", inp({ weeks: 24, km: 55, days: 5, vdot: 45 })],
    ];

const f1 = (x: number) => (Math.round(x * 10) / 10).toString().replace(".", ",");
const qOf = (w: Week) =>
  w.days
    .filter((x) => ["q1", "q2", "test", "sharpener"].includes(x.role))
    .map((x) => x.workout.title.replace(/\s+/g, " "))
    .join(" + ") || "—";
const longOf = (w: Week) => w.days.find((x) => x.role === "long");
function table(p: Plan, asOf?: string): string {
  const rows = ["| ned | faza | cilj / plan | dugi | najduži lagan | kvalitet | napomene |", "|---|---|---|---|---|---|---|"];
  for (const w of p.weeks) {
    const L = longOf(w);
    const easy = Math.max(0, ...w.days.filter((x) => x.role === "easy").map((x) => x.workout.km));
    const ph = `${w.phase}${w.deload ? " R" : ""}${w.test ? " test" : ""}`;
    const mark = asOf && w.endDate <= asOf ? "·" : "";
    const notes = w.notes.map((n) => n.slice(0, 90)).join(" / ");
    rows.push(`| ${w.index}${mark} | ${ph} | ${f1(w.targetKm)} / ${f1(w.plannedKm)} | ${L ? f1(L.workout.km) : "—"} | ${easy ? f1(easy) : "—"} | ${qOf(w)} | ${notes.slice(0, 200)} |`);
  }
  return rows.join("\n");
}
/** Automatske zastavice za trenersko čitanje (budući deo plana kad je dat asOf). */
function flags(p: Plan, asOf = "0000-00-00"): string[] {
  const out: string[] = [];
  let prevLong = 0;
  let prevQ = "";
  let prevTarget = 0;
  for (const w of p.weeks) {
    const L = longOf(w);
    const fut = w.startDate > asOf;
    if (fut && L && prevLong > 0 && L.workout.km > Math.max(prevLong * 1.25, prevLong + 3)) out.push(`ned ${w.index}: skok dugog ${f1(prevLong)} → ${f1(L.workout.km)} km`);
    if (fut && prevTarget > 0 && !w.deload && w.phase !== "taper" && w.phase !== "race" && w.targetKm > prevTarget * 1.12 && w.targetKm - prevTarget > 3)
      out.push(`ned ${w.index}: skok cilja ${f1(prevTarget)} → ${f1(w.targetKm)} km`);
    const q = qOf(w);
    if (fut && !w.deload && ["base", "development", "specific"].includes(w.phase) && q === prevQ && q !== "—") out.push(`ned ${w.index}: isti kvalitet kao prethodne (${q})`);
    if (fut && L) {
      for (const x of w.days.filter((y) => y.role === "easy")) if (x.workout.km > 0.9 * L.workout.km) { out.push(`ned ${w.index}: lagan ${f1(x.workout.km)} ≈ dugi ${f1(L.workout.km)}`); break; }
      for (const x of w.days.filter((y) => y.role === "q1" || y.role === "q2")) if (x.workout.sec > L.workout.sec) out.push(`ned ${w.index}: ${x.role} ${Math.round(x.workout.sec / 60)} min > dugi ${Math.round(L.workout.sec / 60)} min`);
    }
    if (L) prevLong = w.deload || w.phase === "taper" ? prevLong : L.workout.km;
    prevQ = w.deload ? prevQ : q;
    prevTarget = w.deload ? prevTarget : w.targetKm;
  }
  return out;
}
const warn = (p: Plan) => [...new Set(p.warnings.map((v) => `${(v as { rule?: string }).rule ?? v.code}`))].join(", ") || "—";

const md: string[] = [`# Trenersko čitanje — ${name} v2 (zadatak 1, skripta coach.ts)`, ""];
const plans: Record<string, Plan> = {};
for (const [id, input] of PROFILES) {
  const g = d.generate(input);
  md.push(`## ${id}`, "");
  if (!g.ok) {
    md.push(`ODBIJEN: ${g.reasons.map((r) => `${r.code}: ${r.message}`).join(" | ")}`, "");
    continue;
  }
  plans[id] = g.plan;
  const vol = g.plan.weeks.map((w) => w.targetKm);
  md.push(`vdot ${g.plan.vdot ?? "—"} · start ${input["currentWeeklyKm"]} km · vrh ${f1(Math.max(...vol))} km · upozorenja: ${warn(g.plan)}`, "", table(g.plan), "");
  const fl = flags(g.plan);
  md.push(`Zastavice: ${fl.length ? fl.join("; ") : "—"}`, "");
}
// 6 adaptiranih: bazni plan 4 d srednji (rezultat).
const baseIn = hm ? inp({ weeks: 16, km: 40, days: 4, vdot: 45, goal: 6000 }) : inp({ weeks: 18, km: 50, days: 4, vdot: 45, goal: 12600 });
const g0 = d.generate(baseIn);
if (!g0.ok) throw new Error("bazni plan");
const p0 = g0.plan;
const N = p0.weeks.length;
const buildMid = p0.weeks.find((w) => w.phase === "development" && !w.deload)!.index;
const end = (i: number) => p0.weeks[i - 1]!.endDate;
const facts = (s: string, at: string) => (hm ? AHM.factsOf(p0 as never, s as never, at) : TM.factsOf(p0 as never, s as never, at));
const cases: [string, string, P][] = [
  [`bol 5 usred izgradnje (sreda ned ${buildMid})`, wedOf(p0.weeks[buildMid - 1]!.startDate), {}],
  [`pauza 20 (kraj ned ${Math.ceil(N / 2)})`, end(Math.ceil(N / 2)), {}],
  [`pauza 35 — nov start (kraj ned ${Math.ceil(N / 3) + 2})`, end(Math.ceil(N / 3) + 2), {}],
  ["umor pre starta (start − 3)", addDays(p0.input.startDate, -3), {}],
  [`brži rezultat +2 VDOT (kraj ned ${Math.ceil(N / 2) - 1})`, end(Math.ceil(N / 2) - 1), {}],
  [`lanac: pauza 10 (kraj ned 4) + manjak 50 % (kraj ned 5)`, end(4), {}],
];
const scen = ["pain5", "pause20", "pause35", "fatigue", "faster", "chain"];
md.push(`# Adaptacije — bazni plan ${hm ? "4 d, 40 km, VDOT 45, 16 ned" : "4 d, 50 km, VDOT 45, 18 ned"}`, "", table(p0), "");
cases.forEach(([title, at], i) => {
  const s = scen[i]!;
  let r = d.adapt(p0, facts(s, at), at);
  let at2 = at;
  if (r.ok && s === "chain") {
    at2 = addDays(at, 7);
    r = d.adapt(r.plan, d.chain2(p0, at2), at2);
  }
  md.push(`## ${title} — asOf ${at2}`, "");
  if (!r.ok) {
    md.push(`ODBIJENO: ${r.reasons.map((x) => `${x.code}: ${x.message}`).join(" | ")}`, "");
    return;
  }
  const ad = (r.plan as unknown as { adaptation?: { steps: { reasons?: unknown }[] } }).adaptation;
  md.push(`upozorenja: ${warn(r.plan)} · koraka: ${ad?.steps.length ?? 0}`, "", table(r.plan, at2), "");
  const fl = flags(r.plan, at2);
  md.push(`Zastavice: ${fl.length ? fl.join("; ") : "—"}`, "");
});
console.log(md.join("\n"));
