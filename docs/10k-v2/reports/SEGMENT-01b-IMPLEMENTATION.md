# 10K v2 — Segment 01b: kapacitet 4 dana i ispravke (10k-v2.1.0)

Polazni SHA `26846d7`, ista grana. Menjano samo `web/src/domain/generators/tenK/v2/**` i `docs/10k-v2/**` (`artifacts/segment-01/` netaknut); nula uvoza van `tenK/v2/`, 10K v1 i druge distance nepromenjeni.

## Izmene (pravilo | mesto | test)

| odluka    | pravilo                                                                                                                             | mesto                                                         | test                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| D14       | WU/CD po pojasu trenutnog obima, ceo plan: < 35 km 15/10, 35–44,9 km 20/15, ≥ 45 km 25/15 min; I oporavak naniže na 15 s (max 4:00) | `workouts.ts` `warmupCooldown`, `recoveryOf`; validator       | week.node D14, validate.node (WU 15 pri 40 km), policy |
| D16       | početni nivo = najviši nivo ≤ 60 % plafona zone (D11), min prvi nivo; I u razvoju; RP ≥ max(D16, poslednje I)                       | `quality.ts` `startLevel`/`pickSlot`; validator `START_LEVEL` | quality.node D16 ×2, validate.node                     |
| D8        | oštrenje 3 × 1000 m ako je RP doza tapera ≥ 3,0 km, inače 2 × 1000 m (oštrenje ≤ RP tapera)                                         | `week.ts` `sharpenerReps`; validator (nezavisno)              | week.node D8, validate.node                            |
| D10       | T deonice ≥ 1000 m (nema podele → kontinuirano); I do 6 jednakih 800–1200 m ili piramida 1200 + 1000 + 800 m                        | `workouts.ts` `structuresForDose`; `Structure` `pyramid`      | quality.node D10 ×2 (strukture; sve T ≥ 1000 m)        |
| D6        | `CAPACITY_LIMITED`: „4 dana ne nose ovaj obim uz dugi ≤ 105 min; preporuka 5–6 dana (od segmenta 02)"                               | `volume.ts` `CAPACITY_MESSAGE` → generate, validate           | volume.node, validate.node, policy                     |
| D12       | D11 ispred D12 upisano kao usvojena odluka (ne odstupanje)                                                                          | `policy.ts` DECISIONS                                         | policy.node                                            |
| kapacitet | ned 1 < trenutni obim samo kad je dugi ned 1 na 105 min; pada na 26846d7 (1620 planova)                                             | —                                                             | grid.node (novi)                                       |
| regresija | vrh cilj/planirano ≥ 26846d7; izuzeci sa razlogom u `segment01b.regression-exceptions.json`                                         | `segment01.baseline-26846d7.json`                             | grid.node (novi); nova bazna linija = tačno            |

## Sabotaže (pokvareno → palo → vraćeno; diff prema kopiji prazan, ponovo 121/121)

- D14 pojas: `fromKm < obim` umesto `≤` (35 i 45 km u nižem pojasu) → 11 testova (grid 0 grešaka, ned 1, bazna linija, regresija, volume ×3, uzorci).
- D16: početni nivo do 100 % plafona umesto 60 % → 54 testa (quality D16; `START_LEVEL` obara planove: validate.node, grid).
- D8: 3 × 1000 m tek za RP tapera > 3,0 km → 13 testova (week.node D8, validator `RACE_SHARPENER`, grid).

## Komande i rezultati (iz web/)

- Tokom rada: `npx vitest run --project node src/domain/generators/tenK/v2 src/domain/generators/architecture src/domain/generators/tenK/isolation` → 13 fajlova, 121 test (tenK/v2: 11 fajlova, 96 testova).
- Jednom pre commita: `npx tsc -p tsconfig.domain.json --noEmit` exit 0; `npx tsc -p tsconfig.oracle.json --noEmit` prvo exit 2 (`week.node.test.ts:102` `reps[k]++` uz `noUncheckedIndexedAccess`) → ispravljeno, ponovo exit 0; `npx eslint src/domain/generators/tenK/v2` exit 0; `npx prettier --check src/domain/generators/tenK/v2 ../docs/10k-v2` exit 0; `npm run check` exit 0 — 206 test fajlova, 2492 testa (bilo 2485).
- Primeri: `node docs/10k-v2/artifacts/segment-01b/run.ts` dva puta → bajt-isti izlaz (sha1 svih fajlova jednak).

## Brojke pre → posle (mreža 3024: 0 odbijanja, 0 grešaka, deterministička; van mreže 42 687 = VDOT 30–80 × 25–55 km × 10–18 ned × A/B/C)

