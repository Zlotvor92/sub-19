import { describe, expect, it } from 'vitest';
import {
  missingZonesReason,
  zoneDistribution,
  zoneForHr,
  zoneSource,
  zonesForRun,
  zonesFromUpperBounds
} from './index';

/* parity: test/zone-pulsa.test.mjs — namera: ko daje raspodelu, daje i granice; procenti daju 100;
   pokvaren zapis ne postaje „zona od nule". */

const icu7 = [122, 141, 153, 165, 178, 190, 205];
const icuZones = zonesFromUpperBounds(icu7) ?? [];
const strava5 = [
  { min: 0, max: 123 },
  { min: 124, max: 153 },
  { min: 154, max: 168 },
  { min: 169, max: 183 },
  { min: 184, max: -1 }
];

describe('granice zona', () => {
  it('poslednja zona je otvorena naviše, prva počinje od 1', () => {
    expect(icuZones).toHaveLength(7);
    expect(icuZones[0]).toMatchObject({ min: 1, max: 122 });
    expect(icuZones[6]).toMatchObject({ min: 191, max: null });
  });
  it('nerastući, preširok, prekratak niz i neuverljiv puls se odbacuju u celini', () => {
    expect(zonesFromUpperBounds([120, 120, 150])).toBeNull();
    expect(zonesFromUpperBounds([120])).toBeNull();
    expect(zonesFromUpperBounds([40, 120])).toBeNull();
    expect(zonesFromUpperBounds([120, 300])).toBeNull();
    expect(zonesFromUpperBounds(Array.from({ length: 9 }, (_, i) => 100 + i * 10))).toBeNull();
    expect(zonesFromUpperBounds('x')).toBeNull();
  });
});

describe('raspodela po zonama', () => {
  const seconds = [600, 1200, 900, 300, 60, 0, 0];
  const log = { icu: { zonePuls: seconds, zoneGranice: icu7 } };
  const current = zoneSource({ hrZones: icuZones }, { hrZones: strava5 });

  it('procenti uvek daju tačno 100 (metod najvećeg ostatka)', () => {
    for (let k = 1; k < 40; k++) {
      const s = Array.from({ length: 7 }, (_, i) => 100 + ((i * 37 + k * 11) % 400));
      const d = zoneDistribution({ icu: { zonePuls: s, zoneGranice: icu7 } }, current);
      expect(
        d?.rows.reduce((a, r) => a + r.pct, 0),
        `k=${k}`
      ).toBe(100);
    }
  });
  it('granice iz same aktivnosti imaju prednost nad trenutnim podešavanjima', () => {
    const other = zoneSource({ hrZones: icuZones.map((z) => ({ ...z, ime: 'x' })) }, null);
    expect(zoneDistribution(log, other)?.rows.every((r) => r.ime === null)).toBe(true); // imena iz podešavanja ('x') se ne mešaju
    expect(zonesForRun(log, current).source).toBe('icu');
  });
  it('broj zona se mora poklapati: Strava (5) granice ne smeju da imenuju sedam icu zona', () => {
    const noOwn = { icu: { zonePuls: seconds } };
    expect(zoneDistribution(noOwn, zoneSource(null, { hrZones: strava5 }))).toBeNull();
    expect(zoneDistribution(noOwn, current)?.rows).toHaveLength(7);
  });
  it('ispod minuta ukupnog vremena nema raspodele', () => {
    expect(
      zoneDistribution({ icu: { zonePuls: [10, 20, 5, 0, 0, 0, 0], zoneGranice: icu7 } }, current)
    ).toBeNull();
  });
  it('trening bez sopstvene raspodele koristi zone iz podešavanja (icu → Strava)', () => {
    expect(zonesForRun({}, current).source).toBe('icu');
    expect(zonesForRun({}, zoneSource(null, { hrZones: strava5 })).source).toBe('strava');
    expect(zonesForRun(null, zoneSource(null, null)).source).toBeNull();
  });
});

describe('zona za dati puls', () => {
  it('prva, srednja i otvorena poslednja zona', () => {
    expect(zoneForHr(100, icuZones)?.n).toBe(1);
    expect(zoneForHr(150, icuZones)?.n).toBe(3);
    expect(zoneForHr(230, icuZones)).toMatchObject({ n: 7, to: null });
  });
  it('zapis bez granice iz pokvarenog backupa nije „zona od nule"', () => {
    expect(zoneForHr(100, [{ min: null, max: 150 }])).toBeNull();
    expect(zoneForHr(0, icuZones)).toBeNull();
    expect(zoneForHr(null, icuZones)).toBeNull();
    expect(zoneForHr(150, null)).toBeNull();
  });
});

describe('zašto raspodele nema', () => {
  const ctx = { icuConnected: true, current: zoneSource(null, { hrZones: strava5 }) };
  it('ko nema povezan icu ne dobija nikakvu poruku', () => {
    expect(missingZonesReason({}, { ...ctx, icuConnected: false })).toBe('');
  });
  it('ručno korigovano trčanje objašnjava zašto nema zona; greška povlačenja ima prednost nad opštim tekstom', () => {
    expect(missingZonesReason({ lock: true }, ctx)).toContain('ručno korigovano');
    expect(missingZonesReason({}, { ...ctx, zoneError: 'Nema dozvole' })).toBe('Nema dozvole');
    expect(missingZonesReason({}, ctx)).toContain('Povuci sve');
  });
  it('promenjen broj zona: kaže koliko ih je bilo, koliko ih sada ima, i šta da se uradi', () => {
    const log = { icu: { zonePuls: [1, 2, 3, 4, 5, 6, 7] } };
    const cur = {
      icuConnected: true,
      current: zoneSource({ hrZones: icuZones.slice(0, 5) }, null)
    };
    expect(missingZonesReason(log, cur)).toContain('7 zona');
    expect(missingZonesReason(log, cur)).toContain('5');
  });
  it('kad raspodela postoji, razloga nema', () => {
    const log = { icu: { zonePuls: [600, 600, 600, 600, 600, 600, 600], zoneGranice: icu7 } };
    expect(missingZonesReason(log, ctx)).toBe('');
  });
});
