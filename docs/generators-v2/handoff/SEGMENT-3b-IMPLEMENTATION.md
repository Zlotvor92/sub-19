# Segment 3b — lepak predaje za izvor v2 (izveštaj)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `4211884`. Bez PR-a, mergea i deploya. Menjani su
samo `web/src/domain/generators/{handoff,select,contract}.ts` i nov test `handoffV2Source.node.test.ts`. v2 folderi,
v1 folderi, `stores/` i `features/` nisu dirani. Odluke: DESIGN.md § 8.

## 1. Izmene

| Fajl | Izmena |
|---|---|
| `handoff.ts` | `SourceFormat` (`planKey` + `metaKeys`, daje ga adapter izvora kao argument, bez uvoza); `sourceViewForV1` (pogled izvora bez objekta plana v2 i bez meta ključeva v2; nedelje i dani ostaju); `v1TargetForV2Source` (v1 `handoffFuture` nad pogledom; bez rezultata `pb` → `{ error: V1_TARGET_NEEDS_RESULT }`, O5). `regeneratorForDistance` je nepromenjen. |
| `select.ts` | `shorterHandoffForV2Source(flags, format)`: cilj bira `generatorForNewPlan` (prekidač korisnika). v1 generator → `v1TargetForV2Source`. v2 generator → `{ error: V2_TARGET_NOT_READY }` (O4, nikad tihi prelaz; 3d ga zamenjuje). `sameDistanceGraft` na `graftFuturePlan` HM v2 i maratona v2: verzija druge distance se ne vraća (`RESTORE_OTHER_DISTANCE` u `meta.futureChanges.conflicts`, `changedDays` 0, nedelje iste). `PreparationApi.isLimitedLongPreparation(meta, plan?)`. Re-export `SourceFormat`. `preparationForPlan` je nepromenjen (v2 → `null`; uključuju ga 3c/3e). |
| `contract.ts` | `HandoffFacts` (samo tip): `execution`, `restartFromBase`, `notes?`, `meta?`, nov `raw?` (sirove činjenice izvora v2 za cilj v2). Strukturno isti tip kao kopije v1 ciljeva (test u oba smera). |

v1 izvori (HM v1, maraton v1) i dalje koriste `regeneratorForDistance` (O7). Izvršni kod v1 nije menjan.

## 2. Testovi (`handoffV2Source.node.test.ts`, 13 testova)

- **M2 ponovljen sa čistačem.** Izvori: HM v2 i maraton v2 sa rezultatom (brz nivo svaki treći ulaz, pun nivo svi).
  Ciljevi: 10K/5K v1, odnosno HM/10K v1. asOf: start − 1, kraj ned. 2, ⌊N/2⌋. Stanja: bez izvršenja i sa potvrđenom
  pauzom 14 d.
  - Objekat plana v2 u planu cilja: **0**.
  - Meta plana cilja je bajt-ista kao meta cilja nad izvorom BEZ IKAKVE meta izvora (osim `start`). Razlika: **0**.
  - Posle upisa (`stampForStorage`) plan bira v1 generator cilja; `isHmV2Plan` je `false`.
- **Kontrola:** bez čistača isti v1 `handoffFuture` nasleđuje `hmV2`, `racePace`, `paceBasis` (kanal je stvaran).
- **O5:** plan po osećaju (HM, maraton) → `V1_TARGET_NEEDS_RESULT` za sve ciljeve.
- **Prekidač cilja:** uključen (10K, 5K, HM v2) → `V2_TARGET_NOT_READY`; isključen → v1 cilj; distanca bez generatora → `null`.
- **Vraćanje verzije druge distance** (HM v2 i maraton v2 preko plana 10K v1 posle predaje) → odbijeno sa razlogom.
- **Ugovor:** `HandoffFacts` je strukturno isti tip u oba smera; `isLimitedLongPreparation(meta, plan)` daje isto što i
  `(meta)` (v1 ne čita `plan`).

