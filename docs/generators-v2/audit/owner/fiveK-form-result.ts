/* Ugao 4, 5K v2 — „rezultat koji menja tempo" ima dve definicije:
   - jezgro assess.ts:289–313: svež (≤ adapt.resultMaxAgeDays), noviji od rezultata u upotrebi I VDOT u opsegu input.vdot
     (30–60; 08k) — inače RESULT_IGNORED;
   - aplikacija app/form.ts:88–103 (Forma): svež i noviji → status 'pending' „čeka prilagođavanje plana" (bez provere opsega).
   Tok: plan po osećaju (porodice F i B mreže lib.grid5k — sve), test 3 km (T3kRecord) na asOf = sreda nedelje 3, vreme za
   VDOT iz skupa ispod (realan početnik: VDOT 22–29; iskusan: 61–70). Poredi se Forma (formHistory) i adaptacija sa istim
   činjenicama (app buildFacts → adaptFiveKV2). Bez slučajnosti.
   Iz web/: node ../docs/generators-v2/audit/owner/fiveK-form-result.ts */

import { DISTS, wedOf } from "../../final-check/lib.ts";
import { adaptFiveKV2 } from "../../../../web/src/domain/generators/fiveK/v2/adapt.ts";
import { formHistory } from "../../../../web/src/domain/generators/fiveK/v2/app/form.ts";
import { buildFacts } from "../../../../web/src/domain/generators/fiveK/v2/app/facts.ts";
import { generatedPlan, storedPlan } from "../../../../web/src/domain/generators/fiveK/v2/app/plan.ts";
import { raceTimeForVdot, vdotFromResult } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";
import type { FiveKV2Plan } from "../../../../web/src/domain/generators/fiveK/v2/types.ts";

const VDOTS = [22, 25, 28, 29.5, 61, 65, 70];
const d5 = DISTS.find((d) => d.name === "5K")!;
const bases = d5.all().filter((b) => b.family === "F" || b.family === "B");
const out = { plans: 0, cases: 0, pendingButIgnored: 0, pendingAndApplied: 0, other: 0, byVdot: {} as Record<string, number>, ex: [] as string[] };
const t0 = Date.now();
for (const b of bases) {
  const g = d5.generate(b.input);
  if (!g.ok) continue;
  const plan = g.plan as unknown as FiveKV2Plan;
  if (plan.paceMode !== "feel") continue;
  out.plans++;
  const today = wedOf(plan.weeks[2]!.startDate);
  const stored = storedPlan(generatedPlan(plan));
  for (const v of VDOTS) {
    const sec = Math.round(raceTimeForVdot(v, 3000));
    const tests = [{ id: "t1", date: today, sec }];
    out.cases++;
    const fh = formHistory({ plan: stored, today, tests });
    const pt = fh?.points.find((p) => p.date === today && p.kind === "test");
    const facts = buildFacts({ today, plan: stored, log: {}, tests }, plan).facts;
    const r = adaptFiveKV2(plan, facts, today);
    const ignored = r.ok && r.reasons.some((x) => x.condition === "RESULT_IGNORED" && /van 30–60/.test(x.message));
    const applied = r.ok && r.reasons.some((x) => x.condition === "NEW_RESULT" && x.applied);
    if (pt?.status === "pending" && ignored) {
      out.pendingButIgnored++;
      const k = `${b.family}:${v}`;
      out.byVdot[k] = (out.byVdot[k] ?? 0) + 1;
      if (out.ex.length < 4)
        out.ex.push(`${b.id}, asOf ${today}, test 3 km ${sec} s (VDOT ${Math.round(vdotFromResult(3000, sec) * 10) / 10}): Forma „${pt.label}" [${pt.status}] — adaptacija: ${r.ok ? r.reasons.find((x) => x.condition === "RESULT_IGNORED")!.message : "odbijena"}`);
    } else if (pt?.status === "pending" && applied) out.pendingAndApplied++;
    else out.other++;
  }
}
console.log(JSON.stringify({ vdots: VDOTS, ...out, seconds: (Date.now() - t0) / 1000 }, null, 1));
