/* Trenerska ocena početnog plana 10K v2 (coach-final, samo generator; bez adaptacija, predaje i testova).
   Profili po uzoru na audit/coach-5k-10k/coach.ts (PROFILES + inp), prošireni na ≥ 15.
   Iz web/: node ../docs/generators-v2/audit/coach-final/10K-gen.ts > /tmp/10K-gen.md */

import { distOf, type Day, type Plan, type Week } from "../../final-check/lib.ts";
import * as T10 from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";

type P = Record<string, unknown>;
const d = distOf("10K");
const S10 = T10.SCHEDULES_BY_DAYS;
const inp = (o: { weeks: number; km: number; days: 3 | 4 | 5 | 6; vdot?: number; easy?: number; beg?: boolean; goal?: number; sch?: "A" | "B" | "C" }): P => {
  const s = S10[o.days][o.sch ?? "A"];
  const base = T10.inputOf({ weeks: o.weeks, km: o.km, vdot: o.vdot ?? 45, days: s.days, long: s.long, goalTimeSec: o.goal ?? null });
  return { ...base, ...(o.vdot ? {} : { recentResult: null, easyPaceSecPerKm: o.easy }), ...(o.beg ? { experience: "beginner" } : {}) };
};
const PROFILES: [string, P][] = [
  ["01 3d-mali-v40-10w (20 km)", inp({ weeks: 10, km: 20, days: 3, vdot: 40 })],
  ["02 3d-veliki-v52-14w (40 km)", inp({ weeks: 14, km: 40, days: 3, vdot: 52 })],
  ["03 4d-mali-spor-v33-12w (25 km)", inp({ weeks: 12, km: 25, days: 4, vdot: 33 })],
  ["04 4d-veliki-brz-v62-14w (55 km)", inp({ weeks: 14, km: 55, days: 4, vdot: 62 })],
  ["05 4d-srednji-v45-12w cilj 45:00 (35 km)", inp({ weeks: 12, km: 35, days: 4, vdot: 45, goal: 2700 })],
  ["06 4d-v45-12w cilj 40:00 nerealan (35 km)", inp({ weeks: 12, km: 35, days: 4, vdot: 45, goal: 2400 })],
  ["07 5d-srednji-v48-14w (45 km)", inp({ weeks: 14, km: 45, days: 5, vdot: 48 })],
  ["08 5d-veliki-brz-v58-16w (65 km)", inp({ weeks: 16, km: 65, days: 5, vdot: 58 })],
  ["09 6d-veliki-brz-v65-16w (80 km)", inp({ weeks: 16, km: 80, days: 6, vdot: 65 })],
  ["10 6d-mali-spor-v35-12w (35 km)", inp({ weeks: 12, km: 35, days: 6, vdot: 35 })],
  ["11 4d-osecaj-e360-12w (35 km)", inp({ weeks: 12, km: 35, days: 4, easy: 360 })],
  ["12 5d-osecaj-spor-e480-14w (30 km)", inp({ weeks: 14, km: 30, days: 5, easy: 480 })],
  ["13 pocetnik-4d-e420-14w (22 km)", inp({ weeks: 14, km: 22, days: 4, easy: 420, beg: true })],
  ["14 pocetnik-3d-v33-12w (15 km)", inp({ weeks: 12, km: 15, days: 3, vdot: 33, beg: true })],
  ["15 kratka-4d-v45-8w (35 km)", inp({ weeks: 8, km: 35, days: 4, vdot: 45 })],
  ["16 duga-5d-v45-18w (45 km)", inp({ weeks: 18, km: 45, days: 5, vdot: 45 })],
  ["17 3d-raspored-C (pon/sre/pet, dugi pet) v45-12w (30 km)", inp({ weeks: 12, km: 30, days: 3, vdot: 45, sch: "C" })],
  ["18 6d-raspored-C (dugi sub) v50-14w (60 km)", inp({ weeks: 14, km: 60, days: 6, vdot: 50, sch: "C" })],
  ["19 prekratka-6w (granica) v45 4d", inp({ weeks: 6, km: 35, days: 4, vdot: 45 })],
  ["20 preduga-22w (granica) v45 4d", inp({ weeks: 22, km: 35, days: 4, vdot: 45 })],
  ["21 trcanje-hodanje 10K", { ...inp({ weeks: 12, km: 10, days: 3, easy: 480, beg: true }), runWalk: true }],
];

