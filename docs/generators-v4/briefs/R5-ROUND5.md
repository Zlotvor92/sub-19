# Brief R5 — krug 5 V4 HM (motor + podaci), 13. 11. 2026

Polazište: `claude/v4` posle kruga 4 (`8197da5`). Ocene kruga 4: trener Plan 78,8 (6/12 ≥ 80), zbirna 81,1
(`coach/ROUND-V4-HM-04.md`); drugi sudija planovi 70,2 (krug 3: 62,9), v1 68, v2 76, scenariji 79, parovi 72
(`judge2/ROUND-V4-HM-04.md`). Pročitaj OBA fajla u celosti. Pravila rada ista kao do sada. Cilj: trener Plan ≥ 80
i ≥ 8/12 na ≥ 80 bez pada ijednog profila; drugi sudija nijedan plan < 68. Ovo je poslednji krug pre prelaska na
druge distance: sve što ovde postane pravilo motora prepisuje se na 10K/5K/maraton, zato bez posebnih slučajeva.

## Motor
- **M1** Plafon minuta po zoni sa zamenom: kad plafon tempa trke odseče deo, a ostatak je < 15 min → cela doza
  ide u zamenski podražaj (prag pune doze), ne simboličnih 2 × 1 km (p01, p04 ned 15, p09).
- **M2** Zamenski podražaj i izbacivanje praga važe SAMO u nedelji koja ima tempo trke usred nedelje. Nedelja
  bez tempa trke zadržava svoja dva kvaliteta (p05 ned 3, 6, 7, 11: nikad jedan kvalitet u nedelji gradnje za
  nivo koji ima dva).
- **M3** Nivoi i nalazi koji menjaju tekst menjaju i BROJ: `pocetnik-nov`, `dugi-za-distancu`, `kratak-staz`
  stvarno šire raspon / ne računaju napredak (P2 B ≠ P2 A). Test: tekst „širi raspon" ⇒ raspon stvarno širi.
- **M4** Provera forme posle bolesti: pomera se u prvo rasterećenje posle prozora izmene; briše se tek ako
  takvog nema ≥ 3 nedelje pred trku.
- **M5** Najkraće lagano trčanje po nivou (podatak `minEasyMin`); ako dani ne staju — dan manje uz rečenicu (p06).
- **M6** Bez kvaliteta 2 dana pre provere forme ili trke-testa (p01, p02, p04, p05, p09, v2): kvalitet se pomera
  ranije ili otpada; dan pre provere lagano ili odmor.
- **M7 Silazak obima** (podatak `safety.taper`): nedelja −2 ≤ 80 % vršne nedelje u km, nedelja trke (bez trke)
  ≤ 60 %; i dalje ≤ 2 brza treninga u nedelji −2 računato po KALENDARSKOJ nedelji plana (sudija nalazi 3 u p02
  n12, p04 n18, p09 n14, v2 n16 — proveri zašto ih čuvar ne vidi).
- **M8 Upozorenja i objašnjenja slede iz brojeva.** (a) Predlog u upozorenju se računa iz plana („+ X min
  nedeljno daje dugi Y km / vrh Z km") — isti savet ne sme da obećava 1,5 do 10,8 km. (b) Granica se pominje
  samo kad stvarno steže (p05/p06 „22 %"). (c) Zaglavlje prikazuje POSLEDNJU procenu iz koraka „zašto se
  promenilo" — ili koraka nema (s21–s24: bez signala nema koraka procene uopšte). (d) Obrazloženje izmene se
  proverava prema planu (s10 „ionako kraći").
- **M9** Posle bolesti u poslednjih 6 nedelja: poslednji dugi zadržava najmanji blok 15–20 min; prvi dugi posle
  bolesti 60–65 % prethodnog (s05, s06); tempo trke se ne pretvara u lagano ako je van prozora.

## Podaci polumaratona
- **P1** Dugi ≤ vreme trke + 10 min za sporije od 1:55 (p04: ne 2 h 26–2 h 30); blok tempa trke u dugom ≤ 35 min
  za sve sporije od 1:55.
- **P2** Polazni dugi = najduže trčanje poslednje 4 nedelje kad je istorija stabilna (p12, p01, P3 A); 85 %
  samo kad je polazni dugi na plafonu (p08).
- **P3** p04: usponi najviše 2 od 3 nedelje. p03 i spori nivoi: intervali ne brži od tempa na 5 km iz forme.
- **P4** p05/p06 (prag ≈ tempo trke): drugi kvalitet nedelje je I ili brdo ili fartlek, da nedelja nema dva
  ista podražaja; ukupno brzog rada u nedeljama gradnje ≥ 14 %.
- **P5** Kapija dopunjena: M2 (broj kvaliteta u nedelji gradnje po nivou), M6, M7, P1; svi ispisi osveženi.

## Isporuka
`docs/generators-v4/reports/R5-REPORT.md` (≤ 80 redova) + poruka organizatoru. U izveštaju posebno: spisak
pravila koja su sada u motoru kao opšta (za prenos na druge distance) i spisak podataka koje distanca mora da da.
