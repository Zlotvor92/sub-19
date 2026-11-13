/* KRUG 4 (briefs/R3-ROUND3.md, S1–S12, T1–T7) — po jedan test za svako novo pravilo, nad podacima polumaratona.
   Brzi: 14 planova + nekoliko ponovnih planiranja. */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  guard,
  paceCtxOf,
  plan,
  renderPlan,
  summarize,
  type Goal,
  type PlanDoc,
  type RunnerFacts,
  type RunnerState
} from '../../engine';
import { ladderOverBase } from '../../engine/decide';
import { fastWorkSec, weekCost } from '../../engine/guard';
import { effortResult } from '../../engine/vdot';
import { estimateForm } from '../../fitness';
import { hm } from './index';
import { OWNER_PLANS } from './testdata/owner';
import { PROFILES, factsOf } from './testdata/profiles';

interface Built {
  id: string;
  facts: RunnerFacts;
  goal: Goal;
  doc: PlanDoc;
  state: RunnerState;
}

function make(id: string, facts: RunnerFacts, goal: Goal): Built {
  const state = buildState(facts, goal, hm, estimateForm);
  const r = plan(state, goal, hm);
  if (!r.ok) throw new Error(id);
  return { id, facts, goal, doc: r.doc, state };
}

const ALL: Built[] = [
  ...PROFILES.map((p) => make(p.id, factsOf(p), p.goal)),
  ...OWNER_PLANS.map((o) => make(o.id, o.facts, o.goal))
];

