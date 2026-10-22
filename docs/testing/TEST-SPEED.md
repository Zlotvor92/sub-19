# Brzina testova: brz i pun nivo, alat za sabotaže

Mereno 2026-10-18/19 na 4 jezgra (cloud kontejner), serijski: ništa drugo nije radilo (agenti su završili pre završnog
merenja). „Pre" = b09ae49 (čist worktree), „posle" = ovaj commit. Vitest 5.0.3, podrazumevano 3 radnika (forks).

## 1. Zaključak

| cilj | izmereno | status |
|---|---|---|
| `npm run check` (brz) ≤ 5 min zida | **205 s** doslovno (topli keševi tsc/eslint/prettier); hladno (prvo pokretanje u svežem kontejneru) ≈ 32 + 75 + 24 + 199 ≈ **329 s** | ✓ toplo / ✗ hladno (5,5 min) |
| nijedan fajl brzog nivoa > 60 s | najduži 31,6 s (`marathon/equivalence`) | ✓ |
| ceo tenK/v2 node skup (brz) ≤ 60 s | **40,6 s** (22 fajla, 287 testova) | ✓ |
| `npm run check:full` = današnja pokrivenost | svi redovi svih referenci (§ 5), svi `it` sa istim imenima (§ 4), exit 0 (269 fajlova, 2882 testa) | ✓ |
| `check:full` zid ≤ 50 % današnjeg | **829 s** prema današnjem `check` 833–901 s (92–100 %) | ✗ — nije dostižno bez slabljenja zaštite (§ 3); cilj revidiran (§ 1.1) |
| sabotaža ≤ 60 s, svih 5 (06c) ≤ 3 min | 7,5–16,4 s po sabotaži, **72 s** ukupno (redom), 43 s sa `--parallel 2` | ✓ |
| sabotaže (a)–(e) padaju u brzom nivou | 6/6 (§ 6) | ✓ |

### 1.1 Odluka organizatora (posle STANI, 2026-10-19)

1. **Prihvaćeno, cilj revidiran:** pun nivo = današnja pokrivenost, zid ≈ današnji. Uzrok je rad produkcionog koda, ne
   testova (§ 3). Brz nivo (`check` 205 s topao / ~329 s hladan, tenK/v2 40,6 s) i alat za sabotaže (72 s umesto
   1114 s) ispunjavaju svrhu.
2. **Prihvaćena odstupanja:**
   - mreže 10K v2 su uzorkovane i u brzom nivou, ne samo njihov determinizam (pune u `check:full`); bez toga
     tenK/v2 ≤ 60 s nije moguće;
   - `check:full` koristi eslint BEZ keša, isto kao CI (keš daje zastareo rezultat za pravila sa tipovima, § 4.1);
   - typecheck `tsc -b --noEmit --incremental`.
3. **Otvoreno, bez implementacije:** predlozi 2 (brzina produkcije, bajt-isti izlaz) i 4 (paralelne statičke provere
   za hladan `check`) iz § 3. Predlog 3 (CI `--shard`) je urađen 22. 10. (§ 10).
4. **Ispravka merenja organizatora** (JSON reporter ne meri collect ni okruženje) ostaje u izveštaju (§ 3, § 4.1).

## 2. Komande (iz `web/`)

