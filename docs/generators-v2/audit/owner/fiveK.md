# Ugao 4 (jedan vlasnik) — 5K v2

Kod: `670700e` (`git diff --stat 670700e HEAD -- web/` prazan pre i posle merenja). Politika `5k-v2.10.4`.
Folder: `web/src/domain/generators/fiveK/v2/` (+ `app/`). Samo čitanje + merne skripte u ovom folderu; `web/` nije menjan.
Već poznato (POSLE-MERGE, FINAL-2026-10-23, ODLUKE-4a) nije ponovo prijavljeno.

## (a) Veličine koje koristi više delova

| veličina | vlasnik (fajl:funkcija:linija) | korisnici (fajl:linija) | jedna definicija? |
|---|---|---|---|
| dugi nedelje (plafon udela/trajanja) | `lengths.ts:longCapKm:30`, `lengths.ts:weekLengths:49`; bol `lengths.ts:painLongKm:76` | week.ts:102, week.ts:191/194 (secondQualityEasy), volume.ts:104 (kapacitet), feel.ts:368; validator samo granice iz policy: validate.ts:950–956 (LONG_SHARE), 958–968 (LONG_DURATION, bol `min(longMaxSec, painLongMaxSec)`) | da (validator proverava granice politike, ne ponavlja odluku) |
| „najduži dugi" (pouka 28) | — 5K nema `recentLongRunKm` ni pravilo L | — | n/p |
| dugi prethodne nedelje (trkačka) | upisani plan `written.ts:writtenWeek:41` | generate.ts:186 (`written`), validate.ts:318 (`weeks[w.index-2]` = isti upisani plan, adapt.ts:172) | da |
| plafon laganog dana trkačke nedelje | `week.ts:buildRaceWeek:454` (`floor1(min(50 min, 50 % dugog))`) | validate.ts:319–322 — ista formula BEZ `floor1` | **ne** (N3) |
| poslednja nedelja izgradnje | `volume.ts:planVolume:154` (generator), `volume.ts:adaptVolume:337–350, 352–370` (sa ciljem koraka i osnovom povratka) | validate.ts:736 `lastBuildBefore` i 665 (`lastKm`, prepis iste logike); **assess.ts:230** (`lastBuild` bez cilja koraka i bez osnove povratka) → assess.ts:450–461 (manjak), 471 (višak) | **ne** (N1) |
| nivo pre smanjenja | `assess.ts:levelBefore:258` | volume.ts:returnLevelAt (preko `step.levelKm`), validate.ts:levelAt | da |
| osnova povratka posle bola | `volume.ts:returnBaseKm:227` | volume.ts:anchored (adaptVolume), validate.ts:613 `anchorAt`, assess.ts:painReturnNote | da (ali ne ulazi u assess.ts:230, v. N1) |
| minimum nedelje | `policy.ts days[n].minWeekKm` preko `rulesOf`; trkačka `P.week.minRaceWeekKm` | validate.ts:536 (WEEK_MIN_VOLUME, 7,5/10/12,5); volume.ts:94 (dno tabele izvodljivih); `volume.ts:adaptFloorKm:200` = max(minWeekKm, n × 3) = 9/12/15 u izgradnji; generate.ts:202, 218 | ne — dve brojke (7,5 vs 9 …); razilaženje nije nađeno (N4) |
| najkraći lagan po fazi | `week.ts:easyMinOf:211` (taper/trka 2 km, inače 3) | lengths.ts:57 (sopstveno: samo `taper`), volume.ts:202 (sopstveno, taper/trka), validate.ts:987 (sopstveno, taper/trka), validate.ts mešovita (easyMinOf) | ne — 4 zapisa; algebarski isto na domenu (N5) |
| plafon zone / doze | `workouts.ts:qualityBudgets:174` (udeli policy), `workouts.ts:tMaxSec:386` | sve sesije workouts/feel; validate.ts:790 (BUDGETS = qualityBudgets), 802–813 (udeli i ponavljanja iz policy), 925 (DOSE_DROPPED) | da |
| plafon trajanja (dugi, T blok, ponavljanja) | policy `long.maxSec`/`beginner.longMaxSec` (rulesOf), `quality.tContinuousMaxSec` (tMaxSec), `iRepMaxSec`, `rRepMaxSec` | longCapKm, workouts.ts:391, validate.ts:807–813, 957–966 | da |
| okviri nedelja (faze, rasterećenje, test) | `periodize.ts:periodize:68`, `deloadWeeks:54`, `phaseCounts:20`, `testWeekOf:38`; adaptacija `steps.ts:framesFor:156` | generate.ts:97–104; validate.ts (phaseCounts, isShortPrep, testWeekOf); steps.ts:reliefMaxRun | da |
| delimična prva nedelja (r, n) | `assess.ts:assess:212–218` | steps.ts:doseResetDate:262 (asOf + 1), validate.ts segOf | da |
| WU/CD | `workouts.ts:warmupBand:184` (pojas po cilju nedelje) | workouts.ts:326/353/403/450, feel.ts:67/262; validate.ts:993 (isti poziv; za trkačku `raceBound` validatora) | da |
| doza kvaliteta | `quality.ts:weekQuality` (dispečer) + stanje `generate.ts:construct` (`lastDose`); reset `steps.ts:doseResetAt:248` / `doseResetDate:262`; pouka 35 `week.ts:secondQualityEasy:182` | validate.ts:224 (secondQualityEasy), 870–948 (lanac doze po doseResetDate) | da |
| rasterećenje (cilj) | `volume.ts:planVolume:171`, `adaptVolume:342–350, 362` (0,8 × poslednja izgradnja) | validate.ts:750–766 (prepis osnove + factorTolerance) | prepis; razilaženje nije nađeno (N2) |
| taper (cilj) i granica trkačke | `volume.ts:adaptVolume:383–389` (`peakRef`), planVolume:180–183 | validate.ts:620 `peakRefAt` (prepis), 746 `raceBound`, 767–781, 790 (BUDGETS trkačke od raceBound) | prepis; razilaženje nije nađeno (N2) |
| polje plana `peakKm` | generate.ts:400 (`vol.peakKm`) | adapt.ts:227 (max ciljeva izgradnje) — druga definicija, polje bez čitaoca | ne (N6) |
| cilj nedelje | `volume.ts:planVolume/adaptVolume` + `fitTargetKm:139`; mešovita `week.ts:mixedRemainder:261`; trkačka `week.ts:buildRaceWeek:402` | generate.ts, validate.ts (provere) | da |
| prag „lagan ≤ dugi" | `lengths.ts:weekLengths:62` (capped), `splitEasy`, `limitedEasyKm` | volume.ts kapacitet, week.ts:mixedRemainder (top), validate.ts:977–983 (EASY_LONGER_THAN_LONG, direktno poređenje) | da |
| svežina rezultata (84 dana) | `input.ts:hasFreshResult:213` (`P.input.resultMaxAgeDays`) i `assess.ts:289` (`P.adapt.resultMaxAgeDays`) | input.ts:145 (ista formula ponovo), app/form.ts:89, app/members.ts:238 | dve konstante iste vrednosti (84) za različit referentni dan (start / asOf) — razilaženje nije moguće dok su jednake (K, ne nalaz) |
| rezultat koji menja tempo | `assess.ts:assess:289–313` (svež, noviji, VDOT 30–60) | **app/form.ts:88–103** (svež + noviji, bez opsega VDOT) | **ne** (N7) |

