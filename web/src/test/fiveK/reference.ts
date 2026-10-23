/* Referentni rezultati 5K: SHA tačnog zapisa (`exact.ts`) po scenariju i po kategoriji. Uzimaju se SAMO iz starog zajedničkog
   mehanizma (`legacyApi`) na polaznom commitu; fajl se ne osvežava iz novog 5K koda. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { FULL, logCompared, part, sample } from '@/test/level';
import { referenceRow, type Category } from './exact';
import type { GeneratorApi } from './legacyApi';
import {
  adaptationBases,
  adaptationFlows,
  generationCases,
  type GenerationCase
} from './scenarios';

export const REFERENCE_FILE = fileURLToPath(
  new URL('../fixtures/fiveK-reference.json.gz', import.meta.url)
);

export interface ReferenceRow {
  full: string;
  parts: Partial<Record<Category, string>>;
  pure: boolean;
}
export interface ReferenceFile {
  baselineSha: string;
  capturedWith: string;
  tz: string;
  generation: Record<string, ReferenceRow>;
  adaptation: Record<string, ReferenceRow>;
}

type Rows = Record<string, ReferenceRow>;
/** Red reference (`exact.ts` › `referenceRow`). `expected` (očekivani red istog imena) samo štedi ponovni obilazak
    stabla kad je ukupni SHA isti; ishod poređenja je isti. */
const row = (value: unknown, pure: boolean, expected?: ReferenceRow): ReferenceRow =>
  referenceRow(value, pure, expected);

export function generationRows(
  api: GeneratorApi,
  pick: (name: string) => boolean = () => true,
  expected?: Rows
): Rows {
  const out: Record<string, ReferenceRow> = {};
  for (const c of generationCases().filter((x) => pick(x.name))) {
    const input = JSON.parse(JSON.stringify(c.input)) as Record<string, unknown>;
    // NaN se ne serijalizuje JSON-om; prenosi se ručno da granični ulaz ostane isti.
    for (const [k, v] of Object.entries(c.input)) if (Number.isNaN(v)) input[k] = v;
    let value: unknown;
    try {
      value = api.generatePlan(input as never);
    } catch (e) {
      value = { thrown: e instanceof Error ? e.message : String(e) };
    }
    if (out[c.name]) throw new Error(`dupli scenario ${c.name}`);
    out[c.name] = row(value, true, expected?.[c.name]);
  }
  return out;
}

/** `bases`: podskup baznih planova (brz nivo i delovi punog nivoa, v. `adaptationSlice`); bez njega — svi. */
export function adaptationRows(
  api: GeneratorApi,
  limitBases?: number,
  expected?: Rows,
  bases?: GenerationCase[]
): Rows {
  const out: Rows = {};
  for (const f of adaptationFlows(api, limitBases, bases)) {
    if (out[f.name]) throw new Error(`dupli tok ${f.name}`);
    out[f.name] = row(f.value, f.pure, expected?.[f.name]);
  }
  return out;
}

/* ------------------------------------------------------------- nivoi testa ekvivalencije (src/test/level.ts)

   Zajedničko za `domain/generators/{fiveK,tenK}/equivalence.node.test.ts` i njihove delove punog nivoa
   (`equivalence.adapt<N>.full.node.test.ts`). Pokrivenost punog nivoa: bazni planovi su podeljeni `part()`-om, svaki deo
   poredi SVE redove reference svojih baznih planova (nedostaje/novo/razlika), a svaki red reference ima tačno jednog
   vlasnika (`rowsByOwner`, prazan `orphans`) — unija delova = cela referenca, svaki red tačno jednom. */

/** Razlike izračunatih redova od očekivanih (isto poređenje kao ranije u testovima ekvivalencije). */
export function compareRows(actual: Rows, expected: Rows): string[] {
  const out: string[] = [];
  for (const [name, ref] of Object.entries(expected)) {
    const got = actual[name];
    if (!got) {
      out.push(`NEDOSTAJE: ${name}`);
      continue;
    }
    if (got.pure !== ref.pure)
      out.push(`${name}: čistoća ${String(got.pure)} ≠ ${String(ref.pure)}`);
    if (got.full !== ref.full) {
      const parts = Object.keys(ref.parts).filter(
        (k) => got.parts[k as keyof typeof got.parts] !== ref.parts[k as keyof typeof ref.parts]
      );
      out.push(`${name}: razlika u [${parts.join(', ') || 'redosled/oblik'}]`);
    }
  }
  for (const name of Object.keys(actual)) if (!expected[name]) out.push(`NOVO: ${name}`);
  return out;
}

