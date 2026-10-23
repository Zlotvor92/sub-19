/* MAR-09 (marathon-v2.6.0, ispravke posle dubinske provere; docs/generators-v2/audit/fixes/MAR.md). Svaki test pada na
   c13c258 (pre ispravke). */

import { describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { resultFates } from './assess.ts';
import { mustDay } from './dates.ts';
import { userText } from './app/format.ts';
import { generatedPlan } from './app/plan.ts';
import { generateMarathonV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { jumpLongs10, longShortOf } from './lengths.ts';
import { pacesAt } from './steps.ts';
import { factsOf, gridInputs, painFacts } from './testInputs.ts';
import type { AdaptResult, MarathonV2Plan, Paces } from './types.ts';

const planOf = (input: Record<string, unknown>): MarathonV2Plan => {
  const g = generateMarathonV2(input);
  if (!g.ok) throw new Error(JSON.stringify(g.reasons));
  return g.plan;
};
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const weekPaces =
  (p: MarathonV2Plan) =>
  (w: number): Paces => {
    const c = checkInput(p.input);
    if (!c.ok) throw new Error('ulaz');
    return pacesAt(c.pace, p.adaptation?.steps ?? [], w, p.input.currentWeeklyKm);
  };

describe('t. 1: trkačka nedelja nikad prazna (jedna definicija raceOnlyWeek)', () => {
  it('bol 8 na kraj ned N−2, 3 dana (owner O3): plan se vraća, trkačka = trka + RACE_WEEK_SHORT', () => {
    const p = planOf({
      startDate: '2026-11-02',
      raceDate: '2027-01-24',
      runDays: ['mon', 'tue', 'wed'],
      longRunDay: 'mon',
      currentWeeklyKm: 30,
      recentResult: { distanceM: 21097.5, timeSec: 6019, date: '2026-10-19' },
      goalTimeSec: null
    });
    const at = '2027-01-10';
    const r = ok(adaptMarathonV2(p, painFacts(at, 8), at));
    const rw = r.plan.weeks.at(-1)!;
    expect(rw.days.map((d) => d.role)).toEqual(['race']);
    expect(r.plan.warnings.map((v) => v.rule)).toContain('RACE_WEEK_SHORT');
  });
  it('mar-emptyweek-example (thu/fri/sat, po osećaju 375, pain8 asOf 2027-02-24)', () => {
    const p = planOf({
      startDate: '2026-11-05',
      raceDate: '2027-03-10',
      runDays: ['thu', 'fri', 'sat'],
      longRunDay: 'sat',
      currentWeeklyKm: 33,
      recentResult: null,
      goalTimeSec: 10071,
      easyPaceSecPerKm: 375
    });
    const at = '2027-02-24';
    ok(adaptMarathonV2(p, factsOf(p, 'pain8', at), at));
  });
});

describe('t. 2: L skoka dugog po činjenicama (pouka 37 za L)', () => {
  it('MAR 5 d 70 km po osećaju 315, painPause asOf 2027-01-31: posle netrčanih nedelja dugi ≤ plafon iz trčanog', () => {
    const p = planOf({
      startDate: '2026-11-02',
      raceDate: '2027-04-11',
      runDays: ['tue', 'wed', 'thu', 'sat', 'sun'],
      longRunDay: 'sun',
      currentWeeklyKm: 70,
      recentResult: null,
      goalTimeSec: null,
      easyPaceSecPerKm: 315
    });
    const at = '2027-01-31';
    const r = ok(adaptMarathonV2(p, factsOf(p, 'painPause', at), at));
    const long = (i: number) =>
      r.plan.weeks[i - 1]!.days.find((d) => d.role === 'long')!.workout.km;
    expect(long(14)).toBe(10.9);
    // Pre ispravke 26,9 (L = 27,2 planiranog, netrčanog dugog ned 11–13).
    expect(long(15)).toBeLessThanOrEqual(Math.max(1.1 * 10.9, 10.9 + 1) + 1e-9);
    // Ned 11–13 nisu trčane (pokrivenost): nisu L.
    const jl = jumpLongs10(r.plan.weeks, r.plan.adaptation!.steps, 15);
    expect(jl.slice(10, 13)).toEqual([null, null, null]);
    expect(jl[9]).toBe(272);
  });
});

describe('t. 4: plafon 150 min tempom nedelje (longShortOf, kapacitet)', () => {
  it('mar-timecap-example: posle rezultata najduži dugi na 150 min tempa svoje nedelje → napomena, ne MARATHON_LONG_SHORT', () => {
    const p = planOf({
      startDate: '2026-11-07',
      raceDate: '2027-02-12',
      runDays: ['thu', 'wed', 'tue', 'sun', 'sat'],
      longRunDay: 'sun',
      currentWeeklyKm: 44,
      recentResult: null,
      goalTimeSec: 12147,
      recentLongRunKm: 16.9,
      easyPaceSecPerKm: 464
    });
    const at = '2026-12-25';
    const r = ok(adaptMarathonV2(p, factsOf(p, 'faster', at), at));
    expect(longShortOf(r.plan.weeks, 26, weekPaces(r.plan))?.timeCapped).toBe(true);
    expect(r.plan.warnings.map((v) => v.rule)).not.toContain('MARATHON_LONG_SHORT');
  });
});

describe('t. 6 (Z2): korisnički tekst bez internih oznaka', () => {
  const LABEL = /\b(?:[MADHN]\d{1,2}[a-z]?|pouk[ae] \d+|Uslov \d+)\b/;
  it('userText', () => {
    expect(
      userText('Trkačka nedelja ima samo trku: dani pre trke su odmor (bol, A4; pouka 30).')
    ).toBe('Trkačka nedelja ima samo trku: dani pre trke su odmor (bol).');
    expect(userText('Dugi max(1,1 × L; L + 1,0 km) (M13a).')).toBe(
      'Dugi max(1,1 × L; L + 1,0 km).'
    );
    expect(userText('Planirano 19.98 km > cilj 18.5 km (pouka 37, 14)..')).toBe(
      'Planirano 20 km > cilj 18,5 km.'
    );
  });
  it('mreža: napomene, fokus nedelje, upozorenja i razlozi bez oznaka; decimalni zarez', () => {
    const bad: string[] = [];
    for (const [i, x] of gridInputs().entries()) {
      if (i % 9 !== 0) continue;
      const g = generateMarathonV2(x.input);
      if (!g.ok) continue;
      const app = generatedPlan(g.plan);
      const texts = [...app.meta.dayWarnings, ...app.weeks.map((w) => w.focus ?? '')];
      for (const t of texts) if (LABEL.test(t) || /\d\.\d/.test(t) || /\.\./.test(t)) bad.push(t);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('t. 5: napomena spuštene doze vidi najnižu dozu', () => {
  it('d4-21w-55km-v45-A-sat: nijedna napomena ne tvrdi „ne sme biti duži" za dan koji je duži od dugog', () => {
    const p = planOf(gridInputs().find((x) => x.id === 'd4-21w-55km-v45-A-sat')!.input);
    const contra = p.weeks.filter((w) => {
      const L = w.days.find((d) => d.role === 'long');
      const q = w.days.filter((d) => d.workout.kind === 'quality');
      return (
        L &&
        q.some((d) => d.workout.sec > L.workout.sec) &&
        w.notes.some((n) => n.includes('ne sme biti duži od dugog'))
      );
    });
    expect(contra.map((w) => w.index)).toEqual([]);
    expect(p.weeks.some((w) => w.notes.some((n) => n.includes('ostaje duži od dugog')))).toBe(true);
  });
});

describe('t. 6 (Z1): kvalitet ostaje kad je jedini višak upisani višak ≤ 10 %', () => {
  it('d3-12w-40km-v30-A-sun over120 asOf 2026-12-15: ned 7 zadržava kvalitet, MIXED_WEEK_OVER', () => {
    const p = planOf(gridInputs().find((x) => x.id === 'd3-12w-40km-v30-A-sun')!.input);
    const at = '2026-12-15';
    const r = ok(adaptMarathonV2(p, factsOf(p, 'over120', at), at));
    const before = p.weeks[6]!.days.filter((d) => d.date > at && d.workout.kind === 'quality');
    const after = r.plan.weeks[6]!.days.filter((d) => d.date > at && d.workout.kind === 'quality');
    expect(before.length).toBeGreaterThan(0);
    expect(after.map((d) => d.date)).toEqual(before.map((d) => d.date));
    expect(r.plan.warnings.map((v) => `${v.rule}@${v.week}`)).toContain('MIXED_WEEK_OVER@7');
    expect(r.plan.weeks[6]!.plannedKm).toBeLessThanOrEqual(1.1 * r.plan.weeks[6]!.targetKm + 1e-9);
  });
});

describe('t. 6 (Z3): sudbina rezultata — jedna odluka (assess.resultFates) za adaptaciju i Formu', () => {
  it('VDOT van opsega nije „čeka prilagođavanje"', () => {
    const slow = { distM: 5000 as const, sec: 2400, date: '2027-01-10', kind: 'race' as const };
    const good = { distM: 10000 as const, sec: 2700, date: '2027-01-09', kind: 'race' as const };
    const f = resultFates([slow, good], '2026-10-01', mustDay('2027-01-12'));
    expect(f.get(slow)).toBe('range');
    expect(f.get(good)).toBe('apply');
  });
});

describe('t. 6 (Z2): RECENT_LONG_TOO_SHORT sa pravilom max(10 %, 1 km) i pragom', () => {
  it('3 d, 30 km, skorašnji najduži 5 km', () => {
    const g = generateMarathonV2({
      startDate: '2026-11-02',
      raceDate: '2027-01-24',
      runDays: ['tue', 'thu', 'sun'],
      longRunDay: 'sun',
      currentWeeklyKm: 30,
      recentResult: null,
      goalTimeSec: null,
      easyPaceSecPerKm: 330,
      recentLongRunKm: 5
    });
    expect(g.ok).toBe(false);
    const m = !g.ok ? g.reasons[0]!.message : '';
    expect(m).toContain('max(10 %, 1 km)');
    expect(m).toContain('Plan je izvodljiv od 8,0 km.');
    // Prag je tačan: sa njim plan postoji.
    expect(
      generateMarathonV2({
        startDate: '2026-11-02',
        raceDate: '2027-01-24',
        runDays: ['tue', 'thu', 'sun'],
        longRunDay: 'sun',
        currentWeeklyKm: 30,
        recentResult: null,
        goalTimeSec: null,
        easyPaceSecPerKm: 330,
        recentLongRunKm: 8
      }).ok
    ).toBe(true);
  });
});
