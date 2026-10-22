# Segment 3d — 5K v2 i 10K v2 kao CILJ predaje „kraća distanca" (izvori HM v2 i maraton v2)

Grana `claude/generator-isolation-5k-10k-hm-marathon`. Bez PR-a, mergea i deploya. Odluke: DESIGN.md § 3 P3/P5,
§ 8 (O3a, O4a/O5a, O6b, O7a, O8a). Obrazac 3f, kopija (uslov 7). Dva dela: 3d-5K (ovde), 3d-10K (dopuna niže).

## 3d-5K (5k-v2.9.0) — polazni SHA `e7fe15d`

`tenK/v2/**` nije diran osim 19 redova „5K v2" u snimku (§ 4). Izvor je pravi HM v2 (3c).

### 1. Izmene

| Fajl | Izmena |
|---|---|
| `fiveK/v2/app/handoffTarget.ts` (nov) | `handoffFuture(current, input, today, _, facts)`: (1) start = `alignedStart(trka, asOf + 1)` — granica nedelje; 5K v2 i HM v2 nedelje se oba završavaju danom trke (ista formula `alignedStart`), pa su granice iste (M3: 0 bez granice); inače odbijanje sa razlogom; (2) `generateFiveKV2(targetInput)`: dani, obim čarobnjaka izvora (O3a), rezultat doslovno, lak tempo → `typicalEasyPaceSecPerKm` samo ako ga izvor ima, početnik → `canRun30Min: true` (HM v2 je kontinuirano trčanje, činjenica izvora), cilj `null`; 5K v2 nema dan dugog u ulazu; (3) `adaptFiveKV2(plan, targetFacts(facts), asOf)` — `raw` bez `dayId` i zaključanih dana izvora, potvrđena pauza → činjenica pauze; (4) plan za upis sa prefiksom izvora; (5) pokrivenost 'full' (5K v2 nema pojam nepotpune pripreme; nov prag bi bio nov trenerski broj). Odbijanje → `{ error }` doslovno (O4a, O8a). |
| `fiveK/v2/app/plan.ts` | `PREFIX_KEY` (`fiveKV2Prefix`), `Prefix`, `prefixOf`; `storedPlan(gen, prefix)`: nedelje izvora ispred, nedelje v2 broj `offset + index`, id `g{offset+index}d{dow}`; `meta.start`/`weeks` od prvog dana prefiksa; `stampPlan` faza nedelja v2 po `w − offset`, nedelje izvora zadržavaju svoju. Bez prefiksa bajt-isto. `KNOWN_VERSIONS` ∪ 5k-v2.8.1. |
| `fiveK/v2/app/adapt.ts` | Pregled adaptacije, vraćanje verzije i promena cilja nose prefiks; brojevi nedelja u pregledu `offset + index`. |
| `fiveK/v2/app/facts.ts` | `confirmedBreakFact` (prevod potvrđene pauze u činjenicu, jedno mesto). |
| `fiveK/v2/app/index.ts`, `select.ts` | `fiveKV2.handoffFuture`; `shorterHandoffForV2Source`: 5K + uključen 5K v2 → 5K v2 cilj; 10K v2 i dalje `V2_TARGET_NOT_READY` (3d-10K). |
| `fiveK/v2/policy.ts` | `version: '5k-v2.9.0'` + red DECISIONS (format plana: prefiks). Pravila nepromenjena. |

### 2. Testovi (`fiveK/v2/app/handoffTarget.node.test.ts`, 9)

- **Tok** (grid02 HM v2, asOf N − 13, ⌊N/2⌋, N − 7 ned.; 5 scenarija; brzi 55 izvora / 280 predaja, pun 190 / 825):
  plan 5K v2, pokrivenost 'full'; nema duplog datuma ni id-a; id svakog dana = id izvora istog datuma; prefiks =
  nedelje izvora pre starta doslovno (tekuća uključena); start > asOf; poslednja nedelja faza TRKA (stampPlan sa
  offsetom); uslov 8 na delu v2 (budući dani nisu prazni, lagan ≤ dugi).
- **Pravi izvor:** HM v2 posle adaptacije (pauza) → `preparationForPlan(src, {fiveKV2, tenKV2})`: 10K nedostupan
  (`V2_TARGET_NOT_READY`), opcija `shorter-5000`; `buildPreparationChoice` → plan 5K v2, bez `hmV2`, prefiks = nedelje
  izvora do asOf.
- **M3 kroz pravi kod:** odbijanje adaptacije = 0; van 6–16 nedelja → „Plan mora trajati 6–16 nedelja; sada N."
  doslovno (O8a; uzorak ima i > 16 i < 6).
- **Po osećaju:** bez laganog tempa → MISSING_EASY_PACE doslovno; sa njim plan postoji.
- **T1:** politika izvora (HM v2 `volume.growth`, `peakAddKm`) menja izvor (kontrola), deo cilja bajt-isti;
  `startingKm` izvršenja ne menja cilj, potvrđena pauza ga menja. **T2:** politika cilja (5K v2
  `adapt.pause.midShare/shortShare`) menja cilj.
- **Izbor/format:** prekidač 5K v2 isključen → v1 cilj, uključen → 5K v2 (nije NOT_READY); 10K v2 → NOT_READY;
  plan bez predaje nema prefiks, prvi id `g1d1`; verzija 5k-v2.9.0; 5k-v2.8.1 „current".
