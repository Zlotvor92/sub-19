/* Segment 08e (5k-v2.7.0, Odluka 9 + P2) — zajednički kod mreža „rasterećenje posle smanjenja" (uska pretraga
   organizatora) i „rana adaptacija" (šira pretraga) za segment08e.node.test.ts i segment08e.2.full.node.test.ts.
   Provere po toku NEZAVISNO od steps.ts: nedelje smanjenja iz uslova koraka (testInputs.reliefCheck), granica iz
   policy.ts (deloadEvery), prošlost iz baznog plana.

   - J1: posle nedelje smanjenja nikad redovno rasterećenje (prinudno sme); J2: niz od ukinute nedelje ≤ granice;
     J3: 0 odbijanja od validatora (dozvoljeno samo VDOT_OUT_OF_RANGE — rezultat ±2 VDOT van opsega ulaza);
     J4 (Uslov 8): km > 0, dugi ≥ lagan, nedelja ≥ minimum (u nedelji sa danima bola: cilj), nema kvaliteta ni
     ubrzanja u danima bola/odmora, prošlost bajt-ista; polje reduced tačno; rečenica Odluke 9 tačno za ukinute
     nedelje; regresija (5K-10) prema b9c4728 (segment10.e08e-b9c4728.json, otisak bez korisničkog teksta): svaki
     promenjen tok nosi razlog segmenta 09 (segment09.harness).
   - BRZ nivo: uska pretraga — svaki 6. tok po scenariju; šira — samo nedelje 1–3 („rana"), svaki 5. tok po scenariju;
     + imenovani tokovi (primeri). PUN nivo: uska cela (glavni fajl), šira cela (deo 2). */

import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, sample } from '@/test/level';
import { adaptFiveKV2 } from './adapt.ts';
import { generateFiveKV2 } from './generate.ts';
import { raceTimeForVdot } from './paces.ts';
import { isShortPrep, periodize } from './periodize.ts';
import { FIVE_K_V2_POLICY as P, rulesOf, type Athlete } from './policy.ts';
import { ref09, regress09 } from './segment09.harness.node.test.ts';
import {
  RELIEF_NARROW,
  RELIEF_WIDE,
  reliefBases,
  reliefCases,
  reliefCheck,
  type AdaptApi,
  type ReliefBase,
  type ReliefCase,
  type ReliefCheck
} from './testInputs.ts';
import type { AdaptResult, FiveKV2Plan, FiveKV2RunWalkPlan, RunWalkAdaptResult } from './types.ts';

export type Search = 'narrow' | 'wide';
const EPS = 1e-6;
const S = JSON.stringify;
export const GRID_TIMEOUT = 240_000;
const api: AdaptApi = {
  generate: (input) => generateFiveKV2(input),
  adapt: (plan, facts, asOf) => adaptFiveKV2(plan, facts, asOf)
};
/** Granica niza (Odluka 9), nezavisno od steps.ts: najduži niz izgradnje bez rasterećenja koji generator pravi u
    osnovnom rasporedu (periodize, planovi sa rasterećenjem 8–16 ned) + 1 — izmereno: ostali 5 + 1, početnik 3 + 1. */
