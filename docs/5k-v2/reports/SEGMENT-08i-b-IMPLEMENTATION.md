# 5K v2 — Segment 08i-b (5k-v2.10.1): zbir zaštićenih dana po činjenicama; test se ne stavlja na zaključan dan

Polazni SHA `46e72eb` (posle 08i `7576774` i dopune MASTER pouke 37). Odluke organizatora 08i-b (1) i (2). Menjano
`fiveK/v2/**`, `docs/5k-v2/**`; izuzeci kao 08i (redovi „5K v2" u byteSame, oznaka u `fiveKV2Flow.test.tsx`).

## 1. Uzrok korak po korak | strana | ispravka | test

| # | uzrok | strana | ispravka | test |
|---|---|---|---|---|
| 1 | 08i: zbir zaštićenih = PLANIRANI km; neodrađen dan pauze „jede" cilj → preostali dani na minimumu (MIXED_OVER_TARGET 10 362 / 12 634 tokova pauze) | konstruktor + validator | `assess.factKmOf` (jedino mesto): eksplicitna pauza = 0; zapis = urađeni km (neurađen 0); poznat dan bez zapisa (potpuna pokrivenost, Odluka 3) = 0; inače (asOf bez zapisa i pokrivenosti, zaključan budući) planirani km. `week.protectedKm` sabira; konstruktor upisuje `PlanWeek.protectedKm` kad se razlikuje od planiranih km i validator ga treba (nedelja je tada mešovita, `written.writtenWeek`); validator čita | `segment08i.node.test.ts` 08i-b: factKmOf, pauza 10, više od plana |
| 1a | nedelja ostatka pauze (`volume.pauseRemainderKm`) ima dva pravila | konstruktor + validator | jedan vlasnik: pravilo pauze; pouka 37 je ne menja. Merenje: izuzetak isključen → 0 promenjenih tokova od 99 069 (pravila se ne sudaraju) | regresija |
| 1b | otpao samo drugi kvalitet → doza nedelje se nije beležila → R sledeće nedelje niži (BASE_R_DECREASE, `start-day.ts` 25 odbijanja usput) | konstruktor | `week.secondEasyDose` (kao pouka 35); q1 ostaje najduže | `start-day.ts 5K 6` 0 |
| 1c | lanac: nedelja kojoj je ranija adaptacija skinula drugi kvalitet je sada prošlost, upisana ≠ sastavljena → doza se ne beleži → DOSE_PROGRESSION (08g mreža 4 toka usput) | konstruktor | upisana bez q2, q1 isti → `secondEasyDose` | 08i-b lanac r-d4-13w-15km-v58-0 |
| 1d | (dopuna MAR-08) kvalitet je otpadao i kad ni bez njega nedelja ne staje | konstruktor + validator | kvalitet otpada samo kad time ostatak staje; inače ostaje, lagani na minimumu, MIXED_OVER_TARGET (`mixedFloorKm(…, withQuality)` za upisani minimum). 816 tokova regresije zadržava kvalitet (umor 605, više od plana 211) | primer nalaza: 18,28 + upozorenje, kvalitet ostaje |
| 2 | umor u nedelji testa (po osećaju) premešta test u k + 1 na zaključan kvalitet → TEST_WEEK 168 / 9 919 | konstruktor (`steps.framesFor`) | test se ne stavlja na zaštićen dan prethodnog plana — otpada uz napomenu nedelje, bez drugog testa (kao maraton A13/A13b) | 08i-b f-d4-6w-30km-e420-0; trajna mreža sa zaključanim danom i u planu po osećaju |

Novi testi 1, 2 i factKmOf padaju na 08i (`7576774`; 4 pala, 5 starih prolazi); lanac (1c) je nađen usput na 08i-b kodu i pada bez ispravke 1c (sabotaža b-5).

## 2. Merenje (iz `web/`; izlazi `artifacts/segment-08i-b/`)

| skripta | e2e482e | 08i | 08i-b |
|---|---|---|---|
| `mixed-deload.ts` 5K | plan > cilj 22/42 (+2,39, max 4,6) | 7/42 (svi upozorenje; +1,29) | 7/42, svi upozorenje; kvalitet ostaje → +2,28, max 3,01 (dan 1 bez zapisa → planirani km) |
| tokovi pauze sa MIXED_OVER_TARGET (regresija) | 0 (tiho > cilj) | 10 362 | **0** — dani kao na e2e482e |
| trajna mreža 08i (pun) | — | lock samo plan sa rezultatom | lock i po osećaju: 9 947 tokova, 0 odbijanja; test otpao (zaključan dan) 168 — tačno ranijih 168 TEST_WEEK |
| ostale skripte organizatora (fatigue-monday, fatigue-repeat end, locked-result, start-day 6, fatigue-testweek 3, early 29 19 11) | 0 odbijanja | 0 | 0 odbijanja, izlaz isti kao e2e482e (osim mixed-deload) |

## 3. Regresija (99 069 tokova, `regress-08i-b.txt`; heš bez oznake verzije)

Prema e2e482e: generator bajt-isti; promenjeno 20 405; **ciljevi 0, km naviše 0, odbijanja 0**; svaki promenjen tok
ima napomenu pouke 37 ili `protectedKm` (drugih 0).

| klasa | promenjeno | dani | samo `protectedKm` | upozorenje |
|---|---|---|---|---|
| pauza 10/20/35, bol+pauza, lanac (+ drugi korak) | 15 160 | 0 | 15 160 | 0 |
| više od plana (over120: urađeni km > planirani) | 2 666 | 1 818 | 0 | 1 094 |
| umor (zapisi 6 km na zaštićenim danima > planirani) | 2 563 | 1 109 | 384 | 1 315 |
| bol 5 (zapis neurađen = 0) | 16 | 0 | 16 | 0 |
| ostalih 9 scenarija | 0 | — | — | — |

Prema 08i: pauza i lanac se vraćaju na e2e482e (km naviše prema 08i = povratak stisnutih dana; ciljevi 0).
Pravilo pauze kao vlasnik: izuzetak isključen → 0 promenjenih tokova (`regress-pause-owner-off.txt`). Trajna rana mreža
08g (104 800) prema e2e482e: promenjeno 14 908, sve M (pouka 37 / protectedKm), 0 odbijanja. Fixture 08g ponovo snimljen:
promenjeno 20 704 (M 14 848, F 3 272, P 1 980, R 399, N4 171, N3 34), bez razloga 0. 08e TOTALS šira 2 672 → 3 168
(porodica + 496), uska isto.

## 4. Sabotaže

| # | sabotaža | ishod | prvi pali test |
|---|---|---|---|
| b-1 | zbir zaštićenih po planu (stara strana) | PAO | 08i-b pauza 10 |
| b-2 | validator ne čita `protectedKm` | PAO | 08i-b više od plana |
| b-3 | test i na zaključan dan | PAO | trajna mreža 08i (TEST_WEEK) |
| b-4 | trajna mreža bez zaključanog dana u planu po osećaju | PAO | trajna mreža 08i (test otpao 0) |
| b-5 | upisana nedelja bez drugog kvaliteta ne nosi dozu (lanac) | PAO | 08i-b lanac r-d4-13w-15km-v58-0 |

5/5 PALO, 18 s; sabotaže 08i (prilagođena 08i-1) 4/4 PALO; stanje `src` isto.

## 5. Komande (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check .` | exit 0 |
| `npm run check` | exit 0 — 301 / 3558, 523 s |
| `TEST_FULL=1 npx vitest run --changed 46e72eb` | exit 0 — 187 / 1902, 923 s |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 30 / 708, 351 s |
| `TEST_FULL=1 … segment08i.{grid,2.full,3.full}` | po delu 18–20 s |
| `npx playwright test e2e/fivek-v2.spec.ts` | 3 / 3 |
| byteSame 10K/HM/maraton | samo redovi „5K v2" (oznaka; sa oznakom 5k-v2.10.0 prolaze bez snimanja) |

## 6. Napomene

- Poznat dan bez zapisa (potpuna pokrivenost, Odluka 3) računam kao 0 — činjenica „nije trčao"; bez toga pauza 10/35
  (pauza iz pokrivenosti, ne prijavljena) ostaje stisnuta. asOf bez zapisa i bez pokrivenosti = planirani km.
- Više od plana i umor sa zapisima na zaštićenim danima sada skraćuju preostale dane (urađeno > planirano) — posledica
  pravila „cilj važi za celu nedelju".
- `PlanWeek.protectedKm` je nov opcioni podatak plana (bez migracije); nedelja sa njim je mešovita.

## 7. Stalni uslovi (AGENTS.md 1–8)

1. Jedan vlasnik: km zaštićenog dana — `assess.factKmOf`; zbir — `week.protectedKm`; ostatak — `week.mixedRemainder`;
   nedelja pauze — `volume.pauseRemainderKm`; mesto testa — `steps.framesFor`. 2. Plafoni nedirnuti. 3. WU/CD nedirnuti.
4. Činjenice i zaštita poznate unapred (`Written.factKm`). 5. Handoff bez izmene. 6. `5k-v2.10.1`; KNOWN_VERSIONS ∪
   5k-v2.10.0. 7. Izolacija prolazi. 8. Trajna mreža 08i: 0 odbijanja, Uslov 8 bez prekršaja.
