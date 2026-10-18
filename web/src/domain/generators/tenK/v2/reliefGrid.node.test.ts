/* Segment 06c (10k-v2.5.0, A17): redovno rasterećenje odmah posle nedelje smanjenja otpada. Mreža R
   (testInputs.reliefGridBases: 252 R + 20 F + 20 B planova × asOf kraj ned 2…N − 4 × 7 scenarija = 18 193
   tokova): regresija prema 4917959 (segment06c.adapt-hashes-4917959.json; heš bez oznake verzije i polja
   reduced), invarijante J1–J5 NEZAVISNO od steps.ts i volume.ts (nedelje smanjenja iz polja koraka,
   rasterećenja iz baznog plana, brojevi iz policy.ts), primeri iz nalaza N1, nekadašnji sudar (12 i 17 ned),
   višak + bol, umor + bol, nov start, korak sačuvan pre 10k-v2.5.0. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays, mustDay } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { planRule, TEN_K_V2_POLICY as P } from './policy.ts';
import { baseFrames, framesFor } from './steps.ts';
import {
  adaptBases,
  factsOf,
  fnv1a,
  inputOf,
  planHash06c,
  planHash81,
  RELIEF_SCENARIOS,
  reliefAsOfs,
  reliefFacts,
  reliefGridBases,
  SCHEDULES
} from './testInputs.ts';
import type { AdaptResult, PlanWeek, TenKV2AdaptStep, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const A = P.adapt;
const HASHES_491 = join(
  dirname(fileURLToPath(import.meta.url)),
  'segment06c.adapt-hashes-4917959.json'
);
/** Izuzetak D5 A17: izgradnje od ukinute nedelje (uključujući nju) — izuzetak D5 4 + ukinuta nedelja. */
const MAX_RUN = P.deload.exceptionRun + 1;
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

