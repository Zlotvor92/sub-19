# R17 — maraton tab (podatak), 13. 11. 2026, po Beogradu

Izvori: nalog R17 (`coach/ROUND-V4-MAR-02` § D4–D5) i dopuna (`judge2/ROUND-V4-MAR-02`). Menjani su samo
`distances/marathon/` i `plans/MAR/`; ispisi HM, 10K i 5K su bajt-isti. Kapija MAR: 0 prekršaja, 19/19. Testovi
maratona: 110 prolaze, 4 `it.fails`. `target-compare`: 20 od 78 nedelja (pre R17 18).

| stavka | urađeno | broj (pre → posle) |
|---|---|---|
| p07 30–32 km, dugi ≥ 26 km | dugi u telu od 90 % najdužeg, korak 1,5 km, polazni dugi 4 dana 40 %, 5 dana 34 %; provere dugog na 26 km (`longCheckKm`, `minLongKm`) | p07 28,5 → 30 (N−5 i N−3); p09 → 28; p16 → 27,5 |
| dugi ne stoji | talas 100/88/100/82 % u nameri i na plafonu; povratnik bez progresivnog dugog | p17 ned 1–4: 27,5 × 4 → 29-28-30-28; p05 → 32-29-32-32-33 |
| testovi motora | `scenarios.test.ts`: `returnKeepLong` (E2, s27) i `afterLongRace` (s17, s20) | oba prolaze |
| (a) pripremni polumaraton | nedelja trke 85 % obima (ne 5–6 dana odmora); trči se kao trka, dosledno uz „rezultat postaje forma"; nov početnik (P2 B, p18) nema polumaraton, nego proveru 10 km | p08 ned 15: 36 → 54 km; P2 B bez PM 23,9 km |
| (b) početnici p13/p18 | trka > 4 h 30: napomena hod-trk od starta; bez MP bloka i PM; hod-trk dugi nosi više nedelje | p13 najduži 17,9 → 19,9 km; p18 24 km / 3 h |
| (c) dugi ≤ ≈ 45 % kod 3–4 dana | 3 dana 50 %, 4 dana 45 %; 57 % samo u 3 najduže nedelje (N−7, N−5, N−3); posle PM kraći dugi kod 1–3 dana | p01 25,5 → 24,5; p03 25,1 → 23,8; p10 25,1 → 22,5 |
| (d) upozorenja | `minLongKm` 26 = provera dugog (ne „26" i „28" u dva upozorenja); p04 nema `obim-za-nivo` | — |

Odluka organizatora za p04: spor nivo ostaje na 3 h 10, jer je očekivano 4:13 < 4 h 30.

**Sukob za trenera/organizatora:** (c) i R1 se ne slažu kod 4 dana sa vrhom 52–60 km. p01 je spao na 24,5 km
(43 % vrha), a kapija je spuštena sa 25,5 na 24,5 km. Isto važi za 3 dana (p03, p10). Treba izabrati jedno pravilo.

**Zahtevi za motor:**
1. Korak dugog se posle koraka zaokružuje naviše na 0,5 km, pa korak 1,7 km obara K7 (p15 16,1 → 18,2 km).
   Bez toga bi p06 stigao do 26 km (sada 24,5).
2. Talas ne može ispod polaznog dugog u nedelji gradnje, pa ostaje plato posle PM (p05 32-33-32, p17 28-29-28).
3. `afterLongRace` važi i za PLANIRANI pripremni polumaraton: lagani dani dve nedelje posle su 40–50 min, a udeo
   dugog raste (p03, p10) — kapija te dve nedelje ne meri.
