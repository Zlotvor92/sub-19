import { distOf, wedOf, type Plan } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
import { FIVE_K_V2_POLICY as P } from "/home/user/sub-19/web/src/domain/generators/fiveK/v2/policy.ts";
const d = distOf("5K"); const all = d.all(); let gen = 0, ad = 0, ex: string[] = [];
const chk = (p: any, tag: string) => { let n = 0; const min = (P.days as any)[p.input.runDays.length].minWeekKm; for (const w of p.weeks) if (w.phase !== 'race' && w.easyRest && w.plannedKm < min - 1e-6 && !(w.limits?.rest?.length)) { n++; if (ex.length < 6) ex.push(`${tag} ned ${w.index} ${w.plannedKm}/${w.targetKm} min ${min} ${JSON.stringify(w.limits ?? {})}`); } return n; };
for (let i = 0; i < all.length; i++) { const b = all[i]!; const g = d.generate(b.input) as any; if (!g.ok || g.plan.planType === 'runWalk') continue; gen += chk(g.plan, b.id);
  if (i % 60) continue; const p = g.plan; for (let wi = 2; wi <= p.weeks.length - 2; wi++) for (const at of [wedOf(p.weeks[wi-1].startDate), p.weeks[wi-1].endDate]) for (const s of ["pain5","pain8","painPause","pause20","under50"] as const) { const r: any = d.adapt(p, d.facts(p as Plan, s, at), at); if (r.ok && r.plan.planType !== 'runWalk') ad += chk(r.plan, `${b.id}/${s}@${at}`); } }
console.log({ gen, ad }, ex);
