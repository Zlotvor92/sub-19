# HM v2 — Segment 03: plan po osećaju + test 5 km, početnik, odbijanje trčanja/hodanja (hm-v2.2.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`; polazni SHA `2285fc7` (HM-02 `06cfb5a`), zaustavljanje `4fc8a3c`
(`SEGMENT-03-STOP.md`, istorija), odluke organizatora: P1 → HI14 (pouka 33, A: za sve planove), pouka 14 za test,
potvrde HI10 i H17 (< 14 km samo upozorenje). Menjano samo `halfMarathon/v2/**` i `docs/hm-v2/**`; HM v1,
`halfMarathon/index.ts`, lični plan, aplikacija i druge distance netaknuti.

## Odluke | mesto | test (`policy.ts` DECISIONS; brojevi zakucani u `policy.node`)

| odluka                                                                                                                                                                                                               | mesto                                                                         | test                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| H1 opseg 03: bez pouzdanog rezultata plan po osećaju; RESULT_REQUIRED / BEGINNER_NOT_SUPPORTED ukinuti                                                                                                               | input.ts                                                                      | input.node                                         |
| H16 lagan 270–510 obavezan, E ± 15 s, procena VDOT (brži kraj E) 25–60, paceBasis feel, RPE T/RP 6–7 I/R 8 (i oštrenje), bez prognoze i cilja                                                                        | input.ts, paces.ts feelPaces, workouts.ts rpeOf, generate.ts                  | feel.node, feelGrid (invarijante FEEL_*, RPE)      |
| H16 test 5 km: poslednja nedelja baze, dan Q1 / dan kvaliteta rasterećenja, u obimu, ne u dozi; progresija od stanja pre testa                                                                                       | periodize.ts testWeekOf, week.ts, workouts.ts testWorkout, quality.ts advance | feel.node, feelGrid (TEST_*)                       |
| H17 početnik: planRule (jedina tabela), 4–5 d, 12–20 ned, 20–40 / 25–45 km, uvod 2, 1 kvalitet bez I/R, rast 5 % (1–2 km), vrh 1,4× / +15, dugi 135 min, WU/CD 15/10, bez testa, < 14 km upozorenje; runWalk odbijen | policy.ts planRule, input.ts, schedule.ts, week.ts, volume.ts, lengths.ts     | beginner.node, beginnerGrid, input.node            |
| HI10 T kont. početnika od 1,5 km, start = prvi nivo, T kont. kad prvi nivo faze ne staje, rasterećenje min 1,5 km, taper T kad RP ne staje                                                                           | workouts.ts ladderLevels, quality.ts buildLadder/deloadDose/beginnerTaperT    | beginner.node, invarijante BEGINNER_*              |
| HI11 tumačenja testa; (f) dan testa = kvalitetni dan za LONG_SHORTER_THAN_QUALITY (pouka 14)                                                                                                                         | week.ts, validate.ts                                                          | feel.node                                          |
| HI13 pouka 31: rasterećenje u uvodu bez kvaliteta                                                                                                                                                                    | week.ts, validate.ts INTRO                                                    | beginner.node (sintetička nedelja)                 |
| HI14 pouka 33: rasterećenje neizvodljivo zbog minimuma laganog → dugi skraćen (najduži uz lagane ≥ 4 km, ≥ lagan), cilj ostaje, kvalitet otpada samo ako ni tada ne staje; napomena + DELOAD_LONG_SHORTENED          | lengths.ts deloadLengths, deloadEasyShort; week.ts; validate.ts               | beginner.node, beginnerGrid, recent.node (izuzeci) |
| HI12 odluke HM-02/03 bez promene koda                                                                                                                                                                                | —                                                                             | —                                                  |

Nad kodom 2285fc7 svi ulazi mreže 03 su odbijeni (RESULT_REQUIRED, BEGINNER_NOT_SUPPORTED) — feelGrid/beginnerGrid,
feel.node i beginner.node padaju; HI14 test (`b-d4-13w-20km-e330-A`) pada na 4fc8a3c (WEEK_INFEASIBLE ned 4).