const to10 = (km: number): number => Math.round(km * 10);
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'development' || w.phase === 'specific';
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const gen = (input: unknown): TenKV2Plan => {
  const r = generateTenKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const a17Of = (r: AdaptResult): boolean => r.ok && r.plan.notes.some((x) => x.includes('(A17)'));
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
function buildRun(p: TenKV2Plan, from: number): number {
  let n = 0;
  for (const w of p.weeks.slice(from - 1)) {
    if (!isBuild(w) || w.deload) break;
    n++;
  }
  return n;
}

interface Summary {
  flows: number;
  rejected: string[];
  plans: number;
  hash: Record<string, number>;
  h81: Record<string, number>;
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
  deter: { key: string; p0: TenKV2Plan; facts: unknown; asOf: string; json: number }[];
}

function runGrid(): Summary {
  const out: Summary = {
    flows: 0,
    rejected: [],
    plans: 0,
    hash: {},
    h81: {},
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
  for (const b of reliefGridBases()) {
    out.plans++;
    const p0 = gen(b.input);
    const rule = planRule(p0.input.runDays.length, p0.input.experience ?? 'regular')!;
    const floor10 = to10(rule.weekMinKm);
    const d6 = (x10: number): number =>
      Math.min(
        to10(rule.growthMaxKm),
        Math.max(to10(rule.growthMinKm), Math.round(x10 * rule.growth))
      );
    const ret = (x10: number): number =>
      Math.max(to10(A.returnGrowthMinKm), Math.round(x10 * A.returnGrowth));
    for (const a of reliefAsOfs(p0))
      for (const s of RELIEF_SCENARIOS) {
        const key = `${b.id}/w${a.week}/${s}`;
        const facts = reliefFacts(p0, s, a.asOf);
        const res = adaptTenKV2(p0, facts, a.asOf);
        out.flows++;
        out.hash[key] = planHash06c(res);
        out.h81[key] = planHash81(res);
        if (out.flows % 97 === 0)
          out.deter.push({ key, p0, facts, asOf: a.asOf, json: fnv1a(JSON.stringify(res)) });
        if (!res.ok) {
          out.rejected.push(`${key}: ${res.reasons.map((x) => x.message).join('; ')}`);
          continue;
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
          plan.adaptation!.steps.some((x) => x.deload && x.fromWeek === i);
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
        for (const v of adaptInvariants(p0, plan, a.asOf, facts)) out.j4.push(`${key}: ${v}`);
        const errors = validatePlan(plan).filter((v) => v.severity === 'error');
        if (errors.length > 0)
          out.j4.push(`${key}: validator ${errors.map((v) => v.rule).join(',')}`);
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
      }
  }
  return out;
}

describe('mreža R: 292 plana × asOf kraj ned 2…N − 4 × 7 scenarija = 18 193 toka (A17)', () => {
  const g = runGrid();

  it('18 193 toka, 0 odbijanja (nekadašnji sudar 12 i 17 ned: 0)', () => {
    expect(g.plans).toBe(292);
    expect(g.flows).toBe(18193);
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
    expect(Object.keys(g.hash).sort()).toEqual(Object.keys(ref.gridR).sort());
    const changed: Record<string, number> = {};
    const reducedOnly: Record<string, number> = {};
    const other: string[] = [];
    const same: string[] = [];
    for (const [key, h] of Object.entries(g.hash)) {
      const s = key.split('/').at(-1)!;
      const marked = g.a17.has(key) || g.n2.has(key);
      if (ref.gridR[key] !== h) {
        changed[s] = (changed[s] ?? 0) + 1;
        if (!marked) other.push(key);
      } else {
        if (marked) same.push(key);
        if (g.h81[key] !== h) reducedOnly[s] = (reducedOnly[s] ?? 0) + 1;
      }
    }
    expect(other.slice(0, 10)).toEqual([]);
    expect(same.slice(0, 10)).toEqual([]);
    expect(changed).toEqual(CHANGED);
    expect(reducedOnly).toEqual(REDUCED_ONLY);
  });

  it('J1: posle nedelje smanjenja sledeća nedelja nikad nije redovno rasterećenje (i nijedno nije zadržano zbog > 5 izgradnji); ukinuto po scenariju', () => {
    expect(g.j1.slice(0, 10)).toEqual([]);
    expect(g.dropped).toEqual({
      pause10: 739,
      pause20: 739,
      pain5: 739,
      pain8: 739,
      under: 739,
      pause10pain5: 739
    });
    // Svaki tok sa ukinutim rasterećenjem nosi rečenicu A17 i obrnuto (jedna nedelja smanjenja po koraku).
    expect(g.a17.size).toBe(6 * 739);
  });

  it('J2: cilj posle smanjenja ≤ max(min(osnova + max(10 %, 1,0 km), nivo), osnova + korak D6) i ≤ osnova + max(10 %, 1,0 km, korak D6)', () => {
    expect(g.j2Checked).toBeGreaterThan(10000);
    expect(g.j2.slice(0, 10)).toEqual([]);
  });

  it('J3: D5 sa izuzetkom A17 — od ukinutog rasterećenja ≤ 5 uzastopnih nedelja izgradnje (12 i 17 ned: tačno 5); 0 grešaka validatora', () => {
    expect(g.j3).toEqual([]);
    expect(g.maxRun).toBe(MAX_RUN);
  });

  it('J4 (Uslov 8): km > 0, dugi ≥ lagan, nedelje ≥ minimum D17, dani bola/odmora bez kvaliteta i ubrzanja, prošlost i urađeno bajt-isti, 0 grešaka validatora', () => {
    expect(g.j4.slice(0, 10)).toEqual([]);
  });

  it('polje reduced: true tačno uz pauzu i manjak, odsutno u ostalim koracima (višak: mreža 04)', () => {
    expect(g.reducedBad.slice(0, 10)).toEqual([]);
  });

  it('deterministički: drugi poziv = isti JSON (A14)', () => {
    expect(g.deter.length).toBeGreaterThan(150);
    for (const d of g.deter)
      expect(fnv1a(JSON.stringify(adaptTenKV2(d.p0, d.facts, d.asOf))), d.key).toBe(d.json);
  });
});

describe('primeri: nalaz N1 i nekadašnji sudar', () => {
  const bases = new Map(reliefGridBases().map((b) => [b.id, gen(b.input)] as const));
  const adapt = (id: string, week: number, s: (typeof RELIEF_SCENARIOS)[number]) => {
    const p0 = bases.get(id)!;
    const asOf = p0.weeks[week - 1]!.endDate;
    return ok(adaptTenKV2(p0, reliefFacts(p0, s, asOf), asOf));
  };
  const rows = (p: TenKV2Plan, from: number, to: number) =>
    p.weeks.slice(from - 1, to).map((w) => [w.targetKm, w.deload]);
  const msg = (r: AdaptResult, c: string): string =>
    ok(r).reasons.find((x) => x.condition === c)!.message;

  it('10w-25km-v30-A-sat, asOf kraj ned 3: ned 5 više nije rasterećenje (4917959: pauza 17,0, bol 5 14,9, manjak 19,0)', () => {
    const id = '10w-25km-v30-A-sat';
    expect(rows(bases.get(id)!, 4, 7)).toEqual([
      [29.8, false],
      [23.8, true],
      [31.6, false],
      [33.5, false]
    ]);
    const pause = adapt(id, 3, 'pause10');
    expect(rows(pause.plan, 4, 7)).toEqual([
      [21.2, false],
      [23.3, false],
      [25, false],
      [26.5, false]
    ]);
    expect(msg(pause, 'PAUSE')).toMatch(
      / Redovno rasterećenje u nedelji 5 otpada: nedelja 4 je smanjena \(A17\)\.$/
    );
    const pain = adapt(id, 3, 'pain5');
    expect(rows(pain.plan, 4, 7)).toEqual([
      [29.8, false],
      [20.5, false],
      [22.6, false],
      [24.9, false]
    ]);
    expect(msg(pain, 'PAIN')).toContain(
      'Posle nedelje 4 rast kreće od 70 % nivoa pre bola (18,6 km).'
    );
    expect(msg(pain, 'PAIN')).toMatch(
      / Redovno rasterećenje u nedelji 5 otpada: nedelja 4 je smanjena \(A17\)\.$/
    );
    const under = adapt(id, 3, 'under');
    expect(rows(under.plan, 4, 7)).toEqual([
      [23.8, false],
      [26.2, false],
      [27.8, false],
      [29.5, false]
    ]);
    expect(msg(under, 'UNDER_EXECUTION')).toMatch(/nedelja 4 je smanjena \(A17\)\.$/);
    // Pauza + bol na kraju nedelje (r = n): jedna rečenica A17, u poruci pauze.
    const both = adapt(id, 3, 'pause10pain5');
    expect(msg(both, 'PAUSE')).toMatch(/nedelja 4 je smanjena \(A17\)\.$/);
    expect(msg(both, 'PAIN')).not.toContain('(A17)');
    // Umor: prinudno rasterećenje ned 4 (A5), redovno ned 5 ukida A5 — A17 bez dejstva.
    const tired = adapt(id, 3, 'fatigue');
    expect(rows(tired.plan, 4, 5)).toEqual([
      [22.5, true],
      [29.8, false]
    ]);
    expect(a17Of(tired)).toBe(false);
  });

  it('12 ned (smanjena ned 3) i 17 ned (smanjena ned 7): ukinuto rasterećenje, tačno 5 izgradnji do sledećeg (izuzetak A17)', () => {
    const p12 = adapt('12w-25km-v30-A-sat', 2, 'pause10').plan;
    expect(p12.weeks.filter((w) => w.deload).map((w) => w.index)).toEqual([9]);
    expect(buildRun(p12, 4)).toBe(5);
    const p17 = adapt('17w-25km-v30-A-sat', 6, 'pain5').plan;
    expect(p17.weeks.filter((w) => w.deload).map((w) => w.index)).toEqual([4, 13]);
    expect(p17.weeks.slice(7, 12).map((w) => w.targetKm)).toEqual([23, 25.3, 27.8, 29.8, 31.6]);
    expect(buildRun(p17, 8)).toBe(5);
  });
});

describe('A17: polje reduced, prinudno rasterećenje, nov start, stari korak', () => {
  const p = gen(adaptBases().find((b) => b.id === 'd4-r-14w')!.input);
  const painOn = (asOf: string) => ({
    date: asOf,
    km: 0,
    durationSec: 0,
    completed: false,
    pain: 5
  });
  const deloads = (x: TenKV2Plan): number[] => x.weeks.filter((w) => w.deload).map((w) => w.index);
  const wed6 = addDays(p.weeks[5]!.startDate, 2);
  const sun6 = p.weeks[5]!.endDate;

  it('bazni plan d4-r-14w: rasterećenja 4, 8, 11', () => {
    expect(deloads(p)).toEqual([4, 8, 11]);
  });

  it('višak + bol u istom koraku: reduced false → A17 samo preko nedelje sidra (b), nikad preko fromWeek viška', () => {
    // Sreda ned 6: r = 6, fromWeek 7 (višak); rasterećenje ned 8 ostaje (fromWeek viška nije smanjenje).
    const f = factsOf(p, 'over120', wed6) as { workouts: unknown[] };
    const mid = ok(adaptTenKV2(p, { ...f, workouts: [...f.workouts, painOn(wed6)] }, wed6));
    const st = mid.plan.adaptation!.steps[0]!;
    expect([st.fromWeek, st.startKm !== null, st.levelKm !== null, st.reduced]).toEqual([
      7,
      true,
      true,
      false
    ]);
    expect(st.returnFrom).toEqual({ week: 6, share: A.painEasyFactor });
    expect(mid.reasons.filter((x) => x.applied).map((x) => x.condition)).toEqual([
      'PAIN',
      'OVER_EXECUTION'
    ]);
    expect(deloads(mid.plan)).toEqual([4, 8, 11]);
    expect(a17Of(mid)).toBe(false);
    // Kraj ned 6: r = fromWeek = 7 → rasterećenje ned 8 otpada preko sidra bola (poruka PAIN, ne viška).
    const g = factsOf(p, 'over120', sun6) as { workouts: unknown[] };
    const end = ok(adaptTenKV2(p, { ...g, workouts: [...g.workouts, painOn(sun6)] }, sun6));
    expect(end.plan.adaptation!.steps[0]!.reduced).toBe(false);
    expect(deloads(end.plan)).toEqual([4, 11]);
    expect(end.reasons.find((x) => x.condition === 'PAIN')!.message).toMatch(
      / Redovno rasterećenje u nedelji 8 otpada: nedelja 7 je smanjena \(A17\)\.$/
    );
    expect(end.reasons.find((x) => x.condition === 'OVER_EXECUTION')!.message).not.toContain(
      '(A17)'
    );
  });

  it('prinudno rasterećenje (A5) se nikad ne ukida: umor + bol u istom koraku (sreda ned 6) → ned 7 prinudno ostaje', () => {
    const tired = (d: number) => ({
      date: addDays(wed6, -d),
      km: 6,
      durationSec: 2400,
      completed: true,
      rpe: 8
    });
    const r = ok(adaptTenKV2(p, { workouts: [tired(1), tired(3), painOn(wed6)] }, wed6));
    const st = r.plan.adaptation!.steps[0]!;
    expect([st.deload, st.fromWeek, st.returnFrom?.week]).toEqual([true, 7, 6]);
    // A5: ned 7 prinudno, redovno ned 8 ukida A5; sidro bola r = 6 → ned 7 ostaje rasterećenje.
    expect(deloads(r.plan)).toEqual([4, 7, 11]);
    expect(a17Of(r)).toBe(false);
  });

  it('nov start (pauza 35 dana) se ne računa: 16 ned, asOf kraj ned 10 → nov start ned 11 (faze ostaju, A3), rasterećenje ned 12 ostaje', () => {
    const q = gen(
      inputOf({ weeks: 16, km: 35, vdot: 45, days: SCHEDULES.A.days, long: SCHEDULES.A.long })
    );
    expect(deloads(q)).toEqual([4, 8, 12]);
    const asOf = q.weeks[9]!.endDate;
    const r = ok(adaptTenKV2(q, factsOf(q, 'pause35', asOf), asOf));
    const st = r.plan.adaptation!.steps[0]!;
    expect([st.restart, st.fromWeek, st.reduced]).toEqual([true, 11, true]);
    expect(deloads(r.plan)).toEqual([4, 8, 12]);
    expect(a17Of(r)).toBe(false);
  });

  it('korak sačuvan pre 10k-v2.5.0 (bez polja reduced, A14): rezervni put startKm i levelKm → isti plan kao nov korak', () => {
    const q = gen(reliefGridBases().find((b) => b.id === '10w-25km-v30-A-sat')!.input);
    const asOf = q.weeks[2]!.endDate;
    const fresh = ok(adaptTenKV2(q, reliefFacts(q, 'pause10', asOf), asOf)).plan;
    const old = JSON.parse(JSON.stringify(fresh)) as TenKV2Plan;
    delete (old.adaptation!.steps[0] as { reduced?: boolean }).reduced;
    old.policyVersion = '10k-v2.4.1';
    const again = ok(adaptTenKV2(old, {}, asOf)).plan;
    expect(again.weeks.slice(3, 7).map((w) => [w.targetKm, w.deload])).toEqual([
      [21.2, false],
      [23.3, false],
      [25, false],
      [26.5, false]
    ]);
    expect(again.weeks).toEqual(ok(adaptTenKV2(fresh, {}, asOf)).plan.weeks);
  });

  it('framesFor: nov start bez rasporeda D5 (faze ostaju, A3) ne briše prinudno rasterećenje — kasniji bol ga ne ukida', () => {
    // 16 ned (rasterećenja 4, 8, 12): umor (sreda ned 10) → ned 11 prinudno, ned 12 ukida A5; pauza 35 (četvrtak) →
    // nov start ned 11 bez rasporeda (4 nedelje izgradnje); bol (petak) → sidro r = 10 → ned 11 ostaje prinudna.
    const q = gen(
      inputOf({ weeks: 16, km: 35, vdot: 45, days: SCHEDULES.A.days, long: SCHEDULES.A.long })
    );
    const chk = checkInput(q.input);
    if (!chk.ok) throw new Error('ulaz');
    const day = (i: number): string => addDays(q.weeks[9]!.startDate, i);
    const step = (asOf: string, x: Partial<TenKV2AdaptStep>): TenKV2AdaptStep => ({
      asOf,
      firstWeek: 10,
      fromWeek: 11,
      result: null,
      vdot: null,
      startKm: null,
      pauseRemainder: false,
      restart: false,
      deload: false,
      noQuality: [],
      oneQuality: [],
      rest: null,
      pain: null,
      orientation: false,
      levelKm: null,
      returnFrom: null,
      ...x
    });
    const steps = [
      step(day(2), { deload: true }),
      step(day(3), {
        startKm: 20,
        reduced: true,
        pauseRemainder: true,
        restart: true,
        levelKm: 40
      }),
      step(day(4), { levelKm: 40, returnFrom: { week: 10, share: A.painEasyFactor } })
    ];
    const dropped = new Map<number, number>();
    const f = framesFor(
      baseFrames(chk.input.startDate, chk.weeks, false)!,
      q.pattern,
      chk.input.runDays,
      chk.input.raceDate,
      chk.pace,
      steps,
      dropped
    );
    expect(f.filter((w) => w.deload).map((w) => w.index)).toEqual([4, 8, 11]);
    expect([...dropped]).toEqual([]);
  });

  it('poruka PAIN kad deluje min sa ciljem nedelje sidra (pauza + bol, d4-r-14w sreda ned 6)', () => {
    const r = ok(adaptTenKV2(p, factsOf(p, 'painPause', wed6), wed6));
    expect(r.reasons.find((x) => x.condition === 'PAIN')!.message).toContain(
      'Posle nedelje 6 rast kreće od 26,5 km (cilj nedelje 6; 70 % nivoa pre bola bilo bi 29,2 km). Povratak do 41,7 km'
    );
  });
});
