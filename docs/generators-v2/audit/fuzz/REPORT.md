# Dubinska provera v2 — UGAO 2: nasumični ulazi (fuzz)

Kod: **670700e** (`git diff --stat 670700e HEAD -- web/` prazan pre merenja i pre izveštaja). Ništa u `web/` nije menjano.
Merenje: samo generator (`generate*V2`), bez adaptacije. Seed **20261023**, ulazi 0…99 999 po distanci; ulaz `i` je
ponovljiv sam za sebe (`rng = mulberry32(mix(seed, i))`).

| distanca | ulaza | planova | realnih ulaza | realnih planova | CPU s |
|---|---|---|---|---|---|
| 5K | 100 000 | 88 266 | 89 903 | 78 519 | 711 |
| 10K | 100 000 | 83 693 | 75 691 | 63 918 | 235 |
| HM | 100 000 | 85 739 | 66 698 | 56 645 | 314 |
| maraton | 100 000 | 83 286 | 67 172 | 57 045 | 581 |

**Rezultat ukratko:** 0 throw-ova, 0 grešaka validatora na generisanim planovima i 0 prekršaja strukture plana na 4 × 100 000
ulaza. Nema praznog treninga, treninga van plana/nedelje/rasporeda, duplog dana ili trke koja nije poslednji dan. Nema
nedelje ispod minimuma, dugog kraćeg od laganog, kvaliteta bez WU/CD, kao ni plana bez policyId/policyVersion ili faze.
Novi nalazi: **2 B (5K)** i **3 T**, plus 1 artefakt test invarijante (K).

## Fajlovi

- `fuzz.ts` — generator ulaza + provere (`node ../docs/generators-v2/audit/fuzz/fuzz.ts <dist> <seed> <od> <do>`;
  jedan ulaz: `... <dist> 20261023 <indeks> --show` ispisuje ulaz, nalaze i nedelje plana).
- `run.sh` — pun prolaz (iz `web/`), `merge.py` — spaja `out/*.json` u `out/summary.json` (1,3 MB ukupno).
- `sharpen5k.ts` — iscrpno: 5K svi skupovi 3/4/5 dana × 7 dana trke (nalaz F1).
- `qinf5k.ts` — 5K QUALITY_INFEASIBLE: 3 d × km 12–20 × nedelje 6–16 × VDOT 30–60 (nalaz F2).

## 1. Dozvoljen domen ulaza (iz koda)

Čarobnjak (`domain/onboarding/fiveKV2.ts:116`, `*/v2/app/generate.ts alignedStart`) daje bilo koji datum trke i bilo koje
dane trčanja. Start je poravnat na cele nedelje koje se završavaju danom trke, pa start i trka mogu pasti na bilo koji dan.

