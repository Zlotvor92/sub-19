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

Tok (grid02 HM v2, 5 scenarija; brzi 55 izvora / 280 predaja, pun 190 / 825): plan 5K v2, 'full', dupli datum/id 0, id =
izvor istog datuma, prefiks doslovno (tekuća uključena), start > asOf, poslednja nedelja TRKA, uslov 8. Pravi izvor (HM v2
posle pauze → `preparationForPlan` → izbor 5K → plan 5K v2 sa prefiksom). M3 (adaptacija 0; van 6–16 → „Plan mora
trajati 6–16 nedelja; sada N." doslovno). Po osećaju (bez laganog tempa MISSING_EASY_PACE). T1 (HM v2 obim; `startingKm`;
potvrđena pauza menja), T2 (5K v2 `adapt.pause`). Izbor/format (prekidač, prefiks samo uz predaju, `g1d1`, 5k-v2.9.0,
5k-v2.8.1 „current"). Izmenjeni postojeći: `handoffV2Source`, HM `handoffSource` (3c, jedan test), oznaka verzije
(`segment02`, `app`, `adapt`, `fiveKV2Flow.test.tsx`).

**Sabotaže** (`sabotage-3d.json`, brz nivo, `--bail=1`): **5/5 palo** (48 s) — 3d-a cilj čita `startingKm` kao
obim (T1); 3d-b start = dan posle potvrde (tok); 3d-c `dayId` izvora u činjenicama (M3: adaptacija odbija); 3d-d
nedelje cilja bez `offset` (tok: id); 3d-e potvrđena pauza se ne prevodi (T1 pauza). Stanje `src` posle vraćanja isto.

### 3. Merenje M3 kroz pravi kod (`v2target3d.measure.ts` → `v2target3d-5K.json`; brojevi pre 3d-dopune)

Uzorak kao 3a/3f M3 (212 izvora HM v2, 4 240 predaja), ulaz = pravi `contractInput` HM v2 (3c): uspeh **545**;
odbijanje adaptacije **0**; bez iste granice nedelje 0; dupli datum 0, dupli id 0, id ≠ id izvora 0, prefiks ≠ izvor
0; zajedničke provere 4a **0**. Po preostalim nedeljama: < 6 0/1115, 6–16 545/2485, > 16 0/640. Odbijanja generatora
3 695, doslovno; poruka nosi više razloga, brojano po početku poruke do 80 znakova, pa su brojevi donja granica):
dužina 6–16 (PLAN_LENGTH_OUT_OF_RANGE) 1 755, bez laganog tempa (MISSING_EASY_PACE) 1 490, broj dana 3–5 1 040,
obim za broj dana 915, početnik najviše 4 dana 600, VDOT rezultata 100.

Posle 3d-dopune (izvor šalje lak tempo, § 8): uspeh **1 115**, ostalo isto (0 / 0 / 0); MISSING_EASY_PACE 1 490 → 160.
Razlika prema 3a M3 (1 385): 3a je ograničavao broj nedelja na 16 (kasniji start); sa O6(b)/O8a rana predaja (> 16)
je nedostupna sa razlogom.

### 4. Provere (iz `web/`)

| Komanda | Rezultat |
|---|---|
| `npx tsc -b --noEmit`; eslint/prettier menjanih fajlova | exit 0 |
| `npm run check` (pre i posle spajanja sa 10K-06g) | **296 fajlova, 3509/3509**; posle spajanja **297, 3513/3513**, exit 0 |
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

### 6. Otvoreno (3d-5K): lak tempo — rešeno (§ 8); rezultat HM izvora ide doslovno, 5K v2 ga odbija (M3 0).

### 7. Predaja za 3g (5K)

Prefiks (faze i struktura dana iz HM v2), broj nedelje `offset + index`, razlog nedostupnosti doslovno (dužina 6–16, lak
tempo, dani 3–5); pokrivenost 5K v2 cilja uvek 'full'; vrh opcije — dopuna u 3d-10K.

## 8. 3d-dopuna (`fff812b`, polazni `8eb4416`) — HM v2 izvor šalje lak tempo čarobnjaka (odluka (a), DESIGN § 8)

