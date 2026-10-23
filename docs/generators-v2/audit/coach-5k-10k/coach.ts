/* Dubinska provera v2, ugao 1a — trenersko čitanje 5K v2 i 10K v2 (po uzoru na final-check/coach.ts za HM/MAR).
   Po distanci: generisani planovi (3/4/5/6 d gde distanca podržava; mali i veliki obim; spor i brz; po osećaju;
   početnik; 5K i trčanje/hodanje; kratka i duga priprema; 5K i profil korisnika aplikacije), 6 adaptiranih (bol 5
   usred izgradnje, pauza 20, pauza 35 nov start, umor pre starta, brži rezultat +2 VDOT, lanac pauza 10 + manjak 50 %)
   i plan posle predaje „kraća distanca" (5K posle HM v2, 10K posle maraton v2; isti put kao final-check/handoff-adapt.ts).
   Izlaz: markdown tabele nedelja (faza, cilj/planirano, dugi, najduži lagan, kvalitet sa dozom i WU/CD, napomene) +
   automatske zastavice. Bez slučajnosti (seed nije potreban: svi ulazi su fiksni i zapisani ovde).
   Iz web/: node ../docs/generators-v2/audit/coach-5k-10k/coach.ts <5K|10K> > ../docs/generators-v2/audit/coach-5k-10k/coach-<dist>.md */

import { addDays, distOf, wedOf, type Day, type Plan, type Week } from "../../final-check/lib.ts";
import * as T10 from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
import { START as START5 } from "../../../../web/src/domain/generators/fiveK/v2/testInputs.ts";
import { raceTimeForVdot as rt5 } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";
import * as THM from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import * as hmPlan from "../../../../web/src/domain/generators/halfMarathon/v2/app/plan.ts";
import * as hmPrep from "../../../../web/src/domain/generators/halfMarathon/v2/app/preparation.ts";
import * as marPlan from "../../../../web/src/domain/generators/marathon/v2/app/plan.ts";
import * as marPrep from "../../../../web/src/domain/generators/marathon/v2/app/preparation.ts";
import * as fkTarget from "../../../../web/src/domain/generators/fiveK/v2/app/handoffTarget.ts";
import * as tkTarget from "../../../../web/src/domain/generators/tenK/v2/app/handoffTarget.ts";

const name = process.argv[2] as "5K" | "10K";
const d = distOf(name);
const five = name === "5K";
type P = Record<string, unknown>;

/* ---------- ulazi ---------- */
const S10 = T10.SCHEDULES_BY_DAYS;
const D5: Record<3 | 4 | 5, string[]> = { 3: ["tue", "thu", "sun"], 4: ["tue", "thu", "sat", "sun"], 5: ["mon", "tue", "thu", "sat", "sun"] };
const res5 = (vdot: number) => ({ distanceM: 5000, timeSec: Math.round(rt5(vdot, 5000)), date: addDays(START5, -14) });
const inp = (o: { weeks: number; km: number; days: 3 | 4 | 5 | 6; vdot?: number; easy?: number; beg?: boolean; goal?: number }): P => {
  if (five) {
    const days = D5[o.days as 3 | 4 | 5];
    return {
      startDate: START5,
      raceDate: addDays(START5, o.weeks * 7 - 1),
      runDays: days,
      currentWeeklyKm: o.km,
      ...(o.vdot ? { recentResult: res5(o.vdot) } : { typicalEasyPaceSecPerKm: o.easy }),
      ...(o.beg ? { experience: "beginner", canRun30Min: true } : {}),
      goalTimeSec: o.goal ?? null,
    };
  }
  const s = S10[o.days].A;
  const base = T10.inputOf({ weeks: o.weeks, km: o.km, vdot: o.vdot ?? 45, days: s.days, long: s.long, goalTimeSec: o.goal ?? null });
  return {
    ...base,
    ...(o.vdot ? {} : { recentResult: null, easyPaceSecPerKm: o.easy }),
    ...(o.beg ? { experience: "beginner" } : {}),
  };
};
/** Profil korisnika aplikacije: 5K 20:25 (1225 s), cilj ispod 20:00 (1199 s), trka ned 13. 12. 2026, start pon
    19. 10. 2026 (nedelja u kojoj je 23. 10.), 30 km, 4 dana (4 dana 5K = 2 kvaliteta po pravilu days[4].qualityDays). */
