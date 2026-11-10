# P5-10K STOP — F1 × F4: nova odbijanja MAIN_DOSE_DECREASE (10K v2)

10. 11. 2026 (Europe/Belgrade). Polazno `72003c1` (10k-v2.11.0). Patch F1 + F4 (bez F2/F3) nije ugrađen ni pushovan;
samo ova dokumentacija i merne skripte. Ćelija: medijana [min–max].

## Šta je izmereno

Komande (iz `web/`, nisu testovi):

- **K1** `node ../docs/generators-v2/perfection/P5-10K/measure.ts <oznaka>` — mreža P0 (192), ≈ 1 s.
- **K2** `node ../docs/generators-v2/perfection/P5-10K/bigGrid.ts <oznaka>` — mreže generatorskih testova 01 (3024),
  02 (15 840), po osećaju (11 880), početnik (3402), ≈ 70 s.
- **K3** `node ../docs/generators-v2/perfection/P5-10K/summary.cjs pre f1only f4only o1` — sažetak K1.
- Varijante: `pre` = 72003c1; `f1only` = samo F1; `f4only` = samo F4; `f14` = F1 + F4; `o1` = F1 + F4 + opcija O1.

| | pre | samo F1 | samo F4 | F1 + F4 | F1 + F4 + O1 |
|---|---|---|---|---|---|
| odbijanja, mreža P0 (192) | 0 | 0 | 0 | **2** | 0 |
| odbijanja, mreže 01 + 02 (18 864) | 0 | — | — | **126** | 0 |
| odbijanja, F + B (15 282) | 0 | — | — | 0 | 0 |
| planova sa WEEK_FITTED / nedelja (P0) | 76 / 475 | 76 / 471 | 71 / 451 | 69 / 425 | 71 / 444 |
| nedelja 1 ispod obima (P0) | 57 | 57 | 48 | 47 | 48 |
| R: ned 1 T rad [min] | 10,3 [6,9–20,9] | isto | 13,7 [6,9–28,3] | — | 13,7 [6,9–28,3] |
| R: prvi I rad [min] | 10,3 [6,3–15,7] | isto | 12,7 [6,3–21,3] | — | 12,7 [6,3–21,3] |
| R ≥ 12 ned: testova po planu; ned. od testa do trke | 0 | 1; 6,5 [6–7] | 0 | — | 1; 6,5 [6–7] |

F4 sam ne spušta izvodljivost (WEEK_FITTED 76 → 71 planova, ned 1 ispod obima 57 → 48). F1 sam: 0 odbijanja.

## Mehanizam (svih 128 odbijanja isti: `MAIN_DOSE_DECREASE … nedelja A, D34`)

Primer `R-d5-48km-18w-v35` (5 dana, 48 km, VDOT 35, 18 ned): F4 diže T, pa je u nedelji 10 T 4 × 1500 m (6,0 km) uz
I 4 × 1200 m. Nedelja 11 = kontrolni test (poslednja ne-rasteretna nedelja razvoja): sa testom (WU 25 + 5 km + CD 15)
nijedan cilj ≥ 60 km ne može da se sastavi (dugi/lagani), pa je cilj spušten na 58,2 km (WEEK_FITTED) i T 6,0 km više
ne staje u 10 % — druga pretraga spušta T na 5 × 1000 m (DOSE_DROPPED, D11 ispred D12; ispravno po D12). Validator
„glavna doza ne opada" (D27) preskače test nedelju i zato ne vidi spuštanje: prva specifična nedelja A (13: RP 5 × 1000 +
T 2 × 2500 = 10,0 km) poredi se sa nedeljom 10 (I 4,8 + T 6,0 = 10,8 km) → greška. Bez testa ista nedelja 13 sama nosi
spuštanje (korak `drop`) i izuzeta je; sa testom je spuštanje u nedelji koju provera preskače. Pogođeni: samo 4 i 5
dana, 16–18 nedelja (02: d4 6 × 3, d5 30 × 3; P0: d5 48 i 65 km, 18 ned).

