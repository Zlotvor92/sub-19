/* D6 — obim: start, rast, granica izgradnje (max nedelje po broju dana, D17), kapacitet iz STVARNE
   konstrukcije, izvodljiv cilj samo za pogođenu nedelju (sa napomenom), planirano = cilj; D22 poruka
   CAPACITY_LIMITED. */

import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { pacesFromVdot, predicted10k } from './paces.ts';
import { isBuildPhase, periodize } from './periodize.ts';
import { dayRule } from './policy.ts';
import { advance, INITIAL_QUALITY, type QualityState } from './quality.ts';
import { grid02Inputs, gridInputs, inputOf, SCHEDULES, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { TenKV2Plan } from './types.ts';
import { fit10, nominal10, peakCap10, startKm10 } from './volume.ts';
import { buildWeek, type BuiltWeek } from './week.ts';
import { warmupCooldown } from './workouts.ts';

/** Nezavisno pravilo D6: +6 % (min 1,0, max 3,0; korak 0,1) do min(1,4×, +15, max nedelje D17). */
const growth = (last: number): number => Math.min(3, Math.max(1, Math.round(last * 0.6) / 10));
const PEAK_MAX: Record<number, number> = { 3: 45, 4: 60, 5: 75, 6: 90 };
const cap = (start: number, days = 4): number =>
  Math.min(Math.floor(start * 14 + 1e-9) / 10, start + 15, PEAK_MAX[days]!);

/** Ponovi konstrukciju plana i vrati izvodljivost svake nedelje (stvarni week.ts). */
function replay(raw: Record<string, unknown>): ((t10: number) => boolean)[] {
  const c = checkInput(raw);
  if (!c.ok) throw new Error('ulaz');
  const paces = pacesFromVdot(c.vdotRaw);
  const rule = dayRule(c.input.runDays.length)!;
  const ctx = {
    input: c.input,
    paces,
    pattern: c.pattern,
    raceSec: predicted10k(paces),
    wc: warmupCooldown(c.input.currentWeeklyKm),
    rule
  };
  const s10 = startKm10(c.input.currentWeeklyKm);
  const c10 = peakCap10(s10, rule);
  let q: QualityState = INITIAL_QUALITY;
  const vol = { lastBuild10: null as number | null, peak10: 0 };
  let lastLong: number | null = null;
  let longest = 0;
  const out: ((t10: number) => boolean)[] = [];
  for (const f of periodize(c.input.startDate, c.weeks)!) {
    if (f.phase === 'race') break;
    const qq: QualityState = q;
    const ll: number | null = lastLong;
    const lo: number = longest;
    const make = (t: number): BuiltWeek | null => buildWeek(ctx, f, t, qq, ll, lo);
    out.push((t) => make(t) !== null);
    const fit: { target10: number } = fit10(
      nominal10(f, vol, s10, c10),
      f,
      c10,
      rule,
      (t) => make(t) !== null
    )!;
    const w: BuiltWeek = make(fit.target10)!;
    if (w.long10 !== null) longest = Math.max(longest, w.long10);
    if (isBuildPhase(f.phase) && !f.deload) {
      vol.lastBuild10 = fit.target10;
      vol.peak10 = Math.max(vol.peak10, fit.target10);
      lastLong = w.long10;
      if (w.picks) q = advance(w.picks);
    }
  }
  return out;
}

function checkRule(p: TenKV2Plan): void {
  const start = p.input.currentWeeklyKm;
  const days = p.input.runDays.length;
  expect(p.startKm).toBe(start);
  expect(p.peakCapKm).toBe(cap(start, days));
  let last: number | null = null;
  let peak = 0;
  for (const w of p.weeks) {
    if (w.phase === 'race') {
      expect(w.targetKm).toBe(Math.round(w.plannedKm * 10) / 10);
      continue;
    }
    const nominal: number =
      w.phase === 'taper'
        ? Math.round(0.75 * Math.round(peak * 10)) / 10
        : last === null
          ? start
          : w.deload
            ? Math.round(8 * last) / 10
            : Math.min(Math.round((last + growth(last)) * 10) / 10, cap(start, days));
    expect(w.nominalKm, `ned ${w.index}`).toBe(nominal);
    // Nijedna nedelja niža nego što D6 traži, osim pogođenih (oznaka + napomena).
    if (w.targetKm !== nominal) {
      expect(w.fitted, `ned ${w.index}`).toBe(w.targetKm < nominal ? 'down' : 'up');
      expect(w.notes.some((n) => n.includes('najbliži izvodljiv'))).toBe(true);
    } else expect(w.fitted).toBeNull();
    expect(Math.abs(w.plannedKm - w.targetKm)).toBeLessThanOrEqual(0.1 + 1e-9);
    if (isBuildPhase(w.phase) && !w.deload) {
      expect(w.targetKm).toBeLessThanOrEqual(cap(start, days));
      last = w.targetKm;
      peak = Math.max(peak, w.targetKm);
    }
  }
  expect(p.peakKm).toBe(peak);
}

describe('D6: obim', () => {
  it('rast: +6 %, min 1,0, max 3,0 km, korak 0,1; granica min(1,4×, +15, max nedelje D17)', () => {
    expect(growth(25)).toBe(1.5);
    expect(growth(26.5)).toBe(1.6);
    expect(growth(15)).toBe(1);
    expect(growth(55)).toBe(3);
    expect(cap(25)).toBe(35);
    expect(cap(40)).toBe(55);
    expect(cap(55)).toBe(60);
    expect(cap(40, 3)).toBe(45);
    expect(cap(65, 5)).toBe(75);
    expect(cap(80, 6)).toBe(90);
    expect(cap(35, 6)).toBe(49);
  });

  it('pravilo važi u svakoj nedelji uzorka mreže 02 (planirano = cilj ± 0,1)', () => {
    const grid = ([3, 4, 5, 6] as const).flatMap((n) =>
      grid02Inputs(n).filter((_, i) => i % 13 === 0)
    );
    for (const { id, input } of grid) {
      const r = generateTenKV2(input);
      expect(r.ok, id).toBe(true);
      if (r.ok) checkRule(r.plan);
    }
  });

  it('ned 1 = trenutni obim kad ga konstrukcija nosi (01b: VDOT 50 nosi ceo opseg 25–55 km)', () => {
    for (const km of [25, 30, 35, 40, 45, 50, 55]) {
      const r = generateTenKV2(inputOf({ weeks: 12, km, vdot: 50, days: SCHEDULES.A.days }));
      expect(r.ok && r.plan.weeks[0]!.targetKm).toBe(km);
    }
  });

  it('izvodljiv cilj je NAJBLIŽI izvodljiv (stvarna konstrukcija), samo u pogođenoj nedelji', () => {
    const ids = [
      '14w-45km-v50-A-sun',
      '18w-55km-v30-B-sat',
      '15w-50km-v55-C-sun',
      '10w-30km-v30-A-sat'
    ];
    for (const id of ids) {
      const raw = gridInputs().find((g) => g.id === id)!.input;
      const r = generateTenKV2(raw);
      expect(r.ok, id).toBe(true);
      if (!r.ok) continue;
      const feas = replay(raw);
      for (const w of r.plan.weeks.filter((x) => x.phase !== 'race')) {
        const f = feas[w.index - 1]!;
        const nom = Math.round(w.nominalKm * 10);
        const got = Math.round(w.targetKm * 10);
        expect(f(got), `${id} ned ${w.index}`).toBe(true);
        if (w.fitted === null) continue;
        expect(f(nom)).toBe(false);
        // Nijedan bliži cilj nije izvodljiv (obe strane; rasterećenje i taper samo naniže; pri jednakoj
        // udaljenosti bira se niži).
        const hi = w.deload || w.phase === 'taper' ? nom : Math.round(r.plan.peakCapKm * 10);
        const d = Math.abs(got - nom);
        for (let k = 1; k < d; k++) {
          if (nom - k >= 120) expect(f(nom - k), `${id} ned ${w.index} −${k}`).toBe(false);
          if (nom + k <= hi) expect(f(nom + k), `${id} ned ${w.index} +${k}`).toBe(false);
        }
        if (got > nom && nom - d >= 120) expect(f(nom - d)).toBe(false);
      }
    }
  });

  it('kapacitet (pouka 1): spor E + 55 km → vrh = kapacitet iz konstrukcije, dugi seče 105 min', () => {
    const raw = gridInputs().find((g) => g.id === '18w-55km-v30-A-sun')!.input;
    const r = generateTenKV2(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.plan;
    const feas = replay(raw);
    const peakWeek = p.weeks.find(
      (w) => w.targetKm === p.peakKm && isBuildPhase(w.phase) && !w.deload
    )!;
    const t10 = Math.round(p.peakKm * 10);
    expect(p.peakKm).toBeLessThan(p.peakCapKm);
    expect(feas[peakWeek.index - 1]!(t10)).toBe(true);
    expect(feas[peakWeek.index - 1]!(t10 + 1)).toBe(false);
    // Uzrok: dugi je na 105 min sporim E i lagan bi morao biti duži od dugog.
    const long = peakWeek.days.find((d) => d.role === 'long')!.workout.km;
    expect(long).toBe(Math.floor((6300 / p.paces.E.slow) * 10) / 10);
    const easy = peakWeek.days.find((d) => d.role === 'easy')!.workout.km;
    expect(easy).toBeGreaterThanOrEqual(long - 0.1 - 1e-9);
    expect(p.warnings.some((w) => w.rule === 'CAPACITY_LIMITED')).toBe(true);
    const msg = '4 dana ne nose ovaj obim uz dugi ≤ 105 min; preporuka 5–6 dana.';
    expect(p.warnings.find((w) => w.rule === 'CAPACITY_LIMITED')!.message).toBe(msg);
    expect(p.notes.some((n) => n.startsWith(msg))).toBe(true);
    checkRule(p);
  });

  it('D22: CAPACITY_LIMITED imenuje stvarno ograničenje; više dana samo kad postoje (6 dana bez preporuke)', () => {
    const msgOf = (o: Parameters<typeof inputOf>[0]): string | undefined => {
      const r = generateTenKV2(inputOf(o));
      if (!r.ok) throw new Error(JSON.stringify(r.reasons));
      return r.plan.warnings.find((w) => w.rule === 'CAPACITY_LIMITED')?.message;
    };
    const d = SCHEDULES_BY_DAYS;
    // 4 dana, 25 km, VDOT 30: spuštene nedelje seče udeo 33 % (01b: poruka je pogrešno navodila 105 min).
    expect(msgOf({ weeks: 12, km: 25, vdot: 30, days: d[4].A.days, long: 'sun' })).toBe(
      '4 dana ne nose ovaj obim uz dugi ≤ 33 % nedelje; preporuka 5–6 dana.'
    );
    expect(msgOf({ weeks: 17, km: 30, vdot: 35, days: d[3].A.days, long: 'sun' })).toBe(
      '3 dana ne nose ovaj obim uz dugi ≤ 105 min i ≤ 40 % nedelje; preporuka 4–6 dana.'
    );
    expect(msgOf({ weeks: 12, km: 65, vdot: 30, days: d[5].A.days, long: 'sun' })).toBe(
      '5 dana ne nose ovaj obim uz dugi ≤ 105 min; preporuka 6 dana.'
    );
    expect(msgOf({ weeks: 12, km: 80, vdot: 30, days: d[6].A.days, long: 'sun' })).toBe(
      '6 dana ne nose ovaj obim uz dugi ≤ 105 min.'
    );
  });
});
