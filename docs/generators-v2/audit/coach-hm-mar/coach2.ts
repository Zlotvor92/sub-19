/* Revizija v2, ugao 1b (coach-hm-mar) — trenersko čitanje HM i maratona: 6 NOVIH profila po distanci (nema ih u 4a
   coach.ts) + 1 plan izvora sa ponudom „kraća distanca" (domenski okidač shorterOffer, kao handoff/shorter.ts).
   Profili: cilj brži od trenutnog VDOT-a (+3 i +6), najkraća priprema, početnik 3 dana, 6 dana veliki obim, dugi subotom
   uz trku nedeljom, start usred nedelje (plan od četvrtka, trka u sredu). Slučajnosti nema (svi ulazi fiksni, START mreže).
   SAMO ČITANJE: uvozi v2 foldere, ništa ne menja.
   Iz web/: node ../docs/generators-v2/audit/coach-hm-mar/coach2.ts <HM|MAR> > ../docs/generators-v2/audit/coach-hm-mar/coach2-<dist>.md */

import * as AHM from "../../../../web/src/domain/generators/halfMarathon/v2/adaptInputs.ts";
import * as THM from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import { shorterOffer as hmOffer } from "../../../../web/src/domain/generators/halfMarathon/v2/shorter.ts";
import { shorterOffer as marOffer } from "../../../../web/src/domain/generators/marathon/v2/shorter.ts";
import { addDays, distOf, SCENARIOS, wedOf, weekdayOf, type Plan, type Week } from "../../final-check/lib.ts";

const name = process.argv[2] as "HM" | "MAR";
const d = distOf(name);
const hm = name === "HM";
type P = Record<string, unknown>;
type WD = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DIST = hm ? 21097.5 : 42195;
const tFor = (v: number) => (hm ? THM.timeForVdot(v, DIST) : TM.timeForVdot(v, DIST));
const inp = (o: { weeks: number; km: number; days: WD[]; long: WD; vdot?: number; easy?: number; beg?: boolean; goal?: number }): P =>
  hm
    ? THM.inputOf({ weeks: o.weeks, km: o.km, vdot: o.vdot, days: o.days, long: o.long, easyPaceSecPerKm: o.easy, beginner: o.beg, goalTimeSec: o.goal })
    : TM.inputOf({ weeks: o.weeks, km: o.km, vdot: o.vdot, days: o.days, long: o.long, easyPace: o.easy, experience: o.beg ? "beginner" : undefined, goalTimeSec: o.goal });
const D4: WD[] = ["tue", "thu", "sat", "sun"];
const D3: WD[] = ["tue", "thu", "sun"];
const D6: WD[] = ["mon", "tue", "wed", "thu", "sat", "sun"];
/** Start usred nedelje: plan od četvrtka, trka u sredu (cele nedelje do trke; npr. trka na praznik). */
const midweek = (o: Parameters<typeof inp>[0]): P => {
  const x = inp(o);
  const start = addDays(String(x["startDate"]), 3); // pon → čet
  const r = x["recentResult"] as Record<string, unknown> | null;
  return { ...x, startDate: start, raceDate: addDays(start, o.weeks * 7 - 1), ...(r ? { recentResult: { ...r, date: addDays(start, -14) } } : {}) };
};
const PROFILES: [string, P][] = hm
  ? [
      ["cilj+3-4d-v45-16w", inp({ weeks: 16, km: 40, days: D4, long: "sun", vdot: 45, goal: tFor(48) })],
      ["cilj+6-4d-v45-16w", inp({ weeks: 16, km: 40, days: D4, long: "sun", vdot: 45, goal: tFor(51) })],
      ["kratka-min-4d-v45-10w", inp({ weeks: 10, km: 40, days: D4, long: "sun", vdot: 45 })],
      ["kratka-min-pocetnik-4d-e420-12w", inp({ weeks: 12, km: 25, days: D4, long: "sun", easy: 420, beg: true })],
      ["pocetnik-3d-e420-16w", inp({ weeks: 16, km: 25, days: D3, long: "sun", easy: 420, beg: true })],
      ["6d-veliki-v60-16w-90km", inp({ weeks: 16, km: 90, days: D6, long: "sun", vdot: 60 })],
      ["dugi-sub-trka-ned-4d-v45-14w", inp({ weeks: 14, km: 40, days: D4, long: "sat", vdot: 45 })],
      ["start-cet-trka-sre-4d-v45-14w", midweek({ weeks: 14, km: 40, days: D4, long: "sun", vdot: 45 })],
    ]
  : [
      ["cilj+3-4d-v45-18w", inp({ weeks: 18, km: 50, days: D4, long: "sun", vdot: 45, goal: tFor(48) })],
      ["cilj+6-4d-v45-18w", inp({ weeks: 18, km: 50, days: D4, long: "sun", vdot: 45, goal: tFor(51) })],
      ["kratka-min-4d-v45-12w", inp({ weeks: 12, km: 50, days: D4, long: "sun", vdot: 45 })],
      ["kratka-min-pocetnik-4d-e420-16w", inp({ weeks: 16, km: 30, days: D4, long: "sun", easy: 420, beg: true })],
      ["pocetnik-3d-e420-20w", inp({ weeks: 20, km: 30, days: D3, long: "sun", easy: 420, beg: true })],
      ["6d-veliki-v60-18w-110km", inp({ weeks: 18, km: 110, days: D6, long: "sun", vdot: 60 })],
      ["dugi-sub-trka-ned-4d-v45-18w", inp({ weeks: 18, km: 50, days: D4, long: "sat", vdot: 45 })],
      ["start-cet-trka-sre-4d-v45-16w", midweek({ weeks: 16, km: 50, days: D4, long: "sun", vdot: 45 })],
    ];

