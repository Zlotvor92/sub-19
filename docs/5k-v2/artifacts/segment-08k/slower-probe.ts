// Sporiji rezultat (VDOT − 3 … − 12) u svakoj nedelji, ivični i mrežni planovi → odbijanja po pravilu.
const root = process.argv[2]!;
const { generateFiveKV2 } = await import(root + '/web/src/domain/generators/fiveK/v2/generate.ts');
const { adaptFiveKV2 } = await import(root + '/web/src/domain/generators/fiveK/v2/adapt.ts');
const { raceTimeForVdot } = await import(root + '/web/src/domain/generators/fiveK/v2/paces.ts');
const { earlyGridInputs } = await import('/home/user/sub-19/web/src/domain/generators/fiveK/v2/testInputs.ts');
const rules: Record<string, number> = {}; const ex: Record<string, string> = {}; let n = 0;
const bases = earlyGridInputs().filter((b: any, i: number) => i % 7 === 0 && b.input.recentResult);
for (const b of bases) {
  const g: any = generateFiveKV2(b.input); if (!g.ok || g.plan.vdot === null) continue; const p = g.plan;
  for (const w of p.weeks.slice(0, -1)) for (const dv of [3, 6, 9, 12]) {
    const v = Math.max(30, p.vdot - dv); const at = w.endDate;
    const r: any = adaptFiveKV2(p, { results: [{ distM: 5000, sec: Math.round(raceTimeForVdot(v, 5000)), date: at, kind: 'race' }] }, at); n++;
    if (!r.ok) for (const x of r.violations.filter((y: any) => y.severity === 'error')) { rules[x.rule] = (rules[x.rule] ?? 0) + 1; ex[x.rule] ??= `${b.id} ${at} v${v}: ${x.message}`; }
  }
}
console.log({ n, rules, ex });
