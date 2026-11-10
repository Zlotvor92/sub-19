# P8-HM — STOP: odluke koje tab nije smeo sam da donese (hm-v2.11.0)

10. 11. 2026 (Europe/Belgrade). Rad nije stajao: za svaku tačku je ugrađeno stanje navedeno pod „u kodu sada", ostalo
čeka odluku organizatora. Brojevi: `P8-HM/measure.ts` (mreža P0 192 ulaza, velika mreža 27 930), `/P8-HM/out/*.json`,
komande u `P8-HM-REPORT.md`.

**Odluke organizatora (10. 11. 2026, 16:38): S1 → O1; S2 → O2; S3 → oba prihvaćena; S4 → O2; S5 → O2; S6 potvrđeno;
G6 početnik 0,80. Ugrađeno u hm-v2.12.0 — vidi `P8-HM-REPORT.md` § Završetak.**

## S1 — G5 „taper ≤ 60 %" × G2 „najniži nivo uvek staje" (sudar pravila)

Posle G4 najveći RP trening je 5–8 km (45 min), pa je najmanja doza tapera 2 × 2000 m često više od 60 % poslednje
doze (4 km posle 5 ili 6 km = 67–80 %). Planova čiji taper nosi dozu > 60 % najveće doze iste zone: mreža P0 27 → 88
od 192; velika mreža 11 789 od 27 446.