## Odstupanja (svako sa ulazom)

- HI14 (pouka 33), početnik 4 d 20 km, lagan 5:30, 13 ned (`b-d4-13w-20km-e330-A`): ned 4 cilj 17,7 km, uz T 1,5 km
  dugi bi bio < lagan → bez kvaliteta, dugi 5,7 km (0,8 × = 6,4), lagani 3 × 4,0. Mreža 03: 606 nedelja / 426 planova
  početnika sa skraćenim dugim; dugi / poslednji ne-rasteretni dugi min 0,494, p10 0,523, medijana 0,630; 48
  rasterećenja bez kvaliteta (4 d i 5 d po osećaju, po 24). Po osećaju: test u rasterećenju skraćen 102 nedelje
  (min 0,627, p10 0,656, medijana 0,724). `measure-hi14.ts`.
- HI14 skraćuje samo kad standardna konstrukcija ne prolazi: merenje P1 iz STOP-a je menjalo 27 izvodljivih planova
  početnika — artefakt zaokruženja (lagani 7,95 → 8,0 km); sada 0 (`classify-hi14.ts` prema 4fc8a3c: početnik 0,
  po osećaju 6 — test-rasterećenje 4 d 30 km lagan 7:30, dugi 10,6 → 10,7, nepotrebno skraćenje uklonjeno).
- Kvalitet otpada samo pri minimumu laganog (`deloadEasyShort`): bez toga 312 planova sa rezultatom (3 d, VDOT 30,
  lagan > dugi) menjalo bi rasterećenje (sabotaža S14).
- Pouka 14 za test: 18 nedelja izgradnje sa testom dužim od dugog (6 d, 40 km, lagan 4:30) — svi planovi već imaju
  upozorenje zbog Q2 (0 novih); 42 nedelje testa u rasterećenju su van provere ne-rasteretne izgradnje → HM-04 korak A.

## Regresija prema HM-02 (`artifacts/segment-03/regression-hm02.ts`; heš: plan bez oznake verzije ili razlozi odbijanja)

Mreža 02 16 896 + mreža r 10 944 + gusta ned 1 141 804 = 169 644 ulaza: 169 638 isti, 6 razlika — tačno spisak
izuzetaka `segment03.regression-exceptions.json` (HI14 / pouka 33, odluka A); `recent.node` obara svaku drugu
razliku (fikstura `segment02.recent-hashes-2285fc7.json`), `grid.node` drži `segment02.baseline.json` bez izmene.
Menja se samo prva rasteretna nedelja; vrh i ostale nedelje isti:

| ulaz (3 d, VDOT 70, r 5)                           | ned | pre: cilj (pravilo) / dugi / lagani / kvalitet | posle                    |
| -------------------------------------------------- | --- | ---------------------------------------------- | ------------------------ |
| d3-10w-40km, d3-10w-45km                           | 5   | 19,9 (down, 21,4) / 7,2 / 6,4 + 6,3 / 0        | 21,4 / 6,6 / 4,0 / 1 (T) |
| d3-14w-40km, d3-20w-40km, d3-14w-45km, d3-20w-45km | 4   | 19,2 (down, 20,2) / 6,4 / 6,4 + 6,4 / 0        | 20,2 / 5,6 / 4,1 / 1 (T) |

## K1–K6 (`node docs/hm-v2/artifacts/segment-03/k-metrics.ts`, 26 s)

