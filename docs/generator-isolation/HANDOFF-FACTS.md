# Predaja-1 — v1 predaja između distanci: cilj sam izvodi povratni ulaz iz činjenica

Grana `claude/generator-isolation-5k-10k-hm-marathon`; polazni SHA `bf47249` (10K v2 Segment 06b). Bez PR-a, mergea i
deploya. `fiveK/v2/`, `tenK/v2/`, `features/`, `stores/`, `select.ts` nisu dirani. `RETURN_POLICY` vrednosti i udeo za
umor 0,85 nisu menjani ni u jednoj distanci. Nijedan novi uvoz između generatora.

## 1. Odluka (doslovno, tačke 1–5)

1. Jedan vlasnik povratnog ulaza po distanci. U plan/executionAdjustment.ts svakog CILJA (fiveK, tenK v1, halfMarathon)
   izdvoji čistu funkciju, npr.:
     returnInput(original: PlanGenerationInput, today: IsoDate,
                 facts: { base: number; longRunKm?: number; breakDays?: number; fatigued: boolean })
   Ona je JEDINO mesto koje iz potvrđenih činjenica izvodi: startDate, weeklyKm, recentLongRunKm, currentReadiness,
   breakWeeks, intensity, volIntensity, trainedRecently, politiku (returnPolicyFor), guardBaseKm i execution meta
   (startingKm). Pravila su ista kao danas u njegovom executionBasis; ništa se ne menja u brojevima.
   Sopstveni executionBasis tog generatora je poziva posle svoje validacije. Ponašanje mora ostati bajt-isto.
   HM i maraton kao IZVORI isto mogu da koriste svoju funkciju za sopstveni plan (HM je i izvor i cilj).
2. handoffFuture(current, input, today, context, facts) u svakom cilju:
   - facts.execution postoji i ima reason → ulaz se gradi pozivom returnInput nad ulazom izvora sa:
       base = execution.reportedBaseKm
       longRunKm = execution.reportedLongRunKm
       breakDays = execution.breakDays
       fatigued = execution.reason === 'fatigue'
     Iz ulaza izvora ostaju samo polja koja nisu izvedena (distanca, datumi trke, cilj, dani, rezultat itd.).
     Politika, guardBaseKm (kad facts.restartFromBase) i startingKm u execution meta su odluke CILJA.
   - facts.execution = null → ulaz ostaje kakav jeste (to je stvarna baza korisnika; ponašanje kao danas).
   - execution bez reason (stariji meta): ulaz ostaje kakav jeste i dodaje se napomena u notes. Bez pogađanja umora.
     Izmeri koliko je takvih slučajeva u referencama i upiši broj.
3. Izvori (HM, maraton): ponašanje za sopstveni plan se ne menja. preparationDecision i dalje predaje basis.input,
   pošto cilj izvedena polja sam prepisuje. Ispravi komentare (handoffTarget.ts, preparationDecision.ts): izvor predaje
   ulaz i činjenice; cilj iz činjenica sam izvodi obim, dugi, spremnost i politiku.
4. contract.ts: ReturnPolicy = { readonly days: number; readonly fraction: number; readonly easyWeeks: number }.
   Komentar: aplikacija vrednost ne čita, samo je vraća generatoru. Nijedan drugi tip u ugovoru se ne menja.
5. RETURN_POLICY vrednosti i udeo za umor 0,85 se NE menjaju ni u jednoj distanci.

### Sudar sa pravilom putanja (tačka 4) i odluka

Neutralan `ReturnPolicy` samo u `contract.ts` ne prolazi `tsc`: `PreparationApi` predaje osnovu (`DecisionBasis`) iz
aplikacije generatoru, a HM i maraton je primaju sa doslovnim tipom politike
(`(typeof RETURN_POLICY)[keyof typeof RETURN_POLICY]`, `as const`).

| Stanje | `npx tsc -b --noEmit` |
|---|---|
| samo `contract.ts` neutralan | TS2345 u `select.ts` 989, 996 (HM) i 1006, 1016 (maraton) |
| + tip `ReturnPolicy` u `halfMarathon/plan/regenerate.ts` | TS2345 u `select.ts` 1006, 1016 (maraton) |
| + tip `ReturnPolicy` u `marathon/plan/regenerate.ts` | exit 0 |

