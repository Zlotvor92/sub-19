# Glavni trener — V4 10 km, krug 2 (13. 11. 2026)

Isti sudija i merilo kao `ROUND-V4-HM-09.md` (kalibracija tamo: moje merilo je ~1 poen strože od prethodnog
trenera). Ocenjeno sa `origin/claude/v4` @ 12651ae (ispisi 5989be4, posle kruga 2 za 10 km i kruga 9b motora).
Kod nije čitan, testovi nisu pokretani, `judge2/` i `target-compare.md` nisu čitani. Brojevi po nedelji izračunati
iz dana; zbirovi se slažu (K5 bez nalaza).

- **Planovi p01–p12:** čitani dan po dan.
- **Scenariji dan po dan:** s01 (E1), s02, s03, s04, s06 (E2), s07, s08, s09 (E3), s13 (E4), s14, s15, s17 (E5),
  s24 (E6), s25, s26 (E7), s27; spisak izmena za s11, s12, s16. **Iz pregleda + brojeva po nedelji:** s05, s10,
  s18–s23.
- **Parovi:** P1 B, P2 B, P3 A, P3 B prve 3 nedelje dan po dan + brojevi iz pregleda za svih 6.

**Zbirno: Plan 76,9 (sa proverama 76,6) · Prilagođavanje 79,1 · Personalizacija 83,0 → zbirna 78,8**
(krug 1: 74,8 · 80,7 · 82,0 → 78,0).

## A. Plan

| profil | ulaz | k1 | **k2** | vrh km (×) | dugi max | brz max | −2 / −1 / trka | glavno |
|---|---|---|---|---|---|---|---|---|
| p01 | 46:00, 40 km, 4 d, 16 n | 76 | **81,5** | 54,0 (1,32) | 16,5 km | 24 % | 79 / 67 / 32 | specifična faza puna: RP 5 × 1 → 4 × 1,6 → 7 × 1 km uz I |
| p02 | 5 km 20:25, 30 km, 4 d, 8 n | 70 | **70,5** | 33,7 (1,12) | 11,5 km | 21 % | 76 / 74 / 45 | doze male (RP 2 × 1,2, I 3 × 800); predlog „do 65 km" |
| p03 | spor, 20 km, 3 d, 12 n | 77,5 | **78** | 29,1 (1,43) | 91 min | 21 % | 82 / 65 / 34 | tempo trke od ned 7, raste |
| p04 | spor, 50 km, 5 d, 18 n | 75 | **79** | 61,1 (1,22) | 1 h 50 | 17 % | 82 / 64 / 36 | specifična faza puna; ned 5–11 54–57 km ravno |
| p05 | brz, 80 km, 6 d, 12 n | 81,5 | **81** | 106,2 (1,33) | 21,6 km | 15 % | 82 / 63 / 34 | ned 4 „rasterećenje" 82 km (−10 %) sa pragom |
| p06 | brz, 30 km, 5 d, 8 n | 57 | **66** | 36,3 (1,17) | 11 km | 16 % | 86 / 78 / 61 | kvalitet sada svake nedelje; dugi 6,5 km (32 min) u ned 6–7; upozorenje protivreči planu |
| p07 | VDOT 45, 50 km, 5 d, 8 n | 80 | **80** | 61,0 (1,20) | 97 min | 20 % | 83 / 68 / 37 | ned 5 tri teška (I 5 × 1, RP 8 × 1, dugi sa RP) |
| p08 | VDOT 45, 40 km, 3 d, 18 n | 74,5 | **74** | 45,0 (1,10) | 98 min | 20 % | 82 / 63 / 33 | kreće sa 38,9 < 41 km; 39–43 km 15 nedelja |
| p09 | po osećaju, 40 km, 4 d, 12 n | 79,5 | **81** | 52,4 (1,30) | 94 min | 22 % | 84 / 69 / 33 | — |
| p10 | po osećaju, spor, 20 km, 3 d, 18 n | 75 | **76,5** | 33,6 (1,62) | 1 h 50 | 20 % | 80 / 61 / 30 | RP 3 × 1 km dva puta (ned 11, 13) |
| p11 | početnik, 15 km, 3 d, 18 n | 79,5 | **79** (76) | 25,9 (1,75) | 85 min | 20 % | 77 / 68 / 36 | prognoza −3 % (54:21, ispravljeno); ned 7 +12,8 %; faze skaču oko provere |
| p12 | početnik po osećaju, 35 km, 4 d, 12 n | 71,5 | **76** | 42,0 (1,19) | 90 min | 16 % | 81 / 70 / 34 | nema više 5 istih nedelja; 35–38 km pet nedelja |
| **prosek** | | **74,8** | **76,9** | | | | | |

