# P1 — STOP 2: plafon RP po pojasu (S2) × taper (H7) i oštrenje (H8)

9. 11. 2026, Europe/Belgrade. Polaz `a952769` (hm-v2.8.0) + odluke `briefs/P1-odluke-posle-stop.md`. Sve odluke
organizatora su ugrađene (S1 novo, raspored unazad, H12 O1, P-a, S2 pojas, S3, S4, sabotaže, testovi brzog nivoa).
**Kod NIJE pushovan** — jedan nov sudar. Ceo rad: `docs/generators-v2/perfection/P1/p1-v2.patch` (18 fajlova `web/src`;
spisak promenjenih planova se pravi komandom K7). Push samo `docs/**`.

## Sudar: taper bez kvaliteta i trkačka nedelja bez oštrenja (K8, K9)

Taper ima cilj 0,7 × vrh. Kad je vrh 40–57 km, taper je < 40 km → plafon RP 15 %, a doza RP tapera je ≈ 60 % poslednje RP
doze, koja je sada izabrana pod plafonom 20 % (cilj ≥ 40 km). Kad 60 % ne staje u 15 %, taper ostaje bez kvaliteta
(„ni RP 2 × 2000 m ne staje u plafon 15 %" — napomena nije tačna: 2 × 2000 m staje, ne staje doza ≈ 60 %), pa po H8
trkačka nedelja ostaje i bez oštrenja. Profil (a) je u toj klasi: vrh 56 km, poslednji RP 10 000 m, taper 39,2 km
(plafon 5880 m < 6000 m).

| mreže 02 + 03 (K9) | planova | taper bez kvaliteta pre → posle | novih (svi i bez oštrenja) | opcija (b) vraća RP |
|---|---|---|---|---|
| R 3 / 4 / 5 / 6 d | 2640 / 3696 / 4752 / 5808 | 552→912 / 0→240 / 0→210 / 0→180 | 360 / 240 / 210 / 180 | sve |
| F 3 / 4 / 5 / 6 d | 990 / 1386 / 1782 / 2178 | 210→330 / 0→90 / 0→90 / 0→75 | 120 / 90 / 90 / 75 | sve |
| B 4 / 5 d | 945 / 945 | 0 / 0 | 0 | — |
| **ukupno** | 25 122 | 762 → 2127 | **1365 (5,4 %)** | 1365 |

Mreža P0 (K8): 16 → 26 / 192; opcije (b) i (d) vraćaju RP u svih 10.

Opcije (nijedna nije uvedena):
- **(b)** RP tapera = najviši nivo lestvice ≤ min(≈ 60 % poslednje, plafon tapera), najmanje 2 × 2000 m (H11 ispred H7 u
  taperu kao u „drugoj pretrazi"); vraća 1365 / 1365, oštrenje se vraća sa njim. Nov tekst napomene.
- **(d)** plafon RP tapera (i trkačke nedelje) po pojasu VRHA plana umesto cilja tapera (vrh ≥ 40 km → 20 %); P0: 10 / 10.
  Uvodi drugi ključ pojasa (uslov 2: jedan plafon) — mišljenje: slabije od (b).
- **(a)** prihvatiti (5,4 % planova bez kvaliteta tapera i bez oštrenja).

Zbog sudara ne prolazi i jedan postojeći test: `adapt.node.test.ts` „taper samo RP (druga pretraga)" (d6-20w-50km-v60,
pauza 20) — taper je sada bez kvaliteta umesto RP 4,0 km. Nije menjan.

## Komande (iz `web/`; sve ≈ 1–3 s osim označenih)

- **K0** `git apply ../docs/generators-v2/perfection/P1/p1-v2.patch` na `a952769` (ili posle ovog commita).
- **K1** pre: worktree na `a952769`, `node ../docs/generators-v2/perfection/P1/measure.ts pre`; **K2** samo S2: isti kod
  uz `bAllowed` → `false` (specific.ts), `measure.ts s2`; **K3** `measure.ts posle`; poređenje
  `node ../docs/generators-v2/perfection/P1/compare.ts pre <s2|posle>`.
- **K4** `node ../docs/generators-v2/perfection/P1/over25.ts` (nedelje > 25 % km bržih od E).
- **K5** `node ../docs/generators-v2/perfection/P1/bMissing.ts` (uzrok nedelje B koja je A).
- **K6** `node ../docs/generators-v2/perfection/P1/profile.ts > ../docs/generators-v2/perfection/P1/profile-a-HM.txt`.
- **K7** `node ../docs/generators-v2/perfection/P1/changedP1.ts <web/ na a952769> > src/domain/generators/halfMarathon/v2/segmentP1.changed-a952769.json` — 4 min 32 s.
- **K8** `node ../docs/generators-v2/perfection/P1/taper.ts`; **K9** `node ../docs/generators-v2/perfection/P1/taperGrid.ts <web/ na a952769>` — 2 min 23 s.
- **T1** `npx vitest run --project node src/domain/generators/halfMarathon/v2` (brz nivo foldera, u toku rada) — 54 s:
  346 testova, 2 pala: gornji test tapera i DECISIONS (spisak id-jeva; posle ispravljen, `policy.node.test.ts` 10 / 10). **T2**
  `npx vitest run --project node src/domain/generators/halfMarathon/v2/segmentP1.node.test.ts` — 9 / 9, ≈ 3 s.
- **S** `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P1/sabotage-P1.json --quiet` — 5 / 5 palo, 26,6 s
  (`P1/sabotage-P1.result.json`): blok u rasterećenju/taperu, nedelja B zadržava Q2, plafon RP 25 %, dugi sa blokom brojan
  kao lagan (umor), glavna doza B poređena sa A.
- Nisu pokretani (zbog STOP-a): `npm run check`, `--changed`, pun nivo `halfMarathon/v2`, E2E. `tsc -b`, eslint i prettier
  foldera: čisto.

## Ugrađeno (patch)

- S1 (`specific.ts`, jedno mesto): `scheduledType` (poslednja ne-rasteretna specifična B, unazad A, B), `bAllowed` (4–6 dana,
  ne početnik, bez ograničenja i testa, cilj po pravilu), `chooseBlockKm` (4 → 6 → 8, jedan nivo po B; ≤ 40 % dugog,
  trajanje ≤ 150 min, **blok ≤ plafon RP (H11)** — tumačenje, vidi pitanje 2; dan Q1 ≤ dugi sa blokom), `mainDoseM` sa
  blokom, `mainDoseRef` (O1). `week.ts`: nedelja B = isti izbor doza kao A, Q2 lagan (stanje T se ne menja), dugi
  `longBlockWorkout`; B ne staje → A + `B_MISSING_NOTE`. Validator: LONG_BLOCK, B_WEEK_T, B_WEEK_ORDER, B_WEEK_MISSING
  (plan bez adaptacije), RPE bloka, ROLES, LIMITS, MAIN_DOSE O1. `gridInvariants.ts` usklađen (plafon po pojasu, nedelja B,
  O1).
- S2: `caps.RP` tabela `{ < 40 km 15 %, ≥ 40 km 20 % }`, `capShare` (jedna funkcija za izbor, validator, poruke), lestvica
  + 3 × 5000 m. S3: A5 ne broji dugi sa blokom kao lagan; ograničenja / povratak / nov start → dugi lagan; raspored iz
  okvira. S4: naslov „Dugi 22,4 km: 18,4 km lagano + 4,0 km u trkačkom tempu", struktura lagan deo (opseg E) + rad RP
  (tempo RP), tekst za sat — test u `segmentP1.node.test.ts`.
- `policy.ts`: `hm-v2.9.0`, redovi P1-S1, P1-S2, P1-S3; H10/H11/H12 dopunjeni.

## Izmereno (mreža P0, 192 ulaza; R n 144; medijana [min–max]) — K1–K6

| metrika | hm-v2.8.0 | samo S2 | S1 + S2 |
|---|---|---|---|
| najveći RP trening [km] | 8 [5–12] | 9 [5–15] | 9 [5–15] |
| ukupno RP u planu (trening + blok) [km] | 30 [14–53] | 35 [14–69] | 43 [14–79] |
| dugih sa blokom | 0 | 0 | 2 [0–2] |
| najveći blok [km] | — | — | 6 [0–6] |
| % km bržih od E, specifična faza | 16,8 [7,7–21,9] | 19,4 [10–23,3] | 18,7 [10,5–23,5] |
| najduži dan nedelje [km] | 20,5 [14,5–24] | 21,2 [15–25,6] | 21,2 [15,6–25,6] |
| uzrok vrha RP: plafon / ≤ 1 nivo / kraj lestvice / pouka 32 | 76 / 57 / 10 / 1 | 37 / 68 / 35 / 4 | 37 / 68 / 35 / 4 |
| nedelja specifične faze > 25 % km bržih od E (sve porodice, od 776) | 0 | 84 | 81 |
| taper bez kvaliteta (sve porodice, od 192) | 16 | — | 26 |

- 0 odbijanja; promenjeno 159 / 192 (S2 sam 153). F (n 32): ukupno RP 29 → 43 km; početnik (B): bez promene RP (nema nedelje
  B), 21 km.
- % km bržih od E, ne-rasteretne specifične: nedelja A 16,3 [7,3–28,6] (n 388), nedelja B 21,2 [14,1–33,4] (n 260).
- Zahtevnih treninga u nedelji izgradnje (kvalitet/test + dugi sa blokom): najviše 2 u svim planovima (132 plana 2, 60
  planova 1 — 3 dana i početnik). Nedelja B: RP trening + dugi sa blokom, bez T.
- Dugih sa blokom po pripremi (4–6 d): 10 ned 2 [1–2]; 15 ned 2 [2–2]; 20 ned 2 [0–2]; 3 d i početnik 0. Niz tipova
  specifičnih ne-rasteretnih: BAB 82, ABAB 46, AAA 36 i AAAA 24 (3 d i početnik — bez B), ABAA 2, BAA 2.
- B ne staje (P-a): R 4/5 d 0 %, R 6 d 1/36 (3 %), F 4 d 0, F 5 d 1/8 (13 %), F 6 d 2/8 (25 %). Uzrok (K5): F (lagan 450
  s/km) 75–90 km — dugi na 150 min (19,3 km), Q1 RP 3 × 5000 m traje skoro kao dugi, a blok skraćuje trajanje dugog (pouka 32);
  R-d6-40km-10w-v65 ned 8 — dužine pod granicom pouke 28.
- Nedelje > 25 % (K4): sve na cilju ≥ 40 km (42–85), 4–6 dana; B 57, A 24; uzrok: RP do 20 % + T 10 % (+ blok u B). Pojas
  15 % ispod 40 km ih nije uklonio (nijedna nije bila ispod 40 km posle izmene). Nisu ispravljane.
- Orijentiri: ukupno RP ≥ 45 km — 43 (R), 43 (F); RP ≥ 10 km u planovima ≥ 50 km/ned 58 / 60; ≥ 2 duga sa blokom u pripremi
  ≥ 12 ned (R) 72 / 96 (preostalih 24 su 3 dana).
- Promenjeni planovi (K7, mreže 02, 03, pouka 28; 36 066 ulaza): klasa b (blok) 27 651, s (samo S2) 3 561, d 0, x 0;
  **nedelje baze i razvoja bajt-iste u svih 36 066** (S2 menja početni nivo samo RP, koji postoji tek u specifičnoj fazi).
- Profil (a) (`P1/profile-a-HM.txt`, pun ispis): specifična A (RP 2 × 3000 + T 3 × 1600) · B (RP 2 × 4000; dugi 22,4: 18,4 +
  4,0 km RP) · rasterećenje · A (RP 3 × 3000 + T 2 × 2400) · B (RP 2 × 5000; dugi 22,4: 16,4 + 6,0 km RP) · **taper bez
  kvaliteta** (sudar) · trkačka bez oštrenja. RP: najveći trening 10 km (pre 8), ukupno 43 km = 6 + 8 + 9 + 10 + blokovi 4 + 6 (pre 35, uz taper 4 i oštrenje 4).

## Otvorena pitanja

1. Taper: (b) / (d) / (a)? (mišljenje: (b))
2. Blok RP pod plafonom H11 (konstruktor ga bira ≤ plafon RP cilja nedelje) — bez toga adaptacija daje ZONE_CAP odbijanja
   (rana mreža 7 tokova, 08b 2: blok 6 km pri cilju 37,8 km). Potvrda ili izuzetak bloka iz H11?
3. F 5–6 d: B ne staje u 13–25 % planova (uzrok gore) — prihvatljivo?
4. Nedelje > 25 % km bržih od E: 81 / 776, sve na cilju ≥ 40 km — prihvatljivo?
