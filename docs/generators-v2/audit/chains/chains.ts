/* Dubinska provera v2, UGAO 3 (chains) — nasumični lanci adaptacija (SAMO ČITANJE: uvozi v2 foldere, ništa ne menja).
   Lanac = slučajan realan ulaz (bazni ulaz mreže + slučajna perturbacija) → generate → 2–6 koraka adapt(plan, činjenice,
   asOf), asOf ∈ [start − 7, dan trke], neopadajuće. Činjenice su KUMULATIVNE (dnevnik aplikacije raste, kao
   app/facts.buildFacts): izvršeni/propušteni dani po planu u tom trenutku (po planu, manjak, višak, propušteno, bez zapisa),
   pauze (prijavljene ili izvedene iz pokrivenosti), bol (2–9), umor (RPE 8–9), novi rezultat (brži/sporiji, trka/test),
   zaključani dani (ručne izmene = lockedDayIds; skup važi samo za korak, kao snapshot izmena u aplikaciji).
   Provere u svakom koraku: odbijanje/izuzetak, lib.commonChecks (prošlost, urađeni, zaključani, prazan, dugi ≥ lagan,
   trkačka ≤ taper), invarijante distance, determinizam (isti poziv dvaput), ponovna primena (adapt(novi, iste činjenice,
   isti asOf) = isti weeks), policyId/policyVersion/faza, pouka 37 (nezavisno, zbir zaštićenih po činjenicama),
   pouka 38 (zaštićen test ostaje, nema drugog testa), prošle nedelje (endDate ≤ asOf) — polja nedelje.
   Iz web/:  node ../docs/generators-v2/audit/chains/chains.ts <5K|10K|HM|MAR> <seed> <od> <do> [--dump i]
   Svaki lanac i ima svoj generator slučajnosti (seed, i) → ponovljiv sam za sebe. */

import { addDays, commonChecks, distOf, weekdayOf, type Dist, type Plan } from "../../final-check/lib.ts";
import { raceTimeForVdot as rt } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";

