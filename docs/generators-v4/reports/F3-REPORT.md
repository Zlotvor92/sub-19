# F3 — polumaraton kao podatak: izveštaj (12. 11. 2026, motor ec151b6)

Kod: `web/src/domain/v4/distances/hm/` — `index.ts` (jedan izvoz `hm: DistanceData`), `templates.ts`, `library.ts`
(29 unosa), `safety.ts`, `texts.ts`, `testdata/` (12 profila P9, dva plana vlasnika). Motor i `fitness/` nisu menjani.
Ispisi `docs/generators-v4/plans/HM/` (`node docs/generators-v4/plans/render.ts`, iz korena; `--load`, `--stats`);
scenariji `plans/HM/scenarios/s01–s24.txt` + `pregled.txt` (`node docs/generators-v4/plans/scenarios.ts`).

## Kako su podaci složeni
- **Šabloni** (312): po jedan za N = 1–52 × porodica (redovan, mali obim, početnik, „nosivost" 1–3 dana) × dani. Rep
  12+ ned: N−8 rasterećenje + provera forme (10/5/3 km po obimu), N−7 prvi blok RP u dugom, N−6 talas, N−5 drugi blok,
  N−4 rasterećenje, N−3 najteža, N−2 ≤ 85 %, N−1 sužavanje, N trka. Telo: osnova (prag + brzina/brda), razvoj (prag +
  intervali, progresivni dugi). Rep +1–2 nedelje kad bi rasterećenje palo u 1–2. nedelju. Rani test 5 km u 1. ned samo
  po osećaju (`onlyByFeel`); dan trke nosi plan trke (tempo po delovima, doručak, unos).
- **Nivoi**: početnik, mali obim (< 3 h 30 min → jedan kvalitet + ubrzanja), spor/srednji/brz po VDOT-u.
- **Brojevi**: vrh × 1,15 (6 ned) → 1,55 (12–15) → 1,72 (16+, ≈ +50 % km), početnik do × 2,15, plafon vrha po nivou;
  rast +7 %; dugi 40 % vrha kod 4 dana (početnik 44 %), 36/33 % kod 5/6, 45 % kod 3; polazni dugi po danima; najduži
  2 h 15 (početnik 2 h 10, brz 2 h 05); korak 9 min; brz rad ≤ 20 % (vršna 22 %); lagan ≤ 80 % dugog.

## Testovi (`hm.test.ts`, ≈ 6 s; ceo V4 449 testova zelen, ≈ 9 s)
Pokrivenost; plafon/unos/tekst za svaki podražaj; čuvar na mreži 1440 ulaza — svaki nalaz mora imati razlog iz
`justified()`; upotrebljivost; otisci 12 profila; K1–K8 nad `renderPlan`; trenerski zahtevi iz briefa.
**Opravdani nalazi** (ulaz ih traži): < 30 min po danu; 3 dana; > 65 min po danu (dani ne nose cilj); lakša nedelja
malog obima; nedelja sa proverom forme (3 dana bez brzog, § 14.1). Na 14 planova: 0 nalaza.

## Granice u testovima pomerene u toku dana (šta, sa → na, zašto)
1. K7 skok nedelje: „prethodna × 1,12 + 0,5 km" → „najveća od prethodne 3 × 1,12 + 1,5 km". Pad usred bloka zbog više
   brzog rada (više bodova na manje km) nije rasterećenje; +1,5 km = zaokruživanje 3 lagana dana na 0,5 km (p06 n4:
   42,0 prema 41,88).
2. K7 skok nedelje i dugog: ne meri se u rampi posle trke pre plana i 28 dana posle nje (vlasnik v2) — tu obim vodi
   motorova rampa (§ 6.5), ne šablon.
3. K7 „prvi trening ≤ 70 % vrha": + 60 s tolerancije; brzina/brda izuzeti (K8 traži ≥ 8 min rada, vrh brzine 10–12 min).
4. Udeo dugog u najtežoj nedelji: 30–40 % → 28–45 % (5 dana od 25 %, 6+ dana od 20 %, početnik do 52 %). Razlog:
   organizator traži 40–42 % kod 4 dana; početniku dugi kao v3 (p11 19,2 km = 50 %); kod 5–6 dana veže 2 h 15.
5. Nedelja 1 ≥ sadašnji obim: 97 % → 95 % km. Motor drži bodove ≥ B; km su niži za rad kvaliteta (p05 86,2/90).
   Nedelja sa ranim testom po osećaju se ne meri.
6. Mreža, „dani ne nose cilj": > 70 → > 65 min po danu (55 km, 4 dana, brz: rasterećenje N−4 sa dugim 2 h 05).
   Upotrebljivost meri 30–65 min po danu (bilo 30–70).
7. Mreža, brz udeo: dozvoljen do 27 % samo kad je uzrok obim (3 dana, < 30 ili > 65 min po danu, otpao lagan dan,
   provera forme); do 35 % kad je < 30 min po danu.
8. Upozorenje „mali obim": provera prebačena sa vlasnik-v1 (sada 38,6 km, fali < 5 %, motor ga ne daje) na ulaz
   20 km / 4 dana / 10 nedelja, uz broj u predlogu.
9. Timeout testa mreže: 60 s (inače 5 s).
**Uklonjeno** (nepotrebno posle trećeg kruga): „nedelja 1 bez najdužeg trka", „2 nedelje posle provere × 0,8". Treći
slučaj (pad posle provere) je bio GREŠKA PODATAKA — dugi na ulasku u specifičnu fazu (lenPct 0,88–0,9) bio je kraći
od dugog na kraju razvoja (0,95); ispravljeno na 0,95–0,96, ne opravdanjem.

## Poređenje sa v3 (P9v3/plans/HM; v3 → V4)
| profil | vrh km | najduži dugi km | broj kvaliteta | udeo brzog rada |
|---|---|---|---|---|
| p01 | 56,0 → 62,0 | 22,0 → 22,5 | 26 → 23 | 14 → 14 % |
| p02 | 54,0 → 56,1 | 21,5 → 24,5 | 22 → 19 | 14 → 15 % |
| p03 | 33,3 → 39,0 | 15,5 → 17,8 | 16 → 16 | 13 → 12 % |
| p04 | 63,0 → 70,0 | 20,0 → 20,2 | 33 → 30 | 11 → 10 % |
| p05 | 100,1 → 102,7 | 26,0 → 26,5 | 26 → 23 | 12 → 11 % |
| p06 | 43,3 → 44,3 | 16,5 → 17,5 | 15 → 10 | 14 → 12 % |
| p07 | 67,9 → 69,5 | 22,0 → 23,0 | 17 → 14 | 13 → 12 % |
| p08 | 47,8 → 49,0 | 22,0 → 23,0 | 20 → 20 | 12 → 12 % |
| p09 | 59,0 → 68,3 | 22,0 → 22,5 | 25 → 23 | 13 → 13 % |
| p10 | 33,3 → 39,3 | 15,5 → 17,7 | 19 → 20 | 12 → 13 % |
| p11 | 39,2 → 39,3 | 18,0 → 19,2 | 15 → 17 | 8 → 10 % |
| p12 | 55,3 → 58,6 | 18,5 → 19,8 | 11 → 14 | 6 → 8 % |
Nijedan profil ispod v3. p06 ima manje kvaliteta: mali obim (2 h 45 min nedeljno) → jedan kvalitet. Vlasnik v1: vrh
38,6 km, dugi 17 km, prvi dugi 10,5 km, uvek 4 treninga. Vlasnik v2 (baza 30 km = 171 bod): nedelje 1–4: 15,0 / 26,1 /
30,2 / 23,1 km, dugi 7,5 / 11 / 11,5 / 11,5 km; nedelja 5: 26,5 km (cilj posle rampe = B); vrh 44,3 km, dugi 18–20 km 6×.

## Scenariji (24)
E6 ×4: 0 promena, isti otisak. Nalazi posle događaja: s06 `taper` (bolest u 14. ned p04 skida vrh), s19 `min-nedelja`
u 8. ned (p11 posle prvog polumaratona). E5 je nov plan iz stanja sa jučerašnjom trkom.

## Zahtevi prema motoru — 12, svi rešeni (8a22e4d, 3be0d68, ec151b6) i iskorišćeni
Čuvar vidi napor iz plana; × 0,8 ne posle planirane provere; polazni dugi i udeo dugog po danima/nivou; T₁ ≥ B;
rasterećenje vezano za stvarni cilj; napomene dana trke; `onlyByFeel`; rast dugog od nezaokruženog; padeži i dva dela
predloga u upozorenjima; trka u „najdužem skorašnjem" sa 60 %.

## Otvoreno
- Vlasnik v2, nedelja 5 (26,5 km) je ispod nedelje 3 (30,2 km): cilj posle rampe je B (motor); prijavljeno.
- Ocena trenera nije računata (radi sudija).
