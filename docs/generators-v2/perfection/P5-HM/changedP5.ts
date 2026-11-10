/* P5-HM (hm-v2.10.0) — planovi generatora čiji se rezultat menja prema 8e87fd4 (hm-v2.9.0), sa klasom (slova po
   pravilu koje menja plan; utvrđeno kopijama v2 foldera sa samo jednim pravilom uključenim):
   t = F1 (kontrolni test u planu sa rezultatom), s = F3 (ubrzanja), d = F4 (početni nivo T/I 80 %), x = drugo (mora 0).
   Dokaz: kopija sa sva tri pravila isključena (F2 važi samo u adaptaciji) je bajt-ista sa 8e87fd4 u svim ulazima (osim
   oznake verzije) — inače `offDiff` > 0. Mreže 02, 03 (po osećaju, početnik) i pouke 28 (`r-`), isti skup kao P1.
   Iz web/: node ../docs/generators-v2/perfection/P5-HM/changedP5.ts <web/ na 8e87fd4> <scratch sa var-off,var-f1,var-f3,var-f4> \
     > src/domain/generators/halfMarathon/v2/segmentP5.changed-8e87fd4.json */
const A = `${process.argv[2]}/src/domain/generators/halfMarathon/v2`;
const V = process.argv[3];
const Bp = '../../../../web/src/domain/generators/halfMarathon/v2';
const ga = (await import(`${A}/generate.ts`)).generateHmV2;
const gb = (await import(`${Bp}/generate.ts`)).generateHmV2;
const g0 = (await import(`${V}/var-off/v2/generate.ts`)).generateHmV2;
const g1 = (await import(`${V}/var-f1/v2/generate.ts`)).generateHmV2;
const g3 = (await import(`${V}/var-f3/v2/generate.ts`)).generateHmV2;
const g4 = (await import(`${V}/var-f4/v2/generate.ts`)).generateHmV2;
const T = await import(`${Bp}/testInputs.ts`);
const key = (r: any) => JSON.stringify(r.ok ? { ...r.plan, policyVersion: '' } : r);
const out: Record<string, string> = {};
const cls: Record<string, number> = {};
let offDiff = 0; const offIds: string[] = []; let total = 0;
const cmp = (id: string, input: unknown) => {
  total++;
  const a = key(ga(input)), b = key(gb(input)), o = key(g0(input));
  if (o !== a) { offDiff++; if (offIds.length < 10) offIds.push(id); }
  if (a === b) return;
  let c = '';
  if (key(g1(input)) !== o) c += 't';
  if (key(g3(input)) !== o) c += 's';
  if (key(g4(input)) !== o) c += 'd';
  if (c === '') c = 'x';
  out[id] = c; cls[c] = (cls[c] ?? 0) + 1;
};
for (const g of [...T.grid02Inputs(), ...T.feelInputs(), ...T.beginnerInputs()]) cmp(g.id, g.input);
for (const days of T.DAY_COUNTS)
  for (let r = 5; r <= 42; r++)
    for (let km = T.KM_BY_DAYS[days].min; km <= T.KM_BY_DAYS[days].max; km += 5)
      for (const vdot of [30, 45, 70])
        for (const weeks of [10, 14, 20])
          cmp(`r-d${days}-${weeks}w-${km}km-v${vdot}-r${r}`, T.inputOf({ weeks, km, vdot, days: T.SCHEDULES_BY_DAYS[days].A.days, recentLongRunKm: r }));
console.error(JSON.stringify({ total, changed: Object.keys(out).length, cls, offDiff, offIds }));
console.log(JSON.stringify(out, null, 2));