| mreža 03                                          | f 3 d (990)                                               | f 4 d (1386)    | f 5 d (1782)   | f 6 d (2178)    | poč. 4 d (945)                                                             | poč. 5 d (945)                             |
| ------------------------------------------------- | --------------------------------------------------------- | --------------- | -------------- | --------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| K1 odbijanja / greške validatora                  | 0 / 0                                                     | 0 / 0           | 0 / 0          | 0 / 0           | 0 / 0                                                                      | 0 / 0                                      |
| K2 ned 1 < obim: ukupno / bez dugog na plaf.      | 33 / 0                                                    | 165 / 0         | 66 / 0         | 33 / 0          | 0 / 0                                                                      | 0 / 0                                      |
| K3 izgradnja bez kvaliteta                        | 0                                                         | 0               | 0              | 0               | 0                                                                          | 0                                          |
| K4 vrh niži od HM-02                              | — (novi planovi; sa rezultatom: regresija gore, vrh isti) |                 |                |                 |                                                                            |                                            |
| K5 trkačka > taper / pad / susedni / dugi < lagan | 0/0/0/0                                                   | 0/0/0/0         | 0/0/0/0        | 0/0/0/0         | 0/0/0/0                                                                    | 0/0/0/0                                    |
| K6 ponavljanja / kval. > dugi / CAPACITY_LIMITED  | 0 / 0 / 288                                               | 0 / 0 / 405     | 0 / 0 / 261    | 0 / 33 / 147    | 0 / 0 / 18                                                                 | 0 / 0 / 0                                  |
| K6 vrh/start                                      | 1,327                                                     | 1,313           | 1,321          | 1,298           | 1,394                                                                      | 1,380                                      |
| test u rasterećenju (dugi skraćen)                | 180 (24)                                                  | 252 (24)        | 324 (18)       | 396 (36)        | —                                                                          | —                                          |
| ostalo                                            | LONG_SHORT 198, taper / rast. bez kval. 198 / 156         | DOSE_DROPPED 54 | LONG_SHORT 198 | TAPER_RP_ONLY 9 | skraćen dugi 237, T kont. umesto lestvice 84 ned, taper T 378, < 14 km 189 | skraćen dugi 189, taper T 189, < 14 km 378 |

Nezavisne invarijante (`gridInvariants.ts`) na svih 8226 planova mreže 03: 0 prekršaja. Mreža 02 (16 896), gusta
ned 1 (141 804) i mreža r (10 944): K1–K6 kao HM-02 (planovi isti osim 6 izuzetaka).

## Sabotaže (`node scripts/sabotage.mjs ../docs/hm-v2/artifacts/segment-03/sabotage.json --parallel 2`): 15/15 PAO, 71,4 s

S1 test u prvoj nedelji baze (12,4 s); S2 test kao doza (12,6); S3 početnik I/R (1,5); S4 bez uvoda (2,1); S5 runWalk
prihvaćen (1,9); S6 dugi početnika 150 min (1,6); S7 start ≤ 60 % plafona (5,6); S8 procena iz sporog E (14,1); S9
RPE RP 7–8 (13,0); S10 rasterećenje u uvodu sa kvalitetom (1,9); S11 paceBasis u planu sa rezultatom (14,6); S12
HI14 skraćivanje isključeno (5,6); S13 validator bez iste funkcije (4,8); S14 kvalitet otpada van minimuma laganog
(22,4); S15 test van pouke 14 (6,4). Stanje src vraćeno (heš 35e7fa5a46e53174).

## Komande i rezultati (iz `web/`)

- `npx tsc -p tsconfig.domain.json --noEmit`, `npx tsc -p tsconfig.oracle.json --noEmit`, `npx eslint
src/domain/generators/halfMarathon/v2`, `npx prettier --check src/domain/generators/halfMarathon/v2 ../docs/hm-v2` → 0.
- Brz nivo HM v2: 17 fajlova, 146 testova, 28 s zida (najduži samostalno `grid` 22 s, `dense` 12 s, `feelGrid` 10,5 s).
  Pun (`TEST_FULL=1`): 29 fajlova, 181 test, 205 s.
- `npm run check`: exit 0 — typecheck, lint, format:check, 252 test fajla, 3062 testa (pre izmena HM-03 posle odluke 3060).
- `node docs/hm-v2/artifacts/segment-03/run.ts` dva puta → md5 isti (7 primera); regresija po 6 min 15 s – 6 min 48 s.

