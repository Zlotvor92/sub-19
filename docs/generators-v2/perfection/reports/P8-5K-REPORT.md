# P8-5K — ispravke po slepoj trenerskoj oceni (5K, 5k-v2.14.0 → 5k-v2.15.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `9055e5b` (5K v2 isti kao „posle" u P7, `cef9d84`).
Menjano samo `web/src/domain/generators/fiveK/v2/**` i dokumentacija. v1 nije diran. Vremena: Europe/Belgrade.

## Komande (iz `web/`)

| šta | komanda |
|---|---|
| mreža P8 (3 964 ulaza: P0 148 + `final-check` 5K `all()`, bez duplikata) | `node ../docs/generators-v2/perfection/P8-5K/measure.ts <oznaka>` → `P8-5K/m-<oznaka>.json`, `fp-<oznaka>.json` |
| mreža P0 | `node ../docs/generators-v2/perfection/P0/measure.ts 5K` (pre: u worktree-u `9055e5b`) → `P8-5K/p0-summary-{pre,posle}.json` |
| 12 profila P7 | `node ../docs/generators-v2/perfection/P7/dump.ts <koren> <inputs> P8-5K/plans 5K` (ulazi: `P7/make-inputs.ts`) |
| otisci regresije prema 9055e5b | `node ../docs/generators-v2/perfection/P8-5K/fixture15.ts <worktree 9055e5b>/web/src/domain/generators/fiveK/v2/ <g07\|n08d\|e08e\|x08g>` |
| sabotaže | `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P8-5K/sabotage.json -q` |

„pre" = `9055e5b`, „posle" = vrh grane. `P7/plans` nije diran; „posle P8" je u `P8-5K/plans/` (sirovi JSON + `brief-NN.txt`).

## Pravila (ugrađeno; red u `policy.ts` DECISIONS 5k-v2.15.0 i komentari polja)

| # | pravilo | mesto (jedan vlasnik) |
|---|---|---|
| a | budžet I/RP 10 % za sve ciljeve (red ≥ 40 km → 12 % ukinut) | `policy.quality.iMaxShareByTargetKm`, `workouts.iMaxShareOf` |
| G1 | korak ne-rasteretne nedelje razvoja = min(+8 %, (vrh − poslednji) / preostale ne-rasteretne nedelje razvoja), naniže na 0,1, ≥ 0,1 km; razvoj 5K = baza + vrhunac, oštrenje drži | `volume.spreadKm`, `devWeeksLeft` (planVolume i adaptVolume/nextBuildKm) |
| G2 | plafon zone = max(udeo × cilj, prvi nivo lestvice vrste) | `workouts.firstLevelBudget` (u `qualitySession`), `feel.feelFirstLevel` (u `progress`, rasterećenje); validator I/T/R_SHARE (`feelFirstLevelOf`) |
| b | rasterećenje: rad zone ≤ 0,6 × poslednja ne-rasteretna doza te zone; taper ≤ 0,7 ×; ne ispod prvog nivoa (G2); dugi rasterećenja ≤ max(3 km, 0,8 × poslednji dugi) | `generate.qualityCapOf` (granica iz UPISANIH nedelja) → `workouts.cappedBudget`, `feel.cappedFeel`, `lengths.weekLengths(maxLongKm)` |
| c | prvi I posle R faze (prva ne-rasteretna nedelja vrhunca bez testa) ≤ 0,7 × budžet I | `periodize.firstPeakIWeek`, `workouts.firstIBudget`; validator PEAK_MAIN_FLOOR izuzima tu nedelju |
| d | WU/CD trke = pojas za VRH obima; ako bi trka bila ≥ najduži trening plana → prvi pojas → 1,0 / 0,5 km | `workouts.raceWarmup` (konstruktor i validator WARMUP), `policy.warmup.raceMin` |
| e | početnik čiji je obim > kapacitet plana početnika (tabela izvodljivih ciljeva) → plan bez oznake početnika + napomena | `steps.beginnerAboveTable` (u `baseAthlete`) |
| G3 | napomena tvrdi samo ono što važi; upozorenja jednom po planu (zbirno); test kaže šta sa rezultatom | `workouts.biggerInOffer`, `feel` (feelDoseHeld), `generate.deloadText`, `text.userWarnings` (app/plan.ts), `text.belowTargetAdvice`, `policy.feel.testNote` |

