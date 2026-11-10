# P8-10K — ispravke po slepoj oceni + dopuna po glavnom treneru (10k-v2.13.0)

10. 11. 2026 (Europe/Belgrade). Polazno `9055e5b1` (10k-v2.12.0). Zadatak: `briefs/P8-ispravke-po-slepoj-oceni.md`
(G1–G3, 10K a–c) i `briefs/P8-dopuna-po-glavnom-treneru.md` (G4–G8, izmene G1/G2/G3, 10K c; važi dopuna). Odluke koje
traže organizatora: `P8-10K-STOP.md` (S1–S8). Izmene samo u `web/src/domain/generators/tenK/v2/**` i dokumentaciji
(van foldera samo oznaka verzije: `features/onboarding/tenKV2Flow.test.tsx`, `e2e/tenk-v2.spec.ts`).

**Stanje testova: NIJE zeleno** (v. „Testovi"). Kod i merenja su gotovi; preostaje usklađivanje 23 test fajla
(očekivanja starih pravila, nezavisne invarijante, referentni heševi) i 1 odbijanje adaptacije (S8).

## Šta je ugrađeno (policy.ts D39–D48)

| odluka | pravilo | mesto (jedan vlasnik) |
|---|---|---|
| D39 G1 | korak rasta = min(D6; (granica − poslednji) / preostale ne-rasteretne nedelje baze i razvoja); preostale iz OSNOVNE periodizacije (prošlost adaptiranog plana = upisano); naviše (izvodljiv cilj) najviše do D6 | `volume.buildWeeksLeft`, `growthStep10`, `fit10(upMax10)` |
| D40 G2 | plafon zone = max(udeo × cilj; prvi nivo lestvice zone: T 2,0 / početnik 1,5 km, I 2 × 1000, R 6 × 200, RP 2 × 1200 m) | `quality.zoneFloorM`, `capM` |
| D41 G3 | tekst za trkača: prevod napomena i poruka, bez internih izraza, svako upozorenje jednom, test završava uputstvom | `userNotes.ts` → `app/plan.ts` |
| D42 10K c | SHORT_EASY: lagan < 30 min ili odmor + preporuka manje dana; PRVO u planu, sa brojem dana | `validate.ts`, `userNotes.ts` |
| D43 G4 | plafon treninga u minutima rada: T 30 (≥ 80 km: 40), I 20 (VDOT < 40) / 24, RP 30 min — član `capM` | `quality.minutesCapSec`, `capM(…, p)` |
| D44 G5 | oštrenje = 2 jednake deonice RP ≤ 12 min, 400–1500 m (100 m), ≤ RP tapera | `week.sharpenerSpec` |
| D45 G1a/b | vrh ≤ start × 1,30/1,35/1,40 (≤ 12 / 13–15 / ≥ 16 ned) i ≤ 6/7/8 h po VDOT; vrh ≥ start; korak < 3 % se ne primenjuje | `volume.peakCap10`, `growthStep10` |
| D46 G7 | u nedelji testa test je jedini kvalitet; test ne pre nedelje 4 | `periodize.testWeekOf`, `week.buildWeek`, `validate` ROLES |
| D47 G6 | lagan ≤ 0,70 × dugi (4–6 dana), 0,80 (3 dana) — tabela D17 | `policy.days[n].easyMaxLongShare`, `lengths.buildEasyBounds10` |
| D48 G8 | početnik: u 3 poslednje ne-rasteretne nedelje izgradnje udeo dugog do min(50 %, 10 km / cilj); ispod 10 km jedna rečenica | `lengths.longToRaceWeeks`, `longShareOf` |
| G3 dopuna | trkački dan: „Trka 10 km — prognoza m:ss (pre trke 15 min lagano, posle 10 min)" | `workouts.raceWorkout` |

Nije ugrađeno (odluka organizatora, STOP): G5 taper ≤ 60 % najvećeg (S5), G5 rasterećenje bez donje granice (S6),
10K b najmanja izmena udela dugog (S2 — zamenjena sa G8), T početnika iznad 1,5 km (S3).

## Komande merenja (iz `web/`; nisu testovi)

- **M1** `node ../docs/generators-v2/perfection/P8-10K/measure.ts <oznaka> [brzo]` (≈ 2,5 min; brzo = P0 + P7 ≈ 1 s)
  → `raw-<oznaka>.json` (nije u repou); **M2** `node …/P8-10K/summary.cjs pre dopuna` → `summary-pre-dopuna.txt`.
  Oznake: `pre` = stablo 9055e5b1 (10k-v2.12.0), `posle` = G1–G3 (stanje pre dopune), `dopuna` = vrh grane.
- **M3** `node …/P8-10K/p7table.cjs pre dopuna` (12 profila P7); **M4** `node …/P8-10K/minutes.ts` (G4/G5, P0 + P7).
- **M5** `node …/P8-10K/corpus.ts posle` / `corpus.ts sirovo sve sirovo` → `corpus-*.tsv` (tekst kakav vidi trkač /
  doslovno iz plana, isto stablo); **M6** `node …/P8-10K/beginnerLong.ts` (dugi početnika, S2).
- **M7** ispisi 12 profila „posle P8" (tekst kroz userNotes): `node …/P8-10K/dump-user.ts <dir>` pa `P7/render.ts` (A = B)
  → `P8-10K/plans/p01–p12.txt`. `P7/plans` nije diran.

## Zamerka iz ocene → uzrok → izmena → pre / posle (12 profila P7, M3; pre = 10k-v2.12.0, posle = vrh grane)

| zamerka (P7/reviews/10K.md) | uzrok | izmena | pre → posle |
|---|---|---|---|
| 2 plato obima | rast +6 % do granice → vrh u ned 5–7 | G1, G1b | p11 vrh u ned 7 → 11 (kraj razvoja 12), nedelja na vrhu 7 → 4; p10 6 → 4; P0 planova sa ≥ 5 ned na vrhu 55 → 8 |
| 2 plato (p04) | satni plafon (G1a) = start | G1a doslovno | p04 vrh 61,3 → 50,0 km = start, 12 ned na vrhu (S7) |
| 1 dugi plato | plafon 105 min / udeo veže od ned 1 | — (talas dugog: krug 2) | p04 14,0 km 12 ned (isto), p08 17,1 km 12 ned (isto) |
| 3 početnik < 10 km | udeo D17 × vrh 1,3 × start (M6: 1134 / 3402) | G8 | p11 najduži 8,7 → 9,7 km + rečenica „treba bar 20 km nedeljno" |
| 3/4 početnik bez RP, taper/rasterećenje bez kvaliteta | 10 % nedelje < prvi nivo | G2 | p11 ned. sa RP 0 → 4, taper bez RP 1 → 0; mreža B planova bez RP 918 → 0, taper bez kvaliteta 378 → 0, rasterećenje bez kvaliteta 654 → 0 |
| 4 T 1,5 km × 9–13 | 10 % nedelje ne nosi 2,0 km | nije (S3) | p11 T 1,5 km ned 3–11 (isto) |
| 5 lagani 3–4 km (p06) | 5 dana × 30 km | D42 (upozorenje prvo, „3–4 dana") | p06 bez upozorenja → upozorenje kao prva poruka |
| 5 lagani 80 % dugog | T1 0,8 | G6 0,70 (4+ dana) | P0: pad vrha > 10 % u 4/44 planova 4 dana (9,1 %, prag STOP 10 %) |
| 8 dva jaka napora u 48 h (test pa T) | Q2 ostaje u nedelji testa | G7 | nedelja testa: 0 drugih kvaliteta; test ne pre ned 4 (F mreža: 400 planova test ned 2–3 → ≥ 4) |
| 9 taper / oštrenje preteški | oštrenje 3 × 1000 m | G5 oštrenje | oštrenje > 12 min rada: 51 → 0 (M4); taper > 60 % najvećeg 81/204 (S5) |
| (trener) trening predug u minutima | plafon samo u km | G4 | T > 30 min 58 → 0, I > 20/24 min 56 → 0, RP > 30 min 79 → 0 (M4) |
| 10 tekst | interne napomene | G3 | tehničkih napomena trkaču (12 profila) 129 → 0; p08 29 → 0, p04 27 → 0 |
| 6/7 ubrzanja, test | već P5 | — | isto |

## Mreže (M1/M2; 34 350 planova: P7 12, P0 192, 01 3024, 02 15 840, F 11 880, B 3402)

| metrika | pre | dopuna |
|---|---|---|
| odbijanja generatora (sve mreže) | 0 | 0 |
| P0: planova sa ≥ 5 ned na vrhu obima / vrh pre poslednje-3 nedelje razvoja | 55 / 59 | 8 / 17 |
| 02: isto | 3552 / 2022 | 1002 / 816 |
| P0 / 02 / F nedelje > 25 % brzih km | 10 / 234 / 684 | 0 / 0 / 180 |
| nedelje > 30 % brzih km (F) | 12 (0,1 % planova) | 12 (0,1 %) |
| taper bez kvaliteta (P0 / 02 / F / B) | 10 / 48 / 36 / 378 | 0 / 0 / 0 / 0 |
| rasterećenje bez kvaliteta (P0 / 02 / F / B) | 22 / 528 / 288 / 654 | 0 / 0 / 0 / 0 |
| B: planova bez RP | 918 | 0 |
| P0 / 02 nedelje WEEK_FITTED | 444 / 34 236 | 430 / 32 166 |

Promenjeni planovi: svi (G1/G2/G4/G5 i oznaka verzije) — dokaz po klasi bajt-isto nije rađen (v. „Šta nije urađeno").

## Sabotaže (prvi deo, G1–G3, D42)

`node scripts/sabotage.mjs ../docs/generators-v2/perfection/P8-10K/sabotage-P8.json --quiet` — **9/9 palo**, 72 s
(`P8-10K/sabotage-P8.result.json`). Za dopunu (G4–G8) sabotaže nisu napisane; `p8.node.test.ts` ima testove G4, G5,
G1a, G6, G7, G8 i 10K c (15/15 zeleno).

## Testovi (komanda — trajanje — ishod)

- `npx vitest run --project node src/domain/generators/tenK/v2` (brz), posle G1–G3 i usklađivanja: 2 min 02 s — 41
  fajl, 428/428 zeleno.
- Isto posle dopune: 1 min 54 s — **23 fajla, 63 testa pada**: (a) očekivanja kodirana po starim pravilima (policy
  tabele i DECISIONS, beginner, volume, week, quality, validate, feel, periodize, lockedTest, painGrid primeri,
  reliefGrid primeri, earlyGrid primeri, p35, p5, schedule, segment08, adaptFlow); (b) nezavisne invarijante
  (`gridInvariants`: TEST_FLAG/TEST_ONE po G7, LONG_CAP po G8, BEGINNER_GROWTH po G1b); (c) referentni heševi tokova
  (`earlyGrid` regresija 51a924f, mreža E 102 707 → 98 395 tokova) — treba fixture promenjenih planova (obrazac
  `segmentP5.changed-*.json`, P5-10K/mkfxP5.py); (d) 1 odbijanje adaptacije (S8).
- Pun nivo `TEST_FULL=1 … tenK/v2`: pokrenut posle G1–G3 (04:54 UTC = 05:54), prekinut restartom radnika; posle
  dopune nije pokretan (brz nivo nije zelen).
- `npm run check`, `--changed`, E2E, build: nisu pokretani (isti razlog).

## Šta nije urađeno i zašto

1. Usklađivanje 23 test fajla sa dopunom i P8 fixture referentnih heševa — mehanički posao (Sonnet), posle odluka
   S1/S5/S6/S7 (menjaju iste brojke).
2. S8 (odbijanje A6 + rasterećenje) — treba dijagnoza konstruktor/validator za poslednju T dozu sa G4.
3. G3 dopuna „nazivi faza na srpskom svuda" — nije provereno van `app/plan.ts`.
4. Sabotaže G4–G8.
5. Merenje zamerke 1 (dugi plato) i 8 (najteža nedelja pred taper) — van P8 (krug 2).

## Mišljenje (nije merenje)

G2 + G3 + G4 + G5 oštrenje rešavaju najteže tvrde zamerke (početnik bez RP, taper bez kvaliteta, predugi treninzi,
tekst). G1a doslovno pravi ravan plan kod sporog trkača sa većim obimom (S7) — ocena ga je već kaznila; treba odluka.
