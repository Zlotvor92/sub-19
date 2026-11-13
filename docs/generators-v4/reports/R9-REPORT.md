# Krug 9 V4 — deo A (motor), 13. 11. 2026

Grana `claude/v4`. V4 skup: **721 prolaze, 14 očekivano pada, 0 pada**; `npm run check` zelen (4157 + 14); typecheck i lint čisti. Kapije: **HM 0; 10K 1** (p06 B9 „nedelja −1 >
nedelja −2", izuzetak taba 10K `WAIT_A1` u `tenk/gate.test.ts`, vidi A10). `target-compare` HM 26/72, 10K 15/54
(pad u odnosu na krug 8: sporiji prag po A14 i A7 menja dozu i vrstu prema ciljnim planovima).

| # | stanje | test |
|---|---|---|
| A14 | urađeno: sidro T = trka od 60 min; `Transfer.limits` iz rezultata KRAĆIH od cilja u 12 nedelja: VDOT zone ≤ najveći sirovi VDOT, prag ne brži od trke 40–70 min, intervali ne brži od trke/testa ≤ 15 min. Odluka: (c) za prag samo do 70 min (polumaraton je po prirodi sporiji od praga). s04 prag 5:31 → 5:48 (trka 5:48), s03 prag 5:10 → 5:24, I 4:43 → 4:59, par 2 prag 5:23 → 5:40. Vlasnik (test-podaci bez kraćih rezultata): v1 prag 4:35 → 4:37, I 4:13 → 4:15, R 3:58 → 4:00 (+2 s od A14/A7) | `hm/r9`, `tenk/r9` A14 (profili, vlasnik, 27 scenarija) |
| A1 | urađeno: kvalitet koji ne staje — (1) najkraće WU/CD iz podataka, (2) doza korak 60 s do ≥ 12 min / najmanjeg oblika, manji unos istog podražaja, (3) izostavljen lagan dan uz `dan-izostavljen`, (4) tek onda briše; dugi sa blokom ≥ 25 % OSTVARENE nedelje (višak skida poslednji kvalitet). 10K p06 i HM p06 imaju kvalitet u svakoj nedelji gradnje; izuzetak kapije za vrh uz `lagan-kratak` uklonjen (ostaje samo za nedelju trke) | `hm/r5` Z8+A1, 10K B4 bez `WAIT_A1`, B3 bez `WAIT_A1_RP` |
| A2 | nije urađeno | — |
| A3 | delimično: promena tempa po zoni kad zone idu u suprotnim smerovima. Nije: stvarni rezultat u tekstu (10K s01), imenovanje glavnog treninga (s09), reči zone iz teksta distance | `r9` A3 obe distance |
| A4 | urađeno (preko A8): 10K s03 skinut iz `KNOWN`; test E1 bez tolerancije (nova ≤ stara) | `scenarios.test` Z4 obe distance |
| A5 | urađeno: u prozoru bola/pauze (+ 28 dana) nova tempa po zoni ne brža od starih (HM s26 I 5:24 → 5:20 više ne) | `r9` A5 obe distance |
| A6 | delimično: skraćena nedelja izlaska ne podiže udeo brzog (doze srazmerno; HM s05). Poznato: HM s07 dugi-za-distancu (A10), 10K s07/s26 brz-udeo, s14 ispod-cilja, s15 lagan-dugi | `r9` A6 (nalazi koje uvodi događaj) |
| A7 | urađeno: bez ličnog β i bez dokaza ≤ 10 km/kvaliteta prenos naviše β 1, ≤ 3 s/km (`fitness/constants.ts`); početnik i mali obim (< 35 km) uz VDOT ≥ 50: 0. p08 prag = p07 | `hm/r9` A7 |
| A8 | urađeno: `safety.forecastMaxGainByLevel` (HM i 10K: početnik 3 %, potpuno nov 0) u `adjustRaceDay`. Podatak upisan i u `tenk/safety.ts` | `r9` A8 obe distance |
| A9 | urađeno u krugu 8 (30 s) | — |
| A10 | nije urađeno. Pokušaj „sužavanje ≤ prethodna nedelja" (M7 korekcija i izostavljanje dana) brisao je kvalitet sužavanja i kvario udeo laganog/dugog (HM i 10K p06) — vraćeno | 10K B9 `WAIT_A1` ostaje |
| A11, A12 | nije urađeno (`FORM_DRIFT` HM bez p06 posle A1) | — |
| A13 | urađeno: provera forme u prikazanom udelu brzog (HM p01 n8: 0 % → 22 %), budžet isti | `hm/r9` A13 |
| A15 | nije prihvaćeno: dugi posle testa kao lagan ≤ 60 % ruši R2 (s07, s25: nedelja provere manja → sledeća „skok") i Z10 (s26) — vraćeno | — |
| A16 | urađeno: trka na ± 2 % dužine cilja se usvaja 100 % (s17: 6181 → 6151 s) | `hm/r9` A16 |
| A17 | nije urađeno | — |
| A18 | delimično: `lagan-kratak` ne broji nedelje oporavka i rečenica o obimu prati brojeve (s18); napomena trke iz prognoze zaglavlja (jedan izvor); `dan-izostavljen` i `lagan-kratak` sa istim najkraćim danom. Nije: vlasnik-v2 22 %, prvi prag povratnika | `hm/r9` A18 |

Ostalo: `fitness/estimate.test` „stagnira" — odstupanje do 0,47 VDOT posle sidra 60 min (sintetički tempo po tabeli),
tempa se ne menjaju; granica 0,5 (otvoreno za formu). `load.ts` keš ključ = ceo `Transfer` (JSON). Pomoćna varijanta
vlasnik-v1-8n (F4-K2) uklonjena — v1 ponovo ima predlog „planiraj N".

## Pregled (sam, dan po dan)
HM p06: protivrečna upozorenja 35/30 min ispravljena; ostaje naopako sužavanje (9. ned 39 km > 8. ned 34 km, 0 %
brzog u poslednjoj punoj nedelji) — isto kao 10K B9 (A10). HM p11 (početnik): prognoza tačno −3 % (A8), uvod 4
nedelje bez brzog. 10K p06: kvalitet svake nedelje gradnje; „vršna" je 3. nedelja (najveći obim, Z9).
