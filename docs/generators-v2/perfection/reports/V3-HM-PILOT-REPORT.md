# V3-HM pilot — generator polumaratona na trenerskim šablonima (11. 11. 2026)

Grana `claude/v3-pilot-hm` (od `claude/generator-isolation-5k-10k-hm-marathon` @ 0d4572b). Kod: `web/src/domain/generators/halfMarathon/v3/`,
ispis: `P9v3/plans/HM/p01…p12.txt` (`node ../docs/generators-v2/perfection/P9/render.ts $PWD ../docs/generators-v2/perfection/P9v3/plans HMv3`
iz `web/`; v2 ispis iste skripte je bajt-isti, provereno diff-om). v2 nije menjan; v3 nije povezan u aplikaciju.

## Arhitektura (10 redova)
1. `templates.ts` — PODACI: nedelje-namere (obim % vrha, dugi % najdužeg + uloga lagan/progresivan/blok/talas, Q1/Q2 = zona, % vrha doze, oblik).
2. Dve porodice: redovan (sa rezultatom i po osećaju; po osećaju dobija test 3 km + RPE) i početnik (jedan kvalitet, uvod 2 nedelje).
3. Kraj pripreme je vezan za rastojanje od trke: trka, taper, nedelja posle vrha, VRH (N−3), rasterećenje (N−4), specifična (N−6, N−5), kraj razvoja (N−7).
4. Rasterećenje svake 4. nedelje unazad od trke (N−4, N−8, …); N−8 = provera forme (pripremna trka 10 km / test 5 km) sa rečenicom šta rezultat znači.
5. Osnova i razvoj se uzimaju iz nizova (osnova od početka, razvoj od kraja; udeo osnove 60 %) → isti šablon za bilo koji broj nedelja; > 20: osnovna priprema, < 10: vrh N−2 + upozorenje W1-C.
6. `scale.ts` — JEDINO mesto brojeva: vrh obima (G1 faktor, start + 20, red dana, satni plafon, rast H6), najduži dugi (24 km, 150 min, udeo H15), plafon zone (G4 ∩ H11).
7. `build.ts` — motor: obim i dugi po lestvici (kotrljajuća granica pouke 28), doza = % vrha ∩ plafon nedelje, lagani dele ostatak (≤ 0,7–0,8 dugog), manjak se prijavljuje.
8. Nedelja posle vrha ≤ 85 % i taper ≤ 60 % minuta rada vrha se sprovode na jednom mestu (skaliranje doza te nedelje); trkačka nedelja po v2 H8/G5.
9. `guard.ts` — 9 provera, samo prijavljuje: plafon zone, satni plafon, rast, lagan ≤ dugi, prazan trening, minimum nedelje, dugi (plafon + korak), trka poslednja, tvrdi dani.
10. Izlaz: isti `HmV2Plan` kao v2, `policyId hm-v3`, `policyVersion hm-v3.0.0-pilot`; uvozi iz `../v2/` samo ulaz, tempa, datume, politiku i tipove.

## Obim koda (wc -l, bez testova)
| | redova |
|---|---|
| v3 ukupno | **1 470** (šabloni-podaci 329, motor 424, treninzi 189, skaliranje 117, čuvar 86, ulaz 84) |
| v2 generator (bez adaptacije, app/ i test pomoćnika) | 10 012 |
| v2 sve (sa adaptacijom i app/) | 15 105 |

## 12 profila: v2 (hm-v2.15.0) → v3
Plato = broj nedelja sa dugim ≥ 95 % najdužeg. Nedelja najvećeg rada = minuti rep/kontinuirano (bez pripremne trke). RP = km u RP ukupno (bez trke).

| profil | vrh obima km | najduži dugi km | plato dugog | ned. najvećeg rada | RP ukupno km | RP u dugom km |
|---|---|---|---|---|---|---|
| p01 | 56,0 → 54,4 | 22,4 → 21,5 | 5 → 3 | 14 (N−2) → 13 (N−3) | 43,4 → 59,4 | 4/4 → 4/6/8/4 |
| p02 | 53,5 → 52,0 | 21,4 → 20,5 | 4 → 3 | 12 (N−2) → 11 (N−3) | 38,6 → 65,1 | 4/4 → 4/6/8/4 |
| p03 | 34,9 → 34,0 | 15,7 → 15,0 | 3 → 3 | 13 (N−3) → 13 (N−3) | 21,8 → 40,8 | 4/4 → 4/5/6/4 |
| p04 | 63,1 → 63,2 | 20,0 → 20,0 | 6 → 5 | 18 (N−2) → 17 (N−3) | 36,6 → 54,3 | 4/6 → 4/6/8/4 |
| p05 | 100,0 → 100,0 | 24,0 → 24,0 | 11 → 8 | 14 (N−2) → 13 (N−3) | 56,2 → 75,2 | 6/8 → 4/6/9/4 |
| p06 | 44,2 → 39,2 | 14,1 → 12,5 | 2 → 2 | 8 (N−2) → 7 (N−3) | 30,0 → 43,4 | 4 → 4/4/5/4 |
| p07 | 71,5 → 61,6 | 22,8 → 19,5 | 3 → 2 | 8 (N−2) → 7 (N−3) | 35,4 → 60,9 | 4/6 → 4/6/7/4 |
| p08 | 54,3 → 55,0 | 24,0 → 24,0 | 5 → 4 | 16 (N−4) → 17 (N−3) | 27,0 → 61,9 | 4/6 → 4/6/8/4 |
| p09 | 63,0 → 61,2 | 24,0 → 24,0 | 6 → 3 | 14 (N−2) → 13 (N−3) | 43,2 → 57,7 | 4/6 → 4/6/8/4 |
| p10 | 34,9 → 35,0 | 15,7 → 15,5 | 4 → 3 | 16 (N−4) → 17 (N−3) | 21,8 → 41,0 | 4/4 → 4/5/6/4 |
| p11 | 29,2 → 38,0 | 13,6 → 17,5 | 6 → 2 | 14 (N−6) → 17 (N−3) | 20,4 → 21,2 | — → 3/4 |
| p12 | 59,0 → 58,5 | 18,6 → 17,5 | 5 → 2 | 13 (N−3) → 13 (N−3) | 26,4 → 21,0 | — → 3/4 |

