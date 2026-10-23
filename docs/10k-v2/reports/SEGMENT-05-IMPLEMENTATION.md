# 10K v2 — Segment 05: 10K v2 u aplikaciji iza prekidača (generisanje, čuvanje, prikaz, čarobnjak, sat)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `068410b`. Jezgro 10K v2 (policy, konstrukcija, assess,
validate) nije menjano — verzija ostaje `10k-v2.4.0`; ovo je povezivanje po obrascu 5K 08a–08c (ništa iz `fiveK` se ne uvozi).

## Prekidač (P1)

- `domain/generators/flags.ts` `tenKV2Enabled` (kao 5K: samo `true`; `VITE_TENK_V2` `1`/`true` uključuje, `0`/`false` isključuje
  uvek). `generatorFlags(fiveK, tenK?)`: bez izvora 10K polje `tenKV2` izostaje (= isključen) — postojeći pozivi i test 5K isti.
  Okruženje i `ui.generatorV2TenK` čita `stores/generatorFlags.ts`. UI: Ti → Zone i postavke treninga → „Novi 10K plan pravi
  generator v2 (probno)", vidljiv SAMO administratoru ili uz `VITE_TENK_V2` (`tenKV2ToggleVisible`). Uključen → samo NOV 10K plan.

## Rutiranje (P2, `select.ts`)

- `generatorForPlan`: 10K + `policyId === '10k-v2'` → `TEN_K_V2_GENERATOR`; `10k-v1`, `legacy-10k`, ostalo → `TEN_K_GENERATOR`.
  `KNOWN_VERSIONS = ['10k-v2.4.0']`; druga verzija ili bez nje → `unknown` → `null` → `UNKNOWN_POLICY` (nikad 10K v1). Tuđa
  distanca (5K/HM/maraton) sa `10k-v2` → `null`. `generatorForNewPlan(10000, { tenKV2: true })` → v2; postojeći plan se ne
  prebacuje (izbor plana ne čita prekidač). HM/maraton „kraća distanca" → `handoff.ts` → 10K v1 (predaja v2 je 06).
- Novo: `isTenKV2Plan`, `adaptationUnsupportedFor`, `tracksOffPlanRuns` (P8), `generateTenKV2Plan`, `tenKV2Start`; iz `tenK`
  i dalje samo `import * as tenK` (v2 = `tenK.tenKV2`), contract test bez izmene.

## Adapter `tenK/v2/app/` (P3) — fajl → odgovornost

| fajl                                           | odgovornost                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                     | LOKALNI strukturni oblici formata (plan za upis, dan sa strukturom, razrešen plan, zapisi, tereti ugovora)                                                                                                                                                                                                                                                                         |
| `plan.ts`                                      | nedelja v2 → nedelja aplikacije (7 dana, odmor = dan bez treninga, ID `g{w}d{dow+1}`); JEDNA mapa faze (base → BAZA, development → RAZVOJ, specific → VRHUNAC, taper → TAPER, race → TRKA, rasterećenje → DELOAD); tip i vrsta dana (Repeticije, Intervali, Tempo, Tempo isprekidan, Trkački ritam, Test, Lako, Dugo (LR), TRKA); `meta`; `planPolicy`, `stampPlan`, `phaseOfWeek` |
| `structure.ts`                                 | trening v2 → `WorkoutStructure` blok po blok (segmenti doslovno; piramida = blok po deonici i oporavku); po osećaju: rad nosi RPE + tempo kao procenu (`estimatePaceSec`), ubrzanja/trka po osećaju i test 5 km = procena                                                                                                                                                          |
| `generate.ts`                                  | `generateStructured` (čarobnjak), `alignedStart` (cele nedelje do trke, prvi dan ∈ [danas, danas + 6]), ugovorni `generatePlan`/`adaptGeneratedPlan`, `assess`, `product` (10K, 8 ned; pojmovi v1 = NaN), `rpeTarget`                                                                                                                                                              |
| `watch.ts`                                     | sat iz strukture; dan sa delom bez propisanog tempa / bez strukture → `skipped` + `skippedReasons`                                                                                                                                                                                                                                                                                 |
| `paces.ts`                                     | `paceForZone`, `thresholdPace` iz v2 modela                                                                                                                                                                                                                                                                                                                                        |
| `members.ts`                                   | 26 članova (b): eksplicitno nepodržano do 06, razlog po članu (`UNSUPPORTED`); fajl nema nijedan uvoz                                                                                                                                                                                                                                                                              |
| `state/`, `weather.ts`, `date.ts`, `format.ts` | kopija procene stanja i vremena iz `tenK/recovery`, `tenK/weather` (068410b) sa lokalnim tipovima; datumi nad `../dates.ts`                                                                                                                                                                                                                                                        |
| `index.ts`                                     | objekat `tenKV2` (izvozi ga `tenK/index.ts`)                                                                                                                                                                                                                                                                                                                                       |

