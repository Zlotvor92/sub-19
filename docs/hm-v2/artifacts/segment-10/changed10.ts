/* HM-10 (krug T) — planovi generatora čiji se rezultat menja prema b9c4728 (pre HM-10), sa klasom:
   l = T1 — stari plan ima nedelju izgradnje (ne rasterećenje/taper/trkačka) sa laganim > 0,8 × dugi ili < 20 min
       (lagani na 0,8 × dugi, manje laganih dana, spuštena nedelja; posledice u kasnijim nedeljama: cilj, doze, taper),
   r = T1 — stari plan krši T1 u nedelji izgradnje, nov ulaz se odbija RECENT_LONG_TOO_SHORT sa pragom (pouka 28),
   m = T1 — stari plan ima lagan nedelje izgradnje na granici 20 min (≤ 20 min + 0,1 km): dugi ostavlja mesta za
       najkraći lagan pre zaokruživanja (dugi −0,1 km),
   p = T7 — skorašnji najduži > trenutni nedeljni obim → odbijanje RECENT_LONG_OVER_WEEKLY (plauzibilnost),
   d = samo tekst napomena/upozorenja/razloga odbijanja,
   x = drugo (mora biti 0). Mreže 02, 03 (po osećaju, početnik) i pouke 28 (`r-`). Bez slučajnosti.
   Iz web/: node ../docs/hm-v2/artifacts/segment-10/changed10.ts <web/ na b9c4728> > src/domain/generators/halfMarathon/v2/segment10.changed-b9c4728.json */
const A = `${process.argv[2]}/src/domain/generators/halfMarathon/v2`;
const B = '../../../../web/src/domain/generators/halfMarathon/v2';
const ga = (await import(`${A}/generate.ts`)).generateHmV2;
const gb = (await import(`${B}/generate.ts`)).generateHmV2;
const T = await import(`${B}/testInputs.ts`);
const noText = (p: any) => JSON.stringify({ ...p, policyVersion: '', notes: [], warnings: p.warnings.map((w: any) => [w.rule, w.severity, w.week ?? null]), weeks: p.weeks.map((w: any) => ({ ...w, notes: [] })) });
const t1Bad = (p: any) =>
  p.weeks.some((w: any) => {
    if (w.deload || !['base', 'development', 'specific'].includes(w.phase)) return false;
    const L = w.days.find((d: any) => d.role === 'long');
    return !!L && w.days.some((d: any) => d.role === 'easy' && (Math.round(d.workout.km * 10) > Math.floor(8 * Math.round(L.workout.km * 10) / 10) || d.workout.sec < 1200));
  });
const near20 = (p: any) =>
  p.weeks.some((w: any) => !w.deload && ['base', 'development', 'specific'].includes(w.phase) &&
    w.days.some((d: any) => d.role === 'easy' && d.workout.sec < 1200 + (d.workout.sec / d.workout.km) * 0.1 + 1e-9));
const out: Record<string, string> = {};
const cls: Record<string, number> = {};
const cmp = (id: string, input: unknown) => {
  const a: any = ga(input), b: any = gb(input);
  if (JSON.stringify(a.ok ? { ...a.plan, policyVersion: '' } : a) === JSON.stringify(b.ok ? { ...b.plan, policyVersion: '' } : b)) return;
  let c = 'x';
  if (!a.ok && !b.ok && JSON.stringify(a.reasons.map((r: any) => r.code)) === JSON.stringify(b.reasons.map((r: any) => r.code))) c = 'd';
  if (a.ok && b.ok) c = noText(a.plan) === noText(b.plan) ? 'd' : t1Bad(a.plan) ? 'l' : near20(a.plan) ? 'm' : 'x';
  if (!b.ok && b.reasons.every((r: any) => r.code === 'RECENT_LONG_OVER_WEEKLY')) c = 'p';
  if (a.ok && !b.ok && b.reasons.every((r: any) => r.code === 'RECENT_LONG_TOO_SHORT') && t1Bad(a.plan)) c = 'r';
  out[id] = c; cls[c] = (cls[c] ?? 0) + 1;
};
for (const g of [...T.grid02Inputs(), ...T.feelInputs(), ...T.beginnerInputs()]) cmp(g.id, g.input);
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
