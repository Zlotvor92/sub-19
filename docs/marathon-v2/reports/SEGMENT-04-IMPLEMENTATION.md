# Maraton v2 — Segment 04 (MAR-04): adaptacija M18 (marathon-v2.3.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `5547285` (marathon-v2.2.0). Menjano samo
`web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**`; `marathon/index.ts`, maraton v1, lični plan i
aplikacija nepromenjeni. Bez STANI. Obrazac 10K v2 `10k-v2.5.1` (06b/06c/06d ugrađeni od početka), kopija, ne uvoz.
Korak A otpao (MAR-03: 58 planova, upozorenje — odluka organizatora).

## Odluke (pravilo | mesto | test)

| odluka       | pravilo (sažeto)                                                                                                                                                                                           | mesto                                                                 | test                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------- |
| M18/A1       | rezultat 5/10/21,1/42,2 km ≤ 84 d → VDOT od sledeće nedelje; MP po korekciji M2 (`pacesFromVdot`); po osećaju → result od te nedelje (pouke 16–17)                                                         | assess, steps `pacesAt/basisAt`, validate PACES/RPE                   | adapt.node A1 (2)             |
| A2/A6        | manjak < 60 % → cilj ≤ prethodna izgradnja (reduced true); višak > 115 % ×2 → bez rasta (reduced false)                                                                                                    | assess                                                                | adapt.node A6, mreža 04       |
| A3           | pauza 7/14/28 d → 80/70/50 %; ≥ 28 nov start (rePeriodize M4/M5); orijentir < 12 ned (M18)                                                                                                                 | assess, periodize `rePeriodize`, steps                                | adapt.node A3                 |
| A4           | bol ≥ 4: 7 d bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani × 0,7 (≥ 5 km); ≥ 7: 3 d odmora; sidro r = nedelja asOf + 1; osnova min(0,7 × nivo, cilj r) — `returnBase10` (konstruktor, validator, poruka) | assess, lengths `painLong10/limitedEasy10`, week `limitDays`, volume  | pouka 18 (6 testova × 6 dana) |
| A5           | umor → prinudno rasterećenje; u uvodu početnika sadržaj uvoda (pouka 31)                                                                                                                                   | assess, steps, week                                                   | pouka 31, pouka 22            |
| A7/A10       | bol > pauza > umor > izvršenje; dan bez zapisa poznat samo u coverage complete                                                                                                                             | assess                                                                | pouka 7 (c, e)                |
| A8           | povratni rast +10 % (min 1 km) do nivoa; taper posle smanjenja 0,8 / 0,6 × najveći cilj izgradnje posle smanjenja (M18), ≤ cilj koraka                                                                     | volume `adaptNominal10/enterWeek/leaveWeek` (konstruktor = validator) | pouka 7 (a)                   |
| A9           | donja granica = minimum broja dana (M15); prolazi pravilo → popuštanje → 1 kvalitet doze rasterećenja (taper: samo MP) → bez kvaliteta; oštrenje otpada kad trkačka > N−1                                  | volume, generate, week                                                | pouka 7 (b), mreže            |
| A11/pouka 29 | prošlost = upisani dani: najduži dugi (M7), dugi prethodnih nedelja (M13a), poslednji dugi, stanje doze (MP, T), N−1 za trkačku iz `written.ts`; validator u construct vidi spojeni plan                   | written, generate, adapt                                              | pouka 29 (3)                  |
| A13          | test premešten iz blokirane nedelje; posle rezultata nema testa                                                                                                                                            | steps `framesFor`                                                     | mreža 04 (TEST_MOVED 456)     |
| A17/pouka 22 | redovno rasterećenje odmah posle nedelje smanjenja (reduced / sidro r) otpada; prinudno nikad; niz ≤ 5                                                                                                     | steps `framesFor` (izlaz `dropped`), validate M5                      | pouka 22 (5)                  |
| pouka 30     | trkačka ≤ N−1 i uz dane odmora/bola: višak laganih → odmor (prvo bol, pa najraniji); dan pred trku i trka ostaju                                                                                           | week `raceWeekRest` (validator čita isti)                             | pouka 30                      |
| pouka 25     | planirano < cilj zbog dana bola/odmora → PLANNED_BELOW_TARGET_LIMITS / WEEK_MIN_LIMITS (upozorenje)                                                                                                        | validate                                                              | mreža 04                      |
| pouka 19/20  | promena cilja uz zaključane buduće dane: treninzi bajt-isti; `adaptBanner` — traka samo za novo ograničenje                                                                                                | adapt.ts                                                              | pouka 19, 20                  |