`meta`: policyId/Version, start, weeks, raceDate, raceDistM 10000, raceName, goalSec, runDays, quality, paceBasis, `vdot`
(`null` po osećaju), uz rezultat `vdot0`/`trainingVdot`/`racePace`/`predicted10kSec` (ime iz v2 — NE `predictedSec`, koji
`raceRefs` čita kao cilj)/`goalVdot`, `goalAssessment` (realističan/ambiciozan/nerealan/orijentir + poruka v2), `dayWarnings` =
napomene + upozorenja v2 doslovno. Izostavljeno (v2 nema): intensity, vdotGoal, realno, baseWeeks, assessmentBasis.

**Odstupanje (izolacija):** test `tenK/v2/isolation.node.test.ts` je STROŽI od 5K — ni type-only uvoz van `tenK/v2/`. Uvoz
tipova iz `tenK/exchange.ts` bi bio nov izuzetak, pa ga nema: oblici formata su lokalni, parametri adaptera su širi (`string`
datum, samo potrebna polja), plan/izmene/lanac prolaze generički, a datum analize izvršenja dobija tip iz razrešenog plana.
`satisfies PlanGenerator` u `select.ts` prolazi bez kasta za 53 od 55 članova; kast na granici samo gde adapter PRAVI plan
formata (dan sa strukturom van unije `Day`): `generatePlan`, `adaptGeneratedPlan` i pomoćni `generateTenKV2Plan` (komentar).
Jedina izmena testa izolacije je aktivacija (kao 5K 08a): „van v2 ga uvozi SAMO `tenK/index.ts` → `v2/app/index.ts`".

**Format (P4; opciono, bez SCHEMA bump-a i migracije):** `GenPlanState.tenKV2?: unknown` (ceo izlaz v2; 6 d/18 ned
≈ 143 KB JSON, 10 833 čvora — ispod granice revizije 30 000 čvorova / 250 000 znakova); `versions.PLAN_FIELDS` + `tenKV2`
(vraćena verzija je plan v2 — test); `contract.TenKV2PlanInput`; `WatchBatch.skippedReasons?`. `structure`/`StructuredDay`
iz 08a bez izmene. Stari planovi se čitaju isto.

## Ugovor `PlanGenerator` — 55 članova (test: tabela pokriva svaki član; nijedna funkcija nije funkcija 10K v1)

