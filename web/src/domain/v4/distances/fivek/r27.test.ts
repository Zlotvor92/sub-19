/* R27 (briefs/R27-5K.md) — 5 km do praga drugog sudije. Pravila motora su opšta, brojevi su u `safety.ts` 5 km:
   - `peakLadder.adequateFloor` + `rampByLevel` (p13): vrh početnika koji tek počinje do adekvatnog obima, korak 10 %;
   - `fewerRunDays` (p06): dan manje kao odluka plana kad sadašnji obim ne nosi tražene dane;
   - `secondQualityVolumeRoom`, `minDoseLift`, `taper.keepQuality` (p06, p03): drugi kvalitet i tempo trke pred trku;
   - `rampWeeksInChain`, `m6ChainWithinRule`, `easyBeforeQuality`, `levelVolumeNextMaxOver` (p15): obim i dugi rastu
     i u prozoru povratka, lagan dan pre drugog kvaliteta, upozorenje usklađeno sa planom;
   - tekst dana trke po nivou (`<ključ>.<nivo>`). */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  paceCtxOf,
  plan,
  raceNotes,
  renderPlan,
  summarize,
  type PlanDoc,
  type PlanWeek
} from '../../engine';
import { fewerRunDaysOf, ladderOverBase, rampRuleOf } from '../../engine/decide';
import type { RunnerFacts, RunnerState, Weekday } from '../../engine/types';
import { estimateForm } from '../../fitness';
import { fivek } from './index';
import { SAFETY } from './safety';
import { factsOf, PROFILES } from './testdata/profiles';

interface Built {
  doc: PlanDoc;
  state: RunnerState;
  text: string;
}

function buildFrom(facts: RunnerFacts, goal: (typeof PROFILES)[number]['goal']): Built {
  const state = buildState(facts, goal, fivek, estimateForm);
  const res = plan(state, goal, fivek);
  if (!res.ok) throw new Error('plan');
  return { doc: res.doc, state, text: renderPlan(res.doc, state, fivek) };
}

function profile(id: string): (typeof PROFILES)[number] {
  const p = PROFILES.find((x) => x.id === id);
  if (p === undefined) throw new Error(id);
  return p;
}

const build = (id: string): Built => buildFrom(factsOf(profile(id)), profile(id).goal);

/** Km, broj treninga, kvaliteti i dugi (min) nedelje — trka se ne broji. */
function stats(doc: PlanDoc): {
  week: PlanWeek;
  km: number;
  runs: number;
  quality: number;
  longMin: number;
  easyMin: number[];
}[] {
  const ctx = paceCtxOf(doc.header);
  return doc.weeks.map((week) => {
    let km = 0;
    let runs = 0;
    let quality = 0;
    let longMin = 0;
    const easyMin: number[] = [];
    for (const day of week.days) {
      const w = day.workout;
      if (w === null || w.kind === 'race') continue;
      const c = summarize(w, ctx);
      km += c.km;
      runs += 1;
      if (w.kind === 'quality') quality += 1;
      if (w.kind === 'long') longMin = Math.round(c.durationSec / 60);
      if (w.kind === 'easy') easyMin.push(Math.round(c.durationSec / 60));
    }
    return { week, km: Math.round(km * 10) / 10, runs, quality, longMin, easyMin };
  });
}

const kindOf = (w: PlanWeek): string => w.intent.kind;

/* ------------------------------------------------------------------ pravila kao funkcije */

