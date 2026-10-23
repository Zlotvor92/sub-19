# 10K v2 — Segment 02: 3/5/6 dana i kratka priprema 8–9 nedelja (10k-v2.2.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `53da370`. Menjano samo `web/src/domain/generators/tenK/v2/**` i `docs/10k-v2/**` (novo `artifacts/segment-02/`; stari artifacts netaknuti). Obrisani zastareli `segment01.baseline-26846d7.json` i `segment01b.regression-exceptions.json` (regresiju prema 26846d7 zamenjuje regresija prema 53da370). Nula uvoza van `tenK/v2/`; 10K v1 i druge distance nepromenjeni; testovi izolacije bez novih izuzetaka.

## Odluke D17–D22 (pravilo | mesto | test)

| D   | pravilo                                                                                                                                                   | mesto                                                                 | test                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| D17 | `policy.days` — jedina tabela (3/4/5/6 dana: šablon, obim, max nedelje, udeo dugog, min nedelje); vrh min(1,4×; +15; max; kapacitet); 1/2/7 dana odbijeno | `policy.ts` `days`/`dayRule`; čitaju input, schedule, lengths, volume | policy.node D17; input.node D17 ×3; grid (15 840)                                        |
| D18 | 3 dana: jedan kvalitet T kont. / T cruise / RP, prelazi ≥, bez I/R; rasterećenje T ≈ 60 % slota; taper RP ≈ 60 %; kvalitet i dugi nesusedni               | `quality.ts` `ladderFor`, `carries`, `pickDeload`, `pickTaper`        | quality.node D18 ×3; schedule.node; validate.node D18; grid invarijante                  |
| D19 | 5/6 dana: Q1/Q2 kao 4 dana; lagani jednaki (razlika ≤ 0,1, raniji +0,1), ≥ 3 km, ≤ dugi; rasterećenje 1 kvalitet + dugi + lagani                          | `lengths.ts` `splitEasy`; `schedule.ts`; `week.ts`                    | week.node D13+D19; validate.node `EASY_UNEQUAL`; grid `EASY_EQUAL`                       |
| D20 | trkačka: dana sa trkom = min(dana, 5); otpada dugi, pa najraniji lagan; oštrenje ≤ RP tapera                                                              | `week.ts` `raceWeekRuns`, `sharpenerReps`                             | week.node D8+D20; validate.node D20; grid D20 (6 dana)                                   |
| D21 | B ≤ 7: specifično 2, razvoj ceil((B − 2)/2), baza ostatak; tačno 1 rasterećenje (ned 4)                                                                   | `periodize.ts` `phaseCounts` (rasterećenje: ista pretraga D5)         | periodize.node D21 ×2; grid kratka priprema                                              |
| D22 | T 50 m kad nema podele na 100 m; R 200/300/400 m; BASE_PLATEAU greška; CAPACITY_LIMITED imenuje ograničenje, više dana samo ako postoji                   | `workouts.ts` `structuresForDose`; `validate.ts`; `volume.ts`         | quality.node D10/D22; validate.node D22; volume.node D22; grid regresija i ponavljanja 0 |

## Odstupanja (opreznije, bez novog broja; svako u DECISIONS sa ulazom, napomena + upozorenje u planu)

| odluka          | odstupanje                                                                           | ulaz (primer)                                                 | u mreži 02               |
| --------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------ |
| D17             | 3 dana: ned 1 ispod obima i kad dugi nije na 105 min (udeo 40 %: kvalitet < 20 %)    | 3 d uto/čet/ned, 30 km, VDOT 35: ned 1 27,5 km, dugi 11,0     | 396 planova              |
| D5 (D11 ispred) | rasterećenje bez kvaliteta kad T 2,0 km > 10 % cilja (`DELOAD_NO_QUALITY`)           | 3 d, 12 ned, 20 km, VDOT 45: ned 4 cilj 18,0, plafon T 1,8    | 528 nedelja (3 d, 20 km) |
| D7 a            | 4–6 dana: taper samo RP kad sa RP i T nijedan cilj nije izvodljiv (`TAPER_RP_ONLY`)  | 6 d, 8 ned, 35 km, VDOT 70: taper 33,2, dva kvaliteta ≈ 22 km | 6 planova                |
| D7 b / D8       | taper bez kvaliteta kad RP 2 × 1000 > 10 % (`TAPER_NO_QUALITY`) → bez oštrenja       | 3 d, 8 ned, 20 km: taper 19,0 km, plafon RP 1,9               | 48 planova               |
| D15             | trkačka nedelja ispod minimuma = upozorenje `RACE_WEEK_SHORT` (D8 fiksan)            | 3 d, 8 ned, 20 km, VDOT 30: 2 × 35 min = 8,7 km < 9           | 6 planova                |
| D12             | 3 dana: jedini slot bez druge strukture ponavlja trening (identična nedelja)         | 3 d, 17 ned, 20 km, VDOT 45: ned 14–15 RP 2,5 km (5 × 500)    | 216 nedelja              |
| D8 + D9         | oštrenje nesusedno poslednjem zahtevnom danu tapera; nema takvog dana → bez oštrenja | 3 d pon/pet/ned, trka ned (bez toga `HARD_ADJACENT`)          | 0 (van mreže: 33 ulaza)  |

