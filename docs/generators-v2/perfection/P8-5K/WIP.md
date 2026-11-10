# P8-5K — predaja (WIP)

Sav rad je na grani (vrh posle `d62ae99`); `wip.patch` je prazan (nema lokalnog rada van grane).
Detalji i brojevi: `reports/P8-5K-REPORT.md`; STOP: `reports/P8-5K-STOP.md`. Verzija 5k-v2.15.0.

## Urađeno i izmereno (mreža P8 = 3 964 ulaza; svaki korak 0 odbijanja)
- Prvi zadatak: (a) I 10 %; G1 rast do kraja razvoja (`volume.spreadKm/devWeeksLeft`); G2 prvi nivo lestvice
  (`workouts.zoneBudget/firstLevelBudget`, `feel.feelFirstLevel`, validator I/T/R_SHARE); (b) rasterećenje 60 % / dugi 0,8
  (≥ 3 km) (`generate.qualityCapOf`); (c) prvi I ≤ 70 % (`periodize.isFirstIWeek`, po UPISANIM nedeljama — konstruktor i
  validator); (d) WU/CD trke (`workouts.raceWarmup`); (e) početnik iznad kapaciteta → redovan (`steps.beginnerAboveTable`);
  G3 tekst (`text.userWarnings`, `belowTargetAdvice`, `workouts.biggerInOffer`).
- Dopuna: G4 minuti (`workouts.minuteCapKm`, `feel.feelMinuteCap`, `paces.vdotOrEstimate`); G5 taper 60 % najvećeg rada,
  oštrenje 2 × ≥ 400 m ≤ 12 min, inače ubrzanja (`week.buildRaceWeek`); G1a vrh 1,30/1,35/1,40 + satni plafon
  (`volume.peakKm(…, {weeks, p})`); G1b korak < 3 % (`volume.minStep`); G7 test jedini kvalitet, ne pre ned 4; G6 lagan
  ≤ 0,70 × dugi za 4+ dana (`lengths.easyCapKm(…, days)`), bez spuštanja cilja; G3 trka kao trka (prognoza), RPE trke 9.
- Brojevi (pre dopune): plato obima 4,63 → 3,28 ned; prvi I 793 → 557 s; taper RP > 70 %: 3 536 → 0; dugi rasterećenja
  > 0,8: 3 057 → 0; trka = najduži dan 1 105 → 233; početnika 664 → 386. Dopuna: G4 menja 769 planova; vrh/start med 1,26.

## Započeto, nije završeno
- G6 spuštanje cilja: STOP (F 5 d 22,7 %, B 4 d 10,4 % planova gube > 10 % vrha) — čeka odluku A/B/C.
- 42 testa u 17 fajlova `fiveK/v2` očekuju pravila PRE dopune (nijedan nije odbijanje):
  G7 (2 kvaliteta u nedelji testa): `generate`, `segment05`, `segment08h`; G1a/b (brojevi): `segment03/04/05b/06/07/08d/
  08e/08i(.grid)`, `workouts`, `p4`; G6 (0,8): `segment02`, `segment10`; `app` (naslov laganog dana).
  Spisak: `npx vitest run --project node src/domain/generators/fiveK/v2` (brz, ≈ 57 s).
- Sabotaže 11/12 (`P8-5K/sabotage.json`): G3 „najveća doza" ne pada — test p8 treba profil sa tom napomenom posle G4.
- Nije ni započeto: ponovno merenje P0/P7 posle dopune (`plans/` je pre dopune), `npm run check`, `--changed 9055e5b`,
  pun nivo posle dopune, E2E 5K; nazivi faza na srpskom (G3); drugi I posle smanjenog prvog (p07 3×1000 → 6×800).

## Merne skripte (iz `web/`)
- `node ../docs/generators-v2/perfection/P8-5K/measure.ts <oznaka>` → `m-<oznaka>.json`, `fp-<oznaka>.json` (≈ 15 s).
- P0: `node ../docs/generators-v2/perfection/P0/measure.ts 5K` (PREPISUJE `P0/*-5K.json` — kopiraj pa `git checkout P0/`).
- P7 profili: `node P7/make-inputs.ts <inputs.json>`; `node P7/dump.ts <koren> <inputs.json> P8-5K/plans 5K`.
- Otisci regresije: `node ../docs/generators-v2/perfection/P8-5K/fixture15.ts <worktree 9055e5b>/web/src/domain/generators/fiveK/v2/ <g07|n08d|e08e|x08g>`
  (x08g ≈ 10 min). Pravljeni pre dopune; svi tokovi su „P8 promenjen" (`testInputs.markP8`), pa važe.
- Sabotaže: `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P8-5K/sabotage.json -q`.

## Zamke
- `node_modules` nije bio instaliran: `npx tsc` je ćutke ništa ne radio — prvo `npm ci`.
- Validator ponavlja odluke konstruktora: svaka nova granica mora i u validator (PEAK_MAIN_FLOOR uz G4/c, VOLUME_PEAK
  sa tempom KORAKA `pacesAt(input, steps, 1)`, ROLES za G7). Inače odbijanja tek u adaptacionim mrežama (08g, 08j, 08k).
- „Prvi I" po okvirima ≠ po nedeljama kad adaptacija ukine test → zato `isFirstIWeek` nad upisanim nedeljama.
- Dugi rasterećenja 0,8 × dugog skraćenog bolom pada ispod najkraćeg laganog → donja granica `easy.minKm`.
- Po osećaju rasterećenje gubi kvalitet kad je dugi na granici (lagan ≤ dugi) → `feel` room dozvoljava lagan = dugi.
- `segment08l` pomera brojeve nedelja regexom — spisak „u nedeljama 3, 6 i 9" mora da se zaštiti.
- Vitest ne štampa `console.log` prolaznih testova; za vrednosti baci `Error`.
