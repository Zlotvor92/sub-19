/* Trenerska ocena početnog plana HM v2 (coach-final, BRIEF.md). SAMO generator iz profila: bez adaptacija, predaje i testova.
   Iz web/: node ../docs/generators-v2/audit/coach-final/HM-gen.ts > ../docs/generators-v2/audit/coach-final/HM-out.txt */

import * as THM from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import { addDays, distOf, weekdayOf, type Plan, type Week } from "../../final-check/lib.ts";

const d = distOf("HM");
type WD = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type P = Record<string, unknown>;
const HM = 21097.5;
const D3: WD[] = ["tue", "thu", "sun"];
const D4: WD[] = ["tue", "thu", "sat", "sun"];
const D5: WD[] = ["mon", "tue", "thu", "sat", "sun"];
const D6: WD[] = ["mon", "tue", "wed", "thu", "sat", "sun"];
const inp = (o: THM.Profile): P => THM.inputOf(o);

const PROFILES: [string, P][] = [
  ["01 3d-v33-spor-20km-14w", inp({ weeks: 14, km: 20, days: D3, long: "sun", vdot: 33 })],
  ["02 3d-v40-25km-16w-rl10", inp({ weeks: 16, km: 25, days: D3, long: "sun", vdot: 40, recentLongRunKm: 10 })],
  ["03 4d-v45-40km-16w-bezRL", inp({ weeks: 16, km: 40, days: D4, long: "sun", vdot: 45 })],
  ["04 4d-v45-40km-16w-rl8", inp({ weeks: 16, km: 40, days: D4, long: "sun", vdot: 45, recentLongRunKm: 8 })],
  ["05 4d-v45-40km-16w-rl14", inp({ weeks: 16, km: 40, days: D4, long: "sun", vdot: 45, recentLongRunKm: 14 })],
  ["06 4d-v45-40km-16w-rl20", inp({ weeks: 16, km: 40, days: D4, long: "sun", vdot: 45, recentLongRunKm: 20 })],
  ["07 4d-v45-40km-10w-najkraca", inp({ weeks: 10, km: 40, days: D4, long: "sun", vdot: 45 })],
  ["08 4d-v45-40km-20w-najduza", inp({ weeks: 20, km: 40, days: D4, long: "sun", vdot: 45 })],
  ["09 5d-v50-55km-14w-rl16", inp({ weeks: 14, km: 55, days: D5, long: "sun", vdot: 50, recentLongRunKm: 16 })],
  ["10 6d-v58-80km-16w-rl22", inp({ weeks: 16, km: 80, days: D6, long: "sun", vdot: 58, recentLongRunKm: 22 })],
  ["11 6d-v65-110km-12w-brz", inp({ weeks: 12, km: 110, days: D6, long: "sun", vdot: 65, recentLongRunKm: 26 })],
  ["12 osecaj-4d-e390-35km-14w", inp({ weeks: 14, km: 35, days: D4, long: "sun", easyPaceSecPerKm: 390 })],
  ["13 osecaj-5d-e330-50km-16w-rl15", inp({ weeks: 16, km: 50, days: D5, long: "sun", easyPaceSecPerKm: 330, recentLongRunKm: 15 })],
  ["14 pocetnik-3d-e450-18km-16w", inp({ weeks: 16, km: 18, days: D3, long: "sun", easyPaceSecPerKm: 450, beginner: true })],
  ["15 pocetnik-4d-e420-25km-12w-najkraca", inp({ weeks: 12, km: 25, days: D4, long: "sun", easyPaceSecPerKm: 420, beginner: true, recentLongRunKm: 8 })],
  ["16 korisnik-5K20:25-4d-30km-16w-rl14", inp({ weeks: 16, km: 30, days: D4, long: "sun", result: { distanceM: 5000, timeSec: 1225 }, recentLongRunKm: 14 })],
  ["17 4d-v45-cilj+5-40km-16w", inp({ weeks: 16, km: 40, days: D4, long: "sun", vdot: 45, goalTimeSec: THM.timeForVdot(50, HM) })],
  ["01b 3d-v33-spor-25km-14w", inp({ weeks: 14, km: 25, days: D3, long: "sun", vdot: 33 })],
  ["11b 6d-v65-90km-12w-brz-rl26", inp({ weeks: 12, km: 90, days: D6, long: "sun", vdot: 65, recentLongRunKm: 26 })],
  ["14b pocetnik-5d-e450-20km-20w", inp({ weeks: 20, km: 20, days: D5, long: "sun", easyPaceSecPerKm: 450, beginner: true })],
  ["18 5d-v52-60km-20w-rl25-dugiSub-trkaSub", inp({ weeks: 20, km: 60, days: ["mon", "tue", "thu", "fri", "sat"], long: "sat", vdot: 52, race: "sat", recentLongRunKm: 25 })],
];

const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
type Seg = { kind: string; zone: string; km: number; sec: number; paceSecPerKm: number };
type Wo = { km: number; sec: number; title: string; segments?: Seg[]; workKm?: Record<string, number>; dose?: { ladder: string; doseM: number; step: string } | null };
const wo = (x: Week["days"][number]) => x.workout as unknown as Wo;
const QR = ["q1", "q2", "test", "sharpener"];