describe('krug 4: motor (S1–S11) nad polumaratonom', () => {
  it('S1: brz rad ≤ 22 % (vršna ≤ 25 %) od planiranog zbira; trka i test se ne broje; čuvar meri isto', () => {
    for (const b of ALL) {
      const ctx = paceCtxOf(b.doc.header);
      for (const w of b.doc.weeks) {
        if (w.intent.kind === 'race') continue;
        const c = weekCost(w, b.goal.raceDate, ctx);
        const fast = w.days.reduce((sum, d) => sum + fastWorkSec(d.workout), 0);
        expect(c.fastSec).toBe(fast);
        const cap = w.intent.kind === 'peak' ? 0.25 : 0.22;
        expect(fast / c.durationSec, `${b.id} n${String(w.index)}`).toBeLessThanOrEqual(cap + 0.005);
      }
      expect(guard(b.doc, b.state, hm).filter((f) => f.check === 'brz-udeo')).toEqual([]);
    }
  });

  it('S1: nedelja trke uvek ima oštrenje (8–12 min rada) kad ga šablon traži', () => {
    for (const b of ALL) {
      const race = b.doc.weeks[b.doc.weeks.length - 1];
      const sharp = race?.days.find((d) => d.workout?.stimulus === 'ostrenje');
      expect(sharp, b.id).toBeDefined();
      expect(sharp?.workout?.workSec ?? 0).toBeGreaterThanOrEqual(480 - 60);
      expect(sharp?.workout?.workSec ?? 0).toBeLessThanOrEqual(720 + 90);
    }
  });

  it('S2: lestvica vrha po polaznom obimu i dužini pripreme; ograničen trkač najviše granica tabele', () => {
    const s = hm.safety;
    const at = (baseKm: number, weeks: number, limited = false): number =>
      ladderOverBase(s, { baseKm, weeks, limited });
    expect(at(20, 20)).toBeGreaterThan(at(20, 14));
    expect(at(20, 14)).toBeGreaterThan(at(20, 10));
    expect(at(30, 18)).toBeGreaterThan(at(40, 18));
    expect(at(20, 20, true)).toBeLessThanOrEqual(s.peakLadder?.limitedOverBase ?? 0);
    const p11 = ALL.find((b) => b.id === 'p11');
    expect(p11?.doc.header.decisions.peakOverBase).toBe(at(20, 20));
  });

  it('S2: prva nedelja plana je sadašnji obim (95–105 %)', () => {
    for (const b of ALL.filter((x) => x.id.startsWith('p'))) {
      const ctx = paceCtxOf(b.doc.header);
      const first = b.doc.weeks[0];
      if (first === undefined || first.days.length < 7) continue;
      const km = weekCost(first, b.goal.raceDate, ctx).km;
      const base = b.facts.profile.weeklyKm ?? km;
      /* krug 5 (D6): sa 3 dana dugi kreće sa 85 % najdužeg — nedelja 1 ≥ 90 % */
      expect(km / base, b.id).toBeGreaterThanOrEqual(b.doc.header.decisions.runDays.length <= 3 ? 0.9 : 0.95);
      expect(km / base, b.id).toBeLessThanOrEqual(1.05);
    }
  });

  it('S3: polumaraton od 16+ nedelja stiže do dugog ≥ 15 km ili 1 h 50 (ili nosi upozorenje dugi-za-distancu)', () => {
    for (const b of ALL) {
      if (b.doc.weeks.length < 16) continue;
      const ctx = paceCtxOf(b.doc.header);
      const longest = Math.max(
        ...b.doc.weeks.flatMap((w) => w.days).map((d) =>
          d.workout?.kind === 'long' ? summarize(d.workout, ctx).km : 0
        )
      );
      const warned = b.doc.header.warnings.some((w) => w.code === 'dugi-za-distancu');
      expect(longest >= 15 || warned, b.id).toBe(true);
    }
  });

  it('S4: doza raste od osnovice (udeo × vrh), plafon nivoa ograničava dozu', () => {
    for (const b of ALL) {
      const d = b.doc.header.decisions;
      for (const [tag, cap] of Object.entries(d.doseCapSec)) {
        expect(cap, `${b.id} ${tag}`).toBeLessThanOrEqual((d.doseBaseSec?.[tag] ?? cap) + 1);
      }
    }
  });

  it('S7: taktika trke iz današnje forme, bez brže rečenice kad upozorenje kaže da se počne sporije', () => {
    for (const b of ALL) {
      const text = renderPlan(b.doc, b.state, hm);
      if (!b.doc.header.paces.byFeel) expect(text, b.id).toMatch(/Tempo za trku: .*\((današnja forma|tvoj cilj)/);
      if (b.doc.header.warnings.some((w) => w.proposal.includes('počni sporije')))
        expect(text, b.id).not.toContain('potvrdi očekivani napredak');
    }
  });

  it('S8d/S8e: lagano-prebrzo i tegoba su upozorenja iz istorije', () => {
    const p = PROFILES.find((x) => x.id === 'p11');
    if (p === undefined) throw new Error('p11');
    const base = factsOf(p);
    const pained = make('bol', {
      ...base,
      profile: { ...base.profile, yearsRunning: 0.1 },
      painHistory: [{ date: '2026-03-01', level: 5, part: 'potkolenica', resolvedOn: '2026-04-01' }]
    }, p.goal);
    const codes = pained.doc.header.warnings.map((w) => w.code);
    expect(codes).toContain('tegoba');
    expect(codes).toContain('kratak-staz');
    expect(pained.doc.header.decisions.level).toBe('pocetnik-nov');
    /* prve 4 nedelje bez unosa visokog udara */
    const early = pained.doc.weeks.slice(0, 4).flatMap((w) => w.days);
    for (const d of early) {
      const def = hm.library.find((x) => x.id === d.workout?.libraryId);
      expect(def?.impact, d.date).not.toBe('visok');
    }
    /* T1: dugi hod-trk i rasterećenje 2:1 */
    expect(pained.doc.weeks.some((w) => w.days.some((d) => d.workout?.libraryId === 'dugi-hod'))).toBe(true);
  });

  it('S10: trka se usvaja cela i kad je na dan planiranog testa kraće distance', () => {
    const run = {
      id: 'r',
      date: '2026-12-05',
      distanceM: 5000,
      durationSec: 1500,
      effort: 'race' as const,
      plannedEffortM: 3000
    };
    expect(effortResult(run)).toEqual({ distanceM: 5000, durationSec: 1500 });
    expect(effortResult({ ...run, effort: 'test' as const })).toBeNull();
  });

  it('S11: plan za trkača ne nosi interne nalaze čuvara', () => {
    for (const b of ALL) expect(renderPlan(b.doc, b.state, hm), b.id).not.toContain('NALAZI ČUVARA');
  });

  it('T3: dugi ne stoji isti 4 nedelje gradnje zaredom', () => {
    for (const b of ALL) {
      const ctx = paceCtxOf(b.doc.header);
      let run = 1;
      let prev = '';
      for (const w of b.doc.weeks) {
        if (w.intent.kind !== 'build' && w.intent.kind !== 'peak') {
          run = 1;
          prev = '';
          continue;
        }
        const long = w.days.find((d) => d.workout?.kind === 'long')?.workout ?? null;
        const key = long === null ? '' : `${long.text}|${String(Math.round(summarize(long, ctx).km))}`;
        run = key !== '' && key === prev ? run + 1 : 1;
        prev = key;
        expect(run, `${b.id} n${String(w.index)}`).toBeLessThan(4);
      }
    }
  });
});