Sve brojke su heuristika (odluka organizatora P8, nalaz slepe ocene). `policyVersion` 5k-v2.15.0; `KNOWN_VERSIONS` +5k-v2.14.0.

## Zamerka iz ocene → uzrok → izmena → pre/posle (12 profila P7)

Skript: `node prof.cjs` nad `5K-NN.json` (doze u sekundama rada zone). Pre / posle.

| zamerka (P7 5K.md) | uzrok | izmena | izmereno |
|---|---|---|---|
| 4. rasterećenje nosi najveću I dozu (p04 ned 12: 6 × 800) | `deloadBudgetScale` 1,0 + budžet 12 % → isti/veći rad kao vrh | b | najveći rad zone u rasterećenju / poslednji: p04 100 → 60 %, p05 83 → 60 %, p01 80 → 60 %; p04 ned 12 I 6 × 800 → 3 × 800 |
| 4. dugi rasterećenja isti (p04 12 km) | dugi = udeo cilja, a plafon 90 min ga drži | b | p04 ned 4/8/12 dugi 12 → 9,6 km; mreža: dugi > 0,8 × poslednji 3 057 → 0 nedelja |
| 5. taper bez smanjenja (p04 ned 15, p05 ned 9, p07 ned 5) | taper RP = pun budžet | b | taper RP / poslednji RP: p04 100 → 67 %, p05 100 → 67 %; p07 (6 ned, bez RP pre tapera) 5 × 1000 → 4 × 1000 m (budžet 10 %) |
| 8. skok R 8 min → I 26 min (p07 ned 3) | prvi I ≥ 80 % budžeta 12 % | c, a | prvi I: p07 26 → 13 min, p04 25 → 16, p05 24 → 14, p01 17 → 10; P0 medijana M1_I_first 12,5 → 8,8 min |
| 2./9. plato dugog i obima | rast +8 % do vrha u ned 1–5, pa ravno | G1 | vrh dostignut (nedelja): p04 3 → 11, p01 2 → 7, p10 6 → 11, p11 7 → 10; plato obima p04 9 → 3, p01 7 → 3, p10 7 → 3; mreža prosek plato obima 4,63 → 3,28, dugog 4,94 → 4,26 ned |
| 1. trka 8,5 km za sve | `warmup.race` 2,0 / 1,5 fiksno | d | trka: p03/p10/p11 6,5, p06 7,5, p01/p02/p08/p09/p12 9, p04/p05/p07 10 km; trka ≥ najduži dan: mreža 1 105 → 233 (sve sa najdužim treningom ≤ 6,5 km) |
| p12: početnik 45 km spušten na 30 | kapacitet početnika (dugi ≤ 60 min) | e | p12: start 29,9 → 37,3 km (kapacitet 4 dana na 7:00), oznaka početnika → redovan |
| 6. „obim ne dozvoljava više" gde nije tačno | napomena ista za kraj ponude i za budžet | G3 | „ne dozvoljava": p04 2 → 0, p05 1 → 0, p07 1 → 0; preostale (p03, p10) su tačne (veća doza ne staje u budžet) |
| 3. ista upozorenja ponovljena (p04 7, p08 8) | po jedno upozorenje po nedelji | G3 | prikaz: jedno zbirno po pravilu (`text.userWarnings`); u planu ostaju po nedelji (validator, testovi). PLANNED_BELOW_TARGET p04 5 → 1 |
| 10. „rasterećenje svake 3. nedelje" a dolazi ranije | tekst iz `deloadEvery` | G3 | napomena navodi stvarne nedelje rasterećenja |
| 10. „RP … trkački napor (RPE 8)" | opis | G3 | „malo ispod trkačkog napora za 5K (RPE 8)" |
| 7. test bez svrhe u planu po osećaju | napomena „plan ostaje po osećaju" | G3 | „Unesi rezultat — od sledeće nedelje plan dobija tempo iz testa" (assess već prevodi plan na tempo) |
| 7. test kod početnika / test u ned 3 | — | nije rađeno | van P8 (nije u brifu za 5K) |
| 8. p07 +26 % obima za 3 nedelje | +8 %/ned u 6 nedelja | nije rađeno | G1 ne ubrzava ni ne usporava kad razvoj ima ≤ 3 ne-rasteretne nedelje (p07: 45 → 48,6 → 52,4 → 56,5 isto) |
| 2. p01 dugi 14 km × 8 ned, p08 × 11 | vrh = start × 1,3 / kapacitet ≈ start (p01 41,3, p08 35 = start) | nije rađeno | G1 nema prostora; plato dugog p01 8, p08 11 (isto) |