- **O1 (u kodu sada):** najmanja doza 2 × 2000 m ostaje (postojeći izuzetak H7 + G2); napomena tapera to kaže
  („RP 4,0 km je najmanja doza u trkačkom tempu…"). Taper u minutima: medijana 20 min RP (P0), najviše 26,2 min.
- **O2:** taper dobija kraću strukturu van lestvice (npr. 2 × 1500 m ili 3 × 1000 m ≤ 60 %) — traži izmenu H10
  (RP deonice ≥ 2000 m) i novu lestvicu tapera.
- **O3:** prag 60 % → 70 % za taper (kao 5K (b)); tada 4 km posle 6 km prolazi, posle 5 km ne.

## S2 — G8 dugi početnika do 16 km (nije ugrađeno)

Ugradnja „najviše 3 ne-rasteretne nedelje vrha" traži pravilo dugog PO NEDELJI: validator čita pravilo plana na ≈ 38
mesta (dužine, drugi član plafona, kapacitet). To je zaseban segment, ne izmena jedne funkcije.
Izmerena gornja granica efekta (kopija sa udelom dugog početnika 50 % u SVIM nedeljama, mreža početnika 1890 planova,
`/tmp` skripta opisana u izveštaju): najduži dugi ≥ 16 km 792 → 1326 planova, ≥ 14 km 1239 → 1680, 0 odbijanja;
4 d 20 km: 10,8 → 12,6 km; 4 d 25 km: 14,0 → 16,8; 5 d 25 km: 11,2 → 14,9; 5 d 30 km: 13,4 → 18,0.
Nalaz: profil P7 p11 (4 d, 20 km) NE dobija 16 km ni tako — dugi mu drže lagani dani (≥ 4 km / 20 min) i dan
kvaliteta, ne udeo; treba mu veći obim ili manje dana (postojeće upozorenje LONG_RUN_SHORT to kaže).

- **O1:** kako je zadato (3 nedelje vrha, do 16 km) — poseban segment (pravilo po nedelji u validatoru).
- **O2:** udeo dugog početnika max(udeo reda; min(50 %, 16 km)) u svim nedeljama izgradnje — jedna izmena u
  `lengths.longShareCap10`, izmereno gore (gornja granica; sa plafonom 16 km efekat je isti ili manji).

## S3 — nova odbijanja (dve klase, obe postojeći kod odbijanja sa pragom)

1. **G6 pomera prag `RECENT_LONG_TOO_SHORT`.** Skorašnji najduži 5–12 km u koraku 0,5 (5760 ulaza): odbijeno 2343 →
   2229; novih 27 (4 d r 5–6 km: 15; 5 d r 5–6 km: 9; 6 d r 6 km: 3), izgubljenih 141. Primer: 4 d, 40 km, VDOT 70,
   r 6 km — prag 5,5 → 6,5 km (lagan ≤ 0,7 × dugi od 7 km ne nosi obim nedelje 1). Poruka i dalje navodi prag.
   - **O1 (u kodu sada):** prihvatiti (ista klasa odbijanja, sa pragom i preporukom).
   - **O2:** u nedeljama 1–4 kad je dat skorašnji najduži: lagan ≤ 0,80 × dugi (stari udeo).
2. **G1 × taper na najmanjem obimu.** Početnik 4 d, 20 km, 12 ned, lagan 5:30/km (3 plana od 27 930): vrh 28 → 26 km,
   taper 17,9 km ne nosi ni T 1,5 km uz 4 dana ≥ 4 km.
   - **U kodu sada:** nije odbijanje — taper bez kvaliteta i trkačka nedelja bez oštrenja (postojeći ishod HI2/HI10,
     `week.taperDoseFits` strict). Velika mreža: odbijanja 508 → 484, novih 0.
   - **O2:** faktor vrha se ne primenjuje kad je start na dnu tabele početnika.

## S4 — HM (c) kontrolni test nedelju ranije (nije ugrađeno)

Posle G1 poslednja ne-rasteretna nedelja razvoja je po pravilu nedelja u kojoj se dostiže vrh, pa je uslov „ima
najveći cilj obima" skoro uvek ispunjen: test u nedelji najvećeg cilja ima 84 od 112 planova sa testom (P0), 13 518
od 20 175 (velika mreža). Uslov zavisi od ciljeva obima, a nedelju testa određuje `periodize` pre obima — ugradnja
traži konstrukciju u dva prolaza ili bezuslovno pravilo.
G7 je ugrađen: u nedelji testa test je JEDINI kvalitet (drugi dan lagan) — trenerov standard („u nedelji smanjenog
obima ili bez drugog kvaliteta") je time ispunjen: nedelja testa sa drugim kvalitetom 77 → 0 (P0).

- **O1 (u kodu sada):** samo G7.
- **O2:** bezuslovno — kontrolni test plana sa rezultatom u pretposlednjoj ne-rasteretnoj nedelji razvoja (jedna
  izmena u `periodize.testWeekOf`; ne-rasteretnih nedelja razvoja ima 2–5).

## S5 — G7 „ne pre nedelje 4": plan po osećaju od 10–12 nedelja ostaje bez testa

Baza traje 3 nedelje za 10–12 nedelja pripreme, pa bi test pao u nedelju 3; po pravilu („prva ne-rasteretna nedelja
≥ 4 iste faze, inače bez testa") nema ga: 1728 od 6336 planova mreže po osećaju (svi od 10–12 nedelja). Plan to kaže
napomenom („Plan je prekratak za test 5 km…"), tempo ostaje procena do unosa rezultata.

- **O1 (u kodu sada):** bez testa.
- **O2:** test u prvoj ne-rasteretnoj nedelji razvoja (nedelja 4) umesto I treninga.

## S6 — tumačenja taba (da organizator potvrdi)

- Satni plafon vrha računa se tempom plana NA STARTU (rezultat unet u adaptaciji ne menja vrh); posle novog starta
  (pauza ≥ 28 dana) faktor po dužini pripreme koristi ukupnu dužinu plana.
- G1 × adaptacija: korak rasta zavisi od budućih nedelja, a adaptacija ih menja → cilj po pravilu nedelje koja je cela
  prošla čita se iz upisanog plana (konstruktor i validator), ne računa se ponovo (princip pouke 29).
- G2 ne važi u rasterećenju (zadato: izgradnja i taper) — rasterećenje bez kvaliteta kod najmanjeg obima ostaje.
- G5 rasterećenje: plan sa jednim kvalitetom čita poslednju T dozu umesto doze slota; najmanja T doza 2,0 km ostaje
  i kad je > 60 % (planova sa rasterećenjem > 60 % iste zone: P0 98 → 94 — svi su najmanja doza).
- G3: P7 je ocenjivao SIROVE napomene plana (sa oznakama pravila); aplikacija prikazuje `userWeekNotes`/`userText`.
  Ispis za P9 treba da ide kroz te funkcije — `P8-HM/render.ts` to radi (`P8-HM/plans/p01…p12.txt`).
