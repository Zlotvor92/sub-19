const V = process.argv[2] + '/src/domain/generators/halfMarathon/v2';
const { adaptHmV2 } = await import(`${V}/adapt.ts`);
const { generateHmV2 } = await import(`${V}/generate.ts`);
const { addDays } = await import(`${V}/dates.ts`);
const { beginnerInputs } = await import(`${V}/testInputs.ts`);
const b = beginnerInputs().find((g: any) => g.id === 'b-d5-12w-25km-e390-A')!;
const fat = (d1: string, d2: string) => ({ workouts: [
  { date: d1, km: 6, durationSec: 2400, completed: true, rpe: 8 },
  { date: d2, km: 6, durationSec: 2400, completed: true, rpe: 7 }] });
const g: any = generateHmV2(b.input);
const long1 = g.plan.weeks[0].days.find((d: any) => d.role === 'long');
const a1 = addDays(long1.date, -3);
const s1: any = adaptHmV2(g.plan, { workouts: [{ date: a1, km: 0, durationSec: 0, completed: false, pain: 8 }] }, a1);
const a2 = g.plan.weeks[0].endDate;
const s2: any = adaptHmV2(s1.plan, fat(addDays(a1, -1), addDays(a1, -2)), a2);
const show = (p: any) => p.weeks.map((w: any) => `${w.index}${w.deload ? 'D' : ''}${w.phase[0]} t${w.targetKm} L${w.days.find((d: any) => d.role === 'long')?.workout.km ?? '-'} e[${w.days.filter((d: any) => d.role === 'easy').map((d: any) => d.workout.km).join(',')}]`).join('\n');
console.log('s2', s2.ok, '\n' + show(s2.plan));
const a3 = s2.plan.weeks[1].endDate;
const s3: any = adaptHmV2(s2.plan, fat(addDays(a3, -1), addDays(a3, -3)), a3);
console.log('s3', s3.ok, s3.ok ? '\n' + show(s3.plan) : JSON.stringify(s3.reasons));
