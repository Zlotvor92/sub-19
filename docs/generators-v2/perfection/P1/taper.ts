/* P1 — taper bez kvaliteta i doza RP tapera (mreža P0 HM). Iz web/: node ../docs/generators-v2/perfection/P1/taper.ts */
import { grid } from "../P0/common.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
const t: Record<string, [number, number]> = {}; let sum = 0, n = 0;
for (const c of grid("HM")) { const r = generateHmV2(c.input); if (!r.ok) continue;
  const w = r.plan.weeks.find((x) => x.phase === "taper")!; const g = (t[`${c.family} d${c.days}`] ??= [0, 0]); g[1]++;
  const rp = w.days.find((d) => d.workout.dose?.zone === "RP"); if (!w.days.some((d) => d.workout.kind === "quality")) g[0]++;
  if (rp) { sum += rp.workout.dose!.doseM; n++; } }
console.log("taper bez kvaliteta:", Object.entries(t).map(([k, [a, b]]) => `${k} ${a}/${b}`).join("; "), `; RP tapera prosek ${Math.round(sum / n)} m (n ${n})`);

/* Opcije za tapere bez kvaliteta (posle): (b) RP tapera = najviši nivo lestvice ≤ min(≈ 60 %, plafon), najmanje 2 × 2000 m
   — taper ima RP kad 4000 m ≤ plafon; (d) plafon RP tapera po pojasu vrha plana (vrh ≥ 40 km → 20 %). */
import { capM } from "../../../../web/src/domain/generators/halfMarathon/v2/quality.ts";
let nb = 0, nd = 0, none = 0;
for (const c of grid("HM")) { const r = generateHmV2(c.input); if (!r.ok) continue;
  const w = r.plan.weeks.find((x) => x.phase === "taper")!;
  if (w.days.some((d) => d.workout.kind === "quality")) continue; none++;
  if (4000 <= capM("RP", w.targetKm)) nb++;
  const lastRp = Math.max(0, ...r.plan.weeks.filter((x) => x.phase !== "taper" && x.phase !== "race" && !x.deload).flatMap((x) => x.days.filter((d) => d.role === "q1" && d.workout.dose?.zone === "RP").map((d) => d.workout.dose!.doseM)));
  const lv = [4000, 5000, 6000, 8000, 9000, 10000, 12000, 15000].filter((m) => m <= 0.6 * lastRp + 1e-6).pop() ?? 4000;
  const share = r.plan.peakKm >= 40 ? 0.2 : 0.15;
  if (lv <= Math.floor(share * w.targetKm * 1000 + 1e-6)) nd++; }
console.log(`posle: tapera bez kvaliteta ${none}; (b) dobija RP ${nb}; (d) dobija RP ${nd}`);
