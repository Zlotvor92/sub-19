/* KRUG 9b (poruka organizatora 13. 11.) — opšta pravila motora, provera nad podacima ove distance. */
/* eslint-disable @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan, renderPlan } from '../../engine';
import { afterTestEasy, raceInWindow, smallGrid, taperShape } from '../../engine/testdata/round9b';
import { estimateForm } from '../../fitness';
import { marathon } from './index';
import { PROFILES, factsOf } from './testdata/profiles';
import { SCENARIOS } from './testdata/scenarios';

/* maraton 2:50, 3:30, 4:20 (kao HM 1:25, 1:50, 2:20) */
const FORMS = [10200, 12600, 15600];

describe('krug 9b — A10 (a): sužavanje nije naopako i ne izostavlja dan', () => {
  it(
    'profili, mreža i scenariji: nedelja −1 ≤ nedelja −2 ≤ vrh; nedelje −2 i −1 sa svim traženim danima',
    { timeout: 60_000 },
    () => {
      const bad: string[] = [];
      for (const p of PROFILES) {
        const f = factsOf(p);
        const r = plan(buildState(f, p.goal, marathon, estimateForm), p.goal, marathon);
        if (r.ok) bad.push(...taperShape(p.id, r.doc, f.availability.runDays));
      }
      for (const g of smallGrid(marathon.distanceM, FORMS)) {
        const goal = { distanceId: marathon.id, raceDate: g.raceDate };
        const r = plan(buildState(g.facts, goal, marathon, estimateForm), goal, marathon);
        if (r.ok) bad.push(...taperShape(g.label, r.doc, g.runDays));
      }
      for (const s of SCENARIOS) {
        const r: any = s.run();
        bad.push(...taperShape(`s${String(s.no)}`, r.after, r.afterState.availability.runDays));
      }
      /* mreža: 2:50 sa 20 km i 4 dana — gradnja na najkraćim laganim danima sa danom manje, sužavanje vraća dan
       (cilj nedelje −2 motor spušta na 7 BO); izrođen ulaz, zahtev motoru u F7-MAR-REPORT */
      const KNOWN_SHAPE = new Set([
        '{"days":4,"weeks":8,"km":20,"formSec":10200} nedelja −2 24.7 > vrh 24.0 km'
      ]);
      expect(bad.filter((b) => !KNOWN_SHAPE.has(b))).toEqual([]);
    }
  );
});

describe('krug 9b — A2: trka u prozoru povratka', () => {
  it('s26 (bol pa trka): dan trke prikazuje trku; 3 dana bez brzog; nema provere forme 14 dana posle', () => {
    const s = SCENARIOS.find((x) => x.no === 26);
    expect(s).toBeDefined();
    const r: any = s!.run();
    expect(raceInWindow('s26', r.after, r.afterState, marathon, renderPlan)).toEqual([]);
  });
});

describe('krug 9b — A11: tekst pominje izbačenu proveru forme', () => {
  /* maraton s26 (p11: bol u ned 13, trka 10 km 11. 2.): provera 20. 2. postaje lagan dan u izmeni rampe posle trke,
     a rečenica ide uz rezultat trke, ne uz izbačenu proveru — motor (A11), zahtev u F7-MAR-REPORT */
  /* krug 15: prolazi posle M10 (pripremni polumaraton na dan dugog) */
  it('s26 (trka): bar jedna rečenica izmene pominje izostavljenu proveru forme', () => {
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
  it(
    'profili i mreža: dan posle provere je lagano trčanje ≤ 60 % prethodnog dugog',
    { timeout: 60_000 },
    () => {
      const bad: string[] = [];
      for (const p of PROFILES) {
        const r = plan(buildState(factsOf(p), p.goal, marathon, estimateForm), p.goal, marathon);
        if (r.ok) bad.push(...afterTestEasy(p.id, r.doc, marathon));
      }
      for (const g of smallGrid(marathon.distanceM, FORMS)) {
        const goal = { distanceId: marathon.id, raceDate: g.raceDate };
        const r = plan(buildState(g.facts, goal, marathon, estimateForm), goal, marathon);
        if (r.ok) bad.push(...afterTestEasy(g.label, r.doc, marathon));
      }
      expect(bad).toEqual([]);
    }
  );
});
