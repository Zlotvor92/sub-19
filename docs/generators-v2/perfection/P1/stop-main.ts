/* P1-STOP — sudar S1 × H12 („glavna doza ne opada"). Planovi mreže P0 (HM) sa S1+S2, pravilo MAIN_DOSE_DECREASE
   privremeno kao upozorenje (P1_EXP_MAIN=1, samo za merenje). Za svaku opciju: broj planova i nedelja koje bi pravilo
   odbilo. Iz web/: P1_EXP_MAIN=1 node ../docs/generators-v2/perfection/P1/stop-main.ts */
import { grid } from "../P0/common.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import { mainDoseM } from "../../../../web/src/domain/generators/halfMarathon/v2/specific.ts";
type W = ReturnType<typeof generateHmV2> extends infer R ? (R extends { ok: true; plan: infer P } ? P extends { weeks: (infer X)[] } ? X : never : never) : never;
const isB = (w: W) => w.days.some((d) => d.role === "long" && d.workout.workKm.RP > 0);
const steady = (w: W) => ["base", "development", "specific"].includes(w.phase) && !w.deload && !w.test;
const dropped = (w: W) => w.days.some((d) => d.workout.dose?.step === "drop") || w.notes.some((n) => n.includes("pouka 35"));
const noBlock = (w: W) => w.days.reduce((a, d) => a + (d.workout.kind === "quality" ? Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP) * 1000) : 0), 0);
const opts: Record<string, (ws: W[]) => number[]> = {
  // O0: kako je zadato (glavna doza sa blokom, svaka ne-rasteretna nedelja prema prethodnoj)
  O0: (ws) => chain(ws, (w) => mainDoseM(w), () => true),
  // O1: poređenje samo unutar istog tipa (A sa poslednjom A ili nedeljom pre specifične faze, B sa poslednjom B)
  O1: (ws) => {
    const bad: number[] = []; let lastA: W | null = null, lastB: W | null = null;
    for (const w of ws) { if (!steady(w)) continue; const b = w.phase === "specific" && isB(w);
      const prev = b ? lastB : lastA; if (prev && !dropped(w) && mainDoseM(w) < mainDoseM(prev)) bad.push(w.index);
      if (b) lastB = w; else lastA = w; }
    return bad;
  },
  // O2: nedelja B se ne poredi i ne postaje osnova poređenja (kao nedelja testa); A sa poslednjom A
  O2: (ws) => chain(ws.filter((w) => !(w.phase === "specific" && isB(w))), (w) => mainDoseM(w), () => true),
  // O3: glavna doza bez bloka (kao hm-v2.8.0), svaka nedelja prema prethodnoj
  O3: (ws) => chain(ws, noBlock, () => true),
};
function chain(ws: W[], f: (w: W) => number, _: () => boolean): number[] {
  const bad: number[] = []; let prev: W | null = null;
  for (const w of ws) { if (!steady(w)) continue; if (prev && !dropped(w) && f(w) < f(prev)) bad.push(w.index); prev = w; }
  return bad;
}
const res: Record<string, Record<string, { plans: number; weeks: number; n: number }>> = {};
const trans: Record<string, number> = {}; const gaps: number[] = [];
let validatorWarn = 0, myO0 = 0;
for (const c of grid("HM")) {
  const r = generateHmV2(c.input); if (!r.ok) continue;
  const ws = r.plan.weeks as W[]; const g = `${c.family} d${c.days}`;
  validatorWarn += r.plan.warnings.filter((v) => v.rule === "MAIN_DOSE_DECREASE").length;
  for (const [k, f] of Object.entries(opts)) {
    const bad = f(ws); if (k === "O0") myO0 += bad.length;
    const e = ((res[k] ??= {})[g] ??= { plans: 0, weeks: 0, n: 0 }); e.n++; e.weeks += bad.length; if (bad.length) e.plans++;
  }
  let prev: W | null = null;
  for (const w of ws) { if (!steady(w)) continue;
    if (prev && !dropped(w) && mainDoseM(w) < mainDoseM(prev)) { const k = `${prev.phase === "specific" ? (isB(prev) ? "B" : "A") : prev.phase}→${isB(w) ? "B" : "A"}`; trans[k] = (trans[k] ?? 0) + 1; gaps.push(mainDoseM(prev) - mainDoseM(w)); }
    prev = w; }
}
console.log(`kontrola: validator MAIN_DOSE_DECREASE ${validatorWarn} nedelja, ova skripta O0 ${myO0}`);
for (const [k, g] of Object.entries(res)) console.log(k, Object.entries(g).map(([gg, e]) => `${gg}: ${e.plans}/${e.n} planova, ${e.weeks} ned`).join("; "));
const s = [...gaps].sort((a, b) => a - b);
console.log("O0 prelazi:", JSON.stringify(trans), `pad [m] medijana ${s[Math.floor(s.length / 2)]}, max ${s[s.length - 1]}`);

/* Nedelja tipa B koja ne može da se sastavi (očekivan tip B, nedelja A bez ograničenja): planovi i nedelje po grupi. */
const fail: Record<string, { plans: number; weeks: number; bWeeks: number; n: number }> = {};
for (const c of grid("HM")) {
  const r = generateHmV2(c.input); if (!r.ok) continue;
  const ws = r.plan.weeks as W[]; const g = `${c.family} d${c.days}`;
  const e = (fail[g] ??= { plans: 0, weeks: 0, bWeeks: 0, n: 0 }); e.n++;
  let last: W | null = null; let f = 0;
  for (const w of ws) { if (w.phase !== "specific" || w.deload) continue;
    const want = last === null ? "A" : isB(last) ? "A" : "B";
    if (want === "B" && !isB(w)) f++; if (isB(w)) e.bWeeks++; last = w; }
  e.weeks += f; if (f) e.plans++;
}
console.log("B ne staje:", Object.entries(fail).map(([g, e]) => `${g}: ${e.plans}/${e.n} planova (${Math.round((100 * e.plans) / e.n)} %), ${e.weeks} ned; nedelja B ${e.bWeeks}`).join("; "));
