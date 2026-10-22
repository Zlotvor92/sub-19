# Segment 3g — UI predaje „kraća distanca" za izvore v2 (store-ovi, ekrani, E2E)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `aa1d679`. Bez PR-a, mergea i deploya. Dirani su
samo `web/src/stores/`, `web/src/features/plan/`, `web/e2e/` i ovaj folder. `web/src/domain/**` nije menjan. Odluku,
opcije, razloge i plan cilja daje domen; UI ih samo prikazuje (pouka 20).

## 1. Stavke

| # | Fajl | Izmena | Test (`features/plan/handoffV2.test.tsx`) |
|---|---|---|---|
| 1 | `stores/executionActions.ts` `storedPreparationDecision` | `isLimitedLongPreparation(meta, plan)` | (1) odluka nad sačuvanim HM v2 postoji |
| 2 | isto + `previewPreparationChoice` | `preparationForPlan(plan, flags)`. `flags` = `currentGeneratorFlags()`: isti izvor kao za nov plan (podešavanje + razvojni override, `domain/generators/flags.ts`). `storedPreparationDecision(today, flags?)` prima prekidače iz ekrana (`useGeneratorFlags`). | (2) 5K v2 uključen → opcija 5K v2; isključen → v1 cilj traži rezultat |
| 3 | `HmV2Details`/`MarathonV2Details` + `previewHmV2`/`previewMarathonV2` | prenose `shorterOffer` (polja nema kad ponude nema) | (3) |
| 3 | `features/plan/ShorterDistanceDecision.tsx` (nov), `HmV2Adjustment.tsx`, `MarathonV2Adjustment.tsx` | `ShorterOfferNote` u pregledu: poruka + dugme „Odluka o pripremi" (skrol), pre primene tekst „prikazuje se kada primeniš". `useStoredDecision` računa odluku iz sačuvanog plana, dana i prekidača, pa je odluka vidljiva dok stanje traje (O1 dopuna). „Zatvori" je sklanja samo za tu verziju plana. | (3) pregled → primena → odluka; Zatvori ne menja plan; ponovo pri otvaranju |
| 4 | `ShorterDistanceDecision` | `statement`; opcija (naslov, opis, datum, `peakLongRunKm`, `peakWeeklyKm`, pokrivenost) → „Pregledaj opciju" → pregled (pre → posle, `RaceChange`) → „Primeni" (`commitPlanChange`, revizija 'goal'); lista „Nedostupne opcije" = `decision.unavailable` doslovno (`<Distanca>: <razlog>`); `conditions[0]` („Zadrži plan v2…") + dugme „Zatvori". Ugovor nije menjan. | (4) `10K: V1_TARGET_NEEDS_RESULT`, `10K: V2_TARGET_NOT_READY` jednakošću; vrh i pokrivenost |
| 5 | (bez izmene koda) | Prefiks, faza izvora, id dana i broj `offset + index` daje domen (3d/3f `storedPlan`, `changedWeeks`); kalendar i pregled čitaju `w`/`week`. | (5) prefiks = nedelje izvora doslovno; `w` = 1…N; dnevnik na svom danu; „Nedelja 2 od 12"; `PlanOverview` N1…N12; pregled 5K v2 → brojevi > offset |
| 6 | `previewRestore` | `changedDays` 0 i `conflicts` → razlog = `conflicts` (npr. `RESTORE_OTHER_DISTANCE`); bez `conflicts` ostaje stara poruka | (6) razlog doslovno, plan isti |
| 7 | — | Nijedno pravilo u UI: ponuda, prag, opcije i razlozi dolaze iz domena. Vrh 0 (cilj ga ne prijavljuje) se prikazuje kao „—". | — |

Svih 7 testova pada pre izmene (stash store-a i dva ekrana: 7/7 ×).

## 2. E2E `web/e2e/handoff-v2.spec.ts`

Backend i stanje su kao u `hm-v2.spec.ts`. Čarobnjak radi 2026-01-14 (start 2026-01-19). Posle toga ide pomeren sat i
pauza od 35 dana. Server se čeka sa `SYNC = 15 s`.

| Kombinacija | Prekidači | Tok | Rezultat |
|---|---|---|---|
| (a) HM v2 po osećaju → 5K v2 | HM v2, 5K v2 | 01-27: pauza → ponuda → primena → odluka (5K v2 + `10K: <razlog v1>`) → pregled → primena | `5k-v2`, `fiveKV2Prefix` offset 2, revizija na serveru, „Nedelja 2 od 12" |
| (b) maraton v2 → HM v2 | maraton v2, HM v2 | 10K 38:00, 50 km, dugi 24; 01-27 | `hm-v2`, `hmV2Prefix` offset 2 |
| (c) HM v2 (rezultat) → 10K v1 | HM v2 (10K v2 isključen) | 01-20; vrh u opciji | `10k-v1`, plan bez `hmV2`, ima `ulaz` |
| (d) HM v2 po osećaju, v1 ciljevi | HM v2 | 01-27 | lista = `[10K: …, 5K: …]` doslovno, bez opcije |
| (e) „Zatvori" | isto kao (d) | Zatvori → reload → odluka ponovo | plan na serveru isti |
| (f) vraćanje preko distance | posle (a) | „Pregledaj vraćanje: Prilagođavanje 2026-01-27: pauza" | `RESTORE_OTHER_DISTANCE` prikazan, plan isti |
| (g) HM v2 → 10K v2 | — | **otvoreno:** `tenK/v2/app/handoffTarget.ts` nije na grani (pull pre pusha, `d491000`) | organizator dodaje |

