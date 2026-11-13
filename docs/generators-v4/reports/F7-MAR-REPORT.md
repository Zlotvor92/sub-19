# F7 — maraton kao podatak za V4 (13. 11. 2026, po Beogradu)

Grana `claude/v4`. Folder `web/src/domain/v4/distances/marathon/` (id `marathon`, kao u adapterima): šabloni
1–52 ned × 7 dana × 4 porodice (jezgro 8–30), biblioteka (33 unosa), `safety`, tekstovi, 19 profila (12 iz P9 MAR +
7 iz briefa), 29 scenarija (24 + 3 E7 + 2 maratonska), parovi, kapija. Nula uvoza iz `hm/` i `tenk/` (test), nula
izmena u `engine/` i `fitness/`; skripte `plans/dist.ts` i `plans/target.ts` dobile `--dist marathon` (ispisi HM i
10K bajt-isti posle izmene). **Testovi maratona: 99 prolaze, 6 očekivano pada (`it.fails`), 0 pada; ceo V4 skup
830 prolazi, 20 očekivano pada, 0 pada (70 s); typecheck, lint i prettier čisti. Kapija maratona: 0 prekršaja,
19/19.**

Napomena: `briefs/F7-COMMON.md` ne postoji na grani (ni u istoriji) — radio sam po `F7-MAR.md`, obrascu izveštaja
F7-10K i LOG-u (stavka 13. 11. 06:52 za 10K).

## Odluke i brojevi
| odluka | broj | izvor / pouzd. |
|---|---|---|
| lestvica vrha u km (kapija): ≤ 25 km × 2,1 (≥ 24 ned) / 1,8 / 1,55 / 1,35; 25–40 km × 1,6 (≥ 18) / 1,45 / 1,25; 40–60 km × 1,4 (≥ 16) / 1,3 / 1,15; > 60 km × 1,3 / 1,25 / 1,12; tegoba ili staž < 8 ned ≤ × 1,4 | p07 × 1,22, p11 × 1,95, p05 × 1,2 | README (× 1,30 / 1,40, početnik × 2,1) — srednja |
| bodovi lestvice ≈ 1,05 × km (MP nosi malo bodova iznad minuta) | 2,08 / 1,9 / 1,62 … 1,36 / 1,32 / 1,18 | izmereno na 19 profila — srednja |
| najduži dugi po VREMENU (`longMaxSec`): brz 2 h 45, srednji i povratnik 3 h, mali 3 h 05, spor i početnik 3 h 10, nov početnik 3 h 15 | p05 35 km / 2 h 29, p12 27,8 km / 3 h 05 | README tabela, brief (3 h – 3 h 15, ≤ 35 km) — visoka |
| udeo dugog (motor, km laganog tempa): 3 dana 50 %, 4–5 dana 42 %, 6 dana 38 %; ispod 75 km 43 %, u 3 nedelje najdužeg 47 %; početnik 4 dana 47 % | stvarno (kapija): 3 dana ≤ 52 %, 4 ≤ 45 %, 5+ ≤ 44 % (+5 u 3 ned) | README 33–50 %, ciljni p11 52 %, p12 41 % — srednja |
| talas dugog od početka 100 / 88 / 100 / 82 % (≥ 16 nedelja, 4+ dana); nedelja prati dugi (− 30 % pada dugog); 1–3 dana i početnik bez talasa u telu | p08 bez `ispod-cilja` | README; izbor za 3 dana — srednja |
| rep 9 nedelja: N−8 rasterećenje + 10 km subotom, N−7 blok ≈ 8 km MP, N−6 talas + MP 2 × 4–5 km usred nedelje, N−5 blok ≈ 12 km, N−4 rasterećenje, N−3 najteža (najduži dugi + blok ≈ 14 km), N−2 ≈ 78 % (dugi 20–22 sa 3 km MP + MP 2 × 3 km), N−1 ≈ 60 % (dugi 12–14, MP 4 km), N ≈ 30 % (oštrenje MP 2 × 5 min) | p07 blokovi 9 → 13 → 14 km (ciljni 8 → 12 → 14) | ciljni p07, p08 — visoka |
| u nedelji sa blokom nema MP usred nedelje (kapija i test) | — | README — visoka |
| brz rad (prag, I, R, MP i blok): ≤ 18 %, vršna ≤ 20 %; vršna ≥ 10 % (početnik/tegoba ≥ 7 %) | ostvareno 13–20 % u vršnoj | brief 15–18 / 20; ciljni 11–21 %. Obrazloženje: maratonska nedelja je duža, a blok od 60–70 min već nosi najveći deo rada; MP je uključen jer je 70 min MP u dugom najveći pojedinačni napor nedelje — srednja |
| doze: prag ≤ 35 min, intervali ≤ 21 min (samo razvoj, VDOT ≥ 40 i ≥ 4 dana, inače 3 min po osećaju), MP usred nedelje ≤ 50 min (brz 55, početnik 45), blok ≤ 70 min (brz 75, spor/početnik 55), oštrenje ≤ 10 min | — | README — visoka |
| sužavanje 3 nedelje: N−2 ≤ 82 % (kapija 85 %), N−1 ≤ 68 %, nedelja trke ≤ 40–45 %; brz rad nedelja „taper" ≤ 68 % vršne | ostvareno 61–81 / 45–65 / 22–42 % | README 78–80 / 58–62 / 25–30 %; brief ≈ 80 / 60 / 40 — srednja |
| najduži dugi najkasnije N−3; najduži (≥ 95 %) nikad dve nedelje zaredom, najviše 4 puta | 19/19 | brief, README — visoka |
| provera: trka 10 km subotom u N−8 (plan ≥ 12 ned), ranija u N−16 (≥ 20 ned); plan < 12 nedelja nema proveru u prve 3 nedelje | — | README „ned 4–8"; vidi otvoreno t. 3 |
| korak dugog + 1,5 km ili + 8 min (dan se zaokružuje na 0,5 km → ≤ 2 km, K7) | p07 21 → 28 km | README + 1–2 km |
| start trke: `raceStartPaceOffsetSec` 5–10 s/km sporije, prvih 5–10 km | p07 5:07–5:12 uz MP 5:02 | README |
| adekvatno: 16 ned, vrh 60 km, 4 dana, dugi 28 km (provera 27 km ili 2 h 50), staž 26 ned, kraća distanca `hm` | upozorenja p13, p19 predlažu 16 nedelja ili polumaraton | brief, README p11 — srednja |
| tekstovi: unos na 35–40 min uz vodu u svakom dugom ≥ 90 min, obuća u dugom ≥ 2 h 30, raspodela tempa, zid, ishrana na trci i 2–3 dana pred trku | — | README, brief |