`halfMarathon/v2/app/preparation.ts` `contractInput` nosi `easyPaceSecPerKm` kad ga ulaz ima. STANI pre commita: v1 cilj
polje ne čita, ali ulaz prepisuje u `ulaz` plana (jedina razlika, 1 red, 10K i 5K v1) → lepak `handoff.ts`
`v1TargetForV2Source` predaje v1 cilju ulaz bez polja (svaki v2 izvor) → v1 plan bajt-isti doslovno. Testovi `handoffSource`
+2 (polje prisutno/odsutno; v1 sa/bez polja JSON-isto; 5K v2 po osećaju radi). Snimak maratona: 1 red „HM v2 #1 ·
priprema" (osnova nosi lak tempo); plan HM v2 bajt-isti. M3 5K 545 → **1 115**. Sabotaže 3d-f, 3d-g pale (3d ukupno 7/7).
Provere: `npm run check` 297 / 3515; `--changed 8eb4416` pun 158 / 1292; E2E 6/6.

## 9. 3c-dopuna 2 (`444ddc9`, polazni `46dff18`) — HM v2 izvor kao 3e (format izmena, poslednji rezultat, tekst O5)

`halfMarathon/v2/app/preparation.ts` (kopija 3e): format ∪ `hmV2Edits`; `pb = lastResult` (ulaz ili `step.result`, ne
posle starta ulaza ugovora). `handoff.ts` `V1_TARGET_NEEDS_RESULT` „… pre početka novog plana, a ovaj plan ga nema."
Testovi `handoffSource` +2. Tok kroz pravi kod (`hmSource.measure.ts`, kod pre/posle; 218 ponuda): curenje `hmV2Edits`
142 → **0**; `basisFromPlan` bajt-isto (novi `pb` 0); `executionBasis`: promenjeno tačno 138 izbora (69 ponuda × 10K/5K),
svi sa novim `pb`; uspeh 142 → **169** po cilju. M1 HM 3 274 / 114 012 = 3c. Sabotaže 3c2 3/3. Provere: `npm run check`
298 / 3537; `--changed 46dff18` pun 159 / 1314; E2E 6/6.

## 3d-10K (10k-v2.7.0) — polazni SHA `d491000`

Dirani: `tenK/v2/app/{handoffTarget (nov), plan, adapt, facts, index, types}.ts`, `tenK/v2/policy.ts` (samo `version`;
bez reda DECISIONS — pravila nepromenjena, sledi 10K-06i), `select.ts`; testovi. Domen 10K nedirnut.

**Izmene** (obrazac 3f doslovno, kopija): `handoffFuture` = start `alignedStart(trka, asOf + 1)` (svi v2 planovi se
završavaju danom trke — M3: 0 bez granice) + `generateTenKV2(targetInput)` (dani, dan dugog, obim čarobnjaka, rezultat
doslovno, lak tempo kad ga izvor ima, početnik; 10K v2 nema skorašnji najduži u ulazu) + `adaptTenKV2(plan, raw bez
`dayId`/zaključanih, potvrđena pauza → `confirmedBreakFact`)`; pokrivenost 'full' (10K v2 nema pojam nepotpune
pripreme). Prefiks `tenKV2Prefix` u `plan.ts` (`storedPlan`, `stampPlan`), `adapt.ts` (pregled, vraćanje, cilj nose
prefiks; nedelje `offset + index`). `KNOWN_VERSIONS` ∪ 10k-v2.6.2. `select.ts`: 10K + 10K v2 → `t2.handoffFuture`;
`V2_TARGET_NOT_READY` sada nema ni jedan cilj (konstanta ostaje).

