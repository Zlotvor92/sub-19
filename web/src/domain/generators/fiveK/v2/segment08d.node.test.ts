/* Segment 08d (5k-v2.6.1, Odluka 1 dopuna): povratak posle bola ne zavisi od dana u nedelji. Sidro = nedelja r
   koja sadrži asOf + 1; posle nje rast kreće od osnove min(0,7 × nivo pre bola, cilj nedelje r) (volume.returnBaseKm,
   jedino mesto). Regresija prema bf47249 (segment08d.adapt-hashes-bf47249.json): postojeće mreže adaptacije (732
   toka) i mreža bola P (7 planova × 2 nedelje × 7 dana × bol 4/5/7/8 = 392 toka) — menjaju se samo tokovi sa
   primenjenim PAIN i povratkom. Invarijante I1–I5 NEZAVISNO od pravila osnove u volume.ts (brojevi iz policy.ts,
   nivo iz baznog plana; iz volume.ts samo fitTargetKm/capacityKm — rupe izvodljivih ciljeva i kapacitet), pauza +
   bol u istom koraku (min sa ciljem nedelje r deluje) i primeri A–E iz nalaza organizatora. Odluka organizatora o
   sudarima 08d: (1) korak bola sa povratkom počinje novu progresiju doze od r + 1 (steps.doseResetAt) — nijedan tok
   bola sa povratkom nije odbijen; (2) 5K v2 ključevi osveženi u 5K 08d (oznaka 5k-v2.6.1); ostali ključevi su sa
   068410b (tenK/v2/app/byteSame.068410b.json).
   08e (5k-v2.7.0, Odluka 9): heš bez polja koraka `reduced` (canonResult08e; bf47249 ga nema, pa su heševi isti kao
   pre); redovno rasterećenje odmah posle nedelje sidra otpada — izmenjena očekivanja: nekadašnji BASE_R_DECREASE
   (ned 4 više nije rasterećenje), I1 (broj rasterećenja r + 1), primer E. */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays, mustDay } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { raceTimeForVdot } from './paces.ts';
import { FIVE_K_V2_POLICY as P, rulesOf, type Athlete } from './policy.ts';
import {
  adaptNetworkFlows,
  doneFacts,
  historyFacts,
  PAIN_GRID,
  painCases,
  painFacts,
  painGridBases,
  START,
  type AdaptApi,
  type PainBase,
  type PainCase
} from './testInputs.ts';
import type {
  AdaptResult,
  FiveKV2Plan,
  FiveKV2RunWalkPlan,
  PlanWeek,
  RunWalkAdaptResult
} from './types.ts';
import { doseResetAt } from './steps.ts';
import { validatePlan } from './validate.ts';
import { capacityKm, fitTargetKm } from './volume.ts';
import { userText } from './text.ts';
import { ref09, regress09 } from './segment09.harness.node.test.ts';

const A = P.adapt;
const EPS = 1e-6;
const round1 = (x: number): number => Math.round(x * 10) / 10;
const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
const S = JSON.stringify;
const REF = JSON.parse(
  readFileSync(new URL('./segment08d.adapt-hashes-bf47249.json', import.meta.url), 'utf8')
) as {
  against: string;
  policyVersion: string;
  count: { network: number; gridP: number };
  rejectedNetwork: string[];
  rejectedGridP: string[];
  network: Record<string, string>;
  gridP: Record<string, string>;
};
const api: AdaptApi = {
  generate: (input) => generateFiveKV2(input),
  adapt: (plan, facts, asOf) => adaptFiveKV2(plan, facts, asOf)
};

