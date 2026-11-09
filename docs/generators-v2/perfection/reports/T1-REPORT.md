# T1 — brži CI i testovi: izveštaj

Sesija T1, 9. 11. 2026 (sva vremena po beogradskom vremenu). Zadatak: `briefs/T1-brzina-ci.md`. Grana
`claude/generator-isolation-5k-10k-hm-marathon`. Izmena obima (organizator, 22:00): v1 posao ostaje kao danas.

## 1. Pre / posle po vrsti push-a (izmereno na stvarnim run-ovima)

Zid = od kreiranja run-a do kraja poslednjeg posla; runner-min = zbir trajanja poslova (start → kraj), sa postavkom.
Izvor: GitHub Actions API (`list_workflow_jobs` za run).

| vrsta push-a | pre (run) | zid pre | runner-min pre | posle (run) | zid posle | runner-min posle |
|---|---|---|---|---|---|---|
| „sve" (workflow, `src/test`, main…) | 764 (`main`) | 12,7 min | ≈ 89,7 | 766 (`33c645d`) | 9,4 min | ≈ 77,7 |
| jedna distanca v2 (5K, komentar) | 764 (sve) | 12,7 min | ≈ 89,7 | 767 (`122548f`) | 5,6 min | ≈ 32,1 (bez v1 ≈ 21,6) |
| samo ekran (`PlanOverview.tsx`) | 764 (sve) | 12,7 min | ≈ 89,7 | 768 (`4f4033a`) | 5,4 min | ≈ 14,6 |
| van koda aplikacije (`.claude/**`) | 758, 759 (sve) | 12,9 / 12,8 min | ≈ 90 | — (izbor `none`, test) | ≈ 0,3 min | ≈ 0,6 |
| poslednji push (sve, v1 kao danas) | — | — | — | RUN769 | RUN769_ZID | RUN769_RM |

Ciljevi: distanca ≤ 7 min — ispunjeno (5,6). Ekran ≤ 6 min — ispunjeno (5,4; ograničava E2E deo 1/3, 4,6 min testova). „Sve" ≤ 9 min — 766: 9,4 min (delovi 4,8–8,8
min: šum trajanja fajlova na CI-ju je veći od razlike koju tabela ispravlja); posle odluke da v1 ostane jedan posao
(~10 min) zid „sve" ograničava v1 posao — RUN769_NAPOMENA.

Pojedinačno (run 766 prema 764): statičke provere 11,4 → 1,9 min posla (E2E izdvojen; keš `node_modules`: `npm ci`
35–47 s → 2–6 s); E2E 7,6 min u jednom poslu → 3 dela 1,7 / 4,8 / 2,7 min; delovi web-test 6,7–11,9 → 4,8–8,8 min.

## 2. Šta je urađeno

- `web/scripts/ciScope.mjs` — jedna funkcija `decide`, CLI za CI; test `web/scripts/ciScope.node.test.ts` (33 testa).
  Pravila i dokaz: `docs/testing/TEST-SPEED.md` § 13.
- `.github/workflows/test.yml`: posao `scope` (bez `npm ci`); `web` = samo statičke provere; `web-e2e` 3 dela, pregledač
  iz keša; `web-test` 8 delova za „sve", 1–6 za izbor; `web-test-v1` kao pre (jedan posao, `npm run test:v1`), samo
  kad je izbor „sve" (nadskup ranijeg `v1-changes`).
- `.github/actions/web-deps`: keš `node_modules` po hešu `package-lock.json`.
- `scripts/test-durations.json`: prosek CI run-ova 765 i 766 (479 fajlova); reporter piše deo za artefakt
  (`TEST_DURATIONS_OUT`), posao „sve" ga čuva kao `test-durations-*`.
- `vitest.config.ts`: `V1_REFERENCE` iz `ciScope.mjs` (jedan spisak).
- `AGENTS.md` (Testovi i sabotaže), `TEST-SPEED.md` § 13.

## 3. Dokaz pokrivenosti „sve" (isti fajlovi, isti redovi)

