# Glavni trener — V4 5 km, krug 7 (R28, 15. 11. 2026, 07:40 po Beogradu) — štedljiva ocena posle R27

Ocenjeno stanje **51e1bc57**, upoređeno sa b8ad0bb6 (krug 6 / R25). Ista rubrika (§ A3), razvrstavanje iz `R21-RAZVRSTAVANJE.md` bez izmene (plafon ulaza: p13, p14). `judge2/` nije čitan. Ocene promenjenih = ocena R25 + učinak izmene po kriterijumu (isti način kao u krugu 6), uz moju nezavisnu ocenu kao proveru.

**Kalibracija (stanje b8ad0bb6, Plan):** p06 — moja 63,5 naspram 65,5 (−2, u granici). **p12 — moja 73 naspram 77 (−4, preko 3 poena: zapisano, nije štimovano;** isti smer i veličina kao u krugu 6: −3,5). Posledica: moje nezavisne ocene su 2–4 poena strože od skale R23/R25; gde to menja prolaz, piše u tabeli.

## 1. Šta se promenilo (`git diff b8ad0bb6 51e1bc57 -- plans/5K`)

Treninzi: **p03, p06, p13, p15, parovi P1 B i P2 B.** Samo oznaka „vršna nedelja" (popravka 7f3ea1fa): p01, p02, p12, parovi P1 A, P3 A i 18 scenarija (provereno: u scenarijima nijedan red osim zaglavlja nedelje). Bajt-isti: p04, p05, p07–p11, p14, p16.

**Zbirno: Plan 78,8 · Prilagođavanje 82,8 · Personalizacija 82,7 → zbirna 80,8** (k6: 77,4 · 82,8 · 82,7 → 80,1).
**Po merilu: „dozvoljava" 8 od 14 (k6: 7 od 14) · plafon ulaza 1 od 2 (k6: 0 od 2).**

## A. Plan — po profilu

| profil | grupa | Plan R25 → **sada** | Plan za ulaz R25 → **sada** | status | prolazi | šta deli od praga |
|---|---|---|---|---|---|---|
| p01 | dozvoljava | 82 → **82** | — | prenet (oznaka) | da | |
| p02 | dozvoljava | 75,5 → **76** | — | oznaka ispravljena | **ne** | obim 31–34 km i nazad; lagan dan 22–28 min |
| p03 | dozvoljava | 75 → **76** | — | **ocenjen ponovo** | **ne** | obim 13,2–16 km, dugi 45 min četiri puta, lagan dan 20 min |
| p04 | dozvoljava | 80,5 → **80,5** | — | prenet | da | |
| p05 | dozvoljava | 82 → **82** | — | prenet | da | |
| p06 | dozvoljava | 65,5 → **78,5** | — | **ocenjen ponovo** | **ne** | lagan dan 22 min svake nedelje; doze intervala i praga ispod standarda; nedelja pred trku 75 % |
| p07 | dozvoljava | 80 → **80** | — | prenet | da | |
| p08 | dozvoljava | 75 → **75** | — | prenet | **ne** | kreće ispod sadašnjeg obima; 33–36 km devet nedelja |
| p09 | dozvoljava | 80 → **80** | — | prenet | da | |
| p10 | dozvoljava | 76,5 → **76,5** | — | prenet | **ne** | obim 16,3–17,8 km osam nedelja, dugi 55 min šest puta |
| p11 | dozvoljava | 80 → **80** | — | prenet | da | |
| p12 | dozvoljava | 77 → **77** | — | prenet (oznaka) | **ne** | kreće sa 43,5 km uz sadašnjih 48 i ne stiže ih |
| p13 | **plafon** | 77 → **80** | 76 → **81** | **ocenjen ponovo** | **da** | (na ivici; v. dole) |
| p14 | **plafon** | 77 → **77** | 78 → **78** | prenet | **ne** | ni reči šta posle trke; 3 × 800 m u 3. nedelji |
| p15 | dozvoljava | 76 → **80** | — | **ocenjen ponovo** | **da** | (na ivici; moja nezavisna 77,5) |
| p16 | dozvoljava | 80 → **80** | — | prenet | da | |
| **prosek** | | **77,4 → 78,8** | | | 9 od 16 | |

