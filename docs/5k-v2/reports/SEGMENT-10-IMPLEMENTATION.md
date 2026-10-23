# 5K v2 — Segment 10 (5k-v2.12.0): krug T — trenerska pravila

Polazni SHA `b9c4728` (`docs/generators-v2/audit/fixes/03-coach-rules.md`, raspodela `fixes/T-assign.md`: 5K = T1,
T2 (5K deo), T4, T5, T6 C3/C5/C11; pravila `fixes/00-common.md`). Grana `claude/generator-isolation-5k-10k-hm-marathon`.
Menjano samo `web/src/domain/generators/fiveK/v2/**`, `docs/5k-v2/**` i merna skripta otisaka
`docs/generators-v2/audit/fixes/5K/fixture10.ts` (nova). Bez PR-a, mergea, deploya.

## 1. Stavke

| # | pravilo | izmena (jedan vlasnik; konstruktor i validator) | merenje pre → posle |
|---|---|---|---|
| T1 | lagan prema dugom (izgradnja bez rasterećenja) | `lengths.easyVsLongWeek` / `easyCapKm` (⌊0,8 × dugi⌋) / `easyMinKm` (max(3 km, 20 min bržom granicom E)) — `weekLengths` (konstruktor, kapacitet, pouka 35), `week.mixedRemainder`/`easyMinOf`, validator `EASY_VS_LONG` (nov), `EASY_MIN`, `EASY_CAP`, `EASY_REST` (nov), `RUN_DAYS`. Kad minimum laganog ne staje uz dugi: lagan dan manje (`PlanWeek.easyRest`, prvo dan uz dugi); višak preko 0,8 × dugi: planirano < cilj uz `PLANNED_BELOW_TARGET` + preporuka „više dana trčanja ili manji obim". Dugi nikad preko udela dana / vremena. Izuzeci, jedno mesto `week.easyVsLongOff`: nedelja sa danima bola/odmora adaptacije (svoje dužine `limitedEasyKm`) i uvodne nedelje početnika (samo lagano + ubrzanja) — bez izuzetka su nastajale nedelje samo sa dugim (lanci: BUDUĆA NEDELJA PRAZNA 2; `edges` 160/16 000 odbijanja BEGINNER_INTRO/WEEK_DEGENERATE) | `coach-5k-10k/measure.ts 5K 1 60`: M1 lagan ≥ 0,95 × dugi **1 090 → 0** planova (lagan = dugi 646 → 0); M5 dan pre/posle dugog **308 planova / 747 nedelja → 0**; M6 lagan < 20 min **352 → 0** (min 832 s → —); adaptacija 5 210 tokova: 0 odbijanja (pre i posle) |
| T2 | dan kvaliteta ne duži od dugog (5K) | `week.qualityWarmupMin` + `withMinWarmup` (`PlanWeek.wuMin`): u bazi/vrhuncu/oštrenju (i rasterećenje) dan kvaliteta duži od dugog → WU/CD svih dana kvaliteta na najnižem pojasu (1,5 + 1 km), dužine jednom ponovo (oslobođeni km u lagane); i dalje duži → upozorenje `LONG_SHORTER_THAN_QUALITY` (zamenjuje `LONG_NOT_LONGEST`); validator `WARMUP` (pojas), `WARMUP_LONG` (nov: nedelja bez oznake a uslov važi) | `audit/fuzz/fuzz.ts 5K 20261023 0 34000` (trećina punog fuzza, isti seed): parovi (plan, oznaka) „dan kvaliteta > dugi BEZ upozorenja" **943 → 0** (baza 595, rasterećenje 328 + 20 > 5 min); sa upozorenjem 0 → 663; WU/CD na minimumu: 8 planova mreže, upozorenje 122 / 3 816 planova |
| T4 | trkač: taper, rasterećenje, doza vrha | `periodize.phaseCounts(n, beginner)` (taper 1 za ne-početnika), `noRegularDeload` (plan ≤ 8 ned bez redovnog rasterećenja), `deloadFirstOf` (ne pre ned 4) — periodize, rePeriodize (nov start), `steps.reliefMaxRun`, validator `PHASES`, `DELOAD_SHORT`, `DELOAD_EARLY` (nov). `workouts.qualitySession`: glavni I (vrhunac) / RP (oštrenje) sa rezultatom prvo najmanji korak naviše ≥ `quality.peakMainMinShare` (0,8) budžeta, inače postojeći 0,7 (bez odbijanja). Početnik i trčanje/hodanje bez promene | profil korisnika (§ 3): taper 2 → 1, rasterećenje ned 4 → nema, I ned 3–4 2 × 1 km (5,7 % = 72 % budžeta) → ned 4–5 2 × 1200 / 5 × 500 m (80 %), RP 2 × 1 km (72 %) → 5 × 500 m (80 %); vrh 34,9 → 39 km |
| T5 | trčanje/hodanje, početnik | `policy.runWalk.levels` + L13 (35 min) i L14 (40 min), `activeSec.max` 2 400; `runWalk.TRANSITION_LEVEL` (L12: trka bez hodanja i prelaz na kontinuirani plan ostaju na L12, `runWalkAssess` `level ≥ L12`). Početnik: kontrolnog trčanja nema (C13 iz 09, `periodize.controlTest`) — „prvi test posle 2 obična kvaliteta" već važi | 12 ned, tempo 8:30 (trka ≈ 42:30): najduže trčanje pred trku 30 → 40 min (≥ trka − 10 min); 16 ned: L12 → L14 |
| C3 | test mešovite nedelje | `week.isTestDay`: kontrolno trčanje se ne odbacuje radi ostatka — u `mixedFloorKm` i `mixedRemainder` kao dugi (ostaje kakvo je, i u zbiru minimuma) | unit test (zaštićen lagan duži: b9c4728 test otpada → ostaje, planirano > cilj uz upozorenje); mreža lib scenarija (feel, 9 468 tokova): test izgubljen u mešovitoj nedelji bez ograničenja 0 → 0 (nalaz bio čitanjem) |
| C5 | pouka 30 redosled | `week.raceWeekRest`: prvo otpada nezaštićeno oštrenje, pa dani bola, pa najraniji lagani (dan pred trku nikad); napomena „Bez oštrenja: sa njim bi trkačka nedelja bila veća od tapera"; validator `RACE_WEEK_TAPER` (oštrenje se broji kao uklonjivo) | `chains.ts 5K 20261023 0 2000`: COMMON:TRKAČKA > TAPER (upozorenje, ostaje dan pred trku/zaštićen dan) 3 → 2; unit test redosleda |
| C11 | pouka 35 opseg | `buildTrainingWeek`: `secondQualityEasy` u svim nedeljama osim trkačke (i taper, i uz dane odmora); validator čita istu funkciju sa `rule.easyDays` | generator: taper sa pravilom 0 (dugi tapera i dalje najduži); test: taper 4 d / 12 km E 8:00 i nedelja sa danom odmora — ista odluka kao bez odmora |

