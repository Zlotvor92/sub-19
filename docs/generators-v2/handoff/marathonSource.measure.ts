/* Faza 3, 3e — tok maraton v2 IZVOR → HM v1 / 10K v1 (prekidači isključeni) i → HM v2 (prekidač HM v2, 3f) kroz PRAVI
   kod: `select.preparationForPlan` (odluka, izbor) nad sačuvanim planom maratona v2 posle adaptacije sa ponudom.
   Uzorak: 4a mreže maratona v2 (193/97/29 kao shorter.ts), asOf kraj ned. 2 i ⌊N/2⌋, scenariji pause35, pause20,
   painPause, test5k, slower, under50; dnevnik izvora = završeni zapisi činjenica 4a (id dana sačuvanog plana).
   Meri: ponude, opcije i razloge nedostupnosti (klasa poruke), izbore: dupli datum/id, id prošlog dana ≠ id izvora,
   id ≠ id izvora istog datuma (svi dani), curenje formata v2 u v1 cilj (ključ `marathonV2`, meta v2 jednaka izvoru),
   pogrešan generator, po osećaju → v1 nedostupan, zajedničke provere 4a na planu HM v2 cilja. Iz web/:
   npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs marathonSource */
import { writeFileSync } from 'node:fs';
import * as select from '../../../web/src/domain/generators/select';
import { V1_TARGET_NEEDS_RESULT } from '../../../web/src/domain/generators/handoff';
import { generateHmV2 } from '../../../web/src/domain/generators/halfMarathon/v2/generate';
import { shorterOffer } from '../../../web/src/domain/generators/marathon/v2/shorter';
import { generatedPlan, storedPlan } from '../../../web/src/domain/generators/marathon/v2/app/plan';
import { MARATHON_V2_SOURCE_FORMAT, rawFacts } from '../../../web/src/domain/generators/marathon/v2/app/preparation';
import { addDays, commonChecks, distOf, sampleBases, type Plan } from '../final-check/lib';

declare const test: (name: string, fn: () => void, timeout?: number) => void;
const SC = ['pause35', 'pause20', 'painPause', 'test5k', 'slower', 'under50'] as const;
const HM = 21097.5;
type St = { weeks: { start: string; days: { dow: number; id?: string }[] }[]; meta?: Record<string, unknown> } & Record<string, unknown>;
const dated = (p: St) => p.weeks.flatMap((w) => w.days.map((d) => [addDays(w.start, d.dow), d.id] as const));
const cls = (s: string) => s.replace(/[0-9]+([.,][0-9]+)?/g, '#').slice(0, 90);
const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

