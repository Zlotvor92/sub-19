# V1a — uklanjanje v1: popis i plan (bez izmene koda)

Polazno `2bd88ed` (grana `claude/generator-isolation-5k-10k-hm-marathon`), 9. 11. 2026. Menjano samo `docs/generators-v2/perfection/**`; nijedan
test nije pokrenut; baza nije dirana (brojevi baze su iz zadatka). Oznaka: **[M]** izmereno komandom, **[T]** tumačenje/procena organizatoru.
Skripta grafa uvoza: `docs/generators-v2/perfection/V1a/import-graph.py` (iz `web/`: `python3 -I ../docs/generators-v2/perfection/V1a/import-graph.py /tmp/res.json`).

## Zaključak (prvo)

1. v1 se može ukloniti čisto: **nijedan produkcioni fajl van `domain/generators/` ne uvozi v1 folder** — jedina veza je `select.ts` (+ `handoff.ts`). [M]
2. Lični plan vlasnika **danas radi preko HM v1** (`meta.licni`, bez `policyId` → status `legacy` → `HALF_MARATHON_GENERATOR`). Brisanjem HM v1 gubi
   oporavak, vremensku karticu, lak tempo, RPE, ekran forme, predloge tempa i klasifikaciju merenja; plan i unos ostaju (prikaz je u zajedničkom `domain/plan`). [M]
3. Preporuka: **opcija A vremenski ograničena** — HM v1 ostaje zamrznut samo za `meta.licni === true` do posle trke 13. 12. 2026, pa se briše; 5K/10K/maraton v1 idu odmah.
4. „Generiši nov plan" **trajno briše** `g…` unose (dnevnik, pred, alts, moves, vdotLog, bol/težina izvedeni iz treninga): to nije „bez gubitka dnevnika". [M]
5. Najveći trošak nije brisanje foldera nego **99 testova van v1 foldera koji prave ulaz v1 generatorom** (preko `src/test/generators.ts`): moraju na v2 ili fiksture. [M]

## 1. Granica v1

| Grupa | Fajlova | Redova | Komanda / izvor |
|---|---|---|---|
| v1 izvor, 5K (`fiveK/` van `v2/`, bez testova) | 82 | 10 456 | `find fiveK -type f -not -path 'fiveK/v2/*'` iz `web/src/domain/generators` |
| v1 izvor, 10K | 82 | 10 391 | isto za `tenK` |
| v1 izvor, HM | 81 | 11 605 | isto za `halfMarathon` |
| v1 izvor, maraton | 83 | 11 173 | isto za `marathon` |
| **v1 izvor ukupno** | **328** | **43 625** | (v2 za poređenje: 554 fajla, 99 676 redova uklj. testove) |
| v1 testovi u folderima distanci (`equivalence*`, `isolation.node.test.ts`) | 34 | 2 253 | isti `find`, samo `*.test.ts` |
| Testovi van foldera distanci u projektu `v1` (`otherDistances*`, `runtimeIsolation*`, `personalPlan`, `guidance`, `generator.differential/fingerprint`) | 16 | — | `vitest.config.ts:19-27` |
| Pomoćnici `src/test/{fiveK,tenK,halfMarathon,marathon,guidance}` + `generators.ts` + `generatorScenarios.ts` | 28 + 2 | 4 475 + 513 | `find src/test/<d> -name '*.ts' \| xargs cat \| wc -l` |
| Reference `*-reference.json.gz` (5K, 10K, HM, maraton, otherDistances, guidance) | 6 | 4,3 MB | `ls -l web/src/test/fixtures` |
| Zadržati uz opciju A: `personal-reference.json.gz` (104 KB), `src/test/personal` (3 fajla, 266 r.) | — | — | isto |
| `docs/qa/generator-ab` + `generator-final` (neke čitaju testovi: `policyIsolation`, `qualityDose.*`, `hmProgression`, `src/test/*/scenarios.ts`) | 341 (ceo `docs/qa`) | 42 MB (ceo) | `grep -rln 'docs/qa' web/src web/scripts` |
| CI | posao `v1-changes`, `web-test-v1`; skripta `test:v1`; `V1_REFERENCE` | — | `.github/workflows/test.yml:99-148`, `web/package.json:23`, `vitest.config.ts:14-27` |

**Deli v1 i aplikacije/v2 (ne brišu se):** `domain/{state,plan,training,day,recovery,activities,weather,watch,ai,personal,onboarding,race,sync,icu,push,community,settings}` —
zajednički; `domain/plan` (11 izvornih fajlova) daje `resolvePlan` pa **prikaz ne zavisi od generatora** (`stores/trainingStore.ts:154`). Nijedan od njih ne uvozi v1 folder. [M]

