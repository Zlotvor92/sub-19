/* IZOLACIJA U IZVRŠAVANJU — zajednički kod glavnog testa (`domain/generators/runtimeIsolation.node.test.ts`) i delova
   punog nivoa (`runtimeIsolation.*.full.node.test.ts`). Svaki test fajl ima sopstvenu instancu ovog modula (izolacija
   fajla ostaje: bez `isolate: false`), pa i sopstvenu predaju `currentHandoff` na nivou modula, kao kad je bila na nivou
   test fajla. Svež modul generatora (`vi.resetModules()` + dinamički `import`) pravi sam test fajl, kao ranije.

   KONTROLISANI PODSKUP (`Subset`, po distanci): generisanje (svaki n-ti ulaz) + tokovi adaptacije nad izabranim baznim
   planovima. Redovi su isti kao kroz `*GenerationRows(api, every(n))` + `*AdaptationRows(api, limitBases)`: isti tokovi
   (`adaptationFlows`, za HM/maraton i taper), isti redosled poziva; bazni planovi se biraju po indeksu.
   - PUN nivo: današnji podskup `TODAY` (svaki 12. ulaz, prva dva bazna plana) i današnje tvrdnje. Veliki `it` su podeljeni
     na delove današnjeg podskupa (`PARTS`): G = generisanje, B = adaptacija nad oba bazna plana, B0/B1 = nad jednim;
     G ∪ B = G ∪ B0 ∪ B1 = TODAY, bez preklapanja.
   - BRZ nivo: `FAST` — ređe generisanje i jedan kratak bazni plan po distanci; sve tvrdnje (4 distance, svi redosledi,
     svež modul, zajednički objekti, lokalna promena politike za sva 4 cilja i oba načina predaje). */
import { expect } from 'vitest';
import { referenceRow } from '@/test/fiveK/exact';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import { generationRows, loadReference, type ReferenceRow } from '@/test/fiveK/reference';
import {
  adaptationBases,
  adaptationFlows,
  type FlowResult,
  type GenerationCase
} from '@/test/fiveK/scenarios';
import { hmGenerationRows, loadHmReference } from '@/test/halfMarathon/reference';
import { hmAdaptationBases, hmTaperFlows, type HmApi } from '@/test/halfMarathon/scenarios';
import { logCompared } from '@/test/level';
import { loadMarathonReference, marathonGenerationRows } from '@/test/marathon/reference';
import { marathonAdaptationBases, marathonTaperFlows } from '@/test/marathon/scenarios';
import { loadTenKReference, tenKGenerationRows } from '@/test/tenK/reference';
import { tenKAdaptationBases } from '@/test/tenK/scenarios';
import * as fiveK from '@/domain/generators/fiveK';
import { HEURISTIC_5K } from '@/domain/generators/fiveK/training/constants/distances';
import * as halfMarathon from '@/domain/generators/halfMarathon';
import { HEURISTIC_21K } from '@/domain/generators/halfMarathon/training/constants/distances';
import { regeneratorForDistance } from '@/domain/generators/handoff';
import * as marathon from '@/domain/generators/marathon';
import { HEURISTIC_42K } from '@/domain/generators/marathon/training/constants/distances';
import * as tenK from '@/domain/generators/tenK';
import { HEURISTIC_10K } from '@/domain/generators/tenK/training/constants/distances';

export type Rows = Record<string, ReferenceRow>;
export type Mod = typeof fiveK | typeof tenK | typeof halfMarathon | typeof marathon;
export type Handoff = halfMarathon.ShorterDistanceHandoff;
export type DistanceName = '5K' | '10K' | 'HM' | 'maraton';

/** Predaja „kraća distanca" kao u produkciji (`handoff.ts`); test je može usmeriti na drugu instancu generatora. */
let currentHandoff: Handoff = regeneratorForDistance;

