# 10K v2 — Segment 02b: udeo dugog 3 dana, trkačka ≤ taper, RP struktura, upozorenje D25 (10k-v2.2.1)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `49ad476`. Menjano samo `web/src/domain/generators/tenK/v2/**` i `docs/10k-v2/**` (novo `artifacts/segment-02b/`; stari artifacts netaknuti). Nula uvoza van `tenK/v2/`; 10K v1 i druge distance nepromenjeni. Obrisani fixture-i regresije prema 53da370 (`segment01.baseline.json`, `segment02.plan-hashes-53da370.json`, `segment02.regression-exceptions.json`): zamenjuje ih regresija prema 49ad476 (u 02 su redovi 4 dana × 10–18 bili = 53da370, pa 126 izuzetaka D22b ispod važi i prema 53da370).

## Izmene (pravilo | mesto | test)

| odluka | pravilo                                                                                                                                  | mesto                                                                         | test (pada na 49ad476)                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| D17    | 3 dana `longMaxShare` 0,40 → 0,45 (DECISIONS: kvalitet < 20 % nedelje, dugi + lagan > 80 %)                                              | `policy.ts` `days[3]`                                                         | policy.node D17; week.node D13 (dugi = najduži dozvoljen); grid ned 1           |
| D22b   | RP druga struktura kao T: deonice ≥ 1000 m, 50 m kad nema podele na 100 m (2,5 = 2 × 1250; 3,5 = 2 × 1750); validator `REP_MIN` (T i RP) | `workouts.ts` `splitsOf`/`structuresForDose`; `validate.ts`                   | quality.node strukture i deonice; validate.node `REP_MIN`; grid invarijante     |
| D23    | lagan trkačke nedelje = min(35 min E, najkraći lagan tapera), kraći u km; `RACE_WEEK_EASY`, `RACE_WEEK_OVER_TAPER` (greške)              | `week.ts` `raceEasyWorkout`/`raceWeek`; `generate.ts`; `validate.ts`          | week.node D8+D20+D23; validate.node D23; grid D23 i invarijanta trkačka ≤ taper |
| D25    | upozorenje `LONG_SHORTER_THAN_QUALITY`: ne-rasteretna nedelja izgradnje, kvalitetni dan po trajanju > dugi; preporuka manje dana po D17  | `validate.ts`; `volume.ts` `fewerDaysAdvice`                                  | validate.node D25 (poruka, plan se ne menja); volume.node D25; grid `D25_EXACT` |
| fixt.  | regresija: `segment02.baseline.json` (49ad476) + `segment02b.plan-hashes-49ad476.json` (heš celog plana, heš bez trkačke, RP < 1000 m)   | `testInputs.ts` `planHashes49`; `artifacts/segment-02b/regression-49ad476.ts` | grid: vrh ≥ 49ad476 uz izuzetke, uzrok svakog promenjenog plana                 |

Verzija `10k-v2.2.1`; DECISIONS: D1–D22, D22b, D23, D25 (D24 nije dodeljen). Nova bazna linija `segment02b.baseline.json`; izuzeci vrha `segment02b.regression-exceptions.json`.

## Sabotaže (pokvareno → palo → vraćeno; md5 svih fajlova `tenK/v2` i `docs/10k-v2` posle = pre)

- D17: udeo 3 dana nazad 0,40 → 10 od 149 (policy D17, week D13, volume poruka, grid ned 1/invarijante/brojke/bazna linija/regresija ×2, D23 brojke).
- D22b: RP podela opet ≥ 100 m → 26 od 149 (validator `REP_MIN` obara planove: uzorci, quality strukture/deonice, grid 0 odbijanja, regresija).
- D23: trkačka uvek 35 min E → 27 od 149 (validator obara planove: week D23, validate D23, grid 0 odbijanja, D23, regresija).
- Novi testovi nad kodom 49ad476 (worktree, kopirani testovi, `testInputs.ts`, fixture-i) → 22 od 124 pada: D17 4, D22b 5, D23 3, D25 2, invarijante mreže (D22b/D23/D25) 1, verzija/DECISIONS 3, brojke/bazna linija/regresija ×2 4.

## Komande i rezultati (iz `web/`)

- Tokom rada: `npx vitest run --project node src/domain/generators/tenK/v2 src/domain/generators/architecture src/domain/generators/tenK/isolation` → 13 fajlova, 149 testova (tenK/v2: 11 fajlova, 124; bilo 118); ≈ 90 s.
- Jednom pre commita: `npx tsc -p tsconfig.domain.json --noEmit` exit 0; `npx tsc -p tsconfig.oracle.json --noEmit` exit 0; `npx eslint src/domain/generators/tenK/v2` exit 0; `npx prettier --check src/domain/generators/tenK/v2 ../docs/10k-v2` exit 0; `npm run check` exit 0 — typecheck, lint, format:check, 206 test fajlova, 2520 testova (bilo 2514), ≈ 10 min. Posle upisa ovih rezultata u izveštaj i STATUS ponovo samo `npx prettier --check` za ta dva fajla: exit 0.
- Primeri: `node docs/10k-v2/artifacts/segment-02b/run.ts` dva puta → bajt-isti izlaz (sha1 24 fajla jednak); `regression-49ad476.ts` iz worktree-a 49ad476 → heševi i `compare-49ad476.json`.

