# Izolacija politike — nalazi A1, A2, A3, A5, A7, A12

Grana `claude/generator-isolation-5k-10k-hm-marathon`. Polazni SHA: `e196fc95c39dbcb8301bc9ff17f562d21a002754`.
SHA izmene koda: v. `STATUS.md` → „Trenutno stanje". `fiveK/v2/` i `docs/5k-v2/` nisu dirani. Bez PR-a, mergea, deploya.

## Nalazi (12)

| # | Ocena naloga | Moja provera u ovom tabu | Ishod |
|---|---|---|---|
| 1 (A1) | potvrđen | **potvrđen** (`measure.ts:59`, `chain.ts:23`); uz navedene, nađeni i pozivaoci `app/integrations.ts:215`, `app/community.ts:55`, `features/today/WeatherCard.tsx:42`, `adaptation/dates.ts` (usklađivanje datuma iz Strava/icu) | rešeno |
| 2 (A2) | potvrđen | **potvrđen** (HM `preparationDecision.ts:169-172`, maraton `:170`); dodatno: izvor je ocenjivao pokrivenost plana kraće distance SVOJIM pragom (maraton `:293`, `optionFrom`, `buildPreparationChoice`; isto u HM) | rešeno |
| 2b | delimično | nije proveravano (van zadatka) | van ovog taba |
| 3 (A3) | potvrđen | **potvrđen** (`describe.ts:74`, `WeekBody.tsx:38`, `cycle.ts:46`, `planView.ts:55`); `planPhases` nema produkcionog pozivaoca (samo oracle test) | rešeno |
| 4 | potvrđen pregledom koda | nije proveravano | van ovog taba (rekonstrukcija distanci; generatorski `generatePlan`/`regenerate.ts`) |
| 5 (A5) | potvrđen | **potvrđen** (`select.ts:37`, `:353`) | delimično rešeno (v. preostalo) |
| 6 | neprovereno | nije proveravano | van ovog taba |
| 7 (A7) | potvrđen | **potvrđen**: `policyId` postoji samo u nepovezanom `fiveK/v2` | rešeno |
| 8 | potvrđen (E28 0,1 km/ned) | nije proveravano | van ovog taba (generatorski `training/generator/volume.ts`, `weeklyLoad.ts`) |
| 9, 10, 11 | delimično | nije proveravano | van ovog taba (drugi tab / rekonstrukcija distanci) |
| 12 (A12) | potvrđen | **potvrđen** (`architecture.node.test.ts:216-227`) | rešeno |

Nijedan nalaz nisam odbacio.

## Promene i zašto

**A1 — prijem merenja forme pripada generatoru plana.**
- Svaki generator ima svoju kopiju `training/adaptation/measure.ts` (klasifikacija, tolerancija 4) uz postojeću kopiju
  `chain.ts` (α) i konstante u svom `heuristics.ts`; vrednosti su iste. Izvoze se kroz ugovor:
  `classifyMeasurement`, `recomputeVdotChain`, `sessionClassFor`, `currentVdot` (`FormPolicy` u `select.ts`).
- `domain/day/workPace.ts` više ne odlučuje: politiku dobija kroz `WorkPaceContext.form` (= `generatorForPlan(plan)`).
  Pokriveni produkcioni tokovi: ručni unos i brisanje tempa (`stores/dayActions.ts`), automatski uvoz
  (`services/strava/stravaSync.ts`, `services/icu/icuSync.ts`, uključujući usklađivanje datuma `alignVdotDates`, koji
  sada prima `recompute` od pozivaoca), test 3 km dodavanje/izmena datuma/brisanje (`stores/raceActions.ts` preko
  `workPaceContext`), promena polazne forme ličnog plana (`dayActions.editField`), aktiviranje novog plana
  (`stores/actions.ts`), lak tempo (`useEasyPace.ts`), vremenske smernice (`WeatherCard.tsx`), sat/icu
  (`app/integrations.ts`), zajednica (`app/community.ts`).
- Sačuvani `vdotLog` se čita isto (polja `measured`, `ts`, `id`); nema migracije.

