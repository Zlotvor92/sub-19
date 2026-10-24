import { describe, expect, it } from 'vitest';
import { adaptHmV2 } from './adapt.ts';
import { adaptBases, factsOf } from './adaptInputs.ts';
import { MIXED_NOTE } from './week.ts';
import { adaptNominal10, adaptVolume } from './volume.ts';
import { planRule } from './policy.ts';
import { validatePlan } from './validate.ts';
import { restoreMerge } from './app/adapt.ts';
import { generatedPlan, storedPlan } from './app/plan.ts';
import { addDays } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import { checkPlan, emptyStats } from './gridInvariants.ts';
import { longestLong10, stepCap10, taperLongAtMin, taperLongCap10 } from './lengths.ts';
import { beginnerInputs, feelInputs, grid02Inputs } from './testInputs.ts';
import type { HmV2Plan, PlanWeek } from './types.ts';
import { FULL } from '../../../../test/level';

/* Segment HM-09 (hm-v2.7.0) — ispravke posle dubinske provere (docs/generators-v2/audit/fixes/HM.md). Ulazi su iz
   nalaza (owner B1/B2/B3, coach-hm-mar 1b #1/#2/#5, fuzz F6); svaki test pada na kodu pre ispravke. */

type Ok = { ok: true; plan: HmV2Plan };
const ok = (r: unknown): HmV2Plan => {
  const x = r as Ok | { ok: false; reasons: { message: string }[] };
  if (!x.ok) throw new Error(x.reasons.map((m) => m.message).join(' | '));
  return x.plan;
};
const fat = (d1: string, d2: string) => ({
  workouts: [
    { date: d1, km: 6, durationSec: 2400, completed: true, rpe: 8 },
    { date: d2, km: 6, durationSec: 2400, completed: true, rpe: 7 }
  ]
});
const pain8 = (d: string) => ({
  workouts: [{ date: d, km: 0, durationSec: 0, completed: false, pain: 8 }]
});
const longOf = (w: PlanWeek) => w.days.find((d) => d.role === 'long');
const all = () => [...grid02Inputs(), ...feelInputs(), ...beginnerInputs()];
const inputOf = (id: string) => all().find((g) => g.id === id)!.input;

/** Tok B1/B3 (owner hm-deloadref.ts): bol 8 pokriva dugi ned 1; umor ned 1 → rasterećenje ned 2; umor ned 2 →
    rasterećenje ned 3. */
function chain3(input: Record<string, unknown>) {
  const p0 = ok(generateHmV2(input));
  const a1 = addDays(longOf(p0.weeks[0]!)!.date, -3);
  const s1 = ok(adaptHmV2(p0, pain8(a1), a1));
  const a2 = p0.weeks[0]!.endDate;
  const s2 = ok(adaptHmV2(s1, fat(addDays(a1, -1), addDays(a1, -2)), a2));
  const a3 = s2.weeks[1]!.endDate;
  return { s2, s3: adaptHmV2(s2, fat(addDays(a3, -1), addDays(a3, -3)), a3) };
}

describe('HM-09: jedan vlasnik reference dugog rasterećenja (B1, B2)', () => {
  it('B2: bol 8 (odmor pokriva dugi ned 1) + umor u ISTOM koraku → rasterećenje ned 2 sa referencom', () => {
    const b = adaptBases().find((x) => x.id === 'd4-r-14w')!;
    const p0 = ok(generateHmV2(b.input));
    const asOf = '2026-11-05';
    const r = adaptHmV2(
      p0,
      {
        workouts: [...pain8(asOf).workouts, ...fat(addDays(asOf, -1), addDays(asOf, -2)).workouts]
      },
      asOf
    );
    const p = ok(r);
    expect(p.weeks[1]!.deload).toBe(true);
    expect(p.adaptation!.steps.at(-1)!.deloadRefLongKm).toBe(16);
  });

  it('B1: recentLongRunKm 12, bol → umor → umor: rasterećenje ned 3 sudi sopstvenom referencom', () => {
    const { s3 } = chain3({ ...inputOf('d4-17w-50km-v40-C-sat'), recentLongRunKm: 12 });
    const p = ok(s3);
    expect(p.weeks[1]!.deload && p.weeks[2]!.deload).toBe(true);
    // Dugi ned 3 = 0,8 × sopstvena referenca (korak 3), ne referenca ned 2.
    const ref3 = p.adaptation!.steps.at(-1)!.deloadRefLongKm!;
    expect(longOf(p.weeks[2]!)!.workout.km).toBeLessThanOrEqual(Math.floor(8 * ref3) / 10);
  });
});