/* ---------- slučajnost ---------- */
export function rngOf(seed: number, i: number): () => number {
  let a = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type R = () => number;
const ri = (r: R, a: number, b: number): number => a + Math.floor(r() * (b - a + 1));
const pick = <X>(r: R, xs: readonly X[]): X => xs[Math.floor(r() * xs.length)]!;
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const S = JSON.stringify;

/* ---------- ulaz ---------- */
const RES: Record<string, { test: number; race: number }> = {
  "5K": { test: 3000, race: 5000 },
  "10K": { test: 5000, race: 10000 },
  HM: { test: 10000, race: 21097.5 },
  MAR: { test: 10000, race: 21097.5 },
};
const baseCache = new Map<string, ReturnType<Dist["all"]>>();
export function randomInput(d: Dist, r: R): { id: string; input: Record<string, unknown> } {
  const all = baseCache.get(d.name) ?? d.all();
  baseCache.set(d.name, all);
  const b = all[Math.floor(r() * all.length)]!;
  const inp = structuredClone(b.input) as Record<string, any>;
  const shift = ri(r, -10, 20) * 7 + ri(r, -3, 3); // pomeren start (i dan u nedelji)
  inp.startDate = addDays(inp.startDate, shift);
  inp.raceDate = addDays(inp.raceDate, shift + pick(r, [0, 0, 0, -7, 7, 14]));
  inp.currentWeeklyKm = Math.max(5, Math.round(inp.currentWeeklyKm * (0.85 + 0.3 * r()) * 2) / 2);
  const rr = inp.recentResult;
  if (rr && typeof rr === "object") {
    rr.timeSec = Math.round(rr.timeSec * (0.96 + 0.08 * r()));
    rr.date = addDays(inp.startDate, -ri(r, 0, 84));
  }
  for (const k of ["easyPaceSecPerKm", "typicalEasyPaceSecPerKm"])
    if (typeof inp[k] === "number") inp[k] = inp[k] + ri(r, -20, 20);
  if ((d.name === "HM" || d.name === "MAR") && r() < 0.4)
    inp.recentLongRunKm = r1(Math.max(4, inp.currentWeeklyKm * (0.2 + 0.25 * r())));
  return { id: `${b.id}~${shift}`, input: inp };
}
/** Realan trkač (brief): VDOT ≤ 70; početnik VDOT ≤ 45 i lagan ≥ 330 s/km; najduži skorašnji dugi razuman. */
export function realistic(p: Plan): boolean {
  const i = p.input as Record<string, any>;
  if (p.vdot != null && p.vdot > 70) return false;
  const easy = i.easyPaceSecPerKm ?? i.typicalEasyPaceSecPerKm;
  if (i.experience === "beginner") {
    if (p.vdot != null && p.vdot > 45) return false;
    if (typeof easy === "number" && easy < 330) return false;
  }
  if (typeof i.recentLongRunKm === "number") {
    const per = i.currentWeeklyKm / i.runDays.length;
    if (i.recentLongRunKm < per * 0.8 || i.recentLongRunKm > i.currentWeeklyKm * 0.6) return false;
  }
  return true;
}

/* ---------- činjenice (kumulativni dnevnik) ---------- */
interface WF { date: string; dayId?: string; km: number; durationSec: number; completed: boolean; rpe?: number; pain?: number }
interface Log {
  workouts: Map<string, WF>;
  results: { distM: number; sec: number; date: string; kind: "race" | "test" }[];
  breaks: { kind: "break"; from: string; to: string }[];
  cov: "complete" | "incomplete" | "none";
  covFrom: string;
}
export interface StepSpec { asOf: string; regime: string; events: string[]; locked: string[] }
const dayMap = (p: Plan) => new Map(p.weeks.flatMap((w) => w.days.map((x) => [x.date, x] as const)));
const isTest = (x: { workout: { kind: string; segments?: { kind: string }[] } }) =>
  x.workout.kind === "test" || (x.workout.segments ?? []).some((s) => s.kind === "test");

function fill(log: Log, p: Plan, from: string, to: string, regime: string, r: R): void {
  const dm = dayMap(p);
  const inp = p.input;
  if (regime === "pauseBreak") {
    if (from <= to) log.breaks.push({ kind: "break", from, to });
    return;
  }
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const pd = dm.get(d);
    let km: number, sec: number;
    if (pd) {
      if (!pd.countsToWeek) continue;
      km = pd.workout.km;
      sec = pd.workout.sec;
    } else if (d < inp.startDate && inp.runDays.includes(weekdayOf(d))) {
      km = inp.currentWeeklyKm / inp.runDays.length;
      sec = km * 360;
    } else continue;
    let share = 1;
    let done = true;
    switch (regime) {
      case "plan": share = 0.95 + 0.1 * r(); break;
      case "under": share = 0.3 + 0.5 * r(); break;
      case "over": share = 1.15 + 0.3 * r(); break;
      case "miss": if (r() < 0.5) done = false; break;
      case "mixed": { const x = r(); share = x < 0.2 ? 0 : x < 0.4 ? 0.6 : x < 0.9 ? 1 : 1.3; if (share === 0) done = r() < 0.5 ? false : true; break; }
      case "pauseSilent": continue; // bez zapisa (pauza vidljiva samo uz potpunu pokrivenost)
    }
    if (done && share === 0) continue;
    log.workouts.set(d, {
      date: d,
      ...(pd ? { dayId: d } : {}),
      km: done ? r2(km * share) : 0,
      durationSec: done ? Math.round(sec * share) : 0,
      completed: done,
      rpe: ri(r, 3, 6),
    });
  }
}
function factsOfLog(log: Log, asOf: string, locked: string[]): Record<string, unknown> {
  const workouts = [...log.workouts.values()].filter((w) => w.date <= asOf).sort((a, b) => a.date.localeCompare(b.date));
  return {
    workouts: structuredClone(workouts),
    results: structuredClone(log.results.filter((x) => x.date <= asOf)),
    breaks: structuredClone(log.breaks),
    lockedDayIds: [...locked],
    ...(log.cov === "none" ? {} : { coverage: { from: log.covFrom, to: asOf, complete: log.cov === "complete" } }),
  };
}

