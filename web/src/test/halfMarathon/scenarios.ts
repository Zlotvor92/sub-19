/* POLUMARATON — SCENARIJI ZA POREĐENJE PRE/POSLE IZDVAJANJA (segment 3/5).

   Ulazi (ništa nije izmišljeno iz tekstualnih izveštaja):
   - `fingerprint`: HM deo matrice golden master-a (`generatorScenarios.ts`, 576 ulaza; svi sa dva kvaliteta, bez iskustva);
   - `qa`: originalni HM ulazi iz docs/qa/{generator-final,generator-ab,generator-phase1,generator-phase2}/inputs.json;
   - `hmTrack`: matrica HM politike koju golden master ne dodiruje — staza (`developing` / `experienced`, tj. iskustvo sa
     kvalitetom + kontinuitet ≥ 8 ned.) × broj kvaliteta (1, 2) × dužina pripreme × dani trčanja × obim;
   - `seededHm`: deterministički slučajni HM ulazi (mulberry32, seme 21975) sa ISPRAVNIM vrednostima `qualityExperience`
     ('none' | 'some' | 'experienced') i kontinuitetom, da bi staza `performance` bila pokrivena;
   - `edgeHm`: granične i neispravne vrednosti, kratka priprema, povratak, umor, strategije ritma (< 80, 80–110, > 110 min).
   Adaptacija: isti tokovi kao za 5K/10K (`fiveK/scenarios.ts` → `adaptationFlows`) nad HM baznim planovima, plus
   taper/nedelja trke (danas = trka −12 i −5 dana), originalni HM QA događaji U07–U09 iz docs/qa/generator-ab/users/ i
   odluke o ograničenoj pripremi (produženje, kraća distanca — predaja 10K/5K —, povratni režim, odluka nad sačuvanim
   planom u povratnom režimu, odluka iz izvršenja). „Danas" je uvek argument; sat se ne čita.

   Test kod (harnes) se namerno deli sa 5K/10K testovima: zabrana deljenja važi za izvršni kod generatora, ne za proveru. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scenariji } from '@/test/generatorScenarios';
import {
  adaptationFlows,
  attempt,
  qaInputs,
  type FlowResult,
  type GenerationCase
} from '@/test/fiveK/scenarios';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';

type Input = Record<string, unknown>;
export const HM = 21097.5;
const clone = <T>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T));
const USERS = fileURLToPath(new URL('../../../../docs/qa/generator-ab/users/', import.meta.url));

/** Ugovor HM generatora koji test poziva: zajednički API + odluka o pripremi + osnova izvršenja. */
export interface HmApi extends GeneratorApi {
  executionBasis: (...a: never[]) => unknown;
  basisFromPlan: (current: never, today: never) => unknown;
  preparationDecision: (...a: never[]) => unknown;
  buildPreparationChoice: (...a: never[]) => unknown;
  isLimitedLongPreparation: (meta: never) => boolean;
}

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

const BASE: Input = {
  startDate: '2026-10-12',
  raceDate: '2027-02-14',
  raceDistM: HM,
  pb: { distM: HM, sec: 6300, date: '2026-09-20' },
  weeklyKm: 45,
  runDays: 4,
  quality: 2,
  intensity: 'std',
  trainedRecently: true
};

/** Staza × kvalitet × dužina × dani × obim — HM politika (prag/HM ritam, jedan/dva kvaliteta, taper, kontrolna trka). */
export function hmTrackMatrix(): GenerationCase[] {
  const out: GenerationCase[] = [];
  const tracks: Record<string, Input> = {
    first: { qualityExperience: 'some', consistentWeeks: 12 },
    perf: { qualityExperience: 'experienced', consistentWeeks: 26 }
  };
  for (const [track, patch] of Object.entries(tracks))
    for (const quality of [1, 2])
      for (const weeks of [4, 7, 10, 12, 14, 16, 20, 24])
        for (const runDays of [3, 4, 5, 6])
          for (const weeklyKm of [28, 42, 58, 75])
            out.push({
              name: `hmTrack · ${track} · q${quality} · ${weeks}n · ${runDays}d · ${weeklyKm}km`,
              input: {
                ...clone(BASE),
                ...clone(patch),
                quality,
                runDays,
                weeklyKm,
                recentLongRunKm: Math.round(weeklyKm * 0.3),
                raceDate: addIso('2026-10-12', weeks * 7 + 6)
              }
            });
  return out;
}

