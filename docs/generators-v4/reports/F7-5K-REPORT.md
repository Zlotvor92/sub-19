# F7 — 5 km kao podatak za V4 (13. 11. 2026, po Beogradu)

Grana `claude/v4`, posle kruga 9b. Folder `web/src/domain/v4/distances/fivek/` (id `fivek`, kao u adapterima):
šabloni 1–52 ned × 7 dana × 4 porodice (sadržajno 4–24 nedelje), biblioteka (36 unosa), `safety`, tekstovi,
16 profila (P9 5K p01–p12 + p13–p16 iz briefa), 27 scenarija (24 + 3 E7), parovi, kapija. Nula uvoza iz `hm/` i
`tenk/` i obrnuto (test), nula izmena u `engine/` i `fitness/`; skripte `plans/*.ts` dobile `--dist fivek`
(HM i 10K ispisi bajt-isti). **V4 skup: 814 prolaze, 20 očekivano pada (`it.fails`), 0 pada; lint i format čisti.
Typecheck pada samo na `engine/render.ts:413` (`IsoDate`) — greška motora iz kruga 9b, nije moja. Kapija 5 km:
15/16 bez prekršaja, p06 imenovan (motor). Čuvar: 15/16 bez nalaza (p06 `silazak`, isto). Otisci HM i 10K nepromenjeni.**

Napomena: brief kaže „pročitaj `briefs/F7-COMMON.md`", a tog fajla nema na grani (ni u istoriji). Radio sam po
`F7-5K.md`, obrascu 10 km (`F7-10K-REPORT.md`) i uputstvima iz AGENTS.md.

## Odluke i brojevi
| odluka | broj | pouzd. |
|---|---|---|
| šablon: osnova (R + prag) → razvoj (I blok 3 ned 70/85/100 % + prag) → N−4 rasterećenje + provera subotom → N−3 najteža (tempo trke 5 × 1 km + završnica dugog u pragu) → N−2 ≤ 85 % (tempo trke + R) → N−1 sužavanje (tempo trke ≈ 60 %) → trka; rasterećenje svake 4. unazad od provere | README i ciljni p01 | visoka |
| plan < 8 nedelja: bez provere, razvoj → najteža → N−2 → N−1 → trka | — | srednja |
| prvi tempo trke u N−5 (≈ 60 %, deonice 400 m), da najteža dobije punu dozu (motor: prvi trening podražaja ≤ 70 % vrha) | K7 | visoka |
| 3 dana: utorak glavni kvalitet, četvrtak lagan sa dodatkom, svaka treća nedelja progresivan dugi; u osnovi utorak smenjuje R i prag | ciljni p08 | srednja |
| lestvica vrha u bodovima: ≤ 20 km × 1,9 / 1,65 / 1,45; 20–35 km × 1,5 / 1,35; > 35 km × 1,4 / 1,28; ograničen × 1,45. Kapija u km: ≤ 20 × 1,7 / 1,5 / 1,35; 20–35 × 1,35 / 1,25; > 35 × 1,25 / 1,15 | ciljni p11 × 1,6, p01 × 1,2, p04 × 1,1 | srednja |
| plafoni doza: R 12 min; prag 24 min (brz 28; deljivo sa 2/3/4 deonice — zaokruživanje na minut); I 21 min (spor 20, brz 24); tempo trke 22 min (brz 24, početnik 17, hod-trk 15); oštrenje 7–9 min; završnica dugog ≤ 10 min | README 5K | visoka |
| udeo plafona (osnovica doze): R 0,06, I 0,075, tempo trke 0,095, prag 0,085 — kod ≈ 40 km osnovica ≈ plafon; I i R veći deo nego kod 10 km | izbor | niska |
| brz rad ≤ 20 % nedelje, najteža ≤ 23 %; najbrža nedelja plana ≥ 12 % (početnik 8 %, hod-trk 6 %) — najteža nedelja 5 km je posle provere i nosi ≈ 9–14 % (ciljni p01 9 %) | README: ≤ 20 % | visoka / niska (donja) |
| dugi 50–90 min bez bloka tempa trke (nema `dugi-rp` u biblioteci); udeo 4 dana 32 %, 5 dana 29 %, 3 dana 42 % (početnik 45 %); početnik do 90 min, hod-trk 55 min | README, brief | srednja |
| sužavanje 5–7 dana: `taper.lastDays` 5, `weekBeforeFromDays` 8, nedelja −2 ≤ 85 %, nedelja trke ≤ 50 % vrha | brief, README | srednja |
| provera: 3 km (`kontrola-3k`, tekst dozvoljava parkrun 5 km); početnik i < 20 km 1,5 km „jako ravnomerno" | brief | visoka |
| `raceStartPaceOffsetSec` 1–3 s/km (ciljni p01 1. km 4:28 uz 4:26) | ciljni | srednja |
| `minEasyMin` 30 (mali, povratnik 25), zamena 20 min; `minEasySec` 20 min | K8 | srednja |
| WU/CD 10/10 (≤ 120 BO), 15/10, 20/10; brzi treninzi nose napomenu „lagano, pa 4–6 ubrzanja po 20 s" | brief | srednja |
| adekvatno: 6 ned, 15 km, 3 dana, dugi 7 km ili 45 min, brz 35 km; kraće distance nema | izbor | niska |

