/* Segment 08i (5k-v2.10.0) — trajna mreža pouke 37 (mešovita nedelja: ostatak do cilja, samo naniže) nad planovima
   uzorka Faze 4a (testInputs.earlyGridBases). Nezavisno od konstrukcije:
   - UMOR: zapisi umora pet i ned nedelje k − 1 (RPE 8), asOf SVAKI dan nedelje k (k = 2 … N − 3; tekuća nedelja
     rasterećenja je mešovita) + zaključan prvi dan kvaliteta nedelje k + 1 (obrazac locked-result; 2.10.1 i plan po
     osećaju — test se ne stavlja na zaključan dan) → 0 odbijanja;
     svaka mešovita nedelja posle asOf (trkačka izuzeta, pouka 30): planirano ≤ cilj ILI upozorenje MIXED_OVER_TARGET
     te nedelje, a tada su lagani preostali dani na minimumu (kvalitet ostaje — dopuna MAR-08); preostali dani bez
     degenerisanog dana (minimum ≤ lagan ≤ preostali dugi, prazan trening), zaštićeni dani bajt-isti.
   - Mreža mora sadržati mešovite nedelje skraćene po pouci 37 (oznaka week.MIXED_NOTE) — inače ne proverava ništa.
   BRZ nivo: BRZ_PLANOVI (segment08g.harness) + primer nalaza; PUN: svi planovi uzorka u 3 dela
   (segment08i.grid.node.test.ts deo 1, segment08i.{2,3}.full.node.test.ts). */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays, mustDay } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { BRZ_PLANOVI } from './segment08g.harness.node.test.ts';
import { earlyGridBases, earlyGridInputs } from './testInputs.ts';
import type { FiveKV2Plan, PlanDay } from './types.ts';
import { easyMinOf, MIXED_NOTE } from './week.ts';

export const GRID_TIMEOUT = 300_000;
const S = JSON.stringify;
const EPS = 0.05;
/** Primer nalaza organizatora (mixed-deload.ts): 5K b-d3-8w-25km-v36-1 k3 cilj 15,9 → 18,28. */
export const EXAMPLE_08I = 'b-d3-8w-25km-v36-1';

export interface MixedStats {
  bad: string[];
  flows: number;
  mixed: number;
  trimmed: number;
  over: number;
  /** 2.10.1: tokovi u kojima je test otpao jer bi pao na zaključan dan (napomena). */
  testLost: number;
}

const kmOf = (ds: readonly PlanDay[]): number =>
  ds.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0);

