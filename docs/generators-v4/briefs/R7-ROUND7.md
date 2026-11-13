# Brief R7 — završni krug V4 HM pre drugih distanci, 13. 11. 2026

Polazište: `claude/v4` posle kruga 6 (`96f124c`). Trener: HM zatvoren u celini (Plan 79,3, B 84,7, C 84,0) uz
3 ispravke motora (`coach/ROUND-V4-HM-06.md`). Drugi sudija: planovi 73,3 (10/12 ≥ 70), scenariji 79, parovi 8,0
(`judge2/ROUND-V4-HM-06.md`). Pročitaj OBA fajla. Posle ovog kruga nema nove ocene trenera — proveravam ja i
kapija, zato svaka stavka mora imati test. Sve u motoru je opšte pravilo (prenosi se na 10K/5K/maraton).

## Motor
- **Z1** Povratak dugog + 25 % / + 20 min meri se od poslednjeg STVARNO istrčanog dugog i važi i preko nedelje
  rasterećenja/provere (s14: 70/90 min → 2 h 10 ne sme). U prvobitnom planu bez prekida pravilo ne važi.
- **Z2** Kad provera forme otpadne, zamenski lagan dan ≤ 65 % dugog te nedelje (s14 ned 8, s05 ned 8).
- **Z3** Prvi rad u tempu trke posle bola (uklj. blok u dugom) ≤ 60 % planirane doze (s13: 5–6 km, ne 9).
- **Z4 Prognoza se menja samo sa razlogom i u pravom smeru.** Propušten trening nikad ne ubrzava prognozu
  (s09, s10, s11 −4:13); bolji rezultat je ne usporava (s03); test koji potvrdi formu je ne pomera > 1 % (s24).
  Svaka promena prognoze ima rečenicu „zašto". Opšti test nad svim scenarijima.
- **Z5** Plan „po osećaju" posle odrađenog testa dobija tempa iz testa; upozorenje „nemam tvoj rezultat" nestaje
  čim rezultat postoji (s08, s12, s16, s24).
- **Z6** Pouzdanost „visoka" tek posle dva saglasna rezultata; prva trka u životu: raspon bar ± 2 %.
- **Z7 Upozorenje ne krivi ono što plan sam ograničava.** Predlog „planiraj N nedelja" samo kad je N > stvarne
  dužine i kad bi duža priprema stvarno promenila nalaz (probni plan); inače se imenuje pravi uzrok (obim, broj
  dana). Prag nalaza ima toleranciju zaokruživanja (P2 B 14,8 prema 15 km ne okida). Brojevi u upozorenju su
  brojevi iz plana (p03 „39,8 km", p10 „22 nedelje" uz 20, vlasnik-v1 „treba 16").
- **Z8** Traženi broj dana se poštuje (AGENTS t. 6: sve uz upozorenje): p06 dobija 5 dana; ako je lagan dan
  tada kraći od `minEasyMin`, sme do 30 min uz rečenicu. Nema pretvaranja 5 → 4.
- **Z9** „Vršna nedelja" u tekstu i zaglavlju je nedelja sa najvećim obimom plana (p01, p02, v1, v2).
- **Z10 Više događaja zaredom** — tri nova scenarija: s25 bolest 5 dana pa (10 dana kasnije) propušten dugi;
  s26 bol 4/10 pa neplanirana trka 10 km dve nedelje kasnije; s27 dva propuštena kvaliteta pa pauza zbog puta
  6 dana. Uslov: opšti testovi R1/R2/R5/Z4 prolaze i na njima; prozori se ne sabiraju u rep duži od 4 nedelje.

## Podaci polumaratona
- **Y1** Planovi ≥ 16 nedelja imaju proveru forme na svakih 6–8 nedelja (p04, p08 imaju jednu, 12 nedelja pred
  trku); poslednja najkasnije 3 nedelje pred trku.
- **Y2** p08 (3 dana, 20 nedelja): nedelje nisu ravne 41–47 km — talas gradnja/rasterećenje vidljiv (rasterećenje
  ≤ 85 % prethodne). p04 ned 13–17 nisu kopije. Obično rasterećenje: dugi 70–75 % prethodnog.
- **Y3** Parovi: P2 B dugi ned 1 → 2 najviše + 15 min; P3 A dugi raste od ned 3; P1 A lagani dani ≥ 7 km kad
  istorija to nosi. p06: VDOT 58 sa 5 dana ima dva kvaliteta od ned 3.
- **Y4** Tekst: s10, s11/s12 („plan ostaje isti" pa izmena istog dana), s08 „11. 2..", s04 izmena šest nedelja
  posle događaja.

## Isporuka
Testovi za svaku stavku, kapija zelena, ispisi osveženi (uklj. s25–s27), `reports/R7-REPORT.md` (≤ 80 redova) sa
konačnim spiskom: (a) opšta pravila motora, (b) polja koja folder distance mora da da (šabloni, biblioteka,
`safety`, tekstovi, profili, scenariji, kapija) — to je ulaz za brief 10K. Poruka organizatoru.
