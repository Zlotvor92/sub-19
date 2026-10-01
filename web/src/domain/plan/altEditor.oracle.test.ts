import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import {
  ALT_TYPES,
  altDescTemplate,
  chooseRaceKm,
  chooseType,
  holdType,
  raceNameForKm
} from './altEditor';

/* parity: altDescTemplate, imeTrkeZaKm, rukovaoci u renderAltSheet (app.js). */

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp();
});

const KMS: Array<number | null | ''> = [
  null,
  '',
  0,
  5,
  5.0,
  8,
  10,
  10.04,
  10.2,
  21.1,
  21.0975,
  42.2,
  42.195,
  3.5,
  12
];

describe('izmena treninga naspram starog koda', () => {
  it('altDescTemplate: svi tipovi × kilometraže', () => {
    for (const [tag] of [...ALT_TYPES, ['rw', ''], ['nepoznat', '']] as const)
      for (const km of KMS)
        expect(altDescTemplate(tag, km), `${tag} ${String(km)}`).toBe(
          legacy.evalIn(`altDescTemplate(${JSON.stringify(tag)}, ${JSON.stringify(km)})`)
        );
  });

  it('raceNameForKm: isti naziv distance', () => {
    for (const km of KMS.filter((k): k is number => typeof k === 'number'))
      expect(raceNameForKm(km), String(km)).toBe(legacy.evalIn(`imeTrkeZaKm(${km})`));
  });

  it('chooseType: opis postaje šablon samo dok je još opis iz plana; snaga se skida', () => {
    const d = { tag: 'lako', km: 8, desc: 'Lagano 8 km', pace: null, snaga: true };
    expect(chooseType(d, 'tempo', 'Lagano 8 km')).toMatchObject({
      tag: 'tempo',
      snaga: false,
      desc: 'Tempo — unesi strukturu'
    });
    expect(chooseType({ ...d, desc: 'moj opis' }, 'tempo', 'Lagano 8 km').desc).toBe('moj opis');
    expect(chooseType({ ...d, desc: '' }, 'lr', null).desc).toBe('8 km LR (Z2)');
  });

  it('holdType: snaga uz trčanje, trčanje uz snagu; inače ništa', () => {
    const run = { tag: 'lako', km: 8, desc: 'x', pace: null, snaga: false };
    expect(holdType(run, 'snaga')).toMatchObject({ tag: 'lako', snaga: true });
    expect(holdType({ ...run, snaga: true }, 'snaga')).toMatchObject({ snaga: false });
    expect(holdType({ ...run, tag: 'snaga' }, 'tempo')).toMatchObject({
      tag: 'tempo',
      snaga: true
    });
    expect(holdType({ ...run, snaga: true }, 'lr')).toMatchObject({ tag: 'lr', snaga: true });
    expect(holdType(run, 'tempo')).toBeNull();
    expect(holdType({ ...run, tag: 'odmor' }, 'snaga')).toBeNull();
  });

  it('chooseRaceKm: opis prati dužinu dok ga korisnik nije menjao', () => {
    const base = { tag: 'trka', km: 10, desc: '🏁 Trka — 10 km', pace: null, snaga: false };
    expect(chooseRaceKm(base, 21.1, 'orig').desc).toBe('🏁 Trka — Polumaraton (21,1 km)');
    expect(chooseRaceKm({ ...base, desc: 'moj tekst' }, 21.1, 'orig').desc).toBe('moj tekst');
    expect(chooseRaceKm({ ...base, desc: 'orig' }, 5, 'orig').desc).toBe('🏁 Trka — 5 km');
  });
});
