# 10K v2 — Segment 06d (10k-v2.5.1): prošlost = upisani dani; rasterećenje sa testom; trkačka nedelja posle skraćenog tapera; umor u uvodu početnika

Polazni SHA `51a924f` (STANI `fc40faa`, izveštaj `SEGMENT-06d-STOP.md`; kod generatora od `51a924f` do vrha grane
nepromenjen). Grana `claude/generator-isolation-5k-10k-hm-marathon`. Menjano samo `web/src/domain/generators/tenK/v2/` i
`docs/10k-v2/`; izuzeci (samo oznaka verzije): `web/e2e/tenk-v2.spec.ts`,
`web/src/features/onboarding/tenKV2Flow.test.tsx`. Ništa u `fiveK/`, 10K v1, HM, maratonu ni zajedničkom kodu. Bez PR-a,
mergea i deploya.

## 1. Zaključak

- **0 odbijanja** u pretrazi N7 (61 104 toka; pre 152) i u širokoj mreži S (847 392 toka; pre 3197), u mreži E (65 699)
  i u mrežama 04 / P / R.
- Promenjeni prihvaćeni tokovi: **samo porodica 1** (prošlost = upisani dani; 16 840 u S + N7, 18 u mreži 04, svaki
  sa razlikom upisanog i sastavljenog zaštićenog dana, 0 prekršaja Uslova 8) i **N-b** (576: 72 cilj 0,8 × bez
  spuštanja, 504 samo napomena). Oba prihvatio organizator. P i R: 0 promena.
- 2 / 1308 skraćenih trkačkih nedelja su ispod minimuma nedelje (D30b, upozorenje RACE_WEEK_SHORT) — uzak izuzetak u
  invarijanti testa (odluka 4, § 5).
- Faza (b) odluke 1 je uklonjena kao nedostižna (0 poziva u 65 699 tokova E i 509 328 tokova S/N7 sa testom; § 3.1).

## 2. Odluke (organizator)

1. **K2 / N-c / N-d (opcija A):** prošlost ima jednog vlasnika — upisane (zaštićene) dane. Konstruktor vodi svako
   stanje koje zavisi od prošlosti iz upisanih dana (jedno spajanje `written.ts`, A11), a validator u `construct` dobija
   upisani plan. Promena prihvaćenih tokova dozvoljena samo za tu porodicu, uz dokaz.
2. **N-a (opcija A):** D23 ostaje tvrdo; višak laganih dana trkačke nedelje postaje odmor — prvo dani bola, pa
   najraniji lagani; dan pred trku i trka ostaju; jedna funkcija u `week.ts` (`raceWeekRest`), validator D20 je čita.
3. **N-b:** prinudno rasterećenje (A5) u uvodu početnika — obim 0,8 ×, sadržaj uvoda (bez kvaliteta, dani uvoda), ne
   pomera se; pravilo ne zavisi od izvodljivosti kvaliteta (zato i 504 toka sa samo novom napomenom).
4. **N-a × D30b (sudar posle punog nivoa, opcija A):** D23 i ograničenja bola imaju prednost; trkačka nedelja
   skraćena po `raceWeekRest` sme biti ispod minimuma (D30b je u validatoru upozorenje RACE_WEEK_SHORT). Uzak izuzetak
   samo u `adaptInvariants` (test): manje dana trčanja od D20 bez dana odmora koraka, napomena D23 i upozorenje
   RACE_WEEK_SHORT. Kod generatora bez izmene.
5. **K1:** dvofazno iz prototipa → posle sudara 4b (B): faza (b) uklonjena; D27: „za rasterećenje sa testom cilj iznad
   pravila samo ako sastavljena nedelja ima test; inače cilj ≤ pravilu (samo naniže), a test otpada (A9) kad ga
   sastavljena nedelja nema".

## 3. Uzroci i ispravke (fajl → izmena)

