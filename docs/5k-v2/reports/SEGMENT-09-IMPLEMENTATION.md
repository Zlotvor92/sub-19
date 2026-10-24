# 5K v2 — Segment 09 (5k-v2.11.0): ispravke posle dubinske provere

Polazni SHA `c13c258` (zaključan spisak `docs/generators-v2/audit/fixes/5K.md`, pravila `fixes/00-common.md`). Grana
`claude/generator-isolation-5k-10k-hm-marathon`. Menjano samo `web/src/domain/generators/fiveK/v2/**`, `docs/5k-v2/**` i
merne skripte `docs/generators-v2/audit/fixes/5K/` (nove). Bez PR-a, mergea, deploya.

## 1. Stavke

| # | stavka | izmena (jedan vlasnik) | merenje pre → posle |
|---|---|---|---|
| 1 | F1 oštrenje, 3 dana | `week.sharpenerCandidates` (konstruktor i validator SHARPENER_GAP): zahtevni dan šablona ≥ 3 dana pre trke; ako ga nema, lagan dan trčanja ≥ 2 dana pre trke (prvo dani ≥ 3, najbliži trci), ne uz zahtevni dan prethodne nedelje; napomena „Oštrenje je na laganom danu …". Pravilo = trenerska odluka organizatora iz spiska (`policy.schedule.sharpenerEasyMinGapDays`, DECISIONS 2.11.0) | `audit/fuzz/sharpen5k.ts` 3 d: WEEK_INFEASIBLE **12/245 → 0** (svaka kombinacija daje plan; 4–5 d bez promene) |
| 2 | F2 3 d / 12 km | generator koristi POSTOJEĆI lanac konstruktora (`generate.construct`: jedan kvalitet doze rasterećenja → bez kvaliteta, isto kao adaptacija) umesto odbijanja; napomena + upozorenje `QUALITY_REDUCED` (validator čita `limits.quality`) | `audit/fuzz/qinf5k.ts` km12: **273/1 023 → 0** (VDOT 30–60; km13–20 0 → 0) |
| 3 | Z5a/Z5b cilj predaje | `app/handoffTarget.ts`: rezultat nepodržane distance (HM/maraton) → `recentResult: null`, lak tempo izvora, a bez njega lak tempo iz rezultata po modelu tempa 5K (E sporija granica, u opsegu ulaza); `targetFacts` ne prosleđuje rezultate nepodržane distance. Z5b: početnik izvora sa > `beginner.maxRunDays` (4) dana → plan bez oznake početnika | HM izvor sa HM rezultatom → 5K cilj: odbijanje (RESULT_DISTANCE_UNSUPPORTED) → plan po osećaju (test `handoffTarget.node.test.ts`, tokovi none/pause35) |
| 4 | C8 VDOT < 30 | `input.ts`: VDOT ispod opsega → plan po osećaju (lagan tempo obavezan, napomena „sporiji od opsega tabela tempa"); jedno mesto `input.hasFreshResult` (+ `vdotBelowRange`); VDOT > 60 i dalje VDOT_OUT_OF_RANGE (kao 10K) | 5 km 31:40: odbijanje → plan po osećaju |
| 5 | Z4 vraćanje revizije | `app/adapt.ts` `mergeContinuous` spaja kroz `written.writtenWeeks` (mešovite nedelje i kad verzija nema adaptaciju); po pojašnjenju organizatora vraćanje = „poništi prilagođavanje": spoj se primenjuje kad prolazi `validatePlan` i sledeću adaptaciju (`restoreProblems`, jedna funkcija), inače odbijanje sa porukom (razlozi u `meta.futureChanges.problems`, interno) | `fixes/5K/fiveK-restore.ts` (obrazac tenK-restore, 5 760 tokova, danas = asOf + {0, 1, 4, 8}): vraćen plan krši validator **376 → 0**, sledeća adaptacija odbijena **130 → 0**; neposredno poništavanje (k = 0, 1 440): **0 odbijenih**; odbijena vraćanja 156 (k ≥ 1): MIXED_REMAINDER 38, TEST_WEEK 40, DELOAD_SHORT 36, BASE_R_DECREASE 22, VOLUME_GROWTH 20, VOLUME_DELOAD 10, DOSE_PROGRESSION 10, QUALITY_REPEAT 4, sledeća adaptacija 4, VOLUME_TAPER 2, BUDGETS 2 (tok može imati više) |
| 6 | 1a M2 | napomena odmora/bola bez broja planiranog pre upisa („planirano ≤ cilj obima X km", kao 10K) | `coach-5k-10k/measure.ts 5K 1 60`: **1 114 → 0** tokova |
| 7 | 1a M3 | `quality.weekQuality`: napomene doze rasterećenja u nedelji koja nije rasteretna počinju sa „Doza rasterećenja:" | isto merenje: **2 221 → 0** tokova |
| 8 | C1 početnik ned 1–2 | `periodize.deloadWeeks`: rasterećenje pomereno unazad u nedelju < `volume.deloadFirstWeek` (3) ide na nedelju posle n (8 ned: 2 → 4, kao 10K/HM „izuzetno 4"); granica niza Odluke 9 ostaje 4 (`reliefMaxRun`) | `fixes/5K/measure09.ts`: **72/648 → 0** |
| 9 | C2 umor bez dayId | `assess.ts`: zapis bez `dayId` = van plana = lagan (kao 10K/HM/MAR i komentar) | `consistency/deload-prev.ts 5K 13`: tokovi umora bez rasterećenja **355/1 660 → 0/1 672** |
| 10 | owner N1 | `volume.lastBuildKm` / `planLastBuildKm` — JEDNA „poslednja izgradnja" (cilj koraka, osnova povratka posle bola) za `assess`, `adaptVolume` i validator. Posledica otkrivena merenjem: višak posle bola je davao cilj ispod donje granice nedelje (855 odbijanja VOLUME_RESET) → višak dobija istu granicu kao manjak (`max(min(planirano, poslednja izgradnja), min(planirano, adaptFloorKm))`) | `owner/fiveK-n1-repro.ts`: ned 4 posle bola + viška 15,4 (osnova 14 + 10 %) → 14. `owner/fiveK-lastbuild.ts 6 6 3`: višak se razilazi **9 759/38 440 → 0** (merenje `fixes/5K/fiveK-lastbuild-09.ts`: isti tok, broj iz poruke sa zarezom, granica kao manjak; manjak 0 → 0, odbijanja 0 → 0) |
| 11 | C13 početnik test | `periodize.controlTest` (konstruktor, koraci, validator): kontrolno trčanje samo plan po osećaju iskusnog trkača | `measure09.ts`: planovi početnika po osećaju sa testom **324/324 → 0** |
| 12 | Z1 | `week.mixedOver` (konstruktor `mixedRemainder` i validator MIXED_OVER_TARGET): kvalitet ostaje kad je jedini uzrok viška upisani višak i planirano sa njim ≤ `mixed.keepQualityMaxShare` (1,10) × cilj | `consistency/mixed-drop.ts 5K 97`: kvalitet otpao uz višak ≤ 10 % **136 → 0** (višak > 10 %: 13 → 13, ostaje pravilo) |
| 12 | Z2 | `text.ts` JEDINI format teksta korisniku: `userText` (km ≤ 1 decimala, decimalni zarez, oporavak m:ss) u `buildWorkout` (naslov), `construct.push` (napomene nedelje) i na izlazu `generateFiveKV2`/`adaptFiveKV2` (`userResult`: poruke, napomene, izmene); uklonjene interne oznake (pouka 30/35/37, Odluka 9, segment 06, DOSE_DROPPED) i „.." | sken mreže (generator + adaptacija): decimalna tačka 15 533, km sa 2 decimale 4 153, oporavak u s 4 237, oznake 171, „.." 54 → **0** (trajni test `segment09` Z2) |
| 12 | Z3 | `assess.resultUse` — jedna odluka o rezultatu (assess i Forma `app/form.ts`) | `owner/fiveK-form-result.ts`: „čeka prilagođavanje" za ignorisan rezultat **12 124/12 124 → 0** |
| 13 | owner K | `week.raceWeekEasyCap` (konstruktor i validator); `peakKm` adaptacije = `c.peakRefKm`; izolacija: type-only samo ka `fiveK/exchange.ts`, ivica hvata `@/…/v2` alias | `owner/fiveK-peak-field.ts 40 40 20`: peakKm ≠ vrh za taper **2 474/7 548 → 0** |
| 14 | POSLE-MERGE c | test granice: `r-d3-6w-25km-v45-0`, trka Δ8 (VDOT 37) → I 2 × 1000 m tačno 300 s prolazi; sabotaža `<` umesto `<=` u `chooseProgressiveReps` pada | — |

Verzija politike **5k-v2.10.4 → 5k-v2.11.0** (DECISIONS u `policy.ts`); `KNOWN_VERSIONS` + 5k-v2.10.4.

### Odluke izvršioca (za proveru organizatora)

- F2: novi mehanizam nije uveden — generator koristi lanac koji adaptacija već ima (ODLUKA-4a (3): manja struktura / bez
  kvaliteta uz upozorenje). Taper koji ne staje postaje nedelja bez kvaliteta (kao adaptacija).
- C1: rasterećenje se NE izostavlja nego ide na nedelju posle n (kao 10K/HM „izuzetno 4"); tako niz izgradnje i granica
  Odluke 9 ostaju isti. Promena samo za početnika 8 nedelja (rasporedi svih dužina 6–16 i oba `deloadEvery` provereni).
- Z5a: kad izvor nema lak tempo, cilj ga računa iz rezultata izvora svojim modelom tempa (Daniels, E sporija granica) —
  činjenica izvora, politika cilja; rezultat se ne koristi za tempo kvaliteta.
- Z2: format je u jednoj funkciji; naslovi i napomene nedelja se formatiraju u konstrukciji (spajanje upisanih i
  sastavljenih nedelja poredi isti format), poruke na izlazu. Izmena dana u `changes` se i dalje meri na km
  laganog/dugog (naslov više nema 2 decimale).

## 2. Zamrznuti otisci (pravilo 4)

Z2 menja tekst svakog plana, a `peakKm` (K) većine adaptiranih planova, pa su otisci prema starim SHA (c9003aa, bf47249,
51a924f, f4b257d — sa tekstom) zamenjeni otiscima prema **c13c258** bez korisničkog teksta, oznake verzije i `peakKm`
(`testInputs.canon09`; vrednost `peakKm` proverava `segment09`). Pravi ih `docs/generators-v2/audit/fixes/5K/fixture09.ts`
(polazni i tekući kod nad istom mrežom); svaki promenjen tok nosi razlog, a test proverava oznaku razloga na tekućem
rezultatu (`testInputs.mark09`, `segment09.harness`). Promene prema c13c258 ranijih segmenata su u njihovim izveštajima.

| otisak | mreža | tokova | promenjeno | razlozi |
|---|---|---|---|---|
| `segment09.g07-c13c258.json` | generator, regresija 07 | 700 | 132 | C13 112, C1 16, F2 4 (ranije odbijeni; 640 → 644 plana) |
| `segment09.n08d-c13c258.json` | mreže 06/07 + mreža bola P | 1 124 | 102 | C13 72, C1 26, CH 4 |
| `segment09.e08e-c13c258.json` | uska + šira „rasterećenje posle smanjenja" | 16 804 | 1 127 | C13 1 007, Z1 120 |
| `segment09.x08g-c13c258.json` | trajna rana mreža (194 plana) | 104 800 | 25 340 | C13 11 825, CH 11 092, C2 1 022, C1 969, Z1 432 |

Tabela je stanje 5k-v2.11.0; otisci posle dopune (5k-v2.11.1) su u § 5.

Razlozi: C13 — plan početnika bez kontrolnog trčanja (i kad je test u toku otpao, doza nedelje 3/4 je druga); C1 —
početnik 8 nedelja; F2 — ranije QUALITY_INFEASIBLE; Z1 — kvalitet zadržan uz MIXED_OVER_TARGET; C2 — umor prepoznat;
CH — drugi korak lanca posle promenjenog prvog. Ostalo: bajt-isto u kanonu.

## 3. Testovi, sabotaže, završna provera

- Namenski: `segment09.node.test.ts` (24 testa; ulazi iz nalaza; svaki pada na c13c258 — merne skripte iz §1 to
  pokazuju brojevima pre), `app/handoffTarget.node.test.ts` (Z5a pravi tok HM → 5K), izmenjena očekivanja postojećih
  testova (tekst Z2, C8, C13, verzija 2.11.0, 05b 828 → 840 planova zbog F2).
- `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK`: **43 fajla, 765/765** (≈ 8 min).
- `npm run check` i `npx vitest run --changed 670700e`: 3 689 prolazi, **7 pada VAN foldera 5K** (redovi „5K v2" u
  `byteSame` 10K/HM/MAR i oznaka verzije u `features/onboarding/fiveKV2Flow.test.tsx`) — očekivano posle promene 5K v2;
  izmena tamo traži organizatora (pravilo 1, pitanje poslato).
- E2E `npx playwright test e2e/fivek-v2`: **3/3**.
- Sabotaže `artifacts/segment-09/sabotage-09.json` (rezultat `sabotage-09-result.json`): **20/20 pale**, stanje `src`
  vraćeno (svaka stavka ima svoju; C13 hvata `segment05`, ostale `segment09`).
- `bash docs/generators-v2/final-check/run-all.sh /tmp/ra 4 '.*-5K'` (regex iz uputstva `'.*-5K$'` ne hvata nijedan
  posao — `$` stoji ispred `|` u `run-all.sh`): **14 poslova, 0 nečistih** — early 0/18 252, edges 0/16 000,
  last-weeks 0/16 238, locked-pause 0/4 800, locked-result 0/108, locked-test 0/1 120, result-pain 0/7 452,
  start-day 0/5 202, two-step 0/25 024, fatigue-repeat/startday/testweek čisto, predaja HM→5K new 0/44 268,
  MAR→5K 0/34 476.

## 4. Primećeno, nije rađeno

- `policy.ts` DECISIONS: zapis 08k nosi oznaku `5k-v2.10.4` (treba 2.10.3) — istorija, nije menjano.
- Dopuna `01-chains-addendum.md` urađena posle pusha kao 5k-v2.11.1 (§ 5).
- 4 dana RUN_DAYS_SPACING (98/245 u sharpen5k) — nije na spisku.
- `f-d3-15w-25km-e420-1`, bol 8 na 2026-12-09 (jedan korak): adaptacija odbijena EASY_CAP („Oznaka lagan = dugi ne
  odgovara danima nedelje", ned 6) — isto na c13c258 (nije od ovog segmenta; nađeno uzorkom 12/12/6 skripte N1).

## 5. Dopuna lanci (5k-v2.11.1)

Po organizatoru: `docs/generators-v2/audit/fixes/01-chains-addendum.md` je deo ovog kruga — za 5K Z6, Z7, Z8 (B) i C4,
C5 (B), C8 (T). Polazni za „pre": `ce9afcd` (5k-v2.11.0). Verzija **5k-v2.11.0 → 5k-v2.11.1** (DECISIONS; `KNOWN_VERSIONS`
+ 5k-v2.11.0).

| # | stavka | izmena (jedan vlasnik) | test (pada na ce9afcd) |
|---|---|---|---|
| Z6 | LIMITS sa ranije zaključanim danom | `validate.protectedDay` — JEDNA definicija zaštićenog dana (≤ asOf ili zaključan) i u proveri LIMITS, mešovitoj nedelji, oznaci testa i trkačkoj | `segment09` Z6 |
| Z7 | manjak se primenjuje ponovo na iste zapise | `assess`: korak manjka pamti početak prozora zapisa (`AdaptStep.underFrom`); korak čiji se prozor preklapa sa ranijim primenjenim ne pravi novi (razlog „već u planu"), kao umor (pouka 36) | `segment09` Z7 (14,8 → 11,8 ranije) |
| Z8 | bol se primenjuje ponovo na iste zapise | `assess`: kad je raniji korak bola video najnoviji zapis bola, nov korak se ne pravi | `segment09` Z8 |
| C4 | doza/test sa zaštićenim danom | doza: nedelja čiji upisani dani kvaliteta nisu sastavljeni je van lanca doze (`PlanWeek.doseFact` — odluka konstruktora `generate`, validator `segOf` je čita); test: oznaka nedelje se ne poredi sa danom testa u prošlosti (urađen test i dalje broji za „najviše jednom") | `segment09` C4 ×2 |
| C5 | bol u taperu → RACE_WEEK_TAPER odbijanje | `week.raceWeekRest`: kad ni bez svih laganih ne staje, svi lagani koji smeju postaju odmor; zbir ide po svim datumima nedelje (zaštićen dan koji sastavljena nedelja nema — izostavljen lagan dan — ulazi u zbir; lanac i=107); validator: greška samo dok postoji lagan dan koji sme da bude odmor, inače upozorenje „(ostaju oštrenje i dan pred trku)" | `segment09` C5 ×2, `segment08g` (očekivanje „kad ne staje — svi lagani") |
| C8 | mešovita posle pauze > cilj bez upozorenja | `validate`: vlasnik ostatka je pravilo pauze → MIXED_OVER_TARGET upozorenje „posle pauze" kad je zbir kao pouka 37 (zaštićeni po činjenicama + preostali) > cilj (ne planirano: neodrađeni prošli dani nose planirane km — `segment08i` 08i-b ostaje bez upozorenja) | `segment09` C8 |

Merenje (iz `web/`, seed 20261023, lanci 0–2 000; pre = ce9afcd, posle = ovaj commit):

| `chains.ts 5K 20261023 0 2000` | pre | posle |
|---|---|---|
| odbijeni lanci | **131** | **1** |
| REJECT LIMITS / TEST_WEEK / QUALITY_REPEAT / RACE_WEEK_TAPER / DOSE_PROGRESSION | 109 / 9 / 6 / 4 / 3 | 0 / 0 / 1 / 0 / 0 |
| NEXT_DAY odbijeno TEST_WEEK / QUALITY_REPEAT | 3 / 1 | 0 / 0 |
| IDEMP:WEEKS (lanaca) | 327 | 40 |
| NEXT_DAY:CILJ_PAO>10 % | 16 | 5 |
| P37 mešovita iznad cilja bez upozorenja | 6 | 0 |
| BUDUĆA NEDELJA < 40 % cilja | 45 | 43 |
| COMMON:TRKAČKA > TAPER | 0 | 3 (C5: ranije odbijeni, sada plan uz upozorenje RACE_WEEK_TAPER — višak su oštrenje i zaštićen/prošli lagan dan) |
| imenovani lanci i=45, 288, 2650, 6392, 9115 | odbijeni | prolaze |

| `idemp.ts 5K 20261023 0 2000` | pre (neidempotentno/koraka) | posle |
|---|---|---|
| same — ukupno | 462 / 7 532 | **41** / 7 812 |
| same UNDER / NEW_RESULT+UNDER / PAIN+UNDER | 242/275, 108/121, 52/54 | 1/217, 0/100, 0/36 |
| next — ukupno | 203 / 3 855 | **30** / 3 977 |
| next UNDER / PAIN | 100/125, 17/690 | 0/100, 14/610 |

Preostalo (nije na spisku dopune): i=1299 QUALITY_REPEAT — novi rezultat menja tempo, dve uzastopne nedelje sa jednim
kvalitetom dobijaju isti R na NEzaključanim danima (nije zaštićen dan, nije C4); idemp PAIN same 13 / next 14 i
FATIGUE 9 (izmene napomena/ciljeva posle bola/umora pri ponovnoj primeni) — nisu Z7/Z8 (Z8 je ponovni korak bola na
iste zapise: 0).

Otisci prema c13c258 (`fixture09.ts`, novi razlozi; klasifikacija LC4 = jedina razlika `doseFact`, uz oznaku Z7):
`e08e` 1 127 → 3 582 promenjenih (C13 1 007, Z1 120, Z7 1 448 — relief baza već ima korak manjka za iste zapise → „već
u planu", LC4 1 007 — pauza: doza nedelje iz upisanih dana); `x08g` 25 340 → 28 983 (C13 11 822, CH 11 092, Z7 2 790,
C2 1 022, C1 967, LC4 858, Z1 432); `g07` 132 i `n08d` 102 bez promene. byteSame 10K/HM/MAR: samo redovi „5K v2"
(odobrenje organizatora), `fiveKV2Flow.test.tsx` → 5k-v2.11.1.

Sabotaže (`sabotage-09.json`, dodato 8): Z6 (protectedDay samo zaključan), Z7, Z8, C4 doza, C4 test, C5 (bez odmora kad
ne staje), C5 (zbir bez datuma nedelje), C8 — sve padaju.

Testovi (konačan kod): namenski `segment09` 32 (8 novih za dopunu; svaki pada na ce9afcd), izmenjena očekivanja
`segment08g` (raceWeekRest „kad ne staje — svi lagani"); `TEST_FULL=1 npx vitest run --project node
src/domain/generators/fiveK`: **43 fajla, 774/774**; `npm run check` i `npx vitest run --changed 670700e`: **327 fajlova,
3 704/3 704**; E2E `npx playwright test e2e/fivek-v2`: **3/3**; sabotaže **28/28 pale**.
`run-all.sh /tmp/ra 4 '.*-5K'` + `summarize-all.py`: **14 poslova, 0 nečistih** (early 0/18 252, edges 0/16 000,
last-weeks 0/16 238, locked-pause 0/4 800, locked-result 0/108, locked-test 0/1 120 + 0/1 120, result-pain 0/7 452,
start-day 0/5 202, two-step 0/25 024, predaja HM→5K 0/44 268, MAR→5K 0/34 476, fatigue-* čisto).

Dopuna T (`fixes/02-text-addendum.md`, samo tekst, ista verzija 5k-v2.11.1): `validate.ts` „Nedelja mora imati tačno jedno
dugo trčanje.", „Dugo trčanje sme biti samo lagano, bez brzog završetka."; `paces.ts` ocena cilja „… tempo treninga i dalje
zavisi od rezultata." Test `segment09` „dopuna T" (pada na starom tekstu). Otisci prema c13c258 bez promene (kanon bez
teksta); byteSame 10K/HM/MAR: 5 redova „5K v2" (#0 generisanje/plan/cilj/prilagođavanje/adaptacija), ostali redovi isti.
