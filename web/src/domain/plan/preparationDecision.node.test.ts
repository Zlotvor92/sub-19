import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type IsoDate } from '../date';
import type { GenPlanState } from '../state';
import type { ExecutionAnalysis } from '../training/execution';
import {
  buildExecutionAdjustment,
  executionBasis,
  type ExecutionAdjustmentOptions
} from './executionAdjustment';
import { graftFuturePlan, type ReplanContext } from './future';
import { isDemanding } from './finalize';
import { preparationSummary } from './preparation';
import {
  basisFromPlan,
  buildPreparationChoice,
  preparationDecision,
  type PreparationChoice
} from './preparationDecision';
import { resolvePlan } from './resolve';
import { getPlanRevisions, recordPlanRevision } from './versions';

type Event = {
  input: {
    current: GenPlanState;
    context: ReplanContext;
    options: ExecutionAdjustmentOptions;
    today?: IsoDate;
  };
  analysis: ExecutionAnalysis;
  today?: IsoDate;
  profile?: { eventToday: IsoDate };
};
const url = (id: string) =>
  new URL(`../../../../docs/qa/generator-ab/users/${id}-event.json`, import.meta.url);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
function load(id: 'U08' | 'U09' | 'U10' | 'U09-protection') {
  const file = id === 'U09-protection' ? 'U09' : id;
  const bytes = readFileSync(url(file));
  const doc = JSON.parse(bytes.toString('utf8')) as Event & {
    event: Event;
    protection: Event;
  };
  const e =
    id === 'U08'
      ? doc.event
      : id === 'U10'
        ? { ...doc.event, profile: doc.profile }
        : id === 'U09-protection'
          ? doc.protection
          : doc;
  const today = e.today ?? e.input.today ?? e.profile!.eventToday;
  return { e, today, file, digest: sha(bytes) };
}
const serial = (x: unknown) => JSON.stringify(x);