- `TEST_FULL=1 TEST_V1=1 npx vitest list --filesOnly` pre (`998c668`, git stash) i posle: 524 → 525 fajlova; razlika
  je samo nov `scripts/ciScope.node.test.ts`. Bez v1 (`TEST_V1=0`): 478 → 479; projekat v1: 46 → 46.
- Delovi: `DurationSequencer.shard` je nepromenjen (unija delova = svi fajlovi, `testSequencer.node.test.ts`); menja se
  samo broj delova (6 → 8) i tabela težina. Nijedan test nije obrisan, preskočen ni ređe uzorkovan; nivo i uzorci isti.
- v1 posao: ista komanda kao pre (`npm run test:v1`); trči u svakom slučaju u kome je trčao ranije.

## 4. Dokaz ispravnosti izbora

- Tabela slučajeva (`ciScope.node.test.ts`, veštačko stablo): jedna distanca, dve distance, ekran, ekran u grafu
  aplikacije, bazna linija (fs), niska sa `${…}`, fajl van domena koji test čita, nov/obrisan fajl, E2E spec → tačan
  skup; zajednički (`src/test`, workflow, `docs/qa`, lock, `web/scripts`, zajednički domen, koren `generators/*.ts`, v1
  kod, nepoznata distanca, nepoznat fajl u `web/`, mešano) → sve; samo dokumentacija i `.claude/` → ništa; main → sve.
- Stvarno stablo: nijedan test sa dometom „sve"; `process.cwd()` moduli = pregledan spisak; svaki fajl tabele trajanja
  je test fajl, 46 u v1; HM v2 → svi HM testovi (van v1), nijedna mreža maratona; HM bazna linija → bez E2E.
- Nadskup grafa vitest-a: `vitest list --filesOnly --changed` uz privremen komentar u fajlu, poređeno sa izborom, za 40
  izvornih fajlova (10 izabranih + 30 nasumičnih, `shuf`): u svih 29 slučajeva režima `select` 0 fajlova koje vitest
  bira a izbor ne (izbor bira više: fajlove koji čitaju kroz fs/`cwd`); 11 slučajeva su `all` (domen van v2).
  Skripta: `scratchpad/cmp.mjs` (nije u repou; komanda se ponavlja `node cmp.mjs <fajlovi>` iz `web/`).
- Lanac: TEST-SPEED § 13.3.

## 5. Sabotaže dometa na CI-ju

| proba | push | očekivano | dobijeno (posao `scope`) |
|---|---|---|---|
| (a) komentar u `fiveK/v2/dates.ts` (umesto HM: P1 radi u HM v2) | `122548f`, run 767 | 5K testovi i oni koji ih uvoze, bez mreža drugih distanci, E2E da | `select`: 186 web fajlova (3 dela), 0 mreža `tenK/HM/MAR v2`; v1 43 (tada još graf; posle odluke v1 ne trči na v2) |
| ekran: komentar u `PlanOverview.tsx` | `4f4033a`, run 768 | njegovi UI testovi + čitači `web/`, E2E, bez mreža | `select`: 20 web fajlova (1 deo), v1 ništa |
| (b) komentar u `web/src/test/level.ts` | RUN769_SHA, run 769 | sve | RUN769_B |

Komentari (a) i ekran su vraćeni u RUN769_SHA (poruka `4f4033a` kaže „vraćen komentar u fiveK/v2" — netačno: posle
`git pull` je `HEAD~1` bio commit dokumentacije, pa je `4f4033a` čista proba ekrana; vraćanje je u RUN769_SHA).
Komentar (b) ostaje (dokumentuje pravilo).

## 6. v1 kad nestane (V1b)

Run 764: posao `web-test-v1` 11,0 runner-min (10,2 min testova + postavka), paralelno sa delovima. Kad v1 nestane:
−11 runner-min po run-u „sve" (≈ 12 % od ≈ 90); zid „sve" tada ograničavaju delovi web-test (run 766: 9,1 min posla).
Na push-u koji nije „sve" v1 ne trči ni sada → 0. Izbor gubi `V1_REFERENCE` (jedan spisak u `ciScope.mjs`).