**A2 — predaja nosi samo činjenice.** Izvor (HM, maraton) šalje `HandoffFacts` = ulaz (distanca, datumi, stvarna baza
`weeklyKm`), potvrđeno izvršenje (`execution`: datum, `breakDays`, prijavljena/polazna baza) i `restartFromBase`.
Cilj (`<5K|10K|HM>/plan/handoffTarget.ts → handoffFuture`) sam bira povratnu politiku (`returnPolicyFor`), bazu zaštite
rasta i ocenjuje pokrivenost svoje pripreme (`handoffCoverage`); izvor koristi tu ocenu umesto svog praga (HM prag 16 km
u maratonu je sada pravilo HM generatora). `handoff.ts` mapira distancu na `handoffFuture`.
**Izlaz se ne menja**: u svim tokovima izvora politika je već bila funkcija `execution.breakDays`, a baza rasta jednaka
`input.weeklyKm`; tablice i pragovi ciljeva imaju iste vrednosti. Dokaz: HM i maratonske ekvivalencije (sa odlukama o
pripremi) zelene bez izmene referenci. Regresioni slučaj: `policyIsolation.node.test.ts` (U08 HM→10K, U10 maraton→HM).

**A3 — faza iz odluke generatora.** `<distanca>/plan/policy.ts`: `stampPlan` upisuje `weeks[].phase` (funkcija
`weekPhase` tog generatora), `phaseOfWeek` čita upisanu fazu, a za stari plan bez polja računa je funkcijom generatora
tog plana. Prikaz (`WeekBody`, `cycleModel`, `planPhases`) dobija `phaseOf` = `phaseReaderFor(plan)`; `resolvePlan`
prenosi `phase`. Bez migracije.

**A5 — eksplicitan ugovor.** `select.ts`: interfejsi `PlanGenerator` (uz `FormPolicy`) i `PreparationApi` sa svakim
članom i potpisom (svojstva tipa funkcije, stroga provera parametara). Sva četiri objekta: `satisfies PlanGenerator`,
oba objekta pripreme: `satisfies PreparationApi`. Predaja se više ne kastuje (`as ShorterDistanceHandoff` uklonjen).

**A7 — verzija politike.** `POLICY_ID`/`POLICY_VERSION` po generatoru (`5k-v1`/`5k-v1.0.0`, `10k-v1`, `hm-v1`,
`marathon-v1`). `planPolicy(plan)`: bez oznake → `legacy-<distanca>` (obrađuje postojeći generator; ne tvrdi se
reprodukcija); poznata → `current`; ostalo → `unknown`: `generatorForPlan` vraća `null`, aplikacija prikazuje
`UNKNOWN_POLICY` (`unsupportedPlanReason`), bez tihe zamene. Oznaka i faze se upisuju pri upisu plana
(`stampForStorage`): `activateNewPlan`, `commitPlanChange` (izvršenje, run/walk, priprema, vraćanje revizije),
`commitRecalibration`, `changeGoalTime`. `generatePlan`/`adaptGeneratedPlan` ostaju nepromenjeni (reference izlaza).

Posledice za adaptaciju i vraćanje revizije:
- Prilagođavanje legacy plana radi postojeći generator; nova revizija dobija TRENUTNU oznaku = „poslednji upis ove
  politike", ne tvrdnja da su protekle nedelje nastale njome.
- Vraćanje revizije: snimak bez oznake ili sa poznatom → kalemi ga postojeći generator i upisuje sa trenutnom oznakom;
  snimak sa nepoznatom oznakom → odbijeno sa `UNKNOWN_POLICY`. Istorija revizija čuva snimke kakvi jesu.
- **Rizik pri sledećoj verziji**: ako generator podigne `POLICY_VERSION`, a staru ne doda u `KNOWN_VERSIONS`, svi do
  tada označeni planovi te distance postaju `unknown` (nema prilagođavanja). Podizanje verzije mora eksplicitno odlučiti
  koje stare verzije trenutni kod prihvata.

**A12 — testovi.** Iz `LEGACY_SHARED_ALLOWED` uklonjeni `weekPhase` (oba modula), `currentVdot`, `recomputeVdotChain`,
`classifyMeasurement`, `sessionClassFor`; iz `PRODUCTION_LEGACY_FILES` uklonjen `training/adaptation/measure.ts`
(produkcija ga više ne dostiže). Nijedan izuzetak nije proširen. Novi `generators/policyIsolation.node.test.ts`:
- izmena tolerancije i α u 5K (mock modula) menja samo 5K; 10K/HM/maraton isti, i kroz `recordAutoPace`;
- izmena povratne politike IZVORA (HM, maraton) ne menja plan kraće distance — za osnovu izračunatu pre izmene i za
  osnovu iz sačuvanog plana (`basisFromPlan`); kontrola: izmena politike CILJA ga menja;
