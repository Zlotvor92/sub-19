# 10K v2 — Segment 06g (10k-v2.6.1): trkačka nedelja samo sa danom pred trku, nedelja cela odmor, podela punih testova

Polazni SHA `553bda0` (06f + dopuna). Odluke organizatora posle 06f: (a) trkačka nedelja > taper kad su ostali samo dan
pred trku i trka → upozorenje; (b) pouka 35 u mešovitoj nedelji samo za buduće dane (467 tokova, DECISIONS);
(c) puni testovi > 60 s → delovi ≤ ~40 s (CI run 652: p35 > 120 s). Menjano `tenK/v2/**`, `docs/10k-v2/**`, oznaka
verzije u `e2e/tenk-v2.spec.ts` i `tenKV2Flow.test.tsx`, 13 redova `10K v2` u `marathon/v2/app/byteSame.9443676.json`.

## Izmene (jedan vlasnik)
| mesto | pravilo |
|---|---|
| `week.raceWeekRest` | ni bez svih laganih dana trkačka nije ≤ tapera → svi lagani postaju odmor; dan pred trku i trka ostaju (ne skraćuju se). |
| `week.raceWeekEveOnly` → `validate`, `adaptInvariants` | nedelja samo sa danom pred trku i trkom > tapera: upozorenje RACE_WEEK_OVER_TAPER_EVE (inače greška kao do sada). |
| `validate` D23 | dani odmora trkačke po D23 računaju se i kad je taper mešovit (upisan taper — isti koji čita konstruktor). |
| `validate` Uslov 8 | svi dani trčanja nedelje su dani odmora koraka (bol, A4), ili trkačka samo sa trkom po D23 → WEEK_ALL_REST (upozorenje), ne EMPTY_WEEK (kao HM/maraton N1). |
| `policy` | `10k-v2.6.1`, odluka A19 (+ 467 tokova pouke 35 u mešovitoj nedelji); KNOWN_VERSIONS + `10k-v2.6.0`. |

Primer: `b-d4-11w-18km-v35-B-sat`, bol 8 kraj ned 9, NOV bol 8 sutra — na 6.0 RACE_WEEK_OVER_TAPER (dan pred trku 3,3 km
> taper 3 km); sada trkačka = dan pred trku + trka, upozorenje (`fatigue.node.test.ts`).

## Merenje
- Trajna mreža „nov bol 7/8 svakog dana ned N − 3 … N − 1, nov zapis asOf + 1 … + 7": na 6.0 odbijeno RACE_WEEK_OVER_TAPER,
  EMPTY_WEEK (dve prijave = 6 dana odmora: cela nedelja odmor; trkačka samo sa trkom) i RACE_WEEK (mešovit taper) → 0.
- Regresija prema 06f (`553bda0`): `early.ts 10K 193 97 29` 121 392 toka, 0 odbijanja, 0 prekršaja; `measure-06f.ts`
  269 760 tokova bajt-isto; mreže 04/E/R/P (heševi) bajt-iste; `locked-result.ts 10K` 0/1960; `fatigue-monday.ts`
  tekuća 268, bez novog 28; `fatigue-repeat.ts 10K` 0/0. Menjaju se samo ranije odbijeni tokovi.

## Podela punih testova (pojedinačni test na 553bda0, pun nivo, lokalno)
| test | pre | posle |
|---|---|---|
| `p35` mreža (sve mreže) | jedan test, CI > 120 s | `p35.node` + `p35.{2,3,4}.full` (deo 11–17 s sam, 40 s uz opterećenje); 1854 = 413 + 413 + 514 + 514 |
| mreža E: isti umor + 1 … + 7 | 51 s / deo E | `repeatGrid.harness` 16 delova; deo ≈ 42 s sam (testovi 0,1–13 s) |
| mreža E: umor ned ↔ pon | 81 s / deo E | isto (uzorak: svaki 4. plan) |
| mreža E: zaštićeni dani | 78 s / deo E | isto (svaki 4. plan) |
| mreža E: isti bol + 1 … + 7 | 141 s / deo E | isto (svaki 4. plan) |
| mreža E: nov bol (06g) | 303 s / deo E | isto (svaki 40. plan) |
Pokrivenost p35 ista; mreže ponavljanja (06f/06g) na punom nivou uzorkuju planove (ranije svi; ≈ 43 min).
## Provere
tsc, eslint, prettier čisto; `npm run check` 293 fajla (byteSame posle upisa redova 10K v2 prolazi); pun nivo
repeatGrid 16/16 (96 testova, 4 min 41 s), p35 4/4; E2E 3/3; sabotaže 9/9 (`artifacts/segment-06f/sabotage-06f.json`:
+ RACE_WEEK_OVER_TAPER_EVE kao greška, + nedelja cela odmor kao EMPTY_WEEK). `TEST_FULL=1 --changed 553bda0` 213 fajlova / 1728 testova, 17 min 23 s.
