import { describe, expect, it } from 'vitest';
import { generatePlan } from '../generator/generatePlan';
import { sessQKm } from '../sessions/calc';
import type { Day, PlanGenerationInput, SessionDay, TrainingPlan, Week } from '../types';
import { paceForZone } from '../vdot/paceForZone';
import { fitBlocks, HM_TRACKS, hmTrack } from './hmProgression';

/* QA profiles U07 (first HM, limited base) and U08 (experienced HM for a result) from
   docs/qa/generator-ab/inputs.json — the locked inputs of the ten-user QA. */
const U07: PlanGenerationInput = {
  startDate: '2026-10-12',
  raceDate: '2027-01-31',
  raceDistM: 21097.5,
  pb: { distM: 5000, sec: 1425, date: '2026-09-20' },
  weeklyKm: 30,
  recentLongRunKm: 10,
  consistentWeeks: 12,
  breakWeeks: 0,
  qualityExperience: 'some',
  runDays: 4,
  quality: 2,
  intensity: 'std',
  volIntensity: 'std',
  trainedRecently: true,
  goalSec: 6300,
  lrDow: 7
};
const U08: PlanGenerationInput = {
  ...U07,
  raceDate: '2027-01-17',
  pb: { distM: 5000, sec: 1235, date: '2026-09-20' },
  weeklyKm: 55,
  recentLongRunKm: 16,
  consistentWeeks: 24,
  qualityExperience: 'experienced',
  runDays: 5,
  goalSec: 5700
};

const plan = (inp: PlanGenerationInput): TrainingPlan => {
  const p = generatePlan(structuredClone(inp));
  if ('error' in p) throw new Error(p.error);
  return p;
};
const sessions = (w: Week): SessionDay[] => w.days.filter((d): d is SessionDay => !!d.session);
const workMin = (d: SessionDay): number => (sessQKm(d.session) * d.session.paceSec) / 60;
const isBuild = (p: TrainingPlan, w: Week): boolean =>
  !w.deload && !w.taper && w.w < p.weeks.length;
const longRun = (w: Week): Day | undefined => w.days.find((d) => d.tag === 'lr' && !d.mlr);
const hasTrial = (w: Week): boolean => sessions(w).some((d) => d.session.kind === 'Kontrolna trka');

describe('HM tracks', () => {
  it('experienced runners follow the result track; everyone else the first-HM track', () => {
    expect(hmTrack('experienced')).toBe('performance');
    for (const r of ['developing', 'beginner', 'returning'] as const)
      expect(hmTrack(r)).toBe('first');
    expect(hmTrack(undefined)).toBe('first');
  });

  it('the first-HM track uses shorter blocks, smaller totals and longer recovery', () => {
    const f = HM_TRACKS.first;
    const p = HM_TRACKS.performance;
    expect(f.t.endMin).toBeLessThan(p.t.endMin);
    expect(f.rp.endMin).toBeLessThan(p.rp.endMin);
    expect(f.t.blockEndMin).toBeLessThan(p.t.blockEndMin);
    expect(f.rpRestSec(600)).toBeGreaterThan(p.rpRestSec(600));
  });
});

describe('fitBlocks', () => {
  it('never shortens the planned block to hit the total, and never exceeds the hard limit', () => {
    // 4.4 km target with 1.8 km blocks: 2×2200 instead of 2×1800 or 3×1500.
    expect(fitBlocks(4.4, 1.8, 6, 1000)).toEqual({ reps: 2, repM: 2200 });
    for (const [target, block, hard] of [
      [5, 1.6, 5.5],
      [9, 3, 8],
      [3, 2, 3.5],
      [12, 4, 14]
    ] as const) {
      const fit = fitBlocks(target, block, hard, 1000);
      expect(fit).not.toBeNull();
      expect((fit!.reps * fit!.repM) / 1000).toBeLessThanOrEqual(hard + 1e-9);
      expect(fit!.reps).toBeGreaterThanOrEqual(2);
    }
  });

  it('shortens blocks only when two planned blocks do not fit; gives up below the minimum', () => {
    expect(fitBlocks(4, 2.5, 4, 1000)).toEqual({ reps: 2, repM: 2000 });
    expect(fitBlocks(2, 1.5, 1.8, 1000)).toBeNull();
  });
});