## Metrike (mreža P8, 3 964 ulaza; `m-pre.json` / `m-posle.json`)

| metrika | pre | posle |
|---|---|---|
| odbijanja | 0 | 0 |
| plato obima (prosek najdužeg niza iste nedelje izgradnje) / planova sa ≥ 6 | 4,63 / 1 458 | 3,28 / 412 |
| plato dugog / planova sa ≥ 6 | 4,94 / 1 647 | 4,26 / 1 035 |
| prosečna nedelja dostizanja vrha / kraj razvoja | 4,27 / 7,35 | 6,19 / 7,42 |
| nedelje > 25 % brzih km (bez trkačke, bez testa) | 0 | 0 |
| taper bez RP / oštrenje bez RP / trkačka bez oštrenja | 0 / 0 / 0 | 0 / 0 / 0 |
| rasterećenje I > 0,6 × poslednji (nedelja) | 2 375 | 373 (prvi nivo lestvice, mali obim) |
| rasterećenje R > 0,6 × | 2 709 | 372 (isto) |
| taper RP > 0,7 × | 3 536 | 0 |
| taper T > 0,7 × | 1 098 | 392 (prvi nivo: kratak T 1 km) |
| prvi I posle R (prosek, s) | 793 | 557 |
| dan kvaliteta duži od dugog (nedelja) | 362 | 282 |
| početnik (planova) | 664 | 386 (278 iznad kapaciteta → redovan) |
| rasterećenje samo sa ubrzanjima (nedelja; `g2.ts`) | 208 | 96 |

P0 (148 ulaza, `ALL`, medijana [min–max]): M1_I_first 12,5 → 8,8 min; M1_I_max 13,1 → 10,7; M4_plateau 4 → 3;
M7 brzih km taper 12,7 → 10,8 %, vrhunac 14,45 → 12,5 %, oštrenje 12,3 → 12,6 %; M3_totalKm (RP) 7,95 → 8,4; M4_maxKm
isti 12. Svi planovi su promenjeni (trkački dan); po klasi R/F/B × 3/4/5 dana: 3 964 / 3 964.

## Odbijanja i sudari (izmereno; rešeno bez novog pravila)

- **G1 sam** (pre G2): 2 nova odbijanja `BASE_PLATEAU` (3 dana, 12 km, po osećaju 5:00, 16 ned): sporiji rast ostavljao
  budžet bez višeg nivoa. **G2** ih rešava (tempo 10 min staje kao prvi nivo) → 0. Prag STOP (> 5 %) nije dostignut.
- **b × „lagan ≤ dugi" u rasterećenju**: dugi 0,8 × poslednji uz cilj 0,8 × prethodni cilj ostavlja lagane duže od
  dugog. Sa rezultatom je to već bilo „lagan = dugi, planirano < cilj"; po osećaju je kvalitet otpadao (rasterećenja samo
  sa ubrzanjima 208 → 486). Usklađeno sa putem sa rezultatom (`feel` room: dugi na granici dozvoljava lagan = dugi) →
  96. Posledica: 13 nedelja „lagan = dugi" van trkačke u mreži testa segment05 (sve rasterećenja; test izuzima
  rasterećenje). Napomena: „Rasterećenje: dugi X km i lagani najviše koliko dugi, pa nedelja ima Y km umesto Z km."
- **b u adaptaciji**: dugi rasterećenja 0,8 × dugog skraćenog bolom (2,4 km) < najkraći lagan → WEEK_INFEASIBLE (8
  tokova u mrežama 08e). Granica dugog ne ide ispod `easy.minKm` (3 km) → 0.