## Po profilu (najteža = nedelja vrste „peak"; brz rad u min; tempo trke = najveći trening)
| profil | ned | nivo | polazno → vrh km | najduži dugi | % brzog u najtežoj (najbrža) | brz rad ned −2 / −1 | najveći tempo trke | upozorenja |
|---|---|---|---|---|---|---|---|---|
| p01 | 12 | srednji | 40 → 46,3 (× 1,16) | 14,6 km / 86 min | 12 % (18 %) | 28 / 14 | 5 × 1 km (22 min) | — |
| p02 | 8 | srednji | 30 → 31,3 (× 1,04) | 9,8 km / 53 min | 18 % (20 %) | 20 / 13 | 5 × 1 km (20 min) | — |
| p03 | 10 | mali | 12 → 16 (× 1,33) | 6,6 km / 50 min | 10 % (17 %) | 14 / 10 | 4 × 600 m (14 min) | kratak-dugi |
| p04 | 16 | spor | 45 → 49,4 (× 1,10) | 12,8 km / 90 min | 9 % (13 %) | 29 / 13 | 4 × 1 km (22 min) | — |
| p05 | 10 | brz | 65 → 69,5 (× 1,07) | 19,2 km / 88 min | 10 % (16 %) | 25 / 14 | 6 × 1 km (21 min) | — |
| p06 | 6 | brz | 25 → 29,5 (× 1,18) | 8 km / 39 min | 8 % (11 %) | 14 / 0 | 5 × 800 m (14 min) | obim-za-nivo, lagan-kratak |
| p07 | 6 | srednji | 45 → 47,8 (× 1,06) | 13,6 km / 79 min | 12 % (19 %) | 28 / 14 | 6 × 800 m (21 min) | lagan-kratak |
| p08 | 16 | srednji | 35 → 36,5 (× 1,04) | 15,4 km / 90 min | 14 % (17 %) | 21 / 13 | 5 × 1 km (22 min) | — |
| p09 | 10 | srednji | 30 → 32,6 (× 1,09) | 9,8 km / 60 min | 17 % (18 %) | 22 / 14 | 5 × 1 km (23 min) | nema-podataka |
| p10 | 16 | mali | 12 → 18 (× 1,50) | 7,4 km / 60 min | 17 % (18 %) | 14 / 10 | 3 × 1 km (17 min) | nema-podataka |
| p11 | 16 | početnik | 12 → 19,6 (× 1,63) | 8,3 km / 60 min | 9 % (15 %) | 16 / 10 | 3 × 1 km (16 min) | — |
| p12 | 10 | početnik | 45 → 39,9 (× 0,89) | 12,2 km / 90 min | 6 % (8 %) | 16 / 10 | 4 × 800 m (17 min) | nema-podataka |
| p13 hod-trk | 10 | početnik-nov | 10 → 12,7 (× 1,27) | 5,2 km / 45 min | 7 % (12 %) | 10 / 0 | 4 × 400 m (10 min) | mali-obim, kratak-dugi, dan-izostavljen, nema-podataka |
| p14 4 ned | 4 | srednji | 35 → 35,7 (× 1,02) | 11 km / 64 min | 14 % (14 %) | 21 / 14 | 6 × 800 m (21 min) | kratka-priprema |
| p15 povratnik | 14 | povratnik | 20 → 23,9 (× 1,19) | 7,5 km / 49 min | 19 % (20 %) | 18 / 12 | 4 × 1 km (20 min) | obim-za-nivo, povratak |
| p16 stariji | 12 | spor | 25 → 29,1 (× 1,16) | 9,1 km / 65 min | 16 % (19 %) | 20 / 13 | 4 × 1 km (22 min) | — |

