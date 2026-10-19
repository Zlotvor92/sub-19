# HM v2 — Segment 01: jezgro polumaratona, 4 dana sa rezultatom (hm-v2.0.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`; polazni SHA `3fec5c5`, zaustavljanje `faf8807`
(`SEGMENT-01-STOP.md`, ostaje kao istorija), odluka organizatora: udeo dugog 4 dana 0,40 (P2), tumačenja HI1/HI4 i
odbijanja van opsega prihvaćena. Menjano samo `web/src/domain/generators/halfMarathon/v2/**` i `docs/hm-v2/**`;
HM v1, `halfMarathon/index.ts`, lični plan i druge distance netaknuti.

## Odluke | mesto | test (sve u `policy.ts` DECISIONS; brojevi zakucani u `policy.node.test.ts`)

| odluka                                                                                                                                         | mesto                           | test                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| H1 opseg, odbijanja sa preporukom (10K, „počni kasnije", segment 02/03)                                                                        | input.ts                        | input.node                                                            |
| H2 VDOT, zone, RP = prognoza HM iz trenutnog VDOT-a; H3 ocena cilja                                                                            | paces.ts                        | paces.node                                                            |
| H4 faze; H5 gde je rasterećenje (pouka 4)                                                                                                      | periodize.ts                    | periodize.node, mreža                                                 |
| H5 sadržaj (T ≈ 60 %, dugi 0,8 ×), H7 taper (RP/T ≈ 60 %, dugi ≤ 0,6 ×)                                                                        | quality.ts, lengths.ts, week.ts | quality.node, week.node, validate.node                                |
| H6 obim iz stvarne konstrukcije, najbliži izvodljiv cilj (pouke 1, 9)                                                                          | volume.ts                       | volume.node, validate.node (WEEK1_BELOW_START)                        |
| H8 trkačka nedelja (pouka 5)                                                                                                                   | week.ts raceWeek, workouts.ts   | week.node, validate.node                                              |
| H9 raspored                                                                                                                                    | schedule.ts                     | schedule.node                                                         |
| H10/HI1 lestvice, druga struktura (pouka 11); H11 plafon (pouka 10)                                                                            | workouts.ts, quality.ts         | quality.node                                                          |
| H12 progresija, početni nivo, pad doze samo uz kapacitet (pouke 3, 12)                                                                         | quality.ts                      | quality.node, validate.node, mreža                                    |
| H13 dužine, dugi ≥ lagan (pouka 2), LONG_RUN_SHORT                                                                                             | lengths.ts, validate.ts         | week.node, validate.node                                              |
| H14 WU/CD po pojasu, oporavci                                                                                                                  | workouts.ts                     | week.node, quality.node                                               |
| H15 red 4 dana (udeo 0,40), Uslov 8                                                                                                            | policy.ts days                  | policy.node, mreža                                                    |
| HI2 druga pretraga (popuštanje); HI3 upozorenje kvalitet > dugi (pouka 14); HI4 T 2,0 km = 2 × 1000 m u T cruise                               | volume.ts, week.ts, validate.ts | validate.node, mreža                                                  |
| HI5 pouka 27 (MASTER posle `faf8807`): I bez druge podele → piramida korak 200 m (2000 → 800-1200, 5000 → 800-1000-1200-1200-800), naizmenično | workouts.ts stepPyramid         | quality.node; mreža i K bajt-isti pre/posle (u mrežama 0 ponavljanja) |

Validator (`validate.ts`) samo prijavljuje: svaka odluka ima pravilo (14 mutacija u `validate.node`, plan se ne menja).
Jedna funkcija za konstruktor i validator (pouka 24): `nominal10`, `weekMin10`, `deloadDose`, `taperDoses`,
`deloadLong10`, `taperLongCap10`, `sharpenerDate`, `raceWeekRuns`. Zato mreža proverava i NEZAVISNE invarijante
(`gridInvariants.ts`, brojevi iz odluka, ne iz koda).

## Odstupanja (svako sa ulazom)

- H15 udeo dugog 35 % → 40 % (odluka organizatora): uz 35 % mreža 01 396 / 3696 odbijeno (10w-35km-v30-A-sat: ned 1
  najviše 34,6 km, dugi na udelu); merenje `artifacts/segment-01/measure-share.ts`.
- HI2: druga pretraga (H11 ispred H12) javlja se samo u nedeljama ograničenim kapacitetom — DOSE_DROPPED 102 plana,
  K5 „pad doze van kapaciteta" 0; npr. `15w-55km-v35-A-sat` ned 6 (cilj 63,9 → 58,4 km, T 6,0 → 4,8 km); ćelije VDOT 35 pri 45–60 km i VDOT 40 pri 60 km. Taper/rasterećenje bez kvaliteta ili samo RP: 0.
- Izgradnja naviše (najbliži izvodljiv cilj, H6): mreža 01 0 nedelja, gusta 15 (npr. 43,8 km VDOT 31: ned 6 52,2 →
  55,6 km umesto 55,3), uvek ≤ granica izgradnje.

## Sabotaže (`node scripts/sabotage.mjs ../docs/hm-v2/artifacts/segment-01/sabotage.json --parallel 2`): 8/8 PAO, 21,0 s

| #   | izmena                                        | prvi pali                                                         | s   |
| --- | --------------------------------------------- | ----------------------------------------------------------------- | --- |
| S1  | rasterećenje dozvoljeno na prvoj nedelji faze | periodize.node „pravila: nikad u ned 1–2, na prvoj nedelji faze…" | 1,7 |
| S2  | sledeći nivo bez provere plafona              | quality.node „sledeći nivo ako staje…"                            | 1,5 |
| S3  | lagan sme biti duži od dugog                  | week.node „dugi ≤ 40 % … ≥ lagan"                                 | 4,7 |
| S4  | taper 0,8 × vrh (deljena funkcija)            | week.node „taper: 0,7 × vrh…"                                     | 6,8 |
| S5  | RP tapera 100 % (deljena funkcija)            | quality.node „taper: RP i T ≈ 60 %…"                              | 1,5 |
| S6  | oštrenje 2 dana pre trke                      | week.node (plan odbijen: RACE_SHARPENER)                          | 5,3 |
| S7  | lagan trkačke uvek 35 min                     | week.node (plan odbijen: RACE_WEEK_EASY / OVER_TAPER)             | 5,8 |
| S8  | udeo dugog nazad 0,35                         | dense.node „K1: 0 odbijanja…"                                     | 6,1 |

Isti ulaz samo sa `grid.node` (provera nezavisnosti): S2–S8 padaju (S4, S5 na nezavisnim invarijantama, ostali na K1);
S1 NE pada — raspored rasterećenja mreže se ne menja (pretraga i dalje bira iste nedelje), pravilo čuva periodize.node.

## Komande i rezultati (iz `web/`)

- `npx tsc -p tsconfig.domain.json --noEmit`, `npx tsc -p tsconfig.oracle.json --noEmit`, `npx eslint src/domain/generators/halfMarathon/v2`,
  `npx prettier --check src/domain/generators/halfMarathon/v2 ../docs/hm-v2` → exit 0.
- `npx vitest run --project node src/domain/generators/halfMarathon/v2` (brz) → 12 fajlova, 84 testa, 7,0 s zida.
- `TEST_FULL=1 npx vitest run --project node src/domain/generators/halfMarathon/v2` (pun) → 15 fajlova, 91 test, 46,7 s.
- `npm run check` → exit 0 (244 fajla, 2941 test, 6 min 36 s zida; posle pull-a sa maratonom v2 01).
- `node docs/hm-v2/artifacts/segment-01/run.ts` dva puta → md5 svih fajlova isti. `node …/k-metrics.ts` → 57 s.
- Bazna linija `segment01.baseline.json` (3696 redova: vrh, najduži dugi, heš plana bez oznake verzije) za regresiju
  sledećeg segmenta; piše je `TEST_FULL=1 HM_V2_WRITE_BASELINE=1 npx vitest run … grid.node.test.ts`.

## K1–K6 (`node docs/hm-v2/artifacts/segment-01/k-metrics.ts`)

|                                                                                              | mreža 01 (3696)                            | gusta ned 1 (30 401: 30,0–60,0 km × VDOT 30–80 / 0,5, 10 ned) |
| -------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| K1 odbijanja / greške validatora                                                             | 0 / 0                                      | 0 / 0                                                         |
| K2 ned 1 < obim: ukupno / bez dugog na 150 min                                               | 264 / 0                                    | 935 / 0                                                       |
| K3 nedelje izgradnje bez 2 kvaliteta                                                         | 0                                          | 0                                                             |
| K4 vrh niži od prethodnog segmenta                                                           | n/p (prvi segment; bazna linija snimljena) | n/p                                                           |
| K5 trkačka > taper / pad doze van kapaciteta / susedni teški / dugi < lagan                  | 0 / 0 / 0 / 0                              | 0 / 0 / 0 / 0                                                 |
| K6 ponavljanje slota (ned) / kvalitet duži od dugog (planova) / CAPACITY_LIMITED / vrh/start | 0 / 0 / 774 / 1,329                        | 0 / 22 / 3301 / 1,348                                         |
| ostalo: DOSE_DROPPED / izvodljiv cilj (ned) / najduži dugi < 16 km                           | 102 / 6360 / 6                             | —                                                             |
| nezavisne invarijante (Uslov 8, pouke 1–5, 9, 12, 14)                                        | 0 prekršaja                                | 0 prekršaja                                                   |

K6 po broju dana: samo 4 dana (segment 01). CAPACITY_LIMITED: VDOT 30–40 pri 40–60 km (dugi na 150 min).

## Stalni uslovi (AGENTS.md)

| #    | uslov                  | stanje                                                                                                                                                            |
| ---- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | jedan vlasnik odluke   | obim `volume.ts`, doza `quality.ts`, dužine `lengths.ts`, WU/CD `workouts.ts`; bez petlji skraćivanja; validator samo prijavljuje (validate.node „ne menja plan") |
| 2    | jedan plafon po zoni   | `caps` (H11) jedini limit; rasterećenje/taper/druga pretraga poštuju isti plafon                                                                                  |
| 3    | WU/CD nisu pufer       | WU/CD po pojasu ulaza, konstantni; manjak ide u lagan dan ili izvodljiv cilj (WEEK_FITTED)                                                                        |
| 4, 5 | adaptacija, predaja    | nisu u segmentu (04, faza 3)                                                                                                                                      |
| 6    | policyId/Version, faza | `hm-v2` / `hm-v2.0.0`; faza svake nedelje iz `periodize`; validator POLICY_STAMP / PHASES                                                                         |
| 7    | nula uvoza van foldera | `isolation.node` (ni type-only; niko ne uvozi v2); HM/arhitektura testovi bez izuzetaka                                                                           |
| 8    | upotrebljivost         | nedelja ≥ 16 km (trkačka + 21,1), lagan ≥ 4 km, dugi ≥ lagan, bez praznih — greška; invarijante mreže                                                             |

## Primeri (`artifacts/segment-01/plans.md`, ceo plan u `<id>.json`)

`10w-30km-v45-A-sun` (mali obim): vrh 42,0; dugi 12,0 → 16,8; taper 29,4 (RP 2 × 2000, T 2 × 1200); trkačka 16,6.
`18w-60km-v55-B-sun` (veliki obim):

| ned       | faza         | cilj               | Q1                                        | Q2                      | dugi      | lagan       |
| --------- | ------------ | ------------------ | ----------------------------------------- | ----------------------- | --------- | ----------- |
| 1–3       | baza         | 60,0 / 63,6 / 67,4 | R 6 × 300, 10 × 200, 8 × 300              | T 3,0 / 4,0 / 5,0 kont. | 24,0–26,9 | 13,6–14,9   |
| 4         | baza (rast.) | 53,9               | —                                         | T 3,0 kont.             | 21,5      | 10,7 + 10,7 |
| 5–6       | baza         | 70,0               | R 8 × 400, 16 × 200                       | T 6,0 / 7,0 kont.       | 28,0      | 13,9 / 12,7 |
| 7, 9–11   | razvoj       | 70,0               | I 3 × 1000 … 5 × 1000                     | T 2 × 3500 ↔ 7,0 kont.  | 28,0      | 14,2–11,1   |
| 8, 13     | rasterećenje | 56,0               | —                                         | T 4 × 1000              | 22,4      | 10,5 + 10,5 |
| 12, 14–16 | spec.        | 70,0               | RP 2 × 3000, 2 × 4000, 3 × 3000, 2 × 5000 | T 2 × 3500 ↔ 7,0 kont.  | 28,0      | 12,3–8,5    |
| 17        | taper        | 49,0               | RP 2 × 3000                               | T 4 × 1000              | 16,8      | 5,2         |
| 18        | trka         | 22,9               | oštrenje RP 2 × 2000 (sre)                | —                       | —         | 5,2 + 5,2   |

`16w-50km-v30-C-sat` (spor): ned 1 49,0 (dugi 17,8 = 150 min), vrh 57,8 (granica 70), lagan = dugi 17,8 u izgradnji.
`12w-30km-v70-A-sun` (brz): lagan 4,0–4,1 km svake nedelje izgradnje, dugi 9,6 → 16,0, taper dugi 6,1.

## Preostali problemi

- Veliki obim: vrh 70 km dostignut u ned 5 i držan do tapera — 10 nedelja sa dugim 28 km (40 %, ≈ 146 min po srednjem E) i istim
  obimom; pravila (H6 granica, H13) to dozvoljavaju; trenerska odluka (npr. plato ili ponovljeno rasterećenje).
- Spor trkač 40–60 km: lagan jednak dugom (17,8 km, ≈ 2 h 23 min po srednjem E) u svim nedeljama izgradnje; vrh ispod granice
  (CAPACITY_LIMITED 774 plana) — rešenje su 5–6 dana (segment 02).
- Brz trkač 30 km: lagan na minimumu 4 km, taper dugi 6,1 km (kvalitetni dani ≈ 10 km nose obim); gusta mreža: 22
  plana sa kvalitetnim danom dužim od dugog (HI3).
- R druga struktura bez gornje granice broja deonica (16 × 200 m = 8 × 400 m); RP > T po brzini pri VDOT ~80 (H2).
- Pouka 28 (`recentLongRunKm`) po MASTER-u važi od HM-02 — nije uvedena.
- Udeli zona, 60 % plafona, udeo 40 % i 150 min su heuristike bez merenja na podacima.
