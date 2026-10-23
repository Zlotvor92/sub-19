# 10K v2 — Segment 03: plan po osećaju + test 5 km, početnik, bez trčanja/hodanja, ispravke RP i trkačke nedelje (10k-v2.3.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `21c03f1`. Menjano samo `web/src/domain/generators/tenK/v2/**` i `docs/10k-v2/**` (novo `artifacts/segment-03/`; stari artifacts netaknuti). Nula uvoza van `tenK/v2/` (novi `gridInvariants.ts` uvozi samo `dates.ts`/`types.ts`); 10K v1 i druge distance nepromenjeni. Fixture-i regresije prema 49ad476 (`segment02b.plan-hashes-49ad476.json`, `segment02b.regression-exceptions.json`) zamenjeni regresijom prema 21c03f1; `segment02.baseline.json` (49ad476) ostaje samo za proveru vrha iz D30.

## Odluke D26–D30 (pravilo | mesto | test)

| D   | pravilo                                                                                                                                                                                                                                                                  | mesto                                                                                                  | test (pada na 21c03f1)                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| D26 | bez rezultata / rezultat > 84 dana / VDOT < 30 → po osećaju; `easyPaceSecPerKm` 270–510 obavezan (`EASY_PACE_REQUIRED`, `EASY_PACE_OUT_OF_RANGE`); E = lagan ± 15 s; procena VDOT = VO2(lagan)/0,70, 25–60; `paceBasis`; RPE T 6–7, RP 7–8, I 8, R 8; prognoza/cilj null | `input.ts`; `paces.ts` `vdotFromEasyPace`/`feelPaces`; `policy.feel`; `workouts.ts` `rpeOf`; validator | feel.node D26 ×5; input.node D26; policy.node D26; feelGrid (11 880) — 10 palih            |
| D27 | test 5 km samo po osećaju: poslednja nedelja baze, dan Q1 (3 dana: umesto jedinog kvaliteta), u rasterećenju umesto kvaliteta rasterećenja; WU (D14) + 5 km + CD; u obimu, ne u dozi; D12 posle testa od stanja pre testa; glavna doza preskače test                     | `periodize.ts` `testWeekOf`; `week.ts`; `workouts.ts` `testWorkout`; `quality.ts` `advance`; validator | feel.node D27 ×5; periodize.node D27; feelGrid/beginnerGrid D27 — 8 palih                  |
| D28 | početnik: 3–4 dana, 10–18 ned, obim 15–30 / 18–35 km; uvod 2 ned; 1 kvalitet (D18 lestvica, bez I/R); prvi nivo (D16 ne važi); rast 5 % (1,0–2,0 km); vrh 1,3× / +10; dugi 90 min; WU/CD 15/10                                                                           | `policy.beginner` + `planRule` (jedina tabela); `input.ts`; `schedule.ts`; `quality.ts`; `week.ts`     | beginner.node ×9; beginnerGrid (3402) ×7 — 16 palih                                        |
| D29 | `runWalk: true` → `RUN_WALK_NOT_SUPPORTED` („10K plan traži neprekidno trčanje ≥ 30 min; preporuka: 5K plan (trčanje/hodanje)")                                                                                                                                          | `input.ts` (`policy.input.continuousRunMin`)                                                           | beginner.node D29; feelGrid/beginnerGrid uzorak; policy D1 — 4 pala                        |
| D30 | a) RP deonice ≥ 800 m (`rpRepMinM`), T ≥ 1000 m, 50 m bez podele na 100 m; `REP_MIN` po zoni. b) Uslov 8 trkačke: planirano + trka 10 km ≥ minimum                                                                                                                       | `workouts.ts` `splitsOf`; `validate.ts` (`REP_MIN`, `RACE_WEEK_SHORT`)                                 | quality.node, validate.node, week.node, grid regresija/brojke — 14 palih (a 8, b 3, oba 3) |

Verzija `10k-v2.3.0`; DECISIONS D1–D22, D22b, D23, D25–D30 (D1, D10, D15, D22b ažurirani). Nad kodom 21c03f1 (worktree, kopirani testovi, `testInputs.ts`, `gridInvariants.ts`, fixture-i) pada 58 od 162 testa tenK/v2: D26 10, D27 8, D28 16, D29 4, D30 14, verzija/DECISIONS/potpisi 6.

