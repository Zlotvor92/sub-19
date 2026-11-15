/* P5-HM — odluka organizatora 10. 11. 01:28 (F4 × pouka 35/32): nedelje izgradnje u kojima je drugi dan kvaliteta lagan
   (pouka 35, SECOND_EASY_NOTE) i doze spuštene po pouci 32 (korak 'drop'), pre (8e87fd4) i posle; uz to isto za
   kopiju sa samo F4 isključenim (var-f13 = posle bez F4) da se izdvoji uzrok. Mreže 02 + 03.
   Iz web/: node ../docs/generators-v2/perfection/P5-HM/f4cost.ts <web/ na 8e87fd4> [scratch/var-f13/v2] */
const A = `${process.argv[2]}/src/domain/generators/halfMarathon/v2`;
const B = '../../../../web/src/domain/generators/halfMarathon/v2';
const gens: [string, any][] = [["pre", (await import(`${A}/generate.ts`)).generateHmV2], ["posle", (await import(`${B}/generate.ts`)).generateHmV2]];
if (process.argv[3]) gens.push(["posle bez F4", (await import(`${process.argv[3]}/generate.ts`)).generateHmV2]);
const T = await import(`${B}/testInputs.ts`);
const inputs = [...T.grid02Inputs(), ...T.feelInputs(), ...T.beginnerInputs()];
for (const [name, g] of gens) {
  let sec = 0, secPlans = 0, drop = 0, dropStart = 0, rej = 0, weeks = 0;
  const byDays: Record<string, number> = {};
  for (const x of inputs) {
    const r = g(x.input);
    if (!r.ok) { rej++; continue; }
    let had = false;
    const firstSeen = new Set<string>();
    for (const w of r.plan.weeks) {
      if (!["base", "development", "specific"].includes(w.phase) || w.deload) continue;
      weeks++;
      if (w.notes.some((n: string) => n.includes("drugi dan kvaliteta je lagan (pouka 35)"))) { sec++; had = true; byDays[x.id.slice(0, 2)] = (byDays[x.id.slice(0, 2)] ?? 0) + 1; }
      for (const d of w.days) {
        const ds = d.workout.dose; if (!ds) continue;
        const key = ds.zone;
        if (ds.step === "drop") { drop++; if (!firstSeen.has(key)) dropStart++; }
        firstSeen.add(key);
      }
    }
    if (had) secPlans++;
  }
  console.log(`${name}: planova ${inputs.length - rej}, nedelja izgradnje ${weeks}; pouka 35 nedelja ${sec} (planova ${secPlans}, po danima ${JSON.stringify(byDays)}); doza 'drop' ${drop} (prva doza zone ${dropStart})`);
}
