/* 10K-08: stanje planova generatora (mreža 01 i mreže 02 R, F, B — ulazi planGrid.runPlanGrid i p35) za fixture
   segment08.changed-b9c4728.json: id → [planHash81, cause07, summaryRow]. Pokrenuti nad oba stabla:
   node gen-dump.ts <apsolutna putanja do tenK/v2> > izlaz.json */
const root = process.argv[2]!;
const { generateTenKV2 } = await import(root + "/generate.ts");
const T = await import(root + "/testInputs.ts");
const G = await import(root + "/gridInvariants.ts");
const cases = [
  ...T.gridInputs(),
  ...([3, 4, 5, 6] as const).flatMap((d) => T.grid02Inputs(d)),
  ...([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d)),
  ...([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d)),
];
const out: Record<string, unknown> = {};
for (const c of cases) {
  const r = generateTenKV2(c.input);
  out[c.id] = [T.planHash81(r), T.cause07(r), r.ok ? G.summaryRow(r.plan) : null];
}
process.stdout.write(JSON.stringify(out));