Po postojećim tumačenjima ovo nije rešeno: D27 kaže „provera glavne doze preskače test nedelju", a ne kaže šta je
referenca kad test nedelja spusti drugi slot. Zato STOP (nova odbijanja ulaza koji su davali plan).

## Opcije

- **O1 (preporuka; samo validator, bez promene plana):** test nedelja u kojoj je drugi slot spušten (korak `drop`,
  DOSE_DROPPED) postaje referenca glavne doze za sledeće nedelje (kao svaka nedelja sa spuštanjem); test nedelja bez
  spuštanja se i dalje preskače. Izmereno: 0 odbijanja (P0 i sve četiri mreže), planovi isti kao F1 + F4.
- **O2 (konstruktor):** u nedelji testa ni drugi slot ne menja stanje (T nastavlja od doze pre testa, 6,0 km). Prva
  specifična nedelja tada opet ne nosi T 6,0 km (cilj 58,3 km) i spušta ga sama. Traži i izmenu lanca doza u validatoru
  (sa nepromenjenim validatorom 76/192 odbijanja na mreži P0 — nije dalje mereno).
- **O3 (mesto testa):** kontrolni test u pretposlednjoj ne-rasteretnoj nedelji razvoja ili prvoj nedelji specifične
  faze — menja F1, nije mereno.

## Šta radim dok čekam (ne zavisi od odluke)

F3 (ubrzanja), F2 (kvalitet u adaptaciji), prikaz u `v2/app/`, redovi u `policy.ts`, merne skripte; kod O1 je pod
privremenim prekidačem samo u mernim skriptama. Ako odluka bude O2/O3, menja se samo deo F1.

## Otvorena pitanja

1. O1, O2 ili O3?
2. Nedelje > 25 % km bržih od E: 5 → 7 sa F1 (test 5 km se broji kao brz). Prihvatljivo?
3. A13 za kontrolni test: postojeće pravilo premešta test samo dok je plan po osećaju; test plana sa rezultatom u
   nedelji sa ograničenjem (bol, pauza, prinudno rasterećenje) zato otpada, ne premešta se. Prihvatljivo („ništa novo u
   adaptaciji")?

## Dopuna (10. 11. 2026): F4 × „dan kvaliteta ≤ dugi" (pouka 35)

Pouka 35 ne obara plan (drugi dan kvaliteta postaje lagan), ali je u listi „stani i javi". Mreža 02 (15 840), nedelje
izgradnje sa drugim danom kvaliteta laganim — `node ../docs/generators-v2/perfection/P5-10K/p35split.ts` (iz `web/`
starog i novog stabla) i K2:

| | 72003c1 | F1–F4 (+ O1) |
|---|---|---|
| nedelja / planova (02) | 342 / 132 | 660 / 330 |
| po danima | 6 d: 342 | 6 d: 594, 5 d: 66 |
| obim / VDOT | 35 km; VDOT 70 276, 60 66 | 35 km 528, 40 i 45 km po 66; VDOT 70 528, 60 132 |
| nedelja 1 / 2 / 3+ | 66 / 132 / 144 | 330 / 132 / 198 |
| po osećaju (F, 11 880) | 120 / 66 | 138 / 66 |
| „dva dana ostaju" (upozorenje) | 0 | 0 |

Uzrok: veća početna T/I doza (80 %) kod brzog trkača na dnu obima reda (5–6 dana, 35–45 km, VDOT 60–70): WU/CD + rad >
dugi, pa nedelja izgradnje (najviše nedelja 1) ima jedan kvalitet. Odbijanja 0. Opcije: **P-a** prihvatiti (pravilo
radi kako je zamišljeno; brz trkač malog obima dobija jedan veći kvalitet umesto dva); **P-b** F4 samo kad sa većom
dozom ne nastaje nedelja pouke 35 (inače 60 %) — nije mereno, znači drugo mesto odluke početnog nivoa (week.ts), što
sudara stalni uslov 1 ako se ne radi u jednoj funkciji. Preporuka: P-a.
