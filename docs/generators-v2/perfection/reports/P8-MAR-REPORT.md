# P8 — maraton: ispravke po slepoj oceni i po glavnom treneru — izveštaj

10. 11. 2026 (Europe/Belgrade). Polazni SHA `0181e25` (marathon-v2.10.0) → marathon-v2.11.0. Zadaci
`briefs/P8-ispravke-po-slepoj-oceni.md` + `briefs/P8-dopuna-po-glavnom-treneru.md`. Menjano samo
`web/src/domain/generators/marathon/v2/**` i dokumentacija. Sudari pravila: `reports/P8-MAR-STOP.md` (S1–S6; rad nije
stajao, privremene opcije bez novih trenerskih pravila).

## Šta je ugrađeno (redovi `policy.ts`: P8-G1, P8-G2, P8-G4, P8-G5, P8-G6, P8-G7)

- **G4** — `quality.capM` (i dalje JEDNA funkcija plafona zone): min(udeo cilja; minuti rada po tempu zone te nedelje) —
  T ≤ 30 min (cilj ≥ 80 km: 40), I ≤ 20 min za VDOT < 40 (inače 24), MP ≤ 60 min, početnik ≤ 45 min; blok u dugom bez
  člana u minutima. Validator ZONE_CAP/START_LEVEL istom funkcijom; harness mreža nezavisno.
- **G2** — isti `capM`: plafon ≥ doza prvog nivoa lestvice zone. Na maratonu skoro bez efekta (v. dole).
- **G5** — `quality.taperMp` + `policy.taper.weeks[1].mpShare` 0,5 → 0,4: MP tapera = najviši nivo ≤ 60 % / 40 % poslednje
  MP doze izgradnje (trening ili blok); kad 2 × 3000 m ne staje — kontinuirani blok naniže na 0,5 km (min 1,0 km). Minimum
  2 × 3000 m ispred plafona (M7a) više ne važi. `week.sharpenerStructure`: dve jednake deonice, ukupno ≤ 10 min rada i ≤ MP
  N−1, korak 100 m, najmanje 2 × 400 m (bilo 2 × 2000 m, najmanje 2 × 1000 m). Rasterećenje (M5) je već bilo ≤ 60 % i 0,8 ×.
- **G1** — `volume.peakCap10`: vrh = min(staro; start × 1,30 / 1,35 / 1,40; satni plafon 9 / 10 / 11 h × srednji lagan
  tempo), ne ispod starta; `volume.buildStep10` (jedino mesto koraka): min(korak M6; razmak do vrha / preostale
  ne-rasteretne nedelje do kraja razvoja), korak < 3 % se ne primenjuje. Istorija obima adaptiranog plana čita upisani
  cilj prošlih nedelja (`generate.ts`, pouka 29 i za obim).
- **G7** — `periodize.testWeekOf`: ne pre nedelje 4 (prva ne-rasteretna ≥ 4 iste faze, inače bez testa); `week.ts`: u
  nedelji testa dan Q2 je lagan, stanje slotova se ne menja.
- **G6** — `lengths.easyLongShareOf/easyCap10`: lagan ≤ 0,70 × dugi za 4+ dana, 3 dana 0,80.
- **Maraton (a)** — `week.dayLimit(..., byKm)` u taperu: dan kvaliteta ni po km nije duži od dugog (logika, ne tekst).
- **G3 (deo)** — dan trke: „Maraton 42,2 km — prognoza h:mm:ss (pre starta 5 min laganog zagrevanja)" (po osećaju:
  „procena"); napomena oštrenja i tapera iz stvarnih brojeva; rečenica za plan bez testa; napomena spuštanja zbog minuta.
- Verzija `marathon-v2.11.0`; `KNOWN_VERSIONS` ∪ `marathon-v2.10.0`.

## Zamerka → uzrok → izmena → pre / posle (12 profila P7; K-mer, `P8-MAR/sum-{pre,posle}.md`, ispisi `plans-{pre,posle}/`)

