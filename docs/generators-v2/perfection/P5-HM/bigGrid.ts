/* P5-HM — mreže 02, 03 (po osećaju, početnik) i pouke 28 (`r-`): odbijanja, WEEK_FITTED, nedelja 1 < trenutni obim,
   testovi, ubrzanja; poređenje sa web/ na polaznom SHA. Iz web/: node ../docs/generators-v2/perfection/P5-HM/bigGrid.ts <web/ na 8e87fd4> */
const A = `${process.argv[2]}/src/domain/generators/halfMarathon/v2`;
const B = '../../../../web/src/domain/generators/halfMarathon/v2';
const ga = (await import(`${A}/generate.ts`)).generateHmV2;
const gb = (await import(`${B}/generate.ts`)).generateHmV2;
const T = await import(`${B}/testInputs.ts`);
const inputs: { id: string; input: unknown }[] = [...T.grid02Inputs(), ...T.feelInputs(), ...T.beginnerInputs()];
for (const days of T.DAY_COUNTS) for (let r = 5; r <= 42; r += 3) for (let km = T.KM_BY_DAYS[days].min; km <= T.KM_BY_DAYS[days].max; km += 10)
  for (const vdot of [30, 45, 70]) for (const weeks of [10, 12, 14, 20])
    inputs.push({ id: `r-d${days}-${weeks}w-${km}km-v${vdot}-r${r}`, input: T.inputOf({ weeks, km, vdot, days: T.SCHEDULES_BY_DAYS[days].A.days, recentLongRunKm: r }) });
const st = { n: 0, rejA: 0, rejB: 0, newRej: [] as string[], lostRej: 0, fitA: 0, fitB: 0, w1A: 0, w1B: 0, testB: 0, testBadB: 0, strideWeeks: 0, buildTaperWeeks: 0, noStrideWithEasy: 0 };
const codes: Record<string, number> = {};
for (const g of inputs) {
  st.n++;
  const a: any = ga(g.input), b: any = gb(g.input);
  if (!a.ok) st.rejA++;
  if (!b.ok) { st.rejB++; if (a.ok) { st.newRej.push(`${g.id}: ${b.reasons.map((x: any) => x.code).join(',')}`); for (const x of b.reasons) codes[x.code] = (codes[x.code] ?? 0) + 1; } }
  if (!a.ok && b.ok) st.lostRej++;
  if (a.ok) { if (a.plan.warnings.some((w: any) => w.rule === 'WEEK_FITTED')) st.fitA++; if (a.plan.weeks[0].plannedKm < a.plan.startKm - 0.05) st.w1A++; }
  if (b.ok) {
    if (b.plan.warnings.some((w: any) => w.rule === 'WEEK_FITTED')) st.fitB++;
    if (b.plan.weeks[0].plannedKm < b.plan.startKm - 0.05) st.w1B++;
    const tests = b.plan.weeks.filter((w: any) => w.days.some((d: any) => d.role === 'test'));
    if (tests.length) st.testB++;
    for (const w of b.plan.weeks) {
      if (w.phase === 'race') continue;
      st.buildTaperWeeks++;
      const s = w.days.some((d: any) => d.workout.segments.some((x: any) => x.kind === 'stride'));
      if (s) st.strideWeeks++;
      else if (w.days.some((d: any) => d.role === 'easy') && !(b.plan.input.experience === 'beginner' && w.index <= 2)) st.noStrideWithEasy++;
    }
  }
}
console.log(JSON.stringify({ ...st, newRej: st.newRej.slice(0, 20), newRejN: st.newRej.length, codes }, null, 1));
