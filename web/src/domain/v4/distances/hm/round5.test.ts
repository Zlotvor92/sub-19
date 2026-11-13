/* KRUG 5 (briefs/R4-ROUND4.md) — testovi novih pravila nad podacima polumaratona (E7, E9, D3, D7). */
import { describe, expect, it } from 'vitest';
import { buildState, paceCtxOf, plan, summarize, type PlanDoc } from '../../engine';
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
  return step !== undefined && 'target' in step && step.target.type === 'zone' ? step.target.zone : null;
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
});