**Šta v2 uvozi iz v1 foldera (uslov 7):** u izvornom kodu **samo `fiveK/v2/app/**` → `fiveK/exchange.ts`** (18 redova, `export type` iz `../../state`, `../../date`; 13 mesta, npr. `fiveK/v2/app/date.ts:4`).
10K/HM/maraton v2: 0 izvornih uvoza (`python3 -I V1a/import-graph.py` → red `V2->V1` samo za `fiveK/v2/app/*`). Rešenje u V1b: preseliti tipove u `fiveK/v2/app/exchange.ts` (neutralni tipovi dozvoljeni uslovom 7). [M]
**V2 testovi koji uvoze v1:** 18 fajlova (`*/v2/app/{app,adaptFlow,handoffSource,handoffTarget}.node.test.ts`, `*/v2/isolation.node.test.ts`, `halfMarathon/v2/segment07.node.test.ts:208`, `fiveK/v2/segment09`…) — poređenja sa v1 i provere granice; popraviti ili ukloniti. [M]
`<distanca>/index.ts` izvozi i v2 adapter (`halfMarathon/index.ts:27 export { hmV2 }`), a `select.ts:515,758,956` ga uzima iz v1 indeksa (`fiveK.fiveKV2`, `halfMarathon.hmV2`, `marathon.marathonV2`) → `select.ts` mora da uvozi `*/v2/app/index.ts` direktno pre brisanja. [M]

## 2. Lični plan vlasnika

Činjenice [M]: plan je u `web/src/data/personalPlan.ts` (414 r.), 6 nedelja (2. 11 – 13. 12. 2026), 9 dana snage (A/B), `meta.licni: true`, bez `policyId` (`domain/personal/index.ts:131-152`);
`genPlan === null`, aktivni plan = `personalPlan(...)` (`stores/trainingStore.ts:165-173`); vidljiv vlasniku ili nalogu sa unosima (`personal/index.ts:60`); nema isteka po datumu (grep `PERSONAL_RACE`: samo u `meta`).
Danas je 9. 11. = 2. nedelja od 6.

Šta lični plan zove u generatoru (`generatorForPlan(activeGenPlan())`, sve → HM v1) [M]:

| Funkcija | Pozivalac (red) | Bez generatora |
|---|---|---|
| Oporavak: bol, ACWR, spremnost, predlog | `features/recovery/useRecoveryModel.ts:22-24`, `stores/recoveryActions.ts:96` | ekran oporavka prazan (`return null`), predlog 0 |
| Vremenska kartica | `features/today/WeatherCard.tsx:27,31` | nema kartice |
| Lak tempo, RPE ciljevi | `features/session/useEasyPace.ts:14,28` | nema tempa/RPE |
| Forma: dokazi, predviđanje | `features/race/useFormModel.ts:48-49` | ekran forme `null` |
| Predlog/primena VDOT-a, uparivanje redova | `stores/raceActions.ts:64,90,112` | 0 / `null` |
| Unos tempa radnog dela, lanac forme | `stores/dayActions.ts:50,73`, `domain/day/workPace.ts:46-47` (`form` null → lanac ostaje kakav je) | merenje tempa se ne klasifikuje |
| Analiza izvršenja, run/walk | `stores/executionActions.ts:138-171` (`planGenerator()` baca grešku bez generatora), `features/plan/AdjustPlan.tsx:169` | ekran „nema podržane distance" |
| Pisanje prilagođavanja (adaptacija, pauza, bol→plan), handoff, nov cilj | `executionActions.ts:333-334,411,449`, `raceActions.ts:173` traže `t.genPlan` | **već danas ne radi za lični plan** (`genPlan === null`) |

Tačno: za lični plan danas **ne postoji** prilagođavanje plana ni handoff (sve traži pravi `genPlan`); radi samo čitanje (analiza, oporavak, vreme, tempo, forma), predlog bola u `alts` i predlog VDOT-a. [M]