const f1 = (x: number) => (Math.round(x * 10) / 10).toString().replace(".", ",");
const QR = ["q1", "q2", "test", "sharpener"];
const qOf = (w: Week) => w.days.filter((x) => QR.includes(x.role)).map((x) => x.workout.title.replace(/\s+/g, " ")).join(" + ") || "—";
const longOf = (w: Week) => w.days.find((x) => x.role === "long");
function table(p: Plan, asOf?: string): string {
  const rows = ["| ned | faza | cilj / plan | dugi (min) | najduži lagan | kvalitet |", "|---|---|---|---|---|---|"];
  for (const w of p.weeks) {
    const L = longOf(w);
    const easy = Math.max(0, ...w.days.filter((x) => x.role === "easy").map((x) => x.workout.km));
    const ph = `${w.phase}${w.deload ? " R" : ""}${w.test ? " test" : ""}`;
    const mark = asOf && w.endDate <= asOf ? "·" : "";
    rows.push(`| ${w.index}${mark} | ${ph} | ${f1(w.targetKm)} / ${f1(w.plannedKm)} | ${L ? `${f1(L.workout.km)} (${Math.round(L.workout.sec / 60)})` : "—"} | ${easy ? f1(easy) : "—"} | ${qOf(w)} |`);
  }
  return rows.join("\n");
}
/** Iste zastavice kao final-check/coach.ts + dan kvaliteta/dugi dan pre trke + dugi uz dan trke. */
function flags(p: Plan, asOf = "0000-00-00"): string[] {
  const out: string[] = [];
  let prevLong = 0, prevQ = "", prevTarget = 0;
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
    // uzastopni teški dani (kvalitet/dugi dan za danom)
    const hard = w.days.filter((x) => QR.includes(x.role) || x.role === "long").map((x) => x.date).sort();
    for (let i = 1; i < hard.length; i++) if (addDays(hard[i - 1]!, 1) === hard[i]) out.push(`ned ${w.index}: teški dani zaredom ${hard[i - 1]} i ${hard[i]} (${weekdayOf(hard[i - 1]!)}/${weekdayOf(hard[i]!)})`);
    if (L) prevLong = w.deload || w.phase === "taper" ? prevLong : L.workout.km;
    prevQ = w.deload ? prevQ : q;
    prevTarget = w.deload ? prevTarget : w.targetKm;
  }
  // teški dan uz granicu nedelje
  const all = p.weeks.flatMap((w) => w.days).filter((x) => QR.includes(x.role) || x.role === "long" || x.role === "race").sort((a, b) => (a.date < b.date ? -1 : 1));
  for (let i = 1; i < all.length; i++)
    if (addDays(all[i - 1]!.date, 1) === all[i]!.date && p.weeks.find((w) => w.days.includes(all[i]!))!.startDate === all[i]!.date)
      out.push(`granica nedelje: ${all[i - 1]!.role} ${all[i - 1]!.date} pa ${all[i]!.role} ${all[i]!.date}`);
  return out;
}
const day = (x: Week["days"][number]) =>
  `${weekdayOf(x.date)} ${x.date.slice(5)} ${x.role}: ${x.workout.title.replace(/\s+/g, " ")} — ${f1(x.workout.km)} km / ${Math.round(x.workout.sec / 60)} min${x.countsToWeek ? "" : " (ne broji se)"}`;
function detail(p: Plan, idx: number[]): string[] {
  const out: string[] = [];
  for (const i of idx) {
    const w = p.weeks[i - 1];
    if (!w) continue;
    out.push(`- ned ${i} (${w.startDate} … ${w.endDate}, ${w.phase}${w.deload ? " R" : ""}):`);
    for (const x of [...w.days].sort((a, b) => (a.date < b.date ? -1 : 1))) out.push(`  - ${day(x)}`);
    for (const n of w.notes) out.push(`  - napomena: ${n}`);
  }
  return out;
}
const fullWarn = (p: Plan) => p.warnings.map((v) => `  - ${(v as { rule?: string }).rule ?? v.code}: ${v.message}`);
const goalLine = (p: Plan) => {
  const g = (p as unknown as { goal?: { status: string; goalVdot: number; vdotGap: number; message: string } | null }).goal;
  return g ? `cilj: ${g.status}, goalVdot ${g.goalVdot}, razlika ${g.vdotGap} — „${g.message}"` : "cilj: —";
};