## Po profilu
(vršna = nedelja „najteža" = N−3; dugih ≥ 28 km = broj nedelja; N−2 / N−1 / N = km nedelje kao % vrha, nedelja trke
bez trke; ceo ispis u `plans/MAR/pregled.md`)

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

`target-compare.md`: 17 od 78 nedelja u svim tolerancijama (km ± 8 %, dugi ± 1,5 km, blok ± 1,5 km, vrsta, doza
± 20 %). Najveća odstupanja: p07 najduži dugi 28 km prema 32 (korak dugog i udeo), p11 vrh 49 prema 52 i dugi
22 prema 27 (udeo dugog početnika), p12 nedelja 14 (rasterećenje N−4 u šablonu, kod trenera talas posle polumaratona),
pripremni polumaraton trenera (p08, p11, p12) koga šablon nema (motor t. 4).

Scenariji (`plans/MAR/scenarios/`): s28 (propušten najduži dugi u N−3, p07) — jedna promena: plan kaže da se dugi ne
nadoknađuje jer su poslednje dve nedelje za odmor, sužavanje ostaje; s29 (bolest 7 dana u N−3, p08) — 8 promena:
N−2 i N−1 postaju povratak (dugi 14 → 8 km, kvalitet lagan), trka ostaje. Parovi: P1 B (povratnik) vrh niži od
P1 A, P2 B (nov početnik + tegoba) vrh 32,5 km i dugi 14,4 km prema P2 A 51 / 22,7, P3 A povratnik.

## Zahtevi za motor (nisam menjao; zaobiđeno podatkom ili imenovano u testu)
1. **Množilac opterećenja za dugi > 2 h 30 (trener).** `engine/load.ts` (cena koraka) broji svaki minut dugog isto:
   p12 n15 dugi 3 h 05 (27,8 km, 9 km MP) = 215 BO = 46 % nedelje (471 BO), kao 3,6 laganih dana od 60 min; p07 n9
   dugi 2 h 34 = 185 BO. Minut 170. dugog nosi znatno veći zamor (glikogen, mišićno oštećenje) od minuta 10.
   Predlog: podatak distance `safety.longFatigue: { fromSec: 9000, factor: 1,5 }` — minuti dugog posle 2 h 30 se
   množe faktorom u ceni (pravilo rasta, udeo dugog, model forme/umora); p12 dugi bi bio ≈ 238 BO. Do tada granicu
   drže podaci: `longMaxSec` po nivou (2 h 45 – 3 h 15), udeo dugog i 3 najduža dugog u repu sa razmakom 2 nedelje.
