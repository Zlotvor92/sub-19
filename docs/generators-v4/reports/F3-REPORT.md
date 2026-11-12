# F3 — polumaraton kao podatak: izveštaj (12. 11. 2026)

Kod: `web/src/domain/v4/distances/hm/` — `index.ts` (jedan izvoz `hm: DistanceData`), `templates.ts`, `library.ts`
(29 unosa), `safety.ts` (nivoi, brojevi bezbednosti, adekvatna priprema), `texts.ts` (tekstovi + napomene), `testdata/`
(12 profila P9 i dva plana vlasnika). Motor i `fitness/` nisu menjani; uvozi samo tipove i javni izvoz motora.
Ispisi: `docs/generators-v4/plans/HM/p01–p12.txt`, `vlasnik-v1.txt`, `vlasnik-v2.txt` — `node docs/generators-v4/plans/render.ts`
(iz korena; `--load` dodaje bodove, `--stats` nalaze čuvara). Scenariji: `plans/HM/scenarios/s01–s24.txt` + `pregled.txt`
— `node docs/generators-v4/plans/scenarios.ts`.

## Kako su podaci složeni
- **Šabloni**: jedan po broju nedelja (1–52) × porodica (redovan, mali obim, početnik, „nosivost" za 1–3 dana) × dani
  (1–3, 4–7) = 312. Razlikuju se samo po množiocu vrha (`startPct`) i dužini repa. Rep 12+ nedelja: N−8 rasterećenje +
  provera forme (10 km / 5 km / 3 km po obimu i formi), N−7 prvi blok RP u dugom, N−6 talas (RP + prag), N−5 drugi blok,
  N−4 rasterećenje, N−3 najteža nedelja, N−2 ≤ 85 %, N−1 sužavanje, N trka. Telo: osnova (prag + brzina/brda), razvoj
  (prag + intervali, progresivni dugi). Rep se produžava za 1–2 nedelje razvoja da rasterećenje (brojano od repa)
  nikad ne padne u 1. ili 2. nedelju. 8–11 nedelja: bez provere i prvog bloka; 1–7: održavanje + najteža + sužavanje.
- **Nivoi**: početnik, mali obim (< 3 h 30 min nedeljno → jedan kvalitet + ubrzanja, kao v3 ispod 25 km), spor/srednji/
  brz po VDOT-u. Posle trećeg kruga motora nivoi „obiman" (zaobilaznica) su uklonjeni. Rani test (5 km) u 1. nedelji
  samo kad su tempa po osećaju (`onlyByFeel`); dan trke nosi plan trke (raspored tempa, doručak, unos).
- **Brojevi**: vrh × 1,15 (6 ned) → × 1,55 (12+), početnik do × 2,15; rast +7 % (bodovi); dugi 40 % vrha kod 4 dana,
  36 % kod 5, 33 % kod 6, 45 % kod 3 (početnik 44 % kod 4 dana); polazni dugi po danima (31 % kod 4); najduži dugi 2 h 15 (početnik 2 h 10, brz 2 h 05); korak 9 min; brz rad
  ≤ 20 % (vršna 22 %); lagan ≤ 80 % dugog, dan pred dugi ≤ 70 %; prvi trening praga/intervala/RP ≤ 70 % vrha (K7).

## Testovi (`hm.test.ts`, projekat `domain`, ≈ 5 s; ceo V4 421 test zelen)
Pokrivenost (svaki nivo × 1–52 × 1–7); svaki podražaj ima plafon, unos i tekst; čuvar na mreži 1440 ulaza (dani 3–6 ×
nedelje 6–24 × 15–80 km × forma 1:25–2:30 × početnik) — svaki nalaz mora imati razlog iz `justified()`; upotrebljivost
(nema treninga < 20 min osim dana pred trku, lagan ≤ dugi, nedelja ≥ 50 % sadašnje); otisci 12 profila
(`__fixtures__/pNN.otisak.txt`); K1–K8 nad `renderPlan`; trenerski zahtevi iz briefa (nedelja 1 ≥ 97 % sadašnjeg obima,
najteža 2–3 pred trku i sledeća ≤ 85 %, taper 2 nedelje, blok RP raste, upozorenja za mali obim i 3 dana).
**Opravdani nalazi čuvara** (ulaz ih traži): < 30 min po danu; 3 dana (`ispod-cilja`, `min-nedelja`, `brz-udeo` ≤ 27 %);
> 70 min po danu (dani ne nose cilj); lakša nedelja malog obima; nedelja 1 bez podatka o najdužem trku (3–4 dana);
nedelja sa proverom forme i 2 nedelje posle nje (zahtevi 1 i 2). Na 12 profila ostaje samo to (p03, p05, p08, p10).
K7 „prvi trening ≤ 70 % vrha" ne važi za brzinu/brda: K8 traži ≥ 8 min rada, a vrh brzine je 10–12 min.

## Poređenje sa v3 (P9v3/plans/HM; v3 → V4)
| profil | vrh km | najduži dugi km | broj kvaliteta | udeo brzog rada (ceo plan) |
|---|---|---|---|---|
| p01 | 56,0 → 56,0 | 22,0 → 22,5 | 26 → 22 | 14 → 14 % |
| p02 | 54,0 → 56,1 | 21,5 → 24,5 | 22 → 19 | 14 → 15 % |
| p03 | 33,3 → 35,6 | 15,5 → 18,2 | 16 → 16 | 13 → 12 % |
| p04 | 63,0 → 70,0 | 20,0 → 20,2 | 33 → 30 | 11 → 10 % |
| p05 | 100,1 → 102,7 | 26,0 → 26,5 | 26 → 23 | 12 → 10 % |
| p06 | 43,3 → 44,3 | 16,5 → 17,5 | 15 → 10 | 14 → 12 % |
| p07 | 67,9 → 69,5 | 22,0 → 23,0 | 17 → 14 | 13 → 12 % |
| p08 | 47,8 → 49,0 | 22,0 → 23,0 | 20 → 20 | 12 → 12 % |
| p09 | 59,0 → 63,2 | 22,0 → 22,5 | 25 → 23 | 13 → 13 % |
| p10 | 33,3 → 35,5 | 15,5 → 18,0 | 19 → 20 | 12 → 13 % |
| p11 | 39,2 → 39,3 | 18,0 → 19,2 | 15 → 17 | 8 → 10 % |
| p12 | 55,3 → 58,6 | 18,5 → 19,8 | 11 → 14 | 6 → 8 % |
Posle četvrtog kruga motora nijedan profil nije ispod v3 ni po vrhu ni po najdužem dugom. p06 ima manje kvaliteta jer
je mali obim (35 km za 2 h 45 min nedeljno) — jedan kvalitet. Vlasnik v1: vrh 38,6 km, najduži dugi 16 km (+ 15,5 u 5. ned), prvi dugi
10,5 km, uvek 4 treninga, gradnja ne pada. Vlasnik v2: dugi 19–21 km 6 puta, vrh 49,3 km.

## Scenariji (24, `plans/HM/scenarios/`)
Svi daju plan; E6 (4 profila): 0 promena i isti otisak. Nalazi čuvara posle događaja: s06 `taper` (bolest u 14. ned
p04 skida vrh, pa sužavanje ima više rada od nove „najteže"), s09/s11/s13 `dugi-korak` (motor meri korak od skraćenog
dugog), s18/s19 `ispod-cilja` (početak posle trke). E5 je nov plan iz stanja sa jučerašnjom trkom (nema `replan`).

## Zahtevi prema motoru (1–8 rešeni u trećem krugu 8a22e4d, 9–12 u četvrtom 3be0d68; svi iskorišćeni)
1. Čuvar ne vidi rampu posle testa iz plana → lažno `ispod-cilja` u nedelji provere.
2. „Prvi kvalitet posle rampe × 0,8" (14 dana) važi i posle PLANIRANE provere forme — smanjuje blok/RP i ruši nedelju.
3. `longStartShare` po broju dana; L₀ je i pod pravila koraka, pa veći L₀ dozvoljava skok dugog na prelazu faza.
4. Udeo dugog po nivou (početnik ≈ 45 %, v3) — p11.
5. Kad plafon vrha nivoa veže, nedelja 1 pada ispod sadašnjeg obima (`T₁ ≥ B`) — sada nivoi „obiman".
6. Rasterećenje = namera × faktor ne vidi da je prethodna nedelja bila ograničena pravilom rasta.
7. Dan trke nema napomene (tempo po delovima, unos) — ispis piše samo „TRKA: polumaraton".
8. Nema uslova „samo kad su tempa po osećaju" za rani test (v3: test u 4. ned za p09/p10/p12).
9. Novo: dugi raste od ZAOKRUŽENOG prethodnog, pa se zaokruživanje naniže sabira (korak 9 min daje ≈ 1 km).
10. Novo: zaokruživanje deonica (500 m) može spustiti rad ispod `minDoseSec` (K8: kvalitet < 8 min).
11. Novo: posle rampe (plan posle trke) pravilo rasta tri nedelje gradi iz smanjenih nedelja, pa sledi skok (vlasnik v2,
    nedelje 5–7: 32 → 34 → 40 km); dugi u 2. nedelji posle polumaratona je 16,5 km (E5 traži ≤ 60 % dva nedelje).
12. Novo: upozorenje `mali-obim` predlaže samo „produži pripremu" i kad je datum zadat — treba i šta može sada (5. dan).

## Šta NIJE urađeno / otvoreno
- Otisci su zaključani na četvrtom (završnom) krugu motora 3be0d68.
- Upozorenja (tekst predloga) piše motor — tačka 12 nije rešiva podacima.
- Ocena trenera nije računata (radi sudija); trenerski ciljevi su provereni testovima, ne ocenom.
