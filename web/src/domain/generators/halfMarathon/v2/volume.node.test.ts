/* H6 obim (pouke 1 i 9): rast, granica vrha, cilj iz stvarne konstrukcije, najbliži izvodljiv cilj; H5/H7
   cilj rasterećenja i tapera. */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { pacesFromVdot } from './paces.ts';
import { planRule } from './policy.ts';
import { gridInputs } from './testInputs.ts';
import type { WeekFrame } from './types.ts';
import {
  capacityMessage,
  fewerDaysAdvice,
  fit10,
  growth10,
  INITIAL_VOLUME,
  leaveWeek,
  nominal10,
  growLeft,
  peakCap10,
  peakHoursCap10,
  step10,
  weekMin10
} from './volume.ts';

const rule = planRule(4, 'regular')!;
const dayRule = (n: number) => planRule(n, 'regular');
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
    expect(growth10(300, rule)).toBe(18);
    expect(growth10(100, rule)).toBe(10);
    expect(growth10(700, rule)).toBe(40);
    expect(growth10(500, rule)).toBe(30);
  });

  it('granica vrha = min(start × 1,4; start + 20; 70 km)', () => {
    expect(peakCap10(300, rule)).toBe(420);
    expect(peakCap10(450, rule)).toBe(630);
    expect(peakCap10(550, rule)).toBe(700);
    expect(peakCap10(600, rule)).toBe(700);
  });

  it('P8 G1: granica vrha i ≤ start × faktor po dužini pripreme i ≤ satni plafon; start iznad plafona → vrh = start', () => {
    const p45 = pacesFromVdot(45);
    expect(peakCap10(400, rule, { weeks: 12, p: p45 })).toBe(520); // ≤ 12 ned: 1,30
    expect(peakCap10(400, rule, { weeks: 14, p: p45 })).toBe(540); // 13–15 ned: 1,35
    expect(peakCap10(400, rule, { weeks: 16, p: p45 })).toBe(560); // ≥ 16 ned: 1,40
    // VDOT 30: 7,5 h srednjim laganim tempom — plafon ispod 1,4 × start.
    const p30 = pacesFromVdot(30);
    const h10 = peakHoursCap10(p30);
    expect(h10).toBe(Math.floor(((7.5 * 3600) / ((p30.E.fast + p30.E.slow) / 2)) * 10 + 1e-9));
    expect(peakCap10(500, rule, { weeks: 20, p: p30 })).toBe(Math.max(500, Math.min(700, h10)));
    expect(peakCap10(600, rule, { weeks: 20, p: p30 })).toBe(600); // start već iznad satnog plafona
    expect(peakHoursCap10(pacesFromVdot(45))).toBeGreaterThan(peakHoursCap10(p30));
  });

  it('P8 G1: korak = min(H6; (vrh − poslednji) / preostale nedelje do kraja razvoja); < 3 % se ne primenjuje', () => {
    expect(step10(400, 560, rule, 1)).toBe(24); // korak H6
    expect(step10(400, 560, rule, 10)).toBe(16); // 16 km na 10 nedelja = 1,6 km ≥ 3 %
    expect(step10(500, 560, rule, 6)).toBe(0); // 1,0 km < 3 % od 50 km → nedelja zadržava cilj
    expect(step10(500, 560, rule, 3)).toBe(20);
    expect(step10(550, 560, rule, 1)).toBe(0); // ostatak 1,0 km < 3 %
    expect(step10(560, 560, rule, 1)).toBe(0);
    const frames = [
      { index: 1, phase: 'base', deload: false },
      { index: 2, phase: 'base', deload: true },
      { index: 3, phase: 'development', deload: false },
      { index: 4, phase: 'specific', deload: false }
    ];
    expect([1, 2, 3, 4].map((i) => growLeft(frames, i))).toEqual([2, 1, 1, 1]);
  });

  it('nedelja 1 = trenutni; izgradnja od cilja koji je nedelja stvarno dobila; rasterećenje 0,8 ×; taper 0,7 × vrh', () => {
    let h = INITIAL_VOLUME;
    expect(nominal10(frame({ index: 1 }), h, 400, 560, rule)).toBe(400);
    h = leaveWeek(h, frame({ index: 1 }), 395); // spuštena nedelja: rast od 39,5
    expect(nominal10(frame({}), h, 400, 560, rule)).toBe(395 + 24);
    expect(nominal10(frame({ deload: true }), h, 400, 560, rule)).toBe(316);
    h = leaveWeek(h, frame({ deload: true }), 316); // rasterećenje ne menja osnov ni vrh
    expect(h).toEqual({ lastBuild10: 395, peak10: 395 });
    expect(nominal10(frame({ phase: 'taper' }), h, 400, 560, rule)).toBe(Math.round(0.7 * 395));
    // P8 G1: ostatak do vrha 1,0 km < 3 % → cilj ostaje; raspoređen rast (3 nedelje do kraja razvoja).
    expect(nominal10(frame({}), { lastBuild10: 550, peak10: 550 }, 400, 560, rule)).toBe(550);
    expect(nominal10(frame({}), { lastBuild10: 500, peak10: 500 }, 400, 560, rule, 3)).toBe(520);
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

  it('poruka kapaciteta imenuje ograničenje i preporučuje veće brojeve dana iz H15 (HI8, HI9 a)', () => {
    expect(capacityMessage(4, rule, ['time'])).toBe(
      'Sa 4 dana trčanja ne staje ceo planirani obim: dugi najviše 150 min; preporuka 5–6 dana.'
    );
    expect(capacityMessage(4, rule, ['time', 'share'])).toBe(
      'Sa 4 dana trčanja ne staje ceo planirani obim: dugi najviše 150 min i najviše 40 % nedelje; preporuka 5–6 dana.'
    );
    expect(capacityMessage(3, dayRule(3)!, ['share', 'km'])).toBe(
      'Sa 3 dana trčanja ne staje ceo planirani obim: dugi najviše 45 % nedelje i najviše 24 km; preporuka 4–6 dana.'
    );
    expect(capacityMessage(5, dayRule(5)!, ['rolling'])).toBe(
      'Sa 5 dana trčanja ne staje ceo planirani obim: dugi raste najviše 10 % ili 1 km iznad najdužeg u prethodne 4 nedelje; preporuka 6 dana.'
    );
    expect(capacityMessage(6, dayRule(6)!, ['time'])).toBe(
      'Sa 6 dana trčanja ne staje ceo planirani obim: dugi najviše 150 min.'
    );
    expect(capacityMessage(4, rule, ['recent', 'easy'], 8)).toBe(
      'Sa 4 dana trčanja ne staje ceo planirani obim: dugi raste najviše 10 % ili 1 km nedeljno, počevši od skorašnjeg najdužeg trčanja (8,0 km), a lagani najviše 70 % dugog; preporuka 5–6 dana.'
    );
  });

  it('HI3: preporuka manje dana samo kad red sa manje dana podržava obim', () => {
    expect(fewerDaysAdvice(4, 30, rule)).toContain('preporuka 3 dana');
    expect(fewerDaysAdvice(6, 40, dayRule(6)!)).toContain('preporuka 3–5 dana');
    expect(fewerDaysAdvice(6, 80, dayRule(6)!)).toBe('');
    expect(fewerDaysAdvice(3, 30, dayRule(3)!)).toBe('');
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
    // P8 G1: 12 ned → 1,30 × 40 = 52; 18 ned, 60 km → 70. Poslednji korak ispod 3 % se ne primenjuje (vrh ≤ granica).
    const [a, b] = [plan('12w-40km-v45-A-sun'), plan('18w-60km-v55-B-sun')];
    expect([a.peakCapKm, b.peakCapKm]).toEqual([52, 70]);
    expect([a.peakKm, b.peakKm]).toEqual([50.5, 68]);
    for (const p of [a, b]) expect((p.peakCapKm - p.peakKm) / p.peakKm).toBeLessThan(0.03);
  });

  it('kapacitet: spuštena nedelja samo ta (napomena), granica izgradnje se ne spušta, vrh < granica uz CAPACITY_LIMITED', () => {
    const p = plan('16w-50km-v30-C-sat');
    // P8 G1: VDOT 30 — satni plafon 7,5 h (56,1 km) ispod 1,4 × 50.
    expect(p.peakCapKm).toBe(56.1);
    expect(p.peakKm).toBeLessThan(56.1);
    const down = p.weeks.filter((w) => w.fitted === 'down');
    expect(down.length).toBeGreaterThan(0);
    for (const w of down) expect(w.notes[0]).toContain('najbliži izvodljiv cilj');
    expect(p.warnings.filter((w) => w.rule === 'CAPACITY_LIMITED')).toHaveLength(1);
  });

  it('CAPACITY_LIMITED kod sporog trkača sa 4 dana preporučuje 5–6 dana (HI9 a)', () => {
    const p = plan('16w-50km-v30-C-sat');
    expect(p.warnings.find((w) => w.rule === 'CAPACITY_LIMITED')!.message).toContain(
      'preporuka 5–6 dana'
    );
  });

  it('pouka 9: nedelja 1 ispod trenutnog obima samo uz dugi nedelje 1 na 150 min', () => {
    const p = plan('10w-60km-v30-A-sun');
    expect(p.weeks[0]!.targetKm).toBeLessThan(60);
    const long = p.weeks[0]!.days.find((d) => d.role === 'long')!.workout.km;
    expect(long).toBe(Math.floor((9000 / p.paces.E.slow) * 10) / 10);
    expect(plan('10w-60km-v45-A-sun').weeks[0]!.targetKm).toBe(60);
  });
});
