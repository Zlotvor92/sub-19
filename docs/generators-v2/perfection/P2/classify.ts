/* P2 — planovi mreža 02, 03 po osećaju i 03 početnika (testInputs: gridInputs, feelInputs, beginnerInputs): stari kod
   (worktree polaznog SHA, argument 1) prema tekućem. Plan bajt-isti (JSON bez policyVersion) → stabilan; promenjen →
   klasa: S1 (nedelja B sa blokom MP), S2 (dugi na plafonu 150 min ili > 32 km u starom planu, bez nedelje B), ostalo.
   Iz korena repoa: node docs/generators-v2/perfection/P2/classify.ts <worktree> <sha>
   → web/src/domain/generators/marathon/v2/segmentP2.stable-<sha>.json, docs/generators-v2/perfection/P2/changed-<sha>.json */
import { writeFileSync, readFileSync } from "node:fs";
const [wt, sha] = [process.argv[2]!, process.argv[3]!];
const NEW = "/home/user/sub-19/web/src/domain/generators/marathon/v2";
const OLD = `${wt}/web/src/domain/generators/marathon/v2`;
const T = await import(`${NEW}/testInputs.ts`);
const genN = (await import(`${NEW}/generate.ts`)).generateMarathonV2;
const genO = (await import(`${OLD}/generate.ts`)).generateMarathonV2;
const lenO = await import(`${OLD}/lengths.ts`);
const strip = (p: any) => JSON.stringify({ ...p, policyVersion: null });
const prevStable = new Set(JSON.parse(readFileSync(`${NEW}/segment11.stable-b9c4728.json`, "utf8")) as string[]);
const stable: string[] = [];
const changed: Record<string, string[]> = { S1: [], S2: [], ostalo: [] };
let n = 0, rej = 0;
for (const c of [...T.gridInputs(), ...T.feelInputs(), ...T.beginnerInputs()]) {
  n++;
  const a = genO(c.input), b = genN(c.input);
  if (!a.ok || !b.ok) { if (a.ok !== b.ok) { rej++; console.log("RAZLIKA ok", c.id, a.ok, b.ok); } continue; }
  if (strip(a.plan) === strip(b.plan)) { stable.push(c.id); continue; }
  const blk = b.plan.weeks.some((w: any) => w.days.some((d: any) => d.role === "long" && d.workout.workKm.MP > 0));
  const s2 = a.plan.weeks.some((w: any) => w.days.some((d: any) => d.role === "long" &&
    (d.workout.km > 32 + 1e-9 || Math.round(d.workout.km * 10) === lenO.longTimeCap10(a.plan.paces))));
  changed[blk ? "S1" : s2 ? "S2" : "ostalo"]!.push(c.id);
}
const stableP2 = stable.filter((id) => prevStable.has(id)).sort();
writeFileSync(`${NEW}/segmentP2.stable-${sha}.json`, JSON.stringify(stableP2) + "\n");
writeFileSync(new URL(`changed-${sha}.json`, import.meta.url), JSON.stringify(changed, null, 0) + "\n");
console.log(`ulaza ${n}; razlika ok/odbijeno ${rej}; bajt-isto ${stable.length} (od toga u STABLE MAR-11 ${stableP2.length}); promenjeno S1 ${changed.S1!.length}, S2 ${changed.S2!.length}, ostalo ${changed.ostalo!.length}`);
