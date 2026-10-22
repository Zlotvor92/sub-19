/* 10K v2 06i (10k-v2.8.0, pouka 37): trajna mreža mešovite nedelje — zajednički kod za mixedGrid.node.test.ts (deo 1) i
   mixedGrid.<k>.full.node.test.ts. Planovi mreže E (testInputs.earlyGridBases; pun: svaki STRIDE.full., brz: svaki
   STRIDE.fast.); za svaku nedelju k ∈ 2 … N − 3:
   - umor (zapisi asOf − 1 i − 3) sa asOf = SVAKI dan nedelje k;
   - umor asOf prvi dan nedelje k + zaključan, odnosno urađen (upisani km) prvi dan kvaliteta nedelje k + 1;
   - nov rezultat (brži) kraj nedelje k + zaključan, odnosno urađen prvi dan kvaliteta nedelje k + 1 (obrazac
     locked-result, MAR-07b).
   Po toku: 0 odbijanja, adaptInvariants prazno; u svakoj mešovitoj nedelji (deo dana zaštićen: ≤ asOf, zaključan,
   urađen; trkačka izuzeta) preostali dani ≤ cilj − zbir zaštićenih po činjenicama (nezavisno izračunat ovde) ili
   upozorenje MIXED_OVER_TARGET sa razlogom za tu nedelju. Mreža mora sadržati skraćene mešovite nedelje (keptKm). */

import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part } from '@/test/level';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays, mustDay } from './dates.ts';
import { earlyPlan } from './earlyGrid.harness.node.test.ts';
import { GRID_TIMEOUT, missingParts } from './level.harness.node.test.ts';
import { earlyGridBases, type EarlyBase, factsOf } from './testInputs.ts';
import type { PlanDay, TenKV2Facts, TenKV2Plan } from './types.ts';
import { fileURLToPath } from 'node:url';

export const MIXED_PARTS = 10;
const HERE = fileURLToPath(new URL('./', import.meta.url));
const STRIDE = { full: 12, fast: 240 } as const;
const EPS = 1e-6;
const TOL = 0.1;

/** Planovi mreže u delu `partIndex` (brz nivo: ceo uzorak u delu 1). */
export function mixedBases(partIndex: number): EarlyBase[] {
  const xs = earlyGridBases().filter((_, i) => i % (FULL ? STRIDE.full : STRIDE.fast) === 0);
  return FULL ? part(xs, partIndex, MIXED_PARTS) : xs;
}

export interface MixedFlow {
  key: string;
  base: EarlyBase;
  asOf: string;
  facts: Record<string, unknown>;
}

/** Prvi dan kvaliteta nedelje (Q1 ili drugi zahtevni dan osim dugog, trke i testa). */
const firstQuality = (days: readonly PlanDay[]): PlanDay | undefined =>
  days.find((x) => x.role === 'q1' || (x.hard && !['long', 'race', 'test'].includes(x.role)));

/** Tokovi plana: umor svaki dan nedelje k; umor/rezultat + zaključan ili urađen Q1 nedelje k + 1. */
export function mixedFlows(b: EarlyBase): MixedFlow[] {
  const p = earlyPlan(b);
  const N = p.weeks.length;
  const out: MixedFlow[] = [];
  for (let k = 2; k <= N - 3; k++) {
    const w = p.weeks[k - 1]!;
    for (let o = 0; o < 7; o++) {
      const at = addDays(w.startDate, o);
      out.push({
        key: `${b.id}/w${k}+${o}/fatigue`,
        base: b,
        asOf: at,
        facts: factsOf(p, 'fatigue', at)
      });
    }
    const q = firstQuality(p.weeks[k]!.days);
    if (!q) continue;
    for (const [s, at] of [
      ['fatigue', w.startDate],
      ['faster', w.endDate]
    ] as const) {
      const f = factsOf(p, s, at);
      out.push({
        key: `${b.id}/w${k}/${s}/locked`,
        base: b,
        asOf: at,
        facts: { ...f, lockedDayIds: [q.date] }
      });
      // Urađen unapred (zapis na dan asOf za dan posle asOf, kao repeatGrid) → adaptation.doneDayIds.
      const done = {
        date: at,
        dayId: q.date,
        km: q.workout.km,
        durationSec: q.workout.sec,
        completed: true,
        rpe: 5
      };
      const ws = (f['workouts'] as unknown[] | undefined) ?? [];
      out.push({
        key: `${b.id}/w${k}/${s}/done`,
        base: b,
        asOf: at,
        facts: { ...f, workouts: [...ws, done] }
      });
    }
  }
  return out;
}

/** Nezavisno od koda (pouka 37 dopuna 5K-08i): km zaštićenog dana po činjenicama — pauza 0, zapisi dana zbir urađenih
    km, dan poznat iz potpune pokrivenosti bez zapisa 0, inače planirano. */
