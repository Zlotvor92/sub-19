/* Generator, sve mreže (R/F/B): planovi sa nedeljom planirano < cilj (T1 poslednje rešenje) ili ispod minimuma nedelje. */
const root = process.argv[2]!;
const lib = await import(`${root}/docs/generators-v2/final-check/lib.ts`);
const d = lib.distOf('MAR');
let n = 0, under = 0, belowMin = 0, rej = 0, noSharp = 0;
for (const b of d.all()) {
  const r = d.generate(b.input) as any; if (!r.ok) { rej++; continue; } n++;
  if (r.plan.weeks.some((w: any) => w.notes.some((x: string) => x.startsWith('Nedelja izgradnje: planirano je manje od cilja')))) under++;
  if (r.plan.warnings.some((v: any) => v.rule === 'WEEK_MIN_LIMITS' || v.rule === 'PLANNED_BELOW_TARGET')) belowMin++;
  if (!r.plan.weeks.at(-1).days.some((x: any) => x.role === 'sharpener')) noSharp++;
}
console.log(JSON.stringify({ plans: n, rej, underNote: under, belowMinOrUnderWarn: belowMin, raceWeekNoSharpener: noSharp }));