type Any = FiveKV2Plan | FiveKV2RunWalkPlan;
type Res = AdaptResult | RunWalkAdaptResult;
/** Kontinuirani plan rezultata (trčanje/hodanje posle prelaza: continuous.plan). */
const contOf = (p: Any): FiveKV2Plan => (p.planType === 'runWalk' ? p.continuous!.plan : p);
/** Kontinuirani deo, ako postoji (trčanje/hodanje bez prelaza: null). */
const contOrNull = (p: Any): FiveKV2Plan | null =>
  p.planType === 'runWalk' ? (p.continuous?.plan ?? null) : p;
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen';
const athleteOf = (p: FiveKV2Plan): Athlete => ({
  days: p.input.runDays.length as Athlete['days'],
  beginner: p.experience === 'beginner',
  feel: p.paceMode === 'feel'
});
/** Primenjen PAIN sa povratkom (korak kontinuiranog plana ima returnFrom). */
const painBack = (r: Res): boolean =>
  r.ok &&
  r.reasons.some((x) => x.condition === 'PAIN' && x.applied) &&
  (contOrNull(r.plan)?.adaptation?.steps ?? []).some((s) => s.returnFrom);

/** Nezavisno: nedelja sidra r (sadrži asOf + 1), povratak (r je izgradnja), nivo pre bola (poslednja ne-rasteretna
    nedelja izgradnje završena pre dana bola, inače start plana), osnova min(round1(0,7 × nivo), cilj nedelje r). */
function anchorOf(p0: FiveKV2Plan, after: FiveKV2Plan, asOf: string, levelKm?: number) {
  const t1 = mustDay(addDays(asOf, 1));
  const r = p0.weeks.find((w) => mustDay(w.startDate) <= t1 && t1 <= mustDay(w.endDate))!.index;
  let level = p0.startKm;
  for (const w of p0.weeks)
    if (mustDay(w.endDate) < mustDay(asOf) && !w.deload && isBuild(w)) level = w.targetKm;
  const L = levelKm ?? level;
  const share = round1(A.painEasyFactor * L);
  const base = Math.min(share, after.weeks[r - 1]!.targetKm);
  return { r, back: isBuild(p0.weeks[r - 1]!), L, share, base };
}

/** Pravila iz policy.ts (nezavisno od volume.ts): donja granica nedelje (minimum nedelje, izgradnja n × lagan ≥ 3
    km), povratni rast +10% do nivoa (veći od redovnog), rasterećenje 0,8 × osnova; izvodljiv cilj (rupe) i
    kapacitet iz volume.ts. */
function rulesFor(p0: FiveKV2Plan, after: FiveKV2Plan) {
  const a = athleteOf(after);
  const rule = rulesOf(a);
  const floorAt = (i: number): number => {
    const w = p0.weeks[i - 1]!;
    const easy = w.phase === 'taper' || w.phase === 'race' ? P.easy.taperMinKm : P.easy.minKm;
    return Math.min(w.targetKm, Math.max(rule.minWeekKm, round1(a.days * easy)));
  };
  const fitAt = (i: number, x: number): number =>
    fitTargetKm(Math.min(Math.max(x, floorAt(i)), capacityKm(after.paces, a)), after.paces, a);
  const grow = (ref: number): number =>
    floor1(ref * (1 + Math.max(A.returnGrowth, rule.maxBuildGrowth)));
  /** Cilj nedelje i (izgradnja) posle osnove `base` u povratku do nivoa L. */
  const nextAt = (i: number, base: number, L: number, deload: boolean): number =>
    fitAt(i, deload ? round1(base * P.volume.deloadFactor) : Math.min(grow(base), L));
  return { a, rule, floorAt, fitAt, grow, nextAt };
}

/* ---------- tokovi ---------- */

const bases = painGridBases(api);
interface Flow extends PainCase {
  b: PainBase;
  p0: FiveKV2Plan;
  facts: Record<string, unknown>;
  res: Res;
}
const flows: Flow[] = [];
for (const b of bases)
  for (const c of painCases(b)) {
    const facts = painFacts(c.asOf, c.level);
    flows.push({
      ...c,
      b,
      p0: b.cont as FiveKV2Plan,
      facts,
      res: adaptFiveKV2(b.plan as Any, facts, c.asOf)
    });
  }
const okFlows = flows.filter((f) => f.res.ok) as (Flow & {
  res: Extract<Res, { ok: true }>;
})[];
const at = new Map(flows.map((f) => [f.key, f] as const));

