/* P1 (hm-v2.9.0) — planovi generatora čiji se rezultat menja prema a952769 (hm-v2.8.0), sa klasom:
   b = S1 — plan ima dugi sa blokom RP (nedelja tipa B; uz to i S2),
   s = S2 — bez bloka; razlika samo u dozama RP (plafon RP po pojasu cilja, lestvica do 3 × 5000 m) i posledicama
       (dužine nedelja sa RP, taper, oštrenje),
   d = samo tekst napomena/upozorenja,
   x = drugo (mora biti 0; npr. promena nedelje baze ili razvoja).
   Uz to broji planove čije se nedelje baze/razvoja razlikuju (mora 0). Mreže 02, 03 (po osećaju, početnik), pouke 28 (`r-`).
   Iz web/: node ../docs/generators-v2/perfection/P1/changedP1.ts <web/ na a952769> > src/domain/generators/halfMarathon/v2/segmentP1.changed-a952769.json */
const A = `${process.argv[2]}/src/domain/generators/halfMarathon/v2`;
const B = '../../../../web/src/domain/generators/halfMarathon/v2';
const ga = (await import(`${A}/generate.ts`)).generateHmV2;
const gb = (await import(`${B}/generate.ts`)).generateHmV2;
const T = await import(`${B}/testInputs.ts`);
const noText = (p: any) => JSON.stringify({ ...p, policyVersion: '', notes: [], warnings: p.warnings.map((w: any) => [w.rule, w.severity, w.week ?? null]), weeks: p.weeks.map((w: any) => ({ ...w, notes: [] })) });
const early = (p: any) => JSON.stringify(p.weeks.filter((w: any) => w.phase === 'base' || w.phase === 'development').map((w: any) => ({ ...w, notes: [] })));
const hasBlock = (p: any) => p.weeks.some((w: any) => w.days.some((d: any) => d.role === 'long' && d.workout.workKm.RP > 0));
const out: Record<string, string> = {};
const cls: Record<string, number> = {};
let earlyDiff = 0; const earlyIds: string[] = [];
const cmp = (id: string, input: unknown) => {
  const a: any = ga(input), b: any = gb(input);
  if (JSON.stringify(a.ok ? { ...a.plan, policyVersion: '' } : a) === JSON.stringify(b.ok ? { ...b.plan, policyVersion: '' } : b)) return;
  let c = 'x';
  if (!a.ok && !b.ok && JSON.stringify(a.reasons.map((r: any) => r.code)) === JSON.stringify(b.reasons.map((r: any) => r.code))) c = 'd';
  if (a.ok && b.ok) {
    if (early(a.plan) !== early(b.plan)) { earlyDiff++; if (earlyIds.length < 10) earlyIds.push(id); }
    c = noText(a.plan) === noText(b.plan) ? 'd' : early(a.plan) !== early(b.plan) ? 'x' : hasBlock(b.plan) ? 'b' : 's';
  }
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
console.error(JSON.stringify({ total: T.grid02Inputs().length + T.feelInputs().length + T.beginnerInputs().length + recent.length, cls, earlyDiff, earlyIds }));
console.log(JSON.stringify(out, null, 2));
