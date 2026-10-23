# Segment 05b — regresija kapaciteta (5k-v2.4.1)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni commit 349fd64. Nije aktivirano.

## Odluke (DECISIONS 5k-v2.4.1)
1. **3 dana**: dugi ≥ lagan, dugi ≤ 45% nedelje (`days[3].longMaxShare` 0,4 → 0,45) i ≤ 90 min; lagan = ostatak. Lagan ≤ dugi ostaje; kvalitet sad mora biti ≥ 10% nedelje (ne ≥ 20%).
2. **Rupe** (`volume.ts`, jedno mesto): `feasibility()` = tabela izvodljivih ciljeva (iste probe i konstrukcija kao 2.4.0); `capacityKm` = najveći izvodljiv cilj (bez zatvaranja naniže); `fitTargetKm` = najveći izvodljiv ≤ želje, naniže po 0,1 km, za start, izgradnju, rasterećenje i taper (rast se računa od stvarnog cilja). `longStepKm` 0,1 za 3/4/5 dana. Validator (VOLUME_START/DELOAD/TAPER) prihvata cilj koji je `fitTargetKm` od formule.
3. **Vrh ≥ 7b4b574**: 0 slučajeva bez izuzetka. 88 izuzetaka (svi 3 dana; na 7b4b574 vrh-nedelja „lagan = dugi", planirano < cilj): 22/28/35 km × 5K 1197–1830 s, vrh −0,2…−1,6 km. Spisak: `artifacts/segment-05b/peak-exceptions.md`.
- Rupe i dalje postoje (npr. 4 d VDOT 48: 13 ciljeva, 4 d VDOT 50: 2, 3 d VDOT 45: 4) — sada se rešavaju po nedelji.

## Fajlovi
- `fiveK/v2/`: `policy.ts` (verzija, tabela, DECISIONS), `volume.ts` (feasibility, capacityKm, fitTargetKm, planVolume), `validate.ts`, `lengths.ts` (komentari), novi `segment05b.node.test.ts` + fixture `segment05b.peaks-7b4b574.json` (840 vrhova sa 7b4b574, snimljeno skriptom van testa); izmenjeni testovi: `segment02` (verzija), `segment04` (45%), `segment05` (uklonjen test „3 dana ≈ 17,1", test 3 d/30 km bez „start = kapacitet").
- `docs/5k-v2/artifacts/segment-05b/` (isti `inputs.json` kao segment-05, `run.ts` kopiran + tabela kapaciteta), `peak-exceptions.md`; ovaj izveštaj; `STATUS.md`.

## Komande i rezultati (iz `web/`)
- `npx tsc -p tsconfig.domain.json --noEmit` → exit 0; `npx eslint src/domain/generators/fiveK/v2` → exit 0; `npx prettier --check …/v2` → exit 0
- `npx vitest run src/domain/generators/fiveK/v2` → 9 fajlova / 356 testova prolazi
- `segment05b.node.test.ts` na 349fd64 → 6/15 pada (3 d 30 km vrh 17,1; 4 d 45 km vrh 41,3; kapacitet; tabela; `fitTargetKm` ne postoji → regresioni test pada na TypeError, ne na poređenju vrha)
- `npx vitest run --project node src/domain/generators/` → 25 fajlova / 499 testova prolazi (525 s)
- `npm run check` → prvi put exit 2 (TS6133 nekorišćen parametar u `segment05b.node.test.ts`; `tsconfig.domain` ne obuhvata testove), ispravljeno; drugi put exit 0 (185 fajlova / 2128 testova)
- Mreža regular sa rezultatom (840): 828 planova, 12 odbijenih (3 d 12 km, 5K 1100/1197 s, QUALITY_INFEASIBLE — i na 7b4b574/2.4.0), 0 grešaka validatora, 0 „lagan = dugi", 0 PLANNED_BELOW_TARGET; vrh vs 7b4b574: 244 viši, 482 isti, 88 niži (izuzeci), 14 ranije odbijenih → plan; vs 2.4.0: 0 nižih. Bez rezultata / početnik sa i bez rezultata (3 grane × 3/4/5 dana × 120): 0 grešaka, 0 „lagan > dugi", 0 PLANNED_BELOW_TARGET; početnik 5 d = RUN_DAYS_COUNT.

## Kapacitet (km; `capacityKm(pacesFromVdot(v), n)`)
| dana | VDOT 40: 7b4b574 / 2.4.0 / 2.4.1 | VDOT 50 | VDOT 60 |
|---|---|---|---|
| 3 | 32,7 / 17,1 / 31,5 | 38,8 / 17,1 / 37,5 | 45,5 / 17,1 / 40 |
| 4 | 37,7 / 33,8 / 39,2 | 45,5 / 41,3 / 46,7 | 50 / 41,3 / 50 |
| 5 | 54,4 / 55,1 / 55,1 | 62,7 / 64,4 / 64,4 | 71,1 / 65 / 65 |

7b4b574 = formula bez plafona 40/50/65 (vrh plana ga ipak nije prelazio). 3 d VDOT 40/50 ispod 7b4b574: tamo su ti ciljevi davali „lagan = dugi" (dugi na 90 min).

## d3-30km-v48-12w (start 30 → vrh 37,5; 2.4.0: 30 → 17,1 → 17,1)
| ned | faza | km cilj/plan | kvalitet | dugi | lagan max |
|---|---|---|---|---|---|
| 1 | baza | 30 / 30 | R 4 × 300 m | 13,5 | 10,9 |
| 2 | baza | 32,4 / 32,4 | T 2 km | 14,5 | 12,4 |
| 3 | baza | 34,9 / 34,9 | R 4 × 400 m | 15,5 | 13,1 |
| 4 | baza (rast.) | 27,9 / 27,9 | R 4 × 300 m | 12,5 | 9,8 |
| 5 | vrhunac | 37,5 / 37,5 | I 3 × 700 m | 15,5 | 14,94 |
| 6 | vrhunac | 37,5 / 37,5 | I 2 × 1200 m | 15,5 | 14,78 |
| 7 | vrhunac (rast.) | 30 / 30 | I 2 × 1200 m | 13,5 | 9,78 |
| 8 | oštrenje | 37,5 / 37,5 | RP 3 × 800 m | 15,5 | 15 |
| 9 | oštrenje | 37,5 / 37,5 | RP 5 × 500 m | 15,5 | 14,82 |
| 10 | taper | 31,9 / 31,9 | RP 2 × 1000 m | 14,3 | 11,75 |
| 11 | taper | 26,3 / 26,3 | RP 2 × 1000 m | 11,8 | 8,65 |
| 12 | trka | 13,86 / 13,86 | oštrenje 3 × 400 m RP | — | 5,9 |

## Preostalo
1. 45% i „oba trčanja bliske dužine" su heuristika; na vrhu 3 d je lagan 14,8–15 km uz dugi 15,5 km (≈ 90 min) — dva skoro jednaka duga trčanja nedeljno.
2. Rupe postoje (konstrukcija nije monotona: pojas zagrevanja/hlađenja); nedelja u rupi dobija najviše 1,3 km manji cilj od želje (VDOT 30–70, 3/4/5 dana; najveće 4 d VDOT 47, 44,9 → 43,6), bez napomene u planu.
3. 3 d, 12 km, brz trkač (5K ≤ ~20:00): i dalje QUALITY_INFEASIBLE.
4. Ostali preostali problemi Segmenta 05 (3–5) nepromenjeni.
