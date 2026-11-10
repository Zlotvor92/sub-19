# P5 — 5K: kontrolni test u planu sa rezultatom i kvalitet u adaptaciji (5k-v2.14.0)

10. 11. 2026 (Europe/Belgrade). Polazni SHA `8e87fd4` (5k-v2.13.0). Za 5K važe samo F1 i F2 (F3 — 5K već ima ubrzanja;
F4 — druga arhitektura doze). Menjano: `web/src/domain/generators/fiveK/v2/**`, fiksture byteSame 10K/HM/MAR (samo
ključevi „5K v2"), oznaka verzije u `src/features/onboarding/fiveKV2Flow.test.tsx`, dokumentacija. STOP nije bilo:
nijedno novo odbijanje, nijedan sudar koji postojeća tumačenja ne rešavaju (otvorena pitanja na kraju).

## Šta je ugrađeno

| pravilo | mesto (jedan vlasnik) | oznaka |
|---|---|---|
| F1 plan sa rezultatom (ne početnik) ≥ 10 ned → tačno jedan test 3 km (isti kao po osećaju: WU/CD pojasa, isti obračun obima, nije rad zone) u poslednjoj ne-rasteretnoj nedelji vrhunca, dan Q1 umesto I; Q2 = T vrhunca; stanje I slota iz nedelje pre testa | `policy.feel.resultTest.minWeeks`; `periodize.testKindOf/resultTestWeekOf/expectedTestWeek` (konstruktor, `steps.framesFor`, validator TEST_WEEK); `workouts.peakWeek/peakWeekOne` (test), `workouts.testRun` (premešten iz `feel.ts`, isti trening) | heuristika, odluka organizatora P5 |
| F1 napomena nedelje i plana (čemu test služi, unesi rezultat → tempo od sledeće nedelje) | `policy.feel.resultTestNote/resultTestWeekNote`; `generate.finalize` | — |
| F2 (Odluka 10) dva uzastopna dana kvaliteta (Q1/Q2, ne test) u 14 dana do asOf, poznata (zapis, potpuna pokrivenost ili prijavljena pauza), svaki neodrađen ili RPE ≥ 9 → nedelja n (izgradnja, ne rasterećenje) ponavlja poslednju dozu svakog slota; cilj obima isti | `policy.adapt.hardLookbackDays/hardRpe/hardMessage`; `assess` (korak `hard`, razlog HARD_QUALITY); `steps.holdWeek` (oznaka nedelje `hold`); `workouts` (R/T baza, I/T vrhunac, RP/R oštrenje; `heldReps/heldT`), `feel.simpleWeekQuality` (svaka vrsta); validator DOSE_HOLD | heuristika, odluka organizatora P5 |
| F2 prioritet: ispod bola, pauze, umora i manjka izvršenja (HARD_QUALITY applied false „nadjačano (…)"); isti zapisi ne prave nov korak (`hard.lastHard`, kao umor — pouka 36); taper/trka/rasterećenje bez efekta | `assess` | — |

`policyVersion` 5k-v2.14.0; `app/plan.ts KNOWN_VERSIONS` + 5k-v2.13.0; red u `DECISIONS`; `app/adapt.ts` naziv uslova
„preteški ili preskočeni treninzi kvaliteta" i traka (primenjen razlog). Prikaz: dan testa ima postojeću oznaku `test`
(`app/plan.ts tagOf/kindOf`); napomene bez internih oznaka (test proverava da poruka F2 nema „HARD_QUALITY/Odluka/F2").

Tumačenja (moja, vredi potvrde): (T1) „potpuno pokrivena" = dan ima zapis ILI je u potpunoj pokrivenosti ILI u
prijavljenoj pauzi (zapis `completed: false` je činjenica i bez pokrivenosti). (T2) „Ponavlja poslednju dozu" = tačno ista
doza slota kad staje u budžet nedelje i u najduže ponavljanje na tekućem tempu; inače postojeći izbor. Prva doza vrste u
fazi nije rast (nema čega da se zadrži). Nedelja zadržavanja sme da ponovi par → izuzetak QUALITY_REPEAT, BASE_PLATEAU i
donjeg praga 70 % budžeta samo za tu nedelju. (T3) Test u planu sa rezultatom koji adaptacija blokira (rasterećenje,
ograničenje kvaliteta) otpada; premešta se i dalje samo u planu po osećaju (postojeći uslov „nedelja po osećaju" u
`framesFor`); nov rezultat ukida test od svoje nedelje (postojeće pravilo). (T4) R oštrenja se pamti u dozi (`WeekDose.rs`)
da bi i on mogao da se zadrži.

Uslovi 1–8: jedan vlasnik (gore), jedan plafon po zoni (bez novog plafona; DOSE_HOLD samo prijavljuje), WU/CD
nepromenjeni, adaptacija — uslovi poznati unapred (korak `hard`) ulaze u konstruktor, plan nosi policyId/Version i fazu,
0 novih uvoza van foldera (`isolation.node.test.ts` prolazi), degenerisan plan: `p5.node.test.ts` (nedelja testa ≥
minWeekKm, bez praznog treninga, lagan ≤ dugi; nedelja zadržavanja bez praznog treninga).

## Komande merenja (iz `web/`; nisu testovi)

- **K1** `node ../docs/generators-v2/perfection/P5-5K/measure.ts pre|posle` (pre: na 8e87fd4, pre izmene koda) — 4 374
  ulaza: mreža P0 5K (148) + gusta mreža R (3–5 d × svaki ceo km × 6–16 ned × VDOT 35/45/55/65 = 4 224) + profili (a), (b); ≈ 8 s.
- **K2** `node ../docs/generators-v2/perfection/P5-5K/compare.ts pre posle`.
- **K3** `node ../docs/generators-v2/perfection/P5-5K/testweek.ts` — nedelja testa (gusta mreža 10–16 ned, 2 688 planova).
- **K4** `node ../docs/generators-v2/perfection/P5-5K/f2.ts posle` — mreža tokova F2 (uzorak rane mreže 08g, 194 osnove; asOf
  kraj nedelje 1 … N − 2; kontrola / RPE 9 / neodrađeno × bez i sa bolom, umorom, manjkom; lanac); 44 s.
- **K5** `node ../docs/generators-v2/perfection/P5-5K/oneq.ts pre|posle` — nalaz P4 na trajnoj ranoj mreži (104 800 tokova); ≈ 220 s.
- **K6** `node ../docs/generators-v2/perfection/P5-5K/profile.ts <v2 dir> a|b` → `P5-5K/profile-{a,b}-{pre,posle}.txt`.
- **K7** `node ../docs/generators-v2/perfection/P5-5K/fixture14.ts <8e87fd4 v2 dir> g07|n08d|e08e|x08g` — otisci regresije.

## F1 pre / posle (K1, K2, K3)

| metrika | pre (5k-v2.13.0) | posle (5k-v2.14.0) |
|---|---|---|
| odbijeno (4 374 ulaza) | 0 | 0 |
| testova po planu: R 6–9 ned / R 10–16 ned / F / B | 0 / 0 / 1 / 0 | 0 / 1 (2 761 plan) / 1 / 0 |
| faza nedelje testa (R) | — | vrhunac 2 761/2 761 |
| nedelja od testa do trke (R) | — | medijana 5 [4–5]; 10, 13, 14 ned: 4; 11, 12, 15, 16 ned: 5 |
| nedelje dana bajt-iste (R sa testom) | — | 33 171/35 932; promenjena je SAMO nedelja testa (2 761/2 761) |
| planovi bez testa (R < 10 ned, F, B) | — | 1 613/1 613 bajt-isti |
| vrh cilja obima promenjen | — | 0 planova |
| PLANNED_BELOW_TARGET (planova) | 1 511 | 1 718 (+207) |
| nedelja testa: planirano − cilj [km] (K3, n 2 688) | — | medijana 0; < 0 u 1 204; < −1 km u 1 029; najviše −3,98 |
| trajanje dana testa / dan I nedelje pre | — | medijana 0,80 [0,55–1,45] |
| % km bržih od E, R, medijana nedelja vrhunca | 17,6 | 17,0 (ostale faze iste) |
| nedelje > 25 % km bržih od E (K1, R) | 0 | 16 — sve nedelje testa, 4 d 15–16 km VDOT 65 (25,3 / 28,7 %) |

Uzrok manjka u nedelji testa: dan testa (WU + 3 km + CD) ima 3–4 km manje od dana I; oslobođeni km idu u lagane dane do
granice lagan ≤ 0,8 × dugi (T1), ostatak je „planirano < cilj" sa napomenom (uslov 3 — WU/CD nije pufer). Isto se već
dešava u planu po osećaju. Test se u M7 broji kao brz (zona RP), zato 16 nedelja > 25 %.

Profil (a) (10 km 46:00, 40 km, 4 d, 16 ned; `P5-5K/profile-a-*.txt`): jedina razlika je nedelja 11 — bilo I 6 × 800 m
(11,6 km, 62 min) + T 2 × 2000 m, sada kontrolno trčanje 3 km (7 km, 42 min) + isti T; planirano 41,3 → 40,4 km (lagan
7,5 → 11,2 km, granica 0,8 × dugi 14 km); napomena nedelje i plana; test 5 nedelja pre trke (posle njega rasterećenje 12,
oštrenje 13–14, taper 15). Profil (b) (8 ned): bez promene osim oznake verzije.

## F2 — mreža tokova (K4; 194 osnove uzorka 08g; po scenariju R 508, F 591, B 402 toka)

| scenarij | odbijeno | primenjeno | nije primenjeno (razlog) | nedelja zadržavanja po fazi (baza / vrhunac / oštrenje) |
|---|---|---|---|---|
| kontrola (RPE 5), i uz bol / umor / manjak | 0 | 0 | — (nema okidača) | — |
| R RPE 9 | 0 | 365 | 143 (sledeća nedelja rasterećenje/taper/trka) | 137 / 145 / 83 |
| R neodrađeno | 0 | 256 | 132 manjak izvršenja, 120 nije izgradnja | 106 / 94 / 56 |
| F RPE 9 / neodrađeno | 0 / 0 | 429 / 340 | 162 / 251 | 156 / 154 / 119 — 115 / 129 / 96 |
| B RPE 9 / neodrađeno | 0 / 0 | 201 / 201 | 201 / 201 | 18 / 78 / 105 |
| + bol (R/F/B, oba okidača) | 0 | 0 | sve „nadjačano (bol)" | — |
| + umor | 0 | 0 | „nadjačano (umor)" ili nije izgradnja | — |
| + manjak (pola km ostalih dana) | 0 | R 201, F 208, B 2 (RPE 9); 0 (neodrađeno) | „nadjačano (manjak izvršenja)" | — |
| lanac: isti zapisi + urađena sledeća nedelja (asOf + 7) | 0 | 0 | R 208, F 233 „za ove zapise… već zadržana"; ostalo bez okidača | 0 novih nedelja |

Nedelja zadržavanja prema kontroli iste nedelje (RPE 9, n 995): doza manja 520, ista 457 (rast ionako nije bio moguć ili
je prva doza vrste), veća 18 — sve baza 4 d, T: kontrola prelazi kontinuirano → cruise sa manje km (npr. 3,2 → 3,0 km),
zadržana nedelja ponavlja 3,2 km; nijedna nije veća od prethodne nedelje (DOSE_HOLD 0). Cilj nedelje različit: 0.
Prva verzija validatora odbila je 19 F tokova (referenca nedelja pre testa po osećaju, a T raste i u nedelji testa) →
referenca uključuje i nedelju testa → 0.

## Nalaz P4: sporiji rezultat u vrhuncu → „jedan kvalitet doze rasterećenja" (K5)

| | pre | posle |
|---|---|---|
| tokova „slower" sa tom napomenom posle asOf / svih „slower" | 10 / 4 192 | 10 / 4 192 (isti tokovi) |
| nedelja (sve u vrhuncu) | 14 | 14 |
| odbijenih tokova (cela mreža 104 800) | 0 | 0 |

Pogođeni su samo 5 d / 50–60 km / VDOT 38 (−2 VDOT u vrhuncu, `P5-5K/slower.ts r-d5-12w-60km-v38-1 w5end`): pre
rezultata I 6 × 1000 m (5:00 oporavak); posle VDOT 36 ista doza traje 320 s > iRepMaxSec 300 s, gušći oporavak ne staje
(F1 P4) → lanac „jedan kvalitet doze rasterećenja" 6 × 800 m bez T, 1–2 nedelje do rasterećenja. Isti obrazac (bez veze sa
sporijim rezultatom) imaju pauza, bol i manjak izvršenja — tamo je to namera koraka (posle P5: pauza 35 dana 191 → 189
tokova, ostali ± 1–3 — F1 ukida I nedelje testa). U ovom toku nov rezultat ukida i test nedelje 7.
Predlog (bez ugradnje): blaža grana je potrebna, ali mala — opcija B1 „nov rezultat počinje nov segment doze slota u
tekućoj fazi" (kao nov start posle bola: `steps.doseResetAt` za korak sa `vdot`), pa nedelja posle rezultata bira prvu
dozu ≥ 80 % budžeta po novom tempu (npr. 5 × 1000 m ili 6 × 800 m + T) sa dva kvaliteta; ili B2 „zadržana I doza koja
više ne staje u iRepMaxSec → isti rad kraćim ponavljanjima (altMain 'alt' uz trajanje)". B1 je jedno pravilo za sve
zone i pokriva i brži rezultat; B2 menja samo ovaj slučaj. Obim: 0,24 % „slower" tokova — prioritet nizak.

## Promenjeni planovi i otisci regresije (K7, prema 8e87fd4; razlog P5 = `testInputs.markP5`, CH = lanac)

| mreža | tokova | promenjeno | razlog | trajanje K7 |
|---|---|---|---|---|
| g07 (generisanje) | 700 | 160 | P5 160 (planovi sa rezultatom ≥ 10 ned) | 5 s |
| n08d | 1 124 | 410 | P5 410 | 8 s |
| e08e | 16 804 | 10 597 | P5 10 597 (većinom samo razlog HARD_QUALITY applied false u pauzi) | 106 s |
| x08g | 104 800 | 32 837 | P5 24 391, CH 8 446 | 551 s |

0 tokova bez razloga, 0 novih odbijanja (K5: cela rana mreža 104 800 tokova posle izmene, 0 odbijenih). Otisci
`segment14.*-8e87fd4.json` zamenjuju `segment13.*-a859ca7.json` (obrisani).

Van foldera (`BYTE_SAME_RECORD=1`, 6/6 posle snimka): 10K `byteSame.068410b` 20/140 ključeva, HM `28da6af` 14/150, MAR
`9443676` 14/223 — svi promenjeni ključevi sadrže „5K v2", 0 drugih.

## Testovi i sabotaže

| komanda (iz `web/`) | trajanje | ishod |
|---|---|---|
| `npx vitest run --project node src/domain/generators/fiveK/v2/p5.node.test.ts` (namenski, više puta) | ≈ 2 s | 9/9 |
| `npx vitest run --project node src/domain/generators/fiveK/v2` (brz, u toku rada) | 48 s | 1.: 28 pada (oznaka verzije, stari testovi „vrhunac uvek I", „plan sa rezultatom nema test") → usklađeno; 2.: 777/777 |
| `npx vitest run --project node src/domain/generators/{tenK,halfMarathon,marathon}/v2/app/byteSame.node.test.ts` (+ `BYTE_SAME_RECORD=1`) | 7 s | 6/6 posle snimka |
| `npx playwright test e2e/fivek-v2.spec.ts --trace off` | 42 s | 3/3 |
| `npm run check` (1.) | 115 s | format: 4 otiska neformatirana → prettier |
| `npm run check` (2.) | 316 s | 3886/3887 — `features/plan/fiveKV2Import.test.tsx` (vidi pitanje 6) → usklađeno, 1/1 |
| `npx vitest run --changed 8e87fd4` | 129 s | 1936/1936 (151 fajl) |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 239 s | 796/796 (42 fajla) |

Van foldera `fiveK/v2` u testovima: oznaka verzije u `features/onboarding/fiveKV2Flow.test.tsx`, očekivanje u
`features/plan/fiveKV2Import.test.tsx`, tri byteSame JSON-a. Nije pokretano: `check:full`, pun nivo drugih distanci, `v1`.

Sabotaže (`node scripts/sabotage.mjs ../docs/generators-v2/perfection/P5-5K/sabotage.json`, brz nivo, `--bail=1`):
**11/11 palo, 21,4 s**, stanje `src` isto posle (`P5-5K/sabotage-result.json`): F1 prag 12 ned, test u prvoj nedelji
vrhunca, početnik sa testom, validator bez provere nedelje testa; F2 prag RPE 10, neodrađen nije težak, bol ne nadjačava,
isti zapisi prave nov korak, konstruktor ne zadržava dozu, validator bez DOSE_HOLD, zadržavanje u taperu — svaku obara
`p5.node.test.ts`. Prva verzija testa nije oborila 2 (F1d, F2d) → test pojačan (zamena dana testa sa danom I; ponovna
adaptacija bez novih zapisa sa sledećom nedeljom izgradnje).

## Otvorena pitanja (odluka organizatora)

1. Nedelja testa: planirano < cilj u 1 204 / 2 688 planova (do −4 km, 5 d). Postojeće pravilo (T1 + uslov 3) to rešava
   prijavom; alternativa bi bila nova trenerska odluka (npr. test uz duže zagrevanje ili lagan dan duži od 0,8 × dugi u
   nedelji testa).
2. 16 nedelja testa > 25 % km bržih od E (4 d, 15–16 km, VDOT 65) — test 3 km od 12 km nedelje. Prihvatiti ili ne testirati
   ispod nekog obima?
3. Tumačenja T1–T4 (gore), naročito T3: test u planu sa rezultatom se ne premešta kad ga adaptacija blokira.
4. F2 „nije primenjeno" se beleži i u tokovima pauze (svi preskočeni kvaliteti u pauzi) — zato je u mreži 08e promenjeno
   10 597/16 804 tokova samo razlogom HARD_QUALITY applied false. Ako to nije željeno: beležiti samo kad nijedan drugi
   uslov ne objašnjava propuštene dane.
5. Nalaz P4: B1 ili B2 (gore), ili ostaviti.
6. Uvoz (Strava): trčanja na danima odmora (zapisi van plana) uz potpunu pokrivenost ostavljaju dane kvaliteta bez
   zapisa → po F2 „preskočeni" → sledeća nedelja zadržava dozu (test `fiveKV2Import` je ranije očekivao „plan se ne
   menja"; usklađen). Doslovno po pravilu; ako nije željeno: dan kvaliteta bez zapisa nije „preskočen" kad iste nedelje
   postoji zapis van plana.

## Mišljenje (odvojeno od merenja)

1. Test 4–5 nedelja pre trke, posle njega rasterećenje i oštrenje, je dobar trenerski raspored: tempo oštrenja dolazi iz
   sveže forme. Cena je jedna I sesija vrhunca.
2. F2 je konzervativan i retko okida sam (bez drugog uslova); najčešće ga nadjačava manjak izvršenja kad su treninzi
   preskočeni — to je ispravan red, jer manjak već seče obim.
3. Najveći preostali manjak 5K plana sa rezultatom posle P5: nedelja testa gubi km zbog T1 (pitanje 1).
