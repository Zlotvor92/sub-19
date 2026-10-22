# Maraton v2 — Segment MAR-08 (marathon-v2.5.0): pouka 37 — mešovita nedelja, ostatak do cilja

Polazni SHA `46dff18`. Menjano samo `web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**`. Bez STANI;
tri dopune organizatora tokom rada primenjene (dugi se ne seče; zbir zaštićenih po činjenicama; kvalitet otpada samo
ako time staje). Pravilo: `policy.ts` DECISIONS **A11c**.

## Uzrok (korak po korak; `d3-12w-30km-v30-A-sat`, umor, asOf 2026-11-15 = dan 1 ned 3)

1. Pouka 36: prinudno rasterećenje = ned 3 (tekuća), cilj 25,4 km; dan 1 (dugi 16,8 km iz plana pre koraka) ≤ asOf → zaštićen.
2. `generate.construct` gradi CELU ned 3 na cilj 25,4 (dugi 12,7 + lagan 7,6 + T 5,12), kao da je nedelja slobodna.
3. `written.writtenDays` (A11) zamenjuje sastavljeni dan 1 zaštićenim (16,8) → planirano 29,52 > cilj 25,4.
4. Validator: mešovita nedelja preskače PLANNED_VS_TARGET (segment 04) — prekoračenje se nigde ne vidi.
Strana koja odstupa: konstruktor (vlasnik obima ne zna za zaštićene dane); validator ćuti na istom mestu.

## Ispravka | mesto | test

| ispravka | mesto | test |
| --- | --- | --- |
| Ostatak = cilj − zaštićeni dani (po činjenicama), samo naniže: lagani do 5 km (≤ preostali dugi), pa Q2/Q1 otpada samo ako time staje (MP 2 × 3000 m ostaje); dugi se ne seče; ne staje → kvalitet ostaje, MIXED_WEEK_OVER | `mixed.ts` (jedino mesto), `generate.ts` | segment08 (6) |
| Zbir zaštićenih po činjenicama (pauza 0, zapis = upisani km, neodrađen 0); plan nosi `adaptation.factKm` za validator | `mixed.factKmOf`, `adapt.ts`, `written.ts`, `types.ts` | segment08 |
| Nedelja ostatka pauze (pauseRemainder) ima svog vlasnika — pouka 37 se ne primenjuje | `mixed.pauseOwned` (konstruktor, validator, adapt) | pause-owner.ts |
| Validator: mešovita nedelja posle asOf, planirano (po činjenicama) > cilj → MIXED_WEEK_OVER ako `mixedRest` vraća iste dane, inače MIXED_OVER_TARGET | `validate.ts` | segment08 |
| Stanje doze iz upisanih dana kad kvalitet otpadne (inače SLOT_REPEAT kasnije) | `generate.ts` | mixedGrid |
| Nezavisna invarijanta (sopstveno pravilo činjenica); „dugi ≥ lagan" ne sudi urađen dan (kao zaključan, A11b) | `adaptInvariants.ts` | mixedGrid, earlyGrid |
| Trajna mreža `mixedFlows`: umor asOf svaki dan ned 2 … N − 3 + umor + zaključan/urađen prvi dan ned k + 1; 136 planova, 8 delova | `earlyGrid.harness`, `mixedGrid.*` | pun nivo |
| marathon-v2.5.0; KNOWN_VERSIONS = 2.3.1, 2.4.0, 2.4.1, 2.4.2, 2.5.0; DECISIONS A11c | `policy.ts`, `app/plan.ts` | policy, app, adaptFlow |

`segment08.node` primer pada na 46dff18 (`[easy 7,6] [q1 5,12]` umesto `[easy 5] [q1 5,12]`).

## Merenje (iz `web/`, 46dff18 → MAR-08)

| skripta | pre | posle |
| --- | --- | --- |
| `final-check/mixed-deload.ts` MAR | plan > cilj 426/613 (+4,24, max 11,91); ne niže od prethodne 277 | **78/613 (+2,56, max 6,05), svih 78 MIXED_WEEK_OVER**; ne niže 179 (178: sam cilj ≥ prethodna) |
| `fatigue-monday.ts` | 304: tekuća 281, bez novog 23 | isto |
| `fatigue-repeat.ts MAR end` | 990: 0 drugih, 0 odbijeno | isto |
| `locked-result.ts MAR` | 3078, 0 odbijeno | isto |
| `start-day.ts MAR 25` | 43 418 tokova | 0 odbijanja, inv 0 |
| `fatigue-testweek.ts MAR 25` | 4592 | 0 odbijanja, 0 dva testa |
| `early.ts MAR 193 97 29` | 164 394, 0 odbijanja, inv 0 | 0 odbijanja, inv 0, common 0 |
| `handoff/shorter.ts MAR 193 97 29` | 164 394 tokova, 3339 ponuda (583 dugi na plafonu trajanja) | isto (3339, 0 odbijanja) |
| `segment-08/pause-owner.ts` | — | 19 329 tokova pauze; 14 004 nedelje ostatka pauze sa zaštićenim danima; **0** bi bilo skraćeno |
| rana mreža (45 101) — nedelje sa skraćenim ostatkom | — | 599: 443 staje (116 uz odbacivanje kvaliteta), 156 ne staje (kvalitet ostaje) |

