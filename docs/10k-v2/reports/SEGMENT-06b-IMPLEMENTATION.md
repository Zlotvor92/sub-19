# 10K v2 — Segment 06b (10k-v2.4.1): bol — povratak ne zavisi od dana u nedelji (A4/A8)

Polazni SHA `e6540a5` (Segment 06), grana `claude/generator-isolation-5k-10k-hm-marathon`. Menjano samo
`web/src/domain/generators/tenK/v2/` i `docs/10k-v2/`; izuzeci (samo oznaka verzije): `web/e2e/tenk-v2.spec.ts` i
`web/src/features/onboarding/tenKV2Flow.test.tsx` (v. 2, odstupanje). Ništa u `fiveK/`, 10K v1, HM, maratonu ni
zajedničkom kodu. Bez PR-a, mergea i deploya.

## 1. Odluka (doslovno, DECISIONS A4 10k-v2.4.1)

> Bol ≥ 4 u poslednja 3 dana → 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min (sporim E), lagani × 0,7 (≥ 3 km,
> ≤ dugi); bol ≥ 7 → najpre 3 dana odmora, pa isto; poruka o stručnom pregledu; nedelja sa danom bola/odmora ima
> najviše 1 kvalitet doze rasterećenja. Sidro povratka (10k-v2.4.1, A16) = nedelja r koja sadrži asOf + 1 (prvi dan
> odmora ili bola, kao firstWeek koraka); cilj nedelje r ostaje (dani u periodu bola i odmora su ograničeni,
> planirano ≤ cilj); posle nedelje r rast kreće od osnove = min(0,7 × nivo pre bola, cilj nedelje r) [0,1 km] (nivo:
> A8; pauza u istom koraku: najveći nivo koraka; korak bez nivoa: 0,7 × cilj nedelje r); od nedelje r + 1 povratni
> rast A8 do nivoa, pa D6 — i u nedeljama sa danima bola posle r (dani ostaju ograničeni: bez kvaliteta i ubrzanja,
> dugi ≤ 60 min, lagani × 0,7); rasterećenje posle sidra = 0,8 × osnova. Povratak samo kad je r nedelja izgradnje
> (taper i trkačka nedelja nemaju povratak). Poruka: „Posle nedelje r rast kreće od 70 % nivoa pre bola (osnova km)."

A8 dopunjen jednom rečenicom (sidro): „Bol (A4, 10k-v2.4.1): posle nedelje sidra r (sadrži asOf + 1) osnov rasta je
min(0,7 × nivo pre bola, cilj nedelje r), ne cilj poslednje nedelje bola. Rasterećenje u povratku … (posle sidra bola
0,8 × osnova)". Novi zapis **A16** (izmena 10k-v2.4.1) sa obrazloženjem i primerima A–E. Nijedan nov broj (0,7 =
`painEasyFactor`, 10 % = `returnGrowth`, 0,8 = `deload.factor`). A1–A3, A5–A15 nepromenjeni.

## 2. Fajl → izmena

