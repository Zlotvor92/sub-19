# Segment 3h — Forma (Napredak) prikazuje broj nedelje sa prefiksom izvora (REVIEW-3 #2)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `0fa8be7`. Verzija politike nije menjana (prikaz).
UI (`FormTenKV2.tsx`, `FormHmV2.tsx`) nije menjan: čita `next.week` iz domena.

## 1. Izmena

| Fajl | Pre | Posle |
|---|---|---|
| `tenK/v2/app/form.ts` | oznaka „— tempo od nedelje ${fromWeek}", `next.week = fromWeek` | `off + fromWeek` u oba; `off = prefixOf(plan)?.offset ?? 0` |
| `halfMarathon/v2/app/form.ts` | isto | isto |
| `fiveK/v2/app/form.ts` | oznaka `fromWeek` (polja `next` nema) | `off + fromWeek` |

Poređenje `fromWeek > week` ostaje u indeksu v2; bez prefiksa `off = 0` → isti izlaz. Obrazac 3d/3g (`offset + index`).

## 2. Eksperiment (testovi pre izmene, pravi tok predaje)

Nov `form.node.test.ts` u sva tri `app/`: izvor v2 → pauza 20 d → `preparationForPlan` → `buildPreparationChoice` →
plan cilja sa prefiksom → trka u 2. nedelji v2 → adaptacija (tempo od nedelje v2 3) → `formHistory`.

| Cilj (izvor) | offset | Forma pre | Kalendar | Posle |
|---|---|---|---|---|
| 10K v2 (HM v2 `d4-16w-40km-v45-A-sun`) | 6 | 3 | 9 | 9 |
| HM v2 (maraton v2, prvi ≥ 16 ned.) | 6 | 3 | 9 | 9 |
| 5K v2 (HM v2 `d3-10w-35km-v30-A-sat`) | 4 | 3 | 7 | 7 |

Nalaz važi za sve tri distance. Test proverava i da nedelja kalendara sa prikazanim brojem počinje na nedelji v2
`fromWeek`. Drugi test: isti plan bez polja prefiksa → broj = `fromWeek`. Pre izmene: **3/6 pada** (sva tri testa sa
prefiksom), posle: 6/6.

`review3d.measure.ts` (stigao pull-om posle commita; privremena kopija sa putanjom izlaza u moj scratchpad, obrisana):
94 cilja 10K v2 sa prefiksom, 30 sa testom, 30 prilagođeno → **`labelMismatch` 0** (bilo 30/30).

## 3. Sabotaže (`sabotage.mjs`, brz nivo, `--bail=1`)

Ulaz nije u repou (opseg fajlova). Bez offset-a: 10K (oznaka, `next`), HM (oznaka, `next`), 5K (oznaka), svaka nad svojim
`form.node.test.ts`: **3/3 palo**, 19 s; stanje `src` posle vraćanja isto.

## 4. Provere (iz `web/`)
| Komanda | Rezultat |
|---|---|
| `tsc -b --noEmit`, eslint, prettier (menjani fajlovi) | exit 0 |
| `npm run check` | **EXIT 0; 305 fajlova, 3574/3574** (11 min 47 s) |
| `npx vitest run --changed 0fa8be7` | 134 fajla, 1317/1317, 4 min 30 s |
| `npx playwright test` handoff-v2, tenk-v2, hm-v2, fivek-v2 | 13/13, 2,2 min |

## 5. Otvoreno
- REVIEW-3 G2, drugi deo (van opsega 3h, domen 10K-06i): poruke jezgra u `reasons`/`needed` pregleda
  (`tenK/v2/assess.ts:315` „od nedelje ${n}" i dr.) i dalje nose v2 indeks.
- Maraton v2 `form.ts` van opsega: maraton nije cilj predaje „kraća distanca" (nema prefiks).
