/* KRUG 9b (poruka organizatora 13. 11.) — opšta pravila motora, provera nad podacima ove distance. */
/* eslint-disable @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan, renderPlan } from '../../engine';
import {
  forecastReacts,
  raceInWindow,
  returnWindow,
  smallGrid,
  taperShape
} from '../../engine/testdata/round9b';
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
  });
});

describe('krug 9b — A10 (b): povratak posle prekida ne traje do trke', () => {
  it('bolest (E2): posle 2 × trajanje + 7 dana (≤ 3 nedelje) plan je prvobitan ili srazmerno niži uz rečenicu', () => {
    const bad: string[] = [];
    let lowered = 0;
    for (const s of SCENARIOS.filter((x) => x.title.startsWith('E2'))) {
      const r: any = s.run();
      bad.push(...returnWindow(`s${String(s.no)}`, r.before, r.after, r.changes));
      if ((r.changes as any[]).some((c) => String(c.reason).includes('srazmerno niži')))
        lowered += 1;
    }
    expect(bad).toEqual([]);
    expect(lowered).toBeGreaterThan(0);
  });
});

describe('krug 9b — A17: očekivano vreme reaguje na izgubljen obim', () => {
  it('bolest (E2): kad je obim do trke ≥ 15 % manji, prognoza nije brža i ima rečenicu zašto', () => {
    const bad: string[] = [];
    let reacted = 0;
    for (const s of SCENARIOS.filter((x) => x.title.startsWith('E2'))) {
      const r: any = s.run();
      const out = forecastReacts(`s${String(s.no)}`, r.before, r.after, r.changes);
      bad.push(...out);
      if ((r.changes as any[]).some((c) => String(c.reason).includes('očekivani napredak manji')))
        reacted += 1;
    }
    expect(bad).toEqual([]);
    expect(reacted).toBeGreaterThan(0);
  });
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
  it('s26 (trka): bar jedna rečenica izmene pominje izostavljenu proveru forme', () => {
    const s = SCENARIOS.find((x) => x.no === 26);
    expect(s).toBeDefined();
    const r: any = s!.run();
    const has = (r.changes as any[]).some((c) =>
      String(c.reason).includes('Provera forme planirana za')
    );
    expect(has).toBe(true);
  });
});