`marathon/plan/` je po zadatku „samo komentari", a `select.ts` je zabranjen. Sudar je prijavljen pre commita; odluka
korisnika: **dozvoljena izmena samo tipa** `ReturnPolicy` u `marathon/plan/regenerate.ts` (i `halfMarathon/plan/
regenerate.ts`) na neutralan oblik. Vrednosti i izvršni kod se ne menjaju. Kontrola organizatorovog primera
(HM `short.fraction` 0,85 → 0,8, samo za proveru, vraćeno): na `bf47249` → 6 grešaka u `select.ts` (TS2322 717 i 983,
TS2719 737 i 984, TS2345 989 i 996); posle izmene → `tsc` exit 0.

### Sudar sa postojećim testom (tačka 2) i odluka

Pun `vitest run` sa doslovnom tačkom 2 (svako izvršenje sa `reason` → `returnInput`): **1 pad**,
`features/onboarding/marathonFlow.test.tsx:248` („ceo tok ide kroz izdvojeni maratonski generator i čuva istoriju";
`expected undefined to be defined`, opcije odluke `[{"kind":"base"}]`). Tok:

1. maraton → potvrđena pauza (`breakDays` 14, baza 25, dugi 8; `execution.date` 2026-02-11) → upis;
2. „Vraćanje prethodne verzije" (`stores/executionActions.previewRestore` → `graftFuturePlan(trenutni, snapshot)`):
   `meta` se spaja kao `{ ...trenutni.meta, ...snapshot.meta }`, pa `meta.executionAdjustment` OSTAJE, a `ulaz` je
   originalni ulaz plana (start 2026-01-07, `weeklyKm` 32, `intensity` `std`);
3. promena cilja; 4. odluka o pripremi istog dana → „kraća distanca: polumaraton".

Razlika predatog i izvedenog ulaza HM cilja (`returnInput`): `startDate` 2026-01-07 → 2026-02-12, `weeklyKm` 32 →
17,5, `recentLongRunKm` — → 5,6, `currentReadiness` — → `returning` do 2026-03-02, `breakWeeks` — → 2,
`intensity`/`volIntensity` `std` → `kons`, `trainedRecently` true → false. Na `bf47249` HM plan iz 32 km pokriva
distancu i opcija postoji; posle izvođenja pokrivenost je `insufficient` i opcije nema.

Uzrok nije razlika tablica politike, nego predaja izvršenja uz ulaz koji iz njega NIJE izveden (posle vraćanja
verzije). Prijavljeno pre commita; odluka korisnika: **pravilo saglasnosti, bez napomene** — cilj izvodi iz činjenica
samo kad je predati ulaz izveden iz njih (`input.startDate === execution.date + 1`, jer `returnInput` uvek postavlja
`startDate = dan posle potvrde`); inače važi predati ulaz (politika iz `execution.breakDays`, baza rasta iz ulaza,
izvršenje izvora), kao na `bf47249`. Očekivanje testa nije menjano.

## 2. Fajl → izmena

| Fajl | Izmena |
|---|---|
| `fiveK/plan/executionAdjustment.ts` | nova `returnInput(original, today, facts)` + `ReturnFacts`; `executionBasis` posle validacije poziva `returnInput` (`{ ...derived, base, weeklyKm }`, isti redosled ključeva) |
| `tenK/plan/executionAdjustment.ts` | isto (10K v1) |
| `halfMarathon/plan/executionAdjustment.ts` | isto; HM je i izvor i cilj, sopstveni plan ide kroz istu funkciju |
| `fiveK/plan/handoffTarget.ts` | `handoffInput`: izvršenje sa `reason` i saglasan ulaz (`startDate` = `execution.date` + 1) → `returnInput(input, execution.date, činjenice)`; `null` ili nesaglasan ulaz → predati ulaz (kao `bf47249`); bez `reason` → predati ulaz + napomena; `handoffFuture` gradi plan iz `own.input`, `own.policy`, `own.guardBaseKm` (kad `restartFromBase`), `own.execution`; komentari |
| `tenK/plan/handoffTarget.ts` | isto |
| `halfMarathon/plan/handoffTarget.ts` | isto |
| `halfMarathon/plan/preparationDecision.ts` | samo komentari (`HandoffFacts`, `regenerate`) |
| `marathon/plan/preparationDecision.ts` | samo komentari (isto) |
| `halfMarathon/plan/regenerate.ts` | samo tip `ReturnPolicy` → neutralan oblik (tačka 4) |
| `marathon/plan/regenerate.ts` | samo tip `ReturnPolicy` → neutralan oblik (tačka 4, odluka korisnika) |
| `contract.ts` | `ReturnPolicy` = `{ readonly days: number; readonly fraction: number; readonly easyWeeks: number }` + komentar |
| `policyIsolation.node.test.ts` | T1 i T2 (ceo tok, 3 predaje), postojeći slučajevi razdvojeni i preimenovani |

