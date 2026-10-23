# Segment 03 — preostale trenerske odluke 4-dnevnog jezgra (5k-v2.2.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni `ce07ca6`; opseg ulaza isti; NIJE aktivirano.

## Odluke (`policy.ts` DECISIONS 5k-v2.2.0) i odstupanja

1. **Kapacitet 4 dana** (`volume.ts fourDayCapacityKm`): najveći T za koji 2 × (WU + CD) + 10% T (donja
   granica kvaliteta; izmereno pod 2.1.0 ≥ 11,8%) + dugi (≤ 35%, ≤ 90 min) + lagan (≤ dugi) ≥ T. Svaki cilj = min(želja, kapacitet); start = min(obim, kapacitet) + napomena „5 dana
   kasnije" + upozorenje `START_ABOVE_CAPACITY`. „Lagan = dugi" ostaje samo zaštita. *Odstupanje:* treći član
   dugog (prostor za min. lagan) na 0,1 km umesto 0,5 — inače rasteretna 13 km nedelja daje lagan 3,2 > dugi 3.
2. **Rasterećenje** (`periodize.ts`): sa prve nedelje vrhunca/oštrenja na poslednju nedelju prethodne faze;
   izostavlja se u poslednjoj nedelji izgradnje. Validator `DELOAD_PHASE_START`.
3. **Baza** (`workouts.ts baseWeek`): R raste do budžeta (isto/duže ponavljanje) ili se drži; T kontinuirano
   +0,5 km/ned do min(T budžet, 15 min), pa cruise; ista doza (R km, oblik T, T km) ≤ 2 nedelje, pa promena
   strukture T. Validator `BASE_PLATEAU`. *Odstupanje (pregled primera):* cruise odmah na limitu i R drži
   strukturu dok T raste — inače spor profil 45 km dobija R 10 × 150 m.
4. **Jedan T plafon** `tContinuousMaxSec {base 900, peak 1200, sharpen 900, taper 600}`, bez `shortTMaxSec`;
   `peakKm()` = min(1,3 × start, 50), oba člana obrazložena; kapacitet ne zavisi od 50 km.
5. **Brz + mali obim**: rasterećenje → glavni kvalitet, pa kratak T, pa R, uz ubrzanja (`weekQuality` — jedino
   mesto doze). Vrhunac: I neopadajući; bez višeg nivoa I se drži, T menja strukturu (cruise ↔ kontinuirano,
   inače ±0,5 km). RP u oštrenju ostaje strogo rastući.
6. **Trkačka nedelja**: lagan ≤ min(50 min sporijim E, 50% dugog prethodne nedelje); ostatak se ne raspoređuje
   (napomena; `PLANNED_VS_TARGET` tu ostaje upozorenje). Validator `RACE_WEEK_EASY`.

## Fajlovi

`fiveK/v2/`: policy, periodize, volume, workouts, generate, validate, types, novi `segment03.node.test.ts` (50),
ažurirani segment02/generate/workouts testovi; `artifacts/segment-03/` (run.ts + 2 profila); izveštaj; STATUS.

## Komande (iz `web/`) i rezultati

| komanda | rezultat |
|---|---|
| `npx tsc -p tsconfig.domain.json --noEmit` | exit 0 |
| `npx eslint src/domain/generators/fiveK/v2/` | exit 0 |
| `npx prettier --check src/domain/generators/fiveK/v2/` | exit 0 (posle `prettier --write`) |
| `npx vitest run --project node src/domain/generators/fiveK/v2/` | 6 fajlova / 240 testova prolazi |
| `segment03.node.test.ts` na kodu `ce07ca6` | 41 / 50 pada (svaka odluka 1–6 bar jedan pad) |
| `npx vitest run --project node src/domain/generators/` | 22 fajla / 383 testa prolazi (707 s; 1. pokušaj prekinut ručno posle ~25 min, bez greške) |
| `npm run check` | exit 0 (182 fajla / 2012 testova) |

## Mreža 240 ulaza (5 obima × 4 trajanja × 4 rezultata × 3 rasporeda)

| mera | pre (2.1.0) | posle (2.2.0) |
|---|---|---|
| planova / odbijeno | 228 / 12 | 240 / 0 |
| QUALITY_INFEASIBLE za 15 km + VDOT ~53 | 12 | 0 |
| nedelja „lagan = dugi" sa plannedKm < targetKm, van trkačke | 666 (93 plana) | 0 |
| rasterećenje u prvoj nedelji faze (vrhunac / oštrenje) | 171 (114 / 57) | 0 |
| planova sa 3 uzastopne iste doze baze | 12 | 0 |
| planova sa laganim danom trkačke nedelje > 50% prethodnog dugog | 222 | 0 |
| trkačke nedelje planirano < cilj (raspon planirano/cilj) | 0 | 228 (0,58–1,00) |
| nedelja sa zadržanim I / zamenom u rasterećenju | 0 / 0 | 9 / 3 |

