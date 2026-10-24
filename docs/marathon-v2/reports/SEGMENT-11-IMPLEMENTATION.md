# Maraton v2 — MAR-11 (marathon-v2.7.0): trenerska pravila krug T + dopuna lanaca

Polazni SHA `b9c4728` (marathon-v2.6.1). Zadatak: `docs/generators-v2/audit/fixes/03-coach-rules.md`, `T-assign.md`
(MAR: T1, T2 MAR deo, T3, T6 C6 i C11, T7, MAR dodatno C3-lanci, Z8, C8), pravila `00-common.md`. Menjan samo folder
`web/src/domain/generators/marathon/v2/` i `docs/marathon-v2/`.

## Stavke

| stavka | šta je urađeno (jedno mesto odluke) | test (pada na b9c4728) | sabotaža | pre → posle |
|---|---|---|---|---|
| T1 | `lengths.buildLengths`: lagan ≤ 0,8 × dugi (`easyCap10`), najkraći max(5 km, 20 min, `easyFloor10`); ostatak koji ne staje → pretraga cilja M6 (niži cilj, CAPACITY_LIMITED + preporuka); kad nijedan cilj nije izvodljiv → lagan dan odmora (`easyRestNote`), pa lagani na 0,8 × dugi uz planirano < cilj (`EASY_UNDER_NOTE`, PLANNED_BELOW_TARGET); dugi se ne produžava. Validator: EASY_LONG_SHARE (iste funkcije), VOLUME_START prihvata dugi na udelu M15 | segment11 T1 (2) | 11-T1 | §1 |
| T2 (MAR) | `quality.taperMpFit` u `taperDoses`: MP ispod 2 × 3000 m skraćen (kontinuirano, korak 0,5 km, najmanje 1,0 km) do trajanja dugog; doza ne raste | segment11 T2 | 11-T2 | §1 |
| T3 | `QualityState.restart` (generate) → `taperDoses`: posle novog starta i ≥ 1 nedelje sa kvalitetom posle povratka jedan kvalitet MP ≈ 60 % poslednje MP doze posle povratka (najmanje 2 × 3000 m, uz T2), bez T; `hasSharpener(…, restarted)`: trkačka zadržava 2 × 2000 m MP (zabrana kvaliteta bola važi) | segment11 T3 | 11-T3 (2) | §2 |
| T6 C6 | `steps.doseRestartWeeks` (nov start ∪ r + 1 posle bola) za konstruktor i validator | segment11 C6 | 11-C6 | §2 |
| T6 C11 | pouka 35 i u nedelji testa (`week.ts` easy35, validator QUALITY_DAYS) i u taperu (`week.taperSecondEasy`, TAPER_QUALITY) | segment11 C11 | 11-C11 | §2 |
| T7 | `input.ts`: skorašnji najduži > trenutni nedeljni obim → RECENT_LONG_INVALID „… — proveri unos." | segment11 T7 | 11-T7 | §2 |
| C3-lanci | validator TEST: zaštićen test (≤ asOf, zaključan, urađen) se ne broji kao „test plana po osećaju" | segment11 C3 (i=18) | 11-C3 | §3 |
| Z8 | `assess.ts`: raniji korak bola koji je video najnoviji zapis bola → nov korak bola se ne pravi (kao HM-09) | segment11 Z8 | 11-Z8 | §3 |
| C8 | validator: mešovita nedelja čiji je vlasnik pravilo pauze, zaštićeni + preostali > cilj → MIXED_WEEK_OVER | segment11 C8 (i=865) | 11-C8 | §3 |

Sabotaže: `artifacts/segment-11/sabotage-11.json` → **11/11 palo**, stanje `src` vraćeno (`sabotage-11.result.json`).

## §1 T1 i T2 — merenje (coach-hm-mar `measure.ts MAR 400 200 100`, generator svih 31 650 realnih ulaza)

| merenje | b9c4728 | MAR-11 |
|---|---|---|
| generator: lagan ≥ 0,9 × dugi u izgradnji (1b nalaz 4) | 10 521 / 31 650 | **0** |
| generator: taper sa danom kvaliteta dužim od dugog (1b nalaz 3, 70,6 %) | 22 344 / 31 650 | **0** |
| generator: odbijeni | 0 | 0 |
| adaptacija (110 planova × 64 692 toka): taper dan kvaliteta > dugi, novo u odnosu na plan generatora | 3 798 | 303 (svi: MP na najkraćem bloku 1,0 km, WU/CD ≥ dugi — otvoreno pitanje 1) |
| adaptacija: odbijeni | 0 | 38 — svi „dayId … nije dan plana" u drugom koraku lanca (`chain2` pravi zapise iz plana generatora, a taj dan je posle T1 dan odmora; u aplikaciji se zapisuje na dan tekućeg plana) — artefakt alata; pravih odbijanja 0 (`artifacts/segment-11/arej.ts`) |

