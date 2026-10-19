# 5K v2 — Segment 08g (5k-v2.8.0): Faza 4a N2–N4 + pouka 36

Polazni SHA `f4b257d`, grana `claude/generator-isolation-5k-10k-hm-marathon`. Menjano `web/src/domain/generators/fiveK/v2/**`
i `docs/5k-v2/**`; izuzeci: redovi „5K v2" u byteSame fixture-ima 10K/HM/maraton (§ 4) i oznaka verzije u
`features/onboarding/fiveKV2Flow.test.tsx` (kao 08e). Bez PR-a, mergea i deploya.

## 1. Nalazi, uzroci, ispravke

| nalaz | uzrok (strana) | ispravka | test (pada na f4b257d) |
|---|---|---|---|
| N2a TEST_WEEK u lancu pauza 10 → manjak | konstruktor: `steps.framesFor` računa test iz `periodize` i premešta ga samo prema asOf poslednjeg koraka — premeštanje iz koraka 1 se gubi, nedelja dobije oznaku bez testa | test iz upisanog plana (`steps.writtenTest`): urađen (zaštićen dan) ostaje u svojoj nedelji i nedelja ga nosi i kad sastavljeni ostatak nema test; neurađen polazi od nedelje prethodnog plana | `segment08g` N2a (f-d4-6w-30km-e420-0) |
| N2b BASE_R_DECREASE posle sporijeg rezultata | validator pogrešno primenjen (STANI → odluka D): (i) plafon R 2,34 < 2,40 km — konstruktor ne može da zadrži R; (ii) usponi po vremenu rastu (270 → 300 s), km procenjen tempom pada | provere progresije u jedinici doze (m / s; `validate.doseOf`): BASE_R_DECREASE, DOSE_PROGRESSION, BASE_PLATEAU (QUALITY_REPEAT već poredi strukturu); R sme da padne samo kad je plafon (`qualityBudgets`, isti kao konstruktor) ispod prethodne R → napomena u nedelji (`workouts.rDropNotes`) + upozorenje DOSE_DROPPED | `segment08g` N2b (i), (ii) + 2 negativna |
| N3 trkačka > taper | konstruktor (5K nije imao pouku 30) | `week.raceWeekRest` (jedino mesto): višak laganih → odmor (bol, pa najraniji); dan pred trku, oštrenje, trka ostaju; zaštićeni dani ulaze u zbir; polje `raceRest`; validator: RACE_WEEK_TAPER (greška), skraćena < 4 km → RACE_WEEK_SHORT | `segment08g` N3 (r-d3-9w-20km-v45-1: 9,3 → 6,6 ≤ 7,9) |
| N4 prošlost iz sastavljenih nedelja | konstruktor (`generate.ts` dugi/doza iz sastavljenih nedelja, `adapt.ts` gradi bez prethodnog plana) i validator (preskakao mešovite nedelje) | `written.ts` = jedino spajanje (adapt i konstruktor); konstruktor iz upisanih dana: dugi za trkačku, taper, test, stanje doze (doza samo kad su upisani dani kvaliteta = sastavljeni); validator ne preskače mešovitu nedelju — segment doze po DATUMU (`steps.doseResetDate`: pauza usred nedelje → nov segment od asOf + 1) | `segment08g` N4 (r-d3-13w, ned 7 I 2 × 700 → 2 × 600) + 3 provere validatora |
| pouka 36 drugo rasterećenje za iste zapise umora | konstruktor/assess: sidro po asOf | `assess.ts`: sidro = prva puna nedelja posle poslednjeg zapisa umora; rasterećenje od sidra do n je ovih zapisa → novo se ne pravi | `segment08g` pouka 36 (2 plana × asOf + 1 … + 7) |

Mešovita nedelja: nedeljne provere sopstvenog sadržaja (broj dana, budžeti, planirano/cilj) i dalje samo na nivou dana —
nedelja sadrži dane dva plana; provere zavisne od prošlosti (dugi prethodne nedelje za trkačku, lanac doze, test) je
čitaju. Pouka 30 se čita iz polja `raceRest` (odluka konstruktora), ne računa se ponovo u validatoru.

## 2. Merenje pre / posle

