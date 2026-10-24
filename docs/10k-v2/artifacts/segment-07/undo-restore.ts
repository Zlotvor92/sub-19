const V2 = '/home/user/sub-19/web/src/domain/generators/tenK/v2';
const { generateTenKV2 } = await import(`${V2}/generate.ts`);
const { adaptTenKV2 } = await import(`${V2}/adapt.ts`);
const { validatePlan } = await import(`${V2}/validate.ts`);
const T = await import(`${V2}/testInputs.ts`);
const { restoreMerge } = await import(`${V2}/app/adapt.ts`);
const { generatedPlan, storedPlan } = await import(`${V2}/app/plan.ts`);
const store = (p: unknown) => storedPlan(generatedPlan(p));
let n = 0, ref = 0, inv = 0, nxt = 0; const ex: string[] = [];
for (const b of T.adaptBases()) { const g = generateTenKV2(b.input); if (!g.ok) continue;
  for (const kind of T.AS_OF_KINDS) { const at = T.asOfOf(g.plan, kind);
    for (const s of T.SCENARIOS) { const cur = adaptTenKV2(g.plan, T.factsOf(g.plan, s, at), at); if (!cur.ok) continue;
      n++; const r: any = restoreMerge(store(cur.plan), store(g.plan), at, {});
      if (r.meta.futureChanges.conflicts.length) { ref++; if (ex.length < 5) ex.push(`${b.id} ${kind} ${s}`); continue; }
      if (validatePlan(r.tenKV2).some((v: any) => v.severity === 'error')) inv++;
      if (!adaptTenKV2(r.tenKV2, {}, at).ok) nxt++;
    } } }
console.log({ n, ref, inv, nxt }, ex);
