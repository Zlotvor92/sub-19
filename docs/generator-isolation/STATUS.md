# Izdvajanje generatora — stanje

Živi dokument za predaju između prozora. Cilj: četiri nezavisna generatora (5K, 10K, HM, maraton), bez deljenih izvršnih
funkcija, trenerskog engine-a, baznih klasa, limitera i postprocesora. Zajednički ostaju samo UI, skladištenje, autentifikacija,
izbor generatora i format razmene podataka.

**Grana: `claude/generator-isolation-5k-10k`** — na njoj su odvojeni generatori za **5K** (segment 1) i **10K** (segment 2).
**Segment 3 (polumaraton)** je na istoj grani, commit `36403cf` (na `90f2d0e`), pushovano; PR nije otvoren, nije spojeno u
`main`. **Segment 4 (maraton)** je na grani **`claude/generator-isolation-5k-10k-hm-marathon`** (od `ad464c0`; sadrži i
segmente 1–3), pushovano; PR nije otvoren, nije spojeno u `main`. Grana `claude/generator-isolation-5k-10k` je ostala
na `ad464c0` (segmenti 1–3). Segment 5 uklanja stari zajednički mehanizam. Ranija grana `claude/generator-isolation-5k`
sadrži iste commitove do `a8a5baa`.

| Segment | Distanca | Stanje |
|---|---|---|
| 1/5 | 5K | **urađeno** — commit `515bba3`, grana `claude/generator-isolation-5k-10k` (prvobitno `claude/generator-isolation-5k`), bez PR-a |
| 2/5 | 10K | **urađeno** (v. „Segment 2/5 — 10K" ispod) — commit `7966766`, grana `claude/generator-isolation-5k-10k`, bez PR-a |
| 3/5 | polumaraton | **urađeno** (v. „Segment 3/5 — polumaraton" na kraju) — commit `36403cf`, grana `claude/generator-isolation-5k-10k`, bez PR-a |
| 4/5 | maraton | **urađeno** (v. „Segment 4/5 — maraton" na kraju) — grana `claude/generator-isolation-5k-10k-hm-marathon` (od `ad464c0`), bez PR-a |
| 5/5 | uklanjanje starog zajedničkog mehanizma | nije počet |

> Sekcije od „Polazna tačka" do „Stanje radnog stabla (za segment 2)" su zapis segmenta 1 (5K) i nisu prepisivane.
> Stanje posle segmenta 2 je u sekciji **„Segment 2/5 — 10K"**; aktuelno stanje posle segmenta 3 je u sekciji
> **„Segment 3/5 — polumaraton"**; aktuelno stanje posle segmenta 4 je u sekciji **„Segment 4/5 — maraton"** na kraju
> dokumenta (ranije sekcije nisu prepisivane).

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

Grana `claude/generator-isolation-5k-10k`, commit `7966766` (na `f745be0`), pushovano; PR nije otvoren, nije spojeno u `main`. Novi fajlovi: `web/src/domain/generators/tenK/**`,
`web/src/test/tenK/**`, `web/src/test/fixtures/tenK-reference.json.gz`, `web/src/features/onboarding/tenKFlow.test.tsx`.
Izmenjeni: `web/src/domain/generators/{select,handoff}.ts`, `web/src/domain/generators/otherDistances.node.test.ts`,
`web/src/domain/plan/preparationDecision.ts` (komentar), `web/src/features/onboarding/fiveKFlow.test.tsx` (kontrola),
`web/tsconfig.{app,oracle}.json`, ovaj dokument.

Predlog za segment 3 (polumaraton): isti postupak — referenca iz starog mehanizma pre izmena; kopija zatvorenja u
`generators/halfMarathon/` (uključujući `preparationDecision`, jer pripada HM/M); `select.ts` i `handoff.ts` dobijaju HM granu;
proveriti da HM opcija „kraća distanca" i dalje predaje 5K/10K izdvojenim generatorima.

---

# Segment 3/5 — polumaraton

## Polazna tačka (segment 3)

- Polazni commit: **`90f2d0e5a21524ab408ba38060347f97e9843955`** (vrh `origin/claude/generator-isolation-5k-10k`: segment 1 `515bba3`,
  segment 2 `7966766`, dokumentacija `90f2d0e`). `origin/main` je i dalje **`05088e0`** — segmenti 1 i 2 **nisu spojeni u
  `main`**; HM je zato rađen od `90f2d0e`, ne od `main` (lokalna grana `claude/generator-isolation-hm`), i na zahtev
  pushovan na `claude/generator-isolation-5k-10k` kao commit `36403cf` (bez PR-a).
- `AGENTS.md` i dalje **ne postoji**.
- Preduslovi provereni u kodu, ne u dokumentu: `generators/fiveK/` (68 izvornih fajlova) i `generators/tenK/` (68) postoje;
  `select.ts` šalje 5000 → `fiveK`, 10000 → `tenK`; testovi izolacije i ekvivalencije 5K/10K postoje i prolaze.
  Polazni `npm run check` u čistom worktree-ju na `90f2d0e`: **157 fajlova / 1 574 testa, zeleno**.

## Novi modul: `web/src/domain/generators/halfMarathon/`

67 izvornih fajlova, 9 155 redova (plus 2 testa). Struktura je **ogledalo izvornih putanja u `web/src/domain/`**, kao kod 5K/10K.
**Izvor kopije je stari zajednički mehanizam**, ne 5K/10K modul: zatvorenje uvoza je izračunato od starih ulaznih tačaka
(`generatePlan`, `assess`, `plan/adapt`, `executionAdjustment`, `regenerate`, `replan`, `future`, `automaticAlts`,
`runWalkAdjustment`, `runWalkProgress`, `qualityGate`, `adaptation/{proposal,evidence,matching}`, `resolve`, `sessions/calc`,
`test3k` **i `plan/preparationDecision`**), kopirano skriptom koja prepisuje samo putanje uvoza, pa su grane drugih distanci
uklonjene ručno uz poređenje posle svakog koraka.

| Oblast | Fajlovi u `halfMarathon/` |
|---|---|
| javni API / adapter / tipovi razmene | `index.ts`, `plan/adapt.ts`, `exchange.ts` (samo `export type`) |
| ulazna validacija, procena trkača i spremnosti (staza `first`/`performance`) | `training/generator/{validateInput,athleteAssessment,assess,formPolicy}.ts`, `distances/hmProgression.ts` (`hmTrack`) |
| tempo i zone | `training/vdot/*`, `training/prediction/index.ts`, `training/sessions/prescription.ts` |
| kilometraža, progresija, periodizacija | `training/generator/{volume,weeklyLoad,longRunProgression,allocation}.ts`, `generatePlan.ts`, `distances/profile21k.ts` (`phase21K`) |
| raspored treninga i oporavka, srednje-dugo (MLR) | `training/generator/{daySlots,focus}.ts`, `generatePlan.ts` (`limitEasyAfterLongRun`) |
| prag, HM ritam, intervali, kontrolna trka | `distances/profile21k.ts` (`chooseQuality21K`, `mkTimeTrial`, `mkIntervals`), `distances/hmProgression.ts`, `sessions/{build,intervals}.ts` |
| limiti i pravila kvaliteta | `distances/qualityDose.ts`, `sessions/constraints.ts`, `generator/weeklyLoad.ts` (omotač), `generatePlan.ts` (petlja skraćivanja) |
| dužine, gorivo, brz završetak | `generator/longRunProgression.ts`, `sessions/longRun.ts` (`fuelText`), `profile21k.longRunFinish21K` |
| rasterećenje, dvonedeljni taper, nedelja trke | `generatePlan.ts` (`isTaper1`/`isTaper2`, protokol −3/−2/−1), `sessions/deload.ts`, `hmProgression.HM_TAPER` |
| kratka priprema, povratak, run/walk | `generatePlan.ts`, `generator/runWalk.ts`, `plan/{regenerate,returnGrowth,fatigueRecovery}.ts` |
| adaptacija, rekalibracija, promena cilja, vraćanje verzije | `plan/{executionAdjustment,regenerate,replan,future,automaticAlts,runWalkAdjustment,finalize}.ts`, `training/{execution,runWalkProgress,qualityGate}.ts`, `training/adaptation/*`, `training/test3k` |
| **odluka o ograničenoj pripremi** (produženje, kraća distanca, povratni režim) | `plan/preparationDecision.ts` |
| opisi, upozorenja | `plan/{describe,finalize,resolve,edit,baseline,types}.ts`, `training/sessions/calc.ts` |
| konstante | `training/constants/{distances,heuristics,product,evidence}.ts` (u `distances.ts` samo HM) |
| pomoćne funkcije | `date/index.ts`, `format/index.ts`, `state/ids.ts`, `state/records.ts` (DAY_TAGS, STRENGTH_WITH, cleanRunWalk iz `domain/state`) |
| testovi | `equivalence.node.test.ts`, `isolation.node.test.ts` |

### Javni API (`halfMarathon/index.ts`)

`HALF_MARATHON_DISTANCE_M`, `HALF_MARATHON_PRODUCT`, `generatePlan`, `assess`, `adaptGeneratedPlan`, `executionModel`,
`executionBasis`, `buildExecutionAdjustment`, `regenerateFuture`, `finalWarnings`, `buildRunWalkAdjustment`,
`assessRunWalkProgress`, `qualityEntryGate`, `hasRecentMeasuredForm`, `planWithNewGoal`, `planRecalibrated`, `recalibratedPlan`,
`reentryPlan`, `mergeOverrides`, `RECALIBRATION_MIN_WEEKS_LEFT`, `graftFuturePlan`, `alignAutomaticOverlays`, `vdotProposal`,
`applyVdotProposal`, `undoVdotAdjustments`, `planVdotNow`, `fitnessEvidence`; **odluka o pripremi**: `basisFromPlan`,
`preparationDecision`, `buildPreparationChoice`, `buildReturnBase`, `isLimitedLongPreparation`, tipovi `DecisionBasis`,
`PreparationChoice`, `PreparationDecision`, `ShorterDistanceHandoff`; za testove: `resolvePlan`, `matchPlanRows`, `sessKm`,
`sessDesc`, `t3kVdot` (lokalne kopije).

### Predaja kraće distance bez međusobnog uvoza generatora

HM odluka nudi „kraća distanca: 10K/5K istog datuma". Plan te distance mora da napravi generator te distance, a HM ga ne sme
uvesti. Rešenje: `preparationDecision`, `buildPreparationChoice` i `buildExecutionAdjustment` HM generatora imaju **obavezan**
poslednji argument `handoff: ShorterDistanceHandoff` (funkcija distanca → `regenerateFuture` drugog generatora ili `null`).
Vezuje ga samo aplikacioni sloj: `select.ts` (`HALF_MARATHON_GENERATOR.buildExecutionAdjustment`,
`HALF_MARATHON_PREPARATION`) prosleđuje `handoff.regeneratorForDistance`. Za sopstvenu distancu (produženje datuma) HM uvek
koristi svoj `regenerateFuture`. Ime ponuđene kraće distance HM čita iz plana koji je napravio drugi generator
(`meta.raceName`), pa u HM stablu nema proizvodnih podataka 10K/5K.

### Uklonjene grane (HM ih ne aktivira) i dokaz

Dokaz neaktivnosti: `PROFILE_21K` je imao `intervalPaceForWeek: (pI) => pI` (identitet) i nije definisao `longRunCycle`;
`HEURISTIC_21K` ne definiše `fuelStrongFromMin` ni `marathonPaceBudget`; HM kvalitet (`chooseQuality21K`, `introductoryQuality`,
`fartlek`, `intervalsOf`) i brz završetak (`longRunFinish21K`, zona `RP`) nikad ne prave zonu `M`. Posle uklanjanja poređenje
sa referencom je ostalo identično (v. Validacija).

- obrisani `training/distances/profile5k.ts`, `profile10k.ts`, `profile42k.ts`; zatim nedostižni `sessions/{cruise,progression,repetitions,tempo}.ts`;
- `constants/distances.ts`: samo `PRODUCT_21K`/`HEURISTIC_21K`, bez polja `fuelStrongFromMin`; `distances/index.ts`: samo HM profil;
  `distances/types.ts`: `Phase` = `threshold | peak | specific`, HM strategije obavezne, bez `intervalPaceForWeek` i `longRunCycle`;
- `generatePlan.ts`: poruka greške za drugu distancu je HM-specifična; uklonjeni ciklus dugog trčanja (`longRunCycle`),
  `marathon:` zastavica, `intervalPaceForWeek`, M-težina u petlji omotača i „maratonski" opis završetka;
- `longRunProgression.ts`: maratonska konsolidacija; `weeklyLoad.ts`: M-težina 0,5; `sessions/longRun.ts`: jača maratonska
  preporuka goriva; `athleteAssessment.assessPreparation`: pravilo dužine 26 km (maraton);
- `plan/preparationDecision.ts`: `SHORTER` samo `21097.5 → [10000, 5000]`, pravilo dužine 26 km, uvoz `generators/handoff`
  (zamenjen argumentom).

**Namerno zadržano** (čitanje podataka, ne trenerska grana druge distance): zona `M`, `mlr`, `finish` i `RaceDistanceM` sa 42195 u
`plan/{describe,finalize,resolve}.ts`, `vdot/{paceForZone,zoneForKind}.ts`, `sessions/prescription.ts`,
`adaptation/{chain,matching}.ts`. Razlog: maratonska odluka „kraća distanca: polumaraton" sada ide HM generatoru, a zaštićeni
prošli dani tog plana ostaju maratonski i moraju se pročitati i sačuvati kakvi jesu.

Razlika prema izvoru (bez linija uvoza): 52 fajla identična; izmenjeni su samo `date/index.ts` (tip `IsoDate` iz
`exchange.ts`), `plan/{executionAdjustment,preparationDecision}.ts`, `training/constants/distances.ts`,
`training/distances/{index,profile21k,types}.ts`, `training/generator/{athleteAssessment,generatePlan,longRunProgression,weeklyLoad}.ts`,
`training/sessions/longRun.ts`; novi su `index.ts`, `exchange.ts`, `state/records.ts`.

## Izbor generatora i povezane putanje

- `generators/select.ts`: `HALF_MARATHON_GENERATOR`, `GeneratorId = '5k' | '10k' | 'hm' | 'legacy'`, `generatorIdFor(21097.5) → 'hm'`
  (tačna vrednost). Sve produkcione putanje iz tabele segmenta 1 (čarobnjak, upozorenja čarobnjaka, promena cilja,
  rekalibracija, predlog/primena/poništavanje tempa, prilagođavanje prema izvršenju, run/walk, kapija kvaliteta, vraćanje
  verzije, poravnanje automatskih izmena, prikaz forme) već idu kroz `generatorForDistance`/`generatorForPlan`/`productFor`,
  pa za HM plan sada idu u `halfMarathon`.
- **Nova putanja**: odluka o ograničenoj pripremi nad sačuvanim planom (`stores/executionActions.storedPreparationDecision`,
  `previewPreparationChoice`) je ranije direktno zvala stari `domain/plan/preparationDecision`. Sada ide kroz
  `select.preparationForPlan(plan)`: HM plan → `HALF_MARATHON_PREPARATION`; maraton, 5K/10K i lični plan → `LEGACY_PREPARATION`
  (isto kao pre). Odluka iz izvršenja (`buildExecutionAdjustment`) je već bila po generatoru.
- `generators/handoff.ts`: dodat polumaraton (`21097.5 → halfMarathon.regenerateFuture`), pa i **maratonska** opcija
  „kraća distanca: polumaraton" (stari mehanizam) sada pravi izdvojeni HM generator.
- `domain/plan/preparationDecision.ts` (stari) nije menjan.

## Zaštita podataka

Bez migracije, bez promene šeme, bez automatske regeneracije sačuvanih planova: izbor generatora se primenjuje tek na
sledeću radnju korisnika. Lokalna trenerska adaptacija (koji budući dan se menja, kako) je u HM kopiji
`plan/{regenerate,future,finalize,returnGrowth,fatigueRecovery}.ts`; tehnička zaštita istorije pri upisu (koji dan je
zaštićen — prošli, odrađen, ručno izmenjen, pomeren, zaključan merenjem —, prenos ID-jeva, zadržavanje `pred`/`qs`, beleženje
konflikata) ostaje uz nju u `graftFuturePlan`, kao u izvoru i kod 5K/10K (nije razdvajana: razdvajanje nije potrebno za
izolaciju, a doslovna kopija je dokazano identična). Pisanje u skladište, revizije (`domain/plan/versions.ts`) i
`commitPlanChange` ostaju aplikacioni i ne donose trenerske odluke.

Dokaz: (1) referentni tokovi sa zaštitom (budući odrađen dan, ručna sesija sa `overrides`, ručna izmena `alts`, merom
zaključan red `pred`/`predLock`, pomeranja u prošlost i budućnost) identični; (2) `features/onboarding/halfMarathonFlow.test.tsx`:
stvaran tok kroz čarobnjak (izbor „Polumaraton") → generisanje → prikaz → čuvanje/učitavanje kroz pravo skladište → povratak
posle pauze → vraćanje verzije → promena cilja (`1:55:00`) → odluka o ograničenoj pripremi nad sačuvanim planom (identična
direktnom HM pozivu) → „kraća distanca: 10K" (identična direktnom HM pozivu sa predajom; plan posle toga pripada 10K
generatoru); odrađeni dani, stvarna merenja, pomeren dan, ručna izmena, zaključan red, `log/alts/moves/pred/predLock`, upozorenje
o konfliktu i revizija ostaju; brojač poziva starog mehanizma (uključujući stari `preparationDecision`) = 0; kontrola: plan
deklarisan kao maraton i dalje poziva stari mehanizam (i stari `preparationDecision`).

## Dokazi nezavisnosti

`web/src/domain/generators/halfMarathon/isolation.node.test.ts` (16 testova; proverivač dupliran iz 10K, 5K/10K testovi nisu
menjani): paket/alias, izlaz iz `halfMarathon/` mimo `exchange.ts` (samo tipovi iz `domain/state` i `domain/date`), dinamički
uvoz, nedeterminizam, tranzitivno zatvorenje od `index.ts`, re-export (`export {…} from`, `export *`), obrnuti smer (HM uvoze
samo `select.ts` i `handoff.ts`), uvoz `handoff`/`select` iz HM, uvoz/re-export starog `preparationDecision`, **međusobni uvoz
sva tri izdvojena generatora (5K, 10K, HM) u svim smerovima, i tipom**, odsustvo profila/parametara 5K/10K/maratona i
maratonskih grana u HM stablu, HM odluka zna samo za `21097.5 → [10000, 5000]` i dobija predaju kao argument. Proverivač
testiran na veštačkim prekršajima; na stvarnom kodu: privremeni re-export starog `preparationDecision` u
`halfMarathon/plan/future.ts` → HM test pao; privremeni uvoz tipa iz `tenK/exchange` u HM → pala 3 testa (2 HM, 1 10K
„obrnuto"); oba vraćena.

Obrnuta nezavisnost: privremena izmena `HEURISTIC_21K.deloadFactor` 0,76→0,6 u **starom** `domain/training/constants/distances.ts`
→ HM generisanje i dalje identično referenci (HM više ne čita stari mehanizam); vraćeno `git checkout`.

## Referentni ulazi i rezultati (HM)

| Šta | Gde |
|---|---|
| HM scenariji (generisanje, adaptacija, taper, QA događaj, odluke o pripremi) | `web/src/test/halfMarathon/scenarios.ts` |
| referenca i snimanje | `web/src/test/halfMarathon/{reference.ts,captureReference.node.test.ts}`, `web/src/test/fixtures/halfMarathon-reference.json.gz` |
| poređenje | `web/src/domain/generators/halfMarathon/equivalence.node.test.ts` |

Generisanje — **1 826 ulaza**: HM deo matrice golden master-a (576; svi sa dva kvaliteta i bez iskustva, pa ne pokrivaju
stazu `performance`), HM ulazi iz `docs/qa/{generator-final,generator-ab,generator-phase1,generator-phase2}/inputs.json`,
**matrica HM politike** (512: staza `first`/`performance` × 1/2 kvaliteta × 4–24 nedelje × 3–6 dana × 28–75 km), 500
determinističkih slučajnih (mulberry32, seme 21975; ispravne vrednosti `qualityExperience` uključujući `experienced`,
kontinuitet 0–60 ned.) i granični/neispravni: trka +0…13 dana i 2…30 nedelja (sa 1 i 2 kvaliteta, sa i bez iskustva), svi dani
početka, obim 0…1000 uključujući pragove 30 (drugi kvalitet) i 45 (MLR/vrhunac), dani 0…8/NaN, kvalitet 0…3, intenziteti,
**iskustvo sa kvalitetom × kontinuitet** (odvojeni ulazi), strategije ritma (< 80, 80–110, > 110 min), dužine 4…30 km, MLR,
PB 5K/10K/HM/M, zastareo/bez datuma, ciljevi, početnik, povratak, rasporedi, lestvice, umor/smanjen obim/povratna spremnost.

Adaptacija — **27 596 tokova**: isti tokovi kao za 5K/10K (U01 propušten, U02 podizvršenje, U03 RPE 8, pauza 10/21/40 dana,
manji obim, zaštitni izazov iz U02-probe, promena cilja, rekalibracija, run/walk, predlog/primena/poništavanje tempa,
vraćanje verzije, poravnanje) nad 75 HM baznih ulaza (QA, slučajni, iz matrice politike i granični; `hmAdaptationBases`) na tri datuma, plus **taper i nedelja trke** (danas = trka −12 i −5 dana:
model izvršenja, prilagođavanje, promena cilja, rekalibracija — 900 tokova) i originalni HM QA događaj **U07**
(`docs/qa/generator-ab/users/U07-event.json`; U08 nema plan u zapisu, U09 je maraton).

Odluke o pripremi — **519 zapisa** nad 83 bazna ulaza: ograničeni HM planovi (mali obim, kratka priprema, početnik, povratak, malo dana), odluka,
svaka ponuđena opcija (produženje 31, kraća distanca 10K 38 i 5K 14 zapisa), **odluka nad sačuvanim planom u povratnom režimu**
(61) i osnova izvršenja posle pauze (`executionBasis`).

Referenca je uzeta **iz starog mehanizma pre bilo kakve izmene produkcionog koda** (na `90f2d0e`, u radnom stablu), zatim
ponovo u čistom `git worktree`-u na `05088e0` (izvorni `main`, bez segmenata 1–2; tamo stari mehanizam sam pravi i 10K/5K
opcije) — **bajt-identična** (`cmp`). Zapisano: `baselineSha` `90f2d0e…`, `crossCheckedSha` `05088e0…` (polje dodato posle
`cmp`; podaci provereno isti). Test poređenja nikad ne osvežava referencu iz novog koda.

Poređenje: tačan zapis celog izlaza (`fiveK/exact.ts`), **nijedno polje nije isključeno**, ništa se ne zaokružuje; proverava se
i čistoća (ulazi nepromenjeni). Opcije 10K/5K se porede kroz stvarnu predaju (`handoff.ts`) izdvojenim 10K/5K generatorima.
Vreme/zona/slučajnost: generisanje (edge, qa, matrica politike 7 i 14 nedelja) i adaptacija (3 bazna plana + taper) ponovljeni
pod `TZ` Pacific/Kiritimati, America/Los_Angeles, Asia/Kolkata, UTC uz `Math.random`, `Date.now` i `new Date()` bez argumenta
koji bacaju izuzetak — identično.

Osetljivost (sve vraćeno): `HEURISTIC_21K.deloadFactor` 0,76→0,77 → generisanje palo [km, warnings]; `HM_TRACKS.performance.t.startMin`
18→19 → palo [km, warnings, other]; `HM_TAPER.final.rp` 0,4→0,42 → palo; `RETURN_POLICY.medium.fraction` 0,7→0,71 → adaptacija
pala [dates, km, segments, pace, rest, taper, warnings, adaptation, other]; izlaganje dužini 0,85→0,86 u HM
`preparationDecision` → odluke pale.

## Izmenjena postojeća očekivanja (i zašto to nije prilagođavanje testu)

- `generators/otherDistances.node.test.ts`, test izbora: `generatorIdFor(21097.5)` je bio `'legacy'` → sada `'hm'`; dodato da
  21097/21098 i 42195 ostaju `legacy` i provere `preparationForPlan`. Poređenje 10K/HM/M sa referencom polaznog commita sada
  ide i kroz `preparationForPlan` (HM odluke kroz HM generator); referenca nije dirana i ostala je identična. Dodata provera da
  postoji maratonska opcija „kraća distanca: polumaraton" (ide HM generatoru).
- `features/onboarding/{fiveKFlow,tenKFlow}.test.tsx`, kontrola brojača: plan „deklarisan kao polumaraton" je trebalo da ide
  starom mehanizmu; posle izdvajanja HM to više nije tačno, pa je kontrola prebačena na maraton (i dalje stari mehanizam).
  5K/10K delovi testova nisu menjani.
- Lint ispravke (11 suvišnih `as never`) su samo u novom HM test harnesu; referenca je snimljena pre njih, a poređenje
  posle njih je identično.

## Provere i rezultati (segment 3, poslednji prolaz)

| Komanda (iz `web/`, osim gde piše) | Rezultat |
|---|---|
| polazno: `npm run check` na `90f2d0e` (čist worktree) | zeleno; vitest 157 fajlova / 1 574 testa |
| `npm run typecheck`, `npm run lint`, `npm run format:check` | zeleno |
| `npm run test` (vitest, svi projekti) | **161 fajl / 1 598 testova**, zeleno |
| `npx vitest run --project node halfMarathon/equivalence` | 5/5 — 1 826 generisanja, 27 596 tokova adaptacije, 519 odluka, TZ/sat/slučajnost identični |
| `npx vitest run --project node generators/` | 7 fajlova / 56 testova — 5K i 10K ekvivalencija i izolacija nepromenjene, HM 5+16, `otherDistances` 3/3 (10K/HM/M: 2 211 generisanja, 17 638 tokova, 157 odluka identični, sada kroz HM generator za HM) |
| `npx vitest run --project ui Flow.test` | 3 fajla / 6 testova — 5K, 10K i HM stvarni tokovi; brojač starog mehanizma 0; kontrole (maraton) koriste stari |
| `npx vitest run --project node generator.fingerprint` (u `npm run test`) | golden master nepromenjen |
| `node --test "**/*.test.mjs"` (iz `test/`) | 396/396 |
| `npx playwright test` | **77/77** (6,1 min, jedan prolaz); HM kroz pregledač: `generator-ab-users.spec.ts` (HM profili U07/U08 iz `docs/qa/generator-ab/inputs.json`), `race-analysis.spec.ts` |

## Šta maraton još koristi iz starog mehanizma

1. **Sve** generisanje i adaptacija maratona: `domain/training/**` i `domain/plan/**` (kroz `LEGACY_GENERATOR` u `select.ts`),
   uključujući stari `domain/plan/preparationDecision.ts` (`LEGACY_PREPARATION`) i odluku iz izvršenja u starom
   `domain/plan/executionAdjustment.ts`. Njegove opcije „kraća distanca" (polumaraton, 10K) prave izdvojeni HM i 10K
   generator kroz `handoff.ts`. Stari mehanizam i dalje sadrži i 5K/10K/HM profile i grane (`hmProgression.ts`,
   `profile21k.ts`…); iz aplikacije ih više niko ne poziva za 5K/10K/HM planove, ali ostaju do segmenta 5 (testovi `legacyApi`,
   golden master `generator.fingerprint`, ugrađeni lični plan, maraton).
2. **Ugrađeni lični plan vlasnika** (`genPlan === null`; po sadržaju polumaraton) i dalje ide starom mehanizmu, kao u
   segmentima 1–2. Nije prebačen na HM generator: nema `meta`/`ulaz`, nije nastao iz generatora i nije pokriven referencom;
   prebacivanje je zasebna odluka (najkasnije u segmentu 5, kada stari mehanizam nestaje).
3. Prikazni i merni sloj (lanac forme, `currentVdot`, `effectivePace`, `predRowsForDay`, prikaz/izvoz treninga,
   `useEasyPace`, `planPreviewChanges.sessQKm`, `formPreview`, **`describePoint`/imena opcija u `ExecutionAdjustment.tsx`**) i
   dalje koristi deljene funkcije za sve distance, uključujući 5K/10K/HM planove — isto stanje kao posle segmenata 1–2; nisu
   putanje generisanja ni adaptacije; vlasnik se određuje u segmentu 5.

## Ispitano HM ponašanje (stanje koda, bez ocene i bez izmene)

Brojevi su iz jednokratne sonde nad svih 1 826 HM ulaza reference (1 811 planova, 15 grešaka za neispravne ulaze); sonda nije
deo repozitorijuma.

| Tema | Gde i kako radi |
|---|---|
| izbor početničke/iskusnije putanje | `hmProgression.hmTrack`: `performance` samo za `qualityReadiness === 'experienced'`, sve ostalo `first`. `athleteAssessment.assessAthlete:32`: `experienced` = `qualityExperience === 'experienced'` **i** `consistentWeeks ≥ 8`, bez povratka, bez privremenog ograničenja, `trainedRecently !== false`. Raspodela: developing 983, beginner 386, experienced 380, returning 62. |
| iskustvo sa kvalitetom vs iskustvo na distanci | Ulaz za iskustvo **na distanci** (prethodni HM) ne postoji. Staza `first` je opisana kao „prvi polumaraton", ali se bira isključivo iz iskustva sa kvalitetom i kontinuiteta. |
| progresija praga i HM tempa | `hmCycle`/`hmTargets`: ciljne minute i dužina bloka linearno od `startMin` do `endMin` (`HM_TRACKS`); prag od 1. kvalitetne do poslednje radne nedelje, HM ritam od prve nedelje faze `peak` (`rpStartQualW`). Tempo se ne menja, samo doza. |
| minuti i kilometri | Cilj je u minutima (× `kons` 0,85), pretvara se u km preko tempa; tvrde granice su u km/s: T ≤ 10 % nedelje, RP ≤ 20 % i ≤ 12 km, neprekidan prag ≤ 30 min, nedeljni omotač `maxWorkSec`; blok do +25 % duži (`fitBlocks`); < 1,5 km neprekidnog rada → nema sesije. |
| drugi kvalitetan trening | `generatePlan`: `qCut` (vrhunac < 30 km), `frequencyQCut` (< 4 dana), `weeklyQ` (nedelja ≥ 30 km, potvrđena baza ≥ 30 km, `experienced` ili posle 2./3. kvalitetne nedelje). U 647 planova sa `quality: 2` nijedna radna nedelja nema 2 kvaliteta. |
| uticaj dužine na broj kvaliteta | `singleQualityWeek21K`: staza `first`, ≤ 4 dana i duga ≥ 90 min → jedan kvalitet; brz završetak duge (samo `experienced`, ne `kons`, specifična faza) zamenjuje q2; kontrolna trka briše q2. |
| kontrolni treninzi i izuzeci od limita | `chooseQuality21K:188`: „Kontrolna trka" 4 nedelje pred trku (3 ako je 4. deload), samo specifična faza, obim ≥ 30 km; 1 049 planova na −4, 148 na −3. Izuzeta je od doze (`progression: true`) i od nedeljnog omotača (`!hasTrial`). Progresivne HM sesije takođe zaobilaze `applyQualityDose`. |
| kvalitet u rasterećenju i taperu | deload: samo q1, `reducedQualityForDeload` prethodne sesije. Taper: dve nedelje (1 789 planova; 13 kratkih ima jednu); `isTaper2` = prelaz (`HM_TAPER.transition`), `isTaper1` = završna (`HM_TAPER.final`); protokol −3/−2/−1 („Aktivacija") pada u taper nedelju po kalendaru. |
| faze i trajanje pripreme | bazna faza samo za početnika (`baseWeeksBeginner` 10) ili povratak (1–3 ned.); `phase21K` po udelu kvalitetnih nedelja (< 0,3 prag, < 0,6 vrhunac, ostalo specifično); deload svake 4. nedelje pre poslednje radne. |
| naknadno skraćivanje/produžavanje | `constrainWeek` (zone, neprekidan prag), petlja nedeljnog omotača (skida I/R, pa T, HM ritam poslednji — `trimPriority`), „PRODUŽENO ZAGREVANJE" do +1,5 km, plafon udela duge, taper skraćuje i dugu (85 % / 65 %) i MLR (≤ 55 % duge), `limitEasyAfterLongRun`. |

## Poznati HM trenerski nedostaci (evidentirano, nije popravljano)

1. **Drugi kvalitet se vraća u prelaznoj taper nedelji.** Pravila koja svode nedelju na jedan kvalitet (`singleQualityWeek`,
   brz završetak duge, kontrolna trka) su isključena u `isTaper2` (`generatePlan.ts` uslovi `!isTaper2`), a taper format za q2
   postoji. Posledica: u **465 od 1 811** planova poslednja radna nedelja ima jedan kvalitet, a prva taper nedelja dva (npr.
   `fingerprint · HM · 4d · 30km · std · trenirao · 10n`: radna `Tempo trke` → taper `Tempo trke` + `Tempo isprekidan`).
   1 120 taper nedelja ukupno ima dva kvaliteta.
2. **Nema ulaza za iskustvo na distanci**; „prvi polumaraton" (`first`) je zapravo „bez potvrđenog iskustva sa kvalitetom ili
   kontinuiteta < 8 nedelja". Iskusan trkač koji nikad nije trčao HM dobija `performance`, a HM-iskusan bez polja
   `qualityExperience` dobija `first`.
3. **Uvodni fartlek u prelaznoj taper nedelji kratkih planova**: `introductoryQuality` isključuje samo `isTaper1`, pa u kratkim
   planovima prelazna taper nedelja može dobiti uvodni fartlek umesto HM taper formata (41 sesija u sondi).
4. Kontrolna trka je izuzeta iz doze i nedeljnog omotača i briše q2 — po dizajnu; nije ocenjeno.
5. U 647 planova sa traženim drugim kvalitetom on nijednom nije isporučen (pragovi iz tabele iznad); nije ocenjeno da li je
   to poželjno.
6. Uočeno u harnesu prethodnih segmenata (ne HM kod): 5K/10K slučajni i granični ulazi koriste `qualityExperience: 'regular'`,
   koja nije dozvoljena vrednost (`'none' | 'some' | 'experienced'`), pa tim ulazima staza `experienced` nije pokrivena (pokriva
   je samo nekoliko QA ulaza). Nije menjano, da se ne dira zamrznuta referenca 5K/10K.

## Kriterijum završetka segmenta 3

| Merilo | Stanje |
|---|---|
| HM samostalno generiše plan | ispunjeno |
| HM samostalno adaptira (izvršenje, pauza, umor, run/walk, cilj, rekalibracija, predlog tempa, vraćanje verzije, poravnanje) | ispunjeno |
| HM samostalno pravi odluku o ograničenoj pripremi (produženje, povratni režim, odluka nad sačuvanim planom) | ispunjeno; opcije 10K/5K prave izdvojeni 10K/5K generatori kroz predaju-argument |
| maratonska opcija „kraća distanca: polumaraton" ide kroz HM generator | ispunjeno |
| bez zabranjenih direktnih/tranzitivnih zavisnosti, bez međusobnog uvoza generatora | ispunjeno (automatski test, proveren veštačkim prekršajem) |
| ponašanje HM očuvano | ispunjeno (tačno poređenje, bez isključenih polja) |
| 5K, 10K, maraton nepromenjeni | ispunjeno |
| korisnički podaci zaštićeni | ispunjeno |
| ugrađeni lični plan (HM sadržaj) kroz HM generator | **nije urađeno** — ostaje stari mehanizam (§ „Šta maraton još koristi", 2) |
| prikazni/merni sloj bez starog mehanizma | **nije ispunjeno** — van obima, kao u segmentima 1–2 |

## Preostali rizici (segment 3)

- Namerno dupliran kod se razilazi; svaka namerna trenerska izmena HM mora svesno da osveži `halfMarathon-reference.json.gz`
  (novim snimanjem sa obrazloženjem).
- Izbor po tačnoj vrednosti `21097.5`; plan sa `meta.raceDistM` 21097.5 i drugačijim `ulaz.raceDistM` ide HM generatoru, koji
  za drugu distancu vraća „Nepodržana distanca" (stari mehanizam bi je regenerisao). Aplikacija takav plan ne pravi.
- `ShorterDistanceHandoff` je obavezan argument; ako se HM API zove direktno bez njega, TypeScript to odbija. Ako bi ga neko
  prosledio kao `() => null`, opcije 10K/5K bi nestale (HM ne zna da pravi 10K/5K) — bez pada, ali tiho.
- Odluka o pripremi je u `PlanGenerator` ugovoru zasebna (`preparationForPlan`), jer 5K/10K je nemaju; maratonski segment
  treba da je uključi u svoj generator na isti način.
- Četiri velika poređenja (5K, 10K, HM, ostale distance) produžavaju `npm run test` na ~7,5 min.

## Stanje radnog stabla (za segment 4)

Grana `claude/generator-isolation-5k-10k`, commit `36403cf` (na `90f2d0e`), pushovano; PR nije otvoren, nije spojeno u
`main`. Novi fajlovi:
`web/src/domain/generators/halfMarathon/**`, `web/src/test/halfMarathon/**`, `web/src/test/fixtures/halfMarathon-reference.json.gz`,
`web/src/features/onboarding/halfMarathonFlow.test.tsx`. Izmenjeni: `web/src/domain/generators/{select,handoff}.ts`,
`web/src/domain/generators/otherDistances.node.test.ts`, `web/src/stores/executionActions.ts`,
`web/src/features/onboarding/{fiveKFlow,tenKFlow}.test.tsx` (kontrola), `web/tsconfig.{app,oracle}.json`, ovaj dokument.

Predlog za segment 4 (maraton): isti postupak — referenca iz starog mehanizma pre izmena (uključujući odluke o pripremi i
opcije polumaraton/10K kroz predaju); kopija zatvorenja u `generators/marathon/` sa sopstvenim `preparationDecision` i
predajom-argumentom kao HM; `select.ts`, `handoff.ts` i `preparationForPlan` dobijaju maratonsku granu; kontrole brojača u UI
testovima tada nemaju više distancu na starom mehanizmu i treba ih zameniti proverom da je stari mehanizam nedostižan.

---

# Segment 4/5 — maraton

## Polazna tačka (segment 4)

- `origin/main` = **`05088e0440c50e866bb3bbf6246ff20fe5619f4c`** (neizmenjen od segmenta 1; segmenti 1–3 **nisu spojeni u
  `main`**). Preduslovi su zato uzeti sa `origin/claude/generator-isolation-5k-10k`.
- **Polazni SHA: `ad464c01bb3fb3e146cd27939cbe17d8a8e442e8`** (vrh `claude/generator-isolation-5k-10k`: 5K `515bba3`,
  10K `7966766`, HM `36403cf`, dokumentacija `ad464c0`). Radna grana: lokalno `claude/generator-isolation-marathon`, na
  zahtev pushovana kao `claude/generator-isolation-5k-10k-hm-marathon`.
  Radno stablo čisto na polasku; nema drugih nezavršenih izmena.
- `AGENTS.md` i dalje **ne postoji** (provereno).
- Preduslovi provereni u kodu: `generators/{fiveK,tenK,halfMarathon}/` postoje, `select.ts` šalje 5000/10000/21097.5
  izdvojenim generatorima, a 42195 starom mehanizmu; testovi izolacije i ekvivalencije 5K/10K/HM postoje.
  Polazni `npm run check`: **161 fajl / 1 598 testova, zeleno** (7,0 min).
- Po uputstvu segmenta: bez PR-a, merge-a i deploy-a. Commit i push su urađeni posle izričitog zahteva.

## Novi modul: `web/src/domain/generators/marathon/`

70 izvornih fajlova, 8 873 reda (plus 2 testa). Struktura je **ogledalo izvornih putanja u `web/src/domain/`**, kao kod
5K/10K/HM. **Izvor kopije je stari zajednički mehanizam**, ne 5K/10K/HM modul: zatvorenje uvoza je izračunato od istih
starih ulaznih tačaka kao u segmentu 3 (`generatePlan`, `assess`, `plan/adapt`, `executionAdjustment`, `regenerate`,
`replan`, `future`, `automaticAlts`, `runWalkAdjustment`, `runWalkProgress`, `qualityGate`,
`adaptation/{proposal,evidence,matching}`, `resolve`, `sessions/calc`, `test3k`, `plan/preparationDecision`; 76 fajlova
iz `training/`, `plan/`, `date/`, `format/`, `state/ids.ts`), kopirano skriptom koja prepisuje samo putanje uvoza (tipovi
`domain/state` → `exchange.ts`, pravila zapisa → lokalni `state/records.ts`, uvoz `generators/handoff` → argument), pa
su grane drugih distanci uklonjene ručno uz poređenje sa referencom.

| Oblast | Fajlovi u `marathon/` |
|---|---|
| javni API / adapter / tipovi razmene | `index.ts`, `plan/adapt.ts`, `exchange.ts` (samo `export type`) |
| ulazi, validacija, procena trkača i spremnosti (pravilo 26 km) | `training/generator/{validateInput,athleteAssessment,assess,formPolicy}.ts` |
| tempo i zone | `training/vdot/*`, `training/prediction/index.ts`, `training/sessions/prescription.ts` |
| kilometraža i progresija | `training/generator/{volume,weeklyLoad,allocation}.ts`, `generatePlan.ts` (rast, undulacija, deload, isporučeni rast) |
| faze pripreme | `training/distances/profile42k.ts` (`phase42K`: izdržljivost → prag → specifično), `generatePlan.ts` (bazna faza) |
| raspored, kvalitet, oporavak | `training/generator/{daySlots,focus}.ts`, `profile42k.ts` (`chooseQuality42K`), `distances/qualityDose.ts`, `sessions/{build,cruise,intervals,progression,repetitions,tempo,constraints}.ts` |
| dužine, konsolidacija, ciklus, završnice, srednje-dugo, gorivo | `training/generator/longRunProgression.ts`, `profile42k.ts` (`longRunCycle42K`, `longRunFinish42K`), `generatePlan.ts` (MLR, `clampLongRun`, `capAfterLongRun`), `sessions/longRun.ts` (`fuelText`) |
| rasterećenje, taper, nedelja trke | `generatePlan.ts` (dve taper nedelje, protokol −3/−2/−1), `sessions/deload.ts` |
| kratka priprema, povratak, run/walk | `generatePlan.ts`, `training/generator/runWalk.ts`, `plan/{regenerate,returnGrowth,fatigueRecovery}.ts` |
| adaptacija, rekalibracija, promena cilja, vraćanje verzije | `plan/{executionAdjustment,regenerate,replan,future,automaticAlts,runWalkAdjustment,finalize}.ts`, `training/{execution,runWalkProgress,qualityGate}.ts`, `training/adaptation/*`, `training/test3k` |
| odluka o ograničenoj pripremi (produženje, kraća distanca, povratni režim) | `plan/preparationDecision.ts` |
| obračun sesija, opisi, upozorenja | `plan/{describe,finalize,resolve,edit,baseline,types}.ts`, `training/sessions/calc.ts` |
| konstante | `training/constants/{distances,heuristics,product,evidence}.ts` (u `distances.ts` samo `PRODUCT_42K`/`HEURISTIC_42K`) |
| pomoćne funkcije (datum, format/zaokruživanje, ID, zapis) | `date/index.ts`, `format/index.ts`, `state/ids.ts`, `state/records.ts` |
| testovi | `equivalence.node.test.ts`, `isolation.node.test.ts` |

### Javni API (`marathon/index.ts`)

`MARATHON_DISTANCE_M`, `MARATHON_PRODUCT`, `generatePlan`, `assess`, `adaptGeneratedPlan`, `executionModel`, `executionBasis`,
`buildExecutionAdjustment`, `regenerateFuture`, `finalWarnings`, `buildRunWalkAdjustment`, `assessRunWalkProgress`,
`qualityEntryGate`, `hasRecentMeasuredForm`, `planWithNewGoal`, `planRecalibrated`, `recalibratedPlan`, `reentryPlan`,
`mergeOverrides`, `RECALIBRATION_MIN_WEEKS_LEFT`, `graftFuturePlan`, `alignAutomaticOverlays`, `vdotProposal`,
`applyVdotProposal`, `undoVdotAdjustments`, `planVdotNow`, `fitnessEvidence`; **odluka o pripremi**: `basisFromPlan`,
`preparationDecision`, `buildPreparationChoice`, `buildReturnBase`, `isLimitedLongPreparation`, tipovi `DecisionBasis`,
`PreparationChoice`, `PreparationDecision`, `ShorterDistanceHandoff`; za testove: `resolvePlan`, `matchPlanRows`, `sessKm`,
`sessDesc`, `t3kVdot` (lokalne kopije). Ugovor prema aplikaciji je isti `PlanGenerator`/`PreparationApi` kao kod HM.

### Predaja kraće distance bez međusobnog uvoza

Maratonska odluka nudi „kraća distanca: polumaraton/10K istog datuma". `preparationDecision`, `buildPreparationChoice` i
`buildExecutionAdjustment` maratonskog generatora imaju **obavezan** poslednji argument `handoff: ShorterDistanceHandoff`.
Vezuje ga samo `select.ts` (`MARATHON_GENERATOR.buildExecutionAdjustment`, `MARATHON_PREPARATION`) sa
`handoff.regeneratorForDistance` (21097.5 → HM, 10000 → 10K). Produženje datuma iste distance uvek pravi maratonski
`regenerateFuture`. Ime ponuđene distance čita se iz plana koji je napravio drugi generator (`meta.raceName`).
Maraton nije kraća opcija nijedne distance, pa ga `handoff.ts` **ne uvozi** (proverava test).

### Uklonjene grane (maraton ih ne aktivira) i dokaz

Dokaz neaktivnosti: `PROFILE_42K` je imao `intervalPaceForWeek: (pI) => pI` (identitet) i nije definisao `paceStrategy`,
`singleQualityWeek`, `trimPriority`, `weeklyFastShare`; `HEURISTIC_42K` nema `easyAfterLongRun` ni `racePaceBudget`;
maratonski kvalitet (`chooseQuality42K`, `introductoryQuality`, `reducedQualityForDeload`) nikad ne pravi „Kontrolna
trka"; `marathon: raceDistM === 42195` je u ovom generatoru uvek tačno. Posle uklanjanja poređenje je ostalo identično.

- obrisani `training/distances/{profile5k,profile10k,profile21k,hmProgression}.ts`;
- `constants/distances.ts`: samo `PRODUCT_42K`/`HEURISTIC_42K`; maratonska polja (`taperWeeks`, `firstTaperFactor`,
  `midweekLong`, `baseLongRunStart`, `fuelFromMin`, `fuelStrongFromMin`, `recommendedMinRunDays`) su obavezna; uklonjeno
  `easyAfterLongRun`;
- `distances/types.ts`: `Phase` = `endurance | threshold | specific`; bez `PaceStrategy`, `SingleQualityContext`,
  `QualityContext`, `intervalPaceForWeek`, `paceStrategy`, `singleQualityWeek`, `trimPriority`, `weeklyFastShare`;
  `longRunFinish` i `longRunCycle` obavezni;
- `generatePlan.ts`: poruka greške za drugu distancu je maratonska; uklonjeni kontrolna trka (`hasTrial`), „jedan kvalitet
  uz zahtevnu dugu", lak dan posle zahtevne duge (`limitEasyAfterLongRun`), udeo i redosled omotača iz profila,
  `intervalPaceForWeek`, `paceStrategy`, rezervne vrednosti za nepostojeće maratonske parametre;
- `longRunProgression.ts`: konsolidacija bez zastavice (uvek maraton); `weeklyLoad.ts`: bez `share` iz profila;
  `athleteAssessment.assessPreparation`: pravilo dužine je konstanta `MARATHON_REQUIRED_LONG_RUN_KM = 26`;
- `plan/preparationDecision.ts`: `SHORTER` samo `42195 → [21097.5, 10000]`, uvoz `generators/handoff` zamenjen argumentom,
  imena kraćih distanci iz plana drugog generatora.

**Namerno zadržano** (data-robusnost, ne trenerska grana druge distance): zona `RP`, naziv „Kontrolna trka" u mapama zona i
oporavka (`sessions/{prescription,calc}.ts`, `vdot/zoneForKind.ts`), tip `RaceDistanceM` sa 5000/10000/21097.5. Razlog:
ručne izmene i stari zapisi ih mogu nositi. U `preparationRequirement` je zadržano izvorno pravilo dužine kojim maratonska
odluka ocenjuje ponuđenu kraću opciju (polumaraton 16 km, 10K sama distanca) — to je odluka maratonskog generatora o
sopstvenoj ponudi, ne generisanje druge distance.

Razlika prema izvoru (posle prettier-a): 37 fajlova identično; 19 se razlikuje samo u uvozima; izmene logike u 11
(`date/index.ts` — samo izvor tipa `IsoDate`, `plan/{executionAdjustment,preparationDecision}.ts`,
`training/constants/distances.ts`, `training/distances/{index,profile42k,types}.ts`,
`training/generator/{athleteAssessment,generatePlan,longRunProgression,weeklyLoad}.ts`); novi su `index.ts`,
`exchange.ts`, `state/records.ts`.

## Izbor generatora i povezane putanje

- `generators/select.ts`: `MARATHON_GENERATOR`, `MARATHON_PREPARATION`, `GeneratorId = '5k' | '10k' | 'hm' | 'marathon' | 'legacy'`,
  `generatorIdFor(42195) → 'marathon'` (tačna vrednost); `preparationForPlan`: HM → HM, maraton → maraton, ostalo stari.
- Sve produkcione putanje (čarobnjak i njegova upozorenja/procena, promena cilja, rekalibracija, predlog/primena/poništavanje
  tempa, prilagođavanje prema izvršenju, run/walk, kapija kvaliteta, vraćanje verzije, poravnanje automatskih izmena,
  prikaz forme, odluka o pripremi nad sačuvanim planom i iz izvršenja) već idu kroz `generatorForDistance`/`generatorForPlan`/
  `productFor`/`preparationForPlan`, pa za maratonski plan sada idu u `marathon` — bez izmena u ekranima i store-ovima.
- `generators/handoff.ts`: izmenjen samo komentar.
- Stari mehanizam iz aplikacije sada dobija samo plan **bez podržane distance** (`genPlan === null` — ugrađeni lični plan;
  ručno uvezen plan sa drugom distancom).

## Zaštita podataka

Bez migracije, bez promene šeme, bez automatske regeneracije sačuvanih planova: izbor generatora se primenjuje tek na
sledeću radnju korisnika. Trenersko odlučivanje pri adaptaciji je lokalno (`marathon/plan/{regenerate,future,finalize,
returnGrowth,fatigueRecovery,executionAdjustment,preparationDecision}.ts`); tehnička zaštita istorije pri upisu (zaštićeni
dani, prenos ID-jeva, `pred`/`qs`, konflikti) je uz nju u `graftFuturePlan`, kao kod 5K/10K/HM. Revizije, `commitPlanChange`
i skladište ostaju aplikacioni.

Dokaz: (1) referentni tokovi sa zaštitom (budući odrađen dan, ručna sesija sa `overrides`, ručna izmena `alts`, merom
zaključan red `pred`/`predLock`, pomeranja u prošlost i budućnost) identični; (2) `features/onboarding/marathonFlow.test.tsx`:
stvaran tok kroz čarobnjak (izbor „Maraton") → generisanje (identično direktnom pozivu, dve taper nedelje) → prikaz →
čuvanje/učitavanje kroz pravo skladište → povratak posle pauze → vraćanje verzije → promena cilja (`3:59:00`) → odluka o
ograničenoj pripremi nad sačuvanim planom (identična direktnom pozivu) → „kraća distanca: polumaraton" (identično
direktnom pozivu; plan posle toga pripada HM generatoru); odrađeni dani, stvarna merenja, pomeren dan, ručna izmena,
zaključan red, `log/alts/moves/pred/predLock`, upozorenje o konfliktu i revizija ostaju; **brojač poziva starog mehanizma
(uključujući staru odluku o pripremi) = 0**.

## Dokazi nezavisnosti

- `marathon/isolation.node.test.ts` (17 testova; proverivač dupliran): paket/alias, izlaz iz `marathon/` mimo `exchange.ts`,
  dinamički uvoz, nedeterminizam, tranzitivno zatvorenje, re-export (`export {…}`, `export *`), obrnuti smer (maraton uvozi
  samo `select.ts`; ni `handoff.ts`), uvoz stare odluke o pripremi, međusobni uvoz **sva četiri** generatora (i tipom),
  odsustvo profila/parametara/grana 5K/10K/HM, maratonska odluka zna samo `42195 → [21097.5, 10000]` i predaju dobija kao
  argument.
- **Nova provera sva četiri generatora**: `generators/architecture.node.test.ts` (6 testova): izvršno zatvorenje svakog
  od `index.ts` ostaje u njegovom direktorijumu; nijedan generator ne uvozi drugi, `select`/`handoff` ni stari mehanizam (ni
  tipom); generatore van testova uvoze samo `select.ts`/`handoff.ts`; aplikacija ne uvozi izvršne funkcije starog
  generisanja/adaptacije (ni kroz barel `domain/plan`, `domain/training/adaptation`) — jedini popisan izuzetak je prikazni
  `describePoint` u `ExecutionAdjustment.tsx`; svaka distanca ide svom generatoru (i odluka o pripremi).
- `halfMarathon/isolation.node.test.ts`: provera međusobnog uvoza proširena na maraton (jedna linija).
- Osetljivost proverivača na stvarnom kodu (sve vraćeno, `cmp`/`git diff` potvrdili): (a) re-export stare
  `preparationDecision` u `marathon/plan/future.ts` → pala 3 testa (maraton + 2 arhitektura); (b) uvoz tipa iz
  `halfMarathon/exchange` u maratonu → pala 6 testova (maraton, HM, arhitektura); (c) runtime uvoz starog
  `planWithNewGoal` u `stores/executionActions.ts` → pao test arhitekture.
- Obrnuta nezavisnost: `HEURISTIC_42K.deloadFactor` 0,78→0,6 u **starom** `domain/training/constants/distances.ts` →
  maratonsko generisanje i dalje identično referenci; vraćeno.

## Referentni ulazi i rezultati (maraton)

| Šta | Gde |
|---|---|
| scenariji (generisanje, adaptacija, taper, QA događaji, odluke) | `web/src/test/marathon/scenarios.ts` |
| referenca i snimanje | `web/src/test/marathon/{reference.ts,captureReference.node.test.ts}`, `web/src/test/fixtures/marathon-reference.json.gz` |
| poređenje | `web/src/domain/generators/marathon/equivalence.node.test.ts` |

Generisanje — **1 843 ulaza** (1 821 plan, 22 greške neispravnih ulaza): maratonski deo matrice golden master-a (576),
maratonski ulazi iz `docs/qa/*/inputs.json`, **matrica maratonske politike** (512: `first`/`perf` (iskusan, `agr`) ×
1/2 kvaliteta × 4–24 nedelje × 3–6 dana × 30–85 km), 500 determinističkih slučajnih (mulberry32, seme 42195; 1–36 nedelja,
ispravne vrednosti `qualityExperience`) i granični/neispravni: trka +0…13 dana i 2…40 nedelja (sa i bez iskustva), svi dani
početka, obim 0…1000 uključujući pragove 38 (drugi kvalitet), 50 (MLR), 55 (vrhunac), 180 (plafon), dani 0…8/NaN, kvalitet
0…3, intenziteti, iskustvo × kontinuitet, brz završetak (intenzitet × duga 14/18/26), **dužine 4…45 km** (pravilo 26 km,
plafon 32 km, udeo nedelje, niski obim), **spor/brz trkač** (maratonski PB 2:30–5:50 × duga 18/30 — plafon 180 min i gorivo
75/120 min), MLR (4–7 dana, ispod/na granici), PB 5K/10K/HM/M, zastareo/bez datuma, ciljevi, početnik (i kratko), povratak
(kratak, dug, uz kratku pripremu), rasporedi, lestvice, umor/smanjen obim/povratna spremnost.

Adaptacija — **25 764 toka**: isti tokovi kao za 5K/10K/HM (U01 propušten, U02 podizvršenje, U03 RPE 8, pauza 10/21/40,
manji obim, zaštitni izazov iz U02-probe, promena cilja, rekalibracija, run/walk, predlog/primena/poništavanje tempa,
vraćanje verzije, poravnanje) nad maratonskim baznim ulazima na tri datuma, plus **taper i nedelja trke** (danas = trka −12 i
−5 dana; 840 tokova) i originalni maratonski QA događaj **U09** (zabeležena i ponovo izračunata analiza, smanjenje, pauza 14 i
35 dana; 6 zapisa).

Odluke o pripremi — **1 581 zapis** (412 odluka): ograničeni planovi, odluka na dva datuma (2. i 4. nedelja), svaka
ponuđena opcija (produženje 68, **kraća distanca polumaraton 128 i 10K 37** — kroz stvarnu predaju HM/10K generatorima),
povratni režim i odluka nad njim (207), osnova izvršenja posle pauze (206).

Referenca je uzeta **iz starog mehanizma pre bilo kakve izmene produkcionog koda** (na `ad464c0`, u radnom stablu sa samo
novim test fajlovima), zatim ponovo u čistom `git worktree`-u na **`05088e0`** (izvorni `main`, bez segmenata 1–3; tamo stari
mehanizam sam pravi i opcije HM/10K) — **bajt-identična** (`cmp`). Zapisano: `baselineSha` `ad464c0…`, `crossCheckedSha`
`05088e0…` (polje dodato posle `cmp`; podaci provereno isti). Test poređenja nikad ne osvežava referencu iz novog koda.

Poređenje: tačan zapis celog izlaza (`fiveK/exact.ts`), **nijedno polje nije isključeno**, ništa se ne zaokružuje; proverava se
i čistoća (ulazi nepromenjeni). Prvi prolaz je urađen nad doslovnom kopijom (pre uklanjanja grana) — identičan; drugi posle
uklanjanja — identičan. Vreme/zona/slučajnost: generisanje (edge, qa, matrica 8 i 14 nedelja) i adaptacija (3 bazna plana +
taper) pod `TZ` Pacific/Kiritimati, America/Los_Angeles, Asia/Kolkata, UTC uz `Math.random`, `Date.now` i `new Date()` bez
argumenta koji bacaju izuzetak — identično.

Osetljivost (u maratonskoj kopiji, sve vraćeno): `deloadFactor` 0,78→0,79 → generisanje palo [km, warnings]; konsolidacija
0,9→0,91 → palo [km, warnings, other]; brz završetak 0,35→0,36 duge → palo; ciklus duge (3 ned. pre kraja) 1,0→0,85 → palo
[km, pace, taper, warnings]; `RETURN_POLICY.medium.fraction` 0,7→0,71 → adaptacija pala [dates, km, segments, pace, rest,
taper, warnings, adaptation, other]; izlaganje dužini 0,85→0,86 u odluci → odluke pale [warnings]. Mutacija ciklusa 1,0→0,99
**nije** otkrivena — ekvivalentna je: faktor ciklusa se koristi samo kao prag `≥ 0,99` za brz završetak (v. nedostatak 3).

## Izmenjena postojeća očekivanja (i zašto to nije prilagođavanje testu)

- `generators/otherDistances.node.test.ts`, test izbora: `generatorIdFor(42195)` je bio `'legacy'` → sada `'marathon'`;
  `generatorForPlan`/`preparationForPlan` za 42195 → maratonski generator/odluka; dodato da 42194 i 42195.5 ostaju
  `legacy`. To je pravilo izbora koje ovaj segment po zadatku menja. Referenca polaznog commita (`05088e0`) za 10K/HM/maraton
  **nije dirana** i ostala je identična — sada kroz maratonski generator i za maratonski deo.
- `features/onboarding/{fiveKFlow,tenKFlow,halfMarathonFlow}.test.tsx`, kontrola brojača: plan „deklarisan kao maraton" je
  trebalo da ide starom mehanizmu; posle izdvajanja maratona stari mehanizam ostaje samo za plan bez podržane distance, pa
  kontrola koristi takav plan (7000 m). Delovi testova za 5K/10K/HM nisu menjani.
- `halfMarathon/isolation.node.test.ts`: lista drugih generatora dobila maraton (proširenje provere, ne slabljenje).

## Provere i rezultati (segment 4, poslednji prolaz)

| Komanda (iz `web/`, osim gde piše) | Rezultat |
|---|---|
| polazno: `npm run check` na `ad464c0` | zeleno; vitest 161 fajl / 1 598 testova |
| `npm run check` (typecheck + lint + prettier + vitest) | zeleno; vitest **166 fajlova / 1 629 testova** (8,5 min) |
| `npx vitest run --project node generators/marathon/equivalence` | 5/5 — 1 843 generisanja, 25 764 toka adaptacije, 1 581 zapis odluka, TZ/sat/slučajnost identični |
| izolacija 5K/10K/HM/maraton + `generators/architecture` | 5 fajlova / 63 testa |
| `npx vitest run --project node generators/otherDistances` | 3/3 — referenca `05088e0` za 10K/HM/maraton identična (sada kroz izdvojene generatore) |
| 5K/10K/HM ekvivalencija (u `npm run check`) | nepromenjeno zelene (reference nisu dirane) |
| `npx vitest run --project ui Flow.test` | 4 fajla / 8 testova — 5K, 10K, HM, maraton stvarni tokovi; brojač starog mehanizma 0; kontrole (7000 m) koriste stari |
| golden master `generator.fingerprint` (u `npm run check`) | nepromenjen (stari mehanizam nije menjan) |
| `node --test "**/*.test.mjs"` (iz `test/`) | 396/396 |
| `npx playwright test` | **77/77** (6,1 min, jedan prolaz); maraton kroz pregledač: `generator-ab-users.spec.ts` (maratonski profili U09/U10 iz `docs/qa/generator-ab/inputs.json`) |

## Inventar preostalog starog koda i njegovih potrošača (posle segmenta 4)

Stari mehanizam (`domain/training/**`, `domain/plan/**`) **nije menjan** u ovom segmentu (ništa nije dokazano bez
potrošača: i dalje ga koriste stavke ispod). Sadrži i dalje sve profile i grane 5K/10K/HM/M.

1. **Generisanje/adaptacija preko `LEGACY_GENERATOR`/`LEGACY_PREPARATION`** (`select.ts`): samo plan bez podržane
   distance — ugrađeni lični plan (`genPlan === null`, po sadržaju polumaraton) i ručno uvezen plan sa drugom distancom.
   `LEGACY_PREPARATION` se poziva i za 5K/10K plan (`isLimitedLongPreparation` je tamo uvek `false`).
2. **Stari `domain/plan/preparationDecision.ts`** uvozi `generators/handoff.ts` (ka 5K/10K/HM generatorima); potrošač je
   samo stavka 1 i prikazni `describePoint` (`features/plan/ExecutionAdjustment.tsx`).
3. **Prikazni/merni sloj** (runtime uvozi van generatora, sve distance):
   - `domain/plan` barel: `resolvePlan`, `weekOf` (`app/integrations`, `services/{icu,strava}`, `stores/{executionActions,trainingStore}`,
     `features/{cycle,today}`, `domain/activities/realign`), `planBaselineVdot` (`app/integrations`, `services/*`, `stores/{actions,dayActions}`,
     `features/session/useEasyPace`, `domain/race/view`), opisi `sessKind`/`tagName`/`dayLabel`/`weekPhase`/`rpeTarget`
     (`domain/{ai,community,day,push,race}`, `features/{cycle,plan,progress,session}`), `purgeGenPlanData`, `hasGenPlanData`,
     `preparationSummary` (`PlanOverview`), alt editor (`features/plan/AltSheet`);
   - ručne izmene korisnika (tehnički upis, bez trenerske odluke): `setAlt`/`clearAlt`/`swapDays`/`undoWeekMoves`
     (`stores/trainingStore`, `domain/recovery/proposal`, `domain/activities/realign`);
   - lanac forme: `recomputeVdotChain`, `currentVdot`, `sessionClassFor`, `alignVdotDates`, `matchWeekRows`, `predRowsForDay`,
     `effectivePace`, `classifyMeasurement` (`stores/*`, `services/*`, `app/*`, `domain/{ai,day}`, `features/{today,session}`);
   - tempo/VDOT/test 3K: `paceForZone`, `raceTimeForVdot`, `vdotFromRace`, `t3k*`, `isT3kId`, `t3kPossible`, `vdotPossible`,
     `T3K_*`, `VDOT_PROPOSAL_*`, `predictionSummary` (`features/race/*`, `stores/raceActions`, `domain/{onboarding,personal,
     weather,watch,state}`);
   - `runWalkText` (`domain/{day/breakdown,recovery/proposal,state/clean}`), `RECOVERY_JOG` (`domain/watch/icuWorkouts`),
     `sessQKm` (`stores/executionActions.planPreviewChanges`), `describePoint` (`ExecutionAdjustment.tsx`);
   - revizije `domain/plan/versions.ts` (aplikaciono skladištenje).
4. **Testovi**: `src/test/fiveK/legacyApi.ts` (izvor svih referenci), `captureReference` testovi, golden master
   `generator.fingerprint`, oracle testovi, testovi u `domain/training/**` i `domain/plan/**`.

Odluka o vlasniku stavki 1–3 (izbor po planu, aplikacioni merni modul ili prebacivanje ličnog plana na HM generator) je
zadatak segmenta 5.

## Ispitano maratonsko ponašanje (stanje koda, bez ocene i bez izmene)

Brojevi su iz jednokratne sonde nad 1 821 planom reference (sonda nije deo repozitorijuma).

| Tema | Gde i kako radi |
|---|---|
| spremnost za završetak i rezultatski cilj | `assessPreparation`: puna priprema traži najduže ≥ 26 km, bar dva trčanja ≥ 22,1 km (0,85 × 26), vrhunac ≥ 55 km/ned i kontinuitet ≥ 8 ned. Raspodela: `limited` 1 534, `developing` 33, `supported` 254. Cilj brži od reference forme → upozorenje; tempo trke = sporije od (cilj, trenutna forma) / 42,195 — cilj nikad ne ubrzava tempo. Nema ulaza za iskustvo na distanci. |
| nedeljna kilometraža | korak rasta po intenzitetu (`rampStep` 4–7 % uz pod/plafon 1,8–6 km), odredište 95 km, plafon 180; deload svake 4. ned. × 0,78; undulacija 0,94/0,99/1,03 na odredištu; isporučeni rast ≤ prethodna + 1,6 × korak; posle sastavljanja nedelja se proverava prema STVARNO isporučenoj prethodnoj. |
| progresija dužina i konsolidacija | `nextLongRunTarget`: polazna = prijavljena ponovljiva ili min(start × 0,3; 16 km); korak 8 % (≤ 1,5 km) za ustaljene (≥ 8 ned.), inače 6 % (≤ 1 km); deload × 0,75; **svaka 3. nedelja plana × 0,9 (konsolidacija)**; taper × 0,7 (poslednja) / × 0,85 (prva). Vrhunac duge: < 16 km 708, 16–20 418, 20–26 407, 26–32 273, ≥ 32 15. U 5 277 od 20 749 radnih nedelja bez deloada duga je kraća od prethodne. |
| ograničenja dužine | plafoni: udeo ciljne nedelje 0,42, trajanje 180 min, 32 km; na sastavljenoj nedelji udeo ≤ 0,42 (`clampLongRun`, `finalizeWeek`), uz izuzetak da duga ostane ≥ 1,05 × najduži kvalitet. 209 planova je na plafonu trajanja (pre 32 km), 16 na 32 km. |
| srednje-dugo (MLR) | ≥ 5 dana i procenjen vrhunac ≥ 50 km → 0,6 duge; u taperu ≤ 0,55 duge; 844 plana. |
| maratonski tempo, prag, ostalo | faze po udelu kvalitetnih nedelja (< 0,33 izdržljivost, < 0,73 prag, ostalo specifično); q1 većinom M (u izdržljivosti kao progresivno sa M krajem), q2 prag (isprekidan/kontinuiran) ceo ciklus; intervali i repeticije retko (I 2 115, R 126 sesija prema 5 313 „Maratonski tempo", 1 648 progresivnih, 9 514 isprekidan i 6 539 kontinuiran prag). |
| zajednička ograničenja trajanja rada | `applyQualityDose`: vreme rada po spremnosti (početnik 6→12 min, povratnik 6→14, u razvoju 8→16, iskusan 15→22 min; × 1,25 samo za T) važi i za M. Isporučeno trajanje M rada u „Maratonski tempo": početnik p50 10 / max 12 min, povratnik 12,4 / 13,8, u razvoju 14 / 16, iskusan 21,7 / 22 min; graditelj sesije cilja do 16 km (`marathonPaceBudget`). Dalje: neprekidan prag ≤ 35 min, zonski budžet (M „ostalo" 20 % nedelje), nedeljni omotač za iskusne 13 % vremena trčanja (M se broji upola, duga ≥ 90 min → × 0,9). |
| završnice dužina i obračun | `longRunFinish42K`: samo iskusan, intenzitet ≠ `kons`, specifična faza, duga ≥ 16 km, faktor ciklusa < 0,99, van tapera/deloada: poslednjih 35 % duge (5–12 km) na M; briše q2 i ulazi u nedeljni omotač (M upola). 202 plana. |
| raspored zahtevnih treninga | raspored dana jednom za ceo plan (`buildDaySlots`, MLR po vrhuncu); drugi kvalitet tek uz ≥ 4 dana, nedeljni i potvrđeni obim ≥ 38 km i (iskusan ili posle 2./3. kvalitetne nedelje). U 183 od 892 plana sa traženim drugim kvalitetom on nijednom nije isporučen. Ponedeljak posle nedeljne duge ≤ min(14 km; 0,8 duge) (`capAfterLongRun`, ne posle deloada). |
| taper i nedelja trke | dve taper nedelje (1 799 planova; 15 kratkih ima jednu, 7 nijednu): prva × 0,8 vrhunca, kvalitet normalan sa ustaljenom dozom; poslednja × 0,65, kratak M dodir; nedelja trke × 0,4; protokol −3/−2/−1 (shakeout, „Aktivacija" 6 × 200 m približno na ritmu trke — ne meri se, shakeout) pada u taper nedelju po kalendaru. U 25 planova prva taper nedelja ima više kvalitetnih dana od poslednje radne. |
| kratka ili nedovoljna priprema | < 12 nedelja → upozorenje, plan se pravi (317 planova); početnik ima baznu fazu 12 ned. (u kratkom planu skraćenu), povratnik 1–3 ned.; ograničena priprema → odluka (produženje, polumaraton/10K istog datuma, povratni režim). |
| postprocesori koji menjaju prvobitni rezultat | probna raspodela (`volQ`), skraćivanje kvaliteta (`constrainWeek`/`constrainSession`), petlja nedeljnog omotača, „PRODUŽENO ZAGREVANJE" (do +1,5 km), taper skraćivanje duge/MLR/lakih, `clampLongRun`, izravnavanje deloada (prema isporučenoj nedelji), taper klamp (prema isporučenom vrhuncu), čuvar isporučenog rasta, `finalizeWeek` (više prolaza), završni `constrainWeek` i preračun PRED/qs, filter dana pre početka; posle adaptacije `finalizeFuturePlan`/`graftFuturePlan`/`returnGrowth`/`fatigueRecovery`. |

## Poznati maratonski trenerski nedostaci (evidentirano, nije popravljano)

1. **Maratonski tempo je skraćen opštim vremenskim limitima spremnosti**: M rad je 10–22 min (p50) iako ga graditelj
   planira do 16 km; isti limit kao za 5K/10K sesije (sada lokalna kopija, politika neizmenjena). Odgovara nalazu U09-NEW-01.
2. **Spremnost za distancu**: samo 288 od 1 821 plana dostiže 26 km, 1 534 su `limited`; ponuđeni put je odluka
   (produženje / kraća distanca / povratni režim), ne maratonski put izdržljivosti. U09-BOTH-01.
3. **„Ciklus dugog trčanja" ne menja dužinu**: `longRunCycle42K` se koristi samo kao prag za brz završetak (≥ 0,99 → bez
   završetka); komentar profila tvrdi „sopstveni talas". Talas dužine dolazi iz konsolidacije svake 3. nedelje i deloada.
4. **Konsolidacija (svaka 3. nedelja) i deload (svaka 4.) nisu usklađeni**: duga se skraćuje u 25 % radnih nedelja bez
   deloada; nije ocenjeno.
5. **Drugi kvalitet** nikad nije isporučen u 183 od 892 plana koji ga traže (pragovi iz tabele); nije ocenjeno.
6. **Prva taper nedelja može imati više kvaliteta od poslednje radne** (25 planova); srodno U09-OLD-02.
7. **Lak dan posle duge**: maraton nema pravilo „lak dan posle zahtevne duge" (postoji samo za HM); jedini limit je ponedeljak
   posle nedeljne duge. U09-NEW-02.
8. **„Aktivacija" 6 × 200 m** u nedelji trke je približno maratonski ritam označen kao repeticije. U09-BOTH-02.
9. Nema ulaza za iskustvo na maratonskoj distanci; `experienced` znači iskustvo sa kvalitetom + kontinuitet ≥ 8 ned.

## Kriterijum završetka segmenta 4

| Merilo | Stanje |
|---|---|
| maraton samostalno generiše plan | ispunjeno |
| maraton samostalno adaptira (izvršenje, pauza, umor, run/walk, cilj, rekalibracija, predlog tempa, vraćanje verzije, poravnanje) | ispunjeno |
| maraton samostalno pravi odluku o ograničenoj pripremi; opcije polumaraton/10K prave HM/10K generatori kroz predaju-argument | ispunjeno |
| bez zabranjenih direktnih/tranzitivnih zavisnosti, bez međusobnog uvoza, provera na sva četiri generatora | ispunjeno (automatski testovi, provereni veštačkim prekršajima) |
| ponašanje maratona očuvano | ispunjeno (tačno poređenje, bez isključenih polja, referenca potvrđena i na `05088e0`) |
| 5K, 10K, HM nepromenjeni | ispunjeno (njihove reference netaknute i zelene) |
| korisnički podaci zaštićeni | ispunjeno |
| stari mehanizam bez potrošača za podržane distance | ispunjeno za generisanje i adaptaciju; prikazni/merni sloj i plan bez distance ostaju (inventar iznad) |

## Preostali rizici (segment 4)

- Dupliran kod se namerno razilazi; svaka namerna trenerska izmena maratona mora svesno da osveži
  `marathon-reference.json.gz` (novim snimanjem sa obrazloženjem).
- Izbor po tačnoj vrednosti `42195`; plan sa `meta.raceDistM` 42195 i drugačijim `ulaz.raceDistM` ide maratonu, koji za
  drugu distancu vraća „Nepodržana distanca". Aplikacija takav plan ne pravi.
- `ShorterDistanceHandoff` je obavezan; ako bi ga neko prosledio kao `() => null`, opcije polumaraton/10K bi tiho nestale.
- Pet velikih poređenja (5K, 10K, HM, maraton, ostale distance) produžavaju `npm run test` na ~8,5 min.

## Stanje radnog stabla (za segment 5)

Grana `claude/generator-isolation-5k-10k-hm-marathon` (od `ad464c0`), pushovano; PR nije otvoren, nije spojeno u `main`.
Novi fajlovi: `web/src/domain/generators/marathon/**`, `web/src/domain/generators/architecture.node.test.ts`,
`web/src/test/marathon/**`, `web/src/test/fixtures/marathon-reference.json.gz`,
`web/src/features/onboarding/marathonFlow.test.tsx`. Izmenjeni: `web/src/domain/generators/{select,handoff}.ts`,
`web/src/domain/generators/otherDistances.node.test.ts`, `web/src/domain/generators/halfMarathon/isolation.node.test.ts`,
`web/src/features/onboarding/{fiveKFlow,tenKFlow,halfMarathonFlow}.test.tsx` (kontrola), `web/tsconfig.{app,oracle}.json`,
ovaj dokument.

Predlog za segment 5: dodeliti vlasnika stavkama inventara (lični plan, plan bez distance, prikazni/merni sloj,
`describePoint`), zatim ukloniti `domain/training/**`/`domain/plan/**` trenerski deo, `LEGACY_*` iz `select.ts`, stari
`preparationDecision`, `legacyApi` (reference su već snimljene i ne zavise od starog koda u vreme poređenja) i golden
master `generator.fingerprint` (ili ga prevesti na izdvojene generatore uz svesno obrazloženje).