const USER = (runDays: string[]): P => ({
  startDate: "2026-10-19",
  raceDate: "2026-12-13",
  runDays,
  currentWeeklyKm: 30,
  recentResult: { distanceM: 5000, timeSec: 1225, date: "2026-10-12" },
  goalTimeSec: 1199,
});
const PROFILES: [string, P][] = five
  ? [
      ["KORISNIK-20:25-cilj-<20-4d-30km-8w (uto/čet/sub/ned)", USER(["tue", "thu", "sat", "sun"])],
      ["KORISNIK-20:25-cilj-<20-4d-30km-8w (pon/sre/pet/ned)", USER(["mon", "wed", "fri", "sun"])],
      ["3d-mali-v40-10w (15 km)", inp({ weeks: 10, km: 15, days: 3, vdot: 40 })],
      ["3d-veliki-v50-12w (30 km)", inp({ weeks: 12, km: 30, days: 3, vdot: 50 })],
      ["4d-mali-spor-v33-10w (18 km)", inp({ weeks: 10, km: 18, days: 4, vdot: 33 })],
      ["4d-veliki-brz-v58-12w (42 km)", inp({ weeks: 12, km: 42, days: 4, vdot: 58 })],
      ["5d-srednji-v48-12w (40 km)", inp({ weeks: 12, km: 40, days: 5, vdot: 48 })],
      ["5d-veliki-brz-v60-14w (60 km)", inp({ weeks: 14, km: 60, days: 5, vdot: 60 })],
      ["5d-mali-spor-v35-10w (25 km)", inp({ weeks: 10, km: 25, days: 5, vdot: 35 })],
      ["4d-osecaj-e330-10w (30 km)", inp({ weeks: 10, km: 30, days: 4, easy: 330 })],
      ["3d-osecaj-spor-e480-12w (15 km)", inp({ weeks: 12, km: 15, days: 3, easy: 480 })],
      ["pocetnik-4d-e420-12w (18 km)", inp({ weeks: 12, km: 18, days: 4, easy: 420, beg: true })],
      ["kratka-4d-v45-6w (30 km)", inp({ weeks: 6, km: 30, days: 4, vdot: 45 })],
      ["duga-5d-v45-16w (40 km)", inp({ weeks: 16, km: 40, days: 5, vdot: 45 })],
    ]
  : [
      ["3d-mali-v40-10w (20 km)", inp({ weeks: 10, km: 20, days: 3, vdot: 40 })],
      ["3d-veliki-v52-14w (40 km)", inp({ weeks: 14, km: 40, days: 3, vdot: 52 })],
      ["4d-mali-spor-v32-12w (25 km)", inp({ weeks: 12, km: 25, days: 4, vdot: 32 })],
      ["4d-veliki-brz-v62-14w (55 km)", inp({ weeks: 14, km: 55, days: 4, vdot: 62 })],
      ["5d-srednji-v48-14w (45 km)", inp({ weeks: 14, km: 45, days: 5, vdot: 48 })],
      ["6d-veliki-brz-v68-16w (80 km)", inp({ weeks: 16, km: 80, days: 6, vdot: 68 })],
      ["6d-mali-spor-v35-12w (35 km)", inp({ weeks: 12, km: 35, days: 6, vdot: 35 })],
      ["4d-osecaj-e360-12w (35 km)", inp({ weeks: 12, km: 35, days: 4, easy: 360 })],
      ["5d-osecaj-spor-e480-14w (30 km)", inp({ weeks: 14, km: 30, days: 5, easy: 480 })],
      ["pocetnik-4d-e420-14w (22 km)", inp({ weeks: 14, km: 22, days: 4, easy: 420, beg: true })],
      ["pocetnik-3d-v35-12w (20 km)", inp({ weeks: 12, km: 20, days: 3, vdot: 35, beg: true })],
      ["kratka-4d-v45-8w (35 km)", inp({ weeks: 8, km: 35, days: 4, vdot: 45 })],
      ["duga-5d-v45-18w (45 km)", inp({ weeks: 18, km: 45, days: 5, vdot: 45 })],
    ];
