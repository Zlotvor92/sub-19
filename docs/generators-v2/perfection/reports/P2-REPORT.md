# P2 — maraton: specifičnost (MP u dugom, duži dugi) — izveštaj

9. 11. 2026 (Europe/Belgrade). Polazni SHA koda `38fd091` (marathon-v2.8.0) → marathon-v2.9.0. Zadatak
`briefs/P2-maraton-specificnost.md`; prethodni STOP `reports/P2-STOP.md` (`9f4cbc8`).

## Odluke organizatora posle STOP 9f4cbc8 (ugrađene)

1. Nedelja B = O3 + taper iz max(MP trening, blok): Q1 lagan, Q2 = T; blok = jedan nivo iznad max(poslednji blok,
   poslednji MP trening) u granicama; MP trening A nastavlja od max(MP trening, blok); MP doza tapera (M7) od istog
   max — jedna funkcija `quality.lastMpM`. O2 odbijen.
2. Ukupni MP: prag „medijana po grupi dana ne pada > 5 %"; pad > 5 % se prijavljuje i ugrađuje (specifičnost dugog
   ispred zbira km).
3. Nedelje B koje ne staju: P-a (nedelja je A) prihvaćeno.
4. S2: gornja granica dugog 32,0 km uz 180 min, udeo M15 i pouku 28 (heuristika).
5. 3 dana i početnik: bez nedelje B.

## Šta je ugrađeno (samo `web/src/domain/generators/marathon/v2/**` + dokumentacija)

- **M19 / S1** (`specific.ts` — jedino mesto odluke: `specificTypes`, `bAllowed`, `chooseBlockKm`, `blockFits`,
  `mainDoseM`): raspored A/B iz okvira plana (poslednja ne-rasteretna specifična = B, smena unazad; posle koraka
  adaptacije iz adaptiranih okvira); nedelja B bez testa, ograničenja koraka i sa ciljem po pravilu (ne `downOnly`);
  lestvica bloka 8/10/12/14/16 km; blok ne opada, ≤ 50 % dugog, trajanje ≤ granica dugog, dan kvaliteta ≤ lagan dugi
  ostaje ≤ dugi sa blokom; ne staje → nedelja A uz napomenu (`B_AS_A_NOTE`). `quality.ts`: `lastMpM`, `mpCarry`
  (blok > MP doza slota postaje MP doza slota), `mpAfterBlockM` (prelaz I → MP posle bloka od nivoa iznad bloka kad
  staje u plafon, inače prelaz po M12), `advance` nosi `blockM`. `week.ts`: nedelja B (Q1 lagan, Q2 uz lagan dan više u
  drugom članu pouke 32), `workouts.longBlockWorkout`. Glavna doza (M12) = T + I + MP trening + blok, poređenje unutar
  tipa (O1).
- **S2** (M13): `lengths.longMaxSec` 9000 → 10800 (redovan), `beginner.longMaxSec` 9000; `lengths.longMaxKm` 32
  (`longKmCap10` u `longCap10`, validator LONG_KM, poruka CAPACITY_LIMITED `'km'`).
- **S3**: A5 — dugi sa blokom nije lagan trening za umor (`assess.ts`); bol/odmor/zabrana kvaliteta — nedelja sa
  ograničenjima nije B, LIMITS: dugi sa blokom je kvalitet; prinudno rasterećenje, povratak, nov start — raspored iz
  adaptiranih okvira, `downOnly` → nedelja A.
- **S4**: naslov „Dugi 24,0 km: 12,0 km lagano + 12,0 km u maratonskom tempu", segmenti E + MP (app/structure ih
  prenosi bez izmene, tempo MP propisan; po osećaju RPE MP); napomena nedelje B bez internih oznaka u `userText`.
- Validator: ROLES, LONG_BLOCK (nedelja po rasporedu, oblik, nivo iz iste funkcije, granice, napomena), B_WEEK_MP,
  MAIN_DOSE_DECREASE (unutar tipa), START_LEVEL (prelaz posle bloka), LIMITS, LONG_KM; `policy.ts` red M19, izmene
  M7, M12, M13, A4, A5; `policyVersion` marathon-v2.9.0; `app/plan.ts` KNOWN_VERSIONS ∪ marathon-v2.8.0.