**Testovi** `tenK/v2/app/handoffTarget.node.test.ts` (14, za oba izvora; brzi 39 s): tok (HM 55 / 420 predaja, maraton
57 / 325; pun 190 / 1 490 i 225 / 1 245) — plan 10K v2, bez objekta izvora, dupli datum/id 0, id = izvor, prefiks
doslovno, start > asOf, uslov 8; M3 (adaptacija 0 odbijanja; < 8 ned → „Plan od N nedelja je prekratak: 10K plan
traži najmanje 8 nedelja." doslovno); HM po osećaju (lak tempo iz izvora → plan; bez njega EASY_PACE_REQUIRED); pravi
izvor maraton v2 (`preparationForPlan` → izbor 10K → plan 10K v2 sa prefiksom); T1 × 2 izvora (politika obima izvora,
`startingKm`), T2 (10K v2 `adapt.pause`); izbor/format (prekidač, nije NOT_READY, bez prefiksa `g1d1`, 10k-v2.7.0,
10k-v2.6.2 „current"). Izmenjeni postojeći (NOT_READY za 10K nestaje): `handoffV2Source` (svaki v2 cilj: plan v2 ili
odbijanje v2, ne NOT_READY), HM `handoffSource` 3c (opcija `shorter-10000` iz 10K v2), HM `handoffTarget` 3f i 5K
(`ten` = `handoffFuture` 10K v2; 5K: 10K v2 odbija doslovno „Plan od 6 nedelja je prekratak…", nudi 5K), maraton
`handoffSource` 3e (kasno: HM PLAN_TOO_SHORT, opcija 10K iz 10K v2); oznaka verzije u 10K testovima, `tenKV2Flow`,
`e2e/tenk-v2.spec.ts`.

**Sabotaže** `sabotage-3d10.json`: **6/6 palo** (126 s) — startingKm kao obim, start = dan posle potvrde, `dayId`
izvora u činjenicama, nedelje bez offseta, potvrđena pauza se ne prevodi, `select` vraća NOT_READY.

**M3 kroz pravi kod** (`v2target3d.measure.ts`, pravi `contractInput` oba izvora):

| Izvor → 10K v2 | predaje | uspeh | po ned. (< 8 / 8–18 / > 18) | adapt odbija | granica / dupli / id / prefiks | 4a |
|---|---|---|---|---|---|---|
| HM v2 (212) | 4 240 | **1 690** | 0/1485 · 1690/2530 · 0/225 | **0** | 0 / 0 / 0 / 0 | **0** |
| maraton v2 (253) | 5 060 | **1 175** | 0/1480 · 1175/2485 · 0/1095 | **0** | 0 / 0 / 0 / 0 | **0** |

Najčešća odbijanja (doslovno, `v2target3d-*-10K.json`): PLAN_TOO_SHORT, PLAN_TOO_LONG (O8a), obim van reda tabele,
početnik/dani, bez pouzdanog rezultata (maraton: rezultat maratona nije 3/5/10/HM). 3a M3 (sintetički, bez gornje
granice): HM 1 840, maraton 1 755.

**byteSame:** promenjeno samo 13 redova „10K v2" u snimku maratona; HM i 10K snimci bez promene; sa privremeno vraćenim
10k-v2.6.2 sva tri prolaze nad starim snimcima (6/6) — razlika je samo oznaka. `personalPlan` nepromenjen, prolazi.

**Provere:** tsc/eslint/prettier 0; `npm run check` **299 / 3555**, exit 0; `TEST_FULL=1 --changed d491000` **217 / 1858**
(1 685 s); pun `tenK/v2` **60 / 586** (1 131 s); E2E `tenk-v2`, `hm-v2`, `marathon-v2`, `fivek-v2` **12/12**.

**Uslovi:** 1, 5 (T1 × 2 izvora), 6 (10k-v2.7.0, faze), 7 (`isolation`), 8 (uslov 8, 4a 0) — kao 3d-5K.

**Dopuna (nalaz 3g, organizator): vrh opcije v2 cilja.** Izvori HM v2 i maraton v2 (`*/v2/app/preparation.ts`
`peaksOf`, samo app) čitaju `peakLongRunKm`/`peakWeeklyKm` iz `meta.preparation` (v1) ili strukturno iz objekta plana v2
cilja (`tenKV2`/`fiveKV2`; maraton i `hmV2`): najduži dugi nedelja v2 i `peakKm` (prefiks izvora nije u njemu); bez
uvoza tipova cilja. Pre: 0 („—" u UI). Testovi: 5K (HM izvor), 10K (HM izvor, 3c test), 10K (maraton, 3e test) — vrh
opcije > 0 = najduži dugi / `peakKm` plana cilja. Sabotaže 3d10-g/h (izvor ne čita ključ) pale; 3d10 ukupno **8/8** (150 s).

**Predaja za 3g:** prefiks 10K (faze izvora HM/maraton), broj nedelje `offset + index`, razlozi nedostupnosti
doslovno; vrh opcije v2 cilja iz plana cilja (gore).
