const N = '/home/user/sub-19/web/src/domain/generators/tenK/v2';
const O = '/tmp/claude-0/-home-user-sub-19/f78456e6-2b11-5c57-9ec3-0981fc722db2/scratchpad/base/web/src/domain/generators/tenK/v2';
const n = await import(`${N}/generate.ts`); const o = await import(`${O}/generate.ts`);
const na = await import(`${N}/adapt.ts`); const oa = await import(`${O}/adapt.ts`);
const T = await import(`${N}/testInputs.ts`);
const mode = process.argv[2];
const strip = (r: any, cap: boolean, d25: boolean) => {
  const x = JSON.parse(JSON.stringify(r));
  const p = x.plan; if (!p) return JSON.stringify(x);
  const c = (t: string) => cap ? t.replace(/; preporuka [\d–]+ dana\./g, '.') : t;
  p.notes = p.notes.map(c);
  p.warnings = p.warnings.filter((w: any) => !(d25 && w.rule === 'LONG_SHORTER_THAN_QUALITY')).map((w: any) => ({ ...w, message: c(w.message) }));
  return JSON.stringify(x).replace(/10k-v2\.\d+\.\d+/g, 'V');
};
const cnt: Record<string, number> = {}; const ex: Record<string, string> = {};
const classify = (id: string, rn: any, ro: any) => {
  const a = T.undo07(rn);
  let k = 'same';
  if (strip(a, false, false) !== strip(ro, false, false)) {
    if (strip(a, true, false) === strip(ro, true, false)) k = 'O-1b';
    else if (strip(a, false, true) === strip(ro, false, true)) k = 'F3';
    else if (strip(a, true, true) === strip(ro, true, true)) k = 'O-1b+F3';
    else if (JSON.stringify(rn).includes('(više od planiranog)')) k = 'Z1';
    else k = 'other';
  }
  cnt[k] = (cnt[k] ?? 0) + 1; if (!ex[k]) ex[k] = id;
};
if (mode === 'gen') {
  const all = [...([3,4,5,6] as const).flatMap((d) => T.grid02Inputs(d)), ...([3,4,5,6] as const).flatMap((d)=>T.feelGridInputs(d)), ...([3,4] as const).flatMap((d)=>T.beginnerGridInputs(d))];
  for (const c of all) classify(c.id, n.generateTenKV2(c.input), o.generateTenKV2(c.input));
} else {
  for (const b of T.adaptBases()) {
    const gn = n.generateTenKV2(b.input), go = o.generateTenKV2(b.input); if (!gn.ok) continue;
    for (const kind of T.AS_OF_KINDS) { const at = T.asOfOf(gn.plan, kind);
      for (const s of T.SCENARIOS) classify(`${b.id}/${kind}/${s}`, na.adaptTenKV2(gn.plan, T.factsOf(gn.plan, s, at), at), oa.adaptTenKV2(go.plan, T.factsOf(go.plan, s, at), at));
    }
  }
}
console.log(mode, JSON.stringify(cnt), JSON.stringify(ex));
