/* T3: posle novog starta (pauza 35) — taper sa kvalitetom i trkačka sa oštrenjem; staro (argv[2]) prema novom. */
const OLD = `${process.argv[2]}/src/domain/generators/halfMarathon/v2`;
const NEW = '/home/user/sub-19/web/src/domain/generators/halfMarathon/v2';
const lib = await import('/home/user/sub-19/docs/generators-v2/final-check/lib.ts');
const ao = (await import(`${OLD}/adapt.ts`)).adaptHmV2;
const go = (await import(`${OLD}/generate.ts`)).generateHmV2;
const an = (await import(`${NEW}/adapt.ts`)).adaptHmV2;
const d = lib.distOf('HM');
const { bases } = lib.sampleBases(d, { R: 400, F: 200, B: 100 });
const st = { flows: 0, rejO: 0, rejN: 0, taperNoQO: 0, taperNoQN: 0, raceNoSharpO: 0, raceNoSharpN: 0, eligible: 0, ex: '' as string };
for (const b of bases) {
  const g = d.generate(b.input); if (!g.ok) continue;
  const p: any = g.plan;
  const g0: any = go(b.input); if (!g0.ok) continue;
  for (const w of p.weeks.slice(0, -3)) {
    const at = w.endDate;
    const f = d.facts(p, 'pause35', at);
    const ro: any = ao(g0.plan, d.facts(g0.plan, 'pause35', at), at), rn: any = an(p, f, at);
    st.flows++;
    if (!ro.ok) st.rejO++; if (!rn.ok) st.rejN++;
    if (!ro.ok || !rn.ok) continue;
    const info = (pl: any) => {
      const t = pl.weeks.find((x: any) => x.phase === 'taper'); const r = pl.weeks.find((x: any) => x.phase === 'race');
      const st0 = pl.adaptation.steps.find((s: any) => s.restart);
      const after = st0 ? pl.weeks.filter((x: any) => x.index >= st0.fromWeek && !x.deload && ['base','development','specific'].includes(x.phase) && x.days.some((y: any) => y.role === 'q1' || y.role === 'q2')).length : 0;
      return { restart: !!st0, after, tq: t.days.some((y: any) => y.workout.kind === 'quality'), rs: r.days.some((y: any) => y.role === 'sharpener'), pain: (r.limits?.pain ?? []).length > 0 };
    };
    const io = info(ro.plan), inn = info(rn.plan);
    if (!inn.restart || inn.after === 0) continue;
    st.eligible++;
    if (!io.tq) st.taperNoQO++; if (!inn.tq) st.taperNoQN++;
    if (!io.rs) st.raceNoSharpO++; if (!inn.rs && !inn.pain) st.raceNoSharpN++;
    if (!io.tq && inn.tq && !st.ex) st.ex = `${b.id} pause35 asOf ${at}`;
    if (!inn.tq) { const t = rn.plan.weeks.find((x: any) => x.phase === 'taper'); const k = t.notes[0].slice(0, 60); (st as any).why ??= {}; (st as any).why[k] = ((st as any).why[k] ?? 0) + 1;
      if (k.includes('plafon')) { (st as any).tg ??= {}; const kk = t.targetKm < 20 ? '<20' : '>=20'; (st as any).tg[kk] = ((st as any).tg[kk] ?? 0) + 1; if (kk === '>=20') (st as any).ex3 = `${b.id} ${at} ${t.targetKm}`; }
      if (k.includes('(adaptacija)') && !(st as any).ex2) (st as any).ex2 = `${b.id} ${at} limits=${JSON.stringify(t.limits)} st=${JSON.stringify(rn.plan.adaptation.steps.map((q: any) => [q.fromWeek, q.restart, q.quality ?? null]))} taper=${t.index} ` + rn.plan.weeks.map((x: any) => x.index + x.phase[0] + (x.days.some((y: any) => y.workout.kind === 'quality') ? 'Q' : '-')).join(' '); }
  }
}
console.log(JSON.stringify(st));