export function hmSeeded(count = 500): GenerationCase[] {
  const r = rng(21975);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
  const int = (lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
  const out: GenerationCase[] = [];
  for (let i = 0; i < count; i++) {
    const startDate = addIso('2026-01-05', int(0, 400));
    const weeks = int(1, 30);
    const raceDate = addIso(startDate, weeks * 7 + int(-3, 6));
    const pbDist = pick([HM, HM, HM, 10000, 5000, 42195]);
    const pbBase: Record<number, [number, number]> = {
      5000: [960, 2400],
      10000: [2000, 5000],
      21097.5: [4300, 10500],
      42195: [9000, 21000]
    };
    const [lo, hi] = pbBase[pbDist] as [number, number];
    const pbSec = int(lo, hi);
    const runDays = int(2, 7);
    const input: Input = {
      startDate,
      raceDate,
      raceDistM: HM,
      pb: {
        distM: pbDist,
        sec: pbSec,
        ...(r() < 0.6 ? { date: addIso(startDate, -int(0, 200)) } : {})
      },
      weeklyKm: r() < 0.2 ? Math.round(r() * 1300) / 10 : int(8, 110),
      runDays,
      quality: int(1, 2),
      intensity: pick(['kons', 'std', 'agr']),
      trainedRecently: r() < 0.8
    };
    if (r() < 0.6) input['volIntensity'] = pick(['kons', 'std', 'agr']);
    if (r() < 0.4) input['goalSec'] = Math.round(4300 + r() * 6000);
    if (r() < 0.6) input['recentLongRunKm'] = int(3, 30);
    if (r() < 0.7) input['consistentWeeks'] = int(0, 60);
    if (r() < 0.2) input['breakWeeks'] = int(0, 20);
    if (r() < 0.7)
      input['qualityExperience'] = pick(['none', 'some', 'experienced', 'experienced']);
    if (r() < 0.5) input['lrDow'] = int(1, 7);
    if (r() < 0.3) input['qDows'] = [int(1, 7), int(1, 7)].slice(0, int(1, 2));
    if (r() < 0.3) input['runDows'] = [1, 2, 3, 4, 5, 6, 7].filter(() => r() < runDays / 7);
    if (r() < 0.1) input['runWalkLadder'] = [1, 1, 2, 3, 4, 4, 5, 6].slice(0, int(1, 8));
    if (r() < 0.12)
      input['currentReadiness'] = {
        reason: pick(['returning', 'fatigued', 'reduced-volume']),
        until: addIso(startDate, int(1, 21))
      };
    out.push({ name: `seededHm · ${i}`, input });
  }
  return out;
}

export function hmEdgeInputs(): GenerationCase[] {
  const v = (name: string, patch: Input): GenerationCase => ({
    name: `edgeHm · ${name}`,
    input: { ...clone(BASE), ...patch }
  });
  const exp = { qualityExperience: 'experienced', consistentWeeks: 30 };
  const out: GenerationCase[] = [];
  for (let d = 0; d <= 13; d++)
    out.push(v(`trka +${d} dana`, { raceDate: addIso('2026-10-12', d) }));
  for (const w of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 30])
    for (const q of [1, 2]) {
      out.push(
        v(`trka za ${w} ned · q${q}`, { raceDate: addIso('2026-10-12', w * 7), quality: q })
      );
      out.push(
        v(`trka za ${w} ned · q${q} · iskusan`, {
          raceDate: addIso('2026-10-12', w * 7),
          quality: q,
          ...exp,
          weeklyKm: 60
        })
      );
    }
  for (let wd = 0; wd < 7; wd++)
    out.push(
      v(`početak dan ${wd}`, {
        startDate: addIso('2026-10-12', wd),
        raceDate: addIso('2027-02-14', wd)
      })
    );
  for (const km of [
    0, 0.5, 1, 3, 5, 9.9, 15, 20, 29, 30, 31, 44, 45, 46, 60, 80, 110, 160, 161, 250, 1000
  ])
    out.push(v(`km ${km}`, { weeklyKm: km }));
  for (const rd of [0, 1, 2, 3, 4, 5, 6, 7, 8, 3.5, Number.NaN])
    out.push(v(`dani ${String(rd)}`, { runDays: rd }));
  for (const q of [0, 1, 2, 3]) out.push(v(`kvalitet ${q}`, { quality: q }));
  for (const i of ['kons', 'std', 'agr'])
    for (const vi of ['kons', 'std', 'agr'])
      out.push(v(`intenzitet ${i}/${vi}`, { intensity: i, volIntensity: vi }));
  // Kontinuitet i iskustvo: kvalitet (qualityExperience) i trajanje (consistentWeeks) su odvojeni ulazi.
  for (const qe of [undefined, 'none', 'some', 'experienced'])
    for (const cw of [undefined, 0, 3, 7, 8, 20, 52])
      out.push(
        v(`iskustvo ${String(qe)} · kontinuitet ${String(cw)}`, {
          ...(qe ? { qualityExperience: qe } : {}),
          ...(cw !== undefined ? { consistentWeeks: cw } : {})
        })
      );
  // Strategija ritma po vremenu trke (< 80, 80–110, > 110 min) i iskustvo.
  for (const sec of [4300, 4790, 4810, 5400, 6590, 6610, 8000, 10000])
    for (const e of [false, true])
      out.push(
        v(`ritam ${sec}s${e ? ' · iskusan' : ''}`, {
          pb: { distM: HM, sec, date: '2026-09-20' },
          ...(e ? exp : {}),
          weeklyKm: 55,
          runDays: 5
        })
      );
  // Dugo trčanje i MLR (5+ dana, vrhunac ≥ 45 km), lak dan posle zahtevne duge.
  for (const lr of [4, 8, 12, 16, 19.5, 22, 30])
    out.push(v(`dugo ${lr}`, { recentLongRunKm: lr, weeklyKm: 50, runDays: 5 }));
  out.push(v('mlr 6 dana', { weeklyKm: 70, runDays: 6, ...exp }));
  out.push(v('mlr 5 dana granica', { weeklyKm: 45, runDays: 5 }));
  out.push(v('trka pre početka', { raceDate: '2026-10-11' }));
  out.push(v('trka za 2+ godine', { raceDate: '2029-01-01' }));
  out.push(v('neispravan datum', { raceDate: '2027-02-31' }));
  out.push(v('neispravan početak', { startDate: 'x' }));
  out.push(v('pb 0', { pb: { distM: HM, sec: 0 } }));
  out.push(v('pb 5K', { pb: { distM: 5000, sec: 1400 } }));
  out.push(v('pb 10K', { pb: { distM: 10000, sec: 2900 } }));
  out.push(v('pb maraton', { pb: { distM: 42195, sec: 14000 } }));
  out.push(v('zastareo pb', { pb: { distM: HM, sec: 6300, date: '2025-01-01' } }));
  out.push(v('pb bez datuma', { pb: { distM: HM, sec: 6300 } }));
  out.push(v('cilj brži', { goalSec: 6000 }));
  out.push(v('cilj mnogo brži', { goalSec: 5000 }));
  out.push(v('cilj sporiji', { goalSec: 7000 }));
  out.push(v('cilj null', { goalSec: null }));
  out.push(v('početnik', { trainedRecently: false, weeklyKm: 10, runDays: 3 }));
  out.push(v('početnik visok obim', { trainedRecently: false, weeklyKm: 60, runDays: 5 }));
  out.push(v('početnik kratko', { trainedRecently: false, weeklyKm: 12, raceDate: '2026-12-06' }));
  out.push(v('povratak', { breakWeeks: 6, consistentWeeks: 2 }));
  out.push(v('povratak kratak', { breakWeeks: 2, ...exp }));
  out.push(v('povratak dug', { breakWeeks: 30 }));
  out.push(v('dužina veća od obima', { recentLongRunKm: 40 }));
  out.push(v('raspored', { runDows: [2, 4, 6, 7], lrDow: 7, qDows: [2, 4] }));
  out.push(v('raspored vikend', { runDows: [1, 3, 6, 7], lrDow: 6, qDows: [3, 7] }));
  out.push(v('raspored sukob', { runDows: [1, 2], lrDow: 1, qDows: [1, 2], runDays: 2 }));
  out.push(v('raspored jedan kvalitet', { qDows: [3], quality: 1, ...exp }));
  out.push(v('lestvica', { trainedRecently: false, runWalkLadder: [1, 1, 2, 2, 3] }));
  out.push(v('lestvica neispravna', { trainedRecently: false, runWalkLadder: [0, 9] }));
  out.push(v('umoran', { currentReadiness: { reason: 'fatigued', until: '2026-10-25' }, ...exp }));
  out.push(
    v('smanjen obim', { currentReadiness: { reason: 'reduced-volume', until: '2026-10-28' } })
  );
  out.push(
    v('povratna spremnost', {
      currentReadiness: { reason: 'returning', until: '2026-11-02' },
      breakWeeks: 3
    })
  );
  out.push(v('_noSuggest', { weeklyKm: 80, runDays: 3, _noSuggest: true }));
  return out;
}

