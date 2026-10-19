# HM v2 — Segment 01 (hm-v2.0.0): ZAUSTAVLJENO — nedelja 1 ispod trenutnog obima (H6/pouka 9 ↔ H13/H14/H10)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `3fec5c5`. Menjano samo
`web/src/domain/generators/halfMarathon/v2/**` i `docs/hm-v2/**`. Ovo je zaustavni commit (kao 10K 06c `888bf45`):
jezgro je napisano, ali brojevi § 4 se u mreži 01 međusobno ne mogu ispuniti — STANI po prompt-u segmenta, odluka
organizatora. Testovi segmenta (mreža, invarijante, sabotaže, primeri) NISU urađeni; urađeni su posle odluke.

## Stanje koda (prototip po obrascu tenK/v2, kopija, bez uvoza)

`policy.ts` (H1–H15 red 4 dana, DECISIONS H1–H17, HI2, HI3), `input.ts` (H1, H17), `paces.ts` (H2, H3), `periodize.ts`
(H4, H5), `schedule.ts` (H9), `volume.ts` (H6, kapacitet iz konstrukcije), `lengths.ts` (H13), `workouts.ts` (H10,
H14), `quality.ts` (H10–H12), `week.ts` (izgradnja, H5, H7, H8), `validate.ts` (samo prijavljuje), `generate.ts`,
`testInputs.ts` (mreža 01), `isolation.node.test.ts`. tsc/eslint/prettier čisti; `halfMarathon/index.ts`, HM v1 i lični
plan netaknuti.

## Sudar (izmereno)

Pouka 9 / H6: „nedelja 1 = trenutni obim; nedelja 1 < trenutni obim sme samo kad je dugi nedelje 1 na vremenskom
plafonu" (validator: `WEEK1_BELOW_START`, greška). Strukturni kapacitet nedelje 4 dana (pouka 9): Q1 + Q2 + dugi + lagan,
dugi ≤ 35 % (H15), lagan ≤ dugi (pouka 2), WU/CD fiksni (H14), početni nivoi (H12) → najveći obim ≈ (Q1 + Q2) / (1 − 2 ×
0,35) = (Q1 + Q2) / 0,3. Spor trkač ima kratke kvalitetne dane u km, pa kapacitet nedelje 1 pada ispod trenutnog obima,
a dugi je na udelu 35 %, ne na 150 min.

Primer `10w-35km-v30-A-sat` (VDOT 30, 35 km, WU/CD 15/10): Q1 R 6 × 200 m = 5,32 km, Q2 T 2,0 km = 5,12 km; pri cilju
35,0 dugi ≤ 12,2 km (35 %), lagan = 35,0 − 10,44 − 12,2 = 12,4 km > dugi → neizvodljivo; najveći izvodljiv cilj 34,6
km (dugi 12,1, lagan 12,1). Kapacitet nedelje 1 (raspored A, max cilj): VDOT 30 — 34,6 km (30–39,9 km obima) i 44,6 km
(40–59,9 km: duži WU/CD 20/15); VDOT 35 — 37,2 / 50,0 km; VDOT 40 — 40,0 / 56,3 km.

`node docs/hm-v2/artifacts/segment-01/measure-share.ts 0.35 0.37 0.38 0.40` (48 s; isti kod, udeo menja samo proces):

| udeo dugog (4 d) | mreža 01: odbijeno (`WEEK1_BELOW_START`)                                 | ned 1 < obim (sve na 150 min) | CAPACITY_LIMITED | DOSE_DROPPED | LONG_RUN_SHORT | gusto ned 1 (30 401 ulaz): ispod obima bez 150 min, najveći pad |
| ---------------- | ------------------------------------------------------------------------ | ----------------------------- | ---------------- | ------------ | -------------- | --------------------------------------------------------------- |
| 0,35 (H15)       | **396 / 3696** (35, 45, 50, 55, 60 km × VDOT 30; 55 km × VDOT 35; po 66) | 66                            | 468              | 66           | 528            | **2870**, 15,3 km (59,9 km VDOT 30 → 44,6)                      |
| 0,37             | 0                                                                        | 264                           | 774              | 102          | 528            | 2, 0,1 km (39,7 km VDOT 30)                                     |
| 0,38             | 0                                                                        | 264                           | 774              | 102          | 528            | 0                                                               |
| 0,40             | 0                                                                        | 264                           | 774              | 102          | 6              | 0                                                               |

