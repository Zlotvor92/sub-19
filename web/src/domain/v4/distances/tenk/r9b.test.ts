/* KRUG 9b (poruka organizatora 13. 11.) — opšta pravila motora, provera nad podacima ove distance. */
/* eslint-disable @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan } from '../../engine';
import { smallGrid, taperShape } from '../../engine/testdata/round9b';
import { estimateForm } from '../../fitness';
import { tenk } from './index';
import { PROFILES, factsOf } from './testdata/profiles';
import { SCENARIOS } from './testdata/scenarios';

const FORMS = [2280, 2880, 3600];

describe('krug 9b — A10 (a): sužavanje nije naopako i ne izostavlja dan', () => {
  it('profili, mreža i scenariji: nedelja −1 ≤ nedelja −2 ≤ vrh; nedelje −2 i −1 sa svim traženim danima', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const f = factsOf(p);
      const r = plan(buildState(f, p.goal, tenk, estimateForm), p.goal, tenk);
      if (r.ok) bad.push(...taperShape(p.id, r.doc, f.availability.runDays));
    }
    for (const g of smallGrid(tenk.distanceM, FORMS)) {
      const goal = { distanceId: tenk.id, raceDate: g.raceDate };
      const r = plan(buildState(g.facts, goal, tenk, estimateForm), goal, tenk);
      if (r.ok) bad.push(...taperShape(g.label, r.doc, g.runDays));
    }
    for (const s of SCENARIOS) {
      const r: any = s.run();
      bad.push(...taperShape(`s${String(s.no)}`, r.after, r.afterState.availability.runDays));
    }
    expect(bad).toEqual([]);
  });
});
