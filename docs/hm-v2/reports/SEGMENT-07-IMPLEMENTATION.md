# HM v2 — Segment HM-07 (hm-v2.4.0): Faza 4a

Polazni SHA `f4b257d`; posle pull-a na grani `5af0538` (MASTER pouke 35, 36 — organizator). Menjano samo
`web/src/domain/generators/halfMarathon/v2/**` (domen i `app/`), `docs/hm-v2/**` i redovi `HM v2 #…` u
`marathon/v2/app/byteSame.9443676.json` (13 heševa; `tenK/v2/app/byteSame.068410b.json` nema redova HM v2). Odluke:
`docs/generators-v2/final-check/ODLUKE-4a.md` i poruke organizatora (taper B, neizvodljiva nedelja sa jednim
kvalitetom (i), tačka 12 / pouka 36). DECISIONS: `F4a-N5`, `N6`, `N7`, `N9`, `N10`, `N11`, `N12`.

## Tačke

| tačka       | uzrok                                                                                     | ispravka                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | test                                                 |
| ----------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| N5 pouka 35 | dva dana kvaliteta sa WU/CD po ulaznom obimu, dugi je ostatak (posle novog starta 4–6 km) | `week.secondQualityEasy` — jedino mesto: u nedelji izgradnje sa dva kvaliteta (Q1/test + Q2), kad je neki dan duži od dugog, Q2 → lagan (napomena), Q1 ostaje, dužine iz `buildLengths` (dugi raste), stanje Q2 se ne menja; nedelja sa jednim kvalitetom neizvodljiva (dugi na granici pouke 28) → dva kvaliteta + LONG_SHORTER_THAN_QUALITY; taper i trkačka izuzeti. Validator SECOND_QUALITY (ista funkcija; kandidat Q2 iz `quality.pickSlot`), ROLES; `gridInvariants` POUKA35 | `segment07` (generator i pauza 35), `gridInvariants` |
| N6          | `quality.pickSlot` prenosio T dozu u RP preko `structuresForDose` bez poda                | `quality.floorM` (RP ≥ 2 × 2000 m) — prelaz ispod poda nije izvodljiv (A9); validator RP_FLOOR                                                                                                                                                                                                                                                                                                                                                                                       | `segment07` N6                                       |
| N7          | `initialState` = `advance(ref)` → ned 2 = doza planirane ned 2                            | `steps.restartWeeks`: posle umora pre starta ned 2 počinje progresiju (doza = planirana ned 1)                                                                                                                                                                                                                                                                                                                                                                                       | `adapt.node` pouka 34 (doze ned 2 = ned 1)           |
| N10.3       | L pouke 28 bez dugog reference                                                            | `steps.jumpRecentKm` (nedelja 0) u konstruktoru i validatoru; `adaptInvariants` L                                                                                                                                                                                                                                                                                                                                                                                                    | `segment07` N10.3, `adaptInvariants`                 |
| N9          | dve definicije iste veličine                                                              | `lengths.longestLong10` (taper, LONG_RUN_SHORT), `lengths.longsOf10` (L), `steps.preStartOf` (3 mesta), `quality.advance` u validatoru; LONG_RUN_SHORT preko SVIH nedelja                                                                                                                                                                                                                                                                                                            | `segment07` N9                                       |
| N10.1       | ponovljena doza tiho                                                                      | IDENTICAL_WEEKS upozorenje kad ni druga struktura ni sledeći nivo ne staju (oba člana); inače kao pre                                                                                                                                                                                                                                                                                                                                                                                | `segment07` N10.1                                    |
| N10.2       | —                                                                                         | samo DECISIONS: RECENT_LONG_TOO_SHORT u adaptaciji se ne javlja (`construct` ga vraća samo bez koraka; 4a 114 012 + 16 275 tokova: 0)                                                                                                                                                                                                                                                                                                                                                | —                                                    |
| N10.6       | —                                                                                         | DECISIONS: piramida HM ≠ maraton svesno                                                                                                                                                                                                                                                                                                                                                                                                                                              | —                                                    |
| N10.7       | pre starta 7 scenarija                                                                    | `preStartGrid` (171 plan × start − 1/− 3/− 6 × 17 scenarija + lanac = 8721 tok), pun nivo u 2 dela                                                                                                                                                                                                                                                                                                                                                                                   | `preStartGrid*`                                      |
| N11         | WEEK_FITTED po nedelji, kapacitet dvaput                                                  | WEEK_FITTED jedan zbir, CAPACITY_LIMITED jedno upozorenje sa vrhom (napomena plana uklonjena), DELOAD_LONG_SHORTENED jedno; tehnička napomena ostaje u planu, korisniku je ne daje `volume.userWeekNotes` (app `plan.ts` focus)                                                                                                                                                                                                                                                      | `segment07` N11                                      |
| traka       | pravilo u `app/adapt.ts`                                                                  | `adapt.adaptBanner` (oblik maratona MAR-06), app samo zove; uslov „plan se menja posle danas" = promena u nedelji koja se završava posle asOf (isto što je app `weeks`)                                                                                                                                                                                                                                                                                                              | `segment07` traka, `adaptFlow` (17, nepromenjeni)    |
| 12 pouka 36 | umor vezan za asOf (n iz asOf)                                                            | `assess` A5: sidro (poslednji zapis umora) + 1; kad je ta nedelja već rasterećenje → ne pravi novo (razlog „već u planu")                                                                                                                                                                                                                                                                                                                                                            | `fatigueRepeat` (+1…+7), `newLimits`                 |
| verzija     | —                                                                                         | `hm-v2.4.0`; `KNOWN_VERSIONS` = hm-v2.3.0 ∪ tekuća (aplikacija je pisala samo hm-v2.3.0)                                                                                                                                                                                                                                                                                                                                                                                             | `policy.node`, `app.node`                            |

## Merenje pre/posle (4a skripte; pre = `docs/generators-v2/final-check/*.json`, posle = `artifacts/segment-07/*.after.json`)

| merenje                                                                                           | pre                           | posle                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| early.ts HM 193 97 29: planova / tokova / odbijanja / zajedničke / invarijante / 'none' ≠ gen     | 212 / 114 012 / 0 / 0 / 0 / 0 | 212 / 114 012 / 0 / 0 / 0 / 0 (1020 s)                     |
| targeted (a) bol 7/8 ned N − 2, N − 1                                                             | 6636, 0 odbijanja             | 6636, 0                                                    |
| targeted (b) LONG_RUN_SHORT lažno                                                                 | 5 / 2928                      | 0 / 2908                                                   |
| targeted (c) pauza 35: nedelja izgradnje sa danom kvaliteta dužim od dugog (sve)                  | 3993 ned / 1867 planova       | 2141 / 1377 (samo nedelje sa jednim kvalitetom — pouka 14) |
| targeted (c) RP ispod najnižeg nivoa (dani)                                                       | 31                            | 0                                                          |
| targeted (c) dugi < 10 km                                                                         | 14 551 ned / 3714             | 13 257 / 3507                                              |
| regress: tokovi sa nedeljom izgradnje 2 kvaliteta i danom > dugi (bez mešovitih) — ciljana / rana | 1467 / 2546                   | 0 / 0                                                      |
| regress: RP < 4000 m — ciljana / rana / mreža pouke 28                                            | 114 / 219 / 13                | 0 / 0 / 0                                                  |
| generator 25 122 / mreža pouke 28 10 944: nedelja 2 kvaliteta + dan > dugi                        | 165 / 774                     | 0 / 597 (izuzetak izvodljivosti)                           |
| fatigue-repeat.ts HM end (sredom) — drugo rasterećenje                                            | 708 / 777 (0)                 | 0 / 777 (0)                                                |
| WEEK_FITTED poruka po planu R / F / B                                                             | 6,4 / 6,9 / 2,8               | 1 / 1 / 1                                                  |
| DELOAD_LONG_SHORTENED po planu B                                                                  | 1,4                           | 1                                                          |
| „Na šta da paziš" medijana / p90 / max R                                                          | 0 / 4 / 18                    | 0 / 2 / 3                                                  |
| isto F / B                                                                                        | 2 / 12 / 21 · 3 / 5 / 13      | 2 / 4 / 7 · 3 / 5 / 6                                      |
| targeted (d) „Cilj po pravilu … nije izvodljiv" u planu (ostaje tehnička, van korisničkih)        | 89 / 594                      | 89 / 594                                                   |

DOSE_DROPPED R 0,9 → 1,3 % planova: 66 novih, svi u klasi a (npr. d6-10w-40km-v60-A-sat ned 2: Q2 prvi put, dugi
10,3 km — T 2,5 km bi bio duži od dugog → 2,0 km, pouka 32).

## Regresija po klasi (`artifacts/segment-07/regress.ts`, `compare.ts`, `regress-summary.json`; heš bez oznake verzije)

Klasa sadržaja: a pouka 35 (plan pre ima nedelju izgradnje sa 2 kvaliteta i danom > dugi, ili posle napomenu pouke 35),
b RP < 4000 m, c umor pre starta (svih 630 rane: scenario fatigue pre starta), g tok iz plana generatora klase a; d =
samo napomene/upozorenja. Klasa „ponovljen umor" (pouka 36): 0 tokova u ovim skupovima (zapisi umora su asOf − 1/− 3,
nedelja sidra = n); meri je fatigue-repeat.ts i `fatigueRepeat` mreža.

