# HM v2 — Segment 03 (hm-v2.2.0): ZAUSTAVLJENO — početnik pri najmanjem obimu: rasterećenje H5 × lagan ≥ 4 km (H13) × obim 20/25 km (H17)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `2285fc7` (HM-02 `06cfb5a` + merge). Menjano samo
`web/src/domain/generators/halfMarathon/v2/**` i `docs/hm-v2/**`; HM v1, `halfMarathon/index.ts`, lični plan,
aplikacija i druge distance netaknuti. Zaustavni commit (kao HM-01 `faf8807`, HM-02 `01dd4a1`): ceo opseg HM-03 je
urađen i zelen, osim odluke o sudaru ispod. Mreža početnika zato privremeno dozvoljava TAČNO izmerena odbijanja
sudara (`grid03.harness.node.test.ts` `stopRejection`, 426 ulaza). Završni izveštaj
`SEGMENT-03-IMPLEMENTATION.md` dolazi posle odluke organizatora.

## Sudar (izmereno: `node docs/hm-v2/artifacts/segment-03/measure-stop.ts`, 28 s)

Mreža početnika (1890) → 426 odbijanja `WEEK_INFEASIBLE` u PRVOJ rasteretnoj nedelji (ned 4: 384, ned 5: 42): 4 d
20 km 189 (svi tempi), 5 d 25 km 189 (svi tempi), 4 d 25 km 48 (lagan 5:30 i VDOT 40, 13–20 ned). Po osećaju 1080 →
240 odbijeno, sa rezultatom 810 → 186. Planovi po osećaju bez početnika (6336) i svi planovi sa rezultatom: 0.

Uzrok: cilj rasterećenja = 0,8 × poslednja izgradnja (H5) je ≈ minimum nedelje, a dugi mora biti TAČNO 0,8 ×
poslednjeg dugog (H5) i svaki lagan ≥ 4 km (H13) i ≤ dugi (pouka 2). Primer `b-d4-13w-20km-e330-A` (4 d, lagan 5:30):
ned 1–3 cilj 20,0 / 21,0 / 22,1 km, dugi ned 3 8,0 km; ned 4 rasterećenje cilj 17,7 km — T 1,5 km (WU 15 + CD 10
min) = 6,05 km + dugi 6,4 km + 2 lagana ≥ 4 km = 20,45 km > 17,7; bez kvaliteta (druga pretraga HI2 ga ne ispušta
jer T staje u plafon) 6,4 + 3 × 4 = 18,4 > 17,7; niži cilj je još teži (fit10 rasterećenje samo naniže). Isti
obrazac kod 5 d 25 km (`b-d5-13w-25km-e330-A`: ned 3 27,6 km, dugi 8,8; ned 4 22,1 km: 7,0 + 4 × 4 = 23,0 > 22,1).

## Opcije (izmerene na mreži početnika 1890 sa validatorom; kod varijanti u `measure-stop.ts`)

