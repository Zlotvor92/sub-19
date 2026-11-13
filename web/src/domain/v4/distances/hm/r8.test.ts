/* KRUG 8 (briefs/R8-ENGINE.md) — zahtevi druge distance za motor, provera nad podacima polumaratona. */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  guard,
  plan,
  renderPlan,
  type DistanceData,
  type Goal,
  type PlanDoc,
  type RunnerFacts
} from '../../engine';
import { addDays } from '../../engine/dates';
import { derivedPauses, scheduleMaxGap } from '../../engine/pauses';
import type { PlanDay } from '../../engine/types';
import { estimateForm } from '../../fitness';
import { hm } from './index';
import { PROFILES, factsOf } from './testdata/profiles';

function make(
  facts: RunnerFacts,
  goal: Goal,
  data: DistanceData = hm
): { doc: PlanDoc; state: ReturnType<typeof buildState> } {
  const state = buildState(facts, goal, data, estimateForm);
  const r = plan(state, goal, data);
  if (!r.ok) throw new Error('plan');
  return { doc: r.doc, state };
}
const P = (id: string): { facts: RunnerFacts; goal: Goal } => {
  const p = PROFILES.find((x) => x.id === id);
  if (p === undefined) throw new Error(id);
  return { facts: factsOf(p), goal: p.goal };
};

describe('krug 8 — motor čita podatke distance', () => {
  it('t. 1: čuvar `taper` meri udelom iz `safety.taper.weekBeforeMaxOfPeak`, ne konstantom', () => {
    const { facts, goal } = P('p01');
    const { doc, state } = make(facts, goal);
    expect(guard(doc, state, hm).filter((f) => f.check === 'taper')).toEqual([]);
    const taper = hm.safety.taper;
    if (taper === undefined) throw new Error('taper');
    const strict: DistanceData = {
      ...hm,
      safety: { ...hm.safety, taper: { ...taper, weekBeforeMaxOfPeak: 0.05 } }
    };
    const found = guard(doc, state, strict).filter((f) => f.check === 'taper');
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]?.message).toContain('5 %');
  });

  it('t. 8: raspon tempa starta (`{paceFrom}`–`{paceTo}`) je podatak distance', () => {
    const { facts, goal } = P('p01');
    const { doc, state } = make(facts, goal);
    const line = (text: string): string =>
      text.split('\n').find((l) => l.includes('Prvih 5 km')) ?? '';
    const base = line(renderPlan(doc, state, hm));
    const near: DistanceData = {
      ...hm,
      safety: { ...hm.safety, raceStartPaceOffsetSec: { from: 0, to: 1 } }
    };
    const other = line(renderPlan(doc, state, near));
    expect(base).not.toBe('');
    expect(other).not.toBe(base);
    const m = /trči (\d+):(\d+)–(\d+):(\d+)/.exec(other);
    const n = /trči (\d+):(\d+)–(\d+):(\d+)/.exec(base);
    const sec = (a?: string, b?: string): number => Number(a) * 60 + Number(b);
    expect(sec(n?.[1], n?.[2]) - sec(m?.[1], m?.[2])).toBe(5);
    expect(sec(n?.[3], n?.[4]) - sec(m?.[3], m?.[4])).toBe(9);
  });
});

describe('krug 8 — t. 5: pauza iz praznine prema rasporedu trkača', () => {
  it('najveći razmak rasporeda: 3 dana (uto, čet, ned) = 3; svaki dan = 1', () => {
    expect(scheduleMaxGap([1, 3, 6])).toBe(3);
    expect(scheduleMaxGap([0, 1, 2, 3, 4, 5, 6])).toBe(1);
  });
  it('kod 3 dana nedeljno 5 dana bez trčanja nije pauza, 6 jeste', () => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = addDays('2026-11-02', i);
      return {
        id: `d${String(i)}`,
        date,
        workout: [1, 3, 6].includes(i % 7)
          ? { kind: 'easy', steps: [{ extent: { durationSec: 1800 } }] }
          : null
      };
    }) as unknown as PlanDay[];
    const later = ['2026-11-12', '2026-11-15'];
    /* uto 3. 11., pa pon 9. 11.: sre–ned = 5 dana bez trčanja (propušteni čet i ned) — nije pauza */
    const five = new Set(['2026-11-03', '2026-11-09', ...later]);
    expect(derivedPauses(days, five, '2026-11-02', '2026-11-16', [], [1, 3, 6])).toEqual([]);
    /* uto 3. 11., pa uto 10. 11.: sre–pon = 6 dana — pauza */
    const six = new Set(['2026-11-03', '2026-11-10', ...later]);
    expect(derivedPauses(days, six, '2026-11-02', '2026-11-16', [], [1, 3, 6])).toHaveLength(1);
    /* bez rasporeda: staro pravilo (3 dana) */
    expect(derivedPauses(days, five, '2026-11-02', '2026-11-16', [])).toHaveLength(1);
  });
});
