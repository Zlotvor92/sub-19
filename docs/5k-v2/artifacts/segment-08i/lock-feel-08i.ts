const root = process.argv[2]!;
const { generateFiveKV2 } = await import(root + '/web/src/domain/generators/fiveK/v2/generate.ts');
const { adaptFiveKV2 } = await import(root + '/web/src/domain/generators/fiveK/v2/adapt.ts');
const { addDays } = await import(root + '/web/src/domain/generators/fiveK/v2/dates.ts');
const { earlyGridBases } = await import('/home/user/sub-19/web/src/domain/generators/fiveK/v2/testInputs.ts');
let n = 0, rej = 0, rejFeel = 0, rejNoLock = 0; const codes: Record<string, number> = {}; const ex: string[] = [];
const rec = (date: string) => ({ date, km: 6, durationSec: 2400, completed: true, rpe: 8 });
for (const b of earlyGridBases()) {
  const p: any = generateFiveKV2(b.input).plan;
  for (let k = 2; k <= p.weeks.length - 3; k++) {
    const sun = p.weeks[k - 2].endDate; const q = p.weeks[k].days.find((d: any) => d.workout.kind === 'quality');
    for (let dd = 0; dd <= 6; dd++) {
      const at = addDays(p.weeks[k - 1].startDate, dd);
      const r: any = adaptFiveKV2(p, { workouts: [rec(addDays(sun, -2)), rec(sun)], lockedDayIds: q ? [q.date] : [] }, at); n++;
      if (!r.ok) { rej++; if (p.vdot === null) rejFeel++; for (const v of r.violations.filter((v: any) => v.severity === 'error')) codes[v.rule] = (codes[v.rule] ?? 0) + 1; if (ex.length < 3) ex.push(`${b.id} k${k} +${dd}`);
        const r2: any = adaptFiveKV2(p, { workouts: [rec(addDays(sun, -2)), rec(sun)] }, at); if (!r2.ok) rejNoLock++; }
    }
  }
}
console.log({ n, rej, rejFeel, rejNoLock, codes, ex });