| polje | 5K (`fiveK/v2/input.ts`, `policy.ts`) | 10K (`tenK/v2/input.ts`, `policy.ts`) | HM (`halfMarathon/v2/…`) | maraton (`marathon/v2/…`) |
|---|---|---|---|---|
| nedelje | 6–16 (policy.ts:68) | 8–18; početnik 10–18 (policy.ts:433–434, 472) | 10–20; početnik 12–20 (policy.ts:480–482, 557) | 12–24; početnik 16–24 (policy.ts:418–419, 459) |
| dani | 3–5; početnik ≤ 4; run/walk tačno 3 nesusedna (input.ts:79–110, policy.ts:259, 373) | 3–6; početnik 3–4 (policy.ts:469–470, 487–519) | 3–6; početnik 4–5 (policy.ts:491–522, 554–555) | 3–6; početnik 4–5 (policy.ts:478–509, 456–457) |
| raspored | generator: RUN_DAYS_SPACING (4–5 d) | SCHEDULE_NO_RECOVERY (input.ts:288) | SCHEDULE_NO_RECOVERY (input.ts:299) | SCHEDULE_NO_RECOVERY (input.ts:298) |
| dan dugog | — | opcion, ∈ runDays | opcion, ∈ runDays | opcion, ∈ runDays |
| km/ned po danima (iskusan) | 3: 12–35, 4: 15–45, 5: 25–65 (policy.ts:26, 35, 44); run/walk 0–35 | 3: 20–40, 4: 25–55, 5: 30–65, 6: 35–80 | 3: 25–45, 4: 30–60, 5: 35–75, 6: 40–90 | 3: 30–50, 4: 35–65, 5: 40–85, 6: 50–110 |
| km/ned početnik | kao iskusan (3–4 d) | 3: 15–30, 4: 18–35 | 4: 20–40, 5: 25–45 | 4: 25–45, 5: 30–50 |
| rezultat: distance | 3K, 5K, 10K (policy.ts:64) | 3K, 5K, 10K, HM (policy.ts:436) | 5K, 10K, HM, M (policy.ts:484) | 5K, 10K, HM, M (policy.ts:421) |
| starost rezultata | 0–84 d; stariji → po osećaju (policy.ts:57) | 0–84 d (policy.ts:435) | 0–84 d (policy.ts:483) | 0–84 d (policy.ts:420) |
| VDOT rezultata | 30–60, van → VDOT_OUT_OF_RANGE (policy.ts:66) | 30–80; < 30 → po osećaju, > 80 → VDOT_TOO_HIGH (policy.ts:438–439) | isto (policy.ts:485–486) | isto (policy.ts:424–425) |
| lagan tempo | 270–510 s/km, obavezan bez pouzdanog rezultata (policy.ts:59) | 270–510 (policy.ts:447–448) | 270–510 (policy.ts:532–533) | 270–510 (policy.ts:434–435) |
| cilj | opcion; VDOT cilja 25–85 (policy.ts:70) | opcion, > 0 s | opcion, > 0 s | opcion, > 0 s |
| skorašnji najduži | — | — | opcion, 5–42 km (policy.ts:714–716) | opcion, 5–42 km (policy.ts:427–428) |
| run/walk | canRun30Min = false | runWalk → odbijanje | runWalk → odbijanje | runWalk → odbijanje |

## 2. Generator ulaza (van mreža)

Po ulazu: iskustvo (25 % početnik); 5K 8 % run/walk. Broj dana je ravnomeran iz dozvoljenih. Dani su **nasumičan
podskup** (bilo koji dani), dan dugog je 70 % zadat, a nedelje min…max (30 % tačno na granici). Start je bilo koji dan od
2026-10-24 do +800 dana; trka = start + 7·N − 1. Km je u opsegu reda (30 % tačno na min/max, korak 1 ili 0,1).
Osnova tempa je jedna od sledećih:
- rezultat (55 %): VDOT na opsegu politike sa 30 % granica, nasumična dozvoljena distanca, starost 0–84 d sa 30 % granica;
- stari rezultat 85–365 d + lagan tempo (10 %);
- VDOT 25–29,9 + lagan tempo (5 %, 10K/HM/MAR);
- lagan tempo bez rezultata (ostalo).

Cilj je zadat u 30 % ulaza (VDOT forme −3…+6). HM/MAR imaju skorašnji najduži u 45 % ulaza: 60 % u odnosu sa obimom,
40 % bilo gde u 5–42 km (granice 30 %).
Mreže `testInputs`/`adaptInputs` koriste fiksan start (pon), trku nedeljom i nekoliko fiksnih rasporeda. Ovaj uzorak ih
praktično ne preklapa (datumi, dani i km su nasumični).

**Realan ulaz** (zajednička pravila + prag ovog ugla): VDOT ≤ 70; početnik VDOT ≤ 45 i lagan ≥ 330 s/km; skorašnji
najduži između prosečnog treninga (km / dani) i max(0,6 × km, 5 km). Odnos lagan tempo ↔ VDOT rezultata se ne proverava.

## 3. Provere po planu