/** Odluka organizatora (sudar 1, 08d): korak bola sa povratkom počinje novu progresiju doze od r + 1
    (steps.doseResetAt). Ovi tokovi su na bf47249 bili odbijeni (BASE_R_DECREASE: bol u ned 3 plana v45-d4-22km-14w,
    baza → manji obim povratka → manja R doza u ned 5; 22 toka), a bez novog starta doze i u 2.6.1 (24 toka, R ned 5
    0,90 < 1,00/1,20). Sada su prihvaćeni. */
const FORMERLY_REJECTED = [
  ...['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].flatMap((d) =>
    [4, 5, 7, 8].map((l) => `v45-d4-22km-14w/w3/${d}/p${l}`)
  ),
  ...['2026-11-21', '2026-11-22'].flatMap((d) => [4, 5].map((l) => `v45-d4-22km-14w/w3/${d}/p${l}`))
];

describe('regresija prema bf47249 (heš bez oznake verzije)', () => {
  it('fixture: bf47249, 5k-v2.6.0, 732 + 392 toka', () => {
    expect([REF.against, REF.policyVersion]).toEqual(['bf47249', '5k-v2.6.0']);
    expect(REF.count).toEqual({ network: 732, gridP: 392 });
  });

  // 5K-09: otisci prema bf47249 su zamenjeni otiskom prema c13c258 bez korisničkog teksta (Z2); promene bf47249 →
  // c13c258 (s06/pain5, mreža bola P, pouka 35) su u istoriji (SEGMENT-08d…08l izveštaji).
  it('postojeće mreže (732) i mreža bola P (392): regresija prema b9c4728 (5K-10) — promenjeni nose razlog (T1, T2, T4, T5, lanac); 0 odbijanja', () => {
    const ref = ref09('n08d');
    expect([ref.against, ref.count]).toEqual(['b9c4728', 1124]);
    const net = adaptNetworkFlows(api, raceTimeForVdot).map((f) => ({ key: f.key, res: f.result }));
    expect(net).toHaveLength(732);
    expect(flows.length).toBe(392);
    expect(regress09(ref, [...net, ...flows]).slice(0, 10)).toEqual([]);
    expect([...net, ...flows].filter((f) => !(f.res as Res).ok).map((f) => f.key)).toEqual([]);
    // Mreža bola P: 388 tokova sa povratkom (r izgradnja), 4 bez (r je taper) — 5k-v2.12.0 (T4: taper 1 nedelja; bilo 380).
    expect(flows.filter((f) => painBack(f.res)).length).toBe(388);
  });

  it('odbijanja na bf47249 (44: 22 BASE_R_DECREASE + 22 trčanje/hodanje VOLUME_GROWTH) su sada prihvaćena', () => {
    expect(REF.rejectedGridP.length).toBe(44);
    expect(REF.rejectedGridP.filter((k) => !k.startsWith('rw-'))).toEqual(
      FORMERLY_REJECTED.filter((k) => !/2026-11-20\/p[78]$/.test(k))
    );
    expect(REF.rejectedGridP.filter((k) => k.startsWith('rw-16w-pocetnik-e420/w1/')).length).toBe(
      22
    );
    for (const k of [...REF.rejectedGridP, ...FORMERLY_REJECTED])
      expect(at.get(k)!.res.ok, k).toBe(true);
  });
});

