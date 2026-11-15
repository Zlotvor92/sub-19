# P0 — merna osnova trenerskih metrika v2 (5K, 10K, HM, MAR)

9. 11. 2026; politike `5k-v2.12.0`, `10k-v2.10.0`, `hm-v2.8.0`, `marathon-v2.8.0`; `web/src/**` netaknut, testovi nisu
pokretani. Ćelija: medijana [min–max].

## Komande (iz `web/`)

- **K1** `for D in 5K 10K HM MAR; do node ../docs/generators-v2/perfection/P0/measure.ts $D; done` → `P0/raw-<D>.json`, `P0/summary-<D>.json`.
- **K2** `node ../docs/generators-v2/perfection/P0/tables.ts > ../docs/generators-v2/perfection/P0/tables.md` — sve tabele M1–M8 i
  „šta drži dozu" po distanci × porodica × dani × pojas (dno/sredina/vrh); ovaj izveštaj je izvod.
- **K3** `node ../docs/generators-v2/perfection/P0/hold.ts > ../docs/generators-v2/perfection/P0/hold.md` — uzrok doze po distanci × dani.
- **K4** `node ../docs/generators-v2/perfection/P0/profiles.ts` → `P0/profile-{a,b}-<D>.txt`, `P0/profiles.json`.
- **K5** (M9) `grep -n "kind === 'easy' || d.workout.kind === 'long'\|x.km > 0 || x.durationSec > 0" src/domain/generators/*/v2/assess.ts`.
## Ulazi (K1; `P0/common.ts` `grid`)

Po distanci: svi podržani dani (5K 3–5, ostale 3–6) × obim dno/sredina/vrh reda tabele dana × VDOT 35/45/55/65 (rezultat
10 km, 14 dana pre starta) × priprema najkraća/srednja/najduža (5K 6/11/16, 10K 8/13/18, HM 10/15/20, MAR 12/18/24 ned).
Po osećaju (F): lagan 330 i 450 s/km × dno/vrh × najkraća/najduža. Početnik (B): lagan 420 s/km i VDOT 35 × dno/vrh tabele
početnika × najkraća/najduža. Start 2. 11. 2026, dugi nedelja.

| | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| ulaza / planova | 148 / 121 | 192 / 192 | 192 / 192 | 192 / 192 |
| odbijeno | 27 (sve VDOT 65: `VDOT_OUT_OF_RANGE`, 5K max 60) | 0 | 0 | 0 |
| greške | 0 | 0 | 0 | 0 |

## Izmereno — planovi sa rezultatom (R), sve grupe dana (K2, red „R sve")

