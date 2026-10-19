# HM v2 — Segment 04: adaptacija (hm-v2.3.0, HM-04 korak B)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `1146abc` (hm-v2.2.1, korak A `eb29e76`). Menjano
samo `halfMarathon/v2/**` i `docs/hm-v2/**`; HM v1, `halfMarathon/index.ts`, lični plan, aplikacija i druge distance
netaknuti. Adaptacija je kopija 10K v2 (A1–A17, pouke 7, 16–25, 28–33) sa brojevima H18; nula uvoza van foldera.

## Odluka | mesto | test (DECISIONS A1–A15, A17, A18)

| odluka (H18)                                                                                                                                     | mesto (jedno)                                                               | test                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------- |
| Činjenice → korak (rezultat 5000/10000/21097,5/42195 m, test, pauza, bol, umor, izvršenje, coverage) A1–A10                                      | `assess.ts` (jedino mesto odluka koraka)                                    | `adapt.node` A1–A10, pouka 7 (a–e) |
| Cilj nedelje, smanjen/ukinut, prinudno rasterećenje, sidro bola r i osnova povratka (pouka 18)                                                   | `steps.ts` framesFor/reducedWeeks, `volume.ts` adaptNominal10/returnBase10  | A2–A5, A8, A17, pouka 18, 22       |
| Nov start (≥ 28 dana), rePeriodize; „orijentir" kad do trke < 10 ned                                                                             | `steps.ts`, `periodize.ts` rePeriodize, `generate.ts` (goal)                | A3, A12                            |
| Bol: dugi ≤ 60 min, lagani × 0,7 (≥ 4 km), bez kvaliteta/ubrzanja; bol ≥ 7: 3 dana odmora                                                        | `week.ts` limitDays, `lengths.ts` painLong10/limitedEasy10                  | A4, mreža 04 (bol 5/8 svakog dana) |
| Taper posle smanjenja = 0,7 × najveći cilj izgradnje posle poslednjeg smanjenja; pod = minimum nedelje                                           | `volume.ts` adaptNominal10 (downOnly), fit10                                | pouka 7 (b, g)                     |
| Prošlost = upisani dani (stanje doze, najduži/poslednji dugi, taper, pouka 28); validator vidi upisan plan                                       | `written.ts`, `generate.ts` construct, `validate.ts` ({ state })            | pouka 29 (2 testa)                 |
| Pouka 30 (trkačka ≤ taper, višak laganog = odmor), 31 (prinudno u uvodu), 20 (newLimits), 23, 25                                                 | `week.ts` raceWeekRest/raceWeek, `steps.ts` newLimits                       | pouke 30, 31, 20, 23               |
| A18: rasterećenje posle smanjenja — dugi ≥ 4 km (kao 10K deloadLengths `adapted`)                                                                | `lengths.ts` deloadLong10                                                   | A18                                |
| Pouka 34: umor pre starta — ned 1 = 0,8 × planirana ned 1, ned 2 = planirana ned 1; referenca (dugi, doza) = ned 1 generatora, zapisana u koraku | `assess.ts` (preStart), `steps.ts` initialState, `volume.ts` adaptNominal10 | pouka 34 (2 testa)                 |
| Bez koraka = generator hm-v2.2.1 (pouka 16/17); bez činjenica nedelje bajt-iste                                                                  | `generate.ts` construct(raw, [])                                            | pouka 16/17, bazne linije 02/03    |

## Odstupanja i ispravke nađene mrežama (sve u jednom mestu odluke, validator čita istu funkciju)

1. **A18 dugi rasterećenja ≥ 4 km** u nedelji posle smanjenja (10K isto): posle povratka sa dugim 4 km 0,8 × = 3,2 km
   (ispod laganog) → WEEK_INFEASIBLE 18 tokova (pauza 35, `d4-r-14w/w1wed`). Generator bez koraka nepromenjen.
2. **Validator: stanje doze iz upisane mešovite nedelje** (pouka 29; ranije 'unknown') — DOSE_DROP 134 toka rane mreže
   (pauza/manjak u sredu = dan Q1; konstruktor čita upisan T 3000 m).
3. **Pouka 30 uz mešovit taper** (validator `restP30` čita upisan taper) — RACE_WEEK 42 toka (bol 8 u sredu tapera).
4. **Trkačka nedelja samo sa trkom** kad su svi dani pre trke dani odmora A4 (3 dana, bol ≥ 7 u nedelju pred trkačku):
   nije EMPTY_WEEK (trka ≥ minimum nedelje; ispod minimuma važi RACE_WEEK_SHORT). 8 tokova. **Traži potvrdu.**
5. **Nedelja 1 tempom nedelje 1** (WEEK1_BELOW_START posle novog rezultata na kraju ned 1) — 350 tokova široke pretrage
   (klasa po primeru; posle ispravki 5 i 6 široka pretraga 0).