/* ---------- nezavisne provere ---------- */
const WARN37 = new Set(["MIXED_OVER_TARGET", "MIXED_WEEK_OVER"]);
function protKm(p: Plan, w: Plan["weeks"][number], asOf: string, facts: any, prot: (d: string) => boolean): { kept: number; free: number; nKept: number; nFree: number } {
  const wk = new Map<string, WF>((facts.workouts ?? []).map((x: WF) => [x.date, x]));
  const inBreak = (d: string) => (facts.breaks ?? []).some((b: any) => b.from <= d && d <= b.to);
  const cov = facts.coverage;
  let kept = 0, free = 0, nKept = 0, nFree = 0;
  for (const x of w.days) {
    if (!x.countsToWeek) continue;
    if (prot(x.date)) {
      nKept++;
      const f = wk.get(x.date);
      if (inBreak(x.date)) kept += 0;
      else if (f) kept += f.completed ? f.km : 0;
      else if (cov && cov.complete && cov.from <= x.date && x.date <= cov.to) kept += 0;
      else kept += x.workout.km;
    } else { nFree++; free += x.workout.km; }
  }
  void p; void asOf;
  return { kept, free, nKept, nFree };
}
export function extraChecks(d: Dist, before: Plan, after: Plan, asOf: string, facts: any): string[] {
  const bad: string[] = [];
  const pa = after as any;
  if (!pa.policyId || !pa.policyVersion) bad.push("POLICY_ID_NEDOSTAJE");
  for (const w of after.weeks) if (typeof w.phase !== "string" || !w.phase) bad.push("FAZA_NEDOSTAJE");
  const locked = new Set<string>(facts.lockedDayIds ?? []);
  const done = new Set<string>((facts.workouts ?? []).filter((x: WF) => x.completed).map((x: WF) => x.dayId ?? x.date));
  const prot = (dt: string) => dt <= asOf || locked.has(dt) || done.has(dt);
  // Pouka 37 (nezavisno): nedelja sa zaštićenim i preostalim (posle asOf, ne zaključan/urađen) danima.
  const tol = d.name === "5K" ? 0.05 : 0.1;
  for (const w of after.weeks) {
    if (w.phase === "race") continue;
    const k = protKm(after, w, asOf, facts, prot);
    if (k.nKept === 0 || k.nFree === 0) continue;
    if (k.kept + k.free > w.targetKm + tol + 1e-6 && !after.warnings.some((v: any) => WARN37.has(v.rule ?? v.code) && v.week === w.index))
      bad.push(`P37_MESOVITA_IZNAD_CILJA_BEZ_UPOZORENJA`);
  }
  // Pouka 38: zaštićen test iz prethodnog plana ostaje; nijedan drugi test u novom planu.
  const tb = before.weeks.flatMap((w) => w.days).filter((x) => isTest(x as never));
  const ta = after.weeks.flatMap((w) => w.days).filter((x) => isTest(x as never));
  const protTests = tb.filter((x) => prot(x.date));
  for (const t of protTests) {
    if (!ta.some((x) => x.date === t.date)) bad.push("P38_ZASTICEN_TEST_POMEREN");
    if (ta.some((x) => x.date !== t.date)) bad.push("P38_DRUGI_TEST");
  }
  // Prošle nedelje (endDate ≤ asOf): polja nedelje bez dana i napomena.
  const bw = new Map(before.weeks.map((w) => [w.startDate, w] as const));
  for (const w of after.weeks) {
    if (w.endDate > asOf) continue;
    const b = bw.get(w.startDate);
    if (!b) { bad.push("PROSLA_NEDELJA_NESTALA"); continue; }
    for (const f of ["targetKm", "plannedKm", "phase", "deload", "index"] as const)
      if (S((b as any)[f]) !== S((w as any)[f])) bad.push(`PROSLA_NEDELJA_POLJE:${f}`);
  }
  // Degenerisano: buduća nedelja (sve posle asOf, ne trkačka) bez trčanja ili ispod 40 % cilja.
  for (const w of after.weeks)
    if (w.startDate > asOf && w.phase !== "race") {
      const km = w.days.filter((x) => x.countsToWeek).reduce((a, x) => a + x.workout.km, 0);
      if (km <= 0) bad.push("BUDUCA_NEDELJA_PRAZNA");
      else if (km < 0.4 * w.targetKm) bad.push(`BUDUCA_NEDELJA<40%CILJA|ned ${w.index} ${r2(km)}/${w.targetKm} ${w.phase} ${w.days.map((x) => x.role).join(",")}`);
    }
  return bad;
}
/** Prva razlika dva niza nedelja (za opis neidempotentnosti). */
function firstDiff(a: Plan, b: Plan): string {
  for (let i = 0; i < Math.max(a.weeks.length, b.weeks.length); i++) {
    const x = a.weeks[i], y = b.weeks[i];
    if (S(x) === S(y)) continue;
    if (!x || !y) return `ned ${i + 1} postoji samo u jednom`;
    for (const f of ["targetKm", "plannedKm", "phase", "deload"] as const)
      if (S((x as any)[f]) !== S((y as any)[f])) return `ned ${x.index} ${f} ${S((x as any)[f])}→${S((y as any)[f])}`;
    for (let j = 0; j < Math.max(x.days.length, y.days.length); j++)
      if (S(x.days[j]) !== S(y.days[j])) return `ned ${x.index} dan ${x.days[j]?.date ?? y.days[j]?.date} ${x.days[j]?.workout.title ?? "-"} → ${y.days[j]?.workout.title ?? "-"}`;
    return `ned ${x.index} notes/ostalo`;
  }
  return "weeks isti";
}

