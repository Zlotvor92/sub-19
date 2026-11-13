# Brief R9 — krug 9: motor posle prve ocene 10K + 10K krug 2, 13. 11. 2026

Polazište `claude/v4` @ `44b5b5d`+. Trener: 10K krug 1 Plan 74,8 / zbirna 78,0 (`coach/ROUND-V4-10K-01.md`); HM provera
posle lične krive: Plan isto 79,3, E7 77,7 (`coach/ROUND-V4-HM-07.md`). Pročitaj oba. Drugi sudija (Fable) za HM i
10K još radi — njegove zamerke stižu kao dopuna.

## A. Motor (tab motora) — opšta pravila, test po stavci
- **A1 Mali obim uz visok nivo** (10K p06, p02; HM p06) — zamenjuje odbačenu t. 7 kruga 8. Redosled kad kvalitet ne
  staje u nedelju: (1) skrati WU/CD na najmanje iz podataka, (2) skrati dozu do najmanje smislene, (3) izostavi jedan
  lagan dan uz rečenicu, (4) tek onda briši kvalitet. Uslov: svaka nedelja gradnje/vrha ima ≥ 1 kvalitet sa ≥ 12 min
  rada. Udeo dugog se pri izostavljenom laganom danu računa prema ostvarenoj nedelji. Ukloni izuzetak `lagan-kratak`.
- **A2 Trka/test u prozoru povratka** (s26 obe distance): na dan trke plan POSLE prikazuje trku, ne stari trening;
  posle trke 3 dana bez brzog; dugi posle trke po R2 (≤ + 25 % / + 20 min od poslednjeg stvarno istrčanog); nema
  provere forme 14 dana posle trke; rep ukupno ≤ 4 nedelje (osim dugog, + 1 nedelja).
- **A3 Tekst izmene**: navodi stvarni rezultat događaja (trku, ne stari test — 10K s01); kad zone idu u suprotnim
  smerovima, rečenica po zoni (ne „tempa ubrzana" kad je tempo trke sporiji — HM s26); propušten glavni trening se
  imenuje (10K s09); reči o zoni dolaze iz teksta distance (10K s09: „u tempu trke" za završnicu u pragu).
- **A4 Bolji rezultat ne usporava prognozu** (10K s03: 52:51 → 53:38). Opšti test nad E1 obe distance: rezultat brži
  od trenutne procene na ciljnoj dužini ⇒ nova procena ≤ stara.
- **A5 U prozoru bola/bolesti nijedna zona se ne ubrzava** (HM s26: prag 5:35 → 5:28).
- **A6 Posle događaja čuvar bez nalaza** (s07, s15) — opšti test nad svim scenarijima obe distance.
- **A7 Prenos forme naviše bez dokaza** (HM p03, p04, p06, p07, p08, p11 dobili I/R 4–6 s/km brže samo iz rezultata
  na polumaratonu): kad β nije ličan i nema rezultata ≤ 10 km ni odrađenih intervala u istoriji, prenos ka kraćoj
  dužini koristi JEDAN mali β nezavisan od obima (da manji obim ne dobije brži prag — p08 prema p07) i daje najviše
  3 s/km; za nivo početnika i za mali obim uz visoku formu 0. Brojevi u `fitness/constants.ts`.
- **A8 Prognoza početnika**: uz nivo početnika ili `pocetnik-nov` očekivano vreme najviše 3 % brže od trenutne
  procene (10K p11 −5,7 %, HM p11 −7 min); `pocetnik-nov` bez napretka u tački.
- **A9** Brzina testova: ceo V4 skup < 40 s (sada 77 s).

## B. Podaci 10K (tab 10K) — krug 2
- **B1 Specifična faza nije šuplja** (p01 ned 10–12, p04 ned 12–14, p08, p10, P1 B): najviše jedno rasterećenje
  između provere i najteže nedelje; tempo trke ulazi ranije (u razvoju 3 × 1 km), pa 5 × 1 → 4 × 1,6 → 3 × 2 km.
- **B2 Rast obima**: do × 1,25–1,30 od 35 km i 12 nedelja (p04 50 → 56 za 18 ned je ravno); 3 dana: nedelja 1 =
  sadašnji obim (p08 kreće sa 36 uz sadašnjih 41); bez identičnih nedelja (p12 pet istih).
- **B3 Kratka priprema (8 ned)**: sužavanje 1 nedelja + nedelja trke; nedelja −2 ima tempo trke (p02).
- **B4** p06/p02 posle A1: proveri da svaka nedelja ima kvalitet; ako A1 još nije stigao, ne zaobilazi u podacima.
- **B5** `raceStartPaceOffsetSec` za 10K (3 / 6 s/km) ako nije dodat; opis dana trke 10K bez rečenica iz HM.
- **B6** Testovi i kapija 10K dopunjeni za B1–B3; ispisi osveženi; `reports/F7-10K-REPORT.md` § „Krug 2".

Redosled push-a: svako `git pull --rebase` + ceo V4 skup pre svakog push-a. Tab 10K ne dira `engine/` ni `hm/`;
tab motora u `tenk/` dira samo testove/otiske. Izveštaj motora: `reports/R9-REPORT.md`.
