# F7 — maraton kao podatak za V4 (13. 11. 2026, po Beogradu)

Grana `claude/v4` (rebase na `a8178a1`). `web/src/domain/v4/distances/marathon/`: šabloni 1–52 ned × 7 dana × 4
porodice (jezgro 8–30), biblioteka 33 unosa, `safety`, tekstovi, 19 profila (P9 MAR + 7 iz briefa), 29 scenarija,
6 parova, kapija. Nula uvoza iz drugih distanci, `engine/` i `fitness/` nedirnuti; `plans/dist.ts`, `target.ts` dobile
`--dist marathon` (ispisi HM i 10K bajt-isti). **Maraton: 99 testova prolazi, 7 `it.fails`, 0 pada; ceo V4 917 + 27
očekivanih, 0 pada (86 s); typecheck, lint, prettier čisti. Kapija 0 prekršaja, 19/19.**

## Odluke i brojevi
| odluka | broj | izvor / pouzd. |
|---|---|---|
| lestvica vrha u km (kapija): ≤ 25 km × 2,1 (≥ 24 ned) / 1,8 / 1,55 / 1,35; 25–40 km × 1,6 (≥ 18) / 1,45 / 1,25; 40–60 km × 1,4 (≥ 16) / 1,3 / 1,15; > 60 km × 1,3 / 1,25 / 1,12; tegoba ili staž < 8 ned ≤ × 1,4 | p07 × 1,22, p11 × 1,95, p05 × 1,2 | README (× 1,30 / 1,40, početnik × 2,1) — srednja |
| najduži dugi po VREMENU (`longMaxSec`): brz 2 h 45, srednji i povratnik 3 h, mali 3 h 05, spor i početnik 3 h 10, nov početnik 3 h 15 | p05 35 km / 2 h 29, p12 27,8 km / 3 h 05 | README tabela, brief (3 h – 3 h 15, ≤ 35 km) — visoka |
| udeo dugog (motor, km laganog tempa): 3 dana 50 %, 4–5 dana 42 %, 6 dana 38 %; ispod 75 km 43 %, u 3 nedelje najdužeg 47 %; početnik 4 dana 47 % | stvarno (kapija): 3 dana ≤ 52 %, 4 ≤ 45 %, 5+ ≤ 44 % (+5 u 3 ned) | README 33–50 %, ciljni p11 52 %, p12 41 % — srednja |
| talas dugog od početka 100 / 88 / 100 / 82 % (≥ 16 nedelja, 4+ dana); nedelja prati dugi (− 30 % pada dugog); 1–3 dana i početnik bez talasa u telu | p08 bez `ispod-cilja` | README; izbor za 3 dana — srednja |
| rep 9 nedelja: N−8 rasterećenje + 10 km subotom, N−7 blok ≈ 8 km MP, N−6 talas + MP 2 × 4–5 km usred nedelje, N−5 blok ≈ 12 km, N−4 rasterećenje, N−3 najteža (najduži dugi + blok ≈ 14 km), N−2 ≈ 78 % (dugi 20–22 sa 3 km MP + MP 2 × 3 km), N−1 ≈ 60 % (dugi 12–14, MP 4 km), N ≈ 30 % (oštrenje MP 2 × 5 min) | p07 blokovi 9 → 13 → 14 km (ciljni 8 → 12 → 14) | ciljni p07, p08 — visoka |
| brz rad (prag, I, R, MP i blok): ≤ 18 %, vršna ≤ 20 %; vršna ≥ 10 % (početnik/tegoba ≥ 7 %) | ostvareno 13–20 % u vršnoj | brief 15–18 / 20; ciljni 11–21 %. Obrazloženje: maratonska nedelja je duža, a blok od 60–70 min već nosi najveći deo rada; MP je uključen jer je 70 min MP u dugom najveći pojedinačni napor nedelje — srednja |
| doze: prag ≤ 35 min, intervali ≤ 21 min (samo razvoj, VDOT ≥ 40 i ≥ 4 dana, inače 3 min po osećaju), MP usred nedelje ≤ 50 min (brz 55, početnik 45), blok ≤ 70 min (brz 75, spor/početnik 55), oštrenje ≤ 10 min | — | README — visoka |
| sužavanje 3 nedelje: N−2 ≤ 82 % (kapija 85 %), N−1 ≤ 68 %, nedelja trke ≤ 40–45 %; brz rad nedelja „taper" ≤ 68 % vršne | ostvareno 61–81 / 45–65 / 22–42 % | README 78–80 / 58–62 / 25–30 %; brief ≈ 80 / 60 / 40 — srednja |
| najduži dugi najkasnije N−3, najduži (≥ 95 %) nikad dve nedelje zaredom; u nedelji sa blokom nema MP usred nedelje; start trke MP + 5–10 s/km; provera 10 km u N−8 | 19/19 | brief, README — visoka |
| adekvatno: 16 ned, vrh 60 km, 4 dana, dugi 28 km (provera 27 km ili 2 h 50), staž 26 ned, kraća distanca `hm` | upozorenja p13, p19 predlažu 16 nedelja ili polumaraton | brief, README p11 — srednja |
| tekstovi: unos na 35–40 min uz vodu u svakom dugom ≥ 90 min, obuća u dugom ≥ 2 h 30, raspodela tempa, zid, ishrana na trci i 2–3 dana pred trku | — | README, brief |