| fajl                                                             | izmena                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenK/v2/assess.ts`                                              | `returnFrom = { week: r, share }` kad je r izgradnja (bilo: `weekOf(pain.to)`); nivo kao do sada (`levelBefore` prvog dana bola). Poruka PAIN bez „70 % njenog cilja"; dopuna `painReturnNote(step, ciljR10)` (izvezena): „Posle nedelje r rast kreće od 70 % nivoa pre bola (X km)." + postojeći `growthNote` (sada modulski, isti tekst). Osnovu računa `volume.returnBase10`. |
| `tenK/v2/volume.ts`                                              | `ReturnAnchor { share, base10 }`, `returnAnchor(share, levelKm)` (base10 = round(0,7 × nivo koraka), null bez nivoa), `returnBase10(a, cilj10)` = min(base10, cilj r) ili round(0,7 × cilj r) bez nivoa. `adaptVolume.anchors`: nedelja → `ReturnAnchor`; `leaveWeek`: `lastBuild10 = returnBase10(sidro, cilj nedelje r)`. Jedino mesto obima posle bola.                       |
| `tenK/v2/adapt.ts`                                               | posle konstrukcije poruka PAIN dobija `painReturnNote` sa **konstruisanim** ciljem nedelje r (`c.weeks[r-1].targetKm`). Razlog: pauza iz istog koraka smanjuje cilj nedelje r (A3), pa cilj r iz ulaznog plana dao bi pogrešan broj u 56/120 tokova `painPause` mreže 04 (izmereno pre ove izmene). Obim se ne računa ovde (samo poziv `returnBase10`).                          |
| `tenK/v2/policy.ts`                                              | `version: '10k-v2.4.1'`; tekst A4, A8 (mesto: `returnBase10, leaveWeek`); zapis A16.                                                                                                                                                                                                                                                                                             |
| `tenK/v2/types.ts`                                               | komentar `returnFrom` (nova semantika; oblik isti).                                                                                                                                                                                                                                                                                                                              |
| `tenK/v2/app/plan.ts`                                            | `KNOWN_VERSIONS = ['10k-v2.4.0', P.version]` (= `10k-v2.4.1`); komentari.                                                                                                                                                                                                                                                                                                        |
| `tenK/v2/testInputs.ts`                                          | mreža P: `PAIN_GRID`, `PAIN_LEVELS`, `painGridBases`, `painFacts`, `painCases`.                                                                                                                                                                                                                                                                                                  |
| `tenK/v2/painGrid.node.test.ts` (nov, 16 testova)                | mreža P (336), regresija P prema e6540a5, korak i poruka, I1–I5, determinizam, pauza + bol (min sa ciljem r), primeri A–E.                                                                                                                                                                                                                                                       |
| `tenK/v2/segment06b.adapt-hashes-e6540a5.json` (nov)             | 2040 + 336 heševa izlaza adaptacije na e6540a5 (`planHash81`, bez oznake verzije).                                                                                                                                                                                                                                                                                               |
| `tenK/v2/adapt.node.test.ts`                                     | test regresije mreže 04 prema e6540a5; očekivanja `TEST_MOVED` (v. ispod).                                                                                                                                                                                                                                                                                                       |
| `tenK/v2/policy.node.test.ts`                                    | oznaka verzije, lista DECISIONS + A16, provera teksta A4/A8/A16.                                                                                                                                                                                                                                                                                                                 |
| `tenK/v2/periodize.node.test.ts`, `tenK/v2/app/app.node.test.ts` | samo oznaka verzije `10k-v2.4.0` → `10k-v2.4.1`.                                                                                                                                                                                                                                                                                                                                 |
| `tenK/v2/app/adaptFlow.node.test.ts`                             | nov obavezan test: plan 4.0 ostaje v2, prilagođavanje po 4.1 nosi `10k-v2.4.1`, ostale verzije `UNKNOWN_POLICY`.                                                                                                                                                                                                                                                                 |
| `web/e2e/tenk-v2.spec.ts`                                        | samo oznaka verzije (`"policyVersion":"10k-v2.4.1"`).                                                                                                                                                                                                                                                                                                                            |
| `web/src/features/onboarding/tenKV2Flow.test.tsx`                | **odstupanje od spiska**: samo oznaka verzije u `toMatchObject` sačuvanog plana; test proverava oznaku generisanog plana i padao bi. Ništa drugo.                                                                                                                                                                                                                                |
| `docs/10k-v2/artifacts/segment-06b/`                             | `regression-e6540a5.ts` (heševi iz checkouta e6540a5), `run.ts` + `inputs.json`, `cases.json`, `examples.md` (A–E pre/posle).                                                                                                                                                                                                                                                    |
| `docs/10k-v2/STATUS.md`, ovaj izveštaj                           | —                                                                                                                                                                                                                                                                                                                                                                                |

`features/plan/tenKV2Adapt.test.tsx` ne proverava oznaku verzije ni tekst poruke PAIN — nije menjan. `byteSame`
(10K v1, prekidač isključen) nije menjan i prolazi.

Izmene postojećih očekivanja (staro → novo, zašto):

1. `adapt.node` „rezultati po scenariju": `pain8.TEST_MOVED` 10 → 9, `painPause.TEST_MOVED` 13 → 9. U 2.4.0 test 5 km
   (planovi po osećaju, asOf kraj ned 2) je otpadao jer je obim posle kasnog sidra bio premali (A9: test samo uz dugi ≥ 5
   km; `painPause`: 0,7 × cilj pauze = dvostruko smanjenje). U 2.4.1 obim posle r je veći, pa test staje: u 5 tokova ostaje
   u svojoj nedelji (više nije „premešten": `d4-f-18w` pain8; `d3/d4/d5/d6-f-18w` painPause), u ostalim se premešta umesto
   da otpadne (i dalje se broji). Ni jedna odluka o testu (A13) nije menjana.
2. `policy.node`: `10k-v2.4.0` → `10k-v2.4.1`; A1–A15 → A1–A16.
3. `app.node`, `periodize.node`, `tenKV2Flow`, E2E: samo oznaka verzije.
4. `adapt.node` test A4 (asOf kraj ned 8, bol u ned 9) i pouka 7 (g) prolaze bez izmene: kod njih je r = poslednja nedelja
   bola (`returnFrom.week = 9`), formula `returnFrom.week + 1` važi i sa novom semantikom.

## 3. Slučajevi A–E (cilj / planirano po nedelji; e6540a5 → 10k-v2.4.1)

Ulaz: 4 dana (uto/čet/sub/ned), start 2026-10-26, trka 2027-01-24 (13 ned), 40 km, 10 km 45:00, cilj 43:00. Bazni plan:
ned 3 = 44,9, ned 4 = 35,9 (rasterećenje), ned 5 = 47,6, ned 6 = 50,5. Ceo plan: `artifacts/segment-06b/examples.md`.

| slučaj                      | r   | nivo → osnova | ned 4                                  | ned 5                                                  | ned 6       |
| --------------------------- | --- | ------------- | -------------------------------------- | ------------------------------------------------------ | ----------- |
| A asOf 11-15, bol 5 (11-14) | 4   | 42,4 → 29,7   | 35,9/26,6 → isto                       | 27,6/27,6 · 2 kv → **32,7/32,67 · 2 kv**               | 30,4 → 36,0 |
| B isto, bol 8               | 4   | 42,4 → 29,7   | 35,9/21,0 → isto                       | 47,6/44,0 · 1 kv → **32,7/30,59 · 1 kv** (pon–sre bol) | 36,6 → 36,0 |
| C asOf 11-18, bol 5 (11-18) | 4   | 44,9 → 31,4   | 35,9/29,1 → isto                       | 47,6/44,0 · 1 kv → **34,5/32,19 · 1 kv**               | 36,6 → 38,0 |
| D isto, bol 8               | 4   | 44,9 → 31,4   | 35,9/17,9 → isto                       | 47,6/37,9 · 0 kv → **34,5/27,3 · 0 kv**                | 36,6 → 38,0 |
| E asOf 11-13, bol 7 (11-13) | 3   | 42,4 → 29,7   | 35,9/27,1 → **23,8/18,9** (0,8 × 29,7) | 47,6/47,57 · 2 kv → **32,7/32,67 · 2 kv**              | 36,6 → 36,0 |

Prema računici organizatora (A 32,7; B 32,7; C i D 34,5; E ned 4 23,8, ned 5 32,7): razlika 0,0 km u svim slučajevima.
Nedelja r je u svim slučajevima bajt-ista kao u e6540a5 (cilj r ostaje). U E ned 4 sada ima 4 dana bola i planirano 18,9
(e6540a5: 27,1 uz pun cilj 35,9). Poruka PAIN (A): „… Posle nedelje 4 rast kreće od 70 % nivoa pre bola (29,7 km).
Povratak do 42,4 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8)."

## 4. Regresija

- **Generator bez činjenica bajt-isti** (jedino oznaka verzije): R 15 840, F 11 880, B 3402 prema
  `segment04.plan-hashes-b13ca17.json` (heš bez oznake verzije) — `grid`, `feelGrid`, `beginnerGrid` prolaze bez izmene.
  Bazne linije `segment02*/03*.baseline.json` nose istorijske oznake (2.2.0, 2.2.1, 2.3.0, 2.3.1), ne tekuću — nisu
  osvežavane ni menjane.
- **Mreža 04** (30 × 4 asOf × 17 scenarija = 2040, heševi e6540a5 iz `segment06b.adapt-hashes-e6540a5.json`):
  promenjeno **240** — `pain5` 80, `pain8` 80, `painPause` 80; ostalih 14 scenarija (1680 tokova) bajt-isto. Svaki
  promenjen tok ima primenjen PAIN; promenjen je tačno svaki tok sa povratkom posle bola (240); 40 tokova po PAIN
  scenariju bez povratka (r = taper: asOf u taperu 30, kraj ned 8 u planovima od 10 ned 10) bajt-isto (test).
- **Mreža P** (336): promenjeno **332**, svi PAIN; 4 bez povratka (`beg-d4-r-12w`, asOf nedelja ned 10 → r = 11 taper,
  bol 4/5/7/8) bajt-isto.
- Mreža 04 posle izmene: 0 odbijanja, 0 grešaka validatora, invarijante (`adaptInvariants`) 0, deterministička.

## 5. Invarijante I1–I5 (mreža P; nezavisno od volume.ts — nivo iz baznog plana, brojevi iz policy.ts)

|                                                                                                                                                     | 10k-v2.4.1                                                | e6540a5 (isti proračun)            |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| I1: r + 1 izgradnja (216 tokova) = povratni rast od osnove, ≤ max(osnova + max(10 %, 1,0), min D17), ≤ nivo; r + 1 rasterećenje (88) = 0,8 × osnova | 0 prekršaja                                               | 214 / 216                          |
| I2: cilj r + 1 isti za isti plan, nivo, r (23 grupe)                                                                                                | 0 grupa sa > 1 vrednosti                                  | 13 / 23                            |
| I3: bol 8 ≤ bol 5 istog dana (84 para)                                                                                                              | cilj: 0 van trkačke nedelje; izuzeci nabrojani (v. ispod) | 92 nedelje cilj veći, 93 planirano |
| I4: od r + 1 do nivoa ≤ prethodna (prva: osnova) + max(10 %, 1,0) (332 toka)                                                                        | 0                                                         | 256 / 332 tokova                   |
| I5: km > 0, dugi ≥ lagan, ≥ min D17, dani odmora/bola bez kvaliteta/ubrzanja, 0 grešaka validatora, zaštita prošlosti bajt-isto (336)               | 0                                                         | —                                  |

I3 — **sudar sa D8/D23/D19 (nije rešavan novim pravilom)**:

- Trkačka nedelja, 3 toka: `d5-f-18w` (5 dana, po osećaju 6:00, 45 km, 18 ned), asOf 2027-02-05/06/07 (pet/sub/ned
  ned 14), ned 18: bol 5 → 18,8 km, bol 8 → **22,8 km**. Uzrok: uz bol 8 period bola ulazi u ponedeljak ned 16 →
  ned 16 ima ograničenje (1 kvalitet), doza RP ostaje niža, taper (ned 17, 34,7 km u oba) ima 1 kvalitet i lagane po 5,0
  km umesto 3,0 km; D23 (lagani trkačke ≤ najkraći lagani tapera) i D8 (cilj trkačke = planirano) daju veću trkačku
  nedelju. Cilj nedelja 1–17 isti ili manji.
- 16 nedelja (posle dostignutog nivoa, isti cilj, bez dana bola) sa planiranim većim za ≤ 0,06 km: zaokruženje dana uz
  drugi sled doze (D19, tolerancija planirano/cilj 0,1 km).
- Test I3 zato: cilj strogo u svim nedeljama osim trkačke; planirano strogo u nedeljama bola i uz različit cilj; izuzeci
  nabrojani tačno (3 trkačke, 16 zaokruženja) — svaki nov izuzetak obara test. Odluku (da li I3 važi i za trkačku nedelju
  i zaokruženje) ostavljam organizatoru.

Pauza + bol u istom koraku (`painPause` za 6 planova P × 14 asOf): asOf nedelja (r = n, 10 tokova) — cilj r = cilj pauze,
r + 1 raste od min(0,7 × nivo koraka, cilj pauze); min deluje u svih 10 (npr. `beg-d4-r-12w` 2026-12-20: nivo 30,5,
0,7 × nivo 21,4, cilj pauze 15,5 → osnova 15,5, ned r + 1 rasterećenje 12,4). asOf u sredini nedelje (66 tokova):
r + 1 = fromWeek pauze dobija cilj pauze (A3), sidro je bez dejstva.

## 6. Sabotaže (pokvareno → ceo `tenK/v2` node skup, 267 testova → vraćeno; dokaz vraćanja: `git diff --stat` isti)

| sabotaža                                            | palih testova                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| (a) `week` = poslednja nedelja bola (staro pravilo) | **10** (mreža P: regresija, korak/poruka, I1, I2, I3, I4; primeri B, C, D, E)                          |
| (b) osnova = 0,7 × cilj nedelje r bez nivoa         | **12** (mreža 04 statistika, P: korak/poruka, I1, I3, I4, pauza + bol, A–E sva 5, `adaptFlow` 4.0/4.1) |
| (c) bez min sa ciljem nedelje r                     | **1** (pauza + bol u istom koraku)                                                                     |
| (d) sidra se ignorišu                               | **12** (`adapt.node` A4, P: I1, I2, I3, I4, A–E sva 5, `adaptFlow` vraćanje i 4.0/4.1)                 |

(c) obara samo test pauze + bola: u čistom bolu cilj nedelje r nikad nije ispod 0,7 × nivo (mreža P i 04), pa min deluje
samo uz pauzu u istom koraku (10/10 nedeljnih asOf u P, 56/120 tokova `painPause` mreže 04).

## 7. Komande i rezultati (iz `web/`, osim gde piše)

- Pre izmene, na e6540a5: `node docs/10k-v2/artifacts/segment-06b/regression-e6540a5.ts <checkout e6540a5>` → 2376
  heševa (2040 + 336), ≈ 18 s; prettier.
- `npx tsc -b --noEmit` exit 0; `npx eslint .` exit 0; `npx prettier --check .` exit 0.
- `npx vitest run --project node src/domain/generators/tenK/v2`: **21 fajl, 267 testova, sve prolazi, 138 s**
  (e6540a5: 20 / 249).
- `npm run check` (typecheck, eslint, prettier, svi testovi): **exit 0 — 219 fajlova, 2679 testova** (782 s testovi; na
  konačnom kodu, posle poslednje izmene teksta A16).
- `npx playwright test e2e/tenk-v2.spec.ts`: **3/3** (59 s).
- Primeri: `node docs/10k-v2/artifacts/segment-06b/run.ts <checkout e6540a5>` dva puta → `cases.json`, `examples.md`,
  `inputs.json` bajt-isti (sha256).
- Ponovo pročitan diff: obim posle bola računa samo `volume.ts` (`returnAnchor`, `returnBase10`, `leaveWeek`;
  `adaptNominal10`/`enterWeek` nepromenjeni). `assess.ts` određuje samo sidro i nivo; `adapt.ts` i `assess.painReturnNote`
  samo prikazuju broj iz `returnBase10`. Validator čita isti `adaptVolume`/`leaveWeek` (bez izmene u `validate.ts`).

## 8. Stalni uslovi (AGENTS.md 1–8)

1. Jedan vlasnik: `assess.ts` odlučuje sidro (r) i nivo; `volume.ts` jedino računa obim (osnova u `leaveWeek`); bez
   petlji. Validator samo prijavljuje (nepromenjen; prati izmenu kroz `adaptVolume`/`leaveWeek`).
2. Plafoni nedirnuti.
3. WU/CD nedirnuti; manjak obima u nedeljama bola ostaje „planirano < cilj".
4. Uslov poznat unapred (bol, nivo) ulazi u konstruktor kroz korak; završna zaštita samo proverava (I5: prošlost
   bajt-isto).
5. Handoff: bez izmene.
6. Plan nosi `10k-v2`/`10k-v2.4.1` i fazu svake nedelje; sačuvan plan 4.0 ostaje poznat (test `adaptFlow.node`).
7. `isolation.node.test.ts` prolazi bez novih izuzetaka; novi kod uvozi samo iz `tenK/v2/`.
8. Upotrebljivost: I5 na 336 tokova i `adaptInvariants` na mreži 04 — nijedan prazan trening, dugi ≥ lagan, nedelje
   ≥ minimum D17, bez kvaliteta u danima bola.

## 9. Preostali problemi

1. **Sačuvani 4.0 koraci zadržavaju staro sidro.** Koraci se ponavljaju kako su sačuvani (A14), a oblik je isti (odluka
   6), pa korak iz 10k-v2.4.0 nosi `week` = poslednja nedelja bola i u 4.1 se tumači kao sidro. Izmereno (ulaz A–E): plan
   prilagođen u e6540a5 (B: `returnFrom.week = 5`; C isto), pa ponovo u 4.1 bez novih činjenica istog dana: ned 5
   ostaje **47,6** (B i C), ned 6 = 32,7 (B) / 34,5 (C); svež 4.1 daje ned 5 = 32,7 / 34,5. Plan 4.0 sa bolom koji je
   prešao u sledeću nedelju zadržava pun cilj te nedelje dok ga nov korak ne promeni. Ispravka bi tražila odluku (npr.
   ponovna procena sidra starog koraka iz `pain`/`rest` datuma) — nije rađeno.
2. **I3 i trkačka nedelja / zaokruženje** (v. 5): odluka organizatora.
3. **Tekst poruke kad min deluje**: uz pauzu u istom koraku broj u „70 % nivoa pre bola (X km)" je cilj pauze (min),
   ne 70 % nivoa (npr. 15,5 umesto 21,4). Tekst je doslovno iz odluke 5.
4. **Pauza + bol, asOf u sredini nedelje**: r + 1 je fromWeek pauze i dobija cilj pauze (A3 ima prednost u
   `adaptNominal10`), ne osnova + 10 %; r + 1 je isti kao u 2.4.0, a od r + 2 rast ide od cilja pauze (2.4.0: od 0,7 ×
   cilj pauze; npr. `d3-f-18w`, asOf sreda ned 6: ned 8 rasterećenje 10,7 → 15,4, ned 9 14,7 → 21,1).
5. 5K v2 ima isti problem (A4/A8) — poseban segment, `fiveK/` nedirnut.