| komanda | šta |
|---|---|
| `npm run check` | typecheck (`tsc -b --noEmit --incremental`) + `lint:cache` + `format:check:cache` + `test:fast` — za svaki segment i proveru |
| `npm run check:full` | typecheck + `lint` (BEZ keša, kao CI) + `format:check:cache` + `npm test` — kad segment dira v1, zajednički kod, reference ili test infrastrukturu, i pre mergea u main |
| `npm test` | pun nivo (`TEST_FULL=1 vitest run`) — CI (`.github/workflows/test.yml`) ga zove u 6 delova (`npm test -- --shard=i/6`, § 10) |
| `npm run test:fast`, `npx vitest run …` | brz nivo (podrazumevan) |
| `TEST_FULL=1 npx vitest run …` | pun nivo za izabrane fajlove (uključuje `*.full.node.test.ts`) |
| `TEST_ROWS_LOG=<fajl>` | svako poređenje sa referencom dopisuje `{ref, full, names}` (§ 5) |
| `EXACT_VERIFY_PARTS=1` | `referenceRow` ipak računa SHA po kategorijama i poredi ih sa preuzetim (provera § 7.1) |
| `node scripts/sabotage.mjs <ulaz.json> [--parallel 2]` | sabotaže (docs/testing/SABOTAGE.md) |

Okvir: `web/src/test/level.ts` (`FULL`, `sample`, `samplePick`, `part`, `logCompared`); `web/vitest.config.ts`
(`*.full.node.test.ts` samo uz `TEST_FULL=1`; `*.harness.node.test.ts` = zajednički test kod bez testova, nikad se ne
skuplja). Delovi punog nivoa: `<ime>.<deo>.full.node.test.ts`; glavni fajl u punom nivou radi deo 1 i proverava da
postoje tačno delovi 2…N.

## 3. Pun nivo ≤ 50 %: nije dostižno — merenje i predlog

**Zašto.** Zid punog skupa je ograničen ZBIROM rada, ne najdužim `it`-om:

| | zbir rada fajlova (s, sa collect) | zid (s) | zbir / 3 radnika |
|---|---|---|---|
| pre (b09ae49) | 2072 | 692 (hladan keš redosleda) / 760 (topao) | 691 |
| posle, pun nivo | 2230 | 758 (hladan) / 748 (topao, u `check:full`) | 743 |

- Organizatorovo merenje (JSON reporter: 1328 s zbira, 687 s zida) NE vidi fazu collect ni okruženje (jsdom): reliefGrid
  je u njemu 2 s, a stvarno 202 s (collect 200 s); ui 38 s → 132 s. Stvarni zbir je ~2070 s, pa je zid i pre bio skoro
  zbir/3 — podela na fajlove skraćuje samo rep (maraton 375 s), a dodaje ~8 % režije (svaki deo ponovo učitava module,
  referencu i bazne planove; reliefGrid +23 %).
- Profil (§ 7): 80–85 % CPU-a najsporijih fajlova je PRODUKCIONI kod, koji se u ovom zadatku ne menja. Čist višak na
  strani testa (uklonjen) je 5–7 % u fajlovima ekvivalencije.
- Za ≤ 50 % (~350–420 s) bi zbir morao pasti na ~1050–1250 s pri 3 radnika — bez promene produkcije to znači manje
  poređenih redova u punom nivou, što je zabranjeno.
- `--maxWorkers=4`: brz nivo 177 s prema 191 s (−7 %, jedno merenje, zbir raste 536 → 667 s zbog deljenja jezgara) —
  dobitak premali i neponovljen, NIJE uključen.

**Predlog** (odluka: § 1.1 — 1 prihvaćen; 2, 3 i 4 otvoreni, bez implementacije):
1. Prihvatiti stanje: brz nivo + alat (ciljevi ispunjeni), pun nivo = današnja pokrivenost uz zid ≈ današnji; cilj za
   pun nivo revidirati.
2. Poseban segment „brzina produkcije, bajt-isti izlaz" (pun nivo ga štiti — svaki red svake reference): v1 `resolvePlan`
   (17–18 % self u maraton/HM/10K), `preparationDecision` → `regenerate`/`findExtension` iz `buildExecutionAdjustment`
   (46–49 % inkluzivno u adaptaciji maratona/HM), `graftFuturePlan` (38 % HM); 10K v2 `same` (adapt.ts:24, poređenje
   preko `JSON.stringify`, 11–15 % self), `dayNumber` (dates.ts:45, regex parsiranje, 12–15 % self; `mustDay` 23–25 %
   inkl.), `limitsOf`/`dateIn` (steps.ts, 17 % inkl.). Procena dobitka nije merena.
