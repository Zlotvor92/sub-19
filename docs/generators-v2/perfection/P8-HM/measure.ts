/* P8-HM — merenje po brojačima glavnog trenera (coach/ROUND-01.md § 7) na 12 profila P7, mreži P0 (192) i, uz `big`,
   mrežama 02/03/pouka 28 (27 930 ulaza). Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P8-HM/measure.ts <web koren> <oznaka> [big]
   Izlaz: P8-HM/out/<oznaka>-p7.json (po profilu), <oznaka>-p0.json (agregat), <oznaka>-big.json (agregat). */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [root, tag, big] = process.argv.slice(2);
const V2 = `${root}/src/domain/generators/halfMarathon/v2`;
const gen = (await import(`${V2}/generate.ts`)).generateHmV2 as (i: unknown) => any;
const T = await import(`${V2}/testInputs.ts`);
const dir = new URL('.', import.meta.url).pathname;
mkdirSync(`${dir}out`, { recursive: true });

type Seg = { kind: string; zone: string; km: number; sec: number };
type Day = { role: string; date: string; countsToWeek: boolean; workout: { kind: string; km: number; sec: number; segments: Seg[]; workKm: Record<string, number>; dose: { zone: string; doseM: number } | null } };
type Wk = { index: number; phase: string; deload: boolean; test?: boolean; targetKm: number; plannedKm: number; days: Day[]; notes: string[] };
const work = (d: Day, z?: string) => d.workout.segments.filter((s) => (s.kind === 'rep' || s.kind === 'continuous') && (!z || s.zone === z)).reduce((a, s) => a + s.sec, 0);
const r1 = (x: number) => Math.round(x * 10) / 10;
const BAD = /nije izvodljiv|odstupanje|pouka \d|\bH\d|\bHI\d|\(F\d\)|segment 0|cilj po pravilu|A\d\b/;

