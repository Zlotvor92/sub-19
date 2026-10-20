/* Zajednički kod trajne mreže rane i srednje adaptacije (pouka 23, kao 10K E/N7; earlyGrid.node.test.ts i delovi
   punog nivoa earlyGrid.<k>.full.node.test.ts); bez testova (vitest ga ne skuplja, v. vitest.config.ts). Planovi:
   svaki 182. ulaz mreže 02, svaki 78. po osećaju, svaki 42. početnika; asOf: sreda i kraj ned 1, sreda svake
   nedelje 2 … N − 1, kraj nedelje pre svake posebne nedelje (test, rasterećenje, N−2, N−1); scenariji pauza 10/20,
   bol 5/8, pauza 10 + bol 5, manjak, umor; MAR-04b (pouke 23 i 34): asOf PRE STARTA (start − 1/−3/−6) × umor, bol
   5/8, pauza 10, rezultat. MAR-07 (Faza 4a): N10.7 — asOf pre starta × svih 17 scenarija mreže 04 (lanac: drugi
   korak nedelju kasnije); N1 — bol 7 i 8 na svaki dan nedelja N − 2 i N − 1 (3–4 dana); pouka 36 — isti zapisi umora
   ponovo asOf + 1 … + 7 (asOf: kraj nedelja iz earlyAsOfs i start − 1) → 0 novih rasterećenja, traka prazna. MAR-07b
   (pouka 4): novi rezultat (brži, sporiji, test 5 km) × zaključan ili urađen Q1/Q2 sledeće nedelje (asOf: kraj
   nedelja iz earlyAsOfs) → 0 odbijanja, zaštićen dan bajt-isti (adaptInvariants). MAR-07c (pouke 23, 36): umor sa
   asOf svaki dan nedelje testa i nedelje pre nje (po osećaju) i svaki ponedeljak nedelja 1 … N − 3 (svi planovi;
   prinudno rasterećenje u tekućoj nedelji); svi planovi po osećaju (testDayFlows) × umor na dan testa − 1, dan testa
   i + 1 (na a869e21 540 odbijanja: 5 dana raspored C, test na Q1 = ponedeljak = asOf) → 0 odbijanja. Po
   toku: prihvaćen (K1 = 0) i adaptInvariants prazno (nezavisno od validatora). */