- **c × PEAK_MAIN_FLOOR / peakMainMinShare 0,8**: prvi I ≤ 70 % i donji prag 70–80 % budžeta se isključuju; validator
  meri donji prag te nedelje od budžeta × 0,7 (isto tumačenje kao brif: „≤ 70 % budžeta I").
- Adaptacione mreže (otisci prema 9055e5b): g07 700 tokova / 644 promenjeno, n08d 1 124 / 942, e08e 16 804 / 16 804,
  x08g 104 800 / 104 800 — svi razlog P8 ili CH, **0 odbijanja** (nijedan „?rej").

## Tumačenja taba

Razvoj 5K = baza + vrhunac; „tabela početnika" = kapacitet plana početnika; WU/CD trke najmanje 1,0 / 0,5 km; G2 i
granice (b) ne idu ispod prvog nivoa lestvice; doza zone = rad zone u poslednjoj UPISANOJ ne-rasteretnoj nedelji —
prihvaćeno (`briefs/P8-5K-zavrsetak.md`, odluka 3).

## Testovi i trajanje

Pre dopune: brz nivo 787/787, pun nivo 804/807 (3 ispravljena), sabotaže 12/12. Konačno stanje: „Završetak → Testovi".

## Dopuna po glavnom treneru (`briefs/P8-dopuna-po-glavnom-treneru.md`)

Mreža P8 posle svake stavke (`measure.ts g4/g5/g1b/g7/g6`): **0 odbijanja**; adaptacione mreže 08g/08k/08j bez odbijanja
posle ispravke validatora VOLUME_PEAK (tempo sa koracima, kao konstruktor).

| stavka | ugrađeno | mesto | izmereno |
|---|---|---|---|
| G4 plafon treninga u minutima (I 20/24, RP 20, T 30) | da | `workouts.minuteCapKm/zoneBudget`, `feel.feelMinuteCap` (VDOT po osećaju: `paces.vdotOrEstimate`); validator donji prag | 769 planova promenjeno |
| G5 taper ≤ 60 % najvećeg rada zone; oštrenje 2 jednake deonice ≥ 400 m, ≤ 12 min | da | `generate.qualityCapOf`, `workouts` RP_sharpener, `week.buildRaceWeek` (ne staje → ubrzanja) | 0 odbijanja (sa budžetom kao granicom: 87 WEEK_MIN_VOLUME → 400 m je donja granica) |
| G1a vrh: start × 1,30/1,35/1,40 i satni plafon 6/7/8 h po VDOT-u | da | `volume.peakKm(…, {weeks, p})` | vrh/start medijana 1,26, najviše 1,40 |
| G1b korak < 3 % se ne primenjuje | da | `volume.minStep` | plato obima prosek 3,29 → 3,43 |
| G2 u trkačkoj nedelji bez prvog nivoa | da | `workouts.zoneBudget` | — |
| G7 test jedini kvalitet, ne pre ned 4 | da | `feel`, `workouts.peakWeek`, `policy.feel.test`, `periodize.resultTestWeekOf`; validator ROLES | 0 odbijanja |
| G6 lagan ≤ 0,70 × dugi (4+ dana) | da, bez spuštanja cilja | `lengths.easyCapKm(…, days)` | ponovljeno „planirano < cilj" 1 354 → 1 884 planova; **STOP** za spuštanje cilja: `reports/P8-5K-STOP.md` |
| G8 | ne odnosi se na 5K | — | — |
| G3 trka kao trka (prognoza, WU/CD kao preporuka), RPE trke 9 | da (nazivi faza nisu dirani) | `workouts.raceDay`, `policy.feel.effort.race` | — |

Stanje testova i merenja posle dopune: odeljak „Završetak".

## Završetak (5k-v2.15.1; `briefs/P8-5K-zavrsetak.md`)

Polazni vrh `d5c2ab9`; kod gurnut u `d079b311` (brzi nivo zelen) i `65f97994` (posle punog nivoa: tipovi, lint, format).

### Odluka 1 — G6, varijante A i B (izmereno)

`node ../docs/generators-v2/perfection/P8-5K/g6.ts <oznaka>` pa `… g6.ts cmp A B` (mreža `final-check` 5K `all()`, 3 816
planova, 0 odbijanja u obe). B = lagan ≤ 0,75 × dugi za 4+ dana i cilj spušten postojećim mehanizmom izvodljivog cilja
(`volume.feasibility`: cilj je neizvodljiv kad je nedelja na granici laganog a dugi na plafonu).

| grupa | planova | A: planirani vrh < 0,9 × vrh cilja | B: vrh cilja pao > 10 % | B: najveći / prosečan pad | „planirano < cilj" planova A → B |
|---|---|---|---|---|---|
| R 3 d / F 3 d / B 3 d | 550 / 440 / 360 | 0 | 0 | 0 | bez promene |
| R 4 d | 660 | 4 | 520 (78,8 %) | 42,8 % / 21,4 % | 598 → 96 |
| F 4 d | 528 | 6 | 322 (61,0 %) | 37,6 % / 11,7 % | 490 → 182 |
| B 4 d | 288 | 30 | 106 (36,8 %) | 23,3 % / 5,6 % | 186 → 0 |
| R 5 d | 550 | 0 | 200 (36,4 %) | 17,0 % / 5,4 % | 278 → 22 |
| F 5 d | 440 | 100 | 170 (38,6 %) | 16,0 % / 6,2 % | 278 → 22 |

Uslov „vrh pada ≤ 10 % u svakoj grupi" nije ispunjen ni u jednoj grupi sa 4+ dana → **ostaje A** (0,70, cilj se ne
spušta, planirano < cilj). Uzrok: tabela izvodljivih ciljeva odbacuje cilj čim ga ijedna vrsta nedelje ne nosi (npr.
nedelja sa malo kvaliteta), pa cilj pada mnogo više nego što stvarne nedelje gube. Upozorenje je jednom po planu u
prikazu (`text.userWarnings`, test p8 G3); u `plan.warnings` ostaje po nedelji (validator), a napomena nedelje ostaje u
svakoj takvoj nedelji. Dodatno izmereno (nije traženo): samo 0,75 bez spuštanja cilja (`g6.ts B075`) — planirani vrh
< 0,9 × cilj u 6 planova (F 4 d), „planirano < cilj" 598 → 552 (R 4 d), 278 → 272 (F 5 d).

### Odluka 2 — I raste najviše jedan korak lestvice nedeljno

`workouts.iStepUp` (jedino mesto, u `qualitySession`): I u vrhuncu posle prethodnog I lanca = najmanji rad iz ponude
strogo veći od prethodnog, bez praga 70–80 % budžeta. Validator: PEAK_MAIN_FLOOR samo za prvi I lanca. Mreža P8
(`measure.ts kraj`): 3 964 / 3 964, 0 odbijanja. p07: 3 × 1000 → **4 × 800 m** (13 → 14 min; bilo 6 × 800, 21 min); p04:
4 × 700 → 5 × 600 m (bilo 5 × 600 → 6 × 700); p01: 3 × 800 → 5 × 500 m. P0 medijana M1_I_max 13,1 → 10,7 → **9,4 min**
(pre / 2.15.0 / 2.15.1), M1_I_first 8,8 (isto), brzih km u vrhuncu 14,45 → 12,5 → 10,5 %.

### Metrike posle dopune i završetka (`m-pre` / `m-posle` (pre dopune) / `m-kraj`; mreža P8, 3 964)

| metrika | pre | posle | kraj |
|---|---|---|---|
| odbijanja | 0 | 0 | 0 |
| plato obima prosek / planova ≥ 6 | 4,63 / 1 458 | 3,28 / 412 | 3,43 / 513 |
| plato dugog prosek / planova ≥ 6 | 4,94 / 1 647 | 4,26 / 1 035 | 4,24 / 1 026 |
| rasterećenje I / R / T > 0,6 × (nedelja) | 2 375 / 2 709 / 330 | 373 / 372 / 39 | 442 / 316 / 254 |
| taper RP > 0,7 × / taper T > 0,7 × | 3 536 / 1 098 | 0 / 392 | 0 / 396 |
| dan kvaliteta duži od dugog | 362 | 282 | 108 |
| trka = najduži dan | 1 105 | 233 | 227 |
| ponovljeno „planirano < cilj" u `plan.warnings` (planova) | 1 449 | 1 382 | 1 922 (G6 A) |
| prvi I posle R (prosek, s) | 793 | 557 | 562 |

P0 (148 ulaza, `p0-summary-{pre,posle,kraj}.json`, medijana): M4_plateau 4 → 3 → 3; M3_totalKm (RP) 7,95 → 8,4 → 7,9;
M7 taper 12,7 → 10,8 → 9,85 %, oštrenje 12,3 → 12,6 → 11,65 %. 12 profila P7 posle završetka: `P8-5K/plans/5K-NN.json`
i `brief-NN.txt` (`P7/make-inputs.ts`, `P7/dump.ts`, `P8-5K/brief.ts`).

### Izmene očekivanja testova (51 test: 42 nasleđena + 9 od odluke 2), po klasi

| klasa | fajlovi | izmena |
|---|---|---|
| G7 (test jedini kvalitet, ne pre ned 4) | `generate`, `segment04`, `segment05`, `segment08e`, `segment08i` (+ harness) | 2 zahtevna dana u nedelji testa; test u ned 4–5; primer „test otpada" je plan od 7 nedelja (`f-d4-7w-30km-e480-1`), jer plan od 6 nedelja više nema test |
| G1a (vrh 1,30 / 1,35 / 1,40, satni plafon) | `segment03`, `segment04`, `workouts`, `segment05b` | poređenje sa `peakKm(…, {weeks, p})`; 18 planova fiksture sme niži vrh samo na satnom plafonu (računato nezavisno) |
| G1b (korak ≥ 3 %) i G1 | `segment07`, `segment08d`, `segment08e` | brojevi primera (npr. bazni plan 40 / 40 / 41,3 / 33 / 42,6; nivo 38,4) |
| G6 (0,70 za 4+ dana) | `segment02`, `segment06`, `segment08i`, `segment10`, `app` | granica u primerima 0,7; obim pre pauze 23,5; „Lagano 7,4 km"; mreža segment10 računa granicu nezavisno (uvodne nedelje početnika: lagan ≤ dugi, postojeći izuzetak) |
| G2/G4/G5 (posledice) | `p4`, `segment08h`, `segment10` (C11) | oštrenje 2 × ≥ 400 m; primeri pouke 35 prešli na 5 dana (sa 4 dana više ne nastaje) |
| odluka 2 (korak I) | `segment02`, `p4`, `segment05`, `segment10` | prag 70–80 % budžeta samo za prvi I i RP oštrenja; posle prvog I ≤ sledeći nivo lestvice; vrh I profila (b) ≥ 9 min (bilo ≥ 12) |
| verzija | `app`, `adapt`, `handoffTarget`, `features/onboarding/fiveKV2Flow.test.tsx` | 5k-v2.15.1; KNOWN_VERSIONS + 5k-v2.15.0 |

Nezavisne invarijante mreže (novo, `p8.node.test.ts`): G7, G1a, G1b, G6, korak I — brojevi pravila ispisani u testu.
Otisci `segment15.*-9055e5b.json` nisu ponovo snimani (svi tokovi „P8 promenjen", `markP8` prihvata 2.15.0 i 2.15.1;
0 odbijanja u punom nivou); samo preformatirani (prettier).

### Testovi (10. 11. 2026)

| komanda (iz `web/`) | trajanje | rezultat |
|---|---|---|
| `npx vitest run --project node src/domain/generators/fiveK/v2` | ≈ 60 s | 800/800 (bilo 753/795) |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 4 min 41 s | 810/810 |
| `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P8-5K/sabotage.json -q` | 113 s | 17/17 palo, `src` bajt-isti |
| `npx vitest run --changed 9055e5b` | ≈ 5 min | 5K i ostalo zeleno; padaju samo `tenK/v2` (23 fajla — P8-10K, drugi tab) |
| `npm run test:fast` | 5 min 4 s | 3 335 testova, 63 pada — svi `tenK/v2` |
| `npm run check` | 33 s | pada na `typecheck`: greške samo u `tenK/v2` (drugi tab); 5K bez grešaka tipova, linta i formata |
| `npx playwright test e2e/fivek-v2.spec.ts --trace off` | 15 s | 3/3 (nad `npx vite build` + `npm run preview`) |
| `npm run build` | — | pada na `tsc -b` zbog `tenK/v2`; `npx vite build` prolazi |

### Otvoreno (za organizatora)

1. Odluka 2: „korak lestvice" je tumačen kao sledeći veći rad u ponudi (koraci 0,1–0,4 km). Posledica: vrh I doze je
   manji (P0 medijana 10,7 → 9,4 min; profil 30 km / 8 ned 12 → 9,6 min). Ako je namera krupniji korak (npr. +1
   ponavljanje iste dužine ili najmanje +X %), treba broj.
2. G6: napomena nedelje („Lagan trk najviše …") i dalje stoji u svakoj nedelji sa planirano < cilj; jednom po planu je
   samo zbirno upozorenje u prikazu. Opcija 0,75 bez spuštanja cilja je izmerena gore.
3. Sabotaža G3 „najveća doza": posle G4 se kraj ponude u ranoj mreži ne dostiže (0 napomena), pa se tekst proverava
   neposredno (`workouts.why`).
4. `byteSame` fiksture drugih distanci sa 5K ključevima: nijedan test van `fiveK/v2` ne pada zbog 5K (osim verzije u
   `fiveKV2Flow.test.tsx`, ispravljeno) — ništa nije ponovo snimano.
5. Nazivi faza na srpskom (G3) nisu dirani.
