# Brief R6 — krug 6 V4 HM: ponovno planiranje i istinitost teksta, 13. 11. 2026

Polazište: `claude/v4` posle kruga 5 (`d89b059`). Trener: Plan 79,3 (8/12 ≥ 80), zbirna 81,9 — generisanje
zatvoreno (`coach/ROUND-V4-HM-05.md`). Drugi sudija: planovi 69,7, scenariji 79 → 72,9 (s09 = 3, s12 = 5),
parovi 6,3 (`judge2/ROUND-V4-HM-05.md`). Pročitaj OBA fajla u celosti. Ovaj krug NE dira oblik novog plana
(p01–p12 otisci ostaju isti osim gde stavka to izričito traži); popravlja `replan`, događaje i tekst. Sve je
pravilo motora (prenosi se na druge distance) — bez posebnih slučajeva. Pravila rada ista.

## Motor — ponovno planiranje
- **R1 Propušten trening ne kvari ostatak.** Propušten dugi/kvalitet: nadoknada najviše u naredne 2 nedelje i
  nikad na račun sledećeg dugog; nedelje sužavanja (poslednje 2) se ne diraju. s09: sledeći dugi ne sme pasti
  (15 → 6 km je greška); s12: 0 izmena u ned 14–15. Opšti test nad svim scenarijima: posle bilo kog događaja
  nijedan dugi van prozora izmene nije kraći od prvobitnog i nijedna nedelja van prozora nije manja.
- **R2 Povratak bez skoka.** Posle prozora izmene prelaz na prvobitan plan: dugi sme da poraste najviše + 25 %
  ili + 20 min u odnosu na prethodni dugi, nedelja najviše + 20 %; ako prvobitan plan traži više, prozor se
  produžava nedelju po nedelju dok skok ne stane u granicu (s14, s15, s16, s06 25 → 42 → 64 km). Prvi dugi
  posle bolesti = 60–65 % poslednjeg dugog pre bolesti (s05 ≈ 11–12 km, ne 8,5).
- **R3 Ključni trening se ne briše van prozora.** Blok tempa trke u ključnom dugom (s06 N17) ostaje ako je
  nedelja van prozora; unutar prozora se smanjuje, ne briše, osim u rampi.
- **R4 Odrađena provera/trka je rezultat.** Kad je provera odrađena ili rezultat unet: forma se računa iz
  njega, tekst ne kaže „prvi rezultat koji imam" (s02, s04, s17, s19). Neplanirana trka/provera uklanja
  kvalitet ili test zakazan istog i narednog dana (s02, s03).
- **R5 Tekst ne zastareva.** Nijedna rečenica u zaglavlju ne pominje radnju sa datumom u prošlosti („odradi
  proveru 28. 11." posle tog datuma — s08, s12, s16, s24). „Oporavak do X" ⇒ prvi brzi trening je posle X
  (s17, s18, s20). Test nad svim scenarijima.
- **R6 Rep posle propuštenog treninga** ne menja lagane dane za ± 5 min niti povećava dugi u nedelji −2 (s12).

## Motor / podaci — istinitost
- **T1** Poređenje prognoza u tekstu ima ispravan smer („bolja/sporija" izvedeno iz brojeva; P2 B).
- **T2** Predlog dužine pripreme je jedan broj u celom planu i nikad kraći od stvarne pripreme („bar 16
  nedelja" kad ih je 20; drugo upozorenje kaže 26).
- **T3** „Nemam trčanja sa sata" samo kad ih stvarno nema (P1 B ima 18) — bilo je traženo u R4, proveri izlaz.
- **T4** Upozorenje ne obećava ono što plan ne radi: p06 traži 5 dana, plan ima 4 — ili plan ima 5, ili tekst
  kaže zašto je 4 i ne pominje dodavanje dana. Predlog dodatnog dana ≥ 30 min. p06 predlog obima glasi „za
  sledeću pripremu" kad nije dostižan u ovoj.
- **T5** Opis dana trke iz očekivanog vremena trkača (p10, p12: ne „sat i po do dva" za 2:01–2:10).
- **T6** p08: vršna nedelja ne sme biti ispod polaznog obima (44,3 < 45); p04: N15 ≠ N17 i zamenski prag menja
  oblik (3 × 12 → 2 × 18 → 30 min; isto p07 ned 5, 7, 8); nedelja −2 nosi tempo trke, ne intervale (p05 N14).
- **T7** P3 B polazni dugi iz poslednje 4 nedelje; p06 ned 1–2 jedan kvalitet pune doze.

## Isporuka
Testovi (novi opšti nad svih 24 scenarija za R1, R2, R5), kapija zelena, svi ispisi osveženi,
`docs/generators-v4/reports/R6-REPORT.md` (≤ 80 redova): tabela po scenariju (broj izmena krug 5 → 6, najveći
skok dugog i nedelje posle prozora), spisak profila kojima se otisak promenio i zašto. Poruka organizatoru.
