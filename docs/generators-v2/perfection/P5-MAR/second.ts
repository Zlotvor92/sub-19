/* P5-MAR — dopuna odluke F4 (organizator, 10. 11. 2026): broj nedelja u kojima je drugi dan kvaliteta lagan (pouka 35,
   napomena „Q2: dan kvaliteta je lagan …") i nedelja sa dozom spuštenom zbog „dan kvaliteta ≤ dugi" (pouka 32: korak
   'drop' ili napomena sa „pouka 32"), stari kod (worktree) prema tekućem; mreže 02, 03 po osećaju, 03 početnika.
   Iz korena: node docs/generators-v2/perfection/P5-MAR/second.ts <worktree> */
const wt = process.argv[2]!;
const NEW = new URL("../../../../web/src/domain/generators/marathon/v2", import.meta.url).pathname;
const T = await import(`${NEW}/testInputs.ts`);
const out: Record<string, Record<string, number>> = {};
for (const [tag, dir] of [["pre", `${wt}/web/src/domain/generators/marathon/v2`], ["posle", NEW]] as const) {
  const gen = (await import(`${dir}/generate.ts`)).generateMarathonV2;
  const c = (out[tag] = { planova: 0, p35: 0, p35planova: 0, p32drop: 0, p32note: 0, taper35: 0 });
  for (const x of [...T.gridInputs(), ...T.feelInputs(), ...T.beginnerInputs()]) {
    const r = gen(x.input);
    if (!r.ok) continue;
    c.planova++;
    let any = false;
    for (const w of r.plan.weeks) {
      if (w.notes.some((n: string) => n.startsWith("Q2: dan kvaliteta je lagan"))) { c.p35++; any = true; }
      if (w.notes.some((n: string) => n.includes("T dan je lagan"))) c.taper35++;
      if (w.days.some((d: any) => d.workout.dose?.step === "drop")) c.p32drop++;
      if (w.notes.some((n: string) => n.includes("pouka 32"))) c.p32note++;
    }
    if (any) c.p35planova++;
  }
}
console.log(JSON.stringify(out));
