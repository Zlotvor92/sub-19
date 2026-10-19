# HM v2 — Segment HM-07b (hm-v2.4.1): pouka 36 precizno, zaštićeni dani u validatoru

Polazni SHA `16b8906` (HM v2 kod isti kao `afa1c46`). Menjano samo `web/src/domain/generators/halfMarathon/v2/**`,
`docs/hm-v2/**` i 13 redova `HM v2 #0/#1` u `marathon/v2/app/byteSame.9443676.json` (samo oznaka verzije). Uzor
maraton MAR-07 (`assess.fatigueWeek`, `steps.deloadWeekOf`) prepisan, ne uvezen. DECISIONS: `A5`, `F4a-N12`,
`HM07b-GUARD`.

## Tačke

| tačka            | uzrok (16b8906)                                                                                                                                                                          | ispravka                                                                                                                                                                                                                                                                        | test                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1 pouka 36       | `assess` A5: sidro iz zapisa služilo samo za „već u planu"; rasterećenje = prva PUNA nedelja posle asOf → zapisi u k − 1, asOf u nedelji k → k + 1 (ili ništa kad je k + 1 rasterećenje) | `assess.fatigueWeek` (jedino mesto): prva nedelja koja počinje posle poslednjeg zapisa umora; asOf u njoj → njen ostatak (prošli dani upisani). Korak nosi `deloadWeek` kad ≠ fromWeek; `steps.deloadWeekOf` čitaju `framesFor`, `newLimits`, validator; `adaptInvariants` isto | `segment07b` mreža + primer, `fatigueRepeat` |
| 2 zaštićeni dani | provera po danu (H10/H14, H11 ZONE_CAP) sudi i zaključan/upisan dan — zaključan Q1 posle novog rezultata nosi stari tempo (A1) → WARMUP/COOLDOWN → odbijanje                             | `validate.guarded` (jedno mesto: lockedDayIds ∪ datum ≤ poslednji asOf) — petlja H10/H14 i ZONE_CAP ga preskaču kao LIMITS; validator samo prijavljuje                                                                                                                          | `segment07b` mreža + primer                  |
| 3 verzija        | —                                                                                                                                                                                        | `hm-v2.4.1`; `KNOWN_VERSIONS` = hm-v2.3.0 ∪ hm-v2.4.0 ∪ tekuća                                                                                                                                                                                                                  | `policy.node`, `app.node`, `adaptFlow`       |

Umor pre starta (pouka 34): referenca nedelje 1 kad je nedelja umora 1 (`f === 1`, kao maraton), i kad asOf već pada
u nedelju 1 (zapisi pre starta, asOf prvi dan).

## Merenje pre (16b8906, worktree) → posle

| merenje                                                                                                               | pre                                   | posle                                 |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------- |
| probe umor (`artifacts/segment-07b/probe.ts`, svaki 97. ulaz × k ∈ {2, 4, N − 6}): tokova / odbijanja                 | 29 328 / 0                            | 29 328 / 0                            |
| rasterećenje van nedelje k (asOf poslednji zapis … kraj k, oba zapisa u prozoru A5)                                   | 5698 / 20 202                         | 0 / 20 202                            |
| isti zapisi: poslednji dan k − 1 vs prvi dan k — različito od drugog dana nedelje k                                   | 2590 / 2590                           | 15 / 2590 (*)                         |
| probe rezultat + zaštićen dan: (a) zaključani Q1+Q2, (b) samo Q1 nedelje k + 1, (c) lanac (a) + urađen Q1 — odbijanja | 2978 / 3336 (c nedostupan)            | 0 / 4617                              |
| fatigue-repeat.ts HM (sredom) / HM end — drugo rasterećenje / odbijeno drugi                                          | 0 / 0 · 0 / 0 (777)                   | 0 / 0 · 0 / 0 (777)                   |
| early.ts HM 193 97 29: planova / tokova / odbijanja / zajedničke / invarijante / 'none' ≠ gen                         | 212 / 114 012 / 0 / 0 / 0 / 0 (HM-07) | 212 / 114 012 / 0 / 0 / 0 / 0 (779 s) |
| fatigue-monday.ts HM (organizator; zapisi pet/ned, asOf prvi dan nedelje): tekuća+0 / tekuća+1 / bez novog (240)      | 0 / 120 / 120                         | 206 / 0 / 34 (**)                     |
| locked-result.ts HM (organizator; rezultat kraj k + zaključan Q1 k + 1): odbijeno / tokova                            | 1677 / 1916                           | 0 / 1916                              |