## Odstupanja (opreznije, bez novog broja; DECISIONS sa ulazom, napomena + upozorenje u planu)

| odluka         | odstupanje                                                                                                              | ulaz (primer)                                                                  | mreže (planova)              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------- |
| D27 ispred D5  | rasterećenje sa testom: dugi ≤ 0,8 × poslednji — najduži uz lagane ≥ 3 km (`TEST_DELOAD_LONG`)                          | 3 d, 12 ned, 20 km, 7:30: ned 4 cilj 18,0, test 8,3, dugi 8,0 → 6,6, lagan 3,1 | po osećaju 234; početnik 324 |
| D27 ispred D6  | rasterećenje sa testom neizvodljivo i uz kraći dugi → cilj naviše, najviše do ispod poslednje izgradnje (`WEEK_FITTED`) | početnik 3 d, 12 ned, 15 km, 7:30: ned 4 13,6 → 14,5 km (< 17,0)               | po osećaju 0; početnik 144   |
| D11 ispred D28 | početnik: nedelja izgradnje bez kvaliteta kad ni prvi nivo faze ne staje u plafon (`BUILD_NO_QUALITY`)                  | početnik 3 d, 15 km: vrh 19,5 km < 20 km za T 2,0 km                           | 756 (3 d 15 km, 4 d 18 km)   |

## Sabotaže (pokvareno → palo od 187 → vraćeno; md5 svih 146 fajlova `tenK/v2` + `docs/10k-v2` posle = pre)

- D26 procena VDOT-a: `eFractionSlow` umesto `eFractionFast` → 5 (feel.node ×2, feelGrid invarijanta `FEEL_VDOT` i bazna linija, beginnerGrid invarijanta).
- D27 mesto testa: prva umesto poslednje nedelje baze → 17 (feel.node ×5, periodize D27, feelGrid ×4, beginner.node ×2, beginnerGrid ×5).
- D28 uvod: `introWeeks` 0 → 10; D28 rast: `growth` 0,06 → 6 (beginner.node, beginnerGrid invarijante/brojke/bazna linija, policy).
- D30a: `rpRepMinM` 1000 → 15 (quality.node ×3, validate D30a, policy, grid ponavljanja/brojke/bazna linija/regresija ×3, feelGrid ×2, beginnerGrid ×2).

## Komande i rezultati (iz `web/`)

- Tokom rada: `npx vitest run --project node src/domain/generators/tenK/v2 src/domain/generators/architecture src/domain/generators/tenK/isolation` → 17 fajlova, 187 testova (tenK/v2: 15 fajlova, 162; bilo 11 / 124); ≈ 95 s.
- Jednom pre commita: `npx tsc -p tsconfig.domain.json --noEmit` exit 0; `npx tsc -p tsconfig.oracle.json --noEmit` prvo exit 2 (`paces.node.test.ts:61`: zona segmenta sada uključuje `test`) i `npx eslint src/domain/generators/tenK/v2` prvo exit 1 (isti red, `no-unsafe-assignment`) → test preskače segment testa, ponovo oba exit 0; `npx prettier --check src/domain/generators/tenK/v2 ../docs/10k-v2` exit 0; `npm run check` exit 0 — typecheck, lint, format:check, 210 test fajlova, 2558 testova (bilo 206 / 2520). Posle upisa ovih rezultata ponovo samo `npx prettier --check` za izveštaj i STATUS.
- Primeri: `node docs/10k-v2/artifacts/segment-03/run.ts` dva puta → bajt-isti izlaz (sha1 17 fajlova jednak); `regression-21c03f1.ts` iz worktree-a 21c03f1 → `segment03.plan-hashes-21c03f1.json`.

## Regresija prema 21c03f1 (15 840 planova sa rezultatom; heš bez oznake verzije i novih polja sa podrazumevanom vrednošću)

