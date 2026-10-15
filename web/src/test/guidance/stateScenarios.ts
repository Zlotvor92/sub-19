/* STANJE TRKAČA (bol, opterećenje, prekid, spremnost) — tokovi za prenos u generatore.

   Pre prenosa ovo je bila jedna aplikaciona implementacija za sve distance (`domain/recovery/{pain,load,view,constants}`
   i `features/recovery/readiness.ts`). Referenca se uzima iz tog koda pre prenosa; posle prenosa svaka od četiri kopije
   u generatorima mora dati isti zapis. „Danas" je uvek argument. */
import { resolvePlan, type ResolvedPlan } from '@/domain/plan';
import type { LogEntry, PainRecord, WellnessRecord } from '@/domain/state';
import { attempt, type FlowResult } from '@/test/fiveK/scenarios';
import { guidancePlans } from './scenarios';

export interface StateApi {
  painStatus: (pain: never, today: never) => unknown;
  returnToRunPhase: (pain: never, today: never) => unknown;
  acwrNow: (ctx: never, today: never) => unknown;
  acwrPlan: (ctx: never, today: never) => unknown;
  acuteKm: (ctx: never, today: never) => unknown;
  chronicKm: (ctx: never, today: never) => unknown;
  breakInfo: (ctx: never, today: never) => unknown;
  completion: (...a: never[]) => unknown;
  daysWithoutRunning: (ctx: never, today: never) => unknown;
  largestWeeklyKm: (ctx: never, today: never) => unknown;
  plannedKm7: (ctx: never, today: never) => unknown;
  readinessModel: (input: never) => unknown;
  loadMeaning: (band: never) => unknown;
  wellnessSignals: (w: never, today: never, includeStale?: boolean) => unknown;
  acwrBand: (r: number) => unknown;
  acwrText: (r: number | null | undefined) => unknown;
  acwrPosition: (r: number) => unknown;
}

function addIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function doneLog(plan: ResolvedPlan, until: string, factor = 1): Record<string, LogEntry> {
  const log: Record<string, LogEntry> = {};
  for (const d of plan.dated)
    if (d.date < until && !d.rest && (d.km ?? 0) > 0 && d.tag !== 'snaga')
      log[d.id] = { status: 'done', km: (d.km ?? 0) * factor, runDate: d.date, rpe: 4 };
  return log;
}

function wellness(today: string, kind: string): Record<string, WellnessRecord> {
  const out: Record<string, WellnessRecord> = {};
  if (kind === 'nema') return out;
  for (let i = 10; i >= (kind === 'staro' ? 3 : 0); i--) {
    const datum = addIso(today, -i);
    const last = i === 0;
    out[datum] = {
      datum,
      hrv: last && kind === 'los' ? 40 : 62 + (i % 3),
      pulsUMiru: last && kind === 'los' ? 61 : 50 + (i % 2),
      sanH: last && kind === 'los' ? 5.2 : 7.6,
      sanOcena: 3,
      tezina: 70,
      ctl: 40,
      atl: last && kind === 'los' ? 60 : 42,
      svezina: last && kind === 'los' ? -18 : 2
    };
  }
  return out;
}

export function stateFlows(api: StateApi): FlowResult[] {
  const out: FlowResult[] = [];
  const push = (name: string, fn: () => unknown): void => {
    out.push({ name, value: attempt(fn), pure: true });
  };
  for (const { name, plan: stored } of guidancePlans()) {
    const plan = resolvePlan(stored.weeks, { alts: {}, moves: {} });
    const first = plan.dated[0]?.date;
    const last = plan.dated.at(-1)?.date;
    if (!first || !last) continue;
    for (const today of [addIso(first, 3), addIso(first, 30), addIso(last, -9), addIso(last, 1)]) {
      const pains: Record<string, PainRecord[]> = {
        bez: [],
        blag: [{ date: addIso(today, -1), pain: 3, part: 'koleno-L' }],
        stani: [{ date: today, pain: 7, part: 'stopalo-D' }],
        fizijatar: [0, 2, 4].map((d) => ({ date: addIso(today, -d), pain: 4, part: 'list-L' })),
        povratak: [
          { date: addIso(today, -30), pain: 8, part: 'koleno-D' },
          { date: addIso(today, -12), pain: 2, part: 'koleno-D' }
        ],
        gornji: [{ date: today, pain: 6, part: 'rame-L' }]
      };
      for (const [pn, pain] of Object.entries(pains)) {
        push(`${name} · ${today} · bol ${pn} · status`, () =>
          api.painStatus(pain as never, today as never)
        );
        push(`${name} · ${today} · bol ${pn} · povratak`, () =>
          api.returnToRunPhase(pain as never, today as never)
        );
      }
      for (const [ln, log] of Object.entries({
        redovno: doneLog(plan, today),
        vise: doneLog(plan, today, 1.6),
        pauza: doneLog(plan, addIso(today, -15)),
        nista: {}
      }))
        for (const outOfPlan of [{}, { [addIso(first, -5)]: 14, [addIso(first, -12)]: 9 }]) {
          const ctx = { plan, log, outOfPlan };
          const t = `${name} · ${today} · ${ln} · van ${Object.keys(outOfPlan).length}`;
          push(`${t} · akutno`, () => api.acuteKm(ctx as never, today as never));
          push(`${t} · hronično`, () => api.chronicKm(ctx as never, today as never));
          push(`${t} · acwr`, () => api.acwrNow(ctx as never, today as never));
          push(`${t} · acwr plan`, () => api.acwrPlan(ctx as never, today as never));
          push(`${t} · prekid`, () => api.breakInfo(ctx as never, today as never));
          push(`${t} · bez trčanja`, () => api.daysWithoutRunning(ctx as never, today as never));
          push(`${t} · najveća nedelja`, () => api.largestWeeklyKm(ctx as never, today as never));
          push(`${t} · plan 7`, () => api.plannedKm7(ctx as never, today as never));
          for (const win of [7, 28])
            push(`${t} · ostvarenost ${win}`, () =>
              (api.completion as (...a: unknown[]) => unknown)(ctx, today, win)
            );
          const load = attempt(() => api.acwrNow(ctx as never, today as never));
          for (const [pn, pain] of Object.entries({ bez: pains['bez'], stani: pains['stani'] }))
            for (const wk of ['nema', 'dobro', 'los', 'staro']) {
              const status = attempt(() => api.painStatus(pain as never, today as never));
              push(`${t} · spremnost ${pn} ${wk}`, () =>
                api.readinessModel({ status, load, wellness: wellness(today, wk), today } as never)
              );
            }
        }
      for (const wk of ['nema', 'dobro', 'los', 'staro'])
        for (const stale of [false, true])
          push(`${name} · ${today} · jutro ${wk} ${String(stale)}`, () =>
            api.wellnessSignals(wellness(today, wk) as never, today as never, stale)
          );
    }
  }
  for (const b of ['low', 'ok', 'high', 'danger'])
    push(`značenje ${b}`, () => api.loadMeaning(b as never));
  for (let r = 0; r <= 2.6; r += 0.05) {
    const v = Math.round(r * 100) / 100;
    push(`pojas ${v}`, () => api.acwrBand(v));
    push(`tekst ${v}`, () => api.acwrText(v));
    push(`položaj ${v}`, () => api.acwrPosition(v));
  }
  push('tekst null', () => api.acwrText(null));
  return out;
}
