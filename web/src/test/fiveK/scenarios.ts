/* 5K SCENARIJI ZA POREĐENJE PRE/POSLE IZDVAJANJA.

   Ulazi (ništa nije izmišljeno iz tekstualnih izveštaja):
   - `fingerprint`: 5K deo matrice golden master-a (`generatorScenarios.ts`, 576 ulaza);
   - `qa`: originalni 5K ulazi iz docs/qa/{generator-final,generator-ab,generator-phase1,generator-phase2}/inputs.json;
   - `seeded`: deterministički slučajni 5K ulazi (mulberry32, seme 5005) sa poljima koja matrica ne pokriva
     (dani u nedelji, raspored, istorija, run/walk lestvica, spremnost, zastareo rezultat);
   - `edge`: granične i neispravne vrednosti (greške moraju biti iste).
   Adaptacija: QA događaji U01 (jedan propušten), U02 (podizvršenje 0,55 dve nedelje), U03 (dva laka sa RPE 8) i
   zaštitni izazov iz U02-probe.mjs (budući odrađen dan, ručna sesija, ručna izmena, merom zaključan red, pomeranja),
   primenjeni na više baznih planova i datuma. „Danas" je uvek argument; sat se ne čita. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scenariji } from '@/test/generatorScenarios';
import type { GeneratorApi } from './legacyApi';

type Input = Record<string, unknown>;
export interface GenerationCase {
  name: string;
  input: Input;
}

const clone = <T>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T));
const DOCS = fileURLToPath(new URL('../../../../docs/qa/', import.meta.url));

function addIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function qaInputs(raceDistM = 5000): GenerationCase[] {
  const out: GenerationCase[] = [];
  const seen = new Set<string>();
  for (const dir of ['generator-final', 'generator-ab', 'generator-phase1', 'generator-phase2']) {
    const rows = JSON.parse(readFileSync(`${DOCS}${dir}/inputs.json`, 'utf8')) as Array<
      Record<string, unknown>
    >;
    for (const row of rows) {
      const input = row['input'] as Input | undefined;
      if (!input || input['raceDistM'] !== raceDistM) continue;
      const key = JSON.stringify(input);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: `qa · ${dir} · ${String(row['id'] ?? row['scenario'])}`, input });
    }
  }
  return out;
}

export function seededInputs(count = 400, raceDistM = 5000, seed = 5005): GenerationCase[] {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
  const int = (lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
  const out: GenerationCase[] = [];
  for (let i = 0; i < count; i++) {
    const startDate = addIso('2026-01-05', int(0, 400));
    const weeks = int(0, 30);
    const raceDate = addIso(startDate, weeks * 7 + int(-3, 6));
    const pbDist = pick([5000, 5000, 5000, 10000, 21097.5, 3000]);
    const pbBase: Record<number, [number, number]> = {
      3000: [600, 1300],
      5000: [960, 2400],
      10000: [2000, 5000],
      21097.5: [4500, 10500]
    };
    const [lo, hi] = pbBase[pbDist] as [number, number];
    const pbSec = int(lo, hi);
    const runDays = int(2, 7);
    const input: Input = {
      startDate,
      raceDate,
      raceDistM,
      pb: {
        distM: pbDist,
        sec: pbSec,
        ...(r() < 0.5 ? { date: addIso(startDate, -int(0, 200)) } : {})
      },
      weeklyKm: r() < 0.25 ? Math.round(r() * 1200) / 10 : int(3, 90),
      runDays,
      quality: int(1, 2),
      intensity: pick(['kons', 'std', 'agr']),
      trainedRecently: r() < 0.7
    };
    if (r() < 0.6) input['volIntensity'] = pick(['kons', 'std', 'agr']);
    if (r() < 0.4) input['goalSec'] = Math.round(pbSec * (0.85 + r() * 0.25));
    if (r() < 0.4) input['recentLongRunKm'] = int(1, 25);
    if (r() < 0.4) input['consistentWeeks'] = int(0, 40);
    if (r() < 0.25) input['breakWeeks'] = int(0, 20);
    if (r() < 0.4) input['qualityExperience'] = pick(['none', 'some', 'regular']);
    if (r() < 0.5) input['lrDow'] = int(1, 7);
    if (r() < 0.3) input['qDows'] = [int(1, 7), int(1, 7)].slice(0, int(1, 2));
    if (r() < 0.3) {
      const days = [1, 2, 3, 4, 5, 6, 7].filter(() => r() < runDays / 7);
      input['runDows'] = days;
    }
    if (r() < 0.15) input['runWalkLadder'] = [1, 1, 2, 3, 4, 4, 5, 6].slice(0, int(1, 8));
    if (r() < 0.15)
      input['currentReadiness'] = {
        reason: pick(['returning', 'fatigued', 'reduced-volume']),
        until: addIso(startDate, int(1, 21))
      };
    out.push({ name: raceDistM === 5000 ? `seeded · ${i}` : `seeded ${raceDistM} · ${i}`, input });
  }
  return out;
}

export function edgeInputs(): GenerationCase[] {
  const base: Input = {
    startDate: '2026-10-14',
    raceDate: '2026-12-20',
    raceDistM: 5000,
    pb: { distM: 5000, sec: 1500 },
    weeklyKm: 25,
    runDays: 4,
    quality: 2,
    intensity: 'std',
    trainedRecently: true
  };
  const v = (name: string, patch: Input): GenerationCase => ({
    name: `edge · ${name}`,
    input: { ...clone(base), ...patch }
  });
  const out: GenerationCase[] = [];
  for (let d = 0; d <= 13; d++)
    out.push(v(`trka +${d} dana`, { raceDate: addIso('2026-10-14', d) }));
  for (let wd = 0; wd < 7; wd++)
    out.push(
      v(`početak dan ${wd}`, {
        startDate: addIso('2026-10-12', wd),
        raceDate: addIso('2026-12-13', wd)
      })
    );
  for (const km of [0, 0.5, 1, 3, 5, 9.9, 150, 199, 200, 250, 1000])
    out.push(v(`km ${km}`, { weeklyKm: km }));
  for (const rd of [0, 1, 2, 7, 8, 3.5, Number.NaN])
    out.push(v(`dani ${String(rd)}`, { runDays: rd }));
  for (const q of [0, 1, 2, 3]) out.push(v(`kvalitet ${q}`, { quality: q }));
  out.push(v('trka pre početka', { raceDate: '2026-10-13' }));
  out.push(v('trka za 2+ godine', { raceDate: '2029-01-01' }));
  out.push(v('neispravan datum', { raceDate: '2026-02-31' }));
  out.push(v('neispravan početak', { startDate: 'x' }));
  out.push(v('bez distance', { raceDistM: undefined }));
  out.push(v('distanca 0', { raceDistM: 0 }));
  out.push(v('pb 0', { pb: { distM: 5000, sec: 0 } }));
  out.push(v('pb 10K', { pb: { distM: 10000, sec: 2900 } }));
  out.push(v('pb maraton', { pb: { distM: 42195, sec: 14000 } }));
  out.push(v('zastareo pb', { pb: { distM: 5000, sec: 1500, date: '2025-01-01' } }));
  out.push(v('cilj brži', { goalSec: 1300 }));
  out.push(v('cilj sporiji', { goalSec: 1700 }));
  out.push(v('početnik', { trainedRecently: false, weeklyKm: 8, runDays: 3 }));
  out.push(v('početnik visok obim', { trainedRecently: false, weeklyKm: 60, runDays: 5 }));
  out.push(v('povratak', { breakWeeks: 6, consistentWeeks: 20 }));
  out.push(v('povratak dug', { breakWeeks: 30 }));
  out.push(v('iskusan', { qualityExperience: 'regular', consistentWeeks: 52, weeklyKm: 70 }));
  out.push(v('bez iskustva', { qualityExperience: 'none', consistentWeeks: 2 }));
  out.push(v('raspored', { runDows: [2, 4, 6, 7], lrDow: 6, qDows: [2, 4] }));
  out.push(v('raspored sukob', { runDows: [1, 2], lrDow: 1, qDows: [1, 2], runDays: 2 }));
  out.push(v('lestvica', { trainedRecently: false, runWalkLadder: [1, 1, 2, 2, 3] }));
  out.push(v('lestvica neispravna', { trainedRecently: false, runWalkLadder: [0, 9] }));
  out.push(v('umoran', { currentReadiness: { reason: 'fatigued', until: '2026-10-25' } }));
  out.push(
    v('povratna spremnost', {
      currentReadiness: { reason: 'returning', until: '2026-11-02' },
      breakWeeks: 3
    })
  );
  out.push(v('_noSuggest', { weeklyKm: 80, runDays: 3, _noSuggest: true }));
  out.push(v('volIntensity agr', { volIntensity: 'agr', intensity: 'kons' }));
  out.push(v('dužina veća od obima', { recentLongRunKm: 40 }));
  return out;
}

export function generationCases(): GenerationCase[] {
  const fp = scenariji()
    .filter((s) => s.inp['raceDistM'] === 5000)
    .map((s) => ({ name: `fingerprint · ${s.ime}`, input: s.inp }));
  return [...fp, ...qaInputs(), ...seededInputs(), ...edgeInputs()];
}

/* ------------------------------------------------------------------ adaptacija */

