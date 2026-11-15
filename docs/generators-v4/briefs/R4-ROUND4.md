# Brief R4 — krug 4 V4 HM (motor + podaci), 13. 11. 2026

Polazište: `claude/v4` posle kruga 3 (`0d9d9bd`). Ocene kruga 3: trener Plan 78,7 / zbirna 80,4
(`coach/ROUND-V4-HM-03.md`), drugi sudija planovi 62,9, scenariji 78, parovi 6,7 (`judge2/ROUND-V4-HM-03.md`).
Pročitaj OBA fajla u celosti — pojedinačne nedelje i brojevi su tamo. Ovaj brief je odluka organizatora šta se
menja; gde se sudije razlikuju, važi ovo. Pravila rada ista kao u krugu 3 (grana, testovi, trailer, bez distance u
motoru, „ne staj"). Cilj: Plan ≥ 80 kod trenera bez pada ijednog profila; kod drugog sudije nijedan plan < 65.

## Motor
- **E1 Rep izmena posle bolesti/bola/pauze.** Prozor izmene = rampa + 14 dana. Posle toga se vraća PRVOBITAN plan
  bajt-isto (nula izmena). `≤ 1,10 ×` se meri prema poslednjoj PUNOJ nedelji pre događaja i ne lanča se preko
  nedelje rasterećenja. Najteža nedelja se ne dira ako je ≥ 3 nedelje posle povratka. Test: s05 ≤ 12 izmena,
  s16 ≤ 12, s14 ≤ 10; s13, s06 bez izmena van prozora.
- **E2** Kad se nedelja skraćuje, dugi i blok u njemu se skraćuju srazmerno (dugi ≤ 45 % te nedelje). Nema
  „lagano 6 km" umesto kvaliteta uz netaknut dugi sa blokom.
- **E3** Pomerena provera forme ne sme u ± 2 dana od treninga u tempu trke niti sme da zameni jedini tempo trke
  te nedelje; ako nema mesta — otpada uz rečenicu.
- **E4** Bol ≤ 4/10 posle laganog dana: 2 dana odmora + 7–10 dana samo lagano; kasnije nedelje netaknute
  (brojevi su podatak u `safety`).
- **E5** s02 se ponaša kao s01 (planirana trka: 2–3 izmene).
- **E6 Polazni obim.** Nedelja 1 = prosek poslednje 3 stvarne nedelje (ne 8), osim uz bol/pauzu u te 3 nedelje.
  P1 B (22/30/36/40) kreće sa ≈ 35 km; P2 B sa ≈ 20 km. Tekst „nemam trčanja sa sata" samo kad ih stvarno nema.
- **E7** Udeo dugog se meri u KILOMETRIMA (ne minutima), svuda: plan, čuvar, kapija.
- **E8 Forma ne raste od poslušnosti.** „Trenutna procena" se menja samo na signal (trka, test, odrađen kvalitet
  u zadatom tempu, višenedeljni trend laganih). Odrađen plan bez signala ne pomera procenu ni tempa. Očekivani
  raspon na dan trke sme da uključi planirani napredak, ali je označen kao očekivanje i uz pouzdanost „niska"
  sredina raspona ne sme biti > 1 % brža od trenutne procene. Test: s04 (prognoza pre testa nije brža od unete
  forme), s24 (bez signala nula promene procene). Ako je uzrok u `fitness/`, menjaj tamo i zapiši.
- **E9 Silazak intenziteta.** Nedelja −2 (8–14 dana pred trku): najviše 2 kvalitetna treninga, brz rad ≤ 60 %
  minuta brzog rada vršne nedelje. Poslednjih 7 dana: samo oštrenje (8–12 min); bez praga i tempa trke dužeg od
  toga. Brojevi su podatak distance (`safety.taper`), motor ih samo primenjuje. Čuvar: nalaz `silazak-intenziteta`.

## Podaci polumaratona
- **D1** Talas dugog samo kad je dugi na plafonu. Inače raste (p04: 1 h 50 → 2 h 10). Talas ne menja zbir
  nedelje: razlika ide u lagane dane (p04 52 ↔ 56, p05 90 ↔ 104 ne sme).
- **D2** Hod-trk dugi (`pocetnik-nov`): + 10 min po nedelji gradnje do 1 h 40–1 h 45; udeo dugog do 50 %.
- **D3** Tri dana nedeljno: udeo dugog ≤ 50 %; dugi ≤ vreme trke + 5 min (p03 2 h 10); blok u dugom ≤ 35 min
  (p03, p10); p10 bez drugog testa 5 km.
- **D4** vlasnik-v2: dugi 18 km u dve nedelje (ned 13 i 15); dugi ne stoji 15–16 km od ned 8 do 16.
- **D5** p06: ned 1–2 i 5 po treneru; nema 5 dana po 24–29 min — najkraće lagano trčanje za taj nivo 35 min,
  radije dan manje uz rečenicu. p07: rast prve tri nedelje ≤ 8 %.
- **D6** p08: dugi ne počinje na plafonu — ned 1 ≤ 85 % najdužeg, pa raste; 20,5–21,5 km najviše u 5 nedelja.
- **D7 Doza tempa trke po nivou** (minuti nedeljno, uklj. blok u dugom): početnik ≤ 45, srednji ≤ 60,
  napredni ≤ 75; p12 ned 13 (77 min) i p07 (18–19 km) pod plafon.
- **D8** Kad je razmak prag – tempo trke < 5 s/km (p05, p06): ne zadaju se kao dva različita podražaja u istoj
  nedelji; tekst kaže „tempo trke ≈ prag".
- **D9** Kapija i testovi dopunjeni za E1, E6, E7, E8, E9, D3, D7; osveži sve ispise (12 + 2, scenariji, parovi).

## Isporuka
`docs/generators-v4/reports/R4-REPORT.md` (≤ 80 redova): stavka po stavka, tabela po profilu kao u R3 + kolona
„brz rad ned −2 / ned −1 (min)" i „broj izmena" za s05, s06, s13, s14, s16; šta nije uspelo. Poruka organizatoru.
