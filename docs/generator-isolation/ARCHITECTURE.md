# Arhitektura četiri nezavisna generatora

Stanje posle segmenta 5/5. Tok izdvajanja i dokazi po segmentima: `STATUS.md`; završni zaključak: `FINAL-REPORT.md`.
Sve putanje su relativne prema `web/src/`.

## 1. Granice

| Generator | Direktorijum | Izvorni fajlovi (bez testova) | Distanca (tačna vrednost) |
|---|---|---|---|
| 5K | `domain/generators/fiveK/` | 68 / 8 039 redova | `5000` (i ulaz bez distance ili sa 0) |
| 10K | `domain/generators/tenK/` | 68 / 7 977 redova | `10000` |
| polumaraton | `domain/generators/halfMarathon/` | 67 / 9 161 red | `21097.5` |
| maraton | `domain/generators/marathon/` | 70 / 8 879 redova | `42195` |

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

**Dupliranje je namerno.** Isti algoritam postoji u četiri kopije da bi svaka distanca mogla da menja politiku bez
uticaja na ostale. Duplirani kod se ne objedinjuje.

## 2. Javni API

Svaki generator izvozi isti ugovor iz `index.ts` (implementacije su različite):

`generatePlan`, `assess`, `adaptGeneratedPlan`, `executionModel`, `executionBasis`, `buildExecutionAdjustment`,
`regenerateFuture`, `finalWarnings`, `buildRunWalkAdjustment`, `assessRunWalkProgress`, `qualityEntryGate`,
`hasRecentMeasuredForm`, `planWithNewGoal`, `planRecalibrated`, `recalibratedPlan`, `reentryPlan`, `mergeOverrides`,
`RECALIBRATION_MIN_WEEKS_LEFT`, `graftFuturePlan`, `alignAutomaticOverlays`, `vdotProposal`, `applyVdotProposal`,
`undoVdotAdjustments`, `planVdotNow`, `fitnessEvidence`, **`VDOT_PROPOSAL_MIN_MEASUREMENTS`,
`VDOT_PROPOSAL_THRESHOLD`** (kapija rekalibracije, segment 5/5), konstante distance i proizvoda
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
**F** format razmene/tehnički upis, **P** prikaz, **M** merenje forme i fiziološka računica, **S** zajednička trenerska
smernica van generatora (ista za sve distance — preostala prepreka, v. `FINAL-REPORT.md`).

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
| `training/vdot/paceForZone` | `paceForZone` | M; **S** u `features/session/useEasyPace.ts` (lak tempo iz forme), `domain/weather` (tempo po vremenu), `domain/watch/icuWorkouts.ts` (izvoz na sat) |
| `plan/describe`, `plan/index` | `rpeTarget` | **S** (ciljni napor po tipu dana) |
| `training/sessions/calc` | `RECOVERY_JOG` | **S** (izvoz na sat: koji oporavak je kaskanje) |

Produkcioni graf (`main.tsx`, uključujući lenje ekrane) iz starog koda dostiže **tačno 29 fajlova** (`PRODUCTION_LEGACY_FILES`
u istom testu): `plan/{altEditor,baseline,describe,edit,index,preparation,purge,resolve,versions}.ts`,
`training/adaptation/{chain,dates,effectivePace,index,matching,measure}.ts`, `training/constants/{evidence,heuristics,
product}.ts`, `training/generator/runWalk.ts`, `training/prediction/summary.ts`, `training/sessions/calc.ts`,
`training/test3k/index.ts`, `training/vdot/{calculateVDOT,limits,paceForZone,physiology,racePrediction,vdotFromPace,
zoneForKind}.ts`. Nijedan od njih nije generisanje ni adaptacija plana.

### Zajednička trenerska logika VAN starog mehanizma (nije deo izdvajanja, evidentirano)

| Modul | Šta radi | Zašto je to trenerska odluka |
|---|---|---|
| `domain/recovery/*` (`proposal.ts`, `constants.ts`, `load.ts`, `pain.ts`) + `stores/recoveryActions.ts` | predlog izmene plana zbog bola i prekida (run/walk po jačini bola, ACWR granice, lestvica povratka 50/70/85 %, nedelja bez kvaliteta posle 10 dana pauze); primena upisuje `alts` | zajednička ADAPTACIJA za sve distance, van generatora |
| `domain/activities/realign.ts` | automatski `swapDays` kad je trčanje urađeno ±2 dana od plana (razlika km ≤ 30 %) | heuristika rasporeda, ista za sve distance |
| `features/session/useEasyPace.ts`, `domain/weather`, `domain/watch/icuWorkouts.ts` | tempo iz trenutne forme (`paceForZone`), korekcija tempa po vremenu, rezervni tempi pri izvozu na sat | prikazni propis tempa nezavisan od generatora |
| `plan/describe.rpeTarget` | ciljni RPE po tipu dana | ista smernica za sve distance |
| `domain/ai/*` | tekstualni saveti (LLM) | savetodavno, ne menja plan |

Ovi moduli NE menjaju izlaz generatora pri generisanju i ne pozivaju stari mehanizam; `domain/recovery` međutim
predlaže i (posle potvrde korisnika) upisuje izmene budućih dana nad planom bilo koje distance.

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
| `architecture.node.test.ts` (9) | zatvorenje svakog generatora u svom direktorijumu; bez međusobnih uvoza i uvoza starog/izbora (ni tipom); bez deljenog izvršnog koda; aplikacija ne uvozi staro generisanje/adaptaciju (ni kroz barel); izbor po distanci, lični plan → HM, nepodržano → `null`; **dostižnost iz `main.tsx` (TypeScript parser, lenji `import()`, barel po imenu) = tačno 29 popisanih fajlova starog koda**; `select`/`handoff` bez starog koda; **zamrznut inventar imena** (i da nijedna stavka nije zastarela) |
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
npx vitest run --project ui Flow.test personalPlanGenerator # aplikacione putanje, brojač starog mehanizma
npm run build
npx playwright test
```

Iz `test/`: `node --test "**/*.test.mjs"`.
