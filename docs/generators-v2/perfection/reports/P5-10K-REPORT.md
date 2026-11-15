# P5-10K — kontrolni test, kvalitet u adaptaciji, ubrzanja, početna doza (10k-v2.12.0)

10. 11. 2026 (Europe/Belgrade). Polazno `72003c1` (10k-v2.11.0); STOP `df3bdc4` + dopuna `01623a1`
(`reports/P5-10K-STOP.md`). Izmene u `web/src/domain/generators/tenK/v2/**` i dokumentaciji (van foldera: v. dole).
Ćelija: medijana [min–max].

## Odluke organizatora posle STOP-a

1. **O1** — nedelja kontrolnog testa u kojoj je drugi slot spušten (DOSE_DROPPED) je referenca „glavna doza ne opada"
   (samo validator; planovi isti). 2. Nedelje > 25 % brzih 5 → 7 (test se broji kao brz) — prihvaćeno. 3. Kontrolni
   test u nedelji sa ograničenjem otpada i ne premešta se, uz napomenu. 4. **P-b** — početni nivo T/I = najviši nivo
   ≤ 80 % plafona za koji nedelja ne postaje nedelja pouke 35; inače nivo po 60 %.

## Šta je ugrađeno (policy.ts: D35–D38, dopune D16/D27; `policyVersion` 10k-v2.12.0)