| opcija | pravilo (bez novog broja osim P2)                                                                                                                                      | odbijanja                           | promenjeni izvodljivi planovi         | posledica u planu                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| P1     | dugi rasterećenja ≤ 0,8 × poslednji — najduži koji ostavlja lagane ≥ 4 km (isto kao HI11 b za test, 10K A9); kad ni tako kvalitet ne staje, rasterećenje bez kvaliteta | 0                                   | 27 (sada izvodljivi spuštanjem cilja) | 660 nedelja sa kraćim dugim (453 plana), najkraći 4,3 km = 0,49 × poslednji; 48 rasterećenja bez kvaliteta |
| P4     | cilj rasterećenja naviše do najbližeg izvodljivog (≤ granica izgradnje) — protiv HI2 („smanjenje ne raste") i pouke 23                                                 | 0                                   | 0                                     | 606 rasterećenja podignuto, najveće = 0,923 × poslednja izgradnja (rasterećenje −8 %)                      |
| P5     | rasterećenje ispušta najraniji lagan dan (dan odmora) dok nedelja ne stane; validator H9 za rasterećenje                                                               | 0                                   | 0                                     | 606 rasteretnih nedelja sa jednim danom manje (4 d → 3 trčanja), dugi 0,8 × i T zadržani                   |
| P2     | veći minimum obima početnika (H17 tabela, nov broj)                                                                                                                    | 0 od 28,5 km (4 d) / 31,5 km (5 d)* | —                                     | početnik 20–28 / 25–31 km odbijen (preporuka 10K)                                                          |

\* P2 meren nad kodom segmenta, tempi 270–510 i VDOT 30–60, 12–20 ned, raspored A (108 ulaza po obimu): 4 d 25 km
60/108, 27 km 24/108, 28 km 8/108, 28,5 km 0; 5 d 30 km 24/108, 31 km 16/108, 31,5 km 0.

Činjenice za odluku: P1 ima presedan u ovom segmentu (HI11 b, test u rasterećenju) i u 10K (A9 „dugi rasterećenja
≤ 0,8 × — najduži koji ostavlja lagane ≥ 3 km"), ali stvara dugi 4,3 km (manje od pola poslednjeg). P4 krši HI2 i
pouku 23 (rasterećenje bez testa naviše). P5 menja sastav nedelje (H7/H9 „ostali dani lagani"), slično pouci 30.
P2 menja zadatu tabelu H17. Mišljenje (nije odluka): P1 je najbliži postojećim tumačenjima; P5 čuva i dugi i
kvalitet uz manje trčanja, što je kod početnika na 17,7 km opreznije od 4 trčanja ≥ 4 km.

## Urađeno (zeleno; 0 grešaka validatora, 0 prekršaja nezavisnih invarijanti)

- H16 po osećaju: lagan tempo 270–510 obavezan (EASY_PACE_REQUIRED / _OUT_OF_RANGE), E ± 15 s, procena VDOT
  (brži kraj E) 25–60, `paceBasis: 'feel'`, RPE T/RP 6–7, I/R 8 (i oštrenje), bez prognoze i ocene cilja (napomena);
  test 5 km u poslednjoj nedelji baze na danu Q1, u rasterećenju na danu T slota, u obimu, ne u dozi (progresija od
  stanja pre testa, glavna doza preskače test); HI11 b dugi rasterećenja sa testom skraćen (TEST_DELOAD_LONG).
- H17 početnik: `planRule` (jedina tabela), 4–5 dana, 12–20 ned, obim 20–40 / 25–45, uvod 2 ned, jedan kvalitet
  T kont. → T cruise → RP bez I/R, T kont. od 1,5 km i umesto lestvice faze (HI10), rast 5 % (1,0–2,0), vrh 1,4× /
  +15, dugi ≤ 135 min, WU/CD 15/10, bez testa (i po osećaju), LONG_RUN_SHORT < 14 km; HI10 rasterećenje min 1,5 km,
  taper T kad RP ne staje; HI13 (pouka 31) rasterećenje u uvodu bez kvaliteta; runWalk → RUN_WALK_NOT_SUPPORTED.
- HI12: odluke organizatora o HM-02 (594 plana pouke 28, 3 d / 25 km taper/rasterećenje bez kvaliteta, 6 d
  kvalitetni dan duži od dugog) upisane u DECISIONS bez promene koda.
- Plan sa rezultatom: oblik bajt-isti (nova polja `paceBasis`, `experience`, `easyPaceSecPerKm`, `test`, `rpe` samo
  kad postoje). Regresija prema HM-02 (`artifacts/segment-03/regression-hm02.ts`, worktree 2285fc7 vs ovo stablo):
  mreža 02 16 896 + mreža r 10 944 + gusta ned 1 141 804 = 169 644 ulaza, heš rezultata (plan bez oznake verzije
  ili razlozi odbijanja) — 0 razlika (39 odbijanja RECENT_LONG_TOO_SHORT bajt-ista); po 6 min 15–27 s.
  `segment02.baseline.json` nepromenjena i zelena (brz i pun nivo).

## K1–K6 (`node docs/hm-v2/artifacts/segment-03/k-metrics.ts`, 26 s)

| mreža 03                                     | 3 d (990)                                     | 4 d (1386)      | 5 d (1782)     | 6 d (2178)      | poč. 4 d (708) | poč. 5 d (756)   |
| -------------------------------------------- | --------------------------------------------- | --------------- | -------------- | --------------- | -------------- | ---------------- |
| K1 odbijanja / greške validatora             | 0 / 0                                         | 0 / 0           | 0 / 0          | 0 / 0           | 237 sudar / 0  | 189 sudar / 0    |
| K2 ned 1 < obim: ukupno / bez dugog na plaf. | 33 / 0                                        | 165 / 0         | 66 / 0         | 33 / 0          | 0 / 0          | 0 / 0            |
| K3 izgradnja bez kvaliteta                   | 0                                             | 0               | 0              | 0               | 0              | 0                |
| K5 trkačka > taper / pad / susedni / dugi<l. | 0/0/0/0                                       | 0/0/0/0         | 0/0/0/0        | 0/0/0/0         | 0/0/0/0        | 0/0/0/0          |
| K6 ponavljanja / kval. > dugi / CAP_LIMITED  | 0 / 0 / 288                                   | 0 / 0 / 405     | 0 / 0 / 261    | 0 / 33 / 147    | 0 / 0 / 18     | 0 / 0 / 0        |
| K6 vrh/start                                 | 1,327                                         | 1,313           | 1,321          | 1,298           | 1,392          | 1,375            |
| test u rasterećenju (dugi skraćen)           | 180 (24)                                      | 252 (30)        | 324 (18)       | 396 (36)        | —              | —                |
| dan testa duži (km) od dugog                 | 12                                            | 12              | 24             | 63              | —              | —                |
| ostalo                                       | LONG_SHORT 198, taper/rast. bez kval. 198/156 | DOSE_DROPPED 54 | LONG_SHORT 198 | TAPER_RP_ONLY 9 | taper T 141    | dugi < 14 km 189 |

Početnik (1464 izvodljivih): K4 nije primenljiv (novi planovi); T kont. umesto lestvice faze u izgradnji 0 nedelja
(javlja se samo pri obimu sudara); po osećaju / sa rezultatom isti pravilnik, bez testa i bez RPE kod rezultata.

## Testovi i dokazi (iz `web/`)

- Novi: `feel.node` (11), `beginner.node` (11), `feelGrid` (6336; brz uzorak, pun 3 dela), `beginnerGrid` (1890;
  brz uzorak, pun ceo), `grid03.harness`, bazne linije `segment03-feel.baseline.json`,
  `segment03-beginner.baseline.json`; nezavisne invarijante u `gridInvariants.ts` (E ± 15, procena VDOT nezavisnom
  formulom, RPE po zoni, tačno 1 test u poslednjoj nedelji baze na pravom danu, bez prognoze; početnik: uvod, ≤ 1
  kvalitet, bez I/R, start T 1,5 km, rast 5 % (1–2 km), vrh 1,4× / +15, dugi ≤ 135 min, WU/CD 15/10, bez testa,
  upozorenje < 14 km). Izmenjeni potpisi u `quality.node`, `volume.node`, `input.node`, `policy.node`.
- `npx tsc -p tsconfig.domain.json --noEmit` 0, `npx tsc -p tsconfig.oracle.json --noEmit` 0, `npx eslint
src/domain/generators/halfMarathon/v2` 0, `npx prettier --check src/domain/generators/halfMarathon/v2 ../docs/hm-v2` 0.
- Brz nivo HM v2: 17 fajlova, 144 testa, 26 s zida; najduži fajl samostalno `grid` 22 s, `dense` 12 s, `feelGrid`
  10,5 s, `recent` 8,2 s, `feel` 5,5 s, `beginnerGrid` 4,2 s. Pun (`TEST_FULL=1`): 29 fajlova, 179 testova, 202 s.
- `npm run check` (pre upisa izveštaja): typecheck, lint, format:check i 252 test fajla / 3060 testova zeleno, 10 min 22 s
  zida (hladni keševi).
- Sabotaže `node scripts/sabotage.mjs ../docs/hm-v2/artifacts/segment-03/sabotage.json --parallel 2`: 12/12 PAO,
  56,3 s, stanje vraćeno (heš a6c142fdc79f01f9): S1 test u prvoj nedelji baze, S2 test kao doza, S3 početnik I/R,
  S4 bez uvoda, S5 runWalk prihvaćen, S6 dugi 150 min, S7 start ≤ 60 %, S8 procena iz sporog E, S9 RPE RP 7–8, S10
  test bez skraćenja dugog, S11 rasterećenje u uvodu sa kvalitetom, S12 paceBasis u planu sa rezultatom.
- Primeri `artifacts/segment-03/run.ts` (6 planova, `plans.md`), dva pokretanja bajt-isto (md5).

## Stalni uslovi (AGENTS.md)

| #   | stanje                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | put tempa `input.ts`; tempo `paces.ts`; mesto testa `periodize.ts`; brojevi početnika samo `policy.planRule`; doza `quality.ts` (buildLadder, deloadDose, beginnerTaperT); validator samo prijavljuje |
| 2   | H11 nepromenjen; test nije doza (bez plafona); 1,5 km je nivo lestvice, ne drugi limit                                                                                                                |
| 3   | WU/CD testa po H14, početnik 15/10; manjak ide u lagane ili izvodljiv cilj; dugi rasterećenja sa testom skraćen, WU/CD ne                                                                             |
| 4–5 | adaptacija i predaja nisu u segmentu; HI13 struktura uvoda pripremljena za 04                                                                                                                         |
| 6   | `hm-v2` / `hm-v2.2.0`; `paceBasis`; oznaka nedelje testa iz `periodize`; faza iz `periodize`                                                                                                          |
| 7   | `isolation.node` zelen (svi novi fajlovi uvoze samo iz foldera i `@/test/level`), bez novih izuzetaka                                                                                                 |
| 8   | uvod bez kvaliteta ali sa lagan ≥ 4 km; test ne „jede" nedelju (lagani ≥ 4 km, dugi ≥ lagan); sudar odbijen sa razlogom, nikad degenerisan plan                                                       |

## Otvorena pitanja

1. Sudar (gore): P1, P4, P5 ili P2 (ili drugo).
2. Dan testa duži od dugog iste nedelje (12/12/24/63 plana po osećaju; 6 d malog obima) — kao 10K 03, upozorenja nema.
3. Početnik 5 d: najduži dugi < 14 km u 189 / 756 planova (udeo 32 % pri 25–35 km) — upozorenje radi; prihvatljivo?
4. Početnik: start = prvi nivo (HI10, opreznije od H12 60 %); rasterećenje početnika min 1,5 km (H5 kaže 2,0).