const f1 = (x: number) => (Math.round(x * 10) / 10).toString().replace(".", ",");
const pace = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
type Seg = { kind: string; km: number; zone?: string };
const segs = (x: Day) => ((x.workout as unknown as { segments?: Seg[] }).segments ?? []);
const QROLES = ["q1", "q2", "test", "sharpener"];
const isQ = (x: Day) => QROLES.includes(x.role);
const work = (x: Day, z?: string) => segs(x).filter((g) => g.kind === "rep" || g.kind === "work" || g.kind === "tempo" || (g.zone && !["E", "jog"].includes(g.zone) && !["warmup", "cooldown", "recovery"].includes(g.kind))).filter((g) => !z || g.zone === z).reduce((a, g) => a + g.km, 0);
const wucd = (x: Day) => {
  const s = segs(x);
  return { wu: s.filter((g) => g.kind === "warmup").reduce((a, g) => a + g.km, 0), cd: s.filter((g) => g.kind === "cooldown").reduce((a, g) => a + g.km, 0) };
};
const longOf = (w: Week) => w.days.find((x) => x.role === "long");
const WD: Record<string, string> = { mon: "Po", tue: "Ut", wed: "Sr", thu: "Če", fri: "Pe", sat: "Su", sun: "Ne" };
const lay = (w: Week) => w.days.map((x) => `${WD[(x as unknown as { weekday: string }).weekday] ?? x.date.slice(5)}:${x.role}`).join(" ");

