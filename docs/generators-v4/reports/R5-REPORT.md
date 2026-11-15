# Krug 5 V4 HM — izveštaj (motor M1–M9, podaci P1–P5), 13. 11. 2026

Grana `claude/v4`. Testovi V4 + izolacija: **602 prolaze, 8 očekivano pada (`it.fails`, FORM_DRIFT), 0 pada**;
typecheck i lint čisti. Kapija (`plans/gate.ts`, sada 14 provera): **0 prekršaja, 14/14**. `target-compare`: 27 od 72
(krug 4: 25). Nalazi čuvara na 14 planova: 6 (krug 4: 6) — p07@5 i p10@18 nestali, p04@4/@16 novi (P1).

## Motor
| # | stanje | šta |
|---|---|---|
| M1 | urađeno | ostatak zone < 15 min → zamenski prag pune doze; kad budžet skrati dozu ispod najmanje za unos, bira se manji unos istog podražaja (p08 vrh opet 25 %) |
| M2 | urađeno | zamena/izbacivanje praga samo uz tempo trke usred nedelje; dugi već nosi blok zone, a plafon seče i trening usred nedelje → zamenski podražaj kad nosi više rada (p04 vrh 16 %). p05: 2 kvaliteta u nedeljama gradnje |
| M3 | urađeno | `adjustRaceDay` (jedno mesto: plan, ponovno planiranje, ispis): `dugi-za-distancu` → očekivano = današnja prognoza; kratak staž → raspon × 1,5. Ispis je ranije čitao sirovu procenu i preskakao širenje. P2 B 2:04:13 (1:57:10–2:17:03) ≠ P2 A 1:57:11 |
| M4 | urađeno | pomerena provera samo u nedelju rasterećenja ≤ 3 nedelje pred trku, inače otpada uz rečenicu; ostaje i kad se plan posle prozora vraća na prvobitni. s05 → 21. 1., s07 → 18. 2., s14 → 21. 1., s15 → 18. 2. (kod bola se sada i kaže) |
| M5 | urađeno | `minEasyMin` po nivou (iskusni 35, mali/povratnik 30) od `minEasyFromRunDays` 5; kad ne staje — jedan lagan dan manje (ne kvalitet), upozorenje `dan-izostavljen`. p06: 4 od 5 dana, lagano ≥ 35 min |
| M6 | urađeno | kvalitet ≤ 2 dana pred proverom otpada (`noQualityBeforeTestDays`) |
| M7 | urađeno | `safety.taper`: kalendarska nedelja −2 ≤ 80 % vrha (km) i ≤ 2 brza (blok u dugom se broji), nedelja trke ≤ 60 %; višak se skida jednom korekcijom (srazmerno, pa lagani dani, pa dugi). Čuvar nije video 3 brza jer je gledao prozor trka−14…trka−8 (≈ nedelja −1); nova provera `silazak` po kalendarskoj nedelji. Svih 14: 75–80 %, ≤ 2 brza, trka 28–55 % |
| M8 | urađeno | (a) dodatni dan u predlogu: trajanje iz probe plana (razlika vrha × lagan tempo); (b) „22 %" samo kad neka nedelja stoji na granici (uz granicu vrha 25 %); (c) „zašto" ne prikazuje korake bez signala (pripisani napredak plana) — s21–s24 bez koraka procene; (d) „iste dužine/doze" umesto „ionako kraći" (s10) |
| M9 | delimično | poslednji dugi zadržava blok ≥ 15 min (`taper.lastLongMinBlockSec`; s06 7. 3.: 16 min); vrh u 21 dan posle rampe nije merilo silaska (motor i čuvar) — s06 9. 3. tempo trke ostaje. **Otvoreno:** prvi dugi posle bolesti 60–65 % (s05 8,5 km od 18,5): dužinu u rampi određuje cilj nedelje rampe, ne spremnost — pokušaj u spremnosti nije delovao, vraćen |

## Podaci polumaratona
| # | stanje | šta |
|---|---|---|
| P1 | urađeno | `longVsRace` od 1:55 (6900 s): dugi ≤ trka + 10 min, blok ≤ 35 min. p04 najduži 22,4 → 19,3 km (2 h 10); pogađa i p12 (2:00): 19,8 → 19,1 |
| P2 | urađeno | `longStartFloorFromCapShare` 0,88: 85 % samo kad je polazni ≥ 88 % plafona (p08 0,90, p04 0,95); p01 kreće od 15,5 km, p12 od 1 h 40 |
| P3 | urađeno | `tagMaxRun` (brdo 2 od 3, zamena intervali; p04 n3 intervali), `intervalPaceFloor` (od 1:55: I ≥ tempo na 5 km iz forme; p03, p04, p10–p12) |
| P4 | urađeno | prag ≈ tempo trke → drugi kvalitet intervali; gradnja ≥ 14 % (p05 18 %, p06 25 %) |
| P5 | urađeno | kapija 11–14: M2, M6, M7, P1; `r5.test.ts`: M3, M5, P2, P3, M7 (čuvar). Svi ispisi osveženi |