- Ned 1 ispod trenutnog obima: **1620 → 540** planova; svih 540 sa dugim ned 1 na 105 min (pre: 0 od 1620). Najveći pad 24,6 → 15,8 km (`10w-55km-v30-A-sat`).
- Nedelje sa lagan max = dugi: 8928 → 7992 od 39 312 (bez trkačke). Izvodljiv cilj: 8496 → 7842 od 42 336 nedelja; `CAPACITY_LIMITED` 1914 → 1104 planova.
- `DOSE_DROPPED`: van mreže 867 → 1044 planova (867 → 1152 upozorenja), 0 odbijanja; u mreži 0 → 162 plana (45–55 km uz VDOT 35/45, 30 km uz VDOT 30).
- Regresija vrha prema 26846d7: 600 izuzetaka, 0 bez razloga — `PLANNED_ROUNDING` 564 (isti vrh cilja, planirano niže ≤ 0,07 km zbog zaokruženja lakog dana) i `T_REPS_1000` 36 (30 km, VDOT 30, 13–18 ned: vrh 40,2 → 40,0 km).
- Ponavljanje slota: 954 → 1068 nedelja, sve u bazi (T 2,5: 624, T 3,5: 96, R 1,6: 192, R 2,0: 156); piramida: 234 treninga; oštrenje 3 × 1000 m: 3024 → 840, 2 × 1000 m: 0 → 2184.

| obim (km; ćelija = 54 plana) | 25, 30 | 35     | 40    | 45     | 50          | 55          |
| ---------------------------- | ------ | ------ | ----- | ------ | ----------- | ----------- |
| VDOT ispod obima pre         | —      | 30, 35 | 30–50 | 30–60  | svi (30–70) | svi (30–70) |
| VDOT ispod obima posle       | —      | —      | 30    | 30, 35 | 30–40       | 30–45       |

## Poređenje primera 01 → 01b (`artifacts/segment-01b/plans.md`)

| primer                | ned 1 km    | vrh         | najduži dugi | lagan max ned 1 |
| --------------------- | ----------- | ----------- | ------------ | --------------- |
| dev-01                | 25,0 → 25,0 | 35,0 → 35,0 | 11,5 → 11,5  | 5,6 → 5,6       |
| dev-02                | 30,0 → 30,0 | 42,0 → 42,0 | 13,8 → 13,8  | 8,4 → 8,4       |
| dev-03                | 37,6 → 40,0 | 53,2 → 55,0 | 17,2 → 17,2  | 12,4 → 10,6     |
| dev-04                | 38,8 → 45,0 | 55,9 → 60,0 | 18,0 → 18,0  | 12,8 → 11,1     |
| dev-05                | 41,9 → 55,0 | 60,0 → 60,0 | 19,8 → 19,8  | 13,8 → 14,8     |
| dev-06                | 35,0 → 35,0 | 49,0 → 49,0 | 16,1 → 16,1  | 10,9 → 7,6      |
| edge-25km-10w-vdot30  | 25,0 → 25,0 | 35,0 → 35,0 | 11,5 → 11,5  | 6,4 → 6,4       |
| edge-55km-18w-vdot30  | 30,4 → 39,2 | 40,2 → 43,5 | 12,5 → 12,5  | 10,0 → 12,5     |
| edge-55km-vdot75      | 50,1 → 55,0 | 60,0 → 60,0 | 19,8 → 19,8  | 16,5 → 10,3     |
| edge-goal-unrealistic | 35,0 → 35,0 | 48,4 → 49,0 | 15,5 → 15,5  | 11,5 → 8,4      |

## Stalni uslovi (AGENTS.md)

| #   | uslov                            | stanje 01b                                                                                                                          |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | jedan vlasnik odluke, bez petlji | WU/CD `workouts.ts`, doza `quality.ts` (sa D16), obim `volume.ts`, dužine `lengths.ts`; bez nove petlje; validator samo prijavljuje |
| 2   | jedan plafon po zoni             | D11 nepromenjen; D16 bira start kao 60 % istog plafona, nije drugi limit                                                            |
| 3   | WU/CD nisu pufer                 | pojas iz ulaza, isti za ceo plan; manjak ide u lagane dane ili `WEEK_FITTED`                                                        |
| 4–5 | adaptacija, handoff              | nisu u segmentu; `construct(input, [])` nepromenjen                                                                                 |
| 6   | policyId/Version, faza nedelje   | `10k-v2` / `10k-v2.1.0`; periodize.node, validator `POLICY_STAMP`/`PHASES`                                                          |
| 7   | nula uvoza van foldera           | isolation.node (bez novih izuzetaka; ni type-only)                                                                                  |
| 8   | upotrebljivost                   | validator obara prazan trening, dugi < lagan, < 12 km; novi test: ned 1 < obim samo zbog 105 min                                    |