const RUN_WALK: [string, P][] = five
  ? [
      ["trcanje-hodanje-pocetnik-3d-8w", { startDate: START5, raceDate: addDays(START5, 55), runDays: ["tue", "thu", "sun"], currentWeeklyKm: 5, experience: "beginner", canRun30Min: false, goalTimeSec: null }],
      ["trcanje-hodanje-e480-3d-12w", { startDate: START5, raceDate: addDays(START5, 83), runDays: ["mon", "wed", "sat"], currentWeeklyKm: 8, experience: "beginner", canRun30Min: false, typicalEasyPaceSecPerKm: 480, goalTimeSec: null }],
    ]
  : [["trcanje-hodanje-10K (očekivano odbijanje D29)", { ...inp({ weeks: 12, km: 20, days: 3, easy: 480, beg: true }), runWalk: true }]];

/* ---------- prikaz ---------- */
const f1 = (x: number) => (Math.round(x * 10) / 10).toString().replace(".", ",");
type Seg = { kind: string; km: number; zone?: string };
const segs = (x: Day) => ((x.workout as unknown as { segments?: Seg[] }).segments ?? []);
const wucd = (x: Day) => {
  const s = segs(x);
  const wu = s.filter((g) => g.kind === "warmup").reduce((a, g) => a + g.km, 0);
  const cd = s.filter((g) => g.kind === "cooldown").reduce((a, g) => a + g.km, 0);
  return { wu, cd };
};
const QROLES = ["q1", "q2", "test", "sharpener"];
const qOf = (w: Week) =>
  w.days
    .filter((x) => QROLES.includes(x.role))
    .map((x) => {
      const { wu, cd } = wucd(x);
      return `${x.role}: ${x.workout.title.replace(/\s+/g, " ")} [WU ${f1(wu)} + CD ${f1(cd)}; dan ${f1(x.workout.km)} km]`;
    })
    .join(" + ") || "—";