Verzija politike **5k-v2.11.1 → 5k-v2.12.0** (DECISIONS u `policy.ts`; oznaka stavke dopune 09 ispravljena na 5k-v2.11.1);
`KNOWN_VERSIONS` + 5k-v2.11.1.

## 2. Pad planiranog obima (T1)

`docs/5k-v2/artifacts/segment10/below.ts` nad celom mrežom generatora (`final-check/lib` 5K, 3 816 ulaza), b9c4728 → posle:

| | pre | posle |
|---|---|---|
| planovi sa nedeljom planirano < cilj (van trkačke) | 4 | 2 266 |
| nedelje planirano < cilj | 4 | 10 362 |
| zbir manjka [km] | 1 | 15 694 (≈ 1,5 km po nedelji) |
| nedelje sa laganim danom manje (`easyRest`) | 0 | 492 |
| ukupno planirano (sve nedelje, svi planovi) [km] | 1 162 448 | 1 180 714 (+1,6 %: taper 1 nedelja, bez rasterećenja ≤ 8 ned) |

Kapacitet obima (`volume.feasibility`) ostaje pravilo „lagan ≤ dugi" (`weekLengths.overLong`): sa granicom 0,8 u
kapacitetu bi 4 dana / VDOT 50 nosila 35,8 km umesto 46,7 (ceo plan ispod trenutnog obima) — pravilo traži
„planirano < cilj uz upozorenje", ne niži cilj.

## 3. Profil korisnika (coach.ts: 20:25, cilj < 20:00, 30 km, 4 d uto/čet/sub/ned, 19. 10. → 13. 12. 2026)

| ned | pre (b9c4728) faza · cilj/plan · glavni kvalitet | posle (5k-v2.12.0) |
|---|---|---|
| 1 | baza 30/30 · R 4 × 300 + T 2 km | baza 30/30 · isto |
| 2 | baza 32,4/32,4 · R 4 × 400 + T 2,5 km | baza 32,4/32,4 · isto |
| 3 | vrhunac 34,9/34,9 · I 2 × 1000 m | baza 34,9/34,7 · R 4 × 400 + T 3 km (lagan 9,7 = 0,8 × dugi 12,2) |
| 4 | vrhunac R 27,9 · I 2 × 1000 m | vrhunac 37,6/37,6 · I 2 × 1200 m + T cruise 2 × 1600 |
| 5 | oštrenje 34,9 · RP 2 × 1000 m + R 5 × 300 | vrhunac 39/39 · I 5 × 500 m + T cruise 2 × 1600 |
| 6 | taper 1/2 29,7 · RP 2 × 1000 + T 2 km | oštrenje 39/38,9 · RP 5 × 500 m + R 6 × 300 |
| 7 | taper 2/2 24,4 · RP 2 × 800 | taper 1/1 33,2 · RP 2 × 1000 + T 2 km |
| 8 | trkačka 12,2 · oštrenje 3 × 400 RP | trkačka 13,8 · oštrenje 3 × 400 RP |