describe('sudar 1 (odluka organizatora): korak bola sa povratkom počinje novu progresiju doze od r + 1', () => {
  it('doseResetAt = r + 1 kad je r + 1 nedelja izgradnje, inače null; korak sa pauzom zadržava svoj start', () => {
    let reset = 0;
    let none = 0;
    for (const f of okFlows) {
      const after = contOf(f.res.plan);
      const st = after.adaptation!.steps.at(-1)!;
      if (!st.returnFrom) {
        expect(doseResetAt(st, after.weeks), f.key).toBeNull();
        continue;
      }
      const next = after.weeks[st.returnFrom.week];
      if (next && isBuild(next)) {
        reset++;
        expect(doseResetAt(st, after.weeks), f.key).toBe(st.returnFrom.week + 1);
      } else {
        none++;
        expect(doseResetAt(st, after.weeks), f.key).toBeNull();
      }
    }
    // 5k-v2.12.0 (T4): taper 1 nedelja — više nedelja r + 1 je izgradnja (bilo [292, 88]).
    expect([reset, none]).toEqual([348, 40]);
    const pause = {
      ...contOf(okFlows[0]!.res.plan).adaptation!.steps[0]!,
      startKm: 20,
      fromWeek: 5
    };
    expect(
      doseResetAt({ ...pause, firstWeek: 5, pauseRemainder: true }, okFlows[0]!.p0.weeks)
    ).toBe(5);
  });

  it('nekadašnji BASE_R_DECREASE: doza počinje iznova od r + 1 — ned 5 (baza) R 0,80 + T 1,00 (bez novog starta: R 0,90 < 1,00, odbijeno); 08e: ned 4 nije rasterećenje (Odluka 9), 18,2 → ned 5 20,0 km', () => {
    for (const k of FORMERLY_REJECTED) {
      const p = contOf((at.get(k)!.res as Extract<Res, { ok: true }>).plan);
      // asOf pon–sub: r = 3; 5k-v2.6.1: ned 4 rasterećenje 13,3, ned 5 = 18,2; 5k-v2.7.0: ned 4 = 18,2 (povratni
      // rast od osnove 16,6), ned 5 = 20,0. asOf nedelja (2026-11-22): r = 4 je rasterećenje — bez promene.
      const sunday = k.includes('/2026-11-22/');
      expect([p.weeks[3]!.deload, p.weeks[3]!.targetKm, p.weeks[4]!.targetKm], k).toEqual(
        sunday ? [true, 20.4, 18.2] : [false, 18.2, 20]
      );
      expect(validatePlan(p).filter((v) => v.severity === 'error')).toEqual([]);
    }
    const p = contOf(
      (at.get('v45-d4-22km-14w/w3/2026-11-18/p5')!.res as Extract<Res, { ok: true }>).plan
    );
    expect(
      p.weeks[4]!.days.filter((d) => d.workout.kind === 'quality').map((d) => [
        d.workout.qualityType,
        d.workout.workKm.R,
        d.workout.workKm.T
      ])
    ).toEqual([
      ['R', 0.8, 0],
      ['T_short', 0, 1]
    ]);
  });
});