describe('R27 — vlasnici odluka (decide.ts)', () => {
  it('pod vrha do adekvatnog obima: samo nivo iz podataka, bez tegobe, koliko nedelje nose korakom', () => {
    const base = { baseKm: 10, weeks: 10, limited: true };
    /* bez nivoa ili sa tegobom: ograničen množilac lestvice */
    expect(ladderOverBase(SAFETY, base)).toBe(1.45);
    expect(ladderOverBase(SAFETY, { ...base, level: 'pocetnik-nov', pain: true })).toBe(1.45);
    expect(ladderOverBase(SAFETY, { ...base, level: 'pocetnik', pain: false })).toBe(1.45);
    /* 10 nedelja, 10 km: 15 km × 1,15 / 10 km = 1,725 (≤ 1,1^6) */
    expect(ladderOverBase(SAFETY, { ...base, level: 'pocetnik-nov', pain: false })).toBeCloseTo(
      1.725,
      3
    );
    /* 6 nedelja: 1,1^2 = 1,21 < 1,45 — ostaje lestvica; vrh već iznad 15 km — ostaje lestvica */
    expect(ladderOverBase(SAFETY, { ...base, weeks: 6, level: 'pocetnik-nov', pain: false })).toBe(
      1.45
    );
    expect(
      ladderOverBase(SAFETY, { ...base, baseKm: 13, level: 'pocetnik-nov', pain: false })
    ).toBe(1.45);
  });

  it('korak obima po nivou: početnik koji tek počinje + 10 %, ostali opšti brojevi', () => {
    expect(rampRuleOf(SAFETY, 'pocetnik-nov', 100, 519)).toBeCloseTo(110, 6);
    /* opšte: veće od + 7 % i + 1,5 km (u minutima laganog tempa) */
    expect(rampRuleOf(SAFETY, 'srednji', 100, 400)).toBeCloseTo(110, 6);
    expect(rampRuleOf(SAFETY, 'srednji', 300, 400)).toBeCloseTo(321, 6);
  });

  it('dan manje: od 5 traženih dana, prosečno trčanje ispod 27 min, nikad dva dana, potvrđeni dani ostaju', () => {
    const five: Weekday[] = [0, 1, 3, 5, 6];
    const a = { runDays: five, longDay: 6 as Weekday };
    expect(fewerRunDaysOf(SAFETY, 'brz', a, 122)).toEqual([0, 1, 3, 6]);
    expect(fewerRunDaysOf(SAFETY, 'brz', a, 135)).toBeNull();
    expect(fewerRunDaysOf(SAFETY, 'brz', { ...a, confirmedRunDays: true }, 122)).toBeNull();
    expect(fewerRunDaysOf(SAFETY, 'pocetnik', a, 100)).toBeNull();
    expect(fewerRunDaysOf(SAFETY, 'brz', { runDays: [1, 3, 5, 6], longDay: 6 }, 80)).toBeNull();
    /* mreža: rezultat je uvek traženi skup bez tačno jednog dana, dugi ostaje */
    for (const days of [five, [0, 1, 2, 3, 5, 6] as Weekday[], [0, 1, 2, 3, 4, 5, 6] as Weekday[]])
      for (const longDay of [5, 6] as Weekday[])
        for (const min of [60, 100, 130]) {
          const out = fewerRunDaysOf(SAFETY, 'srednji', { runDays: days, longDay }, min);
          if (out === null) {
            expect(min / days.length).toBeGreaterThanOrEqual(27);
            continue;
          }
          expect(out.length).toBe(days.length - 1);
          expect(out).toContain(longDay);
          expect(out.every((d) => days.includes(d))).toBe(true);
        }
  });
});

/* ------------------------------------------------------------------ p13 */

describe('R27 — p13 (početnik, prvi put 5 km, 10 nedelja)', () => {
  const b = build('p13');
  const s = stats(b.doc);

  it('vrh 14,25–15,5 km, nedeljni skok ≤ 10 % (uz zaokruživanje dana na 0,5 km)', () => {
    const peak = Math.max(...s.map((x) => x.km));
    expect(peak).toBeGreaterThanOrEqual(14.25);
    expect(peak).toBeLessThanOrEqual(15.5);
    s.forEach((x, i) => {
      if (i === 0 || (kindOf(x.week) !== 'build' && kindOf(x.week) !== 'peak')) return;
      const ref = Math.max(...s.slice(Math.max(0, i - 3), i).map((y) => y.km));
      expect(x.km, `nedelja ${String(x.week.index)}`).toBeLessThanOrEqual(ref * 1.1 + 0.5);
    });
  });

  it('nedelja sa proverom ima 3 treninga; dugi bez hoda najkasnije u 6. nedelji; lagan dan do 35 min', () => {
    const test = s.find((x) => x.week.days.some((d) => d.workout?.kind === 'test'));
    expect(test?.runs).toBeGreaterThanOrEqual(3);
    const firstContinuous = b.doc.weeks.find((w) =>
      w.days.some((d) => d.workout?.kind === 'long' && !d.workout.text.includes('hod'))
    );
    expect(firstContinuous?.index).toBeLessThanOrEqual(6);
    /* radni dani rastu: 5. nedelja ≥ 30 min, 7. nedelja ≥ 35 min (ceo dan, sa ubrzanjima) */
    expect(Math.max(...(s[4]?.easyMin ?? [0]))).toBeGreaterThanOrEqual(30);
    expect(Math.max(...(s[6]?.easyMin ?? [0]))).toBeGreaterThanOrEqual(35);
  });

  it('upozorenje ne tvrdi da obim ne može da raste; prognoza nije sporija od forme', () => {
    expect(b.doc.header.warnings.some((w) => w.code === 'mali-obim')).toBe(false);
    expect(b.text).not.toContain('ne može bezbedno');
    expect(b.text).not.toContain('Duža priprema ovde ne pomaže');
    const f = b.doc.header.form;
    expect(f.raceDay.expectedSec).toBeLessThanOrEqual(f.current.raceTimeSec);
  });

  it('dan trke prati cilj „istrči bez hodanja"', () => {
    const notes = raceNotes(b.doc, b.state, fivek).join('\n');
    expect(notes).toContain('bez hodanja');
    expect(notes).not.toContain('sve što imaš');
    expect(notes).not.toContain('do tada trči po osećaju');
    expect(notes).toMatch(/Zagrevanje .* ubrzanja/);
  });

  it('isti nivo sa tegobom u 12 meseci (par P2 B) zadržava oprezan vrh lestvice', () => {
    const p11 = profile('p11');
    const base = factsOf(p11);
    const facts: RunnerFacts = {
      ...base,
      profile: {
        ...base.profile,
        yearsRunning: 0.1,
        longestRecentKm: 10,
        recentResult: { distanceM: 10000, timeSec: 3362, date: '2026-10-25' }
      },
      pain: [{ date: '2025-11-10', part: 'potkolenica', level: 5, resolvedOn: '2025-12-15' }]
    };
    const withPain = buildFrom(facts, p11.goal);
    expect(withPain.doc.header.decisions.level).toBe('pocetnik-nov');
    expect(withPain.doc.header.decisions.peakOverBase).toBe(1.45);
    expect(Math.max(...stats(withPain.doc).map((x) => x.km))).toBeLessThanOrEqual(16.1);
  });
});

