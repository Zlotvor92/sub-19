# Segment 3h — Forma (Napredak) prikazuje broj nedelje sa prefiksom izvora (REVIEW-3 #2)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `0fa8be7`. Bez PR-a, mergea i deploya. Verzija
politike nije menjana (prikaz, ne plan). UI (`FormTenKV2.tsx`, `FormHmV2.tsx`) nije menjan: čita `next.week` iz domena.

## 1. Izmena

| Fajl | Pre | Posle |
|---|---|---|
| `tenK/v2/app/form.ts` | oznaka „— tempo od nedelje ${fromWeek}", `next.week = fromWeek` | `off + fromWeek` u oba; `off = prefixOf(plan)?.offset ?? 0` |
| `halfMarathon/v2/app/form.ts` | isto | isto |
| `fiveK/v2/app/form.ts` | oznaka `fromWeek` (polja `next` nema) | `off + fromWeek` |

Unutrašnje poređenje `fromWeek > week` ostaje u indeksu v2. Bez prefiksa `off = 0` → isti izlaz kao pre. Obrazac je
isti kao 3d/3g (pregled i kalendar `offset + index`).

## 2. Eksperiment (testovi pre izmene, pravi tok predaje)

Nov `form.node.test.ts` u sva tri `app/` foldera. Tok: izvor v2 → pauza 20 d → `preparationForPlan` →
`buildPreparationChoice` (kraća) → plan cilja sa prefiksom → trka u 2. nedelji v2 → adaptacija (tempo od nedelje v2 3)
→ `formHistory`.

| Cilj (izvor) | offset | Forma pre | Kalendar | Posle |
|---|---|---|---|---|
| 10K v2 (HM v2 `d4-16w-40km-v45-A-sun`) | 6 | 3 | 9 | 9 |
| HM v2 (maraton v2, prvi ≥ 16 ned.) | 6 | 3 | 9 | 9 |
| 5K v2 (HM v2 `d3-10w-35km-v30-A-sat`) | 4 | 3 | 7 | 7 |

Nalaz važi za sve tri distance. Test proverava i da nedelja kalendara sa prikazanim brojem počinje na nedelji v2
`fromWeek`. Drugi test: isti plan bez polja prefiksa → broj = `fromWeek`. Pre izmene: **3/6 pada** (sva tri testa sa
prefiksom), posle: 6/6.

`docs/generators-v2/handoff/review3d.measure.ts` **nije na grani** (`git ls-files` prazno), pa `labelMismatch` nije
ponovljen. Zamena su gornji testovi (isti tip slučaja: test posle starta na planu sa prefiksom).

## 3. Sabotaže (`sabotage.mjs`, brz nivo, `--bail=1`)

Ulaz nije u repou (segment sme da menja samo navedene fajlove). Tri sabotaže, svaka vraća `off + ` → bez offset-a:
10K (oznaka i `next`), HM (oznaka i `next`), 5K (oznaka). Svaka je proverena svojim `form.node.test.ts`.
**3/3 palo**, 19 s; stanje `src` posle vraćanja isto.

## 4. Provere (iz `web/`)

| Komanda | Rezultat |
|---|---|
| `tsc -b --noEmit`, eslint, prettier (menjani fajlovi) | exit 0 |
| `npm run check` | **EXIT 0; 305 fajlova, 3574/3574** (11 min 47 s) |
| `npx vitest run --changed 0fa8be7` | 134 fajla, 1317/1317, 4 min 30 s |
| `npx playwright test` handoff-v2, tenk-v2, hm-v2, fivek-v2 | 13/13, 2,2 min |

## 5. Otvoreno

- `review3d.measure.ts` nije na grani; ako ga organizator doda, ponoviti `labelMismatch` (očekivano 0).
- Marathon v2 `form.ts` nije u opsegu: maraton nije cilj predaje „kraća distanca", pa nema prefiks.
