# 10K v2 — Segment 10K-07 (10k-v2.9.0): ispravke posle dubinske provere v2

Polazni SHA `c13c258` (kod 10K = `670700e`). Zaključan spisak: `docs/generators-v2/audit/fixes/00-common.md` (Z1–Z5),
`fixes/10K.md` (stavke 1–9) i dopuna `fixes/01-chains-addendum.md` (Z6–Z8, C3, C7, C8). Menjano `tenK/v2/**`,
`docs/10k-v2/**`; izuzeci (kao 06f–06i): oznaka verzije u `e2e/tenk-v2.spec.ts` i
`features/onboarding/tenKV2Flow.test.tsx`. Verzija politike 10k-v2.8.1 → **10k-v2.9.0** (DECISIONS A23; D8, D22, D25
dopunjeni; `app/plan.ts` KNOWN_VERSIONS ∪ 10k-v2.8.1).

## Stavke

| stavka | ispravka (jedan vlasnik) | test (pada pre / prolazi posle) | merenje pre → posle |
| --- | --- | --- | --- |
| 1 / Z4 vraćanje revizije (O-3) | `app/adapt.ts restoreMerge`: odluke sačuvane verzije (ulaz, koraci) + prošlost trenutnog plana → `adaptTenKV2` (writtenWeeks + validatePlan); ne prolazi → odbijanje sa porukom, plan ostaje; provera i datuma plana | `app/restore.node.test.ts` (d3-r-10w iz nalaza; neposredno poništavanje) | `owner/tenK-restore.ts` 2 880: vraćen plan krši validator **1 207 → 0**, sledeća adaptacija odbijena **172 → 0**; odbijena vraćanja 0 → **172** (sve: „posle nje je plan prilagođen…"; fatigue 52, pause10 72, pause20 24, pain5 24 — jezgro iz koraka verzije i upisane prošlosti ne gradi ispravan plan: doza/obim posle pauze/umora). Neposredno poništavanje (isti dan, bez novih zapisa): **2 040 / 2 040 prolazi**, validator 0, sledeća adaptacija 0 odbijena |
| 2 / Z5a | `app/handoffTarget.targetInput`: rezultat distance van `P.input.resultDistancesM` se ne prenosi → plan po osećaju (lak tempo izvora); bez lakog tempa EASY_PACE_REQUIRED doslovno | `handoffTarget.node.test.ts` 10K-07 Z5a | MAR maraton rezultat: odbijanje → plan |
| 3 / Z5b (app A1) | početnik izvora sa obimom iznad reda D28 (`policy.kmFit`, ista funkcija kao ulaz) → bez oznake početnika | `handoffTarget.node.test.ts` Z5b (MAR v2 početnik 45 km, 4 d, 10 km 46:00): ponuda 10K v2 postoji, plan `regular`; 35 km ostaje početnik | WEEKLY_KM_TOO_HIGH → plan |
| 4 M4 | `workouts.sharpenerWarmupCooldown` = WU/CD trke 15 + 10 min (D8), konstruktor i validator | `week.node.test.ts` WU/CD | `coach-5k-10k/measure.ts 10K 3 400` M4: oštrenje ≥ 1,5 × najduži lagan **6 516 / 9 950 (65 %) → 2 420 (24 %)**, max 4,5× → 3,28× (preostalo: 3 × 1000 m RP + oporavak sam po sebi) |
| 5 F3 | `validate.ts` D25: dan testa u svakoj nedelji izgradnje (i rasterećenju) + kvalitet u ne-rasteretnoj | `feelGrid` (invarijanta D25_EXACT, brojke 144/228/204/294) | `fuzz.ts 10K 20261023 0 100000`: test duži od dugog bez upozorenja **1 496 (487 baza + 1 009 rasterećenje) → 0**; B 0; greške validatora 0 |
| 6 O-1a/O-1b | `policy.kmFit` / `daysForKm` (sirov obim) — ulaz (`input.ts`), D22 `capacityMessage` (više dana samo za redove koji podržavaju obim), D25 `fewerDaysAdvice` | `volume.node.test.ts` D22/D25 (40,04 km) | `owner/tenK-advice.ts`: (a) preporuka manje dana odbijena ulazom **28 / 8 220 → 0 / 8 204**; (b) CAPACITY_LIMITED preporuka vodi u odbijanje **930 / 6 708 → 0 / 6 624** |
| 7 app A2 | uvod: „Uvod: k. od N nedelje uvoda bez kvaliteta…" (nije broj kalendarske nedelje) | `beginner.node.test.ts` | — |
| 8 Z1 | `week.recordedExcessKeepsQuality` (konstruktor `mixedRemainder` i validator MIXED_OVER_TARGET): jedini uzrok upisani višak (sa planiranim zaštićenim kvalitet staje, sa upisanim ne — isti kriterijum kao konstruktor) i planirano sa kvalitetom ≤ 1,10 × cilj → kvalitet ostaje, lagani na minimumu | `mixedZ1.node.test.ts` (d3-18w-20km-v50-A-sun over120 2026-11-10) | `consistency/mixed-drop.ts 10K 97` (43 740 tokova): otpao kvalitet over120 **1 741 → 284**, od toga uz višak ≤ 10 % **1 349 → 0** (preostalih 284: višak > 10 %) |
| 8 Z2 | `app/format.userText` (jedino mesto, app sloj: fokus nedelje, „Na šta da paziš", ocena cilja, razlozi, odbijanja, traka): bez oznaka D/A/H/M/F, „pouka N", „segment N"; decimalni zarez; km ≤ 1 decimala; bez „..". Plan jezgra (`tenKV2`) zadržava oznake (validator ih čita) | `app/userText.node.test.ts` (mreža + adaptacija) | „traži 0.3 VDOT" → „traži 0,3 VDOT" |
| 8 Z3 | `assess.resultVdotUsable` (jedina definicija VDOT 30–80) — assess i Forma | `app/form.node.test.ts` Z3 (5 km 31:46) | Forma: „čeka prilagođavanje" → „ne menja tempo (VDOT van 30–80)" |
| 9 owner K | `isolation.node.test.ts v2Edges`: alias `@/…/tenK/v2` i dinamički uvoz | isti fajl | — |
| Z6 (C1) | LIMITS (i oštrenje na dan zabrane) preskače `protectedDay` (≤ asOf, zaključan, urađen) | `chains07.node.test.ts` i=204 | lanci (dole) |
| Z7/Z8 (C2/C6) | `assess`: manjak — `nothingNew` (od prethodnog koraka nema zapisa ni planiranog dana); umor — zapisi ≤ asOf prethodnog koraka su presuđeni (pouka 36). Bol je već vezan za zapise (pouka 18) | `chains07` i=529; `adaptFlow` (isti dan → „već u planu") | `idemp.ts 10K 20261023 0 2000`: same **656 → 3** (manjak 617 → 0, bol 93 → 0; preostala 3: pauza), next **271 → 2** (manjak 240 → 0, bol 67 → 0; preostala 2: pauza) |
| C3 | `steps.framesAndTest`: datum testa posle koraka se prenosi (zaštićen test ranijeg koraka ostaje test) | `chains07` i=218, i=1885 | IDEMP/NEXT_DAY odbijeno TEST **14 → 0** |
| C7 | upozorenje RACE_WEEK_OVER_TAPER_LOCKED: mešovita trkačka sa zaštićenim danom > taper | `chains07` i=5771 | lanci: trkačka > taper bez upozorenja 3 lanca → svi sa upozorenjem |
| C8 | upozorenje MIXED_OVER_TARGET za mešovitu nedelju pauze (vlasnik pravilo pauze) planirano > cilj | `chains07` i=664 | P37 iznad cilja bez upozorenja **9 → 0** |

Lanci `chains.ts 10K 20261023 0 2000` (pre: c13c258 u worktree-u, iste skripte): odbijenih realnih lanaca **91 → 0**
(REJECT LIMITS 87, IDEMP/NEXT_DAY TEST 14), IDEMP:WEEKS **429 → 3** (pauza), NEXT_DAY cilj pao > 10 % **5 → 0**,
P37 iznad cilja bez upozorenja **9 → 0**, buduća nedelja < 40 % cilja 30 → 30 (C11, nije nalaz).

## Zamrznuti otisci (stalni uslov: promena = objašnjena ispravka)

- Generisanje: normalizator `testInputs.undo07` vraća objašnjene promene u stari oblik (WU/CD oštrenja → pojas D14,
  planirano/cilj/nominalni trkačke, stavke `changes`; tekst uvoda, D25, saveta). Preostale razlike imaju uzrok
  `testInputs.cause07`. Izmereno prema c13c258 (stari kod u worktree-u, `cls.ts`): grid02 + po osećaju + početnik
  31 122 plana → **O-1b 930, F3 822, ostalo bajt-isto**; adaptacija 2 040 → **Z1 28, F3 37, ostalo bajt-isto**.
- Adaptacione mreže (grid04, E, R, start + 0): fixture `segment07.adapt-changed-c13c258.json` (tok → [heš na c13c258,
  uzrok]) kao 06f/06i; starije regresije porede stanje c13c258 (`atC13` u lancu `at46e`), `p07FlowErrors` proverava
  skup i uzrok. Brojevi (pun nivo, 135 276 tokova): grid04 241 (C8 159, F3 33, F3+C8 17, Z1 32), E 24 264 (C8 7 339, F3 9 879, F3+C8
  2 651, O-1b 1 739, O-1b+C8 2 551, Z1 105), R 961 (F3 247, O-1b 714), start + 0 4 456 (C8 2 160, F3 974, F3+C8 551,
  O-1b 178, O-1b+C8 593); **bez uzroka 0**. C8 = novo upozorenje mešovite nedelje pauze (plan isti, dodato upozorenje).
- `painGrid` I3: trkačka bol 8 − bol 5 ista dva toka, cilj niži za razliku WU/CD oštrenja.

## Testovi

- `npm run check` (typecheck, lint, format, brz nivo): jedini pad bio je `marathon/v2/app/byteSame` (13 redova „10K v2",
  upisani uz odobrenje organizatora, ostali redovi iz grane) → posle upisa `npx vitest run --changed 670700e`:
  **331 / 331 fajlova, 3 710 / 3 710 testova**.
- Brz nivo 10K: **39 / 39 fajlova, 410 / 410**. Pun nivo `TEST_FULL=1 … src/domain/generators/tenK`: 96 / 97 fajlova,
  732 / 733 — jedini pad (TEST_MOVED over120 1 → 0, posledica Z1) ispravljen i ponovo proveren.
- E2E `npx playwright test e2e/tenk-v2`: **3 / 3**.
- Dopuna T (02-text-addendum): „dugo trčanje", „tempo treninga i dalje zavisi od rezultata" (undo07 vraća tekst za
  stare otiske).

## run-all

`bash docs/generators-v2/final-check/run-all.sh /tmp/ra 4 '.*-10K'` + `summarize-all.py`: **14 poslova, nečistih 0**
(early 0/121 392, edges 0/19 200, last-weeks 0/93 192, locked-pause 0/34 944, result-pain 0/51 336, start-day 0/42 330,
two-step cum 0/143 616, handoff HM→10K 0/48 144, MAR→10K 0/38 352, locked-test 0/8 050, fatigue-* čisto). Pokrenuto
pre dopune T (samo tekst poruka).

## Sabotaže (`node scripts/sabotage.mjs ../docs/10k-v2/artifacts/segment-07/sabotage-07.json`, --bail=1)

17 sabotaža (stavke 1–7, Z1–Z3, Z6, Z7, Z8, C3, C7, C8): **17 / 17 pada** (Z8 posle dopune testa lancem 1855 —
prvo pokretanje 16 / 17); stanje `src` posle vraćanja bajt-isto.

## Primećeno, nije rađeno

- Pauza nije idempotentna (idemp same 3, next 2; IDEMP:WEEKS 3 lanca) — nije na spisku.
- K-1 (validator prepisuje formule konstruktora bez razilaženja) — nije na spisku.
- Vraćanje revizije posle pauze/umora: jezgro iz koraka verzije i upisane prošlosti ne gradi ispravan plan (172 / 2 880
  odbijeno uz poruku). Ako je cilj da i to prođe, potreban je zaseban segment (konstruktor sa korakom verzije nad
  prošlošću drugog plana).
- Z5a bez lakog tempa izvora: plan po osećaju traži lak tempo (EASY_PACE_REQUIRED doslovno); izvođenje lakog tempa iz
  maratonskog rezultata nije zapisana trenerska odluka.
