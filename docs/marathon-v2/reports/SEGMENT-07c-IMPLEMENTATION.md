# Maraton v2 — Segment MAR-07c (marathon-v2.4.2): umor u nedelji testa (pouke 23, 36)

Polazni SHA `a869e21`. Menjano samo `web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**`. Bez STANI.

## Uzrok (korak po korak; `feel-d5-18w-40km-e450-C`, umor, asOf 2026-11-30)

1. Plan: test 5 km u ned 5 (poslednja baze), na Q1 = ponedeljak 2026-11-30 = asOf. Zapisi umora 27. i 29. 11.
2. Pouka 36: rasterećenje = nedelja posle poslednjeg zapisa (29. 11.) = ned 5, tekuća; ponedeljak zaštićen (≤ asOf).
3. `steps.framesFor`: okvir ned 5 postaje rasterećenje → dan testa okvira (M16) prelazi sa Q1 na T slot (čet 3. 12.,
   posle asOf) → A13 „test posle asOf u prinudnom rasterećenju" → test premešten u ned 6.
4. Spajanje (A11) zadržava zaštićen ponedeljak sa testom → plan ima DVA testa (30. 11. i 7. 12.) → validator TEST
   (A13, M17) odbija. Validator sudi tačno; odstupa konstruktor: dan testa poredi iz NOVOG okvira, ne iz plana pre koraka.

Nije trenerska dilema: zaštićen dan se ne menja (A11), a drugi test validator ne dozvoljava; „premestiti/ukinuti"
važi samo za test POSLE asOf i to pravilo (A13) je nepromenjeno (kontrolni test: asOf nedelja → test se premešta).

## Izmena | mesto | test

| izmena                                                                                                                                                                                            | mesto                                                                  | test                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| Dan testa u planu pre koraka (`framesFor` nad koracima bez poslednjeg) ≤ asOf → test zaštićen: okvir posle asOf bez testa, bez premeštanja                                                        | steps.ts `framesFor` (konstruktor i validator)                         | segment07c (2: primer + kontrola) |
| Trajna mreža: `testDayFlows` — svi planovi po osećaju (8190) × umor na dan testa − 1, dan testa, + 1; i umor svaki ponedeljak ned 1 … N − 3 + svaki dan nedelje testa i pre nje (baze rane mreže) | earlyGrid.harness (pun: 4 dela, zaseban blok; brz: svaki 60. + primer) | earlyGrid                         |
| marathon-v2.4.2; KNOWN_VERSIONS = 2.3.1, 2.4.0, 2.4.1, 2.4.2; DECISIONS A13b                                                                                                                      | policy.ts, app/plan.ts                                                 | policy.node, app, adaptFlow       |

`segment07c.node` primer pada na a869e21 (TEST), kontrola prolazi i pre i posle.

## Merenje (a869e21 → 07c)

| merenje                                                                                                                                          | pre            | posle                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------ |
| `final-check/fatigue-monday.ts` MAR                                                                                                              | 1/303 odbijeno | 0/304                                |
| `segment-07c/fatigue-days.ts`: po osećaju + početnik (10 080) × umor asOf svaki dan ned 1 … N − 3 (1 084 860 tokova, od toga 154 980 ponedeljak) | 540 (TEST)     | **0**                                |
| `final-check/fatigue-repeat.ts MAR end`                                                                                                          | 0/990 (MAR-07) | 0/990 drugo rasterećenje, 0 odbijeno |
| `final-check/locked-result.ts MAR`                                                                                                               | 0 (MAR-07b)    | 0/3078                               |

Svih 540: 5 dana raspored C (Q1 ponedeljak), asOf = dan testa (420 bez rasterećenja pre nedelje testa, 120 sa njim);
3/4/6 dana i A/B: Q1 nije ponedeljak, pa rasterećenje iz zapisa ne pada na nedelju čiji je dan testa ≤ asOf.

Regresija (`segment-07/measure.ts` pre/posle + `segment-07c/compare.ts`, strogo: menja se samo tok sa umorom koji je
pre bio odbijen TEST): a04 6236, pre starta 4050, rana 45 101, široka 267 927 — **0 promenjenih**, 0 odbijanja
(`artifacts/segment-07c/compare-07c-result.json`). Generatorske mreže (02, M13a, gusta, po osećaju, početnik) nisu
ponovo merene: `framesFor` se bez koraka adaptacije ne poziva (generate.ts), izmena ne deluje.

## Sabotaže (`web/scripts/sabotage.mjs`, brz nivo, `--bail=1`) — 4/4 palo, 21,6 s, `src` vraćen

`artifacts/segment-07c/sabotage-07c.json`: (1) bez provere zaštićenog testa; (2) dan testa iz okvira posle koraka;
(3) test uklonjen i kad je posle asOf (kontrola A13); (4) = (1) samo nad `earlyGrid.node` (trajna mreža sama hvata).

## Komande (iz `web/`)

- `npx tsc -b --noEmit` 0; `eslint src/domain/generators/marathon/v2/` 0; `prettier --check` 0.
- `npm run check`: exit 0 — 288 fajlova / 3438 testova (246 s).
- `TEST_FULL=1 npx vitest run --changed a869e21`: 186 / 1528, exit 0 (1218 s).
- Pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2`: 48 / 410, prošlo (800 s).
- Brz nivo maratona v2: 28 / 337, 55 s zid (sam). E2E `e2e/marathon-v2.spec.ts`: 3/3 (39,5 s).

## Stalni uslovi

1. Jedno mesto: `framesFor` (konstruktor i validator ga zovu isto). 4. Završna zaštita samo štiti (zaštićen test ostaje).
2. `marathon-v2.4.2`. 7. Uvozi samo iz `marathon/v2`. 8. Mreža: 0 odbijanja, adaptInvariants prazno.