| skup            | ukupno                                   | a    | b   | c   | g   | d (tekst / pravila) | drugo | nova odbijanja |
| --------------- | ---------------------------------------- | ---- | --- | --- | --- | ------------------- | ----- | -------------- |
| generator R/F/B | 25 122                                   | 165  | 0   | —   | —   | 4176 / 0            | 0     | 0              |
| mreža pouke 28  | 10 905 (+39 RECENT_LONG_TOO_SHORT, isto) | 381  | 13  | —   | —   | 3381 / 0            | 0     | 0              |
| ciljana 4a      | 16 275                                   | 1494 | 110 | 0   | 99  | 4418 / 49           | 0     | 0              |
| rana 4a         | 114 012                                  | 2824 | 219 | 630 | 0   | 27 350 / 514        | 5     | 0              |

- Rana „drugo" 5 (d3-12w-25km-v30-B-sat/w7wed/pause20, f-d3-15w-25km-e315-C/w10wed/{pause10, pause20, chain, chain/2}):
  klasa b u konstruisanom (neupisanom) delu mešovite nedelje — kopija koda bez poda RP daje rezultat bajt-isti kao
  f4b257d (proveren svaki od 4 toka).
- Pravila d: −LONG_RUN_SHORT 29 (ciljana 5, rana 24), +IDENTICAL_WEEKS 534 (44 / 490); generator i mreža 28: 0 promena
  skupa pravila (samo tekst WEEK_FITTED/CAPACITY/DELOAD).