4. Tekstovi upozorenja („duža priprema pomaže/ne pomaže" p13, broj treninga u nedelji provere p10). Iz MAR-02:
   § D1–D3, s17, povratak (s07/s15/s16/s25), s26, P3 A.
5. KNOWN posle događaja: s2/s26 `ispod-cilja`, s6 `dugi-korak`, s7 `dugi-za-distancu`, s26 R2 + 23 %.

## § R18 — dužina najdužeg dugog ima prednost (odluka organizatora)
Udeo dugog je najviše 45 % kod 4 dana i 50 % kod 3 dana, osim dve nedelje sa najdužim dugim (N−5 i N−3, razdvojene
rasterećenjem N−4), kad sme 50 % i 55 %. Kapija je vraćena na 26 km kod vrha ≥ 52 km; izuzetak važi samo za dugi na
plafonu po vremenu. N−7 je lagan dugi bez bloka (plan ≥ 16 nedelja), da lestvica N−7 → N−5 → N−3 stigne do 26 km;
korak dugog je 1,7 km.
Najduži dugi: p01 26,5 km (47 % vrha), p02 26, p16 27,5, p07 30. p03 20,5 i p10 20,7 km (3 dana, vrh 40–43 km, pa
kapija od 26 km ne važi). p06 24,5 km: plan od 12 nedelja ne potpada pod kapiju (≥ 16 nedelja); ne stiže do 26 km
zbog koraka (zahtev 1). p11 21,2 km / 2 h 28 (početnik, vrh 50 km).
Prag za vrh 45–52 km spušten je sa 2 h 30 na 2 h 25 (p11).
K7 dozvoljava + 2,5 km kad dugi nosi blok MP. Zahtev motoru: korak dugog meriti u km sa blokom, ne u vremenu laganog
tempa. Početnik ima jedan blok ≥ 30 min (ciljni p11), u vršnoj nedelji brz rad ≥ 7 %.

### Ispravka R18 (organizator: p03/p10 regresija)
Najduži dugi pre → posle ispravke (b38a0ec4 → sada, km): p03 23,8 → 23,8; p10 22,5 → 21,8; p11 24,8 → 22,6; p13 19,9 →
19,2; p18 24 → 22; p19 22 → 21,5. Ostali su isti ili duži (p01 26,5, p02 28, p08/p09 28,5, p15 27,8, p16 28,2).
- 3 dana: udeo 50 % (kao u b38), 56,4 % u nedeljama najdužeg dugog; kapija kod 3 dana dozvoljava 55 % u TRI najduže
  nedelje (ponuda organizatora), 4 dana ostaje dve. 4 dana se ovim ne menjaju.
- N−5 kod 1–3 dana ponovo nosi blok MP (test „≥ 2 duga sa blokom"). Polumaraton u N−9 ima namerni dugi 50 %, da
  nedelje najdužeg dugog budu N−5 i N−3 (p02, p16 duži).
- Test `R18 — najduži dugi nije kraći nego u b38a0ec4` (tolerancija 0,5 km = zaokruživanje dana; plafon po vremenu
  je izuzetak, sada nijedan profil nije na njemu). Navedeni izuzeci, sa računom u testu:
  - p10: N−3 155 od 286 min = 21,8 km; 22,5 km traži udeo 0,568, a on p03 N−5 diže na 22,6 od 40 km (56,5 % > 55 %).
    p03 i p10 dele isti broj, a 0,5 km zaokruživanja ih razdvaja.
  - p11 (početnik 4 dana): N−7 ≤ 45 % od 41 km ≈ 19 km, pa uz korak 1,7 km N−3 ≤ 22,4 km. b38 je imao 57 % u N−7.
  - p13 (hod-trk 3 dana, 10 nedelja): 55 % × 35 km + 0,5 = 19,75 km < 19,9 (b38: 57 %).
  - p18 (hod-trk 4 dana): N−7 ≤ 45 % od 44 km, pa N−3 22 km (b38: 50 % u svim nedeljama).
- Za odluku: povratak b38 vrednosti traži ili udeo ≥ 57 % kod početnika (pravilo R17 c), ili korak dugog > 2 km (K7),
  ili udeo meren u minutima bez viška bloka MP (zahtev motoru).
