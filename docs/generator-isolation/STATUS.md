# Izdvajanje generatora — stanje

Živi dokument za predaju između prozora. Cilj: četiri nezavisna generatora (5K, 10K, HM, maraton), bez deljenih izvršnih
funkcija, trenerskog engine-a, baznih klasa, limitera i postprocesora. Zajednički ostaju samo UI, skladištenje, autentifikacija,
izbor generatora i format razmene podataka.

| Segment | Distanca | Stanje |
|---|---|---|
| 1/5 | 5K | **urađeno** — grana `claude/generator-isolation-5k`, bez PR-a |
| 2/5 | 10K | **urađeno** (v. „Segment 2/5 — 10K" ispod) — commit `7966766` na grani `claude/generator-isolation-5k`, bez PR-a |
| 3/5 | polumaraton | nije počet |
| 4/5 | maraton | nije počet |
| 5/5 | uklanjanje starog zajedničkog mehanizma | nije počet |

> Sekcije od „Polazna tačka" do „Stanje radnog stabla (za segment 2)" su zapis segmenta 1 (5K) i nisu prepisivane.
> Aktuelno stanje posle segmenta 2 je u sekciji **„Segment 2/5 — 10K"** na kraju dokumenta.

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

## Šta još koristi stari zajednički mehanizam (stanje posle segmenta 1; aktuelno v. segment 2)

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

---

# Segment 2/5 — 10K

## Polazna tačka (segment 2)

- Polazni commit: **`f745be0e3f11d0382ee62879dcd24c57e9175683`** (vrh `origin/claude/generator-isolation-5k`, segment 1: `515bba3`
  + `f745be0`). Osnova grane je `05088e0` (= `origin/main`, neizmenjen od segmenta 1).
- Rad je rađen od `origin/claude/generator-isolation-5k` (radno stablo čisto na polasku); po uputstvu je dodat na istu granu
  kao commit `7966766` (bez PR-a, nije spojeno u `main`).
- `AGENTS.md` i dalje **ne postoji** (provereno na svim granama).
- Provera preduslova (stvarni kod, ne dokument): `generators/fiveK/` postoji (68 izvornih fajlova); `select.ts` šalje 5K u
  `fiveK`; 5K testovi ekvivalencije i izolacije prolaze; `npm run check` na polaznom commitu: **153 fajla / 1 553 testa, zeleno**.
- Na početku sesije grana segmenta 1 nije bila na udaljenom repozitorijumu; rad je počeo tek kada je pushovana.

## Novi modul: `web/src/domain/generators/tenK/`

68 izvornih fajlova, 7 971 red (plus 2 testa). Struktura je **ogledalo izvornih putanja u `web/src/domain/`**, kao kod 5K.
**Izvor kopije je stari zajednički mehanizam (`domain/training`, `domain/plan`, `domain/date`, `domain/format`,
`domain/state/ids.ts`)**, ne 5K modul: zatvorenje je izračunato iz uvoza starih ulaznih tačaka (`generatePlan`, `assess`,
`plan/adapt`, `executionAdjustment`, `regenerate`, `replan`, `future`, `automaticAlts`, `runWalkAdjustment`,
`runWalkProgress`, `qualityGate`, `adaptation/{proposal,evidence,matching}`, `resolve`, `sessions/calc`, `test3k`), kopirano,
pa su putanje uvoza prepisane. Iz 5K je preuzet samo obrazac (ogledalo putanja, `exchange.ts`, oblik testova).

| Oblast | Fajlovi u `tenK/` |
|---|---|
| javni API / adapter / tipovi razmene | `index.ts`, `plan/adapt.ts`, `exchange.ts` (samo `export type`) |
| validacija ulaza i procena trkača | `training/generator/{validateInput,athleteAssessment,assess,formPolicy}.ts` |
| tempo i zone | `training/vdot/*`, `training/prediction/index.ts`, `training/sessions/prescription.ts` |
| kilometraža i progresija | `training/generator/{volume,weeklyLoad,longRunProgression,allocation}.ts` |
| periodizacija, rasterećenje, taper, nedelja trke | `training/generator/generatePlan.ts`, `training/distances/profile10k.ts` (`phase10K`), `training/sessions/deload.ts` |
| raspored dana | `training/generator/daySlots.ts`, `focus.ts` |
| prag, intervali, ekonomija, trkački ritam | `training/distances/profile10k.ts`, `training/sessions/{tempo,cruise,intervals,repetitions,progression,build}.ts` |
| doziranje rada i odmora | `training/distances/qualityDose.ts`, `training/sessions/intervals.ts` (`proportionalRest`), `build.ts` |
| dužine i oporavak | `longRunProgression.ts`, `allocation.ts`, `generatePlan.ts` (LR plafoni, `capAfterLongRun`) |
| kratka priprema, povratak, run/walk | `generatePlan.ts`, `training/generator/runWalk.ts`, `plan/{regenerate,returnGrowth,fatigueRecovery}.ts` |
| adaptacija, rekalibracija, promena cilja | `plan/{executionAdjustment,regenerate,replan,future,automaticAlts,runWalkAdjustment}.ts`, `training/{execution,runWalkProgress,qualityGate}.ts`, `training/adaptation/*`, `training/test3k` |
| opisi, upozorenja, finalizacija | `plan/{describe,finalize,resolve,edit,baseline,types}.ts`, `training/sessions/calc.ts` |
| konstante | `training/constants/{distances,heuristics,product,evidence}.ts` (u `distances.ts` samo 10K) |
| pomoćne funkcije | `date/index.ts`, `format/index.ts`, `state/ids.ts`, `state/records.ts` (DAY_TAGS, STRENGTH_WITH, cleanRunWalk) |
| testovi | `equivalence.node.test.ts`, `isolation.node.test.ts` |

### Javni API (`tenK/index.ts`)

`TEN_K_DISTANCE_M`, `TEN_K_PRODUCT`, `generatePlan`, `assess`, `adaptGeneratedPlan`, `executionModel`, `executionBasis`,
`buildExecutionAdjustment`, `regenerateFuture`, `finalWarnings`, `buildRunWalkAdjustment`, `assessRunWalkProgress`,
`qualityEntryGate`, `hasRecentMeasuredForm`, `planWithNewGoal`, `planRecalibrated`, `recalibratedPlan`, `reentryPlan`,
`mergeOverrides`, `RECALIBRATION_MIN_WEEKS_LEFT`, `graftFuturePlan`, `alignAutomaticOverlays`, `vdotProposal`,
`applyVdotProposal`, `undoVdotAdjustments`, `planVdotNow`, `fitnessEvidence`; za testove: `resolvePlan`, `matchPlanRows`,
`sessKm`, `sessDesc`, `t3kVdot` (lokalne kopije). Isti ugovor kao 5K (`PlanGenerator` u `select.ts`), druga implementacija.

### Gde je stari zajednički mehanizam menjao 10K sesiju — sada lokalno u `tenK/`

| Mehanizam | Gde je sada (lokalno) |
|---|---|
| doziranje (uvodna sesija, iskusni, 60/40 deljenje praga, budžeti zona) | `training/distances/qualityDose.ts` (`introductoryQuality`, `applyQualityDose`), poziva ga `profile10k.buildQuality10K` |
| doza u deloadu | `training/sessions/deload.ts` (`reducedQualityForDeload`) + skaliranje WU/CD u `generatePlan.ts` |
| skraćivanje (zone, neprekidni prag) | `training/sessions/constraints.ts` (`constrainSession`, `constrainWeek`, `tempoMaxSec` iz `HEURISTIC_10K`) |
| nedeljni obuhvat brzog rada | `training/generator/weeklyLoad.ts` (`weeklyFastEnvelopeSec`, `sessionLoadSec`) + petlja skraćivanja u `generatePlan.ts` |
| dopunjavanje zagrevanja/rastrčavanja | `generatePlan.ts` („PRODUŽENO ZAGREVANJE", `wuCdMaxExtraKm`) |
| nedeljni limiti | `generatePlan.ts`: plafon udela LR (`clampLongRun`, `finalizeWeek`), taper limit, isporučeni rast (`DELIVERED_GROWTH_FACTOR`), deload limit |
| finalizacija posle adaptacije | `plan/finalize.ts` (`finalizeFuturePlan`, `deliveredWeeks`), `plan/future.ts` (`graftFuturePlan`), `plan/returnGrowth.ts`, `plan/fatigueRecovery.ts`, `plan/regenerate.ts` (`finalWarnings`) |

### Uklonjene grane (10K ih ne aktivira) i dokaz

Dokaz neaktivnosti: `HEURISTIC_10K`/`PRODUCT_10K`/`PROFILE_10K` (stari, neizmenjeni) ne definišu `taperWeeks`, `firstTaperFactor`,
`midweekLong`, `baseLongRunStart`, `fuelFromMin`, `fuelStrongFromMin`, `easyAfterLongRun`, `recommendedMinRunDays`,
`paceStrategy`, `longRunFinish`, `singleQualityWeek`, `trimPriority`, `weeklyFastShare`, `longRunCycle`;
`intervalPaceForWeek` je identitet; `chooseQuality10K` nikad ne pravi „Kontrolna trka" ni zonu M (`progressionRun` bez
`atRacePace`). Posle uklanjanja poređenje sa referencom je ostalo identično (v. Validacija).

- `generatePlan.ts`: druga taper nedelja (`isTaper2`, `firstTaperFactor`), srednje-dugo trčanje (MLR) u svim nedeljama i u
  trkačkoj nedelji, brz završetak dugog trčanja, „jedan kvalitet uz zahtevnu dugu", kontrolna trka (`hasTrial`), lak dan posle
  zahtevne duge, ciklus dugog trčanja, upozorenje o preporučenom minimumu dana, uputstvo za gorivo, maratonska konsolidacija,
  `intervalPaceForWeek`, M-težina u obuhvatu brzog rada, sopstveni udeo i redosled skraćivanja profila. Poruka greške za
  nepodržanu distancu je sada 10K-specifična (put nedostupan iz aplikacije: izbor nikad ne šalje drugu distancu u `tenK`).
- `allocation.ts` (MLR udeo), `daySlots.ts` (MLR slot i upozorenje), `focus.ts` (`isTaper2`, brz završetak u `weekFocus`),
  `weeklyLoad.ts` (`finishLoadSec`, M-težina, `share`), `longRunProgression.ts` (maratonska konsolidacija),
  `athleteAssessment.assessPreparation` (pravila dužine 16/26 km i razlozi za HM/maraton), `sessions/progression.ts`
  (tempo trke/M varijanta), `sessions/longRun.ts` (gorivo; obrisan), `plan/describe.ts` (gorivo), `distances/qualityDose.ts`
  (`taperTransition`), `distances/types.ts` (opcione strategije i HM kontekst), `constants/distances.ts` (parametri 5K/HM/M i
  opciona polja), `distances/index.ts` (samo 10K profil), obrisani `profile5k.ts`, `profile21k.ts`, `profile42k.ts`,
  `hmProgression.ts`.
- `plan/executionAdjustment.ts`: grana odluke o ograničenoj pripremi (`isLimitedLongPreparation` važi samo za
  `raceDistM ≥ 21097`). `DecisionBasis` je lokalni tip; nema uvoza `preparationDecision`.

**Namerno zadržano** (čitanje podataka, ne trenerska grana druge distance): provere `mlr`/`finish`/zone `M` u `plan/describe.ts`,
`plan/finalize.ts`, `plan/resolve.ts`, `assessPreparation`, `prediction`, `vdot/paceForZone.ts`, `zoneForKind.ts`,
`sessions/prescription.ts`, `adaptation/{chain,matching}.ts`. Razlog: 10K adaptacija dobija i plan nastao iz polumaratona ili
maratona (opcija „kraća distanca: 10K"), čiji zaštićeni prošli dani ostaju polumaratonski/maratonski i moraju se pročitati i
sačuvati kakvi jesu.

Razlika prema izvoru po fajlu (posle prettier-a): 31 fajl identičan; 16 se razlikuje samo u putanji uvoza tipova
(`exchange.ts`); `plan/edit.ts` i `date/index.ts` samo u uvozima (lokalni `state/records.ts`, tip `IsoDate` iz `exchange.ts`);
izmene logike su u 16 fajlova popisanih gore; novi su `index.ts`, `exchange.ts`, `state/records.ts`.

## Izbor generatora i povezane putanje

- `generators/select.ts`: `TEN_K_GENERATOR`, `GeneratorId = '5k' | '10k' | 'legacy'`, `generatorIdFor(10000) → '10k'`. Pravilo
  izbora: tačno `10000` m (ulaz ili `meta.raceDistM ?? ulaz.raceDistM`). Sve produkcione putanje iz tabele segmenta 1
  (čarobnjak, upozorenja čarobnjaka, promena cilja, rekalibracija, predlog/primena/poništavanje tempa, prilagođavanje prema
  izvršenju, run/walk, kapija kvaliteta, vraćanje verzije, poravnanje automatskih izmena, prikaz forme) već idu kroz
  `generatorForDistance`/`generatorForPlan`/`productFor`, pa sada za 10K plan idu u `tenK` — bez izmena u store-ovima i ekranima.
- `generators/handoff.ts`: „kraća distanca: 10K" iz odluke o pripremi polumaratona/maratona sada pravi `tenK.regenerateFuture`
  (ranije samo 5K). `domain/plan/preparationDecision.ts`: izmenjen samo komentar.
- Proveren je ceo `src/` (van testova): nijedan ekran, store ni servis ne uvozi stare izvršne module generisanja/adaptacije
  (`plan/{regenerate,replan,future,executionAdjustment,runWalkAdjustment,automaticAlts,adapt,finalize,…}`,
  `training/{generator,runWalkProgress,qualityGate,adaptation/proposal}`) mimo izbora generatora.

## Zaštita podataka

Bez migracije, bez promene šeme, bez automatske regeneracije sačuvanih planova (izbor se primenjuje tek na sledeću radnju
korisnika). Tehnička zaštita istorije ostaje u 10K kopiji `plan/future.ts`/`finalize.ts`, kao u izvoru i kao kod 5K.
Revizije (`domain/plan/versions.ts`), `commitPlanChange` i skladište ostaju aplikacioni i ne sadrže trenerske odluke.
Dokaz: (1) referentni tokovi sa zaštitom (budući odrađen dan, ručna sesija sa `overrides`, ručna izmena `alts`, merom
zaključan red `pred`/`predLock`, pomeranja) identični; (2) `features/onboarding/tenKFlow.test.tsx`: stvaran tok kroz
čarobnjak (izbor 10K) → generisanje → prikaz → čuvanje/učitavanje kroz pravo skladište → povratak posle pauze → vraćanje
verzije → promena cilja; odrađeni dani, stvarna merenja, pomeren dan, ručna izmena, zaključan red, `log/alts/moves/pred/predLock`,
upozorenje o konfliktu i revizija ostaju; brojač poziva starog mehanizma = 0.

## Dokazi nezavisnosti

`web/src/domain/generators/tenK/isolation.node.test.ts` (14 testova; proverivač dupliran iz 5K, 5K test nije menjan):
paket/alias, izlaz iz `tenK/` mimo `exchange.ts` (samo tipovi iz `domain/state` i `domain/date`), dinamički uvoz,
nedeterminizam, tranzitivno zatvorenje od `index.ts`, re-export (`export {…} from`, `export *`), obrnuti smer (10K uvoze samo
`select.ts` i `handoff.ts`), **međusobni uvoz generatora u oba smera (i tipom)**, odsustvo profila/parametara 5K/HM/M u 10K
stablu. Proverivač testiran na veštačkim prekršajima; na stvarnom kodu: privremeni re-export starog `generatePlan` u
`tenK/plan/future.ts` → 10K test pao; privremeni uvoz tipa iz `fiveK/exchange` → pala i 10K pravila i pravila 5K testa
(3 testa); oba vraćena (`diff` potvrdio).

Obrnuta nezavisnost: privremena izmena `HEURISTIC_10K.deloadFactor` 0,75→0,6 u **starom** `domain/training/constants/distances.ts`
→ 10K ekvivalencija i dalje zelena (10K više ne čita stari mehanizam); vraćeno `git checkout`.

## Referentni ulazi i rezultati (10K)

| Šta | Gde |
|---|---|
| 10K scenariji | `web/src/test/tenK/scenarios.ts` |
| referenca i snimanje | `web/src/test/tenK/reference.ts`, `captureReference.node.test.ts`, `web/src/test/fixtures/tenK-reference.json.gz` |
| poređenje | `web/src/domain/generators/tenK/equivalence.node.test.ts` |

Ulazi: 10K deo matrice golden master-a (576), 10K ulazi iz `docs/qa/{generator-final,generator-ab,generator-phase1,generator-phase2}/inputs.json`
(10 jedinstvenih), 400 determinističkih slučajnih (mulberry32, seme 10010; dani, raspored, istorija, run/walk lestvica,
spremnost, zastareo rezultat), 114 graničnih/neispravnih (trka +0…13 dana i 3…30 nedelja, svi dani početka, obim 0…1000,
dani 0…8/NaN, kvalitet 0…3, sve kombinacije intenziteta, PB 3K/5K/HM/M/brz/spor/zastareo/svež, ciljevi, početnik, povratak
kratak/srednji/dug, iskustvo, dužine, rasporedi i sukobi, lestvice, umor/smanjen obim/povratna spremnost). Ukupno **1 100
generisanja**. Adaptacija: isti tokovi kao za 5K nad 43 bazna 10K ulaza (40 planova; za 3 se poredi greška generisanja) (3 datuma × 7 konteksta: bez dnevnika, odrađeno, U01
propušten, U02 podizvršenje, U03 RPE 8, pauza, zaštita) + originalni 10K QA događaji U04 i U06 (potvrđena pauza, zabeležena i
ponovo izračunata analiza) i U05 (promena cilja) iz `docs/qa/generator-ab/users/`. Ukupno **14 267 adaptacionih tokova**.
Odluke o pripremi HM/M sa opcijom „kraća distanca: 10K": 13 izbora + same odluke, u referenci ostalih distanci.

Referenca je uzeta **iz starog mehanizma pre bilo kakve izmene produkcionog koda** (na `f745be0`), zatim ponovo u čistom
`git worktree`-u na `05088e0` (izvorni `main`, bez segmenta 1) — **bajt-identična** (`cmp`). Zapisano u fajlu: `baselineSha`
`f745be0…`, `crossCheckedSha` `05088e0…`. Test poređenja nikad ne osvežava referencu iz novog koda.

Poređenje: tačan zapis celog izlaza (`fiveK/exact.ts`), **nijedno polje nije isključeno**, ništa se ne zaokružuje; proverava se
i čistoća (ulazi nepromenjeni). Vreme/zona/slučajnost: generisanje (edge, qa, 8-nedeljni deo matrice) i adaptacija (3 bazna
plana) ponovljeni pod `TZ` Pacific/Kiritimati, America/Los_Angeles, Asia/Kolkata, UTC uz `Math.random`, `Date.now` i
`new Date()` bez argumenta koji bacaju izuzetak — identično. Osetljivost: `HEURISTIC_10K.deloadFactor` 0,75→0,76 u 10K
kopiji → generisanje palo [km, warnings]; `RETURN_POLICY.medium.fraction` 0,7→0,71 → adaptacija pala [dates, km, rest,
warnings, adaptation, other]; obe vraćene.

## Izmenjena postojeća očekivanja (i zašto to nije prilagođavanje testu)

- `generators/otherDistances.node.test.ts`, test izbora: `generatorIdFor(10000)` je bio `'legacy'` → sada `'10k'`. To je pravilo
  izbora iz segmenta 1, koje ovaj segment po zadatku menja; trenerska očekivanja (referenca 10K/HM/M) nisu dirana i ostala su
  identična. Dodata provera da postoji >10 odluka „kraća distanca: 10K".
- `features/onboarding/fiveKFlow.test.tsx`, kontrola brojača: plan „deklarisan kao 10K" je trebalo da ide starom mehanizmu;
  posle izdvajanja 10K to više nije tačno, pa je kontrola prebačena na polumaraton (i dalje stari mehanizam). 5K deo testa nije
  menjan. Ovo je funkcionalno neophodna izmena, ne stilska.

## Provere i rezultati (segment 2, poslednji prolaz)

| Komanda (iz `web/`, osim gde piše) | Rezultat |
|---|---|
| polazno: `npm run check` na `f745be0` | zeleno; vitest 153 fajla / 1 553 testa |
| `npm run check` (typecheck + lint + prettier + vitest) | zeleno; vitest **157 fajlova / 1 574 testa** |
| `npx vitest run --project node tenK/equivalence` | 4/4 — 1 100 generisanja, 14 267 tokova adaptacije, TZ/sat/slučajnost identični |
| `npx vitest run --project node tenK/isolation fiveK/isolation` | 24/24 (10K: 14, 5K: 10) |
| `npx vitest run --project node fiveK/equivalence` | 4/4 — 5K nepromenjen |
| `npx vitest run --project node generators/otherDistances` | 3/3 — 10K/HM/maraton (2 211 generisanja, 17 638 tokova, 157 odluka, uklj. 13 „kraća distanca: 10K" kroz `tenK`) identični |
| `npx vitest run --project ui Flow.test` | 4/4 — 10K i 5K stvarni tokovi; brojač starog mehanizma 0; kontrola HM koristi stari |
| `node --test "**/*.test.mjs"` (iz `test/`) | 396/396 |
| `npx playwright test` | **77/77** (6,0 min, jedan prolaz). 10K kroz pregledač: `plan.spec.ts` (čarobnjak sa izborom 10K, kratka priprema, čuvanje, ponovno učitavanje) i `generator-ab-users.spec.ts` (svi profili iz `docs/qa/generator-ab/inputs.json`, među njima 10K U04–U06). PWA testovi označeni kao nestabilni u segmentu 1 su ovaj put prošli; nije ponavljano. |

## Šta HM i maraton još koriste iz starog mehanizma

1. **Sve** generisanje i adaptacija polumaratona i maratona: `domain/training/**` i `domain/plan/**`, uključujući
   `preparationDecision.ts` (odluka o ograničenoj pripremi; opcije 5K/10K predaje izdvojenim generatorima kroz `handoff.ts`).
   Stari mehanizam i dalje sadrži i 5K/10K profile i grane; niko ih iz aplikacije više ne poziva za 5K/10K planove, ali ostaju
   do segmenta 5 (testovi `legacyApi`, golden master `generator.fingerprint`, ugrađeni lični plan).
2. Ugrađeni lični plan vlasnika (`genPlan === null`, polumaraton).
3. Prikazni i merni sloj (lanac forme, `currentVdot`, `effectivePace`, `predRowsForDay`, prikaz/izvoz treninga,
   `useEasyPace`, `planPreviewChanges.sessQKm`, `formPreview`) i dalje koristi deljene funkcije **za sve distance, uključujući
   5K i 10K planove** — isto stanje kao posle segmenta 1 (§3 gore). Nisu putanje generisanja ni adaptacije; vlasnik se određuje
   u segmentu 5.

## Kriterijum završetka segmenta 2

| Merilo | Stanje |
|---|---|
| 10K samostalno generiše plan | ispunjeno |
| 10K samostalno adaptira (izvršenje, pauza, umor, run/walk, cilj, rekalibracija, predlog tempa, vraćanje verzije, poravnanje) | ispunjeno |
| HM/M „kraća distanca: 10K" ide kroz 10K generator | ispunjeno |
| bez zabranjenih direktnih/tranzitivnih zavisnosti, bez uvoza 5K/HM/M | ispunjeno (automatski test) |
| ponašanje 10K očuvano | ispunjeno (tačno poređenje, bez isključenih polja) |
| 5K, HM, maraton nepromenjeni | ispunjeno |
| korisnički podaci zaštićeni | ispunjeno |
| prikazni/merni sloj bez starog mehanizma | **nije ispunjeno** — van obima, kao u segmentu 1 |

## Preostali rizici (segment 2)

- Namerno dupliran kod se razilazi: ispravka u starom mehanizmu ili u 5K ne važi za 10K i obrnuto. Svaka namerna trenerska
  izmena 10K mora svesno da osveži `tenK-reference.json.gz` (novim snimanjem sa obrazloženjem), a ne „popravkom" iz novog koda.
- Izbor po tačnoj vrednosti `10000`: plan sa nekonzistentnim `meta.raceDistM`/`ulaz.raceDistM` (npr. ručno uvezen backup) ide
  po `meta`; ako bi `meta` bio 10K a `ulaz` druga distanca, 10K generator vraća grešku „Nepodržana distanca" umesto da
  regeneriše drugu distancu (stari mehanizam bi je regenerisao). Takav plan aplikacija ne pravi; nije pokriveno referencom.
- 10K adaptacija čita polumaratonske/maratonske oznake (`mlr`, `finish`, zona M) samo na zaštićenim prošlim danima; ako HM/M
  segmenti uvedu nove oznake dana, 10K ih neće znati da pročita bez svesne izmene.
- Tri velika poređenja (5K, 10K, ostale distance) zajedno traju ~4 min u `npm run check`.
- `tenKFlow.test.tsx` dokazuje rutiranje obmotavanjem istih starih modula kao 5K test; `training/adaptation/evidence` nije
  obmotan (koristi ga i deljeni merni sloj).
- Test-harnes (`src/test/fiveK/*`) je zajednički za 5K i 10K testove; to je kod provere, ne izvršni kod generatora.

## Stanje radnog stabla (za segment 3)

Grana `claude/generator-isolation-5k`, commit `7966766` (na `f745be0`), pushovano; PR nije otvoren, nije spojeno u `main`. Novi fajlovi: `web/src/domain/generators/tenK/**`,
`web/src/test/tenK/**`, `web/src/test/fixtures/tenK-reference.json.gz`, `web/src/features/onboarding/tenKFlow.test.tsx`.
Izmenjeni: `web/src/domain/generators/{select,handoff}.ts`, `web/src/domain/generators/otherDistances.node.test.ts`,
`web/src/domain/plan/preparationDecision.ts` (komentar), `web/src/features/onboarding/fiveKFlow.test.tsx` (kontrola),
`web/tsconfig.{app,oracle}.json`, ovaj dokument.

Predlog za segment 3 (polumaraton): isti postupak — referenca iz starog mehanizma pre izmena; kopija zatvorenja u
`generators/halfMarathon/` (uključujući `preparationDecision`, jer pripada HM/M); `select.ts` i `handoff.ts` dobijaju HM granu;
proveriti da HM opcija „kraća distanca" i dalje predaje 5K/10K izdvojenim generatorima.
