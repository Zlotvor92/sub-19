# Maraton v2 — Segment 01 (MAR-01): jezgro 4 dana sa rezultatom (marathon-v2.0.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `3fec5c5`. Novo samo
`web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**`; `marathon/index.ts`, maraton v1, lični plan i
ostale distance nepromenjeni (`git status`: samo ta dva foldera). Tehnički obrazac `tenK/v2/` (kopija, ne uvoz).

## Odluke (pravilo | mesto | test)

| id  | pravilo (sažeto)                                                                                           | mesto                                   | test                                          |
| --- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------- |
| M1  | 4 dana, 12–24 ned, 35–65 km, rezultat 10K/HM/M (5K + RESULT_5K) ≤ 84 d, VDOT 30–80                         | input.ts                                | input.node (9), validate RESULT_5K            |
| M2  | zone E/T/I/R iz VDOT-a; MP iz VDOT − korekcija (< 40: −2; 40–59,9: −1; ≥ 60: 0)                            | paces.ts                                | paces.node, validate PACES                    |
| M3  | Δ ≤ 0,08·N / ≤ 0,16·N, prema maratonskom VDOT-u                                                            | paces.ts assessGoal                     | paces.node, validate GOAL                     |
| M4  | taper 2, B = N − 3, specifično 4/5/6, baza ceil                                                            | periodize.ts                            | periodize.node, validate PHASES/TAPER_WEEKS   |
| M5  | ≤ 3 izgradnje (4 na početku faze), zabrane (pouka 4), 0,8 ×, T ≈ 60 % ≥ 2,0 km                             | periodize.ts, week/quality/lengths      | periodize.node, week.node, validate DELOAD_*  |
| M6  | ned 1 = obim; +6 % (1–5 km); vrh min(1,5×; +30; 80; kapacitet)                                             | volume.ts                               | volume.node, validate VOLUME_*, CAPACITY_NOTE |
| M7  | N−2 0,8 × (MP, T ≈ 60 %, dugi ≤ 0,65 ×), N−1 0,6 × (MP ≈ 50 %, bez T, dugi ≤ 0,45 ×)                       | quality.taperDoses, week.ts, lengths.ts | week.node, quality.node, validate TAPER_*     |
| M7a | M7 ispred M11 samo u taperu (MP min 2 × 3000 m i iznad 20 %)                                               | quality.taperDoses / pickTaper          | validate.node M7a, quality.node, sabotaža S9  |
| M8  | min(dani, 5); oštrenje 2 × 2000 MP ≥ 3 d, ≤ MP N−1; 20 min + 4 × 20 s; lagan min(30 min, N−1); 42,2 + WU 5 | week.ts, workouts.ts                    | week.node, validate RACE_*                    |
| M9  | Q1, Q2, dugi nesusedni (ciklično); dugi ulaz/ned/poslednji                                                 | schedule.ts                             | schedule.node, validate ROLES/HARD_ADJACENT   |
| M10 | lestvice po fazi; druga struktura (T ≥ 1000, MP ≥ 3000 ili kont. ≤ 16, I, R)                               | workouts.ts, quality.ts                 | quality.node, validate PHASE_QUALITY/REP_MIN  |
| M11 | R 5 %, I 8 %, T 10 %, MP 20 % po treningu                                                                  | policy caps, quality.capM               | quality.node, validate ZONE_CAP, mreža        |
| M12 | sledeći nivo / druga struktura; start ≤ 60 % plafona; T cruise ≥ T kont.; MP ≥ I                           | quality.ts                              | quality.node, validate DOSE_*/START_LEVEL/…   |
| M13 | dugi ≤ 40 % i ≤ 150 min, ≥ lagan; lagan ≥ 5 km; MARATHON_LONG_SHORT < 26 km                                | lengths.ts, validate.ts                 | week.node, validate LONG_*/EASY_MIN           |
| M14 | WU/CD < 50: 15/10, 50–69,9: 20/15, ≥ 70: 25/15; oporavci                                                   | workouts.ts                             | quality.node, validate WARMUP/RECOVERY        |
| M15 | red 4: 2 Q + 1 lagan, 35–65, max 80, 40 %, min 20                                                          | policy days                             | policy.node, validate WEEK_MIN_VOLUME         |

