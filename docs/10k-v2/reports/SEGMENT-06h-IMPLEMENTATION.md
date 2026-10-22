# 10K v2 — Segment 06h (10k-v2.6.2): umor pre starta sa asOf = prvi dan plana

Polazni SHA `b8fcf22` (10k-v2.6.1). Tok: STANI (`SEGMENT-06h-STOP.md`, 213cb75) → odluka organizatora: **opcija A**
(ispravka ključa, 10k-v2.6.2, trajna mreža start + 0); tačka 1 „ostatak do cilja minus upisani dan" se NE radi u 06h —
organizator je izmerio da je to osobina svih distanci (nova pouka 37, zaseban segment po distanci, samo naniže).
Menjano: `tenK/v2/**`, `docs/10k-v2/**`; oznaka verzije u `e2e/tenk-v2.spec.ts` i `features/onboarding/tenKV2Flow.test.tsx`
(kao 06f/06g, bez toga pada provera verzije). byteSame drugih distanci: bez izmene (vidi Provere).

## Uzrok korak po korak | strana | ispravka | test
| korak | šta |
|---|---|
| 1 `assess` | asOf = start: r = 1, n = fromWeek = **2**; sidro umora (poslednji zapis + 1) = start → f = 1 → `deloadWeek` = **1** (pouka 36: ostatak tekuće nedelje) i `preStart` (f = 1). |
| 2 `steps.framesFor` | rasterećenje na `deloadWeekOf(s)` = 1 — ispravno. |
| 3 konstruktor | `volume.adaptVolume` i `generate.ctxAt` čitali `preStart` po **fromWeek** (2) → ned 1 rasterećenja bez reference (lastBuild i lastLong null) → `buildWeek` null za svaki cilj → **WEEK_INFEASIBLE** (validator nije dosegnut). |
| 4 validator | `validate.ts` isto po fromWeek (ista greška). |
| strana | ključ reference iz 06e (tada je nedelja rasterećenja uvek bila fromWeek); 06f je nedelju premestio u `deloadWeek`, `preStart` nije pratio. Sa start − 1 nema deloadWeek → isto. |
| ispravka | sva tri čitanja po `steps.deloadWeekOf(s)` — jedina definicija nedelje prinudnog rasterećenja (konstruktor 2 mesta, validator 1). |
| test | `fatigue.node.test.ts` 06h: primer `d3-8w-20km-v30-A-sat` (ned 1 rasterećenje cilj 16,0 kao start − 1, dan 1 dugi 9 km upisan, ostali dani i ned 2…N kao start − 1, planirano 17,8, adaptInvariants prazno) + uzorak 40 planova mreže 02; na b8fcf22 pada (sabotaža a). |

## Merenje (iz `web/`)
| | b8fcf22 | 10k-v2.6.2 |
|---|---|---|
| `fatigue-startday.ts 10K 25` | 1245/1245 odbijeno (start + 0) | **0** |
| `fatigue-testweek.ts 10K 25` | 86/6650 | **0** |
| `start-day.ts 10K 25` (17 scenarija + lanac, start + 0/+ 1) | 623 odbijeno | **0 / 42 330, adaptInvariants 0** |
| `fatigue-monday.ts` (10K) | tekuća 268, bez novog 28 | isto |
| `fatigue-repeat.ts 10K end` | 0/963 | 0/963 |
| `locked-result.ts 10K` | 0/1960 | 0/1960 |
| trajna mreža start + 0 (svi planovi mreže E × 8 scenarija) | 3084 odbijeno (svi umor) | **0 / 24 672** |

Posle ispravke start + 0 = start − 1 osim dana 1 (≤ asOf, upisan kakav jeste) u 1245/1245 (`artifacts/segment-06h/cmp.ts`):
nedelja 1 je rasterećenje 0,8 × planirana ned 1, referenca nedelja 1 generatora, doza ned 2 = planirana ned 1 (pouka 34).
Planirano ned 1 > cilj u 805/1245 (+ 2,46 km prosečno) — pravilo mešovite nedelje kao kod k ≥ 2 (DECISIONS A20, pouka 37).

