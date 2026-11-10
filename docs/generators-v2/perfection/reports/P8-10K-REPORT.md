# P8-10K — ispravke po slepoj oceni + dopuna po glavnom treneru (10k-v2.13.0)

10. 11. 2026 (Europe/Belgrade). Polazno `9055e5b1` (10k-v2.12.0). Zadatak: `briefs/P8-ispravke-po-slepoj-oceni.md`
(G1–G3, 10K a–c) i `briefs/P8-dopuna-po-glavnom-treneru.md` (G4–G8, izmene G1/G2/G3, 10K c; važi dopuna). Odluke koje
traže organizatora: `P8-10K-STOP.md` (S1–S8). Izmene samo u `web/src/domain/generators/tenK/v2/**` i dokumentaciji
(van foldera samo oznaka verzije: `features/onboarding/tenKV2Flow.test.tsx`, `e2e/tenk-v2.spec.ts`).

**Stanje testova: v. odeljak „Završetak" na kraju** (stanje posle prvog dela: 23 test fajla nisu bila zelena, 1 odbijanje
adaptacije S8 — rešeno u završetku).

## Šta je ugrađeno (policy.ts D39–D48)

| odluka | pravilo | mesto (jedan vlasnik) |
|---|---|---|
| D39 G1 | korak rasta = min(D6; (granica − poslednji) / preostale ne-rasteretne nedelje baze i razvoja); preostale iz OSNOVNE periodizacije (prošlost adaptiranog plana = upisano); naviše (izvodljiv cilj) najviše do D6 | `volume.buildWeeksLeft`, `growthStep10`, `fit10(upMax10)` |
| D40 G2 | plafon zone = max(udeo × cilj; prvi nivo lestvice zone: T 2,0 / početnik 1,5 km, I 2 × 1000, R 6 × 200, RP 2 × 1200 m) | `quality.zoneFloorM`, `capM` |
| D41 G3 | tekst za trkača: prevod napomena i poruka, bez internih izraza, svako upozorenje jednom, test završava uputstvom | `userNotes.ts` → `app/plan.ts` |
| D42 10K c | SHORT_EASY: lagan < 30 min ili odmor + preporuka manje dana; PRVO u planu, sa brojem dana | `validate.ts`, `userNotes.ts` |
| D43 G4 | plafon treninga u minutima rada: T 30 (≥ 80 km: 40), I 20 (VDOT < 40) / 24, RP 30 min — član `capM` | `quality.minutesCapSec`, `capM(…, p)` |
| D44 G5 | oštrenje = 2 jednake deonice RP ≤ 12 min, 400–1500 m (100 m), ≤ RP tapera | `week.sharpenerSpec` |
| D45 G1a/b | vrh ≤ start × 1,30/1,35/1,40 (≤ 12 / 13–15 / ≥ 16 ned) i ≤ 6/7/8 h po VDOT; vrh ≥ start; korak < 3 % se ne primenjuje | `volume.peakCap10`, `growthStep10` |
| D46 G7 | u nedelji testa test je jedini kvalitet; test ne pre nedelje 4 | `periodize.testWeekOf`, `week.buildWeek`, `validate` ROLES |
| D47 G6 | lagan ≤ 0,70 × dugi (4–6 dana), 0,80 (3 dana) — tabela D17 | `policy.days[n].easyMaxLongShare`, `lengths.buildEasyBounds10` |
| D48 G8 | početnik: u 3 poslednje ne-rasteretne nedelje izgradnje udeo dugog do min(50 %, 10 km / cilj); ispod 10 km jedna rečenica | `lengths.longToRaceWeeks`, `longShareOf` |
| G3 dopuna | trkački dan: „Trka 10 km — prognoza m:ss (pre trke 15 min lagano, posle 10 min)" | `workouts.raceWorkout` |

Nije ugrađeno (odluka organizatora, STOP): G5 taper ≤ 60 % najvećeg (S5), G5 rasterećenje bez donje granice (S6),
10K b najmanja izmena udela dugog (S2 — zamenjena sa G8), T početnika iznad 1,5 km (S3).