| fajl | izmena |
|---|---|
| `written.ts` (nov) | `Written` (prethodni plan, zaštita `keep`, asOf, zaključani), `writtenDays` (dani nedelje kakvi se upisuju), `writtenWeeks` (spajanje A11 + mešovite nedelje; izdvojeno iz `adapt.ts` bez promene logike). **Jedino mesto spajanja.** |
| `adapt.ts` | zaštita (`keep`) pre konstrukcije → `construct(input, steps, prior)`; spajanje = `writtenWeeks`. |
| `generate.ts` | `construct(…, prior?)`: posle svake nedelje `writtenDays` → iz njih najduži dugi (`longestLong10`), poslednji dugi (D5), stanje doze (`writtenPicks` kad se upisani dani razlikuju od sastavljenih), RP i najkraći lagan tapera, poslednji zahtevan dan i planirano tapera (trkačka nedelja); validacija adaptiranog plana nad `writtenWeeks` (isti plan kao završna u `adapt`). K1: uslov izvodljivosti `t10 ≤ pravilo ∨ nedelja ima test` za okvir rasterećenja sa testom. N-a: posle A9 (oštrenje otpada), ako je trkačka i dalje > taper → `raceWeek(…, cap)`. |
| `lengths.ts` | `longestLong10(weeks)` — jedna definicija najdužeg dugog (D7). |
| `validate.ts` | TAPER_LONG čita `longestLong10(weeks pre tapera)`; D20 čita `raceWeekRest` (isti podatak); mešovita nedelja izgradnje ažurira poslednju T dozu (D31) iz upisanih dana (§ 3.2). |
| `adaptInvariants.ts` | uzak izuzetak D30b za trkačku nedelju skraćenu po D23 (odluka 4). |
| `week.ts` | `raceWeekRest` (D23, jedino mesto) i `raceWeek(…, cap100)` + napomena; rasterećenje u uvodu početnika bez kvaliteta (A5/D28). |
| `policy.ts` | `10k-v2.5.1`; dopune D7, D23, D27, A5, A11 („Prošlost = upisani dani"). |
| `app/plan.ts` | `KNOWN_VERSIONS = ['10k-v2.4.0', '10k-v2.4.1', '10k-v2.5.0', P.version]`. |
| `testInputs.ts` | mreža E (`earlyGridBases`, `earlyAsOfs`, `earlyFacts`, `earlyFlows`, `EARLY_NAMED`); `PlanLike.weeks[].test?`. |
| `earlyGrid.*` (novo) | trajna mreža E (§ 6) + primeri K1, K2, N-a, N-b, N-c, N-d; heševi `segment06d.early-hashes-51a924f.json`. |
| `adapt.node.test.ts` | test 06d prema 51a924f (`segment06d.adapt-hashes-51a924f.json`: tačno 18 tokova porodice 1 se menja); starije regresije (e6540a5, 4917959) za tih 18 porede stanje 51a924f. |
| oznake verzije | `policy.node`, `periodize.node`, `painGrid`, `app.node`, `adaptFlow.node`, `tenKV2Flow.test.tsx`, E2E. |

Uzroci (linije na `51a924f`):
- **K1** — `volume.ts:149` (`fit10`: `frame.deload && frame.test` → naviše do `lastBuild10 − 1`) uz `generate.ts:153–167`
  (pretraga pita samo „nedelja izvodljiva"); `week.ts:227` test postoji samo u prolazima rule/relax, a `generate.ts:182`
  skida oznaku testa kad ga nedelja nema → rasterećenje bez testa podignuto naviše → `validate.ts:1411–1413` (ispravno)
  odbija.
- **K2** — `generate.ts:190` (`longest10` iz SASTAVLJENIH nedelja, i za nedelje pre asOf) prema `validate.ts:1177`
  (iz plana posle spajanja, `adapt.ts:133–157`); primer: upisan dugi ned 1 9,2 km, sastavljen 10,5 → dugi tapera 7,3 >
  0,75 × 9,2.
- **N-c / N-d** — `generate.ts:204` (`advance(w.picks)` iz sastavljene nedelje) prema `validate.ts:1182–1188` (iz
  upisane); dan Q1 = asOf zaštićen (T/RP 3600), sastavljen manji.
- **N-a** — `week.ts:445–500` (trkačka po D20) + taper sa danima odmora/bola; D23 nema izlaz.
- **N-b** — `week.ts:223–232` (rasterećenje gradi T bez obzira na uvod D28) prema `validate.ts:315` (uvod: sve lagano).

### 3.1 Faza (b) odluke 1 — uklonjena (nedostižna)

Instrumentisana kopija (brojač poziva): 0 / 65 699 tokova mreže E, 0 / 448 224 tokova S sa planovima po osećaju i 0 /
61 104 N7 (samo planovi po osećaju imaju test). Razlog: faza (a) za okvir sa testom prihvata cilj ≤ pravilu i bez testa,
a prolazi 'one' i 'none' grade upravo nedelju bez testa — isto što bi (b) dala (okvir bez testa, samo naniže); kad ni
'none' ne staje na cilju ≤ pravilu, ne staje ni (b). Sabotaža 4b je zato izbačena iz skupa (odluka organizatora).

### 3.2 Dopuna validatora (ista porodica)

Prvi prolaz posle (A) dao je 2 nova odbijanja (`DELOAD_CONTENT`, `b-d3-17w/18w-30km-e330-B-sun`, sreda ned 9, pauza
20): konstruktor je T dozu mešovite nedelje 9 (zaštićen Q1 T 3600) uzeo iz upisanih dana, a validator je mešovitu
nedelju preskakao za poslednju T dozu (D31) i ostao na 3000. Validator sada i u mešovitoj nedelji izgradnje uzima
poslednju T dozu iz upisanih dana (slot ostaje „nepoznat" kao do sada). Tok: 0 odbijanja (ponovljen deo mreže S sa
početnicima, § 5).

## 4. Primeri (pre → posle; 51a924f odbijeno)

| klasa | tok | 51a924f | 10k-v2.5.1 |
|---|---|---|---|
| K1 | `f-d4-12w-25km-e270-A-sun`, bol 5 2026-11-05 | odbijeno: ned 4 cilj 20 ≠ 17 (VOLUME_RULE) | ned 4 17 km, bez testa, po pravilu |
| K1 | `f-d5-12w-30km-e270-C-sat`, pauza 20 do 2026-11-07 | odbijeno: ned 4 20 ≠ 18,5 | ned 4 18,5 km |
| K2 | `f-d5-8w-35km-e270-A-sat`, bol 5 2026-11-04 | odbijeno: dugi tapera 7,3 > 0,75 × 9,2 | upisan dugi ned 1 9,2 km; dugi tapera 6,9 |
| N-a | `10w-25km-v30-A-sat`, bol 8 2026-12-26 | odbijeno: trkačka 10,1 > taper 8,2 | dan bola 2027-01-03 → odmor; trkačka 3,0 + 4,1 = 7,1 ≤ 8,2, napomena D23 |
| N-b | `b-d3-10w-20km-e390-A-sat`, umor kraj ned 1 | odbijeno: ROLES (q1 u uvodu) | ned 2 rasterećenje 16,0 km, dugi + 2 lagana, bez kvaliteta |
| N-c | `b-d3-17w-30km-e330-B-sun`, pauza 10, sreda ned 10 | odbijeno: DELOAD T 2000 ≠ 1500 | upisan Q1 ned 10 T 3600; rasterećenje ned 13 T 2000 |
| N-d | `b-d3-16w-30km-e330-B-sun`, pauza 20, sreda ned 11 | odbijeno: TAPER_QUALITY | poslednja T 3600 → T tapera 2000 > plafon → taper bez kvaliteta |

## 5. Merenje pre / posle i regresija (`artifacts/segment-06d/`)

| mreža | tokova | odbijeno pre (51a924f) | odbijeno posle |
|---|---|---|---|
| N7 | 61 104 | 152 (K1 142, K2 10) | **0** |
| S | 847 392 | 3197 (K1 172, K2 18, N-a 1308, N-b 1692, N-c 6, N-d 1) | **0** |

Ispravljeno 3349 (K1 314, K2 28, N-a 1308, N-b 1692, N-c 6, N-d 1); prihvaćen → odbijen 0. Merenje S je pokrenuto pre
izmene i posle jednom; posle ispravke § 3.2 i uklanjanja uslova N-b ponovljen je samo deo sa početnicima (jedini koga
te izmene diraju: D31 i uvod važe samo za početnika) — `measure-after.json` = R, F, N7 iz punog prolaza + B iz
ponovljenog.

**Promenjeni prihvaćeni tokovi (S + N7) = 17 416:**

1. **Porodica 1 — 16 840** (`family1-wide.json`, skripta `family1-06d.ts`): svaki ima bar jedan zaštićen prošli dan
   (≤ asOf) čiji se sastavljeni oblik (`construct` bez prior) razlikuje od upisanog — 16 840 / 16 840. Vrste razlike
   (tok može imati više): lagan 14 780, Q1 doza 8894, dugi 7954, Q1 upisan / sastavljen lagan 2926, Q2 3849, test 20.
   Scenariji: samo pauza 10/20/35, manjak, pauza 10 + bol 5 (smanjenje posle asOf u istoj nedelji). Smer (posle asOf,
   prema 51a924f):

   | stanje | viši | niži | isti | nema |
   |---|---|---|---|---|
   | dugi tapera | 887 | 192 | 15 761 | — |
   | doza tapera | 1343 | 115 | 15 382 | — |
   | doza rasterećenja | 2814 | 14 | 12 170 | 1842 |
   | dugi rasterećenja | 7303 | 151 | 7544 | 1842 |
   | doza izgradnje (zbir) | 4148 | 491 | 12 201 | — |

   Uslov 8 (`adaptInvariants` nad svih 16 840): **0 prekršaja**; svi prihvaćeni od validatora (D7, D23 tvrdi).
   Tri primera:

   | tok | upisano / sastavljeno (prošlost) | pre → posle |
   |---|---|---|
   | `b-d3-12w-25km-e390-A-sat`, pauza 20, sreda ned 3 | ned 3 dugi 12,4 / 7,8 km | ned 4 rasterećenje: dugi 6,2 → 7,8 km (0,8 × upisanih 12,4, plafon udela), lagani 5,7/5,6 → 4,9/4,8 |
   | `f-d3-18w-35km-e270-B-sun`, manjak, sreda ned 14 | ned 14 Q1 RP 4500 / RP 3000 | ned 15: bez kvaliteta → T 2400 (stanje doze od upisanih RP 4500); ned 16 RP 3000 (struktura) |
   | `f-d3-11w-35km-e270-B-sun`, pauza 20, sreda ned 7 | ned 7 Q1 RP 4000 / RP 2400 | ned 9 T 2000 → 2400; taper RP 2000 → 2400, dugi 10,8 → 10,7; trkačka lagan 3,3 → 3,0 |

2. **N-b — 576** (`intro-a5-wide.json`): početnik, umor, asOf ned 1 — 72 sa promenom obima (51a924f: 0,8 × nije bio
   izvodljiv SA kvalitetom, cilj spušten; sada 0,8 × bez kvaliteta; npr. `b-d3-10w-20km-e330-A-sat` kraj ned 1: ned 2
   14,9 km — dugi 6,7, lagani 4,1 → 16,0 km — dugi 7,2, lagani 4,4) i 504 sa istim danima i samo novom napomenom uvoda
   (rasterećenje i ranije bez kvaliteta jer T ne staje; upozorenje DELOAD_NO_QUALITY otpada). Uslov 8: 0 prekršaja.

**N-a × D30b:** od 1308 skraćenih trkačkih nedelja (3084 toka bol 8 kraj ned N − 2) **2** su ispod minimuma (D30b),
obe 6 dana, 35 km, po osećaju: `f-d6-9w-35km-e315-B-sat` (asOf 2026-12-19) — taper 10,6 km (dani odmora/bola),
trkačka lagan 3,5 + dan pred trku 4,44 = 7,94 km, + trka 10 = 17,94 < 18 km; `f-d6-14w-35km-e360-B-sat` (asOf
2027-01-23) — taper 11,1, trkačka 3,7 + 3,89 = 7,59 → 17,59 < 18. Još jedan lagan dan (≥ 3 km, A4) bi prešao taper
(D23), pa rešenja koje ispunjava oba nema; oba nose RACE_WEEK_SHORT. Test u `earlyGrid.node.test.ts`: izuzetak važi za
ta 2 toka, a ista nedelja bez napomene D23 ili bez upozorenja obara invarijantu (sabotaža 06d-5).

**Mreže 04 / P / R** (`grids-06d.ts`, 20 569 tokova): promenjeno 18, svi mreža 04, svi asOf sreda tapera, svi porodica 1
(`family1-grid04.json`: zaštićen RP ili lagan dan tapera upisan drugačije → oštrenje/napomena ili lagan trkačke
nedelje iz upisanog tapera; npr. `d5-r-18w` pauza 20: upisan lagan tapera 5,7, sastavljen 6,4 → lagan trkačke
nedelje 5,98 → 5,7). P i R: 0 promena, 0 odbijanja.

**Generator bez činjenica** bajt-isti: `grid`, `feelGrid`, `beginnerGrid` i heš testovi prolaze bez izmene očekivanja
(bez `prior` sva nova stanja se računaju iz istih dana; `raceWeekRest` i uvod bez kvaliteta ne deluju bez koraka).

## 6. Trajna mreža E (Uslov 8)

`earlyGrid.harness.node.test.ts`: 3084 plana (R svaki 12., F svaki 7., B svaki 3.) × {sreda i kraj ned 1, i pred
nedeljom testa} × 7 scenarija (pauza 10/20, bol 5/8, pauza 10 + bol 5, manjak, umor) + kraj ned N − 2 × bol 8 + 7
imenovanih (N-c/N-d) = **65 699 tokova**. Po toku: prihvaćen, `adaptInvariants` prazno, regresija prema 51a924f
(prihvaćen tamo → bajt-isti, osim spiska porodice 1 (828) i A5 u uvodu (576), koji se menjaju tačno). Brz nivo: svaki
60. tok po porodici × scenariju + imenovani primeri (K1, K2, N-a, N-b, N-c, N-d) — **20,4 s**; pun: 4 dela po planu.
`earlyGrid.node.test.ts`: primeri K1 (oba), K2, N-a, N-b, N-c, N-d izričito, i izuzetak D30b (2 toka + negativna
provera).

## 7. Sabotaže (`web/scripts/sabotage.mjs`, `artifacts/segment-06d/sabotage-06d.json`, `--parallel 2`)

| # | sabotaža | odluka | ishod | prvi pali test (poruka) | trajanje |
|---|---|---|---|---|---|
| 1 | K2 stara definicija: najduži dugi iz sastavljenih dana | 1 (K2) | PAO | 0 odbijanja i adaptInvariants prazno (Uslov 8) (AssertionError: expected 2 to be +0 // Object.is equality) | 21.1 s |
| 2 | validacija u construct nad sastavljenim planom | 1 | PAO | 0 odbijanja i adaptInvariants prazno (Uslov 8) (AssertionError: expected 16 to be +0 // Object.is equality) | 20.9 s |
| 3 | stanje doze iz sastavljenih dana | 1 (N-c/N-d) | PAO | 0 odbijanja i adaptInvariants prazno (Uslov 8) (AssertionError: expected 7 to be +0 // Object.is equality) | 19.3 s |
| 4 | validator ne čita raceWeekRest | 2 (N-a) | PAO | 0 odbijanja i adaptInvariants prazno (Uslov 8) (AssertionError: expected 1 to be +0 // Object.is equality) | 21.3 s |
| 5 | raceWeekRest vraća prazno | 2 (N-a) | PAO | 0 odbijanja i adaptInvariants prazno (Uslov 8) (AssertionError: expected 1 to be +0 // Object.is equality) | 20.7 s |
| 6 | prinudno rasterećenje u uvodu sa kvalitetom | 3 (N-b) | PAO | 0 odbijanja i adaptInvariants prazno (Uslov 8) (AssertionError: expected 31 to be +0 // Object.is equality) | 20.6 s |
| 7 | K1 bez uslova „nedelja ima test" | 4 (K1) | PAO | 0 odbijanja i adaptInvariants prazno (Uslov 8) (AssertionError: expected 2 to be +0 // Object.is equality) | 20.3 s |
| 8 | izuzetak D30b bez uslova raceWeekRest | 2 × D30b | PAO | f-d6-9w-35km-e315-B-sat, bol 8 kraj ned N − 2: trkačka 7.94 + 10 < 18 km — prihvaćeno (D23, RACE_WEEK_SHORT); bez napomene D23 invarijanta pada (AssertionError: expected [] to include 'trkačka + trka < minimum') | 20.4 s |

Ukupno 8/8 PALO, 87.3 s zida (`--parallel 2`, brz nivo, `--bail=1`); stanje `src` isto pre i posle (heš `a2e90d517792b37e`). Sabotaža 4b (faza (b) izbačena) uklonjena iz skupa (§ 3.1).

## 8. Komande (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check .` | exit 0 (i u `check:full`) |
| `npx vitest run --project node src/domain/generators/tenK/v2` (brz) | 23 fajla, 300 / 300, 45,6 s |
| `npx vitest run --project node …/earlyGrid.node.test.ts` (brz) | 12 / 12, 20,5 s |
| `npm run check` | exit 0 — 235 fajlova, 2902 testa, 218 s zida |
| `npm run check:full` | exit 0 — 289 fajlova, 3072 testa, 1067 s zida |
| `npx playwright test e2e/tenk-v2.spec.ts` | 3 / 3, 54 s |
| `node scripts/sabotage.mjs ../docs/10k-v2/artifacts/segment-06d/sabotage-06d.json --parallel 2` | 8 / 8 PALO, 87 s |
| `node ../docs/10k-v2/artifacts/segment-06d/repro-n7.ts` (51a924f) | 61 104: VOLUME_RULE 142, TAPER_LONG 10, 392 s |
| `node ../docs/10k-v2/artifacts/segment-06d/measure-06d.ts <izlaz> [<koren>]` | pre (51a924f): 1534 s; posle: 1864 s (R, F, N7) + `MEASURE_FAMILY=B` 480 s |
| `compare-06d.ts`, `family1-06d.ts`, `grids-06d.ts`, `early-hashes-06d.ts` | poređenje, dokaz porodice 1 (16 840 + 576: 330 s), mreže 04/P/R, heševi E |

Mreža S je pokrenuta pre izmene i posle jednom (+ deo B posle ispravke validatora D31 i N-b, § 5); ostalo brzim nivoom i
punim nivoom (`check:full`).

## 9. Stalni uslovi (AGENTS.md 1–8)

1. **Jedan vlasnik odluke:** prošlost — `written.ts` (spajanje; konstruktor, adapt i validacija u construct čitaju
   isto); najduži dugi — `lengths.longestLong10`; dani trkačke nedelje koji postaju odmor — `week.raceWeekRest`
   (validator ga čita); D27 — uslov izvodljivosti u `generate.ts`; uvod — `week.ts`. Bez petlji; validator samo
   prijavljuje. Faza (b) uklonjena kao mrtva grana.
2. **Jedan plafon po zoni:** plafoni nedirnuti; D23 i D7 ostaju jedna provera svaka.
3. **WU/CD:** nedirnuti; manjak obima u trkačkoj nedelji ide u odmor (dani), ne u WU/CD.
4. **Adaptacija:** zaštita dana (A11) je poznata unapred i ulazi u konstruktor (`prior`); završna zaštita samo proverava.
5. **Handoff:** bez izmene.
6. **Plan nosi** `10k-v2` / `10k-v2.5.1` i fazu svake nedelje; 4.0, 4.1 i 5.0 ostaju poznati (`adaptFlow.node`).
7. **Izolacija:** `isolation.node.test.ts` prolazi bez novih izuzetaka; `written.ts` uvozi samo iz `tenK/v2/`.
8. **Upotrebljivost:** mreža E (65 699) i porodica 1 (16 840) + N-b (576): 0 prekršaja `adaptInvariants` (prazan
   trening, dugi ≥ lagan, nedelja ≥ minimum); mreža S 0 odbijanja.

## 10. Preostalo

- 5K v2: isto merenje (N7 + šira mreža) i ista porodica „prošlost = upisani dani" — poseban segment; `fiveK/` nedirnut.
- Mreža S (25–31 min) nije trajni test; trajna je mreža E (pun nivo) + mreže 04/P/R.