Činjenice [visoka]: svih 12 planova bez nalaza čuvara; svi imaju vrh N−3, pripremnu trku/test u N−8 (po osećaju i test 3 km u ned 4),
plan trke (tempo po delovima, unos, zagrevanje). Ciljni p01 ima RP ≈ 57 km, v3 59,4 — povećanje RP prati ciljne planove, ne odstupa od njih.

## Testovi
`v3/shape.node.test.ts`: 368 ulaza (3–6 dana, 15–90 km, 6–24 nedelje, tri porodice) → 219 planova (ostali odbijeni proverom
ulaza v2, npr. obim van reda dana); 8 testova, < 1 s. Mere: plan postoji i čuvar bez nalaza; vrh rada N−3 (≤ 8 ned: N−2), N−2 ≤ 85 %,
taper ≤ 60 %, oštrenje 6–12 min; nijedna ne-rasteretna nedelja ista kao prethodna; ista doza iste zone ≤ 2 nedelje; dugi do najdužeg
na kraju lestvice, talas ≥ 12 % u specifičnoj, blok RP raste do vrha (≥ 3 bloka, vrh ≥ min(6, 40 % dugog)); provera forme u N−8 sa
rečenicom; početnik vrh ≤ start × 2, korak ≤ 1,5 km, dugi ≤ 2 h 05; upotrebljivost (bez praznog, lagan ≤ dugi, minimum nedelje).

## Najmanje izmene unutar v3 (umesto izmene v2)
- „Uloga dugog" nema polje u `HmV2Plan`: nosi je struktura segmenata (blok = kontinuirani RP segment, progresija = drugi tempo) i naslov.
- Nedelja-namera iz šablona se ne upisuje u plan (nema polja); za adaptaciju bi trebalo (dole).
- Minuti rada za „najtežu nedelju" ne računaju pripremnu trku (događaj u rasteretnoj nedelji, kao u ciljnim p11/p12).
- Dugi počinje od max(0,82 × najdužeg, 30 % sadašnjeg obima): trkač od 75–90 km već trči najduži, lestvica tada kreće sa vrha.

## Šta šabloni NE pokrivaju (još)
- Kratke pripreme (≤ 10 ned): lestvica obima se završava u N−7, pa je vrh niži od v2 (p07 71,5 → 61,6; p06 44,2 → 39,2). Svesno konzervativno, ali odluka vlasnika.
- 3 dana: lagan dan je dug (p08 15,7–19 km = 0,8 dugog); „mali podražaj usred nedelje" (GAP 6) nije u šablonu — kvalitet se smenjuje Q1/Q2.
- Hod-trk za spore (GAP 9) i dugi u minutama za lagan ≥ 7:00/km — samo rečenica za najduži dugi početnika.
- Specifična nedelja ponekad planirano < cilj (lagani ≤ 0,7 dugog); prijavljeno rečenicom, nije nadoknađeno.
- Dužine deonica su izračunate (npr. T 2 × 1400 m, 3 × 1300 m), ne iz lestvice „lepih" dužina kao u v2.
- Početnik p11: vrh 38 km (cilj 40) jer je korak ograničen na 1,5 km; p12 dugi 17,5 km (cilj 19) jer je ograničen na 2 h 05.

## Šta bi trebalo za adaptaciju
1. Plan upisuje po nedelji: `kk`, id namere iz šablona i „mesto na lestvici" (činjenice rasporeda), da se ostatak gradi iz upisanog plana.
2. Činjenice (urađeni km, rezultat, pauza, bol) → samo ulazi skaliranja (novi start obima, novi VDOT, granica dugog); šablon ostaje isti.
3. Događaji kao pravila nad nizom namera: bolest → nedelja povratka = namera rasterećenja bez kvaliteta; propušten ključni dugi → pomeranje
   namere ako je ≥ 3 nedelje do trke; provera forme ±3 % → nova tempa od sledeće nedelje. Završna zaštita: urađeno, datumi, zaključano.
4. Čuvar isti; plus provera „urađeni dani nepromenjeni".

## Procena (tumačenje, ne činjenica)
- Oblik iz GAP 1–5 se dobija direktno i meri se testom; u v2 je isti oblik tražio desetine pravila i nije stigao (vrh N−2, blok 4/4).
  Kod je ≈ 7 × manji od v2 generatora bez adaptacije. Po mom mišljenju ovo JE bolji put za početni plan [srednja pouzdanost].
- Ocena trenera za v3 planove nije rađena: **ne znam** da li je ≈ 80; pre odluke treba krug ocenjivanja nad `P9v3/plans/HM`.
- Rizik: v2 nosi stotine proverenih rubnih slučajeva (adaptacija, predaja, dužine, ručne izmene) koje pilot ne pokriva; pravo poređenje
  troška je tek kad v3 ima adaptaciju (procena: još ≈ 1 000–1 500 redova) [niska pouzdanost].
