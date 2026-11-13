/* Parovi personalizacije P1–P3 (coach/SCENARIOS-V4.md § 3–4): isti ulazi, različita istorija trčanja. Procena forme
   iz `fitness/` ide u `buildState`. Pokretanje iz korena:  node docs/generators-v4/plans/pairs.ts [--dist tenk]
   Piše docs/generators-v4/plans/HM/pairs/p1a.txt … p3b.txt i pregled.txt (10 km: plans/10K/pairs/).
   Istorija para je zadata za polumaratonske profile (p01 40 km, p11 20 km, p04 55 km); za drugu distancu se obim
   trčanja istorije srazmerno skalira na sadašnji obim profila te distance (`scale`), trke i testovi ostaju iste
   dužine. Za polumaraton je `scale` = 1 (ispis isti kao pre). */
import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.')) return next(`${specifier}.ts`, context);
      throw error;
    }
  }
});

const here = dirname(fileURLToPath(import.meta.url));
const v4 = join(here, '../../../web/src/domain/v4');
const E = await import(join(v4, 'engine/index.ts'));
const { estimateForm } = await import(join(v4, 'fitness/index.ts'));
const { loadDist } = await import(join(here, 'dist.ts'));
const D = await loadDist(v4, process.argv);
const hm = D.data;
const { PROFILES, gateStats } = D;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const out = join(here, D.outDir, 'pairs');
mkdirSync(out, { recursive: true });

const TODAY = '2026-11-01';
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}
/** Ponedeljak k-te nedelje od 12 (0 = najstarija; 11 = nedelja 26. 10. – 1. 11.). */
const monday = (k: number, of = 12): string => addDays('2026-10-26', -7 * (of - 1 - k));
const profile = (id: string): Any => PROFILES.find((p: Any) => p.id === id);
/** Obim istorije para za distancu: sadašnji obim profila / obim polumaratonskog profila za koji je istorija pisana. */
const HM_KM: Record<string, number> = { p01: 40, p11: 20, p04: 55 };
const scale = (id: string): number => (profile(id).profile.weeklyKm as number) / (HM_KM[id] ?? 1);
const k1 = scale('p01');
const k2 = scale('p11');
const k3 = scale('p04');
let seq = 0;
function run(date: string, km: number, pace: number, extra: Any = {}): Any {
  seq += 1;
  return {
    id: `r${String(seq)}-${date}`,
    date,
    distanceM: Math.round(km * 1000),
    durationSec: Math.round(km * pace),
    ...extra
  };
}
/** Krugovi: zagrevanje, n × deonica (sa oporavkom), hlađenje. */
function laps(wuKm: number, n: number, repM: number, repPace: number, recSec: number, cdKm: number, easy: number): Any[] {
  const out: Any[] = [{ role: 'other', distanceM: wuKm * 1000, durationSec: Math.round(wuKm * easy) }];
  for (let i = 0; i < n; i += 1) {
    out.push({ role: 'work', distanceM: repM, durationSec: Math.round((repM / 1000) * repPace) });
    if (i < n - 1 && recSec > 0) out.push({ role: 'recovery', distanceM: Math.round((recSec / easy) * 1000), durationSec: recSec });
  }
  out.push({ role: 'other', distanceM: cdKm * 1000, durationSec: Math.round(cdKm * easy) });
  return out;
}
const sumLaps = (l: Any[]): { distanceM: number; durationSec: number } => ({
  distanceM: l.reduce((a, x) => a + x.distanceM, 0),
  durationSec: l.reduce((a, x) => a + x.durationSec, 0)
});

/* ------------------------------------------------------------------ P1 — p01 */
function p1a(): Any[] {
  const runs: Any[] = [];
  for (let k = 0; k < 12; k += 1) {
    const m = monday(k);
    runs.push(run(addDays(m, 1), 8 * k1, 355));
    if (k % 2 === 1) {
      const l = laps(2.5, 3, 1600, 282, 60, 1.5, 355);
      runs.push({ id: `p1a-q${String(k)}`, date: addDays(m, 3), ...sumLaps(l), laps: l });
    } else runs.push(run(addDays(m, 3), 9 * k1, 352));
    runs.push(run(addDays(m, 5), 7.5 * k1, 358));
    if (k === 8) runs.push(run(addDays(m, 6), 10, 276, { effort: 'race' }));
    else runs.push(run(addDays(m, 6), (k === 3 || k === 7 || k === 11 ? 18 : 15.5) * k1, 360));
  }
  return runs;
}
function p1b(): Any[] {
  const plan = [
    { n: 3, total: 12, long: 6 },
    { n: 3, total: 22, long: 8 },
    { n: 4, total: 30, long: 10 },
    { n: 4, total: 36, long: 11 },
    { n: 4, total: 40, long: 12 }
  ];
  const runs: Any[] = [];
  plan.forEach((w, i) => {
    const m = monday(7 + i);
    const days = w.n === 3 ? [1, 3, 6] : [1, 3, 5, 6];
    const rest = ((w.total - w.long) / (w.n - 1)) * k1;
    days.forEach((d, j) => runs.push(run(addDays(m, d), j === days.length - 1 ? w.long * k1 : rest, 365 + 5 * (j % 3))));
  });
  return runs;
}

