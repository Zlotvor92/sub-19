/* 5 KM — BIBLIOTEKA TRENINGA. Unos se bira po podražaju (`stimulus`) i redosledu u nizu (§ 4.5): isti podražaj kroz
   nedelje smenjuje oblike onim redom kojim su ovde poređani. Nov trening = nov unos, ne nov kod.
   Razlika prema dužim distancama: dugi je aerobna osnova bez bloka u tempu trke (sadržaj samo završnih 8–10 min u
   pragu ili progresivno); VO2max intervali 400–1200 m; tempo trke usred nedelje su deonice 600–1200 m (ukupno
   ≤ 5–6 km); brzina R 200–400 m i usponi 45 s (`coach/target/5K/README.md`). Brzi treninzi nose napomenu o dužem
   zagrevanju sa ubrzanjima. */
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
  /* završnih 8–10 min u pragu, samo u 2–3 nedelje vrha (README trenera 5K; ciljni p01 ned 7, p04 ned 11) */
  {
    id: 'dugi-prag',
    kind: 'long',
    stimulus: 'dugi-prag',
    tags: ['blok'],
    impact: 'obican',
    requires: { minDoseSec: 360 },
    main: { kind: 'finish-block', zone: 'T', by: 'trajanje' },
    text: 'dugi-prag',
    notes: ['napomena.dugi-blok']
  },
  /* progresivno: poslednjih ≈ 8–10 min od laganog ka pragu (3 dana, ciljni p08 ned 5) */
  {
    id: 'dugi-progresivno',
    kind: 'long',
    stimulus: 'dugi-progresivno',
    tags: ['progresija'],
    impact: 'obican',
    requires: { minDoseSec: 360 },
    main: { kind: 'progressive', zone: 'T', by: 'trajanje' },
    text: 'dugi-progresivno'
  },

  /* ---------------------------------------------------------------- dodaci uz lagan dan (svake nedelje) */
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
  /* usponi 6 × 10–15 s u osnovi (README: „usponi 4–6 × 10 s") */
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
      rep: { durationSec: 12 },
      recovery: walkBack(75),
      place: 'sredina'
    },
    text: 'usponi-kratki'
  },

  /* ---------------------------------------------------------------- brzina R 200–400 m i usponi 45 s (osnova i
     drugi podražaj specifične faze; README: R 6 → 12 min, u dve nedelje osnove usponi 8–10 × 45 s umesto R) */
  {
    id: 'r-200',
    kind: 'quality',
    stimulus: 'brzina',
    tags: [],
    impact: 'visok',
    requires: { needsKnownPaces: true, minVdot: 28 },
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { distanceM: 200 },
      recovery: { extent: { distanceM: 200 }, mode: 'dzog' },
      minReps: 6,
      maxReps: 14
    },
    text: 'r-200',
    notes: ['napomena.zagrevanje']
  },
  {
    id: 'r-300',
    kind: 'quality',
    stimulus: 'brzina',
    tags: [],
    impact: 'visok',
    requires: { needsKnownPaces: true, minVdot: 28 },
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { distanceM: 300 },
      recovery: { extent: { distanceM: 300 }, mode: 'dzog' },
      minReps: 5,
      maxReps: 10
    },
    text: 'r-300',
    notes: ['napomena.zagrevanje']
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
      minReps: 6,
      maxReps: 10
    },
    text: 'brda-45',
    notes: ['napomena.zagrevanje']
  },
  {
    id: 'r-400',
    kind: 'quality',
    stimulus: 'brzina',
    tags: [],
    impact: 'visok',
    requires: { needsKnownPaces: true, minVdot: 32 },
    main: {
      kind: 'reps',
      zone: 'R',
      rep: { distanceM: 400 },
      recovery: { extent: { distanceM: 400 }, mode: 'dzog' },
      minReps: 4,
      maxReps: 8
    },
    text: 'r-400',
    notes: ['napomena.zagrevanje']
  },

  /* ---------------------------------------------------------------- prag (14 → 24 min, brz 28; deonice → u komadu 4–5 km) */
  {
    id: 'prag-2x',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    requires: { minDoseSec: 600 },
    main: { kind: 'split', zone: 'T', pieces: 2, recovery: jog(60), by: 'trajanje' },
    text: 'prag-deonice'
  },
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
    id: 'prag-4x',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    /* 4 deonice do 25 min praga (ciljni p04 ned 7: T 5 × 1000 m) */
    requires: { minDoseSec: 1200 },
    main: { kind: 'split', zone: 'T', pieces: 4, recovery: jog(60), by: 'trajanje' },
    text: 'prag-deonice'
  },
  {
    id: 'prag-5x',
    kind: 'quality',
    stimulus: 'prag',
    tags: [],
    impact: 'obican',
    /* krug 11 (stavka 17): 5 deonica kad doza nosi 5 × 5 min — zaokružen komad više ne prelazi plafon
       (`doseRoundUnderCap`) */
    requires: { minDoseSec: 1500 },
    main: { kind: 'split', zone: 'T', pieces: 5, recovery: jog(60), by: 'trajanje' },
    text: 'prag-deonice'
  },
  /* prag početnika: fartlek i tempo po osećaju (ciljni p11 ned 5, 7, 9–11) */
  /* R17: prvi u nizu — deonice zadate trajanjem tačno pogađaju prvu dozu (≤ 70 % vrha); fartlek po 1 min se
     zaokružuje naviše (p12) */
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
      minReps: 5,
      maxReps: 12
    },
    text: 'fartlek'
  },
  {
    id: 'fartlek-2min',
    kind: 'quality',
    stimulus: 'prag-p',
    tags: ['fartlek'],
    impact: 'obican',
    requires: { minDoseSec: 600 },
    main: {
      kind: 'reps',
      zone: 'T',
      rep: { durationSec: 120 },
      recovery: jog(120),
      minReps: 4,
      maxReps: 8
    },
    text: 'fartlek'
  },
  {
    id: 'prag-p-komad',
    kind: 'quality',
    stimulus: 'prag-p',
    tags: [],
    impact: 'obican',
    requires: { maxDoseSec: 900 },
    main: { kind: 'continuous', zone: 'T', by: 'trajanje' },
    text: 'prag-komad'
  },

  /* ---------------------------------------------------------------- VO2max intervali 400–1200 m (12 → 24 min) */
  {
    id: 'i-800',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 28 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 800 },
      recovery: jog(150),
      minReps: 3,
      maxReps: 7
    },
    text: 'intervali',
    notes: ['napomena.zagrevanje']
  },
  {
    id: 'i-1000',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 28 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 1000 },
      recovery: jog(180),
      minReps: 3,
      maxReps: 6
    },
    text: 'intervali',
    notes: ['napomena.zagrevanje']
  },
  {
    id: 'i-400',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 28 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 400 },
      recovery: jog(90),
      minReps: 5,
      maxReps: 16
    },
    text: 'intervali',
    notes: ['napomena.zagrevanje']
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
    text: 'intervali',
    notes: ['napomena.zagrevanje']
  },
  {
    id: 'i-600',
    kind: 'quality',
    stimulus: 'intervali',
    tags: [],
    impact: 'obican',
    requires: { needsKnownPaces: true, minVdot: 28 },
    main: {
      kind: 'reps',
      zone: 'I',
      rep: { distanceM: 600 },
      recovery: jog(120),
      minReps: 3,
      maxReps: 10
    },
    text: 'intervali',
    notes: ['napomena.zagrevanje']
  },
  /* tempa po osećaju: intervali trajanjem */
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
    text: 'intervali',
    notes: ['napomena.zagrevanje']
  },

  /* ---------------------------------------------------------------- tempo trke usred nedelje (deonice 600–1200 m;
     ukupno ≤ 5–6 km: plafon doze 22–24 min) */
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
      recovery: jog(120),
      minReps: 2,
      maxReps: 6
    },
    text: 'rp-deonice',
    notes: ['napomena.zagrevanje']
  },
  {
    id: 'rp-800',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'RP',
      rep: { distanceM: 800 },
      recovery: jog(120),
      minReps: 3,
      maxReps: 7
    },
    text: 'rp-deonice',
    notes: ['napomena.zagrevanje']
  },
  {
    id: 'rp-1200',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    /* dve deonice od 1,2 km i za tempo trke 7:30/km (18 min) staju u dozu */
    requires: { minDoseSec: 1080 },
    main: {
      kind: 'reps',
      zone: 'RP',
      rep: { distanceM: 1200 },
      recovery: jog(150),
      minReps: 2,
      maxReps: 4
    },
    text: 'rp-deonice',
    notes: ['napomena.zagrevanje']
  },
  {
    id: 'rp-600',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'RP',
      rep: { distanceM: 600 },
      recovery: jog(90),
      minReps: 3,
      maxReps: 8
    },
    text: 'rp-deonice',
    notes: ['napomena.zagrevanje']
  },
  /* kratke deonice u tempu trke: početnik koji tek prelazi sa hod-trka (3–6 × 400 m) */
  {
    id: 'rp-400',
    kind: 'quality',
    stimulus: 'tempo-trke',
    tags: [],
    impact: 'obican',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'RP',
      rep: { distanceM: 400 },
      recovery: walkBack(90),
      minReps: 3,
      maxReps: 8
    },
    text: 'rp-deonice'
  },
  /* oštrenje u nedelji trke: 4 × 400 m u tempu trke, 7–9 min (README; početnik 3 deonice) */
  {
    id: 'rp-ostrenje',
    kind: 'quality',
    stimulus: 'ostrenje',
    tags: [],
    impact: 'obican',
    requires: {},
    main: {
      kind: 'reps',
      zone: 'RP',
      rep: { distanceM: 400 },
      recovery: jog(60),
      minReps: 3,
      maxReps: 5
    },
    text: 'ostrenje'
  },

  /* ---------------------------------------------------------------- provera forme: test 3 km, mali obim 1,5 km */
  {
    id: 'kontrola-3k',
    kind: 'test',
    stimulus: 'kontrola',
    tags: ['test'],
    impact: 'obican',
    /* ispod ≈ 20 km nedeljno i početnik: 1,5 km (brief 5K; README trenera: kraći test „jako ravnomerno") */
    requires: { minBaseLoad: 120, levels: ['povratnik', 'mali', 'spor', 'srednji', 'brz'] },
    main: { kind: 'all-out', distanceM: 3000 },
    text: 'kontrola-3k',
    notes: ['napomena.kontrola']
  },
  {
    id: 'kontrola-1500',
    kind: 'test',
    stimulus: 'kontrola',
    tags: ['test'],
    impact: 'obican',
    requires: {},
    main: { kind: 'all-out', distanceM: 1500 },
    text: 'kontrola-1500',
    notes: ['napomena.kontrola']
  },
  /* rani test (prvo rasterećenje, subota) kad su tempa po osećaju */
  {
    id: 'kontrola-rana-3k',
    kind: 'test',
    stimulus: 'kontrola-rana',
    tags: ['test'],
    impact: 'obican',
    requires: { minBaseLoad: 120, levels: ['mali', 'spor', 'srednji', 'brz'] },
    main: { kind: 'all-out', distanceM: 3000 },
    text: 'kontrola-rana-3k',
    notes: ['napomena.kontrola']
  },
  {
    id: 'kontrola-rana-1500',
    kind: 'test',
    stimulus: 'kontrola-rana',
    tags: ['test'],
    impact: 'obican',
    requires: {},
    main: { kind: 'all-out', distanceM: 1500 },
    text: 'kontrola-rana-1500',
    notes: ['napomena.kontrola']
  }
];