| merenje | f4b257d | 5k-v2.8.0 |
|---|---|---|
| `early.ts 5K 29 19 11` (194 plana, 75 456 tokova) | odbijeno 92 (TEST_WEEK 76, BASE_R_DECREASE 16), trkačka > taper 34 | **0 / 0**, prošlost 0, 'none' ≠ gen 0 (310 s) |
| `early.ts 5K 7 7 7` (541 plan, 208 206 tokova) | odbijeno 209 (TEST_WEEK 191, BASE_R 18), trkačka > taper 94 | **0 / 0** (852 s); generator odbija 4 ulaza i pre i posle |
| slower/faster/test5k, uzorak 7/7/7 | 18 / 34 701 BASE_R_DECREASE | 0 |
| `fatigue-repeat.ts 5K end` / sreda | 58 / 117 / 0 / 117 | 0 / 0 |
| trajna mreža 08g (104 800 tokova) | odbijeno 399, novo rasterećenje za iste zapise 2960 | 0 / 0 |

## 3. Regresija

- Generator bez činjenica: bajt-isti za svih 3816 ulaza mreže (heš bez oznake verzije); `segment07` heševi bez izmene.
- Trajna mreža prema f4b257d (`segment08g.early-hashes-f4b257d.json`): promenjeno 4067 / 104 800 — R ranije odbijen 399,
  F ponovljen umor 2960, N4 673 (konstruktor sa upisanim danima ≠ bez njih), N3 34, C 1 (drugi korak lanca posle N4).
  **Bez razloga: 0.** Svi ostali tokovi bajt-isti (zbir po planu, uključujući upozorenja).
- 08e (51a924f): promenjeni samo tokovi porodice N3/N4/F (`testInputs.family08g`) — uska 75 (N3/N4), šira 61 (7 N3/N4 +
  54 F: zapisi umora iz prethodne nedelje, sidro = tekuća nedelja koja je već rasterećenje → novo se ne pravi,
  npr. `v45-d4-22km-10w`, asOf 18. 11.); 08d, P, pain: bez promene.
- Jedinica doze (N2b-ii): 0 prihvaćenih tokova postalo odbijeno ili dobilo novo upozorenje (svi heševi van spiska isti).

## 4. byteSame (samo redovi „5K v2", oznaka verzije)