| dana | isti | samo D30a | samo D30b | D30a + D30b | drugo | ponavljanja (ned) 21c03f1 → 03 | RACE_WEEK_SHORT |
| ---- | ---- | --------- | --------- | ----------- | ----- | ------------------------------ | --------------- |
| 3    | 1500 | 1134      | 6         | 0           | 0     | 1224 → 240                     | 6 → 0           |
| 4    | 3120 | 576       | 0         | 0           | 0     | 192 → 48                       | 0 → 0           |
| 5    | 3792 | 432       | 0         | 0           | 0     | 144 → 0                        | 0 → 0           |
| 6    | 5064 | 126       | 72        | 18          | 0     | 144 → 0                        | 90 → 0          |

- Prema brojevima iz D30: ponavljanja 240/48/0/0, vrh niži od 49ad476 258 → 12 (3 d, 30 km, VDOT 35, 17–18 ned: 35,6 → 35,2), RACE_WEEK_SHORT 96 → 0 — sve tačno kao kod organizatora; odbijanja 0, trkačka > taper 0, ned 1 ispod obima 330/660/264/264, DOSE_DROPPED 0/162/0/0, CAPACITY_LIMITED 828/1320/810/732 bez promene.
- Vrh cilja ≥ 21c03f1 u svih 15 840 (viši u 120 / 126 planova 3 / 4 dana); planirano niže samo `ROUNDING` 108 (3 dana, isti vrh cilja, ≤ 0,1 km, plan sa RP < 1000 m) — `segment03.regression-exceptions.json`. Ostali redovi bazne linije isti; nova bazna linija `segment03.baseline.json`.

## Mreže: 0 odbijanja, 0 grešaka validatora, determinističke, = bazne linije

- Sa rezultatom 15 840 (`segment03.baseline.json`), po osećaju 11 880 (`segment03-feel.baseline.json`), početnik 3402 (po osećaju 1944, sa rezultatom 1458; `segment03-beginner.baseline.json`).
- Invarijante (`gridInvariants.ts`, nezavisno od validatora, sve mreže): sve iz 02b + T ≥ 1000 m, RP ≥ 800 m; trkačka + 10 km ≥ minimum; po osećaju tačno 1 test (poslednja nedelja baze, dan Q1 ili dan kvaliteta rasterećenja), oznaka nedelje testa, E = lagan ± 15 s, procena VDOT nezavisnom formulom, RPE po zoni, bez prognoze/cilja; sa rezultatom 0 testova, `paceBasis` result, bez RPE; početnik: ned 1–2 bez kvaliteta i testa, ≤ 1 kvalitet nedeljno, bez I/R, rast ≤ max(5 %, 1,0) i ≤ 2,0 km, dugi ≤ 90 min, vrh ≤ min(1,3×, +10), WU/CD 15/10; trčanje/hodanje odbijeno (uzorak 297 + 171 ulaz).
- „Rast ≤ 5 %" je proveren kao pravilo D28 (min 1,0 km): kod starta < 20 km rast od 1,0 km je > 5 %.

| po osećaju: dana | planova | ned 1 ispod obima (105 min / udeo) | CAPACITY_LIMITED | ponavljanja (ned) | D25 | test u rasterećenju (dugi skraćen) | DOSE_DROPPED (udeo) |
| ---------------- | ------- | ---------------------------------- | ---------------- | ----------------- | --- | ---------------------------------- | ------------------- |
| 3                | 1980    | 396 / 0                            | 864              | 48 (RP 3,5)       | 0   | 540 (144)                          | 84 (0)              |
| 4                | 2772    | 660 / 132                          | 1350             | 36 (I 2,0)        | 78  | 756 (36)                           | 156 (6)             |
| 5                | 3168    | 396 / 0                            | 930              | 0                 | 78  | 864 (18)                           | 0                   |
| 6                | 3960    | 396 / 0                            | 846              | 0                 | 132 | 1080 (36)                          | 0                   |

| početnik: dana | planova | ned 1 ispod obima | CAPACITY_LIMITED | ponavljanja (ned) | D25 | BUILD_NO_QUALITY (nedelja) | test u rasterećenju (skraćen / naviše) | rasterećenje / taper bez kvaliteta |
| -------------- | ------- | ----------------- | ---------------- | ----------------- | --- | -------------------------- | -------------------------------------- | ---------------------------------- |
| 3              | 1512    | 0                 | 588              | 192 (RP 2,5)      | 0   | 378 (2670)                 | 288 (162 / 72)                         | 1200 / 774                         |
| 4              | 1890    | 0                 | 324              | 240 (RP 2,5)      | 0   | 378 (1050)                 | 360 (162 / 72)                         | 1116 / 378                         |

