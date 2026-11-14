# R19B — razvrstavanje profila PRE čitanja planova (14. 11. 2026)

Nov trener-sudija. Zapisano pre otvaranja ijednog plana: korišćen je samo prvi red fajla (opis ulaza) i red
„PLAN:" (`head -3`) svih 59 profila + 2 plana vlasnika, stanje `ef506f4c`. `judge2/` i `LOG.md` nisu čitani.

**Šta nisam mogao da izbegnem:** po nalogu sam pre ovoga pročitao rubriku i ocene R19 prethodnog trenera, pa znam
stare ocene i nekoliko brojeva ulaza koji u prvom redu pišu samo opisno („dno obima"): 10 km p02/p06 ≈ 30 km, 5 km
p06 26 km, HM p08 45 km, maraton p11 25 km. Odluke ispod izvedene su iz pravila, ne iz starih ocena — zato ima
profila sa starom ocenom ≥ 80 kojima sam strog i obrnuto.

**Broj nedelja** red „PLAN:" ne daje; izveden je iz datuma trke (plan počinje 2. 11. 2026 — slaže se sa „4 nedelje"
↔ 29. 11., „8 nedelja" ↔ 27. 12., „10 nedelja" ↔ 10. 1.): 13. 12. = 6, 27. 12. = 8, 10. 1. = 10, 24. 1. = 12,
7. 2. = 14, 21. 2. = 16, 7. 3. = 18, 21. 3. = 20, 18. 4. = 24 nedelje.

## Pravilo (isto za sve, pragovi po distanci)

Ulaz DOZVOLJAVA plan od 80 kad su ispunjena sva tri uslova; inače je „plafon ulaza".

| uslov | 5 km | 10 km | polumaraton | maraton |
|---|---|---|---|---|
| nedelja | ≥ 6 | ≥ 8 | ≥ 10 | ≥ 16 (12–15 samo uz ≥ 5 dana i srednji ili veći obim) |
| dana | ≥ 3 | ≥ 3 | ≥ 4 (3 samo uz obim na vrhu za 3 dana, da dugi ostane ≤ 45 % nedelje) | ≥ 4 |
| polazni obim / staž | ≥ 15 km i ≥ 3 meseca trčanja | ≥ 20 km | ≥ 25 km | ≥ 35 km; 25–35 km samo uz ≥ 22 nedelje |

Zašto distanca menja stvar: tri dana nose 5 i 10 km (dugi 60–90 min je trećina nedelje), a na polumaratonu sporog
trkača i na maratonu dugi postaje polovina nedelje i svaki trk je težak. Spor tempo sam po sebi nije plafon;
početnik sam po sebi nije plafon ako ima dovoljno nedelja.

## Polumaraton (12 + 2)

| profil | ulaz (ned · dana) | grupa | razlog |
|---|---|---|---|
| p01 | 40 km · 16 · 4 | dozvoljava | sve iznad praga |
| p02 | 5 km 20:25 · 14 · 4 | dozvoljava | 14 nedelja i 4 dana; obim nije u prvom redu (pretpostavljam ≈ 30 km) |
| p03 | spor, dno obima · 16 · 3 | **plafon ulaza** | 3 dana na dnu obima: dugi od 2 h 15+ je oko polovine nedelje, za drugi podražaj nema mesta |
| p04 | spor, sredina · 20 · 5 | dozvoljava | sve iznad praga |
| p05 | brz, vrh · 16 · 6 | dozvoljava | sve iznad praga |
| p06 | brz, dno za 5 dana · 10 · 5 | dozvoljava (nesiguran) | 10 nedelja je na pragu, ali 5 dana i brz trkač daju 6–7 radnih nedelja i dugi do 18–20 km |
| p07 | srednji, sredina · 10 · 5 | dozvoljava | na pragu nedelja, ostalo iznad |
| p08 | srednji, vrh za 3 dana · 20 · 3 | dozvoljava (nesiguran) | 3 dana, ali ≈ 45 km i 20 nedelja: dugi 18–20 km ostaje ≤ 45 % nedelje |
| p09 | po osećaju 6:00 · 16 · 4 | dozvoljava | sve iznad praga |
| p10 | spor 7:30, dno · 20 · 3 | **plafon ulaza** | isto kao p03: 3 dana na dnu obima, trka ≈ 2 h 40+, dugi polovina nedelje |
| p11 | početnik, dno tabele · 20 · 4 | dozvoljava | 20 nedelja i 4 dana nadoknađuju mali polazni obim |
| p12 | početnik 7:00, vrh tabele · 16 · 5 | dozvoljava | sve iznad praga |
| vlasnik-v1 | HM 1:41, 30 km · 10 · 4 | dozvoljava (nesiguran) | na pragu nedelja i blizu praga obima, ali trkač je već istrčao distancu |
| vlasnik-v2 | 18 nedelja posle polumaratona | dozvoljava | sve iznad praga |

