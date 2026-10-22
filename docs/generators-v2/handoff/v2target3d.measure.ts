/* Faza 3, 3d — M3 kroz PRAVI kod: `select.shorterHandoffForV2Source` sa uključenim prekidačem cilja; ulaz ugovora =
   pravi `contractInput` izvora (`halfMarathon/v2/app/preparation.ts` 3c, `marathon/v2/app/preparation.ts` 3e; lak tempo
   čarobnjaka i poslednji rezultat). Parovi: HM v2 → 5K v2 (3d-5K), HM v2 → 10K v2 i maraton v2 → 10K v2 (3d-10K).
   Uzorak kao v2targetReal.measure.ts (svaki 193./97./29. ulaz R/F/B mreže izvora, bez trajnih mreža); asOf start − 1,
   kraj ned. 2, ⌊N/2⌋, N − 4; scenariji none/under50/pause35/pain8/fatigue (činjenice 4a, `raw`; cilj sam skida dayId).
   Meri: uspeh (po preostalim nedeljama), odbijanja generatora cilja (klasa poruke), odbijanja ADAPTACIJE (generator
   cilja prihvata isti ulaz, a predaja ne uspe), bez iste granice nedelje, dupli datumi/id, id cilja ≠ id izvora istog
   datuma, prefiks ≠ nedelje izvora, zajedničke provere 4a (lib.commonChecks: plan cilja iz generatora → adaptiran).
   Iz web/: npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs v2target3d */
import { writeFileSync } from 'node:fs';
import * as select from '../../../web/src/domain/generators/select';
import { generateFiveKV2 } from '../../../web/src/domain/generators/fiveK/v2/generate';
import { alignedStart as fiveKStart } from '../../../web/src/domain/generators/fiveK/v2/app/generate';
import { targetInput as fiveKInput } from '../../../web/src/domain/generators/fiveK/v2/app/handoffTarget';
import { generateTenKV2 } from '../../../web/src/domain/generators/tenK/v2/generate';
import { alignedStart as tenKStart } from '../../../web/src/domain/generators/tenK/v2/app/generate';
import { targetInput as tenKInput } from '../../../web/src/domain/generators/tenK/v2/app/handoffTarget';
import { contractInput as hmContract, HM_V2_SOURCE_FORMAT } from '../../../web/src/domain/generators/halfMarathon/v2/app/preparation';
import { contractInput as marContract, MARATHON_V2_SOURCE_FORMAT } from '../../../web/src/domain/generators/marathon/v2/app/preparation';
import { addDays, commonChecks, distOf, sampleBases, type Plan } from '../final-check/lib';

declare const test: (name: string, fn: () => void, timeout?: number) => void;
const SC = ['none', 'under50', 'pause35', 'pain8', 'fatigue'] as const;
type Week = { w: number; start: string; days: { dow: number; id?: string }[] };
type Out = { result?: { weeks: Week[] } & Record<string, unknown>; error?: string };
type Gen = (i: unknown) => { ok: boolean; plan?: unknown };

const TARGETS = {
  '5K': { dist: 5000, flags: { fiveKV2: true }, key: 'fiveKV2', start: fiveKStart, input: fiveKInput, generate: generateFiveKV2 as Gen, min: 6, max: 16 },
  '10K': { dist: 10000, flags: { fiveKV2: false, tenKV2: true }, key: 'tenKV2', start: tenKStart, input: tenKInput, generate: generateTenKV2 as Gen, min: 8, max: 18 }
} as const;
const SOURCES = {
  HM: { generate: select.generateHmV2Plan, key: 'hmV2', format: HM_V2_SOURCE_FORMAT, contract: hmContract as (p: never) => Record<string, unknown> },
  MAR: { generate: select.generateMarathonV2Plan, key: 'marathonV2', format: MARATHON_V2_SOURCE_FORMAT, contract: marContract as (p: never) => Record<string, unknown> }
} as const;

function measure(srcName: keyof typeof SOURCES, tName: keyof typeof TARGETS): void {
  const S = SOURCES[srcName];
  const T = TARGETS[tName];
  const lib = distOf(srcName);
  const { bases } = sampleBases(lib, { R: 193, F: 97, B: 29 });
  const out = { sources: 0, calls: 0, ok: 0, genRejected: {} as Record<string, number>, adaptRejected: 0, adaptEx: [] as string[], noBoundary: 0, duplicateDates: 0, duplicateIds: 0, idMismatch: 0, prefixMismatch: 0, common: {} as Record<string, number>, byWeeksLeft: {} as Record<string, string> };
  const tally: Record<string, [number, number]> = {};
  const h = select.shorterHandoffForV2Source(T.flags, S.format)(T.dist)!;
  for (const b of bases) {
    const s = S.generate(b.input as never);
    if (!s.ok) continue;
    out.sources++;
    const src = s.plan as unknown as { weeks: Week[] } & Record<string, unknown>;
    const p = src[S.key] as Plan;
    const N = p.weeks.length;
    const ends = [addDays(p.input.startDate, -1), p.weeks[1]!.endDate, p.weeks[Math.floor(N / 2) - 1]!.endDate, p.weeks[N - 5]!.endDate];
    const ci = { ...S.contract(p as never), raceDistM: T.dist, goalSec: null };
    for (const at of ends)
      for (const sc of SC) {
        out.calls++;
        const left = Math.floor((Date.parse(p.input.raceDate) - Date.parse(addDays(at, 1))) / 86_400_000 / 7 + 1 / 7);
        const bucket = left < T.min ? `<${T.min}` : left <= T.max ? `${T.min}-${T.max}` : `>${T.max}`;
        const t = (tally[bucket] ??= [0, 0]);
        t[1]++;
        const raw = lib.facts(p, sc, at);
        const r = (h as unknown as (...a: unknown[]) => Out)(src, ci, at, {}, { execution: null, restartFromBase: false, raw });
        if (!r.result) {
          const start = T.start(p.input.raceDate, addDays(at, 1));
          const g = start ? T.generate(T.input(ci as never, start)) : null;
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
        const tp = r.result[T.key] as Plan;
        const start = tp.input.startDate;
        if (JSON.stringify(r.result.weeks.filter((w) => w.start < start)) !== JSON.stringify(src.weeks.filter((w) => w.start < start))) out.prefixMismatch++;
        const before = T.generate(T.input(ci as never, start));
        if (before.ok)
          for (const v of commonChecks(before.plan as unknown as Plan, tp, at, raw)) out.common[v] = (out.common[v] ?? 0) + 1;
      }
  }
  out.byWeeksLeft = Object.fromEntries(Object.entries(tally).map(([k, [a, n]]) => [k, `${a}/${n} ok`]));
  const file = srcName === 'HM' && tName === '5K' ? './v2target3d-5K.json' : `./v2target3d-${srcName}-${tName}.json`;
  writeFileSync(new URL(file, import.meta.url), JSON.stringify(out, null, 1) + '\n');
}

test('M3 3d: HM v2 → 5K v2 kroz pravi kod', () => measure('HM', '5K'), 3_600_000);
test('M3 3d-10K: HM v2 → 10K v2 kroz pravi kod', () => measure('HM', '10K'), 3_600_000);
test('M3 3d-10K: maraton v2 → 10K v2 kroz pravi kod', () => measure('MAR', '10K'), 3_600_000);
