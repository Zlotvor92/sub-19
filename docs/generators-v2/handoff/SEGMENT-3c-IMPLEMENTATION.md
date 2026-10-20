# Segment 3c — HM v2 kao izvor predaje „kraća distanca" (+ dopuna 3b: nedelje od ponedeljka)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `e02bca5` (kod; `672f1e5` = zakrpa nedovršenog
rada, sada primenjena). Bez PR-a, mergea i deploya. Odluke: DESIGN.md § 8 (uključujući dopunu O1 i sudar → B).
`tenK/v2`, `fiveK/v2`, `marathon/v2`, `stores/` i `features/` nisu dirani. Verzija HM v2 ostaje **hm-v2.4.1**: plan
ne dobija novo polje i sačuvani plan je bajt-isti (`KNOWN_VERSIONS` nepromenjen).

## 1. Izmene

| Fajl | Izmena |
|---|---|
| `handoff.ts` (dopuna 3b, B) | `mondayWeeks`: pogled izvora za v1 cilj pregrupiše dane u nedelje od ponedeljka. Id i sadržaj dana ostaju; menjaju se samo `dow` i nedelja (broj i polja nedelje izvora koja sadrži taj ponedeljak). Nedelje koje već počinju ponedeljkom ostaju isti objekat. v1 kod se ne menja. |
| `halfMarathon/v2/lengths.ts`, `validate.ts` | `longRunShort(weeks, longWarnKm)`: jedna definicija praga. Čita je validator (LONG_RUN_SHORT, izlaz bajt-isti) i okidač. |
| `halfMarathon/v2/shorter.ts` (nov) | Okidač O1 `shorterOffer(plan, asOf?)`: ima adaptaciju, ispod praga (16 / početnik 14 km), plan generatora za isti ulaz nije ispod praga, trka posle `asOf`. |
| `halfMarathon/v2/app/preparation.ts` (nov) | `HM_V2_SOURCE_FORMAT` (jedino mesto spiska: `hmV2`; `vdot`, `paceBasis`, `predictedHmSec`, `goalVdot`, `goalAssessment`). `contractInput`: ulaz čarobnjaka bez izvedenih polja. `rawFacts`: činjenice bez `dayId` i zaključanih dana. `basisFromPlan`: `policy: null`, `execution: null`, bez `guardBaseKm`. `executionBasis`: potvrda + opis 28 dana, `startingKm = reportedBaseKm`, ulaz saglasan, razlog `confirmed-break`/`reduced-volume`. `preparationDecision`: 10K, pa 5K, prva koju cilj pokriva; „Zadrži plan v2" u `conditions`; nedostupne opcije sa razlogom doslovno. `buildPreparationChoice`: samo „shorter". `isLimitedLongPreparation(meta, plan)`. |
| `halfMarathon/v2/app/{members,index,adapt}.ts` | `executionBasis` postaje član 'v2' (`NO_PREPARATION_DECISION` uklonjen). Izvoz odluke i formata. `AdaptPreview.shorterOffer?: true` samo kad ponuda postoji. |
| `select.ts` | `hmV2Preparation(flags)` i `preparationForPlan(plan, flags = isključeno)` → HM v2. Granični kast za `executionBasis`. Komentar HM v2. |

## 2. Merenja

**weekAlign** (`weekAlign.measure.ts`, HM v2 grid svaki 41. ulaz → 10K/5K v1, 1 648 predaja): dupli datumi pre
dopune subota 824/824, nedelja 0/824; posle dopune 0 i 0 (dupli id 0 i 0).

**M1 sa domenskim okidačem** (`shorter.ts`, 193/97/29, 114 012 tokova, 0 odbijanja; `shorter-HM-3c.json`):
ponuda **3 274** (2,9 %) = 3 018 padova ispod praga u odnosu na prethodni plan (3a; svaki ima ponudu, `lostNotOffer`
0) + 256 ponuda bez pada u tom koraku.

256 je tačno broj tokova lanca čiji je PRVI korak pao ispod praga (`chain` 256). Drugi korak tog lanca (`chain2`) ostaje
ispod praga, a plan generatora nije, pa okidač (osnova = plan generatora) ponovo nudi. Raspodela 256 po scenariju nije
zasebno brojana; poklapanje je zaključak iz zbira. Prema dopuni O1 to je ispravno: stanje traje, a korisnik zatvara
ponudu. Brz uzorak: 175 = 168 + 7.

## 3. Testovi

**`halfMarathon/v2/app/handoffSource.node.test.ts` (11):**
- **Okidač:** pauza 35 d: 17,8 → 13,7 km → ponuda; LONG_RUN_SHORT iz iste funkcije;
  - trka nije posle `asOf` → nema ponude;
  - bez adaptacije ili bez pada → nema ponude;
  - plan rođen ispod praga → nikad ponuda.
