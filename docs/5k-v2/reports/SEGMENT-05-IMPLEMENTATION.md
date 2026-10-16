# Segment 05 — 3-dnevne dopune, plan bez pouzdanog rezultata, početnik (5k-v2.4.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni commit 7b4b574. Nije aktivirano (select.ts/UI/store ne koriste v2).

## Odluke (DECISIONS 5k-v2.4.0) i odstupanja
1. **Kapacitet iz konstrukcije** (`volume.capacityKm`, jedno mesto): najveći T ≤ apsolutnog vrha (40/50/65) takav da `weekQuality` + `weekLengths` (iste funkcije kao generate) ni za jedan cilj t ≤ T ne daju lagan > dugi dok dugi stoji na plafonu. Pretraga naviše od minimuma nedelje, korak 0,1 km; probne nedelje: prva nedelja svake faze, rasterećenje, taper 1/2, druga vrsta smene (3 dana, početnik), uvod početnika, nedelja testa. Rezultat se pamti po (tempo, trkač).
   - Odstupanje: „najveći cilj" je zatvoren naniže (svi ciljevi ≤ T rade), jer konstrukcija nije monotona (pojas zagrevanja, korak dugog 0,5 km). Bez toga 3 dana 22 km pada u rupu.
   - Odstupanje: nedelja u kojoj je dugi sabijen minimumom laganih nije pitanje kapaciteta (donja granica obima) i preskače se.
   - Dopuna: `splitEasy` više ne gura poslednji lagan preko dugog zbog zaokruživanja (višak po 0,01 km ostalima).