DECISIONS: M18, A1–A15, A17 (A16 ugrađen u A4). Plafon MP sa trajanjem i izuzetak najnižeg nivoa (`mpFitsLong`), M13a
(`longJumpCap10` nad upisanim dugim, `longsOf`) i pouka 33 (`deloadLengths`) — iste funkcije i u adaptaciji.

## Odstupanja i tumačenja (svako sa ulazom)

| šta                             | ulaz                                                                                                                             | odluka (opreznije, bez novog broja)                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| MP ispod najnižeg nivoa         | d3-r-12w, lanac (pauza 10 kraj ned 2 + manjak): ned 6 MP 2,4 km kont. (prelaz sa T 2,4 km, M12), ned 6 = ned 7 → IDENTICAL_WEEKS | `pickSlot`: MP ≥ 2 × 3000 m (najmanja smislena MP doza, M7a/MAR-03); inače A9 (1 kvalitet / bez). Generator bajt-isti (bazne linije 02/03). |
| dugi rasterećenja/tapera < 5 km | d5-r-12w, pauza 35 sreda ned 1: ned 5 0,8 × 6,0 = 4,8 km < lagan 5 km → WEEK_INFEASIBLE; d4-r-12w: N−1 0,45 × 10,6 = 4,7 km      | A9 (kao 10K): posle smanjenja (i prinudnog rasterećenja) dugi ≥ 5 km, napomena; 19 / 6236 tokova mreže 04                                   |
| lagan dana bola u trkačkoj      | 30 min E < 5 km (M8)                                                                                                             | × 0,7, ≥ 5 km, nikad duži od planiranog (ne produžava se)                                                                                   |
| ned 1 ispod obima u adaptaciji  | beg-d4-16w-25km, pauza 10 sreda ned 1: ostatak ned 1 = 20 km → VOLUME_START                                                      | VOLUME_START samo za ned 1 van koraka (cilj koraka proverava VOLUME_RULE)                                                                   |
| N−1 mešovita                    | beg-d4-16w-25km, bol 8 sreda N−1                                                                                                 | validator pouku 30 računa nad upisanom N−1 (isto kao konstruktor)                                                                           |

## Merenje pre/posle

- Generator: bez koraka bajt-isti marathon-v2.2.0 — mreže 02 (21 840), M13a (35 910), gusta ned 1, po osećaju (8190),
  početnik (1890) prolaze na baznim linijama MAR-03 (pun nivo, heš bez oznake verzije); `construct(input, [])` =
  generator (adapt.node).
- Brz nivo maratona: pre 17 fajlova / 192 testa, 39,4 s zida; posle — v. Komande.
- Mreža 04 (`artifacts/segment-04/metrics.json`): 6236 tokova; K1 0; invarijante 0. Primenjeno: PAIN 2820, PAUSE 976,
  NEW_RESULT 732, UNDER 278, FATIGUE 124, OVER 64; A17 ukinuto 636; A9 manje kvaliteta 451; orijentir 64; pouka 30 6
  (bol 8 u N−1, find); upozorenja PLANNED_BELOW_TARGET_LIMITS 3357, WEEK_MIN_LIMITS 436.

## Široka pretraga i trajna mreža (pouka 23)

- Široka pretraga (`artifacts/segment-04/wide.ts`, `node --experimental-strip-types … wide.ts 50 k/4`, 4 procesa,
  ~21 min): svaki 50. plan mreže 02, po osećaju, početnika i M13a + svaki 500. guste ned 1 = 1672 ulaza (26 odbija
  generator: RECENT_LONG_TOO_SHORT, M13a — očekivano) → 1646 planova × asOf sreda i kraj svake nedelje 1…N−2 × 7
  scenarija = **337 624 toka: 0 odbijanja, 0 prekršaja adaptInvariants** (`wide-50.json`).

