/* P5 (5K) — nalaz P4: ispis jednog toka „sporiji rezultat u vrhuncu" (trajna rana mreža 08g, scenarij slower) —
   nedelje vrhunca/oštrenja pre i posle adaptacije. Iz web/: node ../docs/generators-v2/perfection/P5-5K/slower.ts <id> <tag> */
const T = await import("../../../../web/src/domain/generators/fiveK/v2/testInputs.ts");
const [id, tag] = [process.argv[2] ?? "r-d5-12w-60km-v38-1", process.argv[3] ?? "w5end"];
const eb = T.earlyGridBases().find((b: any) => b.id === id)!;
const f = T.earlyFlows(eb.id, eb.input).find((x: any) => x.key === `${id}/${tag}/slower`)!;
const show = (p: any, label: string) => {
  console.log(`${label}: VDOT ${p.vdot}`);
  for (const w of p.weeks.filter((w: any) => w.phase === "peak" || w.phase === "sharpen"))
    console.log(`  ${w.index} ${w.phase}${w.deload ? "*" : ""}${w.test ? " TEST" : ""} cilj ${w.targetKm} budžet I ${w.budgets.I}: ` + w.days.filter((d: any) => d.workout.kind === "quality").map((d: any) => d.workout.title).join(" | ") + (w.notes.length ? "  ·  " + w.notes.join(" / ") : ""));
};
show(f.plan, "pre adaptacije");
console.log(`asOf ${f.asOf}; ${f.res.reasons.map((r: any) => r.message).join(" / ")}`);
show(f.res.plan, "posle");
