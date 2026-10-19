/* Referenca za 10K/HM/maraton, uzeta na polaznom commitu (pre izdvajanja 5K) — v. `captureOtherReference.node.test.ts`. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { logCompared, part, sample } from '@/test/level';
import { referenceRow } from './exact';
import type { GeneratorApi } from './legacyApi';
import {
  decisionFlows,
  otherAdaptationBases,
  otherAdaptationFlows,
  otherGenerationCases,
  type DecisionApi
} from './otherScenarios';
import type { ReferenceRow } from './reference';
import type { FlowResult, GenerationCase } from './scenarios';

export const OTHER_REFERENCE_FILE = fileURLToPath(
  new URL('../fixtures/otherDistances-reference.json.gz', import.meta.url)
);

export interface OtherReferenceFile {
  baselineSha: string;
  generation: Record<string, ReferenceRow>;
  adaptation: Record<string, ReferenceRow>;
  decisions: Record<string, ReferenceRow>;
}

type Rows = Record<string, ReferenceRow>;
/** Red reference (`exact.ts` › `referenceRow`). `expected` (očekivani red istog imena) samo štedi ponovni obilazak
    stabla kad je ukupni SHA isti; ishod poređenja je isti. */
const row = (value: unknown, pure: boolean, expected?: ReferenceRow): ReferenceRow =>
  referenceRow(value, pure, expected);
function rows(flows: FlowResult[], expected?: Rows): Rows {
  const out: Rows = {};
  for (const f of flows) {
    if (out[f.name]) throw new Error(`dupli tok ${f.name}`);
    out[f.name] = row(f.value, f.pure, expected?.[f.name]);
  }
  return out;
}

/**
 * Podskup ulaza (brz nivo i delovi punog nivoa, `src/test/level.ts`). Bez izbora — svi ulazi, kao ranije. Imena tokova
 * adaptacije i odluka počinju imenom baznog plana (`rowsOfBases`).
 */
export interface OtherSelection {
  /** Ulazi generisanja (`otherGenerationCases`). */
  generation?: (c: GenerationCase) => boolean;
  /** Bazni planovi tokova adaptacije (`otherAdaptationBases`). */
  adaptation?: (base: GenerationCase) => boolean;
  /** Bazni planovi odluka o pripremi (`otherAdaptationBases`). */
  decisions?: (base: GenerationCase) => boolean;
}

const all = (): boolean => true;

export function otherRows(
  api: GeneratorApi,
  decisions: DecisionApi,
  expected?: Omit<OtherReferenceFile, 'baselineSha'>,
  select: OtherSelection = {}
): Omit<OtherReferenceFile, 'baselineSha'> {
  const generation: Rows = {};
  for (const c of otherGenerationCases().filter(select.generation ?? all)) {
    if (generation[c.name]) throw new Error(`dupli scenario ${c.name}`);
    let value: unknown;
    try {
      value = api.generatePlan(JSON.parse(JSON.stringify(c.input)) as never);
    } catch (e) {
      value = { thrown: e instanceof Error ? e.message : String(e) };
    }
    generation[c.name] = row(value, true, expected?.generation[c.name]);
  }
  const bases = otherAdaptationBases();
  return {
    generation,
    adaptation: rows(
      otherAdaptationFlows(api, bases.filter(select.adaptation ?? all)),
      expected?.adaptation
    ),
    decisions: rows(
      decisionFlows(api, decisions, bases.filter(select.decisions ?? all)),
      expected?.decisions
    )
  };
}

/** Distanca ulaza i vrsta (`fingerprint` / `qa` / `seeded`) — kategorija uzorka generisanja i baznih planova. */
export const otherCategory = (c: GenerationCase): string =>
  `${String(c.input['raceDistM'])} · ${c.name.split(' ')[0]!}`;

/** Broj baznih planova kojima red (adaptacije ili odluke) pripada: ime reda počinje „<ime baznog plana> · ". */
function basesOfRow(bases: readonly GenerationCase[]): (name: string) => number {
  const prefixes = bases.map((b) => `${b.name} · `);
  return (name) => prefixes.filter((p) => name.startsWith(p)).length;
}

/** Redovi reference koji pripadaju datim baznim planovima. */
export function rowsOfBases(rowsIn: Rows, bases: readonly GenerationCase[]): Rows {
  const count = basesOfRow(bases);
  return Object.fromEntries(Object.entries(rowsIn).filter(([name]) => count(name) > 0));
}

/** Redovi reference sa datim imenima. */
export const rowsNamed = (rowsIn: Rows, names: Iterable<string>): Rows =>
  Object.fromEntries([...names].filter((n) => rowsIn[n]).map((n) => [n, rowsIn[n]!]));

