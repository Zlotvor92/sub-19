import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { AltRecord } from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import { weekAnnouncements } from './index';

/* parity: najaveZaNedelju (app.js). */

const NOW = '2026-07-14T14:30:00Z';
let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp(NOW);
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;

describe('najave za nedelju naspram starog koda', () => {
  it('osam dana: odmor je prazan tekst, trening nosi tip i km; izmenjen dan nosi novi tip; van plana je prazno', () => {
    let withText = 0;
    let withEmpty = 0;
    for (const [dist, sec, weeks, back] of [
      [10000, 2570, 14, 3],
      [5000, 1237, 12, 6],
      [42195, 13500, 26, 2]
    ] as const) {
      const start = addDays('2026-07-13' as IsoDate, -back * 7);
      const gen = adaptGeneratedPlan(
        generatePlan({
          startDate: start,
          raceDate: addDays(start, weeks * 7 + 3),
          raceDistM: dist,
          pb: { distM: dist, sec },
          weeklyKm: 45,
          runDays: 5,
          quality: 2,
          intensity: 'std',
          trainedRecently: true
        })
      );
      if (!gen) throw new Error('adapt');
      for (const withAlts of [false, true]) {
        const base = resolvePlan(gen.weeks, { alts: {}, moves: {} });
        const alts: Record<string, AltRecord> = {};
        if (withAlts)
          for (const d of base.dated)
            if (!d.rest && d.km && d.date >= '2026-07-14' && d.date <= '2026-07-22')
              alts[d.id] = {
                tag: 'tempo',
                km: 7.5,
                desc: 'Tempo 7.5 km',
                pace: null,
                rw: null,
                paceAuto: false
              };
        ctx()['__p'] = j(gen);
        ctx()['__a'] = j(alts);
        legacy.evalIn(
          'S.genPlan=__p; S.alts=__a; S.moves={}; setActivePlan(); rebuildDateIndex(); 0'
        );
        const old = j<Record<string, string>>(legacy.evalIn('najaveZaNedelju()'));
        const mine = weekAnnouncements(
          resolvePlan(gen.weeks, { alts, moves: {} }),
          '2026-07-14',
          (id) => !!alts[id]
        );
        expect(mine).toEqual(old);
        for (const v of Object.values(mine)) {
          if (v) withText++;
          else withEmpty++;
        }
      }
    }
    expect(withText).toBeGreaterThan(20);
    expect(withEmpty).toBeGreaterThan(3);
  });
});
