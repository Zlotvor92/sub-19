# F7 — 10 km kao podatak za V4 (13. 11. 2026, po Beogradu)

Grana `claude/v4`, posle kruga 7 motora. Folder `web/src/domain/v4/distances/tenk/` (id `tenk`, kao u adapterima):
šabloni 1–52 ned × 7 dana × 4 porodice, biblioteka (35 unosa), `safety` (sva polja HM + `minEasyFallbackMin` iz
kruga 7, bez `longVsRace`), tekstovi, 12 profila (P9 10K; p01/p03/p06/p11 = ciljni planovi trenera), 27 scenarija
(24 + 3 E7), kapija. Nula uvoza iz `hm/` i obrnuto (test), nula izmena u `engine/` i `fitness/`; skripte `plans/*.ts`
dobile `--dist tenk` (HM ispisi bajt-isti). **V4 skup: 698 prolaze, 19 očekivano pada (`it.fails`), 0 pada;
typecheck i lint čisti. Kapija 10 km: 0 prekršaja, 12/12. Otisci HM nepromenjeni.**

## Odluke i brojevi
| odluka | broj | pouzd. |
|---|---|---|
| lestvica vrha u km (kapija): ≤ 25 km × 1,8 (≥ 18 ned) / × 1,5 / × 1,35; 25–35 km × 1,45 / × 1,3; ≥ 35 km × 1,35 / × 1,25; ograničen × 1,4 | iz ciljnih p11 × 1,8, p03 × 1,4, p01 × 1,33, p06 × 1,3 | srednja |
| lestvica u bodovima ≈ 1,2 × km (rad 10 km nosi više bodova po minutu) | 2,1 / 1,8 / 1,6; 1,75 / 1,55; 1,65 / 1,5 | srednja (izmereno na 12) |
| dugi: 60–100 min (`longMaxSec` 80–100 min), udeo 3 dana 44 %, 4 → 34 %, 5 → 31 %, korak + 5 min / 1 km | README 30–33 %; p03/p11 43–45 % | srednja |
| dugi bez bloka: završnica 10–15 min u pragu ili tempu trke, progresivno 3 km (plafon 15 min) | README | visoka |
| doze: prag ≤ 28 min (brz 32), intervali 12 → 22 (brz 25), tempo trke ≤ 29 (brz 40), brzina ≤ 12, oštrenje 8–12 | README; brz nivo izbor | srednja / niska (brz) |
| brz rad ≤ 22 %, vršna ≤ 25 % (sav rad) i ≥ 14 % (kapija) | R3 S1; ciljni p03 15 % | visoka / niska (donja) |
| silazak 7–10 dana: najteža N−3, N−2 ≤ 85 % km, 8–10 dana pred trku ≤ 2 brza i ≤ 60 % rada vrha, 7 dana samo oštrenje, nedelja trke ≤ 60 % | README, rubrika | srednja |
| provera 5 km (početnik, < 25 km/ned: 3 km; brz uvek 5 km): N ≥ 14 u N−6 subotom (ciljni p01) i N−12 za 16+; 8–13 ned u N−4 ČETVRTKOM | Y1 (≤ 8 ned) | srednja |
| lagan ≤ 80 % dugog kod 4 dana, 3 i 5+ dana 72–75 %; najkraće lagano 30 min, zamena 25 (Z8) | ciljni p01 lagano 9–12 uz dugi 13–17 | srednja |
| WU/CD 15/10 već od ≈ 35 km (HM od 40), adekvatno: 8 ned, 25 km, 4 dana, dugi 10 km, kraća distanca 5 km | — | niska–srednja |

## Po profilu (vršna = nedelja „najteža" iz šablona; rad u min)
| profil | ned | polazno → vrh km | najduži dugi | brz rad vršna | rad ned −2 / −1 | upozorenja |
|---|---|---|---|---|---|---|
| p01 | 16 | 40 → 53,2 (× 1,33) | 16 km / 92 min | 22 % | 45 / 29 | — |
| p02 | 8 | 30 → 33,8 (× 1,13) | 11 km / 60 min | 25 % | 9 / 9 | obim-za-nivo |
| p03 | 12 | 20 → 28,1 (× 1,41) | 12 km / 86 min | 20 % | 21 / 14 | malo-dana |
| p04 | 18 | 50 → 56,7 (× 1,13) | 14,6 km / 100 min | 16 % | 40 / 35 | — |
| p05 | 12 | 80 → 95,9 (× 1,20) | 21 km / 94 min | 15 % | 49 / 37 | — |
| p06 | 8 | 30 → 36,0 (× 1,20) | 10,5 km / 50 min | 8 % | 0 / 9 | obim-za-nivo, lagan-kratak |
| p07 | 8 | 50 → 62,2 (× 1,24) | 15,5 km / 87 min | 18 % | 42 / 31 | — |
| p08 | 18 | 40 → 41,6 (× 1,04) | 16,5 km / 93 min | 19 % | 27 / 16 | malo-dana |
| p09 | 12 | 40 → 53,4 (× 1,33) | 16 km / 93 min | 21 % | 43 / 29 | nema-podataka |
| p10 | 18 | 20 → 28,1 (× 1,41) | 11,8 km / 86 min | 22 % | 30 / 14 | malo-dana, nema-podataka |
| p11 | 18 | 15 → 26,7 (× 1,78) | 12,7 km / 90 min | 19 % | 13 / 11 | malo-dana |
| p12 | 12 | 35 → 39,9 (× 1,14) | 12,9 km / 90 min | 15 % | 20 / 11 | nema-podataka |

