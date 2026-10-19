import { describe, expect, it } from 'vitest';
import { generateMarathonV2 } from './generate.ts';
import { longTimeCap10 } from './lengths.ts';
import { dayRule } from './policy.ts';
import { inputOf, SCHEDULES } from './testInputs.ts';
import type { WeekFrame } from './types.ts';
import { capacityMessage, fit10, growth10, nominal10, peakCap10 } from './volume.ts';

/* M6 obim (jedini vlasnik cilja; pouke 1 i 9), M5/M7 ciljevi rasterećenja i tapera. */

const rule = dayRule(4)!;
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
    expect(growth10(100)).toBe(10); // 10 km → +1,0 (min)
    expect(growth10(450)).toBe(27); // 45 km → +2,7
    expect(growth10(800)).toBe(48);
    expect(growth10(900)).toBe(50); // max 5,0
  });

  it('granica izgradnje = min(start × 1,5; start + 30; 80 km)', () => {
    expect(peakCap10(350, rule)).toBe(525);
    expect(peakCap10(600, rule)).toBe(800);
    expect(peakCap10(650, rule)).toBe(800);
  });

  it('cilj po pravilu: ned 1 start; izgradnja rast do granice; rasterećenje 0,8 ×; taper 0,8 / 0,6 × vrh', () => {
    const h = { lastBuild10: 500, peak10: 600 };
    expect(nominal10(frame(), { lastBuild10: null, peak10: 0 }, 450, 675, null)).toBe(450);
    expect(nominal10(frame(), h, 450, 675, null)).toBe(530);
    expect(nominal10(frame(), { lastBuild10: 660, peak10: 660 }, 450, 675, null)).toBe(675);
    expect(nominal10(frame({ deload: true }), h, 450, 675, null)).toBe(400);
    expect(nominal10(frame({ phase: 'taper' }), h, 450, 675, 0)).toBe(480);
    expect(nominal10(frame({ phase: 'taper' }), h, 450, 675, 1)).toBe(360);
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

  it('poruka kapaciteta imenuje ograničenje; 4 dana su najveći broj u segmentu 01 (bez preporuke dana)', () => {
    expect(capacityMessage(4, rule, ['time'])).toBe('4 dana ne nose ovaj obim uz dugi ≤ 150 min.');
    expect(capacityMessage(4, rule, ['share'])).toBe(
      '4 dana ne nose ovaj obim uz dugi ≤ 40 % nedelje.'
    );
    expect(capacityMessage(4, rule, ['time', 'share'])).toBe(
      '4 dana ne nose ovaj obim uz dugi ≤ 150 min i ≤ 40 % nedelje.'
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
      expect(Math.round(steady[i]!.nominalKm * 10)).toBe(Math.min(last + growth10(last), 800));
    }
    expect(steady.some((w) => w.fitted === 'down')).toBe(true);
  });
});