6. **Taper „samo RP" (druga pretraga)**: drugi član plafona (pouka 32) za nedelju sa jednim danom kvaliteta (T dan je
   lagan, dugi kraći) — QUALITY_OVER_LONG 8 tokova. Konstruktor i validator; 0 planova generatora promenjeno.
7. **Pouka 34 (dopuna organizatora, MASTER bd07eec)**: umor sa asOf pre starta bio je odbijen u 99/99 tokova
   (WEEK_INFEASIBLE, pa START_LEVEL); referenca je činjenica koraka (`preStart`), validator je čita kao stanje pre ned 1.
   Bol 5/8, pauza 10 i rezultat pre starta prolazili su i pre (0 / 990).
8. Invarijante (test kod): niz izgradnje broji od ukinutog rasterećenja osnovne periodizacije (lanac), povratni rast
   poredi cilj po pravilu kad je nedelja `fitted` (H6), džog oporavka tempom nedelje.

## Mreže (K1 = 0 odbijanja i grešaka validatora, adaptInvariants prazno)

| mreža                                                                                                                                                    | tokova  | odbijanja | invarijante |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------- | ----------- |
| 04 (33 plana × asOf § 3 × 17 scenarija + lanac + bol 5/8 svaki dan ned 2 i sredine)                                                                      | 5154    | 0         | 0           |
| rana i srednja (171 plan: 02/400, osećaj/80, početnik/40; asOf pouke 23 i pre starta − 1/− 3/− 6; 7 scenarija)                                           | 27 062  | 0         | 0           |
| široka (`wide04.ts`: 401 plan 02/150, osećaj/60, početnik/25, gusta/4000, r 8/15 km/500 × pre starta − 1/− 3/− 6, sreda i kraj ned 1…N − 2 × 17 + lanac) | 204 519 | 0         | 0           |

Klase nađene usput (pre ispravki 1–6): WEEK_INFEASIBLE 18, DOSE_DROP 134, RACE_WEEK 42, EMPTY_WEEK 8, WEEK1_BELOW_START
350, QUALITY_OVER_LONG 8; umor pre starta 99/99 (tačka 7); invarijante 47 + 41 + 3 (artefakti invarijanti, tačka 8 — 3 iz široke pretrage su
„dan kvaliteta > dugi" zbog tempa posle rezultata u invarijanti, ne ponavljanje najnižeg nivoa iz MAR-04b; u HM
mrežama nema greške ponavljanja najnižeg nivoa). Nerazjašnjenih klasa: 0.
Dodatno: bol 5/8 svakog dana nedelje N − 2 i tapera (330 planova, 9240 tokova): 0 / 0.

## K1–K6 (adaptirani planovi mreže 04, `k04.json`; generator = HM-03b, nepromenjen)

K1 0. K3 nedelje izgradnje bez kvaliteta bez razloga (ograničenje koraka, A9, uvod, H11): 0. K4: vrh generatora
nepromenjen (0 planova promenjeno); posle adaptacije vrh ≤ nivo pre smanjenja (invarijanta). K5: trkačka > taper 0,
susedni teški dani 0, dugi < lagan 0, pad doze van kapaciteta 0 (validator). K6: SLOT_REPEAT 0, dan kvaliteta iznad
najnižeg nivoa duži od dugog 0 (LONG_SHORTER_THAN_QUALITY najniži nivo 232), DOSE_DROPPED 158, CAPACITY_LIMITED 0,
vrh/start ≤ 1,40; PLANNED_BELOW_TARGET_LIMITS 667 (dani bola/odmora, pouka 25), RACE_WEEK_SHORT 0.

## Regresija

Bez koraka plan = generator hm-v2.2.1: `construct(input, []) = generateHmV2(input)` (33 plana), bazne linije 02 (16 896),
03 osećaj (6336), početnik (1890), HM-01/02 heševi i r — pun nivo prolazi, 0 promenjenih planova. Adaptacija bez
činjenica: sve nedelje bajt-iste. Odluka A1–A15 iz 10K preneta; razlike: H18 brojevi (lagan bola ≥ 4 km, taper 0,7,
orijentir < 10 ned, rezultati 4 distance).

## Sabotaže (`node scripts/sabotage.mjs ../docs/hm-v2/artifacts/segment-04/sabotage.json --parallel 2`): 16/16, 77 s

