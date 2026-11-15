const wt = "/tmp/claude-0/-home-user-sub-19/292d3a73-5b82-5f98-bcbb-3bcfd0af9643/scratchpad/wt";
const NEW = "/home/user/sub-19/web/src/domain/generators/marathon/v2";
const T = await import(`${NEW}/testInputs.ts`);
for (const [tag, dir] of [["pre", `${wt}/web/src/domain/generators/marathon/v2`], ["posle", NEW]] as const) {
  const gen = (await import(`${dir}/generate.ts`)).generateMarathonV2;
  const c: Record<string, number> = {};
  let ex = 0;
  for (const x of [...T.gridInputs(), ...T.feelInputs(), ...T.beginnerInputs()]) {
    const r = gen(x.input); if (!r.ok) continue;
    for (const w of r.plan.weeks) for (const d of w.days) if (d.workout.dose?.step === "drop") {
      const why = w.notes.find((n: string) => /pouka 32|pouka 12|plafon|M11/.test(n) && /spušt|niž|drop|Q[12]/.test(n)) ?? w.notes.join(" / ");
      const k = `${w.test ? "TEST " : ""}${w.phase}${w.deload ? "D" : ""} ${d.workout.dose.ladder} fitted=${w.fitted} ${/pouka 32/.test(why) ? "p32" : "other"}`;
      c[k] = (c[k] ?? 0) + 1;
      if (tag === "posle" && ex < 3 && /pouka 32/.test(why)) { ex++; console.log(x.id, w.index, d.role, d.workout.dose.doseM, why.slice(0, 300)); }
    }
  }
  console.log(tag, JSON.stringify(c, null, 0));
}
