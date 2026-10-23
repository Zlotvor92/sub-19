/* 10K-08 T3: posle novog starta (pause35, asOf = kraj nedelje 2…N−3; svaki k-ti plan mreže) — taper bez kvaliteta
   kad posle povratka postoji nedelja izgradnje sa kvalitetom; trkačka bez oštrenja (van perioda bola). Iz web/:
   node ../docs/10k-v2/artifacts/segment-08/t3.ts <k> */
import { distOf } from "../../../generators-v2/final-check/lib.ts";

const k = Number(process.argv[2] ?? 97);
const d = distOf("10K");
const all = d.all();
const o = { flows: 0, ok: 0, restart: 0, withQ: 0, taperNoQ: 0, raceNoSharp: 0, rejected: 0, ex: [] as string[] };
for (let i = 0; i < all.length; i += k) {
  const g = d.generate(all[i]!.input);
  if (!g.ok) continue;
  const N = g.plan.weeks.length;
  for (let wi = 2; wi <= N - 3; wi++) {
    const at = g.plan.weeks[wi - 1]!.endDate;
    o.flows++;
    const r = d.adapt(g.plan, d.facts(g.plan, "pause35", at), at);
    if (!r.ok) { o.rejected++; continue; }
    o.ok++;
    const st = (r.plan as any).adaptation?.steps ?? [];
    const rs = st.find((s: any) => s.restart);
    if (!rs) continue;
    o.restart++;
    const ws = r.plan.weeks;
    const q = ws.some((w) => w.index >= rs.fromWeek && w.phase !== "taper" && w.phase !== "race" && w.days.some((x) => x.workout.kind === "quality"));
    if (!q) continue;
    o.withQ++;
    const tp = ws.filter((w) => w.phase === "taper");
    const noQ = tp.some((w) => !w.days.some((x) => x.workout.kind === "quality"));
    const rw = ws[ws.length - 1]!;
    const noS = !rw.days.some((x) => x.role === "sharpener");
    if (noQ) o.taperNoQ++;
    if (noS) o.raceNoSharp++;
    if ((noQ || noS) && o.ex.length < 5) o.ex.push(`${all[i]!.id}@${at}${noQ ? " taper bez Q" : ""}${noS ? " trkačka bez oštrenja" : ""}`);
  }
}
console.log(JSON.stringify(o, null, 1));
