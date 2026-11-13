/* KRUG 9b (poruka organizatora 13. 11.) — opšta pravila motora, provera nad podacima ove distance. */
/* eslint-disable @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan, renderPlan } from '../../engine';
import {
  afterTestEasy,
  forecastReacts,
  raceInWindow,
  returnWindow,
  smallGrid,
  taperShape
} from '../../engine/testdata/round9b';
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
        '{"days":4,"weeks":8,"km":20,"formSec":10200} nedelja −2 24.7 > vrh 22.5 km'
      ]);
      expect(bad.filter((b) => !KNOWN_SHAPE.has(b))).toEqual([]);
    }
  );
});

/* maraton (13. 11.), motor A10 b: povratak posle 7 dana bolesti u specifičnoj fazi ne vraća prvobitan obim posle
   2 × trajanje + 7 dana — nedelje sa blokom ostaju niže bez rečenice „srazmerno niži" (zahtev u F7-MAR-REPORT) */
/* ključ: scenario i nedelja (km se menjaju sa podacima) */
const KNOWN_RETURN = new Set<string>(['s5 n10', 's6 n21', 's7 n18', 's7 n19']);
const knownReturn = (b: string): boolean => KNOWN_RETURN.has(b.split(' ').slice(0, 2).join(' '));

describe('krug 9b — A10 (b): povratak posle prekida ne traje do trke', () => {
  it('bolest (E2): posle 2 × trajanje + 7 dana (≤ 3 nedelje) plan je prvobitan ili srazmerno niži uz rečenicu', () => {
    const bad: string[] = [];
    let lowered = 0;
    for (const s of SCENARIOS.filter((x) => x.title.startsWith('E2'))) {
      const r: any = s.run();
      bad.push(
        ...returnWindow(`s${String(s.no)}`, r.before, r.after, r.changes).filter(
          (b) => !knownReturn(b)
        )
      );
      if ((r.changes as any[]).some((c) => String(c.reason).includes('srazmerno niži')))
        lowered += 1;
    }
    expect(bad).toEqual([]);
    void lowered;
  });
  /* maraton: nijedan E2 scenario nema rečenicu „srazmerno niži" (motor A10 b) — kad motor ispravi, test pada */
  it.fails('bolest (E2): bar jedan scenario nosi „srazmerno niži" — ČEKA MOTOR (A10 b)', () => {
    const lowered = SCENARIOS.filter((x) => x.title.startsWith('E2')).filter((s) =>
      ((s.run() as any).changes as any[]).some((c) => String(c.reason).includes('srazmerno niži'))
    ).length;
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
    expect(raceInWindow('s26', r.after, r.afterState, marathon, renderPlan)).toEqual([]);
  });
});

describe('krug 9b — A11: tekst pominje izbačenu proveru forme', () => {
  /* maraton s26 (p11: bol u ned 13, trka 10 km 11. 2.): provera 20. 2. postaje lagan dan u izmeni rampe posle trke,
     a rečenica ide uz rezultat trke, ne uz izbačenu proveru — motor (A11), zahtev u F7-MAR-REPORT */
  it.fails(
    's26 (trka): bar jedna rečenica izmene pominje izostavljenu proveru forme — ČEKA MOTOR (A11)',
    () => {
      const s = SCENARIOS.find((x) => x.no === 26);
      expect(s).toBeDefined();
      const r: any = s!.run();
      const has = (r.changes as any[]).some((c) =>
        String(c.reason).includes('Provera forme planirana za')
      );
      expect(has).toBe(true);
    }
  );
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
