/* POLUMARATON — BIBLIOTEKA TRENINGA. Unos se bira po podražaju (`stimulus`) i redosledu u nizu (§ 4.5): isti podražaj
   kroz nedelje smenjuje oblike onim redom kojim su ovde poređani. Nov trening = nov unos, ne nov kod. */
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
  {
    id: 'dugi-rp',
    kind: 'long',
    stimulus: 'dugi-rp',
    tags: ['blok'],
    impact: 'obican',
    requires: { minDoseSec: 600 },
    main: { kind: 'finish-block', zone: 'RP' },
    text: 'dugi-rp',
    notes: ['napomena.dugi-blok']
  },
  {
    id: 'dugi-progresivno',
    kind: 'long',
    stimulus: 'dugi-progresivno',
    tags: ['progresija'],
    impact: 'obican',
    requires: { minDoseSec: 480 },
    main: { kind: 'progressive', zone: 'RP' },
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

  /* ---------------------------------------------------------------- brzina (osnova) */
  {
    id: 'r-200',
    kind: 'quality',
    stimulus: 'brzina',
    tags: [],
    impact: 'visok',
    requires: { needsKnownPaces: true, minVdot: 38 },
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { distanceM: 200 },
      recovery: { extent: { distanceM: 200 }, mode: 'dzog' },
      minReps: 10,
      maxReps: 14
    },
    text: 'r-200'
  },
  {
    id: 'brda-60',
    kind: 'quality',
    stimulus: 'brzina',
    tags: ['brdo'],
    impact: 'visok',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { durationSec: 60 },
      recovery: walkBack(120),
      minReps: 8,
      maxReps: 10
    },
    text: 'brda-60'
  },
  {
    id: 'r-300',
    kind: 'quality',
    stimulus: 'brzina',
    tags: [],
    impact: 'visok',
    requires: { needsKnownPaces: true, minVdot: 38 },
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { distanceM: 300 },
      recovery: { extent: { distanceM: 300 }, mode: 'dzog' },
      minReps: 7,
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
    requires: { needsKnownPaces: true, minVdot: 38 },
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { distanceM: 400 },
      recovery: { extent: { distanceM: 400 }, mode: 'dzog' },
      minReps: 6,
      maxReps: 8
    },
    text: 'r-400'
  },

  /* ---------------------------------------------------------------- prag
     Deonice praga se zadaju trajanjem: zaokruživanje komada na 60 s drži rad u plafonu + 90 s i za 3 komada
     (na 500 m bi 3 komada mogla da pređu plafon za 3 min). U komadu se zadaje dužinom kao lagani dani. */
  {
    id: 'prag-komad',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    requires: { maxDoseSec: 1500 },
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
    main: { kind: 'split', zone: 'T', pieces: 3, recovery: jog(90), by: 'trajanje' },
    text: 'prag-deonice'
  },
  {
    id: 'prag-komad-2',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    requires: { maxDoseSec: 1500 },
    main: { kind: 'continuous', zone: 'T', by: 'trajanje' },
    text: 'prag-komad'
  },
  /* prag početnika: kraći komadi, duži oporavak */
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

  /* ---------------------------------------------------------------- intervali (razvoj)
     Lestvica prva: prva doza je mala (55 % plafona), a lestvica uzima onoliko komada koliko staje. */
  {
    id: 'i-lestvica',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true },
    main: {
      kind: 'ladder',
      zone: 'I',
      reps: [
        { distanceM: 600 },
        { distanceM: 800 },
        { distanceM: 1000 },
        { distanceM: 1200 },
        { distanceM: 1000 },
        { distanceM: 800 }
      ],
      recovery: jog(150)
    },
    text: 'intervali-lestvica'
  },
  {
    id: 'i-1000',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 38 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 1000 },
      recovery: jog(150),
      minReps: 3,
      maxReps: 5
    },
    text: 'intervali'
  },
  {
    id: 'i-800',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 38 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 800 },
      recovery: jog(120),
      minReps: 4,
      maxReps: 6
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
      maxReps: 6
    },
    text: 'intervali'
  },

  /* ---------------------------------------------------------------- tempo trke usred nedelje
     U komadu prvi: prva (mala) doza ostaje ≥ 8 min i posle zaokruživanja na 500 m. */
  {
    id: 'rp-komad',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: { maxDoseSec: 1800 },
    main: { kind: 'continuous', zone: 'RP' },
    text: 'rp-komad'
  },
  {
    id: 'rp-2x',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: {},
    main: { kind: 'split', zone: 'RP', pieces: 2, recovery: jog(120) },
    text: 'rp-deonice'
  },
  {
    id: 'rp-3x',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: { minDoseSec: 1260 },
    main: { kind: 'split', zone: 'RP', pieces: 3, recovery: jog(90) },
    text: 'rp-deonice'
  },
  /* oštrenje u nedelji trke: kratke deonice u tempu trke */
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

  /* ---------------------------------------------------------------- provera forme */
  {
    id: 'kontrola-10k',
    kind: 'test',
    stimulus: 'kontrola',
    tags: ['trka'],
    impact: 'obican',
    requires: { minBaseLoad: 300, minVdot: 44 },
    main: { kind: 'all-out', distanceM: 10000 },
    text: 'kontrola-10k',
    notes: ['napomena.kontrola']
  },
  {
    id: 'kontrola-5k',
    kind: 'test',
    stimulus: 'kontrola',
    tags: ['trka'],
    impact: 'obican',
    requires: { minBaseLoad: 170 },
    main: { kind: 'all-out', distanceM: 5000 },
    text: 'kontrola-5k',
    notes: ['napomena.kontrola']
  },
  /* rani test (1. nedelja) kad su tempa po osećaju: posebna oznaka da ne pomera redosled provere forme */
  {
    id: 'kontrola-rana-5k',
    kind: 'test',
    stimulus: 'kontrola-rana',
    tags: ['test'],
    impact: 'obican',
    requires: {},
    main: { kind: 'all-out', distanceM: 5000 },
    text: 'kontrola-rana',
    notes: ['napomena.kontrola']
  },
  /* mali obim (ispod ≈ 25 km nedeljno): test od 3 km ne preuzima celu nedelju */
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
  }
];