Obim (uzorak svaki 5. ulaz mreža, 6 384 plana; `artifacts/segment-11/vol.ts`, pre na b9c4728):

| | b9c4728 | MAR-11 |
|---|---|---|
| planovi sa CAPACITY_LIMITED (planirano < cilj po pravilu, uz preporuku) | 1 698 | 2 600 |
| planovi sa nedeljom spuštenom ispod cilja po pravilu (fitted down) | 2 854 | 3 022 |
| prosečan vrh [km] | 82,5 | 80,6 (−2,3 %) |
| prosečan zbir planiranog [km] | 1 219,5 | 1 188,8 (−2,5 %) |
| lagan ≥ 0,9 × dugi / taper dan kvaliteta > dugi | 2 115 / 4 488 | 0 / 0 |

Primer (4 d, 45 km, VDOT 40, `d4-14w-45km-v40-A-sat`): ned 1 45 → 42,6 km (lagan 15,0 → 13,6 km uz dugi 17,0),
vrh 67,5 → 64,7 km, CAPACITY_LIMITED „4 dana ne nose ovaj obim uz dugi ≤ 150 min i ≤ 40 % nedelje; preporuka 5–6 dana".
T2 primer (3 d, 30 km, VDOT 30): N−1 MP 2 × 3000 m (dan 70 min > dugi 64 min) → kontinuirani blok koji staje u trajanje
dugog; doza N−1 ≤ N−2.