/** Razlike prema referenci u oba smera: nedostaje, novo, različit tačan zapis (sa kategorijama razlike). */
export function compareOther(actual: Rows, expected: Rows): string[] {
  const out: string[] = [];
  for (const [name, ref] of Object.entries(expected)) {
    const got = actual[name];
    if (!got) out.push(`NEDOSTAJE: ${name}`);
    else if (got.full !== ref.full || got.pure !== ref.pure) {
      const parts = Object.keys(ref.parts).filter(
        (k) => got.parts[k as keyof typeof got.parts] !== ref.parts[k as keyof typeof ref.parts]
      );
      out.push(`${name}: razlika u [${parts.join(', ')}]`);
    }
  }
  for (const name of Object.keys(actual)) if (!expected[name]) out.push(`NOVO: ${name}`);
  return out;
}

/** Redovi (adaptacije ili odluka) koji ne pripadaju TAČNO jednom baznom planu — prazno znači da su delovi po baznim
    planovima particija reference (unija delova = svi redovi, svaki tačno jednom). */
export function rowsWithoutSingleBase(rowsIn: Rows, bases: readonly GenerationCase[]): string[] {
  const count = basesOfRow(bases);
  return Object.keys(rowsIn).filter((name) => count(name) !== 1);
}

/**
 * Izračunava izabrani podskup (`select`) i poredi ga u oba smera sa ODGOVARAJUĆIM delom reference: generisanje po
 * imenima izabranih ulaza, adaptacija i odluke po baznim planovima. Bez izbora — cela referenca, kao ranije. Poređeni
 * redovi se beleže (`logCompared`, `otherDistances.<deo reference>`).
 */
export function compareOtherSelection(
  api: GeneratorApi,
  decisions: DecisionApi,
  reference: OtherReferenceFile,
  select: OtherSelection = {}
): { now: Omit<OtherReferenceFile, 'baselineSha'>; diff: string[] } {
  const bases = otherAdaptationBases();
  const expected = {
    generation: rowsNamed(
      reference.generation,
      otherGenerationCases()
        .filter(select.generation ?? all)
        .map((c) => c.name)
    ),
    adaptation: rowsOfBases(reference.adaptation, bases.filter(select.adaptation ?? all)),
    decisions: rowsOfBases(reference.decisions, bases.filter(select.decisions ?? all))
  };
  const now = otherRows(api, decisions, reference, select);
  for (const k of ['generation', 'adaptation', 'decisions'] as const)
    logCompared(`otherDistances.${k}`, Object.keys(expected[k]));
  return {
    now,
    diff: [
      ...compareOther(now.generation, expected.generation),
      ...compareOther(now.adaptation, expected.adaptation),
      ...compareOther(now.decisions, expected.decisions)
    ]
  };
}

/* NIVOI (`src/test/level.ts`). PUN: tokovi adaptacije su podeljeni na `OTHER_FULL_PARTS` delova po baznim planovima
   (`part`, svaki bazni plan tačno u jednom delu); deo 1 (glavni fajl `otherDistances.node.test.ts`) uz to poredi celo
   generisanje i sve odluke o pripremi, delovi 2…n su `otherDistances.adapt<n>.full.node.test.ts`. BRZ: uzorak po
   distanci i vrsti ulaza (`otherCategory`) — generisanje svaki `FAST_GENERATION_EVERY`-ti ulaz + svi QA ulazi, adaptacija
   nad prvim baznim planom svake kategorije, odluke o pripremi nad svim baznim planovima (jeftine). */
export const OTHER_FULL_PARTS = 4;
const FAST_GENERATION_EVERY = 10;
/** Kategorija baznih planova ima najviše 16 članova, pa uzorak uzima prvi (QA: U04/U07/U09; seeded: indeks 0). */
const FAST_BASE_EVERY = 100;

/** Deo `index` (1…`OTHER_FULL_PARTS`) punog nivoa. */
export function otherFullPart(index: number): OtherSelection {
  const mine = new Set(part(otherAdaptationBases(), index, OTHER_FULL_PARTS).map((b) => b.name));
  return {
    generation: () => index === 1,
    adaptation: (b) => mine.has(b.name),
    decisions: () => index === 1
  };
}

/** Uzorak brzog nivoa (deterministički). */
export function otherFastSelection(): OtherSelection {
  const generation = new Set(
    sample(otherGenerationCases(), FAST_GENERATION_EVERY, otherCategory, (c) =>
      c.name.startsWith('qa · ')
    ).map((c) => c.name)
  );
  const bases = new Set(
    sample(otherAdaptationBases(), FAST_BASE_EVERY, otherCategory).map((b) => b.name)
  );
  return {
    generation: (c) => generation.has(c.name),
    adaptation: (b) => bases.has(b.name),
    decisions: all
  };
}

export function loadOtherReference(): OtherReferenceFile | null {
  if (!existsSync(OTHER_REFERENCE_FILE)) return null;
  return JSON.parse(
    gunzipSync(readFileSync(OTHER_REFERENCE_FILE)).toString('utf8')
  ) as OtherReferenceFile;
}

export function writeOtherReference(file: OtherReferenceFile): void {
  writeFileSync(OTHER_REFERENCE_FILE, gzipSync(JSON.stringify(file), { level: 9 }));
}
