import { describe, expect, it } from 'vitest';
import type { WeatherCardModel } from '../../domain/weather';
import { weatherLine } from './WeatherCard';

const model = (rain: string, note: string): WeatherCardModel =>
  ({
    extra: '14.01. u 18:00',
    note,
    rows: [
      { label: 'u 18:00', parts: [{ kind: 'b', text: '29 °C' }] },
      { label: 'padavine', parts: [{ kind: 'b', text: rain }] }
    ]
  }) as unknown as WeatherCardModel;

describe('weatherLine (jedan red o vremenu na Danas)', () => {
  it('temperatura u času treninga; kiša tek kad je verovatna', () => {
    expect(weatherLine(model('10 %', ''))).toBe('Vreme u 18:00 · 29 °C');
    expect(weatherLine(model('60 %', ''))).toBe('Vreme u 18:00 · 29 °C · padavine 60 %');
  });

  it('predlog hladnijeg sata ulazi u red jer menja odluku', () => {
    expect(weatherLine(model('10 %', 'Hladnije je u 6:00 — 5 °C manje.'))).toBe(
      'Vreme u 18:00 · 29 °C · Hladnije je u 6:00'
    );
  });
});
