/* KRUG 10 (stavke 6 i 9): napomena za dan trke — jedan izvor tempa, poslednja provera forme. */
import { describe, expect, it } from 'vitest';
import { buildState, plan, renderPlan } from '../../engine';
import { raceNoteSource } from '../../engine/testdata/round10';
import { estimateForm } from '../../fitness';
import { tenk } from './index';
import { PROFILES, factsOf } from './testdata/profiles';

describe('krug 10 — napomena za dan trke (tenk)', () => {
  it('tempo trke = tempo u treninzima; pominje se samo poslednja provera forme', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const state = buildState(factsOf(p), p.goal, tenk, estimateForm);
      const r = plan(state, p.goal, tenk);
      if (r.ok) bad.push(...raceNoteSource(p.id, r.doc, renderPlan(r.doc, state, tenk)));
    }
    expect(bad).toEqual([]);
  });
});
