/* UGRAĐENI LIČNI PLAN (`genPlan === null`, polumaraton) — tokovi za poređenje starog mehanizma i HM generatora.

   Do segmenta 5 aplikacija je za lični plan birala stari mehanizam (`generatorForPlan(null)`), jer se u store-u čuva
   `genPlan === null`. Segment 5 bira generator po AKTIVNOM planu (`activeGenPlan()`, distanca 21097,5 → HM). Ovi tokovi
   pokrivaju sve pozive koje produkcija nad ličnim planom može da napravi (model izvršenja, run/walk, kapija kvaliteta,
   dokaz forme, predlog/primena/poništavanje tempa, uparivanje redova) i, radi šire provere, pozive koje produkcija nad
   njim NE pravi (prilagođavanje, promena cilja, rekalibracija, vraćanje verzije, poravnanje — zahtevaju pravi `genPlan`).
   Ulazi: sam ugrađeni plan (`domain/personal`) sa više polaznih formi, datumi od pre početka do posle trke, isti
   konteksti dnevnika kao za 5K (U01 propušten, U02 podizvršenje, U03 RPE 8, pauza, zaštita). „Danas" je uvek argument. */
import { PERSONAL_RACE, PERSONAL_START } from '@/data/personalPlan';
import { personalBaselineVdot, personalPlan } from '@/domain/personal';
import type { GenPlanState } from '@/domain/state';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import { attempt, buildContexts, type FlowResult } from '@/test/fiveK/scenarios';

type Api = GeneratorApi;

function addIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Polazne forme: podrazumevana (PB 5K vlasnika, bez upisane polazne trke) i nekoliko upisanih. */
export const PERSONAL_BASELINES: readonly number[] = [personalBaselineVdot({}), 44, 49.5, 53];

export function personalTodays(): string[] {
  const out: string[] = [];
  for (let d = addIso(PERSONAL_START, -3); d <= addIso(PERSONAL_RACE, 3); d = addIso(d, 6))
    out.push(d);
  out.push(addIso(PERSONAL_RACE, -1), PERSONAL_RACE);
  return [...new Set(out)];
}