function factKm(d: PlanDay, facts: TenKV2Facts): number {
  const t = mustDay(d.date);
  if ((facts.breaks ?? []).some((x) => mustDay(x.from) <= t && t <= mustDay(x.to))) return 0;
  const recs = (facts.workouts ?? []).filter((x) => (x.dayId ?? x.date) === d.date);
  if (recs.length > 0) return recs.reduce((a, x) => a + (x.completed ? x.km : 0), 0);
  const c = facts.coverage;
  if (c?.complete && mustDay(c.from) <= t && t <= mustDay(c.to)) return 0;
  return d.countsToWeek ? d.workout.km : 0;
}

export interface MixedRun {
  ok: boolean;
  bad: string[];
  /** Mešovitih nedelja (sa zaštićenim i preostalim danima, van trkačke). */
  mixed: number;
  /** Nedelja sa preostalim danima skraćenim na ostatak (keptKm). */
  cut: number;
  /** Nedelja iznad cilja sa upozorenjem MIXED_OVER_TARGET. */
  over: number;
}

export function runMixed(f: MixedFlow): MixedRun {
  const p0: TenKV2Plan = earlyPlan(f.base);
  const facts = f.facts as unknown as TenKV2Facts;
  const r = adaptTenKV2(p0, f.facts, f.asOf);
  if (!r.ok)
    return {
      ok: false,
      bad: [`${f.key}: ${JSON.stringify(r).slice(0, 400)}`],
      mixed: 0,
      cut: 0,
      over: 0
    };
  const bad = adaptInvariants(p0, r.plan, f.asOf, facts).map((v) => `${f.key}: ${v}`);
  const t = mustDay(f.asOf);
  const done = new Set(
    (facts.workouts ?? []).filter((x) => x.completed).map((x) => x.dayId ?? x.date)
  );
  const locked = new Set(facts.lockedDayIds ?? []);
  const prot = (d: PlanDay): boolean =>
    mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date);
  let mixed = 0;
  let cut = 0;
  let over = 0;
  for (const w of r.plan.weeks) {
    if (w.phase === 'race' || mustDay(w.endDate) <= t) continue;
    const kept = w.days.filter(prot);
    const free = w.days.filter((d) => !prot(d));
    if (kept.length === 0 || free.length === 0) continue;
    mixed++;
    if (w.keptKm !== undefined) cut++;
    const kf = kept.reduce((a, d) => a + factKm(d, facts), 0);
    const freeKm = free.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0);
    if (freeKm <= w.targetKm - kf + TOL + EPS) continue;
    const warn = r.plan.warnings.find((v) => v.rule === 'MIXED_OVER_TARGET' && v.week === w.index);
    if (warn && warn.message.includes('pouka 37')) over++;
    else
      bad.push(
        `${f.key}: ned ${w.index} preostali ${freeKm.toFixed(2)} > cilj ${w.targetKm} − zaštićeni ${kf.toFixed(2)} bez upozorenja`
      );
  }
  return { ok: true, bad, mixed, cut, over };
}

/** Describe trajne mreže mešovite nedelje (brz: uzorak; pun: deo `partIndex`). */
export function describeMixedGrid(title: string, partIndex: number): void {
  describe(title, () => {
    let flows: MixedFlow[] = [];
    let res: MixedRun[] = [];
    beforeAll(() => {
      flows = mixedBases(partIndex).flatMap(mixedFlows);
      res = flows.map(runMixed);
    }, GRID_TIMEOUT);

    it('pun nivo: svi delovi postoje; skup tokova neprazan', () => {
      if (FULL && partIndex === 1) expect(missingParts(HERE, 'mixedGrid', MIXED_PARTS)).toEqual([]);
      expect(flows.length).toBeGreaterThan(1000);
    });

    it('0 odbijanja i adaptInvariants prazno; mešovita nedelja: preostali ≤ cilj − zaštićeni (po činjenicama) ili MIXED_OVER_TARGET', () => {
      expect(res.filter((x) => !x.ok).length).toBe(0);
      expect(res.flatMap((x) => x.bad).slice(0, 10)).toEqual([]);
    });

    it('mreža sadrži mešovite nedelje skraćene na ostatak (keptKm) i nedelje iznad cilja sa upozorenjem', () => {
      const sum = (g: (x: MixedRun) => number): number => res.reduce((a, x) => a + g(x), 0);
      expect(sum((x) => x.mixed)).toBeGreaterThan(1000);
      expect(sum((x) => x.cut)).toBeGreaterThan(100);
      expect(sum((x) => x.over)).toBeGreaterThan(0);
    });
  });
}
