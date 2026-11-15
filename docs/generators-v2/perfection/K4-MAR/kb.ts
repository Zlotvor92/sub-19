/* K4-MAR (K4-B) — po porodici: planovi sa danom odmora malog obima (napomena plana), planovi kod kojih je odluka
   postojala, ali drugi sastav nije prošao (vraćen plan bez K4-B), broj nedelja sa danom odmora, obim ostalih laganih
   (medijana km laganog dana u tim nedeljama). Iz korena: node --max-old-space-size=6144 docs/.../K4-MAR/kb.ts */
const V2 = new URL("../../../../web/src/domain/generators/marathon/v2", import.meta.url).pathname;
const T = await import(`${V2}/testInputs.ts`);
const { generateMarathonV2 } = await import(`${V2}/generate.ts`);
const W = await import(`${V2}/week.ts`);
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
for (const [fam, list] of [["R", T.gridInputs()], ["F", T.feelInputs()], ["B", T.beginnerInputs()]] as const) {
  const g: Record<string, { applied: number; fallback: number; weeks: number; easy: number[]; under: number }> = {};
  for (const c of list) {
    const r = generateMarathonV2(c.input); if (!r.ok) continue;
    const G = (g[`${fam}-d${c.days}`] ??= { applied: 0, fallback: 0, weeks: 0, easy: [], under: 0 });
    if (r.plan.notes.includes(W.SHORT_REST_PLAN_NOTE)) {
      G.applied++;
      for (const w of r.plan.weeks.filter(W.shortRestWeek)) {
        G.weeks++; if (w.plannedKm + 0.05 < w.targetKm) G.under++;
        G.easy.push(...w.days.filter((d: any) => d.role === "easy").map((d: any) => d.workout.km));
      }
    } else if (W.shortEasyWeeks(r.plan.weeks).length > 0) G.fallback++;
  }
  for (const [k, G] of Object.entries(g)) console.log(k, `K4-B ${G.applied} (nedelja ${G.weeks}, planirano < cilj ${G.under}, lagan med ${med(G.easy)} km) vraćeno ${G.fallback}`);
}