## Regresija (`segment-08/measure.ts` + `compare.ts`, heš bez oznake verzije)

| porodica | tokova | odbijeno pre/posle | mx pre | promenjeno (objašnjeno) | samo (b) factKm | MIXED_WEEK_OVER | promena cilja | neobjašnjeno |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| grid / recent / dense / feel / beg (generator) | 21 840 / 35 910 / 156 954 / 8190 / 1890 | 0 / 930 (isto) / 0 / 0 / 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| a04 (mreža 04) | 6236 | 0 / 0 | 218 | 1528 (1528) | 1480 | 21 | 0 | 0 |
| pre (pre starta) | 4050 | 0 / 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| early (rana, 182/78/42) | 45 101 | 0 / 0 | 9281 | 8117 (8117) | 8051 | 156 | 17 | 0 |
| wide (široka, 4 dela) | 267 927 | 0 / 0 | 30 671 | 36 356 (36 356) | 7683 | 1514 | 66 | 0 |

Zbir po činjenicama prema prvoj verziji ove izmene (zbir po planu, `m-plan-*`): rana 9215, mreža 04 170 tokova pauze/
lanca više nije stisnuto (neodrađeni dani pauze su u zbiru bili po planu); svi tokovi pauze su 0 km po činjenicama.

Klase promena (sve objašnjene, 0 odbijanja pre i posle): (a) mešovita nedelja posle asOf sa planirano > cilj pre
izmene (`mx`); (b) plan nosi `factKm` (zapis ≠ plan na zaštićenom danu, npr. zapisi umora 8 km). Promene CILJA
(rana 17, široka 66 — sve u (b): umor i višak izvršenja over120, zapis > plan): Q2 otpada jer time staje → doza ne napreduje (pouka 29) → cilj kasnije
izgradnje neizvodljiv → najbliži (M6), kaskada ± 1 km (`d4-23w-45km-v30-C-sat`); taper N−1 lagan na 5 km → lagan
trkačke ≤ lagan tapera (M8) → cilj trkačke 20,6 → 19,2 (početnik 5 d). Generatorske porodice bajt-iste.

## Sabotaže (`web/scripts/sabotage.mjs`, brz nivo, `--bail=1`, `--parallel 2`) — **5/5 palo**, 46,6 s, `src` vraćen

`artifacts/segment-08/sabotage-08.json`: 08a ostatak se ne računa; 08b ostatak i naviše; 08c validator ne čita istu
funkciju; 08e zbir po planu (ne po činjenicama); 08d = 08a samo nad `mixedGrid.node` (trajna mreža sama hvata).

## Komande (iz `web/`)

- `npx tsc -b --noEmit` 0; `eslint src/domain/generators/marathon/v2/` 0; `prettier --check` 0.
- `npm run check`: 298/300 fajlova, 2 pala van maratona pod opterećenjem (uporedo sa merenjima): `training/generator/
  audit.test.ts` timeout 5 s, `features/ti/ti.test.tsx` — pojedinačno 2/2 fajla, 43/43 prolaze (956 s).
- `TEST_FULL=1 npx vitest run --changed 46dff18`: 204/204 fajla, 1613/1613 testova (1941 s).
- Pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2`: 62/62, 453/453 (1706 s,
  uporedo sa shorter.ts); delovi mixedGrid 34–46 s (beforeAll; pod opterećenjem).
- Brz nivo foldera: 31/365, 77 s zid sam (polazni 46dff18 na istoj mašini 78 s; MAR-07c 55 s je mereno u drugom okruženju).
- E2E `npx playwright test e2e/marathon-v2.spec.ts`: 3/3 (72 s).
- Merenje: `segment-08/measure.ts <koren> <porodica> <k>/<m>` × {46dff18 worktree, MAR-08} + `compare.ts`;
  `segment-08/pause-owner.ts`; final-check skripte iz tabele (kopije sa korenom worktree-a za „pre").

## Stalni uslovi (AGENTS.md)

1. Jedno mesto: `mixed.ts` (ostatak, zbir po činjenicama, vlasnik pauze); validator i konstruktor ga čitaju. 2. Bez
novog plafona. 3. WU/CD netaknuti; manjak se ne nadoknađuje, višak → upozorenje. 4. Zaštićeni dani bajt-isti
(završna zaštita); činjenice poznate unapred ulaze u konstruktor (`prior.factKm`). 5. Predaja nepromenjena. 6.
marathon-v2.5.0. 7. Uvozi samo iz `marathon/v2` (isolation test). 8. Mreža: 0 odbijanja, lagani ≥ 5 km, dugi ≥ lagan
među preostalim danima, adaptInvariants prazno.

## Otvoreno

- „Rasterećenje nije niže od prethodne" 179/613: u 178 sam cilj rasterećenja ≥ planirano prethodne nedelje (izbor
  cilja, ne pouka 37).
- Dopune K4/K5 (two-step.ts) i K1/K3: MAR-08b.