/** Effective-date, done, manual and measured days must be byte-identical; inputs stay pure. */
function expectPreserved(
  before: GenPlanState,
  after: GenPlanState,
  today: IsoDate,
  ctx: ReplanContext
) {
  const oldView = resolvePlan(before.weeks, { alts: ctx.alts ?? {}, moves: ctx.moves ?? {} });
  const newDays = new Map(after.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
  const measured = new Set(Object.keys(ctx.predLock ?? {}));
  let checked = 0;
  for (const w of before.weeks)
    for (const d of w.days) {
      const date = oldView.byId.get(d.id!)!.date;
      const protectedDay =
        date <= today ||
        ctx.log?.[d.id!]?.status === 'done' ||
        !!ctx.alts?.[d.id!] ||
        (typeof ctx.moves?.[d.id!] === 'string' && (ctx.moves[d.id!] as string) <= today);
      if (!protectedDay) continue;
      expect(serial(newDays.get(d.id))).toBe(serial(d));
      checked++;
    }
  for (const id of measured) {
    const row = before.pred.find((r) => r.id === id);
    expect(serial(after.pred.find((r) => r.id === id))).toBe(serial(row));
  }
  expect(checked).toBeGreaterThan(0);
}

describe('limited preparation is a return plan, not a full marathon preparation', () => {
  it('U09: return to the same date is labelled and offers explained alternatives', () => {
    const { e, today, file, digest } = load('U09');
    const frozen = serial(e);
    const r = buildExecutionAdjustment(
      e.input.current,
      today,
      e.analysis,
      e.input.options,
      e.input.context
    );
    if ('error' in r) throw new Error(r.error);
    expect(r.summary).toContain('Povratak posle 14 dana pauze');
    expect(r.summary).toContain(
      'povratni plan do postojećeg datuma, nije puna priprema za maraton'
    );
    expect(r.result.meta!['cycleDecision']).toMatchObject({
      kind: 'limited',
      fullPreparation: false
    });
    const label = preparationSummary(r.result.meta)!;
    expect(label.fullPreparation).toBe(false);
    expect(label.mode).toBe('Povratni plan do postojećeg datuma — nije puna priprema za maraton');
    const d = r.decision!;
    expect(d.status).toBe('limited');
    expect(d.statement).toContain('najduže 8,8 km');
    expect(d.statement).toContain('najduže ≥ 26 km');
    expect(r.notes[0]).toBe(d.statement);
    // No later date within 52 weeks fixes a 21 km confirmed base; the decision says so.
    expect(d.options.map((o) => o.id)).toEqual(['shorter-10000', 'base']);
    expect(d.unavailable[0]).toContain('do 52 nedelje kasnije ne daje punu pripremu');
    expect(d.options[0]).toMatchObject({
      coverage: 'distance',
      goalSec: null,
      raceDate: '2027-02-28'
    });
    expect(d.options[1]).toMatchObject({ coverage: 'insufficient', goalSec: null });
    expect(d.conditions.join(' ')).toContain('Kraći plan za izabrani datum je dozvoljen');
    expect(serial(e)).toBe(frozen);
    expect(sha(readFileSync(url(file)))).toBe(digest);
  });

  it('U10: experienced marathoner after 28 days gets a half-marathon full-preparation option', () => {
    const { e, today } = load('U10');
    const r = buildExecutionAdjustment(
      e.input.current,
      today,
      e.analysis,
      e.input.options,
      e.input.context
    );
    if ('error' in r) throw new Error(r.error);
    expect(r.result.meta!.preparation!.peakLongRunKm).toBe(17.3);
    expect(preparationSummary(r.result.meta)!.mode).toContain('nije puna priprema za maraton');
    const shorter = r.decision!.options.find((o) => o.id === 'shorter-21097.5')!;
    expect(shorter).toMatchObject({ coverage: 'full', raceDistM: 21097.5, goalSec: null });
    expect(r.decision!.unavailable[0]).toContain('najviše 24,9 km najduže');
  });

  it('U08 earlier permitted return (15,4 km < 16 km) is also labelled limited, with a nearer date', () => {
    const doc = JSON.parse(readFileSync(url('U08'), 'utf8')) as { earlierControlled: Event };
    const early = doc.earlierControlled;
    const r = buildExecutionAdjustment(
      early.input.current,
      early.today!,
      early.analysis,
      early.input.options,
      early.input.context
    );
    if ('error' in r) throw new Error(r.error);
    expect(r.result.meta!.preparation!.peakLongRunKm).toBe(15.4);
    expect(r.summary).toContain('nije puna priprema za polumaraton');
    expect(r.decision!.options.map((o) => [o.id, o.raceDate, o.coverage])).toEqual([
      ['extend', '2027-01-24', 'full'],
      ['shorter-10000', '2027-01-17', 'full'],
      ['base', '2027-01-17', 'distance']
    ]);
  });

  it('a short-distance return keeps its result unchanged and offers no decision', () => {
    const bytes = readFileSync(url('U04'));
    const e = JSON.parse(bytes.toString('utf8')) as Event;
    const today = e.today ?? e.input.today ?? e.profile!.eventToday;
    const r = buildExecutionAdjustment(
      e.input.current,
      today,
      e.analysis,
      e.input.options,
      e.input.context
    );
    if ('error' in r) throw new Error(r.error);
    expect(r.decision).toBeUndefined();
    expect(r.result.meta!['cycleDecision']).toBeUndefined();
    expect(r.summary).not.toContain('nije puna priprema');
    expect(preparationSummary(r.result.meta)!.mode).toBeNull();
  });
});

describe('U08: short cycle is allowed with advisory options', () => {
  const { e, today } = load('U08');
  const before = serial(e.input);
  const r = buildExecutionAdjustment(
    e.input.current,
    today,
    e.analysis,
    e.input.options,
    e.input.context
  );
  const basis = executionBasis(e.input.current, today, e.analysis, e.input.options);
  if ('error' in basis) throw new Error(basis.error);
  const choose = (choice: PreparationChoice) => {
    const built = buildPreparationChoice(e.input.current, today, basis, choice, e.input.context);
    if ('error' in built) throw new Error(built.error);
    return built;
  };

  it('allows the original date and goal, adds a warning and mutates nothing', () => {
    if ('error' in r) throw new Error(r.error);
    expect(r.result.meta!.raceDate).toBe('2027-01-17');
    expect(r.result.meta!.goalSec).toBe(5700);
    expect(r.notes.join(' ')).toContain('Skraćena priprema');
    expectPreserved(e.input.current, r.result, today, e.input.context);
    const d = r.decision!;
    expect(d.status).toBe('limited');
    expect(d.options.map((o) => [o.id, o.raceDate, o.coverage])).toEqual([
      ['extend', '2027-02-21', 'full'],
      ['shorter-10000', '2027-01-17', 'full'],
      ['base', '2027-01-17', 'distance']
    ]);
    expect(serial(e.input)).toBe(before);
  });

  it('old schedule had threshold work and a 22 km long run right after the break; every option removes them', () => {
    const old = resolvePlan(e.input.current.weeks, { alts: {}, moves: {} });
    const oldDay = (date: string) => old.dated.find((d) => d.date === date)!;
    expect(oldDay('2026-11-27').session).toBeTruthy();
    expect(oldDay('2026-11-29')).toMatchObject({ tag: 'lr', km: 22 });
    for (const option of r.decision!.options) {
      const built = choose(option.choice);
      const view = resolvePlan(built.result.weeks, { alts: {}, moves: {} });
      const end = (built.result.meta!['finalization'] as { returnWindow: { end: string } })
        .returnWindow.end;
      expect(end).toBe('2026-12-14');
      const window = view.dated.filter((d) => d.date > today && d.date < end);
      expect(window.some(isDemanding)).toBe(false);
      expect(Math.max(...window.map((d) => d.km ?? 0))).toBeLessThanOrEqual(16);
      expectPreserved(e.input.current, built.result, today, e.input.context);
      expect(built.notes[0]).toMatch(/^Odluka: 17\.01\.2027\. · Polumaraton · cilj 1:35:00 → /);
    }
  });

  it('extend changes only the date; goal and distance stay and the race moves', () => {
    const built = choose({ kind: 'extend', raceDate: '2027-02-21' as IsoDate });
    expect(built.change.to).toEqual({ raceDate: '2027-02-21', raceDistM: 21097.5, goalSec: 5700 });
    expect(built.result.meta!.raceDate).toBe('2027-02-21');
    expect((built.result.ulaz as { raceDate: string }).raceDate).toBe('2027-02-21');
    const race = resolvePlan(built.result.weeks, { alts: {}, moves: {} }).dated.filter(
      (d) => d.tag === 'trka'
    );
    expect(race.map((d) => d.date)).toEqual(['2027-02-21']);
    expect(preparationSummary(built.result.meta)!.fullPreparation).toBe(true);
  });

  it('base mode is easy-only, grows at most 8% to the pre-break base and keeps the race without a goal', () => {
    const built = choose({ kind: 'base' });
    expect(built.change.to).toEqual({ raceDate: '2027-01-17', raceDistM: 21097.5, goalSec: null });
    expect(built.result.meta!.goalSec).toBeNull();
    expect(built.result.meta!['cycleDecision']).toMatchObject({
      kind: 'base',
      fullPreparation: false
    });
    expect(preparationSummary(built.result.meta)!.mode).toContain('Povratni/bazni režim');
    const view = resolvePlan(built.result.weeks, { alts: {}, moves: {} });
    const future = view.dated.filter((d) => d.date > today);
    expect(future.filter((d) => d.tag !== 'trka').some(isDemanding)).toBe(false);
    expect(future.filter((d) => d.tag === 'trka').map((d) => d.date)).toEqual(['2027-01-17']);
    const weekly = view.weeks
      .filter((w) => w.days.every((d) => d.date > today) && !w.days.some((d) => d.tag === 'trka'))
      .map((w) => w.days.reduce((n, d) => n + (d.km ?? 0), 0));
    for (let i = 1; i < weekly.length; i++)
      expect(weekly[i]!).toBeLessThanOrEqual(weekly[i - 1]! * 1.08 + 0.5);
    expect(Math.max(...weekly)).toBeLessThanOrEqual(55);
    expect(
      Math.max(...future.filter((d) => d.tag === 'lr').map((d) => d.km ?? 0))
    ).toBeLessThanOrEqual(16);
    expect(built.notes[1]).toContain('nije priprema za vremenski cilj');
    // Partial first week: the long run is not shorter than an easy day.
    const partial = future.filter((d) => d.date <= '2026-11-29' && !d.rest && d.km);
    expect(partial.map((d) => [d.date, d.tag, d.km])).toEqual([
      ['2026-11-27', 'lako', 4.2],
      ['2026-11-29', 'lr', 11.2]
    ]);
    // Race week keeps no more than the original race-week days.
    const oldRaceWeek = resolvePlan(e.input.current.weeks, { alts: {}, moves: {} }).dated.filter(
      (d) => d.date >= '2027-01-11' && d.tag === 'lako'
    );
    for (const d of oldRaceWeek) expect(view.byId.get(d.id)!.km!).toBeLessThanOrEqual(d.km!);
  });

  it('shorter distance drops the incompatible time goal through the visible change', () => {
    const built = choose({ kind: 'shorter', raceDistM: 10000 });
    expect(built.change.to).toEqual({ raceDate: '2027-01-17', raceDistM: 10000, goalSec: null });
    expect(built.result.meta!.raceName).toBe('10K');
  });

  it('rejects choices outside the offered set', () => {
    expect(
      buildPreparationChoice(
        e.input.current,
        today,
        basis,
        { kind: 'extend', raceDate: '2027-01-10' as IsoDate },
        e.input.context
      )
    ).toEqual({ error: 'Novi datum trke mora biti posle postojećeg.' });
    expect(
      buildPreparationChoice(
        e.input.current,
        today,
        basis,
        { kind: 'shorter', raceDistM: 42195 },
        e.input.context
      )
    ).toEqual({ error: 'Izabrana distanca nije kraća opcija za ovaj plan.' });
  });
});

describe('preservation, persistence and restore across decisions', () => {
  it('U09 seeded manual, moved, measured and completed days survive every option and restore', () => {
    const { e, today } = load('U09-protection');
    const ctx = e.input.context;
    const frozen = serial(e.input);
    const basis = executionBasis(e.input.current, today, e.analysis, e.input.options);
    if ('error' in basis) throw new Error(basis.error);
    const decision = preparationDecision(e.input.current, today, basis, ctx, 'limited');
    expect(decision.options.length).toBeGreaterThan(0);
    for (const option of decision.options) {
      const built = buildPreparationChoice(e.input.current, today, basis, option.choice, ctx);
      if ('error' in built) throw new Error(built.error);
      expectPreserved(e.input.current, built.result, today, ctx);
      // Manual future day is kept and named, not silently rewritten.
      expect(built.notes.join(' ')).toContain('Ručno izmenjen trening');
      // Persist through JSON and restore the previous version over future days only.
      const stored = JSON.parse(
        JSON.stringify(
          recordPlanRevision(e.input.current, built.result, {
            reason: 'goal',
            date: today,
            summary: built.summary
          })
        )
      ) as GenPlanState;
      expectPreserved(e.input.current, stored, today, ctx);
      const [revision] = getPlanRevisions(stored);
      const restored = graftFuturePlan(stored, revision!.snapshot, today, ctx);
      expectPreserved(e.input.current, restored, today, ctx);
      const oldFuture = resolvePlan(e.input.current.weeks, {
        alts: ctx.alts ?? {},
        moves: ctx.moves ?? {}
      });
      const back = resolvePlan(restored.weeks, { alts: ctx.alts ?? {}, moves: ctx.moves ?? {} });
      for (const d of oldFuture.dated.filter((x) => x.date > today))
        expect([d.id, back.byId.get(d.id)?.km, back.byId.get(d.id)?.tag]).toEqual([
          d.id,
          d.km,
          d.tag
        ]);
    }
    expect(serial(e.input)).toBe(frozen);
  });

  it('a stored limited plan reuses its persisted return facts for later decisions', () => {
    const { e, today } = load('U09');
    const r = buildExecutionAdjustment(
      e.input.current,
      today,
      e.analysis,
      e.input.options,
      e.input.context
    );
    if ('error' in r) throw new Error(r.error);
    const later = '2026-12-02' as IsoDate;
    const basis = basisFromPlan(r.result, later)!;
    expect(basis.policy?.easyWeeks).toBe(3);
    expect(basis.execution).toMatchObject({
      date: today,
      reportedBaseKm: 30,
      reportedLongRunKm: 10,
      startingKm: 21
    });
    const d = preparationDecision(
      r.result,
      later,
      basis,
      e.input.context,
      'limited',
      r.result.meta!.preparation
    );
    expect(d.conditions[0]).toBe(
      'Povratni blok: 3 nedelje lakog trčanja od 26.11.2026., bez nadoknade propuštenog.'
    );
  });
});