| metrika | 5K (n 81) | 10K (n 144) | HM (n 144) | MAR (n 144) |
|---|---|---|---|---|
| M1 T rad prvi [min] | 9,3 [3,9–14,2] | 10,3 [6,9–20,9] | 11,3 [6,9–23,2] | 11,8 [6,9–28,3] |
| M1 T rad najveći [min] | 13,9 [3,9–27,8] | 18,5 [6,9–37,1] | 22,3 [8,6–45,3] | 27,5 [10,3–54,4] |
| M1 I prvi / najveći [min] | 10,3 / 11 [4,3–20,8] | 10,3 / 12,8 [6,3–25,1] | 10,9 / 15,7 [6,3–31,3] | 10,9 / 19 [6,3–31,3] |
| M1 R prvi / najveći [min] | 5,5 / 6,4 [2,1–12] | 5,1 / 7,2 [3,6–11,9] | 5,9 / 9,6 [3,6–15,7] | 5,9 / 9,6 [5,4–15,7] |
| M1 RP/MP prvi / najveći [min] | 10,5 / 10,9 [3,7–21,6] | 13,8 / 16,8 [7,9–33,6] | 23,5 / 35,3 [17,3–70,6] | 36,4 / 57,9 [29,7–97,1] |
| M2 udeo rada, prvi kval. dan [%] | 16 [12–19] | 12 [8–31] | 13 [8–31] | 14 [8–31] |
| M2 udeo rada, dan najvećeg rada [%] | 38 [23–47] | 34 [22–46] | 49 [36–62] | 63 [50–75] |
| M3 najveći RP/MP trening [km] | 2,5 [1–5] | 4 [2,4–6] | 8 [5–12] | 12 [8–16] |
| M3 isto, % trke | 50 [20–100] | 40 [24–60] | 37,9 [23,7–56,9] | 28,4 [19–37,9] |
| M3 ukupno RP/MP u planu [km] | 6,5 [1,6–15,4] | 15,4 [4,4–24] | 30 [14–53] | 52 [34–80] |
| M3 nedelja sa RP/MP | 4 [2–4] | 5 [2–5] | 5 [3–6] | 7 [6–7] |
| M4 najduži dugi [km] | 12 [6,5–17] | 15 [10,3–22,9] | 20,5 [14,5–24] | 24,2 [19,4–32,8] |
| M4 najduži dugi [min] | 85 [32–86] | 94 [45–100] | 119 [63–143] | 143 [84–143] |
| M4 najduži dugi, % trke | 240 [130–340] | 149,5 [103–229] | 97,2 [68,7–113,8] | 57,4 [46–77,7] |
| M4 dugih sa delom bržim od E | 0 [0–0] | 0 [0–0] | 0 [0–0] | 0 [0–0] |
| M4 plato dugog (uzast. ne-rast. ned. ±0,1 km) | 4 [1–11] | 5 [1–12] | 7 [1–14] | 8 [1–16] |
| M5 laganih dana sa ubrzanjima | 6 [0–15] | 0 [0–0] | 0 [0–0] | 0 [0–0] |
| M6 testova / ned. od starta do trke | 0 / 11 [6–16] | 0 / 13 [8–18] | 0 / 15 [10–20] | 0 / 18 [12–24] |
| M7 % km bržih od E: baza | 11,5 [6,1–15,1] | 8,7 [3,9–15,1] | 9,5 [3,1–12,3] | 9,6 [6,8–11,3] |
| M7 razvoj (5K: vrhunac) | 12,7 [7,7–16,7] | 10,4 [4,9–15,6] | 9,8 [3,5–13,5] | 10,8 [7,1–15,2] |
| M7 specifična (5K: oštrenje) | 11,7 [8,1–12,5] | 14,7 [7,8–19,7] | 16,8 [7,7–21,9] | 18,3 [11,8–22,1] |
| M7 taper | 11,5 [7,1–13,8] | 11,7 [0–16,9] | 15,4 [0–21,8] | 15 [10,9–20] |
| M8 vrh / nedelja 1 | 1,3 [1–1,7] | 1,3 [1–1,8] | 1,4 [1,1–1,6] | 1,4 [1,1–1,5] |
| M8 dugi / km nedelje vrha [%] | 35 [23–45] | 31 [19–45] | 32 [20–45] | 35 [19–50] |

Po osećaju i početnik (K2, redovi „F sve" / „B sve"), samo razlike vredne pažnje:
- M6: F ima tačno 1 test u svakom planu (sve 4 distance), ned. od testa do trke 5K 8 [3–13], 10K 9 [6–12], HM 10 [7–13],
  MAR 12,5 [9–16]; R i B: 0 testova.
- M6 promena tempa bez novog rezultata: 0 planova od 697 (broj različitih tempa po zoni u planu = 1 svuda).
- B: I i R ne postoje (10K/HM/MAR); 5K B najveći RP 1,1 km [0,8–1,9]; MAR B M7 trkačke nedelje 2,1 % (samo trka).
- Taper bez ijednog brzog km (M7 taper = 0): 10K 10 planova, HM 16 planova — svi 3 dana na dnu obima; napomena plana
  HM: „Taper bez kvaliteta — ni RP 2 × 2000 m ne staje u plafon 15 % cilja (H11 ispred H7)" (K1, `raw-HM.json`,
  npr. `R-d3-25km-10w-v45`).