function qDesc(x: Week["days"][number]): string {
  const w = wo(x);
  const segs = w.segments ?? [];
  const wu = segs.filter((s) => s.kind === "warmup").reduce((a, s) => a + s.sec, 0);
  const cd = segs.filter((s) => s.kind === "cooldown").reduce((a, s) => a + s.sec, 0);
  const work = segs.filter((s) => ["rep", "continuous"].includes(s.kind));
  const pace = [...new Set(work.map((s) => `${s.zone}@${mmss(s.paceSecPerKm)}`))].join(",");
  const dose = w.dose ? `${w.dose.ladder} ${w.dose.doseM}m ${w.dose.step}` : "";
  return `${weekdayOf(x.date)} ${x.role} „${w.title.replace(/\s+/g, " ")}" ${f1(w.km)}km/${Math.round(w.sec / 60)}' [${dose}; WU ${Math.round(wu / 60)}' CD ${Math.round(cd / 60)}'; ${pace}]`;
}

function weekStats(w: Week) {
  const zk: Record<string, number> = {};
  let tot = 0;
  for (const x of w.days) {
    if (!x.countsToWeek) continue;
    for (const s of wo(x).segments ?? []) {
      zk[s.zone] = (zk[s.zone] ?? 0) + s.km;
      tot += s.km;
    }
  }
  const hard = (zk["T"] ?? 0) + (zk["I"] ?? 0) + (zk["R"] ?? 0) + (zk["RP"] ?? 0) + (zk["test"] ?? 0);
  return { zk, tot, hardPct: tot ? (100 * hard) / tot : 0 };
}

const out: string[] = [];
const L = (s: string) => out.push(s);
for (const [id, input] of PROFILES) {
  L(`\n=== ${id}`);
  L(`ulaz: ${JSON.stringify(input)}`);
  const g = d.generate(input);
  if (!g.ok) {
    L(`ODBIJEN: ${g.reasons.map((r) => `${r.code}: ${r.message}`).join(" | ")}`);
    continue;
  }
  const p = g.plan as Plan & { paces?: Record<string, unknown>; goal?: { status: string; goalVdot: number; vdotGap: number; message: string } | null; predictedHmSec?: number | null; peakKm?: number; startKm?: number; notes?: string[]; policyId?: string; policyVersion?: string; paceBasis?: string };
  L(`policy ${p.policyId}/${p.policyVersion} · vdot ${p.vdot} · paceBasis ${p.paceBasis ?? "-"} · tempo ${JSON.stringify(p.paces)} · predikcija HM ${p.predictedHmSec ? mmss(p.predictedHmSec) : "-"} · startKm ${p.startKm} · vrh ${p.peakKm}`);
  if (p.goal) L(`cilj: ${p.goal.status} goalVdot ${p.goal.goalVdot} gap ${p.goal.vdotGap} — „${p.goal.message}"`);
  for (const n of p.notes ?? []) L(`napomena plana: ${n}`);
  for (const v of p.warnings) L(`upozorenje: ${(v as { rule?: string }).rule ?? v.code}: ${v.message}`);
  let prevT = 0;
  for (const w of p.weeks) {
    const longD = w.days.find((x) => x.role === "long");
    const easy = w.days.filter((x) => x.role === "easy").map((x) => f1(wo(x).km));
    const st = weekStats(w);
    const lpct = longD && w.plannedKm ? (100 * wo(longD).km) / w.plannedKm : 0;
    const gr = prevT ? `${(((w.targetKm - prevT) / prevT) * 100).toFixed(0)}%` : "";
    const zs = ["T", "I", "R", "RP"].filter((z) => st.zk[z]).map((z) => `${z} ${f1(st.zk[z]!)}km(${((100 * st.zk[z]!) / st.tot).toFixed(0)}%)`).join(" ");
    L(`- n${w.index} ${w.phase}${w.deload ? " R" : ""}${w.test ? " test" : ""} cilj ${f1(w.targetKm)} plan ${f1(w.plannedKm)} (${gr}) | dugi ${longD ? `${f1(wo(longD).km)}km/${Math.round(wo(longD).sec / 60)}' ${lpct.toFixed(0)}%` : "-"} | lagani [${easy.join(",")}] | teško ${st.hardPct.toFixed(0)}% ${zs}`);
    for (const x of w.days.filter((y) => QR.includes(y.role) || y.role === "race")) L(`    ${qDesc(x)}`);
    const rest = w.days.map((x) => `${weekdayOf(x.date).slice(0, 2)}:${x.role}`).join(" ");
    L(`    raspored: ${rest}`);
    for (const n of w.notes) L(`    napomena: ${n}`);
    prevT = w.targetKm;
  }
  const last = p.weeks[p.weeks.length - 1]!;
  const raceDay = last.days.find((x) => x.role === "race");
  if (raceDay) {
    const before = p.weeks.flatMap((w) => w.days).find((x) => x.date === addDays(raceDay.date, -1));
    L(`dan pred trku: ${before ? `${before.role} ${f1(wo(before).km)}km` : "odmor"}`);
  }
}
console.log(out.join("\n"));
