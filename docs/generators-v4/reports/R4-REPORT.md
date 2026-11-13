# Krug 4 V4 HM — izveštaj (motor E1–E9, podaci D1–D9), 13. 11. 2026

Grana `claude/v4`. Testovi V4 + izolacija (posle dopune): **598 prolaze, 7 očekivano pada (`it.fails`), 0 pada**; typecheck čist.
Kapija (`plans/gate.ts`, `gate.test.ts`): **0 prekršaja, 14/14**. `target-compare`: 25 od 72 nedelje (krug 3: 23).

## Motor
| # | stanje | šta |
|---|---|---|
| E1 | delimično | posle rampe + 14 dana prvobitan plan bajt-isto (`restoreAfter`); najteža nedelja ≥ 21 dan posle rampe netaknuta; merilo povratka poslednja puna nedelja GRADNJE, obim u km. s05 27 → 13 (cilj ≤ 12), s16 49 → 9, s14 23 → 11 (cilj ≤ 10), s13 → 8, s06 → 11 |
| E2 | posredno | nema više skraćenih nedelja van prozora (E1), udeo dugog u km (E7); posebno pravilo „dugi ≤ 45 % skraćene nedelje" nije dodato |
| E3 | urađeno | pomerena provera ne ide u ± 2 dana od tempa trke/bloka i ne menja jedini tempo trke; inače otpada uz rečenicu |
| E4 | urađeno | `safety.painReturnFromLevel` (HM 5): bol 4/10 menja samo prozor zaštite (2 dana odmor, 10 dana lagano) |
| E5 | urađeno | `safety.shortEffortSec` (65 min): trka van plana do 10 km = oporavak kao planirana provera; s02 8 → 1 izmena |
| E6 | urađeno | polazni obim = prosek poslednje 3 nedelje (uz bol/pauzu u njima ne); povratnik koji već trči 3+ nedelje nema ponovnu rampu; ravnomeran rast nije umor. P1 B nedelja 1 23,6 → 34,1 km. P2 B 13,3 km (trka 10 km dan pre plana → rampa) |
| E7 | urađeno | udeli dugog u km (podatak), blok u dugom sa svojim km; prag malog obima 43 km procene ≈ 45 km stvarnih |
| E8 | urađeno | `fitness/`: pripisani napredak plana samo u očekivano vreme, trenutna procena i tempa se ne pomeraju; „niska" → očekivano ≤ 1 % brže. s24 2:02:10 → 2:02:10, s04 pre testa 2:02:10 (nije brža od unete); p06, p09, p12 izašli iz `FORM_DRIFT` |
| E9 | urađeno | `safety.taper`: 8–14 dana pred trku ≤ 2 brza treninga i ≤ 60 % brzog rada vrha (brojač preko granice nedelje, ostvaren rad), poslednjih 7 dana samo oštrenje; čuvar `taper` meri brz rad. Poseban nalaz `silazak-intenziteta` nije dodat — pokriva ga `taper` + test |

## Podaci
| # | stanje | šta |
|---|---|---|
| D1 | delimično | talas samo na plafonu; dugi kreće sa 85 % polaznog i raste korakom; lagani dani se mere prema dugom koji trkač trči → nedelja se ne ljulja (p04 52,8/55,6/55,9; p05 92/91/93). p04 dugi 1 h 45 → 2 h 05 u ned 3, pa stoji do ned 7 (cilj: rast do 2 h 10 u ned 7) |
| D2 | delimično | hod-trk dugi do 50 % nedelje; P2 B najduži 14,8 km (k3 11,3); + 10 min po nedelji nije posebno pravilo |
| D3 | urađeno | `safety.longVsRace` (očekivano ≥ 2:05): dugi ≤ trka + 5 min, blok ≤ 35 min (p03 17,8 km, p10 17,6 km); p10 bez drugog testa 5 km |
| D4 | nije | vlasnik-v2 najduži 17,5 km (cilj 18 u ned 13 i 15) |
| D5 | nije | p06 lagani dani 35 min i p07 rast ≤ 8 % nisu posebno rađeni (p07 vrh 71 km, × 1,29) |
| D6 | urađeno | p08 dugi 17,5 → 19 → 20,5 km; kapija: 3 dana nedelja 1 ≥ 90 % |
| D7 | urađeno | `safety.weeklyZoneMaxSec`: tempo trke uklj. blok — početnik 45, srednji 60, napredni 75 min nedeljno |
| D8 | nije | razmak prag–tempo trke < 5 s/km nije obrađen |
| D9 | urađeno | kapija (lagan/dugi prema dugom koji trkač trči, nedelja rampe kao motor, nedelja 1 za 3 dana), `round5.test.ts` (E9, D3, D7), izmene testova motora; ispisi osveženi |

