# Maraton v2 — Segment 03 (MAR-03): po osećaju + test 5 km, početnik, plafon MP (marathon-v2.2.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `bfb82c9` (kod = MAR-02 `409020f`). Menjano samo
`web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**`; `marathon/index.ts`, maraton v1, lični plan,
aplikacija i ostale distance nepromenjeni. Tri STANI, odluke organizatora u tekstu.

## Odluke (pravilo | mesto | test)

| id  | pravilo (sažeto)                                                                                                                                                                                                  | mesto                                                                                                          | test                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| M16 | bez rezultata / > 84 dana / VDOT < 30 → po osećaju; lagan 270–510 obavezan; E = lagan ± 15 s; procena VDOT (brži kraj E) 25–60; RPE T 6–7, I 8, R 8, MP 5–6; bez prognoze/cilja; `paceBasis`                      | input.ts, paces.ts `feelPaces`, policy `feel`, workouts `rpeOf`, validate (PACE_BASIS, RPE)                    | feel.node, input.node, feelGrid (invarijante nezavisno) |
| M16 | test 5 km u poslednjoj nedelji baze: Q1 (3 d: umesto jedinog kvaliteta) ili dan T slota u rasterećenju; u obimu, nije doza; progresija od stanja pre testa                                                        | periodize `testWeekOf`, week.ts, workouts `testWorkout`, quality `advance`, validate TEST                      | feel.node, feelGrid                                     |
| M17 | početnik: 4–5 d, 16–24 ned, 25–45 / 30–50 km; uvod 2 ned; 1 kvalitet, bez I/R; T kont. [1,5; 2,0; …]; T kont. kad prvi nivo faze ne staje; rast 5 % (1,0–2,5); vrh 1,5× / +25; WU/CD 15/10; bez testa; prag 24 km | policy `beginner` + `planRule`; input, schedule, quality (`buildLadder`, `startLevel`), week, volume, validate | beginner.node, beginnerGrid, policy.node                |
| M17 | runWalk → RUN_WALK_NOT_SUPPORTED (preporuka kraće distance), za sve                                                                                                                                               | input.ts                                                                                                       | beginner.node, input.node                               |
| M15 | udeo 5/6 d ostaje 0,35 / 0,32 (merenje ispod, odluka organizatora (a))                                                                                                                                            | policy `days`, DECISIONS M15                                                                                   | policy.node, sabotaža S6                                |
| M11 | plafon MP u izgradnji = min(20 %; trajanje MP dana ≤ najduži dozvoljeni dugi nedelje); najniži nivo MP izuzet od drugog člana; ostale zone samo upozorenje                                                        | quality `mpFitsLong` (jedina; pickSlot/pickBuild i validate), week.ts, validate MP_LONG_CAP                    | quality.node, grid (regresija MAR-02), S11, S14         |
| S2  | rasterećenje sa testom (M16) i početnika (M17): dugi skraćen kad lagani ne bi bili ≥ 5 km (presedan 10K D27 ispred D5); DELOAD_LONG_SHORTENED                                                                     | lengths `deloadLengths` (jedina; validate je čita)                                                             | feel.node, feelGrid, beginnerGrid, S12                  |
| S3  | početnik N−1 bez MP: T kont. ≈ 60 % poslednje T (min 1,5 km); trkačka bez oštrenja; M7a ne važi                                                                                                                   | quality `taperDoses`/`pickTaper` (beginner), week.ts, validate TAPER_QUALITY                                   | quality.node, beginnerGrid, S13                         |

DECISIONS M1–M17 + M7a, M10a, M13a (M1, M7a, M11, M15 ažurirani; M16, M17 novi). Tačka 4 zadatka zapisana
(TAPER_MP_OVER_CAP 3 d ostaje — M7a; T plato 3 d u redu; 78 + 234 plana M13a prihvaćeno).

## STANI i odluke organizatora

1. **Udeo dugog 5/6 d** (kod MAR-02, menjan samo udeo; mreža 02 / gusta ned 1). Nijedan udeo ne ispunjava „kval. > dugi ≤ 1 %":