## Mreža 02 (15 840): 0 odbijanja, 0 grešaka validatora, deterministička, = `segment02b.baseline.json`

Invarijante sopstvenim testom (nezavisno od validatora): sve iz 02 + T i RP deonice ≥ 1000 m; trkačka (bez trke) ≤ taper; lagan trkačke = min(35 min E, najkraći lagan tapera); ned 1 ispod obima samo uz dugi na 105 min (i 3 dana); `LONG_SHORTER_THAN_QUALITY` tačno kad kvalitetni dan > dugi po trajanju, preporuka tačno kad red sa manje dana podržava obim. Van mreže: svi rasporedi 3–6 dana × 8/9/12/18 ned × 3 obima × VDOT 30/45/70 × sub/ned + gusto km korak 1 × VDOT 30–80 korak 2 (16 068 rešivih) i svaki dan dugog (7 056 rešivih) → 0 odbijanja, trkačka > taper 0 (49ad476: 658), T/RP < 1000 m 0.

| dana | ned 1 ispod obima (105 min / udeo) | trkačka > taper | ponavljanja (ned) | D25 planova | CAPACITY_LIMITED | RACE_WEEK_SHORT | lagan trkačke u km |
| ---- | ---------------------------------- | --------------- | ----------------- | ----------- | ---------------- | --------------- | ------------------ |
| 3    | 528 (132 / 396) → 330 (330 / 0)    | 0 → 0           | 216 → 1224        | 0 → 0       | 888 → 828        | 6 → 6           | 0 → 636            |
| 4    | 660 → 660 (660 / 0)                | 8 → 0           | 48 → 192          | 132 → 132   | 1320 → 1320      | 0 → 0           | 0 → 1428           |
| 5    | 264 → 264                          | 57 → 0          | 0 → 144           | 132 → 132   | 810 → 810        | 0 → 0           | 0 → 2004           |
| 6    | 264 → 264                          | 9 → 0           | 0 → 144           | 330 → 330   | 732 → 732        | 0 → 90          | 0 → 2538           |

DOSE_DROPPED 0 / 162 / 0 / 0 (bez promene); vrh/start 1,258 / 1,25 / 1,279 / 1,25 (3 dana bilo 1,257).

## Regresija prema 49ad476 po uzroku (heš bez oznake verzije, teksta CAPACITY_LIMITED i upozorenja D25)

| dana | isti | D17            | D22b | D23  | D22b + D23 | drugo |
| ---- | ---- | -------------- | ---- | ---- | ---------- | ----- |
| 3    | 132  | 2508 (sam 972) | —    | —    | —          | 0     |
| 4    | 1854 | —              | 414  | 1266 | 162        | 0     |
| 5    | 2112 | —              | 108  | 1680 | 324        | 0     |
| 6    | 2724 | —              | 18   | 2412 | 126        | 0     |

- 3 dana (2508 promenjenih): sa D22b markerom 900, sa D23 234, sa oba 402. Ablacija (svaka odluka sama nad 49ad476): D17 2508 planova (3 dana); D22b 1290 / 576 / 432 / 144; D23 354 / 1428 / 2004 / 2538 (samo trkačka nedelja).
- Vrh cilj/planirano ≥ 49ad476 u 15 546 planova; niži u 294, svaki sa proverenim razlogom: `D22b_CAPACITY` 258 (3 dana 132, 4 dana 126; CAPACITY_LIMITED i RP < 1000 m u 49ad476; vrh niži do 1,1 km) i `ROUNDING` 36 (3 dana; isti vrh cilja, planirano niže ≤ 0,06 km). Samo D17 (ablacija): nijedan vrh cilja niži.

## Primeri `docs/10k-v2/artifacts/segment-02b/` (02 → 02b, iz `plans.md`)

