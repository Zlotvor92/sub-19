# Maraton v2 — Segment MAR-07 (marathon-v2.4.0): Faza 4a

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `7ba9717` (+ `5af0538` MASTER pouka 35 dopuna).
Menjano samo `web/src/domain/generators/marathon/v2/**` (domen i `app/plan.ts`) i `docs/marathon-v2/**`. Bez STANI.
Odluke organizatora (ODLUKE-4a.md, dopuna pouke 35 iz HM-07) primenjene doslovno; jedno tumačenje (pouka 36) ispod.

## Odluke | mesto | test

| odluka                                                                                                                                                                                                                                                       | mesto                                                                                                              | test                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| N1: trkačka nedelja samo sa trkom (dani pre trke odmor, A4) → RACE_WEEK_SHORT, ne EMPTY_WEEK                                                                                                                                                                 | week.ts `raceOnlyWeek` (jedno mesto); validate.ts                                                                  | segment07 N1 (2), trajna rana: bol 7/8 svaki dan N−2, N−1        |
| Pouka 35: izgradnja sa 2 kvaliteta, dan kvaliteta duži od dugog → Q2 lagan (napomena), Q1 ostaje, dugi raste (buildLengths); 1 kvalitet neizvodljiv → 2 + upozorenje pouke 14 (dopuna HM-07); taper/trkačka izuzeti                                          | week.ts `secondQualityEasy` (jedno mesto), buildWeek; validate.ts QUALITY_DAYS, ROLES, MAIN_DOSE                   | segment07 pouka 35 (4); grid invarijanta                         |
| Pouka 36: rasterećenje umora = prva puna nedelja posle poslednjeg RPE zapisa umora; isti zapisi → ista nedelja → bez novog                                                                                                                                   | assess.ts `fatigueWeek`; korak `deloadWeek` (samo kad ≠ fromWeek); steps.ts `deloadWeekOf`; volume.ts; validate.ts | segment07 pouka 36 (2); trajna rana: umor ponovo +1…+7           |
| N8: validator čita stanje upisane mešovite nedelje (`{ state }`), bez 'unknown'/slotKnown                                                                                                                                                                    | validate.ts (lanac, rasterećenje/taper)                                                                            | segment07 N8                                                     |
| N9: nominal10, weekMin10, taperLongFactor10 + adaptedLongCap10, deloadMinM, quality.reduced, warmupCooldown — validator samo poziva                                                                                                                          | volume.ts, lengths.ts, quality.ts, workouts.ts, validate.ts                                                        | segment07 N9 (statički)                                          |
| N10.4: neizvodljivo rasterećenje van test/početnik/adaptacija ne postoji (merenje) → DECISIONS                                                                                                                                                               | `artifacts/segment-07/deload-feasible.ts`                                                                          | —                                                                |
| N10.5: LONG_SHORTER_THAN_QUALITY + preporuka manje dana                                                                                                                                                                                                      | volume.ts `fewerDaysAdvice`                                                                                        | segment07 pauza 35                                               |
| N10.6: piramida — DECISIONS (svesno); N10.7: rana mreža pre starta × 17 scenarija (+ N1 bol, pouka 36 umor): 67 794 toka u punom nivou (bilo 49 151), 0 odbijanja                                                                                            | policy.ts; earlyGrid.harness                                                                                       | earlyGrid (4 dela)                                               |
| N11: MARATHON_LONG_SHORT samo bez plafona 150 min (inače rečenica u planu, LONG_SHORT_NOTE); „Cilj po pravilu … nije izvodljiv" tehnička (`technicalNote`, app je ne prikazuje); CAPACITY_LIMITED = tekst napomene (1 red); DELOAD_LONG_SHORTENED 1 po planu | lengths.ts `longShortOf`, `longTimeCapNote`; volume.ts; generate.ts; validate.ts; app/plan.ts                      | segment07 N11 (3); validate/week/beginner (izmenjena očekivanja) |
| Verzija marathon-v2.4.0; KNOWN_VERSIONS = 2.3.1 ∪ tekuća (već)                                                                                                                                                                                               | policy.ts; app/plan.ts                                                                                             | policy.node, app                                                 |

