/* SINTETIČKA DISTANCA ZA TESTOVE MOTORA: izmišljena trka od 8 km. Dokaz da motor radi bez ijedne prave distance
   (SPEC § 11.2). Brojevi su ilustrativni, nisu trenerska preporuka. */
import type { DistanceData, WeekIntent } from '../types';

const week = (
  phase: string,
  kind: WeekIntent['kind'],
  loadPct: number,
  lenPct: number | null,
  stimuli: WeekIntent['stimuli'],
  long: { stimulus: string; dosePct?: number } = { stimulus: 'dugi' }
): WeekIntent => ({
  phase,
  kind,
  loadPct,
  long: lenPct === null ? null : { lenPct, ...long },
  stimuli,
  source: 'template'
});

const STRIDES = { stimulus: 'ubrzanja' };

export const SYNTHETIC: DistanceData = {
  id: 'syn8',
  version: '1',
  distanceM: 8000,
  label: 'probna trka 8 km',
  levels: [
    { id: 'pocetni', when: { beginner: true } },
    { id: 'pocetni', when: { maxBaseLoad: 100 } },
    { id: 'osnovni', when: {} }
  ],
  templates: [
    {
      id: 'syn-pocetni',
      levels: ['pocetni'],
      minWeeks: 1,
      maxWeeks: 52,
      minRunDays: 1,
      maxRunDays: 7,
      startPct: 0.8,
      tail: [
        week('zavrsna', 'taper', 0.75, 0.6, [{ stimulus: 'prag', dosePct: 0.4 }]),
        week('zavrsna', 'race', 0.45, null, [STRIDES])
      ],
      body: [
        {
          phase: 'osnova',
          share: 1,
          cycle: [
            week('osnova', 'build', 0.82, 0.7, [STRIDES]),
            week('osnova', 'build', 0.9, 0.8, [{ stimulus: 'prag' }]),
            week('osnova', 'build', 0.96, 0.9, [{ stimulus: 'prag' }, STRIDES]),
            week('osnova', 'peak', 1, 1, [{ stimulus: 'prag' }, STRIDES])
          ],
          loopFrom: 1
        }
      ],
      recoveryEvery: 4,
      recovery: { loadFactor: 0.8, longFactor: 0.8, doseFactor: 0.7 }
    },
    {
      id: 'syn-osnovni',
      levels: ['osnovni'],
      minWeeks: 1,
      maxWeeks: 52,
      minRunDays: 1,
      maxRunDays: 7,
      startPct: 0.75,
      tail: [
        week('zavrsna', 'peak', 1, 1, [{ stimulus: 'tempo-trke', dosePct: 0.9 }, STRIDES], {
          stimulus: 'dugi-blok',
          dosePct: 0.8
        }),
        week('zavrsna', 'taper', 0.72, 0.65, [{ stimulus: 'tempo-trke', dosePct: 0.5 }, STRIDES]),
        week('zavrsna', 'race', 0.4, null, [{ stimulus: 'tempo-trke', dosePct: 0.36 }, STRIDES])
      ],
      body: [
        {
          phase: 'osnova',
          share: 0.5,
          cycle: [
            week('osnova', 'build', 0.78, 0.65, [{ stimulus: 'prag' }, STRIDES]),
            week('osnova', 'build', 0.84, 0.75, [{ stimulus: 'prag' }, STRIDES]),
            week('osnova', 'build', 0.9, 0.85, [{ stimulus: 'intervali' }, STRIDES])
          ],
          loopFrom: 1
        },
        {
          phase: 'posebna',
          share: 0.5,
          cycle: [
            week('posebna', 'build', 0.9, 0.85, [{ stimulus: 'tempo-trke' }, STRIDES]),
            week('posebna', 'build', 0.95, 0.95, [{ stimulus: 'intervali' }, STRIDES], {
              stimulus: 'dugi-blok'
            }),
            week('posebna', 'build', 0.97, 1, [{ stimulus: 'tempo-trke' }, STRIDES])
          ],
          loopFrom: 0
        }
      ],
      recoveryEvery: 4,
      recovery: { loadFactor: 0.8, longFactor: 0.8, doseFactor: 0.7 }
    }
  ],
  library: [
    {
      id: 'lagano',
      kind: 'easy',
      stimulus: 'lagano',
      tags: [],
      impact: 'obican',
      requires: {},
      main: { kind: 'steady', zone: 'E' },
      text: 'lagano'
    },
    {
      id: 'dugi',
      kind: 'long',
      stimulus: 'dugi',
      tags: [],
      impact: 'obican',
      requires: {},
      main: { kind: 'steady', zone: 'E' },
      text: 'dugi'
    },
    {
      id: 'dugi-blok',
      kind: 'long',
      stimulus: 'dugi-blok',
      tags: [],
      impact: 'obican',
      requires: { minDoseSec: 480 },
      main: { kind: 'finish-block', zone: 'RP' },
      text: 'dugi-blok'
    },
    {
      id: 'prag-2x',
      kind: 'quality',
      stimulus: 'prag',
      tags: [],
      impact: 'obican',
      requires: {},
      main: {
        kind: 'split',
        zone: 'T',
        pieces: 2,
        recovery: { extent: { durationSec: 90 }, mode: 'dzog' },
        by: 'trajanje'
      },
      text: 'prag-2x'
    },
    {
      id: 'prag-komad',
      kind: 'quality',
      stimulus: 'prag',
      tags: [],
      impact: 'obican',
      requires: { minDoseSec: 600 },
      main: { kind: 'continuous', zone: 'T', by: 'trajanje' },
      text: 'prag-komad'
    },
    {
      id: 'int-1000',
      kind: 'quality',
      stimulus: 'intervali',
      tags: [],
      impact: 'obican',
      requires: { needsKnownPaces: true },
      main: {
        kind: 'reps',
        zone: 'I',
        rep: { distanceM: 1000 },
        recovery: { extent: { durationSec: 150 }, mode: 'dzog' },
        minReps: 3,
        maxReps: 6
      },
      text: 'int-1000'
    },
    {
      id: 'int-brdo',
      kind: 'quality',
      stimulus: 'intervali',
      tags: ['brdo'],
      impact: 'visok',
      requires: {},
      main: {
        kind: 'reps',
        zone: 'I',
        rep: { durationSec: 90 },
        recovery: { extent: { durationSec: 120 }, mode: 'hod' },
        minReps: 4,
        maxReps: 10
      },
      text: 'int-brdo'
    },
    {
      id: 'rp-km',
      kind: 'quality',
      stimulus: 'tempo-trke',
      tags: [],
      impact: 'obican',
      requires: {},
      main: {
        kind: 'reps',
        zone: 'RP',
        rep: { distanceM: 1000 },
        recovery: { extent: { durationSec: 90 }, mode: 'dzog' },
        minReps: 2,
        maxReps: 6
      },
      text: 'rp-km'
    },
    {
      id: 'ubrzanja',
      kind: 'easy',
      stimulus: 'ubrzanja',
      tags: [],
      impact: 'obican',
      requires: {},
      main: {
        kind: 'add-on',
        zone: 'R',
        count: 4,
        rep: { durationSec: 20 },
        recovery: { extent: { durationSec: 60 }, mode: 'dzog' },
        place: 'kraj'
      },
      text: 'ubrzanja'
    },
    {
      id: 'test-3k',
      kind: 'test',
      stimulus: 'test',
      tags: [],
      impact: 'obican',
      requires: {},
      main: { kind: 'all-out', distanceM: 3000 },
      text: 'test-3k'
    }
  ],
  safety: {
    maxWeeklyRampPct: 0.1,
    minRampLoad: 10,
    peakLoadCap: { pocetni: 240, osnovni: null },
    longMaxSec: { pocetni: 4800, osnovni: 7800 },
    longShareByRunDays: { '1': 1, '2': 0.6, '3': 0.45, '4': 0.38, '5': 0.34, '6': 0.3, '7': 0.28 },
    longStepSec: 600,
    longStartShare: 0.3,
    doseCaps: {
      prag: { maxWorkSec: 1800, shareOfPeakLoad: 0.1 },
      intervali: { maxWorkSec: 1200, shareOfPeakLoad: 0.07 },
      'tempo-trke': { maxWorkSec: 1500, shareOfPeakLoad: 0.09 },
      'dugi-blok': { maxWorkSec: 1500, shareOfPeakLoad: 0.1 }
    },
    progression: {
      prag: { startPct: 0.6, stepPct: 0.1 },
      intervali: { startPct: 0.7, stepPct: 0.1 },
      'tempo-trke': { startPct: 0.6, stepPct: 0.1 },
      'dugi-blok': { startPct: 0.6, stepPct: 0.2 }
    },
    minDoseSec: 360,
    maxFastShare: 0.2,
    maxFastSharePeak: 0.24,
    minEasySec: 1200,
    easyMaxShareOfLong: 0.9,
    dayBeforeLongMaxShare: 0.7,
    warmupCooldown: [
      { uptoBaseLoad: 120, warmupSec: 600, cooldownSec: 300 },
      { uptoBaseLoad: null, warmupSec: 900, cooldownSec: 600 }
    ]
  },
  adequate: {
    minWeeks: 8,
    minPeakWeeklyKm: 30,
    minRunDays: 3,
    minLongKm: 12,
    shorter: { distanceId: 'syn4', label: 'probna trka 4 km' }
  },
  noteRules: [{ kinds: ['long'], minDurationSec: 5400, text: 'napomena-voda' }],
  presentation: { byDurationAboveSecPerKm: 420 },
  texts: {
    lagano: 'lagano {len}',
    dugi: 'dugi {len}',
    'dugi-blok': 'dugi {len}, poslednjih {dose}{pace} u tempu trke',
    'prag-2x': 'prag {n} × {rep}{pace}, oporavak {rec}',
    'prag-komad': 'prag {rep} u komadu',
    'int-1000': 'intervali {n} × {rep}{pace}, oporavak {rec}',
    'int-brdo': 'uzbrdo {n} × {rep}, oporavak {rec}',
    'rp-km': 'tempo trke {n} × {rep}{pace}, oporavak {rec}',
    ubrzanja: 'lagano {len} + {n} × {rep} ubrzanja',
    'test-3k': 'test {rep} punim naporom',
    race: 'trka 8 km',
    'napomena-voda': 'ponesi vodu',
    'faza.osnova': 'osnovna faza',
    'faza.posebna': 'posebna faza',
    'faza.zavrsna': 'završna faza'
  }
};