## dev-05 (10 km 38:00 → VDOT 55,2; 55 km; 18 ned; uto/čet/sub/ned; WU/CD 25/15 min)

| ned             | faza         | cilj 01 → 01b                   | kvalitet 01b                                                                           | dugi 01 → 01b                   | lagan max 01 → 01b                        |
| --------------- | ------------ | ------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------- |
| 1 / 2 / 3       | baza         | 41,9/44,4/47,1 → 55,0/58,0/60,0 | R 8 × 200, 6 × 300, 10 × 200 m + T 3,0 / 3,5 / 4,0 km kont.                            | 13,8/14,6/15,5 → 18,1/19,1/19,8 | 13,8/14,2/15,2 → 14,8/16,0/16,3           |
| 5 / 6           | baza         | 49,9/52,9 → 60,0                | R 8 × 300, 12 × 200 m + T 4,5 / 5,0 km kont.                                           | 16,4/17,4 → 19,8                | 16,1/16,9 → 15,1/14,5                     |
| 7 / 9 / 10 / 11 | razvoj       | 51,0/54,0/57,0/60,0 → 60,0      | I 3 × 800, 3 × 1000, 3 × 1200, 4 × 1000 m + T 5 × 1000, 4 × 1500, 3 × 2000, 2 × 3000 m | 16,8/17,8/18,8/19,8 → 19,8      | 16,8/17,4/17,9/18,3 → 14,8/13,1/12,5/11,8 |
| 13 / 14 / 16    | spec.        | 60,0 → 60,0                     | RP 4 × 1000, 3 × 1500, 5 × 1000 m + T 6,0 km kont., 2 × 3000 m, 6,0 km kont.           | 19,8 → 19,8                     | 19,1/18,8/18,3 → 13,5/12,8/12,3           |
| 4 / 8 / 12 / 15 | rasterećenje | 37,7/40,8/48,0/48,0 → 48,0      | T 2,0 km kont., 3 × 1000, 3 × 1200, 3 × 1200 m                                         | 12,4/13,4/15,8/15,8 → 15,8      | 9,2/9,9/11,6/11,6 → 11,1/10,4/10,1/10,1   |
| 17              | taper        | 45,0 → 45,0                     | RP 3 × 1000 m + T 3 × 1200 m                                                           | 14,8 → 14,8                     | 12,7 → 6,7                                |
| 18              | trka         | 20,4 → 23,4                     | oštrenje RP 3 × 1000 m (RP doza tapera 3,0 km)                                         | —                               | 7,0 → 7,0                                 |

## Odluke

- D6/D8/D10/D14/D16 i D11 ispred D12 upisani u `DECISIONS` (policy.ts), verzija `10k-v2.1.0`; D1–D16 zakucani u policy.node.
- Tumačenja bez novog broja: pojas WU/CD po obimu zaokruženom na 0,1 km; T cruise posle T kontinuiranog nije „nova zona" (samo D12); prag oštrenja 3,0 km = puna doza oštrenja (3 × 1000 m), bez zasebnog broja; piramida = samo primer iz odluke (1200 + 1000 + 800 m = 3,0 km); WU/CD trke ostaju 15/10 (D8).
- Odstupanje (opreznije, DECISIONS D12): „baza bez platoa" ne važi kad T doza nema drugu strukturu (T 2,5 / 3,5 km uz deonice ≥ 1000 m) — ponavljanje sa napomenom (D10) umesto skoka obima. Ulaz: 10 ned, 25 km, VDOT 30, uto/čet/sub/ned (ned 3: cilj 28,1 km, T 3,0 km > plafon 2,8 km). Bez toga 528/3024 planova odbijeno (`BASE_PLATEAU`).

## Preostali problemi

- 540 planova i dalje kreće ispod obima (dugi na 105 min: VDOT 30–45 uz 40–55 km) — rešenje 5–6 dana (segment 02).
- `CAPACITY_LIMITED` („uz dugi ≤ 105 min") je netačan za 60 planova (25 km/VDOT 30, 30 km/VDOT 35): tu spuštene nedelje seče 33 %, ne 105 min.
- D10 T ≥ 1000 m: T 2,5 / 3,5 km bez druge strukture → više ponavljanja u bazi, 36 planova sa vrhom −0,2 km, `DOSE_DROPPED` raste (mreža 0 → 162).
- Udeli zona (D2) i prognoza pri VDOT 30 i dalje bez merenja na podacima; 60 % plafona (D16) je heuristika bez izvora.
