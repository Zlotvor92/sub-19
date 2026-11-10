# V1b — uklanjanje v1 generatora 5K, 10K i maratona: izveštaj

Sesija V1b, 10. 11. 2026 (sva vremena po beogradskom vremenu). Zadatak: `briefs/V1b-uklanjanje-v1.md`; plan:
`reports/V1a-REPORT.md` § 6. Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazno `72003c1`. Baza nije
dirana, nema migracije stanja, nema deploya, ništa u `main`. Pravila v2 generatora nisu menjana (izlaz v2 bajt-isti:
bazne linije i mreže v2 netaknute; u `*/v2/**` menjani samo uvozi i poređenja sa v1 u testovima i `fiveK/v2/app`
tipovi razmene). **[M]** izmereno, **[T]** tumačenje.

## Zaključak

1. 5K, 10K i maraton v1 su obrisani; nov plan pravi samo v2 (jedna putanja čarobnjaka, bez prekidača). [M]
2. HM v1 je zamrznut i netaknut, a dobija ga SAMO plan sa `meta.licni === true` (`LEGACY_PERSONAL_GENERATOR`).
   `personalPlan.node.test.ts`: 8196 tokova bajt-isto prema `personal-reference.json.gz`. [M]
3. Stari plan u bazi (bez `policyId` ili sa oznakom v1): otvara se, prikazuje, unos radi; jedna poruka („Plan je
   napravljen starim generatorom: prikazuje se, ali se više ne prilagođava.") i dugme „Generiši nov plan", na Danas,
   Plan i Prilagodi plan. Potvrda kaže šta se briše a šta ostaje. Bez pada (nov E2E + UI testovi). [M]
4. Testovi: brz nivo 292 fajla / 3266 testova zeleno; E2E 82/82; `check:full`: § 7. [M]
5. CI: projekat i posao `v1` ukinuti, „sve" u 10 delova. Merenje CI run-a posle push-a: § 8. [M]

## 1. Obrisano (samo V1b commitovi, `git show --numstat`)

| Grupa | Fajlova | Redova (−) |
|---|---|---|
| v1 5K/10K/maraton (kod i testovi u folderima distanci van `v2/`) | 270 | 33 665 |
| `docs/qa` (12 foldera; nijedan živ test ih više ne čita) | 341 | 1 114 227 (42 MB) |
| reference i otisci (`fiveK/tenK/marathon/halfMarathon/otherDistances/guidance/state-reference.json.gz`, `otisak-generatora.json`, `generator-differential.json`) | 9 | binarno + 24 556 |
| `src/test/{fiveK,tenK,marathon,halfMarathon,guidance}`, `generatorScenarios.ts`, stari `generators.ts` | 36 | 4 823 |
| testovi v1 pravila u `domain/training/**` (generator, distances, sessions, execution, qualityGate, runWalkProgress) | 33 | 4 973 |
| testovi v1 adaptacije u `domain/plan/**`, `replan.oracle`, `onboarding.oracle` | 31 | 2 642 |
| `generators/*.ts`: `flags.ts`, `otherDistances*`, `runtimeIsolation*`, `guidance`, `policyIsolation`, `handoffV2Source`; v1 delovi `select.ts`/`handoff.ts` | 22 | 1 963 |
| v2 folderi: `byteSame*` (3 testa + 3 JSON, provera prekidača), poređenja sa v1 | 46 | 2 428 |
| aplikacija: prekidači (`stores/generatorFlags.ts`, `Ti → Generator plana`), koraci 2–4 starog čarobnjaka, `domain/onboarding` v1, testovi | 44 + 31 | 3 183 + 2 642 |
| HM v1 testovi ekvivalencije (`halfMarathon/equivalence*`, projekat `v1`) | 10 | 252 |
| E2E: `generator-ab-users`, `phase3-execution`, `final-preservation`, `recalibrate`, 4 testa v1 toka | 5 | 408 |

## 2. Zadržano i zašto

- HM v1 (`halfMarathon/` van `v2/`, 81 fajl): lični plan vlasnika do V1c (posle 13. 12. 2026). Kod nije menjan;
  `select.ts` mu za lični plan daje predaju „kraća distanca" bez cilja (`NO_SHORTER_HANDOFF`) — odluka o pripremi
  traži sačuvan `genPlan`, a lični plan ga nema; referenca je i tako bajt-ista (dokaz da predaja nije korišćena).
- `halfMarathon/isolation.node.test.ts`, `personalPlan.node.test.ts`, `personal-reference.json.gz`, `src/test/personal`
  (pomoćnici `exact.ts`, `legacyApi.ts`, `flows.ts` preseljeni iz `src/test/fiveK`, bez izmene koda).
- Oracle testovi prikaza/stanja (17 fajlova): ulaz iz zamrznutog generatora APP_VERSION 282, a prevod v1 u plan
  starog formata je sada zamrznuta fikstura `src/test/legacyAdapt.ts` (`legacy-adapt.json.gz`, 179 planova).
- Nova fikstura `src/test/legacyPlans.ts` (`legacy-plans.json.gz`, 38 ulaza / 22 plana): tačan izlaz v1 za ulaze
  testova koji proveravaju deljeni kod nad planom STAROG formata (taj format imaju stari planovi u bazi). Obe fiksture
  snimljene jednom, pre brisanja v1; nepoznat ulaz je greška testa.
- `domain/training/**`, `domain/plan/**` izvorni kod (deljen, koristi ga aplikacija); `docs/` izveštaji (istorija).
- `vercel.json` / `deploy/vercel.cutover.json` `buildCommand: VITE_V2_DEFAULT_ON=1 …` ostaje: promenljiva je bez efekta
  (nov plan je uvek v2); deploy konfiguracija nije menjana.

## 3. Izmene aplikacije

- `select.ts`: uvozi `*/v2/app/index.ts` direktno; `generatorForDistance`/`generatorForNewPlan` → v2; `generatorForPlan`:
  `licni` → HM v1, tekuća oznaka v2 → v2, stari plan (`isLegacyPlan`: bez oznake ili `*-v1`/`legacy-*`) → `null`
  (`LEGACY_PLAN`), nepoznata verzija → `UNKNOWN_POLICY`. `phaseReaderFor` za stari plan: doslovna kopija v1
  `phaseOfWeek` (`legacyWeekPhase`), pa se faza starog plana prikazuje kao pre. Predaja „kraća distanca" samo ka v2.
- `fiveK/exchange.ts` → `fiveK/v2/app/exchange.ts` (uslov 7: jedini izlaz iz v2, type-only ka `state`/`date`; test).
- `handoff.ts` = samo tip `SourceFormat`. `flags.ts` i `stores/generatorFlags.ts` obrisani.
- Čarobnjak: jedna putanja (koraci v2 izabrane distance); `domain/onboarding/index.ts` = stanje prvog koraka.
- `LegacyPlanNotice` (Danas, Plan, Prilagodi plan); u Prilagodi plan za stari plan nema „Preračunaj"/„Promeni cilj".
- Potvrda „Generiši/Napravi nov plan" (`NEW_PLAN_CONFIRM`): briše se plan i sve uz njegove treninge (upisana trčanja i
  napomene, procene, izmene/pomeranja, VDOT sa tih treninga, bol/težina upisani uz trening); ostaje test 3 km, ručni
  bol/težina, jutarnja merenja, trčanja van plana. Ponašanje `discardPlan` nije menjano.