3. CI: `npm test` podeliti na više poslova (`vitest run --shard=i/n`, GitHub matrix) — ista pokrivenost, CI zid ≈ zbir /
   (3 · n). Lokalni `check:full` se time ne ubrzava.
4. Hladni `check` (5,5 min): statičke provere paralelno (tsc ‖ eslint ‖ prettier: 32 / 75 / 24 s) ili `eslint
   --concurrency` — nije mereno.

## 4. Merenje pre / posle (serijski)

### 4.1 Alati

| | pre (b09ae49) | posle: 1. put | posle: 2. put |
|---|---|---|---|
| typecheck | 33,2 s (`tsc -b --noEmit` nikad nije ažuran: svaki put sve) | 31,7 s | **0,3 s** (`--incremental`, buildinfo u `node_modules/.tmp`) |
| `npm run lint` (CI, `check:full`) | 85,3 s | 77,0 s | 77,0 s (bez keša) |
| `npm run lint:cache` (`check`) | — | 74,7 s | **1,4 s** |
| `npm run format:check` (CI) | 22,6 s | 22,2 s | — |
| `npm run format:check:cache` | — | 23,6 s | **3,0 s** |
| vitest, svi projekti | 692 s (hladan) / 760 s (topao) | brz 199 s / pun 758 s | brz 191 s / pun 748 s |
| `npm run check` | ~833 s (06c izveštaj: 828 s) | — | **205 s** (exit 0, 221 fajl, 2731 test) |
| `npm run check:full` | — | **829 s** (exit 0, 269 fajlova, 2882 testa; tsc topao, eslint bez keša) | — |

- eslint keš: ključ je sadržaj fajla; pravila sa tipovima zavise od DRUGIH fajlova (dokazano: A postane `async`, B
  nepromenjen → `lint:cache` prolazi, `npm run lint` pada na `no-floating-promises` u B). Zato `check:full` i CI ne
  koriste eslint keš. Prettier keš (sadržaj + opcije + verzija) je bezbedan.
- Keš je u `node_modules/.cache/{eslint,prettier}` i `node_modules/.tmp` (gitignorisano); `.eslintcache` i
  `.prettier-cache` dodati u `web/.gitignore`.
- Redosled fajlova: vitest raspoređuje po keširanom trajanju BEZ collect faze (reliefGrid zabeležen 1,8 s), pa je
  na b09ae49 topao keš sporiji od hladnog (760 / 692 s). Posle: računanje mreža je u `beforeAll` (ulazi u trajanje).

### 4.2 Po fajlu (zid fajla sa collect, 3 radnika)

