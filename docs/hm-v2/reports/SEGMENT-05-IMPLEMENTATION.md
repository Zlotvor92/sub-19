# HM v2 — Segment HM-05: polumaraton v2 u aplikaciji iza prekidača (generisanje, čuvanje, prikaz, čarobnjak, sat)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `28da6af` (pre commita spojeno `227aaf0`: HM-04b,
MAR-04b, 10K 06e). Jezgro HM v2 (policy, konstrukcija, assess,
validate, adapt) nije menjano — verzija ostaje `hm-v2.3.0`; ovo je povezivanje po obrascu 10K 05 (ništa iz `tenK`/`fiveK`
se ne uvozi — kopija, AGENTS.md uslov 7).

## Prekidač (pouka 8)

- `domain/generators/flags.ts`: `HM_V2_SETTING = 'generatorV2HalfMarathon'`, `HM_V2_ENV = 'VITE_HM_V2'`, `hmV2Enabled`
  (isto pravilo kao 5K/10K: samo `true`; override `1`/`true` uključuje, `0`/`false` isključuje uvek), `hmV2ToggleVisible`
  (samo uz postavljen `VITE_HM_V2` ili administratoru). `generatorFlags(fiveK, tenK?, hm?)`: bez izvora HM polje `hmV2`
  izostaje (= isključen) — postojeći pozivi (5K/10K testovi, 10K byteSame) isti.
- `stores/generatorFlags.ts` (podešavanje + env, `useHmV2Setting`, `useHmV2ToggleVisible`); UI: Ti → Zone i postavke
  treninga → „Novi plan polumaratona pravi generator v2 (probno)" (`#set-hm-v2`). Uključen → samo NOV plan polumaratona.

## Rutiranje (`select.ts`)

- `generatorForPlan`: HM + `meta.policyId === 'hm-v2'` → `HALF_MARATHON_V2_GENERATOR`; `hm-v1`, `legacy-hm`, lični plan
  vlasnika i tuđa oznaka → `HALF_MARATHON_GENERATOR` (kao do sada). `KNOWN_VERSIONS = [HM_V2_POLICY.version]`
  (`hm-v2.3.0`; nova verzija politike iz HM-04b postaje jedina poznata bez izmene adaptera). Druga verzija ili bez nje →
  `unknown` → `null` → `UNKNOWN_POLICY` (test: `hm-v2.0.0`, `hm-v2.2.1`, `hm-v2.99.0`, bez verzije); tuđa distanca sa
  `hm-v2` → `null`. `generatorForNewPlan(21097.5, { hmV2: true })` → v2; postojeći plan se ne prebacuje.
- `preparationForPlan` (odluka o ograničenoj pripremi) ostaje samo HM v1 (HM v2 → `null`); predaja „kraća distanca"
  (`handoff.ts`, maraton → HM v1, HM → 10K v1) nije dirana (faza 3, test).
- Novo: `HALF_MARATHON_V2_GENERATOR`, `generateHmV2Plan`, `hmV2Start`, `isHmV2Plan`, `adaptationUnsupportedFor` (HM v2 →
  poruka, inače `null`), `tracksOffPlanRuns` += HM v2. Iz `halfMarathon` i dalje samo `import * as halfMarathon`.

## Adapter `halfMarathon/v2/app/` — fajl → odgovornost

