/* MAR-07 N1 (merenje organizatora): svaki 7. plan gridInputs sa 3 dana, bol 7 i 8 poslednji dan nedelje N − 1 →
   odbijanja. Iz korena repoa: node docs/marathon-v2/artifacts/segment-07/n1.ts [koren] → JSON. */
const root = process.argv[2] ?? new URL("../../../../", import.meta.url).pathname;
const G = `${root}/web/src/domain/generators/marathon/v2`;
const { generateMarathonV2, adaptMarathonV2 } = await import(`${G}/index.ts`);
const T = await import(new URL("../../../../web/src/domain/generators/marathon/v2/testInputs.ts", import.meta.url).href);
let flows = 0, rejected = 0, raceOnly = 0;
const cls: Record<string, number> = {};
for (const [i, c] of T.gridInputs().entries()) {
  if (i % 7 !== 0 || c.days !== 3) continue;
  const p = generateMarathonV2(c.input).plan;
  const N = p.weeks.length;
  const at = p.weeks[N - 2].endDate;
  for (const level of [7, 8]) {
    flows++;
    const r = adaptMarathonV2(p, T.painFacts(at, level), at);
    if (!r.ok) {
      rejected++;
      const k = r.reasons.map((x: any) => x.message.split(":")[0]).join(",");
      cls[k] = (cls[k] ?? 0) + 1;
    } else if (r.plan.weeks[N - 1].days.length === 1) raceOnly++;
  }
}
console.log(JSON.stringify({ flows, rejected, cls, raceOnly }));