- `stampPlan`, legacy/nepoznata oznaka, čitanje faze.
Provera osetljivosti: sa privremeno vraćenim starim ponašanjem (cilj koristi politiku izvora) oba A2 slučaja padaju.
`runtimeIsolation.node.test.ts`: netaknuta predaja sada pokazuje na `handoffFuture` (novi ugovor predaje).

## Namerne promene ponašanja

1. Plan upisan posle ove izmene nosi `weeks[].phase` i `meta.policyId/policyVersion` (prikaz faze isti).
2. Plan bez generatora (nepodržana distanca ili nepoznata oznaka): merenje tempa se ne prihvata (`no-generator`),
   lanac ostaje kakav je sačuvan, trenutna forma je `null` (lak tempo pada na polaznu formu plana, zajednica šalje
   `null`), faza je prazna. Ranije je to radio zajednički kod (procenat 0,3/0,65, tolerancija 4, α).
3. Plan sa nepoznatom oznakom se ne prilagođava (eksplicitna poruka).
Izlaz generatora (generisanje, adaptacija, odluke o pripremi, predaja) nije promenjen.

## Komande i rezultati (iz `web/`)

- `npx tsc -p tsconfig.domain.json --noEmit` → 0 grešaka.
- `npx vitest run --project node src/domain/generators/` → pre ispravke inventara: 18/19 fajlova, 303/304 testa; pao
  samo `architecture` (produkcija više ne dostiže `measure.ts` — očekivano, skup sužen). Posle: v. `STATUS.md`.
- `npm run check` (typecheck, lint, format, svi testovi): v. `STATUS.md`.
- Napomena okruženja: `node_modules` nije bio instaliran; urađeno `npm ci`.

## Preostali problemi

- **A5 (delimično)**: tipovi tereta u `select.ts` (blok „tipovi tereta": `ExecutionAnalysis`, `DecisionBasis`,
  `InjuryProposal`, `PlanGenerationInput/Result`, `ResolvedPlan`, …) i dalje se čitaju iz polumaratonskih
  deklaracija. Ugovor više nije izveden iz HM objekta, ali promena HM tipa tereta menja ugovor. Treba ih deklarisati
  neutralno (format razmene) u `select.ts`.
- **A1 (ostatak)**: pretvaranje vremena testa 3 km u VDOT (`domain/training/test3k`: `t3kVdot`, `addT3k`,
  `upsertMeasurement`) je i dalje zajedničko; `vdotLog.measured` čuva izvedeni VDOT, ne sirov tempo (promena bi
  zahtevala migraciju). Stari `training/adaptation/chain.ts` produkcija dostiže samo zbog `zoneForPredLabel`
  (`matching.ts`, `prediction/summary.ts`); stari `classifyMeasurement`/`recomputeVdotChain` koriste još samo testovi i
  `src/test/phase3ImportOracle.ts`. `planBaselineVdot` (čitanje `meta.vdot0`) ostaje zajednički.
- **A3**: plan bez generatora više nema fazu (prazno) — namerno; `planPhases` nema produkcionog pozivaoca.
- **A7**: `icuPush.ts` i čarobnjak i dalje prikazuju `UNSUPPORTED_DISTANCE` (nemaju sačuvan plan pri proveri).

## Može li se 5K sada nezavisno unapređivati

Da, za politiku: tolerancija, α, faza i povratna politika 5K se menjaju u `fiveK/` bez uticaja na 10K/HM/maraton
(dokazano testom), a HM više ne nameće 5K svoju povratnu politiku pri predaji. Blokira još: (1) tipovi tereta ugovora
iz HM (A5) — 5K v2 mora da vrati iste oblike rezultata; (2) povezivanje `fiveK/v2` sa `select.ts` nije urađeno, a
njegova oznaka `5k-v2` je danas za postojeći 5K generator „unknown" (namerno) — pri povezivanju odlučiti
`KNOWN_VERSIONS` i šta se radi sa planovima `5k-v1`; (3) konverzija testa 3 km u VDOT je zajednička.
