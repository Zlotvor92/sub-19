/* KRUG 5 (briefs/R5-ROUND5.md) — namenski testovi pravila koja kapija ne meri (M3, M5, P2, P3) i čuvar za M7.
   Kapija (testdata/gate.ts, provere 11–14) meri M2, M6, M7 i P1 za svih 14 planova. */
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
  type RunnerFacts
} from '../../engine';
import { racePace, vdotAt } from '../../engine/vdot';
import { weekCost } from '../../engine/guard';
import { estimateForm } from '../../fitness';
import { hm } from './index';
import { OWNER_PLANS } from './testdata/owner';
import { PROFILES, factsOf } from './testdata/profiles';

function make(
  facts: RunnerFacts,
  goal: Goal
): { doc: PlanDoc; state: ReturnType<typeof buildState> } {
  const state = buildState(facts, goal, hm, estimateForm);
  const r = plan(state, goal, hm);
  if (!r.ok) throw new Error('plan');
  return { doc: r.doc, state };
}
const byId = (id: string): { facts: RunnerFacts; goal: Goal } => {
  const p = PROFILES.find((x) => x.id === id);
  if (p === undefined) throw new Error(id);
  return { facts: factsOf(p), goal: p.goal };
};
const ALL = [
  ...PROFILES.map((p) => ({ id: p.id, ...make(factsOf(p), p.goal) })),
  ...OWNER_PLANS.map((o) => ({ id: o.id, ...make(o.facts, o.goal) }))
];

describe('krug 5', () => {
  it('M3: „raspon širi" (kratak staž) stvarno širi raspon; „ne računa napredak" ⇒ očekivano nije brže od današnje', () => {
    const { facts, goal } = byId('p11');
    const base = make(facts, goal).doc.header.form.raceDay;
    const short = make({ ...facts, profile: { ...facts.profile, yearsRunning: 0.05 } }, goal).doc;
    const r = short.header.form.raceDay;
    expect(short.header.warnings.map((w) => w.code)).toContain('kratak-staz');
    expect(r.highSec - r.lowSec).toBeGreaterThan(base.highSec - base.lowSec);
    for (const b of ALL)
      if (b.doc.header.warnings.some((w) => w.code === 'dugi-za-distancu'))
        expect(b.doc.header.form.raceDay.expectedSec, b.id).toBeGreaterThanOrEqual(
          b.doc.header.form.current.raceTimeSec
        );
  });

  it('Z8 + A1 (krug 9): p06 (brz, 5 dana, 35 km) — lagano ≥ 30 min; svaka nedelja gradnje/vrha ima kvalitet ≥ 12 min; izostavljen dan samo uz rečenicu', () => {
    const b = ALL.find((x) => x.id === 'p06');
    if (b === undefined) throw new Error('p06');
    const ctx = paceCtxOf(b.doc.header);
    const codes = b.doc.header.warnings.map((w) => w.code);
    expect(codes).toContain('lagan-kratak');
    for (const w of b.doc.weeks) {
      if (w.intent.kind !== 'build' && w.intent.kind !== 'peak') continue;
      const runs = w.days.filter((d) => d.workout !== null).length;
      expect(runs, `n${String(w.index)}`).toBeGreaterThanOrEqual(4);
      if (runs < 5) expect(codes, `n${String(w.index)}`).toContain('dan-izostavljen');
      const work = Math.max(
        0,
        ...w.days.map((d) => (d.workout?.kind === 'quality' ? d.workout.workSec : 0))
      );
      /* ≥ 12 min je granica skraćivanja (A1); u uvodne dve nedelje zadate doze šablona su manje (K7: prvi ≤ 70 % vrha; K8: ≥ 8 min) */
      expect(work, `n${String(w.index)}`).toBeGreaterThanOrEqual(w.index <= 2 ? 8 * 60 : 12 * 60);
      for (const d of w.days)
        if (d.workout?.kind === 'easy')
          expect(summarize(d.workout, ctx).durationSec, d.date).toBeGreaterThanOrEqual(
            30 * 60 - 0.5 * b.doc.header.paces.easy
          );
    }
  });

  it('P2: stabilan trkač kreće dugi od polaznog (p01, p12); 85 % samo na plafonu (p08)', () => {
    for (const id of ['p01', 'p12', 'p08']) {
      const b = ALL.find((x) => x.id === id);
      if (b === undefined) throw new Error(id);
      const ctx = paceCtxOf(b.doc.header);
      const first = b.doc.weeks[0]?.days.find((d) => d.workout?.kind === 'long')?.workout ?? null;
      const sec = first === null ? 0 : summarize(first, ctx).durationSec;
      const start = b.doc.header.decisions.longStartSec;
      if (id === 'p08') expect(sec).toBeLessThan(0.9 * start);
      else expect(sec).toBeGreaterThanOrEqual(start - 300);
    }
  });

  it('P3: usponi najviše 2 od 3 nedelje; spori (od 1:55) — intervali ne brži od tempa na 5 km', () => {
    for (const b of ALL) {
      const hills = b.doc.weeks.map((w) =>
        w.days.some(
          (d) =>
            hm.library.find((x) => x.id === d.workout?.libraryId)?.tags.includes('brdo') === true
        )
      );
      for (let i = 2; i < hills.length; i += 1)
        expect(
          [hills[i - 2], hills[i - 1], hills[i]].filter(Boolean).length,
          `${b.id} n${String(i + 1)}`
        ).toBeLessThanOrEqual(2);
    }
    const p03 = ALL.find((x) => x.id === 'p03');
    const p01 = ALL.find((x) => x.id === 'p01');
    const vdot = p03?.doc.header.form.paceVdot ?? 0;
    /* F4-K2: „tempo na 5 km" po ličnoj krivi plana (isti `vdotAt` kao pun napor) */
    const at5 = vdotAt(vdot, 5000, p03?.doc.header.form.transfer);
    expect(p03?.doc.header.paces.I ?? 0).toBeGreaterThanOrEqual(racePace(at5, 5000) - 3);
    /* brži od 1:55: bez promene (I iz VDOT) */
    expect((p01?.doc.header.paces.T ?? 0) - (p01?.doc.header.paces.I ?? 0)).toBeGreaterThanOrEqual(
      20
    );
  });

  it('M7: čuvar vidi silazak po kalendarskoj nedelji — 14 planova bez nalaza „silazak"', () => {
    for (const b of ALL)
      expect(
        guard(b.doc, b.state, hm).filter((f) => f.check === 'silazak'),
        b.id
      ).toEqual([]);
  });

  it('Z9 (krug 7): „vršna nedelja" u ispisu je nedelja sa najvećim obimom plana', () => {
    for (const b of ALL) {
      const text = renderPlan(b.doc, b.state, hm);
      const ctx = paceCtxOf(b.doc.header);
      const kms = b.doc.weeks.map((w) =>
        w.intent.kind === 'race' ? 0 : weekCost(w, b.doc.header.goal.raceDate, ctx).km
      );
      const peak = kms.indexOf(Math.max(...kms)) + 1;
      const labeled = [...text.matchAll(/^(\d+)\. NEDELJA[^\n]*vršna nedelja/gm)].map((m) =>
        Number(m[1])
      );
      expect(labeled, b.id).toEqual([peak]);
    }
  });
});