- Testovi: nov `p2.node.test.ts` (11); prilagođeni postojeći (ulaz ili očekivanje koje je menjao S2/S1, sa
  komentarom): policy, week, volume, validate, dayCap, adapt, segment07/08c/09/Final, app (KNOWN_VERSIONS,
  handoffSource: test 5 km 27:30 umesto 24:30), mrežne invarijante (`grid.harness`: 180 min / 32 km, blok samo u
  nedelji B, glavna doza unutar tipa, dugi sa blokom = zahtevni dan), skup STABLE → `segmentP2.stable-38fd091.json`.

## Tumačenja (izvođač; nisu nova trenerska pravila — molim potvrdu)

- T1 „izuzetak spuštene doze preko tipa": glavna doza B se poredi sa poslednjom B; kad je u nedelji A između njih doza
  slota spuštena (pouka 12/32, korak `drop`), izuzetak važi i za sledeću nedelju B (i obrnuto). Bez toga mreža rane
  adaptacije odbija 1 tok (feel-d6-21w-50km-e270-A/w5end/pause20: T 5000 → 3000 m drop u A, B 12 800 < 13 000 m).
- T2 prelaz I → MP (prva nedelja B pre ijedne nedelje A): MP trening A kreće od nivoa iznad bloka samo kad taj nivo
  staje u plafon MP 20 %; inače prelaz po M12 (pre izmene: 6 planova 4 d / 35 km odbijeno DOSE_DROP).

- T3 raspored A/B u adaptaciji: tip nedelje iz rasporeda okvira sa koracima koji važe za tu nedelju
  (`specific.specificTypesOver`: nedelja pre prve nedelje koraka zadržava raspored bez tog koraka). Bez toga korak koji
  menja okvire (npr. A17 ukida rasterećenje) preslaže A/B i za prošle nedelje, rekonstruisana prošlost se razlikuje od
  upisane i validator odbija obim (pun nivo, 1. put: 200+ tokova rane adaptacije i mešovitih nedelja).

## Komande merenja (iz `web/`, svaka ≈ 1–2 s osim K5)

- **K1** `node ../docs/generators-v2/perfection/P2/measure.ts pre` na `38fd091`; `… measure.ts posle` na ovom kodu.
- **K2** `node ../docs/generators-v2/perfection/P2/compare.ts pre posle` (sve tabele ispod osim gde piše drugo).
- **K3** `node ../docs/generators-v2/perfection/P2/breakdown.ts pre posle` (MP po izvoru, nedelje B koje nisu B).
- **K4** `node ../docs/generators-v2/perfection/P2/profile.ts posle` → `P2/profile-a-MAR-posle.txt` (pre: `…-pre.txt`).
- **K5** iz korena: `git worktree add <wt> 38fd091 && node docs/generators-v2/perfection/P2/classify.ts <wt> 38fd091`
  (31 920 planova mreža 02, 03 po osećaju i 03 početnika; 4 min 17 s) → `segmentP2.stable-38fd091.json`,
  `P2/changed-38fd091.json`.
- S2 sam: `git apply ../docs/generators-v2/perfection/P2/s2.patch` na `38fd091`, `measure.ts s2`, `compare.ts pre s2`.

## Pre / posle (mreža P0, 192 ulaza; R n 144; medijana [min–max]; K2)

| metrika | pre (2.8.0) | samo S2 | posle (2.9.0) |
|---|---|---|---|
| odbijeno | 0 | 0 | 0 |
| najveći MP trening [km] | 12 [8–16] | 12 [8–16] | 12 [6–16] |
| najveći blok [km] | — | — | 12 [0–16] |
| ukupno MP (trening + blok) [km] | 52 [34–80] | 52 [34–82] | 52 [34,9–80] |
| dugih sa blokom | 0 | 0 | 2 [0–2] |
| najduži dugi [km / min srednjim E / % trke] | 24,2 / 143 / 57,4 | 26,2 / 153 / 62,1 | 26,2 / 149,5 / 62,1 |
| % km bržih od E: nedelja A / B (spec.) | 22,5 / — | 22,4 / — | 21,5 [13,3–27,7] / 23,2 [15,5–26,3] |
| % km bržih od E, specifična faza | 18,3 | 18 | 18 |
| najduži dan nedelje [km / min] | 24,2 / 143 | 26,2 / 153 | 26,2 / 149,5 |
| nedelja > 25 % km bržih od E (sve porodice, sve faze osim trkačke) | 97 | 104 | 76 |
| napomena N11 (najduži < 26 km ograničen trajanjem), sve porodice | 82 | 41 | 41 |
| MARATHON_LONG_SHORT upozorenje | 0 | 0 | 0 |

