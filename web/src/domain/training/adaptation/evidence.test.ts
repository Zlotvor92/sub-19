import { describe, expect, it } from 'vitest';
import { adaptGeneratedPlan, resolvePlan } from '../../plan';
import type { LogEntry, VdotRecord } from '../../state';
import { generatePlan } from '../generator/generatePlan';
import { predRow } from '../prediction';
import { predictionSummary } from '../prediction/summary';
import { paceForZone } from '../vdot/paceForZone';
import { vdotFromPace } from '../vdot/vdotFromPace';
import { t3kVdot } from '../test3k';
import {
  classifyMeasurement,
  dayZone,
  fitnessEvidence,
  matchPlanRows,
  sessionClassFor,
  vdotProposal,
  type ProposalContext
} from './index';
import { enterWorkPace, recordAutoPace, type WorkPaceState } from '../../day/workPace';

const generated = adaptGeneratedPlan(
  generatePlan({
    startDate: '2026-01-05',
    raceDate: '2026-05-31',
    raceDistM: 10000,
    pb: { distM: 10000, sec: 2700 },
    weeklyKm: 45,
    runDays: 5,
    quality: 2,
    intensity: 'std',
    trainedRecently: true,
    consistentWeeks: 24,
    qualityExperience: 'experienced',
    recentLongRunKm: 14
  })
)!;
const plan = resolvePlan(generated.weeks, { alts: {}, moves: {} });
const pred = generated.pred as ProposalContext['pred'];
const matched = matchPlanRows(plan.weeks, pred);
const base: ProposalContext = {
  today: '2026-03-02',
  plan,
  pred,
  meta: generated.meta!,
  log: {},
  alts: {},
  vdotChain: [],
  tests: []
};
const record = (id: string, ts: string, measured = 55): VdotRecord => ({
  id,
  ts,
  measured,
  vdot: 55,
  prev: null,
  delta: null
});
const adequateDays = [...matched]
  .filter(([id, r]) => {
    const d = plan.byId.get(id)!;
    return (
      d.date >= '2026-01-25' &&
      d.date < base.today &&
      !r.nemeri &&
      ['T', 'I'].includes(d.session?.zone ?? r.zone ?? '') &&
      r.q * r.pt >= 360
    );
  })
  .slice(0, 3);
function performed(): ProposalContext {
  const log: Record<string, LogEntry> = {};
  const vdotChain = adequateDays.map(([id, r]) => {
    const d = plan.byId.get(id)!;
    log[id] = { status: 'done', runDate: d.date, km: d.km };
    return record(r.id, d.date);
  });
  return { ...base, log, vdotChain };
}

describe('form evidence gates', () => {
  it('counts recent performed aerobic work and explains evidence type', () => {
    expect(adequateDays).toHaveLength(3);
    const e = fitnessEvidence(performed());
    expect(e.measurements).toBe(3);
    expect(e.distinctDays).toBe(3);
    expect(e.confirmedTests).toBe(0);
    expect(vdotProposal(performed())?.message).toContain('nije potvrđen rezultat trke');
  });
  it.each(['pending', 'skip'])('does not propose from %s entries', (status) => {
    const ctx = performed();
    ctx.log = Object.fromEntries(Object.entries(ctx.log).map(([id, l]) => [id, { ...l, status }]));
    expect(fitnessEvidence(ctx).measurements).toBe(0);
    expect(vdotProposal(ctx)).toBeNull();
  });
  it.each([null, -1, 0.1, Number.NaN])(
    'does not certify completed work from actual km %s',
    (km) => {
      const ctx = performed();
      ctx.log = Object.fromEntries(Object.entries(ctx.log).map(([id, l]) => [id, { ...l, km }]));
      expect(fitnessEvidence(ctx).excluded.every((e) => e.reason === 'incomplete-work')).toBe(true);
      expect(vdotProposal(ctx)).toBeNull();
    }
  );
  it('honors an explicit recovery block on faster proposals', () => {
    expect(vdotProposal({ ...performed(), positiveAdjustmentAllowed: false })).toBeNull();
  });
  it('introductory short work and race-derived targets do not qualify for tempo changes', () => {
    const ctx = performed();
    expect(
      fitnessEvidence({ ...ctx, pred: pred.map((r) => ({ ...r, q: 0.4 })) }).excluded.every(
        (e) => e.reason === 'short-work'
      )
    ).toBe(true);
    expect(
      fitnessEvidence({ ...ctx, pred: pred.map((r) => ({ ...r, nemeri: true })) }).excluded.every(
        (e) => e.reason === 'not-aerobic-evidence'
      )
    ).toBe(true);
  });
  it.each([
    ['2026-03-03', 'future'],
    ['2025-12-20', 'stale'],
    ['2026-02-31', 'invalid-date']
  ])('does not count work dated %s', (runDate, reason) => {
    const ctx = performed();
    ctx.log = Object.fromEntries(Object.entries(ctx.log).map(([id, l]) => [id, { ...l, runDate }]));
    expect(fitnessEvidence(ctx).excluded.every((e) => e.reason === reason)).toBe(true);
    expect(vdotProposal(ctx)).toBeNull();
  });
  it('three entries on one performed day cannot satisfy three independent dates', () => {
    const ctx = performed();
    ctx.log = Object.fromEntries(
      Object.entries(ctx.log).map(([id, l]) => [id, { ...l, runDate: '2026-02-15' }])
    );
    expect(fitnessEvidence(ctx).measurements).toBe(3);
    expect(fitnessEvidence(ctx).distinctDays).toBe(1);
    expect(vdotProposal(ctx)).toBeNull();
  });
  it('repetitions do not supply aerobic form evidence even when performed', () => {
    const ctx = performed();
    const altered = pred.map((r) => ({ ...r, zone: 'R' as const }));
    const weeks = generated.weeks.map((w) => ({
      ...w,
      days: w.days.map((d) =>
        d.session ? { ...d, session: { ...d.session, zone: 'R' as const } } : d
      )
    }));
    expect(
      fitnessEvidence({ ...ctx, pred: altered, plan: resolvePlan(weeks, { alts: {}, moves: {} }) })
        .measurements
    ).toBe(0);
  });
  it('requires actual retained valid 3 km results rather than orphan or future test ids', () => {
    const tests = [1, 2, 3].map((i) => ({
      id: `t3k-2026-02-0${i}-a`,
      date: `2026-02-0${i}`,
      sec: 700
    }));
    const vdotChain = tests.map((t) => record(t.id, t.date, t3kVdot(t.sec)!));
    expect(fitnessEvidence({ ...base, tests, vdotChain }).confirmedTests).toBe(3);
    expect(fitnessEvidence({ ...base, vdotChain }).measurements).toBe(0);
    expect(
      fitnessEvidence({
        ...base,
        tests: tests.map((t) => ({ ...t, date: '2026-03-03' })),
        vdotChain
      }).measurements
    ).toBe(0);
  });
  it('strict race summary preserves manual pace but has no result without accepted evidence', () => {
    const r = pred[0]!;
    const summary = predictionSummary({
      pred: [r],
      paces: { [r.id]: 250 },
      chain: [],
      tests: [],
      raceDistM: 10000,
      requireAcceptedEvidence: true
    });
    expect(summary.rows[0]?.a).toBe(250);
    expect(summary.rows[0]?.pred).toBeNull();
    expect(summary.entered).toHaveLength(0);
  });
});

