/* H6 obim (pouke 1 i 9): rast, granica vrha, cilj iz stvarne konstrukcije, najbliži izvodljiv cilj; H5/H7
   cilj rasterećenja i tapera. */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { dayRule } from './policy.ts';
import { gridInputs } from './testInputs.ts';
import type { WeekFrame } from './types.ts';
import {
  capacityMessage,
  fit10,
  growth10,
  INITIAL_VOLUME,
  leaveWeek,
  nominal10,
  peakCap10,
  weekMin10
} from './volume.ts';

const rule = dayRule(4)!;
const frame = (o: Partial<WeekFrame>): WeekFrame => ({
  index: 2,
  startDate: '2026-11-09',
  endDate: '2026-11-15',
  phase: 'base',
  deload: false,
  ...o
});

describe('H6 pravilo obima', () => {
  it('rast +6 % (min 1,0, max 4,0 km)', () => {
    expect(growth10(300)).toBe(18);
    expect(growth10(100)).toBe(10);
    expect(growth10(700)).toBe(40);
    expect(growth10(500)).toBe(30);
  });

  it('granica vrha = min(start × 1,4; start + 20; 70 km)', () => {
    expect(peakCap10(300, rule)).toBe(420);
    expect(peakCap10(450, rule)).toBe(630);
    expect(peakCap10(550, rule)).toBe(700);
    expect(peakCap10(600, rule)).toBe(700);
  });

  it('nedelja 1 = trenutni; izgradnja od cilja koji je nedelja stvarno dobila; rasterećenje 0,8 ×; taper 0,7 × vrh', () => {
    let h = INITIAL_VOLUME;
    expect(nominal10(frame({ index: 1 }), h, 400, 560)).toBe(400);
    h = leaveWeek(h, frame({ index: 1 }), 395); // spuštena nedelja: rast od 39,5
    expect(nominal10(frame({}), h, 400, 560)).toBe(395 + 24);
    expect(nominal10(frame({ deload: true }), h, 400, 560)).toBe(316);
    h = leaveWeek(h, frame({ deload: true }), 316); // rasterećenje ne menja osnov ni vrh
    expect(h).toEqual({ lastBuild10: 395, peak10: 395 });
    expect(nominal10(frame({ phase: 'taper' }), h, 400, 560)).toBe(Math.round(0.7 * 395));
    expect(nominal10(frame({}), { lastBuild10: 550, peak10: 550 }, 400, 560)).toBe(560);
  });

  it('najbliži izvodljiv cilj: izgradnja naviše do granice; rasterećenje i taper samo naniže; ne ispod 16 km', () => {
    const at = (ok: number[]) => (t: number) => ok.includes(t);
    expect(fit10(400, frame({}), 560, rule, at([400]))).toEqual({ target10: 400, fitted: null });
    expect(fit10(400, frame({}), 560, rule, at([397, 403]))).toEqual({
      target10: 397,
      fitted: 'down'
    });
    expect(fit10(400, frame({}), 560, rule, at([402, 390]))).toEqual({
      target10: 402,
      fitted: 'up'
    });
    expect(fit10(400, frame({}), 401, rule, at([402]))).toBeNull();
    expect(fit10(300, frame({ deload: true }), 560, rule, at([301]))).toBeNull();
    expect(fit10(300, frame({ phase: 'taper' }), 560, rule, at([290]))).toEqual({
      target10: 290,
      fitted: 'down'
    });
    expect(fit10(170, frame({}), 560, rule, at([159]))).toBeNull();
    expect(weekMin10(rule)).toBe(160);
  });

  it('poruka kapaciteta imenuje ograničenje (segment 01: nema većeg broja dana za preporuku)', () => {
    expect(capacityMessage(4, rule, ['time'])).toBe('4 dana ne nose ovaj obim uz dugi ≤ 150 min.');
    expect(capacityMessage(4, rule, ['time', 'share'])).toBe(
      '4 dana ne nose ovaj obim uz dugi ≤ 150 min i ≤ 40 % nedelje.'
    );
  });
});

describe('H6 u planu (pouke 1 i 9)', () => {
  const GRID = gridInputs();
  const plan = (id: string) => {
    const r = generateHmV2(GRID.find((g) => g.id === id)!.input);
    if (!r.ok) throw new Error(id);
    return r.plan;
  };

  it('vrh = min(1,4 × start, start + 20, 70) kad kapacitet dozvoljava', () => {
    expect([plan('12w-40km-v45-A-sun').peakKm, plan('18w-60km-v55-B-sun').peakKm]).toEqual([
      56, 70
    ]);
  });

  it('kapacitet: spuštena nedelja samo ta (napomena), granica izgradnje se ne spušta, vrh < granica uz CAPACITY_LIMITED', () => {
    const p = plan('16w-50km-v30-C-sat');
    expect(p.peakCapKm).toBe(70);
    expect(p.peakKm).toBeLessThan(70);
    const down = p.weeks.filter((w) => w.fitted === 'down');
    expect(down.length).toBeGreaterThan(0);
    for (const w of down) expect(w.notes[0]).toContain('najbliži izvodljiv cilj');
    expect(p.warnings.filter((w) => w.rule === 'CAPACITY_LIMITED')).toHaveLength(1);
  });

  it('pouka 9: nedelja 1 ispod trenutnog obima samo uz dugi nedelje 1 na 150 min', () => {
    const p = plan('10w-60km-v30-A-sun');
    expect(p.weeks[0]!.targetKm).toBeLessThan(60);
    const long = p.weeks[0]!.days.find((d) => d.role === 'long')!.workout.km;
    expect(long).toBe(Math.floor((9000 / p.paces.E.slow) * 10) / 10);
    expect(plan('10w-60km-v45-A-sun').weeks[0]!.targetKm).toBe(60);
  });
});
