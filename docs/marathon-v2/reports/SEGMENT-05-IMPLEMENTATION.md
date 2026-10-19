# Maraton v2 — Segment MAR-05: maraton v2 u aplikaciji iza prekidača (generisanje, čuvanje, prikaz, čarobnjak, sat)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `9443676` (HM-06). Jezgro maratona v2 (policy,
konstrukcija, assess, validate, adapt) nije menjano — verzija ostaje `marathon-v2.3.1`; ovo je povezivanje po obrascu
HM-05 (ništa iz `halfMarathon`/`tenK`/`fiveK` se ne uvozi — kopija, AGENTS.md uslov 7). Bez STANI.

## Prekidač (pouka 8)

- `domain/generators/flags.ts`: `MARATHON_V2_SETTING = 'generatorV2Marathon'`, `MARATHON_V2_ENV = 'VITE_MARATHON_V2'`,
  `marathonV2Enabled` (isto pravilo kao 5K/10K/HM: samo `true`; override `1`/`true` uključuje, `0`/`false` isključuje
  uvek), `marathonV2ToggleVisible` (samo uz postavljen env ili administratoru). `generatorFlags(fiveK, tenK?, hm?,
marathon?)`: bez izvora polje `marathonV2` izostaje (= isključen) — postojeći pozivi isti.
- `stores/generatorFlags.ts` (`useMarathonV2Setting`, `useMarathonV2ToggleVisible`); UI: Ti → Zone i postavke treninga →
  „Novi plan maratona pravi generator v2 (probno)" (`#set-marathon-v2`). Uključen → samo NOV plan maratona.

## Rutiranje (`select.ts`)

- `generatorForPlan`: maraton + `meta.policyId === 'marathon-v2'` → `MARATHON_V2_GENERATOR`; `marathon-v1`,
  `legacy-marathon` i tuđa oznaka → `MARATHON_GENERATOR`. `KNOWN_VERSIONS = [MARATHON_V2_POLICY.version]`
  (`marathon-v2.3.1`; aplikacija pre MAR-05 nije pisala planove maratona v2). Druga verzija ili bez nje → `unknown` →
  `null` → `UNKNOWN_POLICY` (test: `marathon-v2.0.0`, `marathon-v2.3.0`, `marathon-v2.99.0`, `hm-v2.3.0`, bez verzije);
  tuđa distanca sa `marathon-v2` → `null`. `generatorForNewPlan(42195, { marathonV2: true })` → v2; postojeći plan se ne
  prebacuje (izbor plana ne čita prekidač).
- `preparationForPlan` ostaje samo maraton v1 (v2 → `null`); predaja „kraća distanca" (`handoff.ts`) nije dirana (test).
- Novo: `MARATHON_V2_GENERATOR`, `generateMarathonV2Plan`, `marathonV2Start`, `isMarathonV2Plan`,
  `adaptationUnsupportedFor` (maraton v2 → poruka, inače `null`; HM-06 ju je uklonio, vraćena samo za maraton),
  `tracksOffPlanRuns` += maraton v2. Iz `marathon` i dalje samo `import * as marathon`.

## Adapter `marathon/v2/app/` — fajl → odgovornost

