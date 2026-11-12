# Ponovno planiranje posle 7 dana pauze

Sintetička distanca (probna trka 8 km) — dokaz da motor radi bez prave distance; brojevi podataka su ilustrativni.
Ulaz: plan 01; nedelje 1–4 odrađene po planu, bolest 14–20. 12. 2026; danas 20. 12. 2026. `replan(doc, state, deriveEvents(doc, state), data)` → spisak promena je u odeljku PROMENE.
Ispis: `renderPlan(doc, state, data, { showLoad: true })` — deo „opterećenje … BO" u zbirnom redu vidi samo sudija.

```text
PLAN: probna trka 8 km, trka 24. 1. 2027.
Početak 16. 11. 2026. · 10 nedelja · 4 dana trčanja nedeljno

FORMA
Polazna forma (15. 11.): 36:00
Današnja prognoza (20. 12.): 36:00, pouzdanost srednja
Očekivano na dan trke: 35:51 (raspon 35:25–36:21) — 0:09 brže od današnje prognoze, jer plan do trke podiže obim i dodaje rad u tempu trke

TEMPA
- lagano 5:36–6:10/km
- umereno 5:02/km
- prag 4:40/km
- tempo trke 4:30/km
- intervali 4:18/km
- brze deonice 4:03/km

PROMENE
Pauza zbog bolesti trajala je 7 dana (14–20. 12.), pa je povratak postepen: prvih 11 dana posle nje treninzi su kraći i lagani, bez brzih deonica; od 1. 1. plan se nastavlja kako je bio.
- uto 22. 12.: lagano 4 km + 4 × 20 s ubrzanja → lagano 3,5 km
- čet 24. 12.: uzbrdo 9 × 1:30 min, oporavak 2 min hod → lagano 5,5 km
- sub 26. 12.: lagano 4 km → odmor
- ned 27. 12.: dugi 14 km, poslednjih 3 km u tempu trke → dugi 11 km
- uto 29. 12.: lagano 6 km + 4 × 20 s ubrzanja → lagano 5 km + 4 × 20 s ubrzanja
Pauza zbog bolesti trajala je 7 dana (14–20. 12.); posle povratka obim raste postepeno od onoga što je stvarno odrađeno, a prvi brzi trening svake vrste je kraći — zato su treninzi do 10. 1. lakši nego što su bili.
- sub 2. 1.: lagano 6 km → odmor
- ned 3. 1.: dugi 15 km → dugi 12,5 km
- uto 5. 1.: lagano 4 km + 4 × 20 s ubrzanja → odmor
- čet 7. 1.: tempo trke 4 × 1 km, oporavak 1:30 min džog → tempo trke 3 × 1 km, oporavak 1:30 min džog
- sub 9. 1.: lagano 4 km → odmor
- ned 10. 1.: dugi 15 km, poslednjih 4 km u tempu trke → dugi 14 km, poslednjih 3,5 km u tempu trke
- 6. nedelja: 32,2 km → 20 km
- 7. nedelja: 35,7 km → 26,2 km
- 8. nedelja: 33 km → 21,7 km

1. NEDELJA (od 16. 11.) — osnovna faza, gradnja; do trke 9 nedelja
  pon 16. 11.  odmor
  uto 17. 11.  lagano 5,5 km + 4 × 20 s ubrzanja — 6,5 km, 38 min · lagano 5:36–6:10/km · brze deonice 4:03/km
  sre 18. 11.  odmor
  čet 19. 11.  prag 2 × 7 min, oporavak 1:30 min džog — 7,5 km, 41 min · lagano 5:36–6:10/km · prag 4:40/km
  pet 20. 11.  odmor
  sub 21. 11.  lagano 5,5 km — 5,5 km, 32 min · lagano 5:36–6:10/km
  ned 22. 11.  dugi 9,5 km — 9,5 km, 56 min · lagano 5:36–6:10/km
  Zbir: 29 km, 2 h 46 min, 4 treninga, brz rad 8 %, opterećenje 183 BO (cilj 183)

2. NEDELJA (od 23. 11.) — osnovna faza, gradnja; do trke 8 nedelja
  pon 23. 11.  odmor
  uto 24. 11.  lagano 6 km + 4 × 20 s ubrzanja — 7 km, 41 min · lagano 5:36–6:10/km · brze deonice 4:03/km
  sre 25. 11.  odmor
  čet 26. 11.  prag 16 min u komadu — 7,7 km, 41 min · lagano 5:36–6:10/km · prag 4:40/km
  pet 27. 11.  odmor
  sub 28. 11.  lagano 6 km — 6 km, 35 min · lagano 5:36–6:10/km
  ned 29. 11.  dugi 11 km — 11 km, 65 min · lagano 5:36–6:10/km
  Zbir: 31,7 km, 3 h 1 min, 4 treninga, brz rad 9 %, opterećenje 200 BO (cilj 197)

3. NEDELJA (od 30. 11.) — osnovna faza, gradnja; do trke 7 nedelja
  pon 30. 11.  odmor
  uto 1. 12.  lagano 5 km + 4 × 20 s ubrzanja — 6 km, 35 min · lagano 5:36–6:10/km · brze deonice 4:03/km
  sre 2. 12.  odmor
  čet 3. 12.  intervali 3 × 1 km, oporavak 2:30 min džog — 8,1 km, 43 min · lagano 5:36–6:10/km · intervali 4:18/km
  pet 4. 12.  odmor
  sub 5. 12.  lagano 5 km — 5 km, 29 min · lagano 5:36–6:10/km
  ned 6. 12.  dugi 12,5 km — 12,5 km, 73 min · lagano 5:36–6:10/km
  Zbir: 31,6 km, 3 h, 4 treninga, brz rad 7 %, opterećenje 209 BO (cilj 211)

4. NEDELJA (od 7. 12.) — osnovna faza, rasterećenje; do trke 6 nedelja
  pon 7. 12.  odmor
  uto 8. 12.  lagano 4,5 km + 4 × 20 s ubrzanja — 5,5 km, 32 min · lagano 5:36–6:10/km · brze deonice 4:03/km
  sre 9. 12.  odmor
  čet 10. 12.  uzbrdo 5 × 1:30 min, oporavak 2 min hod — 6,9 km, 41 min · lagano 5:36–6:10/km · intervali 4:18/km
  pet 11. 12.  odmor
  sub 12. 12.  lagano 4,5 km — 4,5 km, 26 min · lagano 5:36–6:10/km
  ned 13. 12.  dugi 10 km — 10 km, 59 min · lagano 5:36–6:10/km
  Zbir: 26,9 km, 2 h 37 min, 4 treninga, brz rad 5 %, opterećenje 171 BO (cilj 169)

5. NEDELJA (od 14. 12.) — posebna faza, gradnja; do trke 5 nedelja
  pon 14. 12.  odmor
  uto 15. 12.  lagano 6 km + 4 × 20 s ubrzanja — 7 km, 41 min · lagano 5:36–6:10/km · brze deonice 4:03/km
  sre 16. 12.  odmor
  čet 17. 12.  tempo trke 3 × 1 km, oporavak 1:30 min džog — 7,7 km, 42 min · lagano 5:36–6:10/km · tempo trke 4:30/km
  pet 18. 12.  odmor
  sub 19. 12.  lagano 6 km — 6 km, 35 min · lagano 5:36–6:10/km
  ned 20. 12.  dugi 12,5 km — 12,5 km, 73 min · lagano 5:36–6:10/km
  Zbir: 33,2 km, 3 h 11 min, 4 treninga, brz rad 7 %, opterećenje 212 BO (cilj 211)

6. NEDELJA (od 21. 12.) — posebna faza, gradnja; do trke 4 nedelje
  pon 21. 12.  odmor
  uto 22. 12.  lagano 3,5 km — 3,5 km, 21 min · lagano 5:36–6:10/km
  sre 23. 12.  odmor
  čet 24. 12.  lagano 5,5 km — 5,5 km, 32 min · lagano 5:36–6:10/km
  pet 25. 12.  odmor
  sub 26. 12.  odmor
  ned 27. 12.  dugi 11 km — 11 km, 65 min · lagano 5:36–6:10/km
  Zbir: 20 km, 1 h 57 min, 3 treninga, brz rad 0 %, opterećenje 117 BO (cilj 213)

7. NEDELJA (od 28. 12.) — posebna faza, gradnja; do trke 3 nedelje
  pon 28. 12.  odmor
  uto 29. 12.  lagano 5 km + 4 × 20 s ubrzanja — 6 km, 35 min · lagano 5:36–6:10/km · brze deonice 4:03/km
  sre 30. 12.  odmor
  čet 31. 12.  tempo trke 3 × 1 km, oporavak 1:30 min džog — 7,7 km, 42 min · lagano 5:36–6:10/km · tempo trke 4:30/km
  pet 1. 1.  odmor
  sub 2. 1.  odmor
  ned 3. 1.  dugi 12,5 km — 12,5 km, 73 min · lagano 5:36–6:10/km
  Zbir: 26,2 km, 2 h 30 min, 3 treninga, brz rad 9 %, opterećenje 171 BO (cilj 174)

8. NEDELJA (od 4. 1.) — završna faza, vršna nedelja; do trke 2 nedelje
  pon 4. 1.  odmor
  uto 5. 1.  odmor
  sre 6. 1.  odmor
  čet 7. 1.  tempo trke 3 × 1 km, oporavak 1:30 min džog — 7,7 km, 42 min · lagano 5:36–6:10/km · tempo trke 4:30/km
  pet 8. 1.  odmor
  sub 9. 1.  odmor
  ned 10. 1.  dugi 14 km, poslednjih 3,5 km u tempu trke — 14 km, 77 min · lagano 5:36–6:10/km · tempo trke 4:30/km
  Zbir: 21,7 km, 1 h 59 min, 2 treninga, brz rad 25 %, opterećenje 160 BO (cilj 188)

9. NEDELJA (od 11. 1.) — završna faza, sužavanje pred trku; do trke 1 nedelja
  pon 11. 1.  odmor
  uto 12. 1.  lagano 5 km + 4 × 20 s ubrzanja — 6 km, 35 min · lagano 5:36–6:10/km · brze deonice 4:03/km
  sre 13. 1.  odmor
  čet 14. 1.  tempo trke 2 × 1 km, oporavak 1:30 min džog — 6,5 km, 36 min · lagano 5:36–6:10/km · tempo trke 4:30/km
  pet 15. 1.  odmor
  sub 16. 1.  lagano 5 km — 5 km, 29 min · lagano 5:36–6:10/km
  ned 17. 1.  dugi 9,5 km — 9,5 km, 56 min · lagano 5:36–6:10/km
  Zbir: 27 km, 2 h 35 min, 4 treninga, brz rad 6 %, opterećenje 171 BO (cilj 169)

10. NEDELJA (od 18. 1.) — završna faza, nedelja trke; nedelja trke
  pon 18. 1.  odmor
  uto 19. 1.  lagano 5 km + 4 × 20 s ubrzanja — 6 km, 35 min · lagano 5:36–6:10/km · brze deonice 4:03/km
  sre 20. 1.  odmor
  čet 21. 1.  lagano 5 km — 5 km, 29 min · lagano 5:36–6:10/km
  pet 22. 1.  odmor
  sub 23. 1.  lagano 3,5 km — 3,5 km, 21 min · lagano 5:36–6:10/km
  ned 24. 1.  TRKA: probna trka 8 km
  Zbir: 14,5 km, 85 min, 3 treninga, brz rad 0 %, opterećenje 87 BO (cilj 94)
```