## Stalni uslovi (AGENTS.md)

| #   | stanje                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | put tempa `input.ts`; tempo `paces.ts`; mesto testa `periodize.ts`; brojevi početnika samo `planRule`; doza `quality.ts`; dužine rasterećenja jedna funkcija `deloadLengths` (+ `deloadEasyShort`); validator samo prijavljuje, iste funkcije |
| 2   | H11 nepromenjen; test nije doza; 1,5 km je nivo lestvice                                                                                                                                                                                      |
| 3   | WU/CD testa po H14, početnik 15/10; skraćuje se dugi, nikad WU/CD; cilj rasterećenja ostaje                                                                                                                                                   |
| 4–5 | adaptacija i predaja nisu u segmentu; HI13 struktura uvoda za 04                                                                                                                                                                              |
| 6   | `hm-v2` / `hm-v2.2.0`; `paceBasis` samo po osećaju; oznaka nedelje testa i faza iz `periodize`                                                                                                                                                |
| 7   | `isolation.node` zelen, bez novih izuzetaka                                                                                                                                                                                                   |
| 8   | uvod sa laganima ≥ 4 km; test ne „jede" nedelju (lagani ≥ 4 km, dugi ≥ lagan); rasterećenje najmanjeg obima: dugi ≥ 4,3 km i ≥ lagan, nikad odbijanje ni degenerisan plan                                                                     |

## Primer: f-d4-12w-40km-e360-A (po osećaju, 4 d, 40 km, lagan 6:00; procena VDOT 41,0; ostali u `artifacts/segment-03/plans.md`)

| ned        | faza         | km                 | Q1 / test                                   | Q2                       | dugi        | lagan       |
| ---------- | ------------ | ------------------ | ------------------------------------------- | ------------------------ | ----------- | ----------- |
| 1 / 2      | baza         | 40,0 / 42,4        | R 6 × 200, 8 × 200 m (RPE 8)                | T 2,0 / 2,5 km (RPE 6–7) | 16,0 / 16,9 | 8,1 / 8,3   |
| 3          | baza         | 44,9               | test 5 km                                   | T 3,0 km                 | 17,9        | 7,3         |
| 4 / 6      | razvoj       | 47,6 / 50,5        | I 2 × 1000, 3 × 800 m                       | T 3 × 1000, 2 × 1600 m   | 19,0 / 20,2 | 10,9 / 11,7 |
| 5 / 9      | rasterećenje | 38,1 / 44,8        | —                                           | T 2 × 1000, 2 × 1200 m   | 15,2 / 17,9 | 2 lagana    |
| 7 / 8 / 10 | specifično   | 53,5 / 56,0 / 56,0 | RP 2 × 2000, 2 × 2500, 2 × 3000 m (RPE 6–7) | T 4 × 1000 … 2 × 2400 m  | 21,4–22,4   | 10,6–11,7   |
| 11 / 12    | taper / trka | 39,2 / 19,9        | RP 2 × 2000 m / oštrenje RP 2 × 2000 m      | T 2 × 1200 m             | 13,4 / —    | 7,3 / 5,8   |

## Preostali problemi

- Početnik najmanjeg obima: dugi rasterećenja do 0,49 × poslednjeg (4,3 km), 48 rasterećenja bez kvaliteta (HI14).
- Početnik: najduži dugi < 14 km u 378 / 945 planova sa 5 d (udeo 32 %) i 189 / 945 sa 4 d (20–25 km) — samo
  upozorenje (odluka).
- Dan testa duži od dugog u rasterećenju (42 nedelje) bez upozorenja → HM-04 korak A (pouka 32 za test).
- Procena VDOT-a iz laganog tempa i RPE su heuristike; tempo brzih zona po osećaju čeka test i adaptaciju (04).
- Nasleđeno: 3 d 25 km taper/rasterećenje bez kvaliteta, 6 d kvalitetni dan duži od dugog (prihvaćeno, HI12).