export function hmGenerationCases(): GenerationCase[] {
  const fp = scenariji()
    .filter((s) => s.inp['raceDistM'] === HM)
    .map((s) => ({ name: `fingerprint · ${s.ime}`, input: s.inp }));
  return [...fp, ...qaInputs(HM), ...hmTrackMatrix(), ...hmSeeded(), ...hmEdgeInputs()];
}

/* ------------------------------------------------------------------ adaptacija */

export function hmAdaptationBases(): GenerationCase[] {
  const qa = qaInputs(HM);
  const seeded = hmSeeded().filter((_, i) => i % 29 === 0);
  const track = hmTrackMatrix().filter((c) =>
    /(first|perf) · q[12] · (7|14|20)n · (4d · 42km|5d · 58km)$/.test(c.name)
  );
  const edge = hmEdgeInputs().filter((c) =>
    /početnik$|povratak$|povratak kratak|raspored$|lestvica$|zastareo|umoran|smanjen obim|dugo 19\.5|mlr 6 dana|trka za (3|6|9) ned · q2$|ritam 8000s$|ritam 4810s · iskusan|raspored jedan kvalitet|početak dan 4/.test(
      c.name
    )
  );
  return [...qa, ...seeded, ...track, ...edge];
}

type Stored = NonNullable<ReturnType<GeneratorApi['adaptGeneratedPlan']>>;