(*) Svih 15 su parovi gde rasterećenje menja prvi dan nedelje k (u adaptaciji tog dana upisan stari dan, npr. dugi
12,1 umesto 8,6 km → kasniji dugi po pouci 28 iz upisanog); takvih parova 1815, sa istim prvim danom razlika 0.
(**) Svih 34: tekuća nedelja je već redovno rasterećenje (A5).
Pre: primer `segment07b` (zapisi pretposlednji/poslednji dan k − 1, asOf prvi dan k, k + 1 redovno rasterećenje) —
umor se GUBIO (`deload: false`).

## Regresija (`artifacts/segment-07/regress.ts` + `compare.ts`, heš bez oznake verzije; `regress-summary.json`)

| skup                                                | tokova  | promena sadržaja | promena napomena | odbijanja pre → posle |
| --------------------------------------------------- | ------- | ---------------- | ---------------- | --------------------- |
| generator R/F/B                                     | 25 122  | 0                | 0                | 0 → 0                 |
| rana 4a (193/97/29, svi asOf, 17 scenarija + lanac) | 114 012 | 0                | 0                | 0 → 0                 |
| ciljana 4a                                          | 16 275  | 0                | 0                | 0 → 0                 |

Menjaju se samo tokovi tačke 1 (zapis umora i asOf u različitim nedeljama — rana/ciljana mreža ih nema: zapisi
asOf − 1/− 3 sredom/krajem nedelje) i ranije odbijeni tokovi tačke 2; nijedan drugi. Mreža pouke 28 (`recent`) nije
merena posebno: generator nedirnut (guarded je prazan bez koraka), skup generatora 0 promena.

## Sabotaže (`web/scripts/sabotage.mjs`, `--bail=1`, brz nivo) — 3/3 palo, 8,9 s, `src` vraćen (heš isti)

Ulaz `artifacts/segment-07b/sabotage-07b.json`, rezultat `sabotage-07b.result.json`: (a) sidro umora iz asOf 3,1 s;
(b) provera po danu bez preskakanja zaštićenih 2,9 s; (c) validator čita fromWeek umesto deloadWeekOf 2,7 s — sve
`segment07b` mreža. Novi testovi padaju na 16b8906 (3/3: mreža, primer pouke 36, zaključan Q1).

## Komande (iz `web/`)

- `npx tsc -b --noEmit` 0; `npx eslint src/domain/generators/halfMarathon/v2` 0; `prettier --check` (v2, segment-07b) 0.
- `npm run check`: exit 0 — 287 fajlova / 3432 testa (294 s)
- `TEST_FULL=1 npx vitest run --changed 16b8906`: exit 0 — 200 fajlova / 1549 testova (904 s; uključuje segment07b, fatigueRepeat)
- Pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/halfMarathon/v2`: exit 0 — 51 fajl / 352 testa (531 s)
- Brz nivo `halfMarathon/v2` sam na mašini: 29 fajlova / 272 testa, 41,1 s zid (≤ 60 s; segment07b 3,7 s)
- `npx playwright test e2e/hm-v2.spec.ts`: 3/3 (29,5 s)
- `marathon/v2/app/byteSame` posle zapisa (`BYTE_SAME_RECORD=1`): 2/2; izmenjeno 13 redova `HM v2 #0/#1`, nijedan drugi.

## Stalni uslovi

1. Jedan vlasnik: nedelja umora (`fatigueWeek`), čitanje (`deloadWeekOf`), zaštićen dan (`guarded`); bez petlji.
2. Plafoni nedirnuti. 3. WU/CD nedirnuti (zaštićen dan zadržava svoje). 4. Uslovi unapred u konstruktoru (korak
   nosi nedelju umora); validator ne sudi činjenicama. 5. Handoff nedirnut. 6. `hm-v2.4.1`, faza iz okvira. 7. Bez uvoza
   van foldera (isolation prolazi). 8. Mreže: 0 odbijanja, prošlost upisana.

## Otvoreno

- Plan prvog dana nedelje k ≠ plan poslednjeg dana k − 1 kad rasterećenje menja upisan prvi dan (15 / 2590): posledica
  „prošli dani zaštićeni" — po odluci, ne menjano.
