/* Segment 04 (10k-v2.4.0): adaptacija — assess → isti konstruktor → zaštita → validate. Mreža scenarija
   (30 baznih planova × 4 asOf × 17 scenarija), pouka 7 (a–g), invarijante nezavisno od validatora
   (adaptInvariants.ts) i po jedan test za svaku odluku A1–A15. Na b13ca17 fajl pada ceo (adapt.ts ne
   postoji). Regresija generate (bajt-isto kao b13ca17): grid / feelGrid / beginnerGrid. Segment 06b
   (10k-v2.4.1, A4/A16): regresija mreže prema e6540a5 — menjaju se samo tokovi sa primenjenim PAIN
   (segment06b.adapt-hashes-e6540a5.json); mreža bola P: painGrid.node.test.ts. Segment 06c (10k-v2.5.0,
   A17): regresija prema 4917959 — menjaju se samo tokovi sa ukinutim rasterećenjem ili porukom N2
   (segment06c.adapt-hashes-4917959.json; heš bez oznake verzije i polja reduced); mreža R: reliefGrid. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, logCompared, sample } from '@/test/level';
import {
  at7ba,
  countViolations,
  expectCounts,
  GRID_TIMEOUT,
  p35FlowErrors,
  p37FlowErrors,
  p07FlowErrors,
  p08Errors
} from './level.harness.node.test.ts';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays, mustDay } from './dates.ts';
import { construct, generateTenKV2 } from './generate.ts';
import { round1 } from './paces.ts';
import { periodize, rePeriodize, deloadAllowed, isBuildPhase } from './periodize.ts';
import { dayRule, TEN_K_V2_POLICY as P } from './policy.ts';
import {
  adaptBases,
  AS_OF_KINDS,
  asOfOf,
  factsOf,
  feelGridInputs,
  fnv1a,
  inputOf,
  planHash06c,
  dump08,
  planHash81,
  runsIn,
  SCENARIOS,
  SCHEDULES_BY_DAYS,
  timeForVdot,
  mark07
} from './testInputs.ts';
import type { AdaptResult, PlanWeek, TenKV2Facts, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { raceWeek, type WeekContext } from './week.ts';
import { warmupCooldown } from './workouts.ts';
import { checkInput } from './input.ts';

const A = P.adapt;
const HASHES_E65 = join(
  dirname(fileURLToPath(import.meta.url)),
  'segment06b.adapt-hashes-e6540a5.json'
);
const HASHES_491 = join(
  dirname(fileURLToPath(import.meta.url)),
  'segment06c.adapt-hashes-4917959.json'
);
/** 06d (10k-v2.5.1, prošlost = upisani dani): heševi mreže 04 na 51a924f i tokovi porodice 1 — promenjeni jer je
    zaštićen prošli dan (taper: RP ili lagan) upisan drugačije nego što ga je konstruktor sastavljao
    (docs/10k-v2/artifacts/segment-06d/family1-grid04.json). Starije regresije (e6540a5, 4917959) za njih
    porede stanje 51a924f; tačno ti tokovi se menjaju (test 06d). */
const H51 = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'segment06d.adapt-hashes-51a924f.json'),
    'utf8'
  )
) as { against: string; family1: string[]; grid04: Record<string, number> };
const FAMILY1 = new Set(H51.family1);
/** Heš toka za starije regresije: porodica 1 → stanje 51a924f; 06f (pouka 35) → stanje 7ba9717. */
const asOf51 = (key: string, h: number): number =>
  FAMILY1.has(key) ? H51.grid04[key]! : at7ba('grid04', key, h);
/** 06b: promenjeni tokovi mreže 04 prema e6540a5 po scenariju (svi sa primenjenim PAIN; nepromenjeni PAIN
    tokovi su bez povratka — r je taper: asOf u taperu i kraj ned 8 u planovima od 10 ned). 06c (A17): i
    tokovi sa ukinutim rasterećenjem (heš bez polja reduced). */
const CHANGED_06B = { pain5: 80, pain8: 80, painPause: 80 };
/** 06c: promenjeni tokovi mreže 04 prema 4917959 po scenariju (svi sa A17 ili porukom N2). */
const CHANGED_06C = {
  under50: 40,
  pause10: 40,
  pause20: 40,
  pain5: 20,
  pain8: 20,
  chain: 60,
  painPause: 72
};
/** 06c: tokovi mreže 04 koji se od 4917959 razlikuju SAMO po polju reduced, po scenariju. */
const REDUCED_ONLY_06C = {
  under50: 40,
  over120: 80,
  pause10: 80,
  pause20: 80,
  pause35: 120,
  chain: 60,
  painPause: 48
};
/** Brz nivo: unutar scenarija svaki K-ti tok (redosled plan, pa asOf; 5 je uzajamno prost sa 4 asOf-a → svi asOf-ovi,
    24 od 30 baznih planova po scenariju); brojke celog skupa kvalitativno (level.harness.node.test.ts › expectCounts). */
const K = 5;
const bases = adaptBases();
const plans = new Map(
  bases.map((b) => {
    const r = generateTenKV2(b.input);
    if (!r.ok) throw new Error(`${b.id}: ${JSON.stringify(r.reasons)}`);
    return [b.id, r.plan] as const;
  })
);
const plan = (id: string): TenKV2Plan => plans.get(id)!;
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const isBuild = (w: PlanWeek): boolean => isBuildPhase(w.phase);
const applied = (r: AdaptResult, c: string): boolean =>
  r.ok && r.reasons.some((x) => x.condition === c && x.applied);
const sameWeeks = (a: TenKV2Plan, b: TenKV2Plan, from = 1): boolean =>
  a.weeks.every((w, i) => i + 1 < from || JSON.stringify(w) === JSON.stringify(b.weeks[i]));
const quality = (w: PlanWeek): number => w.days.filter((d) => d.workout.kind === 'quality').length;
/** Drugi korak lanca: manjak 50 % u 7 dana do asOf + 7 (posle pauze 10). */
const chainFacts = (p: TenKV2Plan, a2: string): TenKV2Facts => ({
  workouts: [
    ...runsIn(p, addDays(a2, -13), addDays(a2, -7)),
    ...runsIn(p, addDays(a2, -6), a2, 0.5)
  ] as unknown as TenKV2Facts['workouts'],
  coverage: { from: addDays(a2, -13), to: a2, complete: true }
});

