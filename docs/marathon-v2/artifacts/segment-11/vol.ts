/* Obim: planovi sa CAPACITY_LIMITED, sa nedeljom fitted 'down', zbir vrha i planiranog (uzorak svaki k-ti). */
const root = process.argv[2]!; const k = Number(process.argv[3] ?? 5);
const lib = await import(`${root}/docs/generators-v2/final-check/lib.ts`);
const d = lib.distOf('MAR');
let n = 0, cap = 0, down = 0, peak = 0, planned = 0, rej = 0, t1 = 0, t2 = 0, t2min = 0;
for (const b of d.all().filter((_: unknown, i: number) => i % k === 0)) {
  const r = d.generate(b.input) as any; if (!r.ok) { rej++; continue; } n++;
  const p = r.plan;
  if (p.warnings.some((w: any) => w.rule === 'CAPACITY_LIMITED')) cap++;
  if (p.weeks.some((w: any) => w.fitted === 'down')) down++;
  peak += p.peakKm; planned += p.weeks.reduce((a: number, w: any) => a + w.plannedKm, 0);
  let a = false, c = false, m = false;
  for (const w of p.weeks) { const L = w.days.find((x: any) => x.role === 'long'); if (!L) continue;
    if (['base','development','specific'].includes(w.phase) && !w.deload && w.days.some((x: any) => x.role === 'easy' && x.workout.km >= 0.9 * L.workout.km)) a = true;
    const q = w.days.filter((x: any) => ['q1','q2'].includes(x.role) && x.workout.sec > L.workout.sec);
    if (w.phase === 'taper' && q.length) { c = true; if (q.every((x: any) => x.workout.dose?.doseM === 1000)) m = true; } }
  if (a) t1++; if (c) t2++; if (m) t2min++;
}
console.log(JSON.stringify({ k, plans: n, rej, capLimited: cap, fittedDown: down, avgPeak: +(peak / n).toFixed(2), avgPlannedTotal: +(planned / n).toFixed(1), easyGe09Long: t1, taperQualityOverLong: t2, taperMpAt1kmOverLong: t2min }));
