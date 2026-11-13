# Krug 9 V4 — deo A (motor), 13. 11. 2026

Grana `claude/v4`. V4 skup: **721 prolaze, 14 očekivano pada, 0 pada**; `npm run check` zelen (4157 + 14); typecheck i lint čisti. Kapije: **HM 0; 10K 1** (p06 B9 „nedelja −1 >
nedelja −2", izuzetak taba 10K `WAIT_A1` u `tenk/gate.test.ts`, vidi A10). `target-compare` HM 26/72, 10K 15/54
(pad u odnosu na krug 8: sporiji prag po A14 i A7 menja dozu i vrstu prema ciljnim planovima).

| # | stanje | test |
|---|---|---|
| A14 | urađeno: sidro T = trka od 60 min; `Transfer.limits` iz rezultata KRAĆIH od cilja u 12 nedelja: VDOT zone ≤ najveći sirovi VDOT, prag ne brži od trke 40–70 min, intervali ne brži od trke/testa ≤ 15 min. Odluka: (c) za prag samo do 70 min (polumaraton je po prirodi sporiji od praga). s04 prag 5:31 → 5:48 (trka 5:48), s03 prag 5:10 → 5:24, I 4:43 → 4:59, par 2 prag 5:23 → 5:40. Vlasnik (test-podaci bez kraćih rezultata): v1 prag 4:35 → 4:37, I 4:13 → 4:15, R 3:58 → 4:00 (+2 s od A14/A7) | `hm/r9`, `tenk/r9` A14 (profili, vlasnik, 27 scenarija) |
| A1 | urađeno: kvalitet koji ne staje — (1) najkraće WU/CD iz podataka, (2) doza korak 60 s do ≥ 12 min / najmanjeg oblika, manji unos istog podražaja, (3) izostavljen lagan dan uz `dan-izostavljen`, (4) tek onda briše; dugi sa blokom ≥ 25 % OSTVARENE nedelje (višak skida poslednji kvalitet). 10K p06 i HM p06 imaju kvalitet u svakoj nedelji gradnje; izuzetak kapije za vrh uz `lagan-kratak` uklonjen (ostaje samo za nedelju trke) | `hm/r5` Z8+A1, 10K B4 bez `WAIT_A1`, B3 bez `WAIT_A1_RP` |
| A2 | nije urađeno | — |
| A3 | delimično: promena tempa po zoni kad zone idu u suprotnim smerovima. Nije: stvarni rezultat u tekstu (10K s01), imenovanje glavnog treninga (s09), reči zone iz teksta distance | `r9` A3 obe distance |
| A4 | urađeno (preko A8): 10K s03 skinut iz `KNOWN`; test E1 bez tolerancije (nova ≤ stara) | `scenarios.test` Z4 obe distance |
| A5 | urađeno: u prozoru bola/pauze (+ 28 dana) nova tempa po zoni ne brža od starih (HM s26 I 5:24 → 5:20 više ne) | `r9` A5 obe distance |
| A6 | delimično: skraćena nedelja izlaska ne podiže udeo brzog (doze srazmerno; HM s05). Poznato: HM s07 dugi-za-distancu (A10), 10K s07/s26 brz-udeo, s14 ispod-cilja, s15 lagan-dugi | `r9` A6 (nalazi koje uvodi događaj) |
| A7 | urađeno: bez ličnog β i bez dokaza ≤ 10 km/kvaliteta prenos naviše β 1, ≤ 3 s/km (`fitness/constants.ts`); početnik i mali obim (< 35 km) uz VDOT ≥ 50: 0. p08 prag = p07 | `hm/r9` A7 |
| A8 | urađeno: `safety.forecastMaxGainByLevel` (HM i 10K: početnik 3 %, potpuno nov 0) u `adjustRaceDay`. Podatak upisan i u `tenk/safety.ts` | `r9` A8 obe distance |
| A9 | urađeno u krugu 8 (30 s) | — |
| A10 | nije urađeno. Pokušaj „sužavanje ≤ prethodna nedelja" (M7 korekcija i izostavljanje dana) brisao je kvalitet sužavanja i kvario udeo laganog/dugog (HM i 10K p06) — vraćeno | 10K B9 `WAIT_A1` ostaje |
| A11, A12 | nije urađeno (`FORM_DRIFT` HM bez p06 posle A1) | — |
| A13 | urađeno: provera forme u prikazanom udelu brzog (HM p01 n8: 0 % → 22 %), budžet isti | `hm/r9` A13 |
| A15 | nije prihvaćeno: dugi posle testa kao lagan ≤ 60 % ruši R2 (s07, s25: nedelja provere manja → sledeća „skok") i Z10 (s26) — vraćeno | — |
| A16 | urađeno: trka na ± 2 % dužine cilja se usvaja 100 % (s17: 6181 → 6151 s) | `hm/r9` A16 |
| A17 | nije urađeno | — |
| A18 | delimično: `lagan-kratak` ne broji nedelje oporavka i rečenica o obimu prati brojeve (s18); napomena trke iz prognoze zaglavlja (jedan izvor); `dan-izostavljen` i `lagan-kratak` sa istim najkraćim danom. Nije: vlasnik-v2 22 %, prvi prag povratnika | `hm/r9` A18 |

Ostalo: `fitness/estimate.test` „stagnira" — odstupanje do 0,47 VDOT posle sidra 60 min (sintetički tempo po tabeli),
tempa se ne menjaju; granica 0,5 (otvoreno za formu). `load.ts` keš ključ = ceo `Transfer` (JSON). Pomoćna varijanta
vlasnik-v1-8n (F4-K2) uklonjena — v1 ponovo ima predlog „planiraj N".

## Pregled (sam, dan po dan)
HM p06: protivrečna upozorenja 35/30 min ispravljena; ostaje naopako sužavanje (9. ned 39 km > 8. ned 34 km, 0 %
brzog u poslednjoj punoj nedelji) — isto kao 10K B9 (A10). HM p11 (početnik): prognoza tačno −3 % (A8), uvod 4
nedelje bez brzog. 10K p06: kvalitet svake nedelje gradnje; „vršna" je 3. nedelja (najveći obim, Z9).

## Krug 9b (dopuna organizatora, 13. 11.)

V4 skup: **731 prolazi, 14 očekivano pada, 0 pada**; `npm run check` zelen; typecheck i lint čisti. Kapije: **HM 0, 10K 0
bez izuzetaka** (`WAIT_A1`/B9 uklonjeni). `target-compare` HM 26/72, 10K 15/54.

| # | stanje | test |
|---|---|---|
| 1 (A10 a) | urađeno: sužavanje nije naopako — nedelja −1 ≤ nedelja −2 ≤ vrh (km i dugi); u nedeljama −2 i −1 lagani dani idu do `minEasyFallbackMin` umesto izostavljenog dana; korekcija silaska ne skida trčanje ni kvalitet (prihvata se samo raspored sa istim brojem trčanja/kvaliteta i dugim dužim od laganog dana). Kapija 10K bez `WAIT_A1`. | `r9b` A10 (a): profili + mreža + 27 scenarija obe distance |
| 1 (A10 b) | urađeno: povratak posle pauze traje najviše 2 × trajanje + 7 dana (≤ 3 nedelje); posle toga prvobitan plan koji ne staje u granicu skoka (R2) se spušta srazmerno (niži vrh, prelazi i brz rad u istom odnosu, dugi ne ispod dugog-za-distancu kad R2 dozvoli), uz rečenicu sa brojevima; manjak < 5 % zatvara obična rampa (s05, s07). | `r9b` A10 (b): E2 obe distance |
| 2 (A17) | urađeno: izgubljen obim do trke (spušten ostatak ili ≥ 15 % manje km) smanjuje očekivani napredak u istom odnosu (`raceDayVolumeShare`, posle `maxGain`), uz rečenicu sa brojevima (s05/s07/s08; par 2 B ostaje ≠ A preko A8). | `r9b` A17: E2 obe distance |
| 3 (A2) | urađeno: neplanirana trka (effort race) — render dana trke prikazuje trku (spoj po datumu kad nema `dayId`); nema provere forme 14 dana posle (`race` flag na effort adjustmentu, `NO_TEST_AFTER_RACE_DAYS` 14, važi i van prozora izmene); 3 dana bez brzog (postojeći `NO_FAST_DAYS_AFTER_EFFORT`); dugi po R2 (`smoothExit`). | `r9b` A2: s26 obe distance |
| 4 (A11) | urađeno: kad trka izbaci proveru forme (14 dana posle sebe) tekst result izmene to navodi (`droppedTestAfter`); pomerena provera se i dalje pominje. A3 ostatak: rečenica po zoni (krug 9) i imenovanje propuštenog glavnog treninga (s09 „dugi …") rade; nije: reči o zoni iz teksta distance (nijansa biblioteke). | `r9b` A11: s26 obe distance |
| 5 (A12) | E6 („ništa se nije desilo", s21–s24): otisak pre = posle, nula promene prognoze — radi. `FORM_DRIFT` nepromenjen (isti 6 profila 10K): uzrok je model forme (pripisani napredak posle odrađene provere u `estimateForm`), ne motor — čeka F-seriju. | `scenarios` E6; `gate` `it.fails` |
| 6 (A6) | preostali nalazi čuvara posle događaja su legitimne posledice spuštanja/događaja, ne degeneracija plana: HM s7 `dugi-za-distancu@15` (bolest + spušten ostatak — najduži dugi stvarno ne stiže, plan to kaže rečenicom), 10K s14 `ispod-cilja@11`, s15 `lagan-dugi@14`, s26 `brz-udeo@15` + `silazak@16` (A2 podigao nedelju −2; neslaganje prozora čuvar 21 / motor 28 dana). Ostaju u `KNOWN_A6` sa objašnjenjem. | `r9` A6 `KNOWN_A6` |
| 7 (A15) | **nije prihvaćeno (treći put):** provera forme usred nedelje + dugi skraćen vikendom radi na p01 (provera uto, dugi 60 min ned), ali se sudara sa R17 (koji traži proveru SUBOTOM kad je subota dan trčanja), kapijom i čuvarom mreže — 41 pad. Protivreči ustaljenom pravilu R17; vraćeno. Treba prvo odluka da li R17 (subota) ili A15 (sreda) važi. | — |
| 8 (t18) | nije urađeno (isti razlog kao R8: pod laganih dana iz istorije diže nedelju preko pravila rasta ili skraćuje dugi; nije rešeno bez sudara sa pravilom rasta). | — |

Nove konstante: `NO_TEST_AFTER_RACE_DAYS` 14, `RETURN_WINDOW_PER_BREAK_DAY` 2 / `RETURN_WINDOW_EXTRA_DAYS` 7 /
`RETURN_WINDOW_MAX_DAYS` 21, `LOWERED_REST_MIN_SHARE` 0,05, `LOST_VOLUME_MIN_SHARE` 0,15. Novo polje `Decisions.raceDayVolumeShare`,
`Adjustment(effort).race`, `PlanHeader` nepromenjen (baseline iz stavke 3 nije bio potreban — render spaja trku po datumu).

## Pregled (sam, dan po dan)
HM p06: silazak više nije naopako (9. ned 33,5 km < 8. ned 37 km), kvalitet u svakoj nedelji gradnje. 10K p06 isto
(nedelja −1 ≤ nedelja −2). HM/10K s07: rampa posle bolesti ne traje do trke — od prve nedelje posle prozora ostatak je
niži (HM vrh 36,9 → 27,9 km) uz rečenicu. s26 obe distance: dan trke prikazuje trku, provera forme 23. 1. izostavljena uz
rečenicu. HM p11 (početnik): prognoza −3 % (A8) nepromenjena. vlasnik-v2: nepromenjen.