| dana | udeo | K1 mreža            | K1 gusta | kval. > dugi mreža (pl. / ned) | gusta       | CAP  | ned 1 < obim bez plafona | LONG_SHORT mreža / gusta |
| ---- | ---- | ------------------- | -------- | ------------------------------ | ----------- | ---- | ------------------------ | ------------------------ |
| 5    | 0,35 | 0                   | 0        | 126 / 126 (2,0 %)              | 0           | 1302 | 0                        | 3768 / 25 013            |
| 5    | 0,38 | 0                   | 0        | 126 / 126                      | 0           | 1302 | 0                        | 3744 / 22 396            |
| 5    | 0,40 | 66 WEEK_INFEASIBLE  | 0        | 126 / 126                      | 0           | 1302 | 0                        | 3390 / 21 163            |
| 6    | 0,32 | 0                   | 0        | 786 / 1464 (9,7 %)             | 1788 / 1830 | 1482 | 0                        | 4392 / 27 500            |
| 6    | 0,35 | 66 WEEK_INFEASIBLE  | 0        | 786 / 1464                     | 1788 / 1830 | 1482 | 0                        | 4116 / 25 337            |
| 6    | 0,38 | 198 WEEK_INFEASIBLE | 0        | 786 / 1464                     | 1788 / 1830 | 1482 | 0                        | 3984 / 24 914            |

Uzrok: svih 126 / 786 = VDOT 30, specifična faza, dugi na 150 min; MP 16 km kont. + WU/CD duži. Odluka: udeo ostaje + drugi član plafona MP. 2. **S2/S3** (mreža 03): po osećaju 126 / 8190 i početnik 459 / 1890 neizvodljivo rasterećenje ned 4; početnik 378 / 1890 neizvodljiv N−1 (MP 2 × 3000 + dugi ≤ 0,45 × + lagani ≥ 5 km > 0,6 × vrh). Odluka: S2 skraćen dugi, S3 opcija (b). 3. **Plafon MP × M13a** (pun nivo): strogo +570 RECENT_LONG_TOO_SHORT (r 5–9, VDOT 45/70, prva nedelja specifične faze; ni 2 × 3000 m ne staje u dugi na plafonu skoka). Odluka (b): najniži nivo MP izuzet. 58 planova guste ned 1 (6 d 50 km, VDOT 76–80, ned 1 Q2 T 3,0 km kont.; npr. dense-d6-50km-v76: dugi 11,5 km = 44 min, T dan 44 min) prihvaćeno kao upozorenje: drugi član za sve zone (izmereno) daje 58 × VOLUME_START (ned 1 49,9 < 50 km, pouka 9), mreža 02 bez promene — odbijanje je gore za trkača od upozorenja za ≤ 1 min.

## Odstupanja (svako sa ulazom)

| odluka | odstupanje                                                                        | ulaz                                           | mera                                                |
| ------ | --------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| S2     | dugi rasterećenja < 0,8 × poslednji                                               | feel-d3-14w-30km-e270: ned 4 dugi skraćen      | po osećaju 126 ned; početnik 564 ned                |
| M11    | MP ne raste preko 14 km (16 km kont. ne staje u trajanje dugog) — bez koraka drop | d5-21w-55km-v30: ned 18 MP 16 → 14 km          | 252 / 2250 ned (5 / 6 d), sve VDOT 30, pad ≤ 2,0 km |
| M11    | MP 2 × 3000 m duži od dugog na plafonu skoka (izuzetak)                           | recent-d5-12w-70km-v70-A-r6 ned 6: 62 > 45 min | 570 planova M13a, najviše 16,8 min                  |

## Kontrolne metrike (`artifacts/segment-03/metrics.json`)

Po osećaju (8190 = 1170 / 1638 / 2340 / 3042 za 3 / 4 / 5 / 6 d) i početnik (1890: 4 d 540 osećaj + 405 rezultat, 5 d isto):

| mreža / dana | K1  | K2 ned 1 < obim (bez dugog na 150 min) | K3  | K5 (4) | ponavljanja | kval. > dugi | CAP | vrh/start | DOSE_DROPPED | LONG_SHORT | TAPER_MP_OVER_CAP | test deload / Q1 | dugi skraćen (ned) |
| ------------ | --- | -------------------------------------- | --- | ------ | ----------- | ------------ | --- | --------- | ------------ | ---------- | ----------------- | ---------------- | ------------------ |
| osećaj 3     | 0   | 195 (0)                                | 0   | 0      | 0           | 0            | 582 | 1,342     | 0            | 864        | 672               | 360 / 810        | 36                 |
| osećaj 4     | 0   | 390 (0)                                | 0   | 0      | 0           | 0            | 840 | 1,352     | 93           | 1254       | 18                | 504 / 1134       | 27                 |
| osećaj 5     | 0   | 234 (0)                                | 0   | 0      | 0           | 0            | 759 | 1,381     | 27           | 1722       | 0                 | 720 / 1620       | 36                 |
| osećaj 6     | 0   | 351 (0)                                | 0   | 0      | 0           | 0            | 828 | 1,324     | 54           | 2112       | 0                 | 936 / 2106       | 27                 |
| početnik 4   | 0   | 0                                      | 0   | 0      | 0           | 0            | 60  | 1,5       | 0            | 891        | 0                 | — (bez testa)    | 210                |
| početnik 5   | 0   | 0                                      | 0   | 0      | 0           | 0            | 0   | 1,499     | 0            | 918        | 0                 | — (bez testa)    | 354                |