const md: string[] = [`# Trenersko čitanje — ${name} v2, novi profili (ugao 1b, coach2.ts, kod 670700e)`, ""];
for (const [id, input] of PROFILES) {
  const g = d.generate(input);
  md.push(`## ${id}`, "", "ulaz: `" + JSON.stringify(input) + "`", "");
  if (!g.ok) {
    md.push(`ODBIJEN: ${g.reasons.map((r) => `${r.code}: ${r.message}`).join(" | ")}`, "");
    continue;
  }
  const p = g.plan;
  const N = p.weeks.length;
  const vol = p.weeks.map((w) => w.targetKm);
  md.push(`vdot ${p.vdot ?? "—"} · start ${input["currentWeeklyKm"]} km · vrh ${f1(Math.max(...vol))} km · ${goalLine(p)}`, "", "upozorenja:", ...fullWarn(p), "", table(p), "");
  md.push(`Zastavice: ${flags(p).join("; ") || "—"}`, "", "Dani (ned 1, 2, sredina, N−2, N−1, N):", ...detail(p, [...new Set([1, 2, Math.ceil(N / 2), N - 2, N - 1, N])]), "");
}

// Plan izvora sa ponudom „kraća distanca": prvi tok (bazni plan coach.ts, 4 d) po scenarijima/asOf koji daje ponudu.
// Bazni plan: prvi kandidat čiji najduži dugi je ≥ praga (inače ponuda ne postoji po definiciji — plan „rođen kratak").
const D5: WD[] = ["mon", "tue", "thu", "sat", "sun"];
const CANDS: [string, P][] = hm
  ? [["4 d, 40 km, VDOT 45, 16 ned", inp({ weeks: 16, km: 40, days: D4, long: "sun", vdot: 45 })]]
  : [
      ["4 d, 50 km, VDOT 45, 18 ned", inp({ weeks: 18, km: 50, days: D4, long: "sun", vdot: 45 })],
      ["5 d, 60 km, VDOT 50, 18 ned", inp({ weeks: 18, km: 60, days: D5, long: "sun", vdot: 50 })],
      ["6 d, 70 km, VDOT 50, 18 ned", inp({ weeks: 18, km: 70, days: D6, long: "sun", vdot: 50 })],
    ];
const offer = (pl: Plan, at: string) => (hm ? hmOffer(pl as never, at) : marOffer(pl as never, at));
let found: { s: string; at: string; plan: Plan } | null = null;
let p0: Plan | null = null;
for (const [label, baseIn] of CANDS) {
  const g0 = d.generate(baseIn);
  if (!g0.ok) throw new Error("bazni plan");
  p0 = g0.plan;
  const asOfs = p0.weeks.slice(0, -2).flatMap((w) => [wedOf(w.startDate), w.endDate]);
  let flows = 0, offers = 0;
  const longest = Math.max(...p0.weeks.flatMap((w) => w.days.filter((x) => x.role === "long").map((x) => x.workout.km)));
  for (const at of asOfs)
    for (const s of SCENARIOS) {
      flows++;
      const r = d.adapt(p0, d.facts(p0, s, at), at);
      if (r.ok && offer(r.plan, at)) {
        offers++;
        if (!found) found = { s, at, plan: r.plan };
      }
    }
  md.push(`# Plan izvora sa ponudom „kraća distanca" — bazni ${label} (najduži dugi ${f1(longest)} km)`, "");
  md.push(`Tokova (asOf sreda i kraj ned 1…N−2 × 17 scenarija): ${flows}; sa ponudom: ${offers}.`, "");
  if (found) break;
}
if (found) {
  const ad = (found.plan as unknown as { adaptation?: unknown }).adaptation;
  md.push(`Prvi tok sa ponudom: scenario ${found.s}, asOf ${found.at}`, "", "upozorenja:", ...fullWarn(found.plan), "", table(found.plan, found.at), "");
  md.push(`Zastavice: ${flags(found.plan, found.at).join("; ") || "—"}`, "");
  const fi = found.plan.weeks.findIndex((w) => w.startDate > found!.at) + 1;
  md.push("Dani (prva buduća nedelja, N−1, N):", ...detail(found.plan, [fi, found.plan.weeks.length - 1, found.plan.weeks.length]), "");
  md.push("adaptation: `" + JSON.stringify(ad).slice(0, 1500) + "`", "");
}
console.log(md.join("\n"));
