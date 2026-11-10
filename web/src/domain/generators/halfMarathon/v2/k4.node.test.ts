/* K4 (hm-v2.14.0) — stavke A i B glavnog trenera, krug 3 (docs/generators-v2/perfection/coach/ROUND-03.md § 3).
   Nezavisno od funkcija konstruktora: brojevi pravila upisani ovde, plan se čita kao trkač (dani, segmenti). */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { beginnerInputs, feelInputs, grid02Inputs } from './testInputs.ts';
import type { HmV2Plan, PlanWeek } from './types.ts';

const gen = (input: unknown): HmV2Plan => {
  const r = generateHmV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const longOf = (w: PlanWeek) => w.days.find((d) => d.role === 'long');
/** Km u trkačkom tempu na kraju dugog (blok). */
const blockKm = (w: PlanWeek): number =>
  (longOf(w)?.workout.segments ?? []).filter((s) => s.zone === 'RP').reduce((a, s) => a + s.km, 0);

/** P9 p08: srednji, VDOT 45, 3 dana, 45 km, 20 nedelja. */
const P08 = {
  startDate: '2026-11-02',
  raceDate: '2027-03-21',
  runDays: ['tue', 'thu', 'sun'],
  currentWeeklyKm: 45,
  goalTimeSec: null,
  longRunDay: 'sun',
  recentResult: { distanceM: 21097.5, timeSec: 6014, date: '2026-10-19' }
};

describe('K4-A1: 3 dana — blok RP u dugom, kvalitet usred nedelje lagan', () => {
  /** Nedelja sa blokom: specifična, ne-rasteretna, bez dana kvaliteta; blok 4/6/8 km na kraju dugog, ≤ 40 % dugog;
      blokovi ne opadaju. Plan ima bar jednu takvu nedelju. */
  const check = (p: HmV2Plan): string[] => {
    const bad: string[] = [];
    const bs: number[] = [];
    for (const w of p.weeks) {
      const b = blockKm(w);
      if (b === 0) continue;
      bs.push(b);
      if (w.phase !== 'specific' || w.deload) bad.push(`ned ${w.index}: blok van specifične`);
      if (w.days.some((d) => d.workout.kind === 'quality'))
        bad.push(`ned ${w.index}: kvalitet uz blok`);
      if (![4, 6, 8].includes(b)) bad.push(`ned ${w.index}: blok ${b}`);
      const seg = longOf(w)!.workout.segments;
      if (seg[seg.length - 1]!.zone !== 'RP') bad.push(`ned ${w.index}: blok nije na kraju`);
      if (b > 0.4 * longOf(w)!.workout.km + 1e-9) bad.push(`ned ${w.index}: blok > 40 %`);
    }
    if (bs.length === 0) bad.push('bez nedelje sa blokom');
    for (let k = 1; k < bs.length; k++) if (bs[k]! < bs[k - 1]!) bad.push('blok opada');
    return bad;
  };

  it('p08: dve nedelje sa blokom, bez kvaliteta usred nedelje', () => {
    const p = gen(P08);
    expect(check(p)).toEqual([]);
    expect(p.weeks.filter((w) => blockKm(w) > 0).length).toBe(2);
  });

  it('uzorak mreža 02 i 03, 3 dana (svaki 5.): svaki plan ima blok, 0 prekršaja', () => {
    const bad: string[] = [];
    const three = [...grid02Inputs(), ...feelInputs()].filter((c) => c.days === 3);
    for (const c of three.filter((_, i) => i % 5 === 0))
      for (const x of check(gen(c.input))) bad.push(`${c.id}: ${x}`);
    expect(bad).toEqual([]);
  });
});

describe('K4-A2: talas dugog (3 dana)', () => {
  const l10 = (w: PlanWeek): number => Math.round((longOf(w)?.workout.km ?? 0) * 10);
  const build = (p: HmV2Plan): PlanWeek[] =>
    p.weeks.filter((w) => !w.deload && ['base', 'development', 'specific'].includes(w.phase));
  /** Najduži dugi: najviše 3 puta (osim nedelja sa blokom), nikad > 3 ne-rasteretne zaredom; nedelja sa kraćim dugim
      zbog talasa ≤ ⌊0,85 × najduži⌋; poslednja ne-rasteretna pred taper je na plafonu. */
  const check = (p: HmV2Plan): string[] => {
    const bad: string[] = [];
    const top = Math.max(...p.weeks.map(l10));
    const nd = build(p);
    if (nd.filter((w) => l10(w) === top && blockKm(w) === 0).length > 3)
      bad.push('plafon > 3 puta');
    let r = 0;
    for (const w of nd) {
      r = l10(w) === top ? r + 1 : 0;
      if (r > 3) bad.push(`ned ${w.index}: plafon > 3 zaredom`);
    }
    for (const w of nd)
      if (
        w.notes.some((n) => n.startsWith('Talas dugog')) &&
        l10(w) > Math.floor(0.85 * top + 1e-9)
      )
        bad.push(`ned ${w.index}: talas ${l10(w) / 10}`);
    if (l10(nd[nd.length - 1]!) !== top) bad.push('poslednja pred taper nije na plafonu');
    return bad;
  };

  it('p08: 24 km tri puta (nedelje 12, 15, 18), između 20,4 km', () => {
    const p = gen(P08);
    expect(check(p)).toEqual([]);
    expect(p.weeks.filter((w) => l10(w) === 240).map((w) => w.index)).toEqual([12, 15, 18]);
    expect([14, 16].map((i) => l10(p.weeks[i - 1]!))).toEqual([204, 204]);
  });

  it('uzorak mreža 02 i 03, 3 dana (svaki 5.) sa talasom: 0 prekršaja', () => {
    const bad: string[] = [];
    let waved = 0;
    const three = [...grid02Inputs(), ...feelInputs()].filter((c) => c.days === 3);
    for (const c of three.filter((_, i) => i % 5 === 0)) {
      const p = gen(c.input);
      if (!p.weeks.some((w) => w.notes.some((n) => n.startsWith('Talas dugog')))) continue;
      waved++;
      for (const x of check(p)) bad.push(`${c.id}: ${x}`);
    }
    expect(bad).toEqual([]);
    expect(waved).toBeGreaterThan(300);
  });
});

describe('K4-B: kratak lagan dan — „odmor ili 20 min lagano po želji"', () => {
  const OPT = 'Kratak lagan dan';
  const build = (w: PlanWeek): boolean =>
    !w.deload && ['base', 'development', 'specific'].includes(w.phase);
  /** Nedelja sa danom „po želji": jedan dan trčanja manje, planirano ≤ cilj, manjak ≤ 30 min laganog, nedelja ≥ minimum;
      plan nosi rečenicu u napomeni. Plan bez tih nedelja nema lagan < 30 min u više od 2 nedelje izgradnje osim kad bi
      nedelja pala ispod minimuma. */
  const check = (p: HmV2Plan): string[] => {
    const bad: string[] = [];
    const n = p.input.runDays.length;
    const opt = p.weeks.filter((w) => w.notes.some((x) => x.startsWith(OPT)));
    for (const w of opt) {
      if (!build(w)) bad.push(`ned ${w.index}: van izgradnje`);
      if (w.days.length > n - 1) bad.push(`ned ${w.index}: ${w.days.length} dana`);
      if (w.plannedKm > w.targetKm + 0.1 + 1e-9) bad.push(`ned ${w.index}: planirano > cilj`);
      if (w.targetKm - w.plannedKm > 1800 / p.paces.E.fast + 1e-9)
        bad.push(`ned ${w.index}: manjak`);
    }
    if (opt.length > 0 && !p.notes.some((x) => x.includes('po želji')))
      bad.push('bez napomene plana');
    return bad;
  };

  it('p06 (5 dana, 35 km, 10 ned): lagan < 30 min najviše 2 nedelje, 6 nedelja sa danom po želji', () => {
    const P06 = {
      startDate: '2026-11-02',
      raceDate: '2027-01-10',
      runDays: ['mon', 'tue', 'thu', 'sat', 'sun'],
      currentWeeklyKm: 35,
      goalTimeSec: null,
      longRunDay: 'sun',
      recentResult: { distanceM: 21097.5, timeSec: 4828, date: '2026-10-19' }
    };
    for (const input of [P06]) {
      const p = gen(input);
      expect(check(p)).toEqual([]);
      const short = p.weeks.filter(
        (w) => build(w) && w.days.some((d) => d.role === 'easy' && d.workout.sec < 1800)
      );
      expect(short.length).toBeLessThanOrEqual(2);
      expect(p.weeks.filter((w) => w.notes.some((x) => x.startsWith(OPT))).length).toBe(6);
    }
  });

  it('uzorak mreža 02, 03 i početnika (svaki 7.): 0 prekršaja; pravilo pogađa planove', () => {
    const bad: string[] = [];
    let hit = 0;
    for (const c of [...grid02Inputs(), ...feelInputs(), ...beginnerInputs()].filter(
      (_, i) => i % 7 === 0
    )) {
      const p = gen(c.input);
      if (p.weeks.some((w) => w.notes.some((x) => x.startsWith(OPT)))) hit++;
      for (const x of check(p)) bad.push(`${c.id}: ${x}`);
    }
    expect(bad).toEqual([]);
    expect(hit).toBeGreaterThan(300);
  });
});