## 10 km (12)

| profil | ulaz (ned · dana) | grupa | razlog |
|---|---|---|---|
| p01 | 40 km · 16 · 4 | dozvoljava | sve iznad praga |
| p02 | 5 km 20:25, ≈ 30 km · 8 · 4 | dozvoljava (nesiguran) | 8 nedelja je na pragu, ali uz postojećih ≈ 30 km to je pun blok za 10 km |
| p03 | spor, dno · 12 · 3 | dozvoljava | 3 dana nose 10 km; 12 nedelja dovoljno |
| p04 | spor, sredina · 18 · 5 | dozvoljava | sve iznad praga |
| p05 | brz, vrh · 12 · 6 | dozvoljava | sve iznad praga |
| p06 | brz, dno za 5 dana (≈ 30 km) · 8 · 5 | dozvoljava (nesiguran) | isto kao p02; 5 dana na 30 km znači kratke dane, ali trener to rešava rastom obima |
| p07 | srednji, sredina · 8 · 5 | dozvoljava | na pragu nedelja, ostalo iznad |
| p08 | srednji, vrh za 3 dana · 18 · 3 | dozvoljava | 3 dana nose 10 km |
| p09 | po osećaju 6:00 · 12 · 4 | dozvoljava | sve iznad praga |
| p10 | spor 7:30, dno · 18 · 3 | dozvoljava (nesiguran) | 3 dana i dno obima, ali dugi od 75–90 min je dovoljan za 10 km i 18 nedelja je mnogo |
| p11 | početnik, dno tabele · 18 · 3 | dozvoljava | 18 nedelja i 10 km — pristojan ulaz za početnika |
| p12 | početnik 7:00, vrh tabele · 12 · 4 | dozvoljava | sve iznad praga |

## Maraton (19)

| profil | ulaz (ned · dana) | grupa | razlog |
|---|---|---|---|
| p01 | 40 km · 16 · 4 | dozvoljava (nesiguran) | tačno na sva tri praga; vrh ≈ 55 km i dugi 28–30 km su dostižni |
| p02 | 5 km 20:25 · 18 · 4 | dozvoljava (nesiguran) | 18 nedelja i 4 dana; obim nije u prvom redu — ako je ≈ 30 km, ovo je plafon |
| p03 | spor, dno · 18 · 3 | **plafon ulaza** | 3 dana i dno obima; trka > 5 h, dugi ograničen vremenom na ≈ 24 km |
| p04 | spor, sredina · 24 · 5 | dozvoljava | 24 nedelje i 5 dana; spor tempo sam nije plafon |
| p05 | brz, vrh · 18 · 6 | dozvoljava | sve iznad praga |
| p06 | brz, dno za 5 dana · 12 · 5 | **plafon ulaza** | 12 nedelja sa malog obima: ni obim ni dugi ne stižu do maratonskog nivoa |
| p07 | srednji, sredina · 12 · 5 | dozvoljava (nesiguran) | 12 nedelja, ali 5 dana i srednji obim — skraćen, a potpun maratonski blok |
| p08 | srednji, vrh za 3 dana · 24 · 3 | **plafon ulaza** (nesiguran) | 3 dana: dugi od 28–30 km je 55–60 % nedelje, svaki trk je težak |
| p09 | po osećaju 6:00, sredina · 18 · 4 | dozvoljava | sve iznad praga |
| p10 | spor 7:30, dno · 24 · 3 | **plafon ulaza** | 3 dana, dno obima, trka > 5 h |
| p11 | početnik, 25 km · 24 · 4 | dozvoljava (nesiguran) | mali obim, ali 24 nedelje daju vreme da se prvo napravi baza pa priprema |
| p12 | početnik 7:00, vrh tabele · 18 · 5 | dozvoljava (nesiguran) | 18 nedelja i 5 dana; pretpostavljam obim ≥ 35 km |
| p13 | 28 km · 10 · 3 | **plafon ulaza** | pada na sva tri uslova |
| p14 | 85 km · 16 · 6 | dozvoljava | sve iznad praga |
| p15 | povratnik, 40 km · 20 · 5 | dozvoljava | pauza je završena pre 4 nedelje; 20 nedelja i 5 dana |
| p16 | rođen 1961, koleno, 45 km · 18 · 4 | dozvoljava | godine i tegoba traže oprez, ne spuštaju plafon |
| p17 | 90 km · 18 · 6 | dozvoljava | sve iznad praga |
| p18 | početnik 7:30, 30 km · 20 · 4 | **plafon ulaza** (nesiguran) | 30 km uz 20 nedelja je ispod praga obima; trka > 5 h, dugi ostaje na ≈ 24 km |
| p19 | 40 km · 8 · 4 | **plafon ulaza** | 8 nedelja |

