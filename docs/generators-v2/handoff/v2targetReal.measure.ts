/* Faza 3, 3f — M3 (maraton v2 → HM v2 cilj) kroz PRAVI kod: `select.shorterHandoffForV2Source` sa uključenim HM v2.
   Uzorak kao v2target.ts (svaki 193./97./29. ulaz R/F/B mreže maratona v2, bez trajnih mreža); asOf start − 1, kraj
   ned. 2, ⌊N/2⌋, N − 4; scenariji none/under50/pause35/pain8/fatigue (činjenice 4a, `raw`, cilj sam skida dayId).
   Meri: uspeh, odbijanja generatora cilja (klasa poruke), odbijanja ADAPTACIJE (generator cilja prihvata isti ulaz, a
   predaja ne uspe), dupli datumi/id, id cilja ≠ id izvora istog datuma, zajedničke provere 4a (lib.commonChecks:
   plan cilja iz generatora → adaptiran). Iz web/:
   npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs v2targetReal */
import { writeFileSync } from 'node:fs';
import * as select from '../../../web/src/domain/generators/select';
import { generateHmV2 } from '../../../web/src/domain/generators/halfMarathon/v2/generate';
import { alignedStart } from '../../../web/src/domain/generators/halfMarathon/v2/app/generate';
import { targetInput } from '../../../web/src/domain/generators/halfMarathon/v2/app/handoffTarget';
import { addDays, commonChecks, distOf, sampleBases, type Plan } from '../final-check/lib';

declare const test: (name: string, fn: () => void, timeout?: number) => void;
const WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const FORMAT = { planKey: 'marathonV2', metaKeys: ['vdot', 'paceBasis', 'mpVdot', 'predictedMarathonSec', 'goalVdot', 'goalAssessment'] };
const SC = ['none', 'under50', 'pause35', 'pain8', 'fatigue'] as const;

function contractInput(v: Record<string, unknown>) {
  const runDows = (v['runDays'] as string[]).map((d) => WD.indexOf(d) + 1);
  const r = v['recentResult'] as { distanceM: number; timeSec: number; date: string } | null | undefined;
  return {
    startDate: v['startDate'], raceDate: v['raceDate'], raceDistM: 21097.5,
    ...(r ? { pb: { distM: r.distanceM, sec: r.timeSec, date: r.date } } : {}),
    weeklyKm: v['currentWeeklyKm'],
    ...(v['recentLongRunKm'] != null ? { recentLongRunKm: v['recentLongRunKm'] } : {}),
    ...(v['easyPaceSecPerKm'] != null ? { easyPaceSecPerKm: v['easyPaceSecPerKm'] } : {}),
    runDays: runDows.length, runDows,
    ...(v['longRunDay'] ? { lrDow: WD.indexOf(v['longRunDay'] as string) + 1 } : {}),
    intensity: 'std', goalSec: null, trainedRecently: v['experience'] !== 'beginner'
  };
}

test('M3 kroz pravi kod', () => {
  const mar = distOf('MAR');
  const { bases } = sampleBases(mar, { R: 193, F: 97, B: 29 });
  const out = { sources: 0, calls: 0, ok: 0, genRejected: {} as Record<string, number>, adaptRejected: 0, adaptEx: [] as string[], duplicateDates: 0, duplicateIds: 0, idMismatch: 0, common: {} as Record<string, number>, byWeeksLeft: {} as Record<string, string> };
  const tally: Record<string, [number, number]> = {};
  const h = select.shorterHandoffForV2Source({ fiveKV2: false, hmV2: true }, FORMAT)(21097.5)!;
  for (const b of bases) {
    const s = select.generateMarathonV2Plan(b.input as never);
    if (!s.ok) continue;
    out.sources++;
    const src = s.plan as unknown as { weeks: { start: string; days: { dow: number; id?: string }[] }[]; marathonV2: Plan };
    const p = src.marathonV2;
    const N = p.weeks.length;
    const ends = [addDays(p.input.startDate, -1), p.weeks[1]!.endDate, p.weeks[Math.floor(N / 2) - 1]!.endDate, p.weeks[N - 5]!.endDate];
    const ci = contractInput(p.input as unknown as Record<string, unknown>);
    for (const at of ends)
      for (const sc of SC) {
        out.calls++;
        const left = Math.floor((Date.parse(p.input.raceDate) - Date.parse(addDays(at, 1))) / 86_400_000 / 7 + 1 / 7);
        const bucket = left < 8 ? '<8' : left < 10 ? '8-9' : left < 12 ? '10-11' : '≥12';
        const t = (tally[bucket] ??= [0, 0]);
        t[1]++;
        const raw = mar.facts(p, sc, at);
        const r = (h as unknown as (...a: unknown[]) => { result?: { weeks: { start: string; days: { dow: number; id?: string }[] }[]; hmV2: Plan }; error?: string })(src, ci, at, {}, { execution: null, restartFromBase: false, raw });
        if (!r.result) {
          const start = alignedStart(p.input.raceDate, addDays(at, 1));
          const g = start ? generateHmV2(targetInput(ci as never, start)) : null;
          if (g?.ok) {
            out.adaptRejected++;
            if (out.adaptEx.length < 5) out.adaptEx.push(`${b.id} ${at} ${sc}: ${r.error}`);
          } else {
            const k = String(r.error).replace(/[0-9]+([.,][0-9]+)?/g, '#').slice(0, 80);
            out.genRejected[k] = (out.genRejected[k] ?? 0) + 1;
          }
          continue;
        }
        out.ok++;
        t[0]++;
        const dated = r.result.weeks.flatMap((w) => w.days.map((d) => [addDays(w.start, d.dow), d.id] as const));
        if (new Set(dated.map(([d]) => d)).size !== dated.length) out.duplicateDates++;
        if (new Set(dated.map(([, i]) => i)).size !== dated.length) out.duplicateIds++;
        const srcIds = new Map(src.weeks.flatMap((w) => w.days.map((d) => [addDays(w.start, d.dow), d.id] as const)));
        if (dated.some(([d, i]) => srcIds.get(d) !== i)) out.idMismatch++;
        const before = generateHmV2(targetInput(ci as never, r.result.hmV2.input.startDate));
        if (before.ok)
          for (const v of commonChecks(before.plan as unknown as Plan, r.result.hmV2, at, raw)) out.common[v] = (out.common[v] ?? 0) + 1;
      }
  }
  out.byWeeksLeft = Object.fromEntries(Object.entries(tally).map(([k, [a, n]]) => [k, `${a}/${n} ok`]));
  writeFileSync(new URL('./v2targetReal.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
}, 3_600_000);