| fajl                                           | odgovornost                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                     | LOKALNI strukturni oblici formata (plan za upis, dan sa strukturom, razrešen plan, zapisi, tereti ugovora; `HmV2Meta`)                                                                                                                                                      |
| `plan.ts`                                      | nedelja v2 → nedelja aplikacije (7 dana, ID `g{w}d{dow+1}`); JEDNA mapa faze (base → BAZA, development → RAZVOJ, specific → VRHUNAC, taper → TAPER, race → TRKA, rasterećenje → DELOAD); tip/vrsta dana; `meta`; `planPolicy`, `stampPlan`, `phaseOfWeek`, `KNOWN_VERSIONS` |
| `structure.ts`                                 | trening v2 → `WorkoutStructure` blok po blok (segmenti doslovno; piramida = blok po deonici i oporavku); po osećaju (H16): rad = RPE + tempo kao procena; ubrzanja/trka po osećaju i test 5 km = procena                                                                    |
| `generate.ts`                                  | `generateStructured` (čarobnjak), `alignedStart` (cele nedelje do trke, prvi dan ∈ [danas, danas + 6]), ugovorni `generatePlan`/`adaptGeneratedPlan`, `assess`, `product` (Polumaraton, 10 ned), `rpeTarget`                                                                |
| `watch.ts`                                     | sat iz strukture; deo bez propisanog tempa / dan bez strukture → `skipped` + `skippedReasons`; trka i test se ne šalju                                                                                                                                                      |
| `paces.ts`                                     | `paceForZone`, `thresholdPace` iz v2 modela                                                                                                                                                                                                                                 |
| `members.ts`                                   | 26 članova (b): „nepodržano do HM-06" sa razlogom po članu (`UNSUPPORTED`); fajl nema nijedan uvoz (test)                                                                                                                                                                   |
| `state/`, `weather.ts`, `date.ts`, `format.ts` | kopija HM v1 `halfMarathon/recovery`, `weather`, `date`, `format` (28da6af) sa lokalnim tipovima; datumi nad `../dates.ts`                                                                                                                                                  |
| `index.ts`                                     | objekat `hmV2` (izvozi ga `halfMarathon/index.ts`)                                                                                                                                                                                                                          |

`meta`: policyId/Version, start, weeks, raceDate, raceDistM 21097.5, raceName „Polumaraton", goalSec, runDays, quality,
paceBasis (`result` kad v2 polje nema), `vdot` (`null` po osećaju), uz rezultat `vdot0`/`trainingVdot`/`racePace`/
`predictedHmSec` (NE `predictedSec`)/`goalVdot`, `goalAssessment` (poruka v2 doslovno), `dayWarnings` = napomene +
upozorenja v2 doslovno. Izostavljeno (v2 nema): intensity, vdotGoal, realno, baseWeeks, assessmentBasis, preparation.

**Izolacija:** `halfMarathon/v2/isolation.node.test.ts` (strogi, ni type-only van v2) — jedina izmena je aktivacija kao u
10K 05: „van v2 ga uvozi SAMO `halfMarathon/index.ts` → `v2/app/index.ts`". Bez novih izuzetaka; `satisfies
PlanGenerator` bez kasta za 53/55 članova, kast na granici formata samo `generatePlan`, `adaptGeneratedPlan` i
`generateHmV2Plan` (adapter pravi dan sa strukturom van unije `Day`). HM v1 isolation, architecture, contract i
policyIsolation testovi prolaze bez izmene.

**Format (opciono, bez SCHEMA bump-a i migracije):** `GenPlanState.hmV2?: unknown` (ceo izlaz v2; 6 d / 20 ned = 159 KB
JSON, 12 353 čvora — ispod granice revizije 30 000 / 250 000); `versions.PLAN_FIELDS` + `hmV2` (vraćena verzija je plan
v2 — test); `contract.HmV2PlanInput`. Stari planovi se čitaju isto.

## Ugovor `PlanGenerator` — 55 članova (test: tabela pokriva svaki član; nijedna funkcija nije funkcija HM v1)

| Kat.   | Stanje u HM-05                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| a (15) | v2: oznaka `hm-v2`/`hm-v2.3.0`, faza iz v2, generisanje, procena (vdotGoal = vdot0), proizvod, sat/napor/prag/tempo iz strukture  |
| b (26) | „nepodržano do HM-06": odbijanje (`ADAPTATION_UNSUPPORTED`), `null`/0 primenjenih, nepromenjen ulaz, kapija ∞, merenje `not-used` |
| c (14) | kopija HM v1 procene stanja i vremena (test: iste vrednosti kao `HALF_MARATHON_GENERATOR`; vreme: tempo iz strukture)             |

UI za (b): Plan → Prilagodi plan (`#v2-unsupported`) i Ti → Cilj (`#v2-unsupported-goal`): „Prilagođavanje plana stiže
uskoro…" umesto alata HM v1 (predlozi bola/tempa, „Prilagođavanje prema izvršenju" se ne prikazuju).

## Čarobnjak, prikaz, sat, uvoz

