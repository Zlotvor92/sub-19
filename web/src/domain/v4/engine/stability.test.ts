import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { deriveEvents, replan, serializePlan } from './index';
import { advance, build, facts, goalAt, grid, runsAsPlanned } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type { PlanEvent } from './types';

describe('stabilnost (SPEC § 6.3): bez događaja plan se ne menja', () => {
  it('replan(doc, state, []) vraća isti dokument i prazne promene (mreža)', () => {
    for (const c of grid()) {
      const b = build(c.facts, c.goal);
      const before = serializePlan(b.doc);
      const result = replan(b.doc, b.state, [], SYNTHETIC);
      expect(result.changes, c.name).toEqual([]);
      expect(result.doc, c.name).toBe(b.doc);
      expect(serializePlan(result.doc), c.name).toBe(before);
    }
  });

  it('deriveEvents odmah posle nastanka plana ne menja plan (mreža)', () => {
    for (const c of grid()) {
      const b = build(c.facts, c.goal);
      const result = replan(b.doc, b.state, deriveEvents(b.doc, b.state), SYNTHETIC);
      expect(result.changes, c.name).toEqual([]);
      expect(result.doc, c.name).toBe(b.doc);
    }
  });

  it('događaj `none`, `manual-edit` i već primenjen događaj ne menjaju ništa', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    const day = b.doc.weeks[2]?.days[1];
    const neutral: PlanEvent[] = [
      { id: 'none:2026-11-15', date: '2026-11-15', kind: 'none' },
      {
        id: `manual-edit:2026-11-15:${day?.id ?? ''}`,
        date: '2026-11-15',
        kind: 'manual-edit',
        dayId: day?.id ?? ''
      }
    ];
    const result = replan(b.doc, b.state, neutral, SYNTHETIC);
    expect(result.doc).toBe(b.doc);
    expect(result.changes).toEqual([]);

    const pain: PlanEvent = { id: 'pain:2026-11-15:5', date: '2026-11-15', kind: 'pain', level: 5 };
    const once = replan(b.doc, b.state, [pain], SYNTHETIC);
    expect(once.changes.length).toBeGreaterThan(0);
    expect(once.doc.header.appliedEvents).toEqual([pain.id]);
    const twice = replan(once.doc, b.state, [pain], SYNTHETIC);
    expect(twice.doc).toBe(once.doc);
    expect(twice.changes).toEqual([]);
  });

  it('trčanja koja odgovaraju planu ne menjaju plan, dan za danom', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    const before = serializePlan(b.doc);
    for (let offset = 1; offset <= 45; offset += 1) {
      const today = addDays(b.facts.today, offset);
      const state = advance(b, today, { runs: runsAsPlanned(b.doc, today) });
      const events = deriveEvents(b.doc, state);
      const result = replan(b.doc, state, events, SYNTHETIC);
      expect(result.changes, today).toEqual([]);
      expect(serializePlan(result.doc), today).toBe(before);
    }
  });

  it('običan propušten lagan dan ne menja plan i ne upisuje se', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    const skipped = '2026-11-21';
    const today = '2026-11-24';
    const state = advance(b, today, { runs: runsAsPlanned(b.doc, today, (d) => d === skipped) });
    const events = deriveEvents(b.doc, state);
    expect(events.map((e) => e.kind)).toEqual(['missed']);
    const result = replan(b.doc, state, events, SYNTHETIC);
    expect(result.doc).toBe(b.doc);
    expect(result.doc.header.appliedEvents).toEqual([]);
  });

  it('ponovljen poziv posle primenjenog događaja je stabilan', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    const today = '2026-12-20';
    const state = advance(b, today, {
      runs: runsAsPlanned(b.doc, '2026-12-13'),
      pauses: [{ from: '2026-12-14', to: '2026-12-20', reason: 'bolest' }]
    });
    const first = replan(b.doc, state, deriveEvents(b.doc, state), SYNTHETIC);
    expect(first.changes.length).toBeGreaterThan(0);
    const second = replan(first.doc, state, deriveEvents(first.doc, state), SYNTHETIC);
    expect(second.changes).toEqual([]);
    expect(second.doc).toBe(first.doc);
  });
});
