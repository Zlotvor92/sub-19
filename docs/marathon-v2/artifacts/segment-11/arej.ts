/* Iz web/: node <ovaj fajl> <koren repo-a> 400 200 100 */
/* Odbijanja adaptacije na uzorku measure.ts (coach-hm-mar): sampleBases R/F/B, asOf sreda i kraj ned 1…N−2 × SCENARIOS (+ chain2). */
const root = process.argv[2]!; const kR = Number(process.argv[3] ?? 400), kF = Number(process.argv[4] ?? 200), kB = Number(process.argv[5] ?? 100);
const lib = await import(`${root}/docs/generators-v2/final-check/lib.ts`);
const d = lib.distOf('MAR');
const { bases } = lib.sampleBases(d, { R: kR, F: kF, B: kB });
let flows = 0, rej = 0; const by: Record<string, number> = {}; const ex: string[] = [];
for (const b of bases) {
  const g = d.generate(b.input) as any; if (!g.ok) continue;
  const p = g.plan;
  const asOfs = p.weeks.slice(0, -2).flatMap((w: any) => [lib.wedOf(w.startDate), w.endDate]);
  for (const at of asOfs) for (const s of lib.SCENARIOS) {
    const run = (pl: any, f: any, a: string, tag: string) => { flows++; const r = d.adapt(pl, f, a) as any;
      if (!r.ok) { rej++; const k = r.reasons.map((x: any) => x.message.split(':')[0] + ':' + x.message.slice(0, 60)).join('|'); by[k.slice(0, 90)] = (by[k.slice(0, 90)] ?? 0) + 1; if (ex.length < 12) ex.push(`${b.id} ${tag} ${a}: ${r.reasons.map((x: any) => x.message).join(' | ').slice(0, 200)}`); return null; }
      return r.plan; };
    const p1 = run(p, d.facts(p, s, at), at, s);
    if (p1 && s === 'chain') { const a2 = lib.addDays(at, 7); if (a2 < p.input.raceDate) run(p1, d.chain2(p, a2), a2, 'chain2'); }
  }
}
console.log(JSON.stringify({ flows, rej, by, ex }, null, 1));
