import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../date';
import type { GenPlanState } from '../state';
import { matchPlanRows } from '../training/adaptation/matching';
import { sessDesc } from '../training/sessions/calc';
import type { PlanGenerationInput } from '../training/types';
import { resolvePlan } from './resolve';
import { getPlanRevisions, recordPlanRevision } from './versions';
import type { ExecutionAdjustmentOptions, ReplanContext } from '@/domain/generators/select';
import type { ExecutionAnalysis } from '@/domain/generators/halfMarathon/training/execution';
import { routedEngine } from '@/test/generators';

/* Stari zajednički engine je obrisan: svaka funkcija ide generatoru distance plana o kome je reč (`routedEngine`). */
const {
  adaptGeneratedPlan,
  alignAutomaticOverlays,
  analyzeExecution,
  buildExecutionAdjustment,
  deliveredWeeks,
  generatePlan,
  graftFuturePlan,
  isDemanding
} = routedEngine(5000);

type Event = {
  today?: IsoDate;
  profile?: { eventToday: IsoDate };
  input: {
    current: GenPlanState;
    context: ReplanContext;
    options: ExecutionAdjustmentOptions;
    today?: IsoDate;
  };
  analysis: ExecutionAnalysis;
  adjustment: { result: GenPlanState };
};
function fixture(id: string): Event {
  const doc = JSON.parse(
    readFileSync(
      new URL(`../../../../docs/qa/generator-ab/users/${id}-event.json`, import.meta.url),
      'utf8'
    )
  ) as Event & { earlierControlled: Event; event: Event };
  return id === 'U08'
    ? doc.earlierControlled
    : id === 'U10'
      ? { ...doc.event, profile: doc.profile }
      : doc;
}
function execute(e: Event) {
  const today = e.today ?? e.input.today ?? e.profile!.eventToday;
  const result = buildExecutionAdjustment(
    e.input.current,
    today,
    e.analysis,
    e.input.options,
    e.input.context
  );
  if ('error' in result) throw new Error(result.error);
  return { ...result, today };
}
const serial = (x: unknown) => JSON.stringify(x);

for (const id of ['U04', 'U06', 'U08', 'U09', 'U10']) {
  it(`${id}: final descriptions, focus, peaks and warnings use delivered structure; frozen inputs survive`, () => {
    const e = fixture(id);
    const before = serial(e);
    const { result, today, notes } = execute(e);
    const oldView = resolvePlan(e.input.current.weeks, {
      alts: e.input.context.alts ?? {},
      moves: e.input.context.moves ?? {}
    });
    const view = resolvePlan(result.weeks, {
      alts: e.input.context.alts ?? {},
      moves: e.input.context.moves ?? {}
    });
    const policyEnd = (result.meta!.finalization as { returnWindow: { end: IsoDate } }).returnWindow
      .end;
    for (const d of view.dated) {
      const old = oldView.byId.get(d.id)!;
      if (d.date <= today) expect(d.origin).toEqual(old.origin);
      const row = matchPlanRows(
        oldView.weeks,
        e.input.current.pred.map((r) => ({ ...r, id: r.id! }))
      ).get(d.id);
      const protectedDay =
        d.date <= today ||
        e.input.context.log?.[d.id]?.status === 'done' ||
        (row && (e.input.context.pred?.[row.id] != null || e.input.context.predLock?.[row.id])) ||
        Object.values(old.session?.overrides ?? {}).some(Boolean) ||
        e.input.context.alts?.[d.id];
      if (protectedDay) {
        expect(result.weeks.flatMap((w) => w.days).find((x) => x.id === d.id)).toEqual(
          e.input.current.weeks.flatMap((w) => w.days).find((x) => x.id === d.id)
        );
        if (row) expect(result.pred.find((r) => r.id === row.id)).toEqual(row);
        continue;
      }
      if (d.date > today && d.date < policyEnd && !d.rest && d.tag !== 'snaga') {
        expect(d.session || d.finish || d.strides).toBeFalsy();
        expect(d.desc).not.toMatch(/ubrzanja|poslednjih .*km @|sprint/);
      }
      if (d.session) expect(d.desc).toBe(sessDesc(d.session));
      expect(d.date).toBe(old.date);
    }
    const delivered = deliveredWeeks(result, today, e.input.context);
    for (const w of delivered.filter((w) => w.days.length && !w.days.some(isDemanding))) {
      expect(result.weeks.find((x) => x.w === w.w)!.focus).not.toMatch(
        /Fartlek|Tempo|Intervali|oštrina|brzi završetak/i
      );
    }
    const working = delivered.filter((w) => !w.taper && w.w < result.meta!.weeks);
    const peak = Math.max(0, ...working.map((w) => w.vol));
    expect(result.meta!.preparation!.peakWeeklyKm).toBe(peak);
    const peakWarnings = result.meta!.dayWarnings.filter((w) => w.startsWith('Isporučeni vrhunac'));
    for (const warning of peakWarnings) expect(warning).toContain(`vrhunac ${peak} km/ned`);
    expect(result.meta!.dayWarnings.some((s) => s.startsWith('Vrhunac plana je oko'))).toBe(false);
    expect(
      result.meta!.dayWarnings.some((s) => /plan počinje sa \d+ lagane povratne/.test(s))
    ).toBe(false);
    const fact = result.meta!.dayWarnings.find((s) => s.startsWith('Finalni preostali plan:'))!;
    expect(notes).toContain(fact);
    expect(serial(e)).toBe(before);
  });
}