| fajl (`src/domain/…`) | pre (s) | od toga collect | brz (s) | pun: zbir (s) | fajlova | najduži (s) |
|---|---|---|---|---|---|---|
| `generators/marathon/equivalence.node.test.ts` | 374,7 | 0,7 | 31,6 | 410,7 | 14 | 68,2 |
| `generators/runtimeIsolation.node.test.ts` | 313,1 | 0,4 | 24,0 | 353,7 | 8 | 48,7 |
| `generators/halfMarathon/equivalence.node.test.ts` | 257,6 | 0,5 | 26,8 | 286,1 | 10 | 58,6 |
| `generators/tenK/v2/reliefGrid.node.test.ts` | 201,6 | 199,8 | 17,3 | 247,8 | 7 | 39,8 |
| `generators/tenK/v2/grid.node.test.ts` | 127,4 | 85,8 | 16,2 | 132,6 | 4 | 47,1 |
| `generators/otherDistances.node.test.ts` | 125,7 | 0,5 | 13,0 | 136,9 | 4 | 40,5 |
| `generators/tenK/v2/feelGrid.node.test.ts` | 90,2 | 53,5 | 10,4 | 100,9 | 4 | 35,3 |
| `generators/tenK/equivalence.node.test.ts` | 70,4 | 0,2 | 14,1 | 64,9 | 3 | 35,1 |
| `generators/fiveK/equivalence.node.test.ts` | 70,3 | 0,2 | 15,0 | 62,5 | 3 | 34,4 |
| `generators/tenK/v2/adapt.node.test.ts` | 39,3 | 24,1 | 10,4 | 42,5 | 1 | 42,5 |
| `generators/tenK/v2/beginnerGrid.node.test.ts` | 19,4 | 13,4 | 5,0 | 18,6 | 1 | 18,6 |
| `training/generator/generator.differential.node.test.ts` | 15,3 | 0,4 | 6,6 | 16,2 | 1 | 16,2 |
| `generators/personalPlan.node.test.ts` | 14,4 | 0,4 | 9,8 | 10,6 | 1 | 10,6 |
| `generators/tenK/v2/quality.node.test.ts` | 12,9 | 7,8 | 12,0 | 11,8 | 1 | 11,8 |
| `generators/guidance.node.test.ts` | 12,9 | 0,7 | 9,6 | 9,5 | 1 | 9,5 |
| `state/migrate.oracle.test.ts` | 12,1 | 0,1 | 10,9 | 12,2 | 1 | 12,2 |

Projekti (pre → brz → pun, zbir s): domain 46 → 42 → 46; oracle 47 → 43 → 44; ui 132 → 131 → 134 (jsdom okruženje ~55 s
zbira — `isolate: false`/drugo okruženje bi menjalo izolaciju, nije rađeno); node 1848 → 321 → 2007.

Najsporiji `it` pre (organizator, bez collect): maraton „adaptacija: svi tokovi…" 279 s, HM „adaptacija" 197 s,
runtimeIsolation „lokalna promena politike…" 165 s, otherDistances (jedan it) 125 s, runtimeIsolation „različit
redosled…" 77 s. Posle: nijedan pojedinačan fajl punog nivoa > 69 s; brz nivo ≤ 32 s.