export function personalFlows(api: Api, limitTodays?: number): FlowResult[] {
  const out: FlowResult[] = [];
  const record = (name: string, args: unknown[], fn: () => unknown): void => {
    const before = JSON.stringify(args);
    const value = attempt(fn);
    out.push({ name, value, pure: JSON.stringify(args) === before });
  };
  /* Svi PRED redovi ugrađenog plana nose `nemeri: true`, pa predlog tempa nad njim nikad ne nastaje. Varijanta „merljiv"
     (sintetička, nije produkciono stanje) skida tu oznaku da bi i primena/poništavanje predloga bili upoređeni. */
  const variants: [string, number, GenPlanState][] = [
    ...PERSONAL_BASELINES.map((v): [string, number, GenPlanState] => [
      String(v),
      v,
      personalPlan(v)
    ]),
    ...[44, 53].map((v): [string, number, GenPlanState] => {
      const p = JSON.parse(JSON.stringify(personalPlan(v))) as GenPlanState;
      for (const r of p.pred) delete (r as { nemeri?: unknown }).nemeri;
      return [`${v} merljiv`, v, p];
    })
  ];
  for (const [label, vdot0, plan] of variants) {
    const stored = plan as never;
    const rows = plan.pred.filter((r) => typeof r.id === 'string');
    for (const today of personalTodays().slice(0, limitTodays)) {
      const contexts = buildContexts(api, stored, today);
      for (const [cname, ctx] of Object.entries(contexts)) {
        const tag = `lični ${label} · ${today} · ${cname}`;
        const resolved = api.resolvePlan(plan.weeks, {
          alts: ctx.alts as never,
          moves: ctx.moves
        });
        out.push({ name: `${tag} · resolve`, value: resolved, pure: true });
        const model = attempt(() =>
          api.executionModel(resolved, today, ctx as never, cname === 'gap' ? { km: 6 } : undefined)
        );
        out.push({ name: `${tag} · executionModel`, value: model, pure: true });
        const analysis = (model as { analysis?: unknown }).analysis;
        const rw = attempt(() =>
          api.assessRunWalkProgress({
            plan: resolved,
            log: ctx.log,
            today,
            recentPainMax: cname === 'high' ? 3 : null
          })
        );
        out.push({ name: `${tag} · runWalkProgress`, value: rw, pure: true });
        record(`${tag} · matchPlanRows`, [resolved, rows], () =>
          api.matchPlanRows(resolved.weeks, rows as never)
        );
        // Pozivi koje produkcija nad ličnim planom ne pravi (traže pravi `genPlan`): šira provera istog koda.
        if (analysis) {
          record(`${tag} · qualityGate`, [analysis], () =>
            api.qualityEntryGate({
              analysis: analysis as never,
              recentPainMax: cname === 'high' ? 5 : null,
              formConfirmed: cname === 'done'
            })
          );
          record(`${tag} · execution reduce`, [plan, ctx], () =>
            api.buildExecutionAdjustment(
              stored,
              today as never,
              analysis as never,
              {},
              ctx as never
            )
          );
        }
        record(`${tag} · goal`, [plan, ctx], () =>
          api.planWithNewGoal(stored, 5600, today as never, ctx as never)
        );
        record(`${tag} · recalibrated`, [plan, ctx], () =>
          api.planRecalibrated(stored, vdot0 + 1, today as never, ctx as never)
        );
        record(`${tag} · restore`, [plan, ctx], () =>
          api.graftFuturePlan(stored, stored, today as never, ctx as never)
        );
        record(`${tag} · alignAutomatic`, [plan, ctx], () =>
          api.alignAutomaticOverlays(null, stored, today, ctx as never)
        );
        if (cname !== 'done' && cname !== 'prot' && cname !== 'none') continue;
        for (const shift of [-4, 0, 4]) {
          const tests = [0, 1, 2].map((i) => ({
            id: `t3k-${addIso(today, -3 - i * 9)}-x${i}`,
            date: addIso(today, -3 - i * 9),
            sec: Math.round(690 * (1 - shift / 100) + i * 3)
          }));
          const chain = tests.map((t) => ({
            id: t.id,
            ts: t.date,
            measured: api.t3kVdot(t.sec),
            vdot: api.t3kVdot(t.sec),
            prev: null,
            delta: null
          }));
          record(`${tag} · recentForm ${shift}`, [tests, chain], () =>
            api.hasRecentMeasuredForm(today, { t3k: tests, vdotLog: chain })
          );
          for (const allowed of [true, false]) {
            const pctx = {
              today,
              plan: resolved,
              pred: rows,
              meta: plan.meta,
              log: ctx.log,
              alts: ctx.alts,
              vdotChain: chain,
              tests,
              enteredPaces: ctx.pred,
              predLock: ctx.predLock,
              positiveAdjustmentAllowed: allowed
            };
            const ptag = `${tag} · ${shift} · ${allowed ? 'dozvoljeno' : 'blokirano'}`;
            record(`${ptag} · evidence`, [pctx], () => api.fitnessEvidence(pctx as never));
            record(`${ptag} · planVdotNow`, [pctx], () => api.planVdotNow(pctx as never));
            const proposal = attempt(() => api.vdotProposal(pctx as never));
            out.push({ name: `${ptag} · proposal`, value: proposal, pure: true });
            if (!proposal || typeof proposal !== 'object' || 'thrown' in proposal) continue;
            // Kao u produkciji: lični plan nema `genPlan` u store-u (null).
            const applied = attempt(() =>
              api.applyVdotProposal(proposal as never, resolved, ctx.log, ctx.alts as never, null)
            ) as { alts?: Record<string, unknown> };
            out.push({ name: `${ptag} · apply`, value: applied, pure: true });
            if (!applied.alts) continue;
            const after = api.resolvePlan(plan.weeks, {
              alts: applied.alts as never,
              moves: ctx.moves
            });
            const eligible = Object.fromEntries(
              Object.entries(applied.alts).filter(
                ([, alt]) => (alt as { paceAuto?: unknown }).paceAuto
              )
            );
            record(`${ptag} · undo`, [after, eligible], () =>
              api.undoVdotAdjustments(after, eligible as never, null)
            );
          }
        }
      }
    }
  }
  return out;
}