## Šta drži dozu (K1, K3)

Metod. 10K/HM/MAR: nedelja vrha zone = poslednja ne-rasteretna nedelja izgradnje sa najvećom dozom zone. Kontračinjenica
„sledeći nivo" (`quality.ts nextLevel`) proverena redom: nema ga → **kraj lestvice**; doza > `capM` → **plafon udela
zone**; HM/MAR: `qualityDaySec` sledećeg nivoa > trajanje dugog iste nedelje → **pouka 32**; inače korak izbora iz plana
(`dose.step`): `next` → **≤ 1 nivo/ned + kraj faze**, `transition` → **prelaz bez rasta** (doza prelaza je ostala vrh zone),
`start` → **start 60 % bez rasta**. 5K (R): budžet zone (`qualityBudgets`) i `chooseProgressiveReps` od izabrane doze:
veća postoji u budžetu → ≤ 1 korak/ned + kraj faze; postoji samo uz neograničen budžet → plafon; ne postoji →
kraj ponude; T: +0,5 km prema budžetu T i `tContinuousMaxSec`.

Dokaz kopije (izbor jezgra pozvan sa stanjem slota rekonstruisanim iz plana, bez drugog člana pouke 32, `allowDrop` false):

| | 10K | HM | MAR | 5K (I/RP, R plan.) |
|---|---|---|---|---|
| isti izbor kao plan | 2737/2739 | 3081/3089 | 3742/3744 | 132/161 |
| razlike | 2 `drop` | 6 `alt` (pouka 32), 2 `drop` | 1 `drop`, 1 `alt` | 29: jezgro uzelo „istu dozu druge strukture" (`altMain`, nije izvezen) jer veće u budžetu nema |

Razlike su nedelje u kojima je jezgro spustilo dozu (`drop`) ili izabralo drugu strukturu zbog pouke 32 (`alt`) — upravo
grane koje kopija namerno ne sadrži.

Uzrok po distanci × dani, % planova sa zonom (K3, `P0/hold.md`; sve porodice):

| D | dani | T | I | R | RP/MP |
|---|---|---|---|---|---|
| 5K | 3 | korak +0,5 52; plafon 41; traj. T 7 | plafon 67; ≤1+kraj 33 | plafon 100 | plafon 100 |
| 5K | 4 | plafon 100 | ≤1+kraj 56; plafon 44 | plafon 96 | plafon 89; ≤1+kraj 11 |
| 5K | 5 | plafon 100 | ≤1+kraj 56; plafon 44 | plafon 67; ≤1+kraj 33 | plafon 100 |
| 10K | 3 | plafon 87; prelaz 13 | — | — | plafon 94; ≤1+kraj 6 |
| 10K | 4 | plafon 83; ≤1+kraj 13 | plafon 52; ≤1+kraj 25; prelaz 23 | plafon 45; ≤1+kraj 36; kraj lest. 14 | plafon 65; ≤1+kraj 35 |
| 10K | 5 | plafon 77; ≤1+kraj 23 | prelaz 36; ≤1+kraj 34; plafon 30 | plafon 36; ≤1+kraj 32; kraj lest. 27 | plafon 48; ≤1+kraj 32; kraj lest. 20 |
| 10K | 6 | plafon 59; ≤1+kraj 25; kraj lest. 16 | ≤1+kraj 43; prelaz 36; plafon 14 | kraj lest. 41; ≤1+kraj 30; plafon 23 | ≤1+kraj 39; kraj lest. 39; plafon 23 |
| HM | 3 | plafon 77; prelaz 23 | — | — | plafon 91; ≤1+kraj 9 |
| HM | 4 | plafon 87; prelaz 6; ≤1+kraj 6 | plafon 41; prelaz 36; ≤1+kraj 23 | plafon 55; ≤1+kraj 30; kraj lest. 16 | plafon 60; ≤1+kraj 40 |
| HM | 5 | plafon 91; ≤1+kraj 9 | prelaz 36; ≤1+kraj 32; plafon 23 | kraj lest. 41; plafon 32; ≤1+kraj 27 | plafon 50; ≤1+kraj 50 |
| HM | 6 | plafon 72; kraj lest. 28 | prelaz 36; kraj lest. 30; plafon 23 | kraj lest. 55; ≤1+kraj 25; plafon 18 | ≤1+kraj 45; kraj lest. 30; plafon 23; p32 2 |
| MAR | 3 | plafon 100 | — | — | plafon 91; ≤1+kraj 9 |
| MAR | 4 | plafon 100 | plafon 43; prelaz 36; kraj lest. 20 | plafon 39; ≤1+kraj 39; kraj lest. 23 | plafon 73; ≤1+kraj 27 |
| MAR | 5 | plafon 79; kraj lest. 21 | kraj lest. 41; prelaz 36; plafon 23 | kraj lest. 52; ≤1+kraj 25; plafon 23 | plafon 42; kraj lest. 31; ≤1+kraj 25 |
| MAR | 6 | kraj lest. 64; plafon 36 | kraj lest. 64; prelaz 36 | kraj lest. 77; ≤1+kraj 23 | kraj lest. 48; ≤1+kraj 25; plafon 23; p32 5 |

