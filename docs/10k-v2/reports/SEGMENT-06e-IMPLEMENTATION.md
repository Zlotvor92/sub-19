# 10K v2 — Segment 06e (10k-v2.5.2): umor sa asOf pre starta plana (pouka 34); asOf pre starta u trajnoj mreži E

Polazni SHA `bd07eec`. Menjano samo `web/src/domain/generators/tenK/v2/**` i `docs/10k-v2/**`; oznaka verzije u
`web/e2e/tenk-v2.spec.ts` i `web/src/features/onboarding/tenKV2Flow.test.tsx`. Bez PR-a, mergea, deploya.

## Nalaz (organizator, bd07eec) — potvrđen
Umor (2 lagana RPE ≥ 7 u 7 dana) sa asOf = start − 1/− 3/− 6 → 100 % WEEK_INFEASIBLE, npr. `10w-25km-v30-B-sun`
asOf 2026-11-01: „Nedelja 1: nijedan cilj od 12 km naviše ne može da se sastavi po pravilima." Uzrok: `week.ts:226`
(rasterećenje bez poslednjeg dugog → null) i `quality.pickDeload` (stanje doze prazno); `volume.adaptNominal10` je
nedelji 1 bez prethodne izgradnje davao start (100 %), ne 0,8 ×. Validator rasterećenje ned 1 nije proveravao
(`seenSteady` = false).

## Odluka (pouka 34, doslovno)
„umor sa asOf < start → ned 1 je prinudno rasterećenje = 0,8 × planirana ned 1 (sadržaj rasterećenja D5: 1 kvalitet
T ≈ 60 %, dugi 0,8 ×; početnik: sadržaj uvoda, A5/pouka 31); referenca (poslednja izgradnja, poslednji dugi, stanje
doze) = ned 1 generatora bez činjenica; ned 2 = cilj planirane ned 1 (bez rasta), dalje po rasporedu (redovno
rasterećenje odmah posle prinudnog se ukida po A5, kao i do sada). Pouka 4 (bez rasterećenja u ned 1–2) važi za
REDOVNA rasterećenja. Jedno mesto odluke (assess/steps), validator čita isto."

## Mesto (jedan vlasnik)
| fajl | izmena |
|---|---|
| `generate.ts` | `preStartRef(input)`: ned 1 generatora (`construct(input, [])`) → `{buildKm, longKm, tDoseM}` (doza = `quality.deloadLastM` posle ned 1). Jedino računanje reference. `ctxAt` prosleđuje `ctx.preStart` nedelji koraka. |
| `assess.ts` | A5: `ok && n === 1` (asOf pre starta) → `step.preStart = ref` (lenjo, samo tada). Jedina odluka; poruka FATIGUE imenuje 0,8 × i ned 2. |
| `types.ts` | `PreStartRef`, opciono `TenKV2AdaptStep.preStart` (ostali koraci bez polja → bajt-isti). |
| `volume.ts` | `adaptVolume.preStart`; `adaptNominal10`: rasterećenje bez prethodne izgradnje = 0,8 × referenca; sledeća nedelja bez izgradnje = referenca (cilj planirane ned 1, ne start). Validator zove istu funkciju. |
| `week.ts` / `quality.ts` | rasterećenje: dugi i doza iz `ctx.preStart`; `deloadLastM` izdvojen, `pickDeload(…, refM)`; uvod početnika ima prednost (bez kvaliteta); napomena reference. |
| `validate.ts` | D5 sadržaj i dugi rasterećenja ned 1 iz `korak.preStart` (isti podatak kao konstruktor). |
| `adaptInvariants.ts` | nezavisno: ned 1 ≤ 0,8 × planirana ned 1, kvalitet (uvod 0, inače ≤ 1), ned 2 ≤ planirana ned 1. |
| `policy.ts` | `10k-v2.5.2`; dopuna A5. `app/plan.ts`: `KNOWN_VERSIONS` + `10k-v2.5.1`. |

Primer: ned 1 20,0 km (T 2000 m, dugi 6,5 = ⌊0,8 × 8,2⌋), ned 2 25,0 km, ned 3 = planirana ned 2 (26,5).
Početnik `b-d4-10w-18km-e330-A-sun`: ned 1 14,4 km, dugi + 3 lagana, bez kvaliteta; ned 2 18 km (uvod).
Planovi od 8 ned sa testom u ned 2: cilj ned 2 = planirana ned 1 (npr. 33,7, ne 35 koje bi uz test stalo).

