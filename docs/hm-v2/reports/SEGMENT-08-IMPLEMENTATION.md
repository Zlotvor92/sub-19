# HM v2 — Segment HM-08 (hm-v2.6.0): pouka 37 — mešovita nedelja, ostatak do cilja (samo naniže)

Polazni SHA `e2e482e`. Prvi prolaz: STANI (`SEGMENT-08-STOP.md`). Odluke organizatora: **A** (dugi se ne skraćuje
radi ostatka), dugi ≥ lagan samo među preostalim danima, trkačka izuzeta, „cilj ≥ prethodna" van pouke 37; dopune:
zbir zaštićenih dana **po činjenicama** (5K-08i) i **kvalitet otpada samo kad time nedelja staje** (MAR-08).
Menjano: `halfMarathon/v2/**`, `docs/hm-v2/**`, 13 redova `HM v2 #0/#1` u `marathon/v2/app/byteSame.9443676.json`
(isti skup kao HM-07b). DECISIONS `P37-MIXED`.

## Uzrok → ispravka

| korak | strana (e2e482e)                                                                                                                                            | ispravka                                                                                                                                                                                                                                                                                                             | test                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1     | `construct` sastavlja nedelju na cilj kao da je cela slobodna; `writtenDays` menja zaštićene datume upisanim → planirano = cilj + (zaštićeni − sastavljeni) | `week.remainderWeek` (jedino mesto): okidač zaštićeni (po činjenicama) > sastavljeni za te datume i zaštićeni + preostali > cilj + 0,1; preostali na ostatak: lagani do 4 km (≤ sastavljen, ≤ preostali dugi), pa Q2, pa Q1 → lagan samo ako time staje; dugi i test ostaju; ne staje → lagani 4 km, kvalitet ostaje | `segment08` primer, mreža             |
| 2     | zbir zaštićenih po planu — neodrađen dan „jede" cilj                                                                                                        | `week.keptSum100` (jedna funkcija): pauza 0, upisani km (completed = false → 0), ostali po planu; `adapt.factKmOf` → `adaptation.factKm` (samo razlike); `written` označava takvu nedelju mešovitom                                                                                                                  | `segment08` pauza 20                  |
| 3     | validator mešovitu nedelju proverava samo po danu                                                                                                           | `MIXED_WEEK_OVER` (upozorenje) kad `mixedMin100` > cilj, inače `MIXED_OVER_TARGET` (greška); ista funkcija i zbir kao konstruktor                                                                                                                                                                                    | `segment08` validator                 |
| 4     | urađen dan posle asOf nije zaštićen u validatoru                                                                                                            | `adaptation.doneDayIds` (kao MAR-07b / 10K-06f)                                                                                                                                                                                                                                                                      | `segment08` samo naniže               |
| 5     | —                                                                                                                                                           | `adaptInvariants`: mešovita (po činjenicama) ≤ cilj ili upozorenje; dugi ≥ lagan među preostalim                                                                                                                                                                                                                     | mreža                                 |
| 6     | —                                                                                                                                                           | `hm-v2.6.0`, `KNOWN_VERSIONS` ∪ hm-v2.5.0                                                                                                                                                                                                                                                                            | policy, app, adaptFlow, handoffTarget |

Pauza: vlasnik CILJA nedelje pauze je `volume` (`pauseRemainder`), pouka 37 samo raspoređuje dane unutar njega — ne
sudaraju se. Višak (A6) menja cilj SLEDEĆE nedelje, upisani km iznad plana skraćuju preostale dane TEKUĆE.

## Merenje pre (e2e482e, worktree) → posle (iz `web/`, HM)

| merenje                                                                           | pre                         | posle                                                                       |
| --------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------- |
| `mixed-deload.ts`: planirano > cilj / tokova                                      | 291 / 449 (+3,66, max 9,98) | **19 / 449, svih 19 sa MIXED_WEEK_OVER** (+3,32, max 6,56; kvalitet ostaje) |
| isto: „rasterećenje nije niže od prethodne"                                       | 184                         | 118 — u svih 118 CILJ ≥ planirano prethodne (van pouke 37)                  |
| `fatigue-monday.ts` / `fatigue-repeat.ts HM end` / `locked-result.ts HM`          | 206+34 / 777: 0 / 1916: 0   | isto                                                                        |
| `start-day.ts HM 25` / `fatigue-testweek.ts HM 25` (odbijeno, inv)                | 34 170: 0 / 3556: 0         | isto                                                                        |
| `early.ts HM 193 97 29` (odbijeno / common / inv / none≠gen)                      | 114 012: 0 / 0 / 0 / 0      | isto                                                                        |
| mreža kao skripta (`net.ts`, svaki 4. plan, 5237): mešovita > cilj bez upozorenja | 3374                        | **0** (1278 sa upozorenjem)                                                 |
| isto: inv „dugi < lagan" / odbijanja „dva testa" (TEST)                           | 26 / 38                     | 0 / 38 (isti tokovi — HM-08b, K1)                                           |

