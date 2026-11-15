/* P8-HM završetak — merenje odluka po STOP-u (S2 G8-O2, G6 početnik, S4, S5) prema stanju pre odluka.
   Iz web/: node ../docs/generators-v2/perfection/P8-HM/measureStop.ts <web koren PRE> <web koren POSLE> */
const [A, B] = process.argv.slice(2);
const v2 = (r: string) => `${r}/src/domain/generators/halfMarathon/v2`;
const ga = (await import(`${v2(A!)}/generate.ts`)).generateHmV2 as (i: unknown) => any;
const gb = (await import(`${v2(B!)}/generate.ts`)).generateHmV2 as (i: unknown) => any;
const T = await import(`${v2(B!)}/testInputs.ts`);
const { grid } = await import(`${B}/../docs/generators-v2/perfection/P0/common.ts`);
const build = (w: any) => ['base', 'development', 'specific'].includes(w.phase);
const longest = (p: any) => Math.max(...p.weeks.flatMap((w: any) => w.days.filter((d: any) => d.role === 'long').map((d: any) => d.workout.km)));
const easyKm = (p: any) => p.weeks.filter(build).reduce((a: number, w: any) => a + w.days.filter((d: any) => d.role === 'easy').reduce((b: number, d: any) => b + d.workout.km, 0), 0);
const peakPlanned = (p: any) => Math.max(...p.weeks.filter((w: any) => build(w) && !w.deload).map((w: any) => w.plannedKm));
const testWeek = (p: any) => p.weeks.find((w: any) => w.days.some((d: any) => d.role === 'test'));
const peakT = (p: any) => Math.max(...p.weeks.filter((w: any) => build(w) && !w.deload).map((w: any) => w.targetKm));

// Početnik (1890): dugi, odbijanja, lagani dani, vrh planiranog prema granici vrha.
const beg = { n: 0, rejPre: 0, rejPosle: 0, novih: 0, l16: [0, 0], l14: [0, 0], easyLoss10: 0, easyLossMax: 0, peakUnder90: [0, 0] };
for (const x of T.beginnerInputs()) {
  const a = ga(x.input), b = gb(x.input);
  beg.n++;
  if (!a.ok) beg.rejPre++;
  if (!b.ok) { beg.rejPosle++; if (a.ok) beg.novih++; }
  if (!a.ok || !b.ok) continue;
  [a, b].forEach((r, i) => {
    if (longest(r.plan) >= 16) beg.l16[i]++;
    if (longest(r.plan) >= 14) beg.l14[i]++;
    if (peakPlanned(r.plan) < 0.9 * r.plan.peakCapKm) beg.peakUnder90[i]++;
  });
  const loss = (easyKm(a.plan) - easyKm(b.plan)) / easyKm(a.plan);
  if (loss > 0.1) beg.easyLoss10++;
  beg.easyLossMax = Math.max(beg.easyLossMax, Math.round(loss * 1000) / 10);
}
// Po osećaju (6336): planova bez testa.
const feel = { n: 0, noTest: [0, 0], rejPosle: 0 };
for (const x of T.feelInputs()) {
  const a = ga(x.input), b = gb(x.input);
  feel.n++;
  if (!b.ok) feel.rejPosle++;
  if (a.ok && !testWeek(a.plan)) feel.noTest[0]++;
  if (b.ok && !testWeek(b.plan)) feel.noTest[1]++;
}
// Mreža P0 (192): test u nedelji najvećeg cilja; odbijanja.
const p0 = { n: 0, rej: [0, 0], tests: [0, 0], atPeak: [0, 0], weeksToRace: [[] as number[], [] as number[]] };
for (const c of grid('HM')) {
  p0.n++;
  [ga(c.input), gb(c.input)].forEach((r, i) => {
    if (!r.ok) { p0.rej[i]++; return; }
    const t = testWeek(r.plan);
    if (!t) return;
    p0.tests[i]++;
    if (t.targetKm === peakT(r.plan)) p0.atPeak[i]++;
    p0.weeksToRace[i].push(r.plan.weeks.length - t.index);
  });
}
const med = (x: number[]) => [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)];
console.log(JSON.stringify({ beg, feel, p0: { ...p0, weeksToRace: p0.weeksToRace.map((x) => `${med(x)} [${Math.min(...x)}–${Math.max(...x)}]`) } }, null, 1));
// Velika mreža 02 (16 896): odbijanja pre/posle.
let r0 = 0, r1 = 0, nw = 0, n = 0;
for (const x of T.grid02Inputs()) { const a = ga(x.input), b = gb(x.input); n++; if (!a.ok) r0++; if (!b.ok) { r1++; if (a.ok) nw++; } }
console.log(JSON.stringify({ grid02: n, rejPre: r0, rejPosle: r1, novih: nw }));