const strides = (w: Week) => w.days.filter((x) => x.role === "easy" && /ubrzanj/.test(x.workout.title)).length;
const longOf = (w: Week) => w.days.find((x) => x.role === "long");
function table(p: Plan, asOf?: string): string {
  const rows = ["| ned | faza | cilj / plan | dugi | lagani (km) | kvalitet | napomene |", "|---|---|---|---|---|---|---|"];
  for (const w of p.weeks) {
    const L = longOf(w);
    const easy = w.days.filter((x) => x.role === "easy").map((x) => f1(x.workout.km));
    const ph = `${w.phase}${w.deload ? " R" : ""}${w.test ? " test" : ""}`;
    const mark = asOf && w.endDate <= asOf ? "·" : "";
    const notes = w.notes.map((n) => n.slice(0, 140)).join(" / ");
    const st = strides(w) ? ` (+ubrz. ×${strides(w)})` : "";
    rows.push(`| ${w.index}${mark} | ${ph} | ${f1(w.targetKm)} / ${f1(w.plannedKm)} | ${L ? f1(L.workout.km) : "—"} | ${easy.join(", ") || "—"}${st} | ${qOf(w)} | ${notes.slice(0, 320)} |`);
  }
  return rows.join("\n");
}
type RwDay = { date: string; role: string; level?: number; session?: { title: string; totalSec: number; runTotalSec: number; estRunKm: number | null } };
function rwTable(p: Plan, asOf?: string): string {
  const rows = ["| ned | faza | sesije (nivo, ukupno min, trčanje min) | napomene |", "|---|---|---|---|"];
  for (const w of p.weeks as unknown as { index: number; phase: string; endDate: string; days: RwDay[]; notes?: string[] }[]) {
    const ss = w.days.map((x) => (x.session ? `L${x.level} ${Math.round(x.session.totalSec / 60)}/${Math.round(x.session.runTotalSec / 60)}` : x.role)).join(", ");
    const mark = asOf && w.endDate <= asOf ? "·" : "";
    rows.push(`| ${w.index}${mark} | ${w.phase} | ${ss} | ${(w.notes ?? []).join(" / ").slice(0, 300)} |`);
  }
  return rows.join("\n");
}
const MIN_EASY = 3; // 5K lengths.minKm / 10K Uslov 8 „lagan ≥ 3 km"
const MIN_TAPER = 2; // 5K taperMinKm (10K: trkačka lagan = min(35 min, lagan tapera))
/** Automatske zastavice (budući deo plana kad je dat asOf). */
function flags(p: Plan, asOf = "0000-00-00"): string[] {
  const out: string[] = [];
  let prevLong = 0;
  let prevQ = "";
  let prevTarget = 0;
  let peak = 0;
  const dayOf = new Map(p.weeks.flatMap((w) => w.days.map((x) => [x.date, x] as const)));
  for (const w of p.weeks) {
    const L = longOf(w);
    const fut = w.startDate > asOf;
    const build = !w.deload && ["base", "development", "specific", "peak", "sharpen"].includes(w.phase);
    if (fut && L && prevLong > 0 && L.workout.km > Math.max(prevLong * 1.25, prevLong + 2)) out.push(`ned ${w.index}: skok dugog ${f1(prevLong)} → ${f1(L.workout.km)} km`);
    if (fut && prevTarget > 0 && build && w.targetKm > prevTarget * 1.12 && w.targetKm - prevTarget > 2.5)
      out.push(`ned ${w.index}: skok cilja ${f1(prevTarget)} → ${f1(w.targetKm)} km`);
    const qt = w.days.filter((x) => QROLES.includes(x.role)).map((x) => x.workout.title).join(" + ") || "—";
    if (fut && build && qt === prevQ && qt !== "—") out.push(`ned ${w.index}: isti kvalitet kao prethodne (${qt})`);
    if (fut && build && !w.days.some((x) => x.role === "q1" || x.role === "q2" || x.role === "test")) out.push(`ned ${w.index}: izgradnja bez kvaliteta`);
    if (fut && L) {
      for (const x of w.days.filter((y) => y.role === "easy")) if (x.workout.km > 0.9 * L.workout.km) { out.push(`ned ${w.index}: lagan ${f1(x.workout.km)} ≈ dugi ${f1(L.workout.km)}`); break; }
      for (const x of w.days.filter((y) => QROLES.includes(y.role) && y.role !== "sharpener"))
        if (x.workout.sec > L.workout.sec) out.push(`ned ${w.index}: ${x.role} ${Math.round(x.workout.sec / 60)} min > dugi ${Math.round(L.workout.sec / 60)} min`);
    }
    if (fut)
      for (const x of w.days.filter((y) => y.date > asOf && (y.role === "easy" || y.role === "long"))) {
        const min = w.phase === "taper" || w.phase === "race" ? MIN_TAPER : MIN_EASY;
        if (x.workout.km < min - 1e-9) out.push(`ned ${w.index}: ${x.role} ${f1(x.workout.km)} km < ${min} km`);
      }
    // teški dani zaredom (kvalitet/dugi/test dan posle kvaliteta/dugog)
    if (fut)
      for (const x of w.days) {
        const prev = dayOf.get(addDays(x.date, -1));
        const hard = (y: Day) => QROLES.includes(y.role) && y.role !== "sharpener" || y.role === "long";
        if (prev && hard(x) && hard(prev) && x.role !== "race") out.push(`ned ${w.index}: teški dani zaredom ${prev.role} ${prev.date} → ${x.role} ${x.date}`);
      }
    if (L) prevLong = w.deload || w.phase === "taper" ? prevLong : L.workout.km;
    prevQ = w.deload ? prevQ : qt;
    prevTarget = w.deload ? prevTarget : w.targetKm;
    peak = Math.max(peak, w.targetKm);
  }
  return out;
}
function summary(p: Plan): string {
  const ws = p.weeks;
  const peak = Math.max(...ws.map((w) => w.plannedKm));
  const tap = ws.filter((w) => w.phase === "taper");
  const race = ws[ws.length - 1]!;
  const raceKm = race.days.filter((x) => x.countsToWeek && x.role !== "race").reduce((a, x) => a + x.workout.km, 0);
  const longShare = Math.max(...ws.filter((w) => !["taper", "race"].includes(w.phase)).map((w) => (longOf(w)?.workout.km ?? 0) / w.plannedKm));
  const qShare = Math.max(
    ...ws.map((w) => w.days.filter((x) => QROLES.includes(x.role)).reduce((a, x) => a + segs(x).filter((g) => !["warmup", "cooldown", "recovery"].includes(g.kind)).reduce((b, g) => b + g.km, 0), 0) / w.plannedKm),
  );
  return `vrh planirano ${f1(peak)} km · taper ${tap.map((w) => f1(w.plannedKm)).join("/") || "—"} km (${tap.length ? Math.round((100 * tap[tap.length - 1]!.plannedKm) / peak) : "—"} % vrha) · trkačka bez trke ${f1(raceKm)} km · dugi ≤ ${Math.round(longShare * 100)} % nedelje (van tapera) · radni deo kvaliteta ≤ ${Math.round(qShare * 100)} % nedelje`;
}
const warn = (p: Plan) => [...new Set(p.warnings.map((v) => `${(v as { rule?: string }).rule ?? v.code}`))].join(", ") || "—";
const head = (p: Plan, input: P) => {
  const goal = (p as unknown as { goal?: { status?: string; message?: string } }).goal;
  return `vdot ${p.vdot ?? "—"} · start ${input["currentWeeklyKm"]} km · ${p.policyVersion as string} · cilj: ${goal?.status ?? "—"} (${goal?.message ?? ""}) · upozorenja: ${warn(p)}`;
};