- `domain/onboarding/hmV2.ts` + `features/onboarding/HmV2Steps.tsx`, izbor u `Wizard.tsx` (samo polumaraton + prekidač).
  Koraci: Trka („Plan polumaratona v2: N nedelja, od …") → Rezultat (5/10 km, polumaraton/maraton sa satima, datum) ili
  lagan tempo → 30 min bez prekida, obim, opciono najduže skorašnje trčanje (pouka 28), iskustvo → dani (3–6; početnik
  4–5), dan dugog, opcioni cilj sa satima. „Ne još" → odbijanje v2 doslovno; odbijanje pri izradi → „Plan nije
  napravljen" + razlozi v2; plan se ne upisuje.
- Prikaz: trka 21,1 km + WU/CD van nedeljnog obima (`outsideWeekVolume`, test: km nedelje = `plannedKm` v2, `weekRace`
  = 21,1 km); orijentir (procena) + RPE; upozorenja v2 u „Na šta da paziš" (UI test). `day/structure.ts` nije menjan.
- Sat: deo po osećaju i ručno izmenjen dan → `skipped` + `skippedReasons` (Ti → Slanje na sat, `#icu-skipped`).
- Uvoz: Strava/icu za plan HM v2 → dnevnik + `vanPlanaV2` + `fullSync` (`importV2.node` 3); plan HM v1 bez promene.

## Bajt-isto (prekidač isključen)

- `halfMarathon/v2/app/byteSame.node.test.ts` + `byteSame.28da6af.json`: 150 SHA-256 (čarobnjak → generator nove
  distance → upis → razrešen plan → faza, politika, sat, napor, prag, cilj, izvršenje, prilagođavanje, odluka o pripremi,
  bol, opterećenje) za 5K v1 (2), 10K v1 (2), HM v1 (5 d, 4 d, 3 d početnik), maraton, 5K v2 (2, + adaptacija) i lični
  plan. Snimljen na 28da6af (worktree, 2× isti, `cmp`) → posle izmene isti. Drugi test: uz uključen HM v2 svi ne-HM
  heševi (110) isti, nov HM plan je `hm-v2`.
- Posle spajanja `227aaf0`: isti fajl snimka prolazi i na čistom `227aaf0` (worktree) i posle izmene — HM-04b/MAR-04b/
  10K 06e ne menjaju v1 tokove. 10K v2 (menja ga 10K 06e, pa nije u fajlu): 28 heševa (2 plana + tokovi + pregled
  adaptacije) — `cmp` isti i na 28da6af ↔ HM-05 i na 227aaf0 ↔ HM-05 (merenje, `BYTE_SAME_DUMP_10K`).
- `personalPlan.node.test.ts` nije menjan i prolazi; 10K `byteSame.node` i `importV1Snapshot` prolaze bez izmene.

## E2E (Playwright, Chromium `/opt/pw-browsers`)

`e2e/hm-v2.spec.ts` 3/3 iz prvog pokušaja (1,3 min): (1) prekidač u stanju naloga → čarobnjak (10 km 45:00, 40 km,
najduže 16 km, 4 dana, dugi nedeljom, cilj 1:40:00) → server `hm-v2` + `hmV2` → Plan tab (ocena cilja, struktura) →
dan → Prilagodi plan „stiže uskoro" → Ti → Povezani servisi → Slanje na sat (pregled, bez preskočenih); (2) po osećaju →
RPE + „orijentir (procena)", sat preskače dane po osećaju sa razlogom, test 5 km; (3) „Ne još" → odbijanje v2, plan
`null`. Zajedno sa `tenk-v2` i `fivek-v2`: v. Komande.

## Sabotaže (`web/scripts/sabotage.mjs`, `--bail=1`, brz nivo) — 10/10 palo, 67,0 s, `src` vraćen (heš isti)

Ulaz `artifacts/segment-05/sabotage-05.json`, rezultat `sabotage-05.result.json`. Prekidač podrazumevano uključen (6,9 s,
app.node); nepoznata verzija `hm-v2` → tihi fallback na HM v1 (6,0 s, app.node); adapter type-only uvoz van
`halfMarathon/v2` (1,0 s, isolation); lični plan ide u HM v2 (rutiranje bez oznake) (6,8 s, `personalPlan.node`); mapa
faze specifična → RAZVOJ (6,5 s); trka kao lagan dan u obimu (6,3 s); sat šalje procenu tempa po osećaju (6,7 s); uvoz
HM v2 bez zapisa van plana (6,6 s, importV2); čarobnjak ne čita prekidač (12,4 s, hmV2Flow UI); dugi kraći od laganog
(6,9 s).

## Komande i rezultati (iz `web/`)

- `npx vitest run --project node src/domain/generators/halfMarathon/v2` (brz nivo): 24 fajla / 236 testova, prošlo
  (109 s zida uz opterećenje 7,3 na 4 jezgra od paralelnih sesija; novi fajlovi ≈ 4,3 s testova).
- Novi testovi: `app.node` 27, `byteSame.node` 2, `importV2.node` 3, `hmV2Flow` (UI) 8, `hmV2Watch` (UI) 2.
- `npx tsc -b --noEmit` exit 0; `eslint` (kroz check:full `eslint .`) 0; `prettier --check` 0.
- `npm run check` (na spojenom stablu `227aaf0` + HM-05) exit 0: 271 fajl / 3294 testa, 413 s. Prvi pokušaj (pre
  spajanja, opterećenje ≈ 7): 1 pad — `domain/training/generator/audit.test.ts` istek 5 s (5747 ms); sam: 7/7 (8,4 s).
- `npm run check:full` (spojeno stablo): typecheck, `eslint .`, prettier 0; testovi 357/359 fajlova, 3578 prošlo, 1 pao,
  4 preskočena, 4504 s (opterećenje 4–7 od paralelnih sesija). Oba pada su ISTEK pod opterećenjem, u kodu koji HM-05 ne
  dira: `audit.test.ts` (5717 ms > 5 s) i `halfMarathon/v2/recent.node.test.ts` pun nivo (beforeAll > 120 s). Posle,
  pojedinačno sa `TEST_FULL=1`: `recent.node` 4/4 (82 s, blizu granice 120 s), `audit` 7/7 (6,8 s).
- `npx playwright test e2e/hm-v2.spec.ts e2e/tenk-v2.spec.ts e2e/fivek-v2.spec.ts`: 9/9 (44,8 s).
- Neuspesi usput (ispravljeni): byteSame pragovi broja ključeva (150 / 110 umesto > 150 / > 120).

## Stalni uslovi (AGENTS.md)

1–3: pravila v2 nisu dirana; adapter prenosi strukturu doslovno, njegove odluke (mapa faze, ime vrste, tip dana, šta je
procena) imaju po jedno mesto (`plan.ts`, `structure.ts`). 4: adaptacija nije povezana (HM-06). 5: handoff nije diran
(test: maraton → HM v1, HM → 10K v1). 6: plan nosi `hm-v2`/`hm-v2.3.0` i fazu svake nedelje iz v2 (`stampPlan`, test).
**7:** `halfMarathon/v2/app/` ne uvozi NIŠTA van `halfMarathon/v2/` (ni tip); jedina ivica ka v2 je
`halfMarathon/index.ts` → `v2/app/index.ts`; bez novih izuzetaka (sabotaža 05-c). **8:** test adaptera za 4 plana
(rezultat 4/6 d, po osećaju 3 d, početnik 4 d): nedelja 7 dana, svaki trening ima blokove i km > 0, zbir blokova = km,
dugi ≥ svaki lagan, nedelja ≥ minimum reda (H15), trka van obima, faza iz v2; degenerisan ulaz (trčanje/hodanje, 7 dana,
< 10 ned, obim 5 km, bez tempa) → odbijanje sa razlozima v2.

## Preostalo (HM-06)

- Sve (b): činjenice (dnevnik, bol, pokrivenost samo iz fullSync, pauze, `vanPlanaV2`) → `adaptHmV2` sa pregledom,
  potvrda, revizija, vraćanje verzije spajanjem, traka (pouka 20), promena cilja, Forma iz rezultata, unos testa 5 km.
- Sat ne šalje dane plana po osećaju (rad kvaliteta, ubrzanja) — samo uz ručni tempo dana.
- Posle adaptacije: `structure.ts` uzima E opseg i „po osećaju" po nedelji iz koraka (kao 10K 06 `plan.ts`).
- Predaja HM v2 ↔ 10K/maraton (faza 3). Plan HM v2 6 d/20 ned ≈ 159 KB (5 revizija ≈ 0,8 MB lokalno).
