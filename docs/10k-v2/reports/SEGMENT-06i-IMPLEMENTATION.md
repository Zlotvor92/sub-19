# 10K v2 — Segment 06i (10k-v2.8.0): pouka 37 — mešovita nedelja, ostatak do cilja; earlyGrid u više delova
Polazni SHA `46e72eb`; spojeno 3d-10K (`a0f99f0`, 10k-v2.7.0) i grana do `c082abb` (jezgro 10K nedirnuto, samo app/oznaka).
Uključeni nalazi organizatora u toku: dopuna pouke 37 iz MAR-08 (kvalitet otpada samo kad time staje), K1 (zaključan
test), K2 (invarijanta trkačke sa danima odmora bola), K3 (lanac pre starta → ned 1, i 10K kao cilj predaje), K5
(invarijanta „dugi ≥ lagan" i zaključan dan). Menjano `tenK/v2/**`, `docs/10k-v2/**`; izuzeci: 13 redova `10K v2` u
`marathon/v2/app/byteSame.9443676.json`, oznaka verzije u `e2e/tenk-v2.spec.ts` i `tenKV2Flow.test.tsx` (kao 06f–06h).
## Uzrok korak po korak | strana | ispravka | test
| korak                                                                                                                                                                           | strana                  | ispravka                                                                                                                                                                        | test                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `generate.construct` gradi nedelju na cilj kao da je cela slobodna; `written.writtenDays` zamenjuje sastavljene dane zaštićenima → planirano = cilj + (zaštićeno − sastavljeno) | konstruktor             | `week.mixedRemainder` (jedino mesto) posle izbora cilja, iz `generate.mixed37`: preostali dani na ostatak = cilj − `written.protectedKm` (po činjenicama), samo naniže          | `mixedGrid.node` primer                      |
| `validate`: mešovita nedelja (`mixedWeeks`) sudi se samo po danu → planirano > cilj prolazi tiho                                                                                | validator               | nedelja nosi `keptKm`; preostali ≤ cilj − keptKm (+ 0,1), inače `MIXED_OVER_TARGET` ako su na `week.mixedFloorKm` (ista funkcija), inače `MIXED_REMAINDER`                      | `mixedGrid.node` validator                   |
| zbir zaštićenih: pauza 0, zapis dana = upisani km (neurađen 0), poznat iz potpune pokrivenosti bez zapisa 0, ostali planirani (`written.factKmOf`); nedelja pauze (`volume` remainder) ostaje pravilu pauze                  | konstruktor             | jedna definicija                                                                                                                                                                | neurađen / pauza / pokrivenost / 5 / 12,5 km; pauza 20 |
| K1: `steps.framesFor` premešta test i kad je dan testa zaključan → dva testa; validator sudi zaključanom testu po osnovi tempa posle novog rezultata                            | konstruktor + validator | `steps.protectedTest` (≤ asOf, zaključan, urađen): ne premešta se, okvir nosi test samo na istom danu; validator ga ne sudi                                                     | `lockedTest.node`                            |
| K2/K5: `adaptInvariants` „trkačka + trka < minimum" bez izuzetka dana odmora bola; „dugi ≥ lagan" sudi zaključanom laganom                                                      | test kod                | `week.restDaysWeek` (validator WEEK_MIN_REST i invarijanta); „dugi ≥ lagan" samo među preostalim danima                                                                         | `fatigue.node` 06i, two-step                 |
| K3: umor u ned 1 posle umora pre starta → rasterećenje ned 2 bez reference (lastBuild/lastLong null) → WEEK_INFEASIBLE                                                          | assess                  | pouka 36: zapisi u ned 1 koja je već rasterećenje pre starta → bez drugog; pouke 33/34: rasterećenje bez prethodne izgradnje sa dugim → referenca ned 1 generatora (`preStart`) | `prestartChain.node`                         |

Primer nalaza `d3-8w-20km-v30-A-sat` k3 (umor, asOf pon): cilj 17,0 — bilo dugi 10,1 + 4,7 + 4,7 = 19,5; sada 10,1 (upisan) +
3,5 + 3,4 = **17,0**, napomena, bez upozorenja. Redosled: dugi se ne seče; lagani do 3,0 (≤ preostali dugi); pa kvalitet
(Q2, pa Q1/test) — samo kad time staje (dopuna MAR-08); inače kvalitet ostaje, lagani 3,0, `MIXED_OVER_TARGET`. Trkačka
izuzeta (pouka 30). Razlika do 0,1 km (tolerancija D6) bez izmene — adaptacija bez činjenica bajt-ista.
## Merenje pre/posle (iz `web/`; pre = checkout 46e72eb, predaja/two-step pre = c082abb)
| skripta                                                        | pre                                                                         | posle                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `mixed-deload.ts` 10K (582 tekuća rasterećenja)                | plan > cilj 367 (+3,04, max 8,02), bez upozorenja; ne niže od prethodne 254 | **24, svih 24 MIXED_OVER_TARGET** (+2,61, max 6,21); 169                                  |
| `fatigue-monday.ts` 10K                                        | tekuća 268, bez novog 28                                                    | isto                                                                                      |
| `fatigue-repeat.ts 10K end`                                    | 963, drugo rasterećenje 0, odbijeno 0                                       | isto                                                                                      |
| `locked-result.ts 10K`                                         | 0 / 1960                                                                    | 0 / 1960                                                                                  |
| `start-day.ts 10K 25`                                          | 42 330, 0 odbijanja, inv 0                                                  | isto                                                                                      |
| `fatigue-startday.ts 10K 25` / `fatigue-testweek.ts 10K 25`    | 0 / 4980, 0 / 6650 (dva testa 0)                                            | isto                                                                                      |
| `early.ts 10K 193 97 29`                                       | 121 392, 0 odbijanja, 0 prekršaja                                           | isto                                                                                      |
| K1 `locked-test.ts 10K 97` / `locked-pause.ts 10K 193 97 29`   | 5 662 / 8 050, 394 / 34 944 (TEST)                                          | **0 / 0**                                                                                 |
| K2 `last-weeks.ts 10K 193 97 29`                               | inv „trkačka + trka < minimum" 141 / 93 192                                 | **0**                                                                                     |
| K3 `prestart-chain` (10K, `prestart-chain-10k.ts`)             | 836 / 43 656 WEEK_INFEASIBLE                                                | **0**                                                                                     |
| K3 predaja `handoff-adapt.ts 'HM>10K'` / `'MAR>10K'` 193 97 29 | 80 / 45 084, 44 / 35 088                                                    | **0 / 0**                                                                                 |
| K5 `two-step.ts 10K 193 97 29`                                 | cum: TEST 12, inv „dugi < lagan” 331 / 143 616                              | **0 / 0** (lib `DUGI<LAGAN` 331 ostaje: provera organizatora ne isključuje zaključan dan) |

## Regresija (`artifacts/segment-06i/regress.ts` + `regress-cmp.ts`, heš bez oznake verzije)
Svaki 80. plan R/F/B × 17 scenarija × asOf start − 6/− 3/− 1 i pon/čet/ned svake nedelje (umor svaki dan) + lanac:
**279 545 tokova**, promenjeno **11 353**, svi sa nedeljom pouke 37 (bez oznake 0; oznaka bez promene 0); nedelje pre
prve nedelje pouke 37 bajt-iste; odbijanja 390 = 390 (drugi korak lanca posle trke, ADAPT_AS_OF_INVALID, isto).
Po scenariju: over120 7 553, umor 3 774, bol 5 26, ostalih 14 scenarija 0. Generator bajt-isti (grid/feelGrid/beginnerGrid).
Promena CILJA (612 tokova, `targets-cmp.ts`): 336 samo trkačka — taper mešovit, najkraći lagan tapera kraći → lagan
trkačke (D23); 178 kaskada — kvalitet otpao u nedelji pouke 37 → stanje doze → D6/D12 cilj kasnijih nedelja ±0,5 km;
91 trkačka — kvalitet otpao ranije → doza tapera → lagan tapera (D7/D23); 7 trkačka — RP tapera otpao → bez oštrenja
(D8). Neobjašnjenih 0. Trajne mreže prema 46e72eb (`segment06i.adapt-changed-46e72eb.json`, `adapt-hashes-06i.ts`):
04 63/2040, E 373/102 707, R 0/18 193, P 0/336, start + 0 2507/24 672 — promenjeno ⇔ oznaka pouke 37 (tačno);
starije regresije porede stanje 46e72eb (`at46e` u lancu `at7ba`).

Pravilo pokrivenosti (organizator, kasnije): regresija 06i-pre-pravila → posle (279 545) promenjeno 0 — pause10/chain/painPause:
nedelja asOf je nedelja pauze (vlasnik pravilo pauze); kraća praznina: test `mixedGrid.node` pokrivenost, sabotaža 06i-l.

## Trajne mreže i podela
`mixedGrid` (10 delova): umor asOf svaki dan ned k ∈ 2 … N − 3 + umor/rezultat sa zaključanim ili urađenim Q1 ned k + 1 →
preostali ≤ cilj − zaštićeni (nezavisno po činjenicama) ili `MIXED_OVER_TARGET`, 0 odbijanja, adaptInvariants prazno;
`lockedTest` (4, K1), `prestartChain` (4, K3); `earlyGrid` 4 → 12 delova (obrazac maraton e7fe15d).
Trajanje dela (pun nivo, lokalno, sam): `earlyGrid.2.full` 98 s (bilo ~278 s; beforeAll), glavni `earlyGrid.node` 93 s,
`mixedGrid.2` 24 s, `lockedTest.2` 30 s, `prestartChain.2` 34 s (svaki 32. plan). Pokrivenost earlyGrid ista (`part` po indeksu).

## Sabotaže (`artifacts/segment-06i/sabotage-06i.json`, `--bail=1`)
| #                                                                                                             | sabotaža                               | prvi pali test                                                       | trajanje                                     |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| a                                                                                                             | ostatak se ne računa (stara strana)    | `mixedGrid.node` mreža (preostali > cilj − zaštićeni bez upozorenja) | 18,1 s                                       |
| b                                                                                                             | ostatak i naviše                       | `mixedGrid.node` neurađen dan → bez dopune (samo naniže)             | 19,5 s                                       |
| c                                                                                                             | neodrađen dan / pauza po planu         | `mixedGrid.node` po činjenicama                                      | 18,1 s                                       |
| d                                                                                                             | validator ne čita `mixedFloorKm`       | `mixedGrid.node` mreža                                               | 16,1 s                                       |
| e                                                                                                             | trajna mreža bez mešovite nedelje      | `mixedGrid.node` skup tokova                                         | 8,7 s                                        |
| f                                                                                                             | invarijanta bez izuzetka bola (K2)     | `fatigue.node` 06i                                                   | 5,1 s                                        |
| g                                                                                                             | kvalitet otpada i bez dobitka (dopuna) | `mixedGrid.node` dopuna                                              | 16,8 s                                       |
| h                                                                                                             | `protectedTest` uvek false (K1)        | `lockedTest.node` mreža                                              | 12,2 s                                       |
| i                                                                                                             | drugi umor → drugo rasterećenje (K3)   | `prestartChain.node` primer                                          | 35,7 s                                       |
| j                                                                                                             | bez reference ned 1 generatora (K3)    | `prestartChain.node` mreža                                           | 33,7 s                                       |
| k | validator sudi zaštićenom testu (two-step) | `lockedTest.node` zaključan test pa rezultat | 10,1 s |
| l | dan poznat iz pokrivenosti bez zapisa po planu | `mixedGrid.node` pokrivenost | 12,7 s |

Ukupno **12/12 palo** (a–j jednim pokretanjem 185 s; k, l posle), `src` bajt-isti (`sabotage-06i-result.json`).

## Komande (iz `web/`)
| komanda                                                                            | rezultat                                                                     |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check src e2e`              | exit 0                                                                       |
| `npm run check`                                                                    | exit 0 — 308 fajlova / 3600 testova, 486 s                                   |
| `npx vitest run --project node src/domain/generators/tenK/v2` (brz)                | 370 (posle ispravki svi prolaze)                                             |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/tenK/v2`          | 226 fajlova / 692 testa, 0 palih                                             |
| `TEST_FULL=1 npx vitest run --changed 46e72eb`                                     | exit 0 — 250 fajlova / 1986 testova, 2121 s                                                               |
| `npx playwright test e2e/tenk-v2.spec.ts`                                          | 3 / 3                                                                        |
| `BYTE_SAME_RECORD=1 … marathon/v2/app/byteSame.node.test.ts`                       | samo 13 redova `10K v2 #0/#1`; `personalPlan.node.test.ts` nedirnut, prolazi |
| `node scripts/sabotage.mjs ../docs/10k-v2/artifacts/segment-06i/sabotage-06i.json` | 12/12 palo (a–j, pa k, l pojedinačno)                                                       |

## Otvoreno
1. RP tapera otpada već kad je ostatak 0,1–0,2 km ispod (7 tokova: trkačka bez oštrenja, D8) — po pravilu „otpada kad
   time staje"; trenerski izbor za organizatora (npr. kvalitet tapera izuzet kao trkačka).
2. Validator proverava ostatak samo u nedelji sa `keptKm` (ne vidi činjenice); mešovita nedelja bez skraćenja i dalje
   sme planirano > cilj po planu kad zaštićeni dan nije odrađen (neodrađen dan ne „jede" cilj).

## Stalni uslovi (AGENTS.md 1–8)
(1) Jedan vlasnik: ostatak `week.mixedRemainder`, minimum `week.mixedFloorKm`, zbir `written.protectedKm`, test
`steps.protectedTest`, dani odmora `week.restDaysWeek`. (2) Plafoni nedirnuti. (3) WU/CD nedirnuti; manjak se ne
nadoknađuje. (4) Činjenice (zbir, zaključani) poznate konstruktoru unapred (`Written`); završna zaštita samo proverava.
(5) Handoff nedirnut (K3 važi i za 10K kao cilj). (6) `10k-v2.8.0`, A21; KNOWN_VERSIONS + 6.2, 7.0. (7) Izolacija
prolazi. (8) Mreže: 0 odbijanja, prazan trening 0, dugi ≥ lagan među preostalim danima, zaštićeni dani bajt-isti.