const longestRun = (every: number): number => {
  let longest = 0;
  for (let n = P.input.planWeeks.min; n <= P.input.planWeeks.max; n++) {
    if (isShortPrep(n)) continue;
    let run = 0;
    for (const f of periodize('2026-11-02', n, every)) {
      run = ['base', 'peak', 'sharpen'].includes(f.phase) && !f.deload ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
  return longest;
};
export const LIMIT = {
  regular: longestRun(P.volume.deloadEvery) + 1,
  beginner: longestRun(P.beginner.deloadEvery) + 1
};
export const bound = (beginner: boolean): number => (beginner ? LIMIT.beginner : LIMIT.regular);
let basesCache: { narrow?: ReliefBase[]; wide?: ReliefBase[] } = {};
export const basesOf = (search: Search): ReliefBase[] =>
  (basesCache = {
    ...basesCache,
    [search]: basesCache[search] ?? reliefBases(api, search === 'wide')
  })[search]!;

/** Imenovani tokovi (uvek u uzorku): primeri iz izveštaja i P2. */
const NAMED = [
  'v45-d4-22km-14w/2026-11-15/',
  'v45-d4-22km-14w/2026-11-12/',
  'v45-d3-15km-10w/2026-11-08/',
  'beg-feel-d4-15km-10w/2026-11-08/',
  'beg-feel-d3-12km-10w/2026-12-27/',
  'feel-d4-22km-12w/2026-11-15/'
];
export function casesOf(search: Search): { b: ReliefBase; c: ReliefCase }[] {
  const all = basesOf(search).flatMap((b) =>
    reliefCases(b, search, search === 'narrow' ? RELIEF_NARROW : RELIEF_WIDE, raceTimeForVdot).map(
      (c) => ({ b, c })
    )
  );
  if (FULL) return all;
  const keep = (x: { c: ReliefCase }): boolean => NAMED.some((n) => x.c.key.startsWith(n));
  return search === 'narrow'
    ? sample(all, 6, (x) => x.c.scenario, keep)
    : sample(
        all.filter((x) => x.c.week <= 3),
        5,
        (x) => x.c.scenario,
        keep
      );
}

type Res = AdaptResult | RunWalkAdaptResult;
export interface GridFlow {
  b: ReliefBase;
  c: ReliefCase;
  res: Res;
  k: ReliefCheck;
}
const contOf = (p: FiveKV2Plan | FiveKV2RunWalkPlan): FiveKV2Plan =>
  p.planType === 'runWalk' ? p.continuous!.plan : p;
const athleteOf = (p: FiveKV2Plan): Athlete => ({
  days: p.input.runDays.length as Athlete['days'],
  beginner: p.experience === 'beginner',
  feel: p.paceMode === 'feel'
});

/** J4 (Uslov 8) za prihvaćen tok; vraća opise odstupanja. */
export function usability(f: GridFlow): string[] {
  if (!f.res.ok) return [];
  const bad: string[] = [];
  const key = f.c.key;
  const after = contOf(f.res.plan);
  const p0 = contOf(f.b.plan as FiveKV2Plan | FiveKV2RunWalkPlan);
  const rule = rulesOf(athleteOf(after));
  const steps = after.adaptation!.steps;
  const inR = (d: string, r: { from: string; to: string } | null): boolean =>
    r !== null && d >= r.from && d <= r.to;
  const painDay = (d: string): boolean => steps.some((s) => inR(d, s.pain) || inR(d, s.rest));
  const mixed = new Set(after.adaptation!.mixedWeeks);
  for (const w of after.weeks) {
    const long = w.days.find((d) => d.role === 'long');
    const min = w.phase === 'race' ? P.week.minRaceWeekKm : rule.minWeekKm;
    // 5k-v2.12.0 (T1): nedelja sa laganim danom manje — minimum za cilj (kao dani bola).
    const km =
      (w.limits?.pain?.length ?? 0) > 0 || (w.easyRest ?? 0) > 0 ? w.targetKm : w.plannedKm;
    if (!(w.limits?.rest?.length ?? 0) && km + EPS < min)
      bad.push(`${key} ned ${w.index}: ${km} km < ${min}`);
    for (const d of w.days) {
      if (!(d.workout.km > 0) || !(d.workout.sec > 0)) bad.push(`${key} ${d.date}: prazan`);
      if (!mixed.has(w.index) && long && d.role === 'easy' && d.workout.km > long.workout.km + EPS)
        bad.push(`${key} ${d.date}: lagan > dugi`);
      if (d.role === 'race' || d.date <= f.c.asOf) continue;
      if (painDay(d.date) && d.workout.kind === 'quality')
        bad.push(`${key} ${d.date}: kvalitet u danu bola`);
      if (painDay(d.date) && d.workout.segments.some((x) => x.kind === 'stride'))
        bad.push(`${key} ${d.date}: ubrzanja u danu bola`);
    }
  }
  const now = after.weeks.flatMap((w) => w.days);
  for (const d of p0.weeks.flatMap((w) => w.days).filter((x) => x.date <= f.c.asOf))
    if (S(now.find((x) => x.date === d.date)) !== S(d)) bad.push(`${key} ${d.date}: prošlost`);
  return bad;
}

/** Brojke celog skupa (pun nivo) po pretrazi: tokova, ukinuto, zadržano granicom. */
export const TOTALS: Record<
  Search,
  {
    flows: number;
    dropped: number;
    kept: number;
    /* 5K-09: brojke promena prema 51a924f (changed, formerlyRejected, family08g) uklonjene su sa tim otiskom — regresija
       je prema b9c4728 (segment10.e08e-b9c4728.json, 5K-10). */
  }
> = {
  // 5k-v2.12.0 (T4): manje redovnih rasterećenja trkača (taper 1, ≤ 8 ned bez, ne pre ned 4) → manje ukinutih
  // (bilo 988 / 978).
  narrow: {
    flows: 5952,
    dropped: 897,
    kept: 0
  },
  wide: {
    flows: 10852,
    dropped: 891,
    kept: 0
  }
};

export function describeReliefGrid(title: string, search: Search): void {
  describe(title, () => {
    const flows: GridFlow[] = [];
    beforeAll(() => {
      for (const { b, c } of casesOf(search)) {
        const res = adaptFiveKV2(b.plan as FiveKV2Plan, c.facts, c.asOf) as Res;
        flows.push({ b, c, res, k: reliefCheck(res, bound, b.plan) });
      }
    }, GRID_TIMEOUT);

    it('J3: 0 odbijanja od validatora (dozvoljeno samo VDOT_OUT_OF_RANGE: rezultat van opsega ulaza)', () => {
      expect(LIMIT).toEqual({ regular: 6, beginner: 4 });
      if (FULL) expect(flows.length).toBe(TOTALS[search].flows);
      else expect(flows.length).toBeGreaterThan(search === 'narrow' ? 900 : 400);
      const bad = flows
        .filter((f) => f.k.rejected && f.k.rejected.code !== 'VDOT_OUT_OF_RANGE')
        .map((f) => `${f.c.key}: ${f.k.rejected!.code} ${f.k.rejected!.rules.join('+')}`);
      expect(bad).toEqual([]);
    });

    it('J1, J2: posle nedelje smanjenja nikad redovno rasterećenje; niz od ukinute nedelje ≤ granice; 0 zadržanih granicom', () => {
      expect(flows.flatMap((f) => f.k.p1.map((w) => `${f.c.key} → ${w}`))).toEqual([]);
      const over = flows.flatMap((f) =>
        f.k.dropped
          .filter((x) => x.run > f.k.limit)
          .map((x) => `${f.c.key}: ned ${x.week} niz ${x.run}`)
      );
      expect(over).toEqual([]);
      const dropped = flows.filter((f) => f.k.dropped.length > 0).length;
      const kept = flows.filter((f) => f.k.keptByBound.length > 0).map((f) => f.c.key);
      expect(kept).toEqual([]);
      if (FULL)
        expect([dropped, kept.length]).toEqual([TOTALS[search].dropped, TOTALS[search].kept]);
      else expect(dropped).toBeGreaterThan(50);
    });

    it('rečenica Odluke 9 tačno za ukinute nedelje; polje reduced: pauza/manjak true, višak false, inače bez polja', () => {
      const bad: string[] = [];
      for (const f of flows) {
        if (!f.res.ok) continue;
        const dw = f.k.dropped.map((x) => x.week).sort((a, b) => a - b);
        if (S(dw) !== S([...f.k.noted].sort((a, b) => a - b)))
          bad.push(`${f.c.key}: ukinuto ${S(dw)}, poruka ${S(f.k.noted)}`);
        if (f.k.reduced!.got !== f.k.reduced!.want)
          bad.push(`${f.c.key}: reduced ${f.k.reduced!.got} ≠ ${f.k.reduced!.want}`);
        for (const x of f.res.reasons)
          for (const m of x.message.matchAll(
            /Redovno rasterećenje u nedelji (\d+) otpada: nedelja (\d+) je smanjena\./g
          ))
            if (Number(m[2]) !== Number(m[1]) - 1) bad.push(`${f.c.key}: ${m[0]}`);
      }
      expect(bad.slice(0, 10)).toEqual([]);
    });

    it('J4 (Uslov 8): km > 0, dugi ≥ lagan, nedelja ≥ minimum (dani bola: cilj), bez kvaliteta i ubrzanja u danima bola, prošlost bajt-ista', () => {
      expect(flows.flatMap(usability).slice(0, 10)).toEqual([]);
    });

    // 5K-09: otisak prema 51a924f (sa tekstom) zamenjen otiskom prema c13c258 bez korisničkog teksta (Z2); promene
    // 51a924f → c13c258 (Odluka 9, N3/N4/F/P/M/K, 08k) su u istoriji (SEGMENT-08e…08l izveštaji).
    // 5K-10 (krug T): otisak prema b9c4728 (segment10.e08e-b9c4728.json, fixes/5K/fixture10.ts).
    it('regresija prema b9c4728 (5K-10, otisak bez teksta): promenjeni tokovi nose razlog kruga T', () => {
      const ref = ref09('e08e');
      expect(ref.against).toBe('b9c4728');
      const bad = regress09(
        ref,
        flows.map((f) => ({ key: `${search}:${f.c.key}`, res: f.res }))
      );
      expect(bad.slice(0, 10)).toEqual([]);
    });

    it('determinizam (svaki 9. tok)', () => {
      for (const f of flows.filter((_, i) => i % 9 === 0))
        expect(S(adaptFiveKV2(f.b.plan as FiveKV2Plan, f.c.facts, f.c.asOf))).toBe(S(f.res));
    });
  });
}
