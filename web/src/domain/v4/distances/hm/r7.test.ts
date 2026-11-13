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

  it('kad duža priprema ne pomaže, imenuje se uzrok, bez „planiraj"; probni plan +16 nedelja i dalje ima nalaz', () => {
    for (const b of ALL)
      for (const w of b.doc.header.warnings) {
        if (!w.proposal.includes('Duža priprema ovde ne pomaže')) continue;
        expect(w.proposal, b.id).toMatch(/ograničava broj dana|sadašnjeg obima|nedeljni obim/);
        expect(w.proposal, b.id).not.toMatch(/planiraj \d+ nedelj/);
        const later = { ...b.goal, raceDate: addDays(b.goal.raceDate, 7 * 16) };
        expect(
          make(b.facts, later).header.warnings.map((x) => x.code),
          b.id
        ).toContain(w.code);
      }
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

describe('krug 7 — Y1/Y2: podaci polumaratona', () => {
  it('Y1: plan od 16+ nedelja ima proveru na svakih ≤ 8 nedelja, poslednju najkasnije 3 nedelje pred trku', () => {
    for (const b of ALL) {
      const n = b.doc.weeks.length;
      if (n < 16) continue;
      const checks = b.doc.weeks
        .filter((w) => w.days.some((d) => d.workout?.kind === 'test'))
        .map((w) => w.index);
      expect(checks.length, b.id).toBeGreaterThan(0);
      for (let i = 1; i < checks.length; i += 1)
        expect(
          (checks[i] ?? 0) - (checks[i - 1] ?? 0),
          `${b.id} ${checks.join(',')}`
        ).toBeLessThanOrEqual(8);
      const last = checks[checks.length - 1] ?? 0;
      expect(last, b.id).toBeLessThanOrEqual(n - 3);
      expect(n - last, `${b.id} ${checks.join(',')}`).toBeLessThanOrEqual(8);
    }
  });

  it('Y2: rasterećenje ≤ 85 % prethodne nedelje; obično rasterećenje: dugi 70–75 % prethodnog (±0,5 km)', () => {
    for (const b of ALL) {
      const ctx = paceCtxOf(b.doc.header);
      const costs = b.doc.weeks.map((w) => weekCost(w, b.goal.raceDate, ctx));
      for (let i = 1; i < costs.length; i += 1) {
        const w = b.doc.weeks[i];
        const prev = costs[i - 1];
        const cur = costs[i];
        if (w?.intent.kind !== 'recovery' || prev === undefined || cur === undefined) continue;
        if (w.start < b.doc.header.startDate || i < 3) continue;
        expect(cur.km, `${b.id} n${String(w.index)}`).toBeLessThanOrEqual(0.85 * prev.km + 0.5);
        if (w.days.some((d) => d.workout?.kind === 'test')) continue;
        expect(cur.longKm, `${b.id} n${String(w.index)}`).toBeLessThanOrEqual(
          0.75 * prev.longKm + 0.5
        );
        expect(cur.longKm, `${b.id} n${String(w.index)}`).toBeGreaterThanOrEqual(
          0.7 * prev.longKm - 0.5
        );
      }
    }
  });

  it('Y2: p04 ned 13–17 nisu kopije (dugi nije isti u svim nedeljama gradnje); p08 talas vidljiv', () => {
    for (const id of ['p04', 'p08']) {
      const b = ALL.find((x) => x.id === id);
      if (b === undefined) throw new Error(id);
      const ctx = paceCtxOf(b.doc.header);
      const longs = b.doc.weeks
        .filter((w) => w.index >= 13 && w.index <= 17 && w.intent.kind !== 'recovery')
        .map((w) => Math.round(weekCost(w, b.goal.raceDate, ctx).longSec / 300));
      expect(new Set(longs).size, `${id} ${longs.join(',')}`).toBeGreaterThan(1);
    }
  });
});