const input: PlanGenerationInput = {
  startDate: '2026-10-05',
  raceDate: '2027-03-21',
  raceDistM: 21097.5,
  pb: { distM: 5000, sec: 1250, date: '2026-09-20' },
  weeklyKm: 45,
  recentLongRunKm: 14,
  consistentWeeks: 24,
  qualityExperience: 'experienced',
  runDays: 5,
  quality: 2,
  intensity: 'std'
};
const stored = () => ({ ...adaptGeneratedPlan(generatePlan(input))!, ulaz: input });
const today = parseIsoDate('2026-11-25')!;
function returnPlan(p: GenPlanState, context: ReplanContext) {
  const analysis = analyzeExecution({
    plan: resolvePlan(p.weeks, { alts: context.alts ?? {}, moves: context.moves ?? {} }),
    today,
    log: context.log ?? {}
  });
  const result = buildExecutionAdjustment(
    p,
    today,
    analysis,
    { breakDays: 28, weeklyKm: 45, recentLongRunKm: 14 },
    context
  );
  if ('error' in result) throw new Error(result.error);
  return result.result;
}

describe('finalization preserves evidence and exposes incompatible protected prescriptions', () => {
  it('manual tempo overlay survives and has a dated return conflict; effective calendar/overlay drives aggregates', () => {
    const p = stored();
    const day = p.weeks[10]!.days.find((d) => d.session)!;
    const targetWeek = p.weeks[8]!;
    const date = addDays(parseIsoDate(targetWeek.start)!, 6);
    const context: ReplanContext = {
      moves: {
        [day.id!]: date,
        [targetWeek.days.find((d) => d.dow === 6)!.id!]: addDays(
          parseIsoDate(p.weeks[10]!.start)!,
          day.dow
        )
      },
      alts: {
        [day.id!]: {
          tag: 'tempo',
          km: 25,
          desc: 'Moj tempo 25 km',
          pace: 280,
          paceAuto: false,
          rw: null
        }
      }
    };
    const before = serial({ p, context });
    const result = returnPlan(p, context);
    expect(result.weeks.flatMap((w) => w.days).find((d) => d.id === day.id)).toEqual(day);
    const visible = resolvePlan(result.weeks, {
      alts: context.alts!,
      moves: context.moves!
    }).byId.get(day.id!)!;
    expect(visible.date).toBe(date);
    expect(visible.desc).toBe('Moj tempo 25 km');
    const conflict = result.meta!.dayWarnings.find((s) =>
      s.startsWith('Konflikt povratne politike:')
    )!;
    expect(conflict).toContain(date);
    expect(conflict).toContain(day.id!);
    const delivered = deliveredWeeks(result, today, context);
    expect(delivered.find((w) => w.w === targetWeek.w)!.days.some((d) => d.km === 25)).toBe(true);
    expect(result.weeks.find((w) => w.w === targetWeek.w)!.focus).toContain('Tempo');
    expect(result.meta!.preparation!.peakWeeklyKm).toBe(
      Math.max(...delivered.filter((w) => !w.taper && w.w < result.meta!.weeks).map((w) => w.vol))
    );
    expect(serial({ p, context })).toBe(before);
  });

  it('manual easy overlay suppresses underlying session in focus and demanding counts', () => {
    const p = stored();
    const day = p.weeks[8]!.days.find((d) => d.session)!;
    const context: ReplanContext = {
      alts: {
        [day.id!]: {
          tag: 'lako',
          km: 2,
          desc: 'Moja šetnja/trčanje',
          pace: null,
          paceAuto: false,
          rw: null
        }
      }
    };
    const result = returnPlan(p, context);
    const w = deliveredWeeks(result, today, context).find((w) => w.w === 9)!;
    expect(w.days.some((d) => d.session || d.finish || d.strides)).toBe(false);
    expect(result.weeks[8]!.focus).not.toMatch(/Tempo|Fartlek|Intervali/);
    expect(result.meta!.dayWarnings.some((s) => s.startsWith('Konflikt povratne politike:'))).toBe(
      false
    );
  });

  it('done, measured, manually locked and moved-to-past records and rows remain exact through JSON restore', () => {
    const p = stored();
    const sessions = p.weeks
      .slice(8, 10)
      .flatMap((w) => w.days)
      .filter((d) => d.session);
    const [done, measured, manual, moved] = sessions;
    manual!.session!.overrides = { paceSec: true };
    manual!.desc = 'Ručno zaključan opis';
    const matches = matchPlanRows(
      resolvePlan(p.weeks, { alts: {}, moves: {} }).weeks,
      p.pred.map((r) => ({ ...r, id: r.id! }))
    );
    const row = matches.get(measured!.id!)!;
    const context: ReplanContext = {
      log: { [done!.id!]: { status: 'done', km: 7.23, sec: 2501, runDate: '2026-11-24' } },
      pred: { [row.id]: 266 },
      predLock: { [row.id]: true },
      moves: { [moved!.id!]: '2026-11-24' }
    };
    const before = serial({ p, context });
    const result = returnPlan(p, context);
    const persisted = JSON.parse(
      serial(recordPlanRevision(p, result, { reason: 'execution', date: today, summary: 'Return' }))
    ) as GenPlanState;
    const snapshot = getPlanRevisions(persisted)[0]!.snapshot;
    const restored = graftFuturePlan(persisted, snapshot, today, context);
    for (const plan of [result, restored]) {
      for (const d of sessions)
        expect(plan.weeks.flatMap((w) => w.days).find((x) => x.id === d.id)).toEqual(d);
      expect(plan.pred.find((r) => r.id === row.id)).toEqual(row);
      for (const d of sessions) expect(plan.qs?.[d.id!]).toEqual(p.qs?.[d.id!]);
    }
    expect(serial({ p, context })).toBe(before);
    expect(snapshot.weeks).toEqual(p.weeks);
  });

  it('pure automatic pace overlays follow a removed session without hiding final easy type/text', () => {
    const p = stored();
    const day = p.weeks[8]!.days.find((d) => d.session)!;
    const context: ReplanContext = {
      alts: {
        [day.id!]: {
          tag: day.tag!,
          km: day.km ?? null,
          desc: day.desc!,
          pace: day.session!.paceSec,
          paceAuto: true,
          rw: null
        }
      }
    };
    const before = serial(context);
    const result = returnPlan(p, context);
    const alts = alignAutomaticOverlays(p, result, today, context);
    expect(alts[day.id!]).toBeUndefined();
    const shown = resolvePlan(result.weeks, { alts, moves: {} }).byId.get(day.id!)!;
    expect(shown.tag).toBe('lako');
    expect(shown.desc).not.toMatch(/Tempo|Fartlek|ubrzanja/);
    const delivered = deliveredWeeks(result, today, { ...context, alts });
    const actual = Math.max(
      ...delivered.filter((w) => !w.taper && w.w < result.meta!.weeks).map((w) => w.vol)
    );
    expect(result.meta!.preparation!.peakWeeklyKm).toBe(actual);
    expect(serial(context)).toBe(before);
  });

  it('U08 short cycle succeeds without mutating history', () => {
    const doc = JSON.parse(
      readFileSync(
        new URL('../../../../docs/qa/generator-ab/users/U08-event.json', import.meta.url),
        'utf8'
      )
    ) as { event: Event };
    const event = doc.event;
    const before = serial(event.input);
    expect(
      buildExecutionAdjustment(
        event.input.current,
        event.today!,
        event.analysis,
        event.input.options,
        event.input.context
      )
    ).not.toHaveProperty('error');
    expect(serial(event.input)).toBe(before);
  });
});