## Po profilu (posle dopune)
| profil | vrh km (×) | najduži dugi | brz rad najviše (vršna) | udeo dugog | brz rad ned −2 / ned −1 (min) |
|---|---|---|---|---|---|
| p01 | 54,5 (1,36) | 20,5 | 22 % (22 %) | 41 % | 34 / 9 |
| p02 | 54,4 (1,36) | 20,5 | 24 % (24 %) | 42 % | 33 / 9 |
| p03 | 38,1 (1,52) | 17,8 | 24 % (24 %) | 49 % | 32 / 9 |
| p04 | 68,4 (1,24) | 22,4 | 21 % (18 %) | 35 % | 49 / 9 |
| p05 | 110,2 (1,22) | 28,0 | 16 % (16 %) | 26 % | 44 / 9 |
| p06 | 44,6 (1,27) | 17,0 | 24 % (24 %) | 40 % | 25 / 9 |
| p07 | 71,5 (1,30) | 21,5 | 21 % (21 %) | 31 % | 45 / 9 |
| p08 | 47,4 (1,05) | 21,5 | 25 % (25 %) | 48 % | 36 / 9 |
| p09 | 61,8 (1,37) | 22,0 | 20 % (19 %) | 39 % | 32 / 9 |
| p10 | 36,0 (1,44) | 17,6 | 23 % (23 %) | 50 % | 32 / 9 |
| p11 | 39,1 (1,96) | 16,2 | 18 % (18 %) | 42 % | 16 / 9 |
| p12 | 60,8 (1,35) | 19,8 | 18 % (18 %) | 35 % | 24 / 9 |
| vlasnik-v1 | 37,2 (1,24) | 15,0 | 25 % (25 %) | 42 % | 29 / 9 |
| vlasnik-v2 | 47,3 (1,58) | 18,5 | 24 % (24 %) | 42 % | 31 / 9 |

Broj izmena: s05 13 · s06 12 · s13 8 · s14 11 · s16 9 (krug 3: 27 · 15 · 12 · 23 · 49); čuvar posle svih 24 scenarija: 0.

## Dopuna kruga 4 (poruka organizatora, 13. 11.)
1. D7: odsečen tempo trke postaje prag (`weeklyZoneMaxSec.fallbackStimulus`); vršna nedelja sada 16–25 % kod svih
   (p12 8 → 18 %, p04 10 → 18 %); kapija proverava 16–25 % (pocetnik-nov i tegoba ≥ 10 %).
2. p07 i opšte: u nedelji −2 blok u dugom najviše pola budžeta — p07 ima tempo trke 3 × 1,5 km usred nedelje.
3. E2: `safety.shortenedLongMaxShare` 0,45 — skraćena nedelja (ponovno planiranje, rampa) skraćuje dugi i blok
   srazmerno; test u `round5.test.ts`.
4. D4: v2 dugi 18 / 18,5 km u ned 12–13 (udeo do 42 % od 45 do 50 km, trener § D4; i u kapiji); ned 15 16 km.
   D1: p04 dugi 1 h 45 → raste i posle polaznog (pola koraka nedeljno), ned 7 20,2 km.
5. D5: nije urađeno — najkraće lagano 35 min po nivou traži novi parametar po nivou na više mesta motora; p07 rast
   prve tri nedelje + 10 % / + 3 % (km), pravilo motora je 7 % u km, višak je brži rad kvaliteta.
6. D8: `minZoneGapSecPerKm` 5 — p05, p06: prag otpada u nedelji sa tempom trke, zaglavlje „tempo trke ≈ prag".
7. D2: P2 B ned 2 20,5 km (rampa samo prve nedelje); hod-trk dugi do 95 min (14,8 km) — 1 h 40 traži veći obim
   nedelje od 30 km uz udeo 50 %.
8. E1: s05 13 i s14 11 ostaju — preostale izmene su u rampi i 14 dana posle nje (stvarna skraćenja dana);
   manje bi tražilo novo pravilo (npr. bez izmena laganih dana u prozoru), pa nije rađeno.

## Dopuna 2
- p08 najduži 21,5 km (≥ 20,5 km u 4 nedelje, ned 1 = 85 %): sa 3 dana pod dugog ne raste do polaznog
  (`longFloorGrowMinRunDays` 4); rast posle polaznog samo `spor` sa 4+ dana (`longGrowPastStart`, p04).
- Najduži dugi prema krugu 3: nijedan duži osim v2 (18,5), p04 (22,4), P2 B i p02 (20,0 → 20,5: jedan korak
  zaokruženja 0,5 km zbog udela u km, E7); udeo malog obima 0,41 / 0,43.
- s06 bez nalaza: kad se najteža nedelja gradi iznova, gradi se i sužavanje, a merilo silaska je ostvaren brz rad
  vršne nedelje (isto što meri čuvar). K5: zbir nedelje = zbir prikazanih minuta dana. target-compare 30/72.

## Nije uspelo / otvoreno
- E1: s05 13 (cilj ≤ 12) i s14 11 (≤ 10) — preostale izmene su u rampi i 14 dana posle nje (stvarno skraćenje).
- D4, D5, D8 nisu urađeni; D1 i D2 delimično (p04 dugi stoji 2 h 05 u ned 3–7).
- D7 je spustio vršni brz rad (p12 8 %, p04 10 %) — sudije da kažu da li je to premalo.
- p07 taper: nedelja −2 bez kvaliteta usred nedelje (budžet od 60 % potrošio blok u dugom dan ranije).
- P2 B kreće sa 13,3 km jer dan pre plana ima test 10 km (rampa po pravilu), ne zbog obima.
- `FORM_DRIFT`: p01, p02, p03, p07 (novo, 1 s), p08, vlasnik-v1, vlasnik-v2.