## Tabela po profilu (krug 4 → krug 5)
vrh km · najduži dugi · brz rad (vrh): p01 54,5 · 20,5 · 22→24 %; p02 54,4 · 20,5 · 24→25; p03 38,1→38,8 · 17,8→18,2 ·
24→25; **p04 68,4→65,0 · 22,4→19,3 · 21 (18)→19 (16)** (P1); p05 110,2→111,7 · 28,0 · 16→18; p06 44,6→44,5 · 17,0 · 24→25;
p07 71,5→71,8 · 21,5 · 21; p08 47,4 · 21,5 · 25; p09 61,8 · 22,0 · 20→25; p10 36,0→37,1 · 17,6 · 23→25; p11 39,1 · 16,2 ·
18→21; **p12 60,8→60,1 · 19,8→19,1** · 18 (P1: 2:00 > 1:55); v1 37,2 · 15,0 · 25; v2 47,3 · 18,5 · 24→25.
Gubici samo gde ih brief traži (P1: p04, p12); p06 −0,1 km je zaokruživanje dana (dan manje, M5).

## Odluke u okviru briefa (bez čekanja)
- P2 „na plafonu" = polazni ≥ 88 % najdužeg dozvoljenog (p08 0,896 je granični slučaj, zato ne 0,9).
- M5 važi od 5 dana: sa 4 dana minimum 35 min oduzimao je drugi kvalitet (p02 n2).
- M2 u kapiji: nedelja sa tempom trke; p06 n1–n4 i p09 n5 imaju jedan kvalitet zbog prostora u obimu (isto u krugu
  4) — otvoreno, nije posledica zamene zone.
- FORM_DRIFT: p07 skinut (prolazi), dodati p06 i p04 (+1 s očekivanog vremena posle ponovnog planiranja; forma).

## Pravila koja su sada opšta u motoru (za 10K/5K/maraton)
1. Plafon minuta jedne zone nedeljno + zamenski podražaj pune doze; zamena samo uz tempo trke usred nedelje ili
   kad dugi već nosi istu zonu. 2. Doza skraćena budžetom → manji unos istog podražaja, ne otpadanje.
3. Silazak po kalendarskoj nedelji (km prema vrhu, broj brzih), jedna korekcija; čuvar `silazak`.
4. Bez kvaliteta N dana pred proverom. 5. Pomerena provera → prvo rasterećenje ≥ 3 nedelje pred trku.
6. Najkraće lagano po nivou i jedan dan manje uz rečenicu. 7. Prognoza prema nalazima (`adjustRaceDay`).
8. Oznaka najviše X od Y nedelja (`tagMaxRun`); pod tempa intervala za spore. 9. Dugi ≤ vreme trke + N za spore.
10. Polazni dugi = najduže skorašnje, pod samo na plafonu. 11. Poslednji dugi zadržava najmanji blok; vrh skraćen
povratkom nije merilo silaska. 12. Upozorenje/objašnjenje se računa iz plana (proba sa danom više, „iste dužine").

## Podaci koje distanca mora da da (`safety`)
`taper` {lastDays, weekBeforeFromDays, weekBeforeMaxQuality, weekBeforeMaxOfPeak, weekMinus2MaxOfPeak,
calendarMinus2MaxQuality, raceWeekMaxOfPeak, lastLongMinBlockSec}; `weeklyZoneMaxSec` {zone, fallbackStimulus,
minLeftSec, byLevel}; `zoneGapReplacement`, `minZoneGapSecPerKm`; `noQualityBeforeTestDays`; `minEasySec`,
`minEasyMin` po nivou, `minEasyFromRunDays`; `longVsRace` {fromRaceSec, overSec, blockMaxSec}; `longStartFloorShare`,
`longStartFloorFromCapShare`; `tagMaxRun`; `intervalPaceFloor` {distanceM, fromRaceSec}; plus postojeće (peakLadder,
doseCaps, sharpening, longShareLowVolume, adequate …). Distanca bez nekog polja dobija ponašanje bez tog pravila.
