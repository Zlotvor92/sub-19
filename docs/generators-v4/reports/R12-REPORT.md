# R12 — krug 12 (motor + podatak HM), 13. 11. 2026

Stanje `62e0491`. Kapije HM 0, 10K 0, 5K 0, MAR 0. V4: 54 fajla, 957 + 25 očekivano; lint i typecheck čisti.
Ispisi sve četiri distance osveženi posle poslednjeg rebase-a (na R12 5K i F8).

## Urađeno
- M1: tempa promenjena posle rezultata uvek imaju rečenicu. Najnoviji rezultat se opisuje prema planu pre tihih
  starijih rezultata. Stari rezultat uz drugi događaj objavljuje samo promenu tempa sa svojom rečenicom; dani ostaju
  tihi, a primena je ista kao pre. HM s02/s04/s08/s12, 10K s02/s08/s12, MAR s02/s03/s08/s12/s26.
  Test `hm/r12` (sabotaža obara 4 scenarija). Test r10 a/b (HM, 10K) priznaje zaglavlje „tempa".
- M2 (deo): najteža nedelja pred trku (posle rampe, po prvobitnom planu) se posle prekida spušta, ne briše:
  obim ≥ 83 %, dugi ≥ 85 % prvobitnog. HM s06 ned 17: 40,2 → 53,1 km, dugi 1 h 51 sa 16 min tempa trke.
  Menja se i 10K s06/s07/s15/s27, 5K s05/s15/s27, MAR s05/s06/s07/s13/s15.
  R2 testovi (sve četiri) i `longCapAfterEvent` priznaju zadržan vrh (`keptPeak`, ≥ 80 % prvobitnog).
- M3 (deo): dugi u 3 dana posle trke van plana ≤ poslednji odrađen dugi (HM s26 80 → 60 min, 10K s26 65 → 45,
  MAR s04 2 h 10 → 2 h). Kratka trka van plana više nije „provera forme je bila deo plana".
- M9: propušten prag/intervali u vršnoj nedelji su „glavni brzi trening najteže nedelje", ne „tempo trke" (HM s09,
  MAR s09). Posle puta piše „posle puta", ne „posle bolesti" (10K/5K s27).
- M14: tekst kvaliteta dobija `{wu}`/`{cd}` (zagrevanje, hlađenje u min). Nijedan tekst ih još ne koristi, pa se
  otisci ne menjaju; 10K tab ih upisuje u svoje tekstove (T5).
- Podatak HM: `prag-p-2x` ima najmanje 12 min. p11 i p12 imaju „prag 9 min u komadu" umesto 2 × 4 / 2 × 5 min
  (otisci p11, p12 i njihovi scenariji).

## Nije urađeno — predlozi (veća izmena modela ili tuđ folder)
- M2 ostatak: povratna nedelja 60–70 % i druga 75–80 % traže promenu modela rampe (`readiness`: F i rampDays po
  dužini pauze), ne `smoothExit`. Lagan ≥ 30/45 min uz dugi ≥ 90 min i prvi rast dugog ≤ +20 min idu u isti
  segment. MAR: čuvanje dugog ≥ 26 km i referenca „poslednji pravi dugi" — podatak/motor zajedno sa maraton tabom.
- M3 ostatak: MAR E5 (ned 1–2 posle polumaratona ≤ 60 % / 75 %) je novi plan iz stanja (s17/s20). Pravilo kruga 10
  (`GOAL_RACE_EFFORT_SHARE`) treba proširiti i na trku kraću od cilja. HM s18 (lagan 30 min uz dugi 2 h) — isto.
- M4 (5 dana, 4 zaredom): sa danima pon-uto-čet-sub-ned nema rasporeda sa 2 kvaliteta bez 4 dana zaredom. Predlog:
  podatak `maxConsecutiveWithHard`, pa drugi kvalitet otpada uz rečenicu ili trkač bira dan odmora.
- M5, M6, M7, M8, M10 (stavka 23), M11, M13, M15, M16: nisu stigli u ovaj krug, redom po važnosti M7 → M6 → M10.
- M12: `taper.trimOrder` postoji od kruga 11 kao podatak. 10K tab ga uključuje jednim redom u `tenk/safety.ts`.
  „A1 ne vraća bodove u dugi" i „vrh ne u 3. od 8" su motor, sledeći krug.
- Podatak HM p06 (−1 ≤ 70 %, trka ≤ 45 %, ned 6 kvalitet), p08 (ned 1 = 45 km; 3 dana: km < bodovi), p08/p10 ned 15
  (+15 %), p12 (najveća doza tempa trke ne 14 dana pred trku): zajednički šablon 10–20 ned; zaseban krug sa ocenom.
- K7 i MAR p07 (28,5 km): ne menjano, po uputstvu.
