import { describe, expect, it } from 'vitest';
import {
  buildState,
  deriveEvents,
  fingerprint,
  type PlanDay,
  type PlanDoc,
  type PlanEvent,
  type Run
} from '../../domain/v4/engine';
import { estimateForm } from '../../domain/v4/fitness';
import {
  accept,
  approvalOf,
  autoStep,
  awaiting,
  EMPTY_LEDGER,
  preview,
  reject,
  reportedEvent
} from './events';
import { applyMove } from './edits';
import { DISTANCES, toFacts } from './facts';
import {
  addDays,
  adoptSample,
  clone,
  deepFreeze,
  newPlan,
  SAMPLES,
  TODAY
} from './samples.test-data';

const allDays = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);

describe('podela „sam" / „pregled" (F8 § 9.1)', () => {
  const ev = (e: Record<string, unknown>): PlanEvent =>
    ({ id: 'x', date: TODAY, ...e }) as unknown as PlanEvent;
  it.each([
    ['result', ev({ kind: 'result', runId: 'r' }), 'izvedeno', 'sam'],
    ['missed', ev({ kind: 'missed', dayId: 'd' }), 'izvedeno', 'sam'],
    ['form-update', ev({ kind: 'form-update', vdot: 50 }), 'izvedeno', 'sam'],
    [
      'rupa u trčanju',
      ev({ kind: 'pause', from: TODAY, to: TODAY, reason: 'nepoznato' }),
      'izvedeno',
      'sam'
    ],
    ['opterećenje', ev({ kind: 'fatigue', source: 'opterecenje' }), 'izvedeno', 'sam'],
    ['ručna izmena', ev({ kind: 'manual-edit', dayId: 'd' }), 'prijavljeno', 'sam'],
    ['bol', ev({ kind: 'pain', level: 4 }), 'prijavljeno', 'pregled'],
    ['umor', ev({ kind: 'fatigue', source: 'trkac' }), 'prijavljeno', 'pregled'],
    [
      'bolest',
      ev({ kind: 'pause', from: TODAY, to: TODAY, reason: 'bolest' }),
      'prijavljeno',
      'pregled'
    ],
    [
      'cilj',
      ev({ kind: 'goal-change', goal: { distanceId: 'hm', raceDate: TODAY } }),
      'prijavljeno',
      'pregled'
    ],
    [
      'dani',
      ev({ kind: 'availability-change', availability: { runDays: [1], longDay: 1 } }),
      'prijavljeno',
      'pregled'
    ]
  ] as const)('%s → %s', (_n, e, origin, want) => {
    expect(approvalOf(e, origin)).toBe(want);
  });
});

describe('prijave → događaji', () => {
  it('isti unos isti id; različiti unosi različit id; pauza ima id kao izvedena iz `state.pauses`', () => {
    const a = reportedEvent({ kind: 'pain', level: 4, part: 'koleno' }, TODAY);
    expect(reportedEvent({ kind: 'pain', level: 4, part: 'koleno' }, TODAY)).toEqual(a);
    expect(reportedEvent({ kind: 'pain', level: 5, part: 'koleno' }, TODAY).id).not.toBe(a.id);
    expect(reportedEvent({ kind: 'fatigue' }, TODAY).id).toBe(`fatigue:${TODAY}:trkac`);
    expect(
      reportedEvent(
        { kind: 'pause', from: '2026-11-10', to: '2026-11-14', reason: 'bolest' },
        TODAY
      ).id
    ).toBe('pause:2026-11-10:2026-11-14');
    const av1 = reportedEvent(
      { kind: 'availability-change', availability: { runDays: [5, 1, 3], longDay: 5 } },
      TODAY
    );
    const av2 = reportedEvent(
      { kind: 'availability-change', availability: { runDays: [1, 3, 5], longDay: 5 } },
      TODAY
    );
    expect(av1.id).toBe(av2.id);
  });
});

/** Stanje 10 dana posle početka: svi planirani dani do juče urađeni, osim jednog (propušten). */
function laterState(distanceId: string) {
  const { doc, facts, goal } = newPlan(distanceId);
  const data = DISTANCES[distanceId];
  if (data === undefined) throw new Error(distanceId);
  const today = addDays(TODAY, 10);
  const planned = allDays(doc).filter((d) => d.workout !== null && d.date < today);
  const missed = planned[planned.length - 1];
  const runs: Run[] = planned
    .filter((d) => d !== missed)
    .map((d) => ({
      id: `strava:${d.id}`,
      date: d.date,
      distanceM: 8000,
      durationSec: 2900,
      dayId: d.id
    }));
  const later = toFacts({
    today,
    availability: facts.availability,
    profile: facts.profile,
    activities: runs
  });
  const state = buildState(later, goal, data, estimateForm, doc);
  return { doc, data, state, facts: later, runs, missed, today };
}