export function metricsOf(plan: any) {
  const W: Wk[] = plan.weeks;
  const build = W.filter((w) => ['base', 'development', 'specific'].includes(w.phase));
  const nd = build.filter((w) => !w.deload);
  const secOf = (w: Wk) => w.days.filter((d) => d.countsToWeek).reduce((a, d) => a + d.workout.sec, 0);
  const longOf = (w: Wk) => w.days.find((d) => d.role === 'long');
  const q = (w: Wk) => w.days.filter((d) => d.role === 'q1' || d.role === 'q2');
  const peakKm = Math.max(...nd.map((w) => w.targetKm));
  const peakWeek = nd.find((w) => w.targetKm === peakKm)!.index;
  const lastDev = [...W].reverse().find((w) => w.phase === 'development' && !w.deload)?.index ?? 0;
  let plateau = 0, run = 0, prev = -1;
  for (const w of nd) { const l = longOf(w)?.workout.km ?? 0; run = l === prev ? run + 1 : 1; prev = l; plateau = Math.max(plateau, run); }
  const maxZone = (z: string) => Math.max(0, ...build.flatMap((w) => q(w).map((d) => work(d, z)))) / 60;
  const rpWeek = (w: Wk) => w.days.reduce((a, d) => a + work(d, 'RP'), 0);
  const fastKm = (w: Wk) => w.days.filter((d) => d.countsToWeek).reduce((a, d) => a + d.workout.segments.filter((s) => !['E', 'jog', 'walk'].includes(s.zone) && s.kind !== 'stride').reduce((b, s) => b + s.km, 0), 0);
  const taper = W.find((w) => w.phase === 'taper');
  const race = W.find((w) => w.phase === 'race');
  const sharp = race?.days.find((d) => d.role === 'sharpener');
  const testW = W.find((w) => w.days.some((d) => d.role === 'test'));
  const deloadOver: number[] = [];
  { const last: Record<string, number> = {}; for (const w of build) { for (const d of q(w)) { const z = d.workout.dose?.zone; if (!z) continue; const s = work(d); if (w.deload) { if (last[z]) deloadOver.push(s / last[z]!); } else last[z] = s; } } }
  const easyLong = Math.max(0, ...nd.map((w) => { const l = longOf(w)?.workout.km ?? 0; return l ? Math.max(0, ...w.days.filter((d) => d.role === 'easy').map((d) => d.workout.km)) / l : 0; }));
  const maxRpBuild = maxZone('RP');
  const maxQ = (z: string) => Math.max(0, ...build.flatMap((w) => q(w).filter((d) => d.workout.dose?.zone === z).map((d) => work(d)))) / 60;
  const tq = taper ? q(taper) : [];
  return {
    startKm: plan.startKm, peakKm, peakRatio: r1((peakKm / plan.startKm) * 100) / 100, peakWeek, lastDev,
    peakHours: r1(Math.max(...W.filter((w) => w.phase !== 'race').map(secOf)) / 3600),
    peakWeeksAtTop: nd.filter((w) => w.targetKm === peakKm).length,
    smallSteps: nd.filter((w, i) => i > 0 && w.targetKm > nd[i - 1]!.targetKm && w.targetKm - nd[i - 1]!.targetKm < 0.03 * nd[i - 1]!.targetKm - 1e-9).length,
    longMax: Math.max(...nd.map((w) => longOf(w)?.workout.km ?? 0)), longPlateau: plateau,
    maxRP: r1(maxRpBuild), maxT: r1(maxZone('T')), maxI: r1(maxZone('I')),
    rpTimeShareMax: Math.round(Math.max(0, ...build.map((w) => rpWeek(w) / secOf(w))) * 100),
    weeksRp22: build.filter((w) => rpWeek(w) / secOf(w) > 0.22 + 1e-9).length,
    weeksFast25: build.filter((w) => fastKm(w) / w.plannedKm > 0.25 + 1e-9).length,
    qOverLong: build.filter((w) => { const l = longOf(w); return !!l && w.days.some((d) => (d.role === 'q1' || d.role === 'q2') && d.workout.sec > l.workout.sec); }).length,
    easyLong: Math.round(easyLong * 100),
    taperRP: r1((taper ? taper.days.reduce((a, d) => a + work(d, 'RP'), 0) : 0) / 60), taperWork: r1(tq.reduce((a, d) => a + work(d), 0) / 60),
    taperOver60: tq.filter((d) => { const z = d.workout.dose?.zone; return !!z && work(d) / 60 > 0.6 * maxQ(z) + 0.05; }).length,
    sharpMin: r1(sharp ? work(sharp) / 60 : 0), raceRP: !!sharp,
    deloadOver60: deloadOver.filter((x) => x > 0.6 + 1e-9).length, deloadN: deloadOver.length,
    test: testW ? { week: testW.index, otherQ: q(testW).length, atPeak: testW.targetKm === peakKm, phase: testW.phase + (testW.deload ? '*' : '') } : null,
    blocks: build.filter((w) => (longOf(w)?.workout.workKm['RP'] ?? 0) > 0).length,
    totalRPkm: r1(W.reduce((a, w) => a + w.days.reduce((b, d) => b + (d.role === 'race' ? 0 : d.workout.workKm['RP'] ?? 0), 0), 0)),
    fitted: W.filter((w: any) => w.fitted).length, warnings: plan.warnings.length,
    badText: [...plan.warnings.map((x: any) => x.message), ...plan.notes].filter((s: string) => BAD.test(s)).length
  };
}

/* 12 profila P7 (isti ulazi kao P7/make-inputs.ts, distanca HM). */
const p7 = JSON.parse(readFileSync(`${dir}inputs.json`, 'utf8'))['HM'] as { title: string; input: unknown }[];
const rows = p7.map((p, i) => { const r = gen(p.input); return { n: i + 1, title: p.title, ...(r.ok ? metricsOf(r.plan) : { rejected: r.reasons.map((x: any) => x.code) }) }; });
writeFileSync(`${dir}out/${tag}-p7.json`, JSON.stringify(rows, null, 1));
const cols = ['peakKm', 'peakRatio', 'peakHours', 'peakWeek', 'longMax', 'longPlateau', 'maxRP', 'maxT', 'maxI', 'rpTimeShareMax', 'weeksFast25', 'qOverLong', 'easyLong', 'taperRP', 'taperOver60', 'sharpMin', 'deloadOver60', 'blocks', 'badText'];
console.log(['n', ...cols].join('\t'));
for (const r of rows as any[]) console.log([r.n, ...cols.map((c) => (r.rejected ? 'ODB' : r[c]))].join('\t'));
console.log('test:', (rows as any[]).map((r) => (r.test ? `${r.n}:w${r.test.week}/${r.test.otherQ}q${r.test.atPeak ? '/vrh' : ''}` : `${r.n}:-`)).join(' '));