Vrh/start: po osećaju 1,229 / 1,215 / 1,261 / 1,238; početnik 1,229 / 1,281; sa rezultatom 1,259 / 1,25 / 1,279 / 1,25.

## Stalni uslovi (AGENTS.md)

| #   | uslov                            | stanje 03                                                                                                                                                |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | jedan vlasnik odluke, bez petlji | put tempa `input.ts`; tempo `paces.ts`; mesto testa `periodize.ts`; brojevi početnika `planRule`; cilj `volume.ts` (ista pretraga `fit10`, nova granica) |
| 2   | jedan plafon po zoni             | D11 nepromenjen; test nije doza (bez plafona); početnik bez kvaliteta umesto većeg plafona                                                               |
| 3   | WU/CD nisu pufer                 | WU/CD testa po D14; dugi rasterećenja sa testom skraćen, WU/CD ne                                                                                        |
| 4–5 | adaptacija, handoff              | nisu u segmentu; `construct(input, [])`; rezultat testa čeka segment 04                                                                                  |
| 6   | policyId/Version, faza nedelje   | `10k-v2` / `10k-v2.3.0`; `paceBasis`; oznaka nedelje testa iz `periodize`; validator `PACE_BASIS`, `TEST`                                                |
| 7   | nula uvoza van foldera           | isolation.node + architecture/isolation testovi zeleni, bez novih izuzetaka                                                                              |
| 8   | upotrebljivost                   | trkačka + trka ≥ minimum (D30b); lagan ≥ 3 km i dugi ≥ lagan i u rasterećenju sa testom; ned 1–2 početnika bez kvaliteta                                 |

## feel-d4-30km-e6:00-12w (4 d uto/čet/sub/ned, 30 km, lagan 6:00; procena VDOT 41,0; E 5:45–6:15; orijentir T 5:00, I 4:36, R 4:20, RP 4:54; WU/CD 15/10)

| ned       | faza         | km cilj/plan       | kvalitet (RPE)                                                         | dugi               | lagani              | napomena                          |
| --------- | ------------ | ------------------ | ---------------------------------------------------------------------- | ------------------ | ------------------- | --------------------------------- |
| 1 / 2 / 3 | baza         | 30,0 / 31,8 / 33,7 | R 6 × 200, 4 × 300, 8 × 200 m (8) + T 2,0 / 2,5 / 3,0 kont. (6–7)      | 9,9 / 10,4 / 11,1  | sub 7,6 / 8,5 / 8,3 | —                                 |
| 4         | baza         | 27,0               | čet: test 5 km kontrolisano maksimalno                                 | 8,8                | uto 4,5, sub 4,5    | rasterećenje + test (D27)         |
| 5 / 6 / 7 | razvoj       | 35,7 / 37,8 / 40,1 | I 2 × 1000, 3 × 800, 3 × 1000 m (8) + T 3 × 1000, 3 × 1200, 4 × 1000 m | 11,7 / 12,4 / 13,2 | 9,7 / 9,6 / 9,7     | I posle testa: početni nivo (D16) |
| 8 / 10    | specifično   | 42,0               | RP 3 × 1000, 4 × 1000 m (7–8) + T 2 × 2000 m, 4,0 kont.                | 13,8               | 12,4 / 11,4         | 9: rasterećenje T 2 × 1200 m      |
| 11 / 12   | taper / trka | 31,5 / 16,1        | RP 2 × 1200 + T 2 × 1200 m / oštrenje RP 2 × 1000 m (čet)              | 10,3 / —           | 7,7 / 5,8 + 3,9*    | trka ned (van obima)              |

## beg-d3-15km-e7:30-12w (početnik, 3 d uto/čet/ned, 15 km, lagan 7:30; procena VDOT 30,8; WU/CD 15/10; vrh 19,5 km)