- Fixture izuzetaka testova: `segment07.changed-f4b257d.json` (8116 planova: R a 132 / d 2286, F a 33 / d 1410, B d
  480, mreža 28 a 381 / b 13 / d 3381; `changed07.ts` baca grešku na promenu van klase) — `mayChange` u grid/grid03/recent.

## Sabotaže (`web/scripts/sabotage.mjs`, `--bail=1`, brz nivo) — 7/7 palo, 40,0 s, `src` vraćen (heš isti)

Ulaz `artifacts/segment-07/sabotage-07.json`, rezultat `sabotage-07.result.json`: (a) pouka 35 samo u generatoru
(validator ne čita) 1,8 s; (b) RP bez poda 2,0 s; (c) ned 2 sa dozom planirane ned 2 3,9 s; (d) LONG_RUN_SHORT preko
proverenih nedelja 2,0 s; (e) traka u aplikaciji 10,5 s (adaptFlow); (f) WEEK_FITTED po nedelji 2,3 s; (g) umor vezan
za asOf 16,9 s (fatigueRepeat).

## Komande i rezultati (iz `web/`)

- `npx tsc -b --noEmit` 0; `npx eslint src/domain/generators/halfMarathon/v2` 0; `prettier --check` (v2, segment-07) 0.
- `npm run check`: exit 0 — 283 fajla / 3398 testova (299 s)
- `TEST_FULL=1 npx vitest run --changed f4b257d`: exit 0 — 198 fajlova / 1541 test (976 s; uključuje i izmene drugih sesija posle pull-a)
- Pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/halfMarathon/v2`: exit 0 — 49 fajlova / 345 testova (636 s)
- Brz nivo `halfMarathon/v2` sam na mašini: 28 fajlova / 269 testova, 53,6 s zid (≤ 60 s)
- `npx playwright test e2e/hm-v2.spec.ts`: 3/3 (1,0 min)
- `marathon/v2/app/byteSame` posle zapisa: 2/2; izmenjeno 13 redova `HM v2 #0/#1` (generisanje, plan, generator, policy,
  cilj, prilagođavanje, adaptacija), nijedan drugi heš. `personalPlan.node.test.ts` nije menjan (prolazi u check).

## Stalni uslovi (AGENTS.md)

1. Jedan vlasnik: broj dana kvaliteta (`secondQualityEasy`), pod RP (`floorM`), početak progresije (`restartWeeks`),
   L (`longsOf10` + `jumpRecentKm`), najduži dugi, traka (`adaptBanner`), sidro umora (assess) — po jedno mesto;
   validator čita iste funkcije; bez petlji. 2. Jedan plafon po zoni (pod RP je deo lestvice, ne drugi plafon).
2. WU/CD nedirnuti; oslobođen obim ide u dugi/lagane (buildLengths). 4. Uslovi unapred u konstruktoru (koraci);
   umor: isti zapisi isti plan. 5. Handoff nedirnut. 6. `hm-v2`/`hm-v2.4.0`, faza iz okvira. 7. Bez uvoza van foldera
   (isolation prolazi; app uvozi samo `../`). 8. Upotrebljivost: grid invarijante (POUKA35, LONG_GE_EASY, WEEK_MIN),
   rana/pre starta/ponovljen umor mreže — 0 odbijanja, 0 prekršaja.

## Preostalo

- 597/10 944 planova mreže pouke 28 (kratak skorašnji dugi) zadržava dva kvaliteta uz pouku 14 (odluka i).
- Taper: 1371/25 122 sa RP danom dužim od dugog (odluka B, HI15).
- Umor prvi put prijavljen kasnije od nedelje sidra: rasterećenje je prva puna nedelja posle asOf (prošlost se ne menja).
