/* Mreža R 10K v2 (segment 06c, A17: 292 plana × asOf kraj ned 2…N − 4 × 7 scenarija = 18 193 toka) — zajednički kod
   za reliefGrid.node.test.ts i reliefGrid.<k>.full.node.test.ts. Provere po toku su iste kao ranije `runGrid` u telu
   `describe` (J1–J5, polje reduced, determinizam).

   - BRZ nivo: svi scenariji, deterministički uzorak tokova (`reliefCases`): R planovi — unutar (nedelje plana ×
     scenario) svaki 23. tok (redosled plan, pa asOf; 23 je uzajamno prost sa brojem asOf-ova 5…13 i sa 4 VDOT-a, pa
     uzorak obiđe sve asOf nedelje, obime i VDOT-e); F i B planovi (po 20) — unutar (porodica × scenario) svaki 9. tok;
     + imenovani: 10w-25km-v30-A-sat asOf kraj ned 3 (svi scenariji, primeri N1), 12 i 17 ned iz nekadašnjeg sudara.
   - PUN nivo: delovi po scenariju (`part(RELIEF_SCENARIOS, k, RELIEF_PARTS)`; glavni fajl = deo 1). Sve brojke celog
     skupa su po scenariju (CHANGED, REDUCED_ONLY, ukinuto), pa deo tvrdi svoj deo tabele tačno; zbirne granice (J2,
     determinizam) imaju deo po scenariju čiji je zbir današnja granica. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { mustDay } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { planRule, TEN_K_V2_POLICY as P } from './policy.ts';
import {
  fnv1a,
  planHash06c,
  dump08,
  planHash81,
  RELIEF_SCENARIOS,
  type ReliefScenario,
  reliefAsOfs,
  reliefFacts,
  reliefGridBases,
  mark07
} from './testInputs.ts';
import type { AdaptResult, PlanWeek, TenKV2AdaptStep, TenKV2Facts, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { FULL, logCompared, sample } from '@/test/level';
import {
  at7ba,
  expectCounts,
  GRID_TIMEOUT,
  hasP37,
  missingParts,
  p35FlowErrors,
  p37FlowErrors,
  p07FlowErrors,
  p08Errors,
  changed08,
  pick,
  sumOf
} from './level.harness.node.test.ts';
import { deloadWeekOf } from './steps.ts';

export const RELIEF_PARTS = 7;
const A = P.adapt;
const HERE = fileURLToPath(new URL('./', import.meta.url));
const HASHES_491 = `${HERE}segment06c.adapt-hashes-4917959.json`;
/** Izuzetak D5 A17: izgradnje od ukinute nedelje (uključujući nju) — izuzetak D5 4 + ukinuta nedelja. */
export const MAX_RUN = P.deload.exceptionRun + 1;
/** Promenjeni tokovi prema 4917959 po scenariju (svi sa A17 ili porukom N2; umor: A5, bez izmene). */
const CHANGED = {
  pause10: 739,
  pause20: 739,
  pain5: 739,
  pain8: 739,
  under: 739,
  pause10pain5: 1160
};
/** Tokovi koji se od 4917959 razlikuju SAMO po polju reduced (pauza i manjak bez A17). */
const REDUCED_ONLY = { pause10: 1860, pause20: 1860, under: 1860, pause10pain5: 1439 };
/** Ukinuto rasterećenje (J1) po scenariju. */
const DROPPED = {
  pause10: 739,
  pause20: 739,
  pain5: 739,
  pain8: 739,
  under: 739,
  pause10pain5: 739
};
/** J2: najmanji broj provera po scenariju u punom nivou; zbir 10 002 > 10 000 (današnja granica celog skupa). */
const J2_MIN: Record<ReliefScenario, number> = {
  pause10: 1667,
  pause20: 1667,
  pain5: 1667,
  pain8: 1667,
  under: 1667,
  fatigue: 0,
  pause10pain5: 1667
};
/** Determinizam (pun nivo): svaki 97. tok celog skupa; brz: svaki 6. tok uzorka. */
const DETER_FULL = 97;
const DETER_FAST = 6;
/** Brz nivo: korak uzorka unutar kategorije (R: nedelje × scenario; F/B: porodica × scenario). */
const K_R = 23;
const K_FB = 9;