## Komande merenja (iz `web/`; nisu testovi)

- **M1** `node ../docs/generators-v2/perfection/P8-10K/measure.ts <oznaka> [brzo]` (≈ 2,5 min; brzo = P0 + P7 ≈ 1 s)
  → `raw-<oznaka>.json` (nije u repou); **M2** `node …/P8-10K/summary.cjs pre dopuna` → `summary-pre-dopuna.txt`.
  Oznake: `pre` = stablo 9055e5b1 (10k-v2.12.0), `posle` = G1–G3 (stanje pre dopune), `dopuna` = vrh grane.
- **M3** `node …/P8-10K/p7table.cjs pre dopuna` (12 profila P7); **M4** `node …/P8-10K/minutes.ts` (G4/G5, P0 + P7).
- **M5** `node …/P8-10K/corpus.ts posle` / `corpus.ts sirovo sve sirovo` → `corpus-*.tsv` (tekst kakav vidi trkač /
  doslovno iz plana, isto stablo); **M6** `node …/P8-10K/beginnerLong.ts` (dugi početnika, S2).
- **M7** ispisi 12 profila „posle P8" (tekst kroz userNotes): `node …/P8-10K/dump-user.ts <dir>` pa `P7/render.ts` (A = B)
  → `P8-10K/plans/p01–p12.txt`. `P7/plans` nije diran.

## Zamerka iz ocene → uzrok → izmena → pre / posle (12 profila P7, M3; pre = 10k-v2.12.0, posle = vrh grane)

