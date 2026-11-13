# Krug 4 V4 HM — izveštaj (motor E1–E9, podaci D1–D9), 13. 11. 2026

Grana `claude/v4`. Testovi V4 + izolacija: **597 prolaze, 7 očekivano pada (`it.fails`), 0 pada**; typecheck čist.
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

## Po profilu
| profil | vrh km (×) | najduži dugi | brz rad najviše (vršna) | udeo dugog | brz rad ned −2 / ned −1 (min) |
|---|---|---|---|---|---|
| p01 | 54,5 (1,36) | 20,5 | 22 % (22 %) | 40 % | 34 / 9 |
| p02 | 54,4 (1,36) | 20,5 | 24 % (24 %) | 42 % | 33 / 9 |
| p03 | 38,1 (1,52) | 17,8 | 24 % (24 %) | 49 % | 32 / 9 |
| p04 | 67,5 (1,23) | 21,5 | 21 % (10 %) | 32 % | 28 / 9 |
| p05 | 112,7 (1,25) | 28,0 | 21 % (16 %) | 26 % | 44 / 9 |
| p06 | 44,3 (1,27) | 17,0 | 24 % (24 %) | 40 % | 25 / 9 |
| p07 | 71,0 (1,29) | 21,5 | 20 % (12 %) | 31 % | 29 / 9 |
| p08 | 49,5 (1,10) | 21,5 | 22 % (17 %) | 50 % | 21 / 9 |
| p09 | 61,8 (1,37) | 22,0 | 22 % (19 %) | 39 % | 32 / 9 |
| p10 | 36,0 (1,44) | 17,6 | 23 % (23 %) | 50 % | 35 / 9 |
| p11 | 39,0 (1,95) | 16,2 | 18 % (18 %) | 42 % | 16 / 9 |
| p12 | 60,8 (1,35) | 19,8 | 12 % (8 %) | 36 % | 19 / 9 |
| vlasnik-v1 | 37,3 (1,24) | 16,0 | 24 % (24 %) | 43 % | 29 / 9 |
| vlasnik-v2 | 46,8 (1,56) | 17,5 | 24 % (24 %) | 43 % | 31 / 9 |

Broj izmena: s05 13 · s06 11 · s13 8 · s14 11 · s16 9 (krug 3: 27 · 15 · 12 · 23 · 49). Čuvar posle svih 24 scenarija: 0 nalaza.

## Nije uspelo / otvoreno
- E1: s05 13 (cilj ≤ 12) i s14 11 (≤ 10) — preostale izmene su u rampi i 14 dana posle nje (stvarno skraćenje).
- D4, D5, D8 nisu urađeni; D1 i D2 delimično (p04 dugi stoji 2 h 05 u ned 3–7).
- D7 je spustio vršni brz rad (p12 8 %, p04 10 %) — sudije da kažu da li je to premalo.
- p07 taper: nedelja −2 bez kvaliteta usred nedelje (budžet od 60 % potrošio blok u dugom dan ranije).
- P2 B kreće sa 13,3 km jer dan pre plana ima test 10 km (rampa po pravilu), ne zbog obima.
- `FORM_DRIFT`: p01, p02, p03, p07 (novo, 1 s), p08, vlasnik-v1, vlasnik-v2.
