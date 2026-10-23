/* HM-09 — planovi generatora čiji se rezultat menja prema c13c258 (pre HM-09), sa klasom:
   a = sadržaj tapera/trkačke nedelje (pouka 35 u taperu: drugi dan kvaliteta lagan; trkačka nedelja čita taper),
   d = samo tekst napomena/upozorenja (uvod početnika „prva od 2 uvodne nedelje", napomena tapera „najmanja doza"),
   x = drugo (mora biti 0). Mreže 02, 03 (po osećaju, početnik) i pouke 28 (`r-`). Bez slučajnosti.
   Iz web/: node ../docs/hm-v2/artifacts/segment-09/changed09.ts <web/ na c13c258> > src/domain/generators/halfMarathon/v2/segment09.changed-c13c258.json */
const A = `${process.argv[2]}/src/domain/generators/halfMarathon/v2`;
const B = '../../../../web/src/domain/generators/halfMarathon/v2';
const ga = (await import(`${A}/generate.ts`)).generateHmV2;
const gb = (await import(`${B}/generate.ts`)).generateHmV2;
const T = await import(`${B}/testInputs.ts`);
const noText = (p: any) => JSON.stringify({ ...p, policyVersion: '', notes: [], warnings: p.warnings.map((w: any) => [w.rule, w.severity, w.week ?? null]), weeks: p.weeks.map((w: any) => ({ ...w, notes: [] })) });
const out: Record<string, string> = {};
const cls: Record<string, number> = {};
const cmp = (id: string, input: unknown) => {
  const a: any = ga(input), b: any = gb(input);
  if (JSON.stringify(a.ok ? { ...a.plan, policyVersion: '' } : a) === JSON.stringify(b.ok ? { ...b.plan, policyVersion: '' } : b)) return;
  let c = 'x';
  if (a.ok && b.ok) {
    if (noText(a.plan) === noText(b.plan)) c = 'd';
    else {
      const ph = new Set(a.plan.weeks.filter((w: any, j: number) => JSON.stringify({ ...w, notes: [] }) !== JSON.stringify({ ...b.plan.weeks[j], notes: [] })).map((w: any) => w.phase));
      if ([...ph].every((x) => x === 'taper' || x === 'race')) c = 'a';
    }
  }
  out[id] = c; cls[c] = (cls[c] ?? 0) + 1;
};
for (const g of [...T.grid02Inputs(), ...T.feelInputs(), ...T.beginnerInputs()]) cmp(g.id, g.input);
// Mreža pouke 28 (recent.harness.node.test.ts ALL — ista konstrukcija; harness uvozi vitest).
const recent: any[] = T.DAY_COUNTS.flatMap((days: 3 | 4 | 5 | 6) => {
  const o: any[] = [];
  for (let r = 5; r <= 42; r++)
    for (let km = T.KM_BY_DAYS[days].min; km <= T.KM_BY_DAYS[days].max; km += 5)
      for (const vdot of [30, 45, 70])
        for (const weeks of [10, 14, 20]) o.push({ id: `d${days}-${weeks}w-${km}km-v${vdot}-r${r}`, days, km, vdot, weeks, r });
  return o;
});
for (const g of recent)
  cmp(`r-${g.id}`, T.inputOf({ weeks: g.weeks, km: g.km, vdot: g.vdot, days: T.SCHEDULES_BY_DAYS[g.days].A.days, recentLongRunKm: g.r }));
console.error(JSON.stringify({ recent: recent.length, cls }));
console.log(JSON.stringify(out, null, 2));
