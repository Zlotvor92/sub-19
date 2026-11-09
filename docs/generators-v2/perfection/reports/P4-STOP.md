# P4 — STOP: degenerisan plan na VDOT > 60 (5K, S2)

9. 11. 2026, 23:50 (Europe/Belgrade). Polazni SHA `a859ca7` (5k-v2.12.0). Kod NIJE ugrađen u `web/src` ni pushovan:
stanje rada S1 + S2 + instrument S3 (5k-v2.13.0) je u `docs/generators-v2/perfection/P4/s1s2s3-wip.patch`.
Testovi nisu pokretani (kod nije ostao u stablu; odeljak „Testovi": segment bez izmene `web/src` → nijedan test).

Uslov za STOP iz zadatka je ispunjen: **degenerisan plan na VDOT > 60** — (1) nedelja sa jednim treningom ispod
minimuma obima od VDOT 67, (2) deonica RP kraća od 60 s (oštrenje trkačke nedelje) od VDOT 63. Ostali uslovi nisu
ispunjeni: 0 novih odbijanja, dan kvaliteta duži od dugog 6 → 6 planova (svi sa postojećim upozorenjem), sudara sa
dužinama ili „doza ne opada" nema. S1 i S3 sami nemaju nalaz za STOP.

## Komande (iz `web/`; nijedna nije test; trajanje K1–K3 ≈ 2 s, K4 ≈ 22 s, K5 ≈ 15 s)

- **K0** pre: `git apply --include='*/feel.ts' ../docs/generators-v2/perfection/P4/s1s2s3-wip.patch` (samo merni
  helper `feel.feelDoseHeld`, ponašanje bajt-isto); posle: `git apply ../docs/generators-v2/perfection/P4/s1s2s3-wip.patch`.
- **K1** `node ../docs/generators-v2/perfection/P4/measure.ts pre|posle` — mreža P0 (148) + V (VDOT 62/65/68/70 ×
  3–5 d × dno/sredina/vrh × 6/11/16 ned, 108) + G (4–5 d, 30–65 km korak 5, 8/12/16 ned, VDOT 45/55, 72) = 328 ulaza.
- **K2** `node ../docs/generators-v2/perfection/P4/compare.ts pre posle` — sve tabele ispod.
- **K3** `node ../docs/generators-v2/perfection/P4/profile.ts b` → `P4/profile-b-5K-{pre,posle}.txt`;
  `profile.ts <dani> <km> <ned> <vdot>` → `P4/profile-v{62,65,68,70}-d{4,5}-*-12w.txt`, `profile-v70-d3-12km-6w-STOP.txt`.
- **K4** `node ../docs/generators-v2/perfection/P4/dense.ts pre|posle` — gusta mreža R: 3–5 d × svaki ceo km tabele dana
  × 6–16 ned × VDOT 50/55/58/60/62/64/66/68/70 = 9 504 ulaza; otisci `P4/dense-{pre,posle}.json`.
- **K5** `node ../docs/generators-v2/perfection/P4/edge.ts` — VDOT 60–70 korak 1 (+ 67,5), ista gusta mreža.
- Provera patcha: posle `git apply` ponovljen K1 daje 0 razlika prema prvom merenju (`compare.ts posle chk`: 0/328;
  `pre chkpre`: 0/193).

## Šta je u patchu (5k-v2.13.0)

- **S1** `policy.quality.iMaxShareByTargetKm` [{0 km: 10 %}, {40 km: 12 %}] (zamenjuje `iMaxShare` 8 %), jedini
  pristup `workouts.iMaxShareOf(cilj)`; čitaju ga `qualityBudgets` (konstruktor, po osećaju, početnik) i validator
  `I_SHARE` (osnov kao i do sada: cilj, trkačka nedelja granica). R 5 %, T 10 % i ostala ograničenja bez promene.
- **S2** `policy.input.vdot.max` 60 → 70 (input, assess A1, forma čitaju isto polje).
- **S3** `feel.feelDoseHeld` (samo čitanje, ista ponuda i procena kao `choose 'up'`); pravila nepromenjena.
- Nedostaje do završetka (namerno, do odluke): red u `DECISIONS`, sabotaže S1/S2, STATUS, testovi granice.

## Nalaz STOP 1 — nedelja sa jednim treningom (VDOT ≥ 67), K5, K3

| VDOT | 60 | 62–66 | 67–70 |
|---|---|---|---|
| WEEK_DEGENERATE (od 1 056) | 0 | 0 | 2 (3 d, 12 km, 6 i 7 ned, nedelja 3) |
| QUALITY_REDUCED (od 1 056) | 0 (pre S1: 2, isti ulazi) | 2 (isti ulazi) | 2 (isti ulazi) |
| nedelja izgradnje < minWeekKm 7,5 km | 0 | 0 | 2 |

`profile-v70-d3-12km-6w-STOP.txt`, nedelja 3 (vrhunac, cilj 13,9 km): samo dugi 6,2 km. Uzrok: T1 lagan ≥ max(3 km,
20 min) računat sporom granicom E — na VDOT 70 E 234–258 s/km → lagan ≥ 5,2 km, a lagan ≤ 0,8 × dugi = 5,0 km → oba
lagana dana odmor (`easyRest`); kvalitet rasterećenja (I, kratak T, R ≥ 1,2 km) ne staje u dužine (lagan ≥ minimuma uz
dugi). Samo S2 (I 8 %) daje isto (WEEK_DEGENERATE 2 na VDOT 68/70) i još 58 nedelja sa QUALITY_REDUCED po VDOT-u ≥ 62
(3 d 12–15 km, 4 d 15 km) — S1 to spušta na 2. Uzrok je dakle S2 × T1 na najmanjem obimu 3 dana, ne S1.

## Nalaz STOP 2 — deonica RP < 60 s (oštrenje trkačke nedelje, VDOT ≥ 63), K5

Oštrenje `RP_sharpener` (ponuda 400/300/200 m, 2–4 ponavljanja, prvi izbor ≥ 70 % budžeta): na VDOT 63–70 bira
2 × 300 m ili 3 × 300 m = 54–59 s u **33 od 1 056** planova po VDOT-u (3 d i manji obim; VDOT 63: 59 s, 70: 54 s).
U izgradnji (I/RP vrhunac, oštrenje) deonica < 60 s: 0 na svim VDOT-ima (najkraća RP 400 m = 72 s na VDOT 70).
Oporavak > 2 × rad (I/RP/T): 0. R deonice < 60 s (200–400 m) postoje na svim VDOT-ima od ranije (rRepMaxSec 120 s,
nema donje granice) — nisu brojane kao nalaz.

## Opcije (brojevi iz K4/K5; odluka organizatora)

- **O-a — granica VDOT 66** (S2 60 → 66). WEEK_DEGENERATE 0; QUALITY_REDUCED 2 ulaza po VDOT-u (3 d 12 km 6–7 ned,
  nedelja 3: jedan kvalitet doze rasterećenja, upozorenje postoji); oštrenje < 60 s ostaje 33/1 056 na VDOT 63–66 → uz
  O-c ili O-d.
- **O-b — granica 70 + pravilo ulaza** (3 dana, < 13 km, VDOT ≥ 67 → odbijanje sa porukom „za ovu brzinu treba bar
  13 km ili 4 dana"). U gustoj mreži pogađa tačno 2 ulaza po VDOT-u 67–70 (svi danas odbijeni zbog VDOT > 60, pa nije
  „novo odbijanje ulaza koji je davao plan"); prag 13 km nije izmeren za razlomljene km.
- **O-c — oštrenje sa deonicom ≥ 60 s** (`chooseReps(..., minRepSec 60)` za RP_sharpener, izmeren eksperimentom):
  oštrenje < 60 s 0, WEEK_DEGENERATE i QUALITY_REDUCED 0, ali **11 odbijanja `QUALITY_INFEASIBLE` po VDOT-u 62–70**
  (2 × 400 m ne staje u budžet trkačke nedelje malog obima) — traži zamenu (npr. ubrzanja) koju treba odrediti.
- **O-d — prihvatiti oba nalaza**: 2 × / 3 × 300 m RP u trkačkoj nedelji je oštrenje, ne I stimulus; 2 ulaza po VDOT-u
  ≥ 67 (5K ≈ 15:30 uz 12 km nedeljno, 3 dana) dobijaju nedelju sa jednim treningom uz postojeće upozorenje WEEK_DEGENERATE
  (krši Uslov 8 za te ulaze).
- **O-e — T1 za brze**: lagan ≥ max(3 km, 20 min) računati srednjim E ili samo 3 km — menja trenerski broj T1, nije
  meren.

## S1 — izmereno (K2; mreža P0, trkač sa rezultatom VDOT 35/45/55, n 81; medijana [min–max])

| metrika | pre (8 %) | posle (10/12 %) |
|---|---|---|
| I rad prvi / najveći [min] | 10,3 / 11 [4,3–20,8] | 12,5 / 13,7 [5,1–26] |
| RP rad prvi / najveći [min] | 10,5 / 10,9 [3,7–21,6] | 13 / 13,5 [4,4–26,2] |
| najveći RP trening [km] (% trke) | 2,5 [1–5] (50 %) | 3,2 [1,2–6] (64 %) |
| ukupno RP u planu [km] | 6,5 [1,6–15,4] | 8,5 [1,8–19,6] |
| % km bržih od E: baza / vrhunac / oštrenje / taper | 11,5 / 12,7 / 11,7 / 11,5 | 11,5 / 15 / 13,3 / 13,8 |
| R / T najveći [min] | 6,4 / 13,9 | 6,4 / 13,9 (bez promene) |
| najduži dugi [km] | 12 [6,5–17] | 12 [6,2–17] |

Mreža G (4–5 d, 30–65 km, n 72): I najveći 14,5 → 21,7 min; najveći RP trening 3,6 → 5 km (72 → 100 % trke, max 6 km
= 6 × 1000 m); ukupno RP 10,4 → 14,4 km. Po osećaju (n 24): I najveći 12,8 → 14 min, RP bez promene (19,5 min);
početnik (n 16): RP najveći 7,3 → 8,7 min, RP trening 1,1 → 1,4 km. Promenjeni planovi: P0 R 81/81, B 16/16, F 20/24
(F 5 d 4/8), G 72/72; gusta mreža VDOT ≤ 60 4 224/4 224. Nedelje > 25 % km bržih od E: 4 → 4 (iste, sve F 12–15 km,
330 s/km; navedene, ne ispravljane). Upozorenja (planova koji postoje pre i posle): PLANNED_BELOW_TARGET 92 → 93,
QUALITY_REDUCED 1 → 0 (P0), 2 → 0 po VDOT-u (gusta), LONG_SHORTER_THAN_QUALITY 6 → 6.

Profil (b) (5K 20:25, 30 km, 4 dana, 8 ned; `profile-b-5K-{pre,posle}.txt`): I 2 × 1200 m / 5 × 500 m (9,6 / 10 min) →
4 × 800 m / 5 × 700 m (12,8 / 14 min rada); RP 5 × 500 m (10,3 min) → 4 × 800 m (13,1 min), taper RP 2 × 1000 →
3 × 1000 m; najveći RP trening 2,5 → 3,2 km; oštrenje 3 × 400 → 4 × 400 m. Orijentiri: (b) I vrh ≥ 12 min ✓ (14);
najveći RP ≥ 3 km medijana ✓ (3,2).

**Prijava po S1 (> 50 % planova):** vrh I/RP posle izmene drži `maxReps` (I 6, RP 6) — 5 dana: I 50 % (60/120), RP
69 % (66/96); 3 dana: RP plafon udela 100 % (48/48); 4 dana: I plafon 52 %, RP plafon 61 %. `iRepMaxSec` i ponuda
dužina nikad nisu uzrok. Pre izmene `maxReps` nije bio uzrok ni u jednom planu. Na 5 dana vrh I je tipično 6 × 1200 m
koji se 3 nedelje drži uz gušći oporavak (3:30 → 2:45 → 1:45; `profile-v70-d5-50km-12w.txt`).

## S2 — ispis (K3; VDOT 62/65/68/70 × 4 d 35 km i 5 d 50 km, 12 ned)

Pun ispis u `P4/profile-v*-d{4,5}-*-12w.txt`. U svih 8: tempo monoton (VDOT 70: E 234–258, T 194, I 179, RP 179,
R 168 s/km), I deonice 700–1200 m (2:05–3:35), RP 600–1000 m, R 150–400 m, WU/CD po pojasu obima, dugi 13–17 km /
53–70 min, nijedna prazna nedelja ni nedelja ispod minimuma. Na mreži V (108): I najveći 10,8 [4,2–23,6] min, RP trening
3,2 [1,2–6] km, dugi 14 [6,2–19,5] km / 61 [27–85] min.

## S3 — uzrok doze po osećaju i početnika (K2, posle; broj planova sa vrstom, bez promene pravila)

`step` = veća doza staje u budžet (≤ 1 korak nedeljno / kraj faze), `budget` = plafon udela zone, `offer` = kraj ponude.

| grupa | usponi (R) | tempo (T) | fartlek I | fartlek T | RP po osećaju | RP kratko |
|---|---|---|---|---|---|---|
| F 3 d (8) | step 7, budget 1 | step 4, budget 1 | step 8 | — | step 4 | — |
| F 4 d (8) | step 6, offer 2 | step 5, budget 3 | step 8 | step 2 | step 4 | — |
| F 5 d (8) | step 5, offer 3 | step 6, offer 2 | step 8 | — | step 4 | — |
| B 3 d (8) | step 4 | step 2, budget 2 | — | step 8 | step 4 | step 4 |
| B 4 d (8) | step 4 | step 4 | — | step 8 | step 4 | step 4 |

Pre S1 (F+B zbirno) isto, osim fartlek I (budget 1 → 0) i RP kratko (budget 1 → 0). Izmereno: dozu po osećaju i
početnika drži dužina faze (`step`) u 115/131 (88 %) pre i 117/131 (89 %) posle; plafon udela 9 → 7, kraj ponude 7 → 7
(usponi 4–5 d: 12 × 45 s; tempo 5 d: plafon T bloka faze).

## Mišljenje (odvojeno od merenja)

1. Nalaz 1 je uzak (2 ulaza po VDOT-u ≥ 67, profil malo verovatan); nalaz 2 je pitanje definicije (oštrenje nije I).
   Po mom mišljenju O-a (66) ili O-b uz O-d za oštrenje rešavaju bez nove trenerske odluke o T1.
2. S1 može da ide samostalno (bez S2) — nema nalaza, uklanja postojeći QUALITY_REDUCED; ako se tako odluči, jedan pun
   nivo 5K pokriva i S1 i S2 kada se S2 odluči u istom segmentu.
3. Na 5 dana `maxReps` 6 postaje glavni plafon I/RP (50–69 %) — sledeći rast doze je pitanje lestvice, ne budžeta.
