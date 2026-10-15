/* 10K SCENARIJI ZA POREĐENJE PRE/POSLE IZDVAJANJA.

   Ulazi (ništa nije izmišljeno iz tekstualnih izveštaja):
   - `fingerprint`: 10K deo matrice golden master-a (`generatorScenarios.ts`, 576 ulaza);
   - `qa`: originalni 10K ulazi iz docs/qa/{generator-final,generator-ab,generator-phase1,generator-phase2}/inputs.json;
   - `seeded`: deterministički slučajni 10K ulazi (mulberry32, seme 10010 — drugo seme od reference ostalih distanci);
   - `edge`: granične i neispravne vrednosti za 10K (greške moraju biti iste).
   Adaptacija: isti tokovi kao za 5K (`fiveK/scenarios.ts` → `adaptationFlows`: U01 propušten, U02 podizvršenje, U03 RPE 8,
   pauza, zaštitni izazov iz U02-probe.mjs, promena cilja, rekalibracija, run/walk, predlog tempa, vraćanje verzije) nad 10K
   baznim planovima, plus originalni 10K QA događaji U04–U06 (`docs/qa/generator-ab/users/U0x-event.json`: stvaran plan,
   dnevnik, potvrđena pauza) bez izmena. „Danas" je uvek argument; sat se ne čita.

   Test kod (harnes) se namerno deli sa 5K testovima: zabrana deljenja važi za izvršni kod generatora, ne za proveru. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scenariji } from '@/test/generatorScenarios';
import {
  adaptationFlows,
  attempt,
  qaInputs,
  seededInputs,
  type FlowResult,
  type GenerationCase
} from '@/test/fiveK/scenarios';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';

type Input = Record<string, unknown>;
export const TEN_K = 10000;
const clone = <T>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T));
const USERS = fileURLToPath(new URL('../../../../docs/qa/generator-ab/users/', import.meta.url));

function addIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function tenKEdgeInputs(): GenerationCase[] {
  const base: Input = {
    startDate: '2026-10-14',
    raceDate: '2027-01-17',
    raceDistM: TEN_K,
    pb: { distM: TEN_K, sec: 3000 },
    weeklyKm: 35,
    runDays: 4,
    quality: 2,
    intensity: 'std',
    trainedRecently: true
  };
  const v = (name: string, patch: Input): GenerationCase => ({
    name: `edge10k · ${name}`,
    input: { ...clone(base), ...patch }
  });
  const out: GenerationCase[] = [];
  for (let d = 0; d <= 13; d++)
    out.push(v(`trka +${d} dana`, { raceDate: addIso('2026-10-14', d) }));
  for (const w of [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 24, 30])
    out.push(v(`trka za ${w} ned`, { raceDate: addIso('2026-10-14', w * 7) }));
  for (let wd = 0; wd < 7; wd++)
    out.push(
      v(`početak dan ${wd}`, {
        startDate: addIso('2026-10-12', wd),
        raceDate: addIso('2027-01-17', wd)
      })
    );
  for (const km of [0, 0.5, 1, 3, 5, 9.9, 15, 20, 45, 60, 80, 110, 150, 199, 200, 250, 1000])
    out.push(v(`km ${km}`, { weeklyKm: km }));
  for (const rd of [0, 1, 2, 3, 5, 6, 7, 8, 3.5, Number.NaN])
    out.push(v(`dani ${String(rd)}`, { runDays: rd }));
  for (const q of [0, 1, 2, 3]) out.push(v(`kvalitet ${q}`, { quality: q }));
  for (const i of ['kons', 'std', 'agr'])
    for (const vi of ['kons', 'std', 'agr'])
      out.push(v(`intenzitet ${i}/${vi}`, { intensity: i, volIntensity: vi }));
  out.push(v('trka pre početka', { raceDate: '2026-10-13' }));
  out.push(v('trka za 2+ godine', { raceDate: '2029-01-01' }));
  out.push(v('neispravan datum', { raceDate: '2026-02-31' }));
  out.push(v('neispravan početak', { startDate: 'x' }));
  out.push(v('pb 0', { pb: { distM: TEN_K, sec: 0 } }));
  out.push(v('pb 5K', { pb: { distM: 5000, sec: 1400 } }));
  out.push(v('pb 3K', { pb: { distM: 3000, sec: 800 } }));
  out.push(v('pb polumaraton', { pb: { distM: 21097.5, sec: 6300 } }));
  out.push(v('pb maraton', { pb: { distM: 42195, sec: 14000 } }));
  out.push(v('pb brz', { pb: { distM: TEN_K, sec: 1900 } }));
  out.push(v('pb spor', { pb: { distM: TEN_K, sec: 5000 } }));
  out.push(v('zastareo pb', { pb: { distM: TEN_K, sec: 3000, date: '2025-01-01' } }));
  out.push(v('svež pb', { pb: { distM: TEN_K, sec: 3000, date: '2026-10-01' } }));
  out.push(v('cilj brži', { goalSec: 2700 }));
  out.push(v('cilj mnogo brži', { goalSec: 2300 }));
  out.push(v('cilj sporiji', { goalSec: 3300 }));
  out.push(v('početnik', { trainedRecently: false, weeklyKm: 8, runDays: 3 }));
  out.push(v('početnik visok obim', { trainedRecently: false, weeklyKm: 60, runDays: 5 }));
  out.push(v('početnik kratko', { trainedRecently: false, weeklyKm: 10, raceDate: '2026-11-15' }));
  out.push(v('povratak', { breakWeeks: 6, consistentWeeks: 20 }));
  out.push(v('povratak kratak', { breakWeeks: 2, consistentWeeks: 30 }));
  out.push(v('povratak dug', { breakWeeks: 30 }));
  out.push(v('iskusan', { qualityExperience: 'regular', consistentWeeks: 52, weeklyKm: 70 }));
  out.push(v('iskusan 6 dana', { qualityExperience: 'regular', weeklyKm: 85, runDays: 6 }));
  out.push(v('neko iskustvo', { qualityExperience: 'some', consistentWeeks: 10 }));
  out.push(v('bez iskustva', { qualityExperience: 'none', consistentWeeks: 2 }));
  out.push(v('dugo trčanje 4', { recentLongRunKm: 4 }));
  out.push(v('dugo trčanje 16', { recentLongRunKm: 16, weeklyKm: 50 }));
  out.push(v('dužina veća od obima', { recentLongRunKm: 40 }));
  out.push(v('raspored', { runDows: [2, 4, 6, 7], lrDow: 6, qDows: [2, 4] }));
  out.push(v('raspored vikend', { runDows: [1, 3, 6, 7], lrDow: 7, qDows: [3, 6] }));
  out.push(v('raspored sukob', { runDows: [1, 2], lrDow: 1, qDows: [1, 2], runDays: 2 }));
  out.push(v('raspored jedan kvalitet', { qDows: [3], quality: 1 }));
  out.push(v('lestvica', { trainedRecently: false, runWalkLadder: [1, 1, 2, 2, 3] }));
  out.push(v('lestvica neispravna', { trainedRecently: false, runWalkLadder: [0, 9] }));
  out.push(v('umoran', { currentReadiness: { reason: 'fatigued', until: '2026-10-25' } }));
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

export function tenKSeeded(): GenerationCase[] {
  return seededInputs(400, TEN_K, 10010).map((c) => ({ ...c, name: `seeded10k · ${c.name}` }));
}

export function tenKGenerationCases(): GenerationCase[] {
  const fp = scenariji()
    .filter((s) => s.inp['raceDistM'] === TEN_K)
    .map((s) => ({ name: `fingerprint · ${s.ime}`, input: s.inp }));
  return [...fp, ...qaInputs(TEN_K), ...tenKSeeded(), ...tenKEdgeInputs()];
}

export function tenKAdaptationBases(): GenerationCase[] {
  const qa = qaInputs(TEN_K);
  const seeded = tenKSeeded().filter((_, i) => i % 23 === 0);
  const edge = tenKEdgeInputs().filter((c) =>
    /početnik$|povratak$|povratak kratak|iskusan$|raspored$|lestvica$|zastareo|umoran|smanjen obim|dugo trčanje 16|trka za (4|6|10) ned|početak dan 2|početak dan 6/.test(
      c.name
    )
  );
  return [...qa, ...seeded, ...edge];
}

const generatorDistance = (plan: unknown): unknown =>
  (plan as { meta?: { raceDistM?: unknown }; ulaz?: { raceDistM?: unknown } }).meta?.raceDistM ??
  (plan as { ulaz?: { raceDistM?: unknown } }).ulaz?.raceDistM;

/** Originalni 10K QA događaji (U04–U06): plan, dnevnik i potvrđena pauza kako su zabeleženi. */
export function tenKEventFlows(api: GeneratorApi): FlowResult[] {
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
    // U05: zabeležena promena cilja (stara verzija plana + kontekst).
    const goalPlan = ev.versions?.old?.input?.plan;
    if (ev.goal && goalPlan && today) {
      const ctx = ev.versions!.old!.input!.context ?? {};
      if (generatorDistance(goalPlan) !== TEN_K) continue;
      record('goal', [goalPlan, ctx], () =>
        api.planWithNewGoal(goalPlan as never, ev.goal!.to, today as never, ctx)
      );
      continue;
    }
    const current = ev.input?.current;
    if (!current || !today || generatorDistance(current) !== TEN_K) continue;
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

export function tenKAdaptationFlows(api: GeneratorApi, limitBases?: number): FlowResult[] {
  return [
    ...adaptationFlows(api, limitBases, tenKAdaptationBases()),
    ...(limitBases === undefined ? tenKEventFlows(api) : [])
  ];
}
