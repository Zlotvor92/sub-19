/* P1 — uzrok nedelje po rasporedu B koja je ispala A (napomena B_MISSING_NOTE), mreža P0 HM: dužine (buildLengths sa
   Q2 laganim) ili blok (chooseBlockKm). Iz web/: node ../docs/generators-v2/perfection/P1/bMissing.ts */
import { grid } from "../P0/common.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import { buildLengths } from "../../../../web/src/domain/generators/halfMarathon/v2/lengths.ts";
import { planRule } from "../../../../web/src/domain/generators/halfMarathon/v2/policy.ts";
import { chooseBlockKm } from "../../../../web/src/domain/generators/halfMarathon/v2/specific.ts";
import { B_MISSING_NOTE } from "../../../../web/src/domain/generators/halfMarathon/v2/week.ts";
for (const c of grid("HM")) { const r = generateHmV2(c.input); if (!r.ok) continue; const p = r.plan;
  const rule = planRule(p.input.runDays.length, p.input.experience === "beginner" ? "beginner" : "regular")!;
  for (const w of p.weeks) { if (!w.notes.includes(B_MISSING_NOTE)) continue;
    const q1 = w.days.find((d) => d.role === "q1")!; const long = w.days.find((d) => d.role === "long")!;
    const len = buildLengths(Math.round(w.targetKm * 10), Math.round(q1.workout.km * 100), p.pattern.easy.length + 1, rule, p.paces, Infinity);
    const why = !len ? "dužine (Q2 lagan: lagani > 0,8 × dugi ili dugi na granici)" : chooseBlockKm(len.long10, 0, rule, p.paces, [q1.workout.sec], w.targetKm) === null ? "blok (≤ 40 % dugog / plafon RP / dan Q1 ≤ dugi sa blokom)" : "drugo";
    console.log(`${c.id} ned ${w.index}: cilj ${w.targetKm} km, dugi ${long.workout.km} km, Q1 ${q1.workout.dose?.doseM} m — ${why}`); } }