type Api = GeneratorApi;
type Stored = NonNullable<ReturnType<Api['adaptGeneratedPlan']>>;
type Ctx = {
  log: Record<string, Record<string, unknown>>;
  alts: Record<string, Record<string, unknown>>;
  moves: Record<string, string>;
  pred: Record<string, unknown>;
  predLock: Record<string, unknown>;
};

export function attempt(fn: () => unknown): unknown {
  try {
    return fn();
  } catch (e) {
    return { thrown: e instanceof Error ? e.message : String(e) };
  }
}

/** Bazni planovi za adaptaciju: originalni QA ulazi + raznovrsni deterministički. */
export function adaptationBases(): GenerationCase[] {
  const qa = qaInputs();
  const seeded = seededInputs(400).filter((_, i) => i % 23 === 0);
  const edge = edgeInputs().filter((c) =>
    /početnik$|povratak$|iskusan|raspored$|lestvica$|zastareo|umoran|početak dan 2|početak dan 6/.test(
      c.name
    )
  );
  return [...qa, ...seeded, ...edge];
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

/** Ručna izmena polja sesije (zaključavanje) na budućem kvalitetu — ista ideja kao U02 `g9d3`. */
function withManualSession(api: Api, plan: Stored, today: string): Stored {
  const p = clone(plan);
  const view = api.resolvePlan(p.weeks, { alts: {}, moves: {} });
  const target = view.dated.filter((d) => d.date > today && d.session).at(1);
  if (!target) return p;
  for (const w of p.weeks)
    for (const d of w.days)
      if (d.id === target.id && d.session) {
        d.session.wuKm = Math.round((d.session.wuKm + 0.7) * 10) / 10;
        d.session.overrides = { ...d.session.overrides, wuKm: true };
        d.km = api.sessKm(d.session);
        d.desc = api.sessDesc(d.session);
      }
  return p;
}

export interface FlowResult {
  name: string;
  value: unknown;
  /** Ulazi posle poziva su isti kao pre (čista funkcija). */
  pure: boolean;
}

export function adaptationFlows(
  api: Api,
  limitBases?: number,
  bases: GenerationCase[] = adaptationBases()
): FlowResult[] {
  const out: FlowResult[] = [];
  const record = (name: string, args: unknown[], fn: () => unknown): void => {
    const before = JSON.stringify(args);
    const value = attempt(fn);
    out.push({ name, value, pure: JSON.stringify(args) === before });
  };
  for (const base of bases.slice(0, limitBases)) {
    const input = clone(base.input);
    const gen = api.generatePlan(clone(input) as never);
    if ('error' in gen) {
      out.push({ name: `${base.name} · generisanje`, value: gen, pure: true });
      continue;
    }
    const stored0 = api.adaptGeneratedPlan(gen);
    if (!stored0) continue;
    const stored = { ...stored0, ulaz: clone(input) } as Stored;
    out.push({ name: `${base.name} · adapter`, value: stored, pure: true });
    const start = stored.meta!.start;
    const raceDate = String(input['raceDate']);
    const span = Math.max(1, Math.round((Date.parse(raceDate) - Date.parse(start)) / 86400000));
    const todays = [
      ...new Set([addIso(start, 9), addIso(start, Math.round(span * 0.55)), addIso(raceDate, -20)])
    ];
    for (const today of todays) {
      const contexts = buildContexts(api, stored, today);
      const manual = withManualSession(api, stored, today);
      for (const [cname, ctx] of Object.entries(contexts)) {
        const plan = cname === 'prot' ? manual : stored;
        const tag = `${base.name} · ${today} · ${cname}`;
        const resolved = api.resolvePlan(plan.weeks, { alts: ctx.alts as never, moves: ctx.moves });
        const model = attempt(() =>
          api.executionModel(resolved, today, ctx as never, cname === 'gap' ? { km: 6 } : undefined)
        );
        out.push({ name: `${tag} · executionModel`, value: model, pure: true });
        const analysis = (model as { analysis?: unknown }).analysis;
        if (analysis) {
          for (const [oname, opts] of Object.entries({
            reduce: {},
            pause10: { breakDays: 10, weeklyKm: 20 },
            pause21: { breakDays: 21, weeklyKm: 30, recentLongRunKm: 9 },
            pause40: { breakDays: 40, weeklyKm: 12 },
            lower: { weeklyKm: 9, recentLongRunKm: 4 }
          }))
            record(`${tag} · execution ${oname}`, [plan, ctx, opts], () =>
              api.buildExecutionAdjustment(
                plan,
                today as never,
                analysis as never,
                opts,
                ctx as never
              )
            );
          record(`${tag} · qualityGate`, [analysis], () => ({
            gate: api.qualityEntryGate({
              analysis: analysis as never,
              recentPainMax: cname === 'high' ? 5 : null,
              formConfirmed: cname === 'done'
            }),
            recent: api.hasRecentMeasuredForm(today, { t3k: [], vdotLog: [] })
          }));
        }
        const goal = Number(stored.meta!.predictedSec) || 1500;
        record(`${tag} · goal faster`, [plan, ctx], () =>
          api.planWithNewGoal(plan, Math.round(goal * 0.95), today as never, ctx as never)
        );
        record(`${tag} · goal slower`, [plan, ctx], () =>
          api.planWithNewGoal(plan, Math.round(goal * 1.06), today as never, ctx as never)
        );
        const vdot0 = Number(stored.meta!.vdot0) || 40;
        for (const delta of [-2.5, 3])
          record(`${tag} · recalibrated ${delta}`, [plan, ctx], () =>
            api.planRecalibrated(plan, vdot0 + delta, today as never, ctx as never)
          );
        const changed = attempt(() =>
          api.planWithNewGoal(plan, Math.round(goal * 0.95), today as never, ctx as never)
        ) as Stored & { error?: string };
        if (changed && !('error' in changed && changed.error) && !('thrown' in changed)) {
          record(`${tag} · restore`, [changed, plan, ctx], () =>
            api.graftFuturePlan(changed, plan, today as never, ctx as never)
          );
          record(`${tag} · alignAutomatic`, [plan, changed, ctx], () =>
            api.alignAutomaticOverlays(plan, changed, today, ctx as never)
          );
        }
        const rw = attempt(() =>
          api.assessRunWalkProgress({
            plan: resolved,
            log: ctx.log,
            today,
            recentPainMax: cname === 'high' ? 3 : null
          })
        );
        out.push({ name: `${tag} · runWalkProgress`, value: rw, pure: true });
        if ((rw as { rung?: unknown }).rung != null)
          for (const mode of ['hold', 'step-back', 'repeat-phase'] as const)
            record(`${tag} · runWalk ${mode}`, [plan, ctx], () =>
              api.buildRunWalkAdjustment(
                plan,
                today as never,
                rw as never,
                { mode, extraWeeks: 2 },
                ctx as never
              )
            );
        if (cname === 'done' || cname === 'prot') {
          for (const shift of [-4, 4]) {
            const tests = [0, 1, 2].map((i) => {
              const s = Math.round(720 * (1 - shift / 100) + i * 3);
              return {
                id: `t3k-${addIso(today, -3 - i * 9)}-x${i}`,
                date: addIso(today, -3 - i * 9),
                sec: s
              };
            });
            const chain = tests.map((t) => ({
              id: t.id,
              ts: t.date,
              measured: api.t3kVdot(t.sec),
              vdot: api.t3kVdot(t.sec),
              prev: null,
              delta: null
            }));
            const pctx = {
              today,
              plan: resolved,
              pred: plan.pred,
              meta: plan.meta,
              log: ctx.log,
              alts: ctx.alts,
              vdotChain: chain,
              tests,
              enteredPaces: ctx.pred,
              predLock: ctx.predLock,
              positiveAdjustmentAllowed: shift > 0
            };
            record(`${tag} · evidence ${shift}`, [pctx], () => api.fitnessEvidence(pctx as never));
            record(`${tag} · planVdotNow ${shift}`, [pctx], () => api.planVdotNow(pctx as never));
            const proposal = attempt(() => api.vdotProposal(pctx as never));
            out.push({ name: `${tag} · proposal ${shift}`, value: proposal, pure: true });
            if (proposal && typeof proposal === 'object' && !('thrown' in proposal)) {
              const applied = attempt(() =>
                api.applyVdotProposal(proposal as never, resolved, ctx.log, ctx.alts as never, plan)
              ) as { alts?: Record<string, unknown>; genPlan?: Stored };
              out.push({ name: `${tag} · apply ${shift}`, value: applied, pure: true });
              if (applied.alts && applied.genPlan) {
                const after = api.resolvePlan(applied.genPlan.weeks, {
                  alts: applied.alts as never,
                  moves: ctx.moves
                });
                record(`${tag} · undo ${shift}`, [applied], () =>
                  api.undoVdotAdjustments(after, applied.alts as never, applied.genPlan!)
                );
              }
            }
          }
        }
      }
      const idx = Math.max(
        1,
        stored.weeks.findIndex((w) => w.start <= today && today < addIso(w.start, 7)) + 1
      );
      record(`${base.name} · ${today} · recalibratedPlan`, [input, stored], () =>
        api.recalibratedPlan(input as never, idx, Number(stored.meta!.vdot0) + 1.5, {
          oldWeeks: manualWeeks(api, stored, today)
        })
      );
      record(`${base.name} · ${today} · recalibratedPlan bare`, [input], () =>
        api.recalibratedPlan(input as never, idx, Number(stored.meta!.vdot0) - 1)
      );
      record(`${base.name} · ${today} · reentryPlan`, [input], () =>
        api.reentryPlan(input as never, idx, 14, Number(stored.meta!.vdot0) - 2)
      );
    }
  }
  return out;
}

function manualWeeks(api: Api, stored: Stored, today: string): Stored['weeks'] {
  return withManualSession(api, stored, today).weeks;
}
