/* KRUG 9b (poruka organizatora 13. 11.) — opšta pravila motora, provera nad podacima ove distance. */
/* eslint-disable @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan, renderPlan } from '../../engine';
import { afterTestEasy, raceInWindow, smallGrid, taperShape } from '../../engine/testdata/round9b';
import { estimateForm } from '../../fitness';
import { hm } from './index';
import { PROFILES, factsOf } from './testdata/profiles';
import { SCENARIOS } from './testdata/scenarios';

const FORMS = [5100, 6600, 8400];

describe('krug 9b — A10 (a): sužavanje nije naopako i ne izostavlja dan', () => {
  it('profili, mreža i scenariji: nedelja −1 ≤ nedelja −2 ≤ vrh; nedelje −2 i −1 sa svim traženim danima', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const f = factsOf(p);
      const r = plan(buildState(f, p.goal, hm, estimateForm), p.goal, hm);
      if (r.ok) bad.push(...taperShape(p.id, r.doc, f.availability.runDays));
    }
    for (const g of smallGrid(hm.distanceM, FORMS)) {
      const goal = { distanceId: hm.id, raceDate: g.raceDate };
      const r = plan(buildState(g.facts, goal, hm, estimateForm), goal, hm);
      if (r.ok) bad.push(...taperShape(g.label, r.doc, g.runDays));
    }
    for (const s of SCENARIOS) {
      const r: any = s.run();
      bad.push(...taperShape(`s${String(s.no)}`, r.after, r.afterState.availability.runDays));
    }
    expect(bad).toEqual([]);
  }, 60_000);
});

describe('krug 9b — A2: trka u prozoru povratka', () => {
  it('s26 (bol pa trka): dan trke prikazuje trku; 3 dana bez brzog; nema provere forme 14 dana posle', () => {
    const s = SCENARIOS.find((x) => x.no === 26);
    expect(s).toBeDefined();
    const r: any = s!.run();
    expect(raceInWindow('s26', r.after, r.afterState, hm, renderPlan)).toEqual([]);
  });
});

describe('krug 9b — A11: tekst pominje izbačenu proveru forme', () => {
  it('s26 (trka): bar jedna rečenica izmene pominje izostavljenu ili pomerenu proveru forme', () => {
    const s = SCENARIOS.find((x) => x.no === 26);
    expect(s).toBeDefined();
    const r: any = s!.run();
    const has = (r.changes as any[]).some((c) =>
      /Provera forme planirana za|Provera forme je pomerena/.test(String(c.reason))
    );
    expect(has).toBe(true);
  });
});

describe('krug 9b — dan posle provere forme (odluka organizatora umesto A15)', () => {
  it('profili i mreža: dan posle provere je lagano trčanje ≤ 60 % prethodnog dugog', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const r = plan(buildState(factsOf(p), p.goal, hm, estimateForm), p.goal, hm);
      if (r.ok) bad.push(...afterTestEasy(p.id, r.doc, hm));
    }
    for (const g of smallGrid(hm.distanceM, FORMS)) {
      const goal = { distanceId: hm.id, raceDate: g.raceDate };
      const r = plan(buildState(g.facts, goal, hm, estimateForm), goal, hm);
      if (r.ok) bad.push(...afterTestEasy(g.label, r.doc, hm));
    }
    expect(bad).toEqual([]);
  });
});