2. **3 dana 12–35 km**; ispod: `WEEKLY_KM_OUT_OF_RANGE` sa porukom „ispod 12 km na 3 dana nema prostora za kvalitet; počni laganim trčanjem ili izaberi 4 dana".
3. **I (vrhunac) i RP (oštrenje) bez višeg nivoa**: ista doza druge strukture; ako ponuda nema drugu strukturu (brz trkač, mali budžet, I ≥ 2 min), ista ponavljanja sa kraćim oporavkom (`quality.denser`: −0,25 × vreme ponavljanja, I ≥ 0,5, RP ≥ 0,25). Tek onda (4/5 dana) zadržan I uz promenu T. `QUALITY_INFEASIBLE` samo kad ništa ne staje (npr. 3 d, 12 km, VDOT ~59: I budžet 0,96 km < 2 × 600 m).
4. **Bez rezultata / rezultat > 12 nedelja** (`hasFreshResult`, jedno mesto): plan po osećaju (`paceMode: 'feel'`), E = `typicalEasyPaceSecPerKm` ± 15 s (obavezan, 270–510 s/km; inače `MISSING_EASY_PACE` / `EASY_PACE_OUT_OF_RANGE`). Kvalitet bez brojčanog tempa (`paceSecPerKm: null`, `effort` RPE + opis): kratki usponi 30/45 s, fartlek 1–2 min „brzo ali kontrolisano", tempo po osećaju 10 min do plafona T faze (ili 2–3 × 5–10 min), RP po osećaju 30 s–2 min. Km rada = vreme / E tempo, `kmBasis: 'estimated'`. Star rezultat: samo napomena plana. `RESULT_TOO_OLD` ukinut.
5. **Kontrolno trčanje** 3 km (WU, 3 km RPE 9–10, CD; ne ulazi u udele) u 3. nedelji, ili 4. ako je 3. rasteretna (`periodize`, `WeekFrame.test`). Plan ostaje po osećaju; napomena: tempo iz testa tek kroz adaptaciju (segment 06).
6. **Prognoza i cilj**: `predicted5kSec: null`, cilj `insufficient_data` bez broja i ocene.
7. **Doza**: isti udeli (I 8%, T 10%, R 5% cilja) nad procenjenim km; prag 70% ne važi (validator ga preskače za plan po osećaju i početnika). Prvi izbor po osećaju = najmanji rad ≥ 70% najvećeg rada koji staje (ponuda je ograničena); rast traži veći procenjeni km i duže trajanje.
8. **Početnik** (`experience: 'beginner'`, `canRun30Min: true`, inače `RUN_WALK_NOT_SUPPORTED_YET`; i `regular` sa `canRun30Min: false`): ≤ 4 dana (`RUN_DAYS_COUNT`), 1 kvalitet (šablon bez q2), nedelje 1–2 samo lagano + 6 × 20 s, bez I: baza usponi/tempo, vrhunac fartlek (T zona) / usponi naizmenično, oštrenje i taper RP kratko (sa rezultatom VDOT RP 2–6 × 200–400 m, inače RP po osećaju). Sa rezultatom ubrzanja i RP po VDOT-u, ostalo po osećaju.
9. Početnik: rast ≤ 5%, dugi ≤ 60 min, vrh ≤ 1,2 × start, rasterećenje svake 3. nedelje (`rulesOf`, jedno mesto).
10. Cilj početnika: `feasible` → `orientation` („orijentir"); ambiciozan/nerealan ostaju.
- Dopune posle mreže (odstupanja): trkačka nedelja — lagan dan najmanje 2 km i kad je 50% dugog manje (početnik 12 km je inače imao 3 km nedelju); rasterećenje po osećaju bez mesta za kvalitet u nedelji (`weekLengths`) → samo ubrzanja (početnik 4 d, 15 km).

## Fajlovi
- `web/src/domain/generators/fiveK/v2/`: novi `feel.ts`, `quality.ts` (dispečer doze), `week.ts` (nedelja iz generate.ts), `lengths.ts` (dužine), `segment05.node.test.ts`; izmenjeni `types, policy, input, paces, periodize, schedule, volume, workouts, validate, generate, index` i testovi segment02–04, generate (samo očekivanja promenjena odlukama).
- `docs/5k-v2/artifacts/segment-05/` (29 primera, `inputs.json`, `plans.md`, `run.ts`), ovaj izveštaj, `STATUS.md`.

## Komande i rezultati (iz `web/`)
- `npx tsc -p tsconfig.domain.json --noEmit` → exit 0
- `npx eslint src/domain/generators/fiveK/v2` → exit 0; `npx prettier --check src/domain/generators/fiveK/v2` → exit 0
- `npx vitest run src/domain/generators/fiveK/v2` → 8 fajlova / 342 testa prolazi
- novi testovi na 7b4b574 (kopija segment05 testa): 35/35 pada (svaka odluka 1–10 + mreža)
- `npx vitest run --project node src/domain/generators/` → 24 fajla / 485 testova prolazi (8 min 21 s)
- `npm run check` → prvi put exit 2 (typecheck: nekorišćen parametar `n` u segment05 testu, TS6133); posle ispravke exit 0 (typecheck, lint, format, 184 fajla / 2114 testova)
- `node docs/5k-v2/artifacts/segment-05/run.ts` (iz korena) → 23 plana, 6 očekivanih odbijanja

## Mreža po grani (planovi/odbijeni; 0 grešaka validatora, 0 PLAN_VIOLATES_POLICY, 0 „lagan = dugi" van trke)
| grana (5 obima × {6, 7, 10, 16} ned × varijante × 2 rasporeda) | 3 dana | 4 dana | 5 dana |
|---|---|---|---|
| sa rezultatom, regular (4 VDOT, seg04 mreža; 3 d uključuje 10 km) | 128 / 32 | 160 / 0 | 160 / 0 |
| bez rezultata (E 5:00 / 6:30 / 8:00) | 120 / 0 | 120 / 0 | 120 / 0 |
| početnik bez rezultata (E 5:30 / 7:00 / 8:00) | 120 / 0 | 120 / 0 | 0 / 120 (RUN_DAYS_COUNT) |
| početnik sa rezultatom (5K 25:00 / 27:30 / 30:00) | 120 / 0 | 120 / 0 | 0 / 120 (RUN_DAYS_COUNT) |

Odbijanja 3 d sa rezultatom: 32 × 10 km (opseg) — ranije 34 (32 × 10 km + 2 × QUALITY_INFEASIBLE 15 km/16 ned/VDOT ~59, sada plan po Odluci 3). „Lagan = dugi" van trke: 3 d 608 → 0, 4/5 d 0 → 0.

**Regular sa rezultatom — izmereno (7b4b574 → 2.4.0, 512 ulaza mreže):** 3 d: 126 promenjenih ciljeva (Odluka 1), 6 odbijanja → plan, 22 isti; 4 d: 80 ciljevi (Odluka 1), 2 struktura I (Odluka 3), 78 isti; 5 d: 66 ciljevi, 94 isti; promena iz drugog razloga: 0. Kapacitet (staro → novo): 3 d VDOT 40/50/60: 32,7/38,8/45,5 → 17,1; 4 d: 37,7/45,5/50 → 33,8/41,3/41,3; 5 d: 54,4/62,7/71,1 → 55,1/64,4/65. Primeri (vrh): d3-30km 38,8 → 17,1; d3-15km 18,7 → 17,1; short-7w-d3 31,4 → 17,1; dev-04/05/06, edge-45km (4 d, VDOT 50–58) 45,5–50 → 41,3; edge-slow-45km 31,1 → 32,1; edge-fast-15km nedelja 7 kraći oporavak umesto zadržanog I; dev-01/02/03, edge-15/vdot30/result-12w, short-6w, d5-* bez promene plana.

## Stalni uslovi 1–8
1. Jedan vlasnik: obim `volume.ts` (kapacitet iz konstrukcije), doza `quality.ts` → `workouts.ts`/`feel.ts`, dužine `lengths.ts`, WU/CD `warmupBand`; bez petlji skraćivanja; validator samo prijavljuje. 2. Jedan plafon po zoni (`tContinuousMaxSec` važi i za tempo po osećaju; dugi: `rulesOf.longMaxSec`). 3. WU/CD nepromenjeni; manjak ide u lagane ili je odbijanje. 4–5. Adaptacija/handoff nisu u ovom segmentu (test ulazi kroz segment 06). 6. `policyId`/`policyVersion` 5k-v2.4.0, faza i `test` iz `periodize`. 7. Izolacioni test prolazi (novi fajlovi u v2/, bez novih izuzetaka). 8. Mreža: minimum nedelje, prazan trening, dugi ≥ lagan za sve grane; novi validatori `FEEL_*`, `PACE_MODE`, `TEST_WEEK`, `BEGINNER_*`.

## Bez rezultata: 4 dana, 25 km, E 6:00, 12 ned (kapacitet 41,8; cilj 25:00 → nedovoljno podataka)
| ned | faza | km cilj/plan | kvalitet | dugi | lagan max |
|---|---|---|---|---|---|
| 1 | baza | 25 / 25 | usponi 11 × 30 s + tempo 11 min | 8,5 | 5,19 |
| 2 | baza | 27 / 27 | usponi 12 × 30 s + tempo 12 min | 9 | 6,28 |
| 3 | baza (test) | 29,1 / 29,1 | test 3 km + tempo 2 × 6:30 | 10 | 6,78 |
| 4 | baza (rast.) | 23,3 / 23,3 | usponi 6 × 45 s | 8 | 5,42 |
| 5 | vrhunac | 31,4 / 31,4 | fartlek 7 × 1:30 + tempo 2 × 6:30 | 10,5 | 8,39 |
| 6 | vrhunac | 32,5 / 32,5 | fartlek 6 × 2 min + tempo 14 min | 11 | 8,59 |
| 7 | vrhunac (rast.) | 26 / 26 | fartlek 6 × 1:30 | 9 | 5,4 |
| 8 | oštrenje | 32,5 / 32,5 | RP po osećaju 7 × 1:30 + usponi 9 × 45 s | 11 | 8,94 |
| 9 | oštrenje | 32,5 / 32,5 | RP po osećaju 6 × 2 min + usponi 10 × 45 s | 11 | 8,26 |
| 10 | taper | 27,6 / 27,6 | RP po osećaju 6 × 1:30 + tempo 2 × 6 min | 9,5 | 6,84 |
| 11 | taper | 22,8 / 22,8 | RP po osećaju 5 × 1:30 | 7,5 | 5,57 |
| 12 | trka | 10,89 / 10,89 | RP po osećaju 3 × 1:30 | — | 3,7 |

## Početnik bez rezultata: 3 dana, 12 km, E 7:30, 10 ned (kapacitet 18,6; vrh 13,2 = 1,1 × start)
| ned | faza | km cilj/plan | kvalitet | dugi | lagan max |
|---|---|---|---|---|---|
| 1 | baza | 12 / 12 | — (lagano + 6 × 20 s) | 4,8 | 3,6 |
| 2 | baza | 12,6 / 12,6 | — (lagano + 6 × 20 s) | 5 | 3,8 |
| 3 | baza (rast.) | 10,1 / 10,1 | usponi 5 × 30 s | 3,7 | 3,03 |
| 4 | vrhunac (test) | 13,2 / 13,2 | test 3 km | 4,7 | 3 |
| 5 | vrhunac (rast.) | 10,6 / 10,6 | fartlek 6 × 1 min (RPE 6–7) | 3,6 | 3,07 |
| 6 | oštrenje | 13,2 / 13,2 | RP po osećaju 6 × 1 min | 5,2 | 4,42 |
| 7 | oštrenje | 13,2 / 13,2 | RP po osećaju 9 × 45 s | 5,2 | 4,12 |
| 8 | taper | 11,2 / 11,2 | RP po osećaju 3 × 1:30 | 4,4 | 3,5 |
| 9 | taper | 9,2 / 9,2 | RP po osećaju 7 × 30 s | 3,6 | 2,43 |
| 10 | trka | 5,01 / 5,01 | RP po osećaju 3 × 1 min | — | 2 |

## Preostali problemi
1. Kapacitet 3 dana ≈ 17 km za svaki VDOT: prva T nedelja baze (WU+CD 2,5 km + T 1 km) mora biti ≥ 20% nedelje (dugi ≤ 40%, lagan ≤ dugi). Trkači 3 d sa 22–35 km dobijaju plan od ~17 km uz START_ABOVE_CAPACITY. Trenerska odluka: duži prvi T, dugi 45% ili lagan ≤ 1,1 × dugi.
2. Kapacitet 4 dana za VDOT ≥ 45 pada sa 45,5–50 na 41,3: rupe 41,4–44,9 km (pojas zagrevanja 35–45 + korak dugog 0,5 km, manjak 0,1 km). Zatvaranje naniže to ne dozvoljava. Predlog: korak dugog 0,1 km i za 4 dana (kao 3 dana).
3. Brojke po osećaju (ponuda, RPE, oporavci, 70% najvećeg rada, kraći oporavak kao ista doza) su heuristike; km rada su procena E tempom (stvarni km su veći).
4. Trajanje trke u planu po osećaju je procena E tempom (gornja granica); test ne menja plan do segmenta 06.
5. Početnik sa rezultatom VDOT < 30 (5K > ~30:40) se odbija (`VDOT_OUT_OF_RANGE`); ne prelazi automatski na plan po osećaju.