function storedOf(api: GeneratorApi, input: Input): Stored | { error: unknown } {
  const gen = api.generatePlan(clone(input) as never);
  if ('error' in gen) return { error: gen };
  const stored0 = api.adaptGeneratedPlan(gen);
  if (!stored0) return { error: 'adapter' };
  return { ...stored0, ulaz: clone(input) };
}

/** Taper i nedelja trke: kvalitet, obim i adaptacija u poslednje dve nedelje (dodatak na opšte tokove). */
export function hmTaperFlows(api: HmApi, bases: GenerationCase[]): FlowResult[] {
  const out: FlowResult[] = [];
  const record = (name: string, args: unknown[], fn: () => unknown): void => {
    const before = JSON.stringify(args);
    const value = attempt(fn);
    out.push({ name, value, pure: JSON.stringify(args) === before });
  };
  for (const base of bases) {
    const stored = storedOf(api, base.input);
    if ('error' in stored) continue;
    const race = String(base.input['raceDate']);
    for (const back of [12, 5]) {
      const today = addIso(race, -back);
      if (today <= stored.meta!.start) continue;
      const view = api.resolvePlan(stored.weeks, { alts: {}, moves: {} });
      const log: Record<string, Record<string, unknown>> = {};
      for (const d of view.dated)
        if (d.date <= today && !d.rest && (d.km ?? 0) > 0 && d.tag !== 'snaga')
          log[d.id] = { status: 'done', km: d.km, runDate: d.date, rpe: 4 };
      const ctx = { log, alts: {}, moves: {}, pred: {}, predLock: {} };
      const tag = `${base.name} · taper −${back}`;
      const model = attempt(() => api.executionModel(view, today, ctx)) as {
        analysis?: unknown;
      };
      out.push({ name: `${tag} · executionModel`, value: model, pure: true });
      if (model.analysis)
        for (const [oname, opts] of Object.entries({
          reduce: {},
          pause10: { breakDays: 10, weeklyKm: 20 },
          lower: { weeklyKm: 25, recentLongRunKm: 10 }
        }))
          record(`${tag} · execution ${oname}`, [stored, ctx, opts], () =>
            api.buildExecutionAdjustment(stored, today as never, model.analysis as never, opts, ctx)
          );
      const goal = Number(stored.meta!.predictedSec) || 6300;
      record(`${tag} · goal faster`, [stored, ctx], () =>
        api.planWithNewGoal(stored, Math.round(goal * 0.96), today as never, ctx)
      );
      record(`${tag} · recalibrated +2`, [stored, ctx], () =>
        api.planRecalibrated(stored, Number(stored.meta!.vdot0) + 2, today as never, ctx)
      );
    }
  }
  return out;
}

