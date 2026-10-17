# Segment 08a — 5K v2 u aplikaciji iza prekidača (generisanje, čuvanje, prikaz, čarobnjak)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni `7fa61eb`. Pravila v2 (`policy.ts`, konstrukcija) nisu
menjana — ovo je povezivanje. Adaptacija (izvršenje, bol, pauza, run/walk napredak, predlog tempa) je 08b.

## Prekidač
- Odluka na jednom mestu: `domain/generators/flags.ts` (`fiveKV2Enabled`). Ulazi: podešavanje `ui.generatorV2FiveK`
  (samo `true` uključuje; podrazumevano isključeno) i razvojni override `VITE_FIVEK_V2` (`1`/`true` uključuje, `0`/`false`
  isključuje bez obzira na podešavanje). Domen ne čita okruženje: `stores/generatorFlags.ts` čita oba i prosleđuje.
  UI: Ti → Zone i postavke treninga → „Generator plana" (checkbox; `UiState` već prenosi nepoznata polja).
- Uključen → SAMO nov 5K plan iz čarobnjaka ide kroz v2. Isključen → čarobnjak i plan istim putem kao do sada.
  HM „kraća distanca" (`handoff.ts` → 5K) ostaje na 5K v1 (i uz uključen prekidač).

## Rutiranje (`select.ts`)
- `generatorForPlan`: 5K + `meta.policyId === '5k-v2'` → `FIVE_K_V2_GENERATOR`; `5k-v1`, `legacy-5k` i sve ostalo →
  postojeći `FIVE_K_GENERATOR`. Postojeći planovi se nikad ne prebacuju. `generatorForNewPlan(dist, flags)` za nov plan.
- `KNOWN_VERSIONS` v2 = `['5k-v2.6.0']` (jedina verzija koju trenutni kod gradi). Druga ili bez verzije → `unknown` →
  `null` → `UNKNOWN_POLICY` (postojeće ponašanje). Tuđa distanca sa `5k-v2` oznakom → `null`.
- `select.ts` iz foldera distance i dalje uvozi samo `import * as fiveK` (v2 kao `fiveK.fiveKV2`); contract test bez izmene.

## Adapter `fiveK/v2/app/` (jedini kod v2 koji zna za format aplikacije)
- Izvršno uvozi samo iz `fiveK/v2/`; format razmene samo `import type` kroz `fiveK/exchange.ts` (dodat type-only
  `StructuredDay`). Odstupanje od zadatka: `generators/contract.ts` se NE uvozi ni tipom — arhitektonski test dozvoljava
  izlaz iz foldera distance samo kroz `exchange.ts`, a novi izuzetak nije dozvoljen. Tereti ugovora su lokalni strukturni
  tipovi (`app/types.ts`); usklađenost proverava `satisfies PlanGenerator` u `select.ts`.
- `plan.ts`: nedelja aplikacije = nedelja v2 (početak `startDate` v2, 7 dana, dan bez treninga = odmor), `dow` 0–6, ID
  `g{n}d{dow+1}`; dan nosi `structure` (blokovi v2 doslovno), `desc` = naslov v2, bez `session`; `pred` prazan, bez `ulaz`
  (ulaz v2 je u `fiveKV2.input`). Faza (prikazna mapa): base → BAZA, peak → RAZVOJ, sharpen → VRHUNAC, taper → TAPER,
  race → TRKA, rasterećenje → DELOAD; run/walk BAZA/TRKA. Vrsta (`structure.kind`): Repeticije, Intervali, Tempo, Tempo
  isprekidan, Trkački ritam, Usponi, Fartlek, Test, Lako, Dugo (LR), TRKA, Trčanje/hod.
