import { describe, expect, it } from 'vitest';
import { generateMarathonV2 } from './generate.ts';
import {
  jumpBase10,
  longJumpCap10,
  longTimeCap10,
  recentLongNote,
  recentLongThreshold10
} from './lengths.ts';
import { planRule } from './policy.ts';
import { inputOf, SCHEDULES, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { WeekFrame } from './types.ts';
import { capacityMessage, fit10, growth10, nominal10, peakCap10 } from './volume.ts';

/* M6 obim (jedini vlasnik cilja; pouke 1 i 9), M5/M7 ciljevi rasterećenja i tapera. */

const rule = planRule(4)!;
const frame = (over: Partial<WeekFrame> = {}): WeekFrame => ({
  index: 5,
  startDate: '2026-11-30',
  endDate: '2026-12-06',
  phase: 'base',
  deload: false,
  ...over
});

describe('M6 pravilo obima', () => {
  it('rast +6 % (min 1,0, max 5,0 km, korak 0,1)', () => {
    expect(growth10(100, rule)).toBe(10); // 10 km → +1,0 (min)
    expect(growth10(450, rule)).toBe(27); // 45 km → +2,7
    expect(growth10(800, rule)).toBe(48);
    expect(growth10(900, rule)).toBe(50); // max 5,0
  });

  it('granica izgradnje = min(start × 1,5; start + 30; 80 km)', () => {
    expect(peakCap10(350, rule)).toBe(525);
    expect(peakCap10(600, rule)).toBe(800);
    expect(peakCap10(650, rule)).toBe(800);
  });

  it('cilj po pravilu: ned 1 start; izgradnja rast do granice; rasterećenje 0,8 ×; taper 0,8 / 0,6 × vrh', () => {
    const h = { lastBuild10: 500, peak10: 600 };
    expect(nominal10(frame(), { lastBuild10: null, peak10: 0 }, 450, 675, null, rule)).toBe(450);
    expect(nominal10(frame(), h, 450, 675, null, rule)).toBe(530);
    expect(nominal10(frame(), { lastBuild10: 660, peak10: 660 }, 450, 675, null, rule)).toBe(675);
    expect(nominal10(frame({ deload: true }), h, 450, 675, null, rule)).toBe(400);
    expect(nominal10(frame({ phase: 'taper' }), h, 450, 675, 0, rule)).toBe(480);
    expect(nominal10(frame({ phase: 'taper' }), h, 450, 675, 1, rule)).toBe(360);
  });

  it('pouka 1: neizvodljiv cilj → najbliži izvodljiv (pri jednakoj udaljenosti niži); ned 1, rasterećenje i taper samo naniže', () => {
    expect(fit10(500, frame(), 600, rule, (t) => t === 495 || t === 505)).toEqual({
      target10: 495,
      fitted: 'down'
    });
    expect(fit10(500, frame(), 600, rule, (t) => t === 520)).toEqual({
      target10: 520,
      fitted: 'up'
    });
    expect(fit10(500, frame(), 510, rule, (t) => t === 520)).toBeNull();
    expect(fit10(500, frame({ deload: true }), 600, rule, (t) => t === 520)).toBeNull();
    expect(fit10(500, frame({ phase: 'taper' }), 600, rule, (t) => t === 520)).toBeNull();
    expect(fit10(500, frame({ index: 1 }), 600, rule, (t) => t === 520)).toBeNull();
    expect(fit10(500, frame(), 600, rule, (t) => t < 200)).toBeNull(); // ispod minimuma nedelje (20 km)
  });

  it('poruka kapaciteta imenuje ograničenje; preporuka više dana samo kad veći broj dana postoji u M15 (6 dana bez)', () => {
    expect(capacityMessage(4, rule, ['time'])).toBe(
      '4 dana ne nose ovaj obim uz dugi ≤ 150 min; preporuka 5–6 dana.'
    );
    expect(capacityMessage(4, rule, ['share'])).toBe(
      '4 dana ne nose ovaj obim uz dugi ≤ 40 % nedelje; preporuka 5–6 dana.'
    );
    expect(capacityMessage(4, rule, ['time', 'share'])).toBe(
      '4 dana ne nose ovaj obim uz dugi ≤ 150 min i ≤ 40 % nedelje; preporuka 5–6 dana.'
    );
    expect(capacityMessage(3, planRule(3)!, ['share'])).toBe(
      '3 dana ne nose ovaj obim uz dugi ≤ 50 % nedelje; preporuka 4–6 dana.'
    );
    expect(capacityMessage(5, planRule(5)!, ['time'])).toBe(
      '5 dana ne nose ovaj obim uz dugi ≤ 150 min; preporuka 6 dana.'
    );
    expect(capacityMessage(6, planRule(6)!, ['time'])).toBe(
      '6 dana ne nose ovaj obim uz dugi ≤ 150 min.'
    );
  });
});

describe('M6 u planu (pouke 1 i 9)', () => {
  it('pouka 9: spor trkač velikog obima — ned 1 ispod obima samo uz dugi ned 1 na 150 min', () => {
    const r = generateMarathonV2(inputOf({ weeks: 16, km: 65, vdot: 30, days: SCHEDULES.A.days }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w1 = r.plan.weeks[0]!;
    expect(w1.targetKm).toBeLessThan(65);
    const long = w1.days.find((d) => d.role === 'long')!;
    expect(Math.round(long.workout.km * 10)).toBe(longTimeCap10(r.plan.paces));
    expect(r.plan.warnings.map((w) => w.rule)).toContain('CAPACITY_LIMITED');
  });

  it('pouka 1: rast posle spuštene nedelje meri se od stvarnog cilja; granica izgradnje se ne spušta', () => {
    const r = generateMarathonV2(inputOf({ weeks: 20, km: 55, vdot: 35, days: SCHEDULES.A.days }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.plan;
    expect(p.peakCapKm).toBe(80);
    const steady = p.weeks.filter(
      (w) => !w.deload && ['base', 'development', 'specific'].includes(w.phase)
    );
    for (let i = 1; i < steady.length; i++) {
      const last = Math.round(steady[i - 1]!.targetKm * 10);
      expect(Math.round(steady[i]!.nominalKm * 10)).toBe(
        Math.min(last + growth10(last, rule), 800)
      );
    }
    expect(steady.some((w) => w.fitted === 'down')).toBe(true);
  });
});

describe('M13a (pouka 28): skok dugog ≤ max(1,1 × L; L + 1,0), L = najduži dugi prethodne 4 nedelje (skorašnji = ned 0)', () => {
  const at = (recentLongRunKm: number | null, km = 45, days = SCHEDULES.A.days, weeks = 16) => {
    const r = generateMarathonV2(inputOf({ weeks, km, vdot: 45, days, recentLongRunKm }));
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    return r.plan;
  };
  const longs = (p: ReturnType<typeof at>): number[] =>
    p.weeks.map((w) => w.days.find((d) => d.role === 'long')?.workout.km ?? 0);

  it('plafon: L iz prethodne 4 nedelje i skorašnjeg (ned 0 → ulazi za ned 1–4); max(1,1 L; L + 1), naniže', () => {
    expect(longJumpCap10([], 1, 10)).toBe(110);
    expect(longJumpCap10([], 1, 8)).toBe(90);
    expect(longJumpCap10([], 1, 12.3)).toBe(135);
    expect(longJumpCap10([], 1, null)).toBeNull();
    // r ulazi za nedelje 1–4, ne za 5.
    expect(jumpBase10([100, 100, 100], 4, 20)).toBe(200);
    expect(jumpBase10([100, 100, 100, 100], 5, 20)).toBe(100);
    // Prozor 4 nedelje; trkačka (null) se preskače.
    expect(jumpBase10([200, 120, 120, 120, 120], 6, null)).toBe(120);
    expect(jumpBase10([200, 120, 120, 120], 5, null)).toBe(200);
    expect(longJumpCap10([140, 150], 3, null)).toBe(165);
    // Prag napomene: X/1,1 naviše na 0,1 (X ≥ 11 km), X − 1 za X < 11 km.
    expect([140, 180, 100].map(recentLongThreshold10)).toEqual([128, 164, 90]);
    expect(recentLongNote(180)).toBe(
      'Dugi 18,0 km: ako ti je skorašnje najduže trčanje kraće od 16,4 km, unesi ga — plan počinje od njega (M13a).'
    );
  });

  it('kratak skorašnji dugi: dugi raste ≤ 10 % (ili + 1,0 km) svake nedelje; ned 1 ispod obima, bez CAPACITY_LIMITED', () => {
    const p = at(10);
    const l = longs(p);
    expect(l[0]).toBe(11);
    expect(p.weeks[0]!.targetKm).toBeLessThan(45);
    expect(p.warnings.map((w) => w.rule)).not.toContain('CAPACITY_LIMITED');
    const all = [10, ...l];
    for (let i = 1; i < all.length; i++) {
      if (all[i] === 0) continue;
      const m = Math.max(...all.slice(Math.max(0, i - 4), i));
      expect(all[i]!, `ned ${i}`).toBeLessThanOrEqual(Math.max(1.1 * m, m + 1) + 1e-9);
    }
    expect(
      p.weeks.filter((w) => w.notes.some((n) => n.includes('plafon skoka'))).length
    ).toBeGreaterThan(2);
  });

  it('r + 1,0 za kratke (r = 8 → 9,0 km)', () => {
    expect(longs(at(8))[0]).toBe(9);
  });

  it('RECENT_LONG_TOO_SHORT (pouka 6): neizvodljiva konstrukcija sa datim r → odbijanje sa preporukom', () => {
    const r = generateMarathonV2(
      inputOf({ weeks: 12, km: 35, vdot: 30, days: SCHEDULES.A.days, recentLongRunKm: 5 })
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons[0]!.code).toBe('RECENT_LONG_TOO_SHORT');
    expect(r.reasons[0]!.message).toMatch(
      /Skorašnje najduže trčanje 5,0 km je prekratko za 35,0 km nedeljno sa 4 dana i 12 nedelja do trke: dugi raste najviše max\(10 %, 1 km\).*Preporuka: produži dugo trčanje, duža priprema, manji početni obim ili više dana, ili polumaraton/
    );
  });

  it('plafon iznad dugog po pravilu: plan isti kao bez ulaza (osim napomene ned 1 i ključa ulaza)', () => {
    const a = at(null);
    const b = at(30);
    const strip = (x: ReturnType<typeof at>) =>
      JSON.stringify({
        ...x,
        input: { ...x.input, recentLongRunKm: undefined },
        weeks: x.weeks.map((w) => ({
          ...w,
          notes: w.notes.filter((n) => !n.includes('(M13a)'))
        }))
      });
    expect(strip(b)).toBe(strip(a));
    expect(a.weeks[0]!.notes).toContain(recentLongNote(Math.round(longs(a)[0]! * 10)));
    expect(b.weeks[0]!.notes.some((n) => n.includes('(M13a)'))).toBe(false);
  });

  it('svaki broj dana: dugi ned 1 ≤ plafon, ned 1 ≤ obim', () => {
    for (const n of [3, 4, 5, 6] as const) {
      const km = n === 6 ? 60 : 45;
      const p = at(12, km, SCHEDULES_BY_DAYS[n].A.days);
      expect(Math.round(longs(p)[0]! * 10), `${n}`).toBeLessThanOrEqual(longJumpCap10([], 1, 12)!);
      expect(p.weeks[0]!.targetKm, `${n}`).toBeLessThanOrEqual(km);
    }
  });
});
