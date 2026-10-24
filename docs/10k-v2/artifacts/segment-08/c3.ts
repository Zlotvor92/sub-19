/* 10K-08 C3: plan po osećaju, mešovita nedelja testa (asOf = dan pre testa / 2 dana pre; over120, done100, locked) —
   tokovi u kojima test otpada (plan bez testa posle adaptacije, a rezultata nema). Iz web/ (ili korena worktree-a):
   node <ovaj fajl> <putanja do tenK/v2/index.ts> <k> */
import { distOf } from "../../../generators-v2/final-check/lib.ts";

const [mod, kk] = process.argv.slice(2);
const { adaptTenKV2, generateTenKV2 } = await import(mod!);
const d = distOf("10K");
const all = d.all().filter((b) => b.family === "F");
const k = Number(kk ?? 7);
const o = { flows: 0, ok: 0, rejected: 0, testLost: 0, ex: [] as string[] };
for (let i = 0; i < all.length; i += k) {
  const g = generateTenKV2(all[i]!.input);
  if (!g.ok) continue;
  const tw = g.plan.weeks.find((w: any) => w.test);
  const td = tw?.days.find((x: any) => x.role === "test");
  if (!td) continue;
  for (const back of [1, 2, 3])
    for (const s of ["over120", "done100", "locked"] as const) {
      const at = new Date(Date.parse(td.date + "T00:00:00Z") - back * 864e5).toISOString().slice(0, 10);
      if (at < tw.startDate) continue;
      o.flows++;
      const r = adaptTenKV2(g.plan, d.facts(g.plan, s, at), at);
      if (!r.ok) { o.rejected++; continue; }
      o.ok++;
      if (!r.plan.weeks.some((w: any) => w.days.some((x: any) => x.role === "test"))) {
        o.testLost++;
        if (o.ex.length < 5) o.ex.push(`${all[i]!.id}/${s}@${at}`);
      }
    }
}
console.log(JSON.stringify(o, null, 1));
