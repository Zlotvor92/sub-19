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

## Tumačenja taba (za potvrdu)

1. Razvoj 5K = baza + vrhunac (faze u kojima danas raste obim); oštrenje drži poslednji cilj (= vrh kad ga G1 dostigne).
2. G2 i granice b: rasterećenje/taper ne idu ispod prvog nivoa lestvice — kod malog obima je 60/70 % ispod najmanjeg
   smislenog treninga, pa tada ostaje prvi nivo (zato 373 / 372 / 392 nedelje iznad 60/70 %).
3. Doza zone = rad te zone (km) u poslednjoj UPISANOJ ne-rasteretnoj nedelji izgradnje koja ima tu zonu.
4. d: „cilj" za pojas = vrh obima plana; najkraće WU/CD trke 1,0 / 0,5 km (moj broj) kad ni prvi pojas ne skraćuje trku
   ispod najdužeg treninga; ako ni tada (najduži ≤ 6,5 km) — trka ostaje 6,5 km.
5. e: „tabela početnika" = kapacitet plana početnika za izabrane dane i tempo (5K nema posebnu tabelu obima početnika).

## Testovi i trajanje

| komanda | trajanje | rezultat |
|---|---|---|
| `npx vitest run --project node src/domain/generators/fiveK/v2` (brz, pre ispravki testova) | 49 s | 54 pala (očekivanja starih brojeva) |
| isto, posle ispravki | 53 s | 787/787 |
| `npx vitest run --project node …/p8.node.test.ts` | 6 s | 10/10 |
| sabotaže `P8-5K/sabotage.json` (12, brz nivo, `--bail=1`) | 70 s | 12/12 palo, `src` bajt-isti |
| `fixture15.ts` g07 / n08d / e08e / x08g | 6 s / 8 s / 112 s / 576 s | 0 odbijanja |
| pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | (dopuna ispod) | |
| `npm run check`, `--changed 9055e5b`, E2E `fivek-v2.spec.ts` | (dopuna ispod) | |

Ispravljeni testovi: verzija i KNOWN_VERSIONS (app), budžet 10 % (p4, workouts), prvi I (segment02, segment10, app
3 × 600 m), G2 rasterećenje sa prvim nivoom (segment03/04, segment09 bez QUALITY_REDUCED), e (p5, segment05, 08g, 08i),
brojevi primera posle G1 (segment07, 08d, 08e, 08g, 08i), 08l (spisak nedelja u napomeni), segment05 (rasterećenje
izuzeto iz „lagan = dugi"), segment10 (35 km umesto 30 za PLANNED_BELOW_TARGET), otisci `segment15.*-9055e5b.json`
umesto `segment14.*-8e87fd4.json` (razlog P8 = `testInputs.markP8`).

## Otvoreno / nije urađeno

- Skok doze posle prvog I: drugi I je ≥ 80 % budžeta (T4), pa p07 3 × 1000 → 6 × 800 m (13 → 21 min) u jednoj nedelji.
  Opcije: (A) prihvatiti; (B) druga nedelja vrhunca ≤ 85 % budžeta; (C) progresija od prvog I najviše +1 korak ponude.
- Plato dugog ostaje kad je vrh ≈ start (p01, p05, p08: 7–11 nedelja) — G1 nema prostora; organizatorovo pravilo
  vrha se ne menja.
- Upozorenja u `plan.warnings` ostaju po nedelji (validator ih čita); zbirno je samo u prikazu.
- Kontrolni test početnika / test u ned 3 po osećaju — nije u brifu P8 za 5K.