Izbor datuma u predaji: cilj poziva `returnInput` sa `execution.date` (dan potvrde činjenica), ne sa danom odluke. Uz
`today` odluke svaka osnova iz sačuvanog plana sa ranijim `execution.date` dobila bi drugi `startDate` i prozor
povratka (`currentReadiness.until`) nego danas, pa ponašanje ne bi bilo bajt-isto. U `executionBasis` je
`execution.date === today`, pa je za tok iz osnove izvršenja razlika nemoguća.

## 3. Dokaz problema na `bf47249`

Novi `policyIsolation.node.test.ts` pokrenut nad nepromenjenim kodom `bf47249` (zaseban worktree): **6 od 16 pada**
(T1 i T2 za sve tri predaje). Izmena SAMO politike izvora (`withPolicy`: udeo × 0,5, `easyWeeks` + 3), ceo tok:

| Predaja | ulaz cilja `weeklyKm` | `recentLongRunKm` | `currentReadiness.until` | propisani treninzi različito |
|---|---|---|---|---|
| HM → 10K (U08) | 38,5 → **19,3** | 11,2 → 5,6 | 2026-12-14 → 2027-01-04 | **35 / 82** |
| HM → 5K (U08) | 38,5 → **19,3** | 11,2 → 5,6 (isti `basis.input`) | 2026-12-14 → 2027-01-04 | **35 / 82** |
| maraton → HM (U10) | 33 → **16,8** | 13,2 → 6,7 | 2026-12-21 → 2027-01-11 | **65 / 118** |

Meta koja se menjala (izvor): `meta.athlete`, `meta.dayWarnings`, `meta.preparation`, `meta.executionAdjustment`
(`startingKm` izvora), `meta.finalization`, `result.pred`, `result.qs`, `notes`.
Kontrola na `bf47249` (izmena SAMO politike cilja): `weeklyKm` cilja ostaje 38,5 / 33; različito 7 / 82 (10K i 5K) i
8 / 118 (HM) — politika cilja je birala samo lagane nedelje povratka.

„Propisani treninzi" = dani koji nisu odmor (`!day.rest`) u planu kraće distance; broj različitih = dani (po redu
nedelja/dana) čiji JSON nije isti. HM → 5K i HM → 10K daju iste brojeve, ali različite planove (18 od 98 dana
različito između njih); razlika zbog politike je u istim nedeljama povratka.

## 4. Posle izmene

| Test | HM → 10K (U08) | HM → 5K (U08) | maraton → HM (U10) |
|---|---|---|---|
| T1: politika izvora × 0,5 / +3, ceo tok (`executionBasis` → `buildPreparationChoice`) | ulaz bajt-isti, nedelje bajt-iste, 0 / 82 različito | isto, 0 / 82 | isto, 0 / 118 |
| T1: razlike u metapodacima | **nijedna** | **nijedna** | **nijedna** |
| T2: politika cilja × 0,5 / +3 | `weeklyKm` 38,5 → 19,3; 35 / 82 različito | `weeklyKm` 38,5 → 19,3; 35 / 82 | `weeklyKm` 33 → 16,8; 65 / 118 |

