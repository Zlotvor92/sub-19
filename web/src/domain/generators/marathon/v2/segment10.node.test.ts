/* MAR-10 (marathon-v2.6.1, ispravke lanaca; docs/generators-v2/audit/fixes/MAR-10.md). Svaki test pada na 81e4d1d
   (pre ispravke). Z4 (vraćanje revizije) je u app/adaptFlow.node.test.ts. */

import { describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { factsOf, painFacts } from './testInputs.ts';
import type { AdaptResult, MarathonV2Plan } from './types.ts';

const planOf = (input: Record<string, unknown>): MarathonV2Plan => {
  const g = generateMarathonV2(input);
  if (!g.ok) throw new Error(JSON.stringify(g.reasons));
  return g.plan;
};
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const BASE = {
  startDate: '2026-11-02',
  raceDate: '2027-03-14',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  longRunDay: 'sun',
  currentWeeklyKm: 45,
  recentResult: { distanceM: 21097.5, timeSec: 6300, date: '2026-10-19' },
  goalTimeSec: null
};

describe('Z7: manjak izvršenja vezan za zapise (kao umor, pouka 36)', () => {
  const p = planOf(BASE);
  const at = '2026-12-02';
  const f = factsOf(p, 'under50', at);
  const a1 = ok(adaptMarathonV2(p, f, at));
  it('prvi korak primenjuje manjak i beleži prozor zapisa', () => {
    const r = a1.reasons.find((x) => x.condition === 'UNDER_EXECUTION');
    expect(r?.applied).toBe(true);
    expect(a1.plan.adaptation!.steps.at(-1)!.underFrom).toBe(addDays(at, -6));
  });
  it('iste činjenice, isti asOf → isti plan (nema novog seka cilja)', () => {
    const a2 = ok(adaptMarathonV2(a1.plan, f, at));
    expect(a2.plan.weeks).toEqual(a1.plan.weeks);
    expect(a2.reasons.find((x) => x.condition === 'UNDER_EXECUTION')?.applied).toBe(false);
  });
  it('sutra bez novih zapisa → manjak nije ponovo primenjen', () => {
    const b = addDays(at, 1);
    const a3 = ok(adaptMarathonV2(a1.plan, f, b));
    expect(a3.reasons.find((x) => x.condition === 'UNDER_EXECUTION')?.applied ?? false).toBe(false);
    for (const w of a3.plan.weeks.filter((x) => x.startDate > b))
      expect(w.targetKm).toBeGreaterThanOrEqual(
        a1.plan.weeks.find((x) => x.index === w.index)!.targetKm - 0.05
      );
  });
});

describe('Z6: LIMITS preskače zaštićen dan (≤ asOf, zaključan u bilo kom koraku, urađen)', () => {
  it('dan kvaliteta zaključan u koraku bola, kasnije prošao → sledeći korak nije odbijen', () => {
    const p = planOf(BASE);
    const at = '2026-12-02';
    const q = p.weeks
      .flatMap((w) => w.days)
      .find((d) => d.date > at && d.date <= addDays(at, 5) && d.workout.kind === 'quality')!;
    expect(q).toBeDefined();
    const a1 = ok(adaptMarathonV2(p, { ...painFacts(at, 5), lockedDayIds: [q.date] }, at));
    expect(a1.plan.weeks.flatMap((w) => w.days).find((d) => d.date === q.date)!.workout.kind).toBe(
      'quality'
    );
    const b = addDays(q.date, 1);
    expect(a1.plan.adaptation!.steps.at(-1)!.pain).not.toBeNull();
    const a2 = adaptMarathonV2(a1.plan, {}, b);
    expect(a2.ok ? [] : a2.violations.filter((v) => v.rule === 'LIMITS')).toEqual([]);
    expect(a2.ok).toBe(true);
  });
});
