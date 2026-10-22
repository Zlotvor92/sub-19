/* Segment 06b (10k-v2.4.1, A4/A16): povratak posle bola ne zavisi od dana u nedelji. Mreža bola P (PAIN_GRID:
   6 planova × 2 nedelje izgradnje × 7 dana — asOf = taj dan, bol na dan asOf — × bol 4/5/7/8 = 336 tokova),
   invarijante I1–I5 NEZAVISNO od volume.ts (brojevi iz policy.ts, nivo iz baznog plana), regresija prema e6540a5
   (segment06b.adapt-hashes-e6540a5.json), primeri A–E iz nalaza organizatora i pauza + bol u istom koraku (min sa
   ciljem nedelje r). Segment 06c (10k-v2.5.0, A17): regresija prema 4917959 — menjaju se samo tokovi sa
   ukinutim rasterećenjem (segment06c.adapt-hashes-4917959.json). */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { logCompared } from '@/test/level';
import { GRID_TIMEOUT } from './level.harness.node.test.ts';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays, mustDay } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { dayRule, planRule, TEN_K_V2_POLICY as P } from './policy.ts';
import {
  factsOf,
  PAIN_GRID,
  painCases,
  painFacts,
  painGridBases,
  planHash06c,
  planHash81,
  type PainCase
} from './testInputs.ts';
import type { AdaptResult, PlanWeek, TenKV2Facts, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const A = P.adapt;
const EPS = 1e-6;
const HASHES_E65 = join(
  dirname(fileURLToPath(import.meta.url)),
  'segment06b.adapt-hashes-e6540a5.json'
);
const HASHES_491 = join(
  dirname(fileURLToPath(import.meta.url)),
  'segment06c.adapt-hashes-4917959.json'
);
/** Promenjeni tokovi mreže P prema e6540a5 (svi PAIN; nepromenjeni = bez povratka, r je taper). */
const CHANGED_P = 332;
/** 06c: promenjeni tokovi mreže P prema 4917959 (svi sa ukinutim rasterećenjem, A17), po nivou bola. */
const CHANGED_P_06C = { p4: 22, p5: 22, p7: 22, p8: 22 };
/** I3 — sudar sa D8/D23 (izveštaj 06b): uz bol 8 taper ima 1 kvalitet i duže lagane dane (5,0 umesto 3,0 km),
    pa je trkačka nedelja (cilj = planirano) veća. */
const I3_RACE_WEEK = [
  // 06c (10k-v2.5.0, A17): d5-f-18w asOf 02-05/02-06 otpadaju (r = 14, ukinuto rasterećenje ned 15); d4-r-14w
  // asOf 01-09 nov (r = 10, ukinuto rasterećenje ned 11; uz bol 8 ned 12 ima dan bola → 1 kvalitet, RP tapera
  // 2000 m umesto 2400 m, lagan tapera 4,2 umesto 3,8 km → trkačka 16,4 umesto 16,0, D23/D8).
  'd4-r-14w/w10/2027-01-09/p8 ned 14: 16 → 16.4',
  'd5-f-18w/w14/2027-02-07/p8 ned 18: 18.8 → 22.8'
];
/** I3 — nedelje sa istim ciljem bez dana bola u kojima je planirano uz bol 8 veće za ≤ 0,1 km (D19). 06c
    (A17): 16 → 14 — d5-f-18w asOf 02-05/02-06 ned 17 (taper) otpadaju zajedno sa trkačkom (ukinuto
    rasterećenje ned 15); d4-r-14w asOf 2026-11-21 ned 7 ostaje, cilj 34,7 → 37,1 (ukinuto rasterećenje ned 4). */
const I3_ROUNDING = 14;

const to10 = (km: number): number => Math.round(km * 10);
const km1 = (x10: number): string => (x10 / 10).toFixed(1).replace('.', ',');
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'development' || w.phase === 'specific';
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};

/** Pravila rasta nezavisno od volume.ts (policy.ts): D6 (+6 %, početnik +5 %), A8 (+10 %, min 1,0 km) do
    nivoa, granica izgradnje plana, donja granica nedelje (D17). */