- Trajna mreža rane adaptacije (`earlyGrid*`): 270 planova (svaki 182. mreže 02, 78. po osećaju, 42. početnika) ×
  {sreda i kraj ned 1, sreda svake ned 2…N−1, kraj nedelje pre testa / rasterećenja / N−2 / N−1} × 7 scenarija =
  45 101 tok: 0 odbijanja, 0 prekršaja (pun nivo, 4 dela); brz nivo 763 toka (svaki 60. po porodici × scenariju).
- Klase nađene i rešene tokom rada (pre ispravke): IDENTICAL_WEEKS (MP < 2 × 3000), WEEK_INFEASIBLE (dugi < 5 km u
  rasterećenju/N−1 posle pauze 35 i umora uz r = 5 km), WEEK_MIN_VOLUME (početnik, bol 8, 19,93 < 20 km → pouka 25),
  VOLUME_START (ostatak ned 1), RACE_WEEK (N−1 mešovita). Sve objašnjene; nijedna nerazumljiva.

## Sabotaže (`node scripts/sabotage.mjs ../docs/marathon-v2/artifacts/segment-04/sabotage.json --parallel 2`)

14 / 14 PALO, 56,3 s zida (`--parallel 2`, brz nivo, `--bail=1`), stanje `src` isto (heš `3db43e942d8cdb26`);
`sabotage-result.json`. Prvi pali test je u `adapt.node.test.ts` za svaku:

| #   | sabotaža                                | prvi pali (adapt.node)               | s    |
| --- | --------------------------------------- | ------------------------------------ | ---- |
| S1  | A17 ukida i prinudno                    | pouka 22: prinudno se nikad ne ukida | 3,4  |
| S2  | reduced se ne čita                      | pouka 22: višak nije smanjenje       | 3,2  |
| S3  | sidro bola = n umesto r                 | pouka 18                             | 1,9  |
| S4  | validacija u construct nad sastavljenim | pouka 29: upisan dugi                | 4,9  |
| S5  | trkačka bez pouke 30                    | pouka 30                             | 5,1  |
| S6  | uvod početnika sa kvalitetom pri umoru  | pouka 31                             | 4,5  |
| S7  | dani bola nisu bez kvaliteta            | A14 lanac (LIMITS)                   | 2,2  |
| S8  | konstruktor: stari najduži dugi         | pouka 29: taper                      | 4,6  |
| S9  | M13a iz sastavljenih dugih              | pouka 29: upisan dugi                | 13,5 |
| S10 | povratni rast bez granice nivoa         | pouka 7 (a)                          | 2,5  |
| S11 | stanje doze iz sastavljenih dana        | pouka 29: doza                       | 21,8 |
| S12 | donja granica A9 isključena             | pouka 23: dugi 5 km                  | 11,4 |
| S13 | MP ispod najnižeg nivoa                 | pouka 23: MP ≥ 2 × 3000              | 4,3  |
| S14 | nepotpun zapis = pauza                  | pouka 7 (c)                          | 9,4  |

Prvi prolaz: S8 i S11 NISU PALE → dodati testovi pouke 29 (upisan najduži dugi i upisana doza), zatim 2 / 2 PALO.

## Kontrolne metrike (mreža 04)

| K                                             | vrednost                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1 odbijanja / greške validatora              | 0 / 6236 (i 0 / 45 101 rana, 0 u širokoj)                                                                                                                              |
| K2 ned 1 < obim                               | bez promene generatora (ned 1 adaptacije = cilj koraka, A3)                                                                                                            |
| K3 izgradnja bez kvaliteta                    | samo uz ograničenje koraka ili A9 (451 tok sa napomenom A9)                                                                                                            |
| K4 vrh niži od MAR-03                         | 0 (generator bajt-isti)                                                                                                                                                |
| K5 trkačka > N−1, dugi < lagan, susedni teški | 0 / 0 / 0 (adaptInvariants)                                                                                                                                            |
| K6 kvalitetni dan > dugi                      | MP (osim 2 × 3000) 0; MP 2 × 3000 u 43 toka (izuzetak MAR-03); T/I/R u 116 tokova (pauza 35 79, bol 8 23, lanac 12) — upozorenje (maraton: drugi član samo MP, MAR-03) |