5K po osećaju i početnik (40/121) — nije instrumentisano. „Početni nivo 60 %" kao uzrok vrha: samo 10K R, 7 planova (5 %); „kapacitet nedelje / pad doze": 0 vrhova.

## Vlasnik pravila po metrici (ID, fajl)

| metrika | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| M1/M2 doza, plafon | `policy.quality` iMaxShare 8 %, tMaxShare 10 %, rMaxShare 5 %, maxReps, iRepMaxSec, tContinuousMaxSec; `workouts.ts` vdotWeekQuality/chooseProgressiveReps; po osećaju `feel.ts` simpleWeekQuality | D10, D11 (R 5/I 8/T 10/RP 10 %), D12, D16; `quality.ts` pickSlot | H10, H11 (R 5/I 8/T 10/RP 15 %), H12, HI15 (pouka 32); `quality.ts` pickSlot | M10, M11 (R 5/I 8/T 10/MP 20 %), M12; `quality.ts` pickSlot |
| M2 WU/CD | `policy.warmup.bands`; `workouts.ts` warmupBand | D14 | H14 | M14 |
| M3 RP/MP | RP iz I budžeta (8 %) | D11, lestvica RP (`ladders`) | H11, lestvica RP | M11, M7a, lestvica MP |
| M4 dugi | `days.longMaxShare`, `long.maxSec`; `lengths.ts` | D13; `lengths.ts` | H13, HI7 (pouka 28); `lengths.ts` | M13, M13a; `lengths.ts` |
| M5 ubrzanja | `quality.strides`; `workouts.ts` easyRun | samo dan pred trku, D8 | samo dan pred trku, H8 (`eveWorkout`) | samo dan pred trku, M8 |
| M6 test / tempo | `policy.test`; tempo iz rezultata | D27 (samo F), D2 „tempo fiksan kroz plan", A1 | H16, H2, A1 | M16, M2, A1 |
| M7 | nema sopstvenog pravila — zbir doza | isto | isto | isto |
| M8 | `volume.ts` peakKm | D6 | H6 | M6 |

## M9 adaptacija (čitanje koda, K5)

- Signali `assess.ts`, isti skup u sve 4 distance: rezultat (NEW_RESULT / RESULT_IGNORED, A1), bol (PAIN, A4), pauza
  (PAUSE, A3), manjak i višak izvršenja km u 7-dnevnom prozoru (UNDER/OVER_EXECUTION, A2/A6), umor (FATIGUE, A5),
  NO_FACTS. Zapis treninga (`WorkoutFact`, `types.ts`) ima samo `date, dayId, km, durationSec, completed, rpe, pain` —
  polje tempa ne postoji.