const to10 = (km: number): number => Math.round(km * 10);
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'development' || w.phase === 'specific';
const gen = (input: unknown): TenKV2Plan => {
  const r = generateTenKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
export const a17Of = (r: AdaptResult): boolean =>
  r.ok && r.plan.notes.some((x) => x.includes('(A17)'));
const n2Of = (r: AdaptResult): boolean =>
  r.ok && r.plan.notes.some((x) => x.includes('nivoa pre bola bilo bi'));

/** A17 tačka 1, nezavisno od steps.ts: (a) fromWeek koraka sa ciljem smanjenja (reduced; korak bez polja:
    startKm i levelKm), (b) nedelja sidra bola; nov start se ne računa. */
function reductionWeeks(s: TenKV2AdaptStep): number[] {
  if (s.restart) return [];
  const out: number[] = [];
  if (s.reduced ?? (s.startKm !== null && s.levelKm !== null)) out.push(s.fromWeek);
  if (s.returnFrom && !out.includes(s.returnFrom.week)) out.push(s.returnFrom.week);
  return out;
}

/** Uzastopne nedelje izgradnje od nedelje `from` (1-indeks) do rasterećenja ili kraja izgradnje. */
export function buildRun(p: TenKV2Plan, from: number): number {
  let n = 0;
  for (const w of p.weeks.slice(from - 1)) {
    if (!isBuild(w) || w.deload) break;
    n++;
  }
  return n;
}

/* ---------- Tokovi ---------- */

export interface ReliefFlow {
  /** Redni broj toka u celom skupu (1…18 193; redosled plan × asOf × scenario). */
  n: number;
  key: string;
  id: string;
  weeks: number;
  week: number;
  asOf: string;
  s: ReliefScenario;
  p0: TenKV2Plan;
}

const planCache = new Map<string, TenKV2Plan>();
let inputs: Map<string, unknown> | undefined;
/** Bazni plan mreže R (generiše se jednom po procesu). */
export function reliefPlan(id: string): TenKV2Plan {
  inputs ??= new Map(reliefGridBases().map((b) => [b.id, b.input] as const));
  let p = planCache.get(id);
  if (!p) {
    if (!inputs.has(id)) throw new Error(`nije u mreži R: ${id}`);
    p = gen(inputs.get(id));
    planCache.set(id, p);
  }
  return p;
}

let allFlows: ReliefFlow[] | undefined;
/** Svi tokovi mreže R (jeftino: 292 bazna plana, bez adaptacije). */
export function reliefAll(): ReliefFlow[] {
  if (allFlows) return allFlows;
  const out: ReliefFlow[] = [];
  for (const b of reliefGridBases()) {
    const p0 = reliefPlan(b.id);
    for (const a of reliefAsOfs(p0))
      for (const s of RELIEF_SCENARIOS)
        out.push({
          n: out.length + 1,
          key: `${b.id}/w${a.week}/${s}`,
          id: b.id,
          weeks: p0.weeks.length,
          week: a.week,
          asOf: a.asOf,
          s,
          p0
        });
  }
  return (allFlows = out);
}

/** Imenovani tokovi (uvek u uzorku): primeri N1 i nekadašnji sudar (12 i 17 ned). */
const NAMED = (f: ReliefFlow): boolean =>
  (f.id === '10w-25km-v30-A-sat' && f.week === 3) ||
  f.key === '12w-25km-v30-A-sat/w2/pause10' ||
  f.key === '17w-25km-v30-A-sat/w6/pain5';
const familyOf = (id: string): 'R' | 'F' | 'B' =>
  id.startsWith('f-') ? 'F' : id.startsWith('b-') ? 'B' : 'R';

/** Tokovi koje računa brz nivo (uzorak, svi scenariji) ili deo punog (svi tokovi scenarija `scenarios`). */
export function reliefCases(scenarios: readonly ReliefScenario[]): ReliefFlow[] {
  const flows = reliefAll().filter((f) => scenarios.includes(f.s));
  if (FULL) return flows;
  const r = flows.filter((f) => familyOf(f.id) === 'R');
  const fb = flows.filter((f) => familyOf(f.id) !== 'R');
  const picked = new Set([
    ...sample(r, K_R, (f) => `${f.weeks}/${f.s}`, NAMED),
    ...sample(fb, K_FB, (f) => `${familyOf(f.id)}/${f.s}`, NAMED)
  ]);
  return flows.filter((f) => picked.has(f));
}

/* ---------- Računanje ---------- */

export interface ReliefSummary {
  flows: number;
  rejected: string[];
  hash: Record<string, number>;
  h81: Record<string, number>;
  /** 06f: tokovi sa poukom 35 u rezultatu. */
  p35: Set<string>;
  /** 06i: tokovi sa mešovitom nedeljom pouke 37 u rezultatu. */
  p37: Set<string>;
  /** 10K-07: oznaka uzroka po toku (testInputs.mark07). */
  m07: Record<string, string>;
  a17: Set<string>;
  n2: Set<string>;
  dropped: Record<string, number>;
  j1: string[];
  j2: string[];
  j2Checked: number;
  j3: string[];
  maxRun: number;
  j4: string[];
  reducedBad: string[];
  deter: { key: string; p0: TenKV2Plan; facts: TenKV2Facts; asOf: string; json: number }[];
}

/** Provere mreže R za `flows` (isto kao ranije `runGrid`); `deter(f, i)` bira tokove za determinizam. */
export function runReliefGrid(
  flows: readonly ReliefFlow[],
  deter: (f: ReliefFlow, i: number) => boolean
): ReliefSummary {
  const out: ReliefSummary = {
    flows: 0,
    rejected: [],
    hash: {},
    h81: {},
    p35: new Set(),
    p37: new Set(),
    m07: {},
    a17: new Set(),
    n2: new Set(),
    dropped: {},
    j1: [],
    j2: [],
    j2Checked: 0,
    j3: [],
    maxRun: 0,
    j4: [],
    reducedBad: [],
    deter: []
  };
  const rules = new Map<string, ReturnType<typeof growthOf>>();
  flows.forEach((f, i) => {
    const { key, p0, s } = f;
    let rule = rules.get(f.id);
    if (!rule) rules.set(f.id, (rule = growthOf(p0)));
    const { floor10, d6, ret } = rule;
    const facts = reliefFacts(p0, s, f.asOf) as unknown as TenKV2Facts;
    const res = adaptTenKV2(p0, facts, f.asOf);
    out.flows++;
    out.hash[key] = planHash06c(res);
    dump08('relief', key, res);
    out.h81[key] = planHash81(res);
    if (JSON.stringify(res).includes('Pouka 35:')) out.p35.add(key);
    if (hasP37(res)) out.p37.add(key);
    out.m07[key] = mark07(res);
    if (deter(f, i))
      out.deter.push({ key, p0, facts, asOf: f.asOf, json: fnv1a(JSON.stringify(res)) });
    if (!res.ok) {
      out.rejected.push(`${key}: ${res.reasons.map((x) => x.message).join('; ')}`);
      return;
    }
    if (a17Of(res)) out.a17.add(key);
    if (n2Of(res)) out.n2.add(key);
    const plan = res.plan;
    const st = plan.adaptation!.steps.at(-1)!;
    // Polje reduced: true tačno uz PAUSE/UNDER_EXECUTION, false uz OVER_EXECUTION, inače odsutno.
    const on = (c: string): boolean => res.reasons.some((x) => x.condition === c && x.applied);
    const want =
      on('PAUSE') || on('UNDER_EXECUTION') ? true : on('OVER_EXECUTION') ? false : undefined;
    if (st.reduced !== want || (want === undefined && 'reduced' in st))
      out.reducedBad.push(`${key}: ${String(st.reduced)}`);
    const forced = (i: number): boolean =>
      plan.adaptation!.steps.some((x) => x.deload && deloadWeekOf(x) === i);
    const red = reductionWeeks(st);
    for (const w of red) {
      const next = plan.weeks[w];
      if (!next) continue;
      // J1: posle nedelje smanjenja nikad redovno rasterećenje (prinudno sme).
      if (next.deload && !forced(next.index)) out.j1.push(`${key} ned ${next.index}`);
      // J3: ukinuto rasterećenje (bazni plan) → ≤ MAX_RUN izgradnji od njega.
      if (p0.weeks[w]!.deload && !next.deload && isBuild(next)) {
        out.dropped[s] = (out.dropped[s] ?? 0) + 1;
        const run = buildRun(plan, next.index);
        out.maxRun = Math.max(out.maxRun, run);
        if (run > MAX_RUN) out.j3.push(`${key} ned ${next.index}: ${run}`);
      }
      // J2: cilj posle smanjenja (prva nedelja posle poslednje nedelje smanjenja koraka).
      if (red.includes(w + 1) || !isBuild(next) || next.deload) continue;
      const t = to10(plan.weeks[w - 1]!.targetKm);
      const level = to10(st.levelKm!);
      const base =
        st.returnFrom?.week === w ? Math.min(Math.round(st.returnFrom.share * level), t) : t;
      const v = to10(next.targetKm);
      const hi1 = Math.max(Math.min(base + ret(base), level), base + d6(base));
      const hi2 = base + Math.max(ret(base), d6(base));
      out.j2Checked++;
      if (v > Math.max(Math.min(hi1, hi2), floor10))
        out.j2.push(
          `${key} ned ${next.index}: ${v / 10} (osnova ${base / 10}, nivo ${level / 10})`
        );
    }
    // J4 (Uslov 8): invarijante, validator, dani bola/odmora bez kvaliteta i ubrzanja.
    for (const v of adaptInvariants(p0, plan, f.asOf, facts)) out.j4.push(`${key}: ${v}`);
    const errors = validatePlan(plan).filter((v) => v.severity === 'error');
    if (errors.length > 0) out.j4.push(`${key}: validator ${errors.map((v) => v.rule).join(',')}`);
    if (st.pain) {
      const from = mustDay((st.rest ?? st.pain).from);
      const to = mustDay(st.pain.to);
      for (const d of plan.weeks.flatMap((w) => w.days)) {
        const t = mustDay(d.date);
        if (t < from || t > to || d.role === 'race') continue;
        if (
          (d.workout.kind !== 'easy' && d.workout.kind !== 'long') ||
          d.workout.blocks.some(
            (x) => x.kind === 'reps' || x.kind === 'continuous' || x.kind === 'pyramid'
          )
        )
          out.j4.push(`${key}: ${d.date} ${d.role} ${d.workout.title}`);
      }
    }
  });
  return out;
}

/** Pravila rasta plana (policy.ts): minimum nedelje, korak D6, povratni rast A8 (u desetinama km). */
function growthOf(p0: TenKV2Plan) {
  const rule = planRule(p0.input.runDays.length, p0.input.experience ?? 'regular')!;
  return {
    floor10: to10(rule.weekMinKm),
    d6: (x10: number): number =>
      Math.min(
        to10(rule.growthMaxKm),
        Math.max(to10(rule.growthMinKm), Math.round(x10 * rule.growth))
      ),
    ret: (x10: number): number =>
      Math.max(to10(A.returnGrowthMinKm), Math.round(x10 * A.returnGrowth))
  };
}

/* ---------- Describe (glavni fajl i delovi) ---------- */

/** Describe mreže R za scenarije `scenarios` (brz: svi, uzorak; pun: deo). */
export function describeReliefGrid(title: string, scenarios: readonly ReliefScenario[]): void {
  describe(title, () => {
    let all: ReliefFlow[] = [];
    let flows: ReliefFlow[] = [];
    let g: ReliefSummary;
    const isDeter = (f: ReliefFlow): boolean => f.n % DETER_FULL === 0;
    beforeAll(() => {
      all = reliefAll();
      flows = reliefCases(scenarios);
      g = runReliefGrid(flows, (f, i) => (FULL ? isDeter(f) : (i + 1) % DETER_FAST === 0));
    }, GRID_TIMEOUT);

    it('18 193 toka, 0 odbijanja (nekadašnji sudar 12 i 17 ned: 0)', () => {
      // Pun nivo: unija delova = ceo skup (svi fajlovi delova postoje).
      expect(missingParts(HERE, 'reliefGrid', RELIEF_PARTS)).toEqual([]);
      expect(new Set(all.map((f) => f.id)).size).toBe(292);
      expect(all.length).toBe(18193);
      // Izračunat je svaki izabran tok (pun: svi tokovi scenarija dela; brz: uzorak).
      expect(g.flows).toBe(flows.length);
      expect(g.rejected.slice(0, 5)).toEqual([]);
    });

    it('J5 / regresija prema 4917959 (heš bez oznake verzije i polja reduced): menjaju se samo tokovi sa ukinutim rasterećenjem (A17) ili porukom N2; svi ostali bajt-isti', () => {
      const ref = JSON.parse(readFileSync(HASHES_491, 'utf8')) as {
        against: string;
        count: { gridR: number };
        gridR: Record<string, number>;
      };
      expect(ref.against).toBe('4917959');
      expect(ref.count.gridR).toBe(18193);
      expect(all.map((f) => f.key).sort()).toEqual(Object.keys(ref.gridR).sort());
      expect(Object.keys(g.hash)).toEqual(flows.map((f) => f.key));
      logCompared('tenK.v2.4917959.gridR', Object.keys(g.hash));
      const changed: Record<string, number> = {};
      const reducedOnly: Record<string, number> = {};
      const other: string[] = [];
      const same: string[] = [];
      for (const [key, h] of Object.entries(g.hash)) {
        const s = key.split('/').at(-1)!;
        const marked = g.a17.has(key) || g.n2.has(key);
        // 10K-08: tok promenjen prema b9c4728 — heš stanja b9c4728 (atB9c u lancu), oznake toka su današnje (ne sude se).
        const c08 = changed08('relief', key);
        // 06f (pouka 35): stanje 7ba9717 za tokove koje 06f menja.
        if (ref.gridR[key] !== at7ba('relief', key, h)) {
          changed[s] = (changed[s] ?? 0) + 1;
          if (!marked && !c08) other.push(key);
        } else {
          if (marked && !c08) same.push(key);
          if (g.h81[key] !== h) reducedOnly[s] = (reducedOnly[s] ?? 0) + 1;
        }
      }
      expect(other.slice(0, 10)).toEqual([]);
      expect(same.slice(0, 10)).toEqual([]);
      expectCounts(changed, pick(CHANGED, scenarios));
      expectCounts(reducedOnly, pick(REDUCED_ONLY, scenarios));
    });

    it('06f (10k-v2.6.0): prema 7ba9717 menjaju se tačno tokovi sa poukom 35 (nedelja u rezultatu ili bazni plan)', () => {
      const runs = flows.map((f) => ({
        key: f.key,
        id: f.id,
        hash: g.hash[f.key]!,
        res: g.p35.has(f.key) ? 'Pouka 35:' : null
      }));
      expect(p35FlowErrors('relief', runs).slice(0, 10)).toEqual([]);
    });

    it('06i (10k-v2.8.0): prema 46e72eb menjaju se tačno tokovi sa mešovitom nedeljom pouke 37', () => {
      const runs = flows.map((f) => ({
        key: f.key,
        hash: g.hash[f.key]!,
        res: g.p37.has(f.key) ? 'Mešovita nedelja (pouka 37)' : null,
        m07: g.m07[f.key] ?? ''
      }));
      expect(p37FlowErrors('relief', runs).slice(0, 10)).toEqual([]);
      // 10K-07: tokovi koje 10k-v2.9.0 menja (fixture, uzrok).
      expect(p07FlowErrors('relief', runs).slice(0, 10)).toEqual([]);
      // 10K-08: tokovi koje 10k-v2.10.0 menja prema b9c4728 (fixture).
      expect(p08Errors('relief', runs).slice(0, 10)).toEqual([]);
    });

    it('J1: posle nedelje smanjenja sledeća nedelja nikad nije redovno rasterećenje (i nijedno nije zadržano zbog > 5 izgradnji); ukinuto po scenariju', () => {
      expect(g.j1.slice(0, 10)).toEqual([]);
      expectCounts(g.dropped, pick(DROPPED, scenarios));
      // Svaki tok sa ukinutim rasterećenjem nosi rečenicu A17 i obrnuto (jedna nedelja smanjenja po koraku):
      // ceo skup 6 × 739 (zbir dela tabele po scenariju; brz: zbir ukinutih u uzorku).
      expect(sumOf(DROPPED, RELIEF_SCENARIOS)).toBe(6 * 739);
      expect(g.a17.size).toBe(sumOf(g.dropped, RELIEF_SCENARIOS));
    });

    it('J2: cilj posle smanjenja ≤ max(min(osnova + max(10 %, 1,0 km), nivo), osnova + korak D6) i ≤ osnova + max(10 %, 1,0 km, korak D6)', () => {
      // Ceo skup > 10 000 provera: pun — deo po scenariju (zbir J2_MIN > 10 000); brz — ista gustina u uzorku.
      expect(sumOf(J2_MIN, RELIEF_SCENARIOS)).toBeGreaterThan(10000);
      if (FULL) expect(g.j2Checked).toBeGreaterThanOrEqual(sumOf(J2_MIN, scenarios));
      else expect(g.j2Checked).toBeGreaterThan((10000 * g.flows) / 18193);
      expect(g.j2.slice(0, 10)).toEqual([]);
    });

    it('J3: D5 sa izuzetkom A17 — od ukinutog rasterećenja ≤ 5 uzastopnih nedelja izgradnje (12 i 17 ned: tačno 5); 0 grešaka validatora', () => {
      expect(g.j3).toEqual([]);
      // Dostiže se u svakom scenariju sa ukinutim rasterećenjem (pun: svaki deo; brz: imenovani 12 i 17 ned).
      expect(g.maxRun).toBe(sumOf(DROPPED, scenarios) > 0 ? MAX_RUN : 0);
    });

    it('J4 (Uslov 8): km > 0, dugi ≥ lagan, nedelje ≥ minimum D17, dani bola/odmora bez kvaliteta i ubrzanja, prošlost i urađeno bajt-isti, 0 grešaka validatora', () => {
      expect(g.j4.slice(0, 10)).toEqual([]);
    });

    it('polje reduced: true tačno uz pauzu i manjak, odsutno u ostalim koracima (višak: mreža 04)', () => {
      expect(g.reducedBad.slice(0, 10)).toEqual([]);
    });

    it('deterministički: drugi poziv = isti JSON (A14)', () => {
      // Pun: svaki 97. tok celog skupa (> 150), deo računa svoje; brz: svaki 6. tok uzorka.
      expect(FULL ? all.filter(isDeter).length : g.deter.length).toBeGreaterThan(150);
      if (FULL) expect(g.deter.length).toBe(flows.filter(isDeter).length);
      for (const d of g.deter)
        expect(fnv1a(JSON.stringify(adaptTenKV2(d.p0, d.facts, d.asOf))), d.key).toBe(d.json);
    });
  });
}