`target-compare.md`: 14 od 54 nedelja u svim tolerancijama (km ± 8 %, dugi ± 1,5 km, vrsta, doza ± 20 %); odstupanja
su uglavnom doza (ciljni nose 26–33 % brzog u vrhu — pravilo ima prednost) i vrsta (provera N−4 umesto N−6 kod p03,
N−4 umesto 5. ned kod p06). Parovi: P1 B 34,6 km / vrh 47 / dugi 11,5 (A 41,9 / 55 / 13,5), kvalitet od 3. ned;
P2 B vrh 22 (A 27), hod-trk, širi raspon; P3 A povratnik (kvalitet od 3. ned, dugi 12,7), B prag od 1. ned.

## Sam pročitao (trener) i ispravio
- p01, p03, p05, p11 dan po dan; s05, s12, s13, s21. Ispravljeno usput: kratak plan imao je dve uzastopne nedelje
  rasterećenja (dužina repa); posle provere u subotu vršna nedelja je gubila utorak (K2) → provera kratkog plana u
  četvrtak; jedan kvalitet (3 dana) birao je ubrzanja umesto tempa trke; prvi tempo trke > 70 % vrha (K7) i deonice
  kraće od 8 min kod brzih (K8) → izbor unosa `rp-1200` u prvoj i nedelji sužavanja; prag u N−2/N−1 motor menja
  intervalima pune doze → odmah intervali male doze; tekst trke: start „ne brže od X" (motorovih +5–10 s/km je
  previše za 10 km).
- Ostaje (sudija bi zamerio): p02 bez tempa trke u N−2/N−1 i p06 sa 8 % brzog u vršnoj (motor zamenjuje kvalitet
  laganim kad 5 dana × 25–30 min pojede obim); p05 N−2 intervali 21 min (osnovica doze > plafon); p11 prognoza
  52:51 (−5,7 %) je optimistična za početnika (forma, ne podaci); s13 prvi tempo trke posle bola 75 % umesto ≤ 60 %.

## Zahtevi za motor (nisam menjao; zaobiđeno u podacima ili imenovano u testu)
1. Čuvar `taper` meri konstantom 60 % (`GUARD_TAPER_WORK_SHARE`), ne `safety.taper.weekBeforeMaxOfPeak`.
2. `dosePct` množi osnovicu (udeo × vrh), koja kod velikog obima prelazi plafon — mali % i dalje daje skoro pun
   plafon (p05 N−2 7 × 3 min). Predlog: % plafona, ili jasno pravilo u SPEC.
3. `zoneGapReplacement` (prag → intervali) ne nosi `dosePct` mesta: zamena dobija punu dozu (zaobiđeno: bez praga u
   N−2/N−1).
4. Z3 (60 % posle bola) i sužavanje ne mogu ispod `minReps` unosa `reps` (deonice fiksne dužine): s13/s15/s16 u
   `KNOWN` (`scenarios.test.ts`). Predlog: tada uzeti kraći unos istog podražaja.
5. `deriveEvents` iz 5 dana bez trčanja (3 dana, propušteni čet + ned) izvodi PAUZU → rampa dira sledeći dugi i
   nedelju −2 (s11, R1).
6. Z4/forma: s03 bolji rezultat usporava prognozu 47 s; „ništa" sporije 1–30 s kod 7/12 (`FORM_DRIFT`); Z10 s26 rep
   4 ned + 6 dana.
7. `obim-za-nivo`/Z8: kvalitet se briše umesto da se skrati (p02, p06) — predlog: kraća doza ili kraće WU/CD.
8. Dan trke: `paceFrom/paceTo` = +5/+10 s/km je konstanta motora — treba kao podatak distance.
9. HM `adequate.shorter.distanceId: '10k'`, a id 10 km je `tenk` (adapteri) — ispravka u `hm/` nije moja.

## Šta nije uspelo / otvoreno
- Kapija je dobila dva izuzetka podatka (ne labavljenje ciljeva): lakša nedelja sa laganim danom na najkraćem
  trajanju meri samo K8; plan sa `lagan-kratak` (Z8) nema donju granicu brzog rada u vršnoj ni 60 % nedelje trke.
- `tenk.test` mreža: `taper` za 6-nedeljne planove sporog trkača velikog obima opravdan kao zahtev motoru (t. 2).
- Bez drugog sudije i ocene trenera za 10 km; ciljni planovi trenera nisu dostignuti u dozi (namerno, R3 S1).
