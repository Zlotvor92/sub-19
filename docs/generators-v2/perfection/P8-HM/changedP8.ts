/* P8-HM (hm-v2.11.0) — planovi generatora čiji se rezultat menja prema 0181e25 (hm-v2.10.0), sa klasom:
   v = vrh obima niži (G1 plafon vrha / G6), u = vrh isti ili viši a plan promenjen (G1 raspored rasta, G2, G4, G5, G6,
   G7, HM (b), tekst napomena), r = plan → odbijanje, n = odbijanje → plan. Mreže 02, 03 (po osećaju, početnik) i pouke
   28 (`r-`), isti skup kao P5.
   Iz web/: node ../docs/generators-v2/perfection/P8-HM/changedP8.ts <web/ na 0181e25> \
     > src/domain/generators/halfMarathon/v2/segmentP8.changed-0181e25.json */
const A = `${process.argv[2]}/src/domain/generators/halfMarathon/v2`;
const Bp = '../../../../web/src/domain/generators/halfMarathon/v2';
const ga = (await import(`${A}/generate.ts`)).generateHmV2;
const gb = (await import(`${Bp}/generate.ts`)).generateHmV2;
const T = await import(`${Bp}/testInputs.ts`);
const key = (r: any) => JSON.stringify(r.ok ? { ...r.plan, policyVersion: '' } : { ok: false });
const out: Record<string, string> = {};
const cls: Record<string, number> = {};
let total = 0;
const cmp = (id: string, input: unknown) => {
  total++;
  const a = ga(input), b = gb(input);
  if (key(a) === key(b)) return;
  const c = a.ok && !b.ok ? 'r' : !a.ok && b.ok ? 'n' : b.plan.peakKm < a.plan.peakKm ? 'v' : 'u';
  out[id] = c; cls[c] = (cls[c] ?? 0) + 1;
};
for (const g of [...T.grid02Inputs(), ...T.feelInputs(), ...T.beginnerInputs()]) cmp(g.id, g.input);
for (const days of T.DAY_COUNTS)
  for (let r = 5; r <= 42; r++)
    for (let km = T.KM_BY_DAYS[days].min; km <= T.KM_BY_DAYS[days].max; km += 5)
      for (const vdot of [30, 45, 70])
        for (const weeks of [10, 14, 20])
          cmp(`r-d${days}-${weeks}w-${km}km-v${vdot}-r${r}`, T.inputOf({ weeks, km, vdot, days: T.SCHEDULES_BY_DAYS[days].A.days, recentLongRunKm: r }));
console.error(JSON.stringify({ total, changed: Object.keys(out).length, cls }));
console.log(JSON.stringify(out, null, 2));