export function mixedBad(id: string, input: Record<string, unknown>): MixedStats {
  const g = generateFiveKV2(input);
  if (!g.ok) throw new Error(id);
  const p = g.plan as FiveKV2Plan;
  const st: MixedStats = { bad: [], flows: 0, mixed: 0, trimmed: 0, over: 0, testLost: 0 };
  const rec = (date: string) => ({ date, km: 6, durationSec: 2400, completed: true, rpe: 8 });
  for (let k = 2; k <= p.weeks.length - 3; k++) {
    const sun = p.weeks[k - 2]!.endDate;
    const q = p.weeks[k]!.days.find((d) => d.workout.kind === 'quality');
    for (let d = 0; d <= 6; d++) {
      const at = addDays(p.weeks[k - 1]!.startDate, d);
      const key = `${id}/k${k}/+${d}`;
      const r = adaptFiveKV2(
        p,
        { workouts: [rec(addDays(sun, -2)), rec(sun)], lockedDayIds: q ? [q.date] : [] },
        at
      );
      st.flows++;
      if (!r.ok) {
        st.bad.push(
          `${key}: odbijeno ${
            r.violations
              .filter((v) => v.severity === 'error')
              .map((v) => v.rule)
              .join('+') || r.reasons.map((x) => x.code).join('+')
          }`
        );
        continue;
      }
      if (r.plan.weeks.some((w) => w.notes.some((n) => n.includes('kontrolno trčanje otpada'))))
        st.testLost++;
      const t = mustDay(at);
      const prot = (x: PlanDay): boolean => mustDay(x.date) <= t || x.date === q?.date;
      for (const w of r.plan.weeks) {
        if (
          !r.plan.adaptation!.mixedWeeks.includes(w.index) ||
          mustDay(w.endDate) <= t ||
          w.phase === 'race'
        )
          continue;
        const kept = w.days.filter(prot);
        const free = w.days.filter((x) => !prot(x));
        if (kept.length === 0 || free.length === 0) continue;
        st.mixed++;
        if (w.notes.some((n) => n.includes(MIXED_NOTE))) st.trimmed++;
        const before = p.weeks[w.index - 1]!.days.filter(prot);
        if (S(kept) !== S(before)) st.bad.push(`${key}/w${w.index}: zaštićen dan promenjen`);
        // 5k-v2.12.0 (T1): minimum laganog iz istog mesta kao konstruktor (week.easyMinOf).
        const easyMin = easyMinOf(w.phase, r.plan.paces, w.deload);
        const long = free.find((x) => x.role === 'long');
        for (const x of free)
          if (
            x.workout.km <= 0 ||
            (x.role === 'easy' &&
              (x.workout.km + 1e-9 < easyMin ||
                x.workout.km > (long?.workout.km ?? Infinity) + 1e-9))
          )
            st.bad.push(`${key}/w${w.index}: degenerisan dan ${x.date} ${x.role} ${x.workout.km}`);
        // Zapisi umora su u nedelji k − 1 (cela prošlost): zbir zaštićenih po činjenicama = planirani km (protectedKm nema).
        if (w.protectedKm !== undefined)
          st.bad.push(`${key}/w${w.index}: protectedKm ${w.protectedKm} bez činjenica u nedelji`);
        if (w.plannedKm <= w.targetKm + EPS) continue;
        const warned = r.plan.warnings.some(
          (v) => v.rule === 'MIXED_OVER_TARGET' && v.week === w.index
        );
        // 2.10.1: kvalitet ostaje kad ni bez njega ne staje — minimum = lagani na minimumu.
        const minimal = free.every((x) => x.role !== 'easy' || x.workout.km <= easyMin + 1e-9);
        if (!warned || !minimal)
          st.bad.push(
            `${key}/w${w.index}: planirano ${w.plannedKm} > cilj ${w.targetKm} (zaštićeni ${Math.round(kmOf(kept) * 100) / 100})${warned ? ', preostali dani nisu na minimumu' : ' bez upozorenja'}`
          );
        else st.over++;
      }
    }
  }
  return st;
}

/** PUN: deo `part` od `parts` uzorka + primer nalaza u delu 1; BRZ: BRZ_PLANOVI + primer nalaza. */
export function basesOf(
  part: number,
  parts: number
): { id: string; input: Record<string, unknown> }[] {
  const ex = earlyGridInputs().filter((b) => b.id === EXAMPLE_08I && part === 1);
  const all = earlyGridBases();
  return [
    ...(FULL
      ? all.filter((_, i) => i % parts === part - 1)
      : all.filter((b) => BRZ_PLANOVI.includes(b.id))),
    ...ex
  ];
}

export function describe08i(label: string, part: 1 | 2 | 3): void {
  const bases = basesOf(part, 3);
  describe(label, () => {
    it(
      `${bases.length} planova: umor (zapisi u k − 1), asOf svaki dan nedelje k + zaključan Q1 nedelje k + 1 → 0 odbijanja; mešovita nedelja planirano ≤ cilj ili upozorenje sa minimumom (pouka 37)`,
      () => {
        const st = bases.map((b) => mixedBad(b.id, b.input));
        expect(st.flatMap((s) => s.bad).slice(0, 10)).toEqual([]);
        expect(st.reduce((a, s) => a + s.trimmed, 0)).toBeGreaterThan(0);
        if (part === 1) expect(st.reduce((a, s) => a + s.testLost, 0)).toBeGreaterThan(0);
      },
      GRID_TIMEOUT
    );
  });
}