## Regresija (heš bez oznake verzije)
- `artifacts/segment-06h/hash.ts` (svaki 40. plan R/F/B, asOf start − 6, − 3, − 1, + 0, + 1, + 2, + 3, + 6, + 7, + 9, + 14 × 17
  scenarija, lanac): 145 673 toka, promenjeno **779 = svi start + 0 umor, svi na b8fcf22 odbijeni**; drugih 0.
- Trajna mreža start + 0 (`startday-hashes.ts`, fixture `segment06h.startday-hashes-b8fcf22.json`): 24 672 toka,
  promenjeno 3084 (svi umor, ranije odbijeni); 21 588 prihvaćenih bajt-isto.
- Generator bez činjenica bajt-isti (ispravka je samo u čitanju koraka adaptacije; grid/feelGrid/beginnerGrid prolaze).

## Trajna mreža (`repeatGrid.harness.node.test.ts`, po obrascu 06g)
Nova mreža „06h": asOf = prvi dan plana (`testInputs.start0AsOf`, jedino mesto), `START0_SCENARIOS` = 7 scenarija mreže E
+ rezultat; po toku: 0 odbijanja, adaptInvariants prazno, prema b8fcf22 prihvaćeni bajt-isti, ranije odbijen samo
umor; umor = start − 1 osim dana 1; mreža proverava sama sebe (asOf = prvi dan plana). Pun nivo: svaki 2. plan u 16
delova (~9 s po delu); brz: svaki 60. plan (4,7 s). Mreža „isti umor + 1 … + 7" dobija i tok `start+0/fatigue`.
Puni delovi posle izmene: deo 1 75 s (testovi 0,1–22 s), deo 9 68 s (najduži test 20 s) — daleko od 120 s / 600 s i na CI.
Postojeći delovi `earlyGrid.<k>.full` traju ~278 s (beforeAll, deo 2, lokalno) — zato start + 0 NIJE dodat u earlyGrid
(nalaz za organizatora: na CI 2–3× sporiji to je blizu 600 s).

## Sabotaže (`artifacts/segment-06h/sabotage-06h.json`, alat, `--bail=1`) — 2/2 pale, `src` bajt-isti
- a: stara strana (preStart po fromWeek u volume/generate/validate) → `fatigue.node` 06h pada (WEEK_INFEASIBLE).
- b: trajna mreža bez start + 0 (asOf mreže = start − 1) → `repeatGrid.node` 06h pada (sama mreža hvata).

## Provere
`npx tsc -b --noEmit`, eslint, prettier (kod) — čisto; `npm run check` 297 fajlova / 3516 testova — posle upisa A20 u
spisak DECISIONS i 13 redova `10K v2 #0/#1` u `marathon/v2/app/byteSame.9443676.json` (samo oznaka verzije; ostali redovi
bajt-isti) oba fajla prolaze; `personalPlan.node.test.ts` netaknut. `TEST_FULL=1 npx vitest run --changed b8fcf22`
**238 fajlova / 2387 testova prošlo** (31 min 40 s; uključuje pun nivo tenK/v2). Brz nivo fatigue.node 2,2 s, repeatGrid.node
1 min 28 s. `npx playwright test e2e/tenk-v2.spec.ts` 3/3.

## Stalni uslovi 1–8
1. Jedno mesto: nedelja prinudnog rasterećenja `deloadWeekOf`; referenca `preStartRef` (assess je upisuje). 2. Plafoni
nepromenjeni. 3. WU/CD netaknuti. 4. Uslovi unapred kroz korak (deloadWeek, preStart). 5. Handoff nije diran.
6. `10k-v2.6.2`, faze iz generatora; KNOWN_VERSIONS + 6.1. 7. Nula novih uvoza van foldera (`volume.ts` → `steps.ts` je
u folderu; isolation prolazi). 8. adaptInvariants i trajna mreža: 0 odbijanja, bez praznih treninga, dugi ≥ lagan.
