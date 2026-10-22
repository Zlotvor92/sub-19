/* Faza 3, 3d — M3 (HM v2 → 5K v2 cilj; dopuna 3d-10K: HM v2 i maraton v2 → 10K v2) kroz PRAVI kod:
   `select.shorterHandoffForV2Source` sa uključenim prekidačem cilja; ulaz ugovora izvora HM v2 = pravi
   `contractInput` izvora (`halfMarathon/v2/app/preparation.ts`, 3c; lak tempo čarobnjaka od 3d-dopune). Uzorak kao v2targetReal.measure.ts (svaki
   193./97./29. ulaz R/F/B mreže izvora, bez trajnih mreža); asOf start − 1, kraj ned. 2, ⌊N/2⌋, N − 4; scenariji
   none/under50/pause35/pain8/fatigue (činjenice 4a, `raw`; cilj sam skida dayId).
   Meri: uspeh (po preostalim nedeljama), odbijanja generatora cilja (klasa poruke), odbijanja ADAPTACIJE (generator
   cilja prihvata isti ulaz, a predaja ne uspe), dupli datumi/id, id cilja ≠ id izvora istog datuma, zajedničke provere
   4a (lib.commonChecks: plan cilja iz generatora → adaptiran). Iz web/:
   npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs v2target3d */
import { writeFileSync } from 'node:fs';
import * as select from '../../../web/src/domain/generators/select';
import { generateFiveKV2 } from '../../../web/src/domain/generators/fiveK/v2/generate';
import { alignedStart } from '../../../web/src/domain/generators/fiveK/v2/app/generate';
import { targetInput } from '../../../web/src/domain/generators/fiveK/v2/app/handoffTarget';
import { contractInput } from '../../../web/src/domain/generators/halfMarathon/v2/app/preparation';
import { addDays, commonChecks, distOf, sampleBases, type Plan } from '../final-check/lib';

declare const test: (name: string, fn: () => void, timeout?: number) => void;
const SC = ['none', 'under50', 'pause35', 'pain8', 'fatigue'] as const;
type Week = { w: number; start: string; days: { dow: number; id?: string }[] };
type Out = { result?: { weeks: Week[]; fiveKV2: Plan }; error?: string };

test('M3 3d: HM v2 → 5K v2 kroz pravi kod', () => {
  const hm = distOf('HM');
  const { bases } = sampleBases(hm, { R: 193, F: 97, B: 29 });
  const out = { sources: 0, calls: 0, ok: 0, genRejected: {} as Record<string, number>, adaptRejected: 0, adaptEx: [] as string[], noBoundary: 0, duplicateDates: 0, duplicateIds: 0, idMismatch: 0, prefixMismatch: 0, common: {} as Record<string, number>, byWeeksLeft: {} as Record<string, string> };
  const tally: Record<string, [number, number]> = {};
  const h = select.shorterHandoffForV2Source({ fiveKV2: true }, { planKey: 'hmV2', metaKeys: [] })(5000)!;
  for (const b of bases) {
    const s = select.generateHmV2Plan(b.input as never);
    if (!s.ok) continue;
    out.sources++;
    const src = s.plan as unknown as { weeks: Week[]; hmV2: Plan };
    const p = src.hmV2;
    const N = p.weeks.length;
    const ends = [addDays(p.input.startDate, -1), p.weeks[1]!.endDate, p.weeks[Math.floor(N / 2) - 1]!.endDate, p.weeks[N - 5]!.endDate];
    const ci = { ...contractInput(p as never), raceDistM: 5000, goalSec: null };
    for (const at of ends)
      for (const sc of SC) {
        out.calls++;
        const left = Math.floor((Date.parse(p.input.raceDate) - Date.parse(addDays(at, 1))) / 86_400_000 / 7 + 1 / 7);
        const bucket = left < 6 ? '<6' : left <= 16 ? '6-16' : '>16';
        const t = (tally[bucket] ??= [0, 0]);
        t[1]++;
        const raw = hm.facts(p, sc, at);
        const r = (h as unknown as (...a: unknown[]) => Out)(src, ci, at, {}, { execution: null, restartFromBase: false, raw });
        if (!r.result) {
          const start = alignedStart(p.input.raceDate, addDays(at, 1));
          const g = start ? generateFiveKV2(targetInput(ci as never, start)) : null;
          if (g?.ok) {
            if (/ne poklapaju/.test(String(r.error))) out.noBoundary++;
            else {
              out.adaptRejected++;
              if (out.adaptEx.length < 5) out.adaptEx.push(`${b.id} ${at} ${sc}: ${r.error}`);
            }
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
        const start = r.result.fiveKV2.input.startDate;
        if (JSON.stringify(r.result.weeks.filter((w) => w.start < start)) !== JSON.stringify(src.weeks.filter((w) => w.start < start))) out.prefixMismatch++;
        const before = generateFiveKV2(targetInput(ci as never, start));
        if (before.ok)
          for (const v of commonChecks(before.plan as unknown as Plan, r.result.fiveKV2, at, raw)) out.common[v] = (out.common[v] ?? 0) + 1;
      }
  }
  out.byWeeksLeft = Object.fromEntries(Object.entries(tally).map(([k, [a, n]]) => [k, `${a}/${n} ok`]));
  writeFileSync(new URL('./v2target3d-5K.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
}, 3_600_000);