## Merenje (`artifacts/segment-06e/measure-06e.ts`; grid + feel + beginner svaki 37. = 496 planova × 3 asOf × 9 scenarija)
| | tokova | odbijeno |
|---|---|---|
| pre (`measure-before-bd07eec.json`) | 13 392 | 1488 — svi `fatigue`, WEEK_INFEASIBLE |
| posle (`measure-after.json`) | 13 392 | **0** |

`compare-before-after.json`: prihvaćenih promenjeno 0, novih odbijanja 0, ispravljeno 1488. Šira provera (2036
planova, svaki 11./5.): ned 2 = cilj planirane ned 1 u 6108/6108; ned 1 bez kvaliteta kod ne-početnika samo 3 dana /
20 km (T 2,0 km > plafon 10 %, D11 ispred D5, napomena).

## Regresija
- Pun nivo tenK/v2 (`TEST_FULL=1`, 38 fajlova): mreže 04, P, R, E i generator bajt-isti (heš bez oznake); jedini pad
  bio je test nepoznate verzije koji je koristio `10k-v2.5.2` kao „nepoznatu" → sada `10k-v2.5.3`.
- N7 + S iz 06d (`segment-06d/measure-06d.ts`, worktree bd07eec prema ovom kodu): 908 496 tokova, svi prihvaćeni pre i
  posle, **0 promenjenih heševa** (`compare-ns-bd07eec.json`).
- Generator bez činjenica: nepromenjena putanja (`steps = []` → bez `preStart`); mreže R/F/B bajt-iste.

## Trajna mreža E
+ asOf start − 1/− 3/− 6 × umor, bol 5, pauza 10, rezultat (trka 5 km, VDOT + 2): 3084 × 12 = 37 008 tokova (ukupno
102 707); regresija prema bd07eec (`segment06e.prestart-hashes-bd07eec.json`: 9252 umora odbijeno, ostalih 27 756
bajt-isto). Brz nivo uzorak (K_PRE = 240) + imenovani: primer gore (eksplicitno), početnik, 3 dana 20 km.
earlyGrid brz nivo 23,7 s (bd07eec 21,5 s, ista mašina, mirno). adaptInvariants: 0.

## Sabotaže (`artifacts/segment-06e/sabotage-06e.json`, alat, `--bail=1`, brz nivo, earlyGrid.node.test.ts)
| sabotaža | rezultat | trajanje |
|---|---|---|
| (a) umor pre starta bez reference generatora (`step.preStart` se ne upisuje) | PAO (0 odbijanja) | 28,8 s |
| (b) ned 2 posle prinudnog sa rastom (`nextBuild10` od reference) | PAO (adaptInvariants) | 28,3 s |
| (c) početnik pri umoru pre starta sa kvalitetom | PAO | 29,8 s |
Ukupno 87,3 s (uz paralelno merenje N7/S); stanje `src` vraćeno (heš isti).

## Komande
Iz `web/`: `node ../docs/10k-v2/artifacts/segment-06e/measure-06e.ts <izlaz> [<koren>]` (pre/posle; 43–47 s);
`node ../docs/10k-v2/artifacts/segment-06d/compare-06d.ts`; `prestart-hashes-06e.ts <wt bd07eec> bd07eec`;
`npx tsc -b --noEmit`, `npx eslint src/domain/generators/tenK/v2`, `npx prettier --check` — čisto; tenK/v2 brz
(23 fajla, 52,9 s uz opterećenje); `TEST_FULL=1 npx vitest run src/domain/generators/tenK/v2` — 38 fajlova prolazi;
`npm run check` — 261 fajl / 3171 test, 7 min 12 s; `npm run check:full` — 345 fajlova / 3436 testova, 32 min;
`npx playwright test e2e/tenk-v2.spec.ts` — 3/3; `node scripts/sabotage.mjs …/sabotage-06e.json` — 3/3.

## Stalni uslovi 1–8
1. Referenca jedno mesto (`preStartRef`), odluka jedno mesto (`assess`), obim jedno mesto (`adaptNominal10`); bez
   petlji. 2. Plafoni nepromenjeni (D11 pre D5 kao inače). 3. WU/CD netaknuti. 4. Uslov poznat unapred (umor pre
   starta) ulazi u konstruktor kroz korak. 5. Handoff: nije diran. 6. Plan nosi `10k-v2.5.2` i fazu nedelje iz
   generatora (faze ne pomera). 7. Nula novih uvoza van foldera (isolation test prolazi). 8. adaptInvariants i E: nedelja
   ≥ minimum, bez praznih treninga, dugi ≥ lagan; nova invarijanta umora pre starta.
