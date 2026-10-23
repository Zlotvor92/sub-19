# 10K v2 — Segment 03b: početnik — kvalitet i pri malom obimu, bez testa (10k-v2.3.1)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `81bd351`. Menjano samo `web/src/domain/generators/tenK/v2/**` i `docs/10k-v2/**` (novo `artifacts/segment-03b/`; stari artifacts netaknuti). Nula uvoza van `tenK/v2/`; 10K v1 i druge distance nepromenjeni. Bazna linija početnika `segment03-beginner.baseline.json` zamenjena sa `segment03b-beginner.baseline.json` (10k-v2.3.1); bazne linije R i F (10k-v2.3.0) važe bez izmene.

## Izmene (pravilo | mesto | test)

| D   | pravilo                                                                                                                                                                                   | mesto                                                                                                  | test (pada na 81bd351)                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| D31 | lestvica T kont. početnika [1,5; 2,0; …] (`beginner.tFirstKm`); redovna lestvica i D16 bez promene                                                                                        | `policy.ts`; `workouts.ts` `ladderLevels(ladder, beginner)`                                            | beginner.node lestvica, „D16 ne važi" (T 1,5); policy D28                                  |
| D31 | prvi nivo lestvice faze ne staje u plafon → T kont. (najviši nivo početnika koji staje, po D12); bez kvaliteta samo kad ni 1,5 km ne staje; T kont. posle T cruise nosi dozu              | `quality.ts` `buildLadder`, `pickBuild`, `carries`; napomena `week.ts`                                 | beginner.node 3 d 15 km, 4 d 18 km; beginnerGrid invarijante, D31 ×2, brojke, bazna linija |
| D31 | rasterećenje T ≈ 60 % poslednje T doze, min 1,5 km; taper RP po D7, inače T kont. ≈ 60 % (min 1,5)                                                                                        | `quality.ts` `pickDeload`, `pickTaper` (stanje `t`); `generate.ts` RP doza tapera samo zona RP         | beginner.node 3 d / 4 d; beginnerGrid `BEGINNER_TAPER`, deload invarijanta                 |
| D31 | validator: tip/lestvica Q1 početnika po fazi uz nezavisnu proveru plafona; `BUILD_NO_QUALITY` samo kad 1,5 km ne staje; rasterećenje/taper početnika; izuzetak `BASE_PLATEAU` za T 1,5 km | `validate.ts` (`PHASE_QUALITY`, `BUILD_NO_QUALITY`, `BASE_PLATEAU`, `DELOAD_CONTENT`, `TAPER_QUALITY`) | beginner.node „validator hvata" ×2 (D31), odstupanje                                       |
| D32 | početnik bez testa i po osećaju; napomena plana; nestaju `TEST_DELOAD_LONG` i cilj naviše zbog testa                                                                                      | `policy.ts` `planRule.feelTest`; `generate.ts` (`periodize`, napomena); `validate.ts` `TEST`           | beginner.node D32 ×2, „osnova tempa"; beginnerGrid D32                                     |

Verzija `10k-v2.3.1`; DECISIONS D1–D22, D22b, D23, D25–D32 (D27, D28 ažurirani). Nad kodom 81bd351 (worktree, kopirani testovi, `testInputs.ts`, `gridInvariants.ts`, fixture-i) pada 19 od 171 testa tenK/v2: D31 6 + D32 3 (beginner.node), mreža početnika 6, verzija/DECISIONS/`planRule` 4; regresija R i F prolazi (fixture je iz 81bd351).

**Odstupanje (opreznije, bez novog broja; DECISIONS D31 sa ulazom):** T 1,5 km nema drugu strukturu (deonice ≥ 1000 m, D10), pa kad 2,0 km ne staje slot ponavlja 1,5 km uz napomenu i u bazi — izuzetak od „baza bez platoa" (D22) samo za tu dozu. Ulaz: početnik 3 d, 18 ned, 15 km, 7:30 — baza ned 3 / 5 / 6 T 1,5 km (plafon 1,7 / 1,8 / 1,9). Mreža: 2436 ponovljenih nedelja T 1,5 km (450 planova 3 d; u bazi 252).

## Sabotaže (pokvareno → palo od 196 → vraćeno; md5 svih 152 fajla `tenK/v2` + `docs/10k-v2` posle = pre)

- D31 bez nivoa 1,5 (`ladderLevels` bez `tFirstKm`) → 16 (beginner.node ×10, beginnerGrid ×6: odbijanja, invarijante, D31 ×2, brojke, bazna linija).
- D32 test vraćen (`periodize(…, feel)`) → 13 (beginner.node ×9, beginnerGrid ×4: validator odbija planove sa testom).

## Komande i rezultati (iz `web/`)