/* ---------- jedan lanac ---------- */
export interface ChainOut {
  i: number;
  id: string;
  real: boolean;
  generated: boolean;
  steps: StepSpec[];
  findings: { step: number; cls: string; detail: string }[];
  rejected: boolean;
  plan?: Plan;
}
const REGIMES = ["plan", "plan", "plan", "under", "over", "miss", "mixed", "pauseBreak", "pauseSilent"] as const;
export function runChain(d: Dist, seed: number, i: number, opts: { trace?: any[]; keepPlans?: boolean; startPlan?: Plan; startAsOf?: string; nSteps?: number; log?: Log } = {}): ChainOut {
  const r = rngOf(seed, i);
  let id = "handoff";
  let p: Plan;
  if (opts.startPlan) p = opts.startPlan;
  else {
    // do 8 pokušaja slučajnog ulaza dok generator ne prihvati (odbijanja ulaza su ugao fuzz, ne lanci)
    let g: ReturnType<Dist["generate"]> | null = null;
    for (let t = 0; t < 8 && !(g && g.ok); t++) {
      const ri0 = randomInput(d, r);
      id = ri0.id;
      g = d.generate(ri0.input);
    }
    if (!g || !g.ok) return { i, id, real: false, generated: false, steps: [], findings: [], rejected: false };
    p = g.plan;
  }
  const out: ChainOut = { i, id, real: realistic(p), generated: true, steps: [], findings: [], rejected: false };
  const start = p.input.startDate, race = p.input.raceDate;
  const span = (Date.parse(race) - Date.parse(start)) / 86400000;
  const n = opts.nSteps ?? ri(r, 2, 6);
  let asOf = opts.startAsOf ?? addDays(start, ri(r, -7, Math.max(-7, Math.floor(span * 0.75))));
  const log: Log = opts.log ?? {
    workouts: new Map(), results: [], breaks: [],
    cov: pick(r, ["complete", "complete", "complete", "incomplete", "none"] as const),
    covFrom: addDays(start, -14),
  };
  let filledTo = opts.log ? asOf : addDays(start, -15);
  const base = (p.vdot ?? 40) as number;
  let vdot = base;
  for (let k = 0; k < n; k++) {
    if (k > 0) asOf = addDays(asOf, pick(r, [0, 1, 1, 2, 3, 4, 5, 6, 7, 7, 9, 10, 14]));
    if (asOf >= race) break; // asOf = dan trke: dokumentovano odbijanje ADAPT_AS_OF_INVALID (izmereno posebno)
    const regime = pick(r, REGIMES);
    // dnevnik do asOf po planu u tom trenutku
    if (filledTo < asOf) {
      // pre prvog koraka: 14 dana pre starta po trenutnom obimu
      fill(log, p, addDays(filledTo, 1), asOf, k === 0 && !opts.log ? "plan" : regime, r);
      filledTo = asOf;
    }
    const events: string[] = [];
    const nEv = pick(r, [0, 0, 1, 1, 1, 2]);
    for (let e = 0; e < nEv; e++) {
      const ev = pick(r, ["pain", "pain", "fatigue", "faster", "slower", "test", "done", "missed"] as const);
      if (ev === "pain") {
        const lv = ri(r, 2, 9);
        const dt = addDays(asOf, -ri(r, 0, 2));
        if (dt < addDays(start, -14)) continue;
        const w = log.workouts.get(dt);
        if (w) w.pain = Math.max(w.pain ?? 0, lv);
        else log.workouts.set(dt, { date: dt, km: 0, durationSec: 0, completed: false, pain: lv });
        events.push(`pain${lv}@${dt}`);
      } else if (ev === "fatigue") {
        const ws = [...log.workouts.values()].filter((w) => w.completed && w.date <= asOf).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
        for (const w of ws) w.rpe = ri(r, 8, 9);
        if (ws.length) events.push(`fatigue@${ws.map((w) => w.date).join(",")}`);
      } else if (ev === "faster" || ev === "slower" || ev === "test") {
        vdot = r1(vdot + (ev === "slower" ? -1 : 1) * (0.5 + 3.5 * r()));
        const kind = ev === "test" ? "test" : pick(r, ["race", "test"] as const);
        const distM = kind === "test" ? RES[d.name]!.test : RES[d.name]!.race;
        const dt = addDays(asOf, -ri(r, 0, 3));
        log.results.push({ distM, sec: Math.round(rt(vdot, distM)), date: dt, kind });
        events.push(`${ev}:${kind}${distM}@${dt}v${vdot}`);
      } else if (ev === "done" || ev === "missed") {
        // urađen/propušten dan (dan plana ≤ asOf u tekućoj nedelji)
        const dm = [...dayMap(p).values()].filter((x) => x.date <= asOf && x.date >= addDays(asOf, -6) && x.countsToWeek);
        if (!dm.length) continue;
        const x = pick(r, dm);
        log.workouts.set(x.date, ev === "done"
          ? { date: x.date, dayId: x.date, km: x.workout.km, durationSec: x.workout.sec, completed: true, rpe: 5 }
          : { date: x.date, dayId: x.date, km: 0, durationSec: 0, completed: false });
        events.push(`${ev}@${x.date}`);
      }
    }
    // zaključani dani (ručne izmene): 0–3 budućih dana, ponekad dan testa
    const fut = p.weeks.flatMap((w) => w.days).filter((x) => x.date > asOf && x.role !== "race");
    const locked: string[] = [];
    const nl = pick(r, [0, 0, 0, 1, 1, 2, 3]);
    for (let j = 0; j < nl && fut.length; j++) {
      const x = r() < 0.3 ? fut.find((y) => isTest(y as never)) ?? pick(r, fut.slice(0, 14)) : pick(r, fut.slice(0, 14));
      if (!locked.includes(x.date)) locked.push(x.date);
    }
    locked.sort();
    const spec: StepSpec = { asOf, regime, events, locked };
    out.steps.push(spec);
    const facts = factsOfLog(log, asOf, locked);
    let res;
    try {
      res = d.adapt(p, facts, asOf);
    } catch (e) {
      out.findings.push({ step: k, cls: "THROW", detail: String(e).slice(0, 200) });
      out.rejected = true;
      break;
    }
    if (!res.ok) {
      opts.trace?.push({ asOf, facts, before: p, after: null, rejected: res });
      const vs = ((res as any).violations ?? []).filter((v: any) => v.severity === "error");
      const c = vs.length ? `REJECT:VALIDATOR:${vs[0].rule}` : `REJECT:${res.reasons[0]?.code}`;
      const msg = vs.length ? vs.map((v: any) => v.message).join(" | ") : res.reasons.map((x) => x.message).join(" | ");
      out.findings.push({ step: k, cls: c, detail: msg.slice(0, 300) });
      out.rejected = true;
      break;
    }
    const q = res.plan;
    opts.trace?.push({ asOf, facts, before: p, after: q, reasons: (res as any).reasons });
    for (const v of commonChecks(p, q, asOf, facts)) out.findings.push({ step: k, cls: `COMMON:${v}`, detail: "" });
    if (d.inv) for (const v of d.inv(p, q, asOf, facts)) out.findings.push({ step: k, cls: `INV:${v.replace(/[0-9.,-]+/g, "#").slice(0, 70)}`, detail: v });
    for (const v of extraChecks(d, p, q, asOf, facts)) { const [c, det] = v.split("|"); out.findings.push({ step: k, cls: c!, detail: det ?? "" }); }
    const cond = ((res as any).reasons ?? []).filter((x: any) => x.applied).map((x: any) => x.condition).join("+") || "-";
    // determinizam
    const res2 = d.adapt(p, structuredClone(facts), asOf);
    if (!res2.ok || S(res2.plan) !== S(q)) out.findings.push({ step: k, cls: "NEDETERMINIZAM", detail: res2.ok ? firstDiff(q, res2.plan) : "drugi poziv odbijen" });
    // ponovna primena iste adaptacije na adaptiran plan
    let res3;
    try { res3 = d.adapt(q, structuredClone(facts), asOf); } catch (e) { res3 = null; out.findings.push({ step: k, cls: "IDEMP:THROW", detail: String(e).slice(0, 160) }); }
    if (res3) {
      if (!res3.ok) {
        const vs = ((res3 as any).violations ?? []).filter((v: any) => v.severity === "error");
        out.findings.push({ step: k, cls: `IDEMP:ODBIJENO:${vs.length ? vs[0].rule : res3.reasons[0]?.code}`, detail: (vs.length ? vs[0].message : res3.reasons[0]?.message ?? "").slice(0, 200) });
      } else if (S(res3.plan.weeks) !== S(q.weeks)) out.findings.push({ step: k, cls: "IDEMP:WEEKS", detail: `[${cond}] ${firstDiff(q, res3.plan)}` });
      else if (S(res3.plan.warnings) !== S(q.warnings)) out.findings.push({ step: k, cls: "IDEMP:WARNINGS", detail: "" });
    }
    // sledeći dan bez novih činjenica (iste činjenice, pokrivenost do asOf): budući ciljevi ne smeju pasti kaskadno
    const at1 = addDays(asOf, 1);
    if (at1 < race) {
      let r4;
      try { r4 = d.adapt(q, structuredClone(facts), at1); } catch (e) { r4 = null; out.findings.push({ step: k, cls: "NEXT_DAY:THROW", detail: String(e).slice(0, 160) }); }
      if (r4 && !r4.ok) {
        const vs = ((r4 as any).violations ?? []).filter((v: any) => v.severity === "error");
        out.findings.push({ step: k, cls: `NEXT_DAY:ODBIJENO:${vs.length ? vs[0].rule : r4.reasons[0]?.code}`, detail: (vs.length ? vs[0].message : r4.reasons[0]?.message ?? "").slice(0, 200) });
      } else if (r4) {
        const qm = new Map(q.weeks.map((w) => [w.index, w.targetKm] as const));
        const drop = r4.plan.weeks.filter((w) => w.startDate > addDays(at1, 0) && w.phase !== "race" && w.targetKm < (qm.get(w.index) ?? 0) * 0.9 - 0.05);
        if (drop.length) out.findings.push({ step: k, cls: "NEXT_DAY:CILJ_PAO>10%", detail: `[${cond}] ` + drop.slice(0, 3).map((w) => `ned ${w.index} ${qm.get(w.index)}→${w.targetKm}`).join(", ") });
      }
    }
    p = q;
  }
  if (opts.keepPlans) out.plan = p;
  (out as any).log = log;
  return out;
}