Planirano < cilj u adaptaciji (T1 poslednje rešenje): lagan dan odmora (napomena „odmor umesto laganog dana") samo kad
nijedan cilj nije izvodljiv sa svim danima; pa lagani na 0,8 × dugi uz PLANNED_BELOW_TARGET; nedelja tada sme ispod
minimuma nedelje (upozorenje WEEK_MIN_LIMITS, kao dani odmora A4). Primer: 3 d, 30 km, pauza 35 pre starta — ned 2
dugi 7,5 + lagan 6,0 = 13,5 km < cilj 15 km (bilo dugi 5 + 5 + 5).

## §2 T3, C6, C11, T7

- T3: `d4-18w-50km-v45-A-sun`, pauza 35 do kraja ned 8 — b9c4728: N−2 MP 6,0 + T 2,0, N−1 **bez kvaliteta**, trkačka
  **bez oštrenja**; MAR-11: N−2 MP 6,0 km, N−1 MP 2,5 km (T2), trkačka 2 × 2000 m MP. Pauza do kraja ned 13 (obim
  tapera 23,6 km / 4 dana): taper i dalje bez kvaliteta — najmanji MP dan (≈ 9 km) ne staje u obim uz 3 dana ≥ 5 km
  (pretraga cilja M6 sme samo naniže), oštrenje u trkačkoj ostaje. Tumačenje: „nedelja sa kvalitetom posle povratka" =
  nedelja izgradnje čiji kvalitet ulazi u progresiju doze (stanje doze posle novog starta); nedelja sa jednim kvalitetom
  doze rasterećenja (A9) se ne broji.
- C6: isti ulaz, bol 5 kraj ned 6 (r = 7): ned 8 b9c4728 I 3000 + T 3000 m (nastavak progresije) → MAR-11 I 2000 +
  T 2400 m (početni nivo), ned 9 I 3000 + T 3000 m.
- C11: `feel-d4-12w-50km-e270-B` + skorašnji najduži 8 km: nedelja testa (ned 3) imala test + Q2 duži od dugog → Q2
  lagan (napomena pouke 35), test ostaje. U mrežama generatora bez skorašnjeg najdužeg takvih nedelja nema (0). Taper:
  `taperSecondEasy` (kao HM-09) — u mreži 0 slučajeva posle T2 (MP i T dan ≤ dugi).
- T7: 40 km nedeljno + skorašnji najduži 41 km → RECENT_LONG_INVALID „Skorašnje najduže trčanje 41 km je duže od
  trenutnog nedeljnog obima 40 km — proveri unos." Mreža M13a: svi ulazi sa r > obim (npr. 3 d 30 km, r 31–42) sada
  odbijeni ovom porukom (ranije planovi).

## §3 Lanci (chains/idemp, seed 20261023, lanci 0–2000; pre = MAR-10 `artifacts/segment-09/mar10/*-post.json`, 724b676)

| | pre (724b676) | MAR-11 |
|---|---|---|
| odbijeni lanci (sve klase; C3 TEST) | 26 | **0** |
| ponovna primena odbijena (TEST, C3: i=175, 253, 638, …) | 4 | **0** |
| „sutra bez novih zapisa" odbijeno (TEST) | 3 | **0** |
| mešovita nedelja > cilj bez upozorenja (C8, i=865) | 2 | **0** |
| „sutra" cilj pada > 10 % (Z8 i manjak) | 25 | 2 |
| idemp `same` (promena istim zapisima, svi uslovi) | 58 | 55 |
| idemp `next` (sutra bez novih zapisa) — od toga bol | 31 — 22 | 18 — 9 |
| invarijanta „taper > poslednja izgradnja" | 2 | 3 (+ i=289) |
| ostale klase (IDEMP:WEEKS 44→45, buduća nedelja < 40 % 61→64, skok dugog 1→1) | — | bez nove klase |

C3 u dva dela: (a) validator TEST ne broji zaštićen test kao „test plana po osećaju" (i=18, nov rezultat); (b) okviri
pre poslednjeg koraka (`steps.framesFor`, `before`) računaju se sa istim zaštićenim danima — inače ponovljen korak vidi
test premešten u ranijem koraku kao drugi test (i=175). i=289: bol u ned 14 (poslednja izgradnja) — T1 spušta tu
nedelju 82,8 → 75 km, taper N−2 76,3 km ostaje (poznata klasa, prijavljena; plan prihvaćen, upozorenje nema).
Izlazi: `artifacts/segment-11/chains-post.json`, `idemp-post.json`.

## Otisci (zamrznute bazne linije)

Po konvenciji foldera (MAR-04b STABLE): `segment11.stable-b9c4728.json` = planovi iz `segment04b.stable-bd07eec.json`
(7 566) bez T1/T2 prekršaja na b9c4728 → **5 772**; samo oni moraju ostati bajt-isti prema segment03/02/01 baznim
linijama. Klasifikacija svih 31 650 planova mreža na b9c4728 (`artifacts/segment-11/classify.ts`): menja se 24 276 —
T2 11 292, T1+T2 11 106, T1 1 878 (C11 u mrežama generatora 0). Vrh sme da padne samo u planovima koji se menjaju (T1).
Testovi baznih linija (uzorak i pun nivo) prolaze: nijedan plan van klasifikacije se ne menja.

## Testovi (na baeb435)

- `npm run check` (iz `web/`): **336 fajlova, 3 762 testa — zeleno** (tip, lint, format, brz nivo).
- `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon`: **90 fajlova, 539 testova — zeleno**.
- `npx playwright test e2e/marathon-v2`: **3/3**.
- Namenski: `segment11.node.test.ts` (11 testova; svaki pada na b9c4728 — 8 proverenih kopiranjem u stablo b9c4728,
  C11/C8/C3b pojedinačno); sabotaže **11/11**.
- `--changed`: nije posebno pokretan — `npm run check` je pokrenuo ceo brz nivo (nadskup), pun nivo foldera maratona
  zasebno.
- Izmenjeni postojeći testovi (namerna promena plana, svaki sa komentarom MAR-11): verzija politike i KNOWN_VERSIONS,
  P.lengths/P.taper, invarijante mreža (T1, T2, ned 1 na udelu), recent K1 (T7), dense K2, adaptInvariants
  (planirano < cilj uz napomenu T1), dayCap (W1 ciljevi, 3 d primer r8 12 ned, taper MP, IDENTICAL_WEEKS: ponavljanje
  više ne nastaje — test toka + validator obara ručno ponavljanje), segment07 (primer pouke 35), segment08b/08c, segment09
  (prag 7,5 km, napomena „ostaje duži" više ne postoji), validate M7a (MP 5,0 km), adapt (Z8: stari zapis bola ne
  pravi nov korak; podignut dugi A9 više ne nastaje u tim tokovima), preStart (C11), quality (T2 1,0 km).

## run-all (`run-all.sh … 3 '.*-MAR'`, f20c7ec; early-MAR i edges-MAR ponovljeni na baeb435)

13 poslova (two-step-MAR: vidi dopunu ispod), **nečistih 1: edges-MAR** — 3 odbijanja generatora
RECENT_LONG_TOO_SHORT (skorašnji najduži 5 km uz VDOT 70 i najveći obim reda: pouka 6, poruka sa pragom i preporukom)
+ u adaptaciji 3 × RECENT_LONG_TOO_SHORT i 1 × WEEK_INFEASIBLE (ned 11, taper) posle rezultata na dnu opsega (VDOT 30)
na planu `4 d / 65 km / 12 ned / rl 5` koji je na b9c4728 generator odbijao (nov tok; posledica T1 + odmora laganog dana).
early-MAR 1 → **0 / 164 394** posle baeb435 (pouka 32 uz lagan dan odmora). Ostali: fatigue-repeat 0/990,
fatigue-startday 5 108 tokova, fatigue-testweek 0/4 592, last-weeks 0/89 309, locked-pause 0/54 848, locked-result
0/3 078, locked-test 0/5 880 (+ kontrola 0/5 880), result-pain 0/73 188, start-day 0/43 418, targeted i warnings
(pregled ručno, bez odbijanja).

## Otvoreno / pitanja (odluka nije zapisana — urađeno najmanje, čeka organizatora)

1. **T2, WU/CD ≥ dugi tapera.** Kad dugi N−1 traje koliko WU + CD (npr. 3 d, posle pauze: dugi 6,2 km / 29 min), ni
   najkraći MP blok (1,0 km, `mpShortMinKm`) ne staje — dan MP ostaje duži od dugog (napomena „najniža doza; ostaje
   duži"). Generator 0, adaptacija 303 / 64 692 toka. Pitanje: MP otpada (dan lagan) ili WU/CD na minimum (kao 5K T2)?
2. **T1, nespojive granice.** Kad je 0,8 × dugi < najkraći lagan (5 km; dugi < 6,25 km — plafon skoka posle pauze),
   nijedan lagan ne može da zadovolji oba uslova. Urađeno: strogi T1 (pa odmor, pa planirano < cilj) prvo; tek kad ni
   to nije izvodljivo — lagan ≤ dugi (pouka 2) kao pre T1 (`easyCap10` relax, poslednji pokušaj u `generate.ts`).
   Bez toga pauza 35 pravi odbijanja (merenje: 106 tokova WEEK_INFEASIBLE). Pitanje: da li je to prihvatljivo pravilo?
3. **T2 × M8 oštrenje.** Oštrenje 2 × 2000 m MP traži MP dozu N−1 ≥ 4 km (M8); T2 skraćuje N−1 MP → trkačka bez
   oštrenja u **1 194 / 6 384** plana uzorka (bilo 378; `artifacts/segment-11/sharp.ts`). Nije na spisku; T3 zadržava
   oštrenje samo posle novog starta. Pitanje: oštrenje „kao bez T2" i ovde?
4. **T1 planirano < cilj ispod minimuma nedelje.** Poslednje rešenje (lagani na 0,8 × dugi) sme dati nedelju ispod
   minimuma M15 (upozorenje WEEK_MIN_LIMITS, kao dani odmora A4), npr. 3 d posle pauze 35: 13,5 km < 15 km. Potvrda?
5. **T3 bez kvaliteta kad obim tapera ne nosi najmanji MP dan** (pauza kasno, 4 d, taper 23,6 km: MP dan ≈ 9 km + 3 dana
   ≥ 5 km) — taper ostaje bez kvaliteta (pretraga cilja tapera samo naniže). Oštrenje u trkačkoj ostaje.

## Primećeno, nije rađeno

- Lanac i=289: T1 spušta poslednju nedelju izgradnje u periodu bola (82,8 → 75 km), taper N−2 76,3 km je iznad nje
  (poznata klasa „taper > poslednja izgradnja", 2 → 3 lanca; plan prihvaćen).
- `coach-hm-mar/measure.ts` i `chains` `chain2`: drugi korak pravi zapise iz plana generatora (dayId) — posle T1 taj dan
  može biti dan odmora → „dayId nije dan plana" (38 tokova). Alat, ne plan.
- Merenja `measure.ts` i run-all su pušteni pre poslednje sitne ispravke (abed8fc: odmor laganog dana samo dok nedelja ima
  trening); ona menja samo tokove koji su pre nje bili odbijeni (EMPTY_WEEK), pun nivo testova je posle nje.