## Po profilu
(vršna = N−3; ≥ 28 km = broj nedelja; N−2 / N−1 / N = km kao % vrha, bez trke; ceo ispis `plans/MAR/pregled.md`)

| profil | ulaz | vrh km (×) | najduži dugi | ≥ 28 km | blok MP | brz rad vršne | N−2 / N−1 / N | upozorenja |
|---|---|---|---|---|---|---|---|---|
| p01 | 40 km, 4 d, 16 ned | 55,5 (1,39) | 23,0 km / 2 h 09 | 0 | 59 min | 18 % | 81 / 62 / 27 | mali-obim, dugi-za-distancu |
| p02 | 40 km, 4 d, 18 ned | 59,5 (1,49) | 25,0 km / 2 h 10 | 0 | 54 min | 20 % | 75 / 60 / 28 | dugi-za-distancu |
| p03 | 30 km, 3 d, 18 ned, spor | 46,5 (1,55) | 22,5 km / 2 h 41 | 0 | 55 min | 16 % | 69 / 49 / 25 | mali-obim, malo-dana, kratak-dugi |
| p04 | 65 km, 5 d, 24 ned, spor | 83,1 (1,28) | 26,9 km / 3 h 05 | 0 | 55 min | 14 % | 63 / 48 / 27 | — |
| p05 | 110 km, 6 d, 18 ned, brz | 132 (1,20) | 35,0 km / 2 h 29 | 11 | 68 min | 16 % | 71 / 49 / 30 | — |
| p06 | 40 km, 5 d, 12 ned, brz | 55,7 (1,39) | 22,5 km / 1 h 41 | 0 | 45 min | 17 % | 80 / 65 / 42 | kratka-priprema, mali-obim, kratak-dugi, lagan-kratak |
| p07 | 65 km, 5 d, 12 ned (ciljni) | 79,9 (1,22) | 28,0 km / 2 h 34 | 1 | 70 min | 20 % | 77 / 59 / 30 | kratka-priprema |
| p08 | 50 km, 3 d, 24 ned (ciljni) | 67,5 (1,35) | 29,5 km / 2 h 43 | 4 | 70 min | 18 % | 61 / 45 / 22 | malo-dana |
| p09 | 50 km, 4 d, po osećaju | 66,0 (1,32) | 27,5 km / 2 h 33 | 0 | 69 min | 18 % | 77 / 56 / 26 | dugi-za-distancu (v. motor t. 2), nema-podataka |
| p10 | 30 km, 3 d, po osećaju | 46,8 (1,56) | 22,6 km / 2 h 41 | 0 | 55 min | 16 % | 68 / 50 / 25 | mali-obim, malo-dana, kratak-dugi |
| p11 | početnik 25 km, 4 d, 24 ned (ciljni) | 48,7 (1,95) | 22,2 km / 2 h 34 | 0 | 55 min | 16 % | 79 / 56 / 28 | mali-obim, dugi-za-distancu |
| p12 | početnik po osećaju 50 km, 5 d, 18 ned (ciljni) | 64,6 (1,29) | 27,8 km / 3 h 05 | 0 | 55 min | 13 % | 80 / 62 / 29 | nema-podataka |
| p13 | prvi maraton 28 km, 3 d, 10 ned | 33,6 (1,20) | 16,8 km / 2 h 06 | 0 | 45 min | 18 % | 73 / 54 / 29 | kratka-priprema (16 ned ili polumaraton), mali-obim, malo-dana, kratak-dugi |
| p14 | iskusan 85 km, 6 d, 16 ned | 107,7 (1,27) | 32,5 km / 2 h 40 | 4 | 69 min | 17 % | 76 / 55 / 30 | — |
| p15 | povratnik (4 ned pauze), 40 km, 5 d, 20 ned | 61,0 (1,53) | 26,3 km / 2 h 50 | 0 | 60 min | 19 % | 76 / 58 / 32 | povratak, kratak-dugi, lagan-kratak |
| p16 | stariji, tegoba u junu, 45 km, 4 d | 60,4 (1,34) | 26,7 km / 2 h 55 | 0 | 55 min | 18 % | 75 / 58 / 27 | obim-za-nivo, tegoba |
| p17 | cilj ispod 3 h, 90 km, 6 d | 112,6 (1,25) | 32,0 km / 2 h 27 | 4 | 67 min | 17 % | 77 / 53 / 32 | — (prognoza 2:53, cilj 2:59 dostižan) |
| p18 | „samo da završim", početnik po osećaju 30 km, 4 d, 20 ned | 47,0 (1,57) | 21,4 km / 2 h 34 | 0 | 55 min | 16 % | 77 / 56 / 26 | mali-obim, dugi-za-distancu |
| p19 | maraton za 8 ned, 40 km, 4 d | 46,9 (1,17) | 20,0 km / 2 h 06 | 0 | 55 min | 18 % | 79 / 63 / 28 | kratka-priprema (16 ned ili polumaraton), mali-obim, kratak-dugi |

