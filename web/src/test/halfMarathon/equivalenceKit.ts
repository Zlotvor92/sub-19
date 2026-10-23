/* NIVOI TESTA EKVIVALENCIJE POLUMARATONA I MARATONA (src/test/level.ts, docs/testing/TEST-SPEED.md).

   Zajednički kod glavnih fajlova `generators/{halfMarathon,marathon}/equivalence.node.test.ts` i njihovih delova punog
   nivoa `equivalence.<deo>.full.node.test.ts` (maraton ga deli sa HM kao i `HmApi`). Tvrdnje su iste kao pre podele:
   tačan zapis (`fiveK/exact.ts`) svakog poređenog reda = referenca, čistoća ulaza, isti brojevi nad celim skupom.

   - BRZ nivo: deterministički uzorak baznih planova/ulaza (`sample`: prvi u svakoj kategoriji imena, pa svaki k-ti,
     plus imenovani rubni slučajevi); poredi se tačno deo reference koji pripada uzorku (`ownerOf`).
   - PUN nivo: svi redovi. Bazni planovi se dele `part()`-om na delove (glavni fajl = deo 1, ostali u
     `*.full.node.test.ts`); svaki deo poredi svoj podskup sa referencom za taj podskup u OBA smera (nedostaje / novo).
     Pokrivenost celog skupa proverava se jeftino, bez računanja: svaki red reference pripada tačno jednom baznom planu
     (ili je događaj), a delovi `part()` su particija baznih planova. Unija delova = cela referenca, svaki red jednom.
   - Svako mesto poređenja beleži imena poređenih redova (`logCompared`, `TEST_ROWS_LOG`). */
import { readdirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, vi } from 'vitest';
import { referenceRow } from '@/test/fiveK/exact';
import type { ReferenceRow } from '@/test/fiveK/reference';
import type { FlowResult, GenerationCase } from '@/test/fiveK/scenarios';
import { FULL, logCompared, part, sample, samplePick } from '@/test/level';

export type Rows = Record<string, ReferenceRow>;

