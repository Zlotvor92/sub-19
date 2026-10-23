# 5K v2 — Segment 08i (5k-v2.10.0): pouka 37 — mešovita nedelja, ostatak do cilja (samo naniže)

Polazni SHA `e2e482e`. Grana `claude/generator-isolation-5k-10k-hm-marathon`. Menjano `fiveK/v2/**`, `docs/5k-v2/**`;
izuzeci: redovi „5K v2" u byteSame (10K 19, HM 13, maraton 13; samo oznaka verzije) i oznaka verzije u
`features/onboarding/fiveKV2Flow.test.tsx` (kao 08h). Odluka organizatora + dopuna iz HM-08 (dugi se ne skraćuje,
lagan ≤ dugi samo među preostalim danima, trkačka izuzeta). Bez PR-a, mergea i deploya.

## 1. Uzrok korak po korak (pouka 23)

| korak | strana | ispravka | test |
|---|---|---|---|
| `generate.construct` gradi nedelju `buildTrainingWeek` na cilj kao da je cela slobodna | konstruktor | `week.mixedRemainder` (jedino mesto) posle sastavljanja: preostali dani na ostatak = cilj − zaštićeni, samo naniže | `segment08i.node.test.ts` |
| `written.writtenWeek` zamenjuje sastavljene dane zaštićenima → planirano = cilj + (zaštićeno − sastavljeno za te dane) | spajanje | bez izmene (spaja već skraćenu nedelju) | — |
| `validate` preskače mešovitu nedelju (`checked`) → planirano > cilj prolazi tiho | validator | mešovita nedelja posle asOf, planirano > cilj: `MIXED_OVER_TARGET` (upozorenje) ako su preostali dani na `week.mixedFloorKm` (ista funkcija), inače `MIXED_REMAINDER` (greška) | primer + izmenjen plan |

Primer nalaza `b-d3-8w-25km-v36-1` k3 (umor, asOf pon): zaštićen lagan 6,74; e2e482e lagan 6,74 + q1 4,44 + dugi 7,1 =
18,28 > cilj 15,9 (bez upozorenja). 08i: ostatak 9,16 < minimum preostalih 10,1 (lagan 3 + dugi 7,1, dugi se ne seče) →
q1 otpada, lagan 3: **16,84 + MIXED_OVER_TARGET**. `r-d4-10w-40km-v52-1` k4: lagan 7,98 → 3,66, kvalitet ostaje,
planirano = cilj 34,6. Redosled (dopuna HM-08): dugi kakav je sastavljen; lagani do minimuma faze (lagan ≤ preostali
dugi); kvalitet otpada (prvo drugi, pa svi; dan lagan, doza se ne beleži, test otpada sa oznakom); ni to → minimum +
upozorenje. Trkačka nedelja izuzeta (pouka 30, `week.raceWeekRest`). Ciljevi nedelja se ne menjaju.

## 2. Merenje pre/posle (iz `web/`; izlazi u `artifacts/segment-08i/`)

| skripta | e2e482e | 08i |
|---|---|---|
| `mixed-deload.ts` 5K (42 toka) | plan > cilj 22 (+2,39, max 4,6), bez upozorenja | **7, svih 7 sa MIXED_OVER_TARGET** (+1,29, max 2,12) |
| ↳ „nije niže od prethodne" | 19 | 19 — prethodna je redovno rasterećenje istog cilja (npr. 11,1 = 11,1); cilj, ne pouka 37 |
| trajna mreža 08i (pun, 195 planova) | — | 9 947 tokova, mešovitih nedelja 4 179, skraćeno 3 622, iznad cilja sa upozorenjem 2 027, odbijeno 0 |
| `fatigue-monday.ts` 5K | tekuća+0 22, bez novog 13 | isto |
| `fatigue-repeat.ts 5K end` | 117, drugo rasterećenje 0, odbijeno 0 | isto |
| `locked-result.ts 5K` | 0 / 108 | 0 / 108 |
| `start-day.ts 5K 6` | 21 522 toka, 0 odbijanja, inv 0 | isto |
| `fatigue-testweek.ts 5K 3` | 7 196, 0 odbijanja, dva testa 0 | isto |
| `early.ts 5K 29 19 11` | 75 456, 0 odbijanja | isto |
| trkačka nedelja mešovita (`race-week-08i.ts`, 17 459) | plan > cilj 2 107 (samo pauza/bol), > taper 0 | izuzeta (pouka 30): isto |

## 3. Regresija (`regress-hash-08i.ts` + `regress-cmp-08i.py`, heš bez oznake verzije)

Uzorak: svaki 24. plan mreže (159) × 17 scenarija × asOf start − 3/− 1 i dan 0/3/6 svake nedelje (umor: svaki dan) +
drugi korak lanca = **99 069 tokova**. Generator (3816 planova) bajt-isti.

| klasa | promenjeno | dani promenjeni | samo napomena + upozorenje | km naniže |
|---|---|---|---|---|
| pauza 10/20/35, lanac, bol+pauza | 12 634 | 7 353 | 5 281 | 14 401 |
| drugi korak lanca | 2 539 | 1 823 | 716 | 3 883 |
| umor | 553 | 524 | 29 | 990 |
| bol 5 | 16 | 6 | 10 | 0,84 |
| ostalih 11 scenarija | 0 | — | — | — |