describe('U08 — experienced HM for a result', () => {
  const p = plan(U08);

  it('W1 threshold is a meaningful dose (QA: two T sessions totalled 3.4 km / ~15 min)', () => {
    const w1 = p.weeks[0] as Week;
    const t = sessions(w1).filter((d) => d.session.zone === 'T');
    expect(t.length).toBeGreaterThanOrEqual(1);
    const main = t[0] as SessionDay;
    expect(main.session.type).toBe('int');
    if (main.session.type !== 'int') return;
    expect(workMin(main)).toBeGreaterThanOrEqual(16);
    expect(main.session.repM).toBeGreaterThanOrEqual(1600);
    expect(main.session.restSec).toBeLessThanOrEqual(75);
    // Threshold is the main HM system: W1 threshold work alone is ≥ 25 min (previous
    // segment 22.8 min, locked QA 15 min).
    const tMin = t.reduce((n, d) => n + workMin(d), 0);
    expect(tMin).toBeGreaterThanOrEqual(25);
  });

  it('threshold blocks grow through the cycle while recovery stays short', () => {
    const blocks = p.weeks
      .filter((w) => isBuild(p, w))
      .flatMap((w) => sessions(w))
      .filter((d) => d.session.kind === 'Tempo isprekidan' && d.session.type === 'int')
      .map((d) => (d.session.type === 'int' ? d.session : null)!);
    expect(blocks.length).toBeGreaterThanOrEqual(5);
    expect(blocks.at(-1)!.repM).toBeGreaterThan(blocks[0]!.repM);
    for (const s of blocks) expect(s.restSec).toBeLessThanOrEqual(90);
  });

  it('HM rhythm starts before the specific phase and its blocks lengthen', () => {
    const rp = p.weeks
      .filter((w) => isBuild(p, w))
      .flatMap((w) => sessions(w).map((d) => ({ w: w.w, s: d.session })))
      .filter((x) => x.s.kind === 'Tempo trke' && x.s.type === 'int');
    expect(rp.length).toBeGreaterThanOrEqual(2);
    const reps = rp.map((x) => (x.s.type === 'int' ? x.s.repM : 0));
    for (let i = 1; i < reps.length; i++)
      expect(reps[i]).toBeGreaterThanOrEqual(reps[i - 1] as number);
    for (const x of rp) if (x.s.type === 'int') expect(x.s.restSec).toBeLessThanOrEqual(75);
  });

  it('an LR race-pace finish is the HM day: the only other quality is threshold', () => {
    const finishWeeks = p.weeks.filter((w) => w.days.some((d) => d.finish));
    expect(finishWeeks.length).toBeGreaterThan(0);
    for (const w of finishWeeks) {
      const q = sessions(w);
      expect(q).toHaveLength(1);
      expect(q[0]!.session.zone).toBe('T');
    }
  });

  it('the 10 km race rehearsal counts as the week’s quality: no second session, no LR finish', () => {
    const trial = p.weeks.find(hasTrial);
    expect(trial).toBeDefined();
    expect(sessions(trial!)).toHaveLength(1);
    expect(trial!.days.some((d) => d.finish)).toBe(false);
  });

  it('taper keeps paces and steps the work down from the last build week', () => {
    const v = p.meta.trainingVdot ?? p.meta.vdot0;
    const tapers = p.weeks.filter((w) => w.taper);
    expect(tapers).toHaveLength(2);
    const fast = (w: Week): number =>
      sessions(w).reduce((n, d) => n + workMin(d), 0) +
      w.days.reduce((n, d) => n + (d.finish ? (d.finish.km * d.finish.paceSec) / 60 : 0), 0);
    const lastBuild = p.weeks.filter((w) => isBuild(p, w)).at(-1)!;
    expect(fast(tapers[0]!)).toBeLessThan(fast(lastBuild));
    expect(fast(tapers[1]!)).toBeLessThan(fast(tapers[0]!));
    for (const w of tapers)
      for (const d of sessions(w))
        expect(d.session.paceSec).toBe(
          d.session.zone === 'RP' ? p.meta.racePace : paceForZone(v, 'T')
        );
  });
});

describe('U07 — first HM, limited base', () => {
  const p = plan(U07);

  it('HM-pace work is no longer two short blocks with ~5½ min standing recovery', () => {
    const rp = p.weeks
      .filter((w) => isBuild(p, w))
      .flatMap((w) => sessions(w))
      .filter((d) => d.session.kind === 'Tempo trke');
    expect(rp.length).toBeGreaterThanOrEqual(3);
    for (const d of rp) if (d.session.type === 'int') expect(d.session.restSec).toBe(90);
    expect(workMin(rp.at(-1)!)).toBeGreaterThan(workMin(rp[0]!) * 1.5);
  });

  it('on four running days a long run of 90+ min leaves one quality day', () => {
    const pLR = paceForZone(p.meta.trainingVdot ?? p.meta.vdot0, 'LR');
    const demanding = p.weeks.filter(
      (w) => isBuild(p, w) && !hasTrial(w) && (longRun(w)?.km ?? 0) * pLR >= 90 * 60
    );
    expect(demanding.length).toBeGreaterThan(0);
    for (const w of demanding) expect(sessions(w)).toHaveLength(1);
  });

  it('the easy day after a demanding long run stays short (QA: 19.5 km LR, then 11.5 km)', () => {
    const v = p.meta.trainingVdot ?? p.meta.vdot0;
    const pLR = paceForZone(v, 'LR');
    const pE = paceForZone(v, 'E');
    let checked = 0;
    for (let i = 1; i < p.weeks.length - 1; i++) {
      const lr = longRun(p.weeks[i - 1] as Week);
      const monday = (p.weeks[i] as Week).days.find((d) => d.dow === 1 && d.tag === 'lako');
      if (!lr?.km || !monday?.km || lr.km * pLR < 90 * 60) continue;
      checked++;
      expect(monday.km).toBeLessThanOrEqual(lr.km * 0.6 + 0.05);
      expect(monday.km * pE).toBeLessThanOrEqual(60 * 60 + 0.05 * pE);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('per-session ceilings hold on the delivered week', () => {
    for (const w of p.weeks)
      for (const d of sessions(w)) {
        if (d.session.zone === 'T')
          expect(sessQKm(d.session)).toBeLessThanOrEqual(w.vol * 0.1 + 0.05);
        if (d.session.kind === 'Tempo trke')
          expect(sessQKm(d.session)).toBeLessThanOrEqual(Math.min(w.vol * 0.2, 12) + 0.05);
      }
  });
});