- **D35 (F1)**: `periodize.testKindOf` (jedino mesto: 'feel' D27, 'control' plan sa rezultatom ne-početnik od
  `test.controlMinWeeks` 12 nedelja, null), `testWeekOf` (kontrolni: poslednja ne-rasteretna nedelja razvoja); test isti
  kao D27 na danu Q1; napomena nedelje (`CONTROL_TEST_NOTE`) i plana („Unesi rezultat — tempo treninga se prilagođava od
  sledeće nedelje"). Adaptacija bez promene (A1, A13). Validator TEST po vrsti testa; O1 u MAIN_DOSE_DECREASE.
- **D36 (F3)**: `week.stridesChoice` (jedino mesto, konstruktor i validator): nedelja izgradnje/rasterećenja/tapera
  posle uvoda — jedan lagan dan (ne dan bola), najveći razmak od poslednjeg zahtevnog dana (i prethodne upisane nedelje,
  `ctx.prevHard`), pri jednakom raniji; baza i početnik 4 × 20 s, od razvoja 6 × 20 s (`policy.strides`).
  `workouts.easyStridesWorkout`: dužina dana ista (lagan deo = km − ubrzanja i oporavak, oporavak isti metraž kao D8).
  Validator STRIDES.
- **D37 (F4 + P-b)**: `policy.startLevel.capShare` po zoni (T, I 0,8; R, RP 0,6; `startShare`), `p35FloorShare` 0,6;
  `quality.pickBuild` → `startWithoutP35` (jedino mesto odluke početnog nivoa T/I; konstruktor daje činjenicu
  `keepsTwo` = isti predikat `qualityOverLong`, kao `can` u `volume.fit10`). Validator START_LEVEL: opseg [60 %, 80 %].
- **D38 (F2)**: `assess` korak QUALITY_HOLD (`step.holdDose`): dva poslednja dana Q1/Q2 do asOf, oba u 14 dana i
  pokrivena, svaki bez završenog zapisa ili RPE ≥ 9 → nedelja fromWeek (ne-rasteretna izgradnja) bez rasta doze
  (`pickSlot` hold: ista doza / druga struktura; prelaz koji nosi dozu bez podizanja na početni nivo). Ispod bola, pauze,
  umora, manjka (applied false); isti zapisi se ne sude ponovo. Napomena nedelje `HOLD_NOTE`, poruka `adapt.qualityMessage`;
  app: CONDITION „zahtevni treninzi preteški ili preskočeni", traka „Plan treba prilagoditi" (CHANGE). Validator:
  izuzeci DOSE_STALL, BASE_PLATEAU, IDENTICAL_WEEKS, START_LEVEL za nedelju holdDose.
- Stalni uslovi: 1 (vrsta i nedelja testa `testKindOf`/`testWeekOf`; dan ubrzanja `stridesChoice`; početni nivo
  `pickBuild`; okidač F2 `assess`; validator samo prijavljuje), 2 (bez novog plafona), 3 (WU/CD netaknut; ubrzanja nisu
  km), 4 (F2 u konstruktoru preko koraka), 6 (verzija; faza nedelje), 7 (`isolation.node.test.ts` zelen), 8
  (`gridInvariants`: STRIDES_ONE/DOSE/DAY, TEST_ONE za kontrolni test).

## Komande merenja (iz `web/`; nisu testovi)

- **K1** `node ../docs/generators-v2/perfection/P5-10K/measure.ts pre|posle` (≈ 1 s; `pre` u stablu 72003c1) i
  **K3** `node ../docs/generators-v2/perfection/P5-10K/summary.cjs pre posle`.
- **K2** `node ../docs/generators-v2/perfection/P5-10K/bigGrid.ts <oznaka>` — mreže 01/02/F/B (34 146), ≈ 90–120 s.
- **K4** `…/P5-10K/p35split.ts` (nedelje pouke 35 na mreži 02), **K5** `…/P5-10K/tshare.ts` (udeo rada prvog T/I dana),
  **K6** `…/P5-10K/f2Flows.ts` (tokovi F2), **K7** `…/P5-10K/profile.ts pre|posle` → `profile-a-10K-{pre,posle}.txt`.
- `raw-*.json`, `big-*.json` nisu u repou (`P5-10K/.gitignore`).

## Izmereno pre / posle

Mreža P0 (192; R = sa rezultatom, n 144) — K1/K3; mreže 01/02/F/B (34 146) — K2; K4, K5.

| metrika | 10k-v2.11.0 | 10k-v2.12.0 |
|---|---|---|
| odbijanja P0 / 01+02+F+B | 0 / 0 | 0 / 0 |
| R ≥ 12 ned: testova po planu; < 12 ned | 0; 0 | 1 [1–1]; 0 |
| R: nedelja od testa do trke | — | 6,5 [6–7] |
| planova sa testom: 01 / 02 / F / B | 0 / 0 / 11 880 / 0 | 2352 / 10 080 / 11 880 / 0 |
| R: T rad nedelje 1 [min] | 10,3 [6,9–20,9] | 13,7 [6,9–28,3] |
| R: prvi I rad [min] | 10,3 [6,3–15,7] | 12,7 [6,3–21,3] |
| R: najveći T / I rad [min] | 17,9 / 12,8 | 18,9 / 14,5 |
| R: udeo rada prvog T / prvog I dana [%] (K5) | 24 [16–34] / 19 [14–26] | 28 [16–41] / 22 [16–29] |
| R: udeo rada prvog kvalitetnog dana (R, 60 %) [%] | 12 [8–31] | 12 [8–31] |
| laganih dana sa ubrzanjima po planu R / F / B | 0 / 0 / 0 | 12 [2–17] / 11,5 [5–17] / 11 [7–15] |
| R: nedelja sa ubrzanjima / nedelja bez trkačke | 0 / 12 | 12 [2–17] / 12 [7–17] |
| R % km bržih od E: baza / razvoj / spec. / taper | 8,7 / 10,4 / 15,4 / 13,8 | 11 / 13,1 / 16,7 / 14,9 |
| nedelja > 25 % brzih (192 plana) | 5 | 10 |
| R vrh cilja [km] | 49 [25,3–90] | 49 [25,3–90] (niži u 6/192, do 0,7 km; viši u 30) |
| planova sa WEEK_FITTED / nedelja (P0) | 76 / 475 | 71 / 444 |
| nedelja 1 ispod obima (P0 / 01 / 02 / F / B) | 57 / 1620 / 4158 / 3894 / 162 | 48 / 1458 / 3762 / 3762 / 162 |
| nedelje pouke 35 (02 / F); planova | 342 / 120; 132 / 66 | 342 / 132; 132 / 66 |
| „dva dana ostaju" (upozorenje) | 0 | 0 |

Nedelje > 25 %: 5 → 10 — test 5 km (zona test) i ubrzanja (R) se broje kao brzi km (prihvaćeno za test, odluka 2);
ubrzanja nisu rad zone (workKm), ali M7 ih broji. WEEK_FITTED pada jer F4 prebacuje km iz laganih u kvalitet (lagan
≤ 0,8 × dugi lakše staje, T1).

## F2 — mreža tokova (K6; 192 plana × asOf kraj nedelje baze/razvoja/specifične posle koje sledi izgradnja)

Svi dani 14 dana do asOf zapisani (RPE 5), pokrivenost potpuna; scenarij menja dva poslednja dana kvaliteta. „Kontrola" =
isti tok sa RPE 5. Izlaz `P5-10K/f2Flows.txt`. 0 odbijanja u svih 2410 tokova.

| asOf faze (tokova) | RPE 9 oba: primenjen | skip oba: primenjen / applied false | + umor | + bol |
|---|---|---|---|---|
| baza (176) | 176 | 105 / 71 (manjak A2) | 175 false, 1 primenjen | 176 false |
| razvoj (120) | 120 | 63 / 57 | 120 false | 120 false |
| specifična (186) | 186 | 98 / 88 | 186 false | 186 false |

Kad je primenjen: nijedan slot ne raste (100 %), cilj po pravilu (nominalKm) isti kao kontrola (100 %); zbir doza
nedelje ≤ kontrole osim 1 + 6 tokova (kontrola spustila dozu kapacitetom ili nedelja B — slot ne raste). Ponovna
adaptacija istim zapisima: bez novog koraka (test D38).

## Profil (a) (10 km 46:00, 40 km, 4 d, 16 ned; K7)

Ispis `P5-10K/profile-a-10K-{pre,posle}.txt`. Ned 1 T 2,0 → 3,0 km kontinuirano (9,4 → 14,1 min, dan 49 min); prvi
I (ned 6) 2 × 1000 → 3 × 1000 m (8,7 → 13,0 min; cilj ned 6 45,2 → 50,5 km — veća doza kvaliteta nosi lagane u granici T1); ned 10 (poslednja ne-rasteretna razvoja) kontrolni test 5 km umesto I +
T 5,0 km, napomena „Unesi rezultat"; svaka nedelja izgradnje i tapera ima jedan lagan dan sa ubrzanjima (baza 4 × 20 s,
od ned 6 6 × 20 s), trkačka samo dan pred trku. Specifična faza i taper isti tip kao P3 (ned 11 A RP 3 × 1500 + T
2 × 2500, ned 13 B RP 5 × 1000 + I 5 × 800, ned 14 A RP 3 × 2000 + T 5,0 km); ukupno RP 21,5 → 21,5 km.