function apiOf(mod: Mod, decisions = false): GeneratorApi & Partial<HmApi> {
  const m = mod as typeof halfMarathon;
  const handoff: Handoff = (dist) => currentHandoff(dist);
  const base = {
    generatePlan: m.generatePlan,
    assess: m.assess,
    adaptGeneratedPlan: m.adaptGeneratedPlan,
    resolvePlan: m.resolvePlan,
    executionModel: m.executionModel,
    buildExecutionAdjustment: decisions
      ? (((...a: Parameters<typeof m.buildExecutionAdjustment>) =>
          m.buildExecutionAdjustment(a[0], a[1], a[2], a[3], a[4], handoff)) as never)
      : m.buildExecutionAdjustment,
    buildRunWalkAdjustment: m.buildRunWalkAdjustment,
    assessRunWalkProgress: m.assessRunWalkProgress,
    qualityEntryGate: m.qualityEntryGate,
    hasRecentMeasuredForm: m.hasRecentMeasuredForm,
    planWithNewGoal: m.planWithNewGoal,
    planRecalibrated: m.planRecalibrated,
    recalibratedPlan: m.recalibratedPlan,
    reentryPlan: m.reentryPlan,
    graftFuturePlan: m.graftFuturePlan,
    alignAutomaticOverlays: m.alignAutomaticOverlays,
    vdotProposal: m.vdotProposal,
    applyVdotProposal: m.applyVdotProposal,
    undoVdotAdjustments: m.undoVdotAdjustments,
    fitnessEvidence: m.fitnessEvidence,
    planVdotNow: m.planVdotNow,
    matchPlanRows: m.matchPlanRows,
    sessKm: m.sessKm,
    sessDesc: m.sessDesc,
    t3kVdot: m.t3kVdot
  };
  if (!decisions) return base as never;
  return {
    ...base,
    executionBasis: m.executionBasis,
    basisFromPlan: m.basisFromPlan,
    preparationDecision: (...a: Parameters<typeof m.preparationDecision>) =>
      m.preparationDecision(a[0], a[1], a[2], a[3], a[4], a[5], handoff),
    buildPreparationChoice: (...a: Parameters<typeof m.buildPreparationChoice>) =>
      m.buildPreparationChoice(a[0], a[1], a[2], a[3], a[4], handoff),
    isLimitedLongPreparation: m.isLimitedLongPreparation
  } as never;
}

/* ------------------------------------------------------------------ kontrolisani podskup */

/** Kontrolisani podskup jedne distance. */
export interface Subset {
  /** Generisanje: svaki n-ti ulaz (prvi uvek); `null` — bez generisanja. */
  every: number | null;
  /** Bazni planovi adaptacije (`*AdaptationBases`), redom: indeks ili ime. */
  bases: readonly (number | string)[];
}
export type Subsets = Readonly<Record<DistanceName, Subset>>;

const each = (s: Subset): Subsets => ({ '5K': s, '10K': s, HM: s, maraton: s });

/** Današnji podskup (pun nivo): svaki 12. ulaz generisanja i adaptacija nad prva dva bazna plana. */
export const TODAY: Subsets = each({ every: 12, bases: [0, 1] });

/** Delovi današnjeg podskupa (pun nivo): G ∪ B = G ∪ B0 ∪ B1 = `TODAY`, bez preklapanja. */
export const PARTS = {
  G: each({ every: 12, bases: [] }),
  B: each({ every: null, bases: [0, 1] }),
  B0: each({ every: null, bases: [0] }),
  B1: each({ every: null, bases: [1] })
} as const;

/* Brz podskup: svaki 120. ulaz generisanja i jedan KRATAK bazni plan po distanci (kratka priprema → jeftini tokovi, ali
   svi isti tokovi adaptacije). */
export const FAST: Subsets = {
  '5K': { every: 120, bases: ['seeded · 322'] },
  '10K': { every: 120, bases: ['edge10k · trka za 4 ned'] },
  HM: { every: 120, bases: ['edgeHm · trka za 3 ned · q2'] },
  maraton: { every: 120, bases: ['edgeM · trka za 3 ned · q2'] }
};