**Ponovo ocenjeni (sve nedelje iz dana, zbirovi i udeli brzog rada preračunati — slažu se):**
- **p06 65,5 → 78,5 (+13), ne prolazi za 1,5.** Četiri dana (pon lagano, uto i čet brzo, ned dugi) u svih pet nedelja; kvaliteti 2-2-2-2-1 + oštrenje: 3 × 800 m + prag 8 min · 3 × 1 km + prag 11 min · 9 × 200 m + tempo trke 8 × 400 m · tempo trke 3 × 800 m + 9 × 200 m · tempo trke 3 × 800 m. Brz rad 14-17-12-12-8 %, teški dani razdvojeni. Km 25,7 → 27,2 → 29 → 25,3 → 21,8. **„Dan manje" je trenerski ispravna odluka:** pet dana po 22 min zamenjeno je nedeljom sa dva prava podražaja, a upozorenje kaže zašto, kada se peti dan vraća (redovni obim > 29 km) i da trkač potvrdom zadržava svih 5. Dva upozorenja umesto tri, oba sa brojem. Ostaje: ponedeljak 4,5 km / 22 min u svakoj nedelji; dugi 37–42 min; 2,4–3 km intervala i 8–11 min praga je malo za 17:33 (objašnjeno obimom); nedelja pred trku 75 % vrha (87 % dve nedelje pre) — za 5 km prihvatljivo, ali iznad 60–70 % iz rubrike.
- **p13 stara 77 → 80, Plan za ulaz 76 → 81 (8 · 8 · 8 · 8,5) — prolazi.** Km 10 → 10,9 → 11,5 → 12,3 → 13,7 → (9,6) → 14,9 → 13,8 → 9,7; koraci +9, +5,5, +7, **+11,4 %** (ispod praga K7 od 12 %; u minutima 105 → 116, +10,5 %), vrh posle rasterećenja +8,8 % na 5. nedelju. Dugi hod-trk 35 → 55 min po +5 min, u komadu 30 min (6. ned) i 45 min (8. ned). Radni dani 25–40 min, nedelja provere ima 3 treninga, tempo trke 3 × 400 → 5 × 400 → 3 × 400 m. Nestale su rečenice „ne može bezbedno iznad 12,6 km" i „duža priprema ne pomaže"; dan trke: „celih 5 km bez hodanja, napor 6–7 od 10". **Zamerke:** pet nedelja rasta zaredom za trkača sa šest nedelja staža (ukupno +49 % do vrha) — bezbedno samo zato što je dve trećine rasta hod-trk; zaglavlje zone „tempo trke" i dalje kaže „8–9 od 10, poslednji kilometar sve što imaš", suprotno tekstu dana trke.
- **p15 76 → 80 — prolazi.** Km 17 → 18,4 → 21 → 21,9 → 23 → (21,8) → 24,5 → 26,1 → 26,2 → (22,8) → 27 → 21,2 → 18,5; dugi 40-40-45-50-55-(45)-60-60-56-—-64 min, dva sa završnicom u pragu. 17 → 27 km za 11 nedelja je × 1,35 obima pre pauze, sa dva rasterećenja i koracima ≤ 7 % posle 3. nedelje — za povratnika u redu. **3. nedelja +14 % u km** (18,4 → 21; u minutima +11 %) — ne beležim kao K7 jer je to povratak na obim pre pauze (20 km), ali je najveći korak u planu baš u nedelji prvog brzog treninga. Ostaje: 4. nedelja (brze deonice 5 × 300 m u treningu od 47 min, uz lagane 20 i 28 min — brzi trening je dug koliko i dugi); prag 9 min dva puta isti; lagani 20 min u obe nedelje sužavanja.
- **p03 75 → 76.** Jedina izmena: 9. nedelja dobija tempo trke 3 × 600 m (bilo: nedelja bez ičeg brzog). Obim i dugi isti.
- **p02 75,5 → 76.** „Vršna nedelja" je sada na 5. nedelji (33,8 km, test iza, tempo trke 5 × 1 km) — regresija iz kruga 6 zatvorena.
- **K-provere:** K2, K5, K6, K7 nema. K8 (dan < 20 min) nema; dani od tačno 20–22 min ostaju u p06, p03, p15 (4., 12., 13. ned), p13 (6., 9., 10. ned).

**Commit 21abcf1e (p15, P1 B) — oslabljena provera „povratnik ≤ 4 dana: ≥ 2 treninga brzine umesto 3": trenerski prihvatljivo.** Brze deonice su najrizičniji podražaj posle povrede; dva takva treninga u 14 nedelja uz tempo trke u pet nedelja su dovoljna za 5 km. Izuzetak je uzak (nivo `povratnik` i ≤ 4 dana). Zamerka: pravilo „bez jakih uzbrdica u nedeljama 1–4" važi za p15, a **P1 B (isti nivo, 4 dana) i dalje ima 6 × 12 s jako uzbrdo u 1. i 2. nedelji** — nedosledno, nije opasno (P1 B nema tegobu).

