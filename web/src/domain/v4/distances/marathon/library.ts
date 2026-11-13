/* MARATON — BIBLIOTEKA TRENINGA (README trenera: dugi sa blokom u tempu maratona, progresivni dugi, tempo maratona
   u deonicama 3–5 km, prag, umereni intervali samo u razvoju, brdo; malo R). Unos se bira po podražaju (`stimulus`) i redosledu u nizu (§ 4.5): isti podražaj
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
  /* krug 4 (T1): dugi hod-trk za početnika sa stažom ≤ 8 nedelja (par P2 B) */
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
  /* osnova: usponi prvi (README: brda i ubrzanja u osnovi), kratke brze deonice retko */
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
  } /* po osećaju (bez tempa): kratke brze deonice trajanjem, da se usponi ne ponavljaju tri nedelje zaredom */,
  {
    id: 'brzina-30s',
    kind: 'quality',
    stimulus: 'brzina',
    tags: [],
    impact: 'visok',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { durationSec: 30 },
      recovery: jog(90),
      minReps: 10,
      maxReps: 16
    },
    text: 'r-30s'
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
      recovery: walkBack(90),
      minReps: 11,
      maxReps: 14
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

  /* ---------------------------------------------------------------- prag
     Deonice praga se zadaju trajanjem: zaokruživanje komada na 60 s drži rad u plafonu + 90 s i za 3 komada
     (na 500 m bi 3 komada mogla da pređu plafon za 3 min). U komadu se zadaje dužinom kao lagani dani. */
  {
    id: 'prag-komad',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    /* README: T u komadu do 6–7 km (≈ 32 min) */
    requires: { maxDoseSec: 2000 },
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
  /* ciljni p07: T 4 × 1600 m, 3 × 2 km */
  {
    id: 'prag-1600',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minDoseSec: 1080 },
    main: {
      kind: 'reps',
      zone: 'T',
      rep: { distanceM: 1600 },
      recovery: jog(90),
      minReps: 3,
      maxReps: 5
    },
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

  /* ---------------------------------------------------------------- intervali (samo razvoj)
     README: I samo za VDOT ≥ 40 i ≥ 4 dana, 17–21 min (4–5 × 1000 m); ostalima 3 min po osećaju. */
  {
    id: 'i-1000',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 40, minRunDays: 4 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 1000 },
      recovery: jog(150),
      minReps: 3,
      maxReps: 7
    },
    text: 'intervali'
  },
  {
    id: 'i-800',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 40, minRunDays: 4 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 800 },
      recovery: jog(120),
      minReps: 4,
      maxReps: 8
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

  /* ---------------------------------------------------------------- tempo maratona usred nedelje
     README: 2 × 3–5 km (30–50 min), oporavak 3 min; u komadu do 40 min; 3 × 3 km za veće doze. */
  {
    id: 'rp-2x',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: {},
    main: { kind: 'split', zone: 'RP', pieces: 2, recovery: jog(180) },
    text: 'rp-deonice'
  },
  {
    id: 'rp-komad',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: { maxDoseSec: 2400 },
    main: { kind: 'continuous', zone: 'RP' },
    text: 'rp-komad'
  },
  {
    id: 'rp-3x',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: { minDoseSec: 2100 },
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
    main: { kind: 'split', zone: 'RP', pieces: 2, recovery: jog(120), by: 'trajanje' },
    text: 'ostrenje'
  },

  /* ---------------------------------------------------------------- provera forme */
  {
    id: 'kontrola-10k',
    kind: 'test',
    stimulus: 'kontrola',
    tags: ['trka'],
    impact: 'obican',
    /* README: trka 10 km u subotu rasteretne nedelje kad obim dozvoljava (≈ 35+ km nedeljno) */
    requires: { minBaseLoad: 200 },
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
    /* ispod ≈ 25 km nedeljno test 3 km (R17) */
    /* krug 5 (D3): trkač po osećaju već ima rani test — drugi test iste dužine se ne zadaje */
    requires: { minBaseLoad: 150, needsKnownPaces: true },
    main: { kind: 'all-out', distanceM: 5000 },
    text: 'kontrola-5k',
    notes: ['napomena.kontrola']
  },
  /* rani test (prvo rasterećenje, subota) kad su tempa po osećaju: posebna oznaka da ne pomera redosled provere
     forme. 5 km, a 3 km za početnika i obim ispod ≈ 25 km (R17); upozorenje „nema podataka" čita distancu iz plana */
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
  },
  /* R5 (krug 12): pripremni polumaraton 6–9 nedelja pred maraton (README, ciljni p08/p11/p12) */
  {
    id: 'kontrola-hm',
    kind: 'test',
    stimulus: 'kontrola',
    tags: ['trka'],
    impact: 'obican',
    /* R17 (sudija 2): nov/spor početnik („samo da završim", P2 B sa dugim 12 km) nema polumaraton — provera 10 km */
    requires: {
      minBaseLoad: 150,
      levels: ['pocetnik', 'povratnik', 'mali', 'spor', 'srednji', 'brz']
    },
    main: { kind: 'all-out', distanceM: 21097.5 },
    text: 'kontrola-hm',
    notes: ['napomena.kontrola-hm']
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
