# Arhitektura četiri nezavisna generatora

Stanje posle segmenta 5/5. Tok izdvajanja i dokazi po segmentima: `STATUS.md`; završni zaključak: `FINAL-REPORT.md`.
Sve putanje su relativne prema `web/src/`.

## 1. Granice

| Generator | Direktorijum | Izvorni fajlovi (bez testova) | Distanca (tačna vrednost) |
|---|---|---|---|
| 5K | `domain/generators/fiveK/` | 76 / 9 639 redova | `5000` (i ulaz bez distance ili sa 0) |
| 10K | `domain/generators/tenK/` | 76 / 9 577 redova | `10000` |
| polumaraton | `domain/generators/halfMarathon/` | 75 / 10 761 red | `21097.5` |
| maraton | `domain/generators/marathon/` | 78 / 10 479 redova | `42195` |

Svaki direktorijum sadrži SOPSTVENU kopiju svega što učestvuje u generisanju i adaptaciji plana te distance: procenu
trkača i spremnosti (`training/generator/{athleteAssessment,assess,formPolicy,validateInput}.ts`), kilometražu i
progresiju (`volume`, `weeklyLoad`, `longRunProgression`, `allocation`), periodizaciju i raspored (`generatePlan`,
`daySlots`, `focus`, `training/distances/profile*.ts`), kvalitet i doziranje (`training/sessions/*`,
`distances/qualityDose.ts`), tempo i zone (`training/vdot/*`, `training/prediction`), dužine, oporavak, rasterećenje i
taper (`generatePlan`, `sessions/deload.ts`, `longRun.ts`), kratku pripremu, povratak i run/walk
(`generator/runWalk.ts`, `plan/{regenerate,returnGrowth,fatigueRecovery}.ts`), adaptaciju (izvršenje, umor, pauza,
promena cilja, rekalibracija, predlog tempa, vraćanje verzije — `plan/*`, `training/{execution,qualityGate,
runWalkProgress}.ts`, `training/adaptation/*`), konstante (`training/constants/*`, samo za tu distancu) i pomoćne
funkcije (datum, format/zaokruživanje, ID-jevi, pravila zapisa). HM i maraton dodatno imaju sopstvenu odluku o
ograničenoj pripremi (`plan/preparationDecision.ts`).

Od prenosa zajedničke trenerske logike (posle segmenta 5/5) svaki generator ima i sopstvenu kopiju onoga što je ranije
bilo jedno aplikaciono pravilo za sve distance: predlog izmene plana zbog bola i prekida sa pragovima opterećenja i bola
(`recovery/{proposal,constants,load,pain,bodyParts}.ts`), automatsku zamenu dana posle uvoza aktivnosti
(`activities/realign.ts`), izvoz treninga na sat i prag tempa (`watch/icuWorkouts.ts`), vrućinu, tempo uz vrućinu,
najhladniji sat i karticu „Vreme" (`weather/index.ts`), ciljni napor po tipu dana (`plan/describe.rpeTarget`) i tempo po
zoni za prikaz (`training/vdot/paceForZone`).

**Dupliranje je namerno.** Isti algoritam postoji u četiri kopije da bi svaka distanca mogla da menja politiku bez
uticaja na ostale. Duplirani kod se ne objedinjuje.

## 2. Javni API

Svaki generator izvozi isti ugovor iz `index.ts` (implementacije su različite):

`generatePlan`, `assess`, `adaptGeneratedPlan`, `executionModel`, `executionBasis`, `buildExecutionAdjustment`,
`regenerateFuture`, `finalWarnings`, `buildRunWalkAdjustment`, `assessRunWalkProgress`, `qualityEntryGate`,
`hasRecentMeasuredForm`, `planWithNewGoal`, `planRecalibrated`, `recalibratedPlan`, `reentryPlan`, `mergeOverrides`,
`RECALIBRATION_MIN_WEEKS_LEFT`, `graftFuturePlan`, `alignAutomaticOverlays`, `vdotProposal`, `applyVdotProposal`,
`undoVdotAdjustments`, `planVdotNow`, `fitnessEvidence`, **`VDOT_PROPOSAL_MIN_MEASUREMENTS`,
`VDOT_PROPOSAL_THRESHOLD`** (kapija rekalibracije, segment 5/5), **`injuryProposal`, `applyInjuryProposal`,
`runWalkForPain`, `realignPlan`, `workoutsForWatch`, `thresholdPace`, `dayWorkoutText`, `sessionFromDescription`,
`weatherCard`, `targetPace`, `heatFor`, `heatAdvice`, `heatAdjustedPace`, `rpeTarget`, `paceForZone`** (prenos
zajedničke trenerske logike), konstante distance i proizvoda
(`FIVE_K_DISTANCE_M`/`FIVE_K_PRODUCT` itd.), a za testove poređenja `resolvePlan`, `matchPlanRows`, `sessKm`,
`sessDesc`, `t3kVdot` (lokalne kopije).

