const lib = await import(`/home/user/sub-19/docs/generators-v2/final-check/lib.ts`);
const d = lib.distOf("HM"); const { bases } = lib.sampleBases(d, { R: 193, F: 97, B: 29 });
const b = [...bases, ...d.all()].find((x: any) => x.id === 'd6-10w-40km-v35-B-sun'); const p = d.generate(b.input).plan;
const at = '2027-01-05'; const f = d.facts(p, 'pain8', at); const r = d.adapt(p, f, at);
console.log(r.ok, d.inv(p, r.plan, at, f));
for (const w of r.plan.weeks.slice(-2)) { console.log(w.index, w.phase, 't', w.targetKm, 'p', w.plannedKm, JSON.stringify(w.limits ?? {}), w.days.map((x: any) => x.date.slice(5) + x.role + x.workout.km).join(' ')); console.log('   ', w.notes.join(' | ')); }
console.log(r.plan.warnings.filter((v: any) => v.week >= 9).map((v: any) => v.rule + ' ' + v.message));
