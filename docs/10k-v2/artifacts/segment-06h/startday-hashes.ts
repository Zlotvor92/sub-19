// 06h: heševi trajne mreže „asOf = prvi dan plana" (repeatGrid) iz checkouta <root>: svi planovi mreže E × START0_SCENARIOS,
// redosled plan × scenario; 0 = odbijeno. Iz web/: node ../docs/10k-v2/artifacts/segment-06h/startday-hashes.ts <root> <sha> > fixture
const [ROOT, SHA] = process.argv.slice(2);
const V = `${ROOT}/web/src/domain/generators/tenK/v2`;
const { adaptTenKV2 } = await import(`${V}/adapt.ts`);
const { generateTenKV2 } = await import(`${V}/generate.ts`);
const T: any = await import(`${V}/testInputs.ts`);
const SC = [...T.EARLY_SCENARIOS, 'faster'];
const hashes: number[] = [];
for (const b of T.earlyGridBases()) {
  const g: any = generateTenKV2(b.input);
  const p = g.plan;
  const at = p.input.startDate;
  for (const s of SC) {
    const r: any = adaptTenKV2(p, T.earlyFacts(p, s, at), at);
    hashes.push(r.ok ? T.planHash06c(r) : 0);
  }
}
console.log(JSON.stringify({ against: SHA, scenarios: SC, hashes }));
