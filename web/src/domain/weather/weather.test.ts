import { describe, expect, it } from 'vitest';
import {
  coolestHour,
  forecastAt,
  heatAdjustedPace,
  heatAdvice,
  heatFor,
  parseForecast,
  runHour,
  runTemperature,
  trainingHour,
  type HourlyForecast
} from './index';

/* parity: test/temperatura-trcanja.test.mjs. Namera: temperatura odrađenog trčanja je vrednost iz prognoze za
   SREDINU trčanja; očitavanje sa sata je rezerva koja UVEK nosi oznaku izvora. */

const hours: HourlyForecast = {
  '2026-07-12T08': { temp: 20, feel: 21, humidity: 50, wind: 5, rain: 0 },
  '2026-07-12T09': { temp: 24, feel: 26, humidity: 50, wind: 5, rain: 0 },
  '2026-07-12T10': { temp: 28, feel: 31, humidity: 50, wind: 5, rain: 0 },
  '2026-07-12T18': { temp: 30, feel: 33, humidity: 40, wind: 8, rain: 10 }
};

describe('temperatura odrađenog trčanja', () => {
  it('uzima SREDINU trčanja: dvočasovno trčanje od 8:40 pada u 10 h', () => {
    expect(runHour({ satTrk: 8, sec: 7200 }, 18)).toBe(9);
    expect(runHour({ satTrk: 8.67, sec: 7200 }, 18)).toBe(10);
    expect(runHour({ satTrk: 8, sec: 1800 }, 18)).toBe(8);
  });
  it('prelazak preko ponoći se ne prati: najviše 23 h; nepoznat početak pada na sat treninga', () => {
    expect(runHour({ satTrk: 23, sec: 20000 }, 18)).toBe(23);
    expect(runHour({}, 18)).toBe(18);
    expect(runHour({ satTrk: 'x' }, 7)).toBe(7);
    expect(runHour({ satTrk: 30 }, 7)).toBe(7);
  });
  it('prognoza je merodavna, a sat je samo rezerva sa oznakom izvora', () => {
    const om = runTemperature({ satTrk: 18, sec: 600, temp: 36 }, '2026-07-12', hours, 18);
    expect(om).toMatchObject({ temp: 30, feel: 33, source: 'om' });
    const watch = runTemperature(
      { satTrk: 18, sec: 600, temp: 36, icu: { osecaSe: 38 } },
      '2026-06-01',
      hours,
      18
    );
    expect(watch).toMatchObject({ temp: 36, feel: 38, source: 'watch' });
    expect(runTemperature({ satTrk: 18 }, '2026-06-01', hours, 18)).toBeNull();
    expect(runTemperature(null, '2026-07-12', hours, 18)).toBeNull();
  });
  it('osećaj sa sata se NE meša sa osećajem iz prognoze', () => {
    const r = runTemperature({ satTrk: 18, temp: 36 }, '2026-07-12', hours, 18);
    expect(r?.feel).toBe(33);
    const w = runTemperature({ satTrk: 18, temp: 36 }, undefined, hours, 18);
    expect(w).toMatchObject({ source: 'watch', feel: null });
  });
});

describe('hladniji sat', () => {
  it('nudi se samo kad je razlika bar 3 °C', () => {
    expect(coolestHour(hours, '2026-07-12', 18, '2026-07-12', 6)).toMatchObject({
      hour: 8,
      feel: 21
    });
    expect(coolestHour(hours, '2026-07-12', 9, '2026-07-12', 6)?.hour).toBe(8); // 26 naspram 21
    expect(coolestHour(hours, '2026-07-12', 8, '2026-07-12', 6)).toBeNull(); // izabrani je već najhladniji
  });
  it('za DANAS se gledaju samo sati koji tek dolaze („idi u 8:00" u 9 h nije savet)', () => {
    // sada je 9 h: ostaju 10 (31) i 18 (33); razlika od izabranog 18 je 2 < 3 → bez saveta
    expect(coolestHour(hours, '2026-07-12', 18, '2026-07-12', 9)).toBeNull();
    // drugi dan se gleda ceo prozor
    expect(coolestHour(hours, '2026-07-12', 18, '2026-07-11', 9)?.hour).toBe(8);
  });
  it('bez prognoze nema saveta', () => {
    expect(coolestHour(null, '2026-07-12', 18, '2026-07-12', 6)).toBeNull();
    expect(forecastAt(null, '2026-07-12', 9)).toBeNull();
  });
});

describe('vrućina', () => {
  it('nivoi i tempo uz vrućinu', () => {
    expect(heatFor(36)?.pct).toBe(8);
    expect(heatFor(31)?.pct).toBe(6);
    expect(heatFor(16)?.pct).toBe(1);
    expect(heatFor(5)?.pct).toBe(0);
    expect(heatAdvice(heatFor(36))).toContain('pomeri ili zameni');
    expect(heatAdjustedPace(250, 6)).toBe(265);
  });
  it('sat treninga: 0–23 iz podešavanja, inače 18', () => {
    expect(trainingHour(6)).toBe(6);
    expect(trainingHour(0)).toBe(0);
    expect(trainingHour(24)).toBe(18);
    expect(trainingHour(null)).toBe(18);
    expect(trainingHour('x')).toBe(18);
  });
  it('parseForecast odbacuje oblik koji nije prognoza', () => {
    expect(
      parseForecast({ hourly: { time: ['2026-07-12T09:00'], temperature_2m: [24.04] } })?.[
        '2026-07-12T09'
      ]?.temp
    ).toBe(24);
    expect(parseForecast({})).toBeNull();
    expect(parseForecast(null)).toBeNull();
  });
});