## Promenjeni planovi i dokaz po klasi

Fixture `tenK/v2/segmentP5.changed-72003c1.json` (`P5-10K/mkfxP5.py`, oblik kao P3; spaja se u `CHANGED_08` ispod P3 i
10K-08 — `level.harness`): menjaju se **svi** planovi generatora (01 3024, 02 15 840, F 11 880, B 3402 = 34 146: F3 u
svakoj nedelji izgradnje) i svi tokovi trajnih mreža adaptacije (early 102 707, grid04 2040, pain 336, relief 18 193,
start0 12 336); 0 tokova sa dva heša. Mreža 02: `segmentP5.grid02-72003c1.json` (918 planova koje menja samo P5 —
`P5-10K/grid02-dump.ts`; ostali su već u fixture-ima 10K-08/P3). Snimci: `docs/10k-v2/artifacts/segment-08/gen-dump.ts`
(oba stabla) i privremena kuka `P5_DUMP` u `level.harness` (pun nivo mreža adaptacije, oba stabla; uklonjena).

**Dokaz po klasi (bajt-isto)**: kopija novog stabla sa isključenim F1 (`controlMinWeeks` 99) i F3 (`stridesChoice` →
null) i F4 na 60 % (oznaka 10k-v2.11.0) daje `gen-dump` jednak 72003c1 za **34 146 / 34 146** planova (planHash81,
uzrok 07, red bazne linije) — sve promene generatora su od F1/F3/F4; F2 menja samo adaptaciju (korak `holdDose`). (Provera je rađena pre P-b i pravila F2 po datumu; P-b sa T/I na 60 % ne
menja izbor — nivo po 60 % je i donja granica —, F2 ne utiče na generator.)
Mreža P0: od 2512 nedelja 250 bajt-isto (nedelje bez laganog dana, trkačke).

