/* UGAO 3 (chains) — lanci posle predaje „kraća distanca" (SAMO ČITANJE). Izvor HM/MAR v2: slučajan realan ulaz →
   1–2 adaptacije (chains.runChain) → predaja kroz pravi kod aplikacije (`<cilj>/v2/app/handoffTarget.handoffFuture`,
   kao final-check/handoff-adapt.ts; raw = kumulativne činjenice izvora) → cilj adaptiran 1–3 puta (chains.runChain nad
   planom cilja, dnevnik se nastavlja: zapisi izvora bez dayId, kao handoff-adapt „cum"). Iste provere kao chains.ts.
   Iz web/: node ../docs/generators-v2/audit/chains/handoff-chains.ts <HM>5K|HM>10K|MAR>HM|MAR>10K|MAR>5K> <seed> <od> <do> */

import { addDays, distOf, type Plan } from "../../final-check/lib.ts";
import { rngOf, runChain, type StepSpec } from "./chains.ts";
import * as hmPlan from "../../../../web/src/domain/generators/halfMarathon/v2/app/plan.ts";
import * as hmPrep from "../../../../web/src/domain/generators/halfMarathon/v2/app/preparation.ts";
import * as hmTarget from "../../../../web/src/domain/generators/halfMarathon/v2/app/handoffTarget.ts";
import * as marPlan from "../../../../web/src/domain/generators/marathon/v2/app/plan.ts";
import * as marPrep from "../../../../web/src/domain/generators/marathon/v2/app/preparation.ts";
import * as fkTarget from "../../../../web/src/domain/generators/fiveK/v2/app/handoffTarget.ts";
import * as tkTarget from "../../../../web/src/domain/generators/tenK/v2/app/handoffTarget.ts";

const [pair, seedS, fromS, toS] = process.argv.slice(2) as [string, string, string, string];
const [srcName, tgtName] = pair.split(">") as [string, string];
const src = distOf(srcName);
const tgt = distOf(tgtName);
const SRC: any = srcName === "HM" ? { plan: hmPlan, prep: hmPrep } : { plan: marPlan, prep: marPrep };
const TGT: any =
  tgtName === "HM"
    ? { fn: hmTarget.handoffFuture, key: "hmV2", distM: 21097.5 }
    : tgtName === "10K"
      ? { fn: tkTarget.handoffFuture, key: "tenKV2", distM: 10000 }
      : { fn: fkTarget.handoffFuture, key: "fiveKV2", distM: 5000 };
const seed = Number(seedS);
const t0 = Date.now();
const sum = {
  pair, seed, from: Number(fromS), to: Number(toS), chains: 0, sourceOk: 0, sourceRejected: 0, handoffCalls: 0, handoffOk: 0,
  handoffErr: {} as Record<string, number>, handoffErrEx: [] as string[], targetSteps: 0, real: 0,
  cls: {} as Record<string, { real: number; unreal: number; shortest: any; ex: string[] }>,
};
for (let i = sum.from; i < sum.to; i++) {
  sum.chains++;
  const r = rngOf(seed ^ 0x5eed, i);
  const nSrc = 1 + Math.floor(r() * 2);
  // do 8 pokušaja izvora (podindeks i·8 + a) dok predaja ne prihvati: odbijanja predaje su uslovi ulaza cilja (broj
  // dana, obim, trajanje, starost rezultata) sa porukom — broje se, nisu nalaz lanca.
  let s: any = null, p: Plan | null = null, at = "", log: any = null, h: any = null;
  for (let a = 0; a < 8 && !(h && h.result); a++) {
    s = runChain(src, seed, i * 8 + a, { keepPlans: true, nSteps: nSrc });
    if (!s.generated || s.rejected || !s.plan || s.steps.length === 0) { if (s.rejected) sum.sourceRejected++; h = null; continue; }
    sum.sourceOk++;
    p = s.plan as Plan;
    at = s.steps[s.steps.length - 1]!.asOf;
    log = s.log;
    const raw = { workouts: structuredClone([...log.workouts.values()].filter((x: any) => x.date <= at)), results: structuredClone(log.results), breaks: structuredClone(log.breaks), ...(log.cov === "none" ? {} : { coverage: { from: log.covFrom, to: at, complete: log.cov === "complete" } }) };
    const current = SRC.plan.storedPlan(SRC.plan.generatedPlan(p));
    const ci = { ...SRC.prep.contractInput(p), raceDistM: TGT.distM, goalSec: null };
    sum.handoffCalls++;
    try { h = TGT.fn(current, ci, at, {}, { execution: null, restartFromBase: false, raw }); } catch (e) { h = { error: "THROW " + String(e) }; }
    if (!h.result) {
      const k = String(h.error).replace(/[0-9]+([.,][0-9]+)?/g, "#").slice(0, 100);
      sum.handoffErr[k] = (sum.handoffErr[k] ?? 0) + 1;
      if (sum.handoffErrEx.length < 6) sum.handoffErrEx.push(`${i * 8 + a} ${s.id} asOf ${at}: ${String(h.error).slice(0, 220)}`);
    }
  }
  if (!h || !h.result) continue;
  sum.handoffOk++;
  const tp = h.result[TGT.key] as Plan;
  // dnevnik cilja: zapisi izvora bez dayId (dani izvora nisu dani cilja)
  const tlog = { ...log, workouts: new Map([...log.workouts.entries()].map(([k, w]: any) => { const { dayId: _d, ...x } = w; return [k, x]; })) };
  const startAsOf = at < addDays(tp.input.startDate, -7) ? addDays(tp.input.startDate, -7) : at;
  const nT = 1 + Math.floor(r() * 3);
  const o = runChain(tgt, seed ^ 0x7a96, i, { startPlan: tp, startAsOf, nSteps: nT, log: tlog });
  sum.targetSteps += o.steps.length;
  if (o.real) sum.real++;
  const seen = new Set<string>();
  for (const f of o.findings) {
    const c = (sum.cls[f.cls] ??= { real: 0, unreal: 0, shortest: null, ex: [] });
    if (!seen.has(f.cls)) { seen.add(f.cls); if (o.real) c.real++; else c.unreal++; }
    if (!c.shortest || f.step + 1 < c.shortest.len)
      c.shortest = { i, len: f.step + 1, source: { id: s.id, steps: s.steps }, handoffAsOf: at, target: o.steps.slice(0, f.step + 1) as StepSpec[], detail: f.detail };
    if (c.ex.length < 3 && f.detail) c.ex.push(`${i}/${f.step}: ${f.detail}`);
  }
}
console.log(JSON.stringify({ ...sum, seconds: (Date.now() - t0) / 1000 }, null, 1));
