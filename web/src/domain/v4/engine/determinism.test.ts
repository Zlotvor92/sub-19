import { describe, expect, it } from 'vitest';
import { deriveEvents, plan, replan, serializePlan, buildState } from './index';
import { build, grid } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type { RunnerFacts } from './types';

const clone = <T>(value: T): T => structuredClone(value);

describe('determinizam (SPEC § 6.1)', () => {
  const cases = grid();

  it('mreža ima bar 200 ulaza', () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
  });

  it('isti ulaz → bajt-isti plan; ulaz se ne menja', () => {
    for (const c of cases) {
      const before = JSON.stringify([c.facts, c.goal]);
      const a = build(c.facts, c.goal);
      const copy: RunnerFacts = clone(c.facts);
      const state = buildState(copy, clone(c.goal), clone(SYNTHETIC));
      const again = plan(state, clone(c.goal), clone(SYNTHETIC));
      expect(again.ok, c.name).toBe(true);
      if (!again.ok) continue;
      expect(serializePlan(again.doc), c.name).toBe(serializePlan(a.doc));
      expect(JSON.stringify([c.facts, c.goal]), c.name).toBe(before);
    }
  });

  it('plan ima N nedelja, poslednja je nedelja trke, dan trke je jedan', () => {
    for (const c of cases) {
      const { doc } = build(c.facts, c.goal);
      const races = doc.weeks.flatMap((w) => w.days).filter((d) => d.workout?.kind === 'race');
      expect(
        races.map((d) => d.date),
        c.name
      ).toEqual([c.goal.raceDate]);
      expect(
        doc.weeks.at(-1)?.days.some((d) => d.date === c.goal.raceDate),
        c.name
      ).toBe(true);
      expect(doc.weeks.map((w) => w.index)).toEqual(doc.weeks.map((_, i) => i + 1));
    }
  });

  it('replan je determinističan', () => {
    for (const c of cases.filter((_, i) => i % 9 === 0)) {
      const b = build(c.facts, c.goal);
      const events = [
        { id: 'pain:2026-11-15:5', date: '2026-11-15', kind: 'pain' as const, level: 5 },
        ...deriveEvents(b.doc, b.state)
      ];
      const one = replan(b.doc, b.state, events, SYNTHETIC);
      const two = replan(clone(b.doc), clone(b.state), clone(events), clone(SYNTHETIC));
      expect(serializePlan(two.doc), c.name).toBe(serializePlan(one.doc));
      expect(JSON.stringify(two.changes)).toBe(JSON.stringify(one.changes));
    }
  });
});