| zamerka (ocena) | uzrok (pravilo, fajl) | izmena | pre → posle |
|---|---|---|---|
| p04: 95 km ≈ 11 h nedeljno, VDOT 35 | vrh = start × 1,5 / +30 (M6, `volume.ts`) | G1a satni plafon 9 h | vrh 95 → 73,6 km; 10,9 → 8,6 h |
| p04: lagani 19,2 km = 2 h 17 × 3 | lagan ≤ 0,8 × dugi, višak u lagane | G1a + G6 | najduži lagan 137 → 108 min; lagan/dugi 0,80 → 0,63 |
| p04/p12: MP 2 × 7000 m = 85–90 min | plafon MP samo 20 % km (M11) | G4 | p04 84,9 → 48,5 min; p12 89,8 → 38,5 min |
| p04: T 45 min, I 31 min | isto (10 % / 8 % km) | G4 | T 45,3 → 28,3; I 31,3 → 15,7 min |
| p03/p10: oštrenje 27–28 min MP | 2 × 2000 m za sve (M8) | G5 | 26,7 → 9,4; 28,4 → 9,9 min (svi profili 8,1–9,9) |
| p03/p10: taper N−1 MP 40–43 min | min 2 × 3000 m ispred udela (M7a) | G5 | 40,1 → 20,1; 42,6 → 21,3 min |
| p11/p12: taper N−2 MP 38 / 51 min | isto | G5 | 38,2 → 22,3; 51,3 → 22,5 min |
| +50 % obima (p01, p02, p09) | M6 | G1a faktor 1,40 | 60 → 56; 60 → 56; 75 → 70 km |
| obim dostiže vrh pa plato (p05 10 ned, p08 12, p10 9) | rast +6 % do vrha (M6) | G1 raspored do kraja razvoja | plato obima p05 10 → 6, p08 12 → 6, p10 9 → 5 ned |
| plato dugog (p04 15, p08 13, p10 9 ned) | dugi na plafonu udela/vremena od ned 1–5 | G1 (dugi prati cilj) | p04 15 → 8, p08 13 → 6, p10 9 → 5; p05 12 → 12 (32 km od ned 1) |
| lagani 70–100 % dugog | T1 0,8 (MAR-11) | G6 | najveći lagan/dugi: 0,80 → 0,69 (4+ dana); 3 dana 0,71 → 0,69 |
| napomena „MP skraćen…" a dan duži (7 planova) | poređenje samo po trajanju (`week.dayLimit`) | (a) i po km u taperu | dan kvaliteta duži od dugog po km: P7 5 → 0 profila; mreža P0 Σ 106 → 3 |
| tri teška dana / > 25 % brzih km | MP + T + dugi | G4, G5, G7 | nedelja > 25 %: mreža P0 R 62 → 58, F 15 → 10; P7 5 → 6 (p01, p02, p06: +1, taper sa manjim obimom) |
| test + T + dugi u istoj nedelji | test menja samo Q1 | G7 | nedelja testa bez drugog kvaliteta: svi profili sa testom |
| početnik bez provere (p11, p12) | M17: početnik nema test | nije menjano (nije u P8) | 0 → 0 |
| MP + T + dugi sa blokom (c) | — | provereno | 0 nedelja pre i posle (mreža P0 i P7) |
| p12 početnik +50 % | M17 vrh 1,5 × | S1: početnik zadržava faktor | 75 → 75 km (8,6 → 8,7 h) — otvoreno |
| p11 dugi 17,9 km | obim 25 → 37,5 km, 50 % nedelje u vrhu (F2) | G8 već postoji (F2: 3 nedelje, 50 %, 180 min) | 17,9 → 17,9 km, upozorenje postoji |

## Mreža P0 (192 ulaza; medijana [max]; K-mer) i mreže 02/03 (31 920; K-cls)