describe('mreža bola P: korak, poruka, I1–I5', () => {
  it('svaki tok je prihvaćen i primenjuje PAIN; plan nosi tekuću oznaku; determinizam', () => {
    expect(okFlows.length).toBe(392);
    for (const f of okFlows) {
      expect(
        f.res.reasons.some((x) => x.condition === 'PAIN' && x.applied),
        f.key
      ).toBe(true);
      expect(f.res.plan.policyVersion).toBe(P.version);
      expect(contOf(f.res.plan).policyVersion).toBe(P.version);
    }
    for (const f of flows.filter((_, i) => i % 9 === 0))
      expect(S(adaptFiveKV2(f.b.plan as Any, f.facts, f.asOf))).toBe(S(f.res));
  });

  it('korak: returnFrom.week = r (= firstWeek, sadrži asOf + 1) samo kad je r izgradnja; nivo pre bola; poruka „Posle nedelje r rast kreće od 70% nivoa pre bola (osnova km)."', () => {
    let back = 0;
    for (const f of okFlows) {
      const after = contOf(f.res.plan);
      const st = after.adaptation!.steps.at(-1)!;
      const a = anchorOf(f.p0, after, f.asOf);
      const msg = f.res.reasons.find((x) => x.condition === 'PAIN')!.message;
      expect(st.firstWeek, f.key).toBe(a.r);
      expect(msg, f.key).not.toMatch(/njenog cilja/);
      if (!a.back) {
        expect(st.returnFrom ?? null, f.key).toBeNull();
        expect(msg, f.key).not.toMatch(/rast kreće/);
        continue;
      }
      back++;
      expect(st.returnFrom, f.key).toEqual({ week: a.r, share: A.painEasyFactor });
      expect(st.levelKm, f.key).toBe(a.L);
      // Bez pauze cilj nedelje r ≥ 0,7 × nivo: osnova = 70% nivoa (min ne deluje).
      expect(a.base, f.key).toBe(a.share);
      expect(msg, f.key).toContain(
        userText(
          `Posle nedelje ${a.r} rast kreće od 70% nivoa pre bola (${a.base} km). Povratak do ${a.L} km (nivo pre smanjenja)`
        )
      );
    }
    expect(back).toBe(388); // 5k-v2.12.0 (T4): bilo 380
  });

  it('I1: cilj nedelje r + 1 = povratni rast od osnove (rasterećenje: 0,8 × osnova); ≤ osnova + 10% i ≤ nivo pre bola (osim donje granice nedelje, nabrojano)', () => {
    const bad: string[] = [];
    let n = 0;
    let deloads = 0;
    let floorAbove = 0;
    for (const f of okFlows) {
      const after = contOf(f.res.plan);
      const a = anchorOf(f.p0, after, f.asOf);
      const w = after.weeks[a.r];
      if (!a.back || !w || !isBuild(w)) continue;
      const g = rulesFor(f.p0, after);
      n++;
      if (w.deload) deloads++;
      const want = g.nextAt(w.index, a.base, a.L, w.deload);
      if (w.targetKm !== want) bad.push(`${f.key}: ned ${w.index} ${w.targetKm} ≠ ${want}`);
      const floor = g.floorAt(w.index);
      if (floor > g.grow(a.base) + EPS) floorAbove++;
      if (w.targetKm > Math.max(floor, g.grow(a.base)) + EPS) bad.push(`${f.key}: > osnova + 10%`);
      if (w.targetKm > Math.max(floor, a.L) + EPS) bad.push(`${f.key}: > nivo`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(n).toBe(348); // 5k-v2.12.0 (T4): bilo 292
    // 5k-v2.6.1: 124; 5k-v2.7.0 (Odluka 9): svako redovno rasterećenje odmah posle sidra otpada.
    expect(deloads).toBe(0);
    // Donja granica nedelje (Uslov 8; volume.adaptFloorKm) iznad osnova + 10%: nijednom u mreži P.
    expect(floorAbove).toBe(0);
  });

  it('I2: isti plan, isti nivo pre bola, isto r → cilj nedelje r + 1 isti za svaki dan u nedelji i bol 4/5/7/8', () => {
    const groups = new Map<string, Set<number>>();
    for (const f of okFlows) {
      const after = contOf(f.res.plan);
      const a = anchorOf(f.p0, after, f.asOf);
      const w = after.weeks[a.r];
      if (!a.back || !w) continue;
      const k = `${f.id}|${a.L}|${a.r}`;
      (groups.get(k) ?? groups.set(k, new Set()).get(k)!).add(w.targetKm);
    }
    expect(groups.size).toBeGreaterThanOrEqual(20);
    const multi = [...groups]
      .filter(([, s]) => s.size > 1)
      .map(([k, s]) => `${k}: ${[...s].join(', ')}`);
    expect(multi).toEqual([]);
  });

  it('I3: bol 8 nikad ne daje veći cilj nijedne nedelje od bola 5 istog dana (izuzeci nabrojani)', () => {
    const up: string[] = [];
    for (const f of okFlows.filter((x) => x.level === 8)) {
      const five = at.get(f.key.replace(/p8$/, 'p5'))!;
      if (!five.res.ok) continue;
      const p5 = contOf(five.res.plan);
      contOf(f.res.plan).weeks.forEach((w, i) => {
        const o = p5.weeks[i]!;
        if (w.targetKm > o.targetKm + EPS)
          up.push(`${f.key} ned ${w.index}: ${o.targetKm} → ${w.targetKm}`);
      });
    }
    expect(up).toEqual([]);
  });

  it('I4: od r + 1 do nivoa svaka nedelja izgradnje ≤ prethodna ne-rasteretna (prva: osnova) + 10%', () => {
    const bad: string[] = [];
    for (const f of okFlows) {
      const after = contOf(f.res.plan);
      const a = anchorOf(f.p0, after, f.asOf);
      if (!a.back) continue;
      const g = rulesFor(f.p0, after);
      let ref = a.base;
      for (const w of after.weeks.slice(a.r)) {
        if (!isBuild(w)) break;
        if (w.targetKm > Math.max(g.floorAt(w.index), g.grow(ref)) + EPS)
          bad.push(`${f.key} ned ${w.index}: ${w.targetKm} > ${g.grow(ref)}`);
        if (w.deload) continue;
        ref = w.targetKm;
        if (ref + EPS >= a.L) break;
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('I5 (Uslov 8): km > 0, dugi ≥ lagan, nedelja ≥ minimum, dani bola/odmora bez kvaliteta i ubrzanja, 0 grešaka validatora, prošlost bajt-ista', () => {
    const bad: string[] = [];
    for (const f of okFlows) {
      const plan = f.res.plan;
      const after = contOf(plan);
      const errors = validatePlan(plan).filter((v) => v.severity === 'error');
      if (errors.length > 0)
        bad.push(`${f.key}: validator ${errors.map((v) => v.rule).join(', ')}`);
      const rule = rulesOf(athleteOf(after));
      const st = after.adaptation!.steps.at(-1)!;
      const inR = (d: string, r: { from: string; to: string } | null): boolean =>
        r !== null && d >= r.from && d <= r.to;
      const mixed = new Set(after.adaptation!.mixedWeeks);
      for (const w of after.weeks) {
        const long = w.days.find((d) => d.role === 'long');
        const min = w.phase === 'race' ? P.week.minRaceWeekKm : rule.minWeekKm;
        if (!(w.limits?.rest?.length ?? 0) && w.plannedKm + EPS < min)
          bad.push(`${f.key} ned ${w.index}: ${w.plannedKm} km < ${min}`);
        for (const d of w.days) {
          if (!(d.workout.km > 0) || !(d.workout.sec > 0)) bad.push(`${f.key} ${d.date}: prazan`);
          if (
            !mixed.has(w.index) &&
            long &&
            d.role === 'easy' &&
            d.workout.km > long.workout.km + EPS
          )
            bad.push(`${f.key} ${d.date}: lagan > dugi`);
          if (d.role === 'race') continue;
          if (inR(d.date, st.rest)) bad.push(`${f.key} ${d.date}: trening na dan odmora`);
          if ((inR(d.date, st.pain) || inR(d.date, st.rest)) && d.workout.kind === 'quality')
            bad.push(`${f.key} ${d.date}: kvalitet u danu bola`);
          if (inR(d.date, st.pain) && d.workout.segments.some((x) => x.kind === 'stride'))
            bad.push(`${f.key} ${d.date}: ubrzanja u danu bola`);
        }
      }
      // Prošlost (dani ≤ asOf) bajt-ista; trčanje/hodanje: ceo deo pre prelaza bajt-isti.
      const before = f.p0.weeks.flatMap((w) => w.days).filter((d) => d.date <= f.asOf);
      const now = after.weeks.flatMap((w) => w.days);
      for (const d of before)
        if (S(now.find((x) => x.date === d.date)) !== S(d))
          bad.push(`${f.key} ${d.date}: prošlost`);
      if (plan.planType === 'runWalk')
        if (S(plan.weeks) !== S((f.b.plan as FiveKV2RunWalkPlan).weeks))
          bad.push(`${f.key}: deo trčanja/hodanja`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

/* ---------- Pauza + bol u istom koraku (min sa ciljem nedelje r) ---------- */

describe('pauza 20 dana + bol 8 u istom koraku: osnova = min(0,7 × nivo koraka, cilj nedelje r)', () => {
  it('asOf nedelja (r = n): cilj r = cilj pauze; r + 1 raste od min(0,7 × nivo, cilj pauze), poruka kaže istinu kad min deluje', () => {
    const bad: string[] = [];
    let n = 0;
    let bites = 0;
    for (const b of bases.filter((x) => x.offset === 0)) {
      const p0 = b.plan as FiveKV2Plan;
      const g0 = PAIN_GRID.find((x) => x.id === b.id)!;
      for (const week of g0.weeks) {
        const asOf = p0.weeks[week - 1]!.endDate;
        const missed = p0.weeks
          .flatMap((w) => w.days)
          .filter((d) => d.countsToWeek && d.date > addDays(asOf, -20) && d.date <= asOf)
          .map((d) => ({ date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }));
        const facts = {
          workouts: [
            ...historyFacts(p0.input as unknown as Record<string, unknown>),
            ...doneFacts(p0, addDays(asOf, -20)),
            ...missed,
            { date: asOf, km: 0, durationSec: 0, completed: false, pain: 8 }
          ],
          coverage: { from: addDays(START, -28), to: asOf, complete: true }
        };
        const r = adaptFiveKV2(p0, facts, asOf);
        if (!r.ok) {
          bad.push(
            `${b.id}/${asOf}: odbijeno ${S(r.violations.filter((v) => v.severity === 'error'))}`
          );
          continue;
        }
        const st = r.plan.adaptation!.steps.at(-1)!;
        if (!st.returnFrom || st.startKm === null) continue;
        n++;
        const a = anchorOf(p0, r.plan, asOf, st.levelKm!);
        expect(st.fromWeek, b.id).toBe(a.r);
        const wr = r.plan.weeks[a.r - 1]!;
        if (Math.abs(wr.targetKm - st.startKm) > EPS)
          bad.push(`${b.id}/${asOf}: cilj r ≠ cilj pauze`);
        const msg = r.reasons.find((x) => x.condition === 'PAIN')!.message;
        if (a.base < a.share) {
          bites++;
          if (
            !msg.includes(
              userText(
                `Posle nedelje ${a.r} rast kreće od ${a.base} km (cilj nedelje ${a.r}; 70% nivoa pre bola bilo bi ${a.share} km).`
              )
            )
          )
            bad.push(`${b.id}/${asOf}: poruka ${msg}`);
        } else if (!msg.includes(userText(`rast kreće od 70% nivoa pre bola (${a.base} km)`)))
          bad.push(`${b.id}/${asOf}: poruka ${msg}`);
        const w = r.plan.weeks[a.r];
        if (!w || !isBuild(w)) continue;
        const want = rulesFor(p0, r.plan).nextAt(w.index, a.base, a.L, w.deload);
        if (w.targetKm !== want)
          bad.push(`${b.id}/${asOf}: ned ${w.index} ${w.targetKm} ≠ ${want}`);
        if (validatePlan(r.plan).some((v) => v.severity === 'error'))
          bad.push(`${b.id}/${asOf}: validator`);
      }
    }
    expect(bad).toEqual([]);
    expect(n).toBe(11); // 5k-v2.12.0 (T4): bilo 9
    // min sa ciljem nedelje r mora da deluje (cilj pauze < 0,7 × nivo) — inače test ne bi video sabotažu (c).
    expect(bites).toBe(9); // 5k-v2.12.0 (T4): bilo 7
  });
});

/* ---------- Primeri A–E (nalaz organizatora, ponovljiv na bf47249) ---------- */

describe('primeri A–E: 4 dana (uto/čet/sub/ned), 13 ned od 2026-10-26, 40 km, 5 km 21:00, cilj 20:00', () => {
  const g = generateFiveKV2({
    startDate: '2026-10-26',
    raceDate: '2027-01-24',
    runDays: ['tue', 'thu', 'sat', 'sun'],
    currentWeeklyKm: 40,
    recentResult: { distanceM: 5000, timeSec: 1260, date: '2026-10-10' },
    goalTimeSec: 1200
  });
  if (!g.ok || g.plan.planType === 'runWalk') throw new Error(S(g));
  const p0 = g.plan;
  const run = (asOf: string, day: string, pain: number) => {
    const r = adaptFiveKV2(p0, painFacts(day, pain), asOf);
    if (!r.ok) throw new Error(S(r));
    return r;
  };
  const rows = (ws: PlanWeek[]) =>
    [4, 5, 6].map((i) => {
      const w = ws[i - 1]!;
      return [w.targetKm, w.plannedKm, w.days.filter((d) => d.workout.kind === 'quality').length];
    });

  it('bazni plan: ned 2 = 43,2, ned 3 = 45,6, ned 4 rasterećenje 36,5, ned 5–6 = 45,6', () => {
    expect([2, 3, 4, 5, 6].map((i) => p0.weeks[i - 1]!.targetKm)).toEqual([
      43.2, 45.6, 36.5, 45.6, 45.6
    ]);
    expect(p0.weeks[3]!.deload).toBe(true);
  });

  it('A: asOf 2026-11-15 (ned), bol 5 dana 2026-11-14 → r = 4, nivo 43,2, osnova 30,2; ned 5 = 33,2 (bf47249: 28,0)', () => {
    const r = run('2026-11-15', '2026-11-14', 5);
    expect(r.plan.adaptation!.steps[0]!.returnFrom).toEqual({ week: 4, share: 0.7 });
    expect(rows(r.plan.weeks)).toEqual([
      [36.5, 26.6, 0],
      [33.2, 32.6, 2], // 5k-v2.12.0 (T1): lagan ≤ 0,8 × dugi → planirano < cilj
      [36.5, 36.5, 2]
    ]);
    expect(r.reasons.find((x) => x.condition === 'PAIN')!.message).toContain(
      'Posle nedelje 4 rast kreće od 70% nivoa pre bola (30,2 km). Povratak do 43,2 km (nivo pre smanjenja) po +10%/ned'
    );
  });

  it('B: isto, bol 8 → ned 5 = 33,2 (pon–sre odmor; bf47249: pun cilj 45,6)', () => {
    const r = run('2026-11-15', '2026-11-14', 8);
    expect(rows(r.plan.weeks)).toEqual([
      [36.5, 21.1, 0],
      [33.2, 30.8, 1],
      [36.5, 36.5, 2]
    ]);
  });

  it('C: asOf 2026-11-18 (sre), bol 5 → r = 4, nivo 45,6, osnova 31,9; ned 5 = 35,0 (bf47249: 45,6 sa kvalitetom)', () => {
    const r = run('2026-11-18', '2026-11-18', 5);
    expect(r.plan.adaptation!.steps[0]!.returnFrom).toEqual({ week: 4, share: 0.7 });
    expect(rows(r.plan.weeks)).toEqual([
      [36.5, 28.6, 1],
      [35, 32.6, 1],
      [38.5, 38.5, 2]
    ]);
  });

  it('D: isto, bol 8 → ned 5 = 35,0 (bf47249: 45,6 / 36,3)', () => {
    const r = run('2026-11-18', '2026-11-18', 8);
    expect(rows(r.plan.weeks)).toEqual([
      [36.5, 16.8, 1],
      [35, 28.1, 0],
      [38.5, 38.5, 2]
    ]);
  });

  it('E: asOf 2026-11-13 (pet), bol 7 → r = 3, nivo 43,2, osnova 30,2; 08e (Odluka 9): ned 4 nije rasterećenje — 33,2 = osnova + 10% (5k-v2.6.1: rasterećenje 24,2 = 0,8 × osnova; bf47249: ned 5 45,6, dva kvaliteta)', () => {
    const r = run('2026-11-13', '2026-11-13', 7);
    expect(r.plan.adaptation!.steps[0]!.returnFrom).toEqual({ week: 3, share: 0.7 });
    expect(r.plan.weeks[2]!.targetKm).toBe(45.6);
    expect(r.plan.weeks[3]!.deload).toBe(false);
    expect(rows(r.plan.weeks)).toEqual([
      [33.2, 25, 0],
      [36.5, 36.1, 2],
      [40.1, 40.1, 2]
    ]);
  });
});
