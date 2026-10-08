import { describe, expect, it } from 'vitest';
import { distanceName, profileRows } from './profileModel';

describe('distanceName', () => {
  it('poznate distance dobijaju ime, ostale kilometre', () => {
    expect(distanceName(5000)).toBe('5 km');
    expect(distanceName(10000)).toBe('10 km');
    expect(distanceName(21097.5)).toBe('Polumaraton');
    expect(distanceName(42195)).toBe('Maraton');
    expect(distanceName(15000)).toBe('15 km');
  });
});

describe('profileRows (ulaz čarobnjaka kao spisak)', () => {
  const ulaz = {
    startDate: '2026-01-05',
    raceDate: '2026-04-12',
    raceDistM: 10000,
    pb: { distM: 5000, sec: 1237 },
    goalSec: 2520,
    weeklyKm: 40,
    runDays: 5,
    quality: 2,
    intensity: 'std',
    volIntensity: 'kons'
  };

  it('sve poznato polje postaje red, redom kojim ga čovek razume', () => {
    expect(profileRows(ulaz).map((r) => r.label)).toEqual([
      'Trka',
      'Datum trke',
      'Ciljno vreme',
      'Polazni rezultat',
      'Nedeljni obim na startu',
      'Dana trčanja nedeljno',
      'Kvalitetnih treninga nedeljno',
      'Tempo rasta forme',
      'Tempo rasta obima'
    ]);
    const by = Object.fromEntries(profileRows(ulaz).map((r) => [r.label, r.value]));
    expect(by['Trka']).toBe('10 km');
    expect(by['Ciljno vreme']).toBe('42:00');
    expect(by['Polazni rezultat']).toBe('5 km · 20:37');
    expect(by['Tempo rasta forme']).toBe('standardno');
    expect(by['Tempo rasta obima']).toBe('konzervativno');
  });

  it('polje koje nedostaje ili je neispravno se preskače, ne izmišlja', () => {
    expect(
      profileRows({ raceDistM: 10000, goalSec: -5, pb: { distM: 5000 }, intensity: 'x' })
    ).toEqual([{ label: 'Trka', value: '10 km' }]);
  });

  it('ugrađeni plan nema ulaz: nema redova', () => {
    expect(profileRows(undefined)).toEqual([]);
    expect(profileRows(null)).toEqual([]);
    expect(profileRows('x')).toEqual([]);
    expect(profileRows([1, 2])).toEqual([]);
  });
});
