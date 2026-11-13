/* KRUG 10 (stavke 6 i 9): napomena za dan trke — jedan izvor tempa, poslednja provera forme. */
import { describe, expect, it } from 'vitest';
import { buildState, plan, renderPlan } from '../../engine';
import { raceNoteSource } from '../../engine/testdata/round10';
import { estimateForm } from '../../fitness';
import { marathon } from './index';
import { PROFILES, factsOf } from './testdata/profiles';

describe('krug 10 — napomena za dan trke (marathon)', () => {
  it('tempo trke = tempo u treninzima; pominje se samo poslednja provera forme', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const state = buildState(factsOf(p), p.goal, marathon, estimateForm);
      const r = plan(state, p.goal, marathon);
      if (r.ok) bad.push(...raceNoteSource(p.id, r.doc, renderPlan(r.doc, state, marathon)));
    }
    expect(bad).toEqual([]);
  });
});

describe('krug 10 — stavka 7: oznake faza u ispisu (marathon)', () => {
  it('faza se ne vraća unazad (red prvog pojavljivanja)', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const state = buildState(factsOf(p), p.goal, marathon, estimateForm);
      const r = plan(state, p.goal, marathon);
      if (!r.ok) continue;
      const phases = renderPlan(r.doc, state, marathon)
        .split('\n')
        .filter((l) => /^\d+\. NEDELJA/.test(l))
        .map((l) => (l.split(' — ')[1] ?? '').split(',')[0] ?? '');
      const order = [...new Set(phases)];
      let at = 0;
      for (const ph of phases) {
        const i = order.indexOf(ph);
        if (i < at) bad.push(`${p.id} ${ph} posle ${order[at] ?? ''}`);
        at = Math.max(at, i);
      }
    }
    expect(bad).toEqual([]);
  });
});