Postojeći E2E nisu menjani.

## 3. Sabotaže (`sabotage-3g.json`, brz nivo, `--bail=1`)

| Sabotaža | Fajl | Pala na |
|---|---|---|
| 3g-a store bez plana | `stores/executionActions.ts` | (1) |
| 3g-b store bez prekidača (oba mesta) | isto | (2) |
| 3g-c razlog parafraziran | `ShorterDistanceDecision.tsx` | (4) |
| 3g-d broj nedelje u pregledu bez offset-a | `fiveK/v2/app/adapt.ts` | (5) |
| 3g-e broj nedelje u kalendaru bez offset-a | `fiveK/v2/app/plan.ts` | (5) |
| 3g-f vraćanje bez `conflicts` | `stores/executionActions.ts` | (6) |
| 3g-g pregled HM v2 ne prenosi ponudu | isto | (1) |

**7/7 palo**, 48 s; stanje `src` posle vraćanja isto. 3g-d/e privremeno diraju domen samo kroz `sabotage.mjs`.

## 4. Provere (iz `web/`)

| Komanda | Pre pull-a (`561c0a5`) | Posle `pull --no-rebase` (`63cbd4a`) |
|---|---|---|
| `npx tsc -b --noEmit`, eslint, prettier (menjani fajlovi) | exit 0 | exit 0 |
| `npm run check` | **EXIT 0; 299 fajlova, 3542/3542** (8 min 51 s) | **EXIT 0; 299 fajlova, 3547/3547** |
| `npx vitest run --changed aa1d679` (brz / `TEST_FULL=1`) | 27 fajlova, 227/227 / 27, 227/227 | brz: **150 fajlova, 1575/1575** (uključuje izmene drugih segmenata), 224 s |
| sabotaže `sabotage-3g.json` | 7/7 palo | **7/7 palo**, stanje `src` isto |
| `npx playwright test e2e/handoff-v2 hm-v2 marathon-v2 fivek-v2 tenk-v2` | 16/16 (2,0 min) | **16/16** (2,0 min) |

Posle pull-a se promenio tekst `V1_TARGET_NEEDS_RESULT` (3c-dopuna 2). Jedinični test uvozi konstantu, pa nije
menjan. U E2E je konstanta zapisana doslovno i ažurirana je. `check:full` lokalno nije pokretan (AGENTS.md).

## 5. Stalni uslovi AGENTS.md

1. Jedan vlasnik: ponuda (`shorterOffer`), okidač i opcije su u domenu. UI nema prag ni drugo mesto odluke. „Zatvori"
   samo sklanja prikaz.
2. Jedan plafon: UI nema limit.
3. WU/CD se ne diraju.
4. Adaptacija: van opsega.
5. **Predaja:** izvor šalje činjenice, a cilj bira prekidač korisnika (`preparationForPlan(plan, flags)`) iz istog
   izvora kao čarobnjak (`generatorForNewPlan`). Bez prekidača je cilj v1, a ne tihi v2 (test (2), sabotaža 3g-b). UI ne
   šalje politiku i ne sastavlja ulaz cilja.
6. Plan cilja nosi oznaku cilja (`stampForStorage` u `commitPlanChange`). Faza nedelja prefiksa je faza izvora (test (5)).
7. Bez novih uvoza između foldera distanci; UI uvozi samo `select.ts`/`handoff.ts` (konstanta u testu).
8. Upotrebljivost: plan cilja posle predaje ima prefiks bez rupe i bez duplog broja nedelje, a dnevnik ostaje na svom danu.

## 6. Otvoreno

- **(g) 10K v2 kao cilj:** 3d-10K nije na grani. E2E (g) se dodaje kad stigne `tenK/v2/app/handoffTarget.ts`.
- **Vrh opcije 5K v2 = 0:** HM v2 izvor čita `meta.preparation`, a 5K v2 cilj ga nema (predaja 3d § 7). UI prikazuje
  „—". Ispravka je u domenu (izvor čita vrh iz `fiveKV2`, kao maraton iz `hmV2`), nije u opsegu 3g.
- **Poruka posle izbora:** primena opcije menja distancu plana, pa ekran prelazi na prilagođavanje cilja (npr. 5K v2), a
  poruka „primenjeno" se ne vidi. Plan, revizija i server su ispravni (E2E).