- Izmenjeni postojeći: `handoffV2Source` (3b) — slučaj 5K v2 NOT_READY uklonjen; `halfMarathon/v2/app/handoffSource`
  (3c, jedan test) — sa {5K v2, 10K v2}: 10K NOT_READY, 5K opcija iz 5K v2; oznaka verzije u `segment02`, `app`,
  `adapt` (5K) i `features/onboarding/fiveKV2Flow.test.tsx` (isti red kao u 08g/08h).

**Sabotaže** (`sabotage-3d.json`, brz nivo, `--bail=1`): **5/5 palo** (48 s) — 3d-a cilj čita `startingKm` kao
obim (T1); 3d-b start = dan posle potvrde (tok); 3d-c `dayId` izvora u činjenicama (M3: adaptacija odbija); 3d-d
nedelje cilja bez `offset` (tok: id); 3d-e potvrđena pauza se ne prevodi (T1 pauza). Stanje `src` posle vraćanja isto.

### 3. Merenje M3 kroz pravi kod (`v2target3d.measure.ts` → `v2target3d-5K.json`, `-easy.json`)

Uzorak kao 3a/3f M3 (212 izvora HM v2, 4 240 predaja), ulaz = pravi `contractInput` HM v2 (3c): uspeh **545**;
odbijanje adaptacije **0**; bez iste granice nedelje 0; dupli datum 0, dupli id 0, id ≠ id izvora 0, prefiks ≠ izvor
0; zajedničke provere 4a **0**. Po preostalim nedeljama: < 6 0/1115, 6–16 545/2485, > 16 0/640. Odbijanja generatora
3 695, doslovno; poruka nosi više razloga, brojano po početku poruke do 80 znakova, pa su brojevi donja granica):
dužina 6–16 (PLAN_LENGTH_OUT_OF_RANGE) 1 755, bez laganog tempa (MISSING_EASY_PACE) 1 490, broj dana 3–5 1 040,
obim za broj dana 915, početnik najviše 4 dana 600, VDOT rezultata 100.

Kontrafaktual (EASY=1, izvor šalje i `easyPaceSecPerKm` iz svog ulaza): uspeh **1 115**, ostalo isto (0 / 0 / 0).
Razlika prema 3a M3 (1 385): 3a je ograničavao broj nedelja na 16 (kasniji start); sa O6(b)/O8a rana predaja (> 16)
je nedostupna sa razlogom.

### 4. Provere (iz `web/`)

| Komanda | Rezultat |
|---|---|
| `npx tsc -b --noEmit`; eslint/prettier menjanih fajlova | exit 0 |
| `npm run check` | **296 fajlova, 3509/3509** |
| `TEST_FULL=1 npx vitest run --changed e7fe15d` | **181 fajl, 1858/1858**, 792 s |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | **26 fajlova, 695/695**, 269 s |
| `npx playwright test e2e/fivek-v2.spec.ts e2e/hm-v2.spec.ts` | **6/6** (48 s) |

**Snimci drugih distanci** (byteSame): promenjeni SAMO redovi „5K v2 #i · {adaptacija, cilj, generator, generisanje,
plan, policy, prilagođavanje}" — HM `byteSame.28da6af.json` 13, maraton `byteSame.9443676.json` 13, 10K
`byteSame.068410b.json` 19; ostali ključevi bajt-isti. Dokaz: sa privremeno vraćenim `version: '5k-v2.8.1'` sva tri
testa prolaze nad STARIM snimcima (2/2 svaki) — jedina razlika je oznaka verzije. `personalPlan.node.test.ts` nije
menjan i prolazi.

### 5. Uslovi AGENTS.md

1 jedan vlasnik: povratnu politiku određuje samo adaptacija 5K v2; prevod pauze samo `facts.ts`. 2 bez novog plafona.
3 WU/CD nepromenjeni. 5 cilj prima samo činjenice (T1, 3d-a, 3d-e). 6 plan nosi 5k-v2.9.0 i fazu iz odluke v2
(prefiks: faze izvora). 7 5K v2 ne uvozi ništa van foldera (`isolation` prolazi); spoj u `select.ts`. 8 uslov 8 na delu
cilja, zajedničke provere 0.

### 6. Otvoreno (3d-5K)

- **Lak tempo izvora HM v2 (za organizatora):** `halfMarathon/v2/app/preparation.ts` `contractInput` (3c) ne šalje
  `easyPaceSecPerKm`, pa HM v2 po osećaju (i rezultat star > 12 ned.) → 5K v2 uvek MISSING_EASY_PACE (M3: 545 → 1 115
  sa njim). 3f `HandoffInput` ga već predviđa. (a) dopuna 3c: izvor šalje `easyPaceSecPerKm` iz ulaza (činjenica
  čarobnjaka, ne odluka) **[preporuka; van mog foldera]**; (b) ostaje odbijanje sa razlogom.
- Rezultat HM/maraton izvora ide doslovno; 5K v2 ga odbija (RESULT_DISTANCE_UNSUPPORTED) — u M3 0 (grid izvora ima
  rezultate 5K/10K), u aplikaciji moguće.

### 7. Predaja za 3e/3g (5K)

- 3e/izvor: plan 5K v2 cilja nema `meta.preparation`; opcija dobija `peakLongRunKm/peakWeeklyKm` 0 (izvor ih čita iz
  `meta.preparation`) — za prikaz čitati iz `fiveKV2` ako treba. Pokrivenost 5K v2 cilja je uvek 'full'.
- 3g: prikaz nedelja prefiksa (faze izvora HM v2, struktura dana iz HM v2), broj nedelje u pregledu adaptacije
  (`offset + index`), razlog nedostupnosti doslovno (dužina 6–16, lak tempo, dani 3–5).
