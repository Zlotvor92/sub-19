// Regresija 08i: heš toka (bez oznake verzije) na <root>; iz web/: node regress-hash-08i.ts <root> <deo> <delova> <svaki M-ti plan> > out.tsv; poređenje: python3 regress-cmp-08i.py base.tsv new.tsv (oba sortirana)
// Regresija pouke 37: node hash.ts <root> <part> <nparts> <M> > out.tsv
import { createHash } from 'node:crypto';
import { DISTS, SCENARIOS, addDays } from '/home/user/sub-19/docs/generators-v2/final-check/lib.ts';
const [root, part, nparts, M] = [process.argv[2]!, +process.argv[3]!, +process.argv[4]!, +(process.argv[5] ?? 16)];
const g5 = await import(root + '/web/src/domain/generators/fiveK/v2/generate.ts');
const a5 = await import(root + '/web/src/domain/generators/fiveK/v2/adapt.ts');
const d = DISTS[0]!;
const strip = (x: any): string => JSON.stringify(x).replace(/"policyVersion":"[^"]*"/g, '');
const h = (x: any): string => createHash('sha1').update(strip(x)).digest('hex').slice(0, 16);
const dh = (r: any): string => r.ok ? h(r.plan.weeks.map((w: any) => [w.targetKm, w.plannedKm, w.test, w.days])) : '-';
const kmOf = (r: any): string => r.ok ? r.plan.weeks.map((w: any) => w.plannedKm).join(',') + '|' + r.plan.weeks.map((w: any) => w.targetKm).join(',') : '-';
const info = (r: any): string => {
  if (!r.ok) return 'REJ:' + r.reasons.map((x: any) => x.code).join(',') + ':' + (r.violations ?? []).filter((v: any) => v.severity === 'error').map((v: any) => v.rule).join(',');
  const w37 = r.plan.weeks.filter((w: any) => w.notes.some((n: string) => n.includes('pouka 37'))).map((w: any) => w.index);
  const warn = r.plan.warnings.filter((v: any) => v.rule === 'MIXED_OVER_TARGET').length;
  return `OK:${w37.join('.')}:${warn}`;
};
let i = -1;
for (const b of d.all()) {
  i++;
  if (i % M !== 0 || (i / M) % nparts !== part) continue;
  const g: any = g5.generateFiveKV2(b.input);
  console.log(`${b.id}\tGEN\t-\t${h(g)}\t${g.ok ? 'OK' : 'REJ'}`);
  if (!g.ok) continue;
  const p = g.plan; const N = p.weeks.length;
  const ats: [string, string][] = [];
  for (const s of SCENARIOS) {
    const offs = s === 'fatigue' ? [0, 1, 2, 3, 4, 5, 6] : [0, 3, 6];
    ats.push([s, addDays(p.input.startDate, -3)], [s, addDays(p.input.startDate, -1)]);
    for (let k = 0; k < N - 1; k++) for (const o of offs) ats.push([s, addDays(p.weeks[k].startDate, o)]);
  }
  for (const [s, at] of ats) {
    if (at >= p.input.raceDate) continue;
    const scen = s === 'chain' ? 'pause10' : s;
    const r: any = a5.adaptFiveKV2(p, d.facts(p, scen as any, at), at);
    console.log(`${b.id}\t${s}\t${at}\t${h(r)}\t${info(r)}\t${dh(r)}\t${kmOf(r)}`);
    if (s === 'chain' && r.ok) {
      const a2 = addDays(at, 7);
      if (a2 < p.input.raceDate) {
        const r2: any = a5.adaptFiveKV2(r.plan, d.chain2(r.plan, a2), a2);
        console.log(`${b.id}\tchain2\t${at}\t${h(r2)}\t${info(r2)}\t${dh(r2)}\t${kmOf(r2)}`);
      }
    }
  }
}