| metrika | R pre → posle | F pre → posle | B pre → posle |
|---|---|---|---|
| odbijeno (P0 / mreže 02–03) | 0 → 0 / 0 → 0 | 0 → 0 / 0 → 0 | 0 → 0 / 0 → 0 |
| vrh obima [km] | 74 [120] → 67,5 [116,7] | 60 [120] → 60 [110] | 45 [75] → 44,3 [74] |
| najviše sati nedeljno | 6,5 [13,6] → 6,3 [12] | 7 [14] → 6,7 [12,2] | 5,3 [8,8] → 5,2 [8,7] |
| plato obima / dugog [ned] | 5 / 7 → 5 / 5 | 3 / 7 → 4 / 5 | 1 / 5 → 2 / 4 |
| najduži dugi [km] | 24,1 [32] → 24,1 [32] | 23,2 → 22,4 | 18,2 → 18,3 |
| MP trening [min] | 50,8 [97,1] → 43,4 [50,9] | 59,6 [107,7] → 48,7 [59,6] | 52,5 [89,8] → 38,2 [39,4] |
| T / I trening [min, max] | 54,4 / 31,3 → 37,8 / 21,7 | 60,2 / 34,7 → 37,6 / 21,1 | 37,3 → 28 |
| blok MP u dugom [min] | 50,6 [74,6] → 42,3 [62,2] | 55,2 [71] → 55,2 [69] | — |
| taper N−2 / N−1 MP [min] | 30,2 / 25,4 → 28,9 / 18,7 | 38,9 / 29,8 → 29,8 / 21,3 | 38,5 / — → 22,3 / — |
| oštrenje [min] | 17,2 [25,5] → 9,5 [10] | 20,2 [28,4] → 9,7 [9,9] | — |
| lagan / dugi (najveći) | 0,60 [0,80] → 0,57 [0,80] | 0,64 → 0,63 | 0,53 [0,80] → 0,53 [0,70] |
| nedelja > 25 % brzih km (Σ; mreže 02–03) | 62 → 58 (10 790 → 7540) | 15 → 10 (3779 → 1866) | 0 → 0 |
| rast cilja < 3 % (Σ nedelja) | 99 → 41 | 43 → 27 | 14 → 11 |
| ukupno MP po planu [km] (K-cls) | 54 → 44 | 54 → 42 | 42 → 27,5 |
| planova sa testom (K-cls) | 21 840 → 21 840 | 8190 → 6930 | 0 → 0 |
| `DOSE_DROPPED` (K-cls, Σ) | 570 → 1548 | 168 → 1632 | 0 → 0 |

„Rast cilja < 3 %" posle P8 su nedelje čiji je cilj po pravilu porastao ≥ 3 %, a izvodljiv cilj (M6) je niži; korak po
pravilu manji od 3 % ne postoji (test `p8.node.test.ts`). G2 na maratonu: jedina promena je početnik 25–30 km koji u
specifičnoj fazi dobija MP 2 × 3000 m (pre T kontinuirano) — 41 min rada pri VDOT 35.

Promenjeni planovi (K-cls): 0 bajt-istih od 31 920 (oštrenje i taper menjaju svaki plan) → `segmentP8.stable-0181e25.json`
je prazan skup; lanac starih regresija više ne veže nijedan plan. Novo zaključavanje: `segment0{2,3-feel,3-beginner}.p8.baseline.json`
(svi planovi mreža, red + heš).

## Tumačenja izvođača (molim potvrdu)

- T1: satni plafon čita VDOT i lagan tempo POLAZNOG plana; nov rezultat u adaptaciji ne pomera vrh.
- T2: „najveći MP rad izgradnje" za taper = poslednja MP doza slota (max(trening, blok), M19 O3) — blok ulazi u osnovu.
- T3: najniži nivo lestvice staje i preko minuta (G2 ispred G4): MP 2 × 3000 m spor početnik (lagan 7:30) = 47 min > 45.
- T4: korak rasta broji preostale nedelje iz polaznog rasporeda (prinudno rasterećenje i nov start ne menjaju korak već
  upisanih nedelja); pri umoru pre starta nedelja 3 dobija cilj između planirane 2. i 3. nedelje.
- T5: „ista doza druge strukture" (M10) je češća: sporiji rast cilja → sledeći nivo ne staje → T kontinuirano u bazi
  može postati T deonice iste doze (profil 16 ned / 45 km / VDOT 45, nedelja 3).
- T6: pouka 32 (doza spuštena jer bi dan bio duži od dugog) sada se javlja i van nedelje spuštene kapacitetom: 3/8190
  planova po osećaju (5 dana, 40 km, lagan 4:30).

## Sabotaže (`P8-MAR/sabotage.json`; iz `web/`: `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P8-MAR/sabotage.json --quiet`)

15/15 palo, `--bail=1`, stanje `src` vraćeno (19,7 s): G4 bez minuta, početnik MP 60, validator bez minuta, G2 bez donje
granice, taper N−1 50 %, MP tapera ne ispod 2 × 3000 m, oštrenje bez 10 min, (a) bez provere km, vrh bez faktora, vrh bez
sati, rast neraspoređen, korak < 3 % primenjen, lagan 0,80 za 4+ dana, nedelja testa sa Q2, test pre nedelje 4. Prva
verzija (a) nije pala — u test dodati profili (brz trkač, mali obim) na kojima se slučaj dešava.

