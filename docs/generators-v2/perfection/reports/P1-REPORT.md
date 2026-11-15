# P1 — polumaraton: specifičnost (blok RP u dugom, plafon i lestvica RP) — hm-v2.9.0

9. 11. 2026, 23:10 (Europe/Belgrade). Polaz `a952769` (hm-v2.8.0). Zadatak `briefs/P1-hm-specificnost.md`, odluke
`briefs/P1-odluke-posle-stop.md` (posle `P1-STOP.md`, 89f31c8) i **odluke posle STOP 2 (0b6e944)** iz poruke organizatora:
taper opcija (b); blok podleže plafonu RP (H11) — ne staje nivo → niži, ne staje prvi → nedelja A; F 5–6 d „B ne staje"
prihvaćeno (P-a); nedelje > 25 % brzih km pri cilju ≥ 40 km prihvaćene (raspodela dole). Izmene samo
`web/src/domain/generators/halfMarathon/v2/**`, plus snimak bajt-istosti maratonskog app sloja (vidi „Van foldera").

## Pravila (policy.ts: P1-S1, P1-S2, P1-S3, P1-T; dopunjeni H10, H11, H12; heuristike, odluke organizatora)

- **S1** (`specific.ts`, jedno mesto): raspored iz okvira — poslednja ne-rasteretna specifična nedelja je B, unazad A, B
  (`scheduledType`); samo redovan plan 4–6 dana. Nedelja B: isti izbor RP kao A (bez prekida lestvice), Q2 lagan (stanje
  T se ne menja), dugi `longBlockWorkout` — dužina iz `lengths.ts`, poslednjih X km kontinuirano RP. Blok
  (`chooseBlockKm`): sledeći nivo 4 → 6 → 8 posle poslednjeg bloka, najviši koji staje: ≤ 40 % dugog, trajanje (E sporim
  + RP) ≤ 150 min, ≤ plafon RP cilja nedelje, dan Q1 koji je ≤ lagan dugi ostaje ≤ dugi sa blokom. Ne staje → A +
  napomena (`B_MISSING_NOTE`). Po osećaju: blok nosi RPE 6–7.
- **H12 O1**: glavna doza = T + I + RP treninga + blok (`mainDoseM`); B se poredi sa poslednjom B, ostale sa poslednjom
  ne-B (`mainDoseRef`); RP slot i dalje ne opada iz nedelje u nedelju.
- **S2**: `caps.RP` po pojasu cilja (< 40 km 15 %, ≥ 40 km 20 %, `capShare` — jedna funkcija); lestvica RP + 3 × 5000 m
  (2 × 5000 m je postojao — premisa zadatka ispravljena u STOP-u). Početni nivo RP od plafona pojasa.
- **P1-T**: RP tapera = najviši nivo ≤ min(≈ 60 % poslednje RP doze, plafon RP cilja tapera), min 2 × 2000 m; napomena
  „Taper: RP x km umesto y km (≈ 60 %) — najviše 15 % nedeljnog obima tapera". Oštrenje po H8 kao pre.
- **S3**: A5 (umor) ne broji dugi sa blokom kao lagan; nedelja sa ograničenjima koraka, povratak (cilj samo naniže) i
  nov start — dugi lagan; LIMITS: dugi sa blokom je kvalitet; raspored A/B posle koraka iz novih okvira.
- **S4**: naslov „Dugi 22,4 km: 18,4 km lagano + 4,0 km u trkačkom tempu"; `app/structure.ts` daje lagan deo (opseg E) +
  rad RP (tempo RP), tekst za sat — bez izmene app koda; test u `segmentP1.node.test.ts`.
- Validator: LONG_BLOCK (mesto, struktura, nivo, granice), B_WEEK_T, B_WEEK_ORDER, B_WEEK_MISSING (plan bez adaptacije:
  blok staje a nema ga, ili nema napomene), RPE bloka, ROLES (Q2 lagan u B), MAIN_DOSE O1. `gridInvariants.ts` usklađen.
- Stalni uslovi: 1 jedno mesto (specific.ts, capShare, taperDoses); 2 jedan plafon RP (i za blok); 3 bez dopune WU/CD;
  6 `hm-v2.9.0`, faza nedelje nepromenjena; 7 bez novih uvoza van foldera; 8 invarijante i test obaraju degenerisan plan.

## Komande i trajanja (iz `web/`)

| | komanda | trajanje | ishod |
|---|---|---|---|
| M1 | `node ../docs/generators-v2/perfection/P1/measure.ts <pre\|s2\|posle>` (pre: worktree `a952769`; s2: isti kod, `bAllowed` → false) | ≈ 1,5 s | 192/192 |
| M2 | `node ../docs/generators-v2/perfection/P1/compare.ts pre <s2\|posle>` | < 1 s | tabele dole |
| M3 | `node ../docs/generators-v2/perfection/P1/over25.ts` | ≈ 2 s | raspodela > 25 % |
| M4 | `node ../docs/generators-v2/perfection/P1/bMissing.ts` | ≈ 2 s | uzroci B → A |
| M5 | `node ../docs/generators-v2/perfection/P1/taper.ts`; `taperGrid.ts <web/ na a952769>` | 2 s; ≈ 2,5 min | taper |
| M6 | `node ../docs/generators-v2/perfection/P1/changedP1.ts <web/ na a952769> > src/…/segmentP1.changed-a952769.json` | ≈ 4,5 min | 31 212 promena |
| M7 | `node ../docs/generators-v2/perfection/P1/profile.ts > ../docs/generators-v2/perfection/P1/profile-a-HM.txt` | ≈ 1 s | profil (a) |
| T1 | `npx vitest run --project node src/domain/generators/halfMarathon/v2` (brz, u toku rada, više puta) | 54–55 s | poslednji 347/347 |
| T2 | `npm run check` | 432 s | typecheck, lint, format OK; testovi 3852/3854 — pao `marathon/v2/app/byteSame` (snimak HM v2, vidi dole) |
| T3 | `npx vitest run --project node src/domain/generators/marathon/v2/app/byteSame.node.test.ts` (posle snimka) | 5 s | 2/2 |
| T4 | `npx vitest run --changed a952769` | 279 s | 342 fajla, 3854/3854 |
| T5 | `TEST_FULL=1 npx vitest run --project node src/domain/generators/halfMarathon/v2` | 627 s | 74 fajla, 439/439 |
| T6 | `npx playwright test e2e/hm-v2.spec.ts e2e/handoff-v2.spec.ts --trace off` | 71 s | 8/8 |
| S | `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P1/sabotage-P1.json --quiet` | 44,8 s | 6/6 palo |

Sabotaže (`P1/sabotage-P1.json`, rezultat `P1/sabotage-P1.result.json`, sve hvata `segmentP1.node.test.ts`): S1a blok u
rasterećenju i taperu; S1b nedelja B zadržava Q2; S2 plafon RP 25 %; S3 dugi sa blokom brojan kao lagan (umor); H12
glavna doza B poređena sa A; P1-T RP tapera bez plafona. Stanje `src` posle svake vraćeno (heš isti).

## Izmereno — mreža P0 (192 ulaza; R = sa rezultatom, n 144; medijana [min–max])

| metrika | hm-v2.8.0 | samo S2 | S1 + S2 |
|---|---|---|---|
| najveći RP trening [km] | 8 [5–12] | 9 [5–15] | 9 [5–15] |
| ukupno RP u planu (trening + blok) [km] | 30 [14–53] | 37 [14–69] | 45 [14–79] |
| dugih sa blokom | 0 | 0 | 2 [0–2] |
| najveći blok [km] | — | — | 6 [0–6] |
| % km bržih od E, specifična faza | 16,8 [7,7–21,9] | 19,4 [10–23,3] | 18,7 [10,5–23,5] |
| najduži dan nedelje [km] | 20,5 [14,5–24] | 21,2 [15–25,6] | 21,2 [15,6–25,6] |
| najduži dugi [km] / plato dugog [ned] | 20,5 / 7 | 20,5 / 6 | 20,5 / 6 |
| uzrok vrha RP: plafon / ≤ 1 nivo / kraj lestvice / pouka 32 | 76 / 57 / 10 / 1 | 37 / 68 / 35 / 4 | 37 / 68 / 35 / 4 |
| nedelje specifične faze > 25 % km bržih od E (sve porodice, od 776) | 0 | 84 | 81 |
| taper bez kvaliteta (sve porodice, od 192) | 16 | 16 | 16 |

- 0 odbijanja u sve tri varijante; promenjeno 159 / 192 (samo S2: 153). Po osećaju (F, n 32): ukupno RP 29 → 36,5 → 45 km,
  najveći RP trening 6 → 9 km. Početnik (B, n 16): bez nedelje B; RP 21 km kao pre.
- % km bržih od E u ne-rasteretnim specifičnim: nedelja A 16,3 [7,3–28,6] (n 388), nedelja B 21,2 [14,1–33,4] (n 260).
- Zahtevni treninzi u nedelji izgradnje (kvalitet/test + dugi sa blokom): najviše 2 u svih 192 planova (132 planova 2, 60
  planova 1 — 3 dana i početnik). Nedelja B ima RP trening i dugi sa blokom, bez T.
- Dugih sa blokom po pripremi (4–6 d): 10 ned 2 [1–2], 15 ned 2 [2–2], 20 ned 2 [0–2]; 3 d i početnik 0 (odluka).
  Nizovi tipova specifičnih ne-rasteretnih: BAB 82, ABAB 46, AAA 36 i AAAA 24 (3 d, početnik), ABAA 2, BAA 2.
- **B ne staje** (P-a, M4): R 4 d 0, R 5 d 0, R 6 d 1/36 (3 %), F 4 d 0, F 5 d 1/8 (13 %), F 6 d 2/8 (25 %) — prihvaćeno.
  Uzrok: F (lagan 450 s/km) 75–90 km — dugi na 150 min (19,3 km), Q1 RP 3 × 5000 m traje skoro koliko dugi, blok bi skratio
  trajanje dugog ispod dana Q1 (pouka 32); R-d6-40km-10w-v65 ned 8 — dužine pod granicom pouke 28.
- Orijentiri (nisu pragovi): ukupno RP ≥ 45 km — R 45, F 45; RP trening ≥ 10 km u planovima ≥ 50 km/ned 58 / 60; ≥ 2 duga
  sa blokom u pripremi ≥ 12 ned (R) 72 / 96 (ostalih 24 su 3 dana — bez nedelje B).

**Nedelje > 25 % km bržih od E** (M3; prihvaćeno, nije ispravljano): 81, sve pri cilju ≥ 40 km (42–85 km), 4–6 dana;
ukupno medijana 28,6 %, max 33,4 %. A: 4 d n 6, med 28,6, max 28,6; 5 d n 14, 26,1 / 27,1; 6 d n 4, 27,05 / 27,1. B: 4 d n 24,
28,6 / 33,4; 5 d n 20, 28,6 / 30,6; 6 d n 13, 26,8 / 28,6. Uzrok: RP do 20 % + T 10 % (A), RP + blok (B) pri cilju tik iznad
40 km. **> 30 %: 16 nedelja / 16 planova, sve tip B, poslednja ne-rasteretna nedelja pred taper:** R-d4-30km-15w-v35/45/55/65
ned 13 i R-d4-30km-20w-v35/45/55/65 ned 18 (cilj 42 km) 33,3–33,4 %; F-d4-30km-20w-e330/e450 ned 18 (42 km) 33,3 %;
R-d5-35km-20w-v35/45/55/65 i F-d5-35km-20w-e330/e450 ned 18 (49 km) 30,6 %.

**Taper (P1-T)**: mreže 02 + 03 (M5, 25 122 plana): taper bez kvaliteta 762 → 762 (pre P1-T 2127); svih 1365 iz STOP 2
vraćeno, zajedno sa oštrenjem; P0 16 → 16. RP tapera prosek 4649 → 5238 m.

## Promenjeni planovi (M6; `segmentP1.changed-a952769.json`, `grid.harness` `CHANGED_P1` u `mayChange`)

Mreže 02, 03 (po osećaju, početnik) i pouke 28 (`r-`), 36 066 ulaza: promenjeno 31 212 — **b** (dugi sa blokom, S1 uz S2)
27 651, **s** (samo S2: doze RP specifične faze, taper, oštrenje) 3 561, **d** 0, **x** 0. **Nedelje baze i razvoja
bajt-iste u svih 36 066** (S2 menja početni nivo RP, a RP postoji tek u specifičnoj fazi — izmereno: 0 razlika).
Planovi bez specifične faze sa RP ne postoje u mrežama (svaki plan ima specifičnu fazu ≥ 3 nedelje, H4).

## Profil (a) — pun ispis `P1/profile-a-HM.txt` (pre: `P0/profile-a-HM.txt`)

10 km 46:00, 40 km, uto/čet/sub/ned, 16 ned, skorašnji najduži 14 km, cilj 1:40. Specifična faza: ned 10 A (RP 2 × 3000 +
T 3 × 1600, dugi 22,4 lagano) · ned 11 B (RP 2 × 4000; čet lagan; dugi 22,4 = 18,4 + 4,0 km RP) · ned 12 rasterećenje (T 2 ×
1200) · ned 13 A (RP 3 × 3000 + T 2 × 2400) · ned 14 B (RP 2 × 5000; dugi 22,4 = 16,4 + 6,0 km RP) · ned 15 taper RP 2 × 2500
(≈ 60 % = 6000 > 15 % × 39,2 km) + T 2 × 1200 · ned 16 oštrenje 2 × 2000 + trka. RP: najveći trening 8 → 10 km (47 % trke),
ukupno 35 → 52 km (6 + 8 + 9 + 10 + blokovi 4 + 6 + taper 5 + oštrenje 4).

## Testovi i fajlovi

- Nov: `specific.ts`, `segmentP1.node.test.ts` (S1–S4, O1, P1-T; 10 testova), `segmentP1.changed-a952769.json`.
- Usklađeni sa novim brojevima (bez slabljenja provere): `policy.node` (verzija, lestvica, plafon, DECISIONS), `quality.node`
  (početni nivo RP pod 20 %), `validate.node` (ZONE_CAP 3 × 4000, doza tapera, nedelja sa Q2), `feel.node` (RPE bloka),
  `app/handoffTarget.node` (verzija), `gridInvariants` (pojas, B, O1, napomena tapera). **Oslabljen prag**:
  `segment07b.node` lanaca sa zaključanim Q1 + Q2 u brzom nivou > 5 → > 2 (nedelja B nema Q2; izmereno 3).

## Van foldera

`web/src/domain/generators/marathon/v2/app/byteSame.9443676.json` — snimak tokova svih generatora uključuje HM v2;
ponovo snimljen (`BYTE_SAME_RECORD=1`), promenjeno tačno 13 ključeva „HM v2 #…", 0 drugih (5K, 10K, HM v1, maraton, lični
plan isti; 223 ključa). Isti postupak kao HM-10 (`docs/hm-v2/artifacts/segment-10/byteSame-mar-HMv2-rows.json`).

## Šta nije urađeno / ograničenja

1. Validator proverava „nedelja po rasporedu B koja je A" (B_WEEK_MISSING) samo u planu bez adaptacije; u adaptiranom
   planu odluku „povratak / cilj po pravilu" donosi samo konstruktor.
2. Mreže adaptacije: pokrivene punim nivoom foldera (rana/srednja, 07b, 08b …); posebna adaptaciona mreža za nedelju B nije
   pravljena.
3. `npm run check` posle snimka bajt-istosti nije ponovljen u celini (T3 i T4 posle snimka prolaze).

## Mišljenje (odvojeno)

1. S1 u obliku posle STOP-a daje ono što je traženo: ukupni RP 30 → 45 km uz 2 duga sa blokom, bez novih odbijanja.
2. Nedelje B na dnu obima (cilj 42–49 km) idu do 33 % brzih km — tu bih ubuduće ograničio blok udelom nedelje, ne samo
   dugog; organizator je prihvatio.
3. Pojas RP sa granicom na 40 km je oštar (39,9 km → 15 %, 40 km → 20 %); taper ga sada poštuje (P1-T).