DECISIONS: N1, N5, P36, N8, N9, N10.4–N10.7, N11 (pravilo, mesto, obrazloženje sa merenjem); A5 dopunjen (pouka 36).
`segment07.node.test.ts` (14 testova): 12 pada na 7ba9717 (proveren u worktree-u), 2 su kontrola (EMPTY_WEEK van
izuzetka, taper bez pouke 35).

**Tumačenje (pouka 36):** „sidro = nedelja koja sadrži (zapis + 1)"; rasterećenje je prva PUNA nedelja od sidra (kad
zapis + 1 nije ponedeljak — sledeća), tj. isto pravilo kao n iz asOf, sa zapisom umesto asOf. Doslovno (nedelja koja
sadrži zapis + 1) bi zapis u subotu proglasio rasterećenjem nedelju koja je već prošla. Posledica: asOf ponedeljak sa
zapisom iz nedelje → rasterećenje počinje tekuće nedelje (ponedeljak zaštićen); test `adapt.node` „prinudno se nikad
ne ukida" je zato prebačen na asOf utorak (ista namera).

## Merenje pre (7ba9717, worktree) → posle

| merenje                                                                             | pre                   | posle                                                  |
| ----------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------ |
| N1 organizatora (svaki 7. gridInputs, 3 d, bol 7/8 kraj N−1; `segment-07/n1.ts`)    | 148/892 odbijeno      | 0 (148 trkačkih samo sa trkom)                         |
| final-check targeted.ts MAR (a) bol 7/8 svaki dan N−2/N−1                           | 40/7560               | 0/7560                                                 |
| targeted (c) pauza 35: dugi kraći od kvaliteta (sve nedelje izgradnje)              | 4675 (2171 planova)   | 2517 (1652) — samo nedelje sa 1 kvalitetom             |
| pauza 35, nedelje izgradnje sa 2 kvaliteta i danom > dugi (`segment-07/pause35.ts`) | 3166 (1552 planova)   | **0**; 2488 nedelja Q2 lagan                           |
| targeted (c) dugi < 10 km u izgradnji                                               | 12 981 (4179 planova) | 11 360 (3851)                                          |
| fatigue-repeat.ts MAR end / sredom                                                  | 943/990 / 0/990       | **0/990** / 0/990                                      |
| final-check early.ts MAR 193 97 29 (253 plana, 164 394 toka)                        | 0 odbijanja           | 0 odbijanja, 0 common/inv, 'none' = generator (1572 s) |
| final-check warnings.ts MAR 1 (MARATHON_LONG_SHORT R/F/B/M13a %)                    | 59,0/72,7/95,7/76,4   | 12,0/9,0/44,3/19,6 (redovi kao tabela ispod)           |
| targeted (d) planova sa tehničkom napomenom                                         | 332/736 (prikazana)   | 332/736 (ne prikazuje se)                              |

Pouka 35 na M13a mreži (dopuna HM-07: 1 kvalitet neizvodljiv → 2 kvaliteta + LONG_SHORTER_THAN_QUALITY), nedelje
pre → posle: 4 d 630 → 558, 5 d 1812 → 1347, 6 d 3165 → 1785 (3 d: 0); preostale po r (4/5/6 d): r5 204/372/444,
r6 138/372/432, r7 108/288/378, r8 72/180/279, r9 36/99/171, r10 —/36/81; r ≥ 11: 0. Odbijanja 930 → 930
(RECENT_LONG_TOO_SHORT, isto).

Upozorenja (cele mreže, `segment-07/measure.ts` + `compare.ts`):