describe('HM-09 B3: taper posle smanjenja — dugi tapera najmanje 4 km', () => {
  it('b-d5-12w-25km-e390-A u 3 koraka: najduži 6,6 km → taper prihvaćen, dugi 4 km, TAPER_LONG_MIN', () => {
    expect(taperLongCap10(66)).toBe(40);
    expect(taperLongCap10(100)).toBe(60);
    const { s3 } = chain3(inputOf('b-d5-12w-25km-e390-A'));
    const p = ok(s3);
    const taper = p.weeks.find((w) => w.phase === 'taper')!;
    // HM-10 (T1): manje laganih dana u malim nedeljama → duži najduži dugi (bilo 6,6 km); dugi tapera i upozorenje
    // po istoj funkciji (taperLongCap10 / taperLongAtMin).
    const longest10 = longestLong10(p.weeks.slice(0, taper.index - 1));
    const t10 = Math.round(longOf(taper)!.workout.km * 10);
    expect(t10).toBeLessThanOrEqual(taperLongCap10(longest10));
    expect(p.warnings.some((v) => v.rule === 'TAPER_LONG_MIN' && v.week === taper.index)).toBe(
      taperLongAtMin(t10, longest10)
    );
  });
});

describe('HM-09 1b #5: L skoka dugog iz stvarno trčanog (pouka 37 i za pouku 28)', () => {
  it('6 d 75 km, painPause asOf 2027-01-10: ned 12 dugi ≤ max(1,1 L, L + 1) iz trčanog (8,5 km)', () => {
    const input = {
      startDate: '2026-11-02',
      raceDate: '2027-02-28',
      runDays: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      longRunDay: 'sun',
      currentWeeklyKm: 75,
      recentResult: null,
      goalTimeSec: null,
      easyPaceSecPerKm: 405
    };
    const p0 = ok(generateHmV2(input));
    const asOf = '2027-01-10';
    const p = ok(adaptHmV2(p0, factsOf(p0, 'painPause', asOf), asOf));
    const ran = p.adaptation!.steps.at(-1)!.ranLongKm ?? {};
    expect(Object.keys(ran).length).toBeGreaterThan(0);
    // L nedelja 8–11: protekle iz činjenica (ranLongKm), buduća ned 11 planirana.
    const L10 = Math.max(
      ...[8, 9, 10, 11].map((i) => {
        const l = longOf(p.weeks[i - 1]!);
        const k = l ? Math.round(l.workout.km * 10) : 0;
        return String(i) in ran ? Math.min(k, Math.round(ran[String(i)]! * 10)) : k;
      })
    );
    expect(L10).toBeLessThan(100);
    expect(Math.round(longOf(p.weeks[11]!)!.workout.km * 10)).toBeLessThanOrEqual(stepCap10(L10));
  });
});

describe('HM-09 1b #1/#2: taper — dva dana kvaliteta i dugi', () => {
  it('mreža (svaki 41. plan): taper bez dva dana kvaliteta dužih od dugog; „ne sme biti duži" samo kad nije', () => {
    let n = 0;
    const bad: string[] = [];
    for (const [i, b] of all().entries()) {
      if (i % (FULL ? 3 : 41)) continue;
      const g = generateHmV2(b.input);
      if (!g.ok) continue;
      n++;
      for (const w of g.plan.weeks.filter((x) => x.phase === 'taper')) {
        const long = longOf(w)?.workout.sec;
        if (long === undefined) continue;
        const qs = w.days.filter((d) => d.role === 'q1' || d.role === 'q2');
        const longer = qs.some((d) => d.workout.sec > long);
        if (qs.length === 2 && longer)
          bad.push(`${b.id} ned ${w.index}: dva dana, dugi nije najduži`);
        if (longer && w.notes.some((x) => x.includes('ne sme biti duži od dugog tapera')))
          bad.push(`${b.id} ned ${w.index}: napomena tvrdi suprotno`);
      }
      if (g.plan.warnings.some((v) => v.severity === 'error')) bad.push(`${b.id}: greška`);
    }
    expect(n).toBeGreaterThan(500);
    expect(bad).toEqual([]);
  });
});

