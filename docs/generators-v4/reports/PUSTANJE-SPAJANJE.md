# PUŠTANJE-1 — spajanje `main` u `claude/v4` (izveštaj, 15. 11. 2026, Beograd)

## Spajanje
- Merge commit **`f16761cf`** (`git merge origin/main`, bez rebase-a/force-a); grana se u međuvremenu pomerila
  (`d238e746`, nalog PUŠTANJE-2) → `git merge origin/claude/v4` = `92fef7e7`, pushovano. `main` nije diran, bez PR-a/deploya.
- Stablo `f16761cf` je **identično** stablu `claude/v4` pre spajanja (`git diff ORIG_HEAD f16761cf` prazan):
  sav sadržaj `6a37541d` (#55) već je bio na `claude/v4` (commitovi `bd4fefc1`, `5db7df56`, `56e3703a`, `6bbeabdf`).

## 7 sukoba (svi: obrisano na `claude/v4` u `3fcf5941` V1b korak 5, menjano u `main` #55) → ostaju obrisani
| Fajl | Zašto obrisan | Šta je `main` menjao | Prenos |
|---|---|---|---|
| `generators/guidance.node.test.ts` | v1 referenca trenerske logike (V1b) | broj tokova 14744→14442 (novi lični plan) | nema; fajl pre brisanja = `main` bajt-isto |
| `test/guidance/captureReference.node.test.ts` | isto | isto | nema; bajt-isto |
| `test/fixtures/guidance-reference.json.gz` | v1 referenca | ponovo snimljena za novi lični plan | nema; bajt-isto (`6bbeabdf`) |
| `test/fixtures/state-reference.json.gz` | v1 referenca | isto | nema; bajt-isto |
| `{halfMarathon,marathon,tenK}/v2/app/byteSame.*.json` | poređenje v2 aplikacije sa v1 (V1b) | heševi „lični plan · …" | nema; redovi ličnog plana na `claude/v4` pre brisanja = `main` (0 razlika); razlika samo u 5K v2 heševima (novije 5K v2 politike na `claude/v4`) |

Zamena za ove reference ne postoji jer je v1 (osim zamrznutog HM v1) obrisan; lični plan pokriva
`personal-reference.json.gz` + `personalPlan.node.test.ts` (8196 tokova, isto kao `main`).

## Lični plan iz `main` — dokaz
- `git diff origin/main -- web/src/data/personalPlan.ts` → **prazan**; isto za `web/src/domain/personal/**`,
  `features/personal.test.tsx`, `e2e/owner.spec.ts`, `test/fixtures/personal-reference.json.gz`, `.claude/skills/**`.
- `personalPlan.node.test.ts` se razlikuje od `main` samo u uvozima/izboru generatora iz V1b
  (`LEGACY_PERSONAL_GENERATOR`, `@/test/personal/*`); referenca i broj tokova isti.
- Namenski: `personalPlan.node.test.ts`, `domain/personal`, `features/personal.test.tsx`, `integrations/v4/adopt.test.ts`
  (preuzimanje ličnog plana, `adopted:personal`), `stores/v4Store.test.ts` (`personalProtected`) — **5/5 fajlova, 156/156**.
  `e2e/owner.spec.ts` zelen u celom E2E skupu. Nijedna fikstura nije menjana.

## Provere (lokalno, na `f16761cf`)
| Provera | Ishod |
|---|---|
| `npm ci` (web) | OK |
| `npm run check` | **403/403 fajla, 4884 + 12 očekivanih padova**, 13,5 min |
| korenski `node --test "test/**/*.test.mjs"` | **430/431** — 1 pad, postojao i pre (v. dole) |
| `npm run build` | OK (samo upozorenje o veličini chunka) |
| E2E ceo skup `--trace off` | **92/92**, 4,7 min |
| `npm run check:full` | **541/541 fajl, 5416 + 12 očekivanih padova**, 73,6 min |

## Padalo i pre spajanja (nije popravljano — stablo spajanja = stablo pre)
- `test/api.test.mjs:2625` „svaka funkcija okidača iz fajlova je na spisku izuzetaka": `plan_v4_zapamti` nije na spisku
  izuzetaka u `user-state.sql` čišćenju („bi ih obrisao kao bez posla").
- CI `claude/v4` je crven od ranije (poslednji run 1018 na `51e1bc57`, 07:22): posao `test` = isti pad gore; posao
  `web-test` (pun nivo, select) = istek vremena na CI-ju: `v4/engine/guard.test.ts:39`, `v4/engine/stability.test.ts:9`,
  `v4/distances/hm/r9b.test.ts:57`, `v4/distances/tenk/r9b.test.ts:15` (5 s), `v4/distances/marathon/marathon.test.ts:343`
  (60 s). Lokalno u `check:full` ti testovi prolaze. Nisu u dometu ovog naloga (`domain/v4/**` se ne dira).

## CI za spajanje
- Push `92fef7e7`: CI **nije pokrenut** — u odnosu na prethodni vrh grane menja samo `docs/**`
  (pravilo `ciScope`). Stanje CI grane je stanje run-a 1018 (gore).