| mreža             | MARATHON_LONG_SHORT % planova | „Na šta da paziš" med/p90/max |
| ----------------- | ----------------------------- | ----------------------------- |
| 02 (21 840)       | 59,0 → 12,0                   | 1/3/4 → 1/2/3                 |
| po osećaju (8190) | 72,7 → 9,0                    | 3/5/7 → 3/4/6                 |
| početnik (1890)   | 95,7 → 44,3                   | 4/5/7 → 4/5/6                 |
| M13a (35 910)     | 76,4 → 19,6                   | 1/3/4 → 1/2/4                 |

## Regresija (heš bez oznake verzije; `compare.ts`: menja se samo (a) odbijen pre, (b) pouka 35, (c) umor, (e) samo tekst)

| mreža (tokova/planova) | odbijeno pre → posle | promenjeno | (a) | (b) pouka 35 | (e) samo tekst | neobjašnjeno |
| ---------------------- | -------------------- | ---------- | --- | ------------ | -------------- | ------------ |
| 02 (21 840)            | 0 → 0                | 10 380     | 0   | 0            | 10 380         | 0            |
| M13a (35 910)          | 930 → 930            | 21 075     | 0   | 900          | 20 175         | 0            |
| gusta ned 1 (156 954)  | 0 → 0                | 54 407     | 0   | 0            | 54 407         | 0            |
| po osećaju (8190)      | 0 → 0                | 5340       | 0   | 0            | 5340           | 0            |
| početnik (1890)        | 0 → 0                | 1431       | 0   | 0            | 1431           | 0            |
| 04 (6236)              | 0 → 0                | 4235       | 0   | 51           | 4184           | 0            |
| trajna rana (45 101)   | 0 → 0                | 25 173     | 0   | 816          | 24 357         | 0            |
| rana pre starta (4050) | 0 → 0                | 2371       | 0   | 160          | 2211           | 0            |
| široka (267 927)       | 0 → 0                | 162 970    | 0   | 9555         | 153 415        | 0            |

- (e) = isti sadržaj plana (`hw`: treninzi, ciljevi, faze, koraci), drugačiji samo tekst: MARATHON_LONG_SHORT → napomena
  (02 10 278, široka 131 557), CAPACITY_LIMITED/LONG_SHORTER_THAN_QUALITY tekst, DELOAD_LONG_SHORTENED jednom; (d) N8:
  DOSE_DROPPED više u 158 (rana) / 443 (široka) tokova — validator sada vidi stanje posle mešovite nedelje (samo
  upozorenje). (c) umor: 0 promena u pojedinačnim tokovima (asOf sredom/krajem nedelje: zapis + 1 daje istu nedelju).
- (a) N1 tokovi nisu u ovim mrežama (asOf poslednji dan N − 1): mereno posebno (gore, 148 i 40 → 0).
- Planova sa nedeljom izgradnje sa 2 kvaliteta i danom > dugi: 04 216 → 165, rana 869 → 87, široka 13 921 → 7636 —
  preostalo su zaštićene prošle nedelje adaptacije i M13a slučaj „1 kvalitet neizvodljiv" (QUALITY_DAYS bi ih oborio).
- `artifacts/segment-07/`: measure.ts, compare.ts, compare-result.json, pause35.ts, n1.ts, deload-feasible.ts.

N10.4 (`deload-feasible.ts`): rasterećenja spuštena ispod cilja po pravilu van testa/početnika/adaptacije — 02 3768,
po osećaju 2235, M13a 8382, gusta 10 702 — sva zbog „lagan > dugi" (pouka 2); zbog minimuma laganog (pouka 33): 0.

## Sabotaže (`web/scripts/sabotage.mjs`, brz nivo, `--bail=1`) — 6/6 palo, 41,0 s, `src` vraćen

`artifacts/segment-07/sabotage-07.json` → `.result.json`: (a) bez raceOnly; (b) pouka 35 samo u generatoru (adaptirane
nedelje bez nje); (c) umor vezan za asOf (28,4 s); (d) validator 'unknown' posle mešovite; (e) MARATHON_LONG_SHORT i na
150 min; (f) dve definicije minimuma nedelje (validator u km).

## Brz nivo ≤ 60 s