function table(p: Plan): string {
  const rows = ["| ned | faza | cilj/plan km | dugi | lagani | kvalitet (WU+CD; dan km) | rad I/T/R/RP km | lagano % | raspored | napomene |", "|---|---|---|---|---|---|---|---|---|---|"];
  for (const w of p.weeks) {
    const L = longOf(w);
    const easy = w.days.filter((x) => x.role === "easy").map((x) => f1(x.workout.km)).join(", ") || "—";
    const q = w.days.filter(isQ).map((x) => { const { wu, cd } = wucd(x); return `${x.role}: ${x.workout.title.replace(/\s+/g, " ")} (${f1(wu)}+${f1(cd)}; ${f1(x.workout.km)})`; }).join(" + ") || "—";
    const qd = w.days.filter(isQ);
    const I = qd.reduce((a, x) => a + work(x, "I"), 0), Tz = qd.reduce((a, x) => a + work(x, "T"), 0), R = qd.reduce((a, x) => a + work(x, "R"), 0), RP = qd.reduce((a, x) => a + work(x, "RP"), 0);
    const hard = qd.reduce((a, x) => a + work(x), 0) + (w.days.find((x) => x.role === "race")?.workout.km ?? 0);
    const easyShare = Math.round(100 * (1 - hard / Math.max(w.plannedKm, 1e-9)));
    rows.push(`| ${w.index} | ${w.phase}${w.deload ? " R" : ""}${w.test ? " test" : ""} | ${f1(w.targetKm)}/${f1(w.plannedKm)} | ${L ? f1(L.workout.km) : "—"} | ${easy} | ${q} | ${f1(I)}/${f1(Tz)}/${f1(R)}/${f1(RP)} | ${easyShare} | ${lay(w)} | ${w.notes.join(" / ").slice(0, 300)} |`);
  }
  return rows.join("\n");
}
function flags(p: Plan): string[] {
  const out: string[] = [];
  let prevT = 0, prevL = 0;
  const all = p.weeks.flatMap((w) => w.days.map((x) => [w, x] as const));
  for (const w of p.weeks) {
    const L = longOf(w);
    const qd = w.days.filter(isQ);
    const I = qd.reduce((a, x) => a + work(x, "I"), 0), Tz = qd.reduce((a, x) => a + work(x, "T"), 0), R = qd.reduce((a, x) => a + work(x, "R"), 0);
    if (I > Math.min(0.08 * w.plannedKm, 10) + 0.05) out.push(`ned ${w.index}: I ${f1(I)} > 8 % (${f1(0.08 * w.plannedKm)})`);
    if (Tz > 0.1 * w.plannedKm + 0.05) out.push(`ned ${w.index}: T ${f1(Tz)} > 10 % (${f1(0.1 * w.plannedKm)})`);
    if (R > 0.05 * w.plannedKm + 0.05) out.push(`ned ${w.index}: R ${f1(R)} > 5 % (${f1(0.05 * w.plannedKm)})`);
    if (prevT && !w.deload && w.targetKm > prevT * 1.1 + 0.5) out.push(`ned ${w.index}: rast ${f1(prevT)}→${f1(w.targetKm)} (+${Math.round(100 * (w.targetKm / prevT - 1))} %)`);
    if (L && prevL && L.workout.km > prevL + 2.01) out.push(`ned ${w.index}: dugi ${f1(prevL)}→${f1(L.workout.km)}`);
    if (L) for (const x of w.days.filter((y) => y.role === "easy")) if (x.workout.km >= L.workout.km) out.push(`ned ${w.index}: lagan ${f1(x.workout.km)} ≥ dugi ${f1(L.workout.km)}`);
    for (const x of w.days.filter((y) => y.role === "easy" || y.role === "long")) if (x.workout.km < 3) out.push(`ned ${w.index}: ${x.role} ${f1(x.workout.km)} km < 3`);
    if (!w.deload) prevT = w.targetKm;
    if (L && !w.deload && w.phase !== "taper" && w.phase !== "race") prevL = L.workout.km;
  }
  const hard = (x: Day) => (isQ(x) && x.role !== "sharpener") || x.role === "long";
  for (let i = 1; i < all.length; i++) {
    const [, a] = all[i - 1]!, [w, b] = all[i]!;
    const gap = (Date.parse(b.date) - Date.parse(a.date)) / 86400000;
    if (gap === 1 && hard(a) && hard(b)) out.push(`ned ${w.index}: teški dani zaredom ${a.role} ${a.date} → ${b.role} ${b.date}`);
  }
  return out;
}
function summary(p: Plan): string {
  const ws = p.weeks;
  const peak = Math.max(...ws.map((w) => w.plannedKm));
  const build = ws.filter((w) => !["taper", "race"].includes(w.phase));
  const maxL = Math.max(...ws.map((w) => longOf(w)?.workout.km ?? 0));
  const ls = Math.max(...build.map((w) => (longOf(w)?.workout.km ?? 0) / w.plannedKm));
  const race = ws[ws.length - 1]!;
  const tap = ws.filter((w) => w.phase === "taper");
  const dl = ws.filter((w) => w.deload).map((w) => w.index);
  const qCount = ws.map((w) => w.days.filter((x) => isQ(x) && x.role !== "sharpener").length).join("");
  return `start ${p.input.currentWeeklyKm} → ned1 ${f1(ws[0]!.plannedKm)} → vrh ${f1(peak)} km (×${f1(peak / Number(p.input.currentWeeklyKm))}) · rasterećenja ned ${dl.join(",") || "—"} · najduži dugi ${f1(maxL)} km (≤ ${Math.round(ls * 100)} % nedelje) · taper ${tap.map((w) => f1(w.plannedKm)).join("/") || "—"} · trkačka ${f1(race.plannedKm)} · broj kvaliteta/ned ${qCount}`;
}
const md: string[] = ["# 10K v2 — početni planovi (coach-final)", ""];
for (const [id, input] of PROFILES) {
  const g = d.generate(input);
  md.push(`## ${id}`, "");
  if (!g.ok) { md.push(`ODBIJEN: ${g.reasons.map((r) => `${r.code}: ${r.message}`).join(" | ")}`, ""); continue; }
  const p = g.plan as Plan & { paces?: { E: { fast: number; slow: number }; T: number; I: number; R: number; RP: number }; goal?: { status: string; message: string }; notes?: string[]; predicted10kSec?: number; paceBasis?: string; planType?: string };
  if (p.planType && p.planType !== "standard") md.push(`planType ${p.planType}`, "");
  const pc = p.paces;
  md.push(`${p.policyId}/${p.policyVersion} · vdot ${p.vdot ?? "—"} (${p.paceBasis}) · tempo E ${pc ? pace(pc.E.fast) + "–" + pace(pc.E.slow) : "—"} T ${pc ? pace(pc.T) : "—"} I ${pc ? pace(pc.I) : "—"} R ${pc ? pace(pc.R) : "—"} RP ${pc ? pace(pc.RP) : "—"} /km · prognoza 10K ${p.predicted10kSec ? pace(p.predicted10kSec) : "—"}`, "");
  md.push(`cilj: ${p.goal ? `${p.goal.status} — ${p.goal.message}` : "—"} · upozorenja: ${p.warnings.map((w) => `${(w as { rule?: string }).rule ?? w.code}: ${w.message}`).join(" | ") || "—"}`, "");
  if (p.notes?.length) md.push(`Napomene plana: ${p.notes.join(" / ")}`, "");
  md.push(summary(p), "", table(p), "");
  const fl = flags(p);
  md.push(`Zastavice: ${fl.length ? fl.join("; ") : "—"}`, "");
}
console.log(md.join("\n"));