## Testovi (iz `web/`, 10. 11. 2026, Europe/Belgrade)

| komanda | trajanje | ishod |
|---|---|---|
| `npx vitest run --project node src/domain/generators/marathon/v2` (brz, više puta u toku rada) | 30–40 s | na kraju 0 padova |
| `TEST_FULL=1 MARATHON_V2_WRITE_BASELINE=1 npx vitest run --project node {grid,feelGrid,beginnerGrid}.node.test.ts` (1. put, tri fajla uporedo) | 100 s | OOM u mrežama 02 i po osećaju; bazna linija početnika upisana |
| isto, `grid` pa `feelGrid`, `NODE_OPTIONS=--max-old-space-size=10240 --maxWorkers=1` | 214 s + 75 s | bazne linije P8 upisane |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2` (jednom, na kraju) | 781 s | 78 fajlova, 549 testova zeleno |
| `npm run check` (1. put) | 178 s | stao na formatu 3 nove bazne linije (prettier) |
| `npm run check` (posle `prettier --write` baznih linija) | 367 s | 296 fajlova, 3318 testova zeleno |
| `npx vitest run --changed 0181e25f` | 99 s | 104 fajla, 1028 testova zeleno |
| `npx playwright test e2e/marathon-v2.spec.ts --trace off` | 38 s | 3/3 |
| `node scripts/sabotage.mjs …/P8-MAR/sabotage.json --quiet` | 20 s | 15/15 |

Pisanje baznih linija celih mreža traži veći hip (harness drži sve planove): komanda je u drugom redu tabele.

Prilagođeni testovi (očekivanje koje P8 menja, sa komentarom): adapt, beginner, dayCap, feel, p2, p5, policy, preStart,
quality, segment07, segment08b, segment09, segment11, validate, volume, week, app/app, app/adaptFlow, app/handoffSource,
grid.harness (invarijante: test jedini kvalitet, nezavisan plafon sa minutima, oštrenje ≤ 10 min, lagan po broju dana,
test ≥ nedelja 4, STABLE P8 + nova bazna linija). Nov `p8.node.test.ts` (13).

## Šta nije urađeno i zašto

- **G3 ostatak:** sirove napomene nedelje i dalje nose interne oznake („M7", „odstupanje", „Cilj po pravilu … nije
  izvodljiv") — aplikacija ih čisti (`userText`, `technicalNote`; `segmentFinal.node.test.ts` zelen), ali ispis P7
  (`P7/render.ts`) štampa sirove napomene. Predlog: P9 ispis kroz `app/plan.generatedPlan` ili čišćenje napomena u domenu
  (zaseban, tekstualni segment). „Najviše jedno zbirno upozorenje po vrsti" nije mereno ni menjano.
- **G8:** bez izmene — početnik već ima 3 nedelje vrha sa dugim do 50 % nedelje i 180 min (F2); prag poruke ostaje 26 km
  (nalog: 28 km). p11 ostaje na 17,9 km uz postojeće upozorenje (fali obim: 37,5 km × 50 %).
- **Ostaci (a):** 1/192 tapera gde je uz T dan MP dan po km duži od dugog za 0,25 km; 2 nedelje baze/rasterećenja sa T
  danom dužim od dugog po km (bez napomene koja tvrdi suprotno).
- Početnik bez provere forme, talas dugog, blok za 3 dana/početnika, donji prag doze — van P8 (krug 2).

## Otvorena pitanja organizatoru

1. S1: početnik i faktor vrha (O1 privremeno: izuzet; p12 ostaje +50 %).
2. S2: `DOSE_DROPPED` posle bloka (1548 + 1632 upozorenja) — prihvatiti, ili O2 (stanje slota ograničeno minutima)?
3. S3: ukupno MP −18 do −35 % — prihvatiti kao cenu minuta, ili podići blok/učestalost u krugu 2?
4. S4: plan po osećaju 12–13 nedelja bez testa (1260/8190) — po slovu G7; O2 test u razvoju?
5. S5 i T1–T6: potvrda tumačenja.
6. P9: ispis sirovih napomena (G3 ostatak) — ko čisti tekst za ocenjivača?