| Opcija | Šta znači | Cena | Rizik |
|---|---|---|---|
| **A** zamrznut podskup | HM v1 ostaje samo za `licni` | Cela HM v1 mapa: 81 fajl/11 605 r. Najmanji podskup za gore navedene funkcije: ≥ 60 fajlova/7 320 r. (donja granica: graf iz 5 ulaznih tačaka, `V1a` skripta) — trimovanje je nova izmena koda koju `personal-reference.json.gz` (13 782 toka, bajt-isto) ne bi više dokazivao [T] | najmanji: kod se ne menja; ostaje 1 test (`personalPlan.node.test.ts`, 9,3 s) + `features/personal*.test.tsx` |
| **B** statičan plan | lični plan bez generatora | najjeftinije | gubi 7 funkcija iz tabele (vreme, tempo, RPE, oporavak, forma…) usred pripreme za trku za 5 nedelja; plan i unos ostaju |
| **C** prevod na `hm-v2` | | nije izvodljivo bez promene treninga: v2 plan je `hmV2` objekat izveden iz ulaza (`halfMarathon/v2/app/adapt.ts:45-48`), `weeksMin: 10` (`halfMarathon/v2/policy.ts:507`) a lični plan ima 6 nedelja, snagu A/B i ručne opise [M] | visok |

**Preporuka: A, vremenski ograničeno.** Razlog: jedina opcija koja ne gubi nijednu funkciju vlasniku do trke i ne menja kod koji je dokazan bajt-isto; cena je 1 folder (HM v1) koji živi još ~5 nedelja.
Posle trke (13. 12. 2026): `licni` plan ostaje samo za pregled; vlasnik pravi nov plan kroz čarobnjak (v2) — i tada se HM v1 briše (korak V1c, datum odlučuje korisnik, ne pre 14. 12.). [T]

## 3. Postojeći v1 planovi u bazi (19, bez `meta.policyId`)

Stanje u kodu [M]: `planPolicy` vraća `legacy` za plan bez oznake (`select.ts:143`); `generatorForPlan` ga daje v1 generatoru distance (`select.ts:1167-1170`), a `null` samo za `unknown` (tuđa/nepoznata verzija). Poruke: `UNKNOWN_POLICY`, `UNSUPPORTED_DISTANCE` (`select.ts:1286-1294`).
Prikaz (`resolvePlan`), dnevnik, `vanPlana`, `wellness`, `kg` su nezavisni od generatora → **plan se i dalje prikazuje**; pada samo ono iz tabele § 2 (sve bezbedno: svako mesto ima `if (!generator) …`; izuzetak `executionActions.ts:138-142` baca `Error` — pozivaoci `executionModel/runWalkModel/positiveAdjustmentBlock` treba da se zaštite u V1b). [M]

Predlog ponašanja [T]: (1) nov status `legacy` bez generatora (osim `licni`) sa jednom porukom „Plan je pravljen starim generatorom; prikazuje se, ali se više ne prilagođava" i dugmetom „Generiši nov plan" (postojeći `discardPlan` + čarobnjak); (2) bez migracije stanja: `genPlan` se ne menja, nema nove verzije `v` (`domain/state/migrate.ts`) — **povratno** uklanjanjem grane. Migracija bi bila potrebna samo ako se želi pečat `policyId: legacy-*` (nije potreban).
**Gubitak podataka pri „Generiši nov plan"** [M]: `discardPlan`/`activateNewPlan` brišu sve `g…` ID-jeve (`domain/plan/purge.ts:36-46`): `log`, `pred`, `predLock`, `alts`, `moves`, `vdotLog`, izvedene redove bola/težine. Ostaju: ručni bol/težina, `wellness`, `vanPlana`, test 3 km. Prema bazi 15 od 19 nema nijedan unos, 4 imaju. **Odluka organizatoru:** da li se dnevnik 4 korisnika izvozi/čuva pre brisanja (danas nema arhive: `stores/actions.ts:60-62`).

## 4. Novi planovi → v2 podrazumevano

Već jeste [M]: `vercel.json:14` `buildCommand: VITE_V2_DEFAULT_ON=1 …` (commit `0133057`, 24. 10. 2026. 13:48 CEST) → nesačuvano podešavanje = v2 (`stores/generatorFlags.ts:38-41`); `false` ostaje samo ako ga je administrator sačuvao.
Testovi i E2E ne postavljaju promenljivu pa rade na v1 (`stores/generatorFlags.ts:8`, `web/src/stores/generatorFlags.test.ts`, `deploy/cutover.node.test.ts:56`).
V1b promena: ukloniti `flags.ts` prekidače i `generatorForNewPlan` granu v1; `Wizard.tsx` grane `isV2/isTenKV2/isHmV2/isMarathonV2` + `finish()` v1 deo (`Wizard.tsx:236-250`) → jedna putanja; `domain/onboarding/index.ts:207,281,303` i `Wizard` pregled (`outlook`, `wizardWarnings`, `formPreview`) koriste `generatorForDistance` = v1 `assess/generatePlan/paceForZone` → prebaciti na v2 (inače pregled u čarobnjaku prikazuje v1 brojeve). `features/ti/screens.tsx` + `ShorterDistanceDecision.tsx` prekidači nestaju. [M]