Očekivana dozvoljena razlika („meta izvora koja opisuje njegovu politiku") ne postoji: `executionAdjustment` u planu
kraće distance sada piše cilj (`startingKm` cilja), a ni jedno drugo polje izbora (`summary`, `notes`, `change`,
`pred`, `qs`, `meta.*`) ne zavisi od politike izvora. T1 to tvrdi kao `meta = []`.

Postojeći slučajevi, preimenovani prema onome što proveravaju (oba prolaze):
- „cilj ne čita objekat politike izvora posle izračunate osnove" (+ kontrola cilja nad istom osnovom, bivši slučaj 3);
- „osnova iz sačuvanog plana" (+ regresija oznake politike `stampForStorage`).

## 5. Regresija

Sve postojeće reference prolaze **bez izmene očekivanja**; nijedan referentni fajl ni test očekivanja nije diran.
Završni prolaz `npx vitest run --project node src/domain/generators` na konačnom kodu: **51 fajl, 1026/1026**
(`bf47249`: 51 fajl, 1016/1016; razlika +10 = `policyIsolation` 6 → 16 testova). Broj tokova je broj ključeva u
referentnom fajlu.

| Referenca (test) | Tokovi u referenci | Rezultat |
|---|---|---|
| `otherDistances.node.test.ts` (`otherDistances-reference.json.gz`) | 2 211 generisanja, 17 638 adaptacionih tokova, 157 odluka o pripremi (uklj. „kraća distanca: 5K/10K/HM") | bajt-isto |
| `fiveK/equivalence.node.test.ts` | 1 064 generisanja, 14 942 adaptacije | bajt-isto |
| `tenK/equivalence.node.test.ts` | 1 100 generisanja, 14 267 adaptacija | bajt-isto |
| `halfMarathon/equivalence.node.test.ts` | 1 826 generisanja, 27 596 adaptacija, 519 odluka | bajt-isto |
| `marathon/equivalence.node.test.ts` | 1 843 generisanja, 25 764 adaptacije, 1 581 odluka | bajt-isto |
| `guidance.node.test.ts` (`guidance-reference`, `state-reference`) | 14 744 + 7 380 tokova | bajt-isto |
| `personalPlan.node.test.ts` | 13 782 toka | bajt-isto |
| `tenK/v2/app/byteSame.node.test.ts` (10K v1 kroz aplikaciju) | 140 heševa | bajt-isto |
| `runtimeIsolation.node.test.ts` | predaje kroz `handoff.ts` i izolovane instance | prolazi |
| `policyIsolation.node.test.ts` (postojeći slučajevi) | A1, „cilj ne čita objekat politike izvora…", „osnova iz sačuvanog plana", A3/A7 | prolazi |
| `architecture.node.test.ts`, `contract.node.test.ts` | pravila uvoza, bez novih izuzetaka | prolazi |
| `features/onboarding/{marathon,halfMarathon}Flow.test.tsx` | tok sa vraćanjem verzije (v. 1, sudar 2) | prolazi (posle pravila saglasnosti) |

Instrumentacija (v. 7) potvrđuje da je bajt-istost stvarna, ne slučajna: u svih 23 821 predaje sa saglasnim ulazom bez
izmene politike, ulaz koji cilj izvodi i `executionAdjustment` su bajt-isti predatim.

## 6. Sabotaže (pokvari → test pada → vrati)

Svaka sabotaža je primenjena u sva tri cilja (5K, 10K, HM), pokrenut `policyIsolation.node.test.ts` (16 testova),
pa vraćeno (`git diff` posle vraćanja = isti kao pre).

| Sabotaža | Palo | Koji testovi | Poruka (primer) |
|---|---|---|---|
| (a) `handoffFuture` opet uzima `input.weeklyKm` (`{ ...own.input, weeklyKm: input.weeklyKm }`) | **6 / 16** | T1 i T2 × 3 predaje | T1: `ulaz.weeklyKm 38.5 → 19.3; različito 35 od 82`; T2: `38.5 → 38.5` |
| (b) `returnInput` koristi udeo izvora (`facts.sourceFraction = startingKm / reportedBaseKm`) | **6 / 16** | T1 i T2 × 3 predaje | T1: `38.5 → 19.3; 35 od 82`; T2: `38.5 → 38.5; 7 od 82` |
| (c) `guardBaseKm` iz ulaza izvora (`input.weeklyKm`) | **3 / 16** | T1 × 3 predaje | ulaz bajt-isti, nedelje ne: `različito 30 od 82` (U08), `60 od 118` (U10) |

Pravilo saglasnosti: bez njega (doslovna tačka 2) pada `marathonFlow.test.tsx` (v. 1); sa njim prolazi.

## 7. „execution bez reason"

**U izvršavanju: 0.** Privremena instrumentacija `handoffFuture` (sva tri cilja; uklonjena pre commita), pun
`npx vitest run` (4 projekta, 219 fajlova):

| Predaje | 5K | 10K | HM | ukupno |
|---|---|---|---|---|
| bez izvršenja (`execution = null`) | 64 | 382 | 554 | **1 000** |
| izvršenje **bez `reason`** | 0 | 0 | 0 | **0** |
| `confirmed-break` / `fatigue` / `reduced-volume` | 4 964 / 271 / 537 | 10 320 / 684 / 1 126 | 4 942 / 408 / 586 | 20 226 / 1 363 / 2 249 |
| sa `reason`, saglasan ulaz, izveden ulaz i `executionAdjustment` **bajt-isti** predatom | 5 769 | 12 123 | 5 929 | **23 821** |
| sa `reason`, saglasan ulaz, izvedeno ≠ predato | 3 | 3 | 3 | **9** — svi u `policyIsolation` (namerno izmenjena politika) |
| sa `reason`, **nesaglasan** ulaz (`startDate` ≠ `execution.date` + 1) → predati ulaz | 0 | 4 (`halfMarathonFlow`) | 4 (`marathonFlow`) | **8** |
| ukupno | 5 836 | 12 512 | 6 490 | **24 838** |

Ispravka ranije tvrdnje iz pitanja korisniku („jedini tok"): nesaglasan ulaz imaju DVA toka — `marathonFlow` (pao) i
`halfMarathonFlow` (HM → 10K; nije pao jer opcija 10K postoji i sa izvedenim ulazom, ali ulaz je bio različit). Oba
sada idu putem predatog ulaza, kao na `bf47249`.

Statički (nije ulaz predaje): u JSON fajlovima `docs/qa/**` i `web/src/test/**` ima 127 objekata `executionAdjustment`,
od toga 67 bez `reason` — to su zabeleženi izlazi starijeg koda (izveštaji QA), ne ulazi koje testovi predaju cilju.

## 8. Komande i rezultati

Sve iz `web/`; `TZ` sistema UTC; konačni kod osim gde piše drugačije.

| Komanda | Rezultat |
|---|---|
| `npx vitest run --project node src/domain/generators` na `bf47249` (zaseban worktree) | 51 fajl, 1016/1016, 1001 s |
| novi `policyIsolation.node.test.ts` nad kodom `bf47249` | **6 od 16 pada** (T1 i T2 × 3 predaje) |
| `npx vitest run --project node src/domain/generators/policyIsolation.node.test.ts` | 16/16 |
| sabotaže (a)/(b)/(c), isti test | 6/16, 6/16, 3/16 palih; vraćeno |
| `npx tsc -b --noEmit` sa samo neutralnim `contract.ts` | TS2345 `select.ts` 989, 996, 1006, 1016 |
| isto + tip u HM / + tip u HM i maratonu | 1006, 1016 / **exit 0** |
| HM `short.fraction` 0,85 → 0,8 (samo provera, vraćeno): `bf47249` / konačno | 6 grešaka u `select.ts` / exit 0 |
| pun `npx vitest run` sa doslovnom tačkom 2 (instrumentisano) | 218/219 fajlova, 2688/2689: pao `marathonFlow.test.tsx:248` |
| pun `npx vitest run` sa pravilom saglasnosti (instrumentisano, merenje u 7) | 218/219: pao samo `generator.input.test.ts` (fuzz, „timed out in 5000ms", 0 predaja); samostalno 28/28 |
| `npx tsc -b --noEmit` | exit 0 |
| `npx eslint .` / `npx prettier --check .` | exit 0 / exit 0 (u okviru `npm run check`) |
| `npx vitest run --project node src/domain/generators` (završno) | **51 fajl, 1026/1026, 838 s** |
| `npm run check` (završno: typecheck, lint, format, vitest) | **EXIT 0; 219 fajlova, 2689/2689**; vitest 1026,8 s, ukupno 21 min 15 s |

Pregled sopstvenog diffa: (1) cilj gradi obim iz ulaznog `weeklyKm` uz izvršenje sa `reason` samo u nesaglasnom
slučaju (odluka korisnika, v. 1) — u saglasnom slučaju nijedno polje obima/dugog/spremnosti ne dolazi iz ulaza izvora;
`guardBaseKm` je `own.guardBaseKm`. (2) Nijedan uvoz nije prešao između generatora: jedini novi uvoz je
`handoffTarget.ts → ./executionAdjustment` u istom folderu distance (`architecture`, `runtimeIsolation`,
`policyIsolation` prolaze).

## 9. AGENTS.md uslovi 1, 5 i 7

- **1. Jedan vlasnik odluke.** Povratni ulaz (početak, obim, dugi, spremnost, nedelje pauze, oprez), povratna
  politika, baza zaštite rasta i `startingKm` imaju po jedno mesto odlučivanja u svakoj distanci: `returnInput` u
  `{fiveK,tenK,halfMarathon}/plan/executionAdjustment.ts`. `executionBasis` (sopstveni plan) i `handoffFuture` (predaja)
  je oba pozivaju; nema druge formule obima u cilju. Kad ulaz nije izveden iz predatog izvršenja (pravilo saglasnosti),
  cilj ne računa obim, već uzima predati ulaz kao stvarnu bazu. Maraton je samo izvor; njegov `executionBasis` je nepromenjen
  (putanja „samo komentari").
- **5. Handoff.** Kao cilj: prima ulaz i činjenice izvršenja, sam određuje obim, dugi, spremnost, povratnu politiku i
  bazu rasta (T1: politika izvora ne menja ni bajt ulaza, treninga ni metapodataka; T2: politika cilja menja obim). Kao
  izvor: HM i maraton ne šalju svoju politiku ni bazu rasta (`HandoffFacts` je nepromenjen); izvedena polja u
  `basis.input` cilj prepisuje.
- **7. Nula uvoza van foldera distance.** Novi uvoz je samo `handoffTarget.ts → ./executionAdjustment` unutar iste
  distance. `architecture`, `runtimeIsolation` i `policyIsolation` prolaze bez novih izuzetaka (v. 5 i 8).

## 10. Preostali problemi

1. **Nesaglasno stanje plana posle vraćanja verzije.** `graftFuturePlan` (kopija u svakom generatoru) spaja `meta` kao
   `{ ...trenutni, ...snapshot }`, pa `meta.executionAdjustment` preživi vraćanje verzije od pre prilagođavanja.
   Pravilo saglasnosti samo štiti predaju; izvor za SOPSTVENI plan u tom stanju i dalje (kao na `bf47249`) uzima
   povratnu politiku iz `execution.breakDays` i bazu rasta iz originalnog ulaza (`basisFromPlan`). Uzrok nije diran
   (van zadatka; menja ponašanje).
2. **Signal saglasnosti je `startDate`.** Ulaz promenjen posle prilagođavanja bez promene `startDate` (npr. rekalibracija
   sa uočenom bazom istog dana kao prilagođavanje) smatra se izvedenim, pa cilj izvodi iz starijih činjenica. U
   referencama: 0 takvih slučajeva (svih 23 821 saglasnih predaja bez izmene politike je bajt-isto predatom ulazu).
3. **Tačka 4 izlazi iz dozvoljenih putanja:** tip `ReturnPolicy` u `marathon/plan/regenerate.ts` (odluka korisnika,
   samo tip). 5K i 10K zadržavaju doslovni tip: njihova osnova se ne vraća kroz `PreparationApi`, pa izmena njihove
   vrednosti ne ruši `tsc`.
4. Maratonski `executionBasis` nije izdvojen u `returnInput` (putanja „samo komentari"); maraton nije cilj predaje.
5. `generators/handoff.ts` (van dozvoljenih putanja) i dalje u komentaru kaže „početak od stvarne baze"; nije menjano.
6. T1/T2 pokrivaju potvrđenu pauzu (U08, U10). Putevi `fatigue` i `reduced-volume` u predaji pokriveni su samo
   referencama (bajt-isto), ne testom izmene politike.
7. Sesija je dodelila granu `claude/predaja-v1-handoff-facts-2rm8xo`; po `AGENTS.md` rađeno na
   `claude/generator-isolation-5k-10k-hm-marathon`.
8. Instrumentisani pun prolaz (pod opterećenjem) jednom je oborio `domain/training/generator/generator.input.test.ts`
   (fuzz, „Test timed out in 5000ms", ne prolazi kroz predaju: 0 poziva); samostalno 28/28. Završni `npm run check`:
   v. 8.