- `executionActions.ts planGenerator()`: svi pozivaoci već proveravaju generator (V1a § 2); stari plan ne stiže do
  izuzetka (UI: `ExecutionAdjustment` se crta samo uz generator; E2E i UI testovi bez `pageerror`). [M]

## 4. Testovi: šta su čuvali → čime su zamenjeni / zašto obrisani

| Test (grupa) | Šta je čuvao | Ishod |
|---|---|---|
| `*/equivalence*`, `otherDistances*`, `runtimeIsolation*`, `guidance`, `generator.{differential,fingerprint}`, `policyIsolation`, `src/test/*/capture*` | v1 = stari engine; izolacija v1 u izvršavanju; 4 kopije logike = referenca | obrisano: kod koji su čuvali ne postoji. Kopije v2 (stanje, vreme, sat) i dalje se porede sa istim vrednostima — sa zamrznutim HM v1 (`v2/app/app.node.test.ts` (c)); lični plan: `personalPlan` |
| `domain/training/generator/*` (17), `distances/*` (3), `sessions/{cruise,prescription}`, `execution`, `qualityGate`, `runWalkProgress` | pravila v1 generisanja, doze, run/walk, kapija | obrisano: pravila v1; v2 ima sopstvene testove i mreže |
| `domain/plan/{future,recalibrate,runWalkAdjustment,finalize,finalIntegration,fatigueRecovery,preparationDecision}`, `replan.oracle`, `stores/{recalibration,preparationDecision}` | v1 adaptacija, preračunavanje, odluka o pripremi | obrisano: v1 tok; stari plan se ne prilagođava, lični plan ne upisuje; v2 tok: `*V2Adapt`, `handoffV2`, v2 `adaptFlow`/`handoff*` |
| `onboarding.oracle`, `{fiveK,tenK,halfMarathon,marathon}Flow`, `Wizard.test` (stari) | stari čarobnjak | obrisano; `Wizard.test.tsx` nov (ljuska v2: „Dalje", „✕", potvrda); tok po distanci `*V2Flow` |
| `byteSame` (10K/HM/MAR v2), testovi prekidača (`generatorFlags`, `*V2Flow` „prekidač", `fiveKV2Adapt` „prekidač") | uključen prekidač ne menja ostale distance | obrisano: prekidača nema; nov plan = v2 proveren u `app.node.test.ts` (rutiranje) |
| `handoffV2Source`, v2 `handoffSource/Target` delovi „v1 cilj" | v2 izvor → v1 cilj | obrisano; cilj je v2 (`shorterHandoffForV2Source` = `handoffFuture` v2, test) |
| 99 testova sa ulazom v1 (`src/test/generators.ts`) | plan kao ulaz testa aplikacije | v2 generatorom (isti oblik ulaza, `v2ContractInput`): stores, features, app, services prolaze; gde se proverava stari format (pred redovi, `deload` v1, radni deo): `legacyPlans` (`plan.node`, `taper.node`, `adaptation*.node`, `poison`, `today` „radni deo", `importV1Snapshot`) |
| Forma (`race.test`), predlog zbog bola (`recovery`, `today`) | v1 ekran forme, T3K, predlog | lični plan vlasnika (jedini plan sa v1 generatorom); primena predloga tempa ne postoji za lični plan (ne upisuje se) |
| uvoz/oracle sa politikom forme (`day.oracle`, `icuSync.oracle`, `stravaSync.oracle`, `importV1Snapshot`) | deljeni kod uvoza/merenja = stari frontend | isti, uz zamrznutu politiku forme v1 (HM v1; kod `training/adaptation/*` bajt-isti u sva 4 v1) |
| `architecture`, `contract`, `activeSession`, v2 `isolation` | granice generatora | usklađeni: koreni 5K/10K/MAR v2 + folder HM; `select` sme da uvozi `*/v2/app/index.ts` vrednosno |
| E2E `phase3-execution`, `final-preservation`, `recalibrate`, `generator-ab-users`, `handoff-v2` (a)(c)(d)(e), `plan` „validacija", `recovery-race` „forma" | v1 tokovi u pregledaču | obrisano; v2: `tenk/hm/marathon/fivek-v2`, `handoff-v2` (b)(g); nov `legacy-plan.spec.ts` |
| Ponašanje koje se promenilo po v2 pravilima | maraton v2 22 ned. do trke: 10K cilj je sada v2 (najviše 18 ned.) → nedostupno sa razlogom (ranije v1) | test usklađen (poruka postoji) |

## 5. Dokaz za lični plan (V1a § 2)

| Funkcija | Dokaz |
|---|---|
| izbor generatora | `generatorForPlan(personalPlan(48)) === LEGACY_PERSONAL_GENERATOR` (`architecture`, `personalPlan`, v2 `app` testovi) |
| oporavak, opterećenje, spremnost, predlog bola | `personalPlan` tokovi (8196, bajt-isto); `recovery.test` i `today.test` nad ličnim planom (predlog → izmene) |
| vreme, lak tempo, RPE, prag | isti HM v1 članovi (`personalPlan`), `personal.test.tsx` |
| Forma: dokazi, predviđanje, T3K, lanac | `race.test.tsx` nad ličnim planom (8/8) |
| predlog/primena VDOT-a, uparivanje redova | `personalPlan` (`apply` > 50 tokova); `adaptation.oracle` (HM v1 predlog = stari frontend) |
| unos tempa radnog dela, analiza izvršenja, run/walk | `personalPlan` (`executionModel`, `assessRunWalkProgress`) |
| pisanje prilagođavanja, handoff, nov cilj | ni pre V1b nije radilo za lični plan (`genPlan === null`); bez promene |

Nijedna funkcija iz tabele nije izgubljena za `licni` plan. [M]

## 6. Ponašanje starog plana (E2E `legacy-plan.spec.ts`)

Stanje sa planom v1 formata (bez `meta.policyId`, sa `ulaz`): Danas prikazuje trening dana i traku sa porukom i
„Generiši nov plan"; „Završi trening" upisuje unos; Plan prikazuje „Nedelja 1 od 3" i istu poruku; „Generiši nov plan"
→ potvrda sa „TRAJNO se briše" i „Ostaje: test na 3 km, bol i težina upisani ručno…"; „Ne" ne menja ništa; „Da" →
čarobnjak (v2). Bez `pageerror`. UI: `personalPlanGenerator.test.tsx`, v2 `app.node.test.ts` (`LEGACY_PLAN`,
`isLegacyPlan`). Faza nedelje starog plana: `legacyWeekPhase` (kopija v1).

## 7. Trajanje komandi (lokalno, 4 jezgra)

| Komanda | Trajanje | Ishod |
|---|---|---|
| `npx vitest run` (brz nivo, posle izmena) | 4 min 45 s | 292 fajla, 3266 testova, 0 padova |
| `npm run lint` | 1 min 25 s | 0 grešaka |
| `npx playwright test` (ceo skup, 2 radnika) | 8 min 31 s → 5 min 54 s → 4 min 30 s | 27 → 12 → 0 padova; konačno 82/82 |
| `personalPlan.node.test.ts` (pun) | 4,7 s | 3/3, 8196 tokova |
| 17 oracle fajlova (pun, zamrznute fiksture) | 12,9 s | 69/69 |
| `npm run check:full` (jednom) | CHECKFULL_TIME | CHECKFULL_RESULT |

## 8. CI pre / posle

Pre (T1-REPORT § 1): „sve" run 769 — zid 9,7 min, ≈ 88,2 runner-min, od toga posao `web-test-v1` 6,5 min; 8 delova.
Posle: CI_AFTER

## 9. Šta nije urađeno / otvoreno

1. V1c (posle 13. 12. 2026): brisanje HM v1, `personalPlan.node.test.ts`, `src/test/personal`. Tada i: testovi koji
   sada porede kopije v2 sa HM v1 ((c) u v2 `app.node.test.ts`), `adaptation.oracle`, `day/icuSync/stravaSync.oracle`
   i `importV1Snapshot` (politika forme v1) i `legacyPlans` testovi sa `generators/halfMarathon/**` uvozom treba da
   pređu na zamrznute fiksture ili da se obrišu — odluka organizatora.
2. Stari plan bez generatora ne klasifikuje merenja tempa (lanac forme se ne gradi) i nema predlog zbog bola — svesna
   posledica „ne prilagođava se" (V1a § 3). Ako treba drugačije: odluka.
3. Učestalost ulaza koje v1 prima a v2 odbija (npr. > 16–24 nedelje do trke) nije merena na bazi; v2 odbija sa
   porukom (odluka (6) iz PROGRAM.md).
4. `docs/` izveštaji i dalje pominju v1 putanje i `docs/qa` (istorija, nije menjano osim AGENTS, TEST-SPEED,
   SABOTAGE, ARCHITECTURE, STATUS).
