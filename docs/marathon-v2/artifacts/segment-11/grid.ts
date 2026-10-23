/* Iz web/: node <ovaj fajl> <koren repo-a> <korak uzorka> */
/* Mreža MAR: odbijanja, greške validatora, T1 (lagan > 0,8 × dugi u izgradnji), T2 (dan MP tapera duži od dugog),
   planirano < cilj po pravilu (nedelje sa fitted 'down' / CAPACITY_LIMITED). Arg: koren repo-a, korak uzorka. */
const root = process.argv[2]!;
const k = Number(process.argv[3] ?? 1);
const lib = await import(`${root}/docs/generators-v2/final-check/lib.ts`);
const { validatePlan } = await import(`${root}/web/src/domain/generators/marathon/v2/validate.ts`);
const d = lib.distOf('MAR');
const all = d.all().filter((_: unknown, i: number) => i % k === 0);
let rej = 0, viol = 0, t1 = 0, t1w = 0, t2 = 0, t2w = 0, cap = 0, fitted = 0, plans = 0;
const rejCodes: Record<string, number> = {}, violCodes: Record<string, number> = {};
const ex: string[] = [];
for (const b of all) {
  const r = d.generate(b.input) as any;
  if (!r.ok) { rej++; for (const x of r.reasons) rejCodes[x.code] = (rejCodes[x.code] ?? 0) + 1; if (ex.length < 5) ex.push(b.id + ' ' + r.reasons.map((x: any) => (x.code ?? x.rule) + ':' + x.message).join('|')); continue; }
  plans++;
  const v = validatePlan(r.plan ?? r).filter((x: any) => x.severity === 'error');
  if (v.length) { viol++; for (const x of v) violCodes[x.code ?? x.rule] = (violCodes[x.code] ?? 0) + 1; if (ex.length < 10) ex.push(b.id + ' V ' + v.slice(0,2).map((x: any) => (x.code ?? x.rule) + ':' + x.message).join('|')); }
  const p = r.plan ?? r;
  let a = false, c = false;
  for (const w of p.weeks) {
    const L = w.days.find((x: any) => x.role === 'long');
    if (!L) continue;
    if (['base', 'development', 'specific'].includes(w.phase) && !w.deload) {
      if (w.days.some((x: any) => x.role === 'easy' && x.workout.km > 0.8 * L.workout.km + 1e-6)) { t1w++; a = true; }
    }
    if (w.phase === 'taper' && w.days.some((x: any) => ['q1', 'q2'].includes(x.role) && x.workout.sec > L.workout.sec)) { t2w++; c = true; }
    if (w.fitted === 'down') fitted++;
  }
  if (a) t1++; if (c) t2++;
  if ((p.warnings ?? []).some((x: any) => (x.code ?? x.rule) === 'CAPACITY_LIMITED')) cap++;
}
console.log(JSON.stringify({ n: all.length, plans, rej, rejCodes, viol, violCodes, t1, t1w, t2, t2w, cap, fittedWeeks: fitted, ex }, null, 1));