const generatorDistance = (plan: unknown): unknown =>
  (plan as { meta?: { raceDistM?: unknown } }).meta?.raceDistM ??
  (plan as { ulaz?: { raceDistM?: unknown } }).ulaz?.raceDistM;

/** Originalni HM QA događaji (U07–U09): plan, dnevnik i potvrđena pauza kako su zabeleženi. */
export function hmEventFlows(api: GeneratorApi): FlowResult[] {
  const out: FlowResult[] = [];
  type Current = { meta?: { raceDistM?: number }; weeks: unknown[] };
  for (const id of ['U01', 'U02', 'U03', 'U04', 'U05', 'U06', 'U07', 'U08', 'U09', 'U10']) {
    const ev = JSON.parse(readFileSync(`${USERS}${id}-event.json`, 'utf8')) as {
      today?: string;
      profile?: { eventToday?: string };
      goal?: { from: number; to: number };
      versions?: { old?: { input?: { plan?: Current; context?: Record<string, unknown> } } };
      input?: {
        current?: Current;
        context?: Record<string, unknown>;
        options?: Record<string, unknown>;
      };
      analysis?: unknown;
    };
    const today = ev.today ?? ev.profile?.eventToday;
    const name = `event · ${id}`;
    const record = (label: string, args: unknown[], fn: () => unknown): void => {
      const before = JSON.stringify(args);
      const value = attempt(fn);
      out.push({ name: `${name} · ${label}`, value, pure: JSON.stringify(args) === before });
    };
    const goalPlan = ev.versions?.old?.input?.plan;
    if (ev.goal && goalPlan && today) {
      const ctx = ev.versions!.old!.input!.context ?? {};
      if (generatorDistance(goalPlan) !== HM) continue;
      record('goal', [goalPlan, ctx], () =>
        api.planWithNewGoal(goalPlan as never, ev.goal!.to, today as never, ctx)
      );
      continue;
    }
    const current = ev.input?.current;
    if (!current || !today || generatorDistance(current) !== HM) continue;
    const context = ev.input!.context ?? {};
    const options = ev.input!.options ?? {};
    const resolved = api.resolvePlan(current.weeks as never, {
      alts: (context['alts'] ?? {}) as never,
      moves: (context['moves'] ?? {}) as never
    });
    const model = attempt(() => api.executionModel(resolved, today, context, options as never)) as {
      analysis?: unknown;
    };
    out.push({ name: `${name} · executionModel`, value: model, pure: true });
    record('adjustment recorded analysis', [current, context, options, ev.analysis], () =>
      api.buildExecutionAdjustment(
        current as never,
        today as never,
        ev.analysis as never,
        options,
        context
      )
    );
    if (model.analysis)
      record('adjustment model analysis', [current, context, options], () =>
        api.buildExecutionAdjustment(
          current as never,
          today as never,
          model.analysis as never,
          options,
          context
        )
      );
    record('adjustment reduce', [current, context], () =>
      api.buildExecutionAdjustment(
        current as never,
        today as never,
        ev.analysis as never,
        {},
        context
      )
    );
  }
  return out;
}