- Tokom rada: `npx vitest run --project node src/domain/generators/tenK/v2 src/domain/generators/architecture src/domain/generators/tenK/isolation` → 17 fajlova, 196 testova (tenK/v2: 15 / 171; bilo 162); ≈ 122 s.
- Jednom pre commita: `npx tsc -p tsconfig.domain.json --noEmit` exit 0; `npx tsc -p tsconfig.oracle.json --noEmit` exit 0; `npx eslint src/domain/generators/tenK/v2` exit 0; `npx prettier --check src/domain/generators/tenK/v2 ../docs/10k-v2` exit 0; `npm run check` exit 0 — typecheck, lint, format:check, 210 test fajlova, 2567 testova (bilo 210 / 2558). Posle upisa ovih rezultata ponovo samo `npx prettier --check` za izveštaj i STATUS.
- Primeri: `node docs/10k-v2/artifacts/segment-03b/run.ts` dva puta → bajt-isti izlaz (sha1 11 fajlova); `regression-81bd351.ts` iz worktree-a 81bd351 → `segment03b.plan-hashes-81bd351.json` (27 720 heševa) i `compare-81bd351.json`.

## Regresija: R i F bajt-isti kao 81bd351

- Sa rezultatom 15 840 i po osećaju 11 880: heš celog rezultata (`planHash81`: JSON bez oznake verzije) = 81bd351 za svaki plan; testovi u `grid.node` / `feelGrid.node`, razlika 0. Bazne linije `segment03.baseline.json` / `segment03-feel.baseline.json`, regresija prema 21c03f1 i 49ad476 zelene bez izmene.

## Mreža početnika 3402 (0 odbijanja, 0 grešaka, deterministička, = bazna linija): 81bd351 → 03b

| brojka (3 dana / 4 dana)                                 | 81bd351                    | 03b                                                         |
| -------------------------------------------------------- | -------------------------- | ----------------------------------------------------------- |
| nedelje izgradnje bez kvaliteta posle uvoda (planova)    | 2670 (378) / 1050 (378)    | 0 / 0                                                       |
| planovi bez ijednog kvaliteta od ned 3 do trke           | 378 / 0                    | 0 / 0                                                       |
| nedelje T kont. umesto lestvice faze (D31)               | 0 / 0                      | 2184 / 1050                                                 |
| rasterećenje bez kvaliteta (nedelja)                     | 1200 / 1116                | 462 / 192                                                   |
| taper bez kvaliteta / taper T 1,5 km (planova)           | 774 / 0 i 378 / 0          | 378 / 432 i 0 / 378                                         |
| testovi; dugi rasterećenja < 4 km; cilj naviše (planova) | 864, 72, 72 / 1080, 90, 72 | 0, 0, 0 / 0, 0, 0 (najkraći dugi rasterećenja 6,0 / 4,9 km) |
| ponavljanja (nedelja)                                    | 192 / 240 (RP 2,5)         | 2580 (T 1,5: 2436, RP 2,5: 144) / 168 (RP 2,5)              |
| CAPACITY_LIMITED                                         | 588 / 324                  | 588 / 324                                                   |
| vrh/start                                                | 1,229 / 1,281              | 1,227 / 1,280                                               |

Vrh niži u 72 / 42 plana: 102 po osećaju (vrh 81bd351 je bio u nedelji testa, dan testa duži od kvalitetnog; do 1,7 km: 4 d, 35 km, 8:30, 10 ned 38,5 → 36,8), 12 sa rezultatom (4 d, 30–35 km, VDOT 30: start T 1,5 umesto 2,0 → kraći kvalitetni dan; do 0,6 km). U 36 od njih taper RP 2 × 1000 m → T 1,5 km. Invarijante iz 03 (≤ 1 kvalitet, bez I/R, uvod, rast, vrh, dugi ≤ 90 min) i nove (`BEGINNER_NO_QUALITY`, `BEGINNER_PHASE_LADDER`, `BEGINNER_T_FALLBACK`: doza = najviši nivo početnika ≤ plafon, `BEGINNER_TAPER`, `LONG_MIN`, 0 testova) bez prekršaja.

## beg-d3-15km-e7:30-12w (3 d uto/čet/ned, 15 km, lagan 7:30; vrh 19,5 km): 03 → 03b