/* Kanal predaje u brzom nivou: kratki bazni planovi ne nude „kraću distancu" osetljivu na `deloadFactor` (plan kraće
   distance je prekratak za rasterećenje), pa se uz cilj 5K polumaratonu dodaje bazni plan
   `hmTrack · first · q1 · 7n · 5d · 58km`, čiji tokovi `… · 2026-10-21 · prot · execution pause10/pause21` nude 5K plan
   sa rasterećenjem. (U današnjem podskupu kanal pokriva jedan red: maraton → HM,
   `qa · generator-final · U10 · 2026-12-27 · under · execution reduce`; taj bazni plan je ~3× skuplji.) */
const FAST_HANDOFF: Partial<Record<DistanceName, Partial<Record<DistanceName, Subset>>>> = {
  '5K': {
    HM: { ...FAST.HM, bases: [...FAST.HM.bases, 'hmTrack · first · q1 · 7n · 5d · 58km'] }
  }
};

/** Podskup lokalne promene politike za cilj `target` (brz nivo: `FAST` + kanal predaje). */
export function fastPolicySubsets(target: DistanceName): Subsets {
  return { ...FAST, ...FAST_HANDOFF[target] };
}

const everyPick = (s: Subset): ((name: string) => boolean) => {
  let i = 0;
  return () => s.every !== null && i++ % s.every === 0;
};

function pickBases(all: readonly GenerationCase[], s: Subset): GenerationCase[] {
  return s.bases.map((key) => {
    const b = typeof key === 'number' ? all[key] : all.find((x) => x.name === key);
    if (!b) throw new Error(`nema baznog plana ${key}`);
    return b;
  });
}

function prefix(p: string, rows: Rows): Rows {
  return Object.fromEntries(Object.entries(rows).map(([k, v]) => [p + k, v]));
}

function rowsOf(flows: FlowResult[], expected: Rows): Rows {
  const out: Rows = {};
  for (const f of flows) {
    if (out[f.name]) throw new Error(`dupli tok ${f.name}`);
    out[f.name] = referenceRow(f.value, f.pure, expected[f.name]);
  }
  return out;
}

/* ------------------------------------------------------------------ distance */

interface Reference {
  generation: Rows;
  adaptation: Rows;
}
/** Referenca se učitava (gunzip + JSON.parse) jednom po distanci, a ne pri svakom poređenju (čist višak). */
const once = (load: () => Reference | null): (() => Reference) => {
  let r: Reference | undefined;
  return () => (r ??= load()!);
};

export interface Distance {
  name: DistanceName;
  /** Redovi podskupa (adaptacija sa prefiksom `a:`); kategorije se preuzimaju iz reference kad je ukupni SHA isti. */
  run: (mod: Mod, subset: Subset) => Rows;
  mod: Mod;
  /** Distance čiji plan ovaj generator nudi kao „kraću distancu" (eksplicitna predaja kroz `handoff.ts`). */
  handsOffTo: readonly string[];
  /** Referenca u obliku izlaza `run`. */
  expected: () => Rows;
}

type GenerationRowsFn = (
  api: GeneratorApi & Partial<HmApi>,
  pick: (name: string) => boolean,
  expected: Rows
) => Rows;

function distance(
  name: DistanceName,
  mod: Mod,
  handsOffTo: readonly string[],
  ref: () => Reference,
  generation: GenerationRowsFn,
  adaptation: (api: HmApi, bases: GenerationCase[]) => FlowResult[],
  bases: () => GenerationCase[],
  decisions: boolean
): Distance {
  let expected: Rows | undefined;
  return {
    name,
    mod,
    handsOffTo,
    run: (m, subset) => ({
      ...generation(apiOf(m, decisions), everyPick(subset), ref().generation),
      ...prefix(
        'a:',
        rowsOf(
          adaptation(apiOf(m, decisions) as HmApi, pickBases(bases(), subset)),
          ref().adaptation
        )
      )
    }),
    expected: () => (expected ??= { ...ref().generation, ...prefix('a:', ref().adaptation) })
  };
}

