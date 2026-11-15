# P4 — 5K: doza intervala i trkačkog tempa, brži trkači (5k-v2.13.0)

10. 11. 2026 (Europe/Belgrade). Polazni SHA `a859ca7` (5k-v2.12.0); STOP `42c24f7` (`P4-STOP.md`), STOP 2 i STOP 3
(`P4-STOP2.md`, poruke organizatoru) sa odlukama ispod. Menjano samo `web/src/domain/generators/fiveK/v2/**`, fiksture
byteSame 10K/HM/MAR (samo ključevi „5K v2") i dokumentacija.

## Odluke posle STOP 42c24f7 (organizator)

1. S1 ide kako je izmereno. 2. S2: granica VDOT 70 uz strukturisano odbijanje degenerisane klase — posle STOP 2 varijanta
**B2**: 3 dana + obim < 12,1 km + VDOT ≥ 66 → `VOLUME_LOW_FOR_PACE` sa preporukom (veći obim ili 4 dana). 3. Oštrenje
2–3 × 300 m RP < 60 s na VDOT ≥ 63: **O-d** prihvaćeno (oštrenje, ne I trening); pravilo „deonica ≥ 60 s" važi za I/RP
u izgradnji. 4. `maxReps` na 5 dana se ne dira. 5. S3 samo u izveštaj. STOP 3 (10 novih odbijanja adaptacije, I_REP 306 s > 300 s): **F1** prihvaćen — dopuna pouke 23 za I/RP, bez novog
trenerskog broja.

## Šta je ugrađeno

| pravilo | mesto | oznaka |
|---|---|---|
| S1 jedan plafon I (uključujući RP): cilj < 40 km 10 %, ≥ 40 km 12 % (bilo 8 %) | `policy.quality.iMaxShareByTargetKm`; jedino čitanje `workouts.iMaxShareOf` (budžet konstruktora, po osećaju, početnik; validator `I_SHARE`) | heuristika |
| S2 opseg VDOT 30–70 (bilo 30–60) | `policy.input.vdot` (ulaz, assess A1, Forma) | heuristika |
| B2 3 d + < 12,1 km + VDOT ≥ 66 → `VOLUME_LOW_FOR_PACE` | `policy.input.lowVolumeForPace`; `input.lowVolumeForPace` u ulazu, `assess.resultUse` (RESULT_IGNORED uz tekst `assess.outOfRangeText`), validatoru i Formi | heuristika, odluka organizatora |
| O-d oštrenje < 60 s prihvaćeno | `DECISIONS` 5k-v2.13.0 | svesna odluka |
| F1 zadržana I/RP doza (gušći oporavak, zadržan I) staje u `iRepMaxSec` na tekućem tempu | `workouts.altMain`, `peakWeek` | postojeće pravilo (pouka 23) |
| S3 merni helper (bez izbora) | `feel.feelDoseHeld` | — |

`policyVersion` 5k-v2.13.0; `app/plan.ts KNOWN_VERSIONS` + 5k-v2.12.0 (sačuvan plan se prilagođava po 2.13.0); red u
`DECISIONS`. Uslovi 1–8: jedan vlasnik (S1 jedna funkcija; B2 jedna funkcija za ulaz/assess/validator/Formu), jedan
plafon po zoni, WU/CD nepromenjeni, adaptacija čita isto pravilo (A1), plan nosi policyId/Version i fazu, 0 novih
uvoza van foldera (`isolation.node.test.ts` prolazi), degenerisan plan: test `p4.node.test.ts` (VDOT 62–70 × 3–5 d).

## Komande merenja (iz `web/`, ≈ 2–25 s svaka; nisu testovi)

- **K1** `node ../docs/generators-v2/perfection/P4/measure.ts pre|posle` (pre: na `a859ca7` uz
  `git apply --include='*/feel.ts' ../docs/generators-v2/perfection/P4/s1s2s3-wip.patch`) — 328 ulaza (P0 148, V 108, G 72).
- **K2** `node ../docs/generators-v2/perfection/P4/compare.ts pre posle` → `P4/compare-pre-posle.txt`.
- **K3** `node ../docs/generators-v2/perfection/P4/profile.ts b` i `profile.ts <dani> <km> <ned> <vdot>` → `P4/profile-*.txt`.
- **K4** `node ../docs/generators-v2/perfection/P4/dense.ts pre|posle` — 9 504 ulaza (3–5 d × svaki ceo km × 6–16 ned × 9 VDOT).
- **K5** `node ../docs/generators-v2/perfection/P4/edge.ts` — VDOT 60–70 korak 1; fina mreža B2 (3 927 ulaza) opisana u `P4-STOP2.md`.
- **K6** `node ../docs/generators-v2/perfection/P4/fixture13.ts <a859ca7 v2 dir> g07|n08d|e08e|x08g` — otisci regresije.

## Pre / posle (K2; mreža P0, trkač sa rezultatom VDOT 35/45/55, n 81; medijana [min–max])

| metrika | pre (5k-v2.12.0) | posle (5k-v2.13.0) |
|---|---|---|
| I rad prvi / najveći [min] | 10,3 / 11 [4,3–20,8] | 12,5 / 13,7 [5,1–26] |
| RP rad prvi / najveći [min] | 10,5 / 10,9 [3,7–21,6] | 13 / 13,5 [4,4–26,2] |
| najveći RP trening [km] (% trke) | 2,5 [1–5] (50 %) | 3,2 [1,2–6] (64 %) |
| ukupno RP u planu [km] | 6,5 [1,6–15,4] | 8,5 [1,8–19,6] |
| % km bržih od E: baza / vrhunac / oštrenje / taper | 11,5 / 12,7 / 11,7 / 11,5 | 11,5 / 15 / 13,3 / 13,8 |
| R / T najveći [min]; najduži dugi [km] | 6,4 / 13,9; 12 | 6,4 / 13,9; 12 (bez promene) |
| nedelje > 25 % km bržih od E (cela mreža) | 4 (sve F, 12–15 km, 330 s/km) | 4 (iste; navedene, ne ispravljane) |
| odbijeno (P0) | 27 (VDOT 65) | 0 |

Mreža G (4–5 d, 30–65 km, n 72): I najveći 14,5 → 21,7 min; najveći RP trening 3,6 → 5 km (72 → 100 % trke; max 6 ×
1000 m); ukupno RP 10,4 → 14,4 km. Po osećaju (n 24): I najveći 12,8 → 14 min. Početnik (n 16): RP najveći 7,3 → 8,7 min.
Posredno (S1 → kapacitet obima „lagan ≤ dugi" uz veći kvalitet): vrh cilja veći u 27/193 plana, najviše +0,8 km (+2,2 %);
START_ABOVE_CAPACITY 37 → 37.

Profil (b) (5K 20:25, 30 km, 4 d, 8 ned; `P4/profile-b-5K-{pre,posle}.txt`): I 2 × 1200 / 5 × 500 m (9,6 / 10 min) →
4 × 800 / 5 × 700 m (12,8 / 14 min); RP 5 × 500 m (10,3 min) → 4 × 800 m (13,1 min); taper RP 2 × 1000 → 3 × 1000 m;
najveći RP 2,5 → 3,2 km; oštrenje 3 × 400 → 4 × 400 m. Orijentiri: I vrh ≥ 12 min ✓ (14), RP ≥ 3 km medijana ✓ (3,2).

## Uzrok vrha (K2; R = trkač sa rezultatom, P0 + G + V)

| dani | I posle | RP posle | pre (I / RP) |
|---|---|---|---|
| 3 | plafon udela 57 %, ≤ 1 korak 43 % | plafon 100 % | plafon 67 % / 100 % |
| 4 | plafon 52 %, ≤ 1 korak 48 % | plafon 61 %, ≤ 1 korak 39 % | plafon 41 % / 62 % |
| 5 | **maxReps 50 %**, plafon 35 %, ≤ 1 korak 15 % | **maxReps 69 %**, plafon 25 %, ≤ 1 korak 6 % | maxReps 0 % |

Prijava po S1: na 5 dana vrh I/RP drži `maxReps` (6) u 50 % / 69 % planova; `iRepMaxSec` i ponuda dužina nikad. Ne
menja se u ovom segmentu (odluka 4).

S3 (po osećaju i početnik; `feel.feelDoseHeld`): dozu drži dužina faze (≤ 1 korak nedeljno) u 115/131 (88 %) pre i
117/131 (89 %) posle; plafon udela 9 → 7; kraj ponude 7 → 7 (usponi 12 × 45 s na 4–5 d; tempo 5 d plafon T bloka).

## S2 i B2 (K4, K5, K3)

- Gusta mreža posle: 0 WEEK_DEGENERATE i 0 nedelja < minWeekKm na svih 9 VDOT-a; odbijeno 11 po VDOT-u 66/68/70 (12 km
  × 6–16 ned, B2), 0 na ≤ 64; QUALITY_REDUCED 2 po VDOT-u 62/64 (12 km, 6–7 ned, nedelja 3, uz upozorenje), 0 na ≤ 60
  (pre S1: 2 po VDOT-u). Fina mreža B2 (3 927): odbijeno 99, WEEK_DEGENERATE 0.
- I/RP deonica < 60 s u izgradnji: 0; oštrenje trkačke < 60 s: 33 (VDOT 64) / 22 (66–70) od 1 056 (O-d). Oporavak >
  2 × rad (I/RP/T): 0. Dan kvaliteta duži od dugog: 6 → 6 planova, svi sa LONG_SHORTER_THAN_QUALITY.
- Ispis VDOT 62/65/68/70 × 4 d 35 km i 5 d 50 km (12 ned): `P4/profile-v*-d{4,5}-*-12w.txt` — tempo monoton (VDOT 70: E
  234–258, T 194, I 179, RP 179, R 168 s/km), I 700–1200 m (2:05–3:35), RP 600–1000 m, R 150–400 m, dugi 13–17 km /
  53–70 min; nijedna prazna nedelja.

## Promenjeni planovi i otisci regresije (K1, K4, K6)

- K1 (oba ok): P0 R 81/81, F 20/24 (F 5 d 4/8), B 16/16, G 72/72; gusta mreža VDOT ≤ 60: 4 224/4 224 (S1 menja budžet
  svake nedelje).
- Otisci prema a859ca7 (`segment13.*-a859ca7.json`, zamenjuju `segment10.*-b9c4728.json`; razlog P4 = oznaka
  `testInputs.markP4` na tekućem rezultatu, CH = lanac): g07 644/700 (P4), n08d 942/1 124 (P4 938, CH 4), e08e 16 804/16 804
  (P4), x08g 104 800/104 800 (P4 71 264, CH 33 536); 0 tokova bez razloga, 0 odbijanja. Bez F1 x08g je imao 10 novih
  odbijanja (`PLAN_VIOLATES_POLICY`/I_REP, 5 d / 50–60 km / VDOT 38, sporiji rezultat u vrhuncu) → F1 → 0; tih 10 tokova
  sada ima „jedan kvalitet doze rasterećenja" (6 × 800 m) 1–2 nedelje. Trajanje K6: g07 5 s, n08d 8 s, e08e 111 s, x08g 579 s.
- Van foldera (byteSame, `BYTE_SAME_RECORD=1`): 10K `byteSame.068410b` 19/140 ključeva, HM `28da6af` 13/150, MAR
  `9443676` 13/223 — svi promenjeni ključevi počinju sa „5K v2", 0 drugih.

## Testovi i sabotaže

| komanda (iz `web/`) | trajanje | ishod |
|---|---|---|
| `npx vitest run src/domain/generators/fiveK/v2/p4.node.test.ts` (namenski, više puta u toku rada) | ≈ 2 s | 12/12 |
| `npx vitest run --project node src/domain/generators/fiveK/v2` (brz, u toku rada, pre otisaka) | 44 s | 44 pada → popravljeni (verzija, VDOT 70, brojevi primera, otisci) |
| `npx vitest run --project node src/domain/generators/{tenK,halfMarathon,marathon}/v2/app/byteSame.node.test.ts` (+ `BYTE_SAME_RECORD=1`) | 7 s | 6/6 posle snimka |
| `npx playwright test e2e/fivek-v2.spec.ts --trace off` | 40 s | 3/3 |
| `npm run typecheck` | 37 s | 0 grešaka |
| `npm run check` (1.) | 419 s | 3874/3878 — app.node 2, segment08e 1, `features/onboarding/fiveKV2Flow.test.tsx` 1 (oznaka verzije) → popravljeno |
| `npx vitest run --changed a859ca7` | 133 s | 1927/1927 (150 fajlova) |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 237 s | 787/787 (41 fajl) |
| `npm run check` (2., posle ispravki) | 343 s | 3878/3878 (344 fajla); typecheck, lint, format OK |

Van foldera `fiveK/v2` u testovima: samo oznaka verzije u `src/features/onboarding/fiveKV2Flow.test.tsx` i tri byteSame
JSON-a (gore). Nije pokretano: `check:full`, pun nivo drugih distanci, projekat `v1`.

Sabotaže (`node scripts/sabotage.mjs ../docs/generators-v2/perfection/P4/sabotage.json`, brz nivo, `--bail=1`):
**8/8 palo, 19,5 s**, stanje `src` isto posle (`P4/sabotage-result.json`): S1 plafon
15 % (< 40 km i ≥ 40 km), S2 granica 75, B2 od VDOT 67, B2 bez provere u validatoru, B2 rezultat primenjen u adaptaciji,
F1 gušći oporavak i zadržan I bez provere trajanja — svaku obara `p4.node.test.ts`.

## Mišljenje (odvojeno od merenja)

1. S1 daje ono što je traženo (I/RP doza +25–30 %, RP trening ≥ 3 km), ali na 5 dana vrh odmah udara u `maxReps` 6 —
   sledeći rast doze je pitanje lestvice (npr. 1200 m ponavljanja RP ili 7–8 ponavljanja), ne budžeta.
2. Najveći RP trening 6 × 1000 m (120 % trke) na 50–65 km je klasičan 5K trening, ali je vrh I/RP sada 26 min rada —
   vredi slepe trenerske ocene u P7 zajedno sa udelom km bržih od E (vrhunac medijana 15 %, max 20,6 %).
3. F1 je ispravka propusta, ali otkriva da posle sporijeg rezultata u vrhuncu nema „blagog" pada doze sa dva kvaliteta —
   kandidat za P5 (petlja forme).