- `meta`: policyId/Version, start, weeks, raceDate, raceDistM, raceName, goalSec, runDays, quality, dayWarnings (napomene i
  upozorenja v2 doslovno); sa rezultatom i vdot0/trainingVdot/racePace/goalVdot; `goalAssessment`. NAMERNO izostavljeno
  (v2 ih nema): predictedSec (inače bi `raceRefs` prognozu prikazao kao cilj), vdotGoal, realno, intensity, baseWeeks,
  assessmentBasis; čitaoci aplikacije ih već proveravaju (`fin()`), jedan `as` je u `plan.generatedPlan`.
- `generate.ts`: `generateStructured` (čarobnjak), `alignedStart` (cele nedelje do trke, prvi dan ∈ [danas, danas + 6]),
  ugovorni `generatePlan` (zajednički ulaz → ulaz v2; aplikacija ga ne koristi), `adaptGeneratedPlan`, `assess`, `product`,
  `rpeTarget`. `watch.ts`, `paces.ts`, `unsupported.ts`, `state/` + `weather.ts`, `date.ts`/`format.ts` (bez `Date`).

## Proširenja formata (opciona; bez SCHEMA bump-a i migracije; stari planovi se čitaju isto)
1. `training/types.ts`: `DayBase.structure?: WorkoutStructure`; `WorkoutStructure {title, kind?, blocks, km|null,
   sec|null, kmBasis, secBasis, rpe?, level?, projection?, goal?: 'finish'}`, `StructureBlock {reps, step, recovery?}`,
   `StructureStep {kind, zone?, km|null, sec|null, paceSec|null, paceRange?, estimatePaceSec?, kmBasis, secBasis, effort?}`,
   `StructureEffort`, `StructuredDay` (tag lako/lr/int/tempo/trka/test/rw, km|null). `StructuredDay` NIJE u uniji `Day`
   (generatori v1/10K/HM/maraton čitaju sačuvane dane svojim tipovima); oblik je onaj koji razrešen plan već podržava
   (dan kvaliteta bez `session`, km null kao posle ručne izmene). Tipovi izvezeni kroz `state` i `fiveK/exchange.ts`.
2. `PlanMeta.goalAssessment?: {status, label, message}`. 3. `GenPlanState.fiveKV2?: unknown` (ceo izlaz v2, 45–70 KB).
4. `ResolvedDay.structure?` (plan/types, contract): `resolvePlan` ga prenosi; ručna izmena tipa/km/opisa ga briše.
5. `contract.ts`: `WorkoutStructure`, `StructuredPlanInput`, `PlanRejectionReason`, `StructuredPlanResult`, `WeekdayName`.
6. `ui.generatorV2FiveK` (boolean).