/* ---------- glavni ---------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const [name, seedS, fromS, toS] = process.argv.slice(2);
  const dumpI = process.argv.indexOf("--dump");
  const d = distOf(name!);
  const seed = Number(seedS);
  if (dumpI > 0) {
    const i = Number(process.argv[dumpI + 1]);
    const o = runChain(d, seed, i);
    console.log(JSON.stringify({ ...o, log: undefined }, null, 1));
    process.exit(0);
  }
  const from = Number(fromS), to = Number(toS);
  const t0 = Date.now();
  const sum = { dist: name, seed, from, to, chains: 0, generated: 0, genFailed: 0, real: 0, steps: 0, stepsReal: 0, rejectedChains: 0, cls: {} as Record<string, { real: number; unreal: number; flowsReal: number; flowsUnreal: number; shortest: { i: number; len: number; step: number; real: boolean; steps: StepSpec[]; id: string; detail: string } | null; ex: string[] }> };
  for (let i = from; i < to; i++) {
    const o = runChain(d, seed, i);
    sum.chains++;
    if (!o.generated) { sum.genFailed++; continue; }
    sum.generated++;
    if (o.real) sum.real++;
    sum.steps += o.steps.length;
    if (o.real) sum.stepsReal += o.steps.length;
    if (o.rejected) sum.rejectedChains++;
    const seen = new Set<string>();
    for (const f of o.findings) {
      const c = (sum.cls[f.cls] ??= { real: 0, unreal: 0, flowsReal: 0, flowsUnreal: 0, shortest: null, ex: [] });
      if (o.real) c.flowsReal++; else c.flowsUnreal++;
      if (!seen.has(f.cls)) { seen.add(f.cls); if (o.real) c.real++; else c.unreal++; }
      const len = f.step + 1;
      // najkraći: prvo realan, pa najmanje koraka
      const better = !c.shortest || (o.real && !c.shortest.real) || (o.real === c.shortest.real && len < c.shortest.len);
      if (better) c.shortest = { i, len, step: f.step, real: o.real, steps: o.steps.slice(0, len), id: o.id, detail: f.detail };
      if (c.ex.length < 3 && f.detail) c.ex.push(`${i}/${f.step}: ${f.detail}`);
    }
  }
  console.log(JSON.stringify({ ...sum, seconds: (Date.now() - t0) / 1000 }, null, 1));
}
