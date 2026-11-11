# V3-HM — nov generator polumaratona, samo početni plan (11. 11. 2026)

Grana `claude/v3-hm`; kod `web/src/domain/generators/halfMarathon/v3/` (nula uvoza van foldera, ništa iz v2 nije čitano ni
kopirano). Ispis 12 profila: `P9v3/plans/HM/p01…p12.txt` (`node ../docs/generators-v2/perfection/P9v3/render.ts` iz `web/`).

## Arhitektura (10 redova)
1. `types.ts` — sopstveni ulaz `V3Input` i izlaz `PlanDoc` (plan → nedelje → dani → trening {vrsta, zona, segmenti, km, min, minuti rada, napomena}), policyId/policyVersion, faza svake nedelje.
2. `paces.ts` — VDOT po Danielsu (formula); E 62–70 %, T 88 %, I 97,5 %, R 105 % (pogađa tablice p01/p04 u sekundu), RP = prognoza HM; bez rezultata VDOT iz laganog tempa, tempa po naporu do testa.
3. `layout.ts` — jedini vlasnik uloga nedelja: kraj unazad od trke (trka, taper, ≤ 85 %, vrh N−3, rasterećenje, blok, talas, blok), rasterećenje svake 4. unazad, provera ≈ N−8, test za plan po osećaju; osnova/razvoj po udelu.
4. `templates.ts` — šabloni kao podaci: nizovi namera (R/brda, I lestvica, oblici T), uloge specifične faze (doza = udeo plafona zone, dugi = udeo najdužeg, blok = udeo plafona bloka), obim = udeo vrha; porodice redovan / početnik.
5. `scale.ts` — jedino mesto prilagođavanja: vrh obima (dužina pripreme, satni plafon, nosivost dana, dostižnost koraka), najduži dugi, plafoni zona u minutima, WU/CD, jedan kvalitet ispod 25 km; svaki rez daje rečenicu u zaglavlju.
6. `build.ts` — po jedan vlasnik: obim (lestvica + korak prema stvarno planiranom), dugi, kvalitet, raspodela laganih km (lagan ≥ 30 min, inače dan trajno otpada); 3 dana / jedan kvalitet = glavni kvalitet + mali podražaj na laganom danu.
7. `sessions.ts` — trening iz namere: minuti rada → deonice trenerskih dužina → km i minuti iz tempa.
8. `guard.ts` — 9 provera, samo prijavljuje. `text.ts` — čitljiv ispis. `index.ts` — javni API (`generate`, `renderText`).

Kod: **1 851 red** u krugu 1, **2 056** u krugu 2 (8 fajlova, posle prettier-a), bez testa. Test: `generators/halfMarathonV3.node.test.ts` (krug 2: van `halfMarathon/`, v. dole), 420 ulaza, ≈ 1 s.

## 12 profila (P9 ulazi) — krug 1
| profil | ned | vrh obima km | najduži dugi km (min) | najduži plato dugog (ned) | najveći rad (pre trke) | km RP ukupno / u dugom | čuvar |
|---|---|---|---|---|---|---|---|
| p01 | 16 | 56,0 | 22 (123) | 1 | 13 (3 pre) | 70,4 / 26,5 | 0 |
| p02 | 14 | 54,0 | 21,5 (111) | 1 | 11 (3 pre) | 74,3 / 27,5 | 0 |
| p03 | 16 | 35,0 | 15,5 (110) | 1 | 13 (3 pre) | 46,5 / 19,5 | 0 |
| p04 | 20 | 63,0 | 20 (135) | 2 | 17 (3 pre) | 51,6 / 22,0 | 0 |
| p05 | 16 | 100,1 | 26 (112) | 1 | 13 (3 pre) | 91,0 / 33,0 | 0 |
| p06 | 10 | 42,3 | 16 (69) | 1 | 7 (3 pre) | 62,8 / 22,0 | 0 |
| p07 | 10 | 64,2 | 22 (118) | 1 | 7 (3 pre) | 71,9 / 27,5 | 0 |
| p08 | 20 | 52,1 | 22 (121) | 2 | 17 (3 pre) | 71,9 / 27,5 | 0 |
| p09 | 16 | 59,4 | 22 (125) | 1 | 13 (3 pre) | 69,2 / 26,5 | 0 |
| p10 | 20 | 35,0 | 15,5 (111) | 1 | 17 (3 pre) | 46,5 / 19,5 | 0 |
| p11 | 20 | 39,2 | 18 (123) | 1 | 17 (3 pre) | 25,0 / 10,0 | 0 |
| p12 | 16 | 55,7 | 18,5 (123) | 2 | 13 (3 pre) | 32,4 / 12,0 | 0 |

