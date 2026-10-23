/* Segment 08e (5k-v2.7.0): Odluka 9 — redovno rasterećenje odmah posle nedelje smanjenja otpada (steps.framesFor,
   jedino mesto; konstrukcija i poruka čitaju isti `dropped`) — i P2: konstruktor ne sastavlja ono što validator
   odbije (VOLUME_GROWTH: provera rasta čita donju granicu volume.adaptFloorKm; WEEK_MIN_VOLUME: u nedelji sa danima
   bola minimum važi za cilj). Mreže (segment08e.harness.node.test.ts): uska pretraga organizatora (pun nivo: ovde),
   šira „rana adaptacija" (pun nivo: segment08e.2.full.node.test.ts; brz: ovde, nedelje 1–3). Primeri iz izveštaja,
   granica niza, prinudno rasterećenje, nov start, višak + bol, korak sačuvan pre 5k-v2.7.0, P2. */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { raceTimeForVdot } from './paces.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { basesOf, describeReliefGrid } from './segment08e.harness.node.test.ts';
import { framesFor, reducedWeeks, reliefMaxRun, targetReducedWeek } from './steps.ts';
import { painFacts, reliefFacts, type ReliefScenario } from './testInputs.ts';
import type { AdaptResult, AdaptStep, FiveKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

describeReliefGrid(
  'mreža „rasterećenje posle smanjenja" (uska pretraga: 60 planova × asOf kraj ned i kraj − 3, w = 1 … N − 2 × 6 scenarija = 5952 toka)',
  'narrow'
);
if (!FULL)
  describeReliefGrid(
    'mreža „rana adaptacija" (šira pretraga, brz nivo: nedelje 1–3, asOf sreda i kraj ned × 11 scenarija)',
    'wide'
  );

const ok = (r: unknown): Extract<AdaptResult, { ok: true }> => {
  const x = r as AdaptResult;
  if (!x.ok) throw new Error(JSON.stringify(x).slice(0, 1500));
  return x;
};
const planOf = (id: string): FiveKV2Plan =>
  basesOf('narrow').find((b) => b.id === id)!.plan as FiveKV2Plan;
const run = (id: string, asOf: string, s: ReliefScenario) => {
  const p = planOf(id);
  return ok(adaptFiveKV2(p, reliefFacts(p, s, asOf, raceTimeForVdot), asOf));
};
const run2 = (p: FiveKV2Plan, facts: unknown, asOf: string) => ok(adaptFiveKV2(p, facts, asOf));
/** [cilj, rasterećenje] nedelja from…to. */
const rows = (p: FiveKV2Plan, from: number, to: number) =>
  p.weeks.slice(from - 1, to).map((w) => [w.targetKm, w.deload]);
const text = (r: Extract<AdaptResult, { ok: true }>, c: string): string =>
  r.reasons.find((x) => x.condition === c)?.message ?? '';
const RELIEF = (w: number) =>
  `Redovno rasterećenje u nedelji ${w} otpada: nedelja ${w - 1} je smanjena.`;

describe('Odluka 9: primeri (v45-d4-22km-14w, asOf kraj ned 2; 5k-v2.6.1 → 5k-v2.7.0)', () => {
  it('bazni plan: rasterećenja ned 4 i 8; granica niza = najduži niz generatora + 1: 6 (plan od 11 ned: 5), početnik 4', () => {
    expect(
      planOf('v45-d4-22km-14w')
        .weeks.filter((w) => w.deload)
        .map((w) => w.index)
    ).toEqual([4, 8]);
    expect([reliefMaxRun(P.volume.deloadEvery), reliefMaxRun(P.beginner.deloadEvery)]).toEqual([
      6, 4
    ]);
  });

  it('pauza 10: ned 4 rasterećenje 14,1 → 19,3 (povratni rast od cilja pauze 17,6); ned 8 ostaje rasterećenje', () => {
    const r = run('v45-d4-22km-14w', '2026-11-15', 'pause10');
    expect(rows(r.plan, 3, 9)).toEqual([
      [17.6, false],
      [19.3, false],
      [21.2, false],
      [22.8, false],
      [24.6, false],
      [19.7, true],
      [26.5, false]
    ]);
    expect(text(r, 'PAUSE')).toContain(RELIEF(4));
    expect(r.plan.adaptation!.steps.at(-1)!.reduced).toBe(true);
    expect(r.changes).toContainEqual({ week: 4, field: 'deload', before: 'true', after: 'false' });
  });

  it('bol 5: ned 4 rasterećenje 12,3 → 16,9 (od osnove povratka); manjak: 16,3 → 22,0', () => {
    const pain = run('v45-d4-22km-14w', '2026-11-15', 'pain5');
    expect(rows(pain.plan, 3, 5)).toEqual([
      [25.5, false],
      [16.9, false],
      [18.5, false]
    ]);
    expect(text(pain, 'PAIN')).toContain(RELIEF(4));
    expect(pain.plan.adaptation!.steps.at(-1)!.reduced).toBeUndefined();
    const under = run('v45-d4-22km-14w', '2026-11-15', 'missed');
    expect(rows(under.plan, 3, 5)).toEqual([
      [20.4, false],
      [22, false],
      [23.7, false]
    ]);
    expect(text(under, 'UNDER_EXECUTION')).toContain(RELIEF(4));
  });

  it('pauza + bol (asOf četvrtak ned 2): nedelja smanjenja 3 (pauza) i 2 (sidro bola) — jedna rečenica, uz pauzu', () => {
    const r = run('v45-d4-22km-14w', '2026-11-12', 'pause10pain5');
    const st = r.plan.adaptation!.steps.at(-1)!;
    expect([st.firstWeek, st.fromWeek, st.returnFrom?.week]).toEqual([2, 3, 2]);
    expect(reducedWeeks(st)).toEqual([3, 2]);
    expect(r.plan.weeks[3]!.deload).toBe(false);
    expect(text(r, 'PAUSE')).toContain(RELIEF(4));
    expect(text(r, 'PAIN')).not.toContain('otpada');
  });

  it('primer organizatora: v45-d3-15km-10w kraj ned 1, pauza 10 — ned 3 13,2 (5k-v2.12.0: bez rasterećenja pre ned 4)', () => {
    const r = run('v45-d3-15km-10w', '2026-11-08', 'pause10');
    expect(rows(r.plan, 2, 4)).toEqual([
      [12, false],
      [13.2, false],
      [14.5, false]
    ]);
    // 5k-v2.12.0 (T4): plan trkača nema rasterećenja u ned 3 (prvo je ned 5) — nema šta da otpadne.
    expect(text(r, 'PAUSE')).not.toContain(RELIEF(3));
  });

  it('granica: niz od ukinute nedelje bio bi > 6 → rasterećenje ostaje (sintetički koraci; u mrežama 0 tokova)', () => {
    // d5-60km-16w-v58: rasterećenja 4, 7, 11. Korak bola sa sidrom 6 ukida ned 7 (niz 7–10 = 4); korak sa sidrom 3
    // bi zatim ukinuo ned 4 sa nizom 4–10 = 7 > 6 → ostaje. Obrnut redosled: oba ukinuta (svaki niz meri se od
    // ukinute nedelje napred: 4–6 = 3, 7–10 = 4).
    const p = basesOf('narrow').find((b) => b.id === 'd5-60km-16w-v58')!.plan as FiveKV2Plan;
    // 5k-v2.12.0 (T4): rasterećenja trkača 4, 8, 12 (bilo 4, 7, 11) — sidra 7 i 3.
    expect(p.weeks.filter((w) => w.deload).map((w) => w.index)).toEqual([4, 8, 12]);
    const pain = (r: number): AdaptStep => ({
      asOf: p.weeks[r - 1]!.endDate,
      firstWeek: r + 1,
      fromWeek: r + 1,
      result: null,
      vdot: null,
      startKm: null,
      pauseRemainder: false,
      restart: false,
      deload: false,
      noQuality: [],
      oneQuality: [],
      rest: null,
      pain: null,
      orientation: false,
      levelKm: 40,
      returnFrom: { week: r, share: 0.7 }
    });
    const deloads = (steps: AdaptStep[]) => {
      const dropped = new Map<number, number>();
      const fr = framesFor(p.input, steps, p.pattern, p.weeks.length, dropped);
      return [fr.filter((f) => f.deload).map((f) => f.index), [...dropped]];
    };
    expect(deloads([pain(7), pain(3)])).toEqual([[4, 12], [[8, 0]]]);
    expect(deloads([pain(3), pain(7)])).toEqual([
      [12],
      [
        [4, 0],
        [8, 1]
      ]
    ]);
  });

  it('kontrolno trčanje (po osećaju): postojeće premeštanje — feel-d4-22km-12w bol 5 kraj ned 2: test iz ned 3 (dani bola) na ned 4 (5k-v2.6.1: ned 5, ned 4 je bila rasterećenje)', () => {
    const before = planOf('feel-d4-22km-12w');
    expect(before.weeks.find((w) => w.test)!.index).toBe(3);
    const r = run('feel-d4-22km-12w', '2026-11-15', 'pain5');
    expect(r.plan.weeks[3]!.deload).toBe(false);
    expect(r.plan.weeks.filter((w) => w.test).map((w) => w.index)).toEqual([4]);
  });
});

describe('Odluka 9: šta se ne ukida', () => {
  it('prinudno rasterećenje (umor) se nikad ne ukida: umor + bol u istom koraku (asOf sreda ned 2) — prinudno rasterećenje (ned 2, pouka 36) ostaje', () => {
    const p = planOf('v45-d4-22km-14w');
    const asOf = '2026-11-11';
    const fat = reliefFacts(p, 'fatigue', asOf, raceTimeForVdot)!;
    const facts = {
      ...fat,
      workouts: [
        ...(fat['workouts'] as unknown[]),
        ...(painFacts(asOf, 5)['workouts'] as unknown[])
      ]
    };
    const r = run2(p, facts, asOf);
    const st = r.plan.adaptation!.steps.at(-1)!;
    // 2.8.0 (pouka 36, precizno): zapisi umora su iz ned 1 → prinudno rasterećenje je ned 2 (ostatak od asOf + 1,
    // deloadWeek), sidro bola r = 2; prinudno rasterećenje ostaje (ne ukida ga ni Odluka 9).
    expect([st.deload, st.fromWeek, st.deloadWeek, st.returnFrom?.week]).toEqual([true, 3, 2, 2]);
    expect(rows(r.plan, 2, 3).map((x) => x[1])).toEqual([true, false]);
    expect(r.reasons.map((x) => x.message).join(' ')).not.toContain('otpada');
  });

  it('nov start (pauza 35 + bol, beg-feel-d3-12km-10w, asOf 2026-11-18) se ne računa: rasterećenje ned 5 ostaje', () => {
    const p = basesOf('narrow').find((b) => b.id === 'beg-feel-d3-12km-10w')!.plan as FiveKV2Plan;
    const asOf = '2026-11-18';
    const r = run2(
      p,
      { ...painFacts(asOf, 5), breaks: [{ kind: 'break', from: addDays(asOf, -34), to: asOf }] },
      asOf
    );
    const st = r.plan.adaptation!.steps.at(-1)!;
    expect([st.restart, st.reduced, st.fromWeek, st.returnFrom?.week]).toEqual([true, true, 4, 3]);
    expect(reducedWeeks(st)).toEqual([]);
    expect(targetReducedWeek(st)).toBeNull();
    // Raspored novog starta: rasterećenja 3 i 5; niz od ned 5 do kraja izgradnje (7) = 3 ≤ 3 — ukinulo bi se da se
    // nov start računa.
    expect(r.plan.weeks.filter((w) => w.deload).map((w) => w.index)).toEqual([3, 5]);
  });

  it('višak + bol u istom koraku (asOf sreda ned 2): reduced = false — ned 4 ostaje rasterećenje (cilj viška nije smanjenje)', () => {
    const p = planOf('v45-d4-22km-14w');
    const asOf = '2026-11-11';
    const over = reliefFacts(p, 'over', asOf, raceTimeForVdot)!;
    const facts = {
      ...over,
      workouts: [
        ...(over['workouts'] as unknown[]),
        ...(painFacts(asOf, 5)['workouts'] as unknown[])
      ]
    };
    const r = run2(p, facts, asOf);
    const st = r.plan.adaptation!.steps.at(-1)!;
    expect([st.reduced, st.fromWeek, st.returnFrom?.week]).toEqual([false, 3, 2]);
    expect(reducedWeeks(st)).toEqual([2]);
    expect(r.plan.weeks[3]!.deload).toBe(true);
  });
});

describe('korak sačuvan pre 5k-v2.7.0 (bez polja reduced): rezervni put — cilj koraka uz nivo pre smanjenja', () => {
  const strip = (p: FiveKV2Plan): FiveKV2Plan => {
    const q = JSON.parse(JSON.stringify(p)) as FiveKV2Plan;
    for (const s of q.adaptation!.steps) delete (s as Partial<AdaptStep>).reduced;
    return q;
  };

  it('pauza: ponovna adaptacija bez novih činjenica i dalje ukida ned 4 (isti plan budućnosti)', () => {
    const r1 = run('v45-d4-22km-14w', '2026-11-15', 'pause10');
    const old = strip(r1.plan);
    expect(targetReducedWeek(old.adaptation!.steps[0]!)).toBe(3);
    const r2 = run2(old, {}, '2026-11-16');
    expect(r2.plan.weeks[3]!.deload).toBe(false);
    expect(JSON.stringify(r2.plan.weeks.slice(3))).toBe(JSON.stringify(r1.plan.weeks.slice(3)));
  });

  it('višak + bol (ograničenje, kao 10K § 9.2): stari korak se ne može razlikovati od manjka — ned 4 se ukida', () => {
    const p = planOf('v45-d4-22km-14w');
    const asOf = '2026-11-11';
    const over = reliefFacts(p, 'over', asOf, raceTimeForVdot)!;
    const facts = {
      ...over,
      workouts: [
        ...(over['workouts'] as unknown[]),
        ...(painFacts(asOf, 5)['workouts'] as unknown[])
      ]
    };
    const old = strip(run2(p, facts, asOf).plan);
    const st = old.adaptation!.steps[0]!;
    expect([st.startKm !== null, st.levelKm !== null]).toEqual([true, true]);
    expect(targetReducedWeek(st)).toBe(3);
    const r2 = run2(old, {}, '2026-11-12');
    expect(r2.plan.weeks[3]!.deload).toBe(false);
    // Višak bez bola (levelKm null) se prepoznaje i u starom koraku.
    expect(targetReducedWeek({ ...st, levelKm: null })).toBeNull();
  });
});

describe('P2 (odluka 2): konstruktor ne sastavlja ono što validator odbije', () => {
  it('VOLUME_GROWTH: beg-feel-d4-15km-10w bol 5 kraj ned 1 — osnova 10,5, ned 3–4 = donja granica 12 (4 × 3 km): prihvaćeno', () => {
    const r = run('beg-feel-d4-15km-10w', '2026-11-08', 'pain5');
    expect(rows(r.plan, 2, 5)).toEqual([
      [15.7, false],
      [12, false],
      [13.2, false],
      [12, true]
    ]);
    expect(text(r, 'PAIN')).toContain(
      'Posle nedelje 2 rast kreće od 70% nivoa pre bola (10,5 km).'
    );
    expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
  });

  it('VOLUME_DELOAD: pauza 20, asOf sreda nedelje rasterećenja — ostatak nedelje = cilj pauze (volume.pauseRemainderKm) < 0,8 × prethodne: prihvaćeno (3 toka)', () => {
    const cases: [string, string, number, number, number][] = [
      ['v38-d4-38km-10w', '2026-12-02', 5, 29.9, 26.2], // 5k-v2.12.0 (T4): rasterećenje ned 5 (bilo 3)
      ['v38-d4-38km-14w', '2026-11-25', 4, 29.9, 26.2],
      ['v45-d4-38km-14w', '2026-12-23', 8, 33, 28.9]
    ];
    for (const [id, asOf, week, before, after] of cases) {
      const p = basesOf('narrow').find((b) => b.id === id)!.plan as FiveKV2Plan;
      expect([p.weeks[week - 1]!.deload, p.weeks[week - 1]!.targetKm], id).toEqual([true, before]);
      const r = run(id, asOf, 'pause20');
      const st = r.plan.adaptation!.steps.at(-1)!;
      expect([st.firstWeek, st.fromWeek, st.pauseRemainder, st.startKm], id).toEqual([
        week,
        week + 1,
        true,
        after
      ]);
      const w = r.plan.weeks[week - 1]!;
      expect([w.deload, w.targetKm], id).toEqual([true, after]);
      expect(after / p.weeks[week - 2]!.targetKm, id).toBeLessThan(P.volume.deloadFactor - 0.05);
      // 5k-v2.12.0: v38-d4-38km-10w (rasterećenje ned 5, T4) je i mešovita nedelja (upisani dani do asOf ≠ sastavljeni);
      // vlasnik ostatka je i dalje pravilo pauze (pauseRemainder), validator bez greške.
      if (id !== 'v38-d4-38km-10w') expect(r.plan.adaptation!.mixedWeeks, id).not.toContain(week);
      expect(
        validatePlan(r.plan).filter((v) => v.severity === 'error'),
        id
      ).toEqual([]);
    }
  });

  it('WEEK_MIN_VOLUME: beg-feel-d3-12km-10w pauza 10 + bol 5 kraj ned 8 — ned 9 cilj 7,5 = minimum, planirano 7,3 zbog dana bola: upozorenje', () => {
    const r = run('beg-feel-d3-12km-10w', '2026-12-27', 'pause10pain5');
    const w9 = r.plan.weeks[8]!;
    expect([w9.targetKm, w9.plannedKm]).toEqual([7.5, 7.3]);
    expect(r.plan.warnings).toContainEqual({
      rule: 'PLANNED_BELOW_TARGET_LIMITS',
      severity: 'warning',
      message: 'Planirano 7,3 km < cilj obima 7,5 km (odmor/bol, adaptacija).',
      week: 9
    });
    // Cilj ispod minimuma ostaje greška konstruktora.
    const low = JSON.parse(JSON.stringify(r.plan)) as FiveKV2Plan;
    low.weeks[8]!.targetKm = 7.2;
    expect(validatePlan(low).map((v) => v.rule)).toContain('WEEK_MIN_VOLUME');
  });
});
