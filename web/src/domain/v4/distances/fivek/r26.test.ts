/* R26 (drugi sudija p15, coach/R24-ISPRAVKA.md P3) — povratnik posle povrede (p15, 4 dana): bez jakih uzbrdica u prve
   4 nedelje i brz rad 8. nedelje ≤ 15 % (bilo 20 % uz 21,7 km). */
import { describe, expect, it } from 'vitest';
import { buildState, plan, renderPlan } from '../../engine';
import { estimateForm } from '../../fitness';
import { fivek } from './index';
import { factsOf, PROFILES } from './testdata/profiles';

function weeksOf(id: string): string[] {
  const p = PROFILES.find((x) => x.id === id);
  if (p === undefined) throw new Error(id);
  const st = buildState(factsOf(p), p.goal, fivek, estimateForm);
  const r = plan(st, p.goal, fivek);
  if (!r.ok) throw new Error('plan');
  return renderPlan(r.doc, st, fivek)
    .split(/\n(?=\d+\. NEDELJA)/)
    .slice(1);
}

describe('R26 — p15 povratnik sa 4 dana', () => {
  const weeks = weeksOf('p15');
  it('nedelje 1–4 bez jakih uzbrdica', () => {
    for (const w of weeks.slice(0, 4)) expect(w).not.toMatch(/uzbrdo/);
  });
  it('8. nedelja: brz rad ≤ 15 % vremena trčanja', () => {
    const m = /brz rad (\d+) %/.exec(weeks[7] ?? '');
    expect(m).not.toBeNull();
    expect(Number(m?.[1])).toBeLessThanOrEqual(15);
  });
});