describe('mreža scenarija: 30 baznih planova × 4 asOf × 17 scenarija = 2040 adaptacija', () => {
  const rejected: string[] = [];
  const errors: Record<string, number> = {};
  const bad: string[] = [];
  const hashes: number[] = [];
  const p35Flows: { key: string; id: string; hash: number; res: unknown }[] = [];
  /** 06b: heš bez oznake verzije po toku (`id/asOf/scenarij`) i tokovi sa primenjenim PAIN. */
  const h81: Record<string, number> = {};
  /** 06c: heš bez oznake verzije i polja reduced; tokovi sa ukinutim rasterećenjem (A17) i porukom N2. */
  const h06c: Record<string, number> = {};
  const a17 = new Set<string>();
  const n2 = new Set<string>();
  const painApplied = new Set<string>();
  const painBack = new Set<string>();
  /** 06c: polje reduced svakog novog koraka prema primenjenom uslovu obima istog prilagođavanja. */
  const reducedBad: string[] = [];
  const reducedSeen: Record<string, number> = {};
  const checkReduced = (key: string, r: AdaptResult): void => {
    if (!r.ok) return;
    const st = r.plan.adaptation!.steps.at(-1)!;
    const on = (c: string): boolean => r.reasons.some((x) => x.condition === c && x.applied);
    const want =
      on('PAUSE') || on('UNDER_EXECUTION') ? true : on('OVER_EXECUTION') ? false : undefined;
    const v = 'reduced' in st ? String(st.reduced) : 'absent';
    reducedSeen[v] = (reducedSeen[v] ?? 0) + 1;
    if (st.reduced !== want || (want === undefined && 'reduced' in st))
      reducedBad.push(`${key}: reduced ${v}, uslov ${String(want)}`);
  };
  const stats: Record<string, Record<string, number>> = {};
  type Case = { id: string; k: string; s: string; asOf: string; facts: TenKV2Facts };
  /** Svi tokovi mreže (jeftino) i izračunati (brz: uzorak; pun: svi). */
  const all: Case[] = [];
  let cases: Case[] = [];
  beforeAll(() => {
    for (const b of bases)
      for (const k of AS_OF_KINDS)
        for (const s of SCENARIOS) {
          const p0 = plan(b.id);
          const asOf = asOfOf(p0, k);
          all.push({ id: b.id, k, s, asOf, facts: factsOf(p0, s, asOf) });
        }
    // 06d: tokovi porodice 1 su uvek u uzorku (dokaz u brzom nivou).
    cases = FULL
      ? all
      : sample(
          all,
          K,
          (c) => c.s,
          (c) => FAMILY1.has(`${c.id}/${c.k}/${c.s}`)
        );
    for (const { id, k, s, asOf, facts } of cases) {
      const p0 = plan(id);
      let r = adaptTenKV2(p0, facts, asOf);
      checkReduced(`${id}/${k}/${s}`, r);
      let before = p0;
      let at = asOf;
      let f = facts;
      if (r.ok && s === 'chain') {
        [before, at] = [r.plan, addDays(asOf, 7)];
        f = chainFacts(r.plan, at);
        r = adaptTenKV2(r.plan, f, at);
        checkReduced(`${id}/${k}/${s}#2`, r);
      }
      hashes.push(fnv1a(JSON.stringify(r)));
      h81[`${id}/${k}/${s}`] = planHash81(r);
      h06c[`${id}/${k}/${s}`] = planHash06c(r);
      dump08('grid04', `${id}/${k}/${s}`, r);
      p35Flows.push({ key: `${id}/${k}/${s}`, id, hash: planHash06c(r), res: r });
      const notes = r.ok ? r.plan.notes : [];
      if (notes.some((x) => x.includes('(A17)'))) a17.add(`${id}/${k}/${s}`);
      if (notes.some((x) => x.includes('nivoa pre bola bilo bi'))) n2.add(`${id}/${k}/${s}`);
      if (applied(r, 'PAIN')) painApplied.add(`${id}/${k}/${s}`);
      if (r.ok && r.plan.adaptation!.steps.some((x) => x.returnFrom))
        painBack.add(`${id}/${k}/${s}`);
      const st = (stats[s] ??= { n: 0 });
      st['n']!++;
      if (!r.ok) {
        rejected.push(`${id}/${k}/${s}: ${r.reasons.map((x) => x.code).join(',')}`);
        continue;
      }
      for (const x of r.reasons) if (x.applied) st[x.condition] = (st[x.condition] ?? 0) + 1;
      if (sameWeeks(before, r.plan)) st['same'] = (st['same'] ?? 0) + 1;
      if (r.plan.adaptation!.mixedWeeks.length > 0) st['mixed'] = (st['mixed'] ?? 0) + 1;
      for (const v of validatePlan(r.plan))
        if (v.severity === 'error') errors[v.rule] = (errors[v.rule] ?? 0) + 1;
      for (const v of adaptInvariants(before, r.plan, at, f)) bad.push(`${id}/${k}/${s}: ${v}`);
    }
  }, GRID_TIMEOUT);

  it('2040 adaptacija (+ drugi korak lanca): 0 odbijanja, 0 grešaka validatora', () => {
    expect(bases.length).toBe(30);
    expect(all.length).toBe(2040);
    expect(rejected.slice(0, 10)).toEqual([]);
    expect(errors).toEqual({});
  });

  it('zaštita bajt-isto (prošlost, urađeno, zaključano) i invarijante nezavisno od validatora: planirano = cilj, dugi ≥ lagan, teški dani nesusedni, trkačka ≤ taper, D30b, rasterećenje po D5, doza ne raste u nedelji sa ograničenjem, cilj ≥ minimum, taper ≤ poslednja izgradnja', () => {
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('deterministički: drugi poziv = isti JSON (A14)', () => {
    const again = cases.map(({ id, s, asOf, facts }) => {
      let r = adaptTenKV2(plan(id), facts, asOf);
      if (r.ok && s === 'chain') {
        const a2 = addDays(asOf, 7);
        r = adaptTenKV2(r.plan, chainFacts(r.plan, a2), a2);
      }
      return fnv1a(JSON.stringify(r));
    });
    expect(again).toEqual(hashes);
  });

  it('rezultati po scenariju (primenjeni uslovi, nedelje iste kao pre, mešovite nedelje)', () => {
    expectStats(stats, {
      none: { n: 120, NO_FACTS: 120, same: 120 },
      done100: { n: 120, same: 120 },
      under50: { n: 120, UNDER_EXECUTION: 80, same: 40 },
      // 06i (pouka 37): zaštićeni dani po činjenicama (× 1,2) prelaze sastavljene → preostali dani na ostatak do cilja
      // (mešovita nedelja; same 44 → 14); 1 tok: test otpada sa kvalitetom koji ne staje (TEST_MOVED).
      // 10K-07 (Z1): TEST_MOVED 1 → 0 — test mešovite nedelje ostaje uz upisani višak zaštićenih dana (≤ 10 %).
      over120: { n: 120, OVER_EXECUTION: 80, same: 14, mixed: 60 },
      pause10: { n: 120, PAUSE: 120, mixed: 50, TEST_MOVED: 5 },
      pause20: { n: 120, PAUSE: 120, mixed: 54, TEST_MOVED: 9 },
      pause35: { n: 120, PAUSE: 120, mixed: 60, TEST_MOVED: 13 },
      // 06c (A17): TEST_MOVED 5 → 6 — d4-f-14w w2end: rasterećenje ned 4 sa testom (D27) ukinuto; u izgradnji
      // 27,0 km test i Q2 ne staju → jedan kvalitet doze rasterećenja, test otpada (A9/A13).
      pain5: { n: 120, PAIN: 120, mixed: 54, TEST_MOVED: 6 },
      // 06b (10k-v2.4.1): TEST_MOVED 10 → 9 — viši cilj posle sidra, test 5 km ostaje u svojoj nedelji.
      pain8: { n: 120, PAIN: 120, mixed: 54, TEST_MOVED: 9 },
      // 06i (pouka 37): 3 toka sa ostatkom do cilja (zapis umora 6 km na zaštićenom danu > sastavljeno); same 40 → 37.
      fatigue: { n: 120, FATIGUE: 80, same: 37, mixed: 3, TEST_MOVED: 4 },
      faster: { n: 120, NEW_RESULT: 120, mixed: 1, TEST_MOVED: 13 },
      slower: { n: 120, NEW_RESULT: 108, mixed: 1, TEST_MOVED: 13, same: 12 },
      test5k: { n: 120, NEW_RESULT: 120, mixed: 1, TEST_MOVED: 13 },
      incomplete: { n: 120, NO_FACTS: 120, same: 120 },
      locked: { n: 120, same: 120 },
      // 06c (A17): TEST_MOVED 13 → 8 — d6-f-14w i d3/d4/d5/d6-f-18w w2end: prvi korak (pauza) ukida rasterećenje
      // sa testom, drugi korak (manjak) više ne uklanja test.
      chain: { n: 120, UNDER_EXECUTION: 80, mixed: 50, same: 40, TEST_MOVED: 8 },
      // 06b (10k-v2.4.1): TEST_MOVED 13 → 9 — osnova min(0,7 × nivo, cilj pauze) umesto 0,7 × cilj pauze.
      painPause: { n: 120, PAIN: 120, PAUSE: 120, mixed: 54, TEST_MOVED: 9 }
    });
  });
  /** Pun: tačno. Brz: svaki scenario u uzorku, po scenariju expectCounts uz n = broj tokova scenarija (120). */
  function expectStats(
    got: Record<string, Record<string, number>>,
    full: Record<string, Record<string, number>>
  ): void {
    if (FULL) {
      expect(got).toEqual(full);
      return;
    }
    expect(Object.keys(got).sort()).toEqual(Object.keys(full).sort());
    expect(
      Object.keys(full).flatMap((s) =>
        countViolations(got[s], full[s], { got: got[s]!['n']!, full: full[s]!['n']! }, s)
      )
    ).toEqual([]);
  }

  it('06b/06c: regresija prema e6540a5 (heš bez oznake verzije i polja reduced) — menjaju se samo tokovi sa primenjenim PAIN ili ukinutim rasterećenjem (A17)', () => {
    const ref = JSON.parse(readFileSync(HASHES_E65, 'utf8')) as {
      against: string;
      count: { grid04: number; gridP: number };
      grid04: Record<string, number>;
    };
    expect(ref.against).toBe('e6540a5');
    expect(ref.count.grid04).toBe(2040);
    expect(all.map((c) => `${c.id}/${c.k}/${c.s}`).sort()).toEqual(Object.keys(ref.grid04).sort());
    expect(Object.keys(h81)).toEqual(cases.map((c) => `${c.id}/${c.k}/${c.s}`));
    logCompared('tenK.v2.e6540a5.grid04', Object.keys(h06c));
    const changed: Record<string, number> = {};
    const notPain: string[] = [];
    const unchangedBack: string[] = [];
    const byA17: Record<string, number> = {};
    for (const [key, h0] of Object.entries(h06c)) {
      const h = asOf51(key, h0);
      if (ref.grid04[key] !== h) {
        const s = key.split('/')[2]!;
        if (painApplied.has(key)) changed[s] = (changed[s] ?? 0) + 1;
        else if (a17.has(key)) byA17[s] = (byA17[s] ?? 0) + 1;
        else notPain.push(key);
      } else if (painBack.has(key)) unchangedBack.push(key);
    }
    expect(notPain).toEqual([]);
    expectCounts(changed, CHANGED_06B);
    expectCounts(byA17, { chain: 60, pause10: 40, pause20: 40, under50: 40 });
    // Promenjen je tačno svaki tok sa povratkom posle bola (PAIN bez povratka — r taper — ostaje isti).
    expect(unchangedBack).toEqual([]);
    expect([...painBack].every((k) => painApplied.has(k))).toBe(true);
    expectCounts(painBack.size, 240);
  });

  it('06c: regresija prema 4917959 (heš bez oznake verzije i polja reduced) — menjaju se samo tokovi sa ukinutim rasterećenjem (A17) ili porukom N2; ostali bajt-isti', () => {
    const ref = JSON.parse(readFileSync(HASHES_491, 'utf8')) as {
      against: string;
      count: { grid04: number };
      grid04: Record<string, number>;
    };
    expect(ref.against).toBe('4917959');
    expect(ref.count.grid04).toBe(2040);
    expect(all.map((c) => `${c.id}/${c.k}/${c.s}`).sort()).toEqual(Object.keys(ref.grid04).sort());
    expect(Object.keys(h06c)).toEqual(cases.map((c) => `${c.id}/${c.k}/${c.s}`));
    logCompared('tenK.v2.4917959.grid04', Object.keys(h06c));
    const changed: Record<string, number> = {};
    const reducedOnly: Record<string, number> = {};
    const other: string[] = [];
    const same: string[] = [];
    for (const [key, h0] of Object.entries(h06c)) {
      const h = asOf51(key, h0);
      const s = key.split('/')[2]!;
      const marked = a17.has(key) || n2.has(key);
      if (ref.grid04[key] !== h) {
        changed[s] = (changed[s] ?? 0) + 1;
        if (!marked) other.push(key);
      } else {
        if (marked) same.push(key);
        // Polje reduced je isto u 51a924f i sada (isti koraci): poredi se par novog koda.
        if (h81[key] !== h0) reducedOnly[s] = (reducedOnly[s] ?? 0) + 1;
      }
    }
    expect(other).toEqual([]);
    expect(same).toEqual([]);
    expectCounts(changed, CHANGED_06C);
    expectCounts(reducedOnly, REDUCED_ONLY_06C);
  });

  it('06d: regresija prema 51a924f (heš bez oznake verzije) — menja se tačno 18 tokova porodice 1 (prošlost = upisani dani), ostali bajt-isti', () => {
    expect(H51.against).toBe('51a924f');
    expect(Object.keys(H51.grid04).sort()).toEqual(all.map((c) => `${c.id}/${c.k}/${c.s}`).sort());
    expect(FAMILY1.size).toBe(18);
    logCompared('tenK.v2.51a924f.grid04', Object.keys(h06c));
    const changed = Object.keys(h06c).filter((k) => H51.grid04[k] !== at7ba('grid04', k, h06c[k]!));
    const sampled = Object.keys(h06c).filter((k) => FAMILY1.has(k));
    expect(changed.filter((k) => !FAMILY1.has(k))).toEqual([]);
    expect(changed.filter((k) => FAMILY1.has(k)).sort()).toEqual(sampled.sort());
  });

  it('06f (10k-v2.6.0): prema 7ba9717 menjaju se tačno tokovi sa poukom 35 (76 u celoj mreži)', () => {
    expect(p35FlowErrors('grid04', p35Flows)).toEqual([]);
  });

  it('06i (10k-v2.8.0): prema 46e72eb menjaju se tačno tokovi sa mešovitom nedeljom pouke 37', () => {
    expect(p37FlowErrors('grid04', p35Flows)).toEqual([]);
    // 10K-07: tokovi koje 10k-v2.9.0 menja (fixture, uzrok).
    expect(p08Errors('grid04', p35Flows)).toEqual([]);
    expect(
      p07FlowErrors(
        'grid04',
        p35Flows.map((f) => ({ ...f, m07: mark07(f.res) }))
      )
    ).toEqual([]);
  });

  it('06c: reduced === true tačno u koracima A2/A3 (manjak, pauza — i nov start), === false tačno u koracima A6 (višak), odsutno u svim ostalim', () => {
    expect(reducedBad.slice(0, 10)).toEqual([]);
    // 2040 tokova + 120 drugih koraka lanca: manjak 80 + pauza 360 + pauza i bol 120 + lanac 120 + 80 = 760.
    expectCounts(reducedSeen, { true: 760, false: 80, absent: 1320 });
  });

  it('nevaljani ulazi → strukturisano odbijanje (plan, asOf, činjenice)', () => {
    const p = plan('d4-r-14w');
    const asOf = asOfOf(p, 'w6wed');
    const code = (r: AdaptResult): string[] => (r.ok ? [] : r.reasons.map((x) => x.code));
    expect(code(adaptTenKV2(null, {}, asOf))).toEqual(['ADAPT_PLAN_INVALID']);
    expect(code(adaptTenKV2({ ...p, policyId: '5k-v2' }, {}, asOf))).toEqual([
      'ADAPT_PLAN_INVALID'
    ]);
    expect(code(adaptTenKV2({ ...p, weeks: p.weeks.slice(1) }, {}, asOf))).toEqual([
      'ADAPT_PLAN_INVALID'
    ]);
    expect(code(adaptTenKV2(p, {}, '2026-13-01'))).toEqual(['ADAPT_AS_OF_INVALID']);
    expect(code(adaptTenKV2(p, {}, p.input.raceDate))).toEqual(['ADAPT_AS_OF_INVALID']);
    expect(code(adaptTenKV2(p, 'x', asOf))).toEqual(['ADAPT_FACT_INVALID']);
    expect(code(adaptTenKV2(p, { workouts: {} }, asOf))).toEqual(['ADAPT_FACT_INVALID']);
    expect(
      code(
        adaptTenKV2(
          p,
          { workouts: [{ date: addDays(asOf, 1), km: 5, durationSec: 1, completed: true }] },
          asOf
        )
      )
    ).toEqual(['ADAPT_FACT_AFTER_AS_OF']);
    expect(
      code(
        adaptTenKV2(
          p,
          {
            workouts: [{ date: asOf, dayId: '1999-01-01', km: 5, durationSec: 1, completed: true }]
          },
          asOf
        )
      )
    ).toEqual(['ADAPT_DAY_UNKNOWN']);
    expect(
      code(
        adaptTenKV2(
          p,
          { workouts: [{ date: asOf, km: -1, durationSec: 1, completed: true }] },
          asOf
        )
      )
    ).toEqual(['ADAPT_FACT_INVALID']);
    expect(
      code(
        adaptTenKV2(
          p,
          { workouts: [{ date: asOf, km: 5, durationSec: 1, completed: true, rpe: 11 }] },
          asOf
        )
      )
    ).toEqual(['ADAPT_FACT_INVALID']);
    expect(
      code(adaptTenKV2(p, { results: [{ distM: 4000, sec: 900, date: asOf, kind: 'race' }] }, asOf))
    ).toEqual(['ADAPT_RESULT_INVALID']);
    expect(
      code(adaptTenKV2(p, { results: [{ distM: 5000, sec: 1200, date: asOf, kind: 'x' }] }, asOf))
    ).toEqual(['ADAPT_RESULT_INVALID']);
    expect(code(adaptTenKV2(p, { lockedDayIds: ['1999-01-01'] }, asOf))).toEqual([
      'ADAPT_DAY_UNKNOWN'
    ]);
    expect(code(adaptTenKV2(p, { coverage: { from: asOf, to: asOf } }, asOf))).toEqual([
      'ADAPT_FACT_INVALID'
    ]);
    expect(code(adaptTenKV2(p, { breaks: [{ kind: 'x', from: asOf, to: asOf }] }, asOf))).toEqual([
      'ADAPT_FACT_INVALID'
    ]);
    expect(
      code(adaptTenKV2(p, { breaks: [{ kind: 'break', from: asOf, to: addDays(asOf, -1) }] }, asOf))
    ).toEqual(['ADAPT_FACT_INVALID']);
  });
});

/* ---------- Pouka 7 (5K v2): posebni testovi ---------- */

describe('pouka 7', () => {
  it('(a) posle pauze cilj raste +10 %/ned do nivoa pre pauze — ne ravno do trke i ne skokom; iznad nivoa D6', () => {
    for (const id of ['d4-r-18w', 'd5-f-18w', 'd3-r-14w']) {
      const p = plan(id);
      const asOf = asOfOf(p, 'w6wed');
      const r = ok(adaptTenKV2(p, factsOf(p, 'pause20', asOf), asOf));
      const st = r.plan.adaptation!.steps[0]!;
      const level = st.levelKm!;
      const build = r.plan.weeks.filter((w) => isBuild(w) && !w.deload && w.index > st.fromWeek);
      let last = r.plan.weeks[st.fromWeek - 1]!.targetKm;
      let reached = false;
      for (const w of build) {
        const ret = Math.max(A.returnGrowthMinKm, round1(last * A.returnGrowth));
        const d6 = Math.min(
          P.volume.growthMaxKm,
          Math.max(P.volume.growthMinKm, round1(last * P.volume.growth))
        );
        if (last < level) {
          // Raste (ne ravno), +10 % (min 1,0 km) do nivoa — ne skokom; nikad sporije od D6 (A8).
          expect(w.targetKm, `${id} ned ${w.index}`).toBeGreaterThan(last);
          expect(w.targetKm, `${id} ned ${w.index}`).toBeLessThanOrEqual(
            Math.max(Math.min(level, last + ret), last + d6) + 0.05
          );
        } else reached = true;
        last = w.targetKm;
      }
      // 18 ned: nivo dostignut pre tapera; 14 ned (3 dana) raste do kraja izgradnje.
      expect(reached, id).toBe(id.endsWith('18w'));
    }
  });

  it('(b) cilj nikad ispod minimuma nedelje (A9): pauza 35 posle malog obima → cilj = minimum nedelje', () => {
    const p = plan('d3-r-10w');
    const asOf = asOfOf(p, 'w2end');
    const facts = {
      workouts: runsIn(p, addDays(asOf, -48), addDays(asOf, -35), 0.2),
      coverage: { from: addDays(asOf, -48), to: asOf, complete: true }
    };
    const r = ok(adaptTenKV2(p, facts, asOf));
    const min = dayRule(3)!.weekMinKm;
    expect(r.plan.adaptation!.steps[0]!.startKm).toBe(min);
    for (const w of r.plan.weeks)
      if (w.phase !== 'race') expect(w.targetKm, `ned ${w.index}`).toBeGreaterThanOrEqual(min);
  });

  it('(c) nepotpun zapis bez coverage (i sa complete = false) ≠ pauza ni manjak: budući deo isti', () => {
    const p = plan('d4-r-14w');
    const asOf = asOfOf(p, 'w6wed');
    // Samo 2 zapisa za 14 dana (sat nije sinhronizovan) — bez coverage i sa nepotpunim coverage.
    const workouts = runsIn(p, addDays(asOf, -13), asOf).slice(0, 2);
    for (const coverage of [undefined, { from: addDays(asOf, -13), to: asOf, complete: false }]) {
      const r = ok(adaptTenKV2(p, { workouts, ...(coverage ? { coverage } : {}) }, asOf));
      expect(r.reasons.filter((x) => x.applied).map((x) => x.condition)).toEqual([]);
      expect(sameWeeks(p, r.plan)).toBe(true);
    }
  });

  it('(d) eksplicitna pauza radi bez zapisa i bez coverage', () => {
    const p = plan('d5-r-14w');
    const asOf = asOfOf(p, 'w8end');
    const r = ok(
      adaptTenKV2(p, { breaks: [{ kind: 'break', from: addDays(asOf, -19), to: asOf }] }, asOf)
    );
    expect(applied(r, 'PAUSE')).toBe(true);
    const st = r.plan.adaptation!.steps[0]!;
    // Bez zapisa: obim pre pauze = cilj plana u nedelji početka pauze.
    const ps = mustDay(addDays(asOf, -19));
    const pw = p.weeks.find((w) => mustDay(w.startDate) <= ps && ps <= mustDay(w.endDate))!;
    expect(st.startKm).toBe(round1(A.pause.midShare * pw.targetKm));
  });

  it('(e) prioritet: bol uvek (po datumima) > pauza > umor > izvršenje', () => {
    const p = plan('d4-r-14w');
    const asOf = asOfOf(p, 'w6wed');
    const back = (n: number): string => addDays(asOf, -n);
    const facts = {
      workouts: [
        ...runsIn(p, back(33), back(20)),
        { date: back(1), km: 0, durationSec: 0, completed: false, pain: 5 },
        { date: back(25), km: 6, durationSec: 2400, completed: true, rpe: 8 }
      ],
      coverage: { from: back(33), to: asOf, complete: true }
    };
    const r = ok(adaptTenKV2(p, facts, asOf));
    const got = Object.fromEntries(r.reasons.map((x) => [x.condition, x.applied]));
    expect(got).toEqual({ PAIN: true, PAUSE: true, UNDER_EXECUTION: false });
    // Bol + umor + manjak: obim samo umor (viši od izvršenja), bol po datumima.
    const f2 = {
      workouts: [
        ...runsIn(p, back(13), back(7)),
        ...runsIn(p, back(6), asOf, 0.3),
        { date: back(1), km: 6, durationSec: 2400, completed: true, rpe: 8 },
        { date: back(2), km: 6, durationSec: 2400, completed: true, rpe: 8, pain: 4 }
      ],
      coverage: { from: back(13), to: asOf, complete: true }
    };
    const r2 = ok(adaptTenKV2(p, f2, asOf));
    const got2 = Object.fromEntries(r2.reasons.map((x) => [x.condition, x.applied]));
    expect(got2).toEqual({ PAIN: true, FATIGUE: true, UNDER_EXECUTION: false });
  });

  it('(f) zaštita: prošlost, urađeno i zaključano bajt-isto; završna zaštita samo proverava', () => {
    const p = plan('d4-f-14w');
    const asOf = asOfOf(p, 'w6wed');
    const future = p.weeks
      .flatMap((w) => w.days)
      .filter((d) => mustDay(d.date) > mustDay(asOf) && d.role !== 'race')
      .slice(0, 4)
      .map((d) => d.date);
    const facts = {
      workouts: runsIn(p, addDays(asOf, -9), addDays(asOf, -9)),
      breaks: [{ kind: 'break' as const, from: addDays(asOf, -8), to: asOf }],
      lockedDayIds: future
    };
    const r = ok(adaptTenKV2(p, facts, asOf));
    const after = new Map(r.plan.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
    for (const w of p.weeks)
      for (const d of w.days)
        if (mustDay(d.date) <= mustDay(asOf) || future.includes(d.date))
          expect(JSON.stringify(after.get(d.date)), d.date).toBe(JSON.stringify(d));
    expect(r.plan.adaptation!.lockedDayIds).toEqual(future);
    expect(r.plan.adaptation!.mixedWeeks.length).toBeGreaterThan(0);
  });

  it('(g) taper posle smanjenja = 0,75 × najveći cilj izgradnje posle smanjenja, nije veći od poslednje nedelje izgradnje', () => {
    for (const s of ['pause10', 'pause20', 'pause35', 'under50', 'pain8'] as const)
      for (const id of ['d3-r-10w', 'd4-f-14w', 'd6-r-18w', 'beg-d4-r-14w']) {
        const p = plan(id);
        const asOf = asOfOf(p, 'w6wed');
        const r = ok(adaptTenKV2(p, factsOf(p, s, asOf), asOf));
        const ws = r.plan.weeks;
        const taper = ws.find((w) => w.phase === 'taper')!;
        const lastBuild = ws.filter((w) => isBuild(w) && !w.deload).pop()!;
        expect(taper.targetKm, `${id}/${s}`).toBeLessThanOrEqual(lastBuild.targetKm);
        const st = r.plan.adaptation!.steps[0]!;
        const from = st.startKm !== null ? st.fromWeek : st.returnFrom!.week + 1;
        const peak = Math.max(
          ...ws
            .filter((w) => isBuild(w) && w.index >= from && (!w.deload || w.index === st.fromWeek))
            .map((w) => w.targetKm)
        );
        expect(taper.nominalKm, `${id}/${s}`).toBe(
          Math.round(P.taper.factor * Math.round(peak * 10)) / 10
        );
      }
  });
});

/* ---------- Odluke A1–A15 ---------- */

describe('odluke A1–A15', () => {
  it('A1: rezultat ≤ 84 dana, noviji — VDOT od sledeće nedelje; po osećaju → result (bez RPE od te nedelje); obim po D6; doza se nastavlja; cilj i prognoza iz novog VDOT-a; VDOT van 30–80 i stari rezultat se ignorišu', () => {
    const p = plan('d4-f-14w');
    const asOf = asOfOf(p, 'w6wed');
    const r = ok(
      adaptTenKV2(p, { results: [{ distM: 5000, sec: 1470, date: asOf, kind: 'test' }] }, asOf)
    );
    const st = r.plan.adaptation!.steps[0]!;
    expect(st.fromWeek).toBe(7);
    expect(r.plan.paceBasis).toBe('result');
    expect(r.plan.vdot).toBe(st.vdot);
    expect(r.plan.predicted10kSec).not.toBeNull();
    for (const w of r.plan.weeks)
      for (const d of w.days)
        if (d.workout.kind === 'quality')
          expect(d.workout.rpe !== undefined, `ned ${w.index}`).toBe(w.index < 7);
    // Obim: pravilo D6 nezavisno od tempa (ciljevi isti kao pre; trkačka nedelja = planirano, D8, zavisi
    // od tempa 35 min E).
    // 10K-08 (T1): najkraći lagan = 20 min laganim tempom — kapacitet nedelje zavisi od tempa, pa od prve nedelje
    // spuštene na novom tempu (ned 10) nominalni ciljevi slede stvarno dobijen cilj (D6), ne plan pre rezultata.
    expect(r.plan.weeks.slice(0, 9).map((w) => w.nominalKm)).toEqual(
      p.weeks.slice(0, 9).map((w) => w.nominalKm)
    );
    expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
    // Plan sa rezultatom: ocena cilja za nedelje od rezultata do trke.
    const pr = plan('d4-r-14w');
    const rr = ok(adaptTenKV2(pr, factsOf(pr, 'faster', asOf), asOf));
    expect(rr.plan.goal!.weeks).toBe(14 - 7 + 1);
    expect(rr.plan.vdot).toBe(round1(pr.vdot + 2));
    // VDOT van 30–80 i rezultat stariji od 84 dana: RESULT_IGNORED, plan isti.
    const slow = { distM: 5000, sec: 2700, date: asOf, kind: 'race' };
    const old = { distM: 5000, sec: 1300, date: addDays(asOf, -90), kind: 'race' };
    const ri = ok(adaptTenKV2(pr, { results: [slow, old] }, asOf));
    expect(ri.reasons.map((x) => `${x.condition}:${x.applied}`)).toEqual([
      'RESULT_IGNORED:false',
      'RESULT_IGNORED:false'
    ]);
    expect(sameWeeks(pr, ri.plan)).toBe(true);
    // Nema sledeće nedelje (asOf u trkačkoj nedelji): ne primenjuje se.
    const raceWed = addDays(pr.weeks.at(-1)!.startDate, 2);
    const rn = ok(
      adaptTenKV2(
        pr,
        { results: [{ distM: 5000, sec: 1200, date: raceWed, kind: 'race' }] },
        raceWed
      )
    );
    expect(rn.reasons.map((x) => `${x.condition}:${x.applied}`)).toEqual(['NEW_RESULT:false']);
  });

  it('A2: manjak (< 60 % u pokrivenih 7 dana) → cilj sledeće nedelje = min(prethodni cilj izgradnje, max(izvršeno, 0,8 × cilj)), dalje povratni rast', () => {
    const p = plan('d5-r-14w');
    const asOf = asOfOf(p, 'w6wed');
    const r = ok(adaptTenKV2(p, factsOf(p, 'under50', asOf), asOf));
    const st = r.plan.adaptation!.steps[0]!;
    const tn = p.weeks[st.fromWeek - 1]!.targetKm;
    const last = p.weeks.filter((w) => w.index < st.fromWeek && isBuild(w) && !w.deload).pop()!
      .targetKm;
    const done = (factsOf(p, 'under50', asOf).workouts as { date: string; km: number }[])
      .filter((x) => mustDay(x.date) > mustDay(asOf) - 7)
      .reduce((a, x) => a + x.km, 0);
    expect(st.startKm).toBe(round1(Math.min(tn, last, Math.max(done, A.underFloorShare * tn))));
    expect(r.plan.weeks[st.fromWeek - 1]!.targetKm).toBe(st.startKm);
    expect(st.levelKm).not.toBeNull();
  });

  it('A3: pauza 7–13 → 80 % i 1 kvalitet; 14–27 → 70 %, bez kvaliteta pa 1; ≥ 28 → min(14 dana / 2, 50 %), nov start; < 8 ned → orijentir', () => {
    const p = plan('d4-r-18w');
    const asOf = asOfOf(p, 'w6wed');
    const pre = (s: string, days: number): number =>
      (factsOf(p, s as 'pause10', asOf).workouts as { date: string; km: number }[])
        .filter(
          (x) =>
            mustDay(asOf) - mustDay(x.date) >= days && mustDay(asOf) - mustDay(x.date) < days + 7
        )
        .reduce((a, x) => a + x.km, 0);
    const r10 = ok(adaptTenKV2(p, factsOf(p, 'pause10', asOf), asOf));
    const s10 = r10.plan.adaptation!.steps[0]!;
    expect(s10.startKm).toBe(round1(A.pause.shortShare * pre('pause10', 10)));
    expect(r10.plan.weeks[s10.fromWeek - 1]!.limits?.quality).toBe('one');
    const r20 = ok(adaptTenKV2(p, factsOf(p, 'pause20', asOf), asOf));
    const s20 = r20.plan.adaptation!.steps[0]!;
    expect(r20.plan.weeks[s20.fromWeek - 1]!.limits?.quality).toBe('none');
    expect(r20.plan.weeks[s20.fromWeek]!.limits?.quality).toBe('one');
    expect(quality(r20.plan.weeks[s20.fromWeek - 1]!)).toBe(0);
    const r35 = ok(adaptTenKV2(p, factsOf(p, 'pause35', asOf), asOf));
    const s35 = r35.plan.adaptation!.steps[0]!;
    const k7 = pre('pause35', 35);
    const k14 = k7 + pre('pause35', 42);
    expect(s35.restart).toBe(true);
    expect(s35.startKm).toBe(round1(Math.min(k14 / 2, A.pause.longShare * k7)));
    expect(s35.orientation).toBe(false);
    // Nov start: faze preostale izgradnje iz rePeriodize (baza od sledeće nedelje).
    expect(r35.plan.weeks[s35.fromWeek - 1]!.phase).toBe('base');
    // < 8 nedelja do trke → „orijentir".
    const q = plan('d4-r-14w');
    const a8 = asOfOf(q, 'w8end');
    const ro = ok(adaptTenKV2(q, factsOf(q, 'pause35', a8), a8));
    expect(ro.plan.adaptation!.steps[0]!.orientation).toBe(true);
    expect(ro.plan.goal!.status).toBe('orientation');
    expect(ro.plan.notes).toContain(A.orientationMessage);
  });

  it('A4: bol ≥ 4 → 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani × 0,7 (≥ 3 km); bol ≥ 7 → 3 dana odmora; posle poslednje nedelje bola rast od 0,7 × cilj', () => {
    const p = plan('d6-r-18w');
    const asOf = asOfOf(p, 'w8end');
    const r5 = ok(adaptTenKV2(p, factsOf(p, 'pain5', asOf), asOf));
    const st = r5.plan.adaptation!.steps[0]!;
    expect(st.rest).toBeNull();
    expect(st.pain).toEqual({ from: addDays(asOf, 1), to: addDays(asOf, 7) });
    expect(r5.reasons[0]!.message).toContain('stručni pregled');
    const w9 = r5.plan.weeks[8]!;
    expect(quality(w9)).toBe(0);
    const long = w9.days.find((d) => d.role === 'long')!;
    expect(long.workout.km * r5.plan.paces.E.slow).toBeLessThanOrEqual(A.painLongMaxSec + 1e-6);
    // Lagani na danima bola = max(3 km, 0,7 × isti dan bez bola) — ista nedelja bez bola (zabrana
    // kvaliteta umesto bola) iz istog konstruktora.
    const noPain = { ...st, pain: null, noQuality: [st.pain!] };
    const c = construct(p.input, [noPain]);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    for (const d of w9.days.filter((x) => x.role === 'easy')) {
      const o = c.plan.weeks[8]!.days.find((x) => x.date === d.date)!;
      expect(d.workout.km).toBe(
        Math.max(3, Math.floor(o.workout.km * A.painEasyFactor * 10 + 1e-9) / 10)
      );
    }
    expect(st.returnFrom).toEqual({ week: 9, share: A.painEasyFactor });
    expect(r5.plan.weeks[9]!.nominalKm).toBeLessThan(p.weeks[9]!.nominalKm);
    const r8 = ok(adaptTenKV2(p, factsOf(p, 'pain8', asOf), asOf));
    const s8 = r8.plan.adaptation!.steps[0]!;
    expect(s8.rest).toEqual({ from: addDays(asOf, 1), to: addDays(asOf, 3) });
    const restDays = r8.plan.weeks[8]!.days.filter(
      (d) => mustDay(d.date) <= mustDay(addDays(asOf, 3))
    );
    expect(restDays).toEqual([]);
  });

  it('A5: umor (≥ 2 laganih sa RPE ≥ 7) → sledeća nedelja rasterećenje 0,8 × poslednja ne-rasteretna; redovno odmah posle se ukida', () => {
    const p = plan('d4-r-14w');
    // Kraj ned 7: sledeća nedelja 8 je redovno rasterećenje → umor se ne primenjuje.
    const a7 = p.weeks[6]!.endDate;
    expect(p.weeks[7]!.deload).toBe(true);
    const r7 = ok(adaptTenKV2(p, factsOf(p, 'fatigue', a7), a7));
    expect(applied(r7, 'FATIGUE')).toBe(false);
    // Kraj ned 6: nedelja 7 prinudno rasterećenje, redovno (ned 8) ukinuto.
    const a6 = p.weeks[5]!.endDate;
    const r6 = ok(adaptTenKV2(p, factsOf(p, 'fatigue', a6), a6));
    const ws = r6.plan.weeks;
    expect([ws[6]!.deload, ws[7]!.deload]).toEqual([true, false]);
    expect(ws[6]!.nominalKm).toBe(Math.round(P.deload.factor * ws[5]!.targetKm * 10) / 10);
    // Prinudno odmah posle redovnog: 0,8 × poslednja ne-rasteretna (ne 0,8 × 0,8). 06f (pouka 36): zapisi umora
    // u nedelji redovnog rasterećenja (sreda: zapisi pon, uto) — zapisi pre nje (asOf = ponedeljak) pokriva ono samo.
    const q = plan('d4-r-18w');
    const d = q.weeks.find((w) => w.deload)!;
    const wed = addDays(d.startDate, 2);
    const r = ok(adaptTenKV2(q, factsOf(q, 'fatigue', wed), wed));
    const f = r.plan.weeks[d.index]!;
    expect(f.deload).toBe(true);
    expect(f.nominalKm).toBe(
      Math.round(P.deload.factor * q.weeks[d.index - 2]!.targetKm * 10) / 10
    );
    const mon = ok(adaptTenKV2(q, factsOf(q, 'fatigue', d.startDate), d.startDate));
    expect(applied(mon, 'FATIGUE')).toBe(false);
    expect(mon.plan.weeks[d.index]!.deload).toBe(false);
  });

  it('A6: višak > 115 % u dva pokrivena prozora → sledeća nedelja bez rasta; ne kad je sledeća rasteretna', () => {
    const p = plan('d4-r-14w');
    const a6 = p.weeks[5]!.endDate;
    const r = ok(adaptTenKV2(p, factsOf(p, 'over120', a6), a6));
    expect(applied(r, 'OVER_EXECUTION')).toBe(true);
    expect(r.plan.weeks[6]!.targetKm).toBe(p.weeks[5]!.targetKm);
    const a7 = p.weeks[6]!.endDate;
    const r7 = ok(adaptTenKV2(p, factsOf(p, 'over120', a7), a7));
    expect(applied(r7, 'OVER_EXECUTION')).toBe(false);
  });

  it('A7: svi aktivni uslovi u reasons (applied true/false, poruka); za obim samo najviši', () => {
    const p = plan('d3-r-14w');
    const asOf = asOfOf(p, 'w6wed');
    const r = ok(adaptTenKV2(p, factsOf(p, 'painPause', asOf), asOf));
    for (const x of r.reasons) expect(x.message.length).toBeGreaterThan(20);
    expect(
      r.reasons.filter(
        (x) =>
          ['PAUSE', 'FATIGUE', 'UNDER_EXECUTION', 'OVER_EXECUTION'].includes(x.condition) &&
          x.applied
      ).length
    ).toBe(1);
  });

  it('A8: povratni rast nikad sporiji od D6; rasterećenje u povratku 0,8 × poslednja; cilj koraka osnov i kad je rasteretna; nivo = poslednja ne-rasteretna izgradnja pre događaja (bez nje start)', () => {
    const p = plan('d4-r-18w');
    const a2 = asOfOf(p, 'w2end');
    const r = ok(adaptTenKV2(p, factsOf(p, 'pause10', a2), a2));
    const st = r.plan.adaptation!.steps[0]!;
    // Pauza počinje u nedelji 1 → nema završene nedelje izgradnje pre nje → nivo = start.
    expect(st.levelKm).toBe(p.startKm);
    // Cilj koraka na rasteretnoj nedelji (kraj ned 3 → ned 4 rasteretna) je osnov rasta.
    const a3 = p.weeks[2]!.endDate;
    const rd = ok(adaptTenKV2(p, factsOf(p, 'pause10', a3), a3));
    const sd = rd.plan.adaptation!.steps[0]!;
    expect(rd.plan.weeks[sd.fromWeek - 1]!.deload).toBe(true);
    expect(rd.plan.weeks[sd.fromWeek - 1]!.targetKm).toBe(sd.startKm);
    const next = rd.plan.weeks[sd.fromWeek]!;
    expect(next.nominalKm).toBe(
      round1(
        Math.min(
          sd.levelKm!,
          sd.startKm! + Math.max(A.returnGrowthMinKm, round1(sd.startKm! * A.returnGrowth))
        )
      )
    );
    // Rasterećenje u povratku: 0,8 × poslednja ne-rasteretna.
    for (const w of r.plan.weeks.filter((x) => x.deload && x.index > st.fromWeek)) {
      const prev = r.plan.weeks.filter((x) => x.index < w.index && isBuild(x) && !x.deload).pop()!;
      expect(w.nominalKm).toBe(Math.round(P.deload.factor * prev.targetKm * 10) / 10);
    }
  });

  it('A9: donja granica = minimum nedelje; kvalitet koji ne staje → 1 kvalitet → bez kvaliteta (napomena A9); oštrenje otpada kad bi trkačka bila veća od tapera', () => {
    const p = plan('beg-d3-f-14w');
    const asOf = asOfOf(p, 'w6wed');
    const r = ok(adaptTenKV2(p, factsOf(p, 'pause35', asOf), asOf));
    expect(r.plan.weeks.some((w) => w.notes.some((n) => n.includes('(A9)')))).toBe(true);
    for (const w of r.plan.weeks.filter((x) => x.notes.some((n) => n.includes('(A9)'))))
      expect(quality(w)).toBeLessThanOrEqual(1);
    // Oštrenje: u zabrani kvaliteta (pauza 20 u taperu) nema ga, trkačka ≤ taper.
    const q = plan('d4-r-10w');
    const at = asOfOf(q, 'taperWed');
    const rq = ok(adaptTenKV2(q, factsOf(q, 'pause20', at), at));
    const race = rq.plan.weeks.at(-1)!;
    expect(race.days.some((d) => d.role === 'sharpener')).toBe(false);
    expect(race.plannedKm).toBeLessThanOrEqual(rq.plan.weeks.at(-2)!.plannedKm);
    // A9 (trkačka sa oštrenjem > taper → bez oštrenja): u mreži se ne javlja (D8 + D23), pa direktno —
    // ista trkačka nedelja sa `noSharpener` gubi samo oštrenje, uz napomenu A9.
    const chk = checkInput(q.input);
    if (!chk.ok) throw new Error('ulaz');
    const ctx: WeekContext = {
      input: chk.input,
      paces: q.paces,
      pattern: q.pattern,
      raceSec: q.predicted10kSec!,
      wc: warmupCooldown(q.input.currentWeeklyKm),
      rule: chk.rule,
      feel: false
    };
    const rw = q.weeks.at(-1)!;
    const tw = q.weeks.at(-2)!;
    const rpM = tw.days.map((d) => d.workout.dose).find((d) => d?.zone === 'RP')!.doseM;
    const prevHard = tw.days.filter((d) => d.hard).pop()!.date;
    const easy10 = Math.min(
      ...tw.days.filter((d) => d.role === 'easy').map((d) => Math.round(d.workout.km * 10))
    );
    const withS = raceWeek(ctx, rw, rpM, prevHard, easy10);
    const noS = raceWeek(ctx, rw, rpM, prevHard, easy10, true);
    expect(withS.days.map((d) => d.role)).toContain('sharpener');
    expect(noS.days.map((d) => d.role)).not.toContain('sharpener');
    expect(noS.days.length).toBe(withS.days.length);
    expect(noS.notes[0]).toContain('(A9, D23)');
  });

  it('A10: dan bez zapisa je poznat samo u coverage complete; trčanje = completed i (km ili trajanje); bol i rezultat bez coverage', () => {
    const p = plan('d4-r-14w');
    const asOf = asOfOf(p, 'w6wed');
    // Isti zapisi, coverage complete → pauza; bez coverage → ništa.
    const f = factsOf(p, 'pause10', asOf) as TenKV2Facts;
    expect(applied(adaptTenKV2(p, f, asOf), 'PAUSE')).toBe(true);
    const { coverage: _c, ...noCov } = f;
    const r = ok(adaptTenKV2(p, noCov, asOf));
    expect(r.reasons.filter((x) => x.applied)).toEqual([]);
    // Vremenski zapis bez km je trčanje (prekida pauzu).
    const timed = {
      ...f,
      workouts: [
        ...f.workouts!,
        { date: addDays(asOf, -2), km: 0, durationSec: 1800, completed: true }
      ]
    };
    expect(applied(adaptTenKV2(p, timed, asOf), 'PAUSE')).toBe(false);
    expect(applied(adaptTenKV2(p, factsOf(p, 'pain5', asOf), asOf), 'PAIN')).toBe(true);
  });

  it('A11: zaštita samo proverava; asOf ≥ dan trke ili pre prethodne adaptacije → ADAPT_AS_OF_INVALID', () => {
    const p = plan('d4-r-14w');
    const asOf = asOfOf(p, 'w6wed');
    const r = ok(adaptTenKV2(p, factsOf(p, 'pause10', asOf), asOf));
    const back = adaptTenKV2(r.plan, {}, addDays(asOf, -1));
    expect(!back.ok && back.reasons[0]!.code).toBe('ADAPT_AS_OF_INVALID');
    const race = adaptTenKV2(p, {}, p.input.raceDate);
    expect(!race.ok && race.reasons[0]!.code).toBe('ADAPT_AS_OF_INVALID');
    // Isti asOf kao prethodna adaptacija je dozvoljen (zaštita i dalje važi).
    expect(adaptTenKV2(r.plan, {}, asOf).ok).toBe(true);
  });

  it('A12: datum trke, taper i trkačka nedelja se ne pomeraju; rePeriodize poštuje D5 (i faza od 1 nedelje); 4 nedelje izgradnje → null (faze ostaju)', () => {
    const base = periodize('2026-11-02', 18)!;
    for (let from = 2; from <= 16; from++) {
      const f = rePeriodize(base, from);
      if (16 - from + 1 === 4) {
        expect(f).toBeNull();
        continue;
      }
      expect(f, `from ${from}`).not.toBeNull();
      expect(f!.slice(16).map((x) => x.phase)).toEqual(['taper', 'race']);
      expect(f!.slice(0, from - 1)).toEqual(base.slice(0, from - 1));
      const rel = f!.slice(from - 1).map((x) => x.phase);
      f!.slice(from - 1).forEach((x, k) => {
        if (x.deload) expect(deloadAllowed(rel, k + 1), `from ${from} ned ${x.index}`).toBe(true);
      });
    }
    const p = plan('d4-r-14w');
    const a8 = asOfOf(p, 'w8end');
    const r = ok(adaptTenKV2(p, factsOf(p, 'pause35', a8), a8));
    expect(r.plan.weeks.map((w) => w.phase)).toEqual(p.weeks.map((w) => w.phase));
    expect(r.plan.weeks.at(-1)!.days.find((d) => d.role === 'race')!.date).toBe(p.input.raceDate);
  });

  it('A13: blokirana nedelja testa → prva sledeća ne-rasteretna nedelja izgradnje bez ograničenja; posle rezultata testa nema; početnik bez testa', () => {
    const p = plan('d4-f-14w');
    const tw = p.weeks.find((w) => w.test)!;
    const asOf = addDays(tw.startDate, -1);
    const r = ok(adaptTenKV2(p, factsOf(p, 'pause20', asOf), asOf));
    const moved = r.plan.weeks.find((w) => w.test)!;
    expect(moved.index).toBeGreaterThan(tw.index);
    expect(moved.deload || moved.limits !== undefined || !isBuild(moved)).toBe(false);
    expect(r.reasons.some((x) => x.condition === 'TEST_MOVED')).toBe(true);
    const rr = ok(adaptTenKV2(p, factsOf(p, 'test5k', asOf), asOf));
    expect(rr.plan.weeks.some((w) => w.test || w.days.some((d) => d.role === 'test'))).toBe(false);
    for (const id of ['beg-d3-f-10w', 'beg-d3-f-14w']) {
      const b = plan(id);
      const a = asOfOf(b, 'w2end');
      expect(ok(adaptTenKV2(b, factsOf(b, 'pause10', a), a)).plan.weeks.some((w) => w.test)).toBe(
        false
      );
    }
  });

  it('A14: koraci se čuvaju i ponavljaju — construct(input, koraci) = budući deo adaptiranog plana; lanac', () => {
    const p = plan('d5-f-14w');
    const a1 = asOfOf(p, 'w6wed');
    const r1 = ok(adaptTenKV2(p, factsOf(p, 'pause10', a1), a1));
    const a2 = addDays(a1, 7);
    const r2 = ok(adaptTenKV2(r1.plan, chainFacts(r1.plan, a2), a2));
    expect(r2.plan.adaptation!.steps.length).toBe(2);
    const c = construct(p.input, r2.plan.adaptation!.steps);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const t = mustDay(a2);
    r2.plan.weeks.forEach((w, i) => {
      if (mustDay(w.startDate) > t) expect(JSON.stringify(w)).toBe(JSON.stringify(c.plan.weeks[i]));
    });
  });

  it('A15: plan starije verzije — budućnost po tekućim pravilima, prošlost zaštićena (mixedWeeks); druga politika → ADAPT_PLAN_INVALID', () => {
    const p = plan('d4-r-14w');
    const old = JSON.parse(JSON.stringify(p).replace(/10k-v2\.4\.0/g, '10k-v2.3.1')) as TenKV2Plan;
    old.weeks[0]!.days[0]!.workout = { ...old.weeks[0]!.days[0]!.workout, title: 'stara verzija' };
    const asOf = asOfOf(p, 'w6wed');
    const r = ok(adaptTenKV2(old, {}, asOf));
    expect(r.plan.policyVersion).toBe(P.version);
    expect(r.plan.weeks[0]!.days[0]!.workout.title).toBe('stara verzija');
    expect(r.plan.adaptation!.mixedWeeks).toEqual([1]);
    expect(sameWeeks(p, r.plan, 2)).toBe(true);
    const other = adaptTenKV2({ ...p, policyId: '10k-v1' }, {}, asOf);
    expect(!other.ok && other.reasons[0]!.code).toBe('ADAPT_PLAN_INVALID');
  });
});

describe('regresija generate i bez koraka', () => {
  it('construct(input, []) = generateTenKV2(input); plan generatora nema polje adaptation ni limits', () => {
    for (const b of bases) {
      const g = generateTenKV2(b.input);
      expect(JSON.stringify(construct(b.input, []))).toBe(JSON.stringify(g));
      if (g.ok) {
        expect(g.plan.adaptation).toBeUndefined();
        expect(g.plan.weeks.some((w) => w.limits !== undefined)).toBe(false);
      }
    }
  });

  it('adaptacija bez činjenica: sve nedelje bajt-iste, isti napomene plana, korak zapisan', () => {
    for (const b of bases.slice(0, 8)) {
      const p = plan(b.id);
      const asOf = asOfOf(p, 'w6wed');
      const r = ok(adaptTenKV2(p, {}, asOf));
      expect(sameWeeks(p, r.plan)).toBe(true);
      expect(r.plan.notes).toEqual(p.notes);
      expect(r.changes).toEqual([]);
      expect(r.plan.adaptation!.steps.length).toBe(1);
    }
  });

  it('odstupanja A9 za mali obim važe samo posle smanjenja: plan po osećaju sa dugim < 5 km u nedelji testa (generator) ostaje isti uz adaptaciju bez činjenica i uz rezultat', () => {
    const g = generateTenKV2(
      feelGridInputs(3).find((x) => x.id === 'f-d3-12w-20km-e270-A-sat')!.input
    );
    if (!g.ok) throw new Error('plan');
    const tw = g.plan.weeks.find((w) => w.test)!;
    expect(tw.days.find((d) => d.role === 'long')!.workout.km).toBeLessThan(P.test.km);
    const asOf = g.plan.weeks[0]!.endDate;
    expect(sameWeeks(g.plan, ok(adaptTenKV2(g.plan, {}, asOf)).plan)).toBe(true);
    const r = ok(adaptTenKV2(g.plan, factsOf(g.plan, 'fatigue', asOf), asOf));
    expect(r.plan.weeks.find((w) => w.test)?.index).toBe(tw.index);
  });

  it('inputOf/timeForVdot pomoćne funkcije (mreža sa rezultatom 45)', () => {
    const r = generateTenKV2(
      inputOf({ weeks: 12, km: 35, vdot: 45, days: SCHEDULES_BY_DAYS[4].A.days })
    );
    expect(r.ok).toBe(true);
    expect(timeForVdot(45, 5000)).toBeGreaterThan(0);
  });
});