- throw; odbijanje po kodu + klasi poruke (brojevi → #);
- `validatePlan` distance (greške = B, upozorenja se broje);
- invarijante distance: 10K i HM `gridInvariants.checkPlan`. Maraton ih nema van vitest harnesa
  (`grid.harness.node.test.ts` uvozi vitest), pa za maraton nisu pokrenute. Mreže pretpostavljaju „po osećaju ⇔
  recentResult = null": za plan po osećaju zbog starog rezultata ili VDOT < 30 invarijante dobijaju kopiju sa
  recentResult = null. Bez toga 10K/HM daju lažne PACE_BASIS/RPE/TEST_NONE.
- nezavisno (`fuzz.ts checks`):
  - nedelja (osim trkačke) ispod minimuma; prag = minimum politike po broju dana: 5K `minWeekKm` 7,5/10/12,5,
    10K `weekMinKm` 9/12/15/18, HM 12/16/20/24, MAR 15/20/25/30;
  - prazan trening (km ≤ 0, s ≤ 0 ili bez segmenata; run/walk: sesija bez trajanja);
  - lagan > dugi iste nedelje; kvalitet bez WU ili CD;
  - policyId/policyVersion, faza nedelje, granice nedelja;
  - dan van plana/nedelje/rasporeda, dupli dan, tačno jedan dan trke i on je poslednji;
  - dugi na zadatom danu dugog;
  - T-provere: ned 1 > 1,25 × trenutni + 4 km; skok obima > 25 % i > 4 km; skok dugog > 30 % i > 3 km;
    dan kvaliteta/testa duži **po trajanju** od dugog u nedelji koja nije taper/trkačka (pouke 14/32/35), odvojeno
    sa i bez upozorenja (`LONG_SHORTER_THAN_QUALITY`, `QUALITY_OVER_LONG`, `TWO_QUALITY_LONGER`, `LONG_NOT_LONGEST`;
    gleda se ima li ga plan, ne konkretna nedelja).

Sve nezavisne B-provere i skokovi: **0** na sve 4 distance.

## 4. Odbijanja

| distanca | kod | sve | realno | ocena |
|---|---|---|---|---|
| 5K | RUN_DAYS_SPACING (4–5 d, „izaberi razmaknutije dane") | 9 234 | 9 234 | dokumentovano |
| 5K | **WEEK_INFEASIBLE „Trkačka nedelja: nema zahtevnog dana šablona ≥ 3 dana pre trke za oštrenje."** | 1 954 | **1 604** | **F1 (B)** |
| 5K | **QUALITY_INFEASIBLE** (I 489, RP 126, tempo po osećaju 16) | 631 | **631** | **F2 (B)** |
| 10K | SCHEDULE_NO_RECOVERY (sa predlogom rasporeda) | 14 247 | 11 773 | dokumentovano |
| 10K | VDOT_TOO_HIGH | 2 091 | 0 | dokumentovano |
| 10K | WEEK_INFEASIBLE „nijedan cilj … ne može da se sastavi" | 280 | 0 | F5 (N) |
| HM | SCHEDULE_NO_RECOVERY | 13 502 | 10 053 | dokumentovano |
| HM | RECENT_LONG_TOO_SHORT | 565 | 0 | poznato |
| HM | WEEK_INFEASIBLE | 194 | 0 | F5 (N) |
| MAR | SCHEDULE_NO_RECOVERY | 13 502 | 10 127 | dokumentovano |
| MAR | RECENT_LONG_TOO_SHORT | 1 412 | 0 | poznato |
| MAR | WEEK_INFEASIBLE | 1 800 | 0 | F5 (N) |

## 5. Nalazi

| # | ugao | distanca | broj | ulaz (seed 20261023 + indeks / ceo ulaz) | uzrok | klasa | predlog |
|---|---|---|---|---|---|---|---|
| F1 | fuzz | 5K | 1 604 realnih / 100 000 ulaza (1 954 ukupno); iscrpno 12 / 245 kombinacija 3 d × dan trke, 0 za 4–5 d | #3640, #4249, #7703; najčistije: `{"startDate":"2026-12-28","raceDate":"2027-03-07","runDays":["tue","fri","sun"],"currentWeeklyKm":20,"recentResult":{"distanceM":5000,"timeSec":1309,"date":"2026-12-18"},"goalTimeSec":null}` (VDOT 45, trka nedeljom; proveren) | `fiveK/v2/week.ts:417–435`: kandidati za oštrenje su samo `pattern.q1/q2/long` ≠ dan trke sa razmakom ≥ 3 dana. Kad je dug na danu trke, a q1 2 dana pre nje, nema kandidata i stiže generičko WEEK_INFEASIBLE. Lagan dan (npr. uto) se ne razmatra, a šablon (schedule.ts) se bira bez dana trke. | **B** — realan tok čarobnjaka (uto/pet/ned + trka nedeljom, pon/čet/sub + trka subotom, pon/pet/ned + trka nedeljom), generičko odbijanje bez preporuke (protivno ODLUKE-4a „ivice" (3)) | oštrenje na lagan dan ≥ 3 dana pre trke ili bez oštrenja uz napomenu; ili odbijanje na ulazu sa preporukom (koji dan) |
| F2 | fuzz | 5K | 631 realnih / 100 000; qinf5k: na 12 km 273 / 1 023, na 13–20 km 0 | #802, #1829, #4397 (RP, ned 7); #845 (I, ned 3); #20521 (po osećaju, lagan 290); najčistije: `{"startDate":"2027-01-11","raceDate":"2027-03-07","runDays":["tue","thu","sun"],"currentWeeklyKm":12,"recentResult":{"distanceM":5000,"timeSec":1841,"date":"2027-01-01"},"goalTimeSec":null}` (VDOT 30, 8 nedelja; isto za VDOT 30–48) → „Nedelja 7: RP ponavljanja: budžet 0.77 km nije dovoljan …" | `fiveK/v2/workouts.ts:455` (budžet zone < najmanja doza). Na 12 km / 3 d RP budžet ned 7 (8-ned plan) je 0,77 km. Za 6, 7, 9–11 nedelja odbijanje je od VDOT 49 (I, ned 3). | **B** — novo prema POSLE-MERGE: poznato samo „3 d / 12 km / VDOT 60, nerealno", a sada je i VDOT 30 na 8 nedelja i po osećaju (lagan 287–290) | po ODLUCI-4a (3): kvalitet koji ne staje → manja struktura/bez kvaliteta uz upozorenje, ili odbijanje na ulazu sa preporukom (≥ 13 km ili 4 dana) |
| F3 | fuzz | 10K | dan **testa** duži od dugog (trajanje) bez upozorenja: ne-rasteretna baza 487 (198 > 5 min), rasterećenje 1 009 realnih parova (plan, oznaka) | #6291, #7675, #8993: `{"startDate":"2028-04-13","raceDate":"2028-06-07","runDays":["tue","fri","sat"],"currentWeeklyKm":20,"longRunDay":"fri","recentResult":null,"easyPaceSecPerKm":270,"goalTimeSec":null}`: ned 2 dugi 7,6 km / 34 min, test 10,55 km / 42 min (ned 1 dugi 9 km) | `tenK/v2/validate.ts:617–633`: D25 gleda samo `kind === 'quality'`, test nije obuhvaćen. HM pouka 32 obuhvata i test. | **T** | uskladiti sa HM (test ulazi u D25 ili dugi ≥ test) ili zapisati izuzetak u DECISIONS |
| F4 | fuzz | 5K | dan kvaliteta duži od dugog (trajanje), nema pravila ni upozorenja: realni parovi (plan, oznaka) baza 1 271 (268 > 5 min), vrh 1 616 (321 > 5 min), rasterećenje 961 | #1265: `{"startDate":"2028-01-23","raceDate":"2028-04-15","runDays":["sat","sun","wed"],"currentWeeklyKm":12,"typicalEasyPaceSecPerKm":470,"experience":"beginner","canRun30Min":true,"goalTimeSec":1402}`: ned 4 Q 5,5 km > dugi 4,7 km; #11991, #13987 | 5K nema pravilo „dugi najduži" (pouke 14/32/35 su HM/MAR; 10K D25). U 5K politici je samo lagan > dugi kao upozorenje (policy.ts:495). | **T** | odluka organizatora: preuzeti D25/pouku 32 u 5K ili zapisati da je za 5K svesno |
| F5 | fuzz | 10K/HM/MAR | WEEK_INFEASIBLE „nijedan cilj … naviše ne može da se sastavi": 280 / 194 / 1 800, realnih 0 | 10K #1328 (VDOT > 70, 6 d / 35 km); HM #2802 (početnik VDOT > 45); MAR #865 (VDOT > 70, 3 d / 30 km); MAR #55, #70 iz probe (početnik lagan 289/305) | uzrok nepoznat (nije praćen; samo nerealni ulazi) | **N** — generičko odbijanje bez preporuke, ali samo na nerealnom ulazu | ako se domen ulaza suzi na realnog trkača (plauzibilnost, POSLE-MERGE), otpada; inače odbijanje na ulazu |
| F6 | fuzz | HM | invarijanta DELOAD_LONG 12 realnih / 85 739 planova (80 ukupno) | #8208: `{"startDate":"2028-06-04","raceDate":"2028-09-02","runDays":["thu","tue","fri","wed","sun"],"currentWeeklyKm":44.6,"recentResult":null,"easyPaceSecPerKm":339,"goalTimeSec":6104,"recentLongRunKm":9.5}`: ned 4 dugi 10,2 > 0,8 × 12,6 | plan je ispravan po politici: napomena nedelje „dugi 10,2 km — podignut sa 0,8 × … (10,0 km) da dan testa ne bude duži od dugog (pouka 32)". `halfMarathon/v2/gridInvariants.ts:403` ne zna za izuzetak pouke 32. | **K** (test kod, ne plan) | invarijanta: izuzetak kad nedelja ima test i napomenu pouke 32 |

Nije nalaz (zapisano radi potpunosti):
- **Kvalitet duži od dugog sa upozorenjem** (10K/HM/MAR): plan nosi `LONG_SHORTER_THAN_QUALITY`, što je po pouci
  14/D25. Na maratonu je bez upozorenja samo **test u rasterećenju**: 3 realna (#31388, #80813, #67082). HM nema
  slučaj bez upozorenja.
- **10K kvalitet u rasterećenju duži od dugog bez upozorenja** (439 realnih parova): D25 namerno gleda samo
  ne-rasteretne nedelje izgradnje. Trenerski je diskutabilno, ali je pravilo dokumentovano.
- **Nekonzistentan ulaz (plauzibilnost, POSLE-MERGE):** 10K rezultat sa VDOT < 30 i lagan tempo 270 s/km daje plan po
  osećaju VDOT 58,6 (#6291). Rezultat se po D26 svesno ignoriše, ali ulaz je kontradiktoran. Realnost ovde ne
  obuhvata odnos lagan ↔ rezultat; to je nova činjenica za stavku „plauzibilnost ulaza".
- SCHEDULE_NO_RECOVERY / RUN_DAYS_SPACING: oko 10–14 % nasumičnih rasporeda; odbijanje je dokumentovano, sa predlogom
  rasporeda (10K/HM/MAR) ili porukom (5K).

## 6. Ograničenja merenja

- Samo generator, bez adaptacije (drugi uglovi).
- Maraton bez grid invarijanti (harnes vezan za vitest).
- „Sa upozorenjem" gleda upozorenje na nivou plana, ne nedelje koja krši.
- Prag realnosti za skorašnji najduži je ovog ugla (nije iz pravila).
- Brojevi u F3/F4 su parovi (plan, oznaka faza/rasterećenje/> 5 min); jedan plan može biti u više oznaka.