## Prikaz
`domain/day/structure.ts`: `sessionCore`, `sessionBreakdown`, `sessKind`/`dayLabel`, `sessionSegments`, `estimateMinutes`,
`targetPace` prvo čitaju `structure` (bez nje — kod kao ranije). Po osećaju: „7 × 30 s po osećaju (RPE 8)", bez tempa;
run/walk: Ritam, Nivo (L, „projekcija"), Napor; trka „5 km — cilj: završiti". Ocena cilja doslovno („Cilj: nedovoljno
podataka / orijentir / završiti — <poruka v2>") na Plan tabu i Ti → Cilj; bez nje ništa (nema izmišljene prognoze).
`features/cycle/dayCells.ts`: ćelija po danu u nedelji datuma (nedelja v2 sme da počne bilo kojim danom; za nedelje od
ponedeljka isto kao ranije). Sat: `watch.ts` iz strukture (ponavljanja „Radni deo Nx" + poslednja deonica, E opseg,
mera po osnovi zadato km/vreme, kaskanje/hod kao v1); dan sa delom bez brojčanog cilja se ne šalje i broji u `skipped`.

## Ugovor `PlanGenerator` — 55 članova (zadatak navodi 45; prebrojano u kodu, test „tabela pokriva svaki član")
| Kat. | Članovi | Stanje u 08a |
|---|---|---|
| a | id, policyId, policyVersion, legacyPolicyId, planPolicy, stampPlan, phaseOfWeek | v2: oznaka `5k-v2`/`5k-v2.6.0`, faza iz v2 |
| a | generatePlan, adaptGeneratedPlan, assess, product | v2 generisanje; procena = trenutna forma (vdotGoal = vdot0); proizvod `5K`, 6 ned, pojmovi v1 = NaN |
| a | paceForZone, thresholdPace, rpeTarget, workoutsForWatch | v2 model (E = sredina E opsega, M = maratonski tempo modela); napor iz strukture; sat iz strukture |
| b | classifyMeasurement, recomputeVdotChain, sessionClassFor, currentVdot | merenje odbijeno (`no-row`), lanac nepromenjen, forma `null` |
| b | executionModel, executionBasis, buildExecutionAdjustment, buildRunWalkAdjustment, assessRunWalkProgress, qualityEntryGate, hasRecentMeasuredForm | `{error: ADAPTATION_UNSUPPORTED}` / nema preporuke / `not-applicable` / kapija zatvorena |
| b | planWithNewGoal, planRecalibrated, graftFuturePlan, alignAutomaticOverlays | odbijanje sa porukom; graft bez promene dana (`changedDays: 0` + poruka); izmene nepromenjene |
| b | vdotProposal, applyVdotProposal, undoVdotAdjustments, fitnessEvidence, planVdotNow, matchPlanRows, recalibrationMinMeasurements, recalibrationThreshold | nema predloga (`null`, 0 primenjeno), prazan dokaz, kapija ∞ |
| b | injuryProposal, applyInjuryProposal, realignPlan | nema predloga; poravnanje bez pomeranja |
| c | painStatus, acwrNow, acwrPlan, readinessModel, loadMeaning, wellnessSignals, acwrBand, acwrText, acwrPosition, ACWR_MAX/RETURN/HIGH/SCALE, weatherCard | sopstvena kopija u `app/state/`, `app/weather.ts` (izvor fiveK u 7fa61eb); test: iste vrednosti kao fiveK; tempo vremena iz strukture |
UI za (b): Plan → Prilagodi plan i Ti → Cilj prikazuju „Prilagođavanje plana stiže uskoro…" umesto alata; nijedan (b)
član ne poziva 5K v1 (test: nijedna funkcija v2 objekta nije funkcija `FIVE_K_GENERATOR`).

## Čarobnjak (samo 5K + uključen prekidač; `domain/onboarding/fiveKV2.ts`, `features/onboarding/FiveKV2Steps.tsx`)
Koraci: Trka (napomena: broj celih nedelja i prvi dan) → Rezultat (3/5/10 km + datum) ili „Nemam skoriji rezultat" →
uobičajen lak tempo (i kad je rezultat stariji od 12 ned) → Iskustvo (početnik/redovno), nedeljni km, 30 min bez prekida
→ Dani (3/4/5; run/walk tačno 3) i opcioni cilj. Pravila proverava v2; odbijanje = `Notice` „Plan nije napravljen" sa
razlozima v2 doslovno (role=status), čarobnjak ostaje otvoren, plan se ne upisuje.

## Komande i rezultati (iz `web/`)
- `npx tsc -p tsconfig.domain.json --noEmit` → exit 0.
- `npx vitest run --project node src/domain/generators/` → exit 0, 28 fajlova / 720 testova (polazno 27 / 697).
- `npm run check` (typecheck, eslint, prettier, vitest) → exit 0, 189 fajlova / 2355 testova (polazno 2326).
- Neuspesi usput (ispravljeni): eslint 6 (testovi: tip iz `select`, nepotrebni `as`); novi testovi 5/27 pogrešnih
  očekivanja (faze, `dated` sa odmorom, zaokruživanje km run/walk → dodat `estimatePaceSec`); izolacioni test v2 „ništa
  ne uvozi v2" pao kako je očekivano (aktivacija) → zamenjen strožim: van v2 ga uvozi samo `fiveK/index.ts` → `v2/app/`.
- Novi testovi: `fiveK/v2/app/app.node.test.ts` 23 (generisanje 3 vrste, odbijanje, rutiranje, prekidač, round-trip
  upis→učitavanje→backup→uvoz za sva 3 tipa, prikaz, sat, kopija stanja, tabela a/b/c); `fiveKV2Flow.test.tsx` 5 (tok v2,
  „stiže uskoro", odbijanje, isključen = stari čarobnjak, 10K bajt-isti uz uključen prekidač); `cycle.test.ts` +1.
  Reference (equivalence, guidance, personalPlan, oracle, UI tokovi) nepromenjene i prolaze.

## E2E (Playwright, Chromium iz `/opt/pw-browsers`)
`e2e/fivek-v2.spec.ts`: (1) prekidač uključen u stanju naloga → čarobnjak 5K v2 (4 dana, rezultat 22:30, cilj 21:30) →
plan `5k-v2` na serveru → Plan tab („Cilj:", „× m @ m:ss/km") → dan (Struktura: zagrevanje sa E opsegom, rad sa
tempom, profil) → Prilagodi plan „stiže uskoro"; (2) 5 dana početnik → poruka sa razlogom, plan se ne pravi.
Prvi prolaz: 1 pad (provera teksta pogodila skriven red Plan taba ispod ekrana dana) → provera ograničena na grupu
„Struktura treninga" → 2/2. `plan.spec.ts` + `workouts.spec.ts`: 9/9. Ceo paket: 67 prošlo, 12 palo —
`generator-ab-users.spec.ts` (10: zamrznuti očekivani plan bez `policyId`/faze iz A3/A7) i `pwa.spec.ts` (2: istek 30 s);
istih 12 pada na polaznom `7fa61eb` (proveren u zasebnom worktree-u), dakle nisu od 08a i nisu dirani.

## Namerno nepodržano do 08b
Sve (b): izvršenje, pauza, bol, run/walk napredak/prelaz, promena cilja, rekalibracija, predlog tempa, vraćanje verzije,
automatske izmene i poravnanje posle uvoza, prijem merenja forme (v2 nema redove predikcije). Dnevnik radi normalno.

## Stalni uslovi (AGENTS.md)
1–3: pravila v2 (obim, doza, dugi, WU/CD, plafoni) nisu dirana; adapter prenosi strukturu doslovno, a jedine njegove
odluke (mapa faze, ime vrste, oblik dana) imaju po jedno mesto (`app/plan.ts`). 4: adaptacija nije povezana (08b).
5: v2 ne prima i ne šalje handoff (HM → 5K ostaje v1). 6: plan nosi `5k-v2`/`5k-v2.6.0` i fazu svake nedelje iz odluke
v2 (`stampPlan`). 7: `fiveK/v2/app/` izvršno samo iz `fiveK/v2/`, tipovi kroz `exchange.ts`; isolation (v2, fiveK),
architecture i contract testovi bez novih izuzetaka. 8: validator v2 nepromenjen; test adaptera: svaka nedelja 7 dana,
svaki trening ima blokove strukture, degenerisan ulaz → odbijanje sa razlozima.

## Preostali problemi
- Sat: deo po osećaju (kvalitet, ubrzanja plana po osećaju) i run/walk bez uobičajenog tempa se ne šalju (broje se u
  `skipped`); ručno izmenjen dan v2 plana gubi strukturu, pa se ne šalje.
- Km dana trke uključuje zagrevanje/hlađenje, a nedeljni km Plan taba sabira i trku (v2 trku ne računa u obim nedelje).
- Napredak → Forma za v2 plan: bez lanca forme i redova predikcije (prazno do 08b).
- `meta` v2 nema obavezna polja `PlanMeta` koja v2 ne zna (tip ih tvrdi); novi čitalac mora da ih proverava. Stanje (c)
  je kopija — promena u fiveK se ne prenosi (namerno); test jednakosti to otkriva.
