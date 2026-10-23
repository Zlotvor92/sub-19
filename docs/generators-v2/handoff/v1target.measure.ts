/* Faza 3a, pitanje 3 — da li v1 cilj (`handoff.ts` → 5K/10K/HM v1 `handoffFuture`) radi BEZ IZMENE nad planom v2
   izvora (HM v2 → 10K/5K v1, maraton v2 → HM/10K v1). SAMO ČITANJE: ništa se ne upisuje, kod se ne menja.
   Izvor: plan za upis v2 (`generateStructured`, tačno ono što aplikacija upisuje). Ulaz cilja: ulaz čarobnjaka v2
   preveden u oblik ugovora (`PlanGenerationInput`) BEZ izvedenih polja — samo činjenice ulaza (datumi, dani, obim iz
   čarobnjaka, rezultat, skorašnji najduži, početnik); ovaj prevod danas NE postoji u kodu (v. DESIGN.md P2).
   Dva stanja činjenica: (a) bez izvršenja (`execution: null`), (b) potvrđena pauza 14 dana (saglasan ulaz,
   `startDate = asOf + 1` → v1 `returnInput`). asOf: start − 1, kraj nedelje 2, kraj nedelje N/2.
   Meri: uspeh/greška cilja, ključevi `meta` izvora v2 koji prežive kalemljenje (curenje), dani v2 (`structure`) u
   rezultatu, generator koji `select.ts` posle upisa bira za rezultat.
   Iz web/: npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs */
import { regeneratorForDistance } from '../../../web/src/domain/generators/handoff';
import { generatorForPlan, stampForStorage, TEN_K_GENERATOR, FIVE_K_GENERATOR, HALF_MARATHON_GENERATOR } from '../../../web/src/domain/generators/select';
import { generateStructured as hmStructured } from '../../../web/src/domain/generators/halfMarathon/v2/app/generate';
import { generateStructured as marStructured } from '../../../web/src/domain/generators/marathon/v2/app/generate';
import * as THM from '../../../web/src/domain/generators/halfMarathon/v2/testInputs';
import * as TM from '../../../web/src/domain/generators/marathon/v2/testInputs';
import { writeFileSync } from 'node:fs';

declare const test: (name: string, fn: () => void, timeout?: number) => void;

const DAY = 86_400_000;
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
type V2In = {
  startDate: string;
  raceDate: string;
  runDays: string[];
  longRunDay?: string | null;
  currentWeeklyKm: number;
  recentResult?: { distanceM: number; timeSec: number; date: string } | null;
  recentLongRunKm?: number;
  experience?: string;
};
/** Prevod ulaza v2 → ulaz ugovora (samo činjenice; isti smer kao v2 `generatePlan(ContractInput)`, obrnuto). */
function contractInput(v: V2In, dist: number) {
  const runDows = v.runDays.map((d) => WD.indexOf(d) + 1);
  return {
    startDate: v.startDate,
    raceDate: v.raceDate,
    raceDistM: dist,
    pb: v.recentResult ? { distM: v.recentResult.distanceM, sec: v.recentResult.timeSec, date: v.recentResult.date } : undefined,
    weeklyKm: v.currentWeeklyKm,
    ...(v.recentLongRunKm != null ? { recentLongRunKm: v.recentLongRunKm } : {}),
    runDays: runDows.length,
    runDows,
    ...(v.longRunDay ? { lrDow: WD.indexOf(v.longRunDay) + 1 } : {}),
    intensity: 'std',
    goalSec: null,
    trainedRecently: v.experience !== 'beginner'
  };
}

