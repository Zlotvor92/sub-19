/* 08l (3i za 5K): obrazac REVIEW-3 eksperiment D (docs/generators-v2/handoff/review3d.measure.ts) za cilj 5K v2: plan
   cilja sa prefiksom izvora (HM v2 → 5K v2) + trka 5 km posle predaje → prilagođavanje → Napredak/Forma
   (`fiveKV2FormHistory`) i razlozi pregleda: broj nedelje u tekstu prema broju te nedelje u kalendaru (`w`).
   labelMismatch: „tempo od nedelje N" ≠ broj kalendarske nedelje posle trke; reasonMismatch: broj nedelje u razlogu
   pregleda van kalendarskih nedelja plana cilja (≤ offset ili > offset + broj nedelja v2).
   Iz web/: npx vitest run --config ../docs/5k-v2/artifacts/segment-08l/vitest.measure.config.mjs review3d-5K */
import { writeFileSync } from 'node:fs';
import * as select from '../../../../web/src/domain/generators/select';
import { shorterOffer } from '../../../../web/src/domain/generators/halfMarathon/v2/shorter';
import { generatedPlan, storedPlan } from '../../../../web/src/domain/generators/halfMarathon/v2/app/plan';
import { addDays, distOf, sampleBases } from '../../../generators-v2/final-check/lib';
declare const test: (name: string, fn: () => void, timeout?: number) => void;
type Day = { dow: number; id: string; tag?: string } & Record<string, unknown>;
type St = { weeks: { w: number; start: string; days: Day[] }[]; meta: Record<string, unknown> } & Record<string, unknown>;
const WEEK_NO = /[Nn]edelj[a-z]* (\d+)(?!\d|[.,]\d| km| kvalitet)/g;
test('D-5K', () => {
  const hm = distOf('HM');
  const { bases } = sampleBases(hm, { R: 60, F: 30, B: 10 });
  const out = { targets: 0, adapted: 0, labelMismatch: 0, reasonMismatch: 0, numbered: 0, ex: [] as unknown[] };
  for (const b of bases) {
    const g = hm.generate(b.input);
    if (!g.ok) continue;
    const p = g.plan;
    const at = p.weeks[2]!.endDate as string;
    const r = hm.adapt(p, hm.facts(p, 'pause35', at), at);
    if (!r.ok || !shorterOffer(r.plan as never, at)) continue;
    const src = select.stampForStorage(storedPlan(generatedPlan(r.plan as never)) as never) as never;
    const prep = select.preparationForPlan(src, { fiveKV2: true, tenKV2: false })!;
    const basis = prep.basisFromPlan(src, at as never)!;
    const c = prep.buildPreparationChoice(src, at as never, basis, { kind: 'shorter', raceDistM: 5000 }, { log: {}, alts: {}, moves: {} } as never);
    if ('error' in c) continue;
    const T = select.stampForStorage(c.result) as unknown as St;
    if (!('fiveKV2Prefix' in T)) continue;
    out.targets++;
    const off = (T['fiveKV2Prefix'] as { offset: number }).offset;
    const v2w = (T['fiveKV2'] as { weeks: { startDate: string }[] }).weeks;
    const day = addDays(v2w[1]!.startDate, 2);
    const log = { trka: { status: 'done', km: 5, sec: 1380, ts: day, raceAi: { context: { date: day, distanceM: 5000, officialSec: 1380, intent: 'race' } } } };
    const today = addDays(day, 1);
    const pv = select.fiveKV2AdaptPreview(T as never, today as never, { log } as never) as unknown as { ok: boolean; result: St; reasons: { message: string }[]; needed: string[] };
    if (!pv.ok) continue;
    out.adapted++;
    const R = select.stampForStorage(pv.result as never) as unknown as St;
    const n2 = (R['fiveKV2'] as { weeks: unknown[] }).weeks.length;
    for (const m of [...pv.reasons.map((x) => x.message), ...pv.needed])
      for (const [, n] of m.matchAll(WEEK_NO)) {
        out.numbered++;
        if (Number(n) <= off || Number(n) > off + n2) {
          out.reasonMismatch++;
          if (out.ex.length < 5) out.ex.push({ base: b.id, offset: off, message: m });
        }
      }
    const f = select.fiveKV2FormHistory({ plan: R as never, today: today as never, log: log as never }) as unknown as { points: { label: string }[] };
    const lab = f.points.map((x) => x.label).find((l) => / od nedelje (\d+)/.test(l));
    const n = lab ? Number(/ od nedelje (\d+)/.exec(lab)![1]) : null;
    const cal = R.weeks.find((w) => w.start > day)?.w ?? null;
    if (n !== null && cal !== null && n !== cal) {
      out.labelMismatch++;
      if (out.ex.length < 5) out.ex.push({ base: b.id, offset: off, label: lab, cal });
    }
  }
  writeFileSync((process.env.OUT_DIR ?? '.') + '/review3d-5K.json', JSON.stringify(out, null, 1));
}, 3_600_000);
