/* KRUG 7 (briefs/R7-ROUND7.md) — namenski testovi pravila motora i podataka polumaratona koje kapija ne meri.
   Z7: upozorenja iz probnog plana; Y1–Y4: podaci distance. */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  paceCtxOf,
  plan,
  type Goal,
  type PlanDoc,
  type RunnerFacts
} from '../../engine';
import { addDays } from '../../engine/dates';
import { weekCost } from '../../engine/guard';
import { estimateForm } from '../../fitness';
import { hm } from './index';
import { OWNER_PLANS } from './testdata/owner';
import { PROFILES, factsOf } from './testdata/profiles';

function make(facts: RunnerFacts, goal: Goal): PlanDoc {
  const r = plan(buildState(facts, goal, hm, estimateForm), goal, hm);
  if (!r.ok) throw new Error('plan');
  return r.doc;
}
const ROWS = [
  ...PROFILES.map((p) => ({ id: p.id, facts: factsOf(p), goal: p.goal })),
  ...OWNER_PLANS.map((o) => ({ id: o.id, facts: o.facts, goal: o.goal }))
];
const ALL = ROWS.map((r) => ({ ...r, doc: make(r.facts, r.goal) }));
const num = (s: string): number => Number(s.replace(',', '.'));
const stats = (doc: PlanDoc, raceDate: string): { peakKm: number; longKm: number } => {
  const ctx = paceCtxOf(doc.header);
  const costs = doc.weeks.map((w) => weekCost(w, raceDate, ctx));
  return {
    peakKm: Math.max(0, ...costs.map((c) => c.km)),
    longKm: Math.max(0, ...costs.map((c) => c.longKm))
  };
};

describe('krug 7 — Z7: upozorenje ne krivi ono što plan sam ograničava', () => {
  it('„planiraj N nedelja" samo kad je N > plana i probni plan od N nedelja nema taj nalaz; brojevi su iz probe', () => {
    let proposals = 0;
    for (const b of ALL) {
      for (const w of b.doc.header.warnings) {
        const m =
          /planiraj (\d+) nedelj\w* pripreme — (?:obim|nedelja) tada (?:bezbedno )?stiže do ([\d,]+) km(?: nedeljno)?(?:, a dugi do ([\d,]+) km)?/.exec(
            w.proposal
          );
        if (m === null || (w.code !== 'mali-obim' && w.code !== 'kratak-dugi')) continue;
        proposals += 1;
        const n = Number(m[1]);
        expect(n, `${b.id} ${w.code}`).toBeGreaterThan(b.doc.weeks.length);
        const later = {
          ...b.goal,
          raceDate: addDays(b.goal.raceDate, 7 * (n - b.doc.weeks.length))
        };
        const probe = make(b.facts, later);
        expect(probe.weeks.length).toBe(n);
        expect(
          probe.header.warnings.map((x) => x.code),
          `${b.id} ${w.code} @${String(n)}`
        ).not.toContain(w.code);
        const s = stats(probe, later.raceDate);
        expect(num(m[2] ?? '0'), `${b.id} vrh probe`).toBeCloseTo(s.peakKm, 0);
        if (m[3] !== undefined) expect(num(m[3]), `${b.id} dugi probe`).toBeCloseTo(s.longKm, 0);
      }
    }
    expect(proposals).toBeGreaterThan(0);
  });

  it('kad duža priprema ne pomaže, imenuje se uzrok (p10: broj dana), bez „planiraj"', () => {
    const p10 = ALL.find((b) => b.id === 'p10');
    const w = p10?.doc.header.warnings.find((x) => x.code === 'mali-obim');
    expect(w?.proposal).toMatch(/Duža priprema ovde ne pomaže: obim ograničava broj dana/);
    expect(w?.proposal).not.toMatch(/planiraj/);
  });

  it('prag nalaza ima toleranciju zaokruživanja (5 %): ni jedan nalaz o obimu/dugom kad je plan ≥ 95 % praga', () => {
    const a = hm.adequate;
    for (const b of ALL) {
      const s = stats(b.doc, b.goal.raceDate);
      const codes = b.doc.header.warnings.map((w) => w.code);
      if (s.peakKm >= 0.95 * a.minPeakWeeklyKm) expect(codes, b.id).not.toContain('mali-obim');
      if (s.longKm >= 0.95 * a.minLongKm) expect(codes, b.id).not.toContain('kratak-dugi');
      if (s.longKm >= 0.95 * (a.longCheckKm ?? a.minLongKm))
        expect(codes, b.id).not.toContain('dugi-za-distancu');
    }
  });

  it('predlog dodatnog dana: ≥ 30 min, isti predlog dana se ne ponavlja u dva upozorenja', () => {
    for (const b of ALL) {
      const texts = b.doc.header.warnings.map((w) => w.proposal);
      const days = texts.flatMap((t) =>
        [...t.matchAll(/dodaj (\d+)\. dan laganog trčanja od oko (\d+) min/gi)].map((m) => m[0])
      );
      for (const d of days)
        expect(Number(/(\d+) min/.exec(d)?.[1]), `${b.id}: ${d}`).toBeGreaterThanOrEqual(30);
      expect(new Set(days).size, `${b.id}: ${days.join(' | ')}`).toBe(days.length);
    }
  });

  it('jedan broj nedelja pripreme u svim upozorenjima plana', () => {
    for (const b of ALL) {
      const all = b.doc.header.warnings.map((w) => w.proposal).join(' ');
      const ns = new Set([...all.matchAll(/planiraj (\d+) nedelj/g)].map((m) => m[1]));
      expect(ns.size, b.id).toBeLessThanOrEqual(1);
    }
  });
});
