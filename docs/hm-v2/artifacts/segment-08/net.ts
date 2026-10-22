/* HM-08: trajna mreža segment08 (pun, svaki 4. plan) kao skripta — pre/posle. node net.ts <koren> <i> <n> */
const [root, si, sn] = process.argv.slice(2);
const AI = await import(`${root}/web/src/domain/generators/halfMarathon/v2/adaptInputs.ts`);
const A = await import(`${root}/web/src/domain/generators/halfMarathon/v2/adapt.ts`);
const G = await import(`${root}/web/src/domain/generators/halfMarathon/v2/generate.ts`);
const D = await import(`${root}/web/src/domain/generators/halfMarathon/v2/dates.ts`);
const I = await import(`${root}/web/src/domain/generators/halfMarathon/v2/adaptInvariants.ts`);
const bases = AI.earlyBases({ r: 400, f: 80, b: 40 }).filter((_: any, i: number) => i % 4 === 0).filter((_: any, i: number) => i % Number(sn) === Number(si));
const t: Record<string, number> = { flows: 0, over: 0, overWarn: 0 }; const ex: Record<string, string[]> = {};
const add = (k: string, e: string) => { t[k] = (t[k] ?? 0) + 1; ((ex[k] ??= []).length < 3) && ex[k].push(e); };
for (const b of bases) {
  const p = G.generateHmV2(b.input).plan; const N = p.weeks.length;
  for (let k = 2; k <= N - 3; k++) {
    const wk = p.weeks[k - 1], prev = p.weeks[k - 2], next = p.weeks[k];
    const f0 = { workouts: [D.addDays(prev.endDate, -1), prev.endDate].map((date: string) => ({ date, km: 6, durationSec: 2400, completed: true, rpe: 8 })) };
    const q = next.days.find((d: any) => d.role === 'q1' || d.role === 'q2'); const first = next.days.find((d: any) => d.role !== 'race');
    for (let x = 0; x < 7; x++) {
      const asOf = D.addDays(wk.startDate, x);
      const vs: [string, any][] = [['umor', f0]];
      if (x === 0 || x === 3) { if (q) vs.push(['zaključan', { ...f0, lockedDayIds: [q.date] }]); if (first) vs.push(['urađen', { workouts: [...f0.workouts, { date: asOf, dayId: first.date, km: first.workout.km, durationSec: first.workout.sec, completed: true }] }]); }
      for (const [tag, facts] of vs) {
        t.flows++; const key = `${b.id}/k${k}/+${x}/${tag}`;
        const r = A.adaptHmV2(p, facts, asOf);
        if (!r.ok) { add('rej:' + r.reasons.map((z: any) => z.message.slice(0, 50)).join('|'), key); continue; }
        for (const v of I.adaptInvariants(p, r.plan, asOf, facts)) add('inv:' + v.replace(/[0-9-]+/g, '#'), key);
        const ad = r.plan.adaptation; const prot = new Set([...ad.lockedDayIds, ...(ad.doneDayIds ?? [])]);
        for (const w of r.plan.weeks) if (ad.mixedWeeks.includes(w.index) && w.phase !== 'race' && w.days.some((d: any) => D.mustDay(d.date) > D.mustDay(asOf) && !prot.has(d.date)) && w.days.reduce((x: number, d: any) => x + (!d.countsToWeek ? 0 : d.date in (ad.factKm ?? {}) ? ad.factKm[d.date] : d.workout.km), 0) > w.targetKm + 0.1 + 1e-9) { t.over++; if (r.plan.warnings.some((v: any) => v.rule === 'MIXED_WEEK_OVER' && v.week === w.index)) t.overWarn++; else add('overNoWarn', key); }
      }
    }
  }
}
console.log(JSON.stringify({ t, ex }));
