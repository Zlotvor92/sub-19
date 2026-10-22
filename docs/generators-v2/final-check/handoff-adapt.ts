/* Faza 4 pre-final (22. 10.), zadatak 2e — plan CILJA posle predaje „kraća distanca" (plan sa prefiksom izvora), pa
   adaptacija cilja sa 17 scenarija. Predaja kroz PRAVI kod aplikacije (bez izmene web/**):
   `<cilj>/v2/app/handoffTarget.handoffFuture(planIzvoraZaUpis, contractInput izvora, asOf, {}, { raw: činjenice })`,
   kao `select.shorterHandoffForV2Source` (3d: HM/maraton → 5K; 3f: maraton → HM). 10K cilj (3d-10K) još nije na grani.
   Izvor: uzorak lib.sampleBases distance izvora; predaja na kraju ned 2 i ned ⌊N/2⌋; činjenice izvora none/under50/pain8.
   Adaptacija cilja (domen cilja nad planom v2 iz plana za upis): asOf = start cilja (prvi dan), sreda i kraj ned 1,
   sreda ned 2; činjenice cilja = lib facts cilja nad planom cilja, u dva oblika: new (samo nove) i cum (+ činjenice
   izvora bez dayId, kao dnevnik). Iz web/:
   node ../docs/generators-v2/final-check/handoff-adapt.ts <HM>5K|MAR>HM|MAR>5K> <kR> <kF> <kB> > out.json */

import { addDays, distOf, SCENARIOS, sampleBases, wedOf, type Plan } from "./lib.ts";
import { flow, mergeFacts, print, tally } from "./pre-lib.ts";
import * as hmPlan from "../../../web/src/domain/generators/halfMarathon/v2/app/plan.ts";
import * as hmPrep from "../../../web/src/domain/generators/halfMarathon/v2/app/preparation.ts";
import * as hmTarget from "../../../web/src/domain/generators/halfMarathon/v2/app/handoffTarget.ts";
import * as marPlan from "../../../web/src/domain/generators/marathon/v2/app/plan.ts";
import * as marPrep from "../../../web/src/domain/generators/marathon/v2/app/preparation.ts";
import * as fkTarget from "../../../web/src/domain/generators/fiveK/v2/app/handoffTarget.ts";

const [pair, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const [srcName, tgtName] = pair.split(">") as [string, string];
const src = distOf(srcName);
const tgt = distOf(tgtName);
const SRC = srcName === "HM" ? { plan: hmPlan, prep: hmPrep } : { plan: marPlan, prep: marPrep };
const TGT = tgtName === "HM" ? { fn: hmTarget.handoffFuture, key: "hmV2", prefixKey: "hmV2Prefix", distM: 21097.5 } : { fn: fkTarget.handoffFuture, key: "fiveKV2", prefixKey: "fiveKV2Prefix", distM: 5000 };
const strip = (f: Record<string, unknown>): Record<string, unknown> => {
  const { lockedDayIds: _l, ...rest } = f;
  const w = rest["workouts"] as Record<string, unknown>[] | undefined;
  return w ? { ...rest, workouts: w.map(({ dayId: _d, ...x }) => x) } : rest;
};

const t0 = Date.now();
const { bases } = sampleBases(src, { R: kR, F: kF, B: kB });
const handoff = { calls: 0, ok: 0, noPrefix: 0, errors: {} as Record<string, number>, errorEx: [] as string[] };
const adapt = { new: tally(), cum: tally() };
let sources = 0;
for (const b of bases) {
  const g = src.generate(b.input);
  if (!g.ok) continue;
  sources++;
  const p = g.plan;
  const N = p.weeks.length;
  const current = (SRC.plan as { storedPlan: (g: unknown) => unknown }).storedPlan((SRC.plan as { generatedPlan: (p: unknown) => unknown }).generatedPlan(p));
  const ci = { ...(SRC.prep as { contractInput: (v: unknown) => Record<string, unknown> }).contractInput(p), raceDistM: TGT.distM, goalSec: null };
  for (const at of [p.weeks[1]!.endDate, p.weeks[Math.floor(N / 2) - 1]!.endDate])
    for (const sc of ["none", "under50", "pain8"] as const) {
      handoff.calls++;
      const raw = src.facts(p, sc, at);
      const r = (TGT.fn as unknown as (...a: unknown[]) => { result?: Record<string, unknown>; error?: string })(current, ci, at, {}, { execution: null, restartFromBase: false, raw });
      if (!r.result) {
        const k = String(r.error).replace(/[0-9]+([.,][0-9]+)?/g, "#").slice(0, 90);
        handoff.errors[k] = (handoff.errors[k] ?? 0) + 1;
        if (handoff.errorEx.length < 4) handoff.errorEx.push(`${b.id}/${sc}/asOf ${at}: ${String(r.error).slice(0, 200)}`);
        continue;
      }
      handoff.ok++;
      if (!r.result[TGT.prefixKey]) handoff.noPrefix++;
      const tp = r.result[TGT.key] as Plan;
      const w1 = tp.weeks[0]!;
      const w2 = tp.weeks[1];
      const ats: [string, string][] = [["t1", w1.startDate], ["t1wed", wedOf(w1.startDate)], ["t1end", w1.endDate]];
      if (w2) ats.push(["t2wed", wedOf(w2.startDate)]);
      const f0 = strip(raw);
      for (const [tag, at2] of ats) {
        if (at2 >= tp.input.raceDate) continue;
        for (const s of SCENARIOS) {
          const f = tgt.facts(tp, s, at2);
          const k = `${b.id}/${sc}@${at}→${tgtName}/${tag} ${at2}/${s}`;
          flow(tgt, adapt.new, tp, f, at2, `new ${k}`, `${tag}/${s}`);
          flow(tgt, adapt.cum, tp, mergeFacts(f0, f), at2, `cum ${k}`, `${tag}/${s}`);
        }
      }
    }
}
print({ pair, step: { R: kR, F: kF, B: kB }, sources, handoff, adapt, seconds: (Date.now() - t0) / 1000 });