/** Bazni ulazi za odluku o pripremi: ograničene HM pripreme (mali obim, kratko, povratak) + opšti bazni. */
export function hmDecisionBases(): GenerationCase[] {
  const limited = hmEdgeInputs().filter((c) =>
    /km (9\.9|15|20|29)$|trka za (4|5|6|7|8) ned · q[12]$|početnik$|početnik kratko|povratak$|dugo (4|8)$|dani (2|3)$/.test(
      c.name
    )
  );
  const seeded = hmSeeded().filter((_, i) => i % 11 === 0);
  return [...qaInputs(HM), ...limited, ...seeded];
}

/** Odluka o pripremi nad ograničenim HM planovima, svaka ponuđena opcija, i odluka nad sačuvanim planom u povratnom
 *  režimu (isti put kao `storedPreparationDecision` u aplikaciji). */
export function hmDecisionFlows(api: HmApi): FlowResult[] {
  const out: FlowResult[] = [];
  for (const base of hmDecisionBases()) {
    const stored = storedOf(api, base.input);
    if ('error' in stored) continue;
    const meta = stored.meta!;
    const limited = api.isLimitedLongPreparation(meta as never);
    out.push({ name: `${base.name} · limited`, value: limited, pure: true });
    if (!limited) continue;
    const today = stored.weeks[1]?.start ?? meta.start;
    const basis = attempt(() => api.basisFromPlan(stored as never, today as never));
    out.push({ name: `${base.name} · basis`, value: basis, pure: true });
    if (!basis) continue;
    const decision = attempt(() =>
      api.preparationDecision(
        stored as never,
        today as never,
        basis as never,
        {} as never,
        'limited' as never,
        meta.preparation as never
      )
    ) as { options?: Array<{ choice: unknown }> };
    out.push({ name: `${base.name} · decision`, value: decision, pure: true });
    for (const option of decision.options ?? []) {
      const before = JSON.stringify([stored, basis]);
      const choice = attempt(() =>
        api.buildPreparationChoice(
          stored as never,
          today as never,
          basis as never,
          option.choice as never,
          {} as never
        )
      ) as { result?: Stored };
      out.push({
        name: `${base.name} · choice ${JSON.stringify(option.choice)}`,
        value: choice,
        pure: JSON.stringify([stored, basis]) === before
      });
      // Povratni režim sačuvan → nova odluka nad njim (produženje ili kraća distanca).
      if ((option.choice as { kind?: string }).kind === 'base' && choice.result) {
        const later = addIso(today, 7);
        const b2 = attempt(() => api.basisFromPlan(choice.result as never, later as never));
        out.push({ name: `${base.name} · base · basis`, value: b2, pure: true });
        if (b2 && !(b2 as { thrown?: unknown }).thrown)
          out.push({
            name: `${base.name} · base · decision`,
            value: attempt(() =>
              api.preparationDecision(
                choice.result as never,
                later as never,
                b2 as never,
                {} as never,
                'limited' as never,
                choice.result!.meta?.preparation as never
              )
            ),
            pure: true
          });
      }
    }
    // Osnova izvršenja (pauza) kao u `previewPreparationChoice`.
    const view = api.resolvePlan(stored.weeks, { alts: {}, moves: {} });
    const model = attempt(() => api.executionModel(view, today, {}, { km: 6 })) as {
      analysis?: unknown;
    };
    if (model.analysis)
      out.push({
        name: `${base.name} · executionBasis pause21`,
        value: attempt(() =>
          api.executionBasis(
            stored as never,
            today as never,
            model.analysis as never,
            { breakDays: 21, weeklyKm: 15, recentLongRunKm: 7 } as never
          )
        ),
        pure: true
      });
  }
  return out;
}

export function hmAdaptationFlows(api: HmApi, limitBases?: number): FlowResult[] {
  const bases = hmAdaptationBases();
  return [
    ...adaptationFlows(api, limitBases, bases),
    ...hmTaperFlows(api, bases.slice(0, limitBases)),
    ...(limitBases === undefined ? hmEventFlows(api) : [])
  ];
}