/** Razlike izlaza i reference: nedostaje, novo, čistoća, kategorije koje se razlikuju. */
export function compare(actual: Rows, expected: Rows): string[] {
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

/** Redovi tokova (isto što `rows()` u `src/test/<distanca>/reference.ts`), uz `expected` (v. `exact.ts` › `referenceRow`). */
export function flowRows(flows: readonly FlowResult[], expected?: Rows): Rows {
  const out: Rows = {};
  for (const f of flows) {
    if (out[f.name]) throw new Error(`dupli tok ${f.name}`);
    out[f.name] = referenceRow(f.value, f.pure, expected?.[f.name]);
  }
  return out;
}

const SEP = ' · ';

/** Kategorija imena: deo pre prvog „ · " (`qa`, `seededM`, `mTrack`, `edgeM`, `fingerprint`, …). */
export function categoryOf(name: string): string {
  const i = name.indexOf(SEP);
  return i < 0 ? name : name.slice(0, i);
}

/** Bazni plan kome red pripada: najduže ime baznog plana koje je početak imena reda do granice „ · ". */
export function ownerOf(baseNames: Iterable<string>): (row: string) => string | undefined {
  const names = new Set(baseNames);
  return (row) => {
    let owner: string | undefined;
    for (let i = row.indexOf(SEP); i >= 0; i = row.indexOf(SEP, i + SEP.length)) {
      const prefix = row.slice(0, i);
      if (names.has(prefix)) owner = prefix;
    }
    return owner;
  };
}

export function subset(rows: Rows, keep: (name: string) => boolean): Rows {
  return Object.fromEntries(Object.entries(rows).filter(([name]) => keep(name)));
}

const byName = (bases: readonly GenerationCase[]): string[] => bases.map((b) => b.name);

/** `part()` delovi 1…count su particija niza: disjunktni, unija = ceo niz (jeftina provera pokrivenosti). */
function expectPartition(names: readonly string[], count: number): void {
  const parts = Array.from({ length: count }, (_, i) => part(names, i + 1, count));
  expect(parts.flat().length).toBe(names.length);
  expect(new Set(parts.flat())).toEqual(new Set(names));
  for (const p of parts) expect(p.length).toBeGreaterThan(0);
}

/** Delovi 2… postoje samo u punom nivou (u brzom ih `vitest.config.ts` ne uključuje; ovo je zaštita). */
function onlyFull(index: number): void {
  if (index !== 1) throw new Error(`deo ${index} postoji samo u punom nivou (TEST_FULL=1)`);
}

export type PartKind = 'adapt' | 'decisions' | 'tz';

const PART_FILE = /^equivalence\.(adapt|decisions|tz)(\d+)\.full\.node\.test\.ts$/;

/** Indeks dela iz imena fajla dela (`equivalence.adapt3.full.node.test.ts` → 3): fajlovi delova su isti, pa ime ne
 *  može da se razlikuje od dela koji fajl stvarno pokreće. */
export function partIndexOf(fileUrl: string, kind: PartKind): number {
  const m = PART_FILE.exec(basename(fileURLToPath(fileUrl)));
  if (!m || m[1] !== kind) throw new Error(`nije fajl dela ${kind}: ${fileUrl}`);
  return Number(m[2]);
}

/** Fajlovi delova 2…count postoje tačno za podešen broj delova (deo 1 je glavni fajl): nijedan deo ne fali, nema viška. */
export function expectPartFiles(mainFileUrl: string, kind: PartKind, count: number): void {
  const files = readdirSync(dirname(fileURLToPath(mainFileUrl)))
    .map((f) => PART_FILE.exec(f))
    .filter((m): m is RegExpExecArray => m !== null && m[1] === kind)
    .map((m) => Number(m[2]))
    .sort((a, b) => a - b);
  expect(files, `delovi ${kind}`).toEqual(Array.from({ length: count - 1 }, (_, i) => i + 2));
}

/** Podešavanje jedne distance (HM ili maraton). */
export interface EquivalenceSetup {
  /** Prefiks evidencije redova: `<id>.generation` / `<id>.adaptation` / `<id>.decisions`. */
  id: string;
  /** Za poruke o satu/slučajnosti („u HM generatoru"). */
  label: string;
  reference: { generation: Rows; adaptation: Rows; decisions: Rows };
  generationNames: () => string[];
  generationRows: (pick: (name: string) => boolean, expected?: Rows) => Rows;
  adaptationBases: () => GenerationCase[];
  /** Opšti tokovi (`fiveK/scenarios.ts` › `adaptationFlows`) + taper tokovi za date bazne planove. */
  adaptationFlows: (bases: GenerationCase[]) => FlowResult[];
  /** Originalni QA događaji (`event · …`): jeftini, u glavnom fajlu u oba nivoa. */
  eventFlows: () => FlowResult[];
  eventCount: number;
  decisionBases: () => GenerationCase[];
  decisionFlows: (bases: GenerationCase[]) => FlowResult[];
  /** Tvrdnje o brojevima nad ključevima odluka (ceo skup). */
  decisionCounts: (keys: string[]) => void;
  /** Ulazi generisanja u testu vremenske zone (pun nivo: današnji izbor). */
  tzGenerationPick: (name: string) => boolean;
  /** Pun nivo: broj delova po `it`. Deo 1 je u glavnom fajlu. */
  parts: { adaptation: number; decisions: number; timezone: number };
  /** Brz nivo: k i imenovani rubni slučajevi. */
  fast: {
    generationK: number;
    generationKeep: (name: string) => boolean;
    adaptationK: number;
    adaptationKeep: (name: string) => boolean;
    decisionK: number;
    decisionKeep: (name: string) => boolean;
    tzGenerationK: number;
    /** Bazni plan adaptacije u testu vremenske zone (pun nivo: prva tri). */
    tzAdaptationBase: string;
  };
}

/* ------------------------------------------------------------------ generisanje */

export function checkGeneration(s: EquivalenceSetup): void {
  const ref = s.reference.generation;
  const names = s.generationNames();
  // Pokrivenost (bez računanja): ulazi i redovi reference su isti skup, pa je uzorak ulaza uzorak reference.
  expect(new Set(names).size).toBe(names.length);
  expect(new Set(names)).toEqual(new Set(Object.keys(ref)));
  const pick = FULL
    ? (): boolean => true
    : samplePick(names, s.fast.generationK, categoryOf, s.fast.generationKeep);
  const expected = FULL ? ref : subset(ref, pick);
  const rows = s.generationRows(pick, expected);
  logCompared(`${s.id}.generation`, Object.keys(expected));
  const diff = compare(rows, expected);
  expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
  expect(Object.keys(ref).length).toBeGreaterThan(1500);
}

/* ------------------------------------------------------------------ adaptacija */

/** Bazni planovi adaptacije: brz nivo — uzorak; pun nivo — deo `index` od `parts.adaptation`. */
export function adaptationBasesFor(s: EquivalenceSetup, index = 1): GenerationCase[] {
  const all = s.adaptationBases();
  if (FULL) return part(all, index, s.parts.adaptation);
  onlyFull(index);
  return sample(
    all,
    s.fast.adaptationK,
    (b) => categoryOf(b.name),
    (b) => s.fast.adaptationKeep(b.name)
  );
}

/** Jeftino, bez računanja tokova: svaki red reference adaptacije pripada tačno jednom baznom planu ili je događaj, a
 *  delovi punog nivoa su particija baznih planova — unija delova je cela referenca. */
export function checkAdaptationCoverage(s: EquivalenceSetup): void {
  const ref = s.reference.adaptation;
  const bases = byName(s.adaptationBases());
  expect(new Set(bases).size).toBe(bases.length);
  const owner = ownerOf(bases);
  const owners = new Set<string>();
  const orphans: string[] = [];
  for (const k of Object.keys(ref)) {
    const o = owner(k);
    if (o) owners.add(o);
    else if (!k.startsWith('event · ')) orphans.push(k);
  }
  expect(orphans.slice(0, 20)).toEqual([]);
  expect(bases.filter((b) => !owners.has(b))).toEqual([]);
  expect(Object.keys(ref).filter((k) => k.startsWith('event · ')).length).toBe(s.eventCount);
  expectPartition(bases, s.parts.adaptation);
}

/** Tokovi adaptacije za `bases` (+ događaji) = referenca za te bazne planove (+ događaje); ulazi se ne menjaju. */
export function checkAdaptation(
  s: EquivalenceSetup,
  bases: GenerationCase[],
  withEvents: boolean
): void {
  const ref = s.reference.adaptation;
  const owner = ownerOf(byName(s.adaptationBases()));
  const chosen = new Set(byName(bases));
  const expected = subset(ref, (k) => {
    const o = owner(k);
    return o !== undefined ? chosen.has(o) : withEvents && k.startsWith('event · ');
  });
  const rows = flowRows(
    [...s.adaptationFlows(bases), ...(withEvents ? s.eventFlows() : [])],
    expected
  );
  logCompared(`${s.id}.adaptation`, Object.keys(expected));
  if (withEvents)
    expect(Object.keys(rows).filter((k) => k.startsWith('event · ')).length).toBe(s.eventCount);
  // Ceo skup: > 500 taper redova (reference); ovde poređen podskup = referenca za taj podskup, unija delova = referenca.
  const taper = (k: string): boolean => k.includes(' · taper −');
  expect(Object.keys(ref).filter(taper).length).toBeGreaterThan(500);
  expect(Object.keys(rows).filter(taper).length).toBeGreaterThan(0);
  const diff = compare(rows, expected);
  expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
  expect(Object.values(rows).every((r) => r.pure)).toBe(true);
}

/* ------------------------------------------------------------------ odluke o pripremi */

export function decisionBasesFor(s: EquivalenceSetup, index = 1): GenerationCase[] {
  const all = s.decisionBases();
  if (FULL) return part(all, index, s.parts.decisions);
  onlyFull(index);
  return sample(
    all,
    s.fast.decisionK,
    (b) => categoryOf(b.name),
    (b) => s.fast.decisionKeep(b.name)
  );
}

/** Odluke za `bases` = referenca za te bazne planove. Brojevi (ceo skup) se tvrde nad ključevima reference: poređeni
 *  podskup = referenca, a svaki red reference pripada jednom baznom planu i delovi su particija (unija = referenca). */
export function checkDecisions(s: EquivalenceSetup, bases: GenerationCase[]): void {
  const ref = s.reference.decisions;
  const all = byName(s.decisionBases());
  expect(new Set(all).size).toBe(all.length);
  const owner = ownerOf(all);
  expect(
    Object.keys(ref)
      .filter((k) => !owner(k))
      .slice(0, 20)
  ).toEqual([]);
  expectPartition(all, s.parts.decisions);
  const chosen = new Set(byName(bases));
  const expected = subset(ref, (k) => chosen.has(owner(k)!));
  const rows = flowRows(s.decisionFlows(bases), expected);
  logCompared(`${s.id}.decisions`, Object.keys(expected));
  const diff = compare(rows, expected);
  expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
  s.decisionCounts(Object.keys(ref));
  if (FULL && bases.length === all.length) s.decisionCounts(Object.keys(rows));
  expect(Object.values(rows).every((r) => r.pure)).toBe(true);
}

/* ------------------------------------------------------------------ vremenska zona, sat, slučajnost */

export const ZONES = ['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC'] as const;

/** Pun nivo: zone dela `index` (sve zone kroz delove), današnji izbor generisanja i prva tri bazna plana adaptacije.
 *  Brz nivo: sve četiri zone, uzorak tog izbora generisanja i jedan bazni plan. */
export function checkTimezone(s: EquivalenceSetup, index = 1): void {
  if (!FULL) onlyFull(index);
  const zones = FULL ? part(ZONES, index, s.parts.timezone) : [...ZONES];
  if (index === 1) expectPartition(ZONES, s.parts.timezone);
  const genNames = s.generationNames().filter(s.tzGenerationPick);
  const genPick = FULL
    ? s.tzGenerationPick
    : samplePick(genNames, s.fast.tzGenerationK, categoryOf);
  const all = s.adaptationBases();
  const bases = FULL ? all.slice(0, 3) : all.filter((b) => b.name === s.fast.tzAdaptationBase);
  expect(bases.length).toBe(FULL ? 3 : 1);
  const owner = ownerOf(byName(all));
  const chosen = new Set(byName(bases));
  const expectedGen = subset(s.reference.generation, genPick);
  const expectedAdapt = subset(s.reference.adaptation, (k) => chosen.has(owner(k) ?? ''));
  const tz = process.env['TZ'];
  const RealDate = Date;
  try {
    // Domen ne sme da čita sat ni slučajnost: svaki takav poziv bi ovde pao.
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error(`Math.random u ${s.label}`);
    });
    class NoClockDate extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) throw new Error(`new Date() bez argumenta u ${s.label}`);
        super(...(args as [string]));
      }
      static override now(): number {
        throw new Error(`Date.now u ${s.label}`);
      }
    }
    for (const zone of zones) {
      process.env['TZ'] = zone;
      globalThis.Date = NoClockDate as DateConstructor;
      const gen = s.generationRows(genPick, expectedGen);
      const adapt = flowRows(s.adaptationFlows(bases), expectedAdapt);
      globalThis.Date = RealDate;
      logCompared(`${s.id}.generation`, Object.keys(expectedGen));
      logCompared(`${s.id}.adaptation`, Object.keys(expectedAdapt));
      const diff = [...compare(gen, expectedGen), ...compare(adapt, expectedAdapt)];
      expect(diff, zone).toEqual([]);
      // Veličina poređenog izbora (pun: današnji pragovi; brz: uzorak).
      expect(Object.keys(gen).length).toBeGreaterThan(FULL ? 200 : 30);
      expect(Object.keys(adapt).length).toBeGreaterThan(FULL ? 500 : 300);
    }
  } finally {
    globalThis.Date = RealDate;
    process.env['TZ'] = tz;
    vi.restoreAllMocks();
  }
}
