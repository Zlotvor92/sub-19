/* Kopija formule opterećenja (`fitness/load.ts`) mora da daje isto što i `engine/load.ts` (krug 3).
   Jedini uvoz iz motora van types/vdot/constants u `fitness/`, i to samo u ovom testu. */
import { describe, expect, it } from 'vitest';
import { CHRONIC_DAYS } from '../engine/constants';
import { rollDay, runLoad as engineRunLoad } from '../engine/load';
import type { Lap, Run, ZoneId } from '../engine/types';
import { rollChronic, runLoad } from './load';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomRun(i: number, r: () => number): Run {
  const durationSec = Math.round(600 + r() * 7200);
  const distanceM = r() < 0.05 ? 0 : Math.round(durationSec * (2.2 + r() * 2.8));
  const run: Run = { id: `r${String(i)}`, date: '2026-10-01', distanceM, durationSec };
  const kind = Math.floor(r() * 4);
  if (kind === 0) {
    const laps: Lap[] = Array.from({ length: 2 + Math.floor(r() * 10) }, (_, k) => ({
      role: k % 2 === 0 ? 'work' : 'recovery',
      durationSec: Math.round(r() < 0.1 ? 0 : 60 + r() * 600),
      distanceM: r() < 0.1 ? 0 : Math.round(200 + r() * 2000)
    }));
    run.laps = laps;
  } else if (kind === 1) {
    const zones: ZoneId[] = ['T', 'I', 'RP', 'M'];
    const planDur = Math.round(durationSec * (0.8 + r() * 0.4));
    run.planned = {
      zone: zones[Math.floor(r() * zones.length)] ?? 'T',
      workSec: 1200,
      durationSec: planDur,
      load: (planDur / 60) * (1 + r() * 1.5)
    };
  } else if (kind === 2) {
    run.splits = Array.from({ length: 1 + Math.floor(r() * 20) }, () => ({
      paceSec: 200 + r() * 300
    }));
  }
  return run;
}

describe('opterećenje: kopija = motor', () => {
  it('50 nasumičnih (determinističkih) trčanja, tri praga', () => {
    const r = rng(20261112);
    for (let i = 0; i < 50; i += 1) {
      const run = randomRun(i, r);
      for (const threshold of [230, 270, 330]) {
        expect(runLoad(run, threshold)).toBeCloseTo(engineRunLoad(run, threshold), 9);
      }
    }
  });

  it('baza: isti korak dana', () => {
    let mine = 30;
    let theirs = { chronic: 30, acute: 30 };
    const r = rng(7);
    for (let d = 0; d < 3 * CHRONIC_DAYS; d += 1) {
      const load = r() < 0.4 ? 0 : r() * 150;
      mine = rollChronic(mine, load);
      theirs = rollDay(theirs, load);
      expect(mine).toBeCloseTo(theirs.chronic, 9);
    }
  });
});
