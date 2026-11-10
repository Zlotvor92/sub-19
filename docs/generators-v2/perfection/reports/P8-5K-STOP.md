# P8-5K — STOP (dopuna G6: višak cilja spušten u cilj)

Ugrađeno: lagan ≤ 0,70 × dugi za plan sa 4+ dana (3 dana 0,80), `lengths.easyCapKm`. Višak cilja koji zato ne staje je
i dalje „planirano < cilj" uz upozorenje (jednom po planu u prikazu, G3) — cilj se NE spušta.

Merenje (iz `web/`: `node <scratchpad>/g6.ts`, mreža `final-check` 5K `all()`, 3 816 planova trčanja): planova čiji je
najveći PLANIRANI obim izgradnje < 0,9 × najveći cilj (= vrh bi pao > 10 % kad bi se višak spustio u cilj):

| grupa | planova | vrh −10 % i više |
|---|---|---|
| R 3 d / F 3 d / R 5 d / B 3 d | 550 / 440 / 550 / 360 | 0 |
| R 4 d / F 4 d | 660 / 528 | 4 / 6 |
| B 4 d | 288 | 30 (10,4 %) |
| **F 5 d** | 440 | **100 (22,7 %)** |

Prag dopune (> 10 % planova grupe) prekoračen u F 5 d i B 4 d. Uzrok: po osećaju je dugi ograničen vremenom (90 min
sporijom granicom E), a lagan ≤ 0,70 × dugi; 5 dana × 0,7 × dugi ne nosi cilj.

Opcije:
- (A) zadržati ovako (cilj ostaje, planirano < cilj, jedno zbirno upozorenje) — ugrađeno privremeno;
- (B) 0,75 za 4+ dana (predlog iz dopune) — nije izmereno;
- (C) spustiti cilj (fitTargetKm sa 0,70) samo kad gubitak vrha ≤ 10 %, inače (A).

Ostalo iz dopune nastavljeno (G3, izveštaj).