/* ---------- generisani ---------- */
const md: string[] = [`# Trenersko čitanje — ${name} v2 (ugao 1a, skripta coach.ts, kod 670700e)`, ""];
for (const [id, input] of PROFILES) {
  const g = d.generate(input);
  md.push(`## ${id}`, "");
  if (!g.ok) {
    md.push(`ODBIJEN: ${g.reasons.map((r) => `${r.code}: ${r.message}`).join(" | ")}`, "");
    continue;
  }
  const pl = (g.plan as unknown as { notes?: string[] }).notes ?? [];
  md.push(head(g.plan, input), "", summary(g.plan), "", ...(pl.length ? [`Napomene plana: ${pl.join(" / ")}`, ""] : []), table(g.plan), "");
  const fl = flags(g.plan);
  md.push(`Zastavice: ${fl.length ? fl.join("; ") : "—"}`, "");
}
for (const [id, input] of RUN_WALK) {
  const g = d.generate(input);
  md.push(`## ${id}`, "");
  if (!g.ok) {
    md.push(`ODBIJEN: ${g.reasons.map((r) => `${r.code}: ${r.message}`).join(" | ")}`, "");
    continue;
  }
  const pl = (g.plan as unknown as { notes?: string[] }).notes ?? [];
  md.push(`planType ${g.plan.planType} · upozorenja: ${warn(g.plan)}`, "", `Napomene plana: ${pl.join(" / ")}`, "", rwTable(g.plan), "");
}