HM i maraton dodatno: `basisFromPlan`, `preparationDecision`, `buildPreparationChoice`, `buildReturnBase`,
`isLimitedLongPreparation` i tip `ShorterDistanceHandoff`. Opciju „kraća distanca" pravi generator te distance; HM i
maraton je dobijaju kao **obavezan argument** (`handoff`), pa se generatori međusobno ne uvoze.

Jedina veza generatora sa aplikacijom su **tipovi** razmene, samo kroz `<generator>/exchange.ts` (`export type` iz
`domain/state` i `domain/date`).

## 3. Aplikacioni izbor generatora

`domain/generators/select.ts` — jedina odluka je KOJI generator:

- `generatorIdFor` / `generatorForDistance(raceDistM)`: tačne vrednosti iz tabele iznad; `undefined`/`0` → 5K (stari ulaz
  bez distance); **svaka druga vrednost → `null`**.
- `generatorForPlan(plan)`: distanca iz `meta.raceDistM`, pa iz `ulaz.raceDistM`; nema plana ili nepodržana distanca →
  `null`. Za zamenu plana drugim (vraćanje verzije, regeneracija na drugoj distanci) bira se po planu koji se upisuje.
- Store-ovi biraju po **aktivnom** planu (`activeGenPlan()`), pa ugrađeni lični plan vlasnika (u store-u `genPlan ===
  null`, po sadržaju polumaraton) ide HM generatoru.
- `preparationForPlan(plan)`: HM → HM odluka, maraton → maratonska; 5K/10K i ostalo → `null` (nema odluke).
- `productFor(raceDistM)`: ime/preporučene nedelje iz generatora te distance (prikaz u čarobnjaku i u tački odluke).
- Ugovor `PlanGenerator` ima oblik objekta HM generatora (najširi rezultat — prilagođavanje može nositi odluku);
  TypeScript proverava da se sva četiri uklapaju.
