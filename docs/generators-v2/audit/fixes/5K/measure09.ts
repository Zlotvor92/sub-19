/* 5K-09: C1 (početnik: rasterećenje u ned 1–2) i C13 (početnik po osećaju: kontrolno trčanje) nad svim ulazima mreže
   5K (final-check lib.grid5k, porodica B = početnik). Iz web/: node ../docs/generators-v2/audit/fixes/5K/measure09.ts */
import { distOf } from "../../../final-check/lib.ts";
const d = distOf("5K");
const o = { beginners: 0, plans: 0, deloadW12: 0, feel: 0, feelTest: 0, ex: [] as string[] };
for (const b of d.all()) {
  if (b.family !== "B") continue;
  o.beginners++;
  const g: any = d.generate(b.input);
  if (!g.ok) continue;
  o.plans++;
  if (g.plan.weeks.some((w: any) => w.deload && w.index <= 2)) { o.deloadW12++; if (o.ex.length < 3) o.ex.push(b.id); }
  if (g.plan.paceMode === "feel") { o.feel++; if (g.plan.weeks.some((w: any) => w.test)) o.feelTest++; }
}
console.log(JSON.stringify(o));
