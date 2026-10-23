# 5K v2 — Segment 08d (5k-v2.6.1): bol — povratak ne zavisi od dana u nedelji

- Grana: `claude/generator-isolation-5k-10k-hm-marathon` (AGENTS.md). Polazni SHA: `bf472494c2b3d81a99a86625b82e973ee786e0e9`
  (bf47249, „10K v2 Segment 06b"). Commit: commit koji sadrži ovaj izveštaj (SHA u završnoj poruci).
- Status: odluka implementirana doslovno. Izvršilac se zaustavio na dva sudara (§ 9.1, § 9.2); oba su **rešena odlukom
  organizatora** i implementirana: (1) korak bola sa povratkom počinje novu progresiju doze od r + 1; (2) izričita
  dozvola za ponovni snimak samo ključeva „5K v2" u `tenK/v2/app/byteSame.068410b.json`.

## 1. Odluka (doslovno)

> ODLUKA ORGANIZATORA (Odluka 1 dopuna, verzija 5k-v2.6.1; heuristika, ista kao 10K A16)
> 1. Nedelja sidra = nedelja r koja sadrži asOf + 1 (prvi dan odmora ili bola; = step.firstWeek). Cilj nedelje r ostaje;
>    njeni dani u periodu bola i odmora su ograničeni kao do sada.
> 2. Posle nedelje r rast kreće od osnove povratka:
>      osnova = min( round1(0,7 × nivo koraka), cilj nedelje r )
>    - 0,7 = painEasyFactor.
>    - Nivo koraka = step.levelKm. Nivo pre bola je postojeće pravilo levelBefore prvog dana bola; ako je u istom koraku
>      i pauza, nivo je najveći nivo koraka, kao danas.
>    - Ako levelKm nije poznat (stariji korak), osnova = painReturnKm(cilj nedelje r, 0,7) (ponašanje 2.6.0).
> 3. Od nedelje r + 1: povratni rast (nextBuildKm, +returnGrowth do nivoa), pa redovan rast. Rasterećenje posle sidra =
>    deloadFactor × osnova (postojeće pravilo iz lastBuild). Nedelje sa danima bola posle r dobijaju taj cilj, a dani
>    ostaju ograničeni.
> 4. Povratak samo ako je r nedelja izgradnje (base/peak/sharpen), kao do sada. Taper i trkačka nedelja nemaju povratak.
> 5. Poruka PAIN: „Posle nedelje {r} rast kreće od 70% nivoa pre bola ({osnova} km)." + postojeći growthNote.
>    Ako min deluje (osnova = cilj nedelje r < 0,7 × nivo), poruka mora reći istinu:
>    „… rast kreće od {osnova} km (cilj nedelje {r}; 70% nivoa pre bola bilo bi {x} km)."
>    Ovo je ispravka greške u tekstu koju 10K 06b ima; kod 5K se radi odmah.
> 6. JEDNO mesto pravila: izdvoji jednu funkciju osnove (npr. returnBaseKm(share, levelKm, ciljR) u volume.ts) i koristi
>    je i u adaptVolume i u validatoru. Nijedno drugo mesto ne računa osnovu. Oblik koraka (returnFrom { week, share })
>    se ne menja; menja se semantika week = r.
> 7. Verzija:
>    - policy.ts version = '5k-v2.6.1'; zapis u DECISIONS sa obrazloženjem i primerima A–E (pre → posle);
>    - app/plan.ts: KNOWN_VERSIONS = ['5k-v2.6.0', '5k-v2.6.1']. Sačuvan plan 2.6.0 ostaje plan 5K v2 i prilagođava se
>      pravilima 2.6.1; rezultat nosi 2.6.1; druge verzije ostaju unknown. Obavezan test.
> 8. Trčanje/hodanje (nivoi, runWalkAssess/runWalkAdapt) se NE dira. Ako kontinuirani deo plana posle prelaza
>    (continuous.plan) gradi isti adaptVolume, odluka važi i za njega. Izmeri i upiši.

Tačka 8: kontinuirani deo posle prelaza adaptira isti `adaptContinuous` (runWalkAdapt.ts ga dobija ubrizganog) → isti
`construct` → isti `adaptVolume`; odluka važi i za njega bez izmene koda trčanja/hodanja. Izmereno u mreži P
(`rw-16w-pocetnik-e420`, 56 tokova, § 4).

## 2. Fajl → izmena

| Fajl | Izmena |
|---|---|
| `fiveK/v2/volume.ts` | `returnBaseKm(share, levelKm, targetRKm)` (l. 224) — JEDINO mesto osnove: `min(round1(udeo × nivo), cilj r)`; nivo nepoznat → `round1(udeo × cilj r)` (2.6.0). `returnShareKm` (l. 219) = `round1(udeo × nivo)` (deo osnove; broj x u poruci). `painReturnKm` uklonjen (njegovo pravilo je grana „nivo nepoznat"). `adaptVolume`: sidra nose `{ share, levelKm }` koraka (l. 317), posle nedelje sidra `returnBaseKm` (l. 302). |
| `fiveK/v2/validate.ts` | `anchorAt(i, km)` (l. 442) vraća osnovu iz `returnBaseKm`; koristi se u proveri rasta (l. 496) i osnovu rasterećenja (`lastBuildBefore`, l. 561). |
| `fiveK/v2/assess.ts` | Bol: `returnFrom = { week: r, … }` kad je r nedelja izgradnje (l. 319; bilo `weekOf(pain.to)`); nivo = `levelBefore` prvog dana bola (bez promene). PAIN poruka bez dela o povratku; `painReturnNote(step, ciljR)` (l. 41) dodaje deo o povratku iz `returnBaseKm` (i tekst za slučaj kad min deluje); `growthNote` premešten na nivo modula (isti tekst). |
| `fiveK/v2/adapt.ts` | Posle konstrukcije: poruka PAIN = poruka assess + `painReturnNote(korak, cilj nedelje r iz konstrukcije)` (l. 142; pauza iz istog koraka smanjuje cilj r); iste poruke u `reasons` i `notes`. |
| `fiveK/v2/types.ts` | Komentar `AdaptStep.returnFrom` (semantika week = r). |
| `fiveK/v2/steps.ts` | Sudar 1: `doseResetAt(s, weeks)` — korak bola sa povratkom (bez cilja koraka) → `returnFrom.week + 1`, ako je ta nedelja izgradnje u `weeks`; inače null. Korak sa ciljem (pauza, izvršenje, nov start; i pauza + bol) zadržava svoj start (≤ r + 1). |
| `fiveK/v2/generate.ts`, `fiveK/v2/validate.ts` | Konstruktor (`doseResetAt(s, frames)`) i validator (`doseResetAt(st, weeks)`, segment progresije) čitaju istu funkciju. BASE_R_DECREASE nepromenjen. |
| `fiveK/v2/policy.ts` | `version: '5k-v2.6.1'`; zapis `DECISIONS` 5k-v2.6.1 (obrazloženje, primeri A–E pre → posle, ograničenje sačuvanih koraka, (7) nov start doze posle bola sa obrazloženjem). |
| `fiveK/v2/app/plan.ts` | `KNOWN_VERSIONS = ['5k-v2.6.0', P.version]` (l. 42). |
| `fiveK/v2/testInputs.ts` | Tokovi postojećih mreža adaptacije kao funkcija (`adaptNetworkFlows`, 732 toka, isti ulazi/činjenice/asOf kao segment06/07 testovi; `RW_NETWORK` = RW_NET), mreža bola P (`PAIN_GRID`, `painGridBases`, `painCases`, `painFacts`), `canonResult` (JSON bez oznake verzije). API se ubrizgava (merenje i na bf47249). |
| `fiveK/v2/segment08d.adapt-hashes-bf47249.json` | Heševi 732 + 392 toka i spisak odbijenih tokova, napisani skriptom iz checkouta bf47249. |
| `fiveK/v2/segment08d.node.test.ts` | Nov: regresija prema bf47249 (0 odbijenih tokova bola), nov start doze, mreža P (korak, poruka, I1–I5), pauza + bol, primeri A–E (20 testova). Komentar na vrhu: „5K v2 ključevi osveženi u 5K 08d (oznaka 5k-v2.6.1); ostali ključevi su sa 068410b." |
| `tenK/v2/app/byteSame.068410b.json` | Sudar 2 (izričita dozvola za ovaj jedan fajl): ponovo snimljeni samo ključevi „5K v2 …" — 19 od 41 promenjeno, ostalih 99 ključeva bajt-isti (§ 9.2). |
| `fiveK/v2/app/adapt.node.test.ts` | Nov test: KNOWN_VERSIONS, sačuvan plan 5k-v2.6.0 → current → prilagođavanje nosi 5k-v2.6.1; druge verzije unknown. |
| `fiveK/v2/segment07.node.test.ts` | Očekivanje zavisno od odluke (§ 4.3). |
| `fiveK/v2/segment02.node.test.ts`, `fiveK/v2/app/app.node.test.ts`, `features/onboarding/fiveKV2Flow.test.tsx` | Samo oznaka verzije `5k-v2.6.0` → `5k-v2.6.1`. |
| `docs/5k-v2/artifacts/segment-08d/regression-bf47249.ts` | Skripta heševa (kod iz checkouta bf47249, definicije tokova iz ovog stabla). |
| `docs/5k-v2/artifacts/segment-08d/examples.ts`, `examples.md` | Primeri A–E pre (bf47249) → posle. |
| `docs/5k-v2/STATUS.md`, ovaj izveštaj | Sekcija „Segment 08d". |

Nijedan fajl taba „Predaja v1" (fiveK/plan, tenK/plan, halfMarathon, marathon, contract.ts, policyIsolation.node.test.ts,
docs/generator-isolation) nije diran; ništa van `fiveK/v2/`, `docs/5k-v2/`, oznake verzije u `fiveKV2Flow.test.tsx` i
jednog dozvoljenog fajla `tenK/v2/app/byteSame.068410b.json` (samo ključevi „5K v2"). Rečenicu „5K v2 ključevi osveženi u
5K 08d …" nisam upisao u `tenK/v2/app/byteSame.node.test.ts`, jer dozvola važi samo za JSON; stoji u komentaru na vrhu
`segment08d.node.test.ts` i ovde.
Nijedan nov broj u politici (0,7 = `adapt.painEasyFactor`, +10% = `adapt.returnGrowth`, 0,8 = `volume.deloadFactor`).
Trčanje/hodanje (`runWalk*.ts`) nije menjano.

## 3. Slučajevi A–E (pre → posle)

Ulaz: `{ startDate:'2026-10-26', raceDate:'2027-01-24', runDays:['tue','thu','sat','sun'], currentWeeklyKm:40,
recentResult:{ distanceM:5000, timeSec:1260, date:'2026-10-10' }, goalTimeSec:1200 }`; činjenica
`{ workouts:[{ date:<dan bola>, km:0, durationSec:0, completed:false, pain:N }] }`. Bazni plan (isti na oba SHA): ned 2 =
43,2, ned 3 = 45,6, ned 4 rasterećenje 36,5, ned 5–7 = 45,6. Ćelija: cilj / planirano / broj kvaliteta. Izvor:
`artifacts/segment-08d/examples.md` (pre = kod iz bf47249), test `segment08d.node.test.ts` „primeri A–E".

| Slučaj | | ned 4 | ned 5 | ned 6 | sidro, nivo, osnova |
|---|---|---|---|---|---|
| A asOf 2026-11-15 (ned), bol 5 na 2026-11-14 | pre | 36,5 / 26,6 / 0 | 28,0 / 28,0 / 2 | 30,8 / 30,8 / 2 | sidro 4, 0,7 × 36,5 = 25,6 |
| | posle | 36,5 / 26,6 / 0 | **33,2** / 33,2 / 2 | **36,5** / 36,5 / 2 | r = 4, nivo 43,2, osnova 30,2 |
| B isto, bol 8 | pre | 36,5 / 21,1 / 0 | 45,6 / 42,5 / 1 | 35,0 / 35,0 / 2 | sidro 5 (pun cilj ned 5) |
| | posle | 36,5 / 21,1 / 0 | **33,2** / 30,95 / 1 | **36,5** / 36,5 / 2 | r = 4, nivo 43,2, osnova 30,2 |
| C asOf 2026-11-18 (sre), bol 5 isti dan | pre | 36,5 / 28,6 / 1 | 45,6 / 42,5 / 1 | 35,0 / 35,0 / 2 | sidro 5 (pun cilj ned 5) |
| | posle | 36,5 / 28,6 / 1 | **35,0** / 32,55 / 1 | **38,5** / 38,5 / 2 | r = 4, nivo 45,6, osnova 31,9 |
| D isto, bol 8 | pre | 36,5 / 16,8 / 1 | 45,6 / 36,3 / 0 | 35,0 / 35,0 / 2 | sidro 5 |
| | posle | 36,5 / 16,8 / 1 | **35,0** / 28,1 / 0 | **38,5** / 38,5 / 2 | r = 4, nivo 45,6, osnova 31,9 |
| E asOf 2026-11-13 (pet), bol 7 isti dan | pre | 36,5 / 26,6 / 0 | 45,6 / 45,6 / 2 | 35,0 / 35,0 / 2 | sidro 5 (ned 5 pun cilj, 2 kvaliteta) |
| | posle | **24,2** / 19,3 / 0 | **33,2** / 33,2 / 2 | **36,5** / 36,5 / 2 | r = 3, nivo 43,2, osnova 30,2; ned 4 = 0,8 × 30,2 |

Brojevi organizatora (pre) reprodukovani na bf47249: A 36,5/26,6 · 28,0 · 30,8; C 45,6/42,5 (1 kvalitet) · 35,0; E
36,5/26,6 · 45,6/45,6 sa 2 kvaliteta · 35,0. Posle: ned 5 A = B = E = 33,2 (isti nivo 43,2, ista osnova), C = D = 35,0
(nivo 45,6) — ne zavisi od dana u nedelji ni od nivoa bola; nema „punog cilja pa pad".
Poruka (A posle): „… Posle nedelje 4 rast kreće od 70% nivoa pre bola (30.2 km). Povratak do 43.2 km (nivo pre
smanjenja) po +10%/ned u svim fazama osim tapera i trkačke nedelje." Slučaj kad min deluje (pauza + bol, § 5): „Posle
nedelje 5 rast kreće od 24.5 km (cilj nedelje 5; 70% nivoa pre bola bilo bi 28.6 km)."

## 4. Regresija

### 4.1 Heševi (bf47249 → 5k-v2.6.1)

Heš = prvih 16 hex sha256 celog rezultata adaptacije (plan, changes, reasons; odbijanje: reasons, violations) bez
`policyVersion` (na svim nivoima). Snimak: `node docs/5k-v2/artifacts/segment-08d/regression-bf47249.ts <checkout bf47249>`
→ `segment08d.adapt-hashes-bf47249.json` (dva pokretanja bajt-ista). Poređenje: `segment08d.node.test.ts`.

Postojeće mreže adaptacije 5K v2 (tačan skup iz segment06/07 testova) — 732 toka:

| Mreža (test) | Tokova | Promenjeno | Napomena |
|---|---|---|---|
| s06 „Mreža" (segment06): adaptNetwork 60 × {none, missedWeek, pause10, pause20, pause35, pain5, test3k} | 420 | **pain5 60/60**, ostalih 6 scenarija 0/360 | svih 60 promenjenih: PAIN primenjen sa povratkom |
| s07a „Mreža A" (segment07): 60 × {nepotpun unos, eksplicitna pauza} | 120 | 0 | |
| s07b „Mreža B" (segment07): RW_NET 16 × 6 scenarija × (korak + lanac) | 192 | 0 | bol5 trčanja/hodanja ide u runWalkAssess (nivo −1), nema returnFrom |

Nijedan tok sa povratkom nije ostao isti; nijedan promenjen tok nije bez povratka; 0 odbijanja (i na bf47249 0).

Mreža bola P — 392 toka (7 planova × 2 nedelje izgradnje × 7 dana × bol 4/5/7/8; asOf = dan bola):

| Plan (nedelje) | Tokova | Promenjeno | Povratak (prihvaćeno) | Odbijeno sada / na bf47249 |
|---|---|---|---|---|
| v45-d4-22km-14w (3) | 28 | 28 | 28 | 0 / 22 |
| v45-d4-22km-14w (11) | 28 | 24 | 24 | 0 / 0 |
| v38-d3-15km-10w (2, 6) | 56 | 56 | 56 | 0 / 0 |
| v45-d5-50km-7w (2, 4) | 56 | 56 | 56 | 0 / 0 |
| feel-d4-22km-12w (3, 8) | 56 | 56 | 56 | 0 / 0 |
| feel-d3-28km-8w (2) | 28 | 28 | 28 | 0 / 0 |
| feel-d3-28km-8w (5) | 28 | 24 | 24 | 0 / 0 |
| beg-res-d4-20km-10w (4) | 28 | 28 | 28 | 0 / 0 |
| beg-res-d4-20km-10w (7) | 28 | 24 | 24 | 0 / 0 |
| rw-16w-pocetnik-e420 posle prelaza (1, 4) | 56 | 56 | 56 | 0 / **22** |
| **Ukupno** | **392** | **380** | **380** | **0 / 44** |

- Promenjeno 380 = svi tokovi sa povratkom; nijedan tok bola sa povratkom nije odbijen (uslov prihvatanja, odluka o
  sudaru 1). Nepromenjeno 12 = tokovi bez povratka (asOf nedelja pred taperom → r je taper), bajt-isti.
- bf47249 odbija i 22 toka trčanja/hodanja posle prelaza (ned 1 kontinuiranog dela: sidro u rasterećenju 10,3 → osnova
  7,2 → ned 3 = donja granica 9 → `VOLUME_GROWTH 7,2 → 9 > 10%`); 2.6.1 ih prihvata (osnova 9,0).

### 4.1a Nov start doze posle bola (sudar 1) — koje se doze posle r + 1 menjaju

„Pre" = isti kod bez grane za bol u `doseResetAt` (= sabotaža (e)), „posle" = konačni kod; poređena je doza kvaliteta
(tip i rad I/T/R/RP) u svakoj nedelji ≥ r + 1 tokova sa povratkom. Nedelje pre r + 1 su u svim tokovima bajt-iste.

- Mreža P: 356 tokova bez promene doze; 24 toka su „pre" bila odbijena (BASE_R_DECREASE), sada su prihvaćena. Primer
  v45-d4-22km-14w, asOf 2026-11-18, bol 5: ned 5 (baza, 18,2 km) pre: odbijeno (R 0,90 < R ned 2 1,00) → posle: R 0,80
  + T_short 1,00.
- Postojeće mreže: 14 od 60 tokova s06/pain5 ima promenjenu dozu, uvek u prvoj nedelji vrhunca posle sidra (ned 9; kod
  d5-60km-16w-v58 ned 10); ostalih 46 bez promene doze. Doza kreće iznova od nižeg obima povratka:

| Tok | Nedelja (cilj) | Doza pre → posle |
|---|---|---|
| v45-d3-15km-14w | 9 (15) | I 1,20 → I 1,00 |
| v45-d3-28km-14w | 9 (25,8) | I 2,00 → I 1,50 |
| v45-d4-22km-14w | 9 (22) | I 1,60 → I 1,40 + T_cruise 2,00 |
| v45-d4-38km-14w | 9 (31,7) | I 2,50 + T_cruise 2,40 → I 1,80 + T_cruise 2,40 |
| v45-d5-30km-14w | 9 (30) | I 2,00 → I 1,80 + T_cruise 2,40 |
| v45-d5-50km-14w | 9 (45,4) | I 3,60 + T_cruise 4,00 → I 2,80 + T_cruise 4,00 |
| v38-d3-15km-14w | 9 (15) | I 1,20 → I 1,00 |
| v38-d3-28km-14w | 9 (23,4) | I 1,60 → I 1,40 |
| v38-d4-22km-14w | 9 (22) | I 1,60 → I 1,40 + T_cruise 2,00 |
| v38-d4-38km-14w | 9 (28,8) | I 2,10 → I 1,80 + T_cruise 2,40 |
| v38-d5-30km-14w | 9 (30) | I 2,40 → I 1,80 + T_cruise 2,40 |
| v38-d5-50km-14w | 9 (41,2) | I 3,20 + T_cruise 4,00 → I 2,40 + T_cruise 4,00 |
| d5-60km-16w-v58 | 10 (50) | I 4,00 + T_cruise 4,00 → I 2,80 + T_cruise 4,00 |
| dev-04 | 9 (35) | I 2,40 → I 2,00 + T_cruise 3,20 |

  Gde je „pre" samo I, drugi kvalitet nije stajao u obim uz nastavljenu (veću) dozu; posle novog starta staju oba.
- Svi ovi tokovi su PAIN sa povratkom; ostali tokovi obe mreže su bajt-isti prema bf47249 (§ 4.1).

### 4.2 Generator bez činjenica

Bajt-isti osim oznake verzije: svi postojeći heš i baseline testovi 5K v2 prolaze bez izmene očekivanja — segment07
„700 ulaza (640 planova): heš JSON-a = fixture sa c9003aa" (policyVersion maskiran), segment05b vrhovi (fixture
7b4b574), mreža 06/07 (`none` = bajt-isto). Jedina izmena u testovima generisanja: oznaka `5k-v2.6.0` → `5k-v2.6.1`
(segment02 „plan nosi identitet politike", app.node.test.ts 2 mesta, fiveKV2Flow.test.tsx).

### 4.3 Izmenjena očekivanja zavisna od bola (staro → novo, zašto)

`segment07.node.test.ts` „bol: nedelja bola zadržava cilj, rast posle nje kreće od 70% njenog cilja do nivoa" → „bol:
nedelja sidra zadržava cilj, rast posle nje kreće od 70% nivoa pre bola do nivoa" (DEV04, asOf kraj ned 4, bol 5 dan
ranije; r = 5, cilj 44, nivo 40,8):
- `t[5]`: `floor1(round1(0,7 × 44) × 1,1)` = 33,8 → `floor1(round1(0,7 × 40,8) × 1,1)` = 31,4 — osnova je 0,7 × nivo
  pre bola (28,6), ne 0,7 × cilj nedelje sidra (30,8);
- `t[8]`: 40,8 → 37,9 — sporiji povratak od niže osnove (31,4 → 34,5 → rasterećenje 27,6 → 37,9); nivo 40,8 se dostiže u
  ned 10 (`t[9]`, `t[10]` = 40,8 ostaje).
- `t[4] = 44`, planirano < 44, `returnFrom = { week: 5, share: 0.7 }` — bez promene (ovde je r = poslednja nedelja bola).

Ostali testovi bola (segment06 Odluka 4/7, app 08b „7. bol 5 → traka", UI `fiveKV2Adapt.test.tsx`) prolaze bez izmene.

## 5. Invarijante (mreža P; `segment08d.node.test.ts`)

Nezavisno od pravila osnove u volume.ts: r, nivo (poslednja ne-rasteretna nedelja izgradnje završena pre dana bola,
inače start) i osnova `min(round1(0,7 × nivo), cilj r)` računaju se u testu iz baznog plana i brojeva iz policy.ts;
iz volume.ts samo `fitTargetKm`/`capacityKm` (rupe izvodljivih ciljeva i kapacitet). Prihvaćenih tokova: svih 392.

- Korak/poruka: `firstWeek = r`; `returnFrom = { week: r, share: 0,7 }` tačno u 380 tokova (r izgradnja), inače null i
  bez „rast kreće"; `levelKm` = nezavisni nivo; poruka „Posle nedelje r rast kreće od 70% nivoa pre bola (osnova km).
  Povratak do nivo km …"; nijedna poruka nema „njenog cilja". Bez pauze min ne deluje nijednom (cilj r ≥ 0,7 × nivo).
- Nov start doze: `doseResetAt` = r + 1 u 292 toka (r + 1 izgradnja), null u 88 (r + 1 taper/trka) i u 12 bez povratka.
- **I1**: 292 toka sa r + 1 u izgradnji (124 rasterećenja): cilj r + 1 = izvodljiv(max(min(floor1(osnova × 1,1), nivo),
  donja granica)) odnosno izvodljiv(0,8 × osnova); nikad > osnova + 10% ni > nivo (osim donje granice nedelje — 0 puta u
  mreži P). 0 odstupanja.
- **I2**: 25 grupa (plan, nivo, r): u svakoj tačno jedan cilj r + 1 za svih 7 dana i bol 4/5/7/8. 0 grupa sa > 1.
- **I3**: bol 8 nikad ne daje veći cilj nijedne nedelje od bola 5 istog dana: 0 izuzetaka (sabotaža (a) ga obara).
- **I4**: od r + 1 do nivoa svaka nedelja izgradnje ≤ prethodna ne-rasteretna (prva: osnova) + 10%: 0 odstupanja.
- **I5** (Uslov 8): na svih 392 toka — svaki trening km > 0 i trajanje > 0, dugi ≥ lagan (van mešovitih nedelja),
  nedelja ≥ minimum (7,5/10/12,5; trkačka 4) osim nedelje sa danima odmora, nema treninga na dan odmora ni kvaliteta u
  danima bola/odmora, nema ubrzanja u danima bola, 0 grešaka validatora, prošlost (dani ≤ asOf) bajt-ista, deo
  trčanja/hodanja pre prelaza bajt-isti. 0 odstupanja; 0 odbijenih tokova.
- Pauza 20 dana + bol 8 u istom koraku (6 kontinuiranih planova, asOf = nedelja obe nedelje mreže): 9 tokova sa
  povratkom i ciljem pauze; cilj r = cilj pauze; min deluje u 7 (osnova = cilj pauze < 0,7 × nivo) i poruka tada kaže
  „… rast kreće od {osnova} km (cilj nedelje r; 70% nivoa pre bola bilo bi {x} km)"; r + 1 po I1; 0 grešaka validatora.
- Determinizam: drugi poziv = isti JSON (svaki 9. tok).

## 6. Sabotaže (pokvari → test pada → vrati; `npx vitest run --project node src/domain/generators/fiveK/v2`, 627 testova)

| Sabotaža | Palih testova | Šta pada |
|---|---|---|
| (a) `returnFrom.week` = poslednja nedelja bola (assess) | 14 | 08d: korak/poruka, I1–I4, regresija P, pauza + bol, B–E i drugi; app KNOWN_VERSIONS |
| (b) osnova = 0,7 × cilj nedelje r bez nivoa (`returnBaseKm`) | 17 | 08d: korak/poruka, I1, I4, pauza + bol, A–E i drugi; segment07 „bol"; app „7. bol 5 → traka", app KNOWN_VERSIONS |
| (c) bez min sa ciljem nedelje r (`returnBaseKm`) | 1 | 08d „pauza + bol" (min deluje u 7 tokova; bez pauze min ne deluje) |
| (d) validator zadrži staro pravilo (0,7 × cilj nedelje sidra) | 37 | segment06 mreža (19 planova) i „bol + pauza", 08d (među njima regresija postojećih mreža), app — validator odbija planove nove konstrukcije |
| (e) `doseResetAt` bez dopune za bol | 7 | 08d: regresija P (odbijanja se vraćaju), nekadašnja odbijanja, nov start doze (2), prihvaćeni tokovi, korak/poruka, I1 |

Posle svake sabotaže fajl vraćen iz kopije (`cmp` = isti); konačno stanje: 627/627. Liste palih testova za (a)–(e) iz
pokretanja na konačnom kodu: brojevi tačni, opisi skraćeni.

## 7. Komande i rezultati (iz `web/`)

| Komanda | Rezultat |
|---|---|
| `npx tsc -b --noEmit` | exit 0 |
| `npx eslint .` | exit 0 |
| `npx prettier --check .` | exit 0 („All matched files use Prettier code style!") |
| `npx vitest run --project node src/domain/generators/fiveK/v2` | 15 fajlova, 627 testova, svi prolaze (~17 s); na bf47249 (checkout): 14 fajlova, 606 testova |
| `npx vitest run --project node src/domain/generators/tenK/v2/app/byteSame.node.test.ts` | 2/2 posle ponovnog snimka 5K v2 ključeva; pre toga, sa privremeno vraćenom oznakom `5k-v2.6.0` na konačnom kodu: 2/2 |
| `npm run check` | exit 0 — typecheck, lint, format; vitest 220/220 fajlova, 2700/2700 testova (12 min 43 s); isolation.node.test.ts bez novih izuzetaka |
| `npx playwright test e2e/fivek-v2.spec.ts` | 3/3 (52 s; build + preview) |
| `node docs/5k-v2/artifacts/segment-08d/regression-bf47249.ts <wt>` | 732 + 392 heševa; dva pokretanja bajt-ista |
| `node docs/5k-v2/artifacts/segment-08d/examples.ts <wt>` | examples.md (A–E pre/posle) |

## 8. AGENTS.md — stalni uslovi 1–8

1. Jedan vlasnik odluke: osnovu povratka računa samo `volume.returnBaseKm`; `adaptVolume` (konstrukcija), validator i
   poruka PAIN je zovu. assess određuje samo sidro (r) i nivo. Validator samo prijavljuje.
2. Jedan plafon po zoni: bez novih limita; povratni rast i rasterećenje su postojeća pravila.
3. WU/CD nisu dirani; manjak ide u lagane dane kao do sada (planirano < cilj u nedeljama bola).
4. Adaptacija: sidro i nivo ulaze u konstruktor kroz korak (`returnFrom`, `levelKm`); završna zaštita ne menja plan.
5. Handoff: nema promene (prelaz trčanje/hodanje → kontinuirani prima samo činjenice; odluka važi u kontinuiranom delu).
6. Plan nosi `policyId`/`policyVersion` = `5k-v2`/`5k-v2.6.1` i fazu svake nedelje; sačuvan 5k-v2.6.0 je poznata verzija.
7. Nula uvoza van `fiveK/v2/` (isolation.node.test.ts prolazi bez novih izuzetaka; `testInputs.ts` uvozi samo `dates.ts`
   i tipove, heš je u testu/skripti).
8. Upotrebljivost: I5 (km > 0, dugi ≥ lagan, nedelja ≥ minimum, 0 grešaka validatora) na svih 392 toka mreže P i 732
   toka postojećih mreža; nijedan tok bola sa povratkom nije odbijen (pre odluke o sudaru 1: 24 toka „plan nije
   prilagođen", na bf47249 44).

## 9. Preostali problemi

### 9.1 SUDAR — bol u bazi + BASE_R_DECREASE — rešeno odlukom organizatora

- Pravila: 2.3.0 Odluka 6 (`BASE_R_DECREASE`: R doza u bazi ne pada između ne-rasteretnih nedelja istog segmenta
  progresije) i 2.5.0 (`steps.doseResetAt`: progresija doze počinje iznova samo uz cilj koraka — pauza, izvršenje, nov
  start — ne uz bol). Bol smanjuje obim izgradnje (u 2.6.0 i u 2.6.1) bez novog segmenta doze, pa kad je nedelja posle
  povratka još u bazi, manji obim daje manju R dozu i validator odbija plan (`PLAN_VIOLATES_POLICY`).
- Ulaz: `v45-d4-22km-14w` (adaptNetwork: start 2026-11-02, trka 2027-02-07, uto/čet/sub/ned, 22 km, 5 km 22:20, cilj
  21:20); faze 1–5 baza (ned 4 rasterećenje), ciljevi 22 · 23,7 · 25,5 · 20,4 · 27,5. Bol na dan asOf u ned 3
  (2026-11-16 … 2026-11-22).
- Brojevi (2.6.1): r = 3, nivo 23,7 (ned 2), osnova min(16,6, 25,5) = 16,6 → ned 4 = 13,3, ned 5 (baza) = 18,2 km →
  R ned 5 = 0,90 km < R ned 2 = 1,00 (asOf pon–sre) ili ned 3 = 1,20 (asOf čet–ned) → `BASE_R_DECREASE`, ned 5.
  Subota/nedelja uz bol 7/8: odmor + bol sežu u ned 5 (ograničen kvalitet, nedelja van niza doze) → prihvaćeno.
- Obim: 24 toka mreže P (pon–pet × bol 4/5/7/8 = 20; sub, ned × bol 4/5 = 4). Na bf47249 isti sudar odbija 22 od njih
  (R 0,75 < 1,00/1,20). **Nova odbijanja: 2** — asOf petak 2026-11-20, bol 7 i 8 (odmor 21–23. 11., bol 24–30. 11.;
  30. 11. je ponedeljak ned 5, nije dan trčanja). Na bf47249 sidro je bilo ned 5 (poslednja nedelja bola) → ned 5 pun
  cilj 27,5 sa 2 kvaliteta (R 1,20), pad tek u ned 6 (vrhunac 21,2) — upravo greška iz nalaza; 2.6.1 to ispravlja
  (ned 5 = 18,2), pa tok udara u postojeći sudar.
- Postojeće mreže (732): 0 odbijanja.
- **Odluka (pravac a):** korak bola sa povratkom počinje novu progresiju doze od r + 1, ako je r + 1 nedelja izgradnje
  (`steps.doseResetAt`, isti mehanizam kao korak sa ciljem; konstruktor i validator čitaju istu funkciju).
  BASE_R_DECREASE nepromenjen (poredi od novog starta doze). Tumačenje: korak sa pauzom i bolom zadržava start pauze
  (r, odnosno sledeća nedelja), koji već obuhvata r + 1.
- **Rezultat:** 0 odbijenih tokova u mreži P (392) i postojećim mrežama (732). Nekadašnjih 24 toka: ned 5 = 18,2 km,
  R 0,80 + T_short 1,00, 0 grešaka validatora. Doze posle r + 1 promenjene u 14 tokova s06/pain5 (§ 4.1a), ostali
  bajt-isti prema bf47249. Sabotaža (e) obara 7 testova.

### 9.2 SUDAR — 10K snimak `byteSame` sadrži oznaku verzije 5K v2 — rešeno odlukom organizatora

- `web/src/domain/generators/tenK/v2/app/byteSame.node.test.ts` (10K v2 Segment 05) poredi SHA-256 tokova kroz aplikaciju
  (5K v1, 10K v1, HM, maraton, **5K v2**, lični plan) sa snimkom `byteSame.068410b.json`. Ključevi 5K v2 hešuju i
  `policyVersion` (plan, `generator` = [id, policyId, policyVersion, …], `policy`, `cilj`, `prilagođavanje`,
  `generisanje`, `adaptacija`), pa svaka nova verzija 5K v2 menja snimak.
- Odluka traži `version = '5k-v2.6.1'` (tačka 7), a 10K je van dozvoljenih putanja („Ništa u 10K"). Padaju oba testa:
  „snimak tokova … je isti" i „uključen prekidač 10K v2 ne menja 5K v1/v2 …".
- Dokaz da je razlika samo oznaka: sa privremeno vraćenom `policy.version = '5k-v2.6.0'` (ostatak 08d nepromenjen) oba
  testa prolaze (2/2); tokovi tog testa nemaju bol (adaptacija sa praznim činjenicama).
- **Odluka (pravac a):** izričita dozvola za jedan fajl, `tenK/v2/app/byteSame.068410b.json`, samo ključevi „5K v2".
- **Postupak:** `BYTE_SAME_RECORD=1` (snimak celog skupa) u kopiju, pa spajanje: stari fajl, a za ključeve „5K v2" nove
  vrednosti. Isti format (`JSON.stringify(…, null, 2)` + `\n`), isti redosled ključeva.
- **Dokaz:**
  (1) diff: 140 ključeva, promenjeno 19, svi „5K v2 …" (od 41 ključa „5K v2"; po planu #0/#1/#2: generisanje, plan,
      generator, policy, prilagođavanje, adaptacija, i kod #0 cilj); ostalih 99 ključeva bajt-isti (i u punom novom
      snimku), pa je spojen fajl jednak punom novom snimku;
  (2) sa privremeno vraćenom `version = '5k-v2.6.0'` na konačnom kodu (posle izmene doze) oba testa prolaze 2/2 sa starim
      snimkom, pa su novi heševi isti kao stari osim oznake;
  (3) tokovi tog testa nemaju bol: adaptacija sa praznim činjenicama, a `bol` ključevi (painStatus) nisu promenjeni —
      potvrđeno posle izmene doze iz sudara 1, kroz (2).
- `tenK/v2/app/byteSame.node.test.ts` 2/2. Rečenica o osvežavanju je u komentaru na vrhu `segment08d.node.test.ts`
  (10K test nije diran, § 2).

### 9.3 Ostalo

- Sačuvan korak iz 5k-v2.6.0 se ponavlja kako je sačuvan: njegov `returnFrom.week` ostaje poslednja nedelja bola, a
  osnova se računa po 2.6.1 (`min(0,7 × nivo, cilj te nedelje)`). Primer B sačuvan na bf47249 (sidro 5), prilagođen u
  2.6.1 bez novih činjenica (asOf 2026-11-22): ned 5 ostaje 45,6 (pun cilj), ned 6 35,0 → 33,2. Isto ograničenje kao
  10K 06b.
- Min sa ciljem nedelje r deluje samo kad isti korak ima i pauzu (cilj pauze < 0,7 × nivo): 7 od 9 merenih tokova
  pauza + bol; bez pauze cilj r ≥ 0,7 × nivo u svih 380 tokova sa povratkom u mreži P.
- Poruka koristi postojeći format brojeva 5K poruka (tačka: „30.2 km"), kao `growthNote` i ostale poruke 5K v2.