Mreža E (06d): skup tokova ostaje 06d — tokovi „pred nedeljom testa" samo za test plana po osećaju (`testInputs.
earlyAsOfs`); kontrolni test ne dodaje tokove (redni brojevi i referentni heševi isti). Pokrivenost kontrolnog testa u
adaptaciji: mreže relief/grid04/pain/start0 (planovi ≥ 12 ned) i `p5.node.test.ts`.

## Sabotaže

`node scripts/sabotage.mjs ../docs/generators-v2/perfection/P5-10K/sabotage-P5.json --quiet` (brz nivo, `--bail=1`) —
**14/14 palo**, 23,8 s, stanje `src` vraćeno (`P5-10K/sabotage-P5.result.json`): F1a bez kontrolnog testa, F1b test i u
rasterećenju, F1c O1 isključen, F2a okidač bez RPE, F2e „neodrađen" samo po dayId, F2b zadržana nedelja raste, F2c F2
ispred bola/manjka, F2d isti zapisi ponovo, F3a uvek 4 × 20 s, F3b prvi lagan dan, F3c ubrzanja u uvodu početnika, F4
60 %, F4b bez P-b, V test nedelja određuje stanje Q1 posle mešovite nedelje. Hvataju ih `p5.node.test.ts` (novi) i
`p35.node.test.ts`.

## Testovi (komanda — trajanje — ishod)

- U toku: namenski fajlovi (`npx vitest run --project node <fajl>`), 2–40 s; `npx vitest run --project node
  src/domain/generators/tenK/v2` (brz) — 86 / 156 / 97 s — 59 → 30 → 7 → 0 padova (verzija, proročki testovi, fixture).
- Snimanje otisaka (nije test): stablo 72003c1 `gen-dump` 3 min 37 s + pun nivo mreža adaptacije sa kukom `P5_DUMP`
  15 min (37/37 zeleno); novo stablo `gen-dump` + pun nivo mreža adaptacije 17 min 21 s; `grid02-dump.ts` < 1 min.
- `TEST_FULL=1 npx vitest run --project node src/domain/generators/tenK/v2` (pun, jednom) — **24 min 00 s** (> 15 min:
  opterećenje mašine uporednim snimkom; nije ponavljan) — 96 fajlova, 744 testa, 17 padova: izveštajne brojke mreža 02
  i po osećaju (8), `adapt` TEST_MOVED (1), mreža E delovi 9–12 (4: 10 tokova 3 dana po osećaju, DELOAD_CONTENT —
  lažna greška validatora, v. dole) → popravljeno; ponovljeni samo ti fajlovi: brojke sa privremenim ispisom
  (2 × ≈ 6 min, ispis uklonjen), pa `TEST_FULL=1 … grid. feelGrid. adapt.node earlyGrid.9–12 p5.node` — 5 min 50 s —
  164/165 (1 brojka D25/DOSE_DROPPED, zamenjene kolone) → `grid.3.full` 1 min 22 s 15/15.
- `npm run check` — 2 min 57 s (format fixture-a) → 5 min 47 s — 2 pada (`marathon/v2/app/byteSame` snima 10K v2) →
  snimak obnovljen (`BYTE_SAME_RECORD=1`, promenjeno samo 17 ključeva „10K v2"), 2/2.
- Posle `git pull --rebase` (P5-5K/HM/MAR, P7a/b; sukob samo u `byteSame.9443676.json` → uzeta verzija grane i ponovo
  snimljeno, 17 ključeva „10K v2"): `npm run check` — 8 min 11 s — 348 fajlova, 3928 testova, 0 padova.
- `npx vitest run --changed 72003c1` — 2 min 58 s — 157 fajlova, 1568 testova, 0 padova.
- `npx playwright test e2e/tenk-v2.spec.ts --trace off` — 25 s — 3/3; `npm run build` — 8 s — uspešno.
- Sabotaže — 24 s — 14/14.

## Van foldera `tenK/v2`

- `web/src/features/onboarding/tenKV2Flow.test.tsx`, `web/e2e/tenk-v2.spec.ts`: oznaka verzije 10k-v2.11.0 → 10k-v2.12.0.
- `web/src/domain/generators/marathon/v2/app/byteSame.9443676.json`: 17 heševa tokova „10K v2" (snimak toka 10K v2 kroz
  aplikaciju); ostali ključevi bajt-isti.

## Usput nađeno (ispravljeno, samo validator)

Mreža E, 10 tokova (3 dana, po osećaju, 17–18 ned, asOf sreda ned 5, manjak/pauza): nedelja testa (D27) posle mešovite
nedelje označavala je stanje Q1 „poznatim" iako ga test ne menja, pa je validator sudio rasterećenje ned 8 sa dozom iz
ned 3 (3,5 km) umesto da ga preskoči kao posle mešovite nedelje; konstruktor je uzeo upisanu ned 5 (4,0 km zbog F4).
Na 72003c1 brojevi su se slučajno poklapali. Ispravka: nedelja testa ne dira stanje Q1 (`validate.ts`, sabotaža V).

F2 po odluci organizatora (nalaz 5K): dan kvaliteta je neodrađen samo kad tog datuma nema nijednog trčanja; RPE samo
iz zapisa tog dana plana (test: uvoz bez `dayId` ne okida D38).

## Mišljenje (odvojeno od merenja)

1. F4 nosi najveći dobitak udela rada (prvi T dan 24 → 28 % trajanja) bez gubitka izvodljivosti; P-b čuva drugi dan
   kvaliteta kod brzih trkača malog obima.
2. Kontrolni test dolazi 6–7 nedelja pre trke — dovoljno rano da nov tempo pokrije celu specifičnu fazu.
3. F2 retko deluje sam: preskočena oba kvaliteta najčešće obaraju i obim (A2 manjak ima prednost).

## Otvorena pitanja

1. DOSE_DROPPED (upozorenje, D11 ispred D12) na mreži 02 raste: 84 / 294 / 0 / 0 → 36 / 534 / 90 / 0 planova po
   danima 3–6; po osećaju 84 / 258 / 0 / 0 → 84 / 444 / 210 / 72. Uzrok: veća početna T/I doza, pa u nedelji sa ciljem
   spuštenim kapacitetom doza ne staje u plafon i spušta se. Odbijanja 0. Prihvatljivo ili tražiš ograničenje?
2. Po osećaju, ponavljanja slota (kolona 2) 5–6 dana 0 / 0 → 126 / 240 (ista doza bez druge strukture, D10) — isti
   uzrok (veća doza ranije stiže do nivoa bez druge podele). Prihvatljivo?
3. Izvoz na sat: lagan dan sa ubrzanjima u planu po osećaju se ne šalje (tempo ubrzanja je procena, kao dan pred trku);
   lagani bez ubrzanja se šalju. U planu sa rezultatom šalje se. Prihvatljivo?
4. Mreža E ne dobija tokove „pred nedeljom kontrolnog testa" (skup 06d zadržan zbog rednih brojeva referenci);
   kontrolni test u adaptaciji pokrivaju ostale trajne mreže i `p5.node.test.ts`. Treba li posebna mreža?