function growthOf(p: TenKV2Plan) {
  const rule = planRule(p.input.runDays.length, p.input.experience ?? 'regular')!;
  const floor10 = to10(dayRule(p.input.runDays.length)!.weekMinKm);
  const cap10 = to10(p.peakCapKm);
  const ret10 = (ref10: number): number =>
    Math.max(to10(A.returnGrowthMinKm), Math.round(ref10 * A.returnGrowth));
  /** Nominalni cilj nedelje izgradnje (ne-rasteretne) posle osnova `ref10` u povratku do `level10`. */
  const next10 = (ref10: number, level10: number): number => {
    const g = Math.min(
      to10(rule.growthMaxKm),
      Math.max(to10(rule.growthMinKm), Math.round(ref10 * rule.growth))
    );
    const normal = Math.min(ref10 + g, Math.max(cap10, ref10));
    const t = ref10 < level10 ? Math.max(normal, Math.min(ref10 + ret10(ref10), level10)) : normal;
    return Math.max(t, floor10);
  };
  const deload10 = (ref10: number): number =>
    Math.max(Math.round(P.deload.factor * ref10), floor10);
  return { floor10, ret10, next10, deload10 };
}

/** Nezavisno: nedelja sidra r (sadrži asOf + 1), povratak (r je izgradnja), nivo pre bola (A8: poslednja
    ne-rasteretna nedelja izgradnje završena pre dana bola, inače start), osnova min(0,7 × nivo, cilj r). */
function anchorOf(p0: TenKV2Plan, after: TenKV2Plan, asOf: string, levelKm?: number) {
  const t1 = mustDay(addDays(asOf, 1));
  const r = p0.weeks.find((w) => mustDay(w.startDate) <= t1 && t1 <= mustDay(w.endDate))!.index;
  let level = p0.startKm;
  for (const w of p0.weeks)
    if (mustDay(w.endDate) < mustDay(asOf) && !w.deload && isBuild(w)) level = w.targetKm;
  const level10 = to10(levelKm ?? level);
  const wr = after.weeks[r - 1]!;
  const base10 = Math.min(Math.round(A.painEasyFactor * level10), to10(wr.targetKm));
  return { r, back: isBuild(wr), level10, base10 };
}

const bases = painGridBases();
const plans = new Map(
  bases.map((b) => {
    const r = generateTenKV2(b.input);
    if (!r.ok) throw new Error(`${b.id}: ${JSON.stringify(r.reasons)}`);
    return [b.id, r.plan] as const;
  })
);

interface Flow extends PainCase {
  p0: TenKV2Plan;
  facts: TenKV2Facts;
  res: AdaptResult;
}
const flows: Flow[] = [];

