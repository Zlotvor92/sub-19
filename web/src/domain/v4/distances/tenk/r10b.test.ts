/* KRUG 10 (stavke 6 i 9): napomena za dan trke — jedan izvor tempa, poslednja provera forme. */
import { describe, expect, it } from 'vitest';
import { buildState, paceCtxOf, plan, renderPlan } from '../../engine';
import { weekCost } from '../../engine/guard';
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

describe('krug 10 — stavka 7: oznake faza u ispisu (tenk)', () => {
  it('faza se ne vraća unazad (red prvog pojavljivanja)', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const state = buildState(factsOf(p), p.goal, tenk, estimateForm);
      const r = plan(state, p.goal, tenk);
      if (!r.ok) continue;
      const phases = renderPlan(r.doc, state, tenk)
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

describe('krug 10 — stavka 18: vrh ispod sadašnjeg obima samo uz rečenicu (tenk)', () => {
  it('najveća nedelja < sadašnji obim − 1 km (bez bola/povratka) ⇒ upozorenje vrh-ispod-obima', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const state = buildState(factsOf(p), p.goal, tenk, estimateForm);
      const r = plan(state, p.goal, tenk);
      if (!r.ok) continue;
      const h = r.doc.header;
      const ctx = paceCtxOf(h);
      const baseKm = (h.decisions.baseLoad * 60) / ctx.paces.easy;
      const peak = Math.max(
        0,
        ...r.doc.weeks
          .filter((w) => w.intent.kind !== 'race')
          .map((w) => weekCost(w, h.goal.raceDate, ctx).km)
      );
      const back = h.decisions.painCaution === true || (h.adjustments ?? []).length > 0;
      if (!back && peak < baseKm - 1 && !h.warnings.some((w) => w.code === 'vrh-ispod-obima'))
        bad.push(`${p.id} vrh ${peak.toFixed(1)} < ${baseKm.toFixed(1)} bez rečenice`);
    }
    expect(bad).toEqual([]);
  });
});