- Brz nivo `npx vitest run --project node src/domain/generators/marathon/v2` (4 jezgra, ništa drugo ne radi): 7ba9717
  40,3 s (26 fajlova / 317); posle izmena sa uzorkom rane mreže k = 60: 46,1 / 46,4 s; uzorak rane mreže u BRZOM nivou
  k = 120 (nove vrste tokova N1, 17 scenarija pre starta, umor +1…+7 ostaju u svakoj kategoriji): **43,4 / 42,9 s**
  (27 / 331). Najduži fajl `grid.node` 33,8 s sam. Pun nivo zadržava sve tokove (4 dela rane mreže).

## Komande i rezultati (iz `web/`)

- `npx tsc -b --noEmit` 0; `eslint src/domain/generators/marathon/v2/` 0; `prettier --check` (promenjeni) 0.
- `npm run check`: exit 0 — 281 fajl / 3398 testova, 5 min 24 s.
- Pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2`: 47 fajlova / 401 test, prošlo,
  16 min 31 s (uporedo sa mernim skriptama; MAR-06: 46 / 387, 13 min 56 s).
- `TEST_FULL=1 npx vitest run --changed 7ba9717`: 185 fajlova / 1518 testova, exit 0 (19 min 22 s).
- Brz nivo maratona v2: 27 / 331, 43 s (gore). `segment07.node` 14; `validate.node` 56; `app/` 4 / 49; byteSame
  maraton/HM/10K i `personalPlan.node` 4 / 9 — prolaze bez izmene fixture-a.
- E2E `npx playwright test e2e/marathon-v2.spec.ts`: 3/3 (44 s).
- Merenje: `segment-07/measure.ts` × {grid, recent, dense, feel, beg, a04, early, pre, wide 1–4/4} × {7ba9717 worktree,
  posle} → `compare.ts`; `final-check/targeted.ts MAR`, `fatigue-repeat.ts MAR [end]` (pre u worktree-u).

## byteSame

Maraton v2 nema redova u byteSame fixture-ima (`marathon/v2/app/byteSame.9443676.json` 223, HM `28da6af` 150, 10K
`068410b` 140 heševa — svi za prekidač maratona isključen); fixture-i nepromenjeni, testovi prolaze; `personalPlan`
nepromenjen, prolazi. Bazne linije 02/03 nisu osvežene: `grid.harness` poredi `before07(plan)` (vraća SAMO tekst
MAR-07: MARATHON_LONG_SHORT, CAPACITY_LIMITED, DELOAD_LONG_SHORTENED, preporuka pouke 14) sa linijama pre MAR-07.

## Stalni uslovi

1. Jedan vlasnik: broj dana kvaliteta (secondQualityEasy), nedelja umora (fatigueWeek), izuzetak trkačke (raceOnlyWeek),
   poruka dugog (longShortOf) — validator čita iste funkcije. 2. Plafoni nedirnuti. 3. WU/CD nisu pufer (odbačeno za
   pouku 35). 4. Umor iz zapisa (konstruktor ga zna unapred). 5. Handoff nedirnut. 6. `marathon-v2.4.0`, faza iz okvira.
2. Uvozi samo iz `marathon/v2` (isolation prolazi). 8. Trkačka samo sa trkom je upozorenje, ne prazan plan; invarijante
   mreža (dugi ≥ lagan, prazan trening, minimum) bez prekršaja.

## Otvoreno

1. Nađeno usput (nije menjano, van N-tačaka): zaključan ili urađen dan kvaliteta iz nedelje posle novog rezultata
   (A1: novi tempo od sledeće nedelje) → WARMUP/COOLDOWN greška validatora (zaštićen dan nosi stari tempo, provera
   koristi tempo nedelje) → adaptacija odbijena. Primer `d4-r-16w`, rezultat brži kraj ned 6 + zaključan Q1 ned 7.
   Postoji i na 7ba9717. Mreže to ne kombinuju. Predlog: per-dan provere M14 preskaču zaštićene dane (kao LIMITS).