Upozorenja posle: `PLANNED_BELOW_TARGET` (ned 3 i 6, 0,1–0,2 km), `GOAL_STATUS` (ambiciozan).

## 4. Testovi, sabotaže, merenja

- Nov `segment10.node.test.ts` (16 testova): T1 ×5, prošlost (written) ×1, T2 ×2, T4 ×3, T5 ×2, C3, C5, C11. Na b9c4728: 13/14 prve verzije pada (početnik bez
  testa već važi — C13 iz 09); 2 dodata testa (izuzetak uvoda, prošlost) pokrivaju ispravke ovog segmenta (sabotaže
  10-T1c, 10-W). Ažurirani postojeći testovi (namerna promena plana): očekivanja faza/tapera/rasterećenja
  (T4), dužina laganih i planirano < cilj (T1), lestvica L14 (T5), redosled `raceWeekRest` (C5), brojke mreža (08d, 08e).
- Otisci regresije ponovo snimljeni prema b9c4728 (`segment10.<mreža>-b9c4728.json`, `docs/generators-v2/audit/fixes/5K/
  fixture10.ts`; stari `segment09.*-c13c258.json` obrisani): `g07` 700 tokova, promenjeno 590 (T1 276, T4 300, T2 14); `n08d` 1 124 → 914 (T1 211, T4 575, T2 6, T5 90, lanac 32); `e08e` 16 804 → 15 929 (T1 3 126, T4 12 486, T2 317); `x08g` 104 800 → 95 192 (T1 19 921, T4 43 346, lanac 30 202, T2 1 603, GEN 120 — ulazni plan generatora promenjen, adaptacija istih činjenica daje drugi zapis izmena/mešovitih nedelja). Bez razloga „?" 0. Razlog bira `fixture10.why` (redom: lanac, T5, T4 raspored, T1 dužine/oznake, T2, T4 doza, C5, C3, C11, GEN), oznaku na tekućem rezultatu proverava `testInputs.mark10`
- Sabotaže `docs/5k-v2/artifacts/sabotage-10.json` (`web/scripts/sabotage.mjs`, `--bail=1`, cilj `segment10.node.test.ts`):
  **11/11 palo** (T1 granica, T1 20 min, T1 izuzeci, T2, T4 taper, T4 80 %, T5 L14, C3, C5, C11, prošlost u `written.ts`); stanje `src` isto posle vraćanja.