## Stalni uslovi 1–8

| # | stanje | kako |
|---|---|---|
| 1 | ispunjen | cilj: volume.ts; doza: `weekQuality`; dugi/lagan: `buildTrainingWeek`/`buildRaceWeek`; jedan prolaz |
| 2 | ispunjen | jedan T plafon po fazi; jedna `peakKm()`; kapacitet je nosivost 4 dana, ne drugi vrh |
| 3 | ispunjen | WU/CD po pojasu; manjak samo u trkačkoj nedelji kao planirano < cilj uz napomenu |
| 4, 5 | n/p | adaptacija i handoff nisu u opsegu |
| 6, 7 | ispunjen | `policyId`/`policyVersion` 5k-v2.2.0, faza iz `periodize`; izolacioni test prolazi, uvozi samo unutar v2 |
| 8 | ispunjen | `WEEK_MIN_VOLUME`, `EMPTY_WORKOUT`, `EASY_LONGER_THAN_LONG` greške; mreža bez grešaka |

## dev-04 (VDOT 50, 35 km, 14 ned) — r = rasterećenje

| ned | faza | km cilj/plan | kvalitet | dugi | lagan max |
|---|---|---|---|---|---|
| 1–3 | baza | 35 → 37,8 → 40,8 (= plan) | R 4×400, 4×400, 5×400; T 2 → 2,5 → 3 km | 12–14 | 10,2–12,2 |
| 4r | baza | 32,6/32,6 | R 4×400 | 11 | 7,7 |
| 5 | baza | 44/44 | R 5×400; T 3,5 km | 15 | 13,9 |
| 6, 7 | vrhunac | 45,5/45,5 | I 4×700, 3×1000; T 2×2000 | 15,5 | 11,55 / 11,4 |
| 8r | vrhunac | 36,4/36,4 | I 2×1200 | 12,5 | 8,36 |
| 9 | vrhunac | 45,5/45,5 | I 4×800; T 2×2000 | 15,5 | 10,88 |
| 10, 11 | oštrenje | 45,5/45,5 | RP 3×1000, 4×800; R 7×300 | 15,5 | 12,38 / 12,09 |
| 12, 13 | taper | 38,7 / 31,9 (= plan) | RP 3×1000 + T 2 km; RP 2×1000 | 13,5 / 11 | 11,48 / 7,54 |
| 14 | trka | 22,8/19,49 | RP 4×400 (oštrenje) | — | 5,5 |

## edge-slow-45km (VDOT 30,1, 45 km, 12 ned) — kapacitet 31,1 km

| ned | faza | km cilj/plan | kvalitet | dugi | lagan max |
|---|---|---|---|---|---|
| 1 | baza | 31,1/31,1 | R 4×300; T 2 km (napomena: start = kapacitet) | 10,5 | 9,5 |
| 2, 3 / 4r | baza | 31,1 (= plan) / 24,9 | R 5×300; T 2×1200, 3×1000 / R 4×300 | 10,5 / 8,5 | 8,38, 7,66 / 5,9 |
| 5, 6 / 7r | vrhunac | 31,1 (= plan) / 24,9 | I 3×600, 4×500; T 2×1200 / I 2×800 | 10,5 / 8,5 | 8,44, 8 / 5,93 |
| 8, 9 | oštrenje | 31,1/31,1 | RP 3×600, 4×500; R 5×300 | 10,5 | 8,68 / 8,36 |
| 10, 11 | taper | 26,4 / 21,8 (= plan) | RP 2×800 + T 1,5 km; RP 2×800 | 9 / 7,5 | 7 / 5 |
| 12 | trka | 15,6/11,4 | RP 3×400 (oštrenje) | — | 3,7 |

Pod 2.1.0 isti ulaz: cilj 45 km, manjak do 26%. Kontinuitet 15 primera: bez platoa baze (edge-45km-16w T 3 →
3,5 km → 2×2000 → 3×1600 → 4×1200), prva nedelja faze nikad rasteretna, trkačka nedelja lagan ≤ 50% dugog.

## Preostali problemi

1. Trkačka nedelja: planirano 58–100% cilja (cilj = 50% vrha) — spustiti cilj ili prijavljivati manjak.
2. Zamena u rasterećenju (15 km + VDOT ~53, 8 ned) je R 4 × 150 m: kratak T 0,5 km < minimum 1 km.
3. R u bazi padne korak kad ni R ni T ne rastu (4×200 → 5×150); I ponekad skraćuje ponavljanje (nasleđeno).
4. Donja granica kvaliteta 10% je heuristika; ništa nije provereno na stvarnim korisnicima.