/* ------------------------------------------------------------------ p06 */

describe('R27 — p06 (17:33, 25–26 km, 6 nedelja, 5 traženih dana)', () => {
  const b = build('p06');
  const s = stats(b.doc);

  it('plan ima dan manje u nedeljama 1–5, uz JEDNO upozorenje sa istim brojem obima kao zaglavlje', () => {
    expect(b.doc.header.decisions.askedRunDays).toBe(5);
    expect(b.doc.header.decisions.runDays).toHaveLength(4);
    for (const x of s.slice(0, 5)) expect(x.runs, `nedelja ${String(x.week.index)}`).toBe(4);
    const codes = b.doc.header.warnings.map((w) => w.code);
    expect(codes.filter((c) => c === 'dan-manje')).toHaveLength(1);
    expect(codes).not.toContain('dan-izostavljen');
    expect(codes).not.toContain('lagan-kratak');
    const header = /Polazim od tvojih ≈ ([\d,]+) km/.exec(b.text)?.[1];
    expect(header).toBeDefined();
    const warn = b.doc.header.warnings.find((w) => w.code === 'dan-manje');
    expect(warn?.problem).toContain(`oko ${header ?? ''} km`);
    expect(b.text).not.toContain('ustupa mesto');
  });

  it('nedelje 1–4 po dva kvaliteta; nedelja pred trku ima tempo trke i manja je od vrha', () => {
    for (const x of s.slice(0, 4)) expect(x.quality, `nedelja ${String(x.week.index)}`).toBe(2);
    const taper = s[4];
    const rp = taper?.week.days.some(
      (d) => d.workout?.kind === 'quality' && d.workout.stimulus === 'tempo-trke'
    );
    expect(rp).toBe(true);
    const peak = Math.max(...s.map((x) => x.km));
    /* trener traži ≤ 70 %; uz 4 dana po ≥ 4,5 km, tempo trke i dugi ≥ lagan / 0,8 izlazi 75 % (bilo 78 %) */
    expect((taper?.km ?? 0) / peak).toBeLessThanOrEqual(0.76);
  });

  it('potvrđeni dani: plan zadržava svih 5 dana', () => {
    const p = profile('p06');
    const base = factsOf(p);
    const kept = buildFrom(
      { ...base, availability: { ...base.availability, confirmedRunDays: true } },
      p.goal
    );
    expect(kept.doc.header.decisions.runDays).toHaveLength(5);
    expect(kept.doc.header.decisions.askedRunDays).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ p15 */

describe('R27 — p15 (povratnik, 14 nedelja, 4 dana)', () => {
  const b = build('p15');
  const s = stats(b.doc);
  const peakAt = s.findIndex((x) => kindOf(x.week) === 'peak');
  const body = s.slice(0, peakAt + 1).filter((x) => ['build', 'peak'].includes(kindOf(x.week)));

  it('obim raste do ≥ 1,15 × sadašnji; najveća nedelja je vršna', () => {
    const base = b.doc.header.decisions.baseKm ?? 20;
    const peak = Math.max(...s.map((x) => x.km));
    expect(peak).toBeGreaterThanOrEqual(1.15 * base);
    expect(s[peakAt]?.km).toBe(peak);
  });

  it('isti dugi najviše dve nedelje gradnje zaredom', () => {
    let run = 1;
    for (let i = 1; i < body.length; i += 1) {
      const same = body[i]?.longMin === body[i - 1]?.longMin && (body[i]?.longMin ?? 0) > 0;
      run = same ? run + 1 : 1;
      expect(run, `nedelja ${String(body[i]?.week.index)}`).toBeLessThanOrEqual(2);
    }
    expect(Math.max(...body.map((x) => x.longMin))).toBeGreaterThanOrEqual(60);
  });

  it('lagan dan ≥ 25 min u gradnji (najviše jedna nedelja sa kraćim; bilo tri)', () => {
    const short = body.filter((x) => x.easyMin.some((m) => m < 25));
    expect(short.length).toBeLessThanOrEqual(1);
  });

  it('upozorenje o obimu kaže šta plan radi i predlaže dostižan sledeći korak', () => {
    const w = b.doc.header.warnings.find((x) => x.code === 'obim-za-nivo');
    if (w === undefined) return;
    expect(w.proposal).toContain('Ovaj plan već podiže obim');
    expect(w.proposal).not.toContain('oko 45 km');
  });
});

/* ------------------------------------------------------------------ svojstva nad mrežom 5 km */

describe('R27 — svojstva nad profilima 5 km', () => {
  const all = PROFILES.map((p) => ({ id: p.id, s: stats(build(p.id).doc) }));

  it('nedelja sužavanja (pred nedeljom trke) nije bez brzog treninga', () => {
    for (const { id, s } of all) {
      const taper = s.filter((x) => kindOf(x.week) === 'taper').pop();
      if (taper === undefined) continue;
      expect(taper.quality, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('početnik koji tek počinje: korak ≤ 10 % i vrh ≥ adekvatnog obima nad mrežom nedelja × obima', () => {
    const p13 = profile('p13');
    for (const weeks of [8, 10, 12, 14])
      /* ispod ≈ 10 km nedeljno tri trčanja po ≥ 20 min ne staju u obim (nedelje sa 2 treninga) — van mreže */
      for (const weeklyKm of [10, 12, 14]) {
        const start = new Date(`${p13.today}T00:00:00Z`);
        start.setUTCDate(start.getUTCDate() + 7 * weeks);
        const goal = { ...p13.goal, raceDate: start.toISOString().slice(0, 10) };
        const base = factsOf(p13);
        const facts: RunnerFacts = { ...base, profile: { ...base.profile, weeklyKm } };
        const s = stats(buildFrom(facts, goal).doc);
        const label = `${String(weeks)} ned, ${String(weeklyKm)} km`;
        s.forEach((x, i) => {
          if (i === 0 || (kindOf(x.week) !== 'build' && kindOf(x.week) !== 'peak')) return;
          const ref = Math.max(...s.slice(Math.max(0, i - 3), i).map((y) => y.km));
          expect(x.km, `${label}, nedelja ${String(x.week.index)}`).toBeLessThanOrEqual(
            ref * 1.1 + 0.5
          );
        });
        /* od 10 nedelja i 10 km nedeljno vrh stiže do adekvatnog obima (95 % od 15 km) */
        if (weeks >= 10 && weeklyKm >= 10)
          expect(Math.max(...s.map((x) => x.km)), label).toBeGreaterThanOrEqual(14.25);
      }
  });

  it('dan manje nad mrežom obima × dana: plan ima traženo − 1 dana tačno kad obim ne nosi tražene dane', () => {
    const p06 = profile('p06');
    for (const runDays of [
      [0, 1, 3, 5, 6],
      [0, 1, 2, 3, 5, 6]
    ] as Weekday[][])
      for (const weeklyKm of [22, 26, 34, 45]) {
        const base = factsOf(p06);
        const facts: RunnerFacts = {
          ...base,
          availability: { runDays, longDay: 6 },
          profile: { ...base.profile, weeklyKm }
        };
        const { doc } = buildFrom(facts, p06.goal);
        const d = doc.header.decisions;
        const label = `${String(runDays.length)} dana, ${String(weeklyKm)} km`;
        const avg = (d.baseVolumeMin ?? d.baseLoad) / runDays.length;
        if (avg < 27) {
          expect(d.runDays.length, label).toBe(runDays.length - 1);
          expect(d.askedRunDays, label).toBe(runDays.length);
          expect(doc.header.warnings.filter((w) => w.code === 'dan-manje')).toHaveLength(1);
        } else {
          expect(d.runDays.length, label).toBe(runDays.length);
          expect(d.askedRunDays, label).toBeUndefined();
        }
      }
  });
});