| Kat.   | Članovi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Stanje u 05                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a (15) | id, policyId, policyVersion, legacyPolicyId, planPolicy, stampPlan, phaseOfWeek, generatePlan, adaptGeneratedPlan, assess, product, workoutsForWatch, thresholdPace, rpeTarget, paceForZone                                                                                                                                                                                                                                                                                                                    | v2: oznaka `10k-v2`/`10k-v2.4.0`, faza iz v2, generisanje, procena (vdotGoal = vdot0), sat/napor iz strukture                                                             |
| b (26) | classifyMeasurement, recomputeVdotChain, sessionClassFor, currentVdot, executionModel, executionBasis, buildExecutionAdjustment, buildRunWalkAdjustment, assessRunWalkProgress, qualityEntryGate, hasRecentMeasuredForm, planWithNewGoal, planRecalibrated, graftFuturePlan, alignAutomaticOverlays, vdotProposal, applyVdotProposal, undoVdotAdjustments, fitnessEvidence, planVdotNow, matchPlanRows, recalibrationMinMeasurements, recalibrationThreshold, injuryProposal, applyInjuryProposal, realignPlan | „nepodržano do 06" sa razlogom: odbijanje (`ADAPTATION_UNSUPPORTED`), `null`/0 primenjenih, nepromenjen ulaz, kapija ∞, merenje `not-used`; `members.ts` bez uvoza (test) |
| c (14) | weatherCard, painStatus, acwrNow, acwrPlan, readinessModel, loadMeaning, wellnessSignals, acwrBand, acwrText, acwrPosition, ACWR_MAX/RETURN/HIGH/SCALE                                                                                                                                                                                                                                                                                                                                                         | kopija `tenK/recovery` (test: iste vrednosti kao `TEN_K_GENERATOR`); vreme: tempo iz strukture                                                                            |

UI za (b): Plan → Prilagodi plan i Ti → Cilj: „Prilagođavanje plana stiže uskoro…" (`#v2-unsupported`) umesto alata v1.

## Čarobnjak (P5; samo 10K + uključen prekidač)

