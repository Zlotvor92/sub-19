/* Merenje prototipa A17 + N2 (a17-prototype.diff) prema heševima 4917959. Pokretanje iz korena repoa:
     git apply docs/10k-v2/artifacts/segment-06c/a17-prototype.diff
     node docs/10k-v2/artifacts/segment-06c/measure-a17.ts   → measure-a17.json
     git checkout -- web/src/domain/generators/tenK/v2/{steps,validate,assess,adapt}.ts
   Po toku: heš (planHash81) prema segment06c.adapt-hashes-4917959.json; A17 = poruka „(A17)", N2 = „bilo bi";
   odbijanja sa greškama validatora; J1, J2 (nezavisno od volume.ts: osnova iz koraka, 0,7 i 10 % kao brojevi
   odluke), J4 (adaptInvariants + validator). */

import { readFileSync, writeFileSync } from 'node:fs';

const V = new URL('../../../../web/src/domain/generators/tenK/v2/', import.meta.url).href;
const { generateTenKV2 } = await import(V + 'generate.ts');
const { adaptTenKV2 } = await import(V + 'adapt.ts');
const { addDays } = await import(V + 'dates.ts');
const { validatePlan } = await import(V + 'validate.ts');
const { adaptInvariants } = await import(V + 'adaptInvariants.ts');
const T = await import(V + 'testInputs.ts');
const H = JSON.parse(readFileSync(new URL('segment06c.adapt-hashes-4917959.json', V), 'utf8'));
const to10 = (x: number) => Math.round(x * 10);
const isBuild = (p: string) => p === 'base' || p === 'development' || p === 'specific';
const gen = (i: unknown) => (generateTenKV2(i) as any).plan;
const chainFacts = (p: any, a2: string) => ({
  workouts: [...T.runsIn(p, addDays(a2, -13), addDays(a2, -7)), ...T.runsIn(p, addDays(a2, -6), a2, 0.5)],
  coverage: { from: addDays(a2, -13), to: a2, complete: true }
});
const stat: Record<string, Record<string, number>> = {};
const inc = (g: string, k: string) => { (stat[g] ??= {}); stat[g][k] = (stat[g][k] ?? 0) + 1; };
const rej: string[] = []; const odd: string[] = []; const j1: string[] = []; const j2: string[] = []; const j2all: string[] = []; const j4: string[] = [];
const examples: Record<string, unknown> = {};
function check(grid: string, key: string, scen: string, p0: any, facts: any, asOf: string, r: any, old: number) {
  const h = T.planHash81(r);
  const changed = h !== old;
  inc(grid + '/' + scen, 'flows');
  if (!r.ok) {
    inc(grid + '/' + scen, 'rejected');
    rej.push(`${grid} ${key}: ${r.reasons.map((x: any) => `${x.code} ${x.message} (ned ${x.week})`).join(',')} ${r.violations.filter((v: any) => v.severity === 'error').map((v: any) => `${v.rule}@${v.week}:${v.message}`).join('; ')}`);
    return;
  }
  const msgs = r.reasons.map((x: any) => x.message).join(' ');
  const a17 = msgs.includes('(A17)');
  const n2 = msgs.includes('% nivoa pre bola bilo bi');
  if (a17) inc(grid + '/' + scen, 'a17');
  if (n2) inc(grid + '/' + scen, 'n2');
  if (changed) inc(grid + '/' + scen, 'changed');
  if (changed && !a17 && !n2) odd.push(`${grid} ${key} changed bez A17/N2`);
  if (!changed && (a17 || n2)) odd.push(`${grid} ${key} A17/N2 ali bajt-isto`);
  // J1/J2 for all steps
  const st = r.plan.adaptation.steps; const w = r.plan.weeks;
  const forced = (i: number) => st.some((x: any) => x.deload && x.fromWeek === i);
  for (const s of st) {
    if (s.restart) continue;
    const red = new Set<number>();
    if (s.startKm !== null && s.levelKm !== null) red.add(s.fromWeek);
    if (s.returnFrom) red.add(s.returnFrom.week);
    for (const x of red) {
      const nx = w[x];
      if (nx && nx.deload && !forced(nx.index)) j1.push(`${grid} ${key} ned ${nx.index}`);
      if (!nx || red.has(x + 1) || !isBuild(nx.phase) || nx.deload) continue;
      const t = to10(w[x - 1].targetKm);
      const lv = to10(s.levelKm);
      const base = s.returnFrom && s.returnFrom.week === x ? Math.min(Math.round(0.7 * lv), t) : t;
      const lim = base + Math.max(Math.round(base * 0.1), 10);
      const v = to10(nx.targetKm);
      const bad = v > lim || v > Math.max(lv, base);
      const msg = `${grid} ${key} ned ${nx.index}: ${nx.targetKm} (osnova ${base / 10}, +10% ${lim / 10}, nivo ${lv / 10})`;
      if (bad) { (a17 ? j2 : j2all).push(msg); }
    }
  }
  for (const v of adaptInvariants(p0, r.plan, asOf, facts)) j4.push(`${grid} ${key}: ${v}`);
  const errs = validatePlan(r.plan).filter((v: any) => v.severity === 'error');
  if (errs.length) j4.push(`${grid} ${key}: validator ${errs.map((v: any) => v.rule).join(',')}`);
  if (key.startsWith('10w-25km-v30-A-sat/w3/')) examples[key] = r.plan.weeks.slice(3, 7).map((x: any) => `${x.index}${x.deload ? ' rast.' : ''} ${x.targetKm}/${x.plannedKm}`).join(' | ') + ' || ' + r.reasons.filter((x: any) => x.applied).map((x: any) => x.message).join(' ## ');
}
const t0 = Date.now();
for (const b of T.adaptBases()) {
  const p0 = gen(b.input);
  for (const k of T.AS_OF_KINDS) for (const s of T.SCENARIOS) {
    const asOf = T.asOfOf(p0, k);
    const facts = T.factsOf(p0, s, asOf);
    let r: any = adaptTenKV2(p0, facts, asOf);
    if (r.ok && s === 'chain') { const a2 = addDays(asOf, 7); r = adaptTenKV2(r.plan, chainFacts(r.plan, a2), a2); }
    const key = `${b.id}/${k}/${s}`;
    check('04', key, s, p0, s === 'chain' ? {} : facts, asOf, r, H.grid04[key]);
  }
}
for (const b of T.painGridBases()) {
  const p0 = gen(b.input);
  for (const c of T.painCases(b.id, p0)) {
    const facts = T.painFacts(c.asOf, c.level);
    check('P', c.key, 'p' + c.level, p0, facts, c.asOf, adaptTenKV2(p0, facts, c.asOf), H.gridP[c.key]);
  }
}
for (const b of T.reliefGridBases()) {
  const p0 = gen(b.input);
  for (const a of T.reliefAsOfs(p0)) for (const s of T.RELIEF_SCENARIOS) {
    const key = `${b.id}/w${a.week}/${s}`;
    const facts = T.reliefFacts(p0, s, a.asOf);
    check('R', key, s, p0, facts, a.asOf, adaptTenKV2(p0, facts, a.asOf), H.gridR[key]);
  }
}
const out = { stat, rejCount: rej.length, rej, odd, j1, j2, j2all, j4count: j4.length, j4, examples, sec: (Date.now() - t0) / 1000 };
writeFileSync(new URL('./measure-a17.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(stat), '\nrej', rej.length, 'odd', odd.length, 'j1', j1.length, 'j2(a17)', j2.length, 'j2(other)', j2all.length, 'j4', j4.length, out.sec);