- Po osećaju: procena VDOT 26,1–58,6; test duži (km) od dugog 0 / 0 / 9 / 9; DOSE_DROPPED samo u nedelji ograničenoj kapacitetom (K5 0).
- Početnik: S3 u svih 1890 (N−1 T kont., bez oštrenja); T kont. umesto lestvice faze 0 nedelja (MP 2 × 3000 staje od 30 km, a mreža stiže do specifične faze iznad toga); bez kvaliteta posle uvoda 0; najduži dugi medijana 18,0 / 18,3 km (LONG_SHORT 24 km u 1809 / 1890).
- Mreža 02 (21 840) i gusta ned 1 (157 954): K1 = 0; kval. > dugi 0 / 0 / 0 / 0 i gusta 0 / 0 / 0 / 58.
- Mreža M13a (35 910): 942 odbijanja (= MAR-02; r 5 → 489, 6 → 309, 7 → 105, 8 → 39). Kval. > dugi 2145 planova (MAR-02: 4986 = MP 3645 + ostale zone 2145); sada ostale zone 2145 (ned 1 posle kratkog r, isto kao MAR-02), od toga i MP 570 (izuzetak): po r 5 → 114, 6 → 189, 7 → 153, 8 → 75, 9 → 39; VDOT 45 → 129, 70 → 441; dani 4 / 5 / 6 → 48 / 180 / 342; najveća razlika 16,8 min. Upozorenje navodi „dugi je ograničen skokom … (M13a)".
- **K4** (prema `segment02.baseline.json`): vrh niži 648 planova, najviše 2,0 km (5/6 d, VDOT 30, svi već CAPACITY_LIMITED u MAR-02): MP 14 umesto 16 km → lagani bi bili duži od dugog na 150 min → nedelja na najbliži izvodljiv cilj.

## Regresija prema MAR-02 (planovi sa rezultatom)

- 3 / 4 d: 3120 / 4368 bajt-isto (planHash02 = heš MAR-02 bez `paceBasis: 'result'`). 5 / 6 d: 6114 / 7326 isto, promenjeno 126 / 786 = tačno planovi koji su u MAR-02 imali LONG_SHORTER_THAN_QUALITY (test mreže proverava skup). U njima: MP niži u 252 / 2250 nedelja (16 → 14 km), taper (MP ≈ 50 % poslednje doze) i cilj N−1 u 894, vrh u 648; novih upozorenja 0, LONG_SHORTER_THAN_QUALITY nestaje u svih 912.
- Udeo 5/6 d: bez promene (odluka (a)). Regresija 4 dana prema MAR-01 nepromenjena.

## Sabotaže (`node scripts/sabotage.mjs ../docs/marathon-v2/artifacts/segment-03/sabotage.json`)

13 / 13 PAO, 101,4 s, stanje src isto (heš 36b70abb…); `artifacts/segment-03/sabotage-result.json`.

| #   | sabotaža                             | prvi pali (s)          |
| --- | ------------------------------------ | ---------------------- |
| S1  | test u prvoj nedelji baze            | feel.node (12,7)       |
| S2  | test kao doza T                      | feel.node (11,5)       |
| S3  | početnik sa I/R                      | beginner.node (4,4)    |
| S4  | početnik bez uvoda                   | beginner.node (1,8)    |
| S5  | runWalk se ne odbija                 | input.node (1,8)       |
| S6  | udeo 5 d 38 %                        | policy.node (1,7)      |
| S7  | RPE MP 6–7                           | feel.node (1,8)        |
| S8  | procena VDOT iz sporog kraja E       | feel.node (2,5)        |
| S9  | početnik: start 60 % plafona         | beginner.node (4,5)    |
| S11 | drugi član plafona MP isključen      | grid.node (36,5)       |
| S12 | S2 bez skraćenja dugog               | beginnerGrid K1 (13,3) |
| S13 | S3: MP vraćen u N−1 početnika        | beginnerGrid K1 (4,4)  |
| S14 | izuzetak najnižeg nivoa MP isključen | quality.node (2,4)     |