`target-compare.md`: 17 od 78 nedelja u tolerancijama (odstupa: p07 dugi 28 prema 32, p11 vrh 49 prema 52 i dugi 22
prema 27, pripremni polumaraton trenera). Scenariji: s28 (propušten najduži dugi u N−3, p07) — 1 promena, rečenica
da se ne nadoknađuje jer su poslednje dve nedelje za odmor; s29 (bolest 7 dana u N−3, p08) — N−2 i N−1 postaju
povratak (dugi 14 → 8 km), trka ostaje. Parovi: P1 B i P2 B niži vrh i dugi od A (P2 B 32,5 / 14,4 km), P3 A povratnik.

## Zahtevi za motor (nisam menjao; zaobiđeno podatkom ili imenovano u testu)
1. **Množilac opterećenja za dugi > 2 h 30.** `engine/load.ts` broji svaki minut dugog isto: p12 n15 dugi 3 h 05
   (27,8 km, 9 km MP) = 215 BO = 46 % nedelje (471 BO), kao 3,6 laganih dana od 60 min. Predlog: podatak
   `safety.longFatigue: { fromSec: 9000, factor: 1.5 }` — minuti dugog posle 2 h 30 × faktor u ceni (rast, udeo dugog,
   forma/umor); p12 dugi ≈ 238 BO. Do tada: `longMaxSec` 2 h 45 – 3 h 15, udeo dugog, 3 najduža u repu na 2 nedelje.
2. `longReaches` (`dugi-za-distancu`) meri dugi u km laganog tempa, bez viška km bloka: p09 „najduži 27,5 km — treba
   bar 27 km". Zaobiđeno `longCheckKm` 27 / 2 h 50; predlog: stvarni km dugog.
3. Pripremni polumaraton na dan dugog (ciljni p08/p11/p12, README 6–9 ned) — provera je mesto kvaliteta; predlog:
   `all-out` kao stimulus dugog + nedelja posle bez kvaliteta. 4. Srednje-dugi (lagan dan 55–65 % dugog pri
   ≥ 60 km) — predlog oznaka u nameri nedelje. 5. Upozorenja se ne spajaju (p13 ih ima 4; K3 u testu ≤ 4).
6. `dosePct` × osnovica prelazi plafon kod velikog obima (kao F7-10K t. 2; p05 MP 3 × 4,5 km — plafon brz 55 min).
7. Čuvar `taper` meri svaku nedelju vrste „taper" sa `weekBeforeMaxOfPeak`, motor samo dane 8–14; maratonska N−2 je
   „taper" (inače dugi vezan za polazni: p05 32 km dve nedelje pred trku) → broj 0,68. Predlog: poseban broj za N−2.
8. Ponovno planiranje (KNOWN/`it.fails` u testovima): povratak posle 7 dana bolesti ne vraća obim i nema „srazmerno
   niži" (s5–s7, A10 b); nadovezani prozori — rep > 4 ned (s25, s26, Z10); s07 izlaz + 29 % (R2); nalazi posle
   događaja (s2/s14 `ispod-cilja` 3 dana, s12 `taper`, s25 `brz-udeo`); s26 bez rečenice o izbačenoj proveri (A11,
   posle rebase-a na `a8178a1`). 9. Forma „ništa" 2–30 s sporije: p06, p07, p09, p18, p19 (`FORM_DRIFT`).
10. `birthYear` motor ne čita — „stariji" (p16) personalizovan samo tegobom (≤ × 1,4). 11. Mali obim po danu: dan
    izostavljen pa vraćen = skok nedelje (mreža, početnik 25 km; opravdano u testu).

## Otvoreno
1. Najduži dugi kod 4–5 dana sa 45–60 km vrha 23–25 km (README tabela 26–30; udeo bi bio ≈ 50 %, README za 4 dana
   dozvoljava 45 % u 3 nedelje); kapija ≥ 23 km, plan nosi `dugi-za-distancu` sa predlogom. p07 28 km prema 32.
2. 3 dana (p08) bez talasa u telu (inače `ispod-cilja`). 3. Provera u N−8 (README „ned 4–8"), brief kaže 4–6 nedelja
   pred maraton — nisam pomerio (N−4 je rasterećenje 8 dana pred najteži dugi); pitanje za trenera.
4. Ocena trenera i drugog sudije nisu urađene. Planove p07, p08, p12, p13, p19 i scenarije s26–s29 pročitao sam dan po
   dan; ostale profile preko tabela i kapije.