const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)]! : NaN; };
function aggregate(inputs: { id: string; input: unknown }[]) {
  const ms: any[] = []; const rej: string[] = [];
  for (const g of inputs) { const r = gen(g.input); if (r.ok) ms.push({ id: g.id, ...metricsOf(r.plan) }); else rej.push(`${g.id}:${r.reasons.map((x: any) => x.code).join(',')}`); }
  const num = (k: string) => ms.map((m) => m[k] as number);
  const st = (k: string) => `${med(num(k))} [${Math.min(...num(k))}–${Math.max(...num(k))}]`;
  const cnt = (f: (m: any) => boolean) => ms.filter(f).length;
  return {
    n: inputs.length, rejected: rej.length, rejIds: rej,
    peakRatio: st('peakRatio'), peakHours: st('peakHours'), peakWeek: st('peakWeek'), longPlateau: st('longPlateau'), maxRP: st('maxRP'), maxT: st('maxT'), maxI: st('maxI'),
    rpTimeShareMax: st('rpTimeShareMax'), easyLong: st('easyLong'), taperRP: st('taperRP'), sharpMin: st('sharpMin'), totalRPkm: st('totalRPkm'),
    plansRP45: cnt((m) => m.maxRP > 45.05), plansT30: cnt((m) => m.maxT > 30.05), plansI24: cnt((m) => m.maxI > 24.05),
    plansRp22: cnt((m) => m.weeksRp22 > 0), weeksFast25: num('weeksFast25').reduce((a, b) => a + b, 0), plansQOverLong: cnt((m) => m.qOverLong > 0),
    plansTaperNoRP: cnt((m) => m.taperRP === 0), plansRaceNoRP: cnt((m) => !m.raceRP), plansSharp12: cnt((m) => m.sharpMin > 12.05), plansTaperOver60: cnt((m) => m.taperOver60 > 0),
    plansDeloadOver60: cnt((m) => m.deloadOver60 > 0), plansPeakBeforeDevEnd: cnt((m) => m.lastDev > 0 && m.peakWeek < m.lastDev && m.peakKm > m.startKm), plansSmallSteps: cnt((m) => m.smallSteps > 0),
    plansTestAtPeak: cnt((m) => m.test?.atPeak), plansTestOtherQ: cnt((m) => m.test && m.test.otherQ > 0), plansTest: cnt((m) => m.test), plansEasy70: cnt((m) => m.easyLong > 70),
    plansFitted: cnt((m) => m.fitted > 0), ids: Object.fromEntries(ms.map((m) => [m.id, [m.peakKm, m.maxRP, m.taperRP, m.sharpMin, m.longMax]]))
  };
}
const { grid } = await import(`${root}/../docs/generators-v2/perfection/P0/common.ts`);
const p0 = aggregate([...grid('HM')].map((c: any) => ({ id: c.id, input: c.input })));
writeFileSync(`${dir}out/${tag}-p0.json`, JSON.stringify(p0, null, 1));
const { ids: _i, rejIds, ...show } = p0; console.log('P0', JSON.stringify(show), rejIds.slice(0, 5));
if (big) {
  const inputs: { id: string; input: unknown }[] = [...T.grid02Inputs(), ...T.feelInputs(), ...T.beginnerInputs()];
  for (const days of T.DAY_COUNTS) for (let r = 5; r <= 42; r += 3) for (let km = T.KM_BY_DAYS[days].min; km <= T.KM_BY_DAYS[days].max; km += 10)
    for (const vdot of [30, 45, 70]) for (const weeks of [10, 12, 14, 20])
      inputs.push({ id: `r-d${days}-${weeks}w-${km}km-v${vdot}-r${r}`, input: T.inputOf({ weeks, km, vdot, days: T.SCHEDULES_BY_DAYS[days].A.days, recentLongRunKm: r }) });
  const b = aggregate(inputs);
  writeFileSync(`${dir}out/${tag}-big.json`, JSON.stringify(b));
  const { ids: _j, rejIds: rj, ...sb } = b; console.log('BIG', JSON.stringify(sb), rj.length);
}
