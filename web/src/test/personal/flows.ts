/* POMOĆNICI TOKOVA LIČNOG PLANA (V1b: izdvojeno iz `src/test/fiveK/scenarios.ts` pri brisanju 5K v1, bez izmene koda).
   Konteksti adaptacije (U01–U03, pauza, zaštita) nad planom i „danas" kao argument; sat se ne čita. */
import type { GeneratorApi } from './legacyApi';

type Ctx = {
  log: Record<string, Record<string, unknown>>;
  alts: Record<string, Record<string, unknown>>;
  moves: Record<string, string>;
  pred: Record<string, unknown>;
  predLock: Record<string, unknown>;
};
type Api = GeneratorApi;
type Stored = NonNullable<ReturnType<Api['adaptGeneratedPlan']>>;

const clone = <T>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T));

function addIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function attempt(fn: () => unknown): unknown {
  try {
    return fn();
  } catch (e) {
    return { thrown: e instanceof Error ? e.message : String(e) };
  }
}

export function buildContexts(api: Api, plan: Stored, today: string): Record<string, Ctx> {
  const empty = (): Ctx => ({ log: {}, alts: {}, moves: {}, pred: {}, predLock: {} });
  const view = api.resolvePlan(plan.weeks, { alts: {}, moves: {} });
  const runs = view.dated.filter(
    (d) => d.date <= today && !d.rest && (d.km ?? 0) > 0 && d.tag !== 'snaga'
  );
  const done = empty();
  for (const d of runs) done.log[d.id] = { status: 'done', km: d.km, runDate: d.date, rpe: 4 };
  // U01: jedan propušten trening (poslednji pre danas).
  const miss = clone(done);
  const lastRun = runs.at(-1);
  if (lastRun) delete miss.log[lastRun.id];
  // U02: dve nedelje na 55% propisanog.
  const under = empty();
  const lowFrom = addIso(today, -16);
  const lowTo = addIso(today, -3);
  for (const d of runs)
    under.log[d.id] = {
      status: 'done',
      km: (d.km ?? 0) * (d.date >= lowFrom && d.date <= lowTo ? 0.55 : 1),
      runDate: d.date,
      rpe: 4
    };
  // U03: poslednja dva laka sa RPE 8.
  const high = clone(done);
  for (const d of runs.filter((x) => x.tag === 'lako').slice(-2))
    high.log[d.id] = { ...high.log[d.id], rpe: 8 };
  // Pauza: ništa u poslednjih 12 dana.
  const gap = empty();
  for (const d of runs)
    if (d.date < addIso(today, -11))
      gap.log[d.id] = { status: 'done', km: d.km, runDate: d.date, rpe: 4 };
  // Zaštita (U02-probe): budući odrađen, ručna sesija, ručna izmena, merom zaključan red, pomeranja.
  const prot = clone(done);
  const future = view.dated.filter((d) => d.date > today && !d.rest && (d.km ?? 0) > 0);
  const futureDone = future.find((d) => d.tag === 'lako');
  if (futureDone)
    prot.log[futureDone.id] = { status: 'done', km: futureDone.km, runDate: today, rpe: 4 };
  const futureEasy = future.filter((d) => d.tag === 'lako');
  if (futureEasy[1])
    prot.alts[futureEasy[1].id] = { tag: 'lako', km: 4.2, desc: 'ručna buduća izmena 4,2 km' };
  const matched = api.matchPlanRows(view.weeks, plan.pred as never);
  const measuredDay = future.find((d) => d.session && matched.get(d.id));
  if (measuredDay) {
    const row = matched.get(measuredDay.id)!;
    prot.pred[row.id] = row.pt;
    prot.predLock[row.id] = true;
  }
  const movedBack = future.find((d) => d !== futureDone && d.tag === 'lr');
  if (movedBack) prot.moves[movedBack.id] = today;
  const pastEasy = runs.filter((d) => d.tag === 'lako').at(-1);
  if (pastEasy) prot.moves[pastEasy.id] = addIso(today, 4);
  return { none: empty(), done, miss, under, high, gap, prot };
}

export interface FlowResult {
  name: string;
  value: unknown;
  /** Ulazi posle poziva su isti kao pre (čista funkcija). */
  pure: boolean;
}
