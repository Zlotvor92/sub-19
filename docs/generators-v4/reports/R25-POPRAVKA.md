# R25-POPRAVKA — upozorenja u zaglavlju (izveštaj)

Polazno stanje `f70d9fb9`, grana `claude/v4`, 15. 11. 2026. (Beograd). Sve stavke: svojstvo u
`web/src/domain/v4/distances/header25.test.ts` nad sve četiri distance — profili × (0/3/4/5 dana) × (kako jeste /
početnik: 5 nedelja staža, tegoba, 10 km nedeljno) × (kako jeste / 8 nedelja pripreme) + scenariji. Svako svojstvo je
bilo crveno na sve četiri distance pre izmene.

| # | SHA | Svojstvo (header25) | Menjano |
|---|-----|---------------------|---------|
| 1 | `113e9ac2` | (1) tegoba/bol, prvi predlog kraće distance, `kratak-staz` i `cilj-van-raspona` su uvek stavka | `render.ts` |
| 2 | `1da9ba8d` | (2) nijedan deo „Pomoglo bi i" ne počinje upućivanjem („te nedelje …") | `render.ts` |
| 3 | `e523de52` | (3) svako upozorenje ima neprazan problem, posledicu i predlog | `guard.ts` |
| 4 | `9d8061c4` | (4) „vršna" = nedelja najvećeg opterećenja pre sužavanja (≥ 99 % najvećeg → kasnija) | `render.ts` |

**1.** Granica od tri stavke važi samo za ostala upozorenja: bezbednost i predlog kraće distance idu prvi, staž i cilj
van raspona ostaju (mesto po prvenstvu). Ako ih je tri ili više, nema mesta za druge; višak ide u „Pomoglo bi i".
Ispis: **10K, HM, MAR P2 B** (vraćeni su „trči polumaraton/kraću distancu" i stavka o stažu; MAR P2 B ima i najduži
dugi), **MAR P1 B** (vraćena je stavka „cilj 3:27:30 van raspona").

**2.** Kad rečenica iz viška upućuje na problem svoje stavke (Te/Ove/Tog/Taj … na početku), ispred nje ide taj problem
(„tražio si 4 dana …, a plan u nekim nedeljama (nedelje 5, 8) ima 3 treninga: te nedelje trči kako piše …"). Uzgred:
tačka posle datuma („26. 11.") se više ne briše. Ispis: **10K, HM, MAR P2 B**.

**3.** `rankProposals` (R20 B6) više ne prazni predloge i ne spaja ih u tuđe upozorenje. Svako upozorenje nosi svoj
predlog (i u čarobnjaku pre generisanja), a sažima samo ispis zaglavlja (stavka 1). `malo-dana`, `kratak-dugi`,
`kratak-staz` i `cilj-van-raspona` imaju predlog i u primeru iz naloga (maraton, početnik, 8 nedelja, 10 km).
Usklađena stara tvrdnja: `marathon.test.ts` K3 („najviše dva predloga" → „svako ima svoj predlog"). Ispis:
**MAR p13, p19, P1 B, P2 B; 10K i HM P2 B**.

**4.** Mera je opterećenje (jedna mera, t. 5), ne km. Ne računaju se nedelja trke, sužavanje ni kasna gradnja koja se
ispisuje kao sužavanje. Usklađena stara tvrdnja: `hm/r5.test.ts` Z9 (jedna oznaka, obim ≥ 90 % najvećeg). Ispis:
promenjena je samo oznaka u 87 fajlova, u svakom i dalje tačno jedna. Nalazi trenera: **5K p02 2. → 5.**, **10K p10
14. → 15.**, **10K p11 13. → 15.** Uglavnom se oznaka pomera na 3. nedelju pred trku (97 nedelja), ređe na 5.
Promena je i u **HM vlasnik-v1**, samo oznaka (5. → 7.).

**Dani bajt-isti.** Posle svake stavke svi ispisi (`render`, `pairs`, `scenarios` × 4 distance) poređeni su sa
polaznim. Sve linije od „1. NEDELJA" nadalje su iste, osim naslova nedelja; naslovi se razlikuju samo u oznaci (st. 4).
Kod treninga, šablona i biblioteka nije diran, a motor ne grana po distanci.

**Provere.** `npx vitest run src/domain/v4 src/integrations/v4` posle svake stavke; posle st. 4: 87 fajlova,
1377 prolazi + 12 očekivano pada. `npm run check`: čist — 400 fajlova, 4854 prolazi + 12 očekivano pada.