Druga pretraga cilja (`relax`, samo kad nijedan cilj nije izvodljiv po pravilu) nosi D11 ispred D12 (kao 01b), rasterećenje bez kvaliteta i taper „samo RP / bez kvaliteta" — bez nove petlje. Validator ih prihvata samo uz napomenu i nezavisnu proveru plafona.

## Sabotaže (pokvareno → palo → vraćeno; md5 svih fajlova posle = pre)

- D18: razvoj kod 3 dana na I umesto T cruise (`ladderFor`) → 18 od 143 (quality D18 ×3, validate D18, grid 0 odbijanja/bazna linija, uzorci).
- D19: ceo višak zaokruženja na prvi lagan dan (`splitEasy`) → 16 od 143 (validate `EASY_UNEQUAL`, grid 0 grešaka, uzorci).
- D21: kratka priprema sa podelom D4 (baza veća polovina) → 6 od 143 (periodize D21 ×2 i primeri, grid kratka priprema i bazna linija).
- D22: bez T 50 m (`structuresForDose`) → 19 od 143 (quality D22, validate BASE_PLATEAU, grid 0 grešaka/regresija); poruka sa preporukom i za 6 dana → 3 od 143 (volume D22, validate, kapacitet).
- Pre izmene: novi testovi nad kodom 53da370 (worktree, kopirani samo testovi i `testInputs.ts`) → 49 od 118 pada; svaka od D17–D22 ima bar jedan pali test (policy 7, input 4, periodize 5, schedule 4, quality 8, week 4, volume 4, validate 7, grid 6).

## Komande i rezultati (iz web/)

- Tokom rada: `npx vitest run --project node src/domain/generators/tenK/v2 src/domain/generators/architecture src/domain/generators/tenK/isolation` → 13 fajlova, 143 testa (tenK/v2: 11 fajlova, 118 testova; mreža ≈ 80 s).
- Jednom pre commita: `npx tsc -p tsconfig.domain.json --noEmit` exit 0; `npx tsc -p tsconfig.oracle.json --noEmit` prvo exit 2 (`schedule.node.test.ts:74`, `p.q2` sada `Weekday | null`) → ispravljeno (`p.q2!`), ponovo exit 0; `npx eslint src/domain/generators/tenK/v2` exit 0; `npx prettier --check src/domain/generators/tenK/v2 ../docs/10k-v2` exit 0 (posle ispravke ponovo exit 0); `npm run check` exit 0 — typecheck, lint, format:check, 206 test fajlova, 2514 testova (bilo 2492).
- Primeri: `node docs/10k-v2/artifacts/segment-02/run.ts` dva puta → bajt-isti izlaz (sha1 19 fajlova jednak).

## Mreža 02: 15 840 planova — 0 odbijanja, 0 grešaka validatora, deterministička, = `segment02.baseline.json`

Invarijante sopstvenim testom (bez validatora): planirano = cilj ± 0,1; dugi ≥ svaki lagan; dugi ≤ udeo i ≤ 105 min; teški dani nesusedni (i preko nedelja); WU/CD po pojasu; T ≥ 1000 m; rasterećenje po D5; D19; D20; Uslov 8; 3 dana tačno 1 kvalitet bez I/R; DOSE_DROPPED samo uz nedelju spuštenu sa dugim na 105 min (162/162). Van mreže (svi rešivi rasporedi 3–6 dana × 8/9/12/18 ned × 3 obima × VDOT 30/45/70 × sub/ned, i gusto km korak 1 × VDOT 30–80 korak 2): 23 036 ulaza → 0 odbijanja, 0 grešaka.

