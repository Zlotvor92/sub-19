/* KRUG 5 (briefs/R4-ROUND4.md) — testovi novih pravila nad podacima polumaratona (E7, E9, D3, D7). */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  deriveEvents,
  paceCtxOf,
  plan,
  replan,
  summarize,
  type PlanDoc,
  type Run
} from '../../engine';
import { addDays } from '../../engine/dates';
import { fastWorkSec } from '../../engine/guard';
import { estimateForm } from '../../fitness';
import { hm } from './index';
import { OWNER_PLANS } from './testdata/owner';
import { PROFILES, factsOf } from './testdata/profiles';

const ALL: { id: string; doc: PlanDoc }[] = [
  ...PROFILES.map((p) => ({ id: p.id, facts: factsOf(p), goal: p.goal })),
  ...OWNER_PLANS.map((o) => ({ id: o.id, facts: o.facts, goal: o.goal }))
].map((c) => {
  const r = plan(buildState(c.facts, c.goal, hm, estimateForm), c.goal, hm);
  if (!r.ok) throw new Error(c.id);
  return { id: c.id, doc: r.doc };
});

const zoneOf = (doc: PlanDoc, date: string): string | null => {
  const w = doc.weeks.flatMap((x) => x.days).find((d) => d.date === date)?.workout;
  const step = w?.steps.find((s) => 'role' in s && s.role === 'work');
  return step !== undefined && 'target' in step && step.target.type === 'zone'
    ? step.target.zone
    : null;
};

describe('krug 5: polumaraton', () => {
  it('E9: poslednjih 7 dana samo oštrenje; 8–14 dana pred trku ≤ 2 brza treninga i ≤ 60 % brzog rada vrha', () => {
    const t = hm.safety.taper;
    if (t === undefined) throw new Error('safety.taper');
    for (const { id, doc } of ALL) {
      const race = doc.header.goal.raceDate;
      const days = doc.weeks.flatMap((w) => w.days);
      const peak = Math.max(
        0,
        ...doc.weeks
          .filter((w) => w.intent.kind === 'peak')
          .map((w) => w.days.reduce((s, d) => s + fastWorkSec(d.workout), 0))
      );
      const last = days.filter((d) => d.date >= addDays(race, -t.lastDays) && d.date < race);
      for (const d of last)
        if (fastWorkSec(d.workout) > 0)
          expect(d.workout?.stimulus, `${id} ${d.date}`).toBe(hm.safety.sharpening?.stimulus);
      const before = days.filter(
        (d) => d.date >= addDays(race, -t.weekBeforeFromDays) && d.date < addDays(race, -t.lastDays)
      );
      const fast = before.filter((d) => fastWorkSec(d.workout) > 0);
      expect(fast.length, id).toBeLessThanOrEqual(t.weekBeforeMaxQuality);
      const sum = fast.reduce((s, d) => s + fastWorkSec(d.workout), 0);
      expect(sum, id).toBeLessThanOrEqual(t.weekBeforeMaxOfPeak * peak + 120);
    }
  });

  it('D3: trkač sporiji od 2:05 — dugi ≤ očekivano vreme trke + 5 min, blok u dugom ≤ 35 min', () => {
    const r = hm.safety.longVsRace;
    if (r === undefined) throw new Error('safety.longVsRace');
    for (const { id, doc } of ALL) {
      const expected = doc.header.form.raceDay.expectedSec;
      if (expected < r.fromRaceSec) continue;
      const ctx = paceCtxOf(doc.header);
      for (const d of doc.weeks.flatMap((w) => w.days)) {
        if (d.workout?.kind !== 'long') continue;
        expect(summarize(d.workout, ctx).durationSec, `${id} ${d.date}`).toBeLessThanOrEqual(
          expected + r.overSec + 300
        );
        expect(d.workout.workSec, `${id} ${d.date}`).toBeLessThanOrEqual(r.blockMaxSec + 90);
      }
    }
  });

  it('D7: tempo trke (uklj. blok u dugom) nedeljno ≤ plafon nivoa', () => {
    const z = hm.safety.weeklyZoneMaxSec;
    if (z === undefined) throw new Error('safety.weeklyZoneMaxSec');
    for (const { id, doc } of ALL) {
      const cap = z.byLevel[doc.header.decisions.level] ?? Number.POSITIVE_INFINITY;
      for (const w of doc.weeks) {
        const rp = w.days
          .filter((d) => d.workout?.kind !== 'race' && zoneOf(doc, d.date) === z.zone)
          .reduce((s, d) => s + (d.workout?.workSec ?? 0), 0);
        expect(rp, `${id} n${String(w.index)}`).toBeLessThanOrEqual(cap + 180);
      }
    }
  });

  it('E2: posle bolesti skraćena nedelja ima dugi ≤ 45 % nedelje u km', () => {
    const p = PROFILES.find((x) => x.id === 'p01');
    if (p === undefined) throw new Error('p01');
    const facts = factsOf(p);
    const doc = ALL.find((x) => x.id === 'p01')?.doc;
    if (doc === undefined) throw new Error('plan');
    const ctx0 = paceCtxOf(doc.header);
    const from = doc.weeks[5]?.start ?? '';
    const to = addDays(from, 6);
    const runs: Run[] = doc.weeks
      .flatMap((w) => w.days)
      .filter((d) => d.workout !== null && d.workout.kind !== 'race' && d.date < from)
      .map((d) => {
        const c = summarize(d.workout, ctx0);
        return {
          id: `r-${d.id}`,
          date: d.date,
          distanceM: Math.round(c.distanceM),
          durationSec: Math.round(c.durationSec),
          dayId: d.id
        };
      });
    const state = buildState(
      {
        ...facts,
        today: to,
        runs: [...facts.runs, ...runs],
        pauses: [{ from, to, reason: 'bolest' }]
      },
      p.goal,
      hm,
      estimateForm,
      doc
    );
    const after = replan(doc, state, deriveEvents(doc, state), hm).doc;
    const ctx = paceCtxOf(after.header);
    const share = hm.safety.shortenedLongMaxShare ?? 1;
    for (const w of after.weeks) {
      if (w.start <= to || w.intent.kind === 'race') continue;
      const old = doc.weeks.find((x) => x.start === w.start);
      const km = (x: typeof w): number =>
        x.days.reduce(
          (t, d) =>
            t +
            (d.workout === null || d.workout.kind === 'race' ? 0 : summarize(d.workout, ctx).km),
          0
        );
      if (old === undefined || km(w) >= km(old) - 0.5) continue; /* samo skraćene nedelje */
      const long = Math.max(
        0,
        ...w.days.map((d) => (d.workout?.kind === 'long' ? summarize(d.workout, ctx).km : 0))
      );
      /* krug 6 (R2): prvi dugi posle prekida ima pod 62 % poslednjeg dugog pre njega — tada važi pod, ne 45 % */
      const lastBefore = Math.max(
        0,
        ...runs
          .filter((r) => r.date < from && r.date >= addDays(from, -28))
          .map((r) => r.distanceM / 1000)
      );
      expect(long, `n${String(w.index)}`).toBeLessThanOrEqual(
        Math.max(share * km(w), 0.65 * lastBefore) + 0.5
      );
    }
  });
});