MP po izvoru (K3, R medijana po planu): pre trening 36 · blok 0 · taper 12 · oštrenje 4 = 52; posle 20 · 20 · 12 · 4 =
52. F: 47,2 → 49; početnik 39 → 39 (bez promene).

### Ukupni MP po grupi dana (prag organizatora: pad medijane ≤ 5 %)

| grupa | pre | posle | Δ |
|---|---|---|---|
| 3 d (R+F, n 44) | 45,5 | 46 | +1,1 % |
| 4 d (n 52) | 48,5 | 48,5 | 0 % (R +0,5 %, F +0,5 %) |
| 5 d (n 52) | 51,8 | 50 | **−3,4 %** (R −7,1 %, F −3,4 %) |
| 6 d (n 44) | 62 | 57 | **−8,1 % > 5 %** (R −8,3 %, F −8,7 %) |

6 d pada više od praga (ugrađeno po odluci 2). Uzrok (K2 + `node -e` nad `raw-MAR-*.json`): dugi 6 d medijana 24,1 km
→ blok najviše 12 km (≤ 50 % dugog), dok MP trening 6 d dostiže 14 km; MP izgradnje 45 → 42 km, taper + trkačka
(sa 42,2 km trke) 58,7 → 59,7; plus nedelje B koje ne staju (ispod).

### Nedelje B koje ne staju (K3; P-a: nedelja A uz napomenu)

R 4 d 0/36, F 4 d 0/8, R 5 d 2/36 (6 %), F 5 d 1/8 (13 %), R 6 d 3/36 (8 %), F 6 d 2/8 (25 %). Svi na vrhu obima sa
sporim trkačem (85 km 5 d, 110 km 6 d; VDOT 35 / lagan 450 s/km): bez dana MP treninga lagani (≤ 0,8 × dugi) ne nose
cilj (`P2-STOP.md`, Sudar 2). Niz tipova (sve porodice): ABAB 78, BAB 46, ABAA 3, BAA 2; AAAA 47 i AAA 16 = 3 dana i
početnik.

Dugih sa blokom po pripremi, 4–6 d (sve porodice, medijana [min–max]): 12 ned 2 (6 d [1–2]); 18 ned 2 (5 d [1–2],
6 d [0–2]); 24 ned 2 [0–2]; 16 ned (samo početnik) 0.

### S2: najduži dugi po VDOT (R, km / min / % trke, isto za 3–6 d osim gde piše)

v35 20 / 143 / 47,4 → 24,1 / 172 / 57,1 · v45 24,4 / 143 / 57,8 → 29,3 / 171 / 69,4 · v55 28,7 / 143 / 68 → 30 / 149 /
71,1 (5–6 d 32 / 159 / 75,8) · v65 30 / 131 / 71,1 → isto (5 d 32,5 → 32; 6 d 32,8 → 32 / 139 / 75,8).
Granica 32 km: 28 planova mreže P0 ima najduži dugi tačno 32,0 km (pre 11 planova > 32 km, najviše 32,8; samo S2 bez
granice najviše 38,4). Orijentiri: ukupno MP R 52 (orijentir ≥ 70 — nije dostignut); najveći blok ≥ 14 km u planovima
sa vrhom ≥ 60 km/ned 45/109; najduži dugi ≥ 28 km za VDOT ≥ 45: 72/108.

## Promenjeni planovi (K5; `P2/changed-38fd091.json`)

31 920 ulaza: 0 razlika u odbijanju (nova odbijanja 0); bajt-isto 3387 (od toga u STABLE MAR-11 2613 → novi STABLE);
promenjeno S1 (plan ima nedelju B) 24 810, S2 (stari plan sa dugim na 150 min ili > 32 km, bez nedelje B) 3723,
neobjašnjeno 0.