| zamerka (P7/reviews/10K.md) | uzrok | izmena | pre → posle |
|---|---|---|---|
| 2 plato obima | rast +6 % do granice → vrh u ned 5–7 | G1, G1b | p11 vrh u ned 7 → 11 (kraj razvoja 12), nedelja na vrhu 7 → 4; p10 6 → 4; P0 planova sa ≥ 5 ned na vrhu 55 → 8 |
| 2 plato (p04) | satni plafon (G1a) = start | G1a doslovno | p04 vrh 61,3 → 50,0 km = start, 12 ned na vrhu (S7) |
| 1 dugi plato | plafon 105 min / udeo veže od ned 1 | — (talas dugog: krug 2) | p04 14,0 km 12 ned (isto), p08 17,1 km 12 ned (isto) |
| 3 početnik < 10 km | udeo D17 × vrh 1,3 × start (M6: 1134 / 3402) | G8 | p11 najduži 8,7 → 9,7 km + rečenica „treba bar 20 km nedeljno" |
| 3/4 početnik bez RP, taper/rasterećenje bez kvaliteta | 10 % nedelje < prvi nivo | G2 | p11 ned. sa RP 0 → 4, taper bez RP 1 → 0; mreža B planova bez RP 918 → 0, taper bez kvaliteta 378 → 0, rasterećenje bez kvaliteta 654 → 0 |
| 4 T 1,5 km × 9–13 | 10 % nedelje ne nosi 2,0 km | nije (S3) | p11 T 1,5 km ned 3–11 (isto) |
| 5 lagani 3–4 km (p06) | 5 dana × 30 km | D42 (upozorenje prvo, „3–4 dana") | p06 bez upozorenja → upozorenje kao prva poruka |
| 5 lagani 80 % dugog | T1 0,8 | G6 0,70 (4+ dana) | P0: pad vrha > 10 % u 4/44 planova 4 dana (9,1 %, prag STOP 10 %) |
| 8 dva jaka napora u 48 h (test pa T) | Q2 ostaje u nedelji testa | G7 | nedelja testa: 0 drugih kvaliteta; test ne pre ned 4 (F mreža: 400 planova test ned 2–3 → ≥ 4) |
| 9 taper / oštrenje preteški | oštrenje 3 × 1000 m | G5 oštrenje | oštrenje > 12 min rada: 51 → 0 (M4); taper > 60 % najvećeg 81/204 (S5) |
| (trener) trening predug u minutima | plafon samo u km | G4 | T > 30 min 58 → 0, I > 20/24 min 56 → 0, RP > 30 min 79 → 0 (M4) |
| 10 tekst | interne napomene | G3 | tehničkih napomena trkaču (12 profila) 129 → 0; p08 29 → 0, p04 27 → 0 |
| 6/7 ubrzanja, test | već P5 | — | isto |

## Mreže (M1/M2; 34 350 planova: P7 12, P0 192, 01 3024, 02 15 840, F 11 880, B 3402)

| metrika | pre | dopuna |
|---|---|---|
| odbijanja generatora (sve mreže) | 0 | 0 |
| P0: planova sa ≥ 5 ned na vrhu obima / vrh pre poslednje-3 nedelje razvoja | 55 / 59 | 8 / 17 |
| 02: isto | 3552 / 2022 | 1002 / 816 |
| P0 / 02 / F nedelje > 25 % brzih km | 10 / 234 / 684 | 0 / 0 / 180 |
| nedelje > 30 % brzih km (F) | 12 (0,1 % planova) | 12 (0,1 %) |
| taper bez kvaliteta (P0 / 02 / F / B) | 10 / 48 / 36 / 378 | 0 / 0 / 0 / 0 |
| rasterećenje bez kvaliteta (P0 / 02 / F / B) | 22 / 528 / 288 / 654 | 0 / 0 / 0 / 0 |
| B: planova bez RP | 918 | 0 |
| P0 / 02 nedelje WEEK_FITTED | 444 / 34 236 | 430 / 32 166 |

Promenjeni planovi: svi (G1/G2/G4/G5 i oznaka verzije) — dokaz po klasi bajt-isto nije rađen (v. „Šta nije urađeno").

## Sabotaže (prvi deo, G1–G3, D42)

`node scripts/sabotage.mjs ../docs/generators-v2/perfection/P8-10K/sabotage-P8.json --quiet` — **9/9 palo**, 72 s
(`P8-10K/sabotage-P8.result.json`). Za dopunu (G4–G8) sabotaže nisu napisane; `p8.node.test.ts` ima testove G4, G5,
G1a, G6, G7, G8 i 10K c (15/15 zeleno).

## Testovi (komanda — trajanje — ishod)

- `npx vitest run --project node src/domain/generators/tenK/v2` (brz), posle G1–G3 i usklađivanja: 2 min 02 s — 41
  fajl, 428/428 zeleno.
- Isto posle dopune: 1 min 54 s — **23 fajla, 63 testa pada**: (a) očekivanja kodirana po starim pravilima (policy
  tabele i DECISIONS, beginner, volume, week, quality, validate, feel, periodize, lockedTest, painGrid primeri,
  reliefGrid primeri, earlyGrid primeri, p35, p5, schedule, segment08, adaptFlow); (b) nezavisne invarijante
  (`gridInvariants`: TEST_FLAG/TEST_ONE po G7, LONG_CAP po G8, BEGINNER_GROWTH po G1b); (c) referentni heševi tokova
  (`earlyGrid` regresija 51a924f, mreža E 102 707 → 98 395 tokova) — treba fixture promenjenih planova (obrazac
  `segmentP5.changed-*.json`, P5-10K/mkfxP5.py); (d) 1 odbijanje adaptacije (S8).
- Pun nivo `TEST_FULL=1 … tenK/v2`: pokrenut posle G1–G3 (04:54 UTC = 05:54), prekinut restartom radnika; posle
  dopune nije pokretan (brz nivo nije zelen).
- `npm run check`, `--changed`, E2E, build: nisu pokretani (isti razlog).

## Šta nije urađeno i zašto

1. Usklađivanje 23 test fajla sa dopunom i P8 fixture referentnih heševa — mehanički posao (Sonnet), posle odluka
   S1/S5/S6/S7 (menjaju iste brojke).
2. S8 (odbijanje A6 + rasterećenje) — treba dijagnoza konstruktor/validator za poslednju T dozu sa G4.
3. G3 dopuna „nazivi faza na srpskom svuda" — nije provereno van `app/plan.ts`.
4. Sabotaže G4–G8.
5. Merenje zamerke 1 (dugi plato) i 8 (najteža nedelja pred taper) — van P8 (krug 2).

## Mišljenje (nije merenje)

G2 + G3 + G4 + G5 oštrenje rešavaju najteže tvrde zamerke (početnik bez RP, taper bez kvaliteta, predugi treninzi,
tekst). G1a doslovno pravi ravan plan kod sporog trkača sa većim obimom (S7) — ocena ga je već kaznila; treba odluka.

## Završetak (10. 11. 2026, `briefs/P8-10K-zavrsetak.md`; verzija ostaje 10k-v2.13.0 — nije bila ni u jednom zelenom stanju)

### Odluke organizatora i šta je ugrađeno (policy D49–D51)

| odluka | ugrađeno | mesto |
|---|---|---|
| S1/S5/S6 donja granica ispred G5 | doza rasterećenja i tapera = max(najniži nivo; najviši nivo ≤ 60 % poslednje doze); jedna funkcija za konstruktor i validator; dugi rasterećenja 0,8 × poslednji, ne ispod najdužeg laganog (sme < 4 km) | `quality.reducedDoseM` (D51) |
| S7 ravan obim | rečenica u planu: „Nedeljni obim ostaje X km: to je već oko N sati trčanja nedeljno, pa plan ne dodaje kilometre — napredak donose treninzi u tempu i dugi." Uslov: satni plafon je najniža granica vrha i rast do njega se ne primenjuje (start ≥ plafon ili preostali rast < 3 %, G1b) | `volume.flatByHours`, `generate.ts` (D50) |
| S2 | bez izmene (G8 kako je izmereno) | — |
| S3 T početnika | plafon T početnika = max(udeo × cilj; 3,0 km), uz G4 | `quality.capM`, `policy.beginner.tCapMinKm` (D49) |
| S8 odbijanje adaptacije | validator: nedelja testa (G7, bez Q2) ne određuje stanje nijednog slota — kao konstruktor; ista funkcija smanjene doze | `validate.ts` (D51) |
| S9 (nov STOP u završetku, odlučeno) | početnik (jedan kvalitet) ostaje na lagan ≤ 0,80 × dugi; 0,70 samo redovan plan sa 4+ dana | `policy.beginner.easyMaxLongShare` (D47) |
| S4 i ostalo | ostaje kako je ugrađeno | — |

### Sudari u završetku i rešenja (prihvatio organizator: 1 i 2; 3–5 rešeno po istom načelu, javljeno)

1. **S3 × G6/dužine nedelje**: plafon 3,0 km bez uslova → 12 odbijanja na mreži B (4 dana, 18 km, 17 ned: dan T 3 × 1000 m ≈ 7,9 km
   obara nedelju 21,5 → 17,9 km; rasterećenje i taper ne mogu da se sastave). Rešenje (jedan vlasnik, `quality.pickBuild`, predikat
   konstrukcije `carriesAll` kao `keepsTwo` iz D37): viši nivo T samo kad ga nedelja nosi (dužine izvodljive pri cilju, nijedan lagan dan
   nije odmor); inače doza te nedelje ne raste (napomena trkaču, validator: nedelja bez rasta doze kao D38).
2. **Rasterećenje bez kvaliteta** samo u drugoj pretrazi i samo kad nedelja sa najnižom T dozom ne može da se sastavi; validator
   proverava tvrdnju (dan T + dugi i lagani po 3 km > cilj). Na mreži B posle S9: 0 takvih nedelja.
3. **S3 × prelaz T → RP**: T do 3,0 km > plafon RP 2 × 1200 m → upozorenje „doza spuštena" (206 planova u uzorku brzog nivoa).
   Rešenje: početnik — prelaz u novu zonu nosi dozu najviše do plafona nove zone (`quality.cappedCarry`, konstruktor i validator);
   to je prelaz, ne spuštanje. Posle: DOSE_DROPPED kod početnika 0.
4. **G6 × početnik 4 dana (S9)**: v. tabelu ispod.
5. **G8 × period bola u adaptaciji**: validator je u nedelji dugog do distance tražio dugi po udelu 50 %, a konstruktor ga u periodu
   bola seče na 60 min (A4) → 3 odbijanja (reliefGrid 1, repeatGrid 2, početnik 4 dana). Validator sada čita istu funkciju
   (`lengths.painLong10`); odbijanja 0.

### Brojevi (mreža B = `beginnerGridInputs`, 3402 plana; merne skripte privremene, nisu u repou)

| metrika (mreža B) | pre završetka (G1–G8) | posle |
|---|---|---|
| odbijanja generatora | 0 | 0 |
| ne-rasteretne nedelje sa T 1,5 km | 4800 | 3474 |
| planovi po najvećoj T dozi: 1,5 / 2,0 / 2,4–2,5 / 3,0 / ≥ 3,5 km | 378 / 936 / 1476 / 570 / 42 | 12 / 402 / 384 / 2406 / 198 |
| nedelje u kojima T doza ostaje jer je nedelja ne nosi | — | 144 u 96 planova |
| upozorenje DOSE_DROPPED / rasterećenje bez kvaliteta / taper bez kvaliteta | 0 / 0 / 0 | 0 / 0 / 0 |
| planovi sa dugim rasterećenja < 4 km (3 / 4 dana; S1 dozvoljeno) | 6 / 14 | 18 / 42 |

**S9 — G6 kod početnika sa 4 dana** (1890 planova; cilj nedelje 3, prve sa kvalitetom, prema startu):

| lagan ≤ × dugi | pad ≥ 10 % | pad ≥ 20 % | plan se ne vrati na start |
|---|---|---|---|
| pre P8 (10c72e3) i pre G6 (81e2a98) | 54 | 0 | 108 |
| 0,70 (kako je bilo ugrađeno) | 918 | 594 | 396 |
| 0,75 | 486 | 162 | 150 |
| 0,80 (odluka, ugrađeno) | 54 | 0 | 108 |

Uz 0,70 padala je i postojeća invarijanta adaptacije I2 (`painGrid`: isti cilj nedelje za svaki dan bola) — sa 0,80 prolazi.
Početnik 3 dana bez promene (216 / 108 / 270 od 1512, isto kao pre P8).

**S8**: mreža adaptacije (`adaptBases` × asOf × scenariji, 2040 tokova): odbijeno 3 (d4/d5/d6-r-14w, w6wed, over120) → 0.
Pun nivo trajnih mreža adaptacije (rana 102 707, rasterećenja 18 193, ponavljanja, bol): 0 odbijanja.

**Mreža 02 (15 840) i F (11 880), ceo skup, 10k-v2.12.0 → 10k-v2.13.0** (tabele u `grid02.harness`, `feelGrid.harness`):

| metrika (3 / 4 / 5 / 6 dana) | 02 pre | 02 posle | F pre | F posle |
|---|---|---|---|---|
| CAPACITY_LIMITED (planova) | 1044 / 1968 / 1188 / 1248 | 1002 / 2382 / 1308 / 1272 | 1104 / 1884 / 1314 / 1266 | 1014 / 2160 / 1224 / 1116 |
| vrh / start (prosek) | 1,235 / 1,217 / 1,264 / 1,236 | 1,209 / 1,160 / 1,210 / 1,162 | 1,188 / 1,163 / 1,237 / 1,216 | 1,164 / 1,098 / 1,163 / 1,102 |
| ned 1 ispod obima (105 min + udeo) | 528 / 1254 / 528 / 594 | 528 / 1782 / 726 / 924 | 594 / 1386 / 660 / 792 | 594 / 1782 / 858 / 1056 |
| DOSE_DROPPED (planova) | 36 / 534 / 90 / 0 | 36 / 372 / 0 / 0 | 84 / 444 / 210 / 72 | 96 / 672 / 0 / 0 |
| rasterećenje / taper bez kvaliteta | 528 / 48 (3 dana) | 0 / 0 | 288 / 36 (3 dana) | 0 / 0 |
| ponavljanje slota (nedelja) | 456 / 42 / 0 / 0 | 264 / 174 / 0 / 0 | 384 / 96 / 126 / 240 | 432 / 342 / 132 / 240 |

Prijava (nije sudar, G6 kako je odlučeno za redovne planove): redovan plan sa 4 dana češće ne nosi trenutni obim u nedelji 1
(02: 1254 → 1782 planova; primer 10 ned, 25 km, VDOT 30: nedelja 1 = 23,4 km) i vrh/start je niži (G1a + G6).

### Izmene očekivanja u testovima, po klasi (samo posledice odlučenih pravila)

| klasa | fajlovi | šta |
|---|---|---|
| tabele pravila | `policy` | D43–D51, nova polja (minutesCap, peakG1a, minStepShare, test.minWeek, sharpener*, easyMaxLongShare, beginner.*) |
| G7 test ne pre nedelje 4, jedini kvalitet | `periodize`, `feel`, `lockedTest`, `segment08`, `p5`, `schedule`, `week`, `quality`, `adapt` (tabela scenarija), `gridInvariants` | planovi po osećaju 8–11 ned bez testa; primeri prebačeni na 15 ned; nedelja testa bez Q2; TEST_MOVED niži |
| G1/G1a/G1b rast i vrh | `volume` (nezavisno pravilo), `painGrid` A–E, `adaptFlow`, `beginner`, `reliefGrid`, `validate` | niži ciljevi nedelja u primerima; korak < 3 % se ne primenjuje |
| G6 lagan ≤ 0,70 × dugi (redovan 4+ dana) | `volume`, `validate`, `reliefGrid`, `earlyGrid` primeri, `adapt` A1, tabele mreža 02 i F | poruke „lagan ≤ 70 % dugog", niži izvodljiv cilj, ned 1 ispod obima |
| G4/G5 minuti i oštrenje | `quality` (nezavisan plafon), `week`, `beginner`, `earlyGrid`, `painGrid` I3 | oštrenje 2 jednake deonice; trkačka nedelja kraća za 0,2 km u primerima |
| G2/S3/D49 početnik | `beginner`, `p8`, `gridInvariants`, tabele mreže B | lestvica T napreduje; T kontinuirano umesto lestvice faze i nedelje bez kvaliteta → 0 |
| G8 | `gridInvariants` (LONG_CAP po udelu do 50 % u 3 poslednje nedelje izgradnje) | — |
| invarijanta sa novim izuzetkom | `repeatGrid.harness` (pouka 36/37) | kad je zaštićeni ponedeljak k najduži dugi plana, taper i trkačka nedelja se ne porede (D7 čita najduži dugi upisanog plana); nedelje izgradnje posle k i dalje iste |
| brojevi pouke 35 | `p35.harness` | brz 546 → 624; pun po delovima 112 / 112 / 125 / 125 → 145 / 145 / 167 / 167 |

Skup tokova rane mreže (E) ostaje skup 06d (102 707): asOf „nedelja pre testa" se za plan po osećaju bez testa (G7) računa od
mesta testa po D27 (`testInputs.earlyAsOfs`) — redni brojevi i referentni heševi isti.

### Referentni heševi i fikstura promenjenih planova

Po postojećem obrascu fikstura promenjenih planova čuva stanje starog stabla za planove/tokove koje segment menja, a koji nisu
u ranijim fiksturama. `segmentP5.changed-72003c1.json` već sadrži SVE planove generatora (34 146) i SVE tokove trajnih mreža
(rana 102 707, grid04 2040, bol 336, rasterećenja 18 193, start0 12 336), pa starije regresije porede stanja iz fikstura za
svaki ključ; skup „promenjeno u P8, a nije u ranijim fiksturama" je prazan i nova fikstura nije potrebna. `p08Errors` na punom
nivou dokazuje da se svaki plan i tok razlikuje od svog stanja u fiksturi. Dokaz po klasi (stari kod 10c72e3 → vrh grane): v.
„Promenjeni planovi" ispod.

### Promenjeni planovi (stari kod 10c72e3 → vrh grane; `docs/10k-v2/artifacts/segment-08/gen-dump.ts` i privremena kuka snimka tokova na oba stabla, pun nivo)

Planovi generatora: 01 3024 / 3024, 02 15 840 / 15 840, F 11 880 / 11 880, B 3402 / 3402 — svi promenjeni, 0 odbijenih.
Tokovi adaptacije: rana 102 707 / 102 707, grid04 2040 / 2040, bol 336 / 336, rasterećenja 18 193 / 18 193, start0 12 336 /
12 336 — svi promenjeni, 0 odbijenih, isti skup ključeva na oba stabla.

### Sabotaže

`node scripts/sabotage.mjs ../docs/generators-v2/perfection/P8-10K/sabotage-P8-zavrsetak.json --quiet` — **14 / 14 palo**, 189 s
(`sabotage-P8-zavrsetak.result.json`): G4, G5, G1a, G6, G7 (2), G8, D49 (3: plafon 3,0 km, uslov „nedelja nosi", prelaz zone),
D50, D51 (2: donja granica, stanje slota u nedelji testa), S9. Prvi deo (G1–G3, D42): 9 / 9, ranije.

### Testovi (komanda — trajanje — ishod), sve po beogradskom vremenu 10. 11. 2026

- `npx vitest run --project node src/domain/generators/tenK/v2` (brz): 2 min 08 s na početku — 23 fajla / 63 testa pada; posle
  završetka ≈ 4 min pod opterećenjem — 147 fajlova, 0 padova.
- `TEST_FULL=1 npx vitest run --project node src/domain/generators/tenK/v2` (pun, jednom čisto, 15:34–16:01): **26 min 33 s —
  259 fajlova, 765 testova, 0 padova.** Pre toga jedan pun prolaz za čitanje tabela (28 min, 38 fajlova palo — tabele celog
  skupa i 3 odbijanja adaptacije, v. sudar 5) i ponovljeni samo pali fajlovi (mreža 02: 2 min 52 s × 3; F, B, adapt, p35,
  rasterećenja: 6 min + 3 min).
- `npm run check` (ceo `web/`, brz nivo): 6 min 46 s — typecheck, lint, format prolaze; 298 fajlova, 3357 testova, 1 pad
  (`beginnerGrid`: broj „dugi rasterećenja < 4 km" pisan kao tačan broj celog skupa) — ispravljeno i potvrđeno na oba nivoa
  (fajl sam, brz i pun); ceo `check` posle toga nije ponavljan.
- `npx vitest run --changed 10c72e3` (polazno stablo pre P8-10K; 9055e5b1 nije u plitkom klonu, 10c72e3 je roditelj prvog
  P8-10K commit-a): 4 min 31 s — 164 fajla, 2130 testova, 0 padova.
- `npx playwright test e2e/tenk-v2.spec.ts --trace off`: 23 s — 3 / 3.
- `npm run build`: 7 s — prolazi.
- Posle čistog punog nivoa menjano je samo: uklonjena neiskorišćena promenljiva (`week.ts`), `w.days.length` umesto filtera
  bez dejstva (`validate.ts`), pretvaranje tipa u `testInputs.ts`, format dva fajla, jedan red testa — pun nivo nije ponavljan
  (pokriveno brzim nivoom i `--changed`).

### Šta nije urađeno / otvoreno

1. Zamerka „dugi plato" (krug 2) i G3 „nazivi faza na srpskom svuda" van `app/plan.ts` — nije dirano.
2. G8 u nedelji smanjenog obima (adaptacija, povratak): duži dugi istiskuje lagane dane (primer b-d4-18w-18km-v40, ned 14 posle
   pauze + bola: 2 dana trčanja, planirano 15,5 < cilj 18,0) — posledica prihvaćenog S2/G8, prijava za krug 2.
3. Redovan plan sa 4 dana i malim obimom / sporim tempom ne nosi trenutni obim u nedelji 1 (G6 0,70) — brojevi u tabeli gore;
   odluka organizatora ako slepa ocena to kazni (opcija: 0,75 za 4 dana).
4. `byteSame` fiksture sa 10K ključevima u drugim distancama: ne postoje u repou (posle V1b) — nema šta da se snima.