- **Odluka i izbor:**
  - `preparationForPlan` → HM v2; `isLimitedLongPreparation` iz plana (sama `meta` → `false`);
  - osnova bez politike, izvršenja i `guardBaseKm`;
  - opcija `shorter-10000` (v1 cilj); „Zadrži plan v2" u uslovima;
  - izbor 10K i 5K: plan cilja bez `hmV2` i bez meta v2, upis bira 10K/5K v1;
  - `base` → odbijanje.
- **Nedostupne opcije:**
  - prekidač cilja v2 → `V2_TARGET_NOT_READY` za 10K i 5K (O4a);
  - plan po osećaju → `V1_TARGET_NEEDS_RESULT` (O5a).
- **T1/T2 × trka subota/nedelja × bez izvršenja/potvrđena pauza:**
  - politika izvora (`adapt.returnGrowth`, `pause.longShare`) menja plan izvora (kontrola), a budući deo i ocenu pripreme cilja ne menja;
  - T2: politika cilja (10K `RETURN_POLICY`) menja cilj.

**`handoffV2Source.node.test.ts` (3b, 13):** izvori sa trkom u subotu i u nedelju; nema duplog datuma ni id-a; prošli
dani izvora ostaju (isti id i sadržaj, menja se samo `dow`); budući dani su iz cilja (bez strukture v2).

`app.node.test.ts`: `executionBasis` sada daje osnovu (bez baze → poruka); `preparationForPlan(v2)` nije `null`.

**Sabotaže** (`node scripts/sabotage.mjs …`, brz nivo, `--bail=1`):
- **`sabotage-3b.json`: 6/6 palo**, uključujući 3b-f (pogled bez pregrupisanja).
- **`sabotage-3c.json`: 3/3 palo:** 3c-a okidač bez provere „pre adaptacije"; 3c-b izvor šalje izvedeni obim (min.
  cilj nedelje) umesto obima čarobnjaka (palo 3 testa); 3c-c čistač preskočen (prazan format).
- Stanje `src` posle vraćanja isto.

## 4. Provere (iz `web/`)

| Komanda | Rezultat |
|---|---|
| `npx tsc -b --noEmit`; eslint/prettier menjanih fajlova | exit 0 |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/halfMarathon/v2` | **52 fajla, 363/363**, 669 s |
| `TEST_FULL=1 npx vitest run --changed e02bca5` | 197/198 fajlova, 1539/1541; jedini pad: `marathon/v2/app/byteSame` (2 ključa, v. ispod) → posle osvežavanja 2/2 |
| `npm run check` (posle lint ispravke: `handoff.ts` datumi kroz `domain/date`) | **EXIT 0; 291 fajl, 3484/3484** |
| `npx playwright test e2e/hm-v2.spec.ts` | **3/3** (54 s) |

**Snimak druge distance (odluka organizatora (a)).** `marathon/v2/app/byteSame.9443676.json` je promenjen samo u 2 reda:
- „HM v2 #0 · priprema": `74234e98…b90b` → `53dcb598…e948`;
- „HM v2 #1 · priprema": `74234e98…b90b` → `3985d641…fb9`.

Razlog: snimak hešira `preparationForPlan(HM v2)`. Ranije je to bilo `null`, sada je `HM_V2_PREPARATION`. Ostala 221
ključa su bajt-ista (proveren diff posle `pull --no-rebase`).

`handoff.ts` je posle `--changed` prepravljen samo zbog linta (datumi kroz `domain/date`, isto ponašanje). Posle prepravke:
testovi 3b/3c 24/24, weekAlign dupli datumi i id 0/0, sabotaža 3b-f pada, `npm run check` prolazi.

Byte-same: tokovi HM v2 bez ponude su bajt-isti, jer pregled nema polje, a plan za upis i validator su nepromenjeni
(reference `byteSame`, grid, dense, early i ostale u punom nivou foldera). v1 i lični plan su takođe bajt-isti (`--changed`:
otherDistances, equivalence, personalPlan, policyIsolation).

## 5. Uslovi AGENTS.md

1 jedan vlasnik (`shorterOffer` nad `longRunShort`; spisak formata samo `HM_V2_SOURCE_FORMAT`); 5 činjenice bez
politike (`policy: null`, T1 za oba dana trke); 6 oznaka i faza cilja (`stampForStorage`); 7 bez uvoza van
`halfMarathon/v2/`, cilj kao argument (`isolation`, `architecture`); 8 bez duplih datuma/id, prošlost zaštićena.

## 6. Predaja 3g (odluke organizatora)

1. `storedPreparationDecision` prosleđuje plan: `isLimitedLongPreparation(meta, plan)`. Bez toga HM v2 vraća `false`.
2. `stores` prosleđuje prekidače korisnika: `preparationForPlan(plan, flags)`. Bez toga je cilj uvek v1.
3. „Zadrži plan v2" je dugme „Zatvori", bez promene ugovora.
4. `previewRestore` prikazuje `conflicts` (`RESTORE_OTHER_DISTANCE`, odluka 3b).
5. Prikaz `AdaptPreview.shorterOffer` u pregledu adaptacije (veza ka odluci o pripremi).