Ulaz koji je v1 primao, a v2 odbija — **izmereno samo ono što piše u konstantama** [M]; učestalost [niska] (nije mereno; zahteva replay čarobnjaka, predlog za V1b):

| Ulaz | v1 | v2 | Izvor |
|---|---|---|---|
| nedelja do trke, max | 104 (`*/training/constants/product.ts:20`) | 5K 16, 10K 18, HM 20, maraton 24 | `*/v2/policy.ts` (`planWeeks`/`weeksMax`) |
| nedelja, min | 6/8/10/12 | isto (5K 6, 10K 8, HM 10, maraton 12) | `*/constants/distances.ts` : `minWeeks`; `v2/policy.ts` |
| VDOT iz rezultata | nije ograničen u v1 kodu koji sam pročitao [niska] | 5K 30–60; 10K/HM/maraton 30–80; ispod `vdotMin` plan po osećaju (10K/maraton); ponašanje van opsega za 5K/HM nisam pratio [niska] | `v2/policy.ts` (`vdot`, `vdotMin/Max`) |
| starost rezultata | — | > 84 dana → plan po osećaju | `v2/policy.ts` (`resultMaxAgeDays`) |
| lagan tempo bez rezultata | — | 4:30–8:30 /km | `v2/policy.ts` (`easyPaceSecPerKm`) |
| obim na 3 dana (5K) | — | < 12 km odbijen | `fiveK/v2/policy.ts:61-62` |
| 10K bez 30 min neprekidnog trčanja | — | run/walk putanja | `tenK/v2/policy.ts:459`, `fiveK/v2/input.ts:73-80` |
| handoff „kraća distanca" | HM→10K/5K, maraton→HM/10K (`handoff.ts:24-29`) | ciljevi v2 postoje za HM, 10K, 5K (`select.ts:1241-1252`); v1 cilj samo uz isključen prekidač | `select.ts` |

Nije utvrđeno: broj dana (v1 vs v2 tabele `days`), rasponi obima, run/walk van 5K u v1, brz završetak dugog — treba uporediti `*/v1 distances.ts` i `*/v2/policy.ts days` u V1b.

## 5. Testovi i CI