- `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK`: **44 fajla, 790/790** (541 s; pre dodatog testa prošlosti — posle njega `segment10` 16/16); brz nivo isti folder 32 fajla; `segment10` 16/16; `npm run check` (sa `NODE_OPTIONS=--max-old-space-size=6144` — eslint bez toga pada na memoriji u ovom kontejneru): typecheck, lint, format čisti; test:fast **3 761/3 768** — 7 palih su testovi VAN foldera 5K koji snimaju 5K v2 (`tenK|halfMarathon|marathon/v2/app/byteSame` redovi „5K v2“, `features/onboarding/fiveKV2Flow.test.tsx` oznaka verzije) — spreman patch `docs/5k-v2/artifacts/segment10/byteSame-5Kv2.patch` (57 redova „5K v2“ + oznaka 5k-v2.12.0; proveren: sa njim 11/11), primena traži odobrenje organizatora (pravilo 1, kao 5K-09); E2E `npx playwright test e2e/fivek-v2.spec.ts` **3/3**; `npm run build` čist
- Ispravke otkrivene merenjem (u ovom segmentu): (a) T1 u nedelji sa danima bola/odmora davao je praznu buduću nedelju
  (lanci 2) i nedelje samo sa dugim → izuzetak `easyVsLongOff`; (b) uvodne nedelje brzog početnika (3 d / 12 km): samo
  dugi, `edges` 160/16 000 odbijanja → izuzetak; (c) `written.writtenDays`: sastavljen dan na datumu ≤ asOf koji prethodni
  plan nema (lagan dan manje) ulazio je u prošlost (08i pun nivo „zaštićen dan promenjen") → samo dani > asOf;
  (d) mreža 08g, drugi korak lanca: zapisi su pravljeni iz POLAZNOG plana (dan koji je adaptacija ukinula →
  ADAPT_DAY_UNKNOWN) → iz adaptiranog plana (`testInputs` lanac kao aplikacija).

| merenje | pre (b9c4728) | posle |
|---|---|---|
| `coach-5k-10k/measure.ts 5K 1 60` M1 / M5 / M6 (planova) | 1 090 / 308 / 352 | 0 / 0 / 0 |
| isto, adaptacija M2/M3 (5 210 tokova) | 0 / 0, 0 odbijanja | 0 / 0, 0 odbijanja |
| `fuzz.ts 5K 20261023 0 34000` dan kvaliteta > dugi bez upozorenja | 943 | 0 (sa upozorenjem 663) |
| isto, odbijeni realni / nerealni planovi; B klasa | 3 136 RUN_DAYS_SPACING; B 0 | isto; B:NEDELJA_ISPOD_MINIMUMA nerealni 79 (realni 0) |
| `chains.ts 5K 20261023 0 2000` odbijeni lanci / **34** / 31 (koraka 7 809 / 3 996):WEEKS / NEXT_DAY>10 % / buduća < 40 % / trkačka > taper | 1 / 40 / 5 / 43 / 3 (SEGMENT-09) | **0** / **34** / 5 / 48 / 2 (prazna buduća nedelja 0) |
| `idemp.ts 5K 20261023 0 2000` same / next | 41 / 30 (SEGMENT-09) | **34** / 31 (koraka 7 809 / 3 996) |
| `run-all.sh /tmp/ra 2 '.*-5K'` (14 poslova) | 0 nečistih (FINAL-2026-10-23) | **0 nečistih** (early 0/18 252, edges 0/16 000, last-weeks 0/16 238, locked-pause 0/4 800, result-pain 0/7 452, start-day 0/5 202, two-step 0/25 024 + 0/25 024, locked-test 0/1 120 + 0/1 120, fatigue-testweek 0/784, predaja HM→5K 0/44 268 ×2, MAR→5K 0/34 476 ×2) |

## 5. Odluke izvršioca i otvoreno

Odluke izvršioca (pravilo nije zapisalo detalj; za proveru organizatora):
- T1 kapacitet: granica 0,8 × dugi NE ulazi u kapacitet obima (ostaje „lagan ≤ dugi"); višak je planirano < cilj uz
  upozorenje i preporuku, kako pravilo kaže. Sa granicom u kapacitetu 4 dana / VDOT 50 nosila bi 35,8 km (umesto 46,7)
  i plan bi bio ispod trenutnog obima.
- T1 „20 min laganim tempom" = km na BRŽOJ granici E (trening sa ubrzanjima i dalje ≥ 20 min; M6 0).
- T1 izuzeci (`week.easyVsLongOff`): nedelja sa danima bola/odmora adaptacije i uvodne nedelje početnika (vidi § 4 a, b).
- T1 lagan dan manje: prvo dan uz dugi (dan pre/posle), nikad dan samo sa ubrzanjima pre ostalih; dugi može da se
  vrati do svog udela kad dan otpadne (ne preko udela/vremena).
- T2 važi i u rasterećenju (faze izgradnje); upozorenje se zove `LONG_SHORTER_THAN_QUALITY` (kao 10K/HM), staro
  `LONG_NOT_LONGEST` ukinuto.
- T4 „≥ 80 %": prvi izbor i svaki korak vrhunca/oštrenja traži ≥ 80 % budžeta, a kad ga ponuda nema (mali budžet) ostaje
  postojeći 70 % — bez odbijanja. Plan po osećaju (doza trajanjem, bez tempa) bez promene.
- T5: lestvica ide do L14 kad ima nedelja (i kad je L12 već ≥ trka − 10 min); trka bez hodanja i prelaz ostaju na L12.

Otvoreno / pitanje organizatoru:
- T1 × Uslov 8 u adaptaciji: posle smanjenja cilja (npr. 3 d, ~9 km, brz trkač) nedelja sa laganim danom manje može biti
  planirano < minimum nedelje (7,0–7,3 < 7,5 km) — validator to meri po CILJU nedelje (kao dani bola), u mreži adaptacije
  114 nedelja (`minw`, uzorak k = 60); generator 0. Fuzz nerealni ulazi: B:NEDELJA_ISPOD_MINIMUMA 79 (realni 0).
  Trenerska odluka: da li tada zadržati 3 trčanja ispod 20 min ili prihvatiti 2 trčanja.

Primećeno, nije rađeno (van spiska): veličina `segment10.x08g-b9c4728.json` (~8 MB, 95 153 promenjena toka — skoro svaki
tok menja T1/T4); chains „buduća nedelja < 40 % cilja" 43 → 48 (nedelje bola/odmora).
