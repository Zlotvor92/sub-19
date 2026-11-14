# R19 — motor (nov tab), 14. 11. 2026 (po Beogradu) — stavke 1, 2a/b/d/e, 6, 7; 2c, 2f, 3, 4, 5, 8 nisu

Stanje `26885aa`. Kapije HM/10K/5K/MAR 0. V4: 64 fajla, 1043 prolazi, 25 očekivano pada; typecheck čist. Ispisi
(planovi, scenariji, parovi) sve 4 distance obnovljeni. Novi testovi: `distances/returnSchedule.test.ts` (svojstvo
nad svim distancama), `distances/fivek/r19.test.ts`.

## Urađeno
- **1 `f859ec3` povratak 5–21 dan po nedeljama** (`returnSchedule` u readiness, `returnWeekCap` u gradnji): cilj
  nedelje = 75/90 % (11–21 dan: 60/75/90 %) referentne (najveća od 4 pre pauze, `refWeekKm`), nikad iznad plana;
  ned 1 bez kvaliteta, dugi ≤ ¾ referentnog; ned 2 jedan kvalitet (0,8), dugi ≤ referentni; manjak nose lagani dani.
  ≤ 4 dana bez rampe. R2 (smoothExit i čuvar `dugi-korak`) od max(prethodna, referentna). Provera posle kratke
  pauze najviše 2 nedelje, inače otpada uz rečenicu. Posle pauze sledeći dugi posle propuštenog ≤ poslednji
  odrađeni + 20 min (HM s25: 19 → 16 km). Pre → posle (ned 1 | 2 | 3, plan): MAR s07 23,6|27,6|32,7 →
  28,2|36,8|41,4 (38,5|35,3|41,4); MAR s05 51,0|58,1|69,9 → 54,5|61,6|80,4 (79,3|62,2|80,4), dugi 113/134/148 →
  116/125/167; MAR s06 34,0|40,0|42,9|54,0 → 42,5|51,0|44,1|65,5, nalaz `dugi-korak@21` nestao; HM s05
  30,5|26,5|36,9 → 32,5|37,0|47,6 (ned 8 više nije < ned 7).
  Namerno prepravljeni testovi: examples § 14.6 (3), round4 (pauza ≤ 4 dana: bez izmene), hm/r14 s5/s6/s27 i s05,
  R2 u distances/*/scenarios (4), hm/r10 e (provera otpada uz rečenicu). Moguće regresije: Z2 i round6 (c) prolaze
  bez izmene; MAR returnKeepLong i hm/r14 s05 mere od referentnog dugog (brojevi gore — dugi stiže do plana, ne preko
  referentnog + 20 min). Otisci planova bez promene.
- **2a/2b `ff28214`**: kratak plan (< `longCheckMinWeeks`) koji korakom ne stiže do `longCheckKm` dobija korak do
  1,15 × (što kasnije): MAR p06 24,5 → 26 km, p19 21,5 → 22,5, p13 ned 4 +5 min. K7 u marathon.test meri korak bez
  viška km bloka MP (izuzetak „blok ≤ 2,55" skinut). p11/p18 i dalje 22,6/22 km (b38: 24,8/24) — vezuje ih N−7 ≤ 45 %;
  udeo bez viška bloka probao (menja otiske svih distanci, p11 ne pomera) i vraćen. Izuzeci p11, p13, p18 ostaju.
- **2d/2e `4eee8ed`**: nedelja pripremne trke nije merilo laganih dana posle nje: MAR p03 vrh 42,6 → 47,2, dugi
  23,8 → 25,1; p10 42,6 → 46,9, 21,8 → 25,1 (izuzetak p10 skinut); KNOWN „s26 n17 nedelja" ispravljen; nalazi p03/p10
  nestali. 10K (jedna linija): spor 1 h 30 do 3 dana, 1 h 40 od 4 (p04 ostaje). Otisci: MAR p02, p03, p09, p10, p11,
  p12, p15, p16 (2d) i p06, p13, p19 (2a); 10K p03, p10.
- **7 `4d92fc8`**: „prvi brzi trening je X" posle bola/pauze iz konačnog plana (5K s26: 21. 1. → 28. 1.).
- **6 `26885aa`**: `minRunDaysByLevel`, `minLongKmByLevel` (motor); podatak HM, 10K, MAR: početnik/mali/spor 3 dana
  (5K već 3). „rezultat na kraćoj trci" samo kad rezultat nije ciljne distance (10K p03). Prepravljeni hm.test i
  tenk.test „3 dana: malo-dana". `minPeakWeeklyKmByLevel` ostaje samo za `obim-za-nivo` (opšti prag nije menjan).

## Nije urađeno
- 2c (talas/plato MAR p05, p17): plato drži `lenPct` šablona MAR, ne pod motora — zahtev za tab MAR.
- 2f (10K p08): profil nema istoriju trčanja; ned 1 spušta pod od 85 % kad je polazni dugi na plafonu — treba odluka.
- 3 (5K p06 ned 5): kvalitet ne staje ni posle izostavljanja jednog laganog dana (cilj 115 BO); sa dva izostavljena
  nedelja ima 3 trčanja, a nedelja trke raste na 69 % vrha — vraćeno. 10K p06/p02 nisu dirani.
- 4 (M22), 5 (HM p08/p10/p12), 8 (tekstovi MAR p13/p10, KNOWN MAR s2/s26/s6/s7): nisu započeti.
