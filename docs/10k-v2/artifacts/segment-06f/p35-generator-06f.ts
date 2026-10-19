import * as T from '../../../../web/src/domain/generators/tenK/v2/testInputs.ts';
import { generateTenKV2 } from '../../../../web/src/domain/generators/tenK/v2/generate.ts';
const fams: [string, any[]][] = [
  ['R01', T.gridInputs()], ['R02', ([3, 4, 5, 6] as const).flatMap((d) => T.grid02Inputs(d))],
  ['F', ([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d))], ['B', ([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d))],
];
const B = new Set(['base', 'development', 'specific']);
const seen = new Set<string>();
const gaps: number[] = []; const byDays: Record<string, number> = {}; const byWeek: Record<string, number> = {}; const byFam: Record<string, [number, number]> = {};
const plansHit = new Set<string>(); let warnD25 = 0; const zones: Record<string, number> = {}; const ex: string[] = [];
for (const [f, xs] of fams) for (const c of xs) {
  const k = JSON.stringify(c.input); if (seen.has(k)) continue; seen.add(k);
  const g: any = generateTenKV2(c.input); if (!g.ok) continue;
  byFam[f] ??= [0, 0]; byFam[f][0]++;
  let hit = false;
  for (const w of g.plan.weeks) {
    if (!B.has(w.phase)) continue;
    const q = w.days.filter((d: any) => d.workout.kind === 'quality'); const l = w.days.find((d: any) => d.role === 'long');
    if (q.length < 2 || !l) continue;
    const over = q.filter((d: any) => d.workout.sec > l.workout.sec);
    if (!over.length) continue;
    hit = true;
    const gap = Math.max(...over.map((d: any) => d.workout.sec - l.workout.sec)) / 60; gaps.push(gap);
    const nd = c.input.runDays.length; byDays[nd] = (byDays[nd] ?? 0) + 1; byWeek[w.index] = (byWeek[w.index] ?? 0) + 1;
    for (const d of over) zones[`${d.role}:${d.workout.dose?.zone}`] = (zones[`${d.role}:${d.workout.dose?.zone}`] ?? 0) + 1;
    if (g.plan.warnings.some((v: any) => v.rule === 'LONG_SHORTER_THAN_QUALITY' && v.week === w.index)) warnD25++;
    if (ex.length < 6 && gap > 8) ex.push(`${c.id} ned ${w.index}: dugi ${l.workout.km} km ${Math.round(l.workout.sec/60)} min; ${over.map((d: any)=>`${d.workout.title} ${Math.round(d.workout.sec/60)} min`).join(' | ')}`);
  }
  if (hit) { plansHit.add(c.id); byFam[f][1]++; }
}
gaps.sort((a, b) => a - b);
const q = (p: number) => gaps[Math.floor(p * (gaps.length - 1))]!.toFixed(1);
console.log({ weeks: gaps.length, plans: plansHit.size, byFam, byDays, byWeek, zones, warnD25, gapMin: { p10: q(0.1), p50: q(0.5), p90: q(0.9), max: q(1) }, ex });