| dana | planova | ispod obima (105 min / udeo) | CAPACITY_LIMITED (105 / udeo / oba) | DOSE_DROPPED | ponavljanja (ned) | prosečan vrh/start |
| ---- | ------- | ---------------------------- | ----------------------------------- | ------------ | ----------------- | ------------------ |
| 3    | 2640    | 528 (132 / 396)              | 888 (120 / 180 / 588)               | 0            | 216               | 1,257              |
| 4    | 3696    | 660 (660 / 0)                | 1320 (1128 / 66 / 126)              | 162          | 48 (I 2,0; 9 ned) | 1,250              |
| 5    | 4224    | 264 (264 / 0)                | 810 (810 / 0 / 0)                   | 0            | 0                 | 1,279              |
| 6    | 5280    | 264 (264 / 0)                | 732 (732 / 0 / 0) bez preporuke     | 0            | 0                 | 1,250              |

## Regresija prema 53da370 (4 dana × 10–18 ned, 3024 plana)

- Redovi bazne linije (vrh cilj/planirano, najduži dugi, glavna doza, faze, rasterećenja): 0 promena; vrh ≥ 53da370 za svaki plan; izuzeci: 0 (`segment02.regression-exceptions.json` prazan).
- Ceo plan (heš bez oznake verzije i teksta CAPACITY_LIMITED, `segment02.plan-hashes-53da370.json`): 2184 isti (od toga 912 razlikuje se samo tekst poruke, D22), 528 sa T 50 m i R 400 m, 312 samo sa R 400 m; bez D22 strukture: 0. Uzrok svih promena: D22.
- Ponavljanje slota u mreži 4 dana × 10–18: 1068 → 0; BASE_PLATEAU: 0 (sada greška). `CAPACITY_LIMITED` (1104 plana, kao 01b): 936 „105 min", 60 „udeo 33 %" (01b ih je pogrešno pripisivao 105 min), 108 „oba".

## Stalni uslovi (AGENTS.md)

| #   | uslov                            | stanje 02                                                                                                                            |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | jedan vlasnik odluke, bez petlji | dani/obim tabela `days`; dužine `lengths.ts`; doza `quality.ts`; cilj i poruka `volume.ts`; popuštanje samo u postojećoj 2. pretrazi |
| 2   | jedan plafon po zoni             | D11 nepromenjen; odstupanja D5/D7 poštuju plafon (kvalitet otpada, ne raste plafon)                                                  |
| 3   | WU/CD nisu pufer                 | isti pojas za sve brojeve dana; manjak ide u lagane dane ili `WEEK_FITTED`                                                           |
| 4–5 | adaptacija, handoff              | nisu u segmentu; `construct(input, [])` nepromenjen                                                                                  |
| 6   | policyId/Version, faza nedelje   | `10k-v2` / `10k-v2.2.0`; faze D4/D21 iz periodize; validator `POLICY_STAMP`/`PHASES`                                                 |
| 7   | nula uvoza van foldera           | isolation.node + architecture/isolation testovi zeleni, bez novih izuzetaka                                                          |
| 8   | upotrebljivost                   | min nedelje po broju dana (9/12/15/18), lagan ≥ 3 km, dugi ≥ lagan, lagani jednaki; trkačka ispod minimuma samo upozorenje (D15)     |

## d3-20km-v35-12w (3 dana uto/čet/ned, 20 km, VDOT 35; cilj 55:00 realističan; WU/CD 15/10)

| ned       | faza         | cilj/plan               | kvalitet (čet)                      | dugi              | lagan (uto)      | napomena                      |
| --------- | ------------ | ----------------------- | ----------------------------------- | ----------------- | ---------------- | ----------------------------- |
| 1 / 2 / 3 | baza         | 20,0 / 21,2–21,3 / 22,5 | T 2,0 kont., 2 × 1000 m, 2,0 kont.  | 8,0 / 8,4 / 9,0   | 6,5 / 7,2 / 8,0  | plafon T 2,25 km: alternacija |
| 4         | baza         | 18,0                    | —                                   | 7,2               | 5,4 + čet 5,4    | bez kvaliteta (odstupanje D5) |
| 5 / 6 / 7 | razvoj       | 23,9 / 25,3–25,4 / 26,8 | T 2 × 1000, 2 × 1200 m, 2,4 kont.   | 9,5 / 10,1 / 10,7 | 8,8 / 9,2 / 10,2 | —                             |
| 8 / 10    | spec.        | 28,0–28,1 / 28,0        | RP 2 × 1200, 3 × 800 m              | 11,2              | 10,8 / 10,6      | 9: rasterećenje T 2 × 1000 m  |
| 11 / 12   | taper / trka | 21,0–21,1 / 10,6        | RP 2 × 1000 m / oštrenje 2 × 1000 m | 8,4 / —           | 7,0 / 35 min     | trka ned (van obima)          |

