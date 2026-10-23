const root = process.argv[2]!; const k = Number(process.argv[3] ?? 5);
const lib = await import(`${root}/docs/generators-v2/final-check/lib.ts`);
const d = lib.distOf('MAR');
let n = 0, no = 0;
for (const b of d.all().filter((_: unknown, i: number) => i % k === 0)) {
  const r = d.generate(b.input) as any; if (!r.ok) continue; n++;
  if (!r.plan.weeks.at(-1).days.some((x: any) => x.role === 'sharpener')) no++;
}
console.log(JSON.stringify({ plans: n, raceWeekNoSharpener: no }));
