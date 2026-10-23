/* Ugao 5 (consistency), odložena odluka c): 5K I_REP / T_CONTINUOUS — da li zadržana doza na NOVOM (sporijem)
   tempu dostiže plafon trajanja. SAMO ČITANJE. Iz web/: node ../docs/generators-v2/audit/consistency/rep-ceiling-5k.ts <k>
   Deterministički: svaki k-ti plan 5K mreže (lib), asOf = početak svake nedelje 1 … N−2 + 2 dana, rezultat 5 km
   sporiji za Δ ∈ {1, 2, 4, 6, 8} VDOT (pod 30), vrsta race i test; plus isti rezultat bez Δ (kontrola).
   Meri: odbijanja po pravilu; najveći odnos trajanja ponavljanja prema plafonu (I/RP: iRepMaxSec, T: plafon faze,
   R: rRepMaxSec) u budućim danima — „najbliži prilaz". */
import { distOf } from "../../final-check/lib.ts";
import { raceTimeForVdot } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";
import { FIVE_K_V2_POLICY as P } from "../../../../web/src/domain/generators/fiveK/v2/policy.ts";
const d = distOf("5K");
const K = Number(process.argv[2] ?? 3);
const q: any = (P as any).quality;
const tMax = (ph: string) => q.tContinuousMaxSec[ph] ?? 1200;
const o = { flows: 0, ok: 0, rejected: {} as Record<string, number>, rejEx: {} as Record<string, string>,
  maxRatio: { I: 0, T: 0, R: 0 }, maxEx: { I: "", T: "", R: "" }, over95: { I: 0, T: 0, R: 0 } };
for (const [i, b] of d.all().entries()) {
  if (i % K !== 0) continue;
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const N = p.weeks.length;
  const v0 = p.vdot ?? 38;
  for (let k = 0; k < N - 1; k++) for (const dv of [0, 1, 2, 4, 6, 8]) for (const kind of ["race", "test"]) {
    const at = new Date(Date.parse(p.weeks[k].startDate + "T00:00:00Z") + 2 * 864e5).toISOString().slice(0, 10);
    const v = Math.max(30, Math.round((v0 - dv) * 10) / 10);
    const facts = { results: [{ distM: 5000, sec: Math.round(raceTimeForVdot(v, 5000)), date: at, kind }] };
    o.flows++;
    let a: any; try { a = d.adapt(p, facts, at); } catch (e) { o.rejected["THROW"] = (o.rejected["THROW"] ?? 0) + 1; continue; }
    if (!a.ok) {
      const vs = (a.violations ?? []).filter((x: any) => x.severity === "error").map((x: any) => x.rule);
      const key = vs.length ? vs.join("+") : a.reasons.map((r: any) => r.code).join("+");
      o.rejected[key] = (o.rejected[key] ?? 0) + 1; o.rejEx[key] ??= `${b.id} asOf ${at} Δ${dv} ${kind}`; continue;
    }
    o.ok++;
    for (const w of a.plan.weeks) for (const day of w.days) {
      if (day.date <= at || !day.workout.maxBoutSec) continue;
      const mb = day.workout.maxBoutSec;
      const r = { I: Math.max(mb.I ?? 0, mb.RP ?? 0) / q.iRepMaxSec, T: (mb.T ?? 0) / tMax(w.phase), R: (mb.R ?? 0) / q.rRepMaxSec };
      for (const z of ["I", "T", "R"] as const) {
        if (r[z] > 0.95) o.over95[z]++;
        if (r[z] > o.maxRatio[z]) { o.maxRatio[z] = Math.round(r[z] * 1000) / 1000; o.maxEx[z] = `${b.id} asOf ${at} Δ${dv} ${kind} ned ${w.index} ${day.workout.title}`; }
      }
    }
  }
}
console.log(JSON.stringify(o, null, 1));