| primer          | ned 1 km (dugi)           | vrh km      | trkačka / taper km        | upozorenja 02b                   |
| --------------- | ------------------------- | ----------- | ------------------------- | -------------------------------- |
| d3-35km-v40-12w | 35,0 (14,0) → 35,0 (15,5) | 41,1 → 40,9 | 13,1 / 30,8 → 13,1 / 30,7 | WEEK_FITTED ×5, CAPACITY_LIMITED |
| d5-30km-v70-10w | 30,0 (7,6) → 30,0 (7,6)   | 42,0 → 42,0 | 34,1 / 31,5 → 17,5 / 31,5 | LONG_SHORTER_THAN_QUALITY        |
| d4-25km-v70-10w | 25,0 (5,6) → 25,0 (5,6)   | 35,0 → 35,0 | 22,7 / 26,3 → 17,2 / 26,3 | LONG_SHORTER_THAN_QUALITY        |
| d6-45km-v45-14w | 45,0 (12,1) → 45,0 (12,1) | 60,0 → 60,0 | 26,3 / 45,0 → 22,3 / 45,0 | —                                |

## Stalni uslovi (AGENTS.md)

| #   | uslov                            | stanje 02b                                                                                                                |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | jedan vlasnik odluke, bez petlji | udeo `days`; RP/T strukture `splitsOf`; lagan trkačke `raceEasyWorkout`; D25 samo validator; nijedna nova pretraga/petlja |
| 2   | jedan plafon po zoni             | D11 nepromenjen; `repMinM` 1000 m jedan broj za T i RP (preimenovan iz `tRepMinM`)                                        |
| 3   | WU/CD nisu pufer                 | WU/CD nepromenjeni (D14); D25 je upozorenje, a ne skraćenje WU/CD                                                         |
| 4–5 | adaptacija, handoff              | nisu u segmentu; `construct(input, [])` nepromenjen                                                                       |
| 6   | policyId/Version, faza nedelje   | `10k-v2` / `10k-v2.2.1`; faze nepromenjene                                                                                |
| 7   | nula uvoza van foldera           | isolation.node + architecture/isolation testovi zeleni, bez novih izuzetaka                                               |
| 8   | upotrebljivost                   | trkačka ≤ taper (greška); ned 1 ispod obima samo uz 105 min; trkačka ispod minimuma i dalje samo upozorenje (6 dana: 90)  |

## Odluke

- D17 izmena, D22b, D23, D25 u DECISIONS (`policy.ts`, `10k-v2.2.1`) sa merenjem; D17 brojke organizatora ponovljene ablacijom (396 → 0, 528 → 330, svi na 105 min, 4–6 dana bez promene). D25: simulacija kraćih WU/CD (organizator) nije ponovljena.
- Tumačenja bez novog broja: „km laganog dana tapera" = najkraći lagan tapera (lagani se razlikuju ≤ 0,1 km); D23 važi za svaki lagan trkačke nedelje (dan pred trku i oštrenje po D8); „nedelja izgradnje" za D25 = ne-rasteretna (tako se dobija broj organizatora 0 / 132 / 132 / 330; sa rasterećenjima 0 / 144 / 144 / 330); D25 jedno upozorenje po planu (prva nedelja, broj nedelja); preporuka = svi manji brojevi dana čiji red podržava trenutni obim.
- Odstupanje D22b (opreznije, ulaz u DECISIONS): očekivano ponavljanje 3 dana ≈ 0 nije postignuto — bez deonica < 1000 m RP 2,4 / 2,5 / 3,5 / 4,5 km imaju jednu strukturu i slot ponavlja trening (216 → 1224 ned; 4–6 dana 48 → 192, 0 → 144); ulaz: 3 dana, 9 ned, 20 km, VDOT 30, uto/čet/ned — ned 7 RP 2 × 1200 m ponovljen (bilo 3 × 800 m).
- Odstupanje vrha (D22b): manje oporavaka → kraći kvalitetni dan → niži kapacitet u 258 planova; ulaz: 4 dana, 16 ned, 35 km, VDOT 35, uto/čet/sub/ned — vrh 48,0 → 46,9 km (ned 14 RP 3 × 1500 umesto 5 × 900 m).

## Preostali problemi

- Ponavljanje RP slota (D22b): 1224 / 192 / 144 / 144 ned; trenerska odluka — RP kontinuirano kao T (2,4 kont. ↔ 2 × 1200) ili dodatni nivoi lestvice RP; nije uvedeno (nova struktura).
- D22b snižava vrh u 258 planova ograničenih kapacitetom (do 1,1 km); D23 spušta trkačku nedelju ispod minimuma 6 dana (RACE_WEEK_SHORT 90 planova: 35 km, VDOT 30–50; upozorenje D15).
- D25: 594 plana 4–6 dana (4 d 25 km VDOT 60–70; 5 d 30–35 km VDOT 70; 6 d 35–45 km VDOT 55–70) i dalje imaju kvalitetni dan duži od dugog; rešenje (WU/CD ili udeo) je trenerska odluka.
- Nasleđeno iz 02: 3 dana / 20 km rasterećenje i taper bez kvaliteta, I 2,0 km ponavljanje (4 dana, 9 ned), udeli zona (D2) i heuristike D16/D17 bez merenja na podacima.
