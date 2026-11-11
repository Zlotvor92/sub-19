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

Kod: **1 851 red** (8 fajlova, posle prettier-a), bez testa. Test: `v3.node.test.ts`, 420 ulaza, 13 provera, ≈ 1 s.

## 12 profila (P9 ulazi)
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