describe('mreža bola P: 6 planova × 2 nedelje × 7 dana × bol 4/5/7/8 = 336 tokova', () => {
  // Mreža se računa u beforeAll (ne u telu describe), v. level.harness.node.test.ts. Nije uzorkovana (336 tokova).
  beforeAll(() => {
    for (const b of bases) {
      const p0 = plans.get(b.id)!;
      for (const c of painCases(b.id, p0)) {
        const facts = painFacts(c.asOf, c.level) as unknown as TenKV2Facts;
        flows.push({ ...c, p0, facts, res: adaptTenKV2(p0, facts, c.asOf) });
      }
    }
  }, GRID_TIMEOUT);

  it('336 tokova, svi primenjuju PAIN; 0 odbijanja; plan nosi 10k-v2.8.0', () => {
    expect(PAIN_GRID.length).toBe(6);
    expect(flows.length).toBe(336);
    expect(flows.filter((f) => !f.res.ok).map((f) => f.key)).toEqual([]);
    for (const f of flows) {
      const r = ok(f.res);
      expect(
        r.reasons.some((x) => x.condition === 'PAIN' && x.applied),
        f.key
      ).toBe(true);
      expect(r.plan.policyVersion).toBe('10k-v2.8.0');
    }
  });

  it('06c: regresija prema 4917959 (heš bez oznake verzije i polja reduced) — menjaju se samo tokovi sa ukinutim rasterećenjem (A17); ostali bajt-isti', () => {
    const ref = JSON.parse(readFileSync(HASHES_491, 'utf8')) as {
      against: string;
      count: { gridP: number };
      gridP: Record<string, number>;
    };
    expect(ref.against).toBe('4917959');
    expect(ref.count.gridP).toBe(336);
    expect(flows.map((f) => f.key).sort()).toEqual(Object.keys(ref.gridP).sort());
    logCompared(
      'tenK.v2.4917959.gridP',
      flows.map((f) => f.key)
    );
    const marked = (f: Flow): boolean =>
      ok(f.res).plan.notes.some((x) => x.includes('(A17)') || x.includes('bilo bi'));
    const changed = flows.filter((f) => ref.gridP[f.key] !== planHash06c(f.res));
    const by: Record<string, number> = {};
    for (const f of changed) by[`p${f.level}`] = (by[`p${f.level}`] ?? 0) + 1;
    expect(by).toEqual(CHANGED_P_06C);
    expect(changed.filter((f) => !marked(f)).map((f) => f.key)).toEqual([]);
    expect(flows.filter((f) => marked(f) && !changed.includes(f)).map((f) => f.key)).toEqual([]);
    // Samo bol: korak bez cilja (startKm) nema polje reduced.
    expect(flows.filter((f) => planHash81(f.res) !== planHash06c(f.res)).length).toBe(0);
  });

  it('regresija prema e6540a5: promenjeni su samo tokovi sa povratkom posle bola (PAIN); bez povratka bajt-isto', () => {
    const ref = JSON.parse(readFileSync(HASHES_E65, 'utf8')) as {
      against: string;
      count: { grid04: number; gridP: number };
      gridP: Record<string, number>;
    };
    expect(ref.against).toBe('e6540a5');
    expect(ref.count.gridP).toBe(336);
    expect(flows.map((f) => f.key).sort()).toEqual(Object.keys(ref.gridP).sort());
    logCompared(
      'tenK.v2.e6540a5.gridP',
      flows.map((f) => f.key)
    );
    const changed = flows.filter((f) => ref.gridP[f.key] !== planHash81(f.res));
    const back = (f: Flow): boolean => ok(f.res).plan.adaptation!.steps[0]!.returnFrom !== null;
    expect(changed.length).toBe(CHANGED_P);
    expect(changed.filter((f) => !back(f)).map((f) => f.key)).toEqual([]);
    expect(flows.filter((f) => back(f) && !changed.includes(f)).map((f) => f.key)).toEqual([]);
  });

  it('korak i poruka: returnFrom.week = r (sadrži asOf + 1), samo kad je r izgradnja; „Posle nedelje r rast kreće od 70 % nivoa pre bola (osnova km)"', () => {
    let back = 0;
    for (const f of flows) {
      const r = ok(f.res);
      const st = r.plan.adaptation!.steps[0]!;
      const a = anchorOf(f.p0, r.plan, f.asOf);
      const msg = r.reasons.find((x) => x.condition === 'PAIN')!.message;
      expect(st.firstWeek, f.key).toBe(a.r);
      expect(msg, f.key).not.toMatch(/njenog cilja/);
      if (!a.back) {
        expect(st.returnFrom, f.key).toBeNull();
        expect(msg, f.key).not.toMatch(/rast kreće/);
        continue;
      }
      back++;
      expect(st.returnFrom, f.key).toEqual({ week: a.r, share: A.painEasyFactor });
      expect(to10(st.levelKm!), f.key).toBe(a.level10);
      expect(msg, f.key).toContain(
        `Posle nedelje ${a.r} rast kreće od 70 % nivoa pre bola (${km1(a.base10)} km). Povratak do ${km1(a.level10)} km`
      );
    }
    expect(back).toBe(CHANGED_P);
  });

  it('I1: cilj nedelje r + 1 = povratni rast od osnove; ≤ max(osnova + max(10 %, 1,0 km), minimum D17) i ≤ nivo pre bola; rasterećenje r + 1 = 0,8 × osnova', () => {
    const bad: string[] = [];
    let n = 0;
    for (const f of flows) {
      const r = ok(f.res);
      const a = anchorOf(f.p0, r.plan, f.asOf);
      const w = r.plan.weeks[a.r];
      if (!a.back || !w || !isBuild(w)) continue;
      const g = growthOf(r.plan);
      n++;
      const t10 = to10(w.targetKm);
      if (w.deload) {
        if (to10(w.nominalKm) !== g.deload10(a.base10))
          bad.push(`${f.key}: rasterećenje ${w.nominalKm}`);
        continue;
      }
      if (to10(w.nominalKm) !== g.next10(a.base10, a.level10))
        bad.push(`${f.key}: nominal ${w.nominalKm} ≠ ${g.next10(a.base10, a.level10) / 10}`);
      if (t10 > to10(w.nominalKm)) bad.push(`${f.key}: cilj > nominal`);
      if (t10 > Math.max(a.base10 + g.ret10(a.base10), g.floor10))
        bad.push(`${f.key}: > osnova + rast`);
      if (t10 > Math.max(a.level10, g.floor10)) bad.push(`${f.key}: > nivo`);
    }
    expect(n).toBeGreaterThan(250);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('I2: isti plan, isti nivo pre bola, isto r → cilj nedelje r + 1 isti za svaki dan u nedelji i bol 4/5/7/8', () => {
    const groups = new Map<string, Set<number>>();
    for (const f of flows) {
      const r = ok(f.res);
      const a = anchorOf(f.p0, r.plan, f.asOf);
      const w = r.plan.weeks[a.r];
      if (!a.back || !w) continue;
      const k = `${f.id}|${a.level10}|${a.r}`;
      (groups.get(k) ?? groups.set(k, new Set()).get(k)!).add(to10(w.targetKm));
    }
    expect(groups.size).toBeGreaterThanOrEqual(20);
    const multi = [...groups]
      .filter(([, s]) => s.size > 1)
      .map(([k, s]) => `${k}: ${[...s].join(', ')}`);
    expect(multi).toEqual([]);
  });

  it('I3: bol 8 nikad ne daje veći cilj ili planirano od bola 5 istog dana — izuzeci samo po D8/D23 (trkačka) i D19 (zaokruženje dana), nabrojani', () => {
    const bad: string[] = [];
    const race: string[] = [];
    let rounding = 0;
    const at = new Map(flows.map((f) => [f.key, f] as const));
    for (const f of flows.filter((x) => x.level === 8)) {
      const five = ok(at.get(f.key.replace(/p8$/, 'p5'))!.res).plan;
      const eight = ok(f.res).plan;
      eight.weeks.forEach((w, i) => {
        const o = five.weeks[i]!;
        const up = w.targetKm > o.targetKm + EPS || w.plannedKm > o.plannedKm + EPS;
        if (!up) return;
        // Trkačka nedelja: cilj = planirano (D8), lagani dani ≤ najkraći lagani dan tapera (D23).
        if (w.phase === 'race') race.push(`${f.key} ned ${w.index}: ${o.targetKm} → ${w.targetKm}`);
        // Isti cilj, bez dana bola/odmora: planirano = cilj ± zaokruženje dana (D19, tolerancija 0,1 km).
        else if (
          w.targetKm === o.targetKm &&
          !w.limits?.pain &&
          !w.limits?.rest &&
          !o.limits?.pain &&
          !o.limits?.rest &&
          w.plannedKm - o.plannedKm <= P.tolerance.plannedKm + EPS
        )
          rounding++;
        else
          bad.push(
            `${f.key} ned ${w.index}: cilj ${o.targetKm} → ${w.targetKm}, planirano ${o.plannedKm} → ${w.plannedKm}`
          );
      });
    }
    expect(bad).toEqual([]);
    expect(race).toEqual(I3_RACE_WEEK);
    expect(rounding).toBe(I3_ROUNDING);
  });

  it('I4: od r + 1 do nivoa svaka nedelja izgradnje ≤ prethodna ne-rasteretna (prva: osnova) + max(10 %, 1,0 km)', () => {
    const bad: string[] = [];
    for (const f of flows) {
      const r = ok(f.res);
      const a = anchorOf(f.p0, r.plan, f.asOf);
      if (!a.back) continue;
      const g = growthOf(r.plan);
      let ref = a.base10;
      for (const w of r.plan.weeks.slice(a.r)) {
        if (!isBuild(w)) break;
        const t10 = to10(w.targetKm);
        if (t10 > Math.max(ref + g.ret10(ref), g.floor10))
          bad.push(`${f.key} ned ${w.index}: ${w.targetKm} > ${(ref + g.ret10(ref)) / 10}`);
        if (w.deload) continue;
        ref = t10;
        if (t10 >= a.level10) break;
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('I5 (Uslov 8): km > 0, dugi ≥ lagan, nedelja ≥ minimum D17, dani bola/odmora bez kvaliteta i ubrzanja, 0 grešaka validatora, zaštita prošlosti bajt-isto', () => {
    const bad: string[] = [];
    for (const f of flows) {
      const r = ok(f.res);
      for (const v of adaptInvariants(f.p0, r.plan, f.asOf, f.facts)) bad.push(`${f.key}: ${v}`);
      const errors = validatePlan(r.plan).filter((v) => v.severity === 'error');
      if (errors.length > 0)
        bad.push(`${f.key}: validator ${errors.map((v) => v.rule).join(', ')}`);
      const st = r.plan.adaptation!.steps[0]!;
      const from = mustDay((st.rest ?? st.pain)!.from);
      const to = mustDay(st.pain!.to);
      for (const d of r.plan.weeks.flatMap((w) => w.days)) {
        const t = mustDay(d.date);
        if (t < from || t > to || d.role === 'race') continue;
        if (
          (d.workout.kind !== 'easy' && d.workout.kind !== 'long') ||
          d.workout.blocks.some(
            (b) => b.kind === 'reps' || b.kind === 'continuous' || b.kind === 'pyramid'
          )
        )
          bad.push(`${f.key}: ${d.date} ${d.role} ${d.workout.title}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('deterministički: drugi poziv = isti JSON (A14)', () => {
    for (const f of flows.filter((_, i) => i % 7 === 0))
      expect(JSON.stringify(adaptTenKV2(f.p0, f.facts, f.asOf))).toBe(JSON.stringify(f.res));
  });
});

describe('pauza + bol u istom koraku: osnova = min(0,7 × nivo koraka, cilj nedelje r) — bez skoka iznad cilja pauze', () => {
  it('asOf nedelja (r = n): cilj r = cilj pauze; r + 1 raste od min(0,7 × nivo, cilj pauze); sredina nedelje: r + 1 = cilj pauze (A3)', () => {
    let sunday = 0;
    let bites = 0;
    let mid = 0;
    const bad: string[] = [];
    for (const g of PAIN_GRID) {
      const p0 = plans.get(g.id)!;
      for (const week of g.weeks)
        for (let i = 0; i < 7; i++) {
          const asOf = addDays(p0.weeks[week - 1]!.startDate, i);
          const facts = factsOf(p0, 'painPause', asOf) as unknown as TenKV2Facts;
          const r = ok(adaptTenKV2(p0, facts, asOf));
          const st = r.plan.adaptation!.steps[0]!;
          if (!st.returnFrom || st.startKm === null) continue;
          const a = anchorOf(p0, r.plan, asOf, st.levelKm!);
          const w = r.plan.weeks[a.r];
          if (!w || !isBuild(w)) continue;
          const gr = growthOf(r.plan);
          if (st.fromWeek === a.r + 1) {
            mid++;
            if (to10(w.nominalKm) !== to10(st.startKm))
              bad.push(`${g.id}/${asOf}: r + 1 ≠ cilj pauze`);
            continue;
          }
          sunday++;
          expect(to10(r.plan.weeks[a.r - 1]!.targetKm), asOf).toBeLessThanOrEqual(to10(st.startKm));
          if (a.base10 < Math.round(A.painEasyFactor * a.level10)) bites++;
          const want = w.deload ? gr.deload10(a.base10) : gr.next10(a.base10, a.level10);
          if (to10(w.nominalKm) !== want)
            bad.push(`${g.id}/${asOf}: nominal ${w.nominalKm} ≠ ${want / 10}`);
          for (const x of adaptInvariants(p0, r.plan, asOf, facts))
            bad.push(`${g.id}/${asOf}: ${x}`);
        }
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(sunday).toBeGreaterThanOrEqual(8);
    expect(mid).toBeGreaterThanOrEqual(40);
    // min sa ciljem nedelje r mora da deluje (cilj pauze < 0,7 × nivo) — inače test ne bi video sabotažu (c).
    expect(bites).toBeGreaterThanOrEqual(4);
  });
});

/* ---------- Primeri A–E (nalaz organizatora, ponovljiv na e6540a5) ---------- */

describe('primeri A–E: 4 dana, 13 ned od 2026-10-26, 40 km, 10 km 45:00, cilj 43:00', () => {
  const g = generateTenKV2({
    startDate: '2026-10-26',
    raceDate: '2027-01-24',
    runDays: ['tue', 'thu', 'sat', 'sun'],
    currentWeeklyKm: 40,
    recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-10' },
    goalTimeSec: 2580
  });
  if (!g.ok) throw new Error(JSON.stringify(g.reasons));
  const p0 = g.plan;
  const run = (asOf: string, day: string, pain: number) =>
    ok(adaptTenKV2(p0, painFacts(day, pain), asOf)).plan.weeks;
  const row = (ws: PlanWeek[], i: number) => {
    const w = ws[i - 1]!;
    return [w.targetKm, w.plannedKm, w.days.filter((d) => d.workout.kind === 'quality').length];
  };

  it('bazni plan: ned 3 = 44,9, ned 4 rasterećenje 35,9, ned 5 = 47,6', () => {
    expect([3, 4, 5].map((i) => p0.weeks[i - 1]!.targetKm)).toEqual([44.9, 35.9, 47.6]);
    expect(p0.weeks[3]!.deload).toBe(true);
  });

  it('A: asOf 2026-11-15, bol 5 dana 2026-11-14 → r = 4, nivo 42,4, osnova 29,7; ned 5 = 32,7 (e6540a5: 27,6)', () => {
    const ws = run('2026-11-15', '2026-11-14', 5);
    expect([4, 5, 6].map((i) => row(ws, i))).toEqual([
      [35.9, 26.6, 0],
      [32.7, 32.67, 2],
      [36, 36, 2]
    ]);
  });

  it('B: isto, bol 8 → ned 5 = 32,7 (pon–sre ograničeni; e6540a5: pun cilj 47,6)', () => {
    const ws = run('2026-11-15', '2026-11-14', 8);
    expect([4, 5, 6].map((i) => row(ws, i))).toEqual([
      [35.9, 21, 0],
      [32.7, 30.59, 1],
      [36, 35.97, 2]
    ]);
  });

  it('C: asOf 2026-11-18, bol 5 → r = 4, nivo 44,9, osnova 31,4; ned 5 = 34,5 (e6540a5: 47,6 sa kvalitetom)', () => {
    const ws = run('2026-11-18', '2026-11-18', 5);
    expect([4, 5, 6].map((i) => row(ws, i))).toEqual([
      [35.9, 29.1, 0],
      [34.5, 32.19, 1],
      [38, 37.97, 2]
    ]);
  });

  it('D: isto, bol 8 → ned 5 = 34,5 (e6540a5: 47,6 / 37,9)', () => {
    const ws = run('2026-11-18', '2026-11-18', 8);
    expect([4, 5, 6].map((i) => row(ws, i))).toEqual([
      [35.9, 17.9, 0],
      [34.5, 27.3, 0],
      [38, 37.97, 2]
    ]);
  });

  it('E: asOf 2026-11-13, bol 7 → r = 3, nivo 42,4, osnova 29,7; 06c (A17): rasterećenje ned 4 ukinuto → ned 4 = 32,7 (4.1: 23,8), ned 5 = 36,0, ned 6 = 39,6', () => {
    const ws = run('2026-11-13', '2026-11-13', 7);
    expect([4, 5, 6].map((i) => row(ws, i))).toEqual([
      [32.7, 25.1, 0],
      [36, 35.97, 2],
      [39.6, 39.6, 2]
    ]);
    expect(ws[3]!.deload).toBe(false);
  });
});