## Profil (a) (10 km 46:00, 40 km, 4 d, 16 ned; K4; pun ispis `P2/profile-a-MAR-{pre,posle}.txt`)

| | ned 9 | ned 10 | ned 11 | ned 12 | ned 13 | taper N−2 / N−1 | ukupno MP | najduži dugi |
|---|---|---|---|---|---|---|---|---|
| pre | MP 6 | MP 8 | MP 10 | rasterećenje | MP 12 | 6 / 6 | 52 | 24,0 km / 143 min |
| posle | A: MP 6 | B: T 4,8 + dugi 24,0 (16 + 8 MP) | A: MP 10 | rasterećenje | B: T 4,8 + dugi 24,0 (12 + 12 MP) | 6 / 6 | 52 | 24,0 km / 136 min |

Dugi ostaje 24,0 km (udeo 40 % nedelje od 60 km), pa S2 profil (a) ne menja. T ostaje 4800 m (plafon T 10 %).

## Sabotaže (`P2/sabotage.json`; iz `web/`: `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P2/sabotage.json --quiet`; 9,8 s)

9/9 palo, `--bail=1`, stanje `src` vraćeno: raspored obrnut (S1a), blok bez poslednje MP doze (S1b), blok > 50 %
(S1c), `mpCarry` bez dejstva — taper/MP trening ne nastavljaju od bloka (S1d), validator bez provere nivoa (S1e), bez
granice 32 km (S2a), početnik 180 min (S2b), umor broji dugi sa blokom (S3a), LIMITS bez bloka (S3b). Prvobitna S3b
(„nedelja sa ograničenjima sme biti B") nije pala — ekvivalentan mutant: nedelja sa ograničenjima nikad ne ide u režim
po pravilu; zamenjena.

## Testovi (komanda — trajanje)

Sve iz `web/`, 9. 11. 2026 posle 21:30 (Europe/Belgrade):

| komanda | trajanje | ishod |
|---|---|---|
| `npx vitest run --project node src/domain/generators/marathon/v2` (brz, u toku rada, više puta) | ≈ 32 s | na kraju 39 fajlova zeleno |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2` (1. put) | 622 s | 23 fajla palo (rana adaptacija VOLUME_PEAK/RULE 200+, mešovite nedelje, gusta ned 1 „glavna doza opada") |
| isto, posle ispravke (T3 ispod, invarijanta T1) | 603 s | 77 fajlova, 528 testova zeleno |
| `npm run check` | 295 s (prvi pokušaj 122 s — prettier JSON fajla) | 342 fajla, 3856 testova zeleno |
| `npx vitest run --changed 38fd091` | 114 s | 159 fajlova, 1603 testa zeleno |
| `npx playwright test e2e/marathon-v2.spec.ts --trace off` | 29 s | 3/3 |
| `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P2/sabotage.json --quiet` | 8,8 s | 9/9 palo |

## Mišljenje (odvojeno od merenja)

1. Specifičnost dugog je sada stvarna (2 duga sa blokom 8–16 km u svakom redovnom planu 4–6 d), uz isti ukupni MP
   medijane R i manje nedelja > 25 % brzih km (104 → 76).
2. 6 d gubi ≈ 8 % MP jer je blok vezan za 50 % dugog, a dugi 6 d nije duži od 4 d (udeo 32 %). Ako je to bitno, poluga
   je granica bloka za 6 d (npr. 55–60 %) ili duži dugi 6 d — trenerska odluka, nije merena.
3. 38,4 km iz samog S2 bi bio preterano; granica 32 km dotiče samo vrh obima brzih trkača (28/192).

## Otvorena pitanja organizatoru

1. Potvrda tumačenja T1 (izuzetak spuštene doze preko tipa) i T2 (prelaz I → MP posle bloka).
2. 6 d −8,1 % MP: prihvatiti ili dati polugu (granica bloka 6 d)?
3. T u nedeljama B često stoji na plafonu T 10 % (profil (a): 4800 m kroz celu fazu) — za P6?