Svaki promenjen tok ima mešovitu nedelju sa napomenom pouke 37 (drugih 0); **ciljevi nedelja 0 promena**; nijedan
km naviše; 0 odbijanja.

Trajna rana mreža 08g (104 800 tokova) prema e2e482e: promenjeno **9 931, sve klase M** (`testInputs.hasMixedRemainder`
u `family08g`), 0 odbijanja. Fixture 08g (prema f4b257d) ponovo snimljen: promenjeno 15 930 — M 9 871, F 3 272,
P 2 184, R 399, N4 170, N3 34; **bez razloga 0** (P/N4 manje jer M ima prednost). 08e (prema 51a924f): TOTALS uska
promenjeno 1 102 → 2 022, šira 1 317 → 2 672 — razlika isto toliko u porodici family08g (+920 / +1 355, M), Odluka 9 i R isto.

## 4. Sabotaže (`node scripts/sabotage.mjs ../docs/5k-v2/artifacts/segment-08i/sabotage-08i.json`)

| # | sabotaža | ishod | prvi pali test | trajanje |
|---|---|---|---|---|
| 1 | ostatak se ne računa (stara strana) | PAO | `segment08i.grid` — trajna mreža (planirano > cilj bez upozorenja) | 3,2 s |
| 2 | ostatak i naviše (manjak se nadoknađuje) | PAO | `segment08i.node` — zaštićeni dani kao sastavljeni ili kraći → bez izmene | 2,7 s |
| 3 | validator ne čita `mixedFloorKm` | PAO | `segment08i.node` — validator: preostali dani nisu na minimumu → MIXED_REMAINDER | 2,8 s |
| 4 | trajna mreža bez mešovite nedelje | PAO | `segment08i.grid` — mreža bez skraćene mešovite nedelje | 2,5 s |

Ukupno 4/4 PALO, 11,8 s (brz nivo, `--bail=1`); stanje `src` isto pre i posle.

## 5. Komande (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check .` | exit 0 |
| `npm run check` | exit 0 — 299 / 3519, 622 s; posle mergea grane (6ca22b4) 301 / 3553, 511 s; E2E 3 / 3 |
| `TEST_FULL=1 npx vitest run --changed e2e482e` | exit 0 — 185 fajlova, 1866 testova, 934 s |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 30 fajlova, 703 testa; 08e (2) pali na TOTALS → ažurirano (M), ponovo 27 / 27 |
| `npx vitest run --project node src/domain/generators/fiveK/v2` (brz) | 23 fajla, 696 / 696, 38 s |
| `TEST_FULL=1 … segment08i.{grid,2.full,3.full}` | po delu 17–18 s, 0 odbijanja |
| `npx playwright test e2e/fivek-v2.spec.ts` | 3 / 3, 50 s |
| `BYTE_SAME_RECORD=1 … byteSame.node.test.ts` (10K, HM, maraton) | samo redovi „5K v2" (19/13/13); sa oznakom 5k-v2.9.0 svi prolaze bez snimanja → menja se samo oznaka; `personalPlan.node.test.ts` nedirnut, prolazi |
| organizatorove skripte (`scripts-e2e482e.txt` / `scripts-08i.txt`) | § 2 |

## 6. Otvorena pitanja

1. **Pauza (Odluka 3) i pouka 37.** U nedelji pauze cilj = cilj ostatka (`pauseRemainderKm`); zaštićeni dani su
   neodrađeni dani prethodnog plana i ulaze u zbir → ostatak se sabija, često na minimum (MIXED_OVER_TARGET u 10 362 od
   12 634 promenjenih tokova pauze). Doslovno po pouci 37 (svaka mešovita nedelja, samo naniže); ako cilj nedelje pauze
   treba da važi samo za preostale dane — izuzetak `pauseRemainderKm !== null` (jedan uslov), odluka organizatora.
2. **Zaključan dan + test po osećaju (staro, nije od 08i).** Umor u nedelji testa premešta test u k + 1, gde je
   zaključan kvalitet prethodnog plana → TEST_WEEK: 168 / 9 919 (plan po osećaju), isto na e2e482e
   (`lock-feel-08i.ts`). Trajna mreža zato zaključava dan samo u planu sa rezultatom (kao `locked-result.ts`).

## 7. Stalni uslovi (AGENTS.md 1–8)

1. Jedan vlasnik: obim preostalih dana — `week.mixedRemainder`; minimum — `week.mixedFloorKm` (konstruktor, validator).
2. Plafoni nedirnuti. 3. WU/CD nedirnuti; manjak se ne nadoknađuje, višak ide iz laganih dana i kvaliteta, ne iz WU/CD.
4. Zaštita poznata unapred (`Written`) ulazi u konstruktor; završna zaštita samo proverava. 5. Handoff bez izmene.
6. `5k-v2.10.0`; KNOWN_VERSIONS = 2.6.0, 2.6.1, 2.7.0, 2.8.0, 2.8.1, 2.9.0, 2.10.0. 7. Izolacija prolazi.
8. Trajna mreža 08i: 0 odbijanja, lagan ≥ minimum i ≤ preostali dugi, prazan trening 0, zaštićeni dani bajt-isti.
