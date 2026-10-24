/* Ugao 4 (jedan vlasnik), maraton v2 — tokovi adaptacije na slučajnim realnim planovima (mar-gen-search.randomInput,
   isti seed) × tačke asOf mreže 04 (testInputs.adaptAsOfs) × 17 scenarija (testInputs.factsOf) + rezultat ±4 VDOT.
   Meri:
   (1) odbijanja adaptacije po kodu i greške validatora (PLAN_VIOLATES_POLICY → pravilo) — razilaženje validatora i
       konstruktora na deljenim veličinama;
   (2) „plafon trajanja" (150 min, M13) — konstruktor ga računa iz tempa NEDELJE (generate.ctxAt → pacesAt), a
       lengths.longShortOf (napomena N11 u generate.ts:410, upozorenje MARATHON_LONG_SHORT u validate.ts:688-699, ponuda
       shorter.ts:29) iz tempa PLANA (plan.paces = tempo poslednje nedelje). Broji planove u kojima je najduži dugi
       tačno na plafonu 150 min tempa svoje nedelje, a longShortOf kaže timeCapped = false (→ upozorenje „ograničava ga
       udeo dugog") ili obrnuto.
   Iz web/: node ../docs/generators-v2/audit/owner/mar-adapt-search.ts <broj planova> [seed]  (seed kao mar-gen-search) */

import { adaptMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/adapt.ts";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import { checkInput } from "../../../../web/src/domain/generators/marathon/v2/input.ts";
import { longShortOf, longTimeCap10 } from "../../../../web/src/domain/generators/marathon/v2/lengths.ts";
import { pacesAt } from "../../../../web/src/domain/generators/marathon/v2/steps.ts";
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import type { MarathonV2Plan } from "../../../../web/src/domain/generators/marathon/v2/types.ts";
import { randomInput } from "./mar-gen-search.ts";

const NB = Number(process.argv[2] ?? 100);
const SEED = Number(process.argv[3] ?? 4004);
const t0 = Date.now();
const res10 = (asOf: string, vdot: number) => ({
  results: [{ distM: 10000, sec: TM.timeForVdot(Math.max(30, Math.min(80, vdot)), 10000), date: asOf, kind: "race" }],
});

let bases = 0, flows = 0, ok = 0;
const codes: Record<string, number> = {};
const viol: Record<string, { n: number; ex: string }> = {};
const lsMismatch: Record<string, { n: number; ex: string }> = {};
let lsBelow = 0;
for (let i = 0; bases < NB && i < NB * 20; i++) {
  const inp = randomInput();
  const g = generateMarathonV2(inp);
  if (!g.ok) continue;
  bases++;
  const plan = g.plan as MarathonV2Plan;
  const chk = checkInput(plan.input);
  if (!chk.ok) continue;
  const scen: [string, (asOf: string) => Record<string, unknown>][] = [
    ...TM.SCENARIOS.map((s) => [s, (a: string) => TM.factsOf(plan, s, a)] as [string, (a: string) => Record<string, unknown>]),
    ["slower4", (a) => res10(a, Math.round((plan.vdot! - 4) * 10) / 10)],
    ["faster4", (a) => res10(a, Math.round((plan.vdot! + 4) * 10) / 10)],
  ];
  for (const { tag, asOf } of TM.adaptAsOfs(plan))
    for (const [s, f] of scen) {
      if ((s === "slower4" || s === "faster4" || s === "faster" || s === "slower") && plan.vdot === null) continue;
      flows++;
      const r = adaptMarathonV2(plan, f(asOf), asOf);
      const key = `base#${bases - 1} ${tag} ${s} asOf=${asOf}`;
      if (!r.ok) {
        for (const x of r.reasons) {
          codes[x.code] = (codes[x.code] ?? 0) + 1;
          // Odbijanje iz construct (validator u konstruktoru): pravilo je u poruci, violations je prazno.
          if (x.code === "PLAN_VIOLATES_POLICY" && r.violations.length === 0) {
            const k = "construct:" + x.message.split(":")[0];
            viol[k] ??= { n: 0, ex: key + " msg=" + x.message + " input=" + JSON.stringify(inp) };
            viol[k].n++;
          }
        }
        for (const v of r.violations.filter((v) => v.severity === "error")) {
          viol[v.rule] ??= { n: 0, ex: key };
          viol[v.rule].n++;
        }
        continue;
      }
      ok++;
      const a = r.plan;
      const ls = longShortOf(a.weeks, chk.rule.longShortKm, a.paces);
      if (!ls) continue;
      lsBelow++;
      const steps = a.adaptation?.steps ?? [];
      const ownCapped = a.weeks.some((w) =>
        w.days.some(
          (d) =>
            d.role === "long" &&
            d.workout.km === ls.longestKm &&
            Math.round(d.workout.km * 10) === longTimeCap10(pacesAt(chk.pace, steps, w.index, chk.input.currentWeeklyKm))
        )
      );
      if (ownCapped !== ls.timeCapped) {
        const k = ownCapped ? "na 150 min tempa nedelje, a timeCapped=false (upozorenje: 'udeo')" : "timeCapped=true, a nije na 150 min tempa nedelje";
        lsMismatch[k] ??= { n: 0, ex: key };
        lsMismatch[k].n++;
        if (lsMismatch[k].n === 1) lsMismatch[k].ex += ` input=${JSON.stringify(inp)}`;
      }
    }
}
console.log(JSON.stringify({ seed: SEED, bases, flows, ok, rejectCodes: codes, violations: viol, longShortBelow: lsBelow, longShortTimeCapMismatch: lsMismatch, sec: (Date.now() - t0) / 1000 }, null, 1));
