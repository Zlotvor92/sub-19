# R19 — tab motora (Opus), nastavak R18 u ISTOM tabu, 14. 11. 2026, 00:05

Organizator: `session_01GnHHiXbHoY1xUw1QNCS3LN` (završna poruka samo tamo). Pravila, folderi i provera kao u
`briefs/R14-MOTOR.md` § „Pravila". Provera organizatora nad `dbda3aaa`: 62 fajla, 1038 + 25, typecheck čist, kapije
4 × 0. Kontekst: staješ tek preko ~700 000 tokena; ocene samo `grep`-om; izlaze kroz `tail`/`grep`.

## Odluka za stavku 6 (povratak posle kratke bolesti)
R2 (nedelja ≤ +20 %, dugi ≤ +20 min) je pravilo RASTA IZNAD dostignutog nivoa, ne povratka na njega. Merilo rasta i
u motoru i u čuvaru je `max(prethodna nedelja, referentna nedelja pre pauze)`; referentna = najveća od poslednje 4
odrađene nedelje pre događaja (isto za dugi: poslednji pravi dugi pre pauze). Dok je nedelja ≤ referentne i dugi ≤
referentnog, R2 se ne primenjuje. Rampa po dužini pauze (dani bez trčanja):
- ≤ 4 dana: bez rampe (nedelja u kojoj je pauza se skraćuje za propušteno, sledeća = plan).
- 5–10 dana: 1. nedelja 75 %, 2. nedelja 90 %, 3. = plan. Prvi dugi ≤ ¾ poslednjeg pre pauze, drugi = poslednji pre
  pauze. Kvalitet: 1. nedelja bez ili jedan lak (ubrzanja), 2. nedelja jedan pravi smanjene doze (≈ 0,8).
- 11–21 dan: 60 %, 75 %, 90 %, plan. > 21 dan: postojeća duga rampa (ne diraj).
Procenti su od referentne nedelje, ali nikad iznad onoga što plan za tu nedelju traži (rasterećenje, sužavanje).
Test/pripremna trka se posle bolesti pomera najviše 2 nedelje (ne 8); ako ne staje pre N−3, otpada uz rečenicu.
Primeri koji moraju da se poprave: MAR s07/s15/s16/s25, HM s15 (dugi 45 min mimo ¾), HM s05 (ned 8 < ned 7), HM s25
(19,5 km posle 3 ned bez dugog > 14 km — tu važi „dugi ≤ poslednji pravi dugi + 20 min"). Čuvarov `silazak` u MAR s7:
merilo silaska je plan posle rampe, ne plan pre događaja.

## Redosled (push posle svake stavke)
1. Stavka 6 po odluci gore. Svojstvo nad SVIM distancama: posle pauze 5–10 dana nedelja 3 ≥ 95 % plana bez događaja
   (osim kad je to sužavanje), nijedna nedelja rampe > referentne.
2. Dugi (zahtevi maratona i 10K):
   a. korak dugog se ne zaokružuje naviše tako da lestvica ne stigne cilj (MAR p06 12 ned ostaje 24,5 km umesto 26);
   b. udeo dugog i korak K7 mere se bez dodatnih km bloka tempa trke/MP (MAR p11 22,6, p18 22 — treba ≥ vrednosti iz
      `b38a0ec4`: 24,8 / 24; test maratona „R18 — najduži dugi nije kraći" ima ih kao izuzetke — skini izuzetke);
   c. talas ne ide ispod polaznog dugog; d. planirani pripremni polumaraton: lagani dani normalni posle 2–4 dana
      (afterLongRace samo za neplaniranu trku ili trku ≥ cilja);
   e. plafon dugog po vremenu kao podatak po nivou I broju dana (10K: spor 1 h 30 obara p04 sa 5 dana; treba 1 h 30
      za ≤ 3 dana, 1 h 40 za 4+) — jedna linija podatka u `tenk/` dozvoljena.
3. Stavka 8: 5K p06 — kvalitet ima prednost nad laganim danom na podu u `layoutWeek`/`roomFor` (ned 5 mora imati
   kvalitet; nedelja trke ≈ 55–60 % vrha, ne 70 %). Isto proveri 10K p06 i p02 (lagan dan 25 min: ako je lagan dan
   ispod poda distance, spoji ga sa susednim laganim ili izostavi uz rečenicu — ne ostavljaj „4,5 km bez svrhe").
4. Stavka 10 (M22): jedno merilo vršne nedelje (opterećenje) za motor i čuvara; silazak N−2 u planu od 4 ned (5K
   p14); `LATE_BUILD_WEEKS` po distanci kao podatak.
5. Stavka 11 HM podatak: p08 ned 1 (upozorenje „3 dana ne nose 45 km" + predlog 4. dana), p08/p10 ned 15 bez +15 %,
   p12 najveća doza tempa trke ne 14 dana pred trku (bez obaranja K7 za p11 — ako se sudara, napiši brojeve).
6. Upozorenja po nivou: `minRunDaysByLevel`, `minLongKmByLevel`, `minPeakWeeklyKmByLevel` kao podatak (motor čita;
   HM i 5K popuni ti; za `tenk/` i `marathon/` po jedna linija dozvoljena: pocetnik/mali/spor 3 dana, srednji/brz 4).
   Tekst ne kaže „rezultat na kraćoj trci" kad je unet rezultat ciljne distance (10K p03).
7. 5K s26: rečenica o bolu sa zastarelim datumom „prvi brzi 21. 1." — tekst se računa iz konačnog plana.

Izveštaj `reports/R19-REPORT.md` ≤ 40 redova; JEDNA završna poruka organizatoru `session_01GnHHiXbHoY1xUw1QNCS3LN`
(NE prethodnom organizatoru, NE @parent). Ako pređeš ~700 000 tokena: završi stavku, push, izveštaj, poruka.