describe.each(Object.keys(DISTANCES))('automatski korak: %s', (distanceId) => {
  const s = laterState(distanceId);
  const frozen = deepFreeze(clone(s.doc));

  it('izvedeni događaji se primenjuju sami; urađeni i prošli dani se ne menjaju', () => {
    const r = autoStep(frozen, s.state, s.data, [], EMPTY_LEDGER);
    expect(deriveEvents(frozen, s.state).some((e) => e.kind === 'missed')).toBe(true);
    const before = new Map(allDays(s.doc).map((d) => [d.id, d]));
    for (const d of allDays(r.doc)) {
      if (d.date >= s.today && (before.get(d.id)?.date ?? '') >= s.today) continue;
      expect(d, d.id).toEqual(before.get(d.id));
    }
    expect(JSON.stringify(frozen)).toBe(JSON.stringify(s.doc));
  });

  it('determinizam i ponovna primena bez efekta', () => {
    const a = autoStep(frozen, s.state, s.data, [], EMPTY_LEDGER);
    const b = autoStep(frozen, s.state, s.data, [], EMPTY_LEDGER);
    expect(fingerprint(a.doc, s.facts)).toBe(fingerprint(b.doc, s.facts));
    expect(JSON.stringify(a.changes)).toBe(JSON.stringify(b.changes));
    const again = autoStep(a.doc, s.state, s.data, [], EMPTY_LEDGER);
    expect(again.changes).toEqual([]);
    expect(JSON.stringify(again.doc)).toBe(JSON.stringify(a.doc));
  });

  it('odbijen izvedeni događaj se ne primenjuje', () => {
    const derived = deriveEvents(frozen, s.state);
    let ledger = EMPTY_LEDGER;
    for (const e of derived) ledger = reject(ledger, e);
    const r = autoStep(frozen, s.state, s.data, [], ledger);
    expect(r.changes).toEqual([]);
    expect(r.doc).toBe(frozen);
  });

  it('prijava čeka odluku; pregled ništa ne čuva; „Primeni" = pregled; posle primene više ne čeka; „Ne menjaj" se pamti', () => {
    const pain = reportedEvent({ kind: 'pain', level: 5, part: 'koleno' }, s.today);
    expect(awaiting(frozen, EMPTY_LEDGER, [pain])).toEqual([pain]);
    const p = preview(frozen, s.state, s.data, pain);
    expect(JSON.stringify(frozen)).toBe(JSON.stringify(s.doc));
    const applied = accept(frozen, s.state, s.data, EMPTY_LEDGER, pain);
    expect(JSON.stringify(applied.doc)).toBe(JSON.stringify(p.doc));
    expect(awaiting(applied.doc, EMPTY_LEDGER, [pain])).toEqual([]);
    const twice = accept(applied.doc, s.state, s.data, EMPTY_LEDGER, pain);
    expect(twice.changes).toEqual([]);
    const ledger = reject(EMPTY_LEDGER, pain);
    expect(reject(ledger, pain)).toBe(ledger);
    expect(awaiting(frozen, ledger, [pain])).toEqual([]);
    expect(accept(frozen, s.state, s.data, ledger, pain).doc).toBe(frozen);
  });

  it('ručna izmena ide u automatski korak; premešten dan ostaje gde ga je korisnik stavio', () => {
    const week = s.doc.weeks.find((w) => w.start > s.today);
    const hard = week?.days.find(
      (d) => d.workout?.kind === 'long' || d.workout?.kind === 'quality'
    );
    const rest = week?.days.find((d) => d.workout === null);
    if (hard === undefined || rest === undefined) return;
    const m = applyMove(frozen, hard.id, rest.date, {
      today: s.today,
      done: new Set(s.runs.map((r) => r.dayId ?? ''))
    });
    if (!m.ok) throw new Error(m.reason);
    const r = autoStep(m.doc, s.state, s.data, [m.event], EMPTY_LEDGER);
    const moved = allDays(r.doc).find((d) => d.id === hard.id);
    expect(moved?.date).toBe(rest.date);
    const again = autoStep(r.doc, s.state, s.data, [m.event], EMPTY_LEDGER);
    expect(again.changes).toEqual([]);
  });
});

describe('zaštićen plan (lični plan vlasnika) se ne menja ni na događaj', () => {
  it('svi preuzeti zaštićeni uzorci', () => {
    const prot = SAMPLES.map((x) => ({ x, a: adoptSample(x) })).filter(
      (y) => y.a.doc.header.protected
    );
    expect(prot.length).toBeGreaterThanOrEqual(1);
    for (const { x, a } of prot) {
      const data = DISTANCES[a.doc.header.goal.distanceId];
      if (data === undefined) continue;
      const state = buildState(
        toFacts({ today: x.today, adopted: a.facts }),
        a.doc.header.goal,
        data,
        undefined,
        a.doc
      );
      const pain = reportedEvent({ kind: 'pain', level: 6 }, x.today);
      expect(accept(a.doc, state, data, EMPTY_LEDGER, pain).doc, x.name).toBe(a.doc);
      expect(autoStep(a.doc, state, data, [], EMPTY_LEDGER).doc, x.name).toBe(a.doc);
    }
  });
});