## Komande i rezultati (iz `web/`)

- `npx tsc -p tsconfig.domain.json --noEmit`, `-p tsconfig.oracle.json`, `npx eslint src/domain/generators/marathon/v2`,
  `npx prettier --check src/domain/generators/marathon/v2 ../docs/marathon-v2` — exit 0.
- Brz: `npx vitest run --project node src/domain/generators/marathon/v2` → 20 fajlova, 233 testa, zid 50,3 s (pre:
  17 / 192, 39,4 s); najsporiji novi: earlyGrid 15 s, adaptGrid 9 s.
- Pun: `TEST_FULL=1 …` → 40 fajlova, 302 testa, exit 0, zid 10 min 43 s (pre poslednja 4 testa pouke 29/22/A6).
- `npm run check` → exit 0: typecheck, lint, format, 260 fajlova, 3155 testova (zid 9 min 5 s).

## Stalni uslovi (AGENTS.md)

| #   | stanje                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | jedan vlasnik: koraci `assess.ts`; okviri/A17 `steps.framesFor`; obim `volume.adaptNominal10`; prošlost `written.ts`; trkačka `raceWeekRest`; validator samo prijavljuje; bez petlji |
| 2   | plafoni nedirnuti; MP: ista `mpFitsLong` + donja granica nivoa u istoj funkciji (`pickSlot`)                                                                                         |
| 3   | WU/CD nedirnuti; manjak obima u bolu = planirano < cilj (upozorenje), trkačka: odmor                                                                                                 |
| 4   | uslovi poznati unapred (koraci, `prior`) ulaze u konstruktor; završna zaštita samo proverava (ADAPT_PROTECTION)                                                                      |
| 5   | handoff n/p (faza 3)                                                                                                                                                                 |
| 6   | `marathon-v2` / `marathon-v2.3.0`, faza svake nedelje iz `framesFor` (validator PHASES/FRAMES)                                                                                       |
| 7   | `isolation.node` zelen, bez novih izuzetaka                                                                                                                                          |
| 8   | adaptInvariants: prazan trening, dugi ≥ lagan, cilj ≥ minimum, bez kvaliteta u bolu — 0 prekršaja na svim mrežama                                                                    |

## Tabela adaptiranog plana (d4-r-16w, 45 km, VDOT 45, asOf kraj ned 6; `artifacts/segment-04/examples.md`)

| ned     | pre: cilj   | bol 5: cilj / plan | bol 5: kvalitet | pauza 20: cilj | pauza 20: kvalitet |
| ------- | ----------- | ------------------ | --------------- | -------------- | ------------------ |
| 7       | 60,2        | 60,2 / 34,9        | — (bol)         | 28,4           | — (A3)             |
| 8       | 48,2 R      | 41,3 (A17)         | I + T           | 31,2 (A17)     | T 2 × 1200         |
| 9       | 63,8        | 45,4               | MP 2 × 3000 / T | 34,3           | MP 2 × 3000 / T    |
| 11      | 67,5        | 53,6               | MP 2 × 5000 / T | 41,5           | MP 2 × 4000 / T    |
| 13      | 67,5        | 56,8               | MP 10 km / T    | 45,7           | MP 8 km / T        |
| 14 / 15 | 49,7 / 40,5 | 45,4 / 34,1        | MP 2 × 3000     | 36,6 / 27,4    | MP 2 × 3000        |

Bol: osnova 37,5 km (70 % nivoa 53,6), rast +10 %; pauza: 28,4 km (70 % od 40,5), nivo 50,6.

## Preostali problemi

- K6: T/I/R dan duži od dugog u adaptiranim nedeljama malog obima (pauza 35 → nov start, lanac, bol 8) — 116 / 6236
  tokova mreže 04; po MAR-03 samo upozorenje za ne-MP zone. Pitanje organizatoru: da li u adaptaciji proširiti drugi
  član na sve zone (kao HM-04) ili ostaviti upozorenje.
- Prinudno rasterećenje kad je asOf pre starta (n = 1, nema prethodnog dugog) nije u mrežama (asOf ≥ sreda ned 1).
- Heuristike A1–A17 (10K) bez merenja na podacima maratonaca.