const V1_ID = new Map<unknown, string>([[TEN_K_GENERATOR, '10K v1'], [FIVE_K_GENERATOR, '5K v1'], [HALF_MARATHON_GENERATOR, 'HM v1']]);
type Out = Record<string, number | Record<string, number> | string[]>;
function run(name: string, inputs: { id: string; input: unknown }[], structured: (i: never) => { ok: boolean; plan?: unknown }, targets: number[], v2Key: string) {
  const out: Out = { sources: 0, sourceRejected: 0, calls: 0, ok: 0, error: 0, errors: {}, leakedMetaKeys: {}, v2KeyKept: 0, v2DaysKept: 0, selectedAs: {}, ex: [] };
  const inc = (k: string, key: string) => { const o = out[k] as Record<string, number>; o[key] = (o[key] ?? 0) + 1; };
  for (const c of inputs) {
    const s = structured(c.input as never);
    if (!s.ok) { (out.sourceRejected as number)++; continue; }
    (out.sources as number)++;
    const plan = s.plan as { weeks: { start: string; days: Record<string, unknown>[] }[]; meta: Record<string, unknown> } & Record<string, unknown>;
    const v = c.input as V2In;
    const N = plan.weeks.length;
    const asOfs = [addDays(v.startDate, -1), addDays(v.startDate, 13), addDays(v.startDate, 7 * Math.floor(N / 2) - 1)];
    for (const dist of targets)
      for (const at of asOfs)
        for (const withBreak of [false, true]) {
          const handoff = regeneratorForDistance(dist)!;
          const input = contractInput(v, dist);
          const facts = withBreak
            ? {
                execution: { date: at, reason: 'confirmed-break' as const, breakDays: 14, reportedBaseKm: Math.round(v.currentWeeklyKm * 0.6), startingKm: Math.round(v.currentWeeklyKm * 0.6), reportedLongRunKm: v.recentLongRunKm },
                restartFromBase: true, notes: [], meta: {}
              }
            : { execution: null, restartFromBase: false, notes: [], meta: {} };
          (out.calls as number)++;
          let r: { result?: { meta?: Record<string, unknown>; weeks: { days: Record<string, unknown>[] }[] } & Record<string, unknown>; error?: string };
          try {
            r = handoff(plan as never, { ...input, ...(withBreak ? { startDate: addDays(at, 1) } : {}) } as never, at as never, {}, facts as never) as never;
          } catch (e) {
            r = { error: `THROW ${(e as Error).message.slice(0, 80)}` };
          }
          if (!r.result) {
            (out.error as number)++;
            inc('errors', `${dist}/${withBreak ? 'pauza' : 'bez'}: ${String(r.error).replace(/[0-9]+([.,][0-9]+)?/g, '#').slice(0, 90)}`);
            continue;
          }
          (out.ok as number)++;
          const res = r.result;
          for (const k of Object.keys(plan.meta)) if (k in (res.meta ?? {}) && !['start', 'weeks', 'raceDate', 'raceDistM', 'raceName', 'goalSec', 'runDays', 'quality', 'dayWarnings', 'vdot0', 'vdot', 'policyId', 'policyVersion'].includes(k)) inc('leakedMetaKeys', k);
          if (v2Key in res) (out.v2KeyKept as number)++;
          if (res.weeks.some((w) => w.days.some((d) => 'structure' in d))) (out.v2DaysKept as number)++;
          const stamped = stampForStorage(res as never);
          inc('selectedAs', `${dist}→${V1_ID.get(generatorForPlan(stamped as never)) ?? String((stamped as { meta?: { policyId?: unknown } }).meta?.policyId)}`);
          if ((out.ex as string[]).length < 3 && v2Key in res) (out.ex as string[]).push(`${c.id} ${dist} ${at}`);
        }
  }
  return out;
}

test('v1 cilj nad v2 izvorom', () => {
  const hm = THM.grid02Inputs().filter((_, i) => i % 97 === 48).map((c) => ({ id: c.id, input: c.input }));
  const hmFeel = THM.feelInputs().filter((_, i) => i % 31 === 15).map((c) => ({ id: c.id, input: c.input }));
  const mar = TM.gridInputs().filter((_, i) => i % 97 === 48).map((c) => ({ id: c.id, input: c.input }));
  const marFeel = TM.feelInputs().filter((_, i) => i % 31 === 15).map((c) => ({ id: c.id, input: c.input }));
  const res = {
    'HM v2 (rezultat) → 10K/5K v1': run('HM', hm, hmStructured as never, [10000, 5000], 'hmV2'),
    'HM v2 (po osećaju) → 10K/5K v1': run('HMf', hmFeel, hmStructured as never, [10000, 5000], 'hmV2'),
    'maraton v2 (rezultat) → HM/10K v1': run('MAR', mar, marStructured as never, [21097.5, 10000], 'marathonV2'),
    'maraton v2 (po osećaju) → HM/10K v1': run('MARf', marFeel, marStructured as never, [21097.5, 10000], 'marathonV2')
  };
  writeFileSync(new URL('./v1target.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
}, 3_600_000);
