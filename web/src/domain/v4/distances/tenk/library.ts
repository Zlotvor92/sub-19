/* 10 KM — BIBLIOTEKA TRENINGA. Unos se bira po podražaju (`stimulus`) i redosledu u nizu (§ 4.5): isti podražaj kroz
   nedelje smenjuje oblike onim redom kojim su ovde poređani. Nov trening = nov unos, ne nov kod.
   Razlika prema dužim distancama: dugi nema blok tempa trke kao pravilo — njegov sadržaj je završnica 10–15 min u
   pragu ili tempu trke, ili progresivna poslednja 3 km (ciljni planovi trenera, `coach/target/10K/README.md`);
   tempo trke usred nedelje su deonice 1000–2000 m (ne komad: 10 km tempo je blizu I zone); brzina 200–400 m. */
import type { RecoverySpec, WorkoutDef } from '../../engine/types';

const jog = (sec: number): RecoverySpec => ({ extent: { durationSec: sec }, mode: 'dzog' });
const walkBack = (sec: number): RecoverySpec => ({ extent: { durationSec: sec }, mode: 'hod' });

export const LIBRARY: WorkoutDef[] = [
  /* ---------------------------------------------------------------- lagano i dugi */
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
  /* početnik sa stažom ≤ 8 nedelja: dugi hod-trk */
  {
    id: 'dugi-hod',
    kind: 'long',
    stimulus: 'dugi-hod',
    tags: [],
    impact: 'obican',
    requires: { levels: ['pocetnik-nov'] },
    main: { kind: 'steady', zone: 'E' },
    text: 'dugi-hod'
  },
  /* završnica u tempu trke (10–15 min; ciljni p03 ned 9, p11 ned 15) — nije blok kao kod dužih distanci */
  {
    id: 'dugi-rp',
    kind: 'long',
    stimulus: 'dugi-rp',
    tags: ['blok'],
    impact: 'obican',
    requires: { minDoseSec: 480 },
    main: { kind: 'finish-block', zone: 'RP' },
    text: 'dugi-rp',
    notes: ['napomena.dugi-blok']
  },
  /* završnica u pragu (ciljni p01 ned 11, 13; p06 ned 4, 6) */
  {
    id: 'dugi-prag',
    kind: 'long',
    stimulus: 'dugi-prag',
    tags: ['blok'],
    impact: 'obican',
    requires: { minDoseSec: 480 },
    main: { kind: 'finish-block', zone: 'T' },
    text: 'dugi-prag',
    notes: ['napomena.dugi-blok']
  },
  /* progresivno: poslednja ≈ 3 km od laganog ka pragu (ciljni p01 ned 9) */
  {
    id: 'dugi-progresivno',
    kind: 'long',
    stimulus: 'dugi-progresivno',
    tags: ['progresija'],
    impact: 'obican',
    requires: { minDoseSec: 480 },
    main: { kind: 'progressive', zone: 'T' },
    text: 'dugi-progresivno'
  },

  /* ---------------------------------------------------------------- dodaci uz lagan dan */
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
      recovery: jog(60),
      place: 'kraj'
    },
    text: 'ubrzanja'
  },
  {
    id: 'ubrzanja-6',
    kind: 'easy',
    stimulus: 'ubrzanja-6',
    tags: [],
    impact: 'obican',
    requires: {},
    main: {
      kind: 'add-on',
      zone: 'R',
      count: 6,
      rep: { durationSec: 20 },
      recovery: jog(60),
      place: 'kraj'
    },
    text: 'ubrzanja'
  },
  {
    id: 'usponi-kratki',
    kind: 'easy',
    stimulus: 'usponi-kratki',
    tags: ['brdo'],
    impact: 'visok',
    requires: {},
    main: {
      kind: 'add-on',
      zone: 'R',
      count: 6,
      rep: { durationSec: 15 },
      recovery: walkBack(75),
      place: 'sredina'
    },
    text: 'usponi-kratki'
  },

  /* ---------------------------------------------------------------- brzina (osnova): 200–400 m i usponi 45 s */
  {
    id: 'r-200',
    kind: 'quality',
    stimulus: 'brzina',
    tags: [],
    impact: 'visok',
    requires: { needsKnownPaces: true, minVdot: 36 },
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { distanceM: 200 },
      recovery: { extent: { distanceM: 200 }, mode: 'dzog' },
      minReps: 8,
      maxReps: 14
    },
    text: 'r-200'
  },
  {
    id: 'brda-45',
    kind: 'quality',
    stimulus: 'brzina',
    tags: ['brdo'],
    impact: 'visok',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { durationSec: 45 },
      recovery: walkBack(105),
      minReps: 8,
      maxReps: 12
    },
    text: 'brda-45'
  },
  {
    id: 'r-300',
    kind: 'quality',
    stimulus: 'brzina',
    tags: [],
    impact: 'visok',
    requires: { needsKnownPaces: true, minVdot: 36 },
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { distanceM: 300 },
      recovery: { extent: { distanceM: 300 }, mode: 'dzog' },
      minReps: 6,
      maxReps: 10
    },
    text: 'r-300'
  },
  {
    id: 'r-400',
    kind: 'quality',
    stimulus: 'brzina',
    tags: [],
    impact: 'visok',
    requires: { needsKnownPaces: true, minVdot: 40 },
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { distanceM: 400 },
      recovery: { extent: { distanceM: 400 }, mode: 'dzog' },
      minReps: 5,
      maxReps: 8
    },
    text: 'r-400'
  },

  /* ---------------------------------------------------------------- prag (do 28 min u komadu) */
  {
    id: 'prag-komad',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    requires: { maxDoseSec: 1680 },
    main: { kind: 'continuous', zone: 'T', by: 'trajanje' },
    text: 'prag-komad'
  },
  {
    id: 'prag-2x',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    requires: { minDoseSec: 600 },
    main: { kind: 'split', zone: 'T', pieces: 2, recovery: jog(90), by: 'trajanje' },
    text: 'prag-deonice'
  },
  {
    id: 'prag-3x',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    requires: { minDoseSec: 900 },
    main: { kind: 'split', zone: 'T', pieces: 3, recovery: jog(60), by: 'trajanje' },
    text: 'prag-deonice'
  },
  {
    id: 'prag-komad-2',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    requires: { maxDoseSec: 1680 },
    main: { kind: 'continuous', zone: 'T', by: 'trajanje' },
    text: 'prag-komad'
  },
  /* prag početnika: kraći komadi, duži oporavak; fartlek kao smena oblika (ciljni p11 ned 6) */
  {
    id: 'prag-p-2x',
    kind: 'quality',
    stimulus: 'prag-p',
    tags: [],
    impact: 'obican',
    requires: {},
    main: { kind: 'split', zone: 'T', pieces: 2, recovery: jog(120), by: 'trajanje' },
    text: 'prag-deonice'
  },
  {
    id: 'fartlek',
    kind: 'quality',
    stimulus: 'prag-p',
    tags: ['fartlek'],
    impact: 'obican',
    requires: { maxDoseSec: 720 },
    main: {
      kind: 'reps',
      zone: 'T',
      rep: { durationSec: 60 },
      recovery: jog(120),
      minReps: 8,
      maxReps: 12
    },
    text: 'fartlek'
  },
  {
    id: 'prag-p-komad',
    kind: 'quality',
    stimulus: 'prag-p',
    tags: [],
    impact: 'obican',
    requires: { maxDoseSec: 1200 },
    main: { kind: 'continuous', zone: 'T', by: 'trajanje' },
    text: 'prag-komad'
  },
  {
    id: 'prag-p-3x',
    kind: 'quality',
    stimulus: 'prag-p',
    tags: [],
    impact: 'obican',
    requires: { minDoseSec: 900 },
    main: { kind: 'split', zone: 'T', pieces: 3, recovery: jog(120), by: 'trajanje' },
    text: 'prag-deonice'
  },

  /* ---------------------------------------------------------------- intervali (14 → 22 min) */
  {
    id: 'i-800',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 36 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 800 },
      recovery: jog(150),
      minReps: 3,
      maxReps: 7
    },
    text: 'intervali'
  },
  {
    id: 'i-1000',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 36 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 1000 },
      recovery: jog(150),
      minReps: 3,
      maxReps: 6
    },
    text: 'intervali'
  },
  {
    id: 'i-1200',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 40, minDoseSec: 840 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 1200 },
      recovery: jog(180),
      minReps: 3,
      maxReps: 5
    },
    text: 'intervali'
  },

  {
    id: 'i-3min',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { durationSec: 180 },
      recovery: jog(150),
      minReps: 3,
      maxReps: 7
    },
    text: 'intervali'
  },

  /* ---------------------------------------------------------------- tempo trke usred nedelje (deonice) */
  {
    id: 'rp-1200',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'RP',
      rep: { distanceM: 1200 },
      recovery: jog(90),
      minReps: 2,
      maxReps: 6
    },
    text: 'rp-deonice'
  },
  {
    id: 'rp-1600',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    /* dve deonice od 1600 m i za tempo trke 7:30/km (24 min) staju u dozu */
    requires: { minDoseSec: 1500 },
    main: {
      kind: 'reps',
      zone: 'RP',
      rep: { distanceM: 1600 },
      recovery: jog(90),
      minReps: 2,
      maxReps: 6
    },
    text: 'rp-deonice'
  },
  {
    id: 'rp-2000',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    /* dve deonice od 2 km i za tempo trke 7:00/km (28 min) staju u dozu */
    requires: { minDoseSec: 1680 },
    main: {
      kind: 'reps',
      zone: 'RP',
      rep: { distanceM: 2000 },
      recovery: jog(120),
      minReps: 2,
      maxReps: 4
    },
    text: 'rp-deonice'
  },
  {
    id: 'rp-1000',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'RP',
      rep: { distanceM: 1000 },
      recovery: jog(90),
      minReps: 2,
      maxReps: 10
    },
    text: 'rp-deonice'
  },
  /* oštrenje u nedelji trke: 3 deonice u tempu trke (ciljni p01, p06: 3 × 800 m, 9–11 min); zadato trajanjem, da
     rad ostane 8–12 min za svaki tempo */
  {
    id: 'rp-ostrenje',
    kind: 'quality',
    stimulus: 'ostrenje',
    tags: [],
    impact: 'obican',
    requires: {},
    main: { kind: 'split', zone: 'RP', pieces: 3, recovery: jog(120), by: 'trajanje' },
    text: 'ostrenje'
  },

  /* ---------------------------------------------------------------- provera forme: trka/test 5 km, mali obim 3 km */
  {
    id: 'kontrola-5k',
    kind: 'test',
    stimulus: 'kontrola',
    tags: ['trka'],
    impact: 'obican',
    /* ispod ≈ 25 km nedeljno i početnik: 3 km (README trenera 10K) */
    requires: { minBaseLoad: 150, levels: ['povratnik', 'mali', 'spor', 'srednji', 'brz'] },
    main: { kind: 'all-out', distanceM: 5000 },
    text: 'kontrola-5k',
    notes: ['napomena.kontrola']
  },
  /* brz trkač (VDOT 52+) i sa malim obimom trči 5 km (ciljni p06: 30 km nedeljno, provera 5 km) */
  {
    id: 'kontrola-5k-brz',
    kind: 'test',
    stimulus: 'kontrola',
    tags: ['trka'],
    impact: 'obican',
    requires: { levels: ['brz'] },
    main: { kind: 'all-out', distanceM: 5000 },
    text: 'kontrola-5k',
    notes: ['napomena.kontrola']
  },
  {
    id: 'kontrola-3k',
    kind: 'test',
    stimulus: 'kontrola',
    tags: ['test'],
    impact: 'obican',
    requires: {},
    main: { kind: 'all-out', distanceM: 3000 },
    text: 'kontrola-3k',
    notes: ['napomena.kontrola']
  },
  /* rani test (prvo rasterećenje, subota) kad su tempa po osećaju */
  {
    id: 'kontrola-rana-5k',
    kind: 'test',
    stimulus: 'kontrola-rana',
    tags: ['test'],
    impact: 'obican',
    requires: { minBaseLoad: 150, levels: ['mali', 'spor', 'srednji', 'brz'] },
    main: { kind: 'all-out', distanceM: 5000 },
    text: 'kontrola-rana-5k',
    notes: ['napomena.kontrola']
  },
  {
    id: 'kontrola-rana-3k',
    kind: 'test',
    stimulus: 'kontrola-rana',
    tags: ['test'],
    impact: 'obican',
    requires: {},
    main: { kind: 'all-out', distanceM: 3000 },
    text: 'kontrola-rana',
    notes: ['napomena.kontrola']
  }
];
