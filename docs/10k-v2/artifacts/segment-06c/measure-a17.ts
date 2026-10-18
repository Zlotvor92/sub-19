/* Merenje 10k-v2.5.0 (A17 + N2) prema 4917959, tok po tok. Pokretanje iz web/:
     git worktree add --detach <wt> 4917959 && ln -s "$PWD/node_modules" <wt>/web/node_modules
     node ../docs/10k-v2/artifacts/segment-06c/measure-a17.ts <wt>   → measure-a17.json
   Mreže 04 (sa drugim korakom lanca), P i R. Po toku: normalizovan heš (bez oznake verzije i polja reduced,
   testInputs.planHash06c) novog koda prema heševima 4917959 (segment06c.adapt-hashes-4917959.json);
   A17 = rečenica „(A17)" u napomenama plana, N2 = „bilo bi"; razlika samo po polju reduced; odbijanja;
   nedelja testa 5 km pre/posle (kod iz checkouta 4917959) u tokovima sa A17. */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const V = new URL('../../../../web/src/domain/generators/tenK/v2/', import.meta.url).href;
const W = join(resolve(process.argv[2] ?? ''), 'web/src/domain/generators/tenK/v2/');
type R = { ok: boolean; plan?: any; reasons: { condition: string; applied: boolean; message: string }[] };
const N = {
  gen: (await import(V + 'generate.ts')).generateTenKV2 as (i: unknown) => R,
  adapt: (await import(V + 'adapt.ts')).adaptTenKV2 as (p: unknown, f: unknown, a: string) => R
};
const O = {
  gen: (await import(W + 'generate.ts')).generateTenKV2 as (i: unknown) => R,
  adapt: (await import(W + 'adapt.ts')).adaptTenKV2 as (p: unknown, f: unknown, a: string) => R
};
const { addDays } = await import(V + 'dates.ts');
const T = await import(V + 'testInputs.ts');
const H = JSON.parse(readFileSync(new URL('segment06c.adapt-hashes-4917959.json', V), 'utf8'));

const testWeek = (r: R): number | null =>
  r.ok ? (r.plan.weeks.find((w: any) => w.days.some((d: any) => d.role === 'test'))?.index ?? null) : null;
const chainFacts = (p: any, a2: string) => ({
  workouts: [...T.runsIn(p, addDays(a2, -13), addDays(a2, -7)), ...T.runsIn(p, addDays(a2, -6), a2, 0.5)],
  coverage: { from: addDays(a2, -13), to: a2, complete: true }
});
const stat: Record<string, Record<string, number>> = {};
const inc = (g: string, k: string): void => {
  const s = (stat[g] ??= {});
  s[k] = (s[k] ?? 0) + 1;
};
const testChanges: string[] = [];
const odd: string[] = [];
const rejected: string[] = [];
function check(grid: string, key: string, scen: string, run: (M: typeof N) => R, old: number): void {
  const g = `${grid}/${scen}`;
  const r = run(N);
  inc(g, 'tokova');
  if (!r.ok) {
    inc(g, 'odbijeno');
    rejected.push(`${grid} ${key}`);
    return;
  }
  const notes: string[] = r.plan.notes;
  const a17 = notes.some((x) => x.includes('(A17)'));
  const n2 = notes.some((x) => x.includes('nivoa pre bola bilo bi'));
  const changed = T.planHash06c(r) !== old;
  if (changed) inc(g, 'promenjeno');
  if (a17) inc(g, 'A17');
  if (n2) inc(g, 'N2');
  if (!changed && T.planHash81(r) !== old) inc(g, 'samo reduced');
  if (changed !== (a17 || n2)) odd.push(`${grid} ${key}`);
  if (a17) {
    const o = run(O);
    const [tb, ta] = [testWeek(o), testWeek(r)];
    if (tb !== ta) {
      inc(g, 'test pomeren/otpao/ostao');
      testChanges.push(`${grid} ${key}: test ned ${tb ?? '—'} → ${ta ?? '—'}`);
    }
  }
}
const t0 = Date.now();
for (const b of T.adaptBases()) {
  const p0n = N.gen(b.input).plan;
  const p0o = O.gen(b.input).plan;
  for (const k of T.AS_OF_KINDS)
    for (const s of T.SCENARIOS) {
      const key = `${b.id}/${k}/${s}`;
      check('04', key, s, (M) => {
        const p0 = M === N ? p0n : p0o;
        const asOf = T.asOfOf(p0, k);
        let r = M.adapt(p0, T.factsOf(p0, s, asOf), asOf);
        if (r.ok && s === 'chain') {
          const a2 = addDays(asOf, 7);
          r = M.adapt(r.plan, chainFacts(r.plan, a2), a2);
        }
        return r;
      }, H.grid04[key]);
    }
}
for (const b of T.painGridBases()) {
  const p0n = N.gen(b.input).plan;
  const p0o = O.gen(b.input).plan;
  for (const c of T.painCases(b.id, p0n))
    check('P', c.key, `p${c.level}`, (M) =>
      M.adapt(M === N ? p0n : p0o, T.painFacts(c.asOf, c.level), c.asOf), H.gridP[c.key]);
}
for (const b of T.reliefGridBases()) {
  const p0n = N.gen(b.input).plan;
  const p0o = O.gen(b.input).plan;
  for (const a of T.reliefAsOfs(p0n))
    for (const s of T.RELIEF_SCENARIOS) {
      const key = `${b.id}/w${a.week}/${s}`;
      check('R', key, s, (M) => {
        const p0 = M === N ? p0n : p0o;
        return M.adapt(p0, T.reliefFacts(p0, s, a.asOf), a.asOf);
      }, H.gridR[key]);
    }
}
const out = { stat, rejected, odd, testChanges, sec: Math.round((Date.now() - t0) / 1000) };
writeFileSync(new URL('./measure-a17.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(stat), '\nodbijeno', rejected.length, 'odd', odd.length, 'test', testChanges.length, out.sec, 's');