Podaci: `web/scripts/test-durations.json` (517 fajlova, zbir 11 516 s lokalno; skripta grafa: kolona „direktno v1" = dosezanje v1 mimo `select.ts`/`handoff.ts`) [M].

| Klasa | Fajlova | Zbir s | Šta sa njima |
|---|---|---|---|
| v1 folderi distanci + projekat `v1` (`equivalence*`) | 30 | 830,3 | brisanje |
| v1 folderi distanci, ostali (`isolation.node.test.ts`) | 4 | 1,6 | brisanje |
| projekat `v1` van foldera (`otherDistances*`, `runtimeIsolation*`, `guidance`, `generator.differential/fingerprint`, `personalPlan`) | 16 | 541,8 | brisanje; `personalPlan.node.test.ts` (9,3 s) ostaje uz opciju A |
| **zbir projekta `v1` (46 fajlova)** | **46** | **1 372,1 (11,9 % zbira)** | CI run 741: 1 713 od 22 838 s = 7,5 % (`TEST-SPEED.md:§ 11.2`) |
| v2 testovi koji uvoze v1 | 18 | 42,4 | ukloniti poređenje sa v1 / tipove na neutralan fajl |
| ostali koji **slučajno zavise od v1** (ne `v1` projekat): `domain/{plan,day,recovery,training,activities,weather,watch,ai,community,push,race}/*test*`, `features/*`, `stores/*`, `services/*`, `src/test/capture*` | 99 | 151,0 | `src/test/generators.ts` (32 uvoza v1) prebaciti na v2 generatore ili fiksture planova; `*.oracle.test.ts` (snimci starog frontenda) čuvaju prikaz/stanje — zadržati |
| zavise samo preko `select.ts` (bez izmene posle prebacivanja `select.ts`) | 41 | 200,4 | bez izmene |
| bez v1 | 344 | 9 743,5 | bez izmene |

Dobitak [T]: lokalno pun nivo −1 372 s zbira (~−12 %; ~−3,8 min po delu od 6 uz ravnomernu raspodelu), brz nivo ≈ 0 (v1 je u njemu već isključen); CI: nestaje posao `web-test-v1` (~10 min) i `v1-changes`, deo punog nivoa 7,5 %. Ako se 99 testova prebaci na v2 generatore, njihovih 151 s se uvećava (v2 sporiji): neizmereno.
Rizik [T]: 99 testova je jedina zaštita prikaza/stanja/migracija preko `plan`/`day`/`recovery`; prebaciti ih tek po jedan folder uz `npx vitest run <folder>`.

## 6. Redosled izvođenja (V1b, svaki korak se vraća `git revert` osim označenog)

| # | Korak | Provera | Preduslov / sudar |
|---|---|---|---|
| 0 | Preduslovi: T1 spojen (workflow, `web/scripts`, `vitest.config.ts`); P1 spojen ili V1b zaobilazi `halfMarathon/v2/**` osim 5 test fajlova sa uvozom v1 | `git log` T1/P1 | T1: koraci 7–8 diraju iste fajlove; P1: `halfMarathon/v2/app/*.node.test.ts` |
| 1 | `fiveK/exchange.ts` tipovi → `fiveK/v2/app/exchange.ts`; `select.ts` uvozi `*/v2/app/index.ts` direktno | `tsc`, `fiveK/v2/isolation`, `architecture.node.test.ts` | — |
| 2 | Status `legacy` bez generatora (osim `licni`): poruka + „Generiši nov plan"; zaštita `planGenerator()` | `npx vitest run src/features src/stores`, E2E `plan.spec` sa legacy fiksturom | pre brisanja; v1 još postoji, pa se ponašanje meri |
| 3 | Lični plan: `LEGACY_PERSONAL_GENERATOR` = HM v1 samo za `meta.licni` | `personalPlan.node.test.ts`, `features/personal*.test.tsx` | opcija A |
| 4 | `src/test/generators.ts` + 99 testova na v2/fiksture, folder po folder | `--changed`, brz nivo | najveći posao (§ 5) |
| 5 | Brisanje 5K/10K/maraton v1 (328 − 81 izvornih fajlova), v1 `handoff.ts` ciljevi, reference, pomoćnici, `flags.ts` prekidači, v1 grane `Wizard`/`onboarding` | `npm run check`, `TEST_FULL=1 … <v2 folder>`, E2E v2 specifikacije | — |
| 6 | CI: ukloniti `v1-changes`, `web-test-v1`, `test:v1`, `V1_REFERENCE`, `TEST_V1` u `scripts/sabotage.mjs`; ažurirati `AGENTS.md`, `TEST-SPEED.md § 11.2` | `npm run check`, jedan CI run | T1 sudar; `docs/**`-only push ne pokreće CI |
| 7 | E2E: specifikacije bez v2 oznake (`plan`, `auth`, `data`, `navigation`, `phase3-execution`, `recalibrate`, `final-preservation`, `generator-ab-users`) postavljaju v2 (env u `playwright.config.ts`) | `npm run e2e` dirnutih | proveriti da li hvataju v1 tekst |
| 8 | `npm run check:full` jednom (menja se `src/domain/**`) + `npm run build` | CI zelen | AGENTS.md: jednom pre mergea |
| 9 | **Deploy (odluka korisnika) — tačka posle koje su neke posledice trajne:** tehnički se vraća rollback-om, ali korisnik koji klikne „Generiši nov plan" trajno gubi `g…` unose (`purge.ts`) | — | korisnik odlučuje |
| 10 | V1c posle 13. 12. 2026: brisanje HM v1, `personalPlan.node.test.ts`, `personal-reference.json.gz`, `src/test/personal` | check | korisnik odlučuje datum |

## Otvorene odluke organizatoru

1. Opcija za lični plan: A vremenski ograničena (preporuka) / B / odustati od uslova.
2. Čuva li se dnevnik 4 korisnika sa unosima pre „Generiši nov plan" (izvoz/arhiva), ili je trajno brisanje prihvaćeno.
3. Da li V1b čeka P1 (HM v2) ili zaobilazi njegove fajlove.
4. 99 testova: prevesti na v2 generatore (sporije, tačnije) ili zamrznute fiksture planova (brzo, ali ne prate v2).
5. `docs/qa` (42 MB): koji folderi se brišu; neki su ulaz živih testova (`grep -rln docs/qa web/src`).
6. Raspon nedelja v1 (104) vs v2 (16–24): ostaje odbijanje u čarobnjaku ili se mora blaže poruka.
7. Datum V1c (brisanje HM v1) i potvrda da se lični plan posle trke samo pregleda.