| fajl                                           | odgovornost                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `types.ts`                                     | LOKALNI strukturni oblici formata (plan za upis, dan sa strukturom, razrešen plan, zapisi, tereti ugovora; `MarathonV2Meta`)                                                                                                                                                                                                                                             |
| `plan.ts`                                      | nedelja v2 → nedelja aplikacije (7 dana, ID `g{w}d{dow+1}`); JEDNA mapa faze (base → BAZA, development → RAZVOJ, specific → VRHUNAC, taper → TAPER (2 ned, `taper: true`), race → TRKA, rasterećenje → DELOAD); tip/vrsta dana (MP → „Maratonski tempo"); tempo i osnova po NEDELJI (pouka 16, `pacesAt` sa obimom M2); `meta`; `planPolicy`, `stampPlan`, `phaseOfWeek` |
| `structure.ts`                                 | trening v2 → `WorkoutStructure` blok po blok (piramida = blok po deonici i oporavku); po osećaju (M16): rad = RPE + tempo kao procena; ubrzanja/trka po osećaju i test 5 km = procena                                                                                                                                                                                    |
| `generate.ts`                                  | `generateStructured` (čarobnjak), `alignedStart`, ugovorni `generatePlan`/`adaptGeneratedPlan`, `assess`, `product` (Maraton, 12 ned), `rpeTarget`                                                                                                                                                                                                                       |
| `watch.ts`                                     | sat iz strukture; deo bez propisanog tempa / dan bez strukture → `skipped` + `skippedReasons`; trka i test se ne šalju                                                                                                                                                                                                                                                   |
| `paces.ts`                                     | `paceForZone`, `thresholdPace` iz v2 modela                                                                                                                                                                                                                                                                                                                              |
| `members.ts`                                   | 26 članova (b): „nepodržano do MAR-06" sa razlogom po članu (`UNSUPPORTED`); fajl nema nijedan uvoz (test)                                                                                                                                                                                                                                                               |
| `state/`, `weather.ts`, `date.ts`, `format.ts` | kopija maraton v1 `marathon/recovery`, `weather`, `date`, `format` (9443676; sadržajno isto kao HM v1 — `diff -r` razlikuje samo zaglavlja) sa lokalnim tipovima; datumi nad `../dates.ts`                                                                                                                                                                               |
| `index.ts`                                     | objekat `marathonV2` (izvozi ga `marathon/index.ts`)                                                                                                                                                                                                                                                                                                                     |

`meta`: policyId/Version, start, weeks, raceDate, raceDistM 42195, raceName „Maraton", goalSec, runDays, quality,
paceBasis, `vdot` (`null` po osećaju), uz rezultat `vdot0`/`trainingVdot`/`racePace` (= MP)/`mpVdot`/
`predictedMarathonSec` (NE `predictedSec`)/`goalVdot`, `goalAssessment` (poruka v2 doslovno), `dayWarnings`.

**Odstupanja (opreznija opcija):** (1) ugovorni `assess` nema obim, a v2 prognozu i ocenu cilja računa iz VDOT-a
umanjenog za korekciju obima (M2) → koristi najveću korekciju (−2,0, pojas najmanjeg obima); prognoza nikad brža od
plana (test). Aplikacija `assess` zove samo za v1 čarobnjak (`onboarding/outlook` → `generatorForDistance`). (2)
`paceForZone(vdot, 'M')` = tempo maratona pri datom VDOT-u bez korekcije (definicija zone, kao HM-05); MP plana nosi
struktura dana. Aplikacija `paceForZone` zove samo za `E`.

**Izolacija:** `marathon/v2/isolation.node.test.ts` (strogi, ni type-only van v2) — jedina izmena je aktivacija:
„van v2 ga uvozi SAMO `marathon/index.ts` → `v2/app/index.ts`" + provera aliasa. Bez novih izuzetaka; `satisfies
PlanGenerator` bez kasta za 53/55 članova, kast na granici formata samo `generatePlan`, `adaptGeneratedPlan` i
`generateMarathonV2Plan`. Maraton v1 isolation/architecture/contract testovi prolaze bez izmene.

**Format (opciono, bez SCHEMA bump-a i migracije):** `GenPlanState.marathonV2?: unknown` (ceo izlaz v2; 6 d / 24 ned =
188 KB JSON, 13 926 čvorova — ispod granice revizije 30 000); `versions.PLAN_FIELDS` + `marathonV2` (vraćena verzija je
plan v2 — test); `contract.MarathonV2PlanInput`. Stari planovi se čitaju isto.

## Ugovor `PlanGenerator` — 55 članova (test: tabela pokriva svaki član; nijedna funkcija nije funkcija maraton v1)

| Kat.   | Stanje u MAR-05                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| a (15) | v2: oznaka `marathon-v2`/`marathon-v2.3.1`, faza iz v2, generisanje, procena, proizvod, sat/napor/prag/tempo iz strukture          |
| b (26) | „nepodržano do MAR-06": odbijanje (`ADAPTATION_UNSUPPORTED`), `null`/0 primenjenih, nepromenjen ulaz, kapija ∞, merenje `not-used` |
| c (14) | kopija maraton v1 procene stanja i vremena (test: iste vrednosti kao `MARATHON_GENERATOR`; vreme: tempo iz strukture)              |

UI za (b): Plan → Prilagodi plan (`#v2-unsupported`) i Ti → Trenutni cilj (`#v2-unsupported-goal`): „Prilagođavanje
plana stiže uskoro…"; predlozi bola/tempa i „Prilagođavanje prema izvršenju" se ne prikazuju.

## Čarobnjak, prikaz, sat, uvoz

- `domain/onboarding/marathonV2.ts` + `features/onboarding/MarathonV2Steps.tsx`, izbor u `Wizard.tsx` (samo maraton +
  prekidač). Koraci: Trka („Plan maratona v2: N nedelja, od …") → rezultat (5/10 km, HM, maraton sa satima, datum) ili
  lagan tempo → 30 min bez prekida, obim, opciono najduže skorašnje trčanje (M13a), iskustvo (početnik) → dani (3–6),
  dan dugog, opcioni cilj sa satima. „Ne još" → odbijanje v2 doslovno (kraća distanca); odbijanje pri izradi → „Plan
  nije napravljen" + razlozi v2; plan se ne upisuje.
- Prikaz: trka 42,2 km + WU van nedeljnog obima (test: km nedelje = `plannedKm` v2, `weekRace` = 42,2 km); MP dani sa
  tempom MP plana; orijentir (procena) + RPE; napomene v2 u „Na šta da paziš". `day/structure.ts` nije menjan.
- Sat: deo po osećaju i ručno izmenjen dan → `skipped` + `skippedReasons`.
- Uvoz: Strava/icu za plan maratona v2 → dnevnik + `vanPlanaV2` + `fullSync` (`importV2.node` 3); plan v1 bez promene.

## Bajt-isto (prekidač isključen)

- `marathon/v2/app/byteSame.node.test.ts` + `byteSame.9443676.json`: 223 SHA-256 (čarobnjak → generator nove distance →
  upis → razrešen plan → faza, politika, sat, napor, prag, cilj, izvršenje, prilagođavanje, odluka o pripremi, bol,
  opterećenje) za 5K v1 (2), 10K v1 (2), HM v1 (3), maraton v1 (2), 5K v2 (2 + adaptacija), 10K v2 (2 + adaptacija),
  HM v2 (2 + pregled prilagođavanja), izbor v2 i lični plan. Snimljen na čistom 9443676 (worktree, 2× isti, `cmp`) →
  posle izmene isti. Drugi test: uz uključen prekidač maratona svi ne-maratonski heševi (196) isti, nov maraton je
  `marathon-v2`, ostali prekidači ga ne menjaju.
- `personalPlan.node.test.ts` nije menjan i prolazi (i u `npm run check`); HM `byteSame.node` (28da6af) prolazi.
- UI (`marathonV2Flow`): 5K, 10K i polumaraton plan iz čarobnjaka bajt-isti uz uključen prekidač maratona.

## E2E (Playwright, Chromium `/opt/pw-browsers`)

`e2e/marathon-v2.spec.ts` 3/3 iz prvog pokušaja: (1) prekidač u stanju naloga → čarobnjak (10 km 45:00, 45 km,
najduže 18 km, 4 dana, dugi nedeljom, cilj 3:30:00) → server `marathon-v2` + `marathonV2` → Plan tab (ocena cilja,
struktura) → dan → Prilagodi plan i Trenutni cilj „stiže uskoro" → Slanje na sat (bez preskočenih) → nedelja trke
42,2 km; (2) po osećaju → RPE + „orijentir (procena)", sat preskače dane po osećaju sa razlogom, test 5 km; (3) „Ne
još" → odbijanje v2, plan `null`. Zajedno sa HM/10K/5K: v. Komande.

## Sabotaže (`web/scripts/sabotage.mjs`, `--bail=1`, brz nivo) — 10/10 palo, 85,0 s, `src` vraćen (heš 901ad4fc99af7a10)

Ulaz `artifacts/segment-05/sabotage-05.json`, rezultat `sabotage-05.result.json`: prekidač podrazumevano uključen
(9,3 s, app.node); nepoznata verzija → tihi fallback na maraton v1 (9,1 s, app.node); adapter type-only uvoz van
`marathon/v2` (1,0 s, isolation); lični plan ide u maraton v2 (rutiranje bez oznake i distance) (8,3 s,
`personalPlan.node`); trka kao lagan dan u obimu (8,3 s); čarobnjak ne čita prekidač (13,8 s, marathonV2Flow UI); mapa
faze taper → VRHUNAC (7,6 s); uvoz bez zapisa van plana (8,2 s, importV2); prekidač maratona menja nov polumaraton
(10,4 s, byteSame); sat šalje procenu tempa po osećaju (7,9 s).

## Komande i rezultati (iz `web/`)

- `npx vitest run --project node src/domain/generators/marathon/v2` (brz nivo): 25 fajlova / 298 testova, prošlo. Zid
  89,1 s i 90,3 s; isti nivo na čistom 9443676 na ovoj mašini (4 jezgra): 22 / 266, 87,4 s. App grana dodaje ≈ 2–3 s
  (testovi 3 nova fajla ≈ 3,5 s, ostalo import aplikacije); granica 60 s je na ovoj mašini prekoračena već pre MAR-05,
  uzorak se nema gde smanjiti (trošak je import) — otvoreno pitanje.
- Novi testovi: `app.node` 27, `byteSame.node` 2, `importV2.node` 3, `marathonV2Flow` (UI) 8, `marathonV2Watch` (UI) 2.
- `npx tsc -b --noEmit` exit 0; `eslint` (izmenjeni fajlovi) 0; `prettier --check` 0.
- `npm run check` exit 0: 278 fajlova / 3359 testova (471 s testova, 751 s ukupno).
- `npm run check:full` NIJE pokrenut do kraja: po izmeni pravila (organizator, AGENTS.md e1ea239/c7ee38a) prekinut i
  ostavljen CI-ju. Umesto njega: pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2`
  45 fajlova / 368 testova, prošlo (1243 s); `npx vitest run --changed 9443676`: prvi put 133/134 fajla (1 pad:
  `features/ti/ti.test.tsx` „korisnici: … brisanje na dva sa lozinkom", 1121 ms, kod koji MAR-05 ne dira; sam 36/36),
  drugi put 134 / 1377, prošlo (198 s, opterećenje 4,3 na 4 jezgra).
- `npx playwright test e2e/marathon-v2.spec.ts e2e/hm-v2.spec.ts e2e/tenk-v2.spec.ts e2e/fivek-v2.spec.ts`: 12/12 (69 s).
- Neuspesi usput (ispravljeni): test PLAN_TOO_SHORT sa rezultatom starijim od 84 dana (dao je i EASY_PACE_REQUIRED —
  pomeren start); dupli uvoz u testu.

## Stalni uslovi (AGENTS.md)

1–3: pravila v2 nisu dirana; adapter prenosi strukturu doslovno, njegove odluke (mapa faze, ime vrste, tip dana, šta je
procena) imaju po jedno mesto (`plan.ts`, `structure.ts`). 4: adaptacija nije povezana (MAR-06). 5: handoff nije diran
(test: maraton → HM v1, HM → 10K v1). 6: plan nosi `marathon-v2`/`marathon-v2.3.1` i fazu svake nedelje iz v2
(`stampPlan`, test). **7:** `marathon/v2/app/` ne uvozi NIŠTA van `marathon/v2/` (ni tip); jedina ivica ka v2 je
`marathon/index.ts` → `v2/app/index.ts`; bez novih izuzetaka (sabotaža 05-c). **8:** test adaptera za 4 plana
(rezultat 4/6 d, po osećaju 3 d, početnik 4 d): nedelja 7 dana, svaki trening ima blokove i km > 0, zbir blokova = km,
dugi ≥ svaki lagan, nedelja ≥ minimum reda (M15), trka van obima, taper 2 nedelje, faza iz v2; degenerisan ulaz
(trčanje/hodanje, 7 dana, < 12 ned, obim 5 km, bez tempa) → odbijanje sa razlozima v2.

## Preostalo (MAR-06)

- Sve (b): `marathon/v2/app/facts.ts` → `adaptMarathonV2` sa pregledom, potvrda, revizija, vraćanje verzije, traka
  (pouka 20; jezgro maratona nema `newLimits` u rezultatu adaptacije — HM ga ima), promena cilja, Forma, unos testa 5 km.
- `KNOWN_VERSIONS` proširiti na `marathon-v2.3.1` ∪ tekuća kad se politika promeni.
- Sat ne šalje dane plana po osećaju (rad kvaliteta, ubrzanja) — samo uz ručni tempo dana.
- Predaja maraton v2 ↔ HM/10K (faza 3).