Na ≥ 80: **4 od 12** (p01, p05, p07, p09); krug 1: 2. **K-provere:** K6 bez nalaza (najviše 24 %); K7 p11 ned 7
(19,5 → 22 km, +12,8 % posle nedelje koja nije rasterećenje) → 76 sa proverama; K2, K5, K8 bez nalaza.

**Popravljeno:** šuplja specifična faza (krug 1, tačka 1) — p01, p04, p08, p10 imaju posle provere rad u tempu trke
koji raste (p01 RP 5 × 1 → 4 × 1,6 → 7 × 1 km + I); sužavanje osmonedeljnih planova je jedna nedelja + trka
(p02, p06, p07); p06 više nema nedelja bez kvaliteta; p12 nema identične nedelje; prognoza početnika ≤ 3 %.
**Ostaje:** p06 je i dalje slab (dugi 32 min uz lagane 24 min, upozorenje „u 4 od 5 nedelja zamenjen laganim" a plan
ima kvalitet svake nedelje); p08 ravan i počinje ispod sadašnjeg obima; p02 male doze.

## B. Prilagođavanje

| događaj | k1 | **k2** | scenariji |
|---|---|---|---|
| E1 rezultat | 81,0 | **82,8** | s01 85 · s02 79 · s03 85 · s04 82 |
| E2 bolest | 79,0 | **71,9** | s05 83 · s06 **69,5** · s07 **64** · s08 71 |
| E3 propušteno | 79,5 | **81,8** | s09 80 · s10 84 · s11 82 · s12 81 |
| E4 bol | 78,5 | **75,9** | s13 76,5 · s14 80 · s15 70 · s16 77 |
| E5 juče trka | 84,3 | **82,5** | s17 80 · s18 84 · s19 84 · s20 82 |
| E6 ništa | 89,5 | **89,8** | s21–s23 90 · s24 89 |
| E7 dva događaja | 73,0 | **69,0** | s25 82 · s26 **59** · s27 **66** |
| **deo B** | **80,7** | **79,1** | |

**Dobro:** s01 izmena sada navodi pravu trku (5 km 21:10, 9. 1.); s03 bolji rezultat više ne usporava prognozu
(53:38 prema 54:21); s11 (3 dana) više nije pauza — 2 izmene; s05 povratak 22 → 46 → 49 km pa prvobitan plan;
s14 subota 65 min uz dugi 75, pa dugi 95 min (+20); s25 dugi posle propuštenog 94 min od 85 odrađenih.

**Greške nađene čitanjem:**
1. **s27 (put 6 dana):** povratak je nedelja sa jednim trčanjem od 40 min, a sledeće nedelje **dugi 1 h 43**
   (+158 %, duže i od planiranog 1 h 41) i tempo trke 5 × 1 km četiri dana posle povratka. Tekst kaže „posle
   bolesti" za put.
2. **s26 (bol pa trka):** tri dana posle trke dugi 80 min (poslednji odrađen 45 min, +78 %), zatim dugi pada na
   50 min četiri nedelje; ned 15 26 % brzog (K6 → B1 ≤ 4); ned 14 tempo trke 2 × 600 m (1,2 km — bez svrhe).
3. **s06 (bolest u ned 13 od 18):** ned 14 22 km, pa ned 15 **52 km sa najdužim dugim plana (1 h 50)**, a nedelja
   −2 raste iznad prvobitne (49,8 → 53,6 km, dugi 90 → 100 min) — nadoknada nabijanjem pred trku.
4. **s07 (p11, ned 10):** „ostatak plana je srazmerno niži" — od ned 11 do kraja 10–18 km umesto 17–26 (−30 %),
   provera otpada. Isto pravilo kao HM s05 (krug 9b).
5. **s08 (p12, bolest 3 nedelje pred trku):** ned 11 (−1) četiri trčanja od 20–55 min, bez ikakvog rada u tempu
   trke do oštrenja.
6. **s13 i s15 — lagan dan duži od dugog u prozoru bola:** s13 subota 12 km, nedelja dugi 11,5 km; s15 utorak
   60 min, dugi 55 min (i ned 14 65 = 65; čuvar to prijavljuje). Pravilo „lagan ≤ 65 % dugog" iz HM kruga 6 ne važi
   u prozoru bola.
