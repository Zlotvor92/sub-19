/* REVIEW-3 eksperiment A: lanac maraton v2 → HM v2 (prefiks) → 10K/5K v1 i 5K v2. Curenje ključa prefiksa `hmV2Prefix`
   i formata maratona u planu cilja. Iz web/: npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs review3a */
import { writeFileSync as _w } from 'node:fs';
import * as select from '../../../web/src/domain/generators/select';
import { v1TargetForV2Source } from '../../../web/src/domain/generators/handoff';
import { shorterOffer } from '../../../web/src/domain/generators/marathon/v2/shorter';
import { generatedPlan, storedPlan } from '../../../web/src/domain/generators/marathon/v2/app/plan';
import { HM_V2_SOURCE_FORMAT, contractInput, rawFacts } from '../../../web/src/domain/generators/halfMarathon/v2/app/preparation';
import { distOf, sampleBases } from '../final-check/lib';
declare const test: (name: string, fn: () => void, timeout?: number) => void;
const HM = 21097.5;
test('A', () => {
  const mar = distOf('MAR');
  const { bases } = sampleBases(mar, { R: 193, F: 97, B: 29 });
  const out = { chain: { tried: 0, adaptOk: 0, offer: 0, v1ok: 0, prefixLeak: 0, err: {} as Record<string, number> }, hmTargets: 0, v1: { ok: 0, prefixLeak: 0, err: {} as Record<string, number> }, fiveV2: { ok: 0, err: {} as Record<string, number> }, example: null as unknown };
  for (const b of bases) {
    const g = mar.generate(b.input);
    if (!g.ok) continue;
    const p = g.plan;
    const N = p.weeks.length;
    for (const at of [p.weeks[1]!.endDate as string, p.weeks[Math.floor(N / 2) - 1]!.endDate as string, p.weeks[Math.max(0, N - 12)]!.endDate as string])
    for (const sc of ['pause35', 'pause20', 'painPause'] as const) {
    const facts = mar.facts(p, sc, at);
    const r = mar.adapt(p, facts, at);
    if (!r.ok || !shorterOffer(r.plan as never, at)) continue;
    const src = select.stampForStorage(storedPlan(generatedPlan(r.plan as never)) as never) as never;
    const ctx = { log: {}, alts: {}, moves: {} };
    const prep = select.preparationForPlan(src, { fiveKV2: false, hmV2: true })!;
    const basis = prep.basisFromPlan(src, at as never)!;
    const c = prep.buildPreparationChoice(src, at as never, basis, { kind: 'shorter', raceDistM: HM }, ctx as never);
    if ('error' in c) continue;
    const T = select.stampForStorage(c.result) as never as Record<string, unknown>;
    out.hmTargets++;
    // T kao izvor (posle predaje) → v1 10K kroz isti lepak kao preparationForPlan(T)
    const hv2 = T['hmV2'] as never;
    const input = contractInput(hv2);
    const facts2 = { execution: null, restartFromBase: false, notes: [], meta: {}, raw: rawFacts(T as never, at as never, ctx as never) };
    const v1 = v1TargetForV2Source(10000, HM_V2_SOURCE_FORMAT)!(T as never, { ...input, raceDistM: 10000, goalSec: null } as never, at as never, ctx as never, facts2 as never) as Record<string, unknown>;
    if ('error' in v1) { out.v1.err[String(v1.error).slice(0, 80)] = (out.v1.err[String(v1.error).slice(0, 80)] ?? 0) + 1; }
    else {
      out.v1.ok++;
      const res = select.stampForStorage(v1.result as never) as unknown as Record<string, unknown>;
      if ('hmV2Prefix' in res) { out.v1.prefixLeak++; if (!out.example) out.example = { keys: Object.keys(res), generator: select.generatorForPlan(res as never)?.policyId, prefixWeeks: (res['hmV2Prefix'] as { weeks: unknown[] }).weeks.length }; }
    }
    const five = select.shorterHandoffForV2Source({ fiveKV2: true }, HM_V2_SOURCE_FORMAT)(5000)!(T as never, { ...input, raceDistM: 5000, goalSec: null } as never, at as never, ctx as never, facts2 as never) as Record<string, unknown>;
    if ('error' in five) out.fiveV2.err[String(five.error).slice(0, 80)] = (out.fiveV2.err[String(five.error).slice(0, 80)] ?? 0) + 1;
    else out.fiveV2.ok++;
    // Dostupnost u aplikaciji: druga adaptacija (pauza 21 d) nad T → ponuda → preparationForPlan(T2) → 10K v1.
    for (const k of [7, 14, 21, 35, 42]) {
      const at2 = new Date(Date.parse(at + 'T00:00:00Z') + k * 864e5).toISOString().slice(0, 10);
      if (at2 >= String((T['meta'] as Record<string, unknown>)['raceDate'])) continue;
      out.chain.tried++;
      const from = new Date(Date.parse(at2 + 'T00:00:00Z') - (k >= 35 ? 34 : k - 1) * 864e5).toISOString().slice(0, 10);
      const pv = select.hmV2AdaptPreview(T as never, at2 as never, { log: {}, alts: {}, moves: {}, facts: { confirmedDays: 28 } } as never, [{ from, to: at2 }]) as unknown as { ok: boolean; result?: unknown; shorterOffer?: true };
      if (!pv.ok) continue;
      out.chain.adaptOk++;
      if (!pv.shorterOffer) continue;
      out.chain.offer++;
      const T2 = select.stampForStorage(pv.result as never) as never;
      const prep2 = select.preparationForPlan(T2, { fiveKV2: false })!;
      if (!prep2.isLimitedLongPreparation((T2 as { meta: never }).meta, T2)) continue;
      const b2 = prep2.basisFromPlan(T2, at2 as never)!;
      const c2 = prep2.buildPreparationChoice(T2, at2 as never, b2, { kind: 'shorter', raceDistM: 10000 }, ctx as never);
      if ('error' in c2) { out.chain.err[c2.error.slice(0, 80)] = (out.chain.err[c2.error.slice(0, 80)] ?? 0) + 1; continue; }
      out.chain.v1ok++;
      if ('hmV2Prefix' in (select.stampForStorage(c2.result) as object)) out.chain.prefixLeak++;
    }
    }
  }
  _w((process.env.OUT_DIR ?? '.') + '/review3a.json', JSON.stringify(out, null, 1));
}, 3_600_000);