- `null` se u aplikaciji **eksplicitno** prikazuje porukom `UNSUPPORTED_DISTANCE` (prilagođavanje, promena cilja,
  rekalibracija, vraćanje verzije, odluka o pripremi, čarobnjak, ekran „Prilagodi plan"); nema rezervnog generatora.

`domain/generators/handoff.ts` — predaja „kraća distanca": `5000 → fiveK`, `10000 → tenK`, `21097.5 → halfMarathon`.
Maraton nije kraća opcija nijedne distance i nije u predaji.

Van testova generatore uvoze samo `select.ts` i `handoff.ts`.

## 4. Dozvoljene aplikacione zavisnosti

| Smer | Dozvoljeno |
|---|---|
| generator → bilo šta van svog direktorijuma | samo tipovi kroz `exchange.ts` (`domain/state`, `domain/date`) |
| generator → drugi generator, `select`/`handoff`, stari mehanizam | ništa (ni tip) |
| `select.ts`/`handoff.ts` → stari mehanizam | ništa (ni tip) |
| aplikacija → generator | samo kroz `select.ts`/`handoff.ts` |
| aplikacija → stari kod (`domain/training`, `domain/plan`) | samo imena iz zamrznutog inventara (tabela ispod); tipovi razmene slobodno |

Zamrznut inventar (`LEGACY_SHARED_ALLOWED` u `domain/generators/architecture.node.test.ts`). Kategorije:
**F** format razmene/tehnički upis, **P** prikaz, **M** merenje forme i fiziološka računica. Zajedničkih trenerskih
smernica iz starog koda (ranije „S": `rpeTarget`, `paceForZone` u prikazu/vremenu/satu, `RECOVERY_JOG`) više nema.

| Modul | Imena | Kategorija |
|---|---|---|
| `plan/resolve`, `plan/index` | `resolvePlan`, `weekOf` | F |
| `plan/edit`, `plan/index` | `setAlt`, `clearAlt`, `swapDays`, `undoWeekMoves` | F (ručne izmene korisnika) |
| `plan/index` (`altEditor`) | `ALT_HOLD_MS`, `ALT_TYPES`, `RACE_DISTANCES`, `chooseRaceKm`, `chooseType`, `holdType`, `initialAltDraft`, `paceFromDraftDesc` | F (uređivač ručne izmene) |
| `plan/versions` | `getPlanRevisions`, `recordPlanRevision` | F (revizije) |
| `plan/index` (`purge`) | `hasGenPlanData`, `purgeGenPlanData` | F |
| `plan/describe`, `plan/index` | `tagName`, `sessKind`, `dayLabel`, `weekPhase` | P |
| `plan/preparation` | `preparationSummary` | P (čita `meta.preparation` koju je upisao generator) |
| `training/generator/runWalk` | `runWalkText` | P |
| `training/sessions/calc` | `sessQKm` | P (zbir za pregled promene) |
| `training/adaptation/index` | `effectivePace` | F/P (izmena ima prednost nad PRED redom) |
| `plan/baseline`, `plan/index` | `planBaselineVdot` | M |
| `training/adaptation/index` | `currentVdot`, `recomputeVdotChain`, `sessionClassFor`, `classifyMeasurement`, `predRowsForDay`, `matchWeekRows`, `alignVdotDates` | M (lanac forme) |
| `training/test3k`, `training/constants/product`, `training/vdot/*`, `training/prediction/summary` | `t3k*`, `addT3k`, `removeT3k`, `upsertMeasurement`, `T3K_*`, `vdotFromRace`, `raceTimeForVdot`, `isT3kId`, `t3kPossible`, `t3kSlowest`, `vdotPossible`, `predictionSummary` | M |

Produkcioni graf (`main.tsx`, uključujući lenje ekrane) iz starog koda dostiže **tačno 29 fajlova** (`PRODUCTION_LEGACY_FILES`
u istom testu): `plan/{altEditor,baseline,describe,edit,index,preparation,purge,resolve,versions}.ts`,
`training/adaptation/{chain,dates,effectivePace,index,matching,measure}.ts`, `training/constants/{evidence,heuristics,
product}.ts`, `training/generator/runWalk.ts`, `training/prediction/summary.ts`, `training/sessions/calc.ts`,
`training/test3k/index.ts`, `training/vdot/{calculateVDOT,limits,paceForZone,physiology,racePrediction,vdotFromPace,
zoneForKind}.ts`. Nijedan od njih nije generisanje ni adaptacija plana.

### Trenerska logika van plana — preneta u generatore

| Ranije (jedno za sve distance) | Sada (u svakom generatoru) | Aplikacija |
|---|---|---|
| `domain/recovery/proposal.ts` + pragovi predloga | `<g>/recovery/*` | `useRecoveryModel` i `recoveryActions.applyProposal` zovu generator aktivnog plana; bez generatora nema predloga |
| `domain/activities/realign.ts` | `<g>/activities/realign.ts` | sinhronizacija Strava/intervals.icu zove generator plana; plan bez generatora se ne preraspoređuje |
| `domain/watch/icuWorkouts.ts` | `<g>/watch/icuWorkouts.ts` | `icuPush` dobija generator aktivnog plana; bez njega slanje se odbija (`UNSUPPORTED_DISTANCE`) |
| vrućina/tempo/kartica u `domain/weather` | `<g>/weather/index.ts` | `WeatherCard` zove generator; bez njega kartice nema |
| `plan/describe.rpeTarget` | `<g>/plan/describe.ts` | `usePlanRpe()` → `sessionView`/`sessionBreakdown` |
| `paceForZone` u `useEasyPace`, čarobnjaku, vremenu, satu | `<g>/training/vdot/paceForZone.ts` | `useEasyPace()` i `formPreview` zovu generator plana / izabrane ciljne distance |

### Šta je i dalje zajedničko van generatora (ne menja plan)

| Modul | Šta radi |
|---|---|
| `domain/recovery/{pain,load,view,charts,constants}` | PRIKAZ stanja: status bola (pazi/stani/fizijatar), ACWR i pojasevi, spremnost „danas", masa, wellness, grafikoni; zapis trčanja van plana |
| `domain/weather` (ostatak) | čitanje prognoze, sat treninga, temperatura odrađenog trčanja, lokacija |
| merni sloj (`training/adaptation/{chain,measure,matching}`, `vdot/*`, `test3k`) | lanac forme (`vdotLog`) — ulaz generatorima |
| `domain/ai/*` | tekstualni saveti (LLM), savetodavno |

## 5. Pravilo zabrane zajedničkih trenerskih funkcija

1. Nijedan izvršni fajl ne sme biti deljen između dva generatora; nijedan generator ne uvozi drugi, `select`/`handoff`
   ni stari mehanizam (ni tipom).
2. Aplikacija ne poziva izvršne funkcije starog generisanja/adaptacije (ni kroz barel re-export) i iz starog koda sme da
   uvozi samo inventar iz §4. Novi uvoz zahteva svesno razvrstavanje (izmena inventara u testu + obrazloženje).
3. Izbor generatora nema rezervu: nepodržana distanca je `null` i eksplicitna poruka.
4. Predaja između generatora ide samo kroz `handoff.ts` kao argument.
5. Ponašanje generatora se menja samo u njegovom direktorijumu; namerna trenerska izmena svesno osvežava referencu te
   distance (novo snimanje + obrazloženje), nikad „popravkom" iz novog koda.

## 6. Automatske provere

| Test (`domain/generators/…`) | Šta proverava |
|---|---|
| `architecture.node.test.ts` (10) | zatvorenje svakog generatora u svom direktorijumu; bez međusobnih uvoza i uvoza starog/izbora (ni tipom); bez deljenog izvršnog koda; aplikacija ne uvozi staro generisanje/adaptaciju (ni kroz barel); izbor po distanci, lični plan → HM, nepodržano → `null`; **dostižnost iz `main.tsx` (TypeScript parser, lenji `import()`, barel po imenu) = tačno 29 popisanih fajlova starog koda**; `select`/`handoff` bez starog koda; **zamrznut inventar imena** (i da nijedna stavka nije zastarela); **trenerska logika van plana (19 imena) deklarisana je samo u generatorima i u svakom od četiri** |
| `guidance.node.test.ts` (6) | svaka od četiri kopije prenete logike = referenca aplikacionog koda pre prenosa (`ae6b43a`, 14 744 toka); pregled forme u čarobnjaku isti za podržane distance |
| `fiveK|tenK|halfMarathon|marathon/isolation.node.test.ts` | isto po generatoru + odsustvo profila/parametara drugih distanci |
| `runtimeIsolation.node.test.ts` (5) | samostalno (svež modul), obrnut i isprepletan redosled, ponavljanje = referenca; nema zajedničkog objekta između generatora; izvršavanje ne menja izvezene konstante; probna promena `deloadFactor` jednog generatora menja samo njega (jedini kanal ka drugom je eksplicitna predaja, dokazano preusmeravanjem predaje na netaknutu instancu) |
| `<generator>/equivalence.node.test.ts` | tačan zapis izlaza = zamrznuta referenca starog mehanizma (generisanje, adaptacija, odluke; TZ/sat/slučajnost) |
| `otherDistances.node.test.ts` | referenca polaznog `main` (`05088e0`) za 10K/HM/maraton kroz aplikacioni izbor |
| `personalPlan.node.test.ts` | ugrađeni lični plan: HM generator = stari mehanizam na 13 782 toka |
| `features/onboarding/*Flow.test.tsx`, `features/personalPlanGenerator.test.tsx` | stvarni tok kroz store-ove/ekrane; brojač poziva starog mehanizma = 0; nepodržana distanca eksplicitno odbijena |

Osetljivost svakog novog pravila je proverena veštačkim prekršajem (v. `STATUS.md`, segment 5/5).

## 7. Kompatibilnost starih planova

- Nema migracije, promene šeme ni automatske regeneracije pri učitavanju. Učitavanje (`domain/state/{migrate,clean,
  backup}.ts`) koristi samo `vdotPossible`, `isT3kId`, `t3kPossible`, `runWalkText` (validacija/čišćenje zapisa).
- Sačuvan plan obrađuje generator njegove distance tek pri sledećoj radnji korisnika; za plan napravljen starim
  mehanizmom izlaz je dokazano identičan (reference po distanci uključuju sačuvane planove sa zaštićenim danima).
- Plan bez podržane distance (ručno uvezen) se i dalje učitava i prikazuje; prilagođavanje se eksplicitno odbija.
- Tehnička zaštita istorije (prošli, odrađeni, ručno izmenjeni, pomereni, merom zaključani dani, ID-jevi, `pred`/`qs`,
  konflikti) je u `graftFuturePlan` svakog generatora; revizije i upis su aplikacioni.

## 8. Stari zajednički mehanizam

Produkciona uloga: **nema** (dokaz: §6, test dostižnosti). Fizički nije obrisan; 47 izvršnih modula starog
generisanja/adaptacije ostaju u `domain/training`/`domain/plan` kao **zamrznut istorijski oracle**: iz njih su snimljene
sve reference, a koriste ih istorijski testovi starog koda, golden master `generator.fingerprint`, harnesi referenci
(`test/fiveK/legacyApi.ts`, `capture*`) i UI/oracle testovi koji njima prave ulazne planove (stari `generatePlan`
direktno uvozi 53 testna fajla, stari `adaptGeneratedPlan` 51). Inventar po modulu i
razlog: `FINAL-REPORT.md` §2.

## 9. Komande

Iz `web/`:

```
npm run check                                              # typecheck + lint + prettier + vitest (svi projekti)
npx vitest run --project node generators/                  # arhitektura, izolacija, ekvivalencija, lični plan, runtime izolacija
npx vitest run --project node generators/architecture      # statičke granice i dostižnost iz main.tsx
npx vitest run --project node generators/runtimeIsolation  # izolacija u izvršavanju
npx vitest run --project node generators/personalPlan      # lični plan → HM
npx vitest run --project node generators/guidance          # preneta logika van plana: 4 kopije = referenca
npx vitest run --project ui Flow.test personalPlanGenerator # aplikacione putanje, brojač starog mehanizma
npm run build
npx playwright test
```

Iz `test/`: `node --test "**/*.test.mjs"`.