7. **s02:** izmena navodi stari test („5 km 26:39, 28. 11.") umesto trke 25:49 od 23. 1.; u p12 scenarijima
   (s04, s12, s16, s24) ponovo se objavljuje test 3 km kao nova izmena.
8. s09: propušten dugi sa „završnih 15 min u pragu" opisan je kao „jedan od glavnih treninga u tempu trke";
   propušten tempo trke 7 × 1 km (glavni trening te nedelje) se ne pominje.

## C. Personalizacija

| par | k1 | **k2** | viđeno |
|---|---|---|---|
| P1 stabilan / povratnik | 84 | **84** | B 34,1 → 48 km (A 41,1 → 54,7), dugi od 11 km, dve nedelje bez brzog, forma 49:24 „niska", upozorenje o cilju i laganom tempu; provera tek u ned 6 (očekivano 3–4) |
| P2 početnik / nov + tegoba | 80 | **83** | B 11,1 → 23,5 km, hod-trk, rasterećenje u ned 3, upozorenje o tegobi koristi istoriju bola; prognoza B 56:02 bez napretka uz širi raspon (ispravljeno); A 16 → 25,7 |
| P3 prebrzo / spori + prag | 82 | **82** | A dve nedelje bez kvaliteta, prvi prag 20 min u ned 3, upozorenje o laganom tempu; B prag od ned 1, dugi 1 h 50; vrh A 56 prema B 62 km (traženo isto); A označen kao „povratnik" |
| **deo C** | **82,0** | **83,0** | |

## D. Ispravke (najviše 8)

**MOTOR (iste kao HM-09 § D, ovde sa nalazima 10 km)**
1. Posle bolesti/pauze ostatak plana se ne snižava srazmerno (s07); povratak se vraća na prvobitan plan.
2. Granica dugog (+25 % / +20 min od poslednjeg stvarno istrčanog dugog) važi posle trke, puta i bolesti, i u
   drugoj nedelji povratka (s27 40 → 103 min, s26 45 → 80, s06 65 → 110 min).
3. Posle bolesti u poslednjih 6 nedelja nijedna buduća nedelja ne sme biti veća od prvobitne (s06 nedelja −2
   49,8 → 53,6 km); izgubljeno se ne nadoknađuje.
4. U prozoru bola: lagan dan ≤ 65 % dugog te nedelje (s13, s15); prvi tempo trke posle bola ≤ 70 % doze koja je
   izazvala bol (s13 vraća istih 5 × 1 km).
5. Tekst izmene: pravi rezultat (s02), bez ponovnog objavljivanja starog testa (p12), „put" a ne „bolest" (s27),
   ime propuštenog glavnog treninga i tačna vrsta (s09).

**PODATAK (10 km)**
6. p06: dugi ≥ 1,6 × najkraći lagan dan i ≥ 45 min (sada 32 min uz lagane 24 min); upozorenje mora da opisuje ono
   što plan stvarno radi (sada „4 od 5 nedelja bez kvaliteta" uz kvalitet svake nedelje).
7. p08: nedelja 1 = sadašnji obim (41, ne 38,9 km) i rast do × 1,2 za 18 nedelja; p04 ned 5–11 da raste
   (54 → 57 km je ravno sedam nedelja).
8. p02: doza tempa trke ≥ 4 km od ned 3 (sada 2 × 1,2 km); predlog obima za sledeću pripremu realan korak
   (30 → 40–45 km, ne „do 65 km").

## E. Presuda

**10 km nije zatvoren.** Plan je napredovao (74,8 → 76,9, 4 od 12 na ≥ 80; na merilu prethodnog trenera ≈ 78) i
specifična faza je sada dobra, ali deo B je pao ispod praga (79,1) zbog istih kvarova motora kao HM (bolest seče
ostatak plana; dugi bez granice posle trke i puta) i jednog novog (s06: nadoknada pred trku). Posle ispravki 1–4
očekujem B ≈ 82–83; posle 6–7 Plan ≈ 78–79 [srednja]. Tada je 10 km na nivou za zatvaranje uz pregled vlasnika;
p02 i p06 ostaju ograničeni ulazom (8 nedelja, 30 km).

Za pregled vlasnika:
- **s27** — ned 12–13: posle puta 40 min, pa dugi 1 h 43 i tempo trke 4. dan.
- **s06** — ned 14–16: 22 → 52 → 54 km pred trku posle bolesti.
- **p06** — ceo plan (8 nedelja): dugi 32 min, lagani 24 min.

Ograničenja: s05, s10, s18–s23 iz pregleda i brojeva; parovi delom iz brojeva; K4 samo u pročitanim delovima.
