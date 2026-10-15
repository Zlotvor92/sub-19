# Izdvajanje generatora — stanje

Živi dokument za predaju između prozora. Cilj: četiri nezavisna generatora (5K, 10K, HM, maraton), bez deljenih izvršnih
funkcija, trenerskog engine-a, baznih klasa, limitera i postprocesora. Zajednički ostaju samo UI, skladištenje, autentifikacija,
izbor generatora i format razmene podataka.

| Segment | Distanca | Stanje |
|---|---|---|
| 1/5 | 5K | **urađeno** (ovaj dokument) — grana `claude/generator-isolation-5k`, bez PR-a |
| 2/5 | 10K | nije počet |
| 3/5 | polumaraton | nije počet |
| 4/5 | maraton | nije počet |
| 5/5 | uklanjanje starog zajedničkog mehanizma | nije počet |

## Polazna tačka

- Polazni commit: **`05088e0440c50e866bb3bbf6246ff20fe5619f4c`** (= `origin/main` u trenutku rada; „Merge pull request #44").
- Radno stablo je bilo čisto (detached HEAD na `main`, nema drugih lokalnih grana ni nezavršenih izmena).
- `AGENTS.md` **ne postoji** u repozitorijumu (provereno `find`). Pročitano: `ARCHITECTURE.md`, `docs/REWRITE_STATUS.md` (zaglavlje),
  komentari u generatoru i `domain/plan/*`, QA protokoli u `docs/qa/generator-ab`.
- Polazni rezultat provera (pre izmena): `npx vitest run` → 147 fajlova / 1 532 testa, svi prolaze.

## Šta je urađeno u segmentu 1

### Novi modul: `web/src/domain/generators/fiveK/`

68 izvornih fajlova, ~8 000 redova. Struktura poddirektorijuma je **ogledalo izvornih putanja u `web/src/domain/`**
(npr. `fiveK/training/generator/generatePlan.ts` ← `domain/training/generator/generatePlan.ts`), da bi razlika prema izvoru bila
proverljiva `diff`-om. Sve funkcije koje učestvuju u računanju 5K plana su lokalne kopije, uključujući datume
(`date/`), formatiranje i zaokruživanje (`format/`), ID pomoćne funkcije (`state/ids.ts`) i pravila zapisa ručne izmene
(`state/records.ts`).

| Oblast | Fajlovi u `fiveK/` |
|---|---|
| javni API | `index.ts` |
| adapter prema aplikaciji (izlaz generatora → perzistirani plan) | `plan/adapt.ts` |
| jedina veza sa aplikacijom (samo tipovi) | `exchange.ts` |
| normalizacija i validacija ulaza | `training/generator/validateInput.ts`, `generatePlan.ts` (`softInt`, granice) |
| procena sposobnosti, istorije, spremnosti | `training/generator/athleteAssessment.ts`, `assess.ts`, `formPolicy.ts` |
| kilometraža i progresija | `training/generator/volume.ts`, `weeklyLoad.ts`, `longRunProgression.ts`, `allocation.ts` |
| periodizacija i raspored | `training/generator/generatePlan.ts`, `daySlots.ts`, `focus.ts`, `training/distances/profile5k.ts` |
| izbor i doziranje kvaliteta | `training/distances/profile5k.ts`, `qualityDose.ts`, `training/sessions/*` |
| tempo i zone | `training/vdot/*`, `training/prediction/index.ts` |
| dužine, oporavak, deload, taper | `generatePlan.ts`, `training/sessions/deload.ts`, `longRun.ts`, `constraints.ts` |
| kratka priprema, povratak posle pauze, run/walk | `generatePlan.ts`, `training/generator/runWalk.ts`, `plan/returnGrowth.ts`, `plan/regenerate.ts` |
| adaptacija (izvršenje, umor, pauza) | `plan/executionAdjustment.ts`, `plan/regenerate.ts`, `plan/fatigueRecovery.ts`, `training/execution.ts` |
| run/walk adaptacija | `plan/runWalkAdjustment.ts`, `training/runWalkProgress.ts` |
| kapija kvaliteta | `training/qualityGate.ts` |
| promena cilja, rekalibracija, povratak | `plan/replan.ts` |
| predlog tempa iz forme | `training/adaptation/{proposal,evidence,chain,matching}.ts`, `training/test3k/index.ts` |
| graft/finalizacija/vraćanje verzije | `plan/future.ts`, `plan/finalize.ts`, `plan/automaticAlts.ts`, `plan/resolve.ts`, `plan/describe.ts`, `plan/edit.ts` |
| opisi i upozorenja | `generatePlan.ts`, `plan/describe.ts`, `plan/finalize.ts`, `training/sessions/calc.ts` |
| konstante | `training/constants/{distances,heuristics,product,evidence}.ts` (samo 5K parametri) |
| testovi | `equivalence.node.test.ts`, `isolation.node.test.ts` |

### Javni ulazi (`fiveK/index.ts`)

`FIVE_K_DISTANCE_M`, `FIVE_K_PRODUCT`, `generatePlan`, `assess`, `adaptGeneratedPlan`, `executionModel`, `executionBasis`,
`buildExecutionAdjustment`, `regenerateFuture`, `finalWarnings`, `buildRunWalkAdjustment`, `assessRunWalkProgress`,
`qualityEntryGate`, `hasRecentMeasuredForm`, `planWithNewGoal`, `planRecalibrated`, `recalibratedPlan`, `reentryPlan`,
`mergeOverrides`, `RECALIBRATION_MIN_WEEKS_LEFT`, `graftFuturePlan`, `alignAutomaticOverlays`, `vdotProposal`,
`applyVdotProposal`, `undoVdotAdjustments`, `planVdotNow`, `fitnessEvidence`; za testove poređenja: `resolvePlan`,
`matchPlanRows`, `sessKm`, `sessDesc`, `t3kVdot` (lokalne kopije).

### Uklonjene grane (5K ih ne aktivira)

Dokaz: `HEURISTIC_5K`/`PRODUCT_5K`/`PROFILE_5K` ne definišu `taperWeeks`, `firstTaperFactor`, `midweekLong`, `easyAfterLongRun`,
`recommendedMinRunDays`, `longRunFinish`, `paceStrategy`, `singleQualityWeek`, `trimPriority`, `weeklyFastShare`,
`longRunCycle`; `intervalPaceForWeek` je identitet; 5K kvalitet nikad ne pravi „Kontrolna trka" ni zonu M. Posle svakog koraka
uklanjanja poređenje sa referencom je ostalo identično (v. Validacija).

- `generatePlan.ts`: druga taper nedelja (`isTaper2`, `firstTaperFactor`), srednje-dugo trčanje (MLR), brz završetak dugog
  trčanja, „jedan kvalitet uz zahtevnu dugu", kontrolna trka, lak dan posle zahtevne duge, ciklus dugog trčanja, upozorenje o
  preporučenom minimumu dana, maratonska konsolidacija, `intervalPaceForWeek`.
- `allocation.ts` (MLR udeo), `daySlots.ts` (MLR slot i upozorenje), `longRunProgression.ts` (maratonska konsolidacija),
  `weeklyLoad.ts` (`finishLoadSec`), `athleteAssessment.ts` (pravila dužine za HM/maraton), `constants/distances.ts`
  (parametri 10K/HM/maratona), `distances/index.ts` (samo 5K profil), `sessions/progression.ts` (nedostižan iz 5K).
- `plan/executionAdjustment.ts`: grana odluke o ograničenoj pripremi (postoji samo za `raceDistM ≥ 21097`; 5K rezultat je uvek
  5000). `DecisionBasis` je lokalni tip.

**Namerno zadržano** (podatkovna robusnost, ne trenerska grana za drugu distancu): provere `mlr`/`finish` i zone `M` u
`plan/describe.ts`, `plan/finalize.ts`, `athleteAssessment.assessPreparation`, `prediction`, `vdot/paceForZone.ts`. Razlog:
5K adaptacija dobija i plan koji je nastao iz polumaratona/maratona (opcija „kraća distanca: 5K"), čiji su zaštićeni dani
(prošli, odrađeni, ručni) i dalje polumaratonski i moraju se pročitati i sačuvati kakvi jesu.

### Aplikacioni izbor generatora — `web/src/domain/generators/select.ts`

Jedina odluka: koji generator odgovara. `generatorForDistance(raceDistM)` (ulaz bez distance/0 je 5K, kao stari
`raceDistM || 5000`), `generatorForPlan(plan)` (distanca iz `meta`, pa iz `ulaz`; `null` = ugrađeni lični plan, polumaraton →
stari mehanizam), `productFor(raceDistM)`. Pri zameni plana drugim (vraćanje verzije, poravnanje automatskih izmena) bira se po
planu koji se upisuje.

`web/src/domain/generators/handoff.ts`: opcija „kraća distanca: 5K" u odluci o pripremi polumaratona/maratona
(`domain/plan/preparationDecision.ts`, stari mehanizam) se sada pravi kroz `fiveK.regenerateFuture`. Jedina izmena starog
mehanizma je ta jedna linija izbora.

### Povezane produkcione putanje

| Putanja | Fajl | Sada |
|---|---|---|
| novo kreiranje plana (čarobnjak) | `features/onboarding/Wizard.tsx` | `generatorForDistance(input.raceDistM)` → generate + adapter |
| upozorenja čarobnjaka (probni plan), procena forme, napomena o broju nedelja | `domain/onboarding/index.ts` | `generatorForDistance`, `productFor` |
| promena cilja | `features/plan/planActions.ts` | `generatorForPlan(genPlan).planWithNewGoal` |
| rekalibracija prema formi (dokaz + plan) | `stores/raceActions.ts` | `fitnessEvidence`, `planVdotNow`, `planRecalibrated` po planu |
| predlog / primena / poništavanje tempa | `stores/raceActions.ts` | `vdotProposal`, `applyVdotProposal`, `matchPlanRows`, `undoVdotAdjustments` po planu |
| prilagođavanje prema izvršenju (pauza, umor, manji obim) | `stores/executionActions.ts` | `executionModel`, `buildExecutionAdjustment`, `executionBasis` po planu |
| run/walk adaptacija | `stores/executionActions.ts` | `assessRunWalkProgress`, `buildRunWalkAdjustment` po planu |
| kapija kvaliteta (nepotvrđena forma) | `stores/executionActions.ts` | `qualityEntryGate`, `hasRecentMeasuredForm` po planu |
| vraćanje verzije | `stores/executionActions.ts` | `graftFuturePlan` generatora vraćene verzije |
| poravnanje automatskih izmena tempa posle promene | `stores/executionActions.ts` | `alignAutomaticOverlays` generatora novog plana |
| prikaz forme (isti dokaz kao rekalibracija) | `features/race/useFormModel.ts` | `fitnessEvidence` po planu |
| HM/maraton → „kraća distanca: 5K" | `domain/plan/preparationDecision.ts` → `generators/handoff.ts` | 5K generator |

`recalibratedPlan` i `reentryPlan` postoje u 5K API-ju, ali ih (kao i ranije) nijedan ekran ne poziva (ARCHITECTURE.md R7).

### Zaštita podataka

- Sačuvani planovi se **ne regenerišu automatski**; nema migracije i nema promene šeme (SCHEMA ostaje ista).
- Tehnička zaštita istorije (koji dan je zaštićen, prenos ID-jeva, zadržavanje PRED redova i `qs`) je u 5K kopiji
  `plan/future.ts` zajedno sa trenerskom finalizacijom, kao i u izvoru — nisu razdvajane, jer razdvajanje nije bilo potrebno za
  izolaciju, a doslovna kopija je dokazano identična. Pisanje u skladište, revizije (`domain/plan/versions.ts`) i
  `commitPlanChange` ostaju aplikacioni.
- Dokaz očuvanja: referentni tokovi sa zaštitom (budući odrađen dan, ručna sesija sa `overrides`, ručna izmena `alts`,
  merom zaključan red `pred`/`predLock`, pomeranja u prošlost i budućnost) su identični; UI test toka proverava da odrađeni dani,
  stvarna merenja, efektivni datumi pomerenih treninga, ručne izmene, zaključani redovi, `log/alts/moves/pred/predLock`,
  napomena o konfliktu i revizija ostaju posle prilagođavanja, promene cilja i vraćanja verzije.

## Dozvoljene aplikacione zavisnosti 5K modula

Samo **tipovi**, samo kroz `fiveK/exchange.ts`: `AltRecord`, `DayTag`, `GenPlanState`, `LogEntry`, `StoredWeek`, `T3kRecord`,
`VdotRecord` iz `domain/state` i `IsoDate` iz `domain/date`. Nijedan izvršni uvoz van `fiveK/`, nijedan paket, nijedan `@/`
alias, nema dinamičkog uvoza. Van testova, 5K uvoze samo `generators/select.ts` i `generators/handoff.ts`.
Proverava: `web/src/domain/generators/fiveK/isolation.node.test.ts` (direktno, tranzitivno od `index.ts`, re-export
`export {…} from` i `export * from`, obrnuti smer, nedeterminizam; proverivač je prvo testiran na veštačkim prekršajima, a na
stvarnom kodu je proveren privremenim zabranjenim re-exportom u `plan/future.ts` — pao je, zatim vraćeno).

## Šta još koristi stari zajednički mehanizam

1. **10K, polumaraton, maraton — sve** (generisanje i adaptacija), do segmenata 2–4. Moduli: `domain/training/**`,
   `domain/plan/**` (osim čitanja/prikaza).
2. Ugrađeni lični plan vlasnika (`genPlan === null`, polumaraton).
3. Za 5K plan, **prikazni i merni sloj koji ne menja plan** i dalje koristi deljene funkcije:
   - lanac forme i trenutna forma: `recomputeVdotChain`, `currentVdot`, `sessionClassFor`, `alignVdotDates`, `matchWeekRows`,
     `predRowsForDay`, `effectivePace` (`stores/actions.ts`, `stores/dayActions.ts`, `services/strava/stravaSync.ts`,
     `services/icu/icuSync.ts`, `app/integrations.ts`, `app/community.ts`, `features/today/*`, `domain/ai/*`, `domain/day/*`);
   - predlog lakog tempa dana: `features/session/useEasyPace.ts` (`currentVdot` + `paceForZone`);
   - prikaz/izvoz treninga: `domain/day/{breakdown,compare,workPace,planView}.ts`, `domain/race/view.ts`,
     `domain/watch/icuWorkouts.ts` (`describe`, `paceForZone`, `RECOVERY_JOG`), `domain/state/clean.ts` (`runWalkText`);
   - pregled promena u prethodnom prikazu: `stores/executionActions.planPreviewChanges` (`sessQKm`, samo zbir za prikaz);
   - forma iz unetog rezultata u čarobnjaku: `domain/onboarding.formPreview` (`vdotFromRace`, `paceForZone`; zavisi od
     distance rezultata, ne od ciljne distance).
   Ovo **nisu** putanje generisanja ni adaptacije plana, ali su trenerski proračuni prikaza nad 5K planom. Ako segment 5
   treba da ukloni stari mehanizam, ovi pozivi moraju dobiti vlasnika (izbor po planu ili aplikacioni merni modul). Odluka nije
   doneta u ovom segmentu.
4. Odluka o ograničenoj pripremi (`domain/plan/preparationDecision.ts`) ostaje stari mehanizam (postoji samo za HM/maraton);
   za 5K rezultat poziva 5K generator.

## Referentni ulazi i rezultati

| Šta | Gde |
|---|---|
| 5K scenariji (generisanje 1 000+ ulaza, ~15 000 adaptacionih tokova) | `web/src/test/fiveK/scenarios.ts` |
| 10K/HM/maraton scenariji + odluke o pripremi | `web/src/test/fiveK/otherScenarios.ts` |
| tačan zapis i kategorije poređenja | `web/src/test/fiveK/exact.ts` |
| stari mehanizam kao referentni API | `web/src/test/fiveK/legacyApi.ts` |
| 5K referenca (SHA po scenariju i kategoriji) | `web/src/test/fixtures/fiveK-reference.json.gz` |
| 10K/HM/maraton referenca | `web/src/test/fixtures/otherDistances-reference.json.gz` |
| snimanje referenci (ručno, na polaznom commitu) | `web/src/test/fiveK/captureReference.node.test.ts`, `captureOtherReference.node.test.ts` |

Originalni ulazi: 5K deo golden master matrice (`web/src/test/generatorScenarios.ts`, 576), 5K ulazi iz
`docs/qa/{generator-final,generator-ab,generator-phase1,generator-phase2}/inputs.json`, QA događaji U01 (propušten trening),
U02 (podizvršenje 0,55 dve nedelje) i U03 (dva laka treninga sa RPE 8) i zaštitni izazov iz
`docs/qa/generator-ab/users/U02-probe.mjs`. Dodatno: deterministički slučajni ulazi (mulberry32, seme 5005; za ostale distance
7000+distanca) i granične/neispravne vrednosti. Ništa nije izvedeno iz tekstualnih izveštaja.

Obe reference su uzete **iz starog koda na polaznom commitu**: 5K referenca prvo u radnom stablu pre bilo kakve produkcione
izmene, zatim ponovo u čistom `git worktree`-u na `05088e0` — bajt-identična. Referenca ostalih distanci je uzeta u tom
worktree-ju. Testovi poređenja nikad ne osvežavaju referencu iz novog koda.

### Poređenje i isključena polja

Poredi se tačan zapis celog izlaza (`exact.ts`): ključevi redosledom umetanja, `undefined` ključevi, -0, NaN, ±Infinity,
bez zaokruživanja. **Nijedno polje nije isključeno.** Kategorije (raspored, datumi, km, segmenti, tempo, odmor, taper,
upozorenja, adaptacija, ostalo) služe samo da pad imenuje gde je razlika; svaki list pripada tačno jednoj. Proverava se i da
nijedan poziv ne menja ulaze (čistoća). Osetljivost: mutacija `deloadFactor` 0,73→0,74 i `RETURN_POLICY.medium.fraction`
0,7→0,71 u 5K kopiji — oba testa pala sa razlikom u [km, upozorenja], zatim vraćeno.

Vreme/zona/slučajnost: 5K generisanje i adaptacija ponovljeni pod `TZ` = Pacific/Kiritimati, America/Los_Angeles,
Asia/Kolkata i UTC, uz `Math.random`, `Date.now` i `new Date()` bez argumenta koji bacaju izuzetak — identično referenci.
„Danas" je uvek argument.

## Provere i rezultati (poslednji prolaz)

| Komanda (iz `web/`, osim gde piše) | Rezultat |
|---|---|
| `npm run check` (typecheck + lint + prettier + vitest) | zeleno; vitest **153 fajla / 1 553 testa** (polazno 147 / 1 532) |
| `npx vitest run --project node fiveK/equivalence` | 4/4 — generisanje, adaptacija, TZ/sat/slučajnost identični referenci |
| `npx vitest run --project node fiveK/isolation` | 10/10 |
| `npx vitest run --project node generators/otherDistances` | 3/3 — 10K/HM/maraton: 2 211 generisanja, 17 638 adaptacionih tokova, 157 odluka o pripremi (uključujući 2 opcije „kraća distanca: 5K") identični |
| `npx vitest run --project ui fiveKFlow` | 2/2 — stvarni tok; brojač poziva starog mehanizma za 5K = 0, kontrolni 10K poziv ga koristi |
| `npx vitest run --project node generator.fingerprint` (u `npm run check`) | golden master 2 304/2 304 nepromenjen |
| `node --test "**/*.test.mjs"` (iz `test/`) | 396/396 |
| `npx playwright test` | v. ispod |

E2E: prvi pun prolaz 76/77; pao `e2e/pwa.spec.ts:38` (čarobnjak se resetuje pri pokretanju, „Dalje" ostaje onemogućeno).
Isti test na polaznom commitu (`--workers 1 --repeat-each 4`): **2 od 4 pada**; na trenutnom stanju 4/4 prolazi. Zaključak:
postojeća nestabilnost (trka pri pokretanju), nije posledica izdvajanja. Drugi pun prolaz: 76/77; pao drugi PWA test, `e2e/pwa.spec.ts:65` (ažuriranje service workera). Ponovljeno
(`--workers 1 --repeat-each 4`): trenutno stanje 4/4, polazni commit 3/4 (a paralelno 1 od 2 pada). Oba PWA testa su
nestabilna i na polaznom commitu; svi ostali E2E tokovi (75), uključujući 5K tokove U01–U03 iz `generator-ab-users.spec.ts` i
`final-preservation.spec.ts`, prošli su u oba prolaza.

## Kriterijum završetka segmenta 1

| Merilo | Stanje |
|---|---|
| 5K samostalno generiše plan | ispunjeno |
| 5K samostalno adaptira plan (izvršenje, pauza, umor, run/walk, cilj, rekalibracija, predlog tempa, vraćanje verzije) | ispunjeno |
| nema zabranjenih direktnih/tranzitivnih zavisnosti ni re-exporta | ispunjeno (automatski test) |
| ponašanje 5K očuvano | ispunjeno (tačno poređenje, bez isključenih polja) |
| 10K/HM/maraton nepromenjeni | ispunjeno (poređenje sa referencom polaznog commita) |
| korisnički podaci zaštićeni | ispunjeno (nema auto-regeneracije; testovi zaštite) |
| prikazni/merni sloj nad 5K planom bez starog mehanizma | **nije ispunjeno** — van obima generisanja/adaptacije, popisano u „Šta još koristi stari mehanizam" §3 |

## Preostali rizici

- Dupliran kod se namerno razilazi: buduće ispravke u starom mehanizmu ne važe za 5K i obrnuto. Referenca 5K je zamrznuta na
  `05088e0`; svaka namerna trenerska izmena 5K mora svesno da osveži referencu (novim snimanjem i obrazloženjem), a ne da je
  „popravi" iz novog koda.
- Izbor po `meta.raceDistM`: plan sa neočekivanom distancom (npr. ručno uvezen backup) ide starom mehanizmu, kao i ranije.
- `null` plan (lični plan vlasnika) ide starom mehanizmu.
- Testovi poređenja traju ~1 min (5K) i ~2 min (ostale distance) u `npm run check`.
- `fiveKFlow.test.tsx` dokazuje rutiranje obmotavanjem sledećih starih modula: `generatePlan`, `assess`, `plan/future`,
  `plan/regenerate`, `plan/executionAdjustment`, `plan/replan`, `plan/runWalkAdjustment`, `training/runWalkProgress`,
  `training/qualityGate`, `training/adaptation/proposal`. `training/adaptation/evidence` nije obmotan (koristi ga i deljeni
  merni sloj).
- E2E `pwa.spec.ts:38` i `:65` su nestabilni i na polaznom commitu (nije popravljano; van obima).

## Poznati trenerski nedostaci

Ovaj segment ne menja trenersku politiku i ne ocenjuje je. Nedovoljno dokaza za novu listu; poznati nalazi su u
`docs/GENERATOR_10_USERS_4_COACHES_REPORT.md`, `docs/qa/generator-final/REPORT.md` i `docs/ENGINE_CHANGES.md` i nisu ponovo
provereni ovde. Činjenice zapažene usput, bez ocene: 5K zahtev pune pripreme za najdužu dužinu je sama distanca (5 km,
`assessPreparation`); `recalibratedPlan`/`reentryPlan` nemaju ekran.

## Stanje radnog stabla (za segment 2)

Izmene su na grani `claude/generator-isolation-5k` (commit 515bba3, pushovano; PR nije otvoren, nije spojeno u `main`). Novi fajlovi: `web/src/domain/generators/**`,
`web/src/test/fiveK/**`, `web/src/test/fixtures/{fiveK,otherDistances}-reference.json.gz`,
`web/src/features/onboarding/fiveKFlow.test.tsx`, ovaj dokument. Izmenjeni: `web/src/domain/onboarding/index.ts`,
`web/src/domain/plan/preparationDecision.ts`, `web/src/features/onboarding/Wizard.tsx`, `web/src/features/plan/planActions.ts`,
`web/src/features/race/useFormModel.ts`, `web/src/stores/{executionActions,raceActions}.ts`, `web/tsconfig.{app,oracle}.json`.

Predlog za segment 2 (10K): isti postupak — referenca 10K već postoji u `otherDistances-reference.json.gz`; kopija zatvorenja u
`domain/generators/tenK/` sa sopstvenim `exchange.ts`; `select.ts` dobija 10K granu; `handoff.ts` dobija 10K za
HM/maraton „kraću distancu"; proverivač izolacije treba proširiti na sve generatore (nijedan ne sme uvesti drugi).