export const DISTANCES: readonly Distance[] = [
  distance(
    '5K',
    fiveK,
    [],
    once(loadReference),
    generationRows,
    (api, b) => adaptationFlows(api, undefined, b),
    adaptationBases,
    false
  ),
  distance(
    '10K',
    tenK,
    [],
    once(loadTenKReference),
    tenKGenerationRows,
    (api, b) => adaptationFlows(api, undefined, b),
    tenKAdaptationBases,
    false
  ),
  distance(
    'HM',
    halfMarathon,
    ['10K', '5K'],
    once(loadHmReference),
    hmGenerationRows,
    (api, b) => [...adaptationFlows(api, undefined, b), ...hmTaperFlows(api, b)],
    hmAdaptationBases,
    true
  ),
  distance(
    'maraton',
    marathon,
    ['HM', '10K'],
    once(loadMarathonReference),
    marathonGenerationRows,
    (api, b) => [...adaptationFlows(api, undefined, b), ...marathonTaperFlows(api, b)],
    marathonAdaptationBases,
    true
  )
];

export const byName = (name: DistanceName): Distance => DISTANCES.find((d) => d.name === name)!;

/** Putanje modula generatora relativno prema `domain/generators/` (za svež `import` u test fajlu). */
export const MODULE_PATHS = {
  '5K': './fiveK',
  '10K': './tenK',
  HM: './halfMarathon',
  maraton: './marathon'
} as const;

/** Razlike prema referenci za sve izračunate redove (podskup reference); poređeni redovi se beleže (`logCompared`). */
export function diff(actual: Rows, d: Distance): string[] {
  const expected = d.expected();
  logCompared(`runtimeIsolation.${d.name}`, Object.keys(actual));
  const out: string[] = [];
  for (const [name, got] of Object.entries(actual)) {
    const ref = expected[name];
    if (!ref) out.push(`NEMA U REFERENCI: ${name}`);
    else if (ref.full !== got.full || ref.pure !== got.pure) out.push(name);
  }
  return out;
}

export const runAll = (order: readonly Distance[], subsets: Subsets): Record<string, Rows> =>
  Object.fromEntries(order.map((d) => [d.name, d.run(d.mod, subsets[d.name])]));

/* ------------------------------------------------------------------ provere (tela `it`) */

/** Svaka distanca ima referencu i neprazan kontrolisani podskup jednak referenci. */
export function referenceCheck(subsets: Subsets): void {
  for (const d of DISTANCES) {
    const rows = d.run(d.mod, subsets[d.name]);
    expect(Object.keys(rows).length, d.name).toBeGreaterThan(100);
    expect(diff(rows, d), d.name).toEqual([]);
  }
}

/** 1. Samostalno izvršavanje: `fresh(d)` daje svež modul (test fajl: `vi.resetModules()` + dinamički `import`). */
export async function standaloneCheck(
  fresh: (d: Distance) => Promise<Mod>,
  subsets: Subsets
): Promise<void> {
  for (const d of DISTANCES) {
    const mod = await fresh(d);
    expect(mod, d.name).not.toBe(d.mod);
    expect(diff(d.run(mod, subsets[d.name]), d), d.name).toEqual([]);
  }
}

/** 2–3. Različit redosled, isprepletano i ponovljeno izvršavanje daju isti rezultat (i jednak referenci). */
export function orderCheck(subsets: Subsets): void {
  const forward = runAll(DISTANCES, subsets);
  const backward = runAll([...DISTANCES].reverse(), subsets);
  const interleaved = runAll([DISTANCES[2]!, DISTANCES[0]!, DISTANCES[3]!, DISTANCES[1]!], subsets);
  const again = runAll(DISTANCES, subsets);
  for (const d of DISTANCES) {
    expect(backward[d.name], d.name).toEqual(forward[d.name]);
    expect(interleaved[d.name], d.name).toEqual(forward[d.name]);
    expect(again[d.name], d.name).toEqual(forward[d.name]);
    expect(diff(forward[d.name]!, d), d.name).toEqual([]);
  }
}

