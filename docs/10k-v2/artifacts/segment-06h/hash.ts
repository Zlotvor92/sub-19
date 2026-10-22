// Regresija 06h: heš (bez oznake verzije) svih tokova; ROOT shard nshards stride
const [ROOT, shard, nsh, strideS] = process.argv.slice(2);
const V = `${ROOT}/web/src/domain/generators/tenK/v2`;
const { adaptTenKV2 } = await import(`${V}/adapt.ts`);
const { generateTenKV2 } = await import(`${V}/generate.ts`);
const T: any = await import(`${V}/testInputs.ts`);
const add = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const all = [
  ...[3, 4, 5, 6].flatMap((d) => T.grid02Inputs(d)),
  ...[3, 4, 5, 6].flatMap((d) => T.feelGridInputs(d)),
  ...[3, 4].flatMap((d) => T.beginnerGridInputs(d))
];
const stride = Number(strideS);
const chain2 = (plan: any, a2: string) => ({ workouts: [], results: [{ distM: 5000, sec: T.timeForVdot((plan.vdot ?? 40) + 1, 5000), date: a2, kind: 'test' }], lockedDayIds: [], coverage: null, breaks: [] });
const out: string[] = [];
let j = 0;
for (const [i, b] of all.entries()) {
  if (i % stride) continue;
  if (j++ % Number(nsh) !== Number(shard)) continue;
  const g: any = generateTenKV2(b.input); if (!g.ok) continue; const p = g.plan;
  const s0 = p.weeks[0].startDate;
  const ats = [-6, -3, -1, 0, 1, 2, 3, 6, 7, 9, 14].map((k) => add(s0, k));
  for (const at of ats)
    for (const s of T.SCENARIOS) {
      let f: any; try { f = T.factsOf(p, s, at); } catch { continue; }
      let a: any = adaptTenKV2(p, f, at);
      if (a.ok && s === 'chain') { const a2 = add(at, 7); a = adaptTenKV2(a.plan, chain2(a.plan, a2), a2); }
      out.push(`${b.id}|${at}|${add(at,0) === s0 ? 'start+0' : at}|${s}|${a.ok ? 'ok' : 'rej'}|${T.planHash(a)}`);
    }
}
console.log(out.join('\n'));