## (b) Nalazi

| ugao | distanca | broj (ulaza/tokova) | ulaz koji reprodukuje | uzrok fajl:linija | klasa | predlog |
|---|---|---|---|---|---|---|
| owner | 5K | N1: 9 759 / 38 440 primenjenih koraka viška posle bola (`fiveK-lastbuild.ts 6 6 3`, 744 plana, 87 624 drugih koraka); manjak 0 / 43 812 | `r-d3-6w-20km-v45-1` (lib.grid5k): korak 1 `pain5` asOf 2026-11-15, korak 2 `over120` asOf 2026-11-22 → n = 4, cilj ned 4 15,4 km; assess lastBuild 23,3 (cilj nedelje sidra), vlasnik obima 14 (osnova povratka) → startKm 15,4 umesto 14; poruka „plan se ne povećava (nedelja 4: 15,4 km)", a 15,4 = osnova povratka 14 + 10 % | assess.ts:230 (`lastBuild` bez cilja koraka i `returnBaseKm`) vs volume.ts:337–340 / validate.ts:736; posledica assess.ts:471 | B (pravilo ugla 4: dve definicije se razilaze na realnom ulazu); po posledici: pravilo viška (Odluka 6, „bez rasta") posle bola nema dejstva — povratni rast +10 % ostaje bez upozorenja | jedna funkcija „poslednja izgradnja" u volume.ts (logika lastBuildBefore/adaptVolume: cilj koraka + osnova povratka), koju čitaju assess (manjak/višak), adaptVolume i validator |
| owner | 5K | N7: 12 124 / 12 124 (svi planovi po osećaju F+B, 1 732 plana × 7 VDOT) | `b-d3-…-e480` ili bilo koji F/B plan; test 3 km na sredu ned 3 sa VDOT 22–29,5 (npr. 23:08 = VDOT 22, realan početnik lagan 480 s/km) ili 61–70 (iskusan): Forma „Test 3K 23:08 — čeka prilagođavanje plana" [pending], adaptacija: RESULT_IGNORED „VDOT 22 van 30–60 — rezultat se ne primenjuje" | app/form.ts:89–102 (status `pending` = svež && noviji) vs assess.ts:305–313 (08k: opseg VDOT) | B (pravilo ugla 4); po posledici T — pogrešan tekst u Formi, plan ispravan (rezultat se nikad ne primeni, a piše da čeka) | Forma da čita odluku jezgra (izvesti iz assess funkciju „primenljiv rezultat" ili status RESULT_IGNORED), ne sopstveni uslov |
| owner | 5K | N3: plafon se razlikuje u 38 525 / 78 050 tokova; lagan dan u pojasu (cap konstruktora, cap validatora] 0 / 78 050 | svaka trkačka nedelja čiji min(3000/E.slow, 0,5 × dugi) nije na 0,1 km | week.ts:454–459 (`floor1`) vs validate.ts:319–322 (bez `floor1`) | razilaženje vrednosti nađeno, ali bez posledice na planu (validator je labaviji < 0,1 km; slep pojas za grešku konstruktora) — K | validator da poziva istu funkciju plafona (izvesti `raceWeekEasyCapKm` iz week.ts) |
| owner | 5K | N2: vrh za taper (validator peakRefAt vs konstruktor c.peakRefKm) 0 / 78 050; taper ≠ fit(vrh × f) 0; rasterećenje ≠ fit(osnova × 0,8) 0 | — | validate.ts:620, 736 (prepis volume.adaptVolume) | razilaženje nije nađeno | prepis je redosledno isti kao adaptVolume (isti uslovi `startKm`/`returnFrom`/`resets`); ipak dve kopije — zameniti pozivom jedne funkcije (pouka 24) |
| owner | 5K | N4: cilj nedelje izgradnje u [minWeekKm, adaptFloorKm(∞)) 0 / 78 050 | — | validate.ts:536 (minWeekKm 7,5/10/12,5) vs volume.ts:203 (9/12/15) | razilaženje nije nađeno: adaptVolume.fitAt (volume.ts:319–323) svaki adaptiran cilj diže na adaptFloorKm, a cilj generatora u izgradnji je ≥ 0,8 × weeklyKm.min (≥ 9,6/12/20) | jedan „minimum nedelje izgradnje" (adaptFloorKm) i u WEEK_MIN_VOLUME, ili zapisati u DECISIONS da su to dve različite veličine |
| owner | 5K | N5: 0 (dokaz) | — | lengths.ts:57 (`taper` → 2), week.ts:211 / volume.ts:202 / validate.ts:987 (`taper|race` → 2) | razilaženje nije nađeno: weekLengths se nikad ne zove sa fazom `race` (pozivi: week.ts:102 samo ne-trkačke — trkačka grana generate.ts:168 vraća pre buildTrainingWeek; week.ts:191/194 samo izgradnja — week.ts:82–86, validate.ts:224; volume.ts:104 probe bez `race`; feel.ts:368 samo izgradnja) | svuda `easyMinOf` |
| owner | 5K | N6: 2 474 / 7 548 tokova (`fiveK-peak-field.ts 40 40 20`) | `r-d3-6w-20km-v32-0`, asOf 2026-11-11, `pause20`: plan.peakKm 20 vs vrh za taper 15,4 | adapt.ts:227 vs volume.ts:383 / generate.ts:400 | K (polje nema čitaoca u web/src — grep; validator ga ne čita) | upisati `c.peakRefKm` ili ukloniti polje |

Napomena: N1 — svi ulazi mreže su realni po definiciji brifa (R VDOT 32–58, F lagan 300–480, B lagan 420/480 ili VDOT 32/36);
primer gore je VDOT 45, 3 dana, 20 km. Višak (over120) dve nedelje zaredom tokom povratka posle bola je realno ponašanje
(trkač ignoriše smanjenje).

## (c) Stalni uslovi 1–6 (5K)

| uslov | ispunjen? | dokaz |
|---|---|---|
| 1. jedan vlasnik, bez petlji skraćivanja/dopune, validator samo prijavljuje | **delimično** | Obim: jedan rekurent (volume.ts:planVolume/adaptVolume), korekcija rupa samo fitTargetKm (volume.ts:139, pretraga u unapred izračunatoj tabeli, ne ponovna konstrukcija). Nema `while` petlje nad km (grep: jedina `while` u steps.ts:179 broji nedelje). Pohlepni izbori jednog vlasnika: week.ts:raceWeekRest:371–398 (odmor dok trkačka ≤ taper), week.ts:mixedRemainder:282–310 (pokušaji kvalitet 2→1→0), generate.ts:238–254 (test → 'one' → 'none' kad ne staje) — jedna odluka, ne naknadna ispravka. Validator ne menja plan (validate.ts:1–5, generate.ts:406–419). Odstupanje: „poslednja izgradnja" ima dva vlasnika (N1), validator prepisuje adaptVolume (N2), Forma ima sopstvenu odluku (N7). |
| 2. jedan plafon po zoni | da | qualityBudgets (workouts.ts:174) jedini udeo; T jedan plafon po fazi `tContinuousMaxSec` (policy.ts:144, dvojnik shortTMaxSec ukinut 2.2.0); validator čita iste vrednosti (validate.ts:790–813). Dugi: jedna funkcija sa dva člana (longCapKm, udeo + trajanje). |
| 3. WU/CD nije pufer | da | WU/CD samo iz warmupBand(cilj nedelje) (workouts.ts:184, 326, 403, 450; feel.ts:67, 262); nijedno mesto ne menja WU/CD zbog obima; manjak ide u lagane (lengths.ts:weekLengths) ili PLANNED_BELOW_TARGET (validate.ts:508–531); mešovita nedelja ukida ceo dan kvaliteta, ne WU/CD (week.ts:296–306). Validator zahteva tačan pojas (validate.ts:993–1010). |
| 4. adaptacija: uslovi unapred u konstruktor, završna zaštita samo štiti | da | adapt.ts:132–157: koraci (assess) i zaštita dana (`keep`, `factKm`) ulaze u `construct`; spajanje written.ts (isto koje vidi konstruktor); adapt.ts:175–185 samo proverava i odbija (ADAPT_PROTECTION), ne menja. Nema post-hoc izmene nedelja. Jedino polje plana posle konstrukcije sa sopstvenom računicom: `peakKm` (adapt.ts:227, N6, bez čitaoca). |
| 5. handoff | da (5K je samo cilj) | app/handoffTarget.ts:103–129 (handoffFuture): ulaz iz činjenica čarobnjaka (targetInput:79), činjenice bez dayId i zaključanih dana izvora (targetFacts:62), politiku povratka određuje adaptFiveKV2. 5K v2 nije izvor predaje (nema `preparation.ts`). |
| 6. policyId/policyVersion i faza iz generatora | da | generate.ts:389–390, adapt.ts:216–217 (`P.id`, `P.version`); app/plan.ts:302–303, 436 (isti P); faza nedelje u app iz v2 nedelja (app/plan.ts:409–414, stampPlan:423), validator samo proverava redosled. |

## (d) Izmereno

| skripta (iz `web/`) | ulazi / tokovi | trajanje |
|---|---|---|
| `node ../docs/generators-v2/audit/owner/fiveK-volume-refs.ts 10 10 5` — (a) vrh za taper validator/konstruktor, (b) taper, (c) rasterećenje, (d) poslednja izgradnja assess/validator, (e) minimum nedelje, (f) plafon laganog trkačke; seed LCG 20261023 (izbor s2) | 447 ulaza lib.grid5k (svaki 10./10./5. R/F/B, pomak k/2), 446 planova, 5 asOf × 17 scenarija + drugi korak (+7, s2 po seedu; chain2): 78 050 tokova, 0 odbijenih | 885 s |
| `node ../docs/generators-v2/audit/owner/fiveK-lastbuild.ts 6 6 3` — N1 (bez slučajnosti) | 744 ulaza, 738 planova, 32 412 prvih koraka (bol: pain5/pain8/painPause, sreda i kraj nedelja 2…N − 3), 87 624 drugih (over120/under50 na +7/+14), 0 odbijenih | 1 016 s |
| `node ../docs/generators-v2/audit/owner/fiveK-form-result.ts` — N7 (bez slučajnosti) | svi planovi po osećaju F+B (1 732) × 7 VDOT testa (22, 25, 28, 29,5, 61, 65, 70) = 12 124 | 116 s |
| `node ../docs/generators-v2/audit/owner/fiveK-peak-field.ts 40 40 20` — N6 (bez slučajnosti) | 111 ulaza, 4 asOf × 17 scenarija = 7 548 tokova | ≈ 60 s |

Nepotvrđeno / nije mereno: uslov 7 (izolacija — organizator). App `members.ts` (executionModel, fitnessEvidence) ponavlja
pragove umora/svežine iz policy samo za prikaz; odluku ne donosi (komentar members.ts:100) — razilaženje sa assess nije
mereno.
