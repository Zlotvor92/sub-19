/* Iz web/ (u stablu polaznog koda): node <ovaj fajl> <koren repo-a> > changed11.json */
/* Na polaznom kodu (b9c4728): planovi mreža koje MAR-11 menja i razlog (T1 lagan > 0,8 × dugi u izgradnji;
   T2 dan MP tapera duži od dugog; C11 nedelja testa sa danom kvaliteta dužim od dugog). */
const root = process.argv[2]!;
const lib = await import(`${root}/docs/generators-v2/final-check/lib.ts`);
const d = lib.distOf('MAR');
const out: Record<string, string[]> = {};
for (const b of d.all()) {
  const r = d.generate(b.input) as any;
  if (!r.ok) { out[b.id] = ['REJ']; continue; }
  const why = new Set<string>();
  for (const w of r.plan.weeks) {
    const L = w.days.find((x: any) => x.role === 'long');
    if (!L) continue;
    if (['base', 'development', 'specific'].includes(w.phase) && !w.deload &&
        w.days.some((x: any) => x.role === 'easy' && Math.round(x.workout.km * 10) > Math.floor(0.8 * Math.round(L.workout.km * 10) + 1e-9)))
      why.add('T1');
    if (w.phase === 'taper' && w.days.some((x: any) => x.workout.dose?.zone === 'MP' && x.workout.sec > L.workout.sec)) why.add('T2');
    if (w.days.some((x: any) => x.role === 'test') && w.days.some((x: any) => (x.role === 'q2' || x.role === 'test') && x.workout.sec > L.workout.sec)) why.add('C11');
  }
  if (why.size) out[b.id] = [...why].sort();
}
console.log(JSON.stringify(out));