## Odstupanja od ciljnih planova
- **p01** — obim 40 → 56 i dugi 15 → 22 kao cilj; pripremna trka ned 8 sa pravilom, najteža ned 13, ≤ 85 % i taper isti. Razlike: blok RP 5 → 7 → 9,5 → 5 km (cilj 6 → 10 → 4) i prvi blok u ned 9, ne 10 — šablon ima jedan raspored (blokovi N−7/N−5/N−3, talas N−6, kao cilj p04), a dva ciljna plana se tu međusobno razlikuju; T do 35 min (cilj 33); prag pripremne trke 45:05 (cilj 45:30) jer ga računam iz VDOT-a cilja.
- **p04** — talas, blokovi 4 → 6 → 8 km, dve osnove sa različitim sadržajem i vrh u ned 17 isti. Razlike: ned 1–3 imaju 49–52 km (cilj 54–56) — dan pred dugi ≤ 50 % dugog, a dugi je vođen vremenom; najduži dugi 20 km (cilj 21) zbog plafona 2 h 15 iz ROUND-01; provera u ned 12, ne 8 (pravilo N−8); RP usred nedelje 23–35 min (cilj 24–35); I 3–5 deonica (cilj do 4 × 1000).
- **p11** — T u minutima 10 → 20, RP 2 × 2 km i 4 km u komadu, vrh u ned 17, taper i trkačka nedelja kao cilj. Razlike: vrh 39 km (cilj 40, korak +1,5 km/6 %); najduži dugi 18 km za 2 h 03 sa 4 km RP (cilj 17,5 km lagano uz hod, 2 h 05).
- **p12** — test u ned 4, pripremna trka u ned 8, blok 3 → 5 km, vrh u ned 13 kao cilj. Razlike: vrh 55,7 km (cilj 59) zbog satnog plafona za početnika od 6,5 h iz ROUND-01, koji cilj prelazi; dugi 18,5 km (cilj 19) zbog plafona 2 h 05; test 2 km, ne 3 km (pravilo „test ≤ 2 × najveća dotadašnja doza", a pre testa su bili samo usponi).
- **Ostalih 8** (bez ciljnog plana, isti principi): p05 (6 dana, 90 km) vrh 100 km, blok do 12 km; p06 (VDOT 58, 35 km, 10 ned) jedan lagan dan otpada u 9 nedelja, uz preporuku „povratak posle pauze / 4 dana"; p03/p10 (spori, 3 dana) imaju dugi vođen vremenom, hod-trk i blok 4 → 6 → 7 km; p08 (3 dana) ima lagan dan 0,75 dugog i T/I naizmenično; p09/p10 (po osećaju) imaju test u ned 4 i tempa iz testa, pa iz pripremne trke.

## Pretpostavke (broj nije u trenerovim dokumentima, izabran konzervativno)
- Vrh obima: množilac 1,1 (6 ned) → 1,3 (12) → 1,4 (16+), linearno između; početnik 1 + (N−4)/16 (do 2,0 za 20 ned). Apsolutni plafon 100 km.
- Napredak VDOT-a za ocenu cilja ≤ 0,1 po nedelji, najviše 2.
- Plafon T: 30 / 35 / 40 min (vrh < 45 / < 80 / ≥ 80 km) — ciljevi idu do 35, ROUND-01 kaže 30. RP usred nedelje 35 → 44 min po VDOT-u 35 → 45; početnik 25 → 35 po obimu.
- Brz rad po treningu kao udeo vrha obima: T ≤ 13 %, I ≤ 10 %, RP ≤ 20 %, blok u dugom ≤ 20 % (štiti mali obim sa brzim rezultatom, p06).
- Udeo dugog: 3 dana 45 %, 4 dana 40 %, 5–6 dana 35 %, brz i ≥ 70 km 30 %, početnik 45 % (ROUND-01 ima 35 %; ciljevi p01/p11 traže više).
- WU/CD 20/15 min (≥ 40 km), 15/10 (25–40), 10/10 (početnik i < 25). Pripremna trka 10 km kad nedelja nosi ≥ 25 km, inače 5 km.
- Taper 65 % vrha (ROUND-01 55–65, ciljevi 68). Korak dugog ≤ min(2 km, max(1, 12 %)); T raste najviše 25 % nedeljno.

## Šta šabloni ne pokrivaju
- Adaptaciju, uvoz plana, vezu sa aplikacijom (namerno van obima); 7 dana i 1–2 dana (odbija se kao neispravno).
- Početak usred nedelje: dani pre starta se samo izostave, nedelja 1 nije preračunata.
- Raspored dana je jedan algoritam (najveći razmak kvaliteta od dugog i međusobno); ne zna za posao ni teren.
- Ciljno vreme menja samo tempo na dan trke i pravilo provere, ne i doze treninga.
- Zaokruživanje deonica (trenerske dužine) daje doze ±1,5 min od namere; plafon se ne prelazi.

## Iskrena procena
- Oblik iz GAP § 2–3 meri test na 420 ulaza, i plan ga ima: vrh N−3, ≤ 85 %, taper ≤ 60 %, trkačka nedelja 6–12 min, talas i
  blok 4 → 6 → max, provera sa pravilom, test kod plana po osećaju, ista doza najviše 2 nedelje, čuvar bez nalaza.
- p01 i p04 su po strukturi vrlo blizu ciljnih planova; p11 i p12 su blizu, uz dve razlike koje dolaze iz ROUND-01 plafona
  (satni plafon i 2 h 05). Ocenu treba da da trener, ja je nisam računao.
- Slabije tačke: mali obim sa 5–6 dana (dani otpadaju, plan je ispravan ali krut), a planirani obim ostaje ispod cilja u
  nedeljama gde ga ograničava pravilo „dan pred dugi ≤ 50 %" (p04 ned 1–3, talas-nedelje). Doze u plafonima su delimično
  pretpostavke, gore navedene.

## Krug 2 (po ROUND-V3-HM-01 § e; isti dan)
Šta je promenjeno (sve u `v3/`, po jedan vlasnik):
1. **Nedeljni budžet brzog rada** (`build.ts`, jedino mesto doze nedelje): T + I + R + RP + blok ≤ 20,5 % procenjenog
   vremena nedelje (vrh 23,5 %), procena iz obima koji dani stvarno nose; u nedelji sa blokom RP usred nedelje = 60 %
   doze šablona; vrh ostaje najteži (ostale ≤ 85 % procene vrha), posle vrha ≤ 80 % / taper ≤ 56 % stvarnog rada vrha.
   Doza ispod 8 min postaje lagan dan sa ubrzanjima. Čuvar: nova provera `fast-share` (22 %, vrh 25 %).
2. **3 dana, nedelja sa blokom**: prvi dan lagan (≤ 60 % dugog), kvalitet bliže dugom sa ≤ 60 % doze, blok ≤ 35 % dugog.
3. **Posle pripremne trke**: kvalitet najranije 4 dana kasnije (pomera se na drugi dan ili postaje lagan); kad trka
   zamenjuje dugi, sledeći dugi je bez bloka (ako je sledeća nedelja vrh, trka ide na dan drugog kvaliteta).
4. **Kratka priprema** (10–11 ned): bez prvog bloka i talasa (RP ne pre polovine), budžet 18,5 % van dve ključne
   nedelje; nedelja pripremne trke ima cilj 72 % prethodne.
5. **Nedelja 1 ≥ 95 %** sadašnjeg obima: lagani nose razliku do 80 % dugog (3 dana 90 %), samo u nedelji 1.
6. **Pripremna trka 10 km** samo kad je prosečna nedelja ≥ 35 km i 10 km ≤ 60 min; inače 5 km.
7. **Početnik**: T lestvica linearno do plafona 25 (20 km) → 28 min (45 km), bez ciklusa; početak 10–14 min.
8. **Bez I intervala** za plan po osećaju i 3 dana < 35 km: brda 8–10 × 45 s.
9. **Lagan dan ≥ 35 % dugog** kod 4 dana; početnik: ujednačeni lagani dani.
10. Nalazi čuvara se ne ispisuju korisniku (samo ako postoje, kao „PROVERE PLANA"); u najtežoj nedelji, kad je cilj brži
    od prognoze, poslednja 3 km bloka u ciljnom tempu. Labela tempa posle provere navodi stvarnu dužinu trke (5/10 km).

| profil | najteža ned. brz rad | najviše u nedelji | ned > 22 %* | ned > 20 % | ned 1 / sada km | blok RP u dugom (km) | vrh km |
|---|---|---|---|---|---|---|---|
| p01 | 21 % (65 min) | 21 % | 0 | 1 | 40 / 40 | 5 → 6,5 → 8 → 5 | 56,0 |
| p02 | 22 % (62 min) | 22 % | 0 | 2 | 40 / 40 | 5 → 6,5 → 8 → 5 | 54,0 |
| p03 | 23 % (53 min) | 23 % | 1 | 1 | 24 / 25 | 4 → 5 → 3 | 33,3 |
| p04 | 16 % (68 min) | 16 % | 0 | 0 | 52,7 / 55 | 4 → 5 → 8 → 4 | 62,9 |
| p05 | 16 % (70 min) | 16 % | 0 | 0 | 85,9 / 90 | 6 → 8,5 → 12 → 6 | 99,9 |
| p06 | 23 % (45 min) | 23 % | 1 | 2 | 33,8 / 35 | 5,5 → 6,5 → 4,5 | 43,2 |
| p07 | 19 % (73 min) | 19 % | 0 | 0 | 54,9 / 55 | 7 → 10 → 5 | 67,9 |
| p08 | 23 % (61 min) | 23 % | 1 | 2 | 43,2 / 45 | 6,5 → 7,5 → 5 | 48,8 |
| p09 | 20 % (68 min) | 20 % | 0 | 1 | 43,2 / 45 | 5 → 6,5 → 8,5 → 5 | 59,0 |
| p10 | 23 % (51 min) | 23 % | 1 | 1 | 24 / 25 | 4 → 5 → 3 | 33,9 |
| p11 | 14 % (38 min) | 14 % | 0 | 0 | 20,6 / 20 | 3 → 4 → 2,5 | 38,7 |
| p12 | 14 % (49 min) | 14 % | 0 | 0 | 43,7 / 45 | 3,5 → 5 → 3,5 | 52,8 |
\* jedina nedelja > 22 % je uvek najteža (≤ 25 %); čuvar 0 nalaza na 12 profila i 420 ulaza. Cena: blok u najtežoj nedelji je manji nego u krugu 1 (p01 9,5 → 8 km, p02 10 → 8); kod 3 dana sa malim obimom
(p03, p10) blok pada posle vrha (5 → 3 km). p12 vrh 52,8 km (krug 1: 55,7), jer lagani dani početnika su ujednačeni.
Test (16 provera) dobio: plafon 22/25 % i ≤ 2 nedelje > 20 % u kratkoj pripremi, pravilo 3 dana, 4 dana posle trke.
Postojeći test `scripts/ciScope.node.test.ts` („HM v2: svi testovi foldera…") pada kad je u `halfMarathon/` test koji
ne zavisi od v2 (traži da svaki test tog foldera bude izabran pri izmeni v2); stari test nije menjan — v3 test je
premešten u `generators/halfMarathonV3.node.test.ts`, kod generatora ostaje u `halfMarathon/v3/`.

## Krug 3 (po ROUND-V3-HM-02 § d–e)
1. Nedelja sa blokom (4+ dana): RP usred nedelje se puni do 19 % vremena nedelje (najteža 20 %), ne fiksno 60 %;
   plafon 22/25 % ostaje. 3 dana zadržava 60 % doze (pravilo iz kruga 2). Beginner blok do 6 km (45 km/ned).
2. Kratki usponi (≤ 20 s) idu usred laganog dana pune dužine, ne kao trening od 3,8 km; početnik: ujednačeni lagani
   dani, ali kad bi to oborilo obim > 3 %, važe obični plafoni (p12 vrh 55,3 km, bez pada u ned 3).
3. 3 dana: dugi nosi razliku u ned 1 (do 45 % nedelje, najviše +2 km iznad skorašnjeg najdužeg, ≤ 0,85 najdužeg),
   lagan ≤ 75 % dugog u ned 1 i ≤ 70 % u svim ostalim nedeljama.
4. I intervali ostaju za plan po osećaju sa 4+ dana i ≥ 40 km (p09 ned 6–7: I 4 × 1000 m posle testa).
5. Zaglavlje: rečenice iz § e uslovljene ulazom (brz rezultat uz < 40 km; 3 dana; 3 dana i lagan ≥ 7:00/km sa stvarnim
   najdužim dugim i prognozom; priprema ≤ 11 nedelja). Kad najveći obim i najteži treninzi nisu ista nedelja, plan kaže obe.

| profil | RP usred ned. vrha (min) | najteža ned. brz rad | ned > 22 %* | blok u dugom (km) | vrh km | ned 1 / sada |
|---|---|---|---|---|---|---|
| p01 | 26 | 19 % (62 min) | 0 | 5 → 6 → 7,5 → 5 | 56,0 | 40 / 40 |
| p02 | 27 | 20 % (58) | 0 | 5 → 6 → 7 → 5 | 54,0 | 40 / 40 |
| p03 | 22 | 23 % (53) | 1 | 4 → 5 → 3 | 33,3 | 24,9 / 25 |
| p04 | 35 | 19 % (82) | 0 | 4 → 6 → 8 → 4 | 63,0 | 52,7 / 55 |
| p05 | 44 | 20 % (89) | 0 | 6 → 9 → 12 → 6 | 100,1 | 85,9 / 90 |
| p06 | 17 | 19 % (38) | 0 | 5 → 5,5 → 4 | 43,3 | 33,8 / 35 |
| p07 | 30 | 19 % (73) | 0 | 7,5 → 9 → 5 | 67,9 | 54,9 / 55 |
| p08 | 26 | 23 % (61) | 1 | 6,5 → 7,5 → 5 | 47,8 | 41,9 / 45 |
| p09 | 26 | 19 % (66) | 0 | 5 → 6,5 → 8 → 5 | 59,0 | 43,2 / 45 |
| p10 | 20 | 23 % (51) | 1 | 4 → 5 → 3 | 33,3 | 24,8 / 25 |
| p11 | 24 | 17 % (47) | 0 | 3 → 4 → 3 | 39,2 | 20,6 / 20 |
| p12 | 35 | 19 % (69) | 0 | 4 → 6 → 4 | 55,3 | 45,2 / 45 |
\* jedina nedelja > 22 % je najteža (≤ 25 %), samo kod 3 dana. Čuvar 0 nalaza (12 profila, 420 ulaza); test 18 provera.

Odstupanja: p01 najteža nedelja 21 → 19 % (blok 8 → 7,5 km), jer je i za nju punjenje do 20 %. p08 ned 1 je 93 %
(dugi ne sme > +2 km i 0,85 najdužeg) — trenerova granica 90 % važi; u mreži 3 dana ponegde 80–90 %, test to dozvoljava.
Potvrđeno ostaje: udeo brzog ≤ 22/25 %, lagan utorak posle pripremne trke, 5 km za male obime, T lestvica početnika.