describe('explicit zones and replacing old pace measurements', () => {
  const [dayId, originalRow] = adequateDays[0]!;
  const originalDay = plan.byId.get(dayId)!;
  const day = {
    ...originalDay,
    session: { ...originalDay.session!, kind: 'Fartlek', zone: 'T' as const }
  };
  const row = { ...originalRow, l: `N${day.w} · Fartlek`, zone: 'T' as const };
  const context = { rows: [row], baselineVdot: 48, hasAlt: false };
  const state: WorkPaceState = {
    pred: {},
    predLock: {},
    log: {},
    vdotLog: [record(row.id, day.date, 48)]
  };
  it('T fartlek is measured and adapted through T rather than its old I kind label', () => {
    const p = paceForZone(48, 'T');
    expect(predRow(1, 'Fartlek', 2, p, 5000, 48, 'T').zone).toBe('T');
    expect(dayZone(new Map([[dayId, row]]), day)?.zone).toBe('T');
    expect(sessionClassFor(false, row.l, row.zone)).toBe('tempo');
    expect(
      classifyMeasurement({
        row,
        paceSec: p,
        kind: 'Fartlek',
        auto: false,
        retagged: false,
        baselineVdot: 48,
        currentVdot: 48
      })
    ).toMatchObject({ measured: Math.round(vdotFromPace(p, 'T') * 10) / 10 });
  });
  it('a rejected manual correction stays displayed and removes its earlier VDOT', () => {
    const r = enterWorkPace(day, row.id, 100, day.date, state, context);
    expect(r.outcome.status).toBe('rejected');
    expect(r.pred[row.id]).toBe(100);
    expect(r.predLock[row.id]).toBe(true);
    expect(r.vdotLog).toHaveLength(0);
  });
  it('an automatic rejection clears old automatic pace and old form evidence', () => {
    const r = recordAutoPace(
      day,
      row.id,
      100,
      day.date,
      { ...state, pred: { [row.id]: 250 } },
      context
    );
    expect(r.written).toBe(false);
    expect(r.pred[row.id]).toBeUndefined();
    expect(r.vdotLog).toHaveLength(0);
  });
  it.each([100, paceForZone(48, 'T')])(
    'a locked manual work pace and its chain survive automatic import %s',
    (automaticPace) => {
      const manual: WorkPaceState = {
        ...state,
        pred: { [row.id]: 260 },
        predLock: { [row.id]: true },
        log: { [day.id]: { status: 'done', km: 8, autoOdbijen: 200 } }
      };
      const before = JSON.stringify(manual);
      const result = recordAutoPace(day, row.id, automaticPace, day.date, manual, context);
      expect(result.written).toBe(false);
      expect(result.pred).toBe(manual.pred);
      expect(result.predLock).toBe(manual.predLock);
      expect(result.vdotLog).toBe(manual.vdotLog);
      expect(result.log).toBe(manual.log);
      expect(JSON.stringify(manual)).toBe(before);
    }
  );
  it('a corrected repetition keeps its manually entered pace without VDOT evidence', () => {
    const r = enterWorkPace(
      { ...day, session: { ...day.session, zone: 'R' } },
      row.id,
      paceForZone(48, 'R'),
      day.date,
      state,
      context
    );
    expect(r.outcome.status).toBe('not-measured');
    expect(r.pred[row.id]).toBeGreaterThan(0);
    expect(r.vdotLog).toHaveLength(0);
  });
});
