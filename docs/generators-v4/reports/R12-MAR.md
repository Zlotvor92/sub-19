# R12 — maraton tab (podatak), 13. 11. 2026, po Beogradu

Samo `distances/marathon/` i `plans/MAR/` (nalog R12, `briefs/R12.md` § Maraton; ocene `coach/ROUND-V4-MAR-01` D/E,
`judge2/ROUND-V4-MAR-01`). Motor nedirnut; ispisi HM, 10K i 5K bajt-isti. Kapija MAR 0 prekršaja, 19/19.

| stavka | urađeno | broj (pre → posle) |
|---|---|---|
| R1 najduži dugi po vrhu | udeo dugog: ispod 66 km 47 %, 3 najduža 53 %; 66–85 km 44 %; 3 dana 55 %; N−5 drugi najduži (len 0,98) | p01 23 → 25,5 km; p02 25 → 27; p09 27,5 → 27; p11 22,2 → 24,8; p16 26,7; p07 28 → 28,5 |
| R2 spor/mali obim | spor početnik (VDOT < 34) = `pocetnik-nov`: dugi hod-trk po vremenu, bez MP bloka, rasterećenje 2:1 | p13 16,8 km/2 h 06 → 17,9/2 h 20; p18 21,4/2 h 34 → 23,3/2 h 55, bez bloka |
| R3 blok ≤ 45 % dugog | blok N−7/N−5/N−3 = 0,5/0,7/0,85 plafona; plafon brz 55 min, srednji 63 min; kapija i test meri km | p05 17,5/35 (50 %) → 14/35; p17 16/32 → 13/31,5; p07 14/28 → 12,5/28,5 |
| R4 dugi raste talasom | namera od 80 % najdužeg + korak 1,3 km, talas 100/88/100/82 % i na plafonu | p04 2 h 30 × 8 → 21-21-21-22-21-22-23-21-24…; p17 28 × 8 → 28…30-31,5 |
| R5 pripremni polumaraton | plan ≥ 18 ned: N−9 polumaraton (subota, nedelja bez dugog), N−8 bez kvaliteta; `it.fails` M10 (trka na dan dugog) | 13 od 19 planova; s02/s03 sada polumaraton |
| R6 p16 | nivo spor (VDOT < 40) bez intervala (zaseban šablon); najviše 2 brza treninga u nedelji p16 | p16 n9 tri teška → dva |
| sudija 2 | napomena o obući samo na dugom ≥ 2 h 50 (ne na svakom od 2 h 30) | p04 16 → 4 puta |

Testovi maratona: 106 prolaze, 6 `it.fails` (od toga nov: R5/M10), 0 pada. Ceo V4 skup i typecheck: v. poruku.
`target-compare` 18 od 78 (bilo 17). Scenariji: 17 od 29 bez nalaza čuvara; poznati (KNOWN) dopunjeni: s7 i s26
`dugi-za-distancu` (p11 posle događaja), s26 `silazak@22` (M3).

**Zahtevi za motor (nisam radio):**
1. M10 — pripremni polumaraton na dan dugog: sada subotom, a nedelja te nedelje nema dugog.
2. M6 — p16 i dalje dobija `obim-za-nivo` („više brzog rada… do 75 km"). Tekst je u motoru; za 65 god./tegobu ne
   bi trebalo da se javi.
3. M7 — p13 i p19: tempo trke iz današnje forme. `pocetnik-nov` sada nema napredak u prognozi (p13).
4. Pod dugog (`longGrowPastStart`) raste bez talasa, pa je ostao samo povratniku; p05 i p17 zato stoje 2–4 nedelje.

**Otvoreno:**
- p07 28,5 km (trener 30–32): korak 1,3 km i nedelja provere bez dugog u ned 4. Veći korak obara K7 (≤ 2 km).
- p04 je ograničen vremenom (3 h 00 = 26,2 km za spor nivo), plan nosi `kratak-dugi`. Kod 3 dana (p08) talas je
  blag (95 %), jer jači spušta nedelju ispod cilja.
