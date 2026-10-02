import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import type { Zone } from '../types';
import { vdotFromRace } from './calculateVDOT';
import { paceForZone } from './paceForZone';
import { raceTimeForVdot, riegelDist } from './racePrediction';
import { vdotFromPace, vdotPaceInRange } from './vdotFromPace';

/* parity: test/pure.test.mjs :: Daniels–Gilbert VDOT, Zone i tempi, Riegel
   Isti izrazi, isti redosled operacija → rezultat mora biti BITNO identičan
   (Object.is), ne „približno". */

const ZONES: Zone[] = ['E', 'LR', 'T', 'M', 'I', 'R'];
let legacy: LegacyApp;

beforeAll(async () => {
  legacy = await loadLegacyApp();
});

describe('VDOT matematika naspram starog koda', () => {
  it('vdotFromRace: 4 distance × vremena od svetskog vrha do šetnje', () => {
    for (const distM of [3000, 5000, 10000, 21097.5, 42195]) {
      for (let sec = 480; sec <= 30000; sec += 137) {
        expect(vdotFromRace(distM, sec), `${distM}m/${sec}s`).toBe(
          legacy.call('vdotFromRace', distM, sec)
        );
      }
    }
  });

  it('paceForZone: svih 6 zona, VDOT 20–85 korakom 0.1', () => {
    let n = 0;
    for (const zone of ZONES) {
      for (let v = 200; v <= 850; v++) {
        const vdot = v / 10;
        expect(paceForZone(vdot, zone), `${zone}@${vdot}`).toBe(
          legacy.call('paceForZone', vdot, zone)
        );
        n++;
      }
    }
    expect(n).toBe(6 * 651);
  });

  it('raceTimeForVdot: sve distance, VDOT 25–80', () => {
    for (const distM of [3000, 5000, 10000, 21097.5, 42195]) {
      for (let v = 250; v <= 800; v += 3) {
        const vdot = v / 10;
        expect(raceTimeForVdot(vdot, distM), `${distM}@${vdot}`).toBe(
          legacy.call('raceTimeForVdot', vdot, distM)
        );
      }
    }
  });

  it('vdotFromPace i vdotPaceInRange: tempa 2:30–9:00 po km, sve zone', () => {
    for (const zone of ZONES) {
      for (let pace = 150; pace <= 540; pace += 3) {
        expect(vdotFromPace(pace, zone), `${zone}@${pace}`).toBe(
          legacy.call('vdotFromPace', pace, zone)
        );
        expect(vdotPaceInRange(pace, zone), `${zone}@${pace}`).toBe(
          legacy.call('vdotPaceUOpsegu', pace, zone)
        );
      }
    }
  });

  it('riegelDist', () => {
    for (const [sec, from, to] of [
      [1237, 5000, 10000],
      [2580, 10000, 21097.5],
      [5700, 21097.5, 42195],
      [1500, 5000, 42195]
    ] as const) {
      expect(riegelDist(sec, from, to)).toBe(legacy.call('riegelDist', sec, from, to));
    }
  });
});
