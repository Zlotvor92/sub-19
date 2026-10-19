// Organizator (pouka 36): isti zapisi umora poslati ponovo sutradan → da li nastaje DRUGO rasterećenje. Pokretanje iz web/: node ../docs/generators-v2/final-check/fatigue-repeat.ts [5K|10K|HM|MAR] [end]
import { DISTS, addDays, wedOf } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const only = process.argv[2];
for (const d of DISTS) {
  if (only && d.name !== only) continue;
  const all = d.all(); let n = 0, extra = 0, rej2 = 0; const ex: string[] = [];
  for (const [i, b] of all.entries()) {
    if (i % 97 !== 0) continue;
    const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const N = p.weeks.length;
    for (const k of [1, 3, Math.max(1, N - 6)]) {
      if (k >= N - 2) continue;
      const at = process.argv[3] === "end" ? p.weeks[k].endDate : wedOf(p.weeks[k].startDate);
      const f = d.facts(p, 'fatigue' as any, at);
      const a1: any = d.adapt(p, f, at); if (!a1.ok) continue;
      const a2: any = d.adapt(a1.plan, f, addDays(at, 1)); n++;
      if (!a2.ok) { rej2++; continue; }
      const dl = (pl: any) => pl.weeks.filter((w: any) => w.deload).length;
      if (dl(a2.plan) > dl(a1.plan)) { extra++; if (ex.length < 2) ex.push(`${b.id} asOf ${at}: rasterećenja ${dl(a1.plan)} → ${dl(a2.plan)}`); }
    }
  }
  console.log(d.name, { tokova: n, drugo_rasterecenje: extra, odbijeno_drugi: rej2 }); for (const e of ex) console.log('  ', e);
}