test('3e tok kroz pravi kod', () => {
  const mar = distOf('MAR');
  const { bases } = sampleBases(mar, { R: 193, F: 97, B: 29 });
  const t0 = Date.now();
  const target = () => ({ choices: 0, ok: 0, duplicateDates: 0, duplicateIds: 0, pastIdMismatch: 0, idMismatch: 0, leakPlanKey: 0, leakMeta: 0, wrongGenerator: 0, rejected: {} as Record<string, number>, common: {} as Record<string, number> });
  const out = {
    plans: 0, flows: 0, offers: 0, offersFeel: 0,
    decisions: { v1: {} as Record<string, number>, hmV2: {} as Record<string, number> },
    unavailable: { v1: {} as Record<string, number>, hmV2: {} as Record<string, number> },
    feelV1Unavailable: 0, feelV1Available: 0,
    /** Plan po osećaju čiji je korak adaptacije dao rezultat (test 5 km): `pb` = poslednji rezultat (P2). */
    feelWithStepResult: 0,
    'HM v1': target(), '10K v1': target(), 'HM v2': target(),
    /** HM v1 kroz `executionBasis` (bez pauze, obim čarobnjaka) — rezultat koraka adaptacije ulazi kao `pb`. */
    exec: { ok: 0, stepResultOk: 0, stepResultRejected: 0, rejected: {} as Record<string, number> },
    seconds: 0,
  };
  for (const b of bases) {
    const g = mar.generate(b.input);
    if (!g.ok) continue;
    out.plans++;
    const p = g.plan;
    const N = p.weeks.length;
    for (const at of [p.weeks[1]!.endDate, p.weeks[Math.floor(N / 2) - 1]!.endDate])
      for (const s of SC) {
        out.flows++;
        const facts = mar.facts(p, s, at);
        const r = mar.adapt(p, facts, at);
        if (!r.ok || !shorterOffer(r.plan as never, at)) continue;
        out.offers++;
        const inputResult = !!(r.plan.input as { recentResult?: unknown }).recentResult;
        const stepResult = !!(r.plan as { adaptation?: { steps: { result: unknown }[] } }).adaptation?.steps.some((x) => x.result);
        // Po osećaju = bez ijednog rezultata (ni u ulazu ni u koraku adaptacije).
        const feel = !inputResult && !stepResult;
        if (feel) out.offersFeel++;
        if (!inputResult && stepResult) out.feelWithStepResult++;
        const src = select.stampForStorage(storedPlan(generatedPlan(r.plan as never)) as never) as unknown as St;
        const idOf = new Map(dated(src));
        const log: Record<string, unknown> = {};
        for (const w of (facts['workouts'] as { date: string; km: number; durationSec: number; completed: boolean; rpe?: number }[] | undefined) ?? [])
          if (w.completed && idOf.get(w.date)) log[idOf.get(w.date)!] = { status: 'done', km: w.km, sec: w.durationSec, ...(w.rpe ? { rpe: w.rpe } : {}) };
        const ctx = { log, alts: {}, moves: {} };
        for (const [mode, flags] of [['v1', undefined], ['hmV2', { fiveKV2: false, hmV2: true }]] as const) {
          const prep = select.preparationForPlan(src as never, flags)!;
          const basis = prep.basisFromPlan(src as never, at as never)!;
          const d = prep.preparationDecision(src as never, at as never, basis, ctx as never, 'limited', undefined);
          inc(out.decisions[mode], d.options.map((o) => o.id).join(',') || '—');
          for (const u of d.unavailable) inc(out.unavailable[mode], cls(u));
          if (mode === 'v1' && feel) {
            if (d.unavailable.length === 2 && d.unavailable.every((u) => u.endsWith(V1_TARGET_NEEDS_RESULT))) out.feelV1Unavailable++;
            else out.feelV1Available++;
          }
          if (mode === 'v1') {
            // Potvrđeno izvršenje (start = sutra): poslednji rezultat do danas, i iz koraka adaptacije (P2).
            const ex = select.MARATHON_V2_GENERATOR.executionBasis(src as never, at as never, null as never, { weeklyKm: Number(p.input.currentWeeklyKm) });
            if ('error' in ex) inc(out.exec.rejected, cls(ex.error));
            else {
              const c = prep.buildPreparationChoice(src as never, at as never, ex, { kind: 'shorter', raceDistM: HM }, ctx as never);
              if ('error' in c) inc(out.exec.rejected, cls(c.error));
              else out.exec.ok++;
              if (!inputResult && stepResult) {
                if ('error' in c) out.exec.stepResultRejected++;
                else out.exec.stepResultOk++;
              }
            }
          }
          for (const dist of mode === 'v1' ? [HM, 10000] : [HM]) {
            const name = mode === 'hmV2' ? 'HM v2' : dist === HM ? 'HM v1' : '10K v1';
            const t = out[name];
            t.choices++;
            const c = prep.buildPreparationChoice(src as never, at as never, basis, { kind: 'shorter', raceDistM: dist }, ctx as never);
            if ('error' in c) {
              inc(t.rejected, cls(c.error));
              continue;
            }
            t.ok++;
            const res = select.stampForStorage(c.result) as unknown as St;
            const dd = dated(res);
            if (new Set(dd.map(([x]) => x)).size !== dd.length) t.duplicateDates++;
            if (new Set(dd.map(([, x]) => x)).size !== dd.length) t.duplicateIds++;
            if (dd.some(([x, id]) => x <= at && idOf.get(x) !== id)) t.pastIdMismatch++;
            if (dd.some(([x, id]) => idOf.has(x) && idOf.get(x) !== id)) t.idMismatch++;
            if (MARATHON_V2_SOURCE_FORMAT.planKey in res) t.leakPlanKey++;
            // v1 cilj: meta v2 izvora ne sme ostati (vrednost jednaka izvoru). HM v2 cilj piše sopstvene `vdot`/`paceBasis`
            // (isto ime), pa se broje samo ključevi koje piše SAMO maraton v2.
            const own = name === 'HM v2' ? MARATHON_V2_SOURCE_FORMAT.metaKeys.filter((k) => !['vdot', 'paceBasis', 'goalVdot', 'goalAssessment'].includes(k)) : MARATHON_V2_SOURCE_FORMAT.metaKeys;
            if (own.some((k) => res.meta?.[k] !== undefined && (name === 'HM v2' || JSON.stringify(res.meta[k]) === JSON.stringify(src.meta?.[k])))) t.leakMeta++;
            const gen = select.generatorForPlan(res as never);
            const want = name === 'HM v2' ? select.HALF_MARATHON_V2_GENERATOR : name === 'HM v1' ? select.HALF_MARATHON_GENERATOR : select.TEN_K_GENERATOR;
            if (gen !== want) t.wrongGenerator++;
            if (name === 'HM v2') {
              const hm = res['hmV2'] as Plan;
              const before = generateHmV2(hm.input);
              const raw = rawFacts(src as never, at, ctx as never);
              if (before.ok) for (const v of commonChecks(before.plan as unknown as Plan, hm, at, raw)) inc(t.common, v);
            }
          }
        }
      }
  }
  out.seconds = (Date.now() - t0) / 1000;
  writeFileSync(new URL('./marathonSource.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
}, 3_600_000);