describe('HM-09 fuzz F6: invarijanta DELOAD_LONG zna izuzetak pouke 32 (dugi podignut zbog testa)', () => {
  it('#8208: nedelja 4 dugi 10,2 > 0,8 × 12,6 uz napomenu „podignut" → bez DELOAD_LONG', () => {
    const p = ok(
      generateHmV2({
        startDate: '2028-06-04',
        raceDate: '2028-09-02',
        runDays: ['thu', 'tue', 'fri', 'wed', 'sun'],
        currentWeeklyKm: 44.6,
        recentResult: null,
        easyPaceSecPerKm: 339,
        goalTimeSec: 6104,
        recentLongRunKm: 9.5
      })
    );
    const bad: Record<string, string[]> = {};
    checkPlan('F6', p, bad, emptyStats());
    expect(bad['DELOAD_LONG'] ?? []).toEqual([]);
  });
});

describe('HM-09 Z1: mešovita nedelja — kvalitet ostaje uz upisani višak ≤ 10 %', () => {
  it('d4-10w-35km-v50-C-sat, over120, asOf 2026-11-09: kvalitet ned 2 ostaje, MIXED_WEEK_OVER', () => {
    const p0 = ok(generateHmV2(inputOf('d4-10w-35km-v50-C-sat')));
    const asOf = '2026-11-09';
    const p = ok(adaptHmV2(p0, factsOf(p0, 'over120', asOf), asOf));
    const w0 = p0.weeks[1]!;
    const w = p.weeks[1]!;
    const q = (x: PlanWeek) =>
      x.days.filter((d) => d.date > asOf && d.workout.kind === 'quality').map((d) => d.date);
    expect(q(w0).length).toBeGreaterThan(0);
    expect(q(w)).toEqual(q(w0));
    expect(w.notes.some((n) => n.includes(MIXED_NOTE) && n.includes('kvalitet ostaje'))).toBe(true);
    expect(w.plannedKm).toBeLessThanOrEqual(1.1 * w.targetKm + 1e-9);
    expect(p.warnings.some((v) => v.rule === 'MIXED_WEEK_OVER' && v.week === 2)).toBe(true);
  });
});

describe('HM-09 Z4: vraćanje verzije = spoj → validatePlan (jezgro)', () => {
  const b = adaptBases().find((x) => x.id === 'd3-r-10w')!;
  const g = ok(generateHmV2(b.input));
  const asOf = addDays(g.weeks[1]!.startDate, 2);
  const cur = ok(adaptHmV2(g, factsOf(g, 'under50', asOf), asOf));
  const store = (p: HmV2Plan) => storedPlan(generatedPlan(p));
  const conflicts = (r: unknown) =>
    (r as { meta: { futureChanges: { conflicts: string[] } } }).meta.futureChanges.conflicts;
  it('neposredno poništavanje (isti dan, bez novih zapisa) se vraća i prolazi validator', () => {
    const r = restoreMerge(store(cur), store(g), asOf as never);
    expect(conflicts(r)).toEqual([]);
    const back = (r as unknown as { hmV2: HmV2Plan }).hmV2;
    expect(validatePlan(back).filter((v) => v.severity === 'error')).toEqual([]);
    expect(adaptHmV2(back, {}, asOf).ok).toBe(true);
  });
  it('d3-r-10w under50 +8 dana: spoj krši pravila plana → odbijanje sa razlogom', () => {
    const r = restoreMerge(store(cur), store(g), addDays(asOf, 8) as never);
    expect(conflicts(r)[0]).toMatch(/ne zadovoljava pravila plana/);
  });
});