/** Svi objekti i nizovi dostižni iz izvoza modula (funkcije se ne prate). */
function reachableObjects(root: object): Set<object> {
  const seen = new Set<object>();
  const stack: unknown[] = Object.values(root);
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    for (const x of Object.values(v)) stack.push(x);
  }
  return seen;
}

const exportedConstants = (mod: Mod): string =>
  JSON.stringify(
    Object.entries(mod).filter(([, v]) => v !== null && typeof v === 'object'),
    (_k, v: unknown) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v)
  );

/** 4. Nema zajedničkog promenljivog objekta (uvek ceo izvoz) i izvršavanje podskupa ne menja izvezene konstante. */
export function sharedObjectsCheck(subsets: Subsets): void {
  const mods = DISTANCES.map((d) => [d.name, d.mod] as const);
  const sets = mods.map(([name, mod]) => [name, reachableObjects(mod)] as const);
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const [a, sa] = sets[i]!;
      const [b, sb] = sets[j]!;
      const shared = [...sa].filter((o) => sb.has(o));
      expect(shared.length, `${a} ↔ ${b}`).toBe(0);
    }
  const before = mods.map(([, mod]) => exportedConstants(mod));
  runAll(DISTANCES, subsets);
  expect(mods.map(([, mod]) => exportedConstants(mod))).toEqual(before);
}

/** Politike sa probnom promenom `deloadFactor` (isti objekti koje generator čita). */
const POLICIES: Record<DistanceName, { deloadFactor: number }> = {
  '5K': HEURISTIC_5K,
  '10K': HEURISTIC_10K,
  HM: HEURISTIC_21K,
  maraton: HEURISTIC_42K
};

/**
 * 5. Probna promena `deloadFactor` u memoriji jednog generatora (cilj), za svaki cilj iz `targets`. Jedini dozvoljeni
 * kanal uticaja na drugi generator je EKSPLICITNA predaja „kraća distanca" (HM nudi 10K/5K plan, maraton HM/10K plan,
 * napravljen generatorom te distance kroz `handoff.ts`). Zato se svaka druga distanca računa dvaput: sa produkcionom
 * predajom (razlika sme da postoji samo kod generatora koji predaje promenjenom) i sa predajom usmerenom na NETAKNUTU
 * instancu (`pristineHandoff`, svež modul) — tada nijedan drugi generator ne sme da se promeni, što dokazuje da njegov
 * sopstveni kod ne čita tuđu politiku. Vraća broj redova promenjenih kroz predaju.
 */
export function policyCheck(
  targets: readonly DistanceName[],
  pristineHandoff: Handoff,
  subsetsFor: (target: DistanceName) => Subsets
): number {
  const production = currentHandoff;
  let viaHandoff = 0;
  for (const target of targets.map(byName)) {
    const subsets = subsetsFor(target.name);
    const policy = POLICIES[target.name];
    const original = policy.deloadFactor;
    try {
      policy.deloadFactor = 0.6; // probna promena SAMO u memoriji ovog testa
      for (const d of DISTANCES) {
        currentHandoff = production;
        const changed = diff(d.run(d.mod, subsets[d.name]), d);
        if (d === target) {
          expect(changed.length, `${d.name} mora da reaguje`).toBeGreaterThan(0);
          continue;
        }
        if (!d.handsOffTo.includes(target.name))
          expect(changed, `${target.name} → ${d.name}`).toEqual([]);
        else viaHandoff += changed.length;
        currentHandoff = pristineHandoff;
        expect(
          diff(d.run(d.mod, subsets[d.name]), d),
          `${target.name} → ${d.name} (netaknuta predaja)`
        ).toEqual([]);
      }
    } finally {
      policy.deloadFactor = original;
      currentHandoff = production;
    }
    expect(diff(target.run(target.mod, subsets[target.name]), target), target.name).toEqual([]);
  }
  return viaHandoff;
}