## Regresija (`reg37.ts`, `cmp37.ts`, `cls.ts`; heš bez napomena, upozorenja, policyVersion)

Generator 25 122: 0 promena. Odbijanja 0 → 0 svuda. Rana 4a 114 012 (`cls-early.txt`; meta = samo
`adaptation.mixedWeeks/factKm`, dani isti):

| scenario                    | meta               | dani            | cilj | uzrok                                                                                                                    |
| --------------------------- | ------------------ | --------------- | ---- | ------------------------------------------------------------------------------------------------------------------------ |
| pause10 / chain             | —                  | 1867 / 1867     | —    | dani posle pauze bez zapisa = planirani (pravilo) → stisnuto                                                             |
| pause20 / under50 / pain8   | 2849 / 2849 / 1603 | 0               | —    | pauza 0 / upisani km / bol bez trčanja 0 → **više nije stisnuto**                                                        |
| pause35 / painPause / pain5 | — / 1561 / 1603    | 1280 / 314 / 12 | —    | ostatak                                                                                                                  |
| fatigue                     | 2010               | 160             | —    | upisani km zapisa umora (6) ≠ plan                                                                                       |
| over120                     | 453                | 2371            | 25   | upisani km 1,2 × → kraći preostali; Q2 otpada → T progresija kasni → taper T niži → trkačka +0,4 (d5-11w-60km-v60-A-sat) |
| chain/2                     | 1361               | 1649            | 258  | A2 manjak pre, ne posle (svih 258, `chain334.ts`): 11,58 / 20,59 = 0,56 → 11,58 / 18,70 = 0,62                           |

Stisnuto (dani) bez činjenica → sa činjenicama (`cls-early-bez-cinjenica.txt`): pause10 2450 → 1867, pause20 2221 →
0, chain 2450 → 1867, chain/2 2450 → 1907, painPause 614 → 314. Ciljana 16 275: pain5 3092 meta + 4 dani. Opcija B
(odbačena): cilj u 1458 tokova, vrh do −22,1 km (`cmp-B-*.json`).

## Sabotaže (`web/scripts/sabotage.mjs`, `--bail=1`, brz nivo) — 5/5 palo, `src` vraćen (`sabotage-08.result.json`)

08-a ostatak se ne računa · 08-b ostatak i naviše · 08-c validator ne čita `mixedMin100` · 08-d mreža bez mešovite
nedelje · 08-e zbir po planu umesto po činjenicama. Novi testovi padaju na e2e482e (primer: 24,32 > 21,3).

## Trajna mreža (`segment08.harness`)

Rana mreža × k ∈ 2 … N − 3 × asOf svaki dan nedelje k (umor kraj k − 1) + zaključan Q i urađen dan k + 1 (asOf

1. i 4. dan): 0 odbijanja (osim brojanih „dva testa"), `adaptInvariants` prazno, mešovita ≤ cilj ili upozorenje,
   mešovitih sa ostatkom > 0. Brz: svaki 60. plan; pun: svaki 8. plan u 6 delova (38–52 s).

## Komande (iz `web/`)

- `npx tsc -b --noEmit` 0 · `npx eslint src/domain/generators/halfMarathon/v2` 0 · `prettier --check` (v2, maraton app) 0
- `npm run check`: 299 fajlova / 3540 testova, exit 0 (679 s)
- `TEST_FULL=1 npx vitest run --changed e2e482e`: 211 / 1621, exit 0 (1614 s)
- pun nivo `halfMarathon/v2`: 59 / 383, exit 0 (984 s); brz nivo foldera 32 / 298 (79 s); segment08 delovi 38–52 s
- `npx playwright test e2e/hm-v2.spec.ts`: 3/3 · `marathon/v2/app/byteSame` (`BYTE_SAME_RECORD=1`): 13 redova HM v2
- merenja: `node <scratchpad>/org/{pre,post}-<skripta>.ts` (organizatorove skripte, samo HM; pre = worktree e2e482e)

## Stalni uslovi

1. Jedan vlasnik: `remainderWeek`; zbir `keptSum100`; minimum `mixedMin100` (konstruktor i validator); opcije
   redom. 2. Plafoni nedirnuti. 3. WU/CD nedirnuti. 4. Zaštita i činjenice unapred u konstruktoru (`Written`).
2. Handoff nedirnut. 6. `hm-v2.6.0`. 7. Bez uvoza van foldera. 8. Mreža: lagan ≥ 4 km, dugi ≥ lagan među
   preostalim, planirano ≤ cilj ili upozorenje.

K5 (organizator, `two-step.ts HM 193 97 29`, posle merge-a sa granom): inv 0 (na 46e72eb 12 / 20 672 „dugi < lagan",
plan > cilj bez upozorenja); preostalo 12 odbijanja TEST (zaključan test, K1 → HM-08b; `two-step-locked.after.json`).

## Otvoreno

- „Dva testa" (38 / 5237, pre-postojeće): zaštićen test + umor pomera test (A13) — HM-08b (K1).
- 1278 / 5237 nedelja mreže iznad cilja uz upozorenje (asOf kasno u nedelji).