/* ---------- adaptacije: bazni plan 4 d srednji (rezultat) ---------- */
const baseIn = five ? inp({ weeks: 12, km: 30, days: 4, vdot: 45 }) : inp({ weeks: 14, km: 35, days: 4, vdot: 45, goal: 2700 });
const g0 = d.generate(baseIn);
if (!g0.ok) throw new Error("bazni plan");
const p0 = g0.plan;
const N = p0.weeks.length;
const buildMid = p0.weeks.find((w) => (w.phase === "development" || w.phase === "peak") && !w.deload)!.index;
const end = (i: number) => p0.weeks[i - 1]!.endDate;
const cases: [string, string, string][] = [
  ["pain5", `bol 5 usred izgradnje (sreda ned ${buildMid})`, wedOf(p0.weeks[buildMid - 1]!.startDate)],
  ["pause20", `pauza 20 (kraj ned ${Math.ceil(N / 2)})`, end(Math.ceil(N / 2))],
  ["pause35", `pauza 35 — nov start (kraj ned ${Math.ceil(N / 3) + 2})`, end(Math.ceil(N / 3) + 2)],
  ["fatigue", "umor pre starta (start − 3)", addDays(p0.input.startDate, -3)],
  ["faster", `brži rezultat +2 VDOT (kraj ned ${Math.ceil(N / 2) - 1})`, end(Math.ceil(N / 2) - 1)],
  ["chain", "lanac: pauza 10 (kraj ned 4) + manjak 50 % (kraj ned 5)", end(4)],
];
md.push(`# Adaptacije — bazni plan ${five ? "4 d, 30 km, VDOT 45, 12 ned" : "4 d, 35 km, VDOT 45, 14 ned, cilj 45:00"}`, "", head(p0, baseIn), "", table(p0), "");
for (const [s, title, at] of cases) {
  let r = d.adapt(p0, d.facts(p0, s as never, at), at);
  let at2 = at;
  if (r.ok && s === "chain") {
    at2 = addDays(at, 7);
    r = d.adapt(r.plan, d.chain2(p0, at2), at2);
  }
  md.push(`## ${title} — asOf ${at2}`, "");
  if (!r.ok) {
    md.push(`ODBIJENO: ${r.reasons.map((x) => `${x.code}: ${x.message}`).join(" | ")}`, "");
    continue;
  }
  const ad = (r.plan as unknown as { adaptation?: { steps: unknown[] } }).adaptation;
  md.push(`upozorenja: ${warn(r.plan)} · koraka: ${ad?.steps.length ?? 0}`, "", summary(r.plan), "", table(r.plan, at2), "");
  const fl = flags(r.plan, at2);
  md.push(`Zastavice: ${fl.length ? fl.join("; ") : "—"}`, "");
}

/* ---------- predaja „kraća distanca": 5K posle HM v2, 10K posle maraton v2 ---------- */
{
  const src = distOf(five ? "HM" : "MAR");
  const srcIn = five
    ? THM.inputOf({ weeks: 16, km: 40, vdot: 45, days: THM.SCHEDULES_BY_DAYS[4].A.days, long: THM.SCHEDULES_BY_DAYS[4].A.long })
    : TM.inputOf({ weeks: 18, km: 50, vdot: 45, days: TM.SCHEDULES_BY_DAYS[4].A.days, long: TM.SCHEDULES_BY_DAYS[4].A.long });
  const gs = src.generate(srcIn);
  if (!gs.ok) throw new Error("izvor predaje");
  const sp = gs.plan;
  const SRC = five ? { plan: hmPlan, prep: hmPrep } : { plan: marPlan, prep: marPrep };
  const current = (SRC.plan as { storedPlan: (g: unknown) => unknown }).storedPlan((SRC.plan as { generatedPlan: (p: unknown) => unknown }).generatedPlan(sp));
  const ci = { ...(SRC.prep as { contractInput: (v: unknown) => P }).contractInput(sp), raceDistM: five ? 5000 : 10000, goalSec: null };
  const fn = (five ? fkTarget.handoffFuture : tkTarget.handoffFuture) as unknown as (...a: unknown[]) => { result?: P; error?: string };
  const key = five ? "fiveKV2" : "tenKV2";
  const prefixKey = five ? "fiveKV2Prefix" : "tenKV2Prefix";
  for (const wk of [8, 2])
    for (const sc of ["none", "under50"] as const) {
      const at = sp.weeks[wk - 1]!.endDate;
      const raw = src.facts(sp, sc, at);
      const r = fn(current, ci, at, {}, { execution: null, restartFromBase: false, raw });
      md.push(`# Predaja ${src.name} → ${name}: izvor ${five ? "HM 4 d 40 km VDOT 45 16 ned" : "MAR 4 d 50 km VDOT 45 18 ned"}, kraj ned ${wk} (${at}), činjenice izvora ${sc}`, "");
      if (!r.result) {
        md.push(`ODBIJENO: ${r.error}`, "");
        continue;
      }
      const tp = r.result[key] as Plan;
      md.push(`prefiks izvora: ${r.result[prefixKey] ? "da" : "NE"} · ${head(tp, tp.input)}`, "", summary(tp), "", table(tp), "");
      const fl = flags(tp);
      md.push(`Zastavice: ${fl.length ? fl.join("; ") : "—"}`, "");
    }
}
console.log(md.join("\n"));