Svi brojevi zakucani u `policy.node.test.ts`; DECISIONS M1–M15 + M7a (pravilo, mesto, obrazloženje, izvor ili
„heuristika"). Validator samo prijavljuje (`validate.node`: plan se ne menja; 43 mutacije = 43 pravila grešaka).

## STANI i odluke organizatora

- Sudar M7 ↔ M11: MP tapera 2 × 3000 m > 20 % cilja kad je N−1 < 30 km — 48/4368 planova (svi 12 ned / 35 km:
  vrh 49,7 → N−1 29,8 km, plafon 5960 m). Odluka: opcija (b) = M7a; najviše 20,1 % nedelje; napomena +
  TAPER_MP_OVER_CAP. Dokaz: heš celog plana (stari tekst upozorenja) prema privremenoj verziji — promenjeno tačno
  48 planova, svi `12w-35km-*`; ostalih 4320 bajt-isto. Privremena verzija gasila je i oštrenje.
- Prihvaćeno: dublji taper (nalaz 1), MARATHON_LONG_SHORT kao M13 (novi tekst: najduži dugi + šta ga ograničava;
  menja samo poruku u 2832 planova), CAPACITY_LIMITED, tumačenja (M3, T min tapera 2,0 km, MP N−1 ≈ 50 %, trkačka
  nedelja bez „lagan ≥ 5 km").

## Odstupanja (svako sa ulazom; u DECISIONS)

| odluka  | odstupanje                                                                     | ulaz (primer)                            | mreža 01           |
| ------- | ------------------------------------------------------------------------------ | ---------------------------------------- | ------------------ |
| M7 / M6 | taper na najbliži izvodljiv cilj naniže (dugi ≤ 0,65/0,45 × + lagan ≤ dugi)    | 16w-45km-v45-A-sun: N−2 49,7 umesto 54,0 | N−2 2388, N−1 1548 |
| M12     | M11 ispred M12: doza spuštena u nedelji ograničenoj kapacitetom (DOSE_DROPPED) | spor-18w-45km-v30: ned 6 T 5,0 → 4,8 km  | 318 planova        |
| M10     | I 5,0 km nema drugu strukturu → ponavljanje (nedelja se razlikuje po Q2)       | 22w-45km-v40-A-sat ned 12                | 456 nedelja        |
| M8      | lagan trkačke 30 min E < 5 km (M13 ne važi za trkačku, prihvaćeno)             | spor-18w-45km-v30: 3,7 km                | 1638 planova       |
| M7      | T tapera van plafona otpada (M11 ispred M7)                                    | —                                        | 0                  |

## Kontrolne metrike (mreža 01: 13 × 7 × 8 × 3 × 2 = 4368; `artifacts/segment-01/metrics.json`)

- **K1** odbijanja 0, greške validatora 0.
- **K2** ned 1 < obim: 546 ukupno / 0 bez dugog na 150 min (najveći pad 16,5 km: 65 km, VDOT 30).
- **K3** nedelje izgradnje bez kvaliteta: 0.
- **K4** n/p (prvi segment); bazna linija `segment01.baseline.json` (4368 redova: vrh, planirano, najduži dugi,
  glavna doza, rasterećenja, N−2/N−1/trkačka, upozorenja, heš plana) za MAR-02.
- **K5** trkačka > taper 0; pad doze van kapaciteta 0; susedni teški dani 0; dugi < lagan 0.
- **K6** (4 dana) ponavljanja slota 456 ned (I 5,0); kvalitetni dan duži od dugog 0; CAPACITY_LIMITED 1656;
  vrh/start 1,382; DOSE_DROPPED 318; MARATHON_LONG_SHORT 2832; TAPER_MP_OVER_CAP 48; nedelje izgradnje spuštene
  13 398, podignute 78.

Taper/vrh po obimu (min / medijana) — N−2: 35 km 0,722 / 0,800; 40: 0,664 / 0,800; 45: 0,647 / 0,780; 50: 0,658 /
0,755; 55–65: 0,658 / 0,722–0,724. N−1: 35: 0,600 / 0,600; 40: 0,583 / 0,600; 45: 0,559 / 0,600; 50: 0,539 / 0,600;
55–65: 0,539 / 0,593. Invarijante (test, cela mreža u punom nivou): N−2 ≥ N−1 (cilj i planirano), taper ≤
poslednja izgradnja, trkačka bez trke ≤ N−1 — 0 prekršaja.

## Sabotaže (`node scripts/sabotage.mjs ../docs/marathon-v2/artifacts/segment-01/sabotage.json --parallel 2`)

9/9 PAO, ukupno 14,6 s, stanje src isto (heš a9e7921b…); rezultat `artifacts/segment-01/sabotage-result.json`.

| #   | sabotaža                              | prvi pali test (s)                               |
| --- | ------------------------------------- | ------------------------------------------------ |
| S1  | rasterećenje sme na prvu nedelju faze | periodize.node deloadAllowed (1,3)               |
| S2  | plafon MP 25 % u izboru doze          | quality.node plafon po treningu (1,1)            |
| S3  | lagan sme biti duži od dugog          | week.node taper (plan odbijen validatorom) (1,1) |
| S4  | taper 1 nedelja                       | periodize.node M4 faze (1,2)                     |
| S5  | oštrenje 2 dana pre trke              | grid K1 (validator obara planove) (4,4)          |
| S6  | lagan trkačke uvek 30 min E           | week.node M8 lagan ≤ N−1 (4,7)                   |
| S7  | početni nivo do 100 % plafona         | quality.node početni nivo (0,9)                  |
| S8  | rasterećenje 0,9 ×                    | week.node taper (plan odbijen validatorom) (1,0) |
| S9  | plafon MP vraćen u taper (M7a)        | validate.node M7a 12w/35km (4,0)                 |

## Komande i rezultati (iz `web/`)

- `npx tsc -p tsconfig.domain.json --noEmit` i `-p tsconfig.oracle.json` → exit 0 (prvo exit 2: `policy.node.test.ts`
  konverzija tipa lestvice → ispravljeno); `npx eslint src/domain/generators/marathon/v2` → exit 0;
  `npx prettier --check src/domain/generators/marathon/v2 ../docs/marathon-v2` → exit 0.
- `npx vitest run --project node src/domain/generators/marathon/v2` → 11 fajlova, 122 testa, zid 5,5 s (mreža:
  uzorak k = 6 + 7 imenovanih).
- `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2` → 13 fajlova, 132 testa, 10,7 s
  (mreža 4368 u 3 dela).
- `npm run check` → exit 0: typecheck, lint, format, 232 fajla, 2857 testova (zid 358 s, hladni keševi).
- Primeri: `node --experimental-strip-types docs/marathon-v2/artifacts/segment-01/run.ts` i `metrics.ts` dva puta
  → bajt-isti izlaz (sha1 svih json/md isti). Determinizam i u testu (svaki 6. ulaz, dva generisanja).

## Stalni uslovi (AGENTS.md)

| #   | uslov                          | stanje MAR-01                                                                                         |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1   | jedan vlasnik odluke           | obim volume.ts, doza quality.ts (taper: taperDoses), dužine lengths.ts, WU/CD workouts.ts; bez petlji |
| 2   | jedan plafon po zoni           | `caps` jedini limit zona; M7a je jedini izuzetak (MP u taperu), ne drugi limit                        |
| 3   | WU/CD nisu pufer               | WU/CD po pojasu ulaza, fiksni; manjak ide u lagane dane ili najbliži izvodljiv cilj (napomena)        |
| 4   | adaptacija                     | n/p (MAR-04); jedan konstruktor, koraci će ući kao ulaz                                               |
| 5   | handoff                        | n/p (faza 3)                                                                                          |
| 6   | policyId/Version, faza nedelje | `marathon-v2` / `marathon-v2.0.0`, faza iz periodize; validator POLICY_STAMP/PHASES                   |
| 7   | nula uvoza van foldera         | `isolation.node` (ni type-only; niko ne uvozi v2); postojeći architecture/isolation bez izmena        |
| 8   | upotrebljivost                 | min nedelje 20 km, lagan ≥ 5 km, dugi ≥ lagan, bez praznih → greška; invarijante mreže                |

## Tabela jednog plana — mali obim (16 ned, 35 km, VDOT 45 → MP 5:08, uto/čet/sub/ned)

| ned    | faza    | cilj           | Q1                                  | Q2                    | dugi           | lagan      |
| ------ | ------- | -------------- | ----------------------------------- | --------------------- | -------------- | ---------- |
| 1–3    | baza    | 35,0–39,3      | R 6×200, 8×200, 6×300               | T 2,0, 3,0, 2 × 1500  | 14,0–15,7      | 7,8–8,6    |
| 5–7    | razvoj  | 41,7–46,9      | I 2×1000, 3×1000, piramida          | T 3×1000, 2×1500, 3,0 | 16,6–18,7      | 10,5–12,3  |
| 9–13   | spec.   | 49,7–52,5      | MP 2×3000, 2×4000, 2×5000, 10 kont. | T 3×1600 / 2×2400     | 19,8–21,0      | 7,5–10,0   |
| 4/8/12 | raster. | 31,4/37,5/42,0 | —                                   | T 2,0 / 2,0 / 2×1200  | 12,5/14,9/16,8 | 2 lagana   |
| 14/15  | taper   | 42,0 / 31,5    | MP 2×3000 / 2×3000                  | T 2×1200 / —          | 13,6 / 9,4     | 11,0 / 5,8 |
| 16     | trka    | 17,7           | oštrenje MP 2×2000 (čet)            | —                     | —              | 30 min     |

Veliki obim (20 ned, 65 km, VDOT 55): vrh 80,0 od ned 6, dugi 26,0–28,7 (150 min), MP 2×4000 → 2×7000, taper
64,0 / 48,0, trkačka 22,2. Spor (18 ned, 45 km, VDOT 30): dugi 17,8 svih nedelja (150 min), vrh 57,1 (CAPACITY_
LIMITED), taper 37,9 / 33,3. Brz (18 ned, 45 km, VDOT 70, trka sub): vrh 67,5, dugi do 27,0, bez upozorenja.
Sve tabele: `artifacts/segment-01/examples.md`.

## Preostali problemi

- MARATHON_LONG_SHORT 65 % i CAPACITY_LIMITED 38 % planova — granica 4 dana (40 %, 150 min); MAR-02 (5/6 dana).
- Taper ispod 0,8 × kod 55 % planova (medijana N−2/vrh 0,72 pri 55–65 km) — prihvaćeno kao opreznija strana.
- I 5,0 km bez druge strukture (456 ponovljenih nedelja); R 3,2 km kao 16 × 200 m kad 8 × 400 ne raste dalje.
- Nedelja 1 ima dugi 40 % obima (npr. 26,0 km pri 65 km) — po M13, bez uvodnog praga.
- Udeli zona, korekcija obima (M2) i pragovi M3 su heuristike bez merenja na podacima.