`tenK/v2/app/byteSame.068410b.json` 19, `halfMarathon/v2/app/byteSame.28da6af.json` 13, `marathon/v2/app/byteSame.9443676.json`
13 redova; svi ostali heševi isti (`git diff` bez ijednog reda van „5K v2"). `personalPlan.node.test.ts` nediran, prolazi.

## 5. Trajna rana mreža

`segment08g.harness.node.test.ts`: uzorak Faze 4a (194 plana) × asOf start − 6/− 3/− 1, sreda i kraj ned 1 … N − 2 × 17
scenarija + drugi korak lanca + isti umor asOf + 1 … + 7. Po toku: 0 odbijanja, `earlyChecks` (Uslov 8), 'none' = generator,
0 novih rasterećenja za iste zapise, regresija prema f4b257d sa razlogom (R/N3/N4/C/F, nezavisno proverenim). Brz nivo
(`segment08g.grid`): 5 planova imenovanih primera — 11 s; pun: 4 dela po planu (`segment08g.{2,3,4}.full`).

## 6. Sabotaže (`node scripts/sabotage.mjs ../docs/5k-v2/artifacts/segment-08g/sabotage-08g.json --parallel 2`)

| # | sabotaža | ishod | prvi pali test | trajanje |
|---|---|---|---|---|
| 1 | 08g-1 premeštanje testa se gubi (test iz periodize, ne iz upisanog plana) | PAO | `segment08g.grid.node.test.ts` — 5 planova: 0 odbijanja, Uslov 8, 'none' = generator, regresi | 11 s |
| 2 | 08g-2a validator poredi km umesto jedinice doze | PAO | `segment08g.node.test.ts` — (i) plafon dozvoljava prethodnu R, a R padne → i dalje BASE_ | 11.2 s |
| 3 | 08g-2b izuzetak R bez provere plafona | PAO | `segment08g.node.test.ts` — (i) plafon dozvoljava prethodnu R, a R padne → i dalje BASE_ | 11 s |
| 4 | 08g-2c konstruktor bez DOSE_DROPPED | PAO | `segment08g.node.test.ts` — (i) r-d5-14w-60km-v32-1, sreda ned 3: plafon R 2,34 km < 2,4 | 11.4 s |
| 5 | 08g-3 trkačka nedelja bez pouke 30 | PAO | `segment08g.grid.node.test.ts` — 5 planova: 0 odbijanja, Uslov 8, 'none' = generator, regresi | 11 s |
| 6 | 08g-4 stanje doze iz sastavljene umesto upisane nedelje | PAO | `segment08g.grid.node.test.ts` — 5 planova: 0 odbijanja, Uslov 8, 'none' = generator, regresi | 11.3 s |
| 7 | 08g-5 validator preskače mešovitu nedelju (lanac doze) | PAO | `segment08g.node.test.ts` — isti par kvaliteta posle mešovite nedelje → QUALITY_REPEAT | 11.5 s |
| 8 | 08g-6 umor vezan za asOf (pouka 36) | PAO | `segment08g.grid.node.test.ts` — 5 planova: 0 odbijanja, Uslov 8, 'none' = generator, regresi | 11.5 s |

Ukupno 8/8 PALO, 50.9 s zida (`--parallel 2`, brz nivo, `--bail=1`); stanje `src` isto pre i posle. Rezultat: `artifacts/segment-08g/sabotage-08g-result.json`.

Nije sabotirano: dugi trkačke nedelje iz sastavljene umesto upisane nedelje — u mreži nema toka gde se upisani i sastavljen
dugi tapera razlikuju (pretraga sa zaključanim dugim tapera, bol 5 / brži rezultat: 0), pa ga nijedan test ne bi uhvatio.

## 7. Komande (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check .` | exit 0 |
| `npm run check` | exit 0 — 282 fajla, 3401 test, 414 s |
| `TEST_FULL=1 npx vitest run --changed f4b257d` | exit 0 — 174 fajla, 1807 testova, 638 s |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 22 fajla, 675 / 675, 242 s |
| `npx vitest run --project node …/segment08g.grid.node.test.ts` (brz) | 1 / 1, 11 s |
| `npx playwright test e2e/fivek-v2.spec.ts` | 3 / 3, 52 s |
| `BYTE_SAME_RECORD=1 … byteSame.node.test.ts` (10K, HM, maraton) | samo redovi „5K v2" (§ 4) |
| `node ../docs/generators-v2/final-check/early.ts 5K 29 19 11` / `7 7 7` | § 2 |
| `node ../docs/generators-v2/final-check/fatigue-repeat.ts 5K [end]` | 0 / 117 |
| `node docs/5k-v2/artifacts/segment-08g/early-hashes-08g.ts <koren> <izlaz>` + `why-08g.ts` + `fixture-08g.py` | fixture regresije (iz korena repoa) |

## 8. Stalni uslovi (AGENTS.md 1–8)

1. Jedan vlasnik: prošlost — `written.ts`; test — `steps.writtenTest`; segment doze — `steps.doseResetDate`; trkačka ≤ taper —
   `week.raceWeekRest` (validator čita `raceRest`); plafon R — `qualityBudgets` (konstruktor i validator); umor — `assess.ts`.
   Validator samo prijavljuje; bez petlji.
2. Jedan plafon po zoni: R plafon je postojeći budžet (5 % cilja), bez novog.
3. WU/CD nedirnuti; višak trkačke nedelje ide u odmor, ne u WU/CD.
4. Zaštita dana (≤ asOf, urađeni, zaključani) je poznata unapred i ulazi u konstruktor (`prior`); završna zaštita samo proverava.
5. Handoff: bez izmene.
6. Plan nosi `5k-v2` / `5k-v2.8.0`; KNOWN_VERSIONS = 2.6.0, 2.6.1, 2.7.0, 2.8.0 (test sačuvanog plana 2.7.0).
7. Izolacija: `isolation.node.test.ts` prolazi; `written.ts` uvozi samo iz `fiveK/v2/`; testInputs bez `Date`.
8. Upotrebljivost: trajna mreža i 4a/7-7-7 pretraga — 0 praznih treninga, dugi ≥ lagan, trkačka ≤ taper, prošlost bajt-ista.