- Kvalitetni trening: tempo — nema podatka; trajanje — `durationSec` služi samo kao „trčao je" (`x.km > 0 ||
  x.durationSec > 0`: 5K `assess.ts:261`, 10K `:242`, HM `:309`, MAR `:294`); RPE — umor broji samo dane čiji je trening
  lagan ili dugi (5K `:445`, 10K `:438`, HM `:500`, MAR `:476`), pa RPE kvalitetnog dana nema nikakav efekat.
- App sloj (`v2/app/`): `facts.ts` prevodi dnevnik u iste činjenice (RPE se prenosi, tempo ne); `adapt.ts` koristi
  kvalitet samo za tekst pregleda nedelje (npr. HM `app/adapt.ts:79`). Van jezgra nema ničeg od toga.

## Imenovani profili (K4; pun ispis `P0/profile-a-<D>.txt`, `P0/profile-b-<D>.txt`)

(a) 10 km 46:00 (VDOT 44,1), 40 km, uto/čet/sub/ned, 16 ned, skorašnji najduži 14 km (HM/MAR); cilj HM 6000 s, ostale
prognoza × 0,98 (5K 1304 s „ambiciozan", 10K 2706 s, MAR 12693 s „realističan").

| (a) | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| T prvi / max [min] | 11,8 / 18,8 | 9,4 / 23,5 | 9,4 / 22,6 | 9,4 / 22,6 |
| I prvi / max [min] | 12,1 / 13,9 | 8,7 / 15,6 | 10,4 / 17,3 | 8,7 / 17,3 |
| R prvi / max [min] | 6,5 / 8,2 | 4,9 / 8,2 | 4,9 / 8,2 | 4,9 / 7,4 |
| RP/MP prvi / max [min] | 13,3 / 14,2 | 18,4 / 23 | 24,2 / 38,7 | 30,7 / 61,4 |
| M2 prvi / vrh [%] | 17 / 43 | 11 / 38 | 11 / 51 | 14 / 71 |
| RP/MP najveći km (% trke) / ukupno / ned | 3,2 (64) / 9,8 / 4 | 5 (50) / 19,5 / 5 | 8 (37,9) / 35 / 6 | 12 (28,4) / 52 / 7 |
| najduži dugi km / min (% trke) | 14 / 83 (280) | 16,8 / 100 (168) | 22,4 / 133 (106,2) | 24 / 143 (56,9) |
| plato dugog [ned] / dugi sa brzim | 11 / 0 | 5 / 0 | 5 / 0 | 3 / 0 |
| ubrzanja / testova | 6 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| vrh/ned 1; dugi/vrh | 1,07; 34 % | 1,34; 32 % | 1,40; 40 % | 1,50; 40 % |
| uzrok vrha R / T / I / RP | plafon ×4 | plafon / plafon / ≤1+kraj / plafon | plafon ×4 | ≤1+kraj / plafon / plafon / plafon |

HM (a) potvrđuje polaznu ocenu: ned 1 T 2,0 km = 9,4 min uz WU 20 + CD 15 min; vrh T 2 × 2400 m, I 4 × 1000 m; RP 8 km
(37,9 %); dugi 5 nedelja na 22,4 km (`profile-a-HM.txt`).

(b) 5K 20:25, 30 km, 4 dana, 19. 10. → 13. 12. 2026 (8 ned), cilj 1199 s: T 8,7 / 13,9 min, I 9,6 / 10, R 4,5 / 6,8,
RP 10,3 / 10,3; najveći RP 2,5 km (50 %); dugi 13,6 km / 75 min; 3 laganih sa ubrzanjima; 0 testova; uzrok R/T plafon,
I/RP ≤ 1 korak + kraj faze; cilj „ambiciozan" (goalVdot 49,9). Isti ulaz za 10K: plan nastaje (`profile-b-10K.txt`);
HM `PLAN_TOO_SHORT`, MAR `PLAN_TOO_SHORT, WEEKLY_KM_TOO_LOW` (očekivano: 8 nedelja).

## Šta nedostaje / šta nije izmereno

1. 5K po osećaju i početnik (40 planova): doza se bira u `feel.ts simpleWeekQuality` (vreme/RPE, druga logika) — uzrok
   doze nije instrumentisan; M1–M8 jesu izmereni.
2. Pouka 32 u kontračinjenici je procena: poredi se dan sledećeg nivoa sa dugim KAKAV JE u planu; jezgro (week.ts
   `buildDayLimit`) računa dugi koji bi nastao uz veći kvalitet (kraći). Procena zato može da potceni udeo pouke 32
   (izmereno 0–5 %). Tačno merenje traži poziv `buildDayLimit` sa unutrašnjim stanjem nedelje (`roll10`, `target10`).
3. „Kontrolna trka" ne postoji kao pojam u planu nijedne distance — brojani su samo testovi (`week.test` / uloga `test`).
4. M7 za 5K računa km ubrzanja (zona R) kao brže od E; ostale distance imaju ubrzanja samo dan pred trku.
5. Kopija 5K ne pokriva granu `altMain` (nije izvezena); 29 izbora označeno kao razlika (tabela dokaza).

## Mišljenje (odvojeno od merenja; bez predloga koda)

HM
1. RP doza je glavni manjak: najveći RP trening 8 km (37,9 % trke) medijana; vrh RP drži H11 15 % u 53 % planova, u
   ostalima kraj faze (≤ 1 nivo/ned) — specifična faza je prekratka da lestvica stigne do plafona.
2. Dugi je u 100 % planova samo E, a plato dugog medijana 7 nedelja: specifičnost dugog ne postoji.
3. I u 36 % planova 4–6 dana ne raste iznad doze prelaza (razvoj prekratak za lestvicu I).
4. Prvi dan kvaliteta ima 13 % rada (WU/CD dominira); 0 ubrzanja na laganim danima.
5. Plan sa rezultatom nema nijednu tačku merenja forme; tempo je isti kroz ceo plan.

MAR
1. MP: plafon M11 20 % dozvoljava više nego što lestvica i faza daju — najveći MP 12 km (28,4 % trke); kraj lestvice
   drži MP u 31–48 % planova 5–6 dana.
2. Dugi: medijana 143 min / 24,2 km, nijedan sa MP delom; trajanje dugog, ne obim, je granica (M13 150 min).
3. 5–6 dana: R, I i T staju na kraju lestvice (R 52–77 %, I 41–64 %) — lestvice su kratke za veliki obim.
4. Nema ubrzanja, nema testa u planu sa rezultatom, tempo fiksan.
5. Udeo rada na danu najvećeg rada je visok (63 %) — doza MP je jedini kvalitet koji „nosi" plan.

10K
1. RP najviše 4 km (40 % trke), plafon D11 RP 10 % drži RP u 55 % planova (3 dana 94 %).
2. I najveći 12,8 min medijana; u 36 % planova 5–6 dana I ne raste iznad doze prelaza.
3. 3 dana na dnu obima: taper bez ijednog brzog km (10 planova).
4. Dugi samo E, plato do 12 nedelja.
5. 0 ubrzanja na laganim danima; test samo po osećaju.

5K
1. Doze su male u minutima: R najveći 6,4 min, I 11 min (medijane); budžet udela drži R u 88 % i RP u 96 % planova.
2. Dugi je 240 % trke (12 km) uz vrh I od 11 min — po mom mišljenju odnos aerobnog i specifičnog rada je nagnut ka dugom.
3. Najveći RP trening 2,5 km (50 % trke); RP traje 4 nedelje.
4. Prvi dan kvaliteta 16 % rada; WU/CD pojas je isti za sve doze.
5. VDOT > 60 se odbija (27 ulaza); 33 % planova (po osećaju, početnik) nema merljiv uzrok doze.