/** Redovi `rows` sa imenima `names` (ime koga nema u `rows` se preskače). */
export function pickRows(rows: Rows, names: Iterable<string>): Rows {
  const out: Rows = {};
  for (const n of names) if (rows[n]) out[n] = rows[n];
  return out;
}

/**
 * Raspodela redova po vlasniku: red `<vlasnik> · …` pripada vlasniku iz `owners` (ime baznog plana; za 10K i `event`).
 * Red kome odgovara više vlasnika je greška harnesa (izuzetak); red bez vlasnika ide u `orphans`.
 */
export function rowsByOwner(
  names: Iterable<string>,
  owners: readonly string[]
): { byOwner: Map<string, string[]>; orphans: string[] } {
  const byOwner = new Map<string, string[]>(owners.map((o) => [o, []]));
  const prefixes = owners.map((o) => [o, `${o} · `] as const);
  const orphans: string[] = [];
  for (const name of names) {
    const own = prefixes.filter(([, p]) => name.startsWith(p)).map(([o]) => o);
    if (own.length > 1) throw new Error(`red ${name} ima više vlasnika: ${own.join(' | ')}`);
    if (own[0] === undefined) orphans.push(name);
    else byOwner.get(own[0])!.push(name);
  }
  return { byOwner, orphans };
}

/** Kategorija ulaza ili baznog plana po imenu: `fingerprint`, `qa`, `seeded`, `edge` (10K: `seeded10k`, `edge10k`). */
export const categoryOfName = (name: string): string => name.split(' · ')[0] ?? '';

/** Broj delova adaptacije 5K u punom nivou: deo 1 je u `equivalence.node.test.ts`, ostali u
    `equivalence.adapt<N>.full.node.test.ts`. */
export const ADAPTATION_PARTS = 3;

const FIVE_K_KEEP = /^edge · (lestvica|iskusan)$/;

/**
 * Bazni planovi adaptacije 5K koje proverava deo `index` (1…`ADAPTATION_PARTS`) u punom nivou, odnosno uzorak u brzom:
 * svaki 7. unutar kategorije (qa / seeded / edge; prvi uvek) + imenovani rubni `edge · lestvica` (run/walk lestvica)
 * i `edge · iskusan` (greška generisanja). U brzom nivou `index` ne utiče.
 */
export function adaptationSlice(index: number): GenerationCase[] {
  const all = adaptationBases();
  if (!FULL && index !== 1)
    throw new Error(`deo ${index} adaptacije 5K postoji samo u punom nivou`);
  if (!FULL)
    return sample(
      all,
      7,
      (b) => categoryOfName(b.name),
      (b) => FIVE_K_KEEP.test(b.name)
    );
  return part(all, index, ADAPTATION_PARTS);
}

/**
 * Adaptacija 5K za deo `index` (v. `adaptationSlice`): izračunati redovi, deo reference koji im odgovara (SVI redovi
 * reference izabranih baznih planova, u redosledu reference; beleži se `logCompared`) i redovi reference bez vlasnika
 * među SVIM baznim planovima (mora biti prazno).
 */
export function adaptationPart(
  api: GeneratorApi,
  reference: Rows,
  index: number
): { rows: Rows; expected: Rows; orphans: string[] } {
  const bases = adaptationSlice(index);
  const { byOwner, orphans } = rowsByOwner(
    Object.keys(reference),
    adaptationBases().map((b) => b.name)
  );
  const chosen = new Set(bases.flatMap((b) => byOwner.get(b.name) ?? []));
  const expected = pickRows(
    reference,
    Object.keys(reference).filter((n) => chosen.has(n))
  );
  logCompared('fiveK.adaptation', Object.keys(expected));
  return { rows: adaptationRows(api, undefined, reference, bases), expected, orphans };
}

/** API generatora za harnes (isti oblik kao ranije u testovima ekvivalencije): izvozi modula generatora po imenu. */
export function generatorApi(m: GeneratorApi): GeneratorApi {
  return {
    generatePlan: m.generatePlan,
    assess: m.assess,
    adaptGeneratedPlan: m.adaptGeneratedPlan,
    resolvePlan: m.resolvePlan,
    executionModel: m.executionModel,
    buildExecutionAdjustment: m.buildExecutionAdjustment,
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
}

export function loadReference(): ReferenceFile | null {
  if (!existsSync(REFERENCE_FILE)) return null;
  return JSON.parse(gunzipSync(readFileSync(REFERENCE_FILE)).toString('utf8')) as ReferenceFile;
}

export function writeReference(file: ReferenceFile): void {
  writeFileSync(REFERENCE_FILE, gzipSync(JSON.stringify(file), { level: 9 }));
}