`domain/onboarding/tenKV2.ts` + `features/onboarding/TenKV2Steps.tsx`; izbor koraka u `Wizard.tsx`. Koraci: Trka (napomena:
cele nedelje i prvi dan) → Rezultat (3/5/10 km, polumaraton sa satima, datum) ili lagan tempo (i uz rezultat > 12 ned) → 30 min
bez prekida, obim, iskustvo → dani (3–6), dan dugog („Plan bira" ili jedan od dana), opcioni cilj. „Ne još" → odmah odbijanje
v2 doslovno („…preporuka: 5K plan (trčanje/hodanje).", role=status), dalje se ne ide. Odbijanje pri izradi → „Plan nije
napravljen" + razlozi v2 doslovno; čarobnjak ostaje otvoren, plan se ne upisuje.

## Prikaz (P6) i sat (P7)

- `domain/day/structure.ts`: procenjen tempo → „po osećaju (RPE 6–7), orijentir (procena) 5:12/km", test/trka po osećaju →
  „5 km — orijentir (procena) …"; piramida → „Odmor" redom. 5K v2 bajt-isto (run/walk ne ulazi u novu granu; testovi isti).
- Trka i njen WU/CD van nedeljnog obima (postojeći `outsideWeekVolume`, test: km nedelje = `plannedKm` v2). Izmena samo tempa
  čuva strukturu (`resolve.withWorkPace`, test). Upozorenja v2 u „Na šta da paziš" (UI test).
- Sat: deo po osećaju/procena i ručno izmenjen dan bez strukture se ne šalju → `skipped` + `skippedReasons`, ispisani u
  Ti → Slanje na sat (`#icu-skipped`); bez razloga (ostali generatori) stari tekst.

**Uvoz (P8):** `stravaSync`/`icuSync`: uslov 08c `isFiveKV2Plan` → `tracksOffPlanRuns` (5K v2 ili 10K v2). Plan 10K v2:
trčanje na dan plana → dnevnik, na dan odmora → `vanPlanaV2`, potpuna sinhronizacija → `fullSync` (`importV2.node` 3;
sabotaža: stari uslov → 2/3 pada). Plan v1: bez promene (`importV1Snapshot` = heš f09a50a, prolazi na 068410b i posle).

## Fajlovi van `tenK/v2` (svaki sa razlogom)

- `domain/generators/tenK/index.ts` — izvoz `tenKV2`. `select.ts` — P2 + generator v2 + granica formata. `flags.ts` — P1.
- `domain/generators/contract.ts` — `TenKV2PlanInput`, `WatchBatch.skippedReasons?`. `domain/state/types.ts` — `tenKV2?`.
- `domain/plan/versions.ts` — `PLAN_FIELDS` + `tenKV2`. `domain/day/structure.ts` — prikaz procene i odmora piramide.
- `domain/onboarding/tenKV2.ts` (novo), `features/onboarding/TenKV2Steps.tsx` (novo), `features/onboarding/Wizard.tsx` — P5.
- `features/ti/screens.tsx` — prekidač 10K v2; Cilj: poruka. `features/ti/icuSections.tsx` — razlozi preskočenih dana.
- `features/plan/AdjustPlan.tsx` — „stiže uskoro" za 10K v2 (bez alata v1). `stores/generatorFlags.ts` — P1.
- `services/strava/stravaSync.ts`, `services/icu/icuSync.ts` — P8 (samo uslov + komentar).
- Testovi: `features/onboarding/tenKV2Flow.test.tsx`, `features/ti/tenKV2Watch.test.tsx`, `e2e/tenk-v2.spec.ts` (novi).

## Komande i rezultati (iz `web/`)

- Tokom rada: `vitest --project node src/domain/generators/` 49 / 985; UI (`src/features src/stores src/services`) 46 / 395.
- Pre commita (jednom): `npx tsc -p tsconfig.domain.json --noEmit` exit 0; `npx tsc -p tsconfig.oracle.json --noEmit` exit 0;
  `npm run check` (tsc -b, eslint, prettier, vitest) exit 0 — 216 fajlova / 2642 testova (068410b: 211 / 2601; +5 / +41).
  Posle check-a izmenjen samo `app.node.test.ts` (nezavisna mapa faze, v. sabotaže): tsc -b 0, eslint 0, prettier 0, 26/26.
- Novi testovi: `app.node` 26, `byteSame.node` 2, `importV2.node` 3, `tenKV2Flow` (UI) 8, `tenKV2Watch` (UI) 2.
- Neuspesi usput (ispravljeni): tsc 1 (tip `Set` u testu); test 1/26 („1000 m" → prikaz „1 km"); UI 1/8 (polje „sati");
  eslint 12 (nepotrebni kastovi, i `as IsoDate` u kopiji stanja — datum je lokalno `string`); bajt-isti 1 (uključen 10K v2:
  ulaz v1 bez datuma rezultata v2 odbija → poređenje bez 10K).

## E2E (Playwright, Chromium `/opt/pw-browsers`)

- `e2e/tenk-v2.spec.ts` 3/3 iz prvog pokušaja: (1) prekidač u stanju naloga → čarobnjak (45:00, 4 dana, dugi nedeljom, cilj
  43:00) → server `10k-v2`/`10k-v2.4.0` + `tenKV2` → Plan tab → dan (Struktura treninga) → Prilagodi plan „stiže uskoro";
  (2) po osećaju → RPE + „orijentir (procena)", test 5 km; (3) „Ne još" → odbijanje v2 doslovno, plan na serveru `null`.
- Ceo paket (`npx playwright test`, podrazumevano): 81 prošlo, 2 pala — `pwa.spec.ts` (bez mreže; ažuriranje), istek 30 s.
  Na 068410b (čist worktree, isti način): 78 prošlo, ista 2 pada → novih padova 0. Sa `--workers=1 --timeout=120000` ista 2
  pada i na 068410b i posle (čarobnjak `createPlan`: „Dalje" ostaje onemogućeno); test nije diran.
- `generator-ab-users.spec.ts` 10/10 u celom paketu (prekidač isključen → 10K v1, razlika v1/v2 se ne javlja).

## Bajt-isto (prekidač isključen)

`tenK/v2/app/byteSame.node.test.ts` + `byteSame.068410b.json`: 140 SHA-256 (čarobnjak → generator nove distance → upis →
razrešen plan → faza, politika, sat, napor, prag, promena cilja, izvršenje, prilagođavanje, bol, opterećenje) za 5K v1 (2),
10K v1 (3), HM, maraton, 5K v2 (3, uz prekidač 5K + adaptacija) i lični plan. Snimljen na 068410b (worktree, 2× isti) →
posle izmene isti. Drugi test: uz uključen 10K v2 svi ne-10K heševi isti, nov 10K plan je `10k-v2`. Uvoz v1:
`importV1Snapshot` prolazi na 068410b i posle; postojeći UI tokovi (5K/10K/HM/maraton) bez izmene.

## Stalni uslovi (AGENTS.md)

1–3: pravila v2 nisu dirana; adapter prenosi strukturu doslovno, njegove odluke (mapa faze, ime vrste, tip dana, šta je
procena) imaju po jedno mesto (`plan.ts`, `structure.ts`). 4: adaptacija nije povezana (06). 5: handoff nije diran (HM → 10K
ostaje v1, test). 6: plan nosi `10k-v2`/`10k-v2.4.0` i fazu svake nedelje iz v2 (`stampPlan`, test). **7:** `tenK/v2/app/` ne
uvozi NIŠTA van `tenK/v2/` (ni tip); isolation (v2 strogi, tenK), architecture i contract testovi bez novih izuzetaka; jedina
ivica ka v2 je `tenK/index.ts` → `v2/app/index.ts`. **8 (upotrebljivost):** test adaptera za 4 plana (rezultat 4/6 d, po
osećaju, početnik): svaka nedelja 7 dana, svaki trening ima blokove i km > 0, zbir blokova = km treninga, dugi ≥ svaki lagan,
nedelja ≥ minimum (D17), trka van obima, faza iz v2; degenerisan ulaz (trčanje/hodanje, 7 dana, < 8 ned, obim, bez tempa) →
odbijanje sa razlozima. Sabotaže adaptera (pokvareno → `app.node` + `importV2`, 29 testova → vraćeno, md5 `app/` isti):
prazan trening (dugi bez blokova) 7, nedelja bez dana odmora 4, trka kao lagan dan (u obimu) 7, faza `specific` → RAZVOJ 4,
deo po osećaju sa tempom (sat šalje procenu) 3, dugi kraći od laganog 4. Prvi krug: faza 0 — test je fazu poredio istom
funkcijom adaptera → ispravljen na nezavisnu mapu iz zadatka (P3).

## Odluke

- Lokalni tipovi umesto `exchange.ts` (strogi test izolacije, bez izuzetka); kast na granici samo gde adapter pravi plan.
- Po osećaju: tempo T/I/R/RP = procena (`estimatePaceSec`), cilj je RPE; sat ga ne šalje (P7). Test 5 km uvek procena.
- `meta.vdot` = `null` po osećaju; prognoza samo uz rezultat (`predicted10kSec`). Trčanje/hodanje: odbijanje v2 već na koraku 3.

## Preostali problemi (čeka 06)

- Sve (b): činjenice (dnevnik, bol, pokrivenost, pauze, `vanPlanaV2`) → `adaptTenKV2` sa pregledom, revizija, vraćanje
  verzije spajanjem, promena cilja, Forma iz rezultata; predaja HM/maraton → 10K v2.
- Sat ne šalje dane plana po osećaju (rad kvaliteta, ubrzanja trkačke nedelje) — samo uz ručni tempo dana.
- Posle adaptacije (06): `structure.ts` uzima E opseg i „po osećaju" iz plana (`paceBasis`, `paces`), ne po nedelji.
- Plan 10K v2 ~2× veći od 5K v2 (≈ 143 KB; 5 revizija ≈ 0,7 MB lokalno). Kopija stanja (c) se ne prenosi iz tenK sama.
