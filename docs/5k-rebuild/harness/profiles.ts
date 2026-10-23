/* 5K RAZVOJNI SKUP, GRANIČNI SLUČAJEVI I PROFILI DRUGIH DISTANCI (segment 1/10).

   Svaki profil je ZAKRPA stanja čarobnjaka (`WizardState`), ne ručno sastavljen ulaz generatora: ulaz generatora pravi
   aplikacioni `toGenerationInput` (isti put kao dugme „Napravi plan"). Zato su svi profili u razvojnom skupu unutar
   onoga što aplikacija stvarno prihvata. Granični slučajevi koji čarobnjak NE prihvata (npr. bez rezultata) beleže se
   kao ograničenje (`wizardRejects`), bez zamene izmišljenim PB-om.

   Sintetički profili, ne stvarni sportisti. Rezultati su vremena koje korisnik unosi; ništa nije izvedeno iz tekstualnih
   izveštaja. */

export const TODAY = '2026-10-15'; // četvrtak; plan kreće usred nedelje kao u stvarnoj upotrebi
export const TODAY_MONDAY = '2026-10-12';

/** Nedelja (dan trke) posle `weeks` nedelja računato od ponedeljka tekuće nedelje (formula generatora). */
export function sundayAfterWeeks(weeks: number): string {
  // ponedeljak 2026-10-12 + (weeks-1)*7 + 6 dana
  const d = new Date(`${TODAY_MONDAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (weeks - 1) * 7 + 6);
  return d.toISOString().slice(0, 10);
}
export function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Polja čarobnjaka kao stringovi, isto kao u formi. */
export interface WizardPatch {
  raceDist?: number;
  raceDate: string;
  pbDist?: number;
  pbH?: string;
  pbMin: string;
  pbSec: string;
  pbDate?: string;
  weeklyKm: string;
  trainedRecently?: boolean;
  recentLongRunKm?: string;
  consistentWeeks?: string;
  breakWeeks?: string;
  qualityExperience?: '' | 'none' | 'some' | 'experienced';
  runDays?: number;
  quality?: number;
  runDows?: number[];
  lrDow?: number | null;
  lrDowManual?: boolean;
  qDays?: number[];
  intensity?: 'kons' | 'std' | 'agr';
  volIntensity?: 'kons' | 'std' | 'agr';
  goalH?: string;
  goalMin?: string;
  goalSec?: string;
}

export interface Profile {
  id: string;
  label: string;
  /** Zašto je profil u skupu i šta pokriva. */
  covers: string;
  /** `today` kad se razlikuje od podrazumevanog. */
  today?: string;
  wizard: WizardPatch;
}

const ago = (days: number): string => daysBefore(TODAY, days);

/* ------------------------------------------------------------------ razvojni skup (17) */
export const DEV_PROFILES: Profile[] = [
  {
    id: 'D01',
    label: 'Početnik, run/walk, sa sporim poznatim rezultatom',
    covers: 'trainedRecently=false; mala baza; 3 dana; 1 kvalitet; kons; 12 nedelja; bazna faza i run/walk lestvica',
    wizard: {
      raceDate: sundayAfterWeeks(12),
      pbMin: '38',
      pbSec: '00',
      pbDate: ago(20),
      weeklyKm: '6',
      trainedRecently: false,
      recentLongRunKm: '3',
      consistentWeeks: '0',
      qualityExperience: 'none',
      runDays: 3,
      quality: 1,
      intensity: 'kons',
      volIntensity: 'kons'
    }
  },
  {
    id: 'D02',
    label: 'Početnik koji trči neprekidno, mala baza',
    covers: 'trained, 12 km/ned, 3 dana, 1 kvalitet, bez iskustva kvaliteta, kratak kontinuitet',
    wizard: {
      raceDate: sundayAfterWeeks(12),
      pbMin: '33',
      pbSec: '00',
      pbDate: ago(30),
      weeklyKm: '12',
      recentLongRunKm: '5',
      consistentWeeks: '6',
      qualityExperience: 'none',
      runDays: 3,
      quality: 1,
      intensity: 'kons',
      volIntensity: 'kons'
    }
  },
  {
    id: 'D03',
    label: 'Rekreativac 25:00',
    covers: '25 km/ned, 4 dana, 2 kvaliteta, std, 12 nedelja, delimično iskustvo',
    wizard: {
      raceDate: sundayAfterWeeks(12),
      pbMin: '25',
      pbSec: '00',
      pbDate: ago(45),
      weeklyKm: '25',
      recentLongRunKm: '8',
      consistentWeeks: '12',
      qualityExperience: 'some',
      runDays: 4,
      quality: 2,
      goalMin: '24',
      goalSec: '00'
    }
  },
  {
    id: 'D04',
    label: 'Rekreativac 20:25, cilj sub-20, 9 nedelja',
    covers: 'profil korisnika: 30 km/ned, 4 dana, 2 kvaliteta, cilj brži od PB-a, priprema kraća od 10 nedelja',
    wizard: {
      raceDate: sundayAfterWeeks(9),
      pbMin: '20',
      pbSec: '25',
      pbDate: ago(40),
      weeklyKm: '30',
      recentLongRunKm: '10',
      consistentWeeks: '20',
      qualityExperience: 'some',
      runDays: 4,
      quality: 2,
      goalMin: '19',
      goalSec: '59'
    }
  },
  {
    id: 'D05',
    label: 'Iskusan 19:00, 50 km, 5 dana, 16 nedelja',
    covers: 'politika experienced (iskustvo + ≥8 ned kontinuiteta), duga priprema, viši obim',
    wizard: {
      raceDate: sundayAfterWeeks(16),
      pbMin: '19',
      pbSec: '00',
      pbDate: ago(35),
      weeklyKm: '50',
      recentLongRunKm: '14',
      consistentWeeks: '24',
      qualityExperience: 'experienced',
      runDays: 5,
      quality: 2,
      goalMin: '18',
      goalSec: '30'
    }
  },
  {
    id: 'D06',
    label: 'Napredni 17:30, 70 km, 6 dana',
    covers: 'najviši podržani profil u skupu: velika baza, 6 dana, experienced, 12 nedelja',
    wizard: {
      raceDate: sundayAfterWeeks(12),
      pbMin: '17',
      pbSec: '30',
      pbDate: ago(28),
      weeklyKm: '70',
      recentLongRunKm: '18',
      consistentWeeks: '40',
      qualityExperience: 'experienced',
      runDays: 6,
      quality: 2,
      intensity: 'std',
      volIntensity: 'std'
    }
  },
  {
    id: 'D07',
    label: 'Velika baza na malo dana (50 km / 3 dana)',
    covers: 'strukturni plafon: obim koji ne staje u izabrane dane; 3 dana sa traženim 2 kvaliteta',
    wizard: {
      raceDate: sundayAfterWeeks(10),
      pbMin: '21',
      pbSec: '30',
      pbDate: ago(50),
      weeklyKm: '50',
      recentLongRunKm: '15',
      consistentWeeks: '16',
      qualityExperience: 'some',
      runDays: 3,
      quality: 2
    }
  },
  {
    id: 'D08',
    label: 'Kratka priprema: tačno 6 nedelja',
    covers: 'minWeeks proizvoda (6); 30 km, 4 dana, 2 kvaliteta',
    wizard: {
      raceDate: sundayAfterWeeks(6),
      pbMin: '23',
      pbSec: '00',
      pbDate: ago(30),
      weeklyKm: '30',
      recentLongRunKm: '9',
      consistentWeeks: '12',
      qualityExperience: 'some',
      runDays: 4,
      quality: 2
    }
  },
  {
    id: 'D09',
    label: 'Vrlo kratka priprema: 3 nedelje',
    covers: 'skraćena priprema ispod minimuma (dozvoljena uz upozorenje); 35 km, 5 dana',
    wizard: {
      raceDate: sundayAfterWeeks(3),
      pbMin: '22',
      pbSec: '00',
      pbDate: ago(20),
      weeklyKm: '35',
      recentLongRunKm: '11',
      consistentWeeks: '16',
      qualityExperience: 'some',
      runDays: 5,
      quality: 2
    }
  },
  {
    id: 'D10',
    label: 'Duga priprema: 24 nedelje, 20 km',
    covers: 'dug ciklus, više deload ciklusa, rast obima kroz vreme; 4 dana; 27:00',
    wizard: {
      raceDate: sundayAfterWeeks(24),
      pbMin: '27',
      pbSec: '00',
      pbDate: ago(25),
      weeklyKm: '20',
      recentLongRunKm: '7',
      consistentWeeks: '10',
      qualityExperience: 'some',
      runDays: 4,
      quality: 2,
      volIntensity: 'kons'
    }
  },
  {
    id: 'D11',
    label: 'Star rezultat (400 dana)',
    covers: 'speedConfidence stale-result → effort-first; 30 km, 4 dana',
    wizard: {
      raceDate: sundayAfterWeeks(12),
      pbMin: '22',
      pbSec: '00',
      pbDate: ago(400),
      weeklyKm: '30',
      recentLongRunKm: '10',
      consistentWeeks: '20',
      qualityExperience: 'some',
      runDays: 4,
      quality: 2
    }
  },
  {
    id: 'D12',
    label: 'Rezultat na 10K bez datuma, nepotpuna istorija',
    covers: 'PB druge distance; bez datuma; bez dužine/kontinuiteta/iskustva (sve pretpostavke); 35 km, 5 dana',
    wizard: {
      raceDate: sundayAfterWeeks(12),
      pbDist: 10000,
      pbMin: '46',
      pbSec: '00',
      weeklyKm: '35',
      runDays: 5,
      quality: 2
    }
  },
  {
    id: 'D13',
    label: 'Povratak posle 10 nedelja pauze',
    covers: 'breakWeeks=10, kontinuitet 2 → returning; stari rezultat (300 dana); 15 km, 4 dana',
    wizard: {
      raceDate: sundayAfterWeeks(12),
      pbMin: '21',
      pbSec: '00',
      pbDate: ago(300),
      weeklyKm: '15',
      recentLongRunKm: '5',
      consistentWeeks: '2',
      breakWeeks: '10',
      qualityExperience: 'some',
      runDays: 4,
      quality: 2
    }
  },
  {
    id: 'D14',
    label: 'Rezultat sa polumaratona (1:45:00), 40 km',
    covers: 'PB sa duže distance; 5 dana; 10 nedelja; iskusan po izjavi',
    wizard: {
      raceDate: sundayAfterWeeks(10),
      pbDist: 21097.5,
      pbH: '1',
      pbMin: '45',
      pbSec: '00',
      pbDate: ago(60),
      weeklyKm: '40',
      recentLongRunKm: '16',
      consistentWeeks: '30',
      qualityExperience: 'experienced',
      runDays: 5,
      quality: 2
    }
  },
  {
    id: 'D15',
    label: 'Zadati dani: Ut/Če kvalitet, Sub dugo, Ned lako',
    covers: 'eksplicitni runDows/qDays/lrDow; dugo pa lako odmah sutradan; 30 km',
    wizard: {
      raceDate: sundayAfterWeeks(12),
      pbMin: '23',
      pbSec: '30',
      pbDate: ago(30),
      weeklyKm: '30',
      recentLongRunKm: '10',
      consistentWeeks: '14',
      qualityExperience: 'some',
      runDows: [2, 4, 6, 7],
      runDays: 4,
      qDays: [2, 4],
      lrDow: 6,
      lrDowManual: true,
      quality: 2
    }
  },
  {
    id: 'D16',
    label: 'Dva dana trčanja, 15 km',
    covers: 'najmanji broj dana koji čarobnjak nudi; 1 kvalitet',
    wizard: {
      raceDate: sundayAfterWeeks(10),
      pbMin: '28',
      pbSec: '00',
      pbDate: ago(30),
      weeklyKm: '15',
      recentLongRunKm: '8',
      consistentWeeks: '10',
      qualityExperience: 'some',
      runDays: 2,
      quality: 1
    }
  },
  {
    id: 'D17',
    label: 'Sedam dana, 60 km, agresivno',
    covers: 'najveći broj dana; agr doza i agr rast obima; 14 nedelja',
    wizard: {
      raceDate: sundayAfterWeeks(14),
      pbMin: '18',
      pbSec: '20',
      pbDate: ago(21),
      weeklyKm: '60',
      recentLongRunKm: '16',
      consistentWeeks: '30',
      qualityExperience: 'experienced',
      runDays: 7,
      quality: 2,
      intensity: 'agr',
      volIntensity: 'agr'
    }
  }
];

/* ------------------------------------------------------------------ granični slučajevi */
const base: WizardPatch = {
  raceDate: sundayAfterWeeks(10),
  pbMin: '24',
  pbSec: '00',
  pbDate: ago(30),
  weeklyKm: '25',
  recentLongRunKm: '8',
  consistentWeeks: '12',
  qualityExperience: 'some',
  runDays: 4,
  quality: 2
};
const edge = (id: string, label: string, covers: string, patch: Partial<WizardPatch>, today?: string): Profile => ({
  id,
  label,
  covers,
  wizard: { ...base, ...patch },
  ...(today ? { today } : {})
});

export const EDGE_PROFILES: Profile[] = [
  edge('E01', 'Trka danas', 'raceDate = today (tekuća nedelja)', { raceDate: TODAY }),
  edge('E02', 'Trka za 1 nedelju', 'raceDate = nedelja sledeće nedelje', { raceDate: sundayAfterWeeks(2) }),
  edge('E03', 'Trka ove nedelje (nedelja)', 'raceDate = nedelja tekuće nedelje', { raceDate: sundayAfterWeeks(1) }),
  edge('E04', 'Pet nedelja (minWeeks−1)', 'granica upozorenja o skraćenoj pripremi', { raceDate: sundayAfterWeeks(5) }),
  edge('E05', '104 nedelje', 'MAX_PLAN_WEEKS', { raceDate: sundayAfterWeeks(104) }),
  edge('E06', '105 nedelja', 'iznad MAX_PLAN_WEEKS — očekivana greška', { raceDate: sundayAfterWeeks(105) }),
  edge('E07', 'Obim 1 km/ned', 'ispod MIN_START_WEEKLY_KM i poda po treningu', { weeklyKm: '1', recentLongRunKm: '' }),
  edge('E08', 'Obim 200 km/ned', 'iznad MAX_INPUT_WEEKLY_KM (120)', { weeklyKm: '200', runDays: 7, recentLongRunKm: '30' }),
  edge('E09', 'PB 12:00 (najbrže dozvoljeno)', 'donja granica PB_SANITY', { pbMin: '12', pbSec: '00', weeklyKm: '100', runDays: 7, recentLongRunKm: '25', qualityExperience: 'experienced', consistentWeeks: '52' }),
  edge('E10', 'PB 99:59 (najsporije dozvoljeno)', 'gornja granica PB_SANITY', { pbMin: '99', pbSec: '59', weeklyKm: '5', trainedRecently: false, runDays: 3, quality: 1 }),
  edge('E11', 'Cilj mnogo brži od PB-a', 'PB 30:00, cilj 18:00', { pbMin: '30', pbSec: '00', goalMin: '18', goalSec: '00' }),
  edge('E12', 'Cilj sporiji od PB-a', 'PB 22:00, cilj 25:00 — racePace iz cilja', { pbMin: '22', pbSec: '00', goalMin: '25', goalSec: '00' }),
  edge('E13', 'Početnik sa 60 km/ned', 'protivrečan ulaz (BEGINNER_MAX_WEEKLY_KM)', { trainedRecently: false, weeklyKm: '60', runDays: 5 }),
  edge('E14', 'Početnik, 3 nedelje', 'run/walk faza ne staje', { trainedRecently: false, weeklyKm: '8', raceDate: sundayAfterWeeks(3), runDays: 3, quality: 1 }),
  edge('E15', 'Dužina veća od pola nedelje', 'recentLongRunKm 25 uz 20 km/ned', { weeklyKm: '20', recentLongRunKm: '25' }),
  edge('E16', 'Dužina 0,5 km', 'recentLongRunKm vrlo mali', { recentLongRunKm: '0.5' }),
  edge('E17', 'Iskusan bez kontinuiteta', 'qualityExperience experienced, consistentWeeks 0', { qualityExperience: 'experienced', consistentWeeks: '0' }),
  edge('E18', 'Pauza 52 nedelje', 'breakWeeks 52, kontinuitet 0', { breakWeeks: '52', consistentWeeks: '0', pbDate: ago(500) }),
  edge('E19', 'Rezultat istog dana', 'pbDate = today', { pbDate: TODAY }),
  edge('E20', 'Kvalitet u susednim danima + dugo odmah posle', 'qDays [1,2], lrDow 3', { runDows: [1, 2, 3, 5], qDays: [1, 2], lrDow: 3, lrDowManual: true }),
  edge('E21', '2 dana, 2 kvaliteta', 'traženo više kvaliteta nego što dani nose', { runDays: 2, quality: 2 }),
  edge('E22', 'Start u nedelju', 'today = nedelja; nedelja 1 ima jedan dan', { raceDate: '2027-01-03' }, '2026-10-18'),
  edge('E23', 'Start u ponedeljak', 'today = ponedeljak; puna prva nedelja', { raceDate: '2027-01-03' }, '2026-10-19'),
  edge('E24', 'Rezultat sa maratona (3:30:00)', 'PB sa najduže distance', { pbDist: 42195, pbH: '3', pbMin: '30', pbSec: '00', weeklyKm: '45', runDays: 5 }),
  edge('E25', 'Datum rezultata u budućnosti', 'čarobnjak treba da odbije (resultDateMessage)', { pbDate: '2026-12-01' }),
  edge('E26', 'Bez rezultata', 'čarobnjak ne dozvoljava korak 2 bez vremena — ograničenje', { pbMin: '', pbSec: '' }),
  edge('E27', 'Kons doza + agr rast obima', 'razdvojeni izbori intensity/volIntensity', { intensity: 'kons', volIntensity: 'agr', weeklyKm: '35', runDays: 5 }),
  edge('E28', 'Run/walk početnik, 8 nedelja, 2 dana', 'najmanji broj dana za početnika', { trainedRecently: false, weeklyKm: '4', runDays: 2, quality: 1, raceDate: sundayAfterWeeks(8) }),
  edge('E29', 'Spor početnik 45:00 (VDOT ispod tablice 20)', 'realan spor rezultat koji čarobnjak prihvata; VDOT ≈ 18,7', { pbMin: '45', pbSec: '00', trainedRecently: false, weeklyKm: '8', recentLongRunKm: '3', consistentWeeks: '0', qualityExperience: 'none', runDays: 3, quality: 1, intensity: 'kons', volIntensity: 'kons', raceDate: sundayAfterWeeks(12) })
];

/* ------------------------------------------------------------------ druge distance (provera izolacije) */
export const OTHER_PROFILES: Profile[] = [
  {
    id: 'X10K',
    label: '10K reprezentativan',
    covers: '10K, 35 km, 5 dana, 12 nedelja',
    wizard: { raceDist: 10000, raceDate: sundayAfterWeeks(12), pbMin: '22', pbSec: '00', pbDate: ago(40), weeklyKm: '35', recentLongRunKm: '12', consistentWeeks: '16', qualityExperience: 'some', runDays: 5, quality: 2 }
  },
  {
    id: 'XHM',
    label: 'Polumaraton reprezentativan',
    covers: 'HM, 40 km, 5 dana, 14 nedelja, PB 10K',
    wizard: { raceDist: 21097.5, raceDate: sundayAfterWeeks(14), pbDist: 10000, pbMin: '46', pbSec: '00', pbDate: ago(40), weeklyKm: '40', recentLongRunKm: '16', consistentWeeks: '20', qualityExperience: 'some', runDays: 5, quality: 2 }
  },
  {
    id: 'XM',
    label: 'Maraton reprezentativan',
    covers: 'maraton, 55 km, 5 dana, 18 nedelja, PB HM',
    wizard: { raceDist: 42195, raceDate: sundayAfterWeeks(18), pbDist: 21097.5, pbH: '1', pbMin: '40', pbSec: '00', pbDate: ago(60), weeklyKm: '55', recentLongRunKm: '24', consistentWeeks: '30', qualityExperience: 'experienced', runDays: 5, quality: 2 }
  }
];