Gusto: obim 30,0–60,0 km korak 0,1 × VDOT 30–80 korak 0,5, raspored A (nedelja 1 ne zavisi od broja nedelja ni rasporeda
kvalitetnih dana). Sa 0,37–0,40 CAPACITY_LIMITED i DOSE_DROPPED rastu samo zato što se uključuju 396 ranije odbijenih
planova (spori trkači velikog obima, dugi na 150 min). Ostalo u mreži 01 (0,35, 3300 planova): 0 drugih grešaka
validatora; taper i rasterećenje bez popuštanja (TAPER_RP_ONLY / TAPER_NO_QUALITY / DELOAD_NO_QUALITY: 0); trkačka ≤ taper
u svim; LONG_RUN_SHORT 528 = sve ćelije 30 km (vrh 42 km × 35 % = 14,7 km < 16).

Ostali brojevi § 4 se uklapaju (provereno): najniži nivo svake lestvice staje u plafon pri 30 km (pouka 10: R 1200 ≤ 1500,
I 2000 ≤ 2400, T 2000 ≤ 3000, T cruise 2400 ≤ 3000, RP 4000 ≤ 4500 m); RP 2 × 2000 m tapera staje (0 TAPER_NO_QUALITY);
T 2,0 km rasterećenja staje (0 DELOAD_NO_QUALITY).

## Predlozi (odluka organizatora; ja ne biram)

1. **P1 — udeo dugog 4 dana 0,35 → 0,38** (najmanji okrugao koji gusto daje 0; 0,37 ostavlja 2 ulaza sa padom 0,1 km).
   Mreža 01: 0 odbijanja; nedelja 1 ispod obima samo uz dugi na 150 min (264). LONG_RUN_SHORT ostaje 528 (30 km).
2. **P2 — udeo 0,40** (kao obrazac 10K 3 dana 0,40 → 0,45, 10k-v2.2.1): isto kao P1, a LONG_RUN_SHORT 528 → 6 (30 km
   VDOT 70) — dugi ≥ 16 km pri obimu 30 km. Dugi do 40 % nedelje je iznad Danielsove smernice 25–30 % (sekundarni izvor);
   pri 4 dana i dva kvalitetna dana to je cena kapaciteta.
3. **P3 — 0,35 ostaje, pouka 9 sa izuzetkom „i na udelu"** (kao privremeno odstupanje 10K D17 u 10k-v2.2.0): 396 planova
   kreće ispod trenutnog obima do −10,4 km u mreži (55 km VDOT 30 → 44,6), gusto do −15,3 km. Ne preporučujem (trkač od
   60 km dobija 50,6 km u nedelji 1).
4. P4 — duži WU/CD za spore trkače (po vremenu ili pojasu VDOT-a) — nov broj; nije mereno.

Moja procena (mišljenje, ne činjenica): P2 rešava i sudar i upozorenje 30 km; P1 je najmanja izmena broja.

## Otvorena pitanja

1. Izbor P1/P2/P3/P4 (ili drugo) za red 4 dana H15 (udeo dugog).
2. Tumačenje (bez novog broja, ostaje ako se ne kaže drugačije): broj deonica druge strukture 2–5 i korak 100/50 m
   preuzeti iz 10K v2 D10/D22 (H10 navodi samo najmanju deonicu); T 2,0 km rasterećenja/tapera u T cruise kao 2 × 1000 m;
   oporavak T cruise > 1600 m = 90 s, RP > 3000 m = 120 s (i 2 × 2400 m T kao druga struktura 4,8 km).
3. 3/5/6 dana u segmentu 01: `RUN_DAYS_COUNT` sa porukom „segment 02"; bez rezultata `RESULT_REQUIRED` (segment 03);
   početnik `BEGINNER_NOT_SUPPORTED` (segment 03); obim > 60 km sa 4 dana `WEEKLY_KM_TOO_HIGH`.

## Posle odluke (ostatak segmenta 01)

Testovi po fajlu i mreža 01 (brz uzorak, pun u delovima), nezavisne invarijante (Uslov 8, pouke 1–14), determinizam,
3 primera (`artifacts/segment-01/`), sabotaže (rasterećenje, plafon zone, dugi ≥ lagan, taper, trkačka), K1–K6, izveštaj
`SEGMENT-01-IMPLEMENTATION.md`, STATUS; `npm run check`.
