/* Sintetička distanca podešena da liči na prošetani primer SPEC § 12 (a): 21 097,5 m, šablon „4 dana, jedan
   kvalitet + mali podražaj", startPct 0,72. Brojevi su iz primera, nisu podaci prave distance. */
import type { DistanceData, WeekIntent } from '../types';
import { SYNTHETIC } from './synthetic';

const STRIDES = { stimulus: 'ubrzanja' };

const week = (
  kind: WeekIntent['kind'],
  loadPct: number,
  lenPct: number | null,
  quality: WeekIntent['stimuli'][number],
  block?: number
): WeekIntent => ({
  phase: kind === 'taper' || kind === 'race' ? 'zavrsna' : 'osnova',
  kind,
  loadPct,
  long:
    lenPct === null
      ? null
      : block === undefined
        ? { lenPct, stimulus: 'dugi' }
        : { lenPct, stimulus: 'dugi-blok', dosePct: block },
  stimuli: [quality, STRIDES],
  source: 'template'
});

export const EXAMPLE: DistanceData = {
  ...SYNTHETIC,
  id: 'syn21',
  distanceM: 21097.5,
  label: 'probna trka 21,1 km',
  levels: [{ id: 'osnovni', when: {} }],
  templates: [
    {
      id: 'primer-4-dana',
      levels: ['osnovni'],
      minWeeks: 1,
      maxWeeks: 52,
      minRunDays: 1,
      maxRunDays: 7,
      startPct: 0.72,
      tail: [
        week('peak', 1, 1, { stimulus: 'tempo-trke', dosePct: 0.39 }, 0.73),
        week('build', 0.85, 0.8, { stimulus: 'tempo-trke', dosePct: 0.5 }),
        week('taper', 0.65, 0.6, { stimulus: 'tempo-trke', dosePct: 0.39 }),
        week('race', 0.35, null, { stimulus: 'tempo-trke', dosePct: 0.2 })
      ],
      body: [
        {
          phase: 'osnova',
          share: 1,
          cycle: [
            week('build', 0.74, 0.66, { stimulus: 'prag', dosePct: 0.6 }),
            week('build', 0.8, 0.72, { stimulus: 'prag', dosePct: 0.74 }),
            week('build', 0.86, 0.8, { stimulus: 'intervali', dosePct: 0.75 }),
            week('recovery', 0.7, 0.63, { stimulus: 'prag', dosePct: 0.52 }),
            week('build', 0.9, 0.86, { stimulus: 'tempo-trke', dosePct: 0.5 }),
            week('build', 0.96, 0.94, { stimulus: 'tempo-trke', dosePct: 0.5 }, 0.48)
          ],
          loopFrom: 0
        }
      ],
      recoveryEvery: 0,
      recovery: { loadFactor: 0.8, longFactor: 0.8, doseFactor: 0.7 }
    }
  ],
  safety: {
    ...SYNTHETIC.safety,
    maxWeeklyRampPct: 0.08,
    minRampLoad: 10,
    peakLoadCap: { osnovni: null },
    longMaxSec: { osnovni: 8100 },
    longShareByRunDays: { '1': 1, '2': 0.6, '3': 0.48, '4': 0.42, '5': 0.38, '6': 0.34, '7': 0.3 },
    longStepSec: 720,
    longStartShare: 0.33,
    doseCaps: {
      prag: { maxWorkSec: 2100, shareOfPeakLoad: 0.11 },
      intervali: { maxWorkSec: 1500, shareOfPeakLoad: 0.07 },
      'tempo-trke': { maxWorkSec: 2700, shareOfPeakLoad: 0.15 },
      'dugi-blok': { maxWorkSec: 3000, shareOfPeakLoad: 0.16 }
    },
    minDoseSec: 360,
    maxFastShare: 0.2,
    maxFastSharePeak: 0.23,
    minEasySec: 1200,
    easyMaxShareOfLong: 0.75,
    dayBeforeLongMaxShare: 0.6,
    warmupCooldown: [{ uptoBaseLoad: null, warmupSec: 900, cooldownSec: 600 }]
  },
  adequate: {
    minWeeks: 12,
    minPeakWeeklyKm: 40,
    minRunDays: 4,
    minLongKm: 18,
    shorter: { distanceId: 'syn8', label: 'probna trka 8 km' }
  },
  texts: { ...SYNTHETIC.texts, race: 'trka 21,1 km' }
};
