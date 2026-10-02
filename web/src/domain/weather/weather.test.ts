import { describe, expect, it } from 'vitest';
import {
  bestHour,
  heatAdjustedPace,
  heatAdvice,
  heatFor,
  hourFor,
  parseForecast,
  runHour,
  runTemp,
  trainingHour,
  weatherCard,
  type ForecastCache
} from './index';

/* parity: test/temperatura-trcanja.test.mjs. Namera: temperatura odrađenog trčanja je vrednost iz prognoze za
   SREDINU trčanja; očitavanje sa sata je rezerva koja UVEK nosi oznaku izvora. Stari kod je diferencijalno
   dokazan u `weather.oracle.test.ts`; ovo su čitljivi slučajevi koji rade i bez njega. Polja prognoze imaju
   SRPSKA imena (`osecaj`, `vlaga`, …) jer se keš čuva u stanju koje čita i stari klijent. */

const hour = (temp: number, osecaj: number, kisa = 0) => ({
  temp,
  osecaj,
  vlaga: 50,
  vetar: 5,
  kisa
});
const cache = (extra: Record<string, ReturnType<typeof hour>> = {}): ForecastCache => ({
  at: 1,
  lat: 1,
  lon: 2,
  sati: {
    '2026-07-12T08': hour(20, 21),
    '2026-07-12T09': hour(24, 26),
    '2026-07-12T10': hour(28, 31),
    '2026-07-12T18': hour(30, 33, 10),
    ...extra
  }
});
const hours = cache();

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
    const om = runTemp({ satTrk: 18, sec: 600, temp: 36 }, '2026-07-12', hours, 18);
    expect(om).toMatchObject({ temp: 30, osecaj: 33, izvor: 'om' });
    const watch = runTemp(
      { satTrk: 18, sec: 600, temp: 36, icu: { osecaSe: 38 } },
      '2026-06-01',
      hours,
      18
    );
    expect(watch).toMatchObject({ temp: 36, osecaj: 38, izvor: 'sat' });
    expect(runTemp({ satTrk: 18 }, '2026-06-01', hours, 18)).toBeNull();
    expect(runTemp(null, '2026-07-12', hours, 18)).toBeNull();
  });
  it('osećaj sa sata se NE meša sa osećajem iz prognoze', () => {
    const r = runTemp({ satTrk: 18, temp: 36 }, '2026-07-12', hours, 18);
    expect(r?.osecaj).toBe(33);
    const w = runTemp({ satTrk: 18, temp: 36 }, undefined, hours, 18);
    expect(w).toMatchObject({ izvor: 'sat', osecaj: null });
  });
});

describe('hladniji sat', () => {
  it('nudi se samo kad je razlika bar 3 °C', () => {
    expect(bestHour(hours, '2026-07-12', 18, '2026-07-12', 6)).toMatchObject({
      hour: 8,
      osecaj: 21
    });
    expect(bestHour(hours, '2026-07-12', 9, '2026-07-12', 6)?.hour).toBe(8); // 26 naspram 21
    expect(bestHour(hours, '2026-07-12', 8, '2026-07-12', 6)).toBeNull(); // izabrani je već najhladniji
  });
  it('za DANAS se gledaju samo sati koji tek dolaze („idi u 8:00" u 9 h nije savet)', () => {
    // sada je 9 h: ostaju 10 (31) i 18 (33); razlika od izabranog 18 je 2 < 3 → bez saveta
    expect(bestHour(hours, '2026-07-12', 18, '2026-07-12', 9)).toBeNull();
    // drugi dan se gleda ceo prozor
    expect(bestHour(hours, '2026-07-12', 18, '2026-07-11', 9)?.hour).toBe(8);
  });
  it('bez prognoze nema saveta', () => {
    expect(bestHour(null, '2026-07-12', 18, '2026-07-12', 6)).toBeNull();
    expect(hourFor(null, '2026-07-12', 9)).toBeNull();
  });
});

describe('vrućina', () => {
  it('nivoi i tempo uz vrućinu', () => {
    expect(heatFor(36)?.pct).toBe(8);
    expect(heatFor(31)?.pct).toBe(6);
    expect(heatFor(16)?.pct).toBe(1);
    expect(heatFor(5)?.pct).toBe(0);
    expect(heatAdvice(heatFor(36))).toContain('pomeri ili zameni');
    expect(heatAdvice(heatFor(26))).toBe(
      'Toplo — ciljni tempo je realno oko 4 % sporiji. To nije pad forme.'
    );
    expect(heatAdjustedPace(250, 6)).toBe(265);
  });
  it('sat treninga: 0–23 iz podešavanja, inače 18', () => {
    expect(trainingHour(6)).toBe(6);
    expect(trainingHour(0)).toBe(0);
    expect(trainingHour(24)).toBe(18);
    expect(trainingHour(null)).toBe(18);
    expect(trainingHour('x')).toBe(18);
  });
  it('parseForecast: srpska imena polja, jedna decimala, bez „−0"; odbacuje oblik koji nije prognoza', () => {
    const p = parseForecast({
      hourly: {
        time: ['2026-07-12T09:00'],
        temperature_2m: [24.04],
        apparent_temperature: [-0.04],
        relative_humidity_2m: [55],
        wind_speed_10m: [null],
        precipitation_probability: [10]
      }
    });
    expect(p?.['2026-07-12T09']).toEqual({ temp: 24, osecaj: 0, vlaga: 55, vetar: null, kisa: 10 });
    expect(Object.is(p?.['2026-07-12T09']?.osecaj, -0)).toBe(false);
    expect(parseForecast({})).toBeNull();
    expect(parseForecast(null)).toBeNull();
  });
});

describe('kartica vremena', () => {
  const day = { date: '2026-07-12', tag: 'int', session: { paceSec: 240 } };
  const input = (d: Partial<typeof day> & { rest?: boolean }, over: object = {}) => ({
    day: { ...day, ...d },
    today: '2026-07-12',
    nowHour: 6,
    trainingHour: 18,
    cache: hours,
    hasLocation: true,
    predPace: null,
    vdot: null,
    ...over
  });
  it('nema kartice za odmor, prošlost, bez lokacije i bez prognoze za taj sat', () => {
    expect(weatherCard(input({ rest: true }))).toBeNull();
    expect(weatherCard(input({}, { today: '2026-07-13' }))).toBeNull();
    expect(weatherCard(input({}, { hasLocation: false }))).toBeNull();
    expect(weatherCard(input({}, { trainingHour: 3 }))).toBeNull();
  });
  it('vrućina: tempo uz vrućinu iz sesije, savet i hladniji sat', () => {
    const c = weatherCard(input({}));
    expect(c?.extra).toBe('12.07. u 18:00');
    const pace = c?.rows.find((r) => r.label === 'tempo uz vrućinu');
    expect(pace?.parts.map((p) => p.text)).toEqual(['4:14', 'umesto 4:00 · +6 %']);
    expect(c?.note).toContain('Na ovoj vrućini radni deo');
    expect(c?.note).toContain(
      'Hladnije je u 8:00 (danas): osećaj 21 °C, 12 °C manje nego u 18:00.'
    );
  });
});
