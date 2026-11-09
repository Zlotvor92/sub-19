/* P1-STOP2 — taper bez kvaliteta i trkačka nedelja bez oštrenja: mreže 02 + 03 (po osećaju, početnik), pre (a952769) i posle.
   Iz web/: node ../docs/generators-v2/perfection/P1/taperGrid.ts <web/ na a952769> */
const A = `${process.argv[2]}/src/domain/generators/halfMarathon/v2`;
const B = "../../../../web/src/domain/generators/halfMarathon/v2";
const ga = (await import(`${A}/generate.ts`)).generateHmV2;
const gb = (await import(`${B}/generate.ts`)).generateHmV2;
const T = await import(`${B}/testInputs.ts`);
const Q = await import(`${B}/quality.ts`);
const st = (p: any) => { const t = p.weeks.find((w: any) => w.phase === "taper"); const r = p.weeks.at(-1);
  return { q: t.days.some((d: any) => d.workout.kind === "quality"), sh: r.days.some((d: any) => d.role === "sharpener"), t: t.targetKm }; };
const g: Record<string, { n: number; preNo: number; postNo: number; newNo: number; newNoSharp: number; fixB: number }> = {};
for (const x of [...T.grid02Inputs(), ...T.feelInputs(), ...T.beginnerInputs()]) {
  const a: any = ga(x.input), b: any = gb(x.input); if (!a.ok || !b.ok) continue;
  const k = `${x.id.startsWith("f-") ? "F" : x.id.startsWith("b-") ? "B" : "R"} d${x.id.match(/d(\d)/)![1]}`;
  const e = (g[k] ??= { n: 0, preNo: 0, postNo: 0, newNo: 0, newNoSharp: 0, fixB: 0 }); e.n++;
  const sa = st(a.plan), sb = st(b.plan);
  if (!sa.q) e.preNo++; if (!sb.q) e.postNo++;
  if (sa.q && !sb.q) { e.newNo++; if (sa.sh && !sb.sh) e.newNoSharp++; if (4000 <= Q.capM("RP", sb.t)) e.fixB++; }
}
for (const [k, e] of Object.entries(g).sort()) console.log(`${k}: n ${e.n}; taper bez kvaliteta pre ${e.preNo}, posle ${e.postNo}; novih ${e.newNo} (od toga i bez oštrenja ${e.newNoSharp}; opcija (b) vraća RP u ${e.fixB})`);