## B. Prilagođavanje — 82,8 (preneto)

Svih 18 promenjenih scenarija razlikuje se samo u oznaci „vršna nedelja" u zaglavlju nedelje; treninzi pre i posle događaja su isti. E1 83,8 · E2 81,0 · E3 82 · E4 80,4 · E5 82,0 · E6 89,8 · E7 80,7. s20 nepromenjen.

## C. Personalizacija — 82,7 (P1 84 · P2 82 · P3 82)

- **P1 B 84 (isto).** Vrh 46,3 → 45,8 km (A: 51,8), prvi dugi 10,5 → 12 km (očekivano 11–12), najduži 15,5 km; prag u razvoju 24 → 14 min i 3 × 8 → 2 × 7 min, 6. nedelja 18 → 12 % brzog rada. Smer razlike prema A je i dalje tačan (niži vrh, prve dve nedelje bez T/R, provera u 4. nedelji, širi raspon); manja doza praga povratniku odgovara. Prvi dugi od 12 km u 1. nedelji posle tri meseca pauze je na gornjoj ivici očekivanog.
- **P2 B 82 (isto).** Menja se samo 14. nedelja: dugi u komadu 40 → 45 min.

## D. Regresije (R25 dobro → sada lošije)

**Nijedna ocena nije pala.** Regresija kruga 6 (p02, oznaka vršne nedelje) je zatvorena. Dve sitnice bez pada ocene:
1. **Oznaka „vršna nedelja" kod p01, P1 A i P1 B** je sada na 7. nedelji (48,6 km, 5 nedelja do trke), a najveća nedelja po kilometrima (9. — 50,8 km, 3 nedelje do trke) piše „gradnja". Oznaka prati opterećenje, trkač gleda kilometre.
2. **p13:** upozorenje više ne pominje da je vrh (14,9 km) na samoj donjoj granici adekvatnog obima — tačno je da je dostiže, ali trkač to ne zna.

## E. Šta vlasnik treba da zna pre puštanja (najviše 5)

1. **p06: plan sam daje 4 dana trkaču koji je tražio 5.** Plan je time mnogo bolji (65,5 → 78,5), upozorenje je jasno i trkač potvrdom vraća 5 dana — ali to je odstupanje od pravila „nijedan izbor trkača se ne odbija" (AGENTS § 6). Treba tvoja odluka da li je „dan manje dok ne potvrdiš" u redu kao podrazumevano ponašanje.
2. **Šest profila je i dalje ispod 80 i R27 ih nije dirao:** p12 77 · p10 76,5 · p02 76 · p03 76 · p08 75 (+ p06 78,5). Nisu opasni — tanki su: obim stoji ili kreće ispod sadašnjeg, dugi se ponavlja. p14 (plafon, 78): i dalje ni reči šta posle trke.
3. **p13 i p15 prolaze na samoj ivici (81 i 80)**, po skali R25; moja nezavisna ocena je 2–4 poena stroža (kalibracija p12: −4). Drugi sudija ih može oceniti ispod 80 — to ne bi bilo neslaganje u čitanju plana, nego u strogosti.
4. **Lagan dan od 20–22 min** i dalje postoji (p06 svake nedelje, p15 u 4. nedelji i sužavanju, p03). Kod p06 ga je „dan manje" sveo sa pet na jedan nedeljno, nije ga uklonio.
5. **s20 (juče 10 km za 70 min, početnik)** nepromenjen: prvi trk 65 min četvrtog dana, dugi 90 min sedmi dan.

## F. Presuda

**5 km: B 82,8 i C 82,7 prolaze; „dozvoljava" 8 od 14 (bilo 7), plafon ulaza 1 od 2 (bilo 0).** Prešli prag: p15 (80), p13 (81 za ulaz). Najveći pomak: p06 +13, ostaje 1,5 ispod. Niko nije pao. Ispod: p06 78,5 · p12 77 · p10 76,5 · p02 76 · p03 76 · p08 75; plafon p14 78.
**Da li bih pustio 5 km trkačima: da, uz upozorenja kakva jesu** — nijedan plan nije opasan niti loš (jedini loš, p06, više to nije); šest planova je tanko, ne štetno. Pre puštanja tražim samo odluku vlasnika iz § E1.