## 7. Sabijanje lanca starih regresija — samo merenje (TEST-SPEED § 11.5)

CPU profil (`node:inspector` kroz privremen setup fajl, 1 radnik; nije u repou), udeo uzoraka čiji stek sadrži
`undo07|undoF1|oldText|before07|planHash06c|canon09|at7ba|at46e|atC13|atB9c|regress09|regressGroup09|changedOk|
regressionInputs`:

| distanca | brz nivo (fajlovi koji uvoze lanac) | pun nivo (jedan deo) | procena punog nivoa porodice |
|---|---|---|---|
| 5K | 30 fajlova, CPU 104,5 s, lanac 2,4 % | `segment08g.2.full`: 19,2 % | segment08g 346 s × 19 % ≈ 66 s |
| 10K | 38 fajlova, CPU 213,1 s, lanac 19,9 % | `earlyGrid.10.full`: 46,5 %; `repeatGrid.10.full`: 8,2 % | earlyGrid 1370 s × 46 % ≈ 640 s; repeatGrid 872 s × 8 % ≈ 70 s |
| HM | 12 fajlova, CPU 54,5 s, 0,0 % | `grid.2.full`: 0,0 % | ≈ 0 |
| maraton | 11 fajlova, CPU 48,2 s, 6,8 % | `grid.2.full`: 15,2 %; `dense.2.full`: 0 % | grid 230 s × 15 % ≈ 35 s |

Procena (mišljenje, ekstrapolacija sa jednog dela po porodici): ≈ 810 s od ≈ 10 150 s zbira punog nivoa bez v1 (≈ 8 %),
≈ 5 runner-min po run-u „sve"; skoro sve u 10K `earlyGrid`. Brz nivo: ≈ 50 s CPU od ≈ 420 s (10K 42 s). Nije urađeno.

## 8. Komande i trajanja (lokalno, 4 jezgra)

- `npx vitest run scripts/` — 33 testa, < 1 s (više puta).
- `npm run typecheck` 33 s; `npm run lint` 82 s; `npm run format:check` (oba prolaze).
- `TEST_FULL=1 TEST_V1=1 npx vitest list --filesOnly` (pre/posle) — po ~6 s.
- `vitest list --changed` poređenje: 10 fajlova 58 s, 30 fajlova ≈ 3 min.
- Profil lanca: brz 5K 41 s, HM 22 s, MAR 23 s, 10K 81 s zida; pun po jedan deo (6 fajlova) ≈ 6 min.
- `npm run check` (kraj, `b7690cd` pre push-a): 6 min 57 s; 341 fajl, 3844 testa, sve prolazi.
- Nije pokretano: `check:full`, pun nivo distanci, projekat v1 lokalno, sabotaže kroz `sabotage.mjs` (izmena ne dira
  pravila generatora).

## 9. Šta nije urađeno / otvoreno

1. „Sve" ≤ 9 min: run 766 9,4 min; posle odluke o v1 zid „sve" ≈ v1 posao (~10–11 min) dok v1 postoji. Posle V1b
   očekivano ≈ 9 min (delovi), ne izmereno.
2. Šum trajanja na CI-ju: isti fajlovi su između run-ova 765 i 766 imali do ±30 % po delu; tabela je prosek dva run-a.
   Bolja ravnoteža bi tražila više merenja (artefakti `test-durations-*` se skupljaju u svakom run-u „sve").
3. Graf je sopstveni parser (ne vitest), proveren kao nadskup na 40 fajlova; nov oblik čitanja fajla (npr. putanja
   iz promenljive van `import.meta.url`/`cwd`) bi ga zaobišao — test traži pregled svakog novog `process.cwd()` i
   `child_process`, ali ne može da vidi `readFileSync(promenljiva)` u modulu bez `import.meta.url`.
4. Poruka commita `ae02ebf` ima pogrešan ID sesije u redu `Claude-Session` (ispravno: `session_01GnHHiYGLZCDtpdHBNxXnfV`).