`target-compare.md`: 20 od 60 nedelja u svim tolerancijama (km ± 8 %, dugi ± 1,5 km, vrsta, doza ± 20 %).
Odstupanja: (1) provera je u N−4 po README-u („4–6 nedelja pred trku"), a ciljni p04/p08/p11 je imaju u ned 8 od
16 (N−8) — README i ciljni planovi se tu razilaze, izabran README; (2) prvi tempo trke u N−5 umesto praga (motor:
prvi trening podražaja ≤ 70 % vrha, inače najteža nedelja ne dobija punu dozu); (3) dugi p01 13–14,6 km prema 15–16
(udeo 4 dana 32 %: sa 33 % povratnik sa 20 km ima nedelju trke > 50 % vrha); (4) N−1 bez praga (sa pragom brz
rad N−1 kod velikog obima prelazi N−2). Parovi: P1 B povratnik 33,5 → 40,9 km (A 40,8 → 47,8), kvalitet od 3. ned,
rani test u 4. ned; P2 B hod-trk 9,5 → 16,1 km (A 12,5 → 20,5), širi raspon; P3 A povratnik (bez kvaliteta u
istoriji), B spor sa pragom od 1. ned. Scenariji: 27, posle ponovnog planiranja čuvar bez nalaza osim s14 i s20
(`ispod-cilja` po jednu nedelju).

## Sam pročitao (trener) i ispravio
- p01, p04, p08, p11, p13, p06 dan po dan. Ispravljeno usput: 3 dana — kratak prag u četvrtak skraćivao je nedelju,
  pa je dugi nosio 51 % (p08 ned 2) → četvrtak lagan sa dodatkom, utorak smenjuje R i prag; najteža je imala samo
  70 % tempa trke (prvi trening podražaja) → uvod tempa trke u N−5; prag u 5 deonica prelazio plafon (zaokruživanje
  na minut) → 4 deonice i plafon 24 min; `rp-1200` kod sporog (2 × 1,2 km > plafon) → `minDoseSec` 18 min; hod-trk
  početnik imao dva testa i nedelju od 2 treninga (rasterećenje svake 3.) → svake 4., bez ranog testa; tempo trke
  hod-trka nije stajao (min 3 × 800 m) → `rp-400`; početnik — skok + 20 % posle rasterećenja (čuvar) → linearan rast.
- Ostaje: p06 (brz, 25 km, 5 dana, 6 ned) — 4 od 4 nedelje gradnje bez drugog kvaliteta, nedelja −2 27,7 km > 85 %
  vrha, N−1 bez tempa trke (motor, kao 10 km p06 B9); p12 početnik sa 45 km — vrh 40 km (× 0,89): dugi ≤ 90 min i
  lagan ≤ 80 % dugog ne nose 45 km na 4 dana (podatak bira bezbednost, upozorenja nema); p13 i p06 N−1 bez tempa trke;
  p03 (10 ned, 3 dana) ima samo jedan trening R.

## Zahtevi za motor (nisam menjao; zaobiđeno u podacima ili imenovano u testu)
1. Dan sa dodatkom (ubrzanja) ne čuva `minEasySec`: u sužavanju i nedelji trke malog obima pada na 15–18 min
   (p03 N−1 „lagano 10 min + 4 × 20 s"). Zaobiđeno: 3 dana u N−1 i nedelji trke bez dodatka; test dozvoljava ≥ 14,5 min
   samo u lakšim nedeljama i uz `lagan-kratak`. Predlog: dodatak samo na dan ≥ `minEasySec`.
2. Lagan dan se zaokružuje na 0,5 km naniže, pa 20 min postaje 18 min (test: ≥ 18 min).
3. `lagan-kratak` + kratak plan (p06): najkraći lagani dani drže nedelju −2 iznad 85 % vrha (`silazak`); kapija
   `it.fails` za p06 (`gate.test.ts`, `ENGINE`).
4. `dosePct × osnovica` (isto kao 10 km t. 2): osnovica = udeo × vrh prelazi plafon kod velikog obima, pa N−2 sa
   0,82–0,85 dobija pun plafon (p01 N−2 21 min prema 22). Zaobiđeno udelima (osnovica ≈ plafon kod 40 km).
5. `minDoseOf` = (minReps − 0,5) × deonica: unos prođe sa pola deonice manje, pa zaokruživanje pređe plafon
   (`rp-1200` kod sporog, `i-800` kod malog obima). Zaobiđeno `minDoseSec` i manjim `minReps`.
6. Dugi < lagan kad je lagan dan na najkraćem trajanju a dugi je udeo male nedelje (6 dana × 20 km): mreža testa
   izostavlja 6 dana < 35 km.
7. Forma „ništa se nije desilo" → 1–8 s sporije kod p02, p03, p05, p09, p14 (isto kao 10 km i HM; `FORM_DRIFT`).
8. `birthYear` motor ne čita (p16 stariji trkač dobija plan kao spor trkač istog obima, bez rečenice o godinama).
9. Ispis zove „vršnom" nedelju najvećeg obima (Z9), a najteža (peak) je druga nedelja — kod 5 km je to češće,
   jer je najteža posle rasterećenja sa proverom.

## Šta nije uspelo / otvoreno
- Kapija je prilagođena 5 km, ne olabavljena: donja granica brzog rada meri najbržu nedelju (najteža nedelja 5 km
  je posle provere i nosi tempo trke + završnicu dugog), tempo trke ≥ 4,5 km (srednji, brz) / 2,4 (spor) / 2 (mali,
  početnik) / 1,2 km (hod-trk), K8 dozvoljava R i oštrenje ≥ 6 min (README: R 6 → 12 min, oštrenje 7–9 min).
- Bez ocene trenera i drugog sudije za 5 km.
- `F7-COMMON.md` ne postoji na grani — ako je sadržao nešto što ovde nedostaje, to nije urađeno.