| ned              | faza                 | km cilj/plan        | kvalitet                            | dugi            | lagani (uto + čet)                | napomena                                             |
| ---------------- | -------------------- | ------------------- | ----------------------------------- | --------------- | --------------------------------- | ---------------------------------------------------- |
| 1 / 2            | baza                 | 15,0 / 16,0         | — (uvod D28)                        | 6,7 / 7,2       | 4,2 + 4,1 / 4,4 + 4,4             | —                                                    |
| 3                | baza                 | 17,0                | — (T 2,0 km > plafon 1,7 km)        | 7,6             | 4,7 + 4,7                         | BUILD_NO_QUALITY                                     |
| 4                | baza                 | 14,5 (pravilo 13,6) | čet: test 5 km                      | 3,1             | uto 3,1                           | rasterećenje + test; cilj naviše, dugi skraćen (D27) |
| 5 / 6 / 7, 8, 10 | razvoj/spec.         | 18,0 / 19,0 / 19,5  | — (T cruise / RP ne staju u plafon) | 8,1 / 8,5 / 8,7 | 5,0 + 4,9 / 5,3 + 5,2 / 5,4 + 5,4 | BUILD_NO_QUALITY                                     |
| 9 / 11 / 12      | spec. / taper / trka | 15,6 / 14,6 / 8,0   | — / — / bez oštrenja                | 6,9 / 6,5 / —   | 4,4 + 4,3 / 4,1 + 4,0 / 4,0 + 4,0 | DELOAD_NO_QUALITY, TAPER_NO_QUALITY; trka ned        |

## Odluke

- D26–D30 u DECISIONS (`policy.ts`, `10k-v2.3.0`); brojke D30 iz simulacije organizatora ponovljene i zakucane testom.
- Tumačenja bez novog broja: u rasterećenju test stoji na danu kvaliteta rasterećenja (T slot: Q2 kod 4–6 dana); lagan tempo uz pouzdan rezultat se ne koristi; prognoza 10K plana po osećaju služi samo za trajanje segmenta trke (procena); test bez RPE broja („kontrolisano maksimalno"); 4 dana početnika = šablon D18 (jedan kvalitet nesusedan dugom); rast početnika proverava pravilo 5 % sa min 1,0 km; obim iznad opsega početnika → `WEEKLY_KM_TOO_HIGH` (plan bez oznake početnika); poruka CAPACITY_LIMITED početnika preporučuje samo 3–4 dana; D30b: trkačka ispod minimuma ostaje upozorenje (nedelja je zadata, D15), sa trkom u zbiru se u mrežama ne javlja.
- Regresioni heš: `planHashes21` uklanja oznaku verzije i nova polja sa podrazumevanom vrednošću (`paceBasis` result, `experience` regular, `easyPaceSecPerKm` null); D30b = isti heš bez `RACE_WEEK_SHORT`.

## Preostali problemi

- Početnik malog obima: 3 d 15 km i 4 d 18 km bez kvaliteta u delu ili celoj izgradnji (D11 10 % < T 2,0 / RP 2,4 km), taper bez kvaliteta; 3 d 15 km rasterećenje sa testom ima dugi 3,1 km. Trenerska odluka: plafon početnika, T umesto RP u specifičnoj fazi ili test van rasterećenja.
- Dan testa duži (km) od dugog iste nedelje u 1812 / 11 880 planova po osećaju i 798 / 1944 početnika (test nije kvalitet, D25 ga ne broji).
- Po osećaju, 4 dana, sporo lagano (30 km / 8:30, 40 km / 7:30): ned 1 ispod obima zbog udela 33 % (132), DOSE_DROPPED uz udeo (6) — udeo dugog 4 dana (D17) bez merenja.
- Ponavljanje slota: sa rezultatom 240 / 48; po osećaju 48 / 36; početnik 192 / 240 (RP 2,5 / 3,5 km imaju jednu strukturu; I 2,0 km).
- Spor lagan tempo (≥ 7:30, procena VDOT ≤ 30,8): RP ≈ T po modelu (10K > 60 min; 8:30 → T 7:08, RP 7:10); orijentir brzih zona bez merenja, čeka test i adaptaciju (04).
- Nasleđeno: D25 (594 plana sa rezultatom), udeli zona (D2), heuristike D16/D17/D26/D28 bez merenja na podacima.