- S5 je u prvom pokretanju (`--parallel 2`, uz metrike) dao GREŠKA (vitest bez palog testa); pojedinačno 4 × PAO.
- Izbačena S10 („skraćen dugi i u planu sa rezultatom"): ekvivalentna mutacija — 0 od 57 750 planova sa rezultatom (mreža 02 + M13a) ima skraćen dugi.

## Komande i rezultati (iz `web/`)

- `npx tsc -p tsconfig.domain.json --noEmit` i `-p tsconfig.oracle.json` exit 0; `npx eslint src/domain/generators/marathon/v2` exit 0; `npx prettier --check … ../docs/marathon-v2` exit 0.
- Brz: `npx vitest run --project node src/domain/generators/marathon/v2` → 17 fajlova, 192 testa, zid 48,9 s.
- Pun: `TEST_FULL=1 …` → 33 fajla, 255 testova, exit 0, zid 6 min 18 s (pre izuzetka najnižeg MP: 252 / 255, pala mreža M13a — STANI 3).
- `npm run check` → exit 0: typecheck, lint, format, 252 fajla, 3060 testova (zid 11 min 28 s).
- Bazne linije: `segment03.baseline.json` (mreža 02), `segment03-feel.baseline.json`, `segment03-beginner.baseline.json` (`TEST_FULL=1 MARATHON_V2_WRITE_BASELINE=1`). `run.ts` dva puta → bajt-isti izlaz (sha1).

## Stalni uslovi (AGENTS.md)

| #   | uslov                          | stanje MAR-03                                                                                                                            |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | jedan vlasnik odluke           | put tempa input.ts; brojevi početnika `planRule`; nedelja testa `testWeekOf`; dužine `deloadLengths`; plafon MP `mpFitsLong`; bez petlji |
| 2   | jedan plafon po zoni           | MP: jedna funkcija sa dva člana (odluka organizatora); test nije doza; ostale zone bez promene                                           |
| 3   | WU/CD nisu pufer               | WU/CD testa po M14, početnik 15/10; skraćuje se dugi, ne WU/CD                                                                           |
| 4–5 | adaptacija, handoff            | n/p (MAR-04, faza 3)                                                                                                                     |
| 6   | policyId/Version, faza nedelje | `marathon-v2` / `marathon-v2.2.0`; `paceBasis`; oznaka nedelje testa; validator POLICY_STAMP, PACE_BASIS, TEST                           |
| 7   | nula uvoza van foldera         | isolation.node zelen, bez novih izuzetaka                                                                                                |
| 8   | upotrebljivost                 | lagan ≥ 5 km i dugi ≥ lagan i u rasterećenju sa testom; uvod bez kvaliteta; 0 nedelja izgradnje bez kvaliteta posle uvoda                |

## Tabela jednog plana — početnik 4 d, 25 km, lagan 7:30, 16 ned (S2 + S3; `examples.md`)

| ned   | faza       | cilj        | kvalitet                          | dugi          | lagani      |
| ----- | ---------- | ----------- | --------------------------------- | ------------- | ----------- |
| 1–2   | baza uvod  | 25,0 / 26,3 | —                                 | 10,0 / 10,5   | 3 × 5,0–5,3 |
| 3     | baza       | 27,6        | T 1,5 km kont.                    | 11,0          | 5,9 / 5,9   |
| 4     | raster.    | 22,1        | T 1,5 km kont.                    | 7,2 (skraćen) | 5,1 / 5,0   |
| 5–7   | razvoj     | 29,0–32,0   | T 2 × 1200, 3 × 1000, 2 × 1500    | 11,6–12,8     | 5,7–6,4     |
| 9–13  | specifično | 33,6–37,5   | MP 2 × 3000 ↔ 6,0 km kont.        | 13,4–15,0     | 5,3–6,6     |
| 14/15 | taper      | 30,0 / 22,5 | MP 2 × 3000 / T 1,5 km kont. (S3) | 9,7 / 6,7     | 5,4 / 5,5   |
| 16    | trka       | —           | bez oštrenja                      | —             | —           |

Ostali primeri: po osećaju 4 d 45 km (test u rasterećenju, Q2), 3 d 30 km (test na Q1), 3 d 30 km 4:30 (skraćen dugi), 6 d 90 km; početnik sa rezultatom 4 d 35 km, po osećaju 5 d 45 km.

## Preostali problemi

- Početnik: najduži dugi < 24 km u 1809 / 1890 (medijana 18 km) — „cilj: završiti"; MP plato 2 × 3000 ↔ 6 km kont. kad 2 × 4000 ne staje u 20 %.
- Ostale zone: kval. > dugi u 58 (gusta ned 1) i 2145 (M13a, ned 1 posle kratkog r) — upozorenje (odluka).
- MP orijentir po osećaju do testa; MP posle testa čeka adaptaciju (MAR-04). Heuristike M16/M17 bez merenja na podacima.
