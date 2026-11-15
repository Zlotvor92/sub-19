/* K4-MAR — 12 profila P9 (P9/inputs.json, MAR): kratke mere po profilu i dugi po nedeljama.
   Iz korena repoa: node docs/generators-v2/perfection/K4-MAR/prof.ts [koren koda] */
import { readFileSync } from "node:fs";
import { metrics } from "./snap.ts";
const root = process.argv[2] ?? new URL("../../../../", import.meta.url).pathname;
const gen = (await import(`${root}/web/src/domain/generators/marathon/v2/generate.ts`)).generateMarathonV2;
const dir = new URL(".", import.meta.url).pathname;
const inputs = JSON.parse(readFileSync(`${dir}../P9/inputs.json`, "utf8")).MAR;
inputs.forEach((p: any, i: number) => {
  const r = gen(p.input);
  const id = `p${String(i + 1).padStart(2, "0")}`;
  if (!r.ok) return console.log(id, "ODBIJEN", r.reasons.map((x: any) => x.code).join(","));
  const m = metrics(r.plan, p.input);
  const L = r.plan.weeks.map((w: any) => { const l = w.days.find((d: any) => d.role === "long"); const b = l ? (l.workout.segments ?? []).filter((x: any) => x.zone === "MP").reduce((a: number, x: any) => a + x.km, 0) : 0; return l ? `${l.workout.km}${b ? "+" + Math.round(b * 10) / 10 : ""}${w.deload ? "r" : ""}` : "-"; }).join(" ");
  const T = r.plan.weeks.map((w: any) => Math.round(w.plannedKm)).join(" ");
  const E = r.plan.weeks.map((w: any) => w.days.filter((d: any) => d.role === "easy").map((d: any) => d.workout.km).join("/")).join(" ");
  console.log(`${id} vrh ${m.peak} (start ${m.start}) h ${m.hoursPeak.toFixed(1)} dugi ${m.longest} (${Math.round(m.longMin)} min, ×${m.atTop}, >45% ${m.longShare45}) najteža −${m.hardFromRace} pred-taper ${m.lastPreShare.toFixed(2)} lag/dugi ${m.easyLong} dan-pred ${m.eve} MPdugi ${m.blockMpKm} MPsred ${m.mpMidMax.toFixed(0)} test ${m.testMin.toFixed(0)} blok ${m.blocks} (${m.mpLongKm} km) niz ${m.topRun} lagMin ${m.easyMin} kratkih ${m.shortEasyWeeks} | ${m.warn.join(",")}`);
  console.log(`     dugi: ${L}\n     obim: ${T}\n     lagani: ${E}`);
});