describe('HM-09 dopuna lanaca: Z6, Z7, Z8, C7', () => {
  const b = adaptBases().find((x) => x.id === 'd4-r-14w')!;
  const g = ok(generateHmV2(b.input));
  const asOf = g.weeks[2]!.endDate;
  it('Z7: ista adaptacija dvaput (manjak, iste činjenice, isti asOf) ne seče cilj ponovo', () => {
    const f = factsOf(g, 'under50', asOf);
    const a1 = ok(adaptHmV2(g, f, asOf));
    const a2 = ok(adaptHmV2(a1, f, asOf));
    expect(a2.weeks.map((w) => w.targetKm)).toEqual(a1.weeks.map((w) => w.targetKm));
  });
  it('Z8: bol — ista adaptacija dvaput i „sutra bez novih zapisa" bez kaskade', () => {
    // asOf subota: sutra (nedelja) sidro bola bi prešlo u sledeću nedelju (kaskada pre Z8).
    const sat = addDays(asOf, -1);
    const f = factsOf(g, 'pain5', sat);
    const a1 = ok(adaptHmV2(g, f, sat));
    const a2 = ok(adaptHmV2(a1, f, sat));
    expect(a2.weeks.map((w) => w.targetKm)).toEqual(a1.weeks.map((w) => w.targetKm));
    const a3 = ok(adaptHmV2(a1, f, asOf));
    expect(a3.weeks.map((w) => w.targetKm)).toEqual(a1.weeks.map((w) => w.targetKm));
  });
  it('Z6: dan kvaliteta zaključan u ranijem koraku pa prošao (≤ asOf) u periodu bola nije LIMITS', () => {
    const q = g.weeks
      .slice(3)
      .flatMap((w) => w.days)
      .find((d) => d.role === 'q1')!;
    const a0 = addDays(q.date, -2);
    const a1 = ok(adaptHmV2(g, { ...factsOf(g, 'pain5', a0), lockedDayIds: [q.date] }, a0));
    expect(a1.weeks.flatMap((w) => w.days).find((d) => d.date === q.date)!.workout.kind).toBe(
      'quality'
    );
    const r = adaptHmV2(a1, {}, addDays(q.date, 1));
    expect(r.ok, JSON.stringify(!r.ok && r.reasons)).toBe(true);
  });
});

describe('HM-09 C7: taper posle smanjenja bez ne-rasteretne izgradnje', () => {
  it('osnova tapera = osnova rasterećenja (lastBuild), ne 0 → minimum nedelje', () => {
    const frame = { index: 13, phase: 'taper', deload: false } as never;
    const h = { lastBuild10: 665, peak10: 950, cap10: 950, peakRef10: 0, tailCap10: null };
    const av = adaptVolume([]);
    const rule = planRule(6, 'regular')!;
    expect(adaptNominal10(frame, h, 750, rule, av).nominal).toBe(Math.round(0.7 * 665));
  });
});

describe('HM-09 C3: zaštićen test ostaje činjenica i u sledećem koraku (pouka 38)', () => {
  it('test zaključan u koraku umora (nedelja testa postaje rasterećenje), pa prošao → jedan test, prihvaćeno', () => {
    const b = adaptBases().find((x) => x.id.includes('-f-') && x.id.startsWith('d6'))!;
    const g = ok(generateHmV2(b.input));
    const td = g.weeks.flatMap((w) => w.days).find((d) => d.role === 'test')!.date;
    const wk = g.weeks.find((w) => w.days.some((d) => d.date === td))!;
    // Umor u nedelji pre testa → nedelja testa je rasterećenje (A13 bi premestio test); dan testa zaključan.
    const a0 = addDays(wk.startDate, -2);
    const a1 = ok(
      adaptHmV2(g, { ...fat(addDays(a0, -1), addDays(a0, -2)), lockedDayIds: [td] }, a0)
    );
    const tests1 = a1.weeks.flatMap((w) => w.days).filter((d) => d.role === 'test');
    expect(tests1.map((d) => d.date)).toEqual([td]);
    // Sledeći korak posle dana testa, bez zaključavanja i bez zapisa testa.
    const a2 = adaptHmV2(a1, {}, td);
    expect(a2.ok, JSON.stringify(!a2.ok && a2.reasons)).toBe(true);
    const tests2 = ok(a2)
      .weeks.flatMap((w) => w.days)
      .filter((d) => d.role === 'test');
    expect(tests2.length).toBe(1);
  });
});
