/* P5-MAR — planovi mreža 02, 03 po osećaju i 03 početnika (testInputs: gridInputs, feelInputs, beginnerInputs): stari
   kod (worktree polaznog SHA, argument 1) prema tekućem. Novi plan bez ubrzanja (dan sa ubrzanjima → lagan dan iste
   dužine, kao grid.harness withoutStrides) bajt-isti sa starim (JSON bez policyVersion) → stabilan; inače prva
   različita nedelja i njena klasa: F1 (nedelja testa plana sa rezultatom), F4 (nedelja sa T/I dozom koja se razlikuje
   ili prva nedelja T/I lestvice), ostalo. Dokaz po klasi: nedelje pre prve različite su bajt-iste (po konstrukciji
   poređenja); klasa „ostalo" mora biti 0. Dodatno: svaka nedelja sa ubrzanjima je posle uklanjanja ubrzanja ista
   kao u novom planu bez ubrzanja (km dana, segmenti lagani).
   Iz korena repoa: node docs/generators-v2/perfection/P5-MAR/classify.ts <worktree> <sha>
   → web/src/domain/generators/marathon/v2/segmentP5.stable-<sha>.json, docs/generators-v2/perfection/P5-MAR/changed-<sha>.json */
import { writeFileSync, readFileSync } from "node:fs";
const [wt, sha] = [process.argv[2]!, process.argv[3]!];
const NEW = new URL("../../../../web/src/domain/generators/marathon/v2", import.meta.url).pathname;
const OLD = `${wt}/web/src/domain/generators/marathon/v2`;
const T = await import(`${NEW}/testInputs.ts`);
const genN = (await import(`${NEW}/generate.ts`)).generateMarathonV2;
const genO = (await import(`${OLD}/generate.ts`)).generateMarathonV2;
const easyN = (await import(`${NEW}/workouts.ts`)).easyWorkout;
const strip = (p: any) => JSON.stringify({ ...p, policyVersion: null });
const noStrides = (p: any) => ({ ...p, weeks: p.weeks.map((w: any) => ({ ...w, days: w.days.map((d: any) =>
  d.role === "easy" && d.workout.segments.some((s: any) => s.kind === "stride") ? { ...d, workout: easyN(d.workout.km, p.paces) } : d) })) });
const prevStable = new Set(JSON.parse(readFileSync(`${NEW}/segmentP2.stable-38fd091.json`, "utf8")) as string[]);
const stable: string[] = [];
const changed: Record<string, string[]> = { F1: [], F4: [], ostalo: [] };
const byFamily: Record<string, Record<string, number>> = {};
let n = 0, rej = 0, stridePlans = 0;
const t0 = Date.now();
const tiDoses = (w: any) => w.days.map((d: any) => d.workout.dose).filter((x: any) => x && (x.zone === "T" || x.zone === "I")).map((x: any) => `${x.ladder}:${x.doseM}`).sort().join(",");
for (const [fam, list] of [["R", T.gridInputs()], ["F", T.feelInputs()], ["B", T.beginnerInputs()]] as const) {
  const cnt = (byFamily[fam] ??= { ulaza: 0, stabilno: 0, F1: 0, F4: 0, ostalo: 0 });
  for (const c of list) {
    n++; cnt.ulaza!++;
    const a = genO(c.input), b0 = genN(c.input);
    if (!a.ok || !b0.ok) { if (a.ok !== b0.ok) { rej++; console.log("RAZLIKA ok", c.id, a.ok, b0.ok); } continue; }
    if (b0.plan.weeks.some((w: any) => w.days.some((d: any) => d.workout.segments.some((s: any) => s.kind === "stride") && d.role === "easy"))) stridePlans++;
    const b = noStrides(b0.plan);
    if (strip(a.plan) === strip(b)) { stable.push(c.id); cnt.stabilno!++; continue; }
    const i = b.weeks.findIndex((w: any, k: number) => JSON.stringify(w) !== JSON.stringify(a.plan.weeks[k]));
    const wn = b.weeks[i], wo = a.plan.weeks[i];
    const seenTI = (p: any, k: number) => new Set(p.weeks.slice(0, k).flatMap((w: any) => w.days.map((d: any) => d.workout.dose?.ladder).filter(Boolean)));
    const firstTI = wo && wo.days.some((d: any) => d.workout.dose && (d.workout.dose.zone === "T" || d.workout.dose.zone === "I") && !seenTI(a.plan, i).has(d.workout.dose.ladder));
    const cls = i < 0 ? "ostalo" : wn.days.some((d: any) => d.role === "test") && !(wo.days.some((d: any) => d.role === "test")) ? "F1" : tiDoses(wn) !== tiDoses(wo) || firstTI ? "F4" : "ostalo";
    changed[cls]!.push(c.id); cnt[cls]!++;
  }
}
const stableP5 = stable.filter((id) => prevStable.has(id)).sort();
writeFileSync(`${NEW}/segmentP5.stable-${sha}.json`, JSON.stringify(stableP5) + "\n");
writeFileSync(new URL(`changed-${sha}.json`, import.meta.url), JSON.stringify({ byFamily, changed }, null, 0) + "\n");
console.log(`ulaza ${n}; razlika ok/odbijeno ${rej}; planova sa ubrzanjima ${stridePlans}; bajt-isto bez ubrzanja ${stable.length} (od toga u STABLE P2 ${stableP5.length}); prva različita nedelja F1 ${changed.F1!.length}, F4 ${changed.F4!.length}, ostalo ${changed.ostalo!.length}; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(JSON.stringify(byFamily));
console.log("ostalo (prvih 10):", changed.ostalo!.slice(0, 10).join(" "));