## 5 km (16)

| profil | ulaz (ned · dana) | grupa | razlog |
|---|---|---|---|
| p01 | 40 km · 12 · 4 | dozvoljava | sve iznad praga |
| p02 | 5 km 20:25 · 8 · 4 | dozvoljava | 8 nedelja je dovoljno za 5 km |
| p03 | spor, dno · 10 · 3 | dozvoljava | 3 dana nose 5 km |
| p04 | spor, sredina · 16 · 5 | dozvoljava | sve iznad praga |
| p05 | brz, vrh · 10 · 5 | dozvoljava | sve iznad praga |
| p06 | brz, 26 km · 6 · 5 | dozvoljava (nesiguran) | 6 nedelja je na pragu: za treniranog trkača to je blok oštrenja (3–4 radne nedelje + sužavanje) |
| p07 | srednji, sredina · 6 · 5 | dozvoljava (nesiguran) | isto kao p06 |
| p08 | srednji, vrh za 3 dana · 16 · 3 | dozvoljava | 3 dana nose 5 km |
| p09 | po osećaju 6:00 · 10 · 4 | dozvoljava | sve iznad praga |
| p10 | spor 7:30, dno · 16 · 3 | dozvoljava | 3 dana nose 5 km |
| p11 | početnik, dno tabele · 16 · 3 | dozvoljava | 16 nedelja i 5 km |
| p12 | početnik 7:00, vrh tabele · 10 · 4 | dozvoljava | sve iznad praga |
| p13 | staž 6 nedelja, 10 km · 10 · 3 | **plafon ulaza** (nesiguran) | staž i obim ispod praga: plan može samo da uvede neprekidno trčanje, kvalitet i specifičnost nemaju mesta |
| p14 | 35 km · 4 · 4 | **plafon ulaza** | 4 nedelje: dve radne nedelje i sužavanje, nema progresije ni provere forme |
| p15 | povratnik, 20 km · 14 · 4 | dozvoljava | 14 nedelja je dovoljno i za povratak i za pripremu |
| p16 | rođen 1960, 25 km · 12 · 4 | dozvoljava | sve iznad praga |

## Zbir

| distanca | dozvoljava | plafon ulaza |
|---|---|---|
| polumaraton | 10 (+ 2 vlasnik) | 2 (p03, p10) |
| 10 km | 12 | 0 |
| maraton | 12 | 7 (p03, p06, p08, p10, p13, p18, p19) |
| 5 km | 14 | 2 (p13, p14) |
| **ukupno** | **48** (+ 2) | **11** |

## Gde nisam siguran

1. **Kratke pripreme na pragu** (HM p06 i vlasnik-v1 10 ned; 10 km p02 i p06 8 ned; 5 km p06 i p07 6 ned): stavio sam
   „dozvoljava" jer trkač već ima bazu, a blok je kratak ali potpun. Ko misli da je prag nedelju-dve viši, prebacuje
   svih šest u plafon — odluka je ista za sve, ne pojedinačna.
2. **Tri dana:** plafon na maratonu (p03, p08, p10) i na polumaratonu sa dna obima (p03, p10); dozvoljava na
   polumaratonu sa 45 km (p08) i svuda na 5 i 10 km. Najspornija su dva: maraton p08 (24 nedelje, najviše što 3 dana
   mogu) i HM p08.
3. **Početnik na maratonu:** p11 (25 km, 24 ned) dozvoljava, p18 (30 km, 20 ned) plafon — deli ih samo broj
   nedelja; oba su blizu granice. p12 zavisi od obima koji ne piše u prvom redu.
4. **5 km p13:** plan za ovakav ulaz može biti odličan kao uvod u trčanje, ali rubrika A1 traži dozu kvaliteta i
   specifičnost koje ovde ne treba zadavati — zato plafon.
5. Obim u prvom redu većine profila piše opisno; gde broj ne znam, pretpostavka je navedena u tabeli.
