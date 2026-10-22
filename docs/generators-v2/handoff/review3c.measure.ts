/* REVIEW-3 eksperiment C: vraćanje revizije izvora (HM v2 / maraton v2) preko plana cilja posle predaje, kroz isti
   poziv kao `previewRestore` (generator po snimku → `graftFuturePlan(current, snapshot)`). Meri `raceDistM` u meta
   cilja i da li vraćanje prolazi (changedDays > 0, plan dobija hmV2) umesto RESTORE_OTHER_DISTANCE.
   Iz web/: npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs review3c */
import { writeFileSync } from 'node:fs';
import * as select from '../../../web/src/domain/generators/select';
import { shorterOffer } from '../../../web/src/domain/generators/halfMarathon/v2/shorter';
import { generatedPlan, storedPlan } from '../../../web/src/domain/generators/halfMarathon/v2/app/plan';
import { distOf, sampleBases } from '../final-check/lib';
declare const test: (name: string, fn: () => void, timeout?: number) => void;
const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
test('C', () => {
  const hm = distOf('HM');
  const { bases } = sampleBases(hm, { R: 60, F: 0, B: 0 });
  const out: Record<string, { n: number; raceDistM: Record<string, number>; restore: Record<string, number>; ex?: unknown }> = {};
  for (const b of bases) {
    const g = hm.generate(b.input);
    if (!g.ok) continue;
    const p = g.plan;
    const at = p.weeks[Math.floor(p.weeks.length / 2) - 1]!.endDate as string;
    const r = hm.adapt(p, hm.facts(p, 'pause35', at), at);
    if (!r.ok || !shorterOffer(r.plan as never, at)) continue;
    const src = select.stampForStorage(storedPlan(generatedPlan(r.plan as never)) as never) as never;
    const ctx = { log: {}, alts: {}, moves: {} };
    for (const [flags, dist, name] of [[{ fiveKV2: false }, 10000, '10K v1'], [{ fiveKV2: false }, 5000, '5K v1'], [{ fiveKV2: true }, 5000, '5K v2']] as const) {
      const prep = select.preparationForPlan(src, flags)!;
      const basis = prep.basisFromPlan(src, at as never)!;
      const c = prep.buildPreparationChoice(src, at as never, basis, { kind: 'shorter', raceDistM: dist }, ctx as never);
      if ('error' in c) continue;
      const cur = select.stampForStorage(c.result) as never as { meta: Record<string, unknown> };
      const o = (out[name] ??= { n: 0, raceDistM: {}, restore: {} });
      o.n++;
      inc(o.raceDistM, String(cur.meta['raceDistM']));
      // previewRestore: generator po snimku (HM v2), graft nad tekućim planom (cilj)
      const gen = select.generatorForPlan(src)!;
      const res = gen.graftFuturePlan(cur as never, src, at as never, ctx as never) as unknown as Record<string, unknown> & { meta: Record<string, unknown> };
      const ch = res.meta['futureChanges'] as { changedDays?: number; conflicts?: string[] } | undefined;
      const key = ch?.conflicts?.includes(select.RESTORE_OTHER_DISTANCE) ? 'odbijeno RESTORE_OTHER_DISTANCE' : ch?.changedDays ? `PROŠLO changedDays>0, hmV2=${'hmV2' in res}, raceDistM=${res.meta['raceDistM']}, gen=${select.generatorForPlan(select.stampForStorage(res as never) as never)?.policyId}` : `changedDays=${ch?.changedDays}`;
      inc(o.restore, key);
    }
  }
  writeFileSync((process.env.OUT_DIR ?? '.') + '/review3c.json', JSON.stringify(out, null, 1));
}, 3_600_000);
