# Maraton v2 — Segment 02 (MAR-02): 3/5/6 dana, piramida, skok dugog (marathon-v2.1.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `8ae290a` (kod = MAR-01 `e86d2c3`). Menjano samo
`web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**` (`git status`); `marathon/index.ts`, maraton v1,
lični plan, aplikacija i ostale distance nepromenjeni.

## Odluke (pravilo | mesto | test)

| id      | pravilo (sažeto)                                                                                                                                                                                             | mesto                                                                                     | test                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| M15     | 3 d 1 Q + lagan + dugi 30–50/60/50 %/15; 4 d kao 01; 5 d 2 Q + 2 lagana 40–85/100/35 %/25; 6 d 3 lagana 50–110/120/32 %/30                                                                                   | policy `days` (jedina tabela)                                                             | policy.node, input.node (obim po redu, preporuka dana)                     |
| M10/M15 | 3 d: jedan kvalitet T kont. → T cruise → MP, bez I/R; MP ≥ poslednje T; prelaz iste zone koji bi ponovio trening ide pravilom lestvice                                                                       | quality `ladderFor`, `carries`, `pickSlot(oneSlot)`                                       | quality.node, week.node, validate `SLOT_TYPES_ONE`, grid                   |
| M5      | rasterećenje 3 d: T na Q1; „poslednja T doza" = poslednje T izgradnje (`state.t`; 4–6 d = slot Q2, isto kao 01)                                                                                              | quality `pickDeload`, `deloadSlot`                                                        | quality.node, validate `DELOAD_CONTENT`                                    |
| M7      | 3 d: taper samo MP (N−2 60 %, N−1 50 %)                                                                                                                                                                      | quality `taperDoses(…, quality)`                                                          | quality.node, validate `TAPER_QUALITY`, grid                               |
| M9      | 3 d: Q1 nesusedan dugom, lagan bilo gde (`q2: null`); 5/6 d kao 4                                                                                                                                            | schedule `patternOf`                                                                      | schedule.node (sve kombinacije 3/5/6 dana)                                 |
| M10a    | pouka 27: bez druge strukture → piramida u opsegu zone, korak 200 m, isti zbir (I 5000 = 800-1000-1200-1200-800)                                                                                             | workouts `pyramidOf`, `structuresForDose`                                                 | quality.node, validate `REP_MIN`, regresija                                |
| M13a    | pouka 28 po odluci organizatora: dugi SVAKE nedelje ≤ max(1,1 L; L + 1,0), L = najduži dugi prethodne 4 ned (r = „ned 0"); neizvodljivo sa r → `RECENT_LONG_TOO_SHORT`; bez r napomena ned 1 sa pragom X/1,1 | lengths `jumpBase10`, `longJumpCap10`, `recentLongNote`; generate; volume `capacityWeeks` | volume.node, validate `LONG_JUMP`/`RECENT_LONG`/`VOLUME_START`, mreža M13a |
| M14     | pojas ≥ 70 km (25/15) sada dostižan (5/6 dana)                                                                                                                                                               | workouts (bez izmene)                                                                     | week.node M14 6 dana                                                       |

DECISIONS: M1–M15, M7a, M10a, M13a (zakucano u policy.node). Izvor M13a: Frandsen i sar., BJSM 2025 (DOI
10.1136/bjsports-2024-109380, naveden u `docs/qa/generator-ab/coaches/hm-review.md` S7) — posmatračka asocijacija,
uz oznaku heuristike. Tačka 4 zadatka (R 16 × 200 m) bez izmene.

## STANI i odluka organizatora

- Sudar (prvobitna pouka 28, samo ned 1): mala ned 1 + rast od stvarnog cilja (pouka 1) → rasterećenje / taper N−1 /
  ned 1 neizvodljivi. Mreža M13a (35 910): 1611 WEEK_INFEASIBLE, sve pri r ≤ 10 km; skok dugog ned 1 → 2 medijana
  ×1,41, najviše ×2,39. Odluka: (d) kotrljajuće pravilo + (a) odbijanje sa preporukom; (b), (c) ne.

## Odstupanja i tumačenja (svako sa ulazom)

| odluka   | odstupanje / tumačenje                                                                                             | ulaz (primer)                                           | mera                       |
| -------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------- |
| M13a     | bez r pravilo menja 78 planova 4 d (organizator očekivao samo tekst): stari skok +11,5 %                           | 12w-35km-v70-A-sat: ned 3 dugi 15,5 → 15,2 (13,9 × 1,1) | 78 (4 d), 234 (6 d)        |
| M13a     | nedelja na plafonu skoka nije CAPACITY_LIMITED (`capacityWeeks`)                                                   | d4 16 ned 45 km r = 10: ned 1 34,7 km                   | —                          |
| M5       | 3 d u specifičnoj fazi T rasterećenja ≈ 60 % poslednjeg T (ne MP)                                                  | d3-veliki ned 13: T 3 × 1000 (60 % od 6,0)              | —                          |
| M6 tekst | CAPACITY_LIMITED sada preporučuje veći broj dana (predviđeno u MAR-01); MARATHON_LONG_SHORT bez „(od segmenta 02)" | sve 4 d sa upozorenjem                                  | 1656 / 888 planova (tekst) |

## Kontrolne metrike (`artifacts/segment-02/metrics.json`; mreža 02 = 3120 + 4368 + 6240 + 8112 = 21 840)

| dana | K1 odb./greške | K2 ned 1 < obim (bez dugog na 150 min) | K3  | K5 (trkačka>taper, pad doze, susedni, dugi<lagan) | K6 ponavljanja  | piramida (ned) | kval. > dugi | CAPACITY_LIMITED | vrh/start | DOSE_DROPPED | LONG_SHORT | TAPER_MP_OVER_CAP | skok (ned/planova) |
| ---- | -------------- | -------------------------------------- | --- | ------------------------------------------------- | --------------- | -------------- | ------------ | ---------------- | --------- | ------------ | ---------- | ----------------- | ------------------ |
| 3    | 0 / 0          | 234 (0), najveći pad 8,0 km            | 0   | 0 / 0 / 0 / 0                                     | 0               | 0              | 0            | 1044             | 1,369     | 0            | 1896       | 1512              | 0 / 0              |
| 4    | 0 / 0          | 546 (0), 16,5 km                       | 0   | 0 / 0 / 0 / 0                                     | 0 (MAR-01: 456) | 336            | 0            | 1656             | 1,382     | 318          | 2832       | 48                | 78 / 78            |
| 5    | 0 / 0          | 390 (0), 13,8 km                       | 0   | 0 / 0 / 0 / 0                                     | 0               | 192            | 126          | 1302             | 1,397     | 24           | 3768       | 0                 | 0 / 0              |
| 6    | 0 / 0          | 468 (0), 19,3 km                       | 0   | 0 / 0 / 0 / 0                                     | 0               | 0              | 786          | 1482             | 1,339     | 0            | 4392       | 0                 | 618 / 234          |

- **K4** (4 dana prema `segment01.baseline.json`): vrh niži 0 planova.
- Gusta ned 1 (obim korak 0,1 × VDOT 30–80 korak 0,5, 12 ned, raspored A): 20 301 / 30 401 / 45 551 / 60 701 → K1 = 0;
  ned 1 < obim 926 / 2186 / 1198 / 1771, svi uz dugi na 150 min (invarijanta).
- Mreža M13a (dani × obim × VDOT {30,45,70} × 12/16/24 ned × A/B/C × r 5–42): 942 odbijanja, sva
  `RECENT_LONG_TOO_SHORT`; po r: 5 → 489, 6 → 309, 7 → 105, 8 → 39; po danima 369/243/174/156; po nedeljama plana
  12 ned 636, 16 → 153, 24 → 153; nedelja neizvodljivosti 1: 144, 4: 210, 5: 54, 11: 534. Prekršaja skoka 0; najveći
  skok ned 1 → 2: 6,0 → 7,0 km (×1,167, + 1,0 km). Ned 1 < obim u 10 587 prihvaćenih.

## Regresija 4 dana prema MAR-01 (ceo plan, `segment02.regression-01.json`, `regression-01.ts` iz worktree-a e86d2c3)

- 4368 planova: 4014 razlikuju se SAMO tekstom (napomena ned 1 M13a 4368; CAPACITY_LIMITED + napomena 1656;
  MARATHON_LONG_SHORT 888); 276 piramida (prva razlika uvek u nedelji sa piramidom; u redu bazne linije menja se samo
  najveće planirano, 36 planova — vrh cilja, dugi, doza, taper isti); 78 plafon skoka (red bazne linije isti). Drugih promena 0. Test mreže proverava sve tri grupe i red `segment01.baseline.json`.

## Sabotaže (`node scripts/sabotage.mjs ../docs/marathon-v2/artifacts/segment-02/sabotage.json --parallel 2`)

9/9 PAO, 9,2 s ukupno, stanje src isto (heš 28ba3def…); `artifacts/segment-02/sabotage-result.json`.

| #   | sabotaža                                   | prvi pali test (s)                      |
| --- | ------------------------------------------ | --------------------------------------- |
| S1  | udeo dugog 5 d 40 % umesto 35 %            | policy.node M15 (1,3)                   |
| S2  | 3 d: I u razvoju                           | quality.node M15 3 dana (1,3)           |
| S3  | piramida M10a isključena                   | quality.node M10a (1,4)                 |
| S4  | granica r: 5 km odbijen                    | input.node M13a (1,2)                   |
| S5  | skok 20 % umesto 10 %                      | volume.node plafon (1,7)                |
| S6  | lagani nejednaki 5/6 d                     | week.node 5/6 dana (1,3)                |
| S7  | kotrljajuće pravilo samo ned 1             | volume.node kratak skorašnji dugi (1,6) |
| S8  | odbijanje RECENT_LONG_TOO_SHORT isključeno | volume.node RECENT_LONG_TOO_SHORT (1,6) |
| S9  | 3 d: T u taperu N−2                        | quality.node taper (1,6)                |

## Komande i rezultati (iz `web/`)

- `npx tsc -p tsconfig.domain.json --noEmit` i `-p tsconfig.oracle.json` → exit 0 (prvo exit 2: `schedule.node`
  `p.q2` sada `Weekday | null`, i `structuredClone` u `testInputs.ts` → ispravljeno); `npx eslint …/marathon/v2` exit 0;
  `npx prettier --check …/marathon/v2 ../docs/marathon-v2` exit 0.
- Brz: `npx vitest run --project node src/domain/generators/marathon/v2` → 13 fajlova, 153 testa, 27 s.
- Pun: `TEST_FULL=1 …` → 27 fajlova, 201 test, exit 0, zid 240 s (mreža 02 u 6, gusta u 8, M13a u 3 dela).
- `npm run check` → exit 0: typecheck, lint, format, 235 fajlova, 2892 testa (zid 382 s).
- `run.ts` i `metrics.ts` dva puta → bajt-isti izlaz (sha1 svih json/md isti, i posle prettier-a).

## Stalni uslovi (AGENTS.md)

| #   | uslov                          | stanje MAR-02                                                                                                        |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | jedan vlasnik odluke           | dani `days`; doza quality.ts; dužine i skok lengths.ts (`longJumpCap10` jedina funkcija); cilj volume.ts; bez petlji |
| 2   | jedan plafon po zoni           | `caps` nepromenjeni; plafon skoka je ograničenje dugog (M13), ne zone                                                |
| 3   | WU/CD nisu pufer               | WU/CD po pojasu ulaza, isti za sve dane; manjak ide u najbliži izvodljiv cilj ili odbijanje                          |
| 4   | adaptacija                     | n/p (MAR-04); istorija dugih ulazi u konstruktor, ne posle                                                           |
| 5   | handoff                        | n/p (faza 3)                                                                                                         |
| 6   | policyId/Version, faza nedelje | `marathon-v2` / `marathon-v2.1.0`; faze iz periodize; validator POLICY_STAMP/PHASES                                  |
| 7   | nula uvoza van foldera         | `isolation.node` zelen; bez novih izuzetaka                                                                          |
| 8   | upotrebljivost                 | min nedelje po redu (15/20/25/30), lagan ≥ 5 km, dugi ≥ lagan, lagani jednaki, 3 d bez I/R — invarijante svih mreža  |

## Tabela jednog plana — 3 dana, mali obim (16 ned, 30 km, VDOT 40 → MP 5:41, uto/čet/ned)

| ned      | faza    | cilj           | kvalitet (čet)                   | dugi           | lagan (uto) |
| -------- | ------- | -------------- | -------------------------------- | -------------- | ----------- |
| 1–3      | baza    | 30,0–33,7      | T 2,0 kont., 3,0 kont., 2 × 1500 | 15,0–16,8      | 9,0–9,9     |
| 5–7      | razvoj  | 35,7–40,1      | T 3 × 1000, 2 × 1500, 3,0 kont.  | 17,8–20,0      | 10,7–13,2   |
| 9–11, 13 | spec.   | 42,5–45,0      | MP 2 × 3000, 2 × 4000, 8,0 kont. | 21,2–22,2      | 10,7–11,2   |
| 4/8/12   | raster. | 27,0/32,1/36,0 | T 2,0 kont.                      | 13,4/16,0/17,7 | 7,7–12,4    |
| 14/15    | taper   | 36,0 / 27,0    | MP 2 × 3000 / 2 × 3000 (M7a)     | 14,4 / 9,9     | 11,5 / 7,0  |
| 16       | trka    | 12,9           | oštrenje MP 2 × 2000 (čet)       | —              | 4,7         |

Ostali primeri (`artifacts/segment-02/examples.md`): 3 d 50 km VDOT 55 (vrh 60, dugi 28,7 = 150 min), 4 d piramida,
4 d r = 10 (ned 1 34,7 km, dugi 11,0 → 12,1 → 13,3 …), 5 d spor, 6 d 90 km VDOT 60 (vrh 120, dugi 30,8 = 150 min).

## Preostali problemi

- 3 dana: TAPER_MP_OVER_CAP 1512 / 3120 (48 %; M7a: 2 × 3000 m > 20 % malog tapera) — prihvaćeno pravilo M7a, ali
  udeo je visok; trenerska odluka.
- 3 dana: T plato (T 6,0 km kont. ↔ 2 × 3000 m više nedelja kad T cruise 6,4 ne staje u 10 %), d3-veliki ned 9–11.
- 5/6 dana: MARATHON_LONG_SHORT 60 % / 54 % (udeo 35/32 % + 150 min); kvalitetni dan duži od dugog 126 / 786 planova.
- M13a: bez r pravilo menja 78 planova 4 d i 234 plana 6 d (skok > 10 % u izgradnji); 942 odbijanja pri r ≤ 8 km.
- Udeli zona, korekcija obima (M2), pragovi M3/M13a i tabela M15 su heuristike bez merenja na podacima.