/* ------------------------------------------------------------------ P2 — p11 */
function p2a(): Any[] {
  const runs: Any[] = [];
  for (let k = 0; k < 12; k += 1) {
    const m = monday(k);
    const four = k % 3 !== 0;
    const longKm = (8 + (k % 3)) * k2;
    if (k === 9) {
      runs.push(run(addDays(m, 1), 4 * k2, 425), run(addDays(m, 3), 4.5 * k2, 430), run(addDays(m, 6), 10, 336.2, { effort: 'race' }));
      continue;
    }
    const easy = four ? [4, 4.5, 3.5] : [4.5, 5];
    const days = four ? [1, 3, 5] : [1, 3];
    days.forEach((d, j) => runs.push(run(addDays(m, d), (easy[j] ?? 4) * k2, 425 + 5 * j)));
    runs.push(run(addDays(m, 6), longKm, 432));
  }
  return runs;
}
function p2b(): Any[] {
  const weeks = [
    { n: 3, total: 8, long: 4 },
    { n: 3, total: 11, long: 5 },
    { n: 3, total: 14, long: 6 },
    { n: 4, total: 17, long: 7 },
    { n: 4, total: 19, long: 8 },
    { n: 4, total: 20, long: 10 }
  ];
  const runs: Any[] = [];
  weeks.forEach((w, i) => {
    const m = monday(6 + i);
    const days = w.n === 3 ? [1, 3, 6] : [1, 3, 5, 6];
    const rest = ((w.total - w.long) / (w.n - 1)) * k2;
    days.forEach((d, j) => {
      const last = j === days.length - 1;
      if (last && i === 5) runs.push(run(addDays(m, d), 10, 336.2, { effort: 'test' }));
      else runs.push(run(addDays(m, d), last ? w.long * k2 : rest, 440 + 8 * j));
    });
  });
  return runs;
}

/* ------------------------------------------------------------------ P3 — p04 */
function p3a(): Any[] {
  const runs: Any[] = [];
  for (let k = 0; k < 12; k += 1) {
    const m = monday(k);
    [0, 1, 3, 5].forEach((d, j) => runs.push(run(addDays(m, d), ([10, 11, 10, 10][j] ?? 10) * k3, 375 + 5 * (j % 2), { avgHr: 158 + j })));
    runs.push(run(addDays(m, 6), (k % 2 === 0 ? 14 : 15) * k3, 382, { avgHr: 162 }));
  }
  return runs;
}
function p3b(): Any[] {
  const runs: Any[] = [];
  for (let k = 0; k < 12; k += 1) {
    const m = monday(k);
    [0, 1, 5].forEach((d, j) => runs.push(run(addDays(m, d), ([9.5, 10.5, 10][j] ?? 10) * k3, 430 + 5 * j, { avgHr: 139 + j })));
    const l = laps(2.5, 1, k % 2 === 0 ? 4000 : 5000, 340, 0, 2, 432);
    runs.push({ id: `p3b-t${String(k)}`, date: addDays(m, 3), ...sumLaps(l), laps: l });
    runs.push(run(addDays(m, 6), (k % 2 === 0 ? 15 : 18) * k3, 435, { avgHr: 141 }));
  }
  return runs;
}