B1 ukidanje (A17) ukida i prinudno (4,8 s) · B2 reduced se ne čita (5,1) · B3 sidro bola = poslednja nedelja bola (2,0)
· B4 validator vidi sastavljen umesto upisanog plana (16,9) · B5 trkačka bez pouke 30 (11,0) · B6 uvod početnika sa
kvalitetom pri umoru (11,7) · B7 bez dana zabrane kvaliteta (7,3, mreža 04) · B8 konstruktor: najduži dugi iz
sastavljenih nedelja (20,3) · B9 bez dugog ≥ 4 km (A18) (5,7) · B10 stanje doze posle mešovite nedelje nepoznato (7,8)
· B11 pouka 30 samo uz nemešovit taper (11,6) · B12 trkačka samo sa trkom = prazna (11,7) · B13 taper „samo RP" sa
dva dana u drugom članu (5,5) · B14 nedelja 1 tempom plana (5,5) · B15 umor pre starta bez reference (4,4) · B16 ned 2
raste posle umora pre starta (4,7). Prvi pali testovi: `sabotage-result.json`.

## Komande (iz `web/`)

`tsc -p tsconfig.domain.json` 0, `tsconfig.oracle.json` 0, `eslint src/domain/generators/halfMarathon/v2` 0, prettier 0.
HM v2 brz: 21 fajl, 206 testova, 50 s (mreža 04: svaki 12. tok po scenariju; rana: svaki 25.). Pun (`TEST_FULL=1`): 37 fajlova, 265 testova, 9 min 27 s.
`npm run check`: exit 0 — 264 test fajla, 3216 testova (6 min 48 s).

## Stalni uslovi 1–8

1. Jedan vlasnik: korak (assess), okvir (steps), cilj (volume.adaptNominal10), dužine (lengths), doza (quality); bez
   petlji skraćivanja; validator samo prijavljuje. 2. Jedan plafon po zoni (pouka 32 i u adaptiranim nedeljama). 3. WU/CD
   nepromenjeni; manjak ide u lagane dane ili PLANNED_BELOW_TARGET_LIMITS. 4. Uslovi poznati unapred ulaze u konstruktor
   (koraci, `Written`); završna zaštita samo proverava. 5. Handoff: van opsega. 6. policyId/policyVersion hm-v2.3.0,
   faza svake nedelje iz okvira. 7. `isolation.node` prolazi, bez novih izuzetaka. 8. Invarijante obaraju prazan
   trening, dugi < lagan, nedelju ispod minimuma (osim dana bola/odmora uz upozorenje).

## Jedan plan pre/posle (`artifacts/segment-04/plan-table.md`)

`d4-r-14w` (4 d, 40 km, VDOT 45), asOf sreda ned 6. Ćelija: cilj / planirano · dugi · kvalitet.

| ned | pre                        | bol 5                       | pauza 20                    |
| --- | -------------------------- | --------------------------- | --------------------------- |
| 6   | 50,5 / 50,6 · 20,2 · I + T | 50,5 / 34,6 · 9,7 · I 2400  | 31,4 / 32,8 · 12,5 · I 2400 |
| 7   | 53,5 · 21,4 · I 3000 + T   | 36,6 / 34,6 · 14,6 · T 2000 | 31,4 · 12,5 · —             |
| 8   | 42,8 R · 17,1 · T 2400     | 29,3 R · 11,6 · T 2000      | 34,5 · 13,8 · T 2000 (A17)  |
| 9   | 56 · 22,4 · RP 5000 + T    | 40,3 · 16,1 · RP 4000 + T   | 38 · 14,4 · RP 4000 + T     |
| 12  | 56 · 22,4 · RP 8000 + T    | 47,6 · 19 · RP 6000 + T     | 44,3 · 17,3 · RP 6000 + T   |
| 13  | 39,2 · 13,4 · RP 4000 + T  | 33,3 · 10,9 (0,7 × 47,6)    | 31,0 · 8,2 (0,7 × 44,3)     |
| 14  | 20,3 · RP oštrenje         | 18,3                        | 18,3                        |

Bol 5: 7 dana bez kvaliteta (dugi 9,7 km ≤ 60 min), sidro r = 6, povratak od 0,7 × nivo; pauza 20: 70 %, nedelja bez
kvaliteta pa 1 kvalitet, redovno rasterećenje ned 8 ukinuto (A17).

## Preostali problemi / pitanja za organizatora

1. Tačka 4 (trkačka nedelja samo sa trkom posle 3 dana odmora A4): prihvaćeno kao produžetak pouke 30 — potvrda.
2. K4 mreže r iz koraka A (259 / 10 944 planova sa nižim vrhom ≤ 3,8 km): prihvaćeno (organizator).
3. Pun nivo HM v2 traje ≈ 9–10 min (rana mreža 27 062 toka u 4 dela); brz nivo ≈ 50 s.
4. Klase 2, 3, 5 i 6 su u kodu prenetom iz 10K v2; 10K verovatno ima iste latentne slučajeve (nije provereno, van opsega).