| ned       | faza                | km cilj (03 → 03b) | kvalitet 03               | kvalitet 03b                                 | dugi 03 → 03b   |
| --------- | ------------------- | ------------------ | ------------------------- | -------------------------------------------- | --------------- |
| 1 / 2     | baza (uvod)         | 15,0 / 16,0        | —                         | —                                            | 6,7 / 7,2       |
| 3         | baza                | 17,0               | — (T 2,0 > plafon 1,7)    | T 1,5 km kont.                               | 7,6             |
| 4         | baza, rasterećenje  | 14,5 → 13,6        | test 5 km (cilj naviše)   | — (T 1,5 > plafon 1,36)                      | 3,1 → 6,0       |
| 5 / 6 / 7 | razvoj              | 18,0 / 19,0 / 19,5 | — (T cruise 2,0 ne staje) | T 1,5 km kont. (ponovljen)                   | 8,1 / 8,5 / 8,7 |
| 8 / 10    | specifično          | 19,5               | — (RP 2,4 ne staje)       | T 1,5 km kont. (ponovljen)                   | 8,7             |
| 9         | specifično, rasteć. | 15,6               | —                         | T 1,5 km (≈ 60 % → min 1,5)                  | 6,9             |
| 11 / 12   | taper / trka        | 14,6 / 8,0         | — / bez oštrenja          | — (ni RP 2,0 ni T 1,5 ≤ 1,46) / bez oštrenja | 6,5 / —         |

Nedelje 3 … taper sa kvalitetom 0 / 9 → 7 / 9; ostali primeri i tabela poređenja: `artifacts/segment-03b/plans.md` (beg-d4-18km 1 / 7 → 7 / 7, taper T 1,5; beg-d3-20km 9 / 11 → 11 / 11; beg-d4-25km-result: T 1,5 km umesto 2,0 km na startu (ned 3) i u rasterećenjima ned 4, 8, 11, ostalo isto).

## Stalni uslovi (AGENTS.md)

| #   | uslov                            | stanje 03b                                                                                                                                                                                 |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | jedan vlasnik odluke, bez petlji | lestvica Q1 početnika `quality.ts buildLadder`; doza rasterećenja/tapera `pickDeload`/`pickTaper`; 1,5 km samo `policy.beginner.tFirstKm`; test `planRule.feelTest`; ista pretraga `fit10` |
| 2   | jedan plafon po zoni             | D11 nepromenjen; 1,5 km je nivo lestvice, ne drugi limit                                                                                                                                   |
| 3   | WU/CD nisu pufer                 | WU/CD početnika 15/10 bez promene; obim ostaje u laganim danima                                                                                                                            |
| 4–5 | adaptacija, handoff              | nisu u segmentu; rezultat trke/parkruna početnika čeka segment 04                                                                                                                          |
| 6   | policyId/Version, faza nedelje   | `10k-v2` / `10k-v2.3.1`; faza iz `periodize`; početnik bez oznake testa (validator `TEST`)                                                                                                 |
| 7   | nula uvoza van foldera           | isolation.node + architecture/isolation testovi zeleni, bez novih izuzetaka                                                                                                                |
| 8   | upotrebljivost                   | 0 nedelja izgradnje i 0 planova bez kvaliteta; dugi rasterećenja ≥ 4,9 km, ≥ 3 km i ≥ lagan (`LONG_MIN`, `LONG_GE_EASY`); nema testa ≈ pola nedelje                                        |

## Odluke

- D31, D32 u DECISIONS (`policy.ts`, `10k-v2.3.1`); D27 i D28 upućuju na njih; brojke organizatora (3720, 378, 162) ponovljene na 81bd351.
- Tumačenja bez novog broja: „najviši nivo lestvice početnika koji staje" ostvaren pravilom D12 (≤ 1 nivo nedeljno; ista doza druge strukture 2,0 km ↔ 2 × 1000 m; T 1,5 km ponovljen) — invarijanta `BEGINNER_T_FALLBACK` potvrđuje dozu u svih 3234 nedelja; „poslednja T doza" = poslednja doza u zoni T iz ne-rasteretne nedelje izgradnje; rasterećenje u razvoju/specifičnoj fazi 1,5 km kontinuirano pod lestvicom T cruise (D5, T cruise nema nivo 1,5 km, D10); T kont. posle T cruise ≥ poslednje T (`carries`, D12); T tapera ne daje oštrenje (oštrenje ≤ RP doza tapera, D8); D28 start = prvi nivo → svi početnici počinju od T 1,5 km.

## Preostali problemi

- 3 d 15 km (378 planova): T 1,5 km ponovljen kroz celu izgradnju (2,0 km traži cilj ≥ 20 km, vrh 19,5), rasterećenje ned 4 (13,6 km) i taper (14,6 km) bez kvaliteta, bez oštrenja. Trenerska odluka: druga struktura za 1,5 km ili veći vrh početnika.
- Taper sa T 1,5 km (810 planova) i bez kvaliteta (378): trkačka nedelja bez oštrenja (D8).
- Vrh niži u 114 planova (kapacitet: dugi 90 min); bez testa tempo T/RP početnika po osećaju ostaje procena do rezultata trke/parkruna (04).
- Nasleđeno iz 03: dan testa duži od dugog (1812 redovnih po osećaju), 4 dana po osećaju udeo 33 %, ponavljanje RP 2,5 / I 2,0, D25, RP ≈ T pri sporom laganom tempu, heuristike bez merenja.