2. `longReaches` (čuvar i upozorenje `dugi-za-distancu`) meri dugi u km laganog tempa, bez viška km bloka u MP:
   p09 dugi 27,5 km (sa 13,5 km MP) dobija „najduži trening je 27,5 km — treba bar 27 km" (rečenica protivreči
   sama sebi). Zaobiđeno: `longCheckKm` 27 i `minLongSec` 2 h 50. Predlog: meriti stvarne km dugog.
3. Upozorenja se ne spajaju: p13 ima 4 (kratka priprema, obim, dani, dugi) — K3 u testu pušten na ≤ 4.
4. Pripremna trka na dan dugog (polumaraton 6–9 nedelja pred maraton, ciljni p08/p11/p12) ne može: provera je
   mesto kvaliteta (subota), a dugi je zaseban. Predlog: `long.stimulus` sa `all-out` unosom (trka umesto dugog) i
   cela nedelja posle bez kvaliteta.
5. Srednje-dugi (jedan lagan dan 55–65 % dugog pri ≥ 60 km) — motor deli lagane dane ravnomerno. Predlog: oznaka u
   nameri nedelje (`easyLong`) koju motor daje jednom laganom danu.
6. `dosePct` množi osnovicu (udeo × vrh), koja kod velikog obima prelazi plafon — isto kao F7-10K t. 2 (p05 MP
   3 × 4,5 km se zaokruži preko plafona; zaobiđeno plafonom brz 55 min).
7. Čuvar `taper` meri SVAKU nedelju vrste `taper` prema `weekBeforeMaxOfPeak`, a motor taj udeo primenjuje samo na
   dane 8–14 pred trku. Maraton ima N−2 vrste „taper" (da dugi ne bude vezan za polazni — p05 bi imao 32 km dve
   nedelje pred trku), pa je `weekBeforeMaxOfPeak` 0,68 (ciljni p07 N−2 51 %). Predlog: poseban broj za N−2.
8. Ponovno planiranje (KNOWN u testovima, sa ključem): povratak posle 7 dana bolesti u specifičnoj fazi ne vraća
   prvobitan obim posle 2 × trajanje + 7 dana i nema rečenicu „srazmerno niži" (s5, s6, s7; A10 b, `it.fails`);
   nadovezani prozori — rep izmena duži od 4 nedelje (s25, s26; Z10); s07 izlaz iz prozora + 29 % (R2); posle
   događaja nalazi čuvara (s2/s14 `ispod-cilja` kod 3 dana, s12 `taper`, s25 `brz-udeo`). Isti uzrok kao HM/10K.
9. Forma „ništa" 2–30 s sporije kod p06, p07, p09, p18, p19 (`FORM_DRIFT`, isti uzrok kao HM/10K R12).
10. Starost (`birthYear`) motor ne čita — „stariji trkač" (p16) je personalizovan samo kroz tegobu (lestvica
    ≤ × 1,4). Predlog: uslov nivoa ili lestvice po godinama (npr. 55+ → rast 5 %, rasterećenje svake 3. nedelje).
11. Mali obim po danu: motor izostavlja dan koji ne staje u najkraće lagano, pa kad se dan vrati nedelja skoči
    (mreža, početnik 25 km) — opravdano u testu mreže.

## Šta nije uspelo / otvoreno
1. Najduži dugi kod 4–5 dana sa 45–60 km vrha je 23–25 km (README tabela traži 26–30 km). Udeo dugog bi tada morao
   da bude ≈ 50 % nedelje, što README za 4 dana dozvoljava samo do 45 % u 3 nedelje; kapija traži ≥ 23 km. Plan to
   kaže upozorenjem `dugi-za-distancu` sa predlogom obima. Isto p07: 28 km prema ciljnih 32.
2. 3 dana (p08): nema talasa dugog u telu (bez njega `ispod-cilja`); dugi raste 22 → 30 km stepenasto.
3. Provera je u N−8 (README „ned 4–8"); brief kaže 4–6 nedelja pred maraton — nisam pomerio, jer bi provera u N−4
   (rasterećenje) bila 8 dana pred najteži dugi; pitanje za trenera.
4. Ocena trenera i drugog sudije za maraton nisu urađene.
5. Testovi: dva maratonska izuzetka u opravdanim nalazima mreže (5–6 dana: nedelja trke na najkraćim laganim danima;
   plan ≤ 6 nedelja i `taper`) i K7 bez lestvice uz `lagan-kratak` (p06).