interface Pair {
  id: string;
  base: string;
  label: string;
  facts: Any;
  must: string;
}
const facts = (base: string, prof: Any, runs: Any[], pauses: Any[] = [], pain: Any[] = []): Any => {
  const p = profile(base);
  return {
    today: TODAY,
    availability: { runDays: p.runDays, longDay: p.longDay },
    profile: { ...p.profile, ...prof },
    runs,
    pauses,
    pain,
    ...(pain.length > 0 ? { painHistory: pain } : {})
  };
};
const r01 = profile('p01').profile.recentResult;
const r11 = profile('p11').profile.recentResult;
const r04 = profile('p04').profile.recentResult;
const MUST_TENK = {
  p1: 'B: nedelja 1 ≈ 34–36 km, niži vrh od A (A ≈ 53), dugi kreće niže (≈ 11–12 km), prve 2 nedelje bez T/R, rana provera forme, širi raspon prognoze',
  p2: 'B: niži vrh (× 1,4–1,5 umesto × 1,8), rasterećenje 2:1, dugi hod-trk po vremenu, brda/ubrzanja kasnije, širi raspon i predlog duže pripreme',
  p3: 'A: sporiji lagani dani sa objašnjenjem, prvi T mali i kasnije, dugi od ≈ 14 km; B: T od 1. nedelje, dugi ≈ 16 km, završnica u dugom ranije; vrh isti'
};
const MUST_HM = {
  p1: 'B: nedelja 1 34–36 km, vrh 48–50 (A 56), dugi od 12–13 km, prve 2–3 nedelje bez T/R, provera forme u ned 3–4, širi raspon prognoze',
  p2: 'B: vrh × 1,5 (A × 2,0), rasterećenje 2:1, dugi po vremenu uz hod-trk, brda/ubrzanja od ned 5, cilj „završiti" sa predlogom duže pripreme',
  p3: 'A: sporiji lagani dani sa objašnjenjem, prvi T 15–20 min i 2 nedelje kasnije, dugi od 14–15 km; B: T 28 min u ned 1–2, dugi 17–18 km, blok ranije; vrh isti'
};
const MUST = D.key === 'hm' ? MUST_HM : MUST_TENK;
const PAIRS: Pair[] = [
  { id: 'p1a', base: 'p01', label: 'P1 A — stabilan 12 meseci, rezultat star 3 nedelje', must: MUST.p1, facts: facts('p01', { yearsRunning: 4, longestRecentKm: 18 * k1, recentResult: { ...r01, date: '2026-10-11' } }, p1a()) },
  { id: 'p1b', base: 'p01', label: 'P1 B — povratnik posle 3 meseca pauze, rezultat star 8 meseci', must: MUST.p1, facts: facts('p01', { yearsRunning: 4, longestRecentKm: 12 * k1, recentResult: { ...r01, date: '2026-03-01' } }, p1b(), [{ from: '2026-06-29', to: '2026-09-27', reason: 'nepoznato' }]) },
  { id: 'p2a', base: 'p11', label: 'P2 A — početnik, 8 meseci bez prekida', must: MUST.p2, facts: facts('p11', { yearsRunning: 0.7, longestRecentKm: 10, recentResult: { ...r11, distanceM: 10000, timeSec: 3362, date: '2026-10-04' } }, p2a()) },
  { id: 'p2b', base: 'p11', label: 'P2 B — početnik, 6 nedelja trčanja, tegoba u potkolenici pre godinu dana', must: MUST.p2, facts: facts('p11', { yearsRunning: 0.1, longestRecentKm: 10, recentResult: { ...r11, distanceM: 10000, timeSec: 3362, date: '2026-10-25' } }, p2b(), [], [{ date: '2025-11-10', part: 'potkolenica', level: 5, resolvedOn: '2025-12-15' }]) },
  { id: 'p3a', base: 'p04', label: 'P3 A — sve u istom prebrzom tempu, bez kvaliteta, dugi 14–15 km', must: MUST.p3, facts: facts('p04', { yearsRunning: 3, longestRecentKm: 15 * k3, recentResult: r04 }, p3a()) },
  { id: 'p3b', base: 'p04', label: 'P3 B — spori lagani + prag jednom nedeljno, dugi 15/18 km', must: MUST.p3, facts: facts('p04', { yearsRunning: 3, longestRecentKm: 18 * k3, recentResult: r04 }, p3b()) }
];

const clock = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return `${h > 0 ? `${String(h)}:` : ''}${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
};
const f1 = (x: number): string => x.toFixed(1).replace('.', ',');
const summary: string[] = [`# Parovi personalizacije — ${D.name} (pregled)`, ''];
for (const pair of PAIRS) {
  const goal = profile(pair.base).goal;
  const state = E.buildState(pair.facts, goal, hm, estimateForm);
  const res = E.plan(state, goal, hm);
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  const doc = res.doc;
  const g = gateStats(doc, pair.facts);
  const firstQ = doc.weeks.find((w: Any) => w.days.some((d: Any) => d.workout?.kind === 'quality'));
  const test = doc.weeks.find((w: Any) => w.days.some((d: Any) => d.workout?.kind === 'test'));
  const firstLong = g.weeks.find((w: Any) => w.longKm > 0)?.longKm ?? 0;
  const lines = [
    `${pair.id.toUpperCase()} — ${pair.label} (ulazi kao ${pair.base})`,
    `MORA DA SE RAZLIKUJE: ${pair.must}`,
    `ISTORIJA: ${String(pair.facts.runs.length)} trčanja; nedelje (km): ${state.weeks.map((w: Any) => f1(w.distanceM / 1000)).join(' / ')}; pauze ${String(state.pauses.length)}, bol ${String((pair.facts.painHistory ?? []).length)}`,
    `BROJEVI: nivo ${String(doc.header.decisions.level)}; nedelja 1 ${f1(g.weeks[0]?.km ?? 0)} km; vrh ${f1(g.peakKm)} km; prvi dugi ${f1(firstLong)} km, najduži ${f1(g.longestLongKm)} km; prvi kvalitet u ${String(firstQ?.index ?? '-')}. nedelji; provera forme u ${String(test?.index ?? '-')}. nedelji; forma ${clock(state.form.current.raceTimeSec)} (${String(state.form.current.confidence)}), dan trke ${clock(doc.header.form.raceDay.expectedSec)} (${clock(doc.header.form.raceDay.lowSec)}–${clock(doc.header.form.raceDay.highSec)})`,
    ''
  ];
  writeFileSync(join(out, `${pair.id}.txt`), `${lines.join('\n')}\n${E.renderPlan(doc, state, hm)}\n`);
  summary.push(...lines.slice(0, 1), ...lines.slice(3, 4), '');
}
writeFileSync(join(out, 'pregled.txt'), `${summary.join('\n')}\n`);
console.log(summary.join('\n'));
