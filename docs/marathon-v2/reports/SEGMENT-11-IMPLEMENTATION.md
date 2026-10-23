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

Sabotaže: `artifacts/segment-11/sabotage-11.json` → **10/10 palo**, stanje `src` vraćeno (`sabotage-11.result.json`).

## §1 T1 i T2 — merenje (coach-hm-mar `measure.ts MAR 400 200 100`, generator svih 31 650 realnih ulaza)

TBD

## §2 T3, C6, C11, T7

TBD

## §3 Lanci (chains/idemp, seed 20261023, lanci 0–2000)

TBD

## Otisci (zamrznute bazne linije)

Po konvenciji foldera (MAR-04b STABLE): `segment11.stable-b9c4728.json` = planovi iz `segment04b.stable-bd07eec.json`
(7 566) bez T1/T2 prekršaja na b9c4728 → **5 772**; samo oni moraju ostati bajt-isti prema segment03/02/01 baznim
linijama. Klasifikacija svih 31 650 planova mreža na b9c4728 (`artifacts/segment-11/classify.ts`): menja se 24 276 —
T2 11 292, T1+T2 11 106, T1 1 878 (C11 u mrežama generatora 0). Vrh sme da padne samo u planovima koji se menjaju (T1).
Testovi baznih linija (uzorak i pun nivo) prolaze: nijedan plan van klasifikacije se ne menja.

## Testovi

TBD

## Otvoreno / pitanja

TBD

## Primećeno, nije rađeno

TBD