## short-9w-d5-45km-v50 (5 dana pon/uto/čet/sub/ned, 45 km, VDOT 50; faze 2/3/2/1/1; WU/CD 25/15)

| ned   | faza         | cilj        | kvalitet (uto / čet)                                  | dugi        | lagani                                       |
| ----- | ------------ | ----------- | ----------------------------------------------------- | ----------- | -------------------------------------------- |
| 1 / 2 | baza         | 45,0 / 47,7 | R 6 × 200, 8 × 200 m / T 2,5, 3,0 kont.               | 13,5 / 14,3 | pon/sub 6,0+5,9, 6,3+6,2                     |
| 3 / 5 | razvoj       | 50,6 / 53,6 | I 3 × 800, 3 × 1000 m / T 3 × 1000, 3 × 1200 m        | 15,1 / 16,0 | 6,9+6,8, 7,2+7,1                             |
| 4     | razvoj       | 40,5        | — / T 2 × 1000 m (rasterećenje)                       | 12,0        | pon/uto/sub 6,3                              |
| 6 / 7 | spec.        | 56,6 / 59,6 | RP 3 × 1000, 4 × 1000 m / T 4 × 1000, 3 × 1600 m      | 16,9 / 17,8 | 8,5+8,4, 8,6+8,6                             |
| 8 / 9 | taper / trka | 44,7 / 27,1 | RP 2 × 1200 / T 2 × 1200 m; oštrenje 2 × 1000 m (čet) | 13,3 / —    | 5,7+5,6 / 35 + 35 min, sub 20 min + 4 × 20 s |

## Odluke

- D17–D22 u `DECISIONS` (policy.ts, `10k-v2.2.0`), D1–D22 zakucani u policy.node; odstupanja gore, svako sa ulazom.
- Tumačenja bez novog broja: D7 „4 dana" → svi dani trčanja (učestalost zadržana); D22 50 m samo kad podele na 100 m nema (4,5 km ostaje 3 × 1500 m; inače 2 × 2250 m); kod 3 dana prelaz T kont. → T cruise koji bi dao isti trening ide pravilom iste lestvice (D12 „nema identičnih nedelja"); `CAPACITY_LIMITED` „oba" kad se u planu javljaju oba ograničenja; preporuka = svi veći brojevi dana iz tabele.
- Poruke odbijanja obima navode brojeve dana čiji red podržava obim (npr. 6 dana / 30 km → „podržava 3–5 dana"); < 20 km i dalje „5K plan ili izgradnja osnove".

## Preostali problemi

- 3 dana: udeo 40 % nosi nedelju samo dok je kvalitet ≥ 20 % cilja → 396 planova kreće ispod obima zbog udela, 588+180 `CAPACITY_LIMITED` sa udelom; trenerska odluka (udeo ili WU/CD za 3 dana).
- 3 dana / 20 km: rasterećenje i (8 ned) taper bez kvaliteta, trkačka 8,7 km < 9 (VDOT 30); RP 2,5 / 3,5 km bez druge strukture (RP ostaje deljiv sa 100 m) → 216 ponovljenih nedelja.
- Niski obim + brz trkač, 5–6 dana: WU/CD (35–40 min) dominiraju — dugi u izgradnji od 4,7 km (6 d, 35 km, VDOT 70), dugi kraći od kvalitetnog dana u 612 planova 6 dana; trkačka nedelja veća od tapera u 8 / 57 / 9 planova (4 / 5 / 6 dana).
- I 2,0 km nema drugu strukturu: 48 ponavljanja (4 dana, 9 ned, 25 km) — dozvoljeno jer drugi slot menja nedelju.
- Udeli zona (D2), prognoza pri VDOT 30 i heuristike D16/D17 (udeli, min nedelje) bez merenja na podacima.