**Ispravka M2 (DESIGN.md § 2).** M2 je brojao samo prisustvo ključa. `racePace` i `trainingVdot` piše i v1 cilj (prepisuje
ih), pa nisu curenje. Stvarno curenje pokazuje poređenje vrednosti: `vdot` (M2 ga je izostavio), `paceBasis`,
`predictedHmSec`, kod maratona još `mpVdot` i `predictedMarathonSec`, a sa ciljem izvora i `goalVdot` i `goalAssessment`.
Spisak u testu (`HM_FORMAT`, `MAR_FORMAT`) je predlog za adapter izvora u 3c/3e.

## 3. Sabotaže (`node scripts/sabotage.mjs ../docs/generators-v2/handoff/sabotage-3b.json`, brz nivo, `--bail=1`)

| Sabotaža | Rezultat | Prvi pali test |
|---|---|---|
| a čistač ne uklanja objekat plana v2 | PAO | M2 HM: bez objekta v2 i meta v2 |
| b čistač ne uklanja meta ključeve v2 | PAO | isto (pre ispravke kontrole: NIJE PAO, kontrola je išla kroz isti čistač; ispravljeno) |
| c v1 cilj bez rezultata nije odbijen | PAO | O5 HM |
| d prekidač cilja v2 tiho pada na v1 | PAO | prekidač 10K |
| e vraćanje druge distance nije odbijeno | PAO | vraćanje HM v2 |

5/5 palo; stanje `src` posle vraćanja isto.

## 4. Provere (iz `web/`)

| Komanda | Rezultat |
|---|---|
| `npx tsc -b --noEmit` | exit 0 |
| `npx eslint` / `npx prettier --check` (menjani fajlovi) | exit 0 |
| `npx vitest run --project node src/domain/generators/handoffV2Source.node.test.ts` (brz / `TEST_FULL=1`) | 13/13 / 13/13 |
| `TEST_FULL=1 npx vitest run --changed 4211884` | **153 fajla, 1172/1172**, 350 s. Uključuje: `otherDistances`, HM i maraton `equivalence`, `personalPlan`, `policyIsolation`, `guidance`, `architecture`, `runtimeIsolation`, `features/personalPlanGenerator`. |
| `npx vitest run --project node contract.node.test.ts` + `byteSame` 10K/HM/maraton v2 | 9/9 |
| `npx playwright test e2e/{fivek,tenk,hm,marathon}-v2.spec.ts` | **12/12** (1,6 min) |
| `npm run check` (typecheck, lint, format, vitest brz nivo) | **EXIT 0; 288 fajlova, 3452/3452**, vitest 238 s |

v1 reference su bajt-iste bez izmene očekivanja. `check:full` lokalno nije pokretan.

## 5. Uslovi AGENTS.md

- **1 jedan vlasnik:** izbor cilja je samo `generatorForNewPlan`; spisak formata izvora je samo kod adaptera izvora (argument).
- **5 predaja:** izvor ne šalje politiku. Cilj v1 dobija pogled bez formata v2; meta izvora ne menja meta cilja (test).
- **7 nula uvoza:** nijedan nov uvoz između foldera distanci; `handoff.ts` uvozi samo tip `GenPlanState` iz `../state`.
  `architecture` i `runtimeIsolation` prolaze.
- **8 upotrebljivost:** plan cilja pravi v1 cilj kao i do sada; uslov 8 za v2 cilj ostaje u 3d.

## 6. Otvoreno (sudar opsega, za 3g)

1. **Razlog odbijanja vraćanja se ne prikazuje.** `stores/executionActions.ts:610` `previewRestore` za `changedDays` 0
   vraća opštu poruku „Nema preostalih dana…" i ne prikazuje `conflicts`. Odbijanje radi (ništa se ne vraća), ali tekst
   `RESTORE_OTHER_DISTANCE` korisnik ne vidi. Ispravka je u `stores/`, van opsega 3b → predlog za 3g.
2. Vraćanje verzije druge distance za v1 izvore (HM v1 → 10K v1) je nepromenjeno, prema O7 (bajt-isto).
3. `V2_TARGET_NOT_READY` je privremen; 3d ga zamenjuje predajom cilju v2.