import { beforeAll, describe, expect, it } from 'vitest';
import { adaptBanner, adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import {
  type AdaptBase,
  chainFacts,
  EARLY_SCENARIOS,
  earlyAsOfs,
  earlyFacts,
  earlyGridBases,
  earlyPreAsOfs,
  type EarlyScenario,
  factsOf,
  feelInputs,
  painFacts,
  PRE_START_SCENARIOS,
  type Scenario,
  SCENARIOS
} from './testInputs.ts';
import type { MarathonV2Plan } from './types.ts';

export const EARLY_PARTS = 4;
export const EARLY_TIMEOUT = 600_000;

export interface EarlyFlow {
  key: string;
  base: AdaptBase;
  asOf: string;
  /** 'early' — earlyFacts (s: EarlyScenario); 's17' — factsOf mreže 04 (s: Scenario, N10.7); 'pain' — bol `level`
      na dan asOf (N1); 'fatigue' — isti zapisi umora ponovo asOf + 1 … + 7 (pouka 36); 'fatigueDay' — umor
      (factsOf) na dan asOf (MAR-07c). */
  kind: 'early' | 's17' | 'pain' | 'fatigue' | 'fatigueDay' | 'protected';
  /** MAR-07b: zaštićen dan kvaliteta sledeće nedelje i način zaštite. */
  day?: { date: string; how: 'locked' | 'done' };
  s: EarlyScenario | Scenario;
  level?: number;
  /** asOf pre starta (pouka 34). */
  pre: boolean;
}

const plans = new Map<string, MarathonV2Plan>();
export const planOf = (b: AdaptBase): MarathonV2Plan => {
  let p = plans.get(b.id);
  if (!p) {
    const r = generateMarathonV2(b.input);
    if (!r.ok) throw new Error(`${b.id}: ${JSON.stringify(r.reasons)}`);
    p = r.plan;
    plans.set(b.id, p);
  }
  return p;
};

export const EARLY_BASES: readonly AdaptBase[] = earlyGridBases(182, 78, 42);
/** MAR-07c: svi planovi po osećaju (mreža 03, 8190) — baze tokova testDayFlows. */
export const TEST_DAY_BASES: readonly AdaptBase[] = feelInputs().map((c) => ({
  id: c.id,
  family: 'F',
  input: c.input
}));
/** Primer organizatora (fatigue-monday.ts): umor, asOf 2026-11-30 = dan testa. */
export const TEST_DAY_EXAMPLE = 'feel-d5-18w-40km-e450-C';

/** MAR-07c (pouke 23, 36): umor (factsOf) na dan testa − 1, dan testa i + 1. */
export function testDayFlows(bases: readonly AdaptBase[]): EarlyFlow[] {
  const out: EarlyFlow[] = [];
  for (const base of bases) {
    const t = planOf(base)
      .weeks.flatMap((w) => w.days)
      .find((d) => d.role === 'test');
    if (!t) continue;
    for (const k of [-1, 0, 1]) {
      const asOf = addDays(t.date, k);
      out.push({
        key: `${base.id}/${asOf}/testDay`,
        base,
        asOf,
        kind: 'fatigueDay',
        s: 'fatigue',
        pre: false
      });
    }
  }
  return out;
}

/** Tokovi mreže za date planove (redosled: plan, asOf pre starta × PRE_START_SCENARIOS i × 17 scenarija, asOf ×
    scenario, bol 7/8 ned N − 2 i N − 1 (3–4 dana), ponovljen umor). */
export function earlyFlows(bases: readonly AdaptBase[]): EarlyFlow[] {
  const out: EarlyFlow[] = [];
  for (const base of bases) {
    const p = planOf(base);
    const N = p.weeks.length;
    for (const a of earlyPreAsOfs(p)) {
      for (const s of PRE_START_SCENARIOS)
        out.push({
          key: `${base.id}/${a.tag}/${s}`,
          base,
          asOf: a.asOf,
          kind: 'early',
          s,
          pre: true
        });
      for (const s of SCENARIOS)
        out.push({
          key: `${base.id}/${a.tag}/s17-${s}`,
          base,
          asOf: a.asOf,
          kind: 's17',
          s,
          pre: true
        });
    }
    for (const a of earlyAsOfs(p))
      for (const s of EARLY_SCENARIOS)
        out.push({
          key: `${base.id}/${a.tag}/${s}`,
          base,
          asOf: a.asOf,
          kind: 'early',
          s,
          pre: false
        });
    if (p.input.runDays.length <= 4)
      for (const w of [N - 2, N - 1])
        for (let i = 0; i < 7; i++)
          for (const level of [7, 8]) {
            const asOf = addDays(p.weeks[w - 1]!.startDate, i);
            out.push({
              key: `${base.id}/w${w}d${i}/pain${level}`,
              base,
              asOf,
              kind: 'pain',
              s: 'pain8',
              level,
              pre: false
            });
          }
    const ends = [
      { tag: 's-1', asOf: addDays(p.input.startDate, -1) },
      ...earlyAsOfs(p).filter((a) => a.tag.endsWith('end'))
    ];
    for (const a of earlyAsOfs(p).filter((x) => x.tag.endsWith('end'))) {
      const next = p.weeks.find((w) => w.startDate > a.asOf);
      for (const d of next?.days.filter((x) => x.role === 'q1' || x.role === 'q2') ?? [])
        for (const s of ['faster', 'slower', 'test5k'] as const)
          for (const how of ['locked', 'done'] as const)
            out.push({
              key: `${base.id}/${a.tag}/${s}+${how}-${d.role}`,
              base,
              asOf: a.asOf,
              kind: 'protected',
              s,
              day: { date: d.date, how },
              pre: false
            });
    }
    // MAR-07c: umor svaki dan nedelje testa i nedelje pre nje; svaki ponedeljak nedelja 1 … N − 3.
    const tw = p.weeks.find((w) => w.test)?.index;
    const days = new Set<string>();
    for (let w = 1; w <= N - 3; w++) days.add(p.weeks[w - 1]!.startDate);
    if (tw !== undefined)
      for (const w of [tw - 1, tw].filter((x) => x >= 1))
        for (let i = 0; i < 7; i++) days.add(addDays(p.weeks[w - 1]!.startDate, i));
    for (const asOf of [...days].sort())
      out.push({
        key: `${base.id}/${asOf}/fatigueDay`,
        base,
        asOf,
        kind: 'fatigueDay',
        s: 'fatigue',
        pre: false
      });
    for (const a of ends)
      out.push({
        key: `${base.id}/${a.tag}/fatigue+7`,
        base,
        asOf: a.asOf,
        kind: 'fatigue',
        s: 'fatigue',
        pre: a.tag === 's-1'
      });
  }
  return out;
}

const deloads = (p: MarathonV2Plan): string =>
  p.weeks
    .filter((w) => w.deload)
    .map((w) => w.index)
    .join(',');

/** Pouka 36: isti zapisi umora ponovo asOf + 1 … + 7 → bez novog rasterećenja i bez trake; null = važi. */
function fatigueRepeat(f: EarlyFlow, p: MarathonV2Plan): string | null {
  const facts = factsOf(p, 'fatigue', f.asOf);
  const a1 = adaptMarathonV2(p, facts, f.asOf);
  if (!a1.ok)
    return `${f.key}: odbijeno ${a1.reasons
      .map((x) => x.message)
      .join(' | ')
      .slice(0, 300)}`;
  for (let k = 1; k <= 7; k++) {
    const at = addDays(f.asOf, k);
    if (at >= p.input.raceDate) break;
    const r = adaptMarathonV2(a1.plan, facts, at);
    if (!r.ok)
      return `${f.key}+${k}: odbijeno ${r.reasons
        .map((x) => x.message)
        .join(' | ')
        .slice(0, 300)}`;
    if (deloads(r.plan) !== deloads(a1.plan))
      return `${f.key}+${k}: rasterećenja ${deloads(a1.plan)} → ${deloads(r.plan)} (pouka 36)`;
    if (adaptBanner(a1.plan, r, facts, at).length > 0)
      return `${f.key}+${k}: traka za isti umor (pouke 20 i 36)`;
    const bad = adaptInvariants(a1.plan, r.plan, at, facts);
    if (bad.length > 0) return `${f.key}+${k}: ${bad.join('; ')}`;
  }
  return null;
}

/** Jedan tok: null = prihvaćen i invarijante važe; inače opis. */
export function runFlow(f: EarlyFlow): string | null {
  const p = planOf(f.base);
  if (f.kind === 'fatigue') return fatigueRepeat(f, p);
  const day =
    f.kind === 'protected'
      ? p.weeks.flatMap((w) => w.days).find((d) => d.date === f.day!.date)!
      : null;
  const facts =
    f.kind === 'protected'
      ? {
          ...factsOf(p, f.s as Scenario, f.asOf),
          ...(f.day!.how === 'locked'
            ? { lockedDayIds: [day!.date] }
            : {
                workouts: [
                  {
                    date: f.asOf,
                    dayId: day!.date,
                    km: day!.workout.km,
                    durationSec: day!.workout.sec,
                    completed: true
                  }
                ]
              })
        }
      : f.kind === 'early'
        ? earlyFacts(p, f.s as EarlyScenario, f.asOf)
        : f.kind === 's17' || f.kind === 'fatigueDay'
          ? factsOf(p, f.s as Scenario, f.asOf)
          : painFacts(f.asOf, f.level!);
  let r = adaptMarathonV2(p, facts, f.asOf);
  let before = p;
  let at = f.asOf;
  let used = facts;
  // N10.7: lanac — drugi korak (manjak 50 %) nedelju kasnije.
  if (r.ok && f.kind === 's17' && f.s === 'chain') {
    [before, at] = [r.plan, addDays(f.asOf, 7)];
    used = chainFacts(r.plan, at);
    r = adaptMarathonV2(before, used, at);
  }
  if (!r.ok)
    return `${f.key}: odbijeno ${r.reasons
      .map((x) => x.message)
      .join(' | ')
      .slice(0, 300)}`;
  const bad = adaptInvariants(before, r.plan, at, used);
  return bad.length > 0 ? `${f.key}: ${bad.join('; ')}` : null;
}

export function describeEarly(title: string, pick: () => EarlyFlow[]): void {
  describe(title, () => {
    let flows: EarlyFlow[] = [];
    const bad: string[] = [];
    beforeAll(() => {
      flows = pick();
      for (const f of flows) {
        const x = runFlow(f);
        if (x) bad.push(x);
      }
    }, EARLY_TIMEOUT);
    it('0 odbijanja i adaptInvariants prazno (K1, Uslov 8, pouka 23)', () => {
      expect(flows.length).toBeGreaterThan(0);
      expect(bad.slice(0, 20)).toEqual([]);
      expect(bad).toHaveLength(0);
    });
  });
}