Svi današnji testovi (2726 jedinstvenih „fajl + puno ime") postoje sa istim imenom i u brzom i u punom nivou i prolaze;
nov `it` u oba nivoa: runtimeIsolation „pun nivo: delovi adaptacije današnjeg podskupa postoje kao zasebni fajlovi".

## 5. Redovi po referenci (iz `TEST_ROWS_LOG`; jedinstvena imena)

Danas `compare()` prolazi SVE redove reference, pa je „danas" = broj redova reference. U punom nivou je za svaku
referencu broj jedinstvenih poređenih redova = broj redova reference (zbir je veći gde test vremenske zone ili ponovljena
izvršavanja beleže isti ključ).

| referenca | redova (danas) | brz | pun |
|---|---|---|---|
| marathon generation / adaptation / decisions | 1843 / 25 764 / 1581 | 454 / 3309 / 172 | 1843 / 25 764 / 1581 |
| halfMarathon generation / adaptation / decisions | 1826 / 27 596 / 519 | 437 / 2945 / 82 | 1826 / 27 596 / 519 |
| tenK (v1) generation / adaptation | 1100 / 14 267 | 320 / 2175 | 1100 / 14 267 |
| fiveK (v1) generation / adaptation | 1064 / 14 942 | 284 / 3002 | 1064 / 14 942 |
| otherDistances generation / adaptation / decisions | 2211 / 17 638 / 157 | 252 / 1384 / 157 | 2211 / 17 638 / 157 |
| runtimeIsolation podskup 5K / 10K / HM / maraton (11 poređenja po redu) | 854 / 796 / 893 / 882 | 349 / 360 / 724 / 370 | 854 / 796 / 893 / 882 |
| personal flows, guidance flows / state / formPreview | 13 782, 14 744 / 7380 / 30 | isto | isto |
| fingerprint redovi, differential SHA | 2304, 1500 | 2304, 501 | 2304, 1500 |
| 10K v2: mreža R (4917959) | 18 193 | 995 | 18 193 |
| 10K v2: mreža 04 (4917959, e6540a5) | 2040 | 408 | 2040 |
| 10K v2: mreža P (4917959, e6540a5) | 336 | 336 | 336 |
| 10K v2: mreža 02 (segment03/02b/02 baseline, 21c03f1, 81bd351, b13ca17) | 15 840 | 1651 | 15 840 |
| 10K v2: po osećaju (segment03-feel, 81bd351, b13ca17) | 11 880 | 1100 | 11 880 |
| 10K v2: početnici (segment03b-beginner, b13ca17) | 3402 | 684 | 3402 |

Nijedna referenca/fixture/heš nije izmenjen ni ponovo snimljen: sha256 svih 407 fajlova (`web/src/**/*.json[.gz]`,
`*.mjs`, `docs/qa/**`) isti pre i posle.

## 6. Sabotaže

| | stari način (ceo tenK/v2 skup, bez bail, b09ae49) | novi alat (brz nivo, `--bail=1`, redom) |
|---|---|---|
| 06c-a A17 isključen | 297,2 s, 14/287 palih | 16,4 s, prvi: painGrid „06c: regresija prema 4917959…" |
| 06c-b A17 ukida i prinudno | 208,7 s, 2/287 | 15,8 s, reliefGrid „prinudno rasterećenje (A5) se nikad ne ukida…" |
| 06c-c validator bez izuzetka A17 | 190,2 s, 27/287 | 7,5 s, painGrid „336 tokova, svi primenjuju PAIN…" |
| 06c-d nov start ulazi u A17 | 208,9 s, 1/287 | 15,7 s, reliefGrid „nov start (pauza 35 dana) se ne računa…" |
| 06c-e reduced se ne čita | 209,5 s, 1/287 | 16,3 s, reliefGrid „višak + bol u istom koraku…" |
| ukupno | **1114,5 s** | **72,1 s** (`--parallel 2`: 43,4 s; `--parallel 3`: 45,7 s) |

- `docs/10k-v2/artifacts/segment-06c/sabotage.json` ne sadrži find/replace, samo imena palih i heš
  `sha256(git diff --diff-filter=M 888bf45 -- web/src)[:16]`. Ulaz `docs/testing/sabotage-06c.json` je rekonstruisan:
  (a), (c), (e) i (d) (dve izmene) daju bajt-isti diff kao zabeleženi heševi; (b) ne (heš 87336a2… nije nađen) —
  semantički ista izmena (uklonjena provera `forced`). Stari način na b09ae49 obara TAČNO iste testove (ista imena)
  kao zabeleženo za svih pet.
- Dokaz da brz nivo hvata greške (`docs/testing/sabotage-proof.json`, novi alat, 6/6 PAO, 80,6 s):

| sabotaža | izmena | pun nivo: palih redova | brz: prvi pali | s |
|---|---|---|---|---|
| (a) maraton v1, manjina tokova | `marathon/plan/executionAdjustment.ts` `fatigued ? 0.85 : 1` → `0.8` | 227 / 25 764 (0,9 %) | maraton „adaptacija: svi tokovi…" | 20,8 |
| (b) HM v1 | `halfMarathon/plan/regenerate.ts` `fraction: 0.7` → `0.75` (srednja pauza) | 945 / 27 596 (3,4 %) | HM „adaptacija…" | 18,5 |
| (c) 10K v1 | `tenK/training/runWalkProgress.ts` `windowDays: 21` → `14` | 28 / 14 267 (0,2 %) | 10K „adaptacija…" | 9,2 |
| (c') 5K v1 | `fiveK/training/constants/heuristics.ts` `VDOT_PROPOSAL_THRESHOLD = 1.5` → `2.5` | 180 / 14 942 | 5K „adaptacija…" | 10,1 |
| (d) zajednički promenljiv objekat | `tenK/index.ts` + `export { FIVE_K_PRODUCT as SHARED_FIVE_K_PRODUCT } from '../fiveK'` | — | runtimeIsolation „nema zajedničkog promenljivog objekta…" | 11,3 |
| (e) nedeterminizam 10K v2 | `tenK/v2/generate.ts` napomena `… RPE. ${Date.now()}` | — | feelGrid „deterministički…" | 10,4 |

  (c) se u brzom nivou hvata samo zahvaljujući imenovanom baznom planu `lestvica` (run/walk tokove ima 6/70 planova).

## 7. Profil i čist višak

CPU profil (`--import` hook sa `node:inspector`; vitest forks ne piše `--cpu-prof`), 4 najsporija fajla (pod
opterećenjem 4 paralelna profila — udeli, ne apsolutna vremena):

| fajl | CPU | produkcija | `exact.ts` | `record` (čistoća) | GC |
|---|---|---|---|---|---|
| marathon/equivalence | 425 s | ~80 % (resolvePlan 17,5 % self; preparationDecision 49 % inkl.) | 8,5 % | 4,2 % | 6,7 % |
| halfMarathon/equivalence | 309 s | ~80 % (resolvePlan 17,6 %; buildExecutionAdjustment 51 % inkl.) | 8,5 % | 4,1 % | 6,0 % |
| runtimeIsolation | 371 s | ~75 % | 12,7 % | 5,2 % | 5,5 % |
| tenK/v2/reliefGrid | 239 s | ~85 % (adaptTenKV2 67 % inkl., validatePlan 36 %; `same` 14,7 %, `dayNumber` 14,7 % self) | — | — | 3,6 % |

Uklonjeno (iste tvrdnje, isti redovi):
1. `exact.ts` › `referenceRow`: SHA po kategorijama (obilazak stabla, ~60 % troška `exact.ts`) računao se za SVAKI red,
   a testovi ga gledaju samo kad se ukupni SHA razlikuje. Sad se, kad je ukupni SHA jednak očekivanom, kategorije
   preuzimaju iz reference (isti tačan zapis = isto stablo); pri razlici se računaju kao ranije. Provera:
   `EXACT_VERIFY_PARTS=1 TEST_FULL=1` (računa i poredi) prolazi za sve fajlove ekvivalencije, runtimeIsolation,
   otherDistances, personalPlan, guidance.
2. runtimeIsolation: referenca se učitava jednom po distanci (ranije gunzip + JSON.parse pri svakom od ~45 poziva).
3. otherDistances: prosleđuje očekivani red (ranije obilazak za svih 20 006 redova).
4. personalPlan: referenca jednom (ranije dvaput); differential: `shaOf` jednom po planu; fingerprint: `preview()` samo
   pri `UPDATE_FINGERPRINT` (ne poredi se).
5. reliefGrid „primeri": 292 bazna plana generisala su se u telu describe-a, a koristila 3 — sad po potrebi (keš sa
   mrežom; mreža i dalje generiše svih 292 i tvrdi da nijedan nije odbijen).
6. Računanje mreža iz `describe` tela u `beforeAll` (raspoređivanje, filter imena, `--bail` ne računa nepotrebnu mrežu).

Nije uklonjeno: dvostruki `JSON.stringify` argumenata u `record` (to JE tvrdnja čistoće); dvostruki stringify u
`planHash81`/`planHash06c` (`tenK/v2/testInputs.ts` je po pravilu zadatka produkcioni fajl).

Vruće tačke u produkciji (samo prijava): v. § 3 predlog 2. Nijedan pojedinačan poziv > 20 ms nije izmeren (adaptTenKV2
~10 ms; bazni plan maratona 0,2–9 s CPU za ~360 tokova); kvadratna petlja nije nađena.

## 8. Uzorci brzog nivoa (deterministički, `sample`: svaki k-ti unutar kategorije, prvi uvek)

| test | uzorak |
|---|---|
| marathon/equivalence | generisanje k = 8 (fingerprint / mTrack / seededM), svi `edgeM` i `qa`; adaptacija k = 12 po kategoriji baznih planova (qa / seededM / mTrack / edgeM) + imenovani `početnik`, `povratak kratka priprema`, svih 6 `event`; odluke k = 12 + `edgeM · povratak`; vremenska zona: sve 4 zone, po zoni 48 ulaza + bazni plan `trka za 6 ned · q2` |
| halfMarathon/equivalence | generisanje k = 8, svi `edgeHm` i `qa`; adaptacija k = 18 + `početnik`, `povratak`, sva 4 `event`; odluke k = 6; vremenska zona kao maraton (46 ulaza + 1 bazni plan) |
| tenK/equivalence (v1) | generisanje k = 5, svi `qa` i `edge10k`; adaptacija k = 9 + `edge10k · lestvica`, `edge10k · iskusan`, svih 9 `event`; vremenska zona: zona i poredi i-ti od 4 dela skupa ulaza i 1 od prva 3 bazna plana (unija = današnji skup) |
| fiveK/equivalence (v1) | generisanje k = 5; adaptacija k = 7 + `edge · lestvica`, `edge · iskusan`; vremenska zona kao 10K |
| runtimeIsolation | svaki 120. ulaz generisanja + 1 kratak bazni plan po distanci (5K `seeded · 322`, 10K `edge10k · trka za 4 ned`, HM `edgeHm · trka za 3 ned · q2`, maraton `edgeM · trka za 3 ned · q2`; za cilj 5K i HM `hmTrack · first · q1 · 7n · 5d · 58km` — kanal predaje); `reachableObjects` i sve kombinacije redosleda/svežeg modula/lokalne promene: puno |
| otherDistances | generisanje k = 10 po distanci × kategoriji + svi QA; adaptacija prvi bazni plan svake od 6 kategorija; odluke sve |
| tenK/v2/reliefGrid | R: k = 23 unutar nedelja plana × scenario (63 kategorije); F/B: k = 9 unutar porodica × scenario (14); imenovani `10w-25km-v30-A-sat/w3` (svih 7 scenarija), `12w…/w2/pause10`, `17w…/w6/pain5` → 995 tokova; determinizam svaki 6. |
| tenK/v2/grid | k = 11 unutar dana × nedelje (44 kategorije) + imenovani: 12 planova sa nižim vrhom od 49ad476, 108 izuzetaka ROUNDING, 96 planova sa RACE_WEEK_SHORT u 21c03f1 → 1651 plan |
| tenK/v2/feelGrid, beginnerGrid, adapt | k = 11 (1100 planova); k = 5 (684); k = 5 unutar scenarija (408 tokova, 24/30 baznih planova, sva 4 asOf) |
| generator.differential | svaki 3. ulaz po distanci (501 / 1500); `withGoal` se broji nad svih 1500 |
| bez uzorka | sve ostalo, uključujući `isolation.node.test.ts` (AGENTS.md uslov 7, svi), painGrid, quality, week, personalPlan, guidance, fingerprint, oracle, ui |

Tvrdnje drugačije u brzom nivou (pun nivo: tačno današnje):
- vremenska zona: pragovi veličine podskupa (10K/5K > 50 / > 300 umesto > 100 / > 500; maraton/HM > 30 / > 300
  umesto > 200 / > 500) jer zona poredi deo skupa;
- brojke nad celim skupom (npr. „taper > 500", broj odluka „shorter") tvrde se nad ključevima reference, a izračunati
  uzorak = referenca za uzorak (u oba smera); pokrivenost: svaki red reference pripada tačno jednom baznom planu;
- 10K v2 mreže: brojke celog skupa (CHANGED = 739 po scenariju, REDUCED_ONLY, tabele po broju dana, D30a/D30b, uzroci
  regresije, `reducedSeen`…) samo u punom; brz tvrdi isti oblik, ≤ broj celog skupa, nula ostaje nula, bez nove
  kategorije; kolona proseka vrh/start (`statsRow`) se ne poredi; J2 prag srazmeran uzorku; broj ULAZA i ključeva
  (15 840, 18 193, 11 880, 3402, 2040) proverava se u oba nivoa;
- runtimeIsolation brz ne pokriva kanal predaje maraton → HM (pokriva 5K → HM).

Pun nivo — strukturne razlike prema danas (iste tvrdnje, isti redovi): runtimeIsolation „različit redosled…" radi sva
4 redosleda po delu (G, B0, B1) umesto nad celim podskupom; „mora da reaguje" tvrdi se po delu (jače); `viaHandoff > 0`
je u delu HM (izmereno: jedini doprinosilac danas, red maraton → HM U10). Nijedan `it` ne postoji samo u punom nivou —
delovi „(deo k/N)" su delovi postojećih `it`.

## 9. Napomene

- Zajednički kod mreža 10K v2 je u `tenK/v2/*.harness.node.test.ts` (relativni uvozi), ne u `src/test/`: provera
  „segment 05" (`tenK/v2/isolation.node.test.ts`) dozvoljava van tenK/v2 samo `tenK/index.ts → v2/app/index.ts` i ne
  razrešava `@/` alias — pomoćni fajl u `src/test` sa alias uvozom bi je zaobišao. Ime `*.test.ts` ih čini test kodom
  (provera izolacije, tsconfig); vitest ih ne skuplja.
- `src/test/level.ts` je u `tsconfig.oracle.json` (Node tipovi), izuzet iz `tsconfig.app.json`.
- Sva merenja agenata (paralelno, deljena 4 jezgra) su samo orijentir; brojke u ovom dokumentu su iz serijskog merenja.

## 10. CI (organizator, 22. 10. — odluka delegirana od korisnika)

Pre: jedan posao `web` je radio typecheck, lint, format, `npm test`, build i E2E redom — 80–90 min po run-u; svaki push
grane sa otvorenim PR-om pokretao je DVA run-a (push i pull_request), a brzi pushevi su se gomilali (4 run-a odjednom).
Run 665 (d473e5d) pao je na timeout beforeAll-a pod opterećenjem.

`.github/workflows/test.yml` sada:

| izmena | efekat |
|---|---|
| `paths`: sve osim `docs/**` (izuzev `docs/qa/**`, koje testovi čitaju) i `*.md` u korenu; + `workflow_dispatch` | push samo dokumentacije ne pokreće testove (izveštaji segmenata); ručno pokretanje ostaje |
| samo `push` (+ `workflow_dispatch`), bez `pull_request`; `concurrency` po grani, `cancel-in-progress: false` | jedan run po pushu; PR prikazuje run svog commita; run koji radi se završava, a od pusheva u međuvremenu čeka samo najnoviji (GitHub otkazuje stariji koji čeka) — sa `cancel-in-progress: true` 6 tabova je otkazivalo svaki run pre kraja. (Prva verzija je imala i `pull_request`: njegov `paths` gleda ceo PR, pa je svaki push dokumentacije pokretao run i otkazivao run koda — ispravljeno istog dana.) |
| posao `web-test` (matrica 1…6): `npm test -- --shard=i/6` | pun nivo u 6 paralelnih delova (vitest deli fajlove po hešu putanje); `web` ostaje typecheck, lint, format, build, E2E |

Pokrivenost ista (isti `npm test`, isti fajlovi; zbir delova = svi fajlovi). Posledica: proverava se vrh grane (najnoviji push koji je čekao), ne svaki međukorak — organizator čita CI na vrhu
grane.

